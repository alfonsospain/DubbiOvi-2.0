import { v4 as uuidv4 } from 'uuid';
import {
  VoiceProvider,
  VoiceCapabilities,
  VoiceDescriptor,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from './types/voice-provider-types';
import { ProviderServiceManager } from './ProviderServiceManager';
import { loadOpenAiApiKey } from './apiKeyStorage';

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '(none)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Validated voices available in OpenAI Text-to-Speech Audio Speech API.
 */
export const OPENAI_VOICES: VoiceDescriptor[] = [
  { id: 'alloy', name: 'Alloy (Neutral)', gender: 'neutral', language: 'EN' },
  { id: 'echo', name: 'Echo (Male)', gender: 'male', language: 'EN' },
  { id: 'fable', name: 'Fable (Neutral / Expressive)', gender: 'neutral', language: 'EN' },
  { id: 'onyx', name: 'Onyx (Deep Male)', gender: 'male', language: 'EN' },
  { id: 'nova', name: 'Nova (Warm Female)', gender: 'female', language: 'EN' },
  { id: 'shimmer', name: 'Shimmer (Clear Female)', gender: 'female', language: 'EN' },
];

export const DEFAULT_OPENAI_VOICE = 'alloy';

/**
 * Helper to save generated binary audio data to local project Audio/ directory.
 */
async function saveGeneratedAudioFile(
  filename: string,
  audioData: Uint8Array | Buffer
): Promise<void> {
  const isElectron = typeof window !== 'undefined' && (window as any).electron?.saveFile !== undefined;
  if (isElectron) {
    try {
      const projectPath =
        typeof (window as any).electron?.getAppSetting === 'function'
          ? await (window as any).electron.getAppSetting('dubbiovi_project_path', '')
          : '';
      const relPath = `Audio/${filename}`;
      const targetPath = projectPath ? `${projectPath}/${relPath}` : relPath;
      await (window as any).electron.saveFile(targetPath, audioData);
    } catch (err) {
      console.error('[OpenAITTSProvider] Electron file save error:', err);
    }
  } else if (typeof window === 'undefined' && typeof process !== 'undefined' && process.versions?.node) {
    try {
      const req = eval('require');
      const fs = req('fs');
      const path = req('path');
      const audioDir = path.join(process.cwd(), 'Audio');
      if (!fs.existsSync(audioDir)) {
        fs.mkdirSync(audioDir, { recursive: true });
      }
      fs.writeFileSync(path.join(audioDir, filename), Buffer.from(audioData));
    } catch (_) {
      // In-memory or virtual test environment
    }
  }
}

/**
 * Independent VoiceProvider implementation for OpenAI Text-to-Speech Audio Speech API.
 */
export class OpenAITTSProvider implements VoiceProvider {
  public readonly id = 'openai';
  public readonly name = 'OpenAI Audio TTS';

  public readonly capabilities: VoiceCapabilities = {
    supportsSpeakingRate: true,
    supportsPitch: false,
    supportsSSML: false,
    supportedFormats: ['mp3', 'wav', 'ogg'],
    supportedSampleRates: [24000],
    isOffline: false,
    requiresApiKey: true,
  };

  /**
   * Checks if OpenAI API key is configured and available.
   */
  public isAvailable(): boolean {
    const key = (
      loadOpenAiApiKey() ||
      (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : '') ||
      ''
    ).trim();
    return key.length > 0;
  }

  /**
   * Discovers available OpenAI voice descriptors.
   */
  public async getAvailableVoices(language?: string): Promise<VoiceDescriptor[]> {
    if (!language) return [...OPENAI_VOICES];
    const normLang = language.trim().toUpperCase();
    return OPENAI_VOICES.map((v) => ({ ...v, language: normLang }));
  }

  /**
   * Canonical synthesis implementation converting VoiceGenerationRequest into VoiceGenerationResult
   * via official OpenAI Audio Speech endpoint (/v1/audio/speech).
   */
  public async synthesize(
    request: VoiceGenerationRequest,
    apiKey?: string
  ): Promise<VoiceGenerationResult> {
    if (!request.text || typeof request.text !== 'string' || request.text.trim().length === 0) {
      throw new Error('Invalid VoiceGenerationRequest: text parameter is required.');
    }

    const key = (
      apiKey ||
      loadOpenAiApiKey() ||
      (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : '') ||
      ''
    ).trim();

    console.log('[Voice Diagnostic] selected provider ID: openai');
    console.log('[Voice Diagnostic] credential storage key requested: dubbiovi_openai_api_key');
    console.log('[Voice Diagnostic] masked credential prefix/suffix supplied:', maskApiKey(key));
    console.log('[Voice Diagnostic] actual provider invoked: OpenAITTSProvider (OpenAI Audio TTS)');

    if (!key) {
      throw new Error('OpenAI API key is required. Please configure your OpenAI API Key in Settings / AI Platforms.');
    }

    const activeModelSetting = await ProviderServiceManager.getServiceModel('openai', 'tts');

    const VALID_OPENAI_VOICES = new Set([
      'alloy',
      'echo',
      'fable',
      'onyx',
      'nova',
      'shimmer',
      'ash',
      'sage',
      'coral',
    ]);

    const VALID_OPENAI_MODELS = new Set(['tts-1', 'tts-1-hd']);

    let modelToUse = (request.modelName || '').trim().toLowerCase();
    if (!VALID_OPENAI_MODELS.has(modelToUse)) {
      const storedModel = (activeModelSetting || '').trim().toLowerCase();
      modelToUse = VALID_OPENAI_MODELS.has(storedModel) ? storedModel : 'tts-1';
    }

    let voiceToUse = (request.voiceId || '').trim().toLowerCase();
    if (!VALID_OPENAI_VOICES.has(voiceToUse)) {
      const storedSetting = (activeModelSetting || '').trim().toLowerCase();
      voiceToUse = VALID_OPENAI_VOICES.has(storedSetting) ? storedSetting : DEFAULT_OPENAI_VOICE;
    }

    const formatToUse: 'mp3' | 'wav' | 'ogg' = request.format || 'mp3';

    // Map ogg/wav/mp3 to OpenAI API response_format parameter ('mp3', 'opus', 'aac', 'flac', 'wav', 'pcm')
    const openAiFormat = formatToUse === 'wav' ? 'wav' : 'mp3';

    const payload = {
      model: modelToUse,
      input: request.text.trim(),
      voice: voiceToUse,
      response_format: openAiFormat,
      speed: request.speakingRate || 1.0,
    };

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      throw new Error(`OpenAI API Connection Error: ${fetchErr.message || String(fetchErr)}`);
    }

    if (!response.ok) {
      const rawText = await response.text();
      let errDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error?.message) {
          errDetail = errJson.error.message;
        }
      } catch (_) {}

      if (response.status === 401) {
        throw new Error(`Invalid OpenAI API Key (HTTP 401). Details: ${errDetail}`);
      } else if (response.status === 429) {
        throw new Error(`OpenAI API rate limit exceeded or quota exhausted (HTTP 429). Details: ${errDetail}`);
      } else {
        throw new Error(`OpenAI Audio Speech API Error (HTTP ${response.status}): ${errDetail}`);
      }
    }

    const contentType = response.headers && typeof response.headers.get === 'function'
      ? response.headers.get('content-type')
      : 'audio/mpeg';
    const arrayBuffer = await response.arrayBuffer();
    const binaryBuffer = Buffer.from(arrayBuffer);
    const hexHeader = binaryBuffer.subarray(0, 12).toString('hex');

    if (binaryBuffer.length < 50) {
      throw new Error('OpenAI TTS API returned an invalid or empty audio response.');
    }

    const resultId = uuidv4();
    const takeId = request.takeId || 'unassigned';
    const cleanTakeId = takeId.replace(/[^a-zA-Z0-9-_]/g, '-');
    const filename = `voice_${cleanTakeId}_${resultId.substring(0, 8)}.${formatToUse}`;
    const relativePath = `Audio/${filename}`;

    console.log('[OpenAI Audio Diagnostics]');
    console.log('  response Content-Type   :', contentType);
    console.log('  requested response_format:', openAiFormat);
    console.log('  byte length             :', binaryBuffer.length);
    console.log('  first 12 bytes (hex)    :', hexHeader);
    console.log('  relative asset path     :', relativePath);
    console.log('  file extension          :', formatToUse);

    await saveGeneratedAudioFile(filename, binaryBuffer);

    const estimatedDuration = Math.max(1.0, parseFloat((request.text.length * 0.065).toFixed(2)));

    return {
      id: resultId,
      takeId,
      relativePath,
      filename,
      format: formatToUse,
      sampleRate: request.sampleRate || 24000,
      durationSeconds: estimatedDuration,
      metadata: {
        generatorProviderId: this.id,
        generatorModelName: modelToUse,
        voiceId: voiceToUse,
        speakerName: voiceToUse,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Backwards-compatibility wrapper delegating to canonical synthesize().
   */
  public async generateVoice(
    request: VoiceGenerationRequest,
    apiKey?: string
  ): Promise<VoiceGenerationResult> {
    return this.synthesize(request, apiKey);
  }
}

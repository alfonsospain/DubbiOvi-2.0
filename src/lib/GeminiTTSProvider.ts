import { v4 as uuidv4 } from 'uuid';
import {
  VoiceProvider,
  VoiceCapabilities,
  VoiceDescriptor,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from './types/voice-provider-types';
import { ProviderServiceManager } from './ProviderServiceManager';
import { loadApiKey } from './apiKeyStorage';

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '(none)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Validated prebuilt voices available in Google Gemini Speech synthesis.
 */
export const GEMINI_PREBUILT_VOICES: VoiceDescriptor[] = [
  { id: 'Puck', name: 'Puck (Neutral)', gender: 'neutral', language: 'EN' },
  { id: 'Charon', name: 'Charon (Deep Male)', gender: 'male', language: 'EN' },
  { id: 'Kore', name: 'Kore (Warm Female)', gender: 'female', language: 'EN' },
  { id: 'Fenrir', name: 'Fenrir (Intense Male)', gender: 'male', language: 'EN' },
  { id: 'Aoede', name: 'Aoede (Clear Female)', gender: 'female', language: 'EN' },
];

export const DEFAULT_GEMINI_VOICE = 'Puck';

/**
 * Helper to wrap raw uncompressed 16-bit PCM audio data into a standard 44-byte RIFF WAV container.
 */
export function wrapPcmInWavHeader(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcmBuffer.length;
  const fileSize = 36 + dataSize;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  header.write('RIFF', 0);
  header.writeUInt32LE(fileSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
  header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

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
      console.error('[GeminiTTSProvider] Electron file save error:', err);
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
 * Independent VoiceProvider implementation for Google Gemini Text-to-Speech API.
 */
export class GeminiTTSProvider implements VoiceProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini TTS';

  public readonly capabilities: VoiceCapabilities = {
    supportsSpeakingRate: false,
    supportsPitch: false,
    supportsSSML: false,
    supportedFormats: ['mp3', 'wav'],
    supportedSampleRates: [24000],
    isOffline: false,
    requiresApiKey: true,
  };

  /**
   * Checks if Gemini API key is configured and available.
   */
  public isAvailable(): boolean {
    const key = (
      loadApiKey() ||
      (typeof process !== 'undefined'
        ? process.env?.GEMINI_API_KEY || process.env?.GOOGLE_API_KEY || process.env?.GOOGLE_GENAI_API_KEY
        : '') ||
      ''
    ).trim();
    return key.length > 0;
  }

  /**
   * Discovers available Gemini voice descriptors.
   */
  public async getAvailableVoices(language?: string): Promise<VoiceDescriptor[]> {
    if (!language) return [...GEMINI_PREBUILT_VOICES];
    const normLang = language.trim().toUpperCase();
    return GEMINI_PREBUILT_VOICES.map((v) => ({ ...v, language: normLang }));
  }

  /**
   * Canonical synthesis implementation converting VoiceGenerationRequest into VoiceGenerationResult
   * via official Google Gemini generateContent text-to-speech API.
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
      loadApiKey() ||
      (typeof process !== 'undefined'
        ? process.env?.GEMINI_API_KEY || process.env?.GOOGLE_API_KEY || process.env?.GOOGLE_GENAI_API_KEY
        : '') ||
      ''
    ).trim();

    console.log('[Voice Diagnostic] selected provider ID: gemini');
    console.log('[Voice Diagnostic] credential storage key requested: dubbiovi_gemini_api_key');
    console.log('[Voice Diagnostic] masked credential prefix/suffix supplied:', maskApiKey(key));
    console.log('[Voice Diagnostic] actual provider invoked: GeminiTTSProvider (Google Gemini TTS)');

    if (!key) {
      throw new Error('Gemini API key is required. Please configure your Gemini API Key in Settings / AI Platforms.');
    }

    const activeModelSetting = await ProviderServiceManager.getServiceModel('gemini', 'tts');

    const VALID_GEMINI_VOICES = new Set(['puck', 'charon', 'kore', 'fenrir', 'aoede']);
    let voiceToUse = (request.voiceId || '').trim();
    if (!VALID_GEMINI_VOICES.has(voiceToUse.toLowerCase())) {
      const storedVoice = (activeModelSetting || '').trim();
      voiceToUse = VALID_GEMINI_VOICES.has(storedVoice.toLowerCase()) ? storedVoice : DEFAULT_GEMINI_VOICE;
    }

    const DEFAULT_GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
    const VALID_GEMINI_TTS_MODELS = new Set([
      'gemini-2.5-flash-preview-tts',
      'gemini-2.5-pro-preview-tts',
      'gemini-3.1-flash-tts-preview',
    ]);

    const rawModel = (request.modelName || activeModelSetting || '').trim();
    let modelToUse = DEFAULT_GEMINI_TTS_MODEL;

    if (rawModel && VALID_GEMINI_TTS_MODELS.has(rawModel)) {
      modelToUse = rawModel;
    } else if (rawModel) {
      console.warn(
        `[GeminiTTSProvider] Invalid or unrecognized Gemini TTS model '${rawModel}' ignored. Falling back to default: '${DEFAULT_GEMINI_TTS_MODEL}'.`
      );
    }

    const payload = {
      contents: [
        {
          parts: [{ text: request.text.trim() }],
        },
      ],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceToUse,
            },
          },
        },
      },
    };

    const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${key}`;
    const loggedUrl = requestUrl.split('?')[0];
    console.log(`[GeminiTTSProvider] Requesting URL: ${loggedUrl}`);

    let response: Response;
    try {
      response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      throw new Error(`Gemini API Connection Error: ${fetchErr.message || String(fetchErr)}`);
    }

    if (!response.ok) {
      const rawText = await response.text();
      console.error(`[GeminiTTSProvider] Complete HTTP Response Body (HTTP ${response.status}):\n${rawText}`);
      let errDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error?.message) {
          errDetail = errJson.error.message;
        }
      } catch (_) {}

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Invalid or unauthorized Gemini API Key (HTTP ${response.status}). Details: ${errDetail}`);
      } else if (response.status === 429) {
        throw new Error(`Gemini API rate limit exceeded (HTTP 429). Details: ${errDetail}`);
      } else {
        throw new Error(`Gemini Voice Generation API Error (HTTP ${response.status}): ${errDetail}`);
      }
    }

    const resJson = await response.json();
    const candidate = resJson?.candidates?.[0];
    const inlineData = candidate?.content?.parts?.[0]?.inlineData;

    if (!inlineData || !inlineData.data || typeof inlineData.data !== 'string') {
      throw new Error('Gemini TTS API returned an invalid or empty audio response.');
    }

    const base64Data = inlineData.data;
    const rawMimeType = (inlineData.mimeType || '').toLowerCase();
    const rawBuffer = Buffer.from(base64Data, 'base64');

    if (rawBuffer.length < 50) {
      throw new Error('Gemini TTS API returned audio payload that is too short or malformed.');
    }

    let finalBuffer: Buffer = rawBuffer;
    let format: 'wav' | 'mp3' | 'ogg' = 'wav';
    let sampleRateToUse = request.sampleRate || 24000;

    if (rawMimeType.includes('l16') || rawMimeType.includes('pcm') || rawMimeType.includes('raw')) {
      const rateMatch = rawMimeType.match(/rate=(\d+)/);
      if (rateMatch) {
        sampleRateToUse = parseInt(rateMatch[1], 10);
      }
      const channelsMatch = rawMimeType.match(/channels=(\d+)/);
      const parsedChannels = channelsMatch ? parseInt(channelsMatch[1], 10) : 1;

      finalBuffer = wrapPcmInWavHeader(rawBuffer, sampleRateToUse, parsedChannels, 16);
      format = 'wav';
    } else if (rawMimeType.includes('mp3') || rawMimeType.includes('mpeg')) {
      format = 'mp3';
    } else if (rawMimeType.includes('ogg')) {
      format = 'ogg';
    } else if (rawMimeType.includes('wav')) {
      format = 'wav';
    } else {
      // Fallback format inspection if mimeType is absent or generic
      const hexHeader = rawBuffer.subarray(0, 4).toString('hex');
      if (hexHeader.startsWith('52494646')) {
        format = 'wav';
      } else if (hexHeader.startsWith('494433') || hexHeader.startsWith('fff3') || hexHeader.startsWith('fffb')) {
        format = 'mp3';
      } else {
        // Default to PCM -> WAV header wrapping for Gemini raw audio
        finalBuffer = wrapPcmInWavHeader(rawBuffer, sampleRateToUse, 1, 16);
        format = 'wav';
      }
    }

    const resultId = uuidv4();
    const takeId = request.takeId || 'unassigned';
    const cleanTakeId = takeId.replace(/[^a-zA-Z0-9-_]/g, '-');
    const filename = `voice_${cleanTakeId}_${resultId.substring(0, 8)}.${format}`;
    const relativePath = `Audio/${filename}`;

    await saveGeneratedAudioFile(filename, finalBuffer);

    // Calculate duration or estimate based on text length
    const estimatedDuration = Math.max(1.0, parseFloat((request.text.length * 0.065).toFixed(2)));

    return {
      id: resultId,
      takeId,
      relativePath,
      filename,
      format,
      sampleRate: sampleRateToUse,
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

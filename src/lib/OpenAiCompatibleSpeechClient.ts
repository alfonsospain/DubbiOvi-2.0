import { v4 as uuidv4 } from 'uuid';
import { VoiceGenerationResult } from './types/voice-provider-types';

export interface OpenAiSpeechSynthesisOptions {
  baseUrl: string;
  model: string;
  text: string;
  voice: string;
  responseFormat?: 'mp3' | 'wav' | 'ogg';
  speed?: number;
  apiKey?: string;
  takeId: string;
  providerId: string;
  projectPath?: string;
}

/**
 * Saves binary audio buffer to local disk under Audio/ directory via Electron IPC or Node fs.
 */
export async function saveGeneratedAudioFile(
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
      console.error('[OpenAiCompatibleSpeechClient] Electron file save error:', err);
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
      // Virtual/test environment fallback
    }
  }
}

/**
 * Reusable HTTP client performing audio synthesis against any OpenAI-compatible speech endpoint (/v1/audio/speech).
 * Supports both cloud endpoints (OpenAI) and local speech servers (Kokoro-FastAPI, Local TTS, XTTS, etc.).
 */
export class OpenAiCompatibleSpeechClient {
  public static async synthesizeSpeech(
    options: OpenAiSpeechSynthesisOptions
  ): Promise<VoiceGenerationResult> {
    if (!options.text || options.text.trim().length === 0) {
      throw new Error('Invalid speech request: text parameter is required.');
    }

    const cleanBaseUrl = options.baseUrl.trim().replace(/\/+$/, '');
    const endpointUrl = cleanBaseUrl.endsWith('/audio/speech')
      ? cleanBaseUrl
      : `${cleanBaseUrl}/audio/speech`;

    const format = options.responseFormat || 'mp3';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (options.apiKey && options.apiKey.trim().length > 0) {
      headers['Authorization'] = `Bearer ${options.apiKey.trim()}`;
    }

    const payload = {
      model: options.model || 'tts-1',
      input: options.text,
      voice: options.voice || 'alloy',
      response_format: format,
      speed: options.speed || 1.0,
    };

    console.log(`[OpenAiCompatibleSpeechClient] Synthesizing speech via ${endpointUrl}...`);

    let response: Response;
    try {
      response = await fetch(endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      throw new Error(
        `Local speech server at ${cleanBaseUrl} is offline or unreachable (${err.message || 'Connection refused'}). Please verify your local speech server (e.g. Kokoro-FastAPI) is running.`
      );
    }

    if (!response.ok) {
      let errText = '';
      try {
        errText = await response.text();
      } catch (_) {}
      throw new Error(
        `OpenAI-compatible speech endpoint returned HTTP ${response.status} (${response.statusText}): ${
          errText || 'Audio synthesis failed.'
        }`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = new Uint8Array(arrayBuffer);

    if (audioBuffer.length === 0) {
      throw new Error('OpenAI-compatible speech endpoint returned an empty 0-byte audio payload.');
    }

    const resultId = uuidv4();
    const filename = `voice_${options.takeId}_${resultId.substring(0, 8)}.${format}`;
    const relativePath = `Audio/${filename}`;

    await saveGeneratedAudioFile(filename, audioBuffer);

    // Derive approximate audio duration based on byte size and format
    let estimatedDurationSeconds = 3.0;
    if (format === 'mp3') {
      estimatedDurationSeconds = Math.max(0.5, Math.round((audioBuffer.length / 16000) * 100) / 100);
    } else if (format === 'wav') {
      estimatedDurationSeconds = Math.max(0.5, Math.round((audioBuffer.length / 48000) * 100) / 100);
    }

    return {
      id: resultId,
      takeId: options.takeId,
      relativePath,
      filename,
      format,
      sampleRate: 24000,
      durationSeconds: estimatedDurationSeconds,
      metadata: {
        generatorProviderId: options.providerId,
        generatorModelName: options.model,
        voiceId: options.voice,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

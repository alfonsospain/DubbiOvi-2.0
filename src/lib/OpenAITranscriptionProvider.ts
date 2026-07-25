import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { formatTime } from './utils';

/**
 * Helper to format seconds into HH:MM:SS.mmm timestamp string.
 */
function formatSecondsToTimestamp(seconds: number): string {
  return formatTime(seconds).replace(',', '.');
}

/**
 * Parser responsible for converting the verbose JSON output from OpenAI Whisper Audio Transcriptions API
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class OpenAIParser {
  public static parse(rawResult: any): TranscriptResult {
    const segments = Array.isArray(rawResult?.segments) ? rawResult.segments : [];
    const detectedLanguage = (rawResult?.language || 'en').toUpperCase();

    // If verbose_json did not return segments array (fallback single text segment)
    if (segments.length === 0 && typeof rawResult?.text === 'string' && rawResult.text.trim().length > 0) {
      const duration = typeof rawResult?.duration === 'number' ? rawResult.duration : 0;
      const startTime = formatSecondsToTimestamp(0);
      const endTime = formatSecondsToTimestamp(duration);

      return {
        detectedLanguage,
        takes: [
          {
            id: uuidv4(),
            character: 'Speaker 1',
            time: `${startTime} - ${endTime}`,
            startSeconds: 0,
            endSeconds: duration,
            original: rawResult.text.trim(),
            translation: '',
            notes: '',
            status: 'Pending',
          },
        ],
        metadata: {
          modelName: 'openai/whisper-1',
        },
      };
    }

    const takes = segments.map((seg: any) => {
      const startSec = typeof seg.start === 'number' ? seg.start : 0;
      const endSec = typeof seg.end === 'number' ? seg.end : startSec;
      const startTime = formatSecondsToTimestamp(startSec);
      const endTime = formatSecondsToTimestamp(endSec);

      return {
        id: uuidv4(),
        character: 'Speaker 1',
        time: `${startTime} - ${endTime}`,
        startSeconds: startSec,
        endSeconds: endSec,
        original: (seg.text || '').trim(),
        translation: '',
        notes: '',
        status: 'Pending' as const,
      };
    });

    return {
      detectedLanguage,
      takes,
      metadata: {
        modelName: 'openai/whisper-1',
      },
    };
  }
}

/**
 * TranscriptionProvider implementation for OpenAI Cloud Whisper Audio Transcriptions API.
 */
export class OpenAITranscriptionProvider implements TranscriptionProvider {
  public readonly id = 'openai-asr';
  public readonly name = 'OpenAI Whisper (Cloud)';
  public readonly capabilities: ProviderCapabilities = {
    supportsLanguageDetection: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'JA', 'ZH', 'IT', 'PT', 'RU', 'KO'],
    supportsWordTimestamps: true,
    supportsSpeakerDiarization: false,
    isOffline: false,
    requiresApiKey: true,
    audio: {
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      normalize: true,
    },
  };

  /**
   * Transcribes a PreparedAudio object using official OpenAI Audio Transcriptions API.
   *
   * @param audio The PreparedAudio container from AudioPreparationService.
   * @param sourceLanguage Optional target language code (e.g., 'en', 'es', or 'Auto-Detect').
   * @param apiKey OpenAI API key passed from secure configuration flow.
   */
  public async transcribe(
    audio: PreparedAudio,
    sourceLanguage?: string,
    apiKey?: string
  ): Promise<TranscriptResult> {
    const key = (apiKey || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : '') || '').trim();
    if (!key) {
      throw new Error('OpenAI API key is required. Please configure your OpenAI API Key in Settings / Services.');
    }

    const formData = new FormData();
    formData.append('file', audio.blob, 'audio.wav');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    if (sourceLanguage && sourceLanguage.toLowerCase() !== 'auto-detect' && sourceLanguage.toLowerCase() !== 'none') {
      formData.append('language', sourceLanguage.toLowerCase());
    }

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
        },
        body: formData,
      });
    } catch (fetchErr: any) {
      throw new Error(`OpenAI API Connection Error: ${fetchErr.message || String(fetchErr)}`);
    }

    if (!response.ok) {
      const rawBodyText = await response.text();
      console.error('[OpenAITranscriptionProvider] Request Failed!');
      console.error('[OpenAITranscriptionProvider] HTTP Status Code:', response.status, response.statusText);
      console.error('[OpenAITranscriptionProvider] RAW Error Response Body:\n', rawBodyText);

      let errDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = JSON.parse(rawBodyText);
        if (errJson?.error?.message) {
          errDetail = errJson.error.message;
        }
      } catch (_) {}

      if (response.status === 401) {
        throw new Error(`Invalid OpenAI API Key (HTTP 401). Details: ${errDetail}`);
      } else if (response.status === 429) {
        throw new Error(`OpenAI API rate limit exceeded or quota exhausted (HTTP 429). Details: ${errDetail}`);
      } else {
        throw new Error(`OpenAI Audio Transcriptions API Error (HTTP ${response.status}): ${errDetail}`);
      }
    }

    const rawJson = await response.json();
    return OpenAIParser.parse(rawJson);
  }
}

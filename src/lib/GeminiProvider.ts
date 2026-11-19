import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { getAudioTranscription } from '@/app/actions';
import { normalizeGeminiTakes } from './gemini-asr-helpers';

/**
 * Parser responsible for converting the raw AI output (AsrOutput) from Gemini
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class GeminiParser {
  public static parse(
    rawResult: { detectedLanguage: string; takes: any[] },
    mediaDuration?: number
  ): TranscriptResult {
    const takes = normalizeGeminiTakes(rawResult?.takes || [], mediaDuration);

    return {
      detectedLanguage: rawResult?.detectedLanguage || 'EN',
      takes,
      metadata: {
        modelName: 'googleai/gemini-3.5-flash-lite',
      }
    };
  }
}

/**
 * TranscriptionProvider implementation for Google Gemini 3.5 Flash-Lite.
 */
export class GeminiProvider implements TranscriptionProvider {
  public readonly id = 'gemini';
  public readonly name = 'Google Gemini';
  public readonly capabilities: ProviderCapabilities = {
    supportsLanguageDetection: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'JA', 'ZH', 'IT', 'PT', 'RU', 'KO'],
    supportsWordTimestamps: true,
    supportsSpeakerDiarization: true,
    isOffline: false,
    requiresApiKey: true,
    audio: {
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      normalize: false,
    }
  };

  /**
   * Transcribes a PreparedAudio object using Gemini via the server-side asrTranscriptionFlow.
   * 
   * @param audio The PreparedAudio container from AudioPreparationService.
   * @param sourceLanguage Optional target language code (or 'Auto-Detect').
   * @param apiKey Optional user-supplied Google Gemini API key.
   */
  public async transcribe(
    audio: PreparedAudio,
    sourceLanguage?: string,
    apiKey?: string
  ): Promise<TranscriptResult> {
    const formData = new FormData();
    formData.append('audio', audio.blob, 'audio.wav');
    if (sourceLanguage) {
      formData.append('sourceLang', sourceLanguage);
    }
    if (apiKey) {
      formData.append('apiKey', apiKey);
    }

    const response: any = await getAudioTranscription(formData);
    if (!response) {
      throw new Error('Transcription failed. No response from AI service.');
    }

    if (response.success === false) {
      throw new Error(response.error || 'Gemini transcription failed.');
    }

    const asrData = response.success === true ? response.data : response;
    return GeminiParser.parse(asrData, audio.duration);
  }
}

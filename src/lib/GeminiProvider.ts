import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { getAudioTranscription } from '@/app/actions';
import { parseTimestampToSeconds } from './utils';

/**
 * Parser responsible for converting the raw AI output (AsrOutput) from Gemini
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class GeminiParser {
  public static parse(rawResult: { detectedLanguage: string; takes: any[] }): TranscriptResult {
    const takes = rawResult.takes.map(t => ({
      id: uuidv4(),
      character: t.character,
      time: `${t.startTime} - ${t.endTime}`,
      startSeconds: parseTimestampToSeconds(t.startTime),
      endSeconds: parseTimestampToSeconds(t.endTime),
      original: t.original,
      translation: '',
      notes: '',
      status: 'Pending' as const,
    }));

    return {
      detectedLanguage: rawResult.detectedLanguage,
      takes,
      metadata: {
        modelName: 'googleai/gemini-2.5-flash',
      }
    };
  }
}

/**
 * TranscriptionProvider implementation for Google Gemini 2.5 Flash.
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

    const response = await getAudioTranscription(formData);
    if (!response) {
      throw new Error('Transcription failed. No response from AI service.');
    }

    return GeminiParser.parse(response);
  }
}

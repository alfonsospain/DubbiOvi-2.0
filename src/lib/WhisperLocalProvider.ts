import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { parseTimestampToSeconds } from './utils';

/**
 * Parser responsible for converting the JSON output from whisper-cli
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class WhisperLocalParser {
  public static parse(rawResult: any): TranscriptResult {
    const transcription = rawResult.result.transcription;
    const detectedLanguage = rawResult.result.language || 'en';

    const takes = transcription.map((segment: any) => {
      // whisper.cpp output timestamps can be e.g. "00:00:02,300"
      // Replace commas with dots for parseTimestampToSeconds compatibility
      const fromTime = segment.timestamps.from.replace(',', '.');
      const toTime = segment.timestamps.to.replace(',', '.');

      return {
        id: uuidv4(),
        character: 'Speaker 1',
        time: `${fromTime} - ${toTime}`,
        startSeconds: parseTimestampToSeconds(fromTime),
        endSeconds: parseTimestampToSeconds(toTime),
        original: segment.text.trim(),
        translation: '',
        notes: '',
        status: 'Pending' as const,
      };
    });

    return {
      detectedLanguage: detectedLanguage.toUpperCase(),
      takes,
      metadata: {
        modelName: rawResult.model || 'local-whisper-model',
      }
    };
  }
}

/**
 * TranscriptionProvider implementation for local whisper.cpp execution.
 */
export class WhisperLocalProvider implements TranscriptionProvider {
  public readonly id = 'whisper-local';
  public readonly name = 'Whisper Local (Offline)';
  public readonly capabilities: ProviderCapabilities = {
    supportsLanguageDetection: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'JA', 'ZH', 'IT', 'PT', 'RU', 'KO'],
    supportsWordTimestamps: true,
    supportsSpeakerDiarization: false,
    isOffline: true,
    audio: {
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      normalize: true,
    }
  };

  private activeModelName?: string;

  /**
   * Constructs the provider with a configurable model name.
   * Defaults to undefined, letting the backend resolve the default model (ggml-tiny.bin).
   * 
   * @param activeModelName The filename of the model (e.g. 'ggml-tiny.bin', 'ggml-base.bin').
   */
  constructor(activeModelName?: string) {
    this.activeModelName = activeModelName;
  }

  /**
   * Transcribes a PreparedAudio object using local whisper.cpp execution via Electron IPC.
   * 
   * @param audio The PreparedAudio container from AudioPreparationService.
   * @param sourceLanguage Optional target language code (or 'Auto-Detect').
   * @param apiKey Not used for local execution.
   */
  public async transcribe(
    audio: PreparedAudio,
    sourceLanguage?: string,
    apiKey?: string
  ): Promise<TranscriptResult> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      throw new Error('Whisper Local is only supported when running inside the desktop app (Electron).');
    }

    // Convert PreparedAudio.blob to ArrayBuffer for IPC transfer
    const arrayBuffer = await audio.blob.arrayBuffer();

    let rawResult;
    try {
      rawResult = await (window as any).electron.runWhisperLocal(arrayBuffer, this.activeModelName);
    } catch (err: any) {
      console.error('Whisper Local transcription error:', err);
      throw new Error(`Whisper Local Error: ${err.message || String(err)}`);
    }

    if (!rawResult || !rawResult.result || !rawResult.result.transcription) {
      throw new Error('Whisper Local failed to generate a valid transcription result.');
    }

    return WhisperLocalParser.parse(rawResult);
  }
}

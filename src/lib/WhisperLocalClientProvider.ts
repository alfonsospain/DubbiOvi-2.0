import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { parseTimestampToSeconds } from './utils';

/**
 * Parser responsible for converting the raw JSON output from whisper-cli / IPC
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class WhisperLocalParser {
  public static parse(rawResult: any): TranscriptResult {
    // If conversion happened inside the Main Process, return TranscriptResult directly
    if (rawResult && Array.isArray(rawResult.takes)) {
      return rawResult as TranscriptResult;
    }

    const transcription = rawResult?.result?.transcription || [];
    const detectedLanguage = rawResult?.result?.language || 'en';

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
 * Client-side TranscriptionProvider implementation for local whisper.cpp execution via Electron IPC.
 * This class contains ZERO Node.js native dependencies (fs, path, os) and is 100% Turbopack/Browser safe.
 */
export class WhisperLocalClientProvider implements TranscriptionProvider {
  public readonly id = 'whisper-local';
  public readonly runtimeId = 'whisper';
  public readonly name = 'Whisper Local (Offline)';
  public readonly capabilities: ProviderCapabilities = {
    supportsLanguageDetection: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'JA', 'ZH', 'IT', 'PT', 'RU', 'KO'],
    supportsWordTimestamps: true,
    supportsSpeakerDiarization: false,
    isOffline: true,
    requiresApiKey: false,
    audio: {
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      normalize: true,
    }
  };

  private activeModelName?: string;
  private targetVersion: string = '1.9.1';

  /**
   * Constructs the client provider with an optional active model name and target version.
   */
  constructor(activeModelName?: string, targetVersion = '1.9.1') {
    this.activeModelName = activeModelName;
    this.targetVersion = targetVersion;
  }

  /**
   * Checks whether the underlying Whisper engine runtime is installed via IPC bridge.
   */
  public async checkRuntimeStatus(version = this.targetVersion): Promise<{ isInstalled: boolean; info?: any }> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      return { isInstalled: false };
    }
    try {
      return await (window as any).electron.checkRuntimeInstalled(this.runtimeId, version);
    } catch (err) {
      console.error('[WhisperLocalClientProvider] Error checking runtime status:', err);
      return { isInstalled: false };
    }
  }

  /**
   * Fetches the catalog descriptor for the Whisper runtime via IPC bridge.
   */
  public async getRuntimeDescriptor(version = this.targetVersion): Promise<any> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) return null;
    return (window as any).electron.getRuntimeDescriptor(this.runtimeId, version);
  }

  /**
   * Requests atomic installation of the Whisper runtime via IPC bridge.
   */
  public async ensureRuntimeInstalled(
    onProgress?: (progress: any) => void,
    version = this.targetVersion
  ): Promise<any> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      throw new Error('Whisper Local runtime installation is only supported inside the desktop app.');
    }

    const status = await this.checkRuntimeStatus(version);
    if (status.isInstalled && status.info) {
      return status.info;
    }

    let unsubProgress: (() => void) | null = null;
    if (onProgress && typeof (window as any).electron.onRuntimeDownloadProgress === 'function') {
      unsubProgress = (window as any).electron.onRuntimeDownloadProgress((data: any) => {
        if (data.runtimeId === this.runtimeId) {
          onProgress(data);
        }
      });
    }

    try {
      const installedInfo = await (window as any).electron.installRuntime(this.runtimeId, version);
      return installedInfo;
    } finally {
      if (unsubProgress) unsubProgress();
    }
  }

  /**
   * Locates the runtime executable through IPC bridge.
   */
  public async getExecutablePath(version = this.targetVersion): Promise<string | null> {
    const status = await this.checkRuntimeStatus(version);
    return status.isInstalled && status.info ? status.info.executablePath : null;
  }

  /**
   * Transcribes a PreparedAudio object using local whisper.cpp execution via Electron IPC.
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

    const status = await this.checkRuntimeStatus();
    if (!status.isInstalled) {
      throw new Error('Whisper Local runtime is missing. Please install the engine runtime first.');
    }

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

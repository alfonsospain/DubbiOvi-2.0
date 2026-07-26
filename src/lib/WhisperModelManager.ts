import { getAppSetting, setAppSetting } from './appSettings';

export interface WhisperModelDescriptor {
  id: string;
  name: string;
  filename: string;
  estimatedSize: string;
  description: string;
}

export const WHISPER_MODEL_STORAGE_KEY = 'dubbiovi_whisper_selected_model';

/**
 * Catalog definition of supported Whisper models.
 * Download URLs and checksums remain in EngineRegistry / LocalEngineManager.
 */
export const SUPPORTED_WHISPER_MODELS: WhisperModelDescriptor[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    filename: 'ggml-tiny.bin',
    estimatedSize: '~75 MB',
    description: 'Fastest transcription speed with lightweight resource usage.',
  },
  {
    id: 'base',
    name: 'Base',
    filename: 'ggml-base.bin',
    estimatedSize: '~142 MB',
    description: 'Balanced speed and transcription accuracy.',
  },
  {
    id: 'small',
    name: 'Small',
    filename: 'ggml-small.bin',
    estimatedSize: '~466 MB',
    description: 'Higher accuracy for multi-speaker or complex audio.',
  },
  {
    id: 'medium',
    name: 'Medium',
    filename: 'ggml-medium.bin',
    estimatedSize: '~1.5 GB',
    description: 'Maximum accuracy precision for demanding spoken audio.',
  },
];

/**
 * Service managing Whisper model metadata, active model selection, and model resolution.
 * Decoupled completely from download logic and hardware recommendation logic.
 */
export class WhisperModelManager {
  public static readonly DEFAULT_MODEL = 'ggml-tiny.bin';

  /**
   * Returns all supported catalog model descriptors.
   */
  public static getAvailableModels(): WhisperModelDescriptor[] {
    return [...SUPPORTED_WHISPER_MODELS];
  }

  /**
   * Resolves a descriptor by filename or model id.
   */
  public static getModelDescriptor(filenameOrId: string): WhisperModelDescriptor | null {
    const clean = (filenameOrId || '').toLowerCase().trim();
    return (
      SUPPORTED_WHISPER_MODELS.find(
        (m) => m.filename.toLowerCase() === clean || m.id.toLowerCase() === clean
      ) || null
    );
  }

  /**
   * Retrieves the currently active selected model filename from AppSettingsService.
   */
  public static async getActiveModelName(): Promise<string> {
    return await getAppSetting<string>(WHISPER_MODEL_STORAGE_KEY, WhisperModelManager.DEFAULT_MODEL);
  }

  /**
   * Persists the active selected model filename to AppSettingsService.
   */
  public static async setActiveModelName(modelName: string): Promise<boolean> {
    const descriptor = WhisperModelManager.getModelDescriptor(modelName);
    const targetFilename = descriptor ? descriptor.filename : modelName;
    return await setAppSetting(WHISPER_MODEL_STORAGE_KEY, targetFilename);
  }

  /**
   * Checks whether a specific model filename exists locally via Electron IPC.
   */
  public static async checkModelInstalled(
    modelName: string
  ): Promise<{ exists: boolean; modelPath: string | null }> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron?.checkEngineModel !== undefined;
    if (!isElectron) {
      return { exists: false, modelPath: null };
    }
    try {
      const res = await (window as any).electron.checkEngineModel('whisper', modelName);
      return { exists: !!res?.exists, modelPath: res?.modelPath || null };
    } catch (err) {
      console.error(`[WhisperModelManager] Error checking model '${modelName}':`, err);
      return { exists: false, modelPath: null };
    }
  }

  /**
   * Queries installation status for all catalog models via IPC.
   */
  public static async getModelsStatus(): Promise<
    Array<WhisperModelDescriptor & { isInstalled: boolean; modelPath: string | null }>
  > {
    const models = WhisperModelManager.getAvailableModels();
    const results = await Promise.all(
      models.map(async (model) => {
        const status = await WhisperModelManager.checkModelInstalled(model.filename);
        return {
          ...model,
          isInstalled: status.exists,
          modelPath: status.modelPath,
        };
      })
    );
    return results;
  }
}

import { ProviderServiceManager } from './ProviderServiceManager';
import { VoiceDescriptor } from './types/voice-provider-types';

export interface PiperModelDescriptor {
  id: string;
  name: string;
  filename: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  estimatedSize: string;
  description: string;
}

/**
 * Catalog of known Piper voice models.
 * Used for catalog listing; dynamic filesystem discovery scans userData/models/piper/.
 */
export const KNOWN_PIPER_MODELS: PiperModelDescriptor[] = [
  {
    id: 'en_US-lessac-high.onnx',
    name: 'English (US) - Lessac High',
    filename: 'en_US-lessac-high.onnx',
    language: 'EN',
    gender: 'female',
    estimatedSize: '~102 MB',
    description: 'High quality American English female voice',
  },
  {
    id: 'es_ES-davefx-medium.onnx',
    name: 'Spanish (ES) - Dave FX Medium',
    filename: 'es_ES-davefx-medium.onnx',
    language: 'ES',
    gender: 'male',
    estimatedSize: '~65 MB',
    description: 'Natural Castilian Spanish male voice',
  },
  {
    id: 'fr_FR-upmc-medium.onnx',
    name: 'French (FR) - UPMC Medium',
    filename: 'fr_FR-upmc-medium.onnx',
    language: 'FR',
    gender: 'female',
    estimatedSize: '~63 MB',
    description: 'Clear French female voice',
  },
];

/**
 * Service managing Piper voice model metadata, dynamic discovery (*.onnx),
 * and active model configuration via ProviderServiceManager.
 */
export class PiperModelManager {
  public static readonly DEFAULT_MODEL = 'en_US-lessac-high.onnx';

  /**
   * Returns all known catalog voice models.
   */
  public static getKnownModels(): PiperModelDescriptor[] {
    return [...KNOWN_PIPER_MODELS];
  }

  /**
   * Normalizes legacy model names to canonical model filenames.
   */
  public static normalizeModelName(filenameOrId: string): string {
    const clean = (filenameOrId || '').toLowerCase().trim();
    if (clean === 'es_ES-dave-medium.onnx' || clean === 'es_es-dave-medium.onnx') {
      return 'es_ES-davefx-medium.onnx';
    }
    return filenameOrId;
  }

  /**
   * Resolves a voice model descriptor by filename or ID.
   */
  public static getModelDescriptor(filenameOrId: string): PiperModelDescriptor | null {
    const target = PiperModelManager.normalizeModelName(filenameOrId);
    const clean = target.toLowerCase().trim();
    return (
      KNOWN_PIPER_MODELS.find(
        (m) => m.filename.toLowerCase() === clean || m.id.toLowerCase() === clean
      ) || null
    );
  }

  /**
   * Retrieves active Piper model filename from ProviderServiceManager ('piper', 'tts').
   */
  public static async getActiveModelName(): Promise<string> {
    const raw = await ProviderServiceManager.getServiceModel('piper', 'tts');
    const normalized = PiperModelManager.normalizeModelName(raw);
    if (normalized !== raw) {
      await ProviderServiceManager.setServiceModel('piper', 'tts', normalized);
    }
    return normalized;
  }

  /**
   * Persists active Piper model filename via ProviderServiceManager ('piper', 'tts').
   */
  public static async setActiveModelName(modelName: string): Promise<boolean> {
    const normalized = PiperModelManager.normalizeModelName(modelName);
    const descriptor = PiperModelManager.getModelDescriptor(normalized);
    const targetFilename = descriptor ? descriptor.filename : normalized;
    return await ProviderServiceManager.setServiceModel('piper', 'tts', targetFilename);
  }

  /**
   * Dynamically discovers installed model files for Piper via Electron IPC.
   * Scans userData/models/piper/ for *.onnx files.
   */
  public static async listInstalledModels(): Promise<Array<{ id: string; filename: string; path: string }>> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron?.listModels !== undefined;
    if (!isElectron) {
      return [];
    }
    try {
      const res = await (window as any).electron.listModels('piper');
      return Array.isArray(res) ? res : [];
    } catch (err) {
      console.error('[PiperModelManager] Error listing models:', err);
      return [];
    }
  }

  /**
   * Dynamically discovers and maps installed models to VoiceDescriptor objects for TTS generation.
   */
  public static async discoverVoiceDescriptors(targetLanguage?: string): Promise<VoiceDescriptor[]> {
    const known = PiperModelManager.getKnownModels();
    const installed = await PiperModelManager.listInstalledModels();

    const installedFilenames = new Set(installed.map((i) => i.filename.toLowerCase()));

    // Merge known models with any dynamically discovered *.onnx files
    const availableDescriptors: VoiceDescriptor[] = [];

    for (const m of known) {
      const langUpper = m.language.toUpperCase();
      if (!targetLanguage || langUpper === targetLanguage.toUpperCase() || targetLanguage === 'Auto-Detect') {
        availableDescriptors.push({
          id: m.filename,
          name: `${m.name} ${installedFilenames.has(m.filename.toLowerCase()) ? '(Installed)' : ''}`.trim(),
          gender: m.gender,
          language: langUpper,
          sampleRate: 22050,
        });
      }
    }

    // Include dynamically discovered models that weren't in default known list
    for (const inst of installed) {
      if (!known.some((k) => k.filename.toLowerCase() === inst.filename.toLowerCase())) {
        availableDescriptors.push({
          id: inst.filename,
          name: `${inst.filename.replace('.onnx', '')} (Installed)`,
          gender: 'neutral',
          language: (targetLanguage || 'EN').toUpperCase(),
          sampleRate: 22050,
        });
      }
    }

    return availableDescriptors;
  }
}

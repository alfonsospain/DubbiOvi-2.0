import { ProviderServiceManager } from './ProviderServiceManager';
import { VoiceDescriptor } from './types/voice-provider-types';
import { LanguageRegistry } from './languages/LanguageRegistry';

export interface PiperModelDescriptor {
  id: string;
  name: string;
  filename: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  estimatedSize: string;
  description: string;
}

const PIPER_LANGUAGE_VOICES_STORAGE_KEY = 'dubbiovi_piper_language_voices';

/**
 * Catalog of known Piper voice models across multiple languages.
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
    id: 'en_US-amy-medium.onnx',
    name: 'English (US) - Amy Medium',
    filename: 'en_US-amy-medium.onnx',
    language: 'EN',
    gender: 'female',
    estimatedSize: '~60 MB',
    description: 'Clear American English female voice',
  },
  {
    id: 'en_GB-alan-medium.onnx',
    name: 'English (UK) - Alan Medium',
    filename: 'en_GB-alan-medium.onnx',
    language: 'EN',
    gender: 'male',
    estimatedSize: '~64 MB',
    description: 'Natural British English male voice',
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
    id: 'es_MX-ald-medium.onnx',
    name: 'Spanish (MX) - Ald Medium',
    filename: 'es_MX-ald-medium.onnx',
    language: 'ES',
    gender: 'male',
    estimatedSize: '~58 MB',
    description: 'Mexican Spanish male voice',
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
  {
    id: 'de_DE-thorsten-high.onnx',
    name: 'German (DE) - Thorsten High',
    filename: 'de_DE-thorsten-high.onnx',
    language: 'DE',
    gender: 'male',
    estimatedSize: '~115 MB',
    description: 'High quality German male voice',
  },
  {
    id: 'it_IT-riccardo-x_low.onnx',
    name: 'Italian (IT) - Riccardo Low',
    filename: 'it_IT-riccardo-x_low.onnx',
    language: 'IT',
    gender: 'male',
    estimatedSize: '~28 MB',
    description: 'Lightweight Italian male voice',
  },
  {
    id: 'pt_BR-edresson-low.onnx',
    name: 'Portuguese (BR) - Edresson Low',
    filename: 'pt_BR-edresson-low.onnx',
    language: 'PT',
    gender: 'male',
    estimatedSize: '~29 MB',
    description: 'Brazilian Portuguese male voice',
  },
  {
    id: 'zh_CN-huayan-medium.onnx',
    name: 'Chinese (CN) - Huayan Medium',
    filename: 'zh_CN-huayan-medium.onnx',
    language: 'ZH',
    gender: 'female',
    estimatedSize: '~66 MB',
    description: 'Standard Mandarin female voice',
  },
];

/**
 * Service managing Piper voice model metadata, dynamic discovery (*.onnx),
 * Language -> Preferred Voice mapping, and active model configuration.
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
   * Retrieves stored Language -> Preferred Voice map from localStorage.
   */
  public static getLanguageVoiceMapping(): Record<string, string> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(PIPER_LANGUAGE_VOICES_STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  /**
   * Sets preferred voice for a specific language (e.g., 'EN' -> 'en_US-lessac-high.onnx', 'IT' -> 'it_IT-riccardo-x_low.onnx').
   */
  public static async setPreferredVoiceForLanguage(language: string, modelName: string): Promise<boolean> {
    const normLang = LanguageRegistry.normalizeCode(language).toUpperCase();
    const normalizedModel = PiperModelManager.normalizeModelName(modelName);

    // Verify model is installed
    const installed = await PiperModelManager.listInstalledModels();
    const isInstalled = installed.some((i) => i.filename.toLowerCase() === normalizedModel.toLowerCase());

    if (!isInstalled) {
      throw new Error(`Cannot set preferred voice '${normalizedModel}': model is not installed on disk. Please download it first.`);
    }

    if (typeof window !== 'undefined') {
      try {
        const mapping = PiperModelManager.getLanguageVoiceMapping();
        mapping[normLang] = normalizedModel;
        localStorage.setItem(PIPER_LANGUAGE_VOICES_STORAGE_KEY, JSON.stringify(mapping));
      } catch (err) {
        console.error('[PiperModelManager] Error saving language voice mapping:', err);
      }
    }

    // Set as global active model for backward compatibility
    await ProviderServiceManager.setServiceModel('piper', 'tts', normalizedModel);
    return true;
  }

  /**
   * Resolves the preferred Piper voice model for a given target language (e.g., 'IT', 'ES', 'EN').
   * 1. Checks explicit Language -> Preferred Voice mapping in dubbiovi_piper_language_voices.
   * 2. If unmapped, checks for any installed model matching that language code on disk.
   * 3. Fallback: returns active installed model or default installed model.
   */
  public static async getVoiceForLanguage(targetLanguage?: string): Promise<string> {
    const installed = await PiperModelManager.listInstalledModels();
    if (installed.length === 0) {
      return '';
    }

    const normLang = LanguageRegistry.normalizeCode(targetLanguage).toUpperCase();

    // 1. Check explicit mapping
    const mapping = PiperModelManager.getLanguageVoiceMapping();
    const mappedModel = mapping[normLang];

    if (mappedModel) {
      const isMappedInstalled = installed.some((i) => i.filename.toLowerCase() === mappedModel.toLowerCase());
      if (isMappedInstalled) {
        return mappedModel;
      }
    }

    // 2. Check installed models matching target language code
    const matchingInstalled = installed.find((inst) => {
      const desc = PiperModelManager.getModelDescriptor(inst.filename);
      if (desc && desc.language.toUpperCase() === normLang) {
        return true;
      }
      return inst.filename.toLowerCase().startsWith(normLang.toLowerCase());
    });

    if (matchingInstalled) {
      return matchingInstalled.filename;
    }

    // 3. Fallback: default active installed model or first installed model
    const globalActive = await PiperModelManager.getActiveModelName();
    if (globalActive && installed.some((i) => i.filename.toLowerCase() === globalActive.toLowerCase())) {
      return globalActive;
    }

    return installed[0].filename;
  }

  /**
   * Retrieves active Piper model filename from ProviderServiceManager ('piper', 'tts').
   * Verifies that the returned model is installed on disk. If invalid or uninstalled,
   * recovers safely by selecting a valid installed model or returning empty string ('').
   */
  public static async getActiveModelName(): Promise<string> {
    const raw = await ProviderServiceManager.getServiceModel('piper', 'tts');
    const normalized = PiperModelManager.normalizeModelName(raw);

    const installed = await PiperModelManager.listInstalledModels();
    const isInstalled = (filename: string) =>
      installed.some((i) => i.filename.toLowerCase() === filename.toLowerCase());

    // If normalized model is installed on disk, keep it
    if (normalized && isInstalled(normalized)) {
      if (normalized !== raw) {
        await ProviderServiceManager.setServiceModel('piper', 'tts', normalized);
      }
      return normalized;
    }

    // Safe Recovery: Stored model is uninstalled or invalid
    if (installed.length > 0) {
      const validInstalled = installed[0].filename;
      console.warn(`[PiperModelManager] Persisted active model '${raw}' is not installed on disk. Recovering with installed model '${validInstalled}'.`);
      await ProviderServiceManager.setServiceModel('piper', 'tts', validInstalled);
      return validInstalled;
    }

    return normalized || KNOWN_PIPER_MODELS[0].filename;
  }

  /**
   * Persists active Piper model filename via ProviderServiceManager ('piper', 'tts').
   * Ensures catalog-only/uninstalled models cannot be set active.
   */
  public static async setActiveModelName(modelName: string): Promise<boolean> {
    const normalized = PiperModelManager.normalizeModelName(modelName);
    const descriptor = PiperModelManager.getModelDescriptor(normalized);
    const targetFilename = descriptor ? descriptor.filename : normalized;

    const installed = await PiperModelManager.listInstalledModels();
    const isInstalled = installed.some((i) => i.filename.toLowerCase() === targetFilename.toLowerCase());

    if (!isInstalled) {
      throw new Error(`Cannot activate model '${targetFilename}': model is not installed on disk. Please download it first.`);
    }

    // Determine model language if known and save preference
    if (descriptor && descriptor.language) {
      const mapping = PiperModelManager.getLanguageVoiceMapping();
      mapping[descriptor.language.toUpperCase()] = targetFilename;
      if (typeof window !== 'undefined') {
        localStorage.setItem(PIPER_LANGUAGE_VOICES_STORAGE_KEY, JSON.stringify(mapping));
      }
    }

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

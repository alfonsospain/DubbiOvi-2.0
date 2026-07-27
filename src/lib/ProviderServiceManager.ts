import { ProviderServiceDescriptor, ServiceCategory } from './types/ProviderServiceTypes';
import { getAppSetting, setAppSetting } from './appSettings';

export const PROVIDER_SERVICE_MODELS_SETTING_KEY = 'dubbiovi_provider_service_models';

/**
 * Service managing service-level model configurations per provider.
 * Allows providers (Gemini, OpenAI, Ollama, Piper, etc.) to expose independent models
 * for ASR, MT, TTS, and LLM services while preserving a unified provider configuration.
 */
export class ProviderServiceManager {
  private static descriptors: Map<string, ProviderServiceDescriptor> = new Map();

  /**
   * Generates internal lookup key for a provider service capability.
   */
  private static makeKey(providerId: string, serviceType: ServiceCategory): string {
    return `${providerId.toLowerCase()}:${serviceType.toLowerCase()}`;
  }

  /**
   * Registers a service capability descriptor for a provider.
   */
  public static registerCapability(descriptor: ProviderServiceDescriptor): void {
    if (!descriptor.providerId || !descriptor.serviceType || !descriptor.defaultModel) {
      throw new Error('Invalid ProviderServiceDescriptor. Fields required: providerId, serviceType, defaultModel.');
    }
    const key = ProviderServiceManager.makeKey(descriptor.providerId, descriptor.serviceType);
    ProviderServiceManager.descriptors.set(key, { ...descriptor });
  }

  /**
   * Registers default known service capabilities across providers.
   */
  public static registerDefaults(): void {
    // 1. Gemini Provider Services
    ProviderServiceManager.registerCapability({
      providerId: 'gemini',
      serviceType: 'asr',
      defaultModel: 'gemini-2.5-flash',
      supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      description: 'Gemini Speech Recognition ASR model',
    });
    ProviderServiceManager.registerCapability({
      providerId: 'gemini',
      serviceType: 'mt',
      defaultModel: 'gemini-2.5-flash',
      supportedModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      description: 'Gemini Machine Translation MT model',
    });
    ProviderServiceManager.registerCapability({
      providerId: 'gemini',
      serviceType: 'tts',
      defaultModel: 'gemini-2.5-flash-tts',
      supportedModels: ['gemini-2.5-flash-tts'],
      description: 'Gemini Voice Generation TTS model',
    });

    // 2. OpenAI Provider Services
    ProviderServiceManager.registerCapability({
      providerId: 'openai',
      serviceType: 'asr',
      defaultModel: 'whisper-1',
      supportedModels: ['whisper-1'],
      description: 'OpenAI Whisper ASR model',
    });
    ProviderServiceManager.registerCapability({
      providerId: 'openai',
      serviceType: 'mt',
      defaultModel: 'gpt-4o-mini',
      supportedModels: ['gpt-4o-mini', 'gpt-4o'],
      description: 'OpenAI GPT Translation MT model',
    });
    ProviderServiceManager.registerCapability({
      providerId: 'openai',
      serviceType: 'tts',
      defaultModel: 'tts-1',
      supportedModels: ['tts-1', 'tts-1-hd'],
      description: 'OpenAI Voice Synthesis TTS model',
    });

    // 3. Ollama Provider Services
    ProviderServiceManager.registerCapability({
      providerId: 'ollama',
      serviceType: 'mt',
      defaultModel: 'llama3:8b',
      supportedModels: ['llama3:8b', 'mistral:7b', 'gemma:7b'],
      description: 'Ollama local translation model',
    });
    ProviderServiceManager.registerCapability({
      providerId: 'ollama',
      serviceType: 'tts',
      defaultModel: 'bark:small',
      supportedModels: ['bark:small', 'piper-local'],
      description: 'Ollama local voice generation model',
    });

    // 4. Piper Local Engine Services (TTS)
    ProviderServiceManager.registerCapability({
      providerId: 'piper',
      serviceType: 'tts',
      defaultModel: 'en_US-lessac-high.onnx',
      supportedModels: ['en_US-lessac-high.onnx', 'es_ES-davefx-medium.onnx', 'fr_FR-upmc-medium.onnx'],
      description: 'Piper neural fast local TTS model',
    });
  }

  /**
   * Retrieves all registered service capabilities for a provider.
   */
  public static getCapabilitiesForProvider(providerId: string): ProviderServiceDescriptor[] {
    const cleanId = providerId.toLowerCase();
    return Array.from(ProviderServiceManager.descriptors.values()).filter(
      (d) => d.providerId.toLowerCase() === cleanId
    );
  }

  /**
   * Resolves the active model configured for a specific provider and service category.
   */
  public static async getServiceModel(
    providerId: string,
    serviceType: ServiceCategory
  ): Promise<string> {
    const key = ProviderServiceManager.makeKey(providerId, serviceType);
    const descriptor = ProviderServiceManager.descriptors.get(key);
    const defaultModel = descriptor ? descriptor.defaultModel : '';

    const storedConfigs = await getAppSetting<Record<string, string>>(
      PROVIDER_SERVICE_MODELS_SETTING_KEY,
      {}
    );

    return storedConfigs[key] || defaultModel;
  }

  /**
   * Persists an active model selection for a specific provider service category.
   */
  public static async setServiceModel(
    providerId: string,
    serviceType: ServiceCategory,
    modelName: string
  ): Promise<boolean> {
    const key = ProviderServiceManager.makeKey(providerId, serviceType);
    const storedConfigs = await getAppSetting<Record<string, string>>(
      PROVIDER_SERVICE_MODELS_SETTING_KEY,
      {}
    );

    const updated = {
      ...storedConfigs,
      [key]: modelName,
    };

    return await setAppSetting(PROVIDER_SERVICE_MODELS_SETTING_KEY, updated);
  }
}

// Auto-register default provider service capabilities
ProviderServiceManager.registerDefaults();

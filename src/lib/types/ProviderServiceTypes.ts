export type ServiceCategory = 'asr' | 'mt' | 'tts' | 'llm';

export interface ProviderServiceDescriptor {
  providerId: string;
  serviceType: ServiceCategory;
  defaultModel: string;
  supportedModels: string[];
  description?: string;
}

export type ProviderServiceModelConfig = Record<string, string>;

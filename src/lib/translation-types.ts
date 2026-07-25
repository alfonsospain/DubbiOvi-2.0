import { GlossaryEntry } from './types';

export interface TranslationProviderMetadata {
  modelName: string;
  providerId: string;
  latencyMs?: number;
  tokensUsed?: number;
}

export interface TranslationCapabilities {
  supportsGlossary: boolean;
  supportsBatchTranslation: boolean;
  supportedLanguages: string[];
  isOffline: boolean;
  requiresApiKey: boolean;
}

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  glossary?: GlossaryEntry[];
  options?: Record<string, any>;
}

export interface TranslationResult {
  translation: string;
  sourceLanguage: string;
  targetLanguage: string;
  metadata: TranslationProviderMetadata;
}

export interface TranslationProvider {
  id: string;
  name: string;
  capabilities: TranslationCapabilities;
  translate(request: TranslationRequest, apiKey?: string): Promise<TranslationResult>;
}

import {
  TranslationProvider,
  TranslationCapabilities,
  TranslationRequest,
  TranslationResult,
} from './translation-types';
import { OllamaClient } from './OllamaClient';
import { LanguageRegistry } from './languages/LanguageRegistry';

export interface OllamaTranslationProviderConfig {
  baseUrl?: string;
  model?: string;
}

export class OllamaTranslationProvider implements TranslationProvider {
  public id = 'ollama-mt';
  public name = 'Ollama (Local LLM)';

  public capabilities: TranslationCapabilities = {
    supportsGlossary: true,
    supportsBatchTranslation: false,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'JA', 'ZH', 'KO', 'RU', 'AST'],
    isOffline: true,
    requiresApiKey: false,
  };

  private baseUrl: string;
  private model: string;

  constructor(config: OllamaTranslationProviderConfig = {}) {
    this.baseUrl = (config.baseUrl && config.baseUrl.trim()) ? config.baseUrl.trim() : 'http://localhost:11434';
    this.model = (config.model && config.model.trim()) ? config.model.trim() : '';
  }

  public async translate(
    request: TranslationRequest,
    _apiKey?: string
  ): Promise<TranslationResult> {
    const startTime = Date.now();
    const client = new OllamaClient(this.baseUrl);

    let modelToUse = request.options?.model || this.model;

    if (!modelToUse) {
      try {
        const availableModels = await client.listModels();
        if (availableModels.length > 0) {
          modelToUse = availableModels[0].name;
        }
      } catch (err) {
        console.warn('[OllamaTranslationProvider] Model auto-discovery failed:', err);
      }
    }

    if (!modelToUse) {
      modelToUse = 'llama3:8b';
    }

    const targetDesc = LanguageRegistry.getLanguageByCode(request.targetLanguage);
    const targetName = targetDesc ? targetDesc.name : request.targetLanguage;

    let sourceName = 'auto-detected language';
    if (request.sourceLanguage) {
      const srcClean = request.sourceLanguage.trim().toLowerCase();
      if (srcClean !== 'auto-detect' && srcClean !== 'auto' && srcClean !== 'none' && srcClean !== 'auto-detected language') {
        const srcDesc = LanguageRegistry.getLanguageByCode(request.sourceLanguage);
        sourceName = srcDesc ? srcDesc.name : request.sourceLanguage;
      }
    }

    let prompt = `Translate the following text from ${sourceName} to ${targetName}.\n\nOriginal Text:\n${request.text}\n\nTranslation:`;

    if (request.glossary && request.glossary.length > 0) {
      const glossaryLines = request.glossary
        .map((entry) => `- "${entry.sourceTerm}" -> "${entry.targetTerm}"`)
        .join('\n');
      prompt = `Apply the following terminology glossary strictly:\n${glossaryLines}\n\n${prompt}`;
    }

    const systemPrompt = `You are an expert audio-visual subtitle and dubbing translator.
Translate text accurately from ${sourceName} to ${targetName}.
Provide ONLY the direct translation. Do not include markdown code blocks, intro text, explanations, or quotes.`;

    const response = await client.generateCompletion(prompt, {
      model: modelToUse,
      system: systemPrompt,
      temperature: 0.2,
      keepAlive: '5m', // Unload model after 5m of inactivity for 8 GB RAM machines
      timeoutMs: request.options?.timeoutMs || 120000, // 120s timeout for 8 GB RAM model loading
    });

    let translatedText = response.text.trim();

    // Post-process: strip surrounding quotes if model wrapped its output in quotes
    if (
      (translatedText.startsWith('"') && translatedText.endsWith('"')) ||
      (translatedText.startsWith('“') && translatedText.endsWith('”'))
    ) {
      translatedText = translatedText.slice(1, -1).trim();
    }

    // Secondary enforcement check for glossary terms
    if (request.glossary) {
      for (const entry of request.glossary) {
        if (entry.sourceTerm && entry.targetTerm) {
          const regex = new RegExp(`\\b${entry.sourceTerm}\\b`, 'gi');
          translatedText = translatedText.replace(regex, entry.targetTerm);
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    return {
      translation: translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      metadata: {
        modelName: response.model || modelToUse,
        providerId: this.id,
        latencyMs,
      },
    };
  }
}

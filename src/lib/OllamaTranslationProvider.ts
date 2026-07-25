import {
  TranslationProvider,
  TranslationCapabilities,
  TranslationRequest,
  TranslationResult,
} from './translation-types';
import { OllamaClient } from './OllamaClient';

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
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'JA', 'ZH', 'KO', 'RU'],
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

    console.log('[OllamaTranslationProvider] translate() invoked:');
    console.log(`  - Config Base URL : ${this.baseUrl}`);
    console.log(`  - Config Model    : ${this.model || '(empty - auto-detecting)'}`);
    console.log(`  - Request Language : ${request.sourceLanguage} -> ${request.targetLanguage}`);

    let modelToUse = request.options?.model || this.model;

    if (!modelToUse) {
      console.log('[OllamaTranslationProvider] No active model specified in config. Attempting auto-discovery from daemon tags...');
      try {
        const availableModels = await client.listModels();
        if (availableModels.length > 0) {
          modelToUse = availableModels[0].name;
          console.log(`  - Auto-discovered active model: ${modelToUse}`);
        }
      } catch (err) {
        console.warn('  - Model auto-discovery failed:', err);
      }
    }

    if (!modelToUse) {
      modelToUse = 'llama3:8b';
    }

    let prompt = `Translate the following text from ${request.sourceLanguage} to ${request.targetLanguage}.\n\nOriginal Text:\n${request.text}\n\nTranslation:`;

    if (request.glossary && request.glossary.length > 0) {
      const glossaryLines = request.glossary
        .map((entry) => `- "${entry.sourceTerm}" -> "${entry.targetTerm}"`)
        .join('\n');
      prompt = `Apply the following terminology glossary strictly:\n${glossaryLines}\n\n${prompt}`;
    }

    const systemPrompt = `You are an expert audio-visual subtitle and dubbing translator.
Translate text accurately from ${request.sourceLanguage} to ${request.targetLanguage}.
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

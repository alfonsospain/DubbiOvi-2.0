import { TranslationProvider } from './translation-types';
import { OllamaTranslationProvider } from './OllamaTranslationProvider';
import { GeminiTranslationProvider } from './GeminiTranslationProvider';
import { DeepLTranslationProvider } from './DeepLTranslationProvider';
import { OpenAITranslationProvider } from './OpenAITranslationProvider';

class TranslationProviderRegistryClass {
  private providers: Map<string, TranslationProvider> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const ollama = new OllamaTranslationProvider();
    const gemini = new GeminiTranslationProvider();
    const deepl = new DeepLTranslationProvider();
    const openai = new OpenAITranslationProvider();

    this.registerProvider(ollama);
    this.registerProvider(gemini);
    this.registerProvider(deepl);
    this.registerProvider(openai);

    // Register Aliases
    this.aliasMap.set('ollama', 'ollama-mt');
    this.aliasMap.set('ollama llm', 'ollama-mt');
    this.aliasMap.set('ollama (local llm)', 'ollama-mt');

    this.aliasMap.set('gemini', 'gemini-mt');
    this.aliasMap.set('gemini (google cloud)', 'gemini-mt');
    this.aliasMap.set('google', 'gemini-mt');

    this.aliasMap.set('deepl', 'deepl');
    this.aliasMap.set('deepl (cloud api)', 'deepl');

    this.aliasMap.set('openai', 'openai-mt');
    this.aliasMap.set('openai (cloud gpt)', 'openai-mt');
    this.aliasMap.set('gpt', 'openai-mt');
  }

  public registerProvider(provider: TranslationProvider): void {
    this.providers.set(provider.id, provider);
  }

  public getProvider(idOrAlias: string): TranslationProvider | undefined {
    if (!idOrAlias) return undefined;
    const normalizedKey = idOrAlias.toLowerCase().trim();
    const resolvedId = this.aliasMap.get(normalizedKey) || normalizedKey;
    return this.providers.get(resolvedId);
  }

  public getAllProviders(): TranslationProvider[] {
    return Array.from(this.providers.values());
  }
}

export const TranslationProviderRegistry = new TranslationProviderRegistryClass();

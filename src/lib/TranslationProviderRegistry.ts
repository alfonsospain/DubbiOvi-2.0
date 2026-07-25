import { TranslationProvider } from './translation-types';
import { OllamaTranslationProvider } from './OllamaTranslationProvider';

class TranslationProviderRegistryClass {
  private providers: Map<string, TranslationProvider> = new Map();
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    const ollama = new OllamaTranslationProvider();
    this.registerProvider(ollama);

    // Register Aliases
    this.aliasMap.set('ollama', 'ollama-mt');
    this.aliasMap.set('ollama llm', 'ollama-mt');
    this.aliasMap.set('ollama (local llm)', 'ollama-mt');
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

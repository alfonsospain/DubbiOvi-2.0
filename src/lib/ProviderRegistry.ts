import { TranscriptionProvider } from './transcription-types';
import { GeminiProvider } from './GeminiProvider';
import { WhisperLocalClientProvider } from './WhisperLocalClientProvider';
import { OpenAITranscriptionProvider } from './OpenAITranscriptionProvider';

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private providers: Map<string, TranscriptionProvider> = new Map();

  public constructor() {
    // Auto-register default client providers (browser/Turbopack safe)
    this.register(new GeminiProvider());
    this.register(new WhisperLocalClientProvider());
    this.register(new OpenAITranscriptionProvider());
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public register(provider: TranscriptionProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Resolves a provider by ID or selector display name.
   */
  public get(id: string): TranscriptionProvider | undefined {
    if (!id) return undefined;
    const normalized = id.toLowerCase().trim();

    // Map common display selector names to provider IDs
    if (
      normalized === 'whisper' ||
      normalized === 'whisper local' ||
      normalized === 'whisper-local'
    ) {
      return this.providers.get('whisper-local');
    }
    if (normalized === 'gemini' || normalized.includes('gemini')) {
      return this.providers.get('gemini');
    }
    if (
      normalized === 'openai' ||
      normalized === 'openai-asr' ||
      normalized === 'openai whisper' ||
      normalized.includes('openai')
    ) {
      return this.providers.get('openai-asr');
    }

    return this.providers.get(id);
  }

  public getAll(): TranscriptionProvider[] {
    return Array.from(this.providers.values());
  }

  public getDefaultProvider(selectedProviderName?: string): TranscriptionProvider | undefined {
    if (selectedProviderName && selectedProviderName !== 'None') {
      const resolved = this.get(selectedProviderName);
      if (resolved) return resolved;
    }

    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('dubbiovi_transcription_provider');
      if (savedProvider && this.get(savedProvider)) {
        return this.get(savedProvider);
      }
    }
    return this.get('whisper-local') || this.get('gemini') || this.getAll()[0];
  }

  public clear(): void {
    this.providers.clear();
  }
}

/** Exported shared instance for clean dependency usage without forcing singleton patterns */
export const providerRegistry = ProviderRegistry.getInstance();

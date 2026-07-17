import { TranscriptionProvider } from './transcription-types';
import { GeminiProvider } from './GeminiProvider';
import { WhisperLocalProvider } from './WhisperLocalProvider';

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private providers: Map<string, TranscriptionProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
      // Auto-register available providers
      ProviderRegistry.instance.register(new GeminiProvider());
      ProviderRegistry.instance.register(new WhisperLocalProvider());
    }
    return ProviderRegistry.instance;
  }

  public register(provider: TranscriptionProvider): void {
    this.providers.set(provider.id, provider);
  }

  public get(id: string): TranscriptionProvider | undefined {
    return this.providers.get(id);
  }

  public getAll(): TranscriptionProvider[] {
    return Array.from(this.providers.values());
  }

  public getDefaultProvider(): TranscriptionProvider | undefined {
    if (typeof window !== 'undefined') {
      const savedProvider = localStorage.getItem('dubbiovi_transcription_provider');
      if (savedProvider && this.get(savedProvider)) {
        return this.get(savedProvider);
      }
    }
    // Gemini is the current default provider
    return this.get('gemini') || this.getAll()[0];
  }

  public clear(): void {
    this.providers.clear();
  }
}

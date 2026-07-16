import { TranscriptionProvider } from './transcription-types';

export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private providers: Map<string, TranscriptionProvider> = new Map();

  private constructor() {}

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
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

  public clear(): void {
    this.providers.clear();
  }
}

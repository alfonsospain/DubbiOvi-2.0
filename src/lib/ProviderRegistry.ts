import { TranscriptionProvider } from './transcription-types';
import { VoiceProvider } from './types/voice-provider-types';
import { GeminiProvider } from './GeminiProvider';
import { WhisperLocalClientProvider } from './WhisperLocalClientProvider';
import { OpenAITranscriptionProvider } from './OpenAITranscriptionProvider';
import { StubVoiceProvider } from './stubs/StubVoiceProvider';
import { PiperLocalProvider } from './PiperLocalProvider';

/**
 * Unified Provider Registry managing discovery for all provider categories (ASR, MT, Voice/TTS).
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry | null = null;
  private asrProviders: Map<string, TranscriptionProvider> = new Map();
  private voiceProviders: Map<string, VoiceProvider> = new Map();

  public constructor() {
    // Auto-register default ASR transcription providers
    this.register(new GeminiProvider());
    this.register(new WhisperLocalClientProvider());
    this.register(new OpenAITranscriptionProvider());

    // Auto-register default Voice Providers
    this.registerVoiceProvider(new StubVoiceProvider());
    this.registerVoiceProvider(new PiperLocalProvider());
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  // --- ASR Transcription Providers ---

  public register(provider: TranscriptionProvider): void {
    this.asrProviders.set(provider.id, provider);
  }

  /**
   * Resolves an ASR transcription provider by ID or display alias.
   */
  public get(id: string): TranscriptionProvider | undefined {
    if (!id) return undefined;
    const normalized = id.toLowerCase().trim();

    if (
      normalized === 'whisper' ||
      normalized === 'whisper local' ||
      normalized === 'whisper-local'
    ) {
      return this.asrProviders.get('whisper-local');
    }
    if (normalized === 'gemini' || normalized.includes('gemini')) {
      return this.asrProviders.get('gemini');
    }
    if (
      normalized === 'openai' ||
      normalized === 'openai-asr' ||
      normalized === 'openai whisper' ||
      normalized.includes('openai')
    ) {
      return this.asrProviders.get('openai-asr');
    }

    return this.asrProviders.get(id);
  }

  public getAll(): TranscriptionProvider[] {
    return Array.from(this.asrProviders.values());
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

  // --- Voice / TTS Providers ---

  public registerVoiceProvider(provider: VoiceProvider): void {
    this.voiceProviders.set(provider.id, provider);
  }

  public getVoiceProvider(id: string): VoiceProvider | undefined {
    if (!id) return undefined;
    const normalized = id.toLowerCase().trim();

    if (normalized === 'stub' || normalized.includes('stub')) {
      return this.voiceProviders.get('stub-voice-provider');
    }

    return this.voiceProviders.get(id);
  }

  public getAllVoiceProviders(): VoiceProvider[] {
    return Array.from(this.voiceProviders.values());
  }

  public clear(): void {
    this.asrProviders.clear();
    this.voiceProviders.clear();
  }
}

/** Exported shared instance for clean dependency usage */
export const providerRegistry = ProviderRegistry.getInstance();

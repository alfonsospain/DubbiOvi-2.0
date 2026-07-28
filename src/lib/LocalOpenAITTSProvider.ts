import {
  VoiceProvider,
  VoiceCapabilities,
  VoiceDescriptor,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from './types/voice-provider-types';
import { ProviderServiceManager } from './ProviderServiceManager';
import { OpenAiCompatibleSpeechClient } from './OpenAiCompatibleSpeechClient';

export const DEFAULT_LOCAL_TTS_URL = 'http://localhost:8880/v1';

export const DEFAULT_LOCAL_VOICES: VoiceDescriptor[] = [
  { id: 'af_bella', name: 'Bella (American Female)', gender: 'female', language: 'EN' },
  { id: 'af_sky', name: 'Sky (American Female)', gender: 'female', language: 'EN' },
  { id: 'am_adam', name: 'Adam (American Male)', gender: 'male', language: 'EN' },
  { id: 'bf_emma', name: 'Emma (British Female)', gender: 'female', language: 'EN' },
  { id: 'bm_george', name: 'George (British Male)', gender: 'male', language: 'EN' },
];

/**
 * Provider-independent Local AI Voice Provider foundation for any local neural speech engine
 * exposing an OpenAI-compatible speech endpoint (e.g. POST /v1/audio/speech).
 * Supports Kokoro, XTTS, StyleTTS, Parler, Bark, or local custom speech servers.
 */
export class LocalOpenAITTSProvider implements VoiceProvider {
  public readonly id = 'local-openai-tts';
  public readonly name = 'Local AI Voice Server (OpenAI-Compatible)';

  public readonly capabilities: VoiceCapabilities = {
    supportsSpeakingRate: true,
    supportsPitch: false,
    supportsSSML: false,
    supportedFormats: ['wav', 'mp3', 'ogg'],
    supportedSampleRates: [24000],
    isOffline: true,
    requiresApiKey: false,
  };

  /**
   * Resolves configured local speech base URL from localStorage/appSettings.
   */
  public getBaseUrl(): string {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dubbiovi_local_tts_url');
        if (saved && saved.trim().length > 0) {
          return saved.trim();
        }
      } catch (_) {}
    }
    return DEFAULT_LOCAL_TTS_URL;
  }

  /**
   * Local provider is available whenever local endpoint URL is configured or online.
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Discovers available voices from local speech endpoint (/v1/voices or /v1/models) or default catalog.
   */
  public async getAvailableVoices(language?: string): Promise<VoiceDescriptor[]> {
    const baseUrl = this.getBaseUrl().replace(/\/+$/, '');
    try {
      const res = await fetch(`${baseUrl}/models`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.data)) {
          const discovered: VoiceDescriptor[] = data.data.map((item: any) => ({
            id: item.id || item.name,
            name: `${item.name || item.id} (Local Neural)`,
            gender: 'neutral',
            language: (language || 'EN').toUpperCase(),
          }));
          if (discovered.length > 0) return discovered;
        }
      }
    } catch (_) {
      // Local server offline or non-standard models endpoint; fallback to local catalog
    }

    if (!language) return [...DEFAULT_LOCAL_VOICES];
    const normLang = language.trim().toUpperCase();
    return DEFAULT_LOCAL_VOICES.map((v) => ({ ...v, language: normLang }));
  }

  /**
   * Synthesizes audio using local OpenAI-compatible speech endpoint.
   */
  public async synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    const baseUrl = this.getBaseUrl();
    const activeModel = await ProviderServiceManager.getServiceModel('local-openai-tts', 'tts');

    return await OpenAiCompatibleSpeechClient.synthesizeSpeech({
      baseUrl,
      model: activeModel || 'tts-1',
      text: request.text,
      voice: request.voiceId || DEFAULT_LOCAL_VOICES[0].id,
      responseFormat: 'wav',
      takeId: request.takeId || 'unassigned',
      providerId: this.id,
    });
  }

  public async generateVoice(request: VoiceGenerationRequest, apiKey?: string): Promise<VoiceGenerationResult> {
    return this.synthesize(request);
  }
}

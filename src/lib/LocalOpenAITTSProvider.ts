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

export interface LocalServerStatus {
  online: boolean;
  baseUrl: string;
  statusMessage: string;
  models: string[];
  voices: VoiceDescriptor[];
  errorType?: 'OFFLINE' | 'TIMEOUT' | 'INVALID_RESPONSE' | 'SERVER_ERROR';
}

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
   * Saves configured local speech base URL.
   */
  public saveBaseUrl(url: string): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('dubbiovi_local_tts_url', url.trim());
      } catch (_) {}
    }
  }

  /**
   * Probes the local speech server endpoint to determine online availability,
   * available models (/v1/models), and available voices (/v1/audio/voices).
   */
  public async checkServerConnection(targetUrl?: string): Promise<LocalServerStatus> {
    const baseUrl = (targetUrl || this.getBaseUrl()).trim().replace(/\/+$/, '');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    try {
      const modelsRes = await fetch(`${baseUrl}/models`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!modelsRes.ok) {
        return {
          online: false,
          baseUrl,
          statusMessage: `Local speech server returned HTTP ${modelsRes.status} on /models`,
          models: [],
          voices: DEFAULT_LOCAL_VOICES,
          errorType: 'SERVER_ERROR',
        };
      }

      const modelsData = await modelsRes.json();
      const modelsList: string[] = [];
      if (Array.isArray(modelsData?.data)) {
        for (const m of modelsData.data) {
          if (m.id) modelsList.push(String(m.id));
        }
      } else if (Array.isArray(modelsData?.models)) {
        for (const m of modelsData.models) {
          if (typeof m === 'string') modelsList.push(m);
          else if (m.id) modelsList.push(String(m.id));
        }
      }

      if (modelsList.length === 0) {
        modelsList.push('kokoro', 'tts-1');
      }

      // Try discovering voices via /audio/voices or /voices
      let discoveredVoices: VoiceDescriptor[] = [];
      try {
        const voicesRes = await fetch(`${baseUrl}/audio/voices`);
        if (voicesRes.ok) {
          const vData = await voicesRes.json();
          const rawVoices = Array.isArray(vData) ? vData : (vData?.voices || vData?.data || []);
          if (Array.isArray(rawVoices) && rawVoices.length > 0) {
            discoveredVoices = rawVoices.map((v: any) => {
              const vId = typeof v === 'string' ? v : (v.id || v.name);
              const vName = typeof v === 'string' ? v : (v.name || v.id);
              const lang = v.language || (vId.startsWith('es_') ? 'ES' : 'EN');
              return {
                id: vId,
                name: `${vName}`,
                gender: vId.includes('m_') ? 'male' : (vId.includes('f_') ? 'female' : 'neutral'),
                language: String(lang).toUpperCase(),
              };
            });
          }
        }
      } catch (_) {}

      if (discoveredVoices.length === 0) {
        discoveredVoices = [...DEFAULT_LOCAL_VOICES];
      }

      return {
        online: true,
        baseUrl,
        statusMessage: `Connected to local speech server at ${baseUrl}`,
        models: modelsList,
        voices: discoveredVoices,
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isTimeout = err?.name === 'AbortError';
      return {
        online: false,
        baseUrl,
        statusMessage: isTimeout
          ? `Connection to ${baseUrl} timed out after 3.5s`
          : `No Local AI Voice server is currently running at ${baseUrl}`,
        models: [],
        voices: DEFAULT_LOCAL_VOICES,
        errorType: isTimeout ? 'TIMEOUT' : 'OFFLINE',
      };
    }
  }

  /**
   * Returns whether the local server is reachable (statically or probed).
   */
  public isAvailable(): boolean {
    return true;
  }

  /**
   * Discovers available models dynamically from GET /v1/models.
   */
  public async getAvailableModels(targetUrl?: string): Promise<string[]> {
    const status = await this.checkServerConnection(targetUrl);
    return status.models.length > 0 ? status.models : ['kokoro', 'tts-1'];
  }

  /**
   * Discovers available voices dynamically from local speech endpoint or default catalog.
   */
  public async getAvailableVoices(language?: string): Promise<VoiceDescriptor[]> {
    const status = await this.checkServerConnection();
    let voices = status.voices;

    if (language) {
      const normLang = language.trim().toUpperCase();
      const filtered = voices.filter((v) => v.language.toUpperCase() === normLang);
      if (filtered.length > 0) return filtered;
    }

    return voices;
  }

  /**
   * Synthesizes audio using local OpenAI-compatible speech endpoint.
   */
  public async synthesize(request: VoiceGenerationRequest): Promise<VoiceGenerationResult> {
    const baseUrl = this.getBaseUrl();
    const activeModel = await ProviderServiceManager.getServiceModel('local-openai-tts', 'tts');

    return await OpenAiCompatibleSpeechClient.synthesizeSpeech({
      baseUrl,
      model: activeModel || 'kokoro',
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

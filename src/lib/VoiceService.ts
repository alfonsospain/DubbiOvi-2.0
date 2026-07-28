import { providerRegistry } from './ProviderRegistry';
import { VoiceAssetManager } from './VoiceAssetManager';
import { VoiceAsset } from './types/voice-types';
import {
  VoiceProvider,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from './types/voice-provider-types';
import { ProviderServiceManager } from './ProviderServiceManager';
import { ServiceCategory } from './types/ProviderServiceTypes';
import { PiperModelManager } from './PiperModelManager';

export interface GenerateVoiceForTakeOptions {
  takeId: string;
  text: string;
  language: string;
  voiceId?: string;
  providerId: string;
  apiKey?: string;
  format?: string;
  sampleRate?: number;
  speakingRate?: number;
  pitch?: number;
}

/**
 * High-level orchestration service managing Voice Providers, model resolution via ProviderServiceManager,
 * stateless generation invocation, and VoiceAsset lifecycle registration.
 */
export class VoiceService {
  private assetManager: VoiceAssetManager;

  constructor(assetManager?: VoiceAssetManager) {
    this.assetManager = assetManager || new VoiceAssetManager();
  }

  /**
   * Resolves VoiceProvider instance from ProviderRegistry.
   */
  private resolveProvider(providerId: string): VoiceProvider {
    const provider = providerRegistry.getVoiceProvider(providerId);
    if (!provider) {
      throw new Error(`VoiceProvider with ID '${providerId}' not found in ProviderRegistry.`);
    }
    return provider;
  }

  /**
   * Generates a voice clip for a Take. Resolves preferred voice by target language for Piper,
   * or active TTS service model via ProviderServiceManager, invokes stateless VoiceProvider,
   * and registers output VoiceAsset with VoiceAssetManager.
   */
  public async generateVoiceForTake(options: GenerateVoiceForTakeOptions): Promise<{
    result: VoiceGenerationResult;
    asset: VoiceAsset;
  }> {
    console.log('[Voice Generation Diagnostic] Provider ID received by the service:', options.providerId);
    const provider = this.resolveProvider(options.providerId);
    console.log('[Voice Generation Diagnostic] Provider resolved by ProviderRegistry:', provider.id, `(${provider.name})`);
    console.log('[Voice Generation Diagnostic] Actual provider instance invoked:', provider.constructor.name, `(${provider.name})`);

    // Resolve voice model for this request using ProviderServiceManager or requested voiceId
    let targetModel = options.voiceId;
    if (!targetModel) {
      targetModel = await ProviderServiceManager.getServiceModel(provider.id, 'tts');
    }

    const reqFormat: 'wav' | 'mp3' | 'ogg' =
      options.format === 'wav' || options.format === 'mp3' || options.format === 'ogg'
        ? options.format
        : provider.id === 'piper'
        ? 'wav'
        : 'mp3';

    const request: VoiceGenerationRequest = {
      takeId: options.takeId,
      text: options.text,
      language: options.language,
      voiceId: options.voiceId,
      modelName: targetModel,
      format: reqFormat,
      sampleRate: options.sampleRate || 24000,
      speakingRate: options.speakingRate,
      pitch: options.pitch,
    };

    // Invoke stateless VoiceProvider via canonical synthesize() contract
    const result = typeof provider.synthesize === 'function'
      ? await provider.synthesize(request, options.apiKey)
      : await provider.generateVoice(request, options.apiKey);

    const assetFormat: 'wav' | 'mp3' | 'ogg' =
      result.format === 'mp3' ? 'mp3' : result.format === 'ogg' ? 'ogg' : 'wav';

    // Register generated result with VoiceAssetManager (preserves project-relative path)
    const asset = this.assetManager.registerAsset({
      id: result.id,
      takeId: result.takeId,
      relativePath: result.relativePath,
      filename: result.filename,
      format: assetFormat,
      sampleRate: result.sampleRate,
      durationSeconds: result.durationSeconds,
      metadata: result.metadata,
    });

    return { result, asset };
  }

  /**
   * Returns the underlying VoiceAssetManager instance.
   */
  public getAssetManager(): VoiceAssetManager {
    return this.assetManager;
  }
}

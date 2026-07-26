import {
  VoiceGenerationRequest,
  VoiceGenerationResult,
  VoiceProvider,
} from './types/voice-provider-types';
import { providerRegistry } from './ProviderRegistry';
import { ProviderServiceManager } from './ProviderServiceManager';
import { VoiceAssetManager } from './VoiceAssetManager';
import { VoiceAsset } from './types/voice-types';

export interface GenerateVoiceForTakeOptions {
  takeId: string;
  text: string;
  language: string;
  voiceId: string;
  providerId: string;
  apiKey?: string;
  format?: 'wav' | 'mp3' | 'ogg';
  sampleRate?: number;
  speakingRate?: number;
  pitch?: number;
}

/**
 * Generic orchestration service managing Voice Providers, model resolution via ProviderServiceManager,
 * and registering output VoiceGenerationResults with VoiceAssetManager.
 */
export class VoiceService {
  private assetManager: VoiceAssetManager;

  constructor(assetManager?: VoiceAssetManager) {
    this.assetManager = assetManager || new VoiceAssetManager();
  }

  /**
   * Resolves a VoiceProvider by ID from the central ProviderRegistry.
   */
  public resolveProvider(providerId: string): VoiceProvider {
    const provider = providerRegistry.getVoiceProvider(providerId);
    if (!provider) {
      throw new Error(`VoiceProvider with ID '${providerId}' not found in ProviderRegistry.`);
    }
    return provider;
  }

  /**
   * Generates a voice clip for a Take, resolves the active TTS service model via ProviderServiceManager,
   * invokes the stateless VoiceProvider, and registers the output VoiceAsset with VoiceAssetManager.
   */
  public async generateVoiceForTake(options: GenerateVoiceForTakeOptions): Promise<{
    result: VoiceGenerationResult;
    asset: VoiceAsset;
  }> {
    const provider = this.resolveProvider(options.providerId);

    // Resolve active TTS model configured for this provider via ProviderServiceManager
    const activeModel = await ProviderServiceManager.getServiceModel(options.providerId, 'tts');

    const request: VoiceGenerationRequest = {
      takeId: options.takeId,
      text: options.text,
      language: options.language,
      voiceId: options.voiceId,
      modelName: activeModel,
      format: options.format || 'wav',
      sampleRate: options.sampleRate || 24000,
      speakingRate: options.speakingRate,
      pitch: options.pitch,
    };

    // Invoke stateless VoiceProvider
    const result = await provider.generateVoice(request, options.apiKey);

    // Register generated result with VoiceAssetManager (preserves project-relative path)
    const asset = this.assetManager.registerAsset({
      id: result.id,
      takeId: result.takeId,
      relativePath: result.relativePath,
      filename: result.filename,
      format: result.format,
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

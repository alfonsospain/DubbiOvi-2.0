import {
  VoiceProvider,
  VoiceCapabilities,
  VoiceDescriptor,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from '../types/voice-provider-types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Generic, provider-agnostic stub implementation of VoiceProvider.
 * Used for architectural validation, capability reporting, and testing
 * without requiring real TTS engines or API calls.
 */
export class StubVoiceProvider implements VoiceProvider {
  public readonly id = 'stub-voice-provider';
  public readonly name = 'Stub Voice Provider (Mock)';

  public readonly capabilities: VoiceCapabilities = {
    supportsSpeakingRate: true,
    supportsPitch: true,
    supportsSSML: false,
    supportedFormats: ['wav', 'mp3'],
    supportedSampleRates: [24000, 16000],
    isOffline: true,
    requiresApiKey: false,
  };

  public isAvailable(): boolean {
    return true;
  }

  /**
   * Returns a mock list of available voice descriptors.
   */
  public async getAvailableVoices(language = 'en'): Promise<VoiceDescriptor[]> {
    const langUpper = language.toUpperCase();
    return [
      {
        id: `stub-voice-1-${langUpper.toLowerCase()}`,
        name: `Stub Voice 1 (${langUpper})`,
        gender: 'neutral',
        language: langUpper,
        sampleRate: 24000,
      },
      {
        id: `stub-voice-2-${langUpper.toLowerCase()}`,
        name: `Stub Voice 2 (${langUpper})`,
        gender: 'female',
        language: langUpper,
        sampleRate: 24000,
      },
    ];
  }

  /**
   * Canonical synthesis implementation returning a provider-independent VoiceGenerationResult.
   */
  public async synthesize(
    request: VoiceGenerationRequest,
    apiKey?: string
  ): Promise<VoiceGenerationResult> {
    if (!request.text || typeof request.text !== 'string' || request.text.trim().length === 0) {
      throw new Error('Invalid VoiceGenerationRequest: text parameter is required.');
    }

    const resultId = uuidv4();
    const takeId = request.takeId || 'unassigned-take';
    const filename = `voice_${takeId}_${resultId.substring(0, 8)}.wav`;
    const relativePath = `Audio/${filename}`;

    return {
      id: resultId,
      takeId,
      relativePath,
      filename,
      format: request.format || 'wav',
      sampleRate: request.sampleRate || 24000,
      durationSeconds: Math.max(1.0, parseFloat((request.text.length * 0.06).toFixed(2))),
      metadata: {
        generatorProviderId: this.id,
        generatorModelName: request.modelName || 'stub-tts-v1',
        voiceId: request.voiceId || 'stub-voice-1-en',
        speakerName: 'Stub Speaker',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Backwards-compatibility wrapper delegating to canonical synthesize().
   */
  public async generateVoice(
    request: VoiceGenerationRequest,
    apiKey?: string
  ): Promise<VoiceGenerationResult> {
    return this.synthesize(request, apiKey);
  }
}

import {
  VoiceProvider,
  VoiceCapabilities,
  VoiceDescriptor,
  VoiceGenerationRequest,
  VoiceGenerationResult,
} from './types/voice-provider-types';
import { PiperModelManager } from './PiperModelManager';
import { v4 as uuidv4 } from 'uuid';

/**
 * Reference offline Voice Provider implementation for Piper Neural TTS.
 * Stateless, buffer-free, and outputs provider-neutral audio file references.
 */
export class PiperLocalProvider implements VoiceProvider {
  public readonly id = 'piper';
  public readonly name = 'Piper Neural TTS (Offline)';

  public readonly capabilities: VoiceCapabilities = {
    supportsSpeakingRate: true,
    supportsPitch: false,
    supportsSSML: false,
    supportedFormats: ['wav'],
    supportedSampleRates: [22050, 16000],
    isOffline: true,
    requiresApiKey: false,
  };

  /**
   * Discovers available voice descriptors dynamically via PiperModelManager.
   */
  public async getAvailableVoices(language?: string): Promise<VoiceDescriptor[]> {
    return await PiperModelManager.discoverVoiceDescriptors(language);
  }

  /**
   * Generates a voice synthesis result for a request using the configured active model.
   * Outputs provider-neutral audio filename format: voice_<takeId>_<uuid>.wav.
   */
  public async generateVoice(
    request: VoiceGenerationRequest,
    apiKey?: string
  ): Promise<VoiceGenerationResult> {
    if (!request.text || typeof request.text !== 'string' || request.text.trim().length === 0) {
      throw new Error('Invalid VoiceGenerationRequest: text parameter is required.');
    }

    const rawModel = request.modelName || (await PiperModelManager.getActiveModelName());
    const modelToUse = PiperModelManager.normalizeModelName(rawModel);
    const resultId = uuidv4();
    const takeId = request.takeId || 'unassigned';

    // Provider-neutral filename format: voice_<takeId>_<uuid>.wav
    const cleanTakeId = takeId.replace(/[^a-zA-Z0-9-_]/g, '-');
    const filename = `voice_${cleanTakeId}_${resultId.substring(0, 8)}.wav`;
    const relativePath = `Audio/${filename}`;

    const isElectron = typeof window !== 'undefined' && (window as any).electron?.runPiperLocal !== undefined;
    if (isElectron) {
      try {
        await (window as any).electron.runPiperLocal({
          text: request.text,
          modelName: modelToUse,
          outputFilename: filename,
        });
      } catch (err: any) {
        console.error('[PiperLocalProvider] Execution error:', err);
        throw new Error(`Piper TTS Error: ${err.message || String(err)}`);
      }
    }

    const estimatedDuration = Math.max(1.0, parseFloat((request.text.length * 0.065).toFixed(2)));

    return {
      id: resultId,
      takeId,
      relativePath,
      filename,
      format: request.format || 'wav',
      sampleRate: request.sampleRate || 22050,
      durationSeconds: estimatedDuration,
      metadata: {
        generatorProviderId: this.id,
        generatorModelName: modelToUse,
        voiceId: request.voiceId || modelToUse,
        speakerName: request.voiceId || modelToUse,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

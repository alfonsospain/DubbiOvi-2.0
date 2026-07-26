import { VoiceAssetMetadata } from './voice-types';

export interface VoiceCapabilities {
  supportsSpeakingRate: boolean;
  supportsPitch: boolean;
  supportsSSML: boolean;
  supportedFormats: Array<'wav' | 'mp3' | 'ogg'>;
  supportedSampleRates: number[];
  isOffline: boolean;
  requiresApiKey: boolean;
}

export interface VoiceDescriptor {
  id: string;
  name: string;
  gender?: 'male' | 'female' | 'neutral';
  language: string;
  sampleRate?: number;
}

export interface VoiceGenerationRequest {
  text: string;
  language: string;
  voiceId: string;
  takeId?: string;
  modelName?: string;
  format?: 'wav' | 'mp3' | 'ogg';
  sampleRate?: number;
  speakingRate?: number;
  pitch?: number;
}

/**
 * Result representing a generated voice clip.
 * Refers exclusively to project-relative audio file paths and metadata (no raw binary buffers).
 */
export interface VoiceGenerationResult {
  id: string;
  takeId: string;
  relativePath: string;
  filename: string;
  format: 'wav' | 'mp3' | 'ogg';
  sampleRate: number;
  durationSeconds: number;
  metadata: VoiceAssetMetadata;
}

/**
 * Generic, provider-independent interface for Text-to-Speech Voice Providers.
 * Providers are stateless and transform VoiceGenerationRequest into VoiceGenerationResult.
 */
export interface VoiceProvider {
  readonly id: string;
  readonly name: string;
  readonly capabilities: VoiceCapabilities;

  getAvailableVoices(language?: string): Promise<VoiceDescriptor[]>;
  generateVoice(request: VoiceGenerationRequest, apiKey?: string): Promise<VoiceGenerationResult>;
}

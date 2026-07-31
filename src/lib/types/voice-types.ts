export interface VoiceAssetMetadata {
  generatorProviderId: string;
  generatorModelName: string;
  voiceId?: string;
  speakerName?: string;
  generatedAt: string;
  // Duration Fitting Metadata (Milestone B2.1)
  parentAssetId?: string;
  isAdjusted?: boolean;
  originalDuration?: number;
  takeDuration?: number;
  adjustmentRatio?: number;
  adjustedAt?: string;
}

/**
 * Represents a generated audio clip as a first-class project resource.
 * Stores metadata and relative file references only (no raw binary buffers).
 */
export interface VoiceAsset {
  id: string;
  takeId: string;
  relativePath: string; // Project-relative path e.g. "audio/voice_take1_abc.wav"
  filename: string;     // Base filename e.g. "voice_take1_abc.wav"
  format: 'wav' | 'mp3' | 'ogg';
  sampleRate: number;
  durationSeconds: number;
  metadata: VoiceAssetMetadata;
}

export interface TakeVoiceState {
  takeId: string;
  activeVoiceAssetId?: string;
  availableVoiceAssets: VoiceAsset[];
}

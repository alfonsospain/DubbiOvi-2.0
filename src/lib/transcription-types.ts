import { Take } from './types';

export interface TranscriptionProviderMetadata {
  modelName: string;
  apiVersion?: string;
  latencyMs?: number;
  tokensUsed?: number;
  costEstimate?: number;
}

export interface ProviderAudioCapabilities {
  format: 'wav' | 'mp3' | string;
  sampleRate: number;
  channels: 1 | 2;
  normalize?: boolean;
}

export interface ProviderCapabilities {
  supportsLanguageDetection: boolean;
  supportedLanguages: string[]; // List of language codes
  supportsWordTimestamps: boolean;
  supportsSpeakerDiarization: boolean;
  isOffline: boolean;
  requiresApiKey: boolean;
  audio?: ProviderAudioCapabilities;
}

export interface PreparedAudio {
  blob: Blob;
  mimeType: string;
  sampleRate: number;
  channels: number;
  duration: number;
  format: string;
  normalizationApplied: boolean;
  sourceFileName: string;
  metadata?: Record<string, any>;
}

export interface TranscriptResult {
  detectedLanguage: string;
  transcript?: string;
  takes: Take[];
  confidence?: number;
  metadata: TranscriptionProviderMetadata;
}

export interface TranscriptionProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  transcribe(audio: PreparedAudio, sourceLanguage?: string, apiKey?: string): Promise<TranscriptResult>;
}

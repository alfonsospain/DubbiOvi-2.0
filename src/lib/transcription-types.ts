import { Take } from './types';

export interface TranscriptionProviderMetadata {
  modelName: string;
  apiVersion?: string;
  latencyMs?: number;
  tokensUsed?: number;
  costEstimate?: number;
}

export interface ProviderCapabilities {
  supportsLanguageDetection: boolean;
  supportedLanguages: string[]; // List of language codes
  supportsWordTimestamps: boolean;
  supportsSpeakerDiarization: boolean;
  isOffline: boolean;
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
  transcribe(audioFile: Blob, sourceLanguage?: string): Promise<TranscriptResult>;
}

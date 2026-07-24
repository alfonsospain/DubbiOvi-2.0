/**
 * Domain category for local AI runtimes
 */
export type RuntimeCategory = 'asr' | 'tts' | 'llm' | 'mt';

/**
 * State machine states for runtime management
 */
export type RuntimeStatus =
  | 'NOT_INSTALLED'
  | 'DOWNLOADING'
  | 'VALIDATING'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'ERROR'
  | 'REPAIRING';

/**
 * DubbiOvi Runtime Manifest Schema v2.0.0
 */
export interface RuntimeManifest {
  schemaVersion: string; // e.g. "2.0.0"
  minimumDubbiOviVersion: string; // e.g. "2.0.0"
  runtimeApiVersion: string; // e.g. "2.0.0"
  id: string; // e.g. "whisper"
  name: string; // e.g. "Whisper.cpp Engine"
  category: RuntimeCategory;
  version: string; // e.g. "1.9.1"
  executable: string; // e.g. "bin/whisper-cli"
  platform: string; // e.g. "darwin"
  arch: string; // e.g. "arm64"
  packagedAt: string; // ISO 8601 string
  files: string[]; // Relative paths within package
  checksumSha256: string | null;
}

/**
 * Catalog / Remote Descriptor for available Runtimes
 */
export interface RuntimeDescriptor {
  id: string;
  name: string;
  category: RuntimeCategory;
  version: string;
  downloadUrl: string;
  checksumSha256: string; // Authoritative checksum
  estimatedSize?: string;
  runtimeApiVersion?: string;
  minimumDubbiOviVersion?: string;
}

/**
 * Information record for an installed, registered runtime
 */
export interface InstalledRuntimeInfo {
  id: string;
  name: string;
  category: RuntimeCategory;
  version: string;
  executablePath: string;
  installedPath: string;
  installedAt: string;
  manifest: RuntimeManifest;
  status: RuntimeStatus;
}

/**
 * Download progress callback object
 */
export interface DownloadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type DownloadProgressCallback = (progress: DownloadProgress) => void;

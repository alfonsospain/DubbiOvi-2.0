/**
 * Category of AI Engine
 */
export type EngineCategory = 'asr' | 'mt' | 'tts' | 'llm';

/**
 * Explicit State Machine states for local engines
 */
export type EngineState = 
  | 'NOT_INSTALLED'
  | 'DOWNLOADING'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'UPDATING'
  | 'BROKEN'
  | 'REPAIRING';

/**
 * Metadata for a known downloadable model
 */
export interface ModelMetaDescriptor {
  filename: string;
  name: string;
  downloadUrl: string;
  estimatedSize?: string;
  sizeBytes?: number;
  checksum?: string;
}

/**
 * Binary release package URLs per platform/architecture
 */
export interface EnginePackageRelease {
  version: string;
  downloads: Record<string, string>; // e.g. darwin_arm64, darwin_x64, win32_x64
  estimatedSize?: string;
}

/**
 * Abstract Descriptor for registering local engines
 */
export interface EngineDescriptor {
  id: string;
  name: string;
  category: EngineCategory;
  executableName: string;
  supportedModelExtensions: string[];
  description?: string;
  knownModels?: ModelMetaDescriptor[];
  release?: EnginePackageRelease;
}

/**
 * Local manifest representing installed engine state on user's machine
 */
export interface LocalManifest {
  id: string;
  version: string;
  executable: string;
  installedAt: string;
  state: EngineState;
}

/**
 * Dynamically discovered model file descriptor
 */
export interface ModelDescriptor {
  id: string;
  name: string;
  filename: string;
  engineId: string;
  sizeBytes?: number;
  path: string;
}

/**
 * Full engine status object combining descriptor, manifest and discovered models
 */
export interface EngineStatus {
  id: string;
  name: string;
  category: EngineCategory;
  state: EngineState;
  executablePath: string | null;
  installedVersion: string | null;
  availableModels: ModelDescriptor[];
}

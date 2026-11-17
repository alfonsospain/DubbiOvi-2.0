import { RuntimeDescriptor } from './RuntimeTypes';

export class RuntimeRepository {
  private descriptors: Map<string, RuntimeDescriptor> = new Map();

  /**
   * Centralized platform resolution helper mapping platform and architecture to platform keys.
   * Format: ${platform}_${arch} (e.g. darwin_arm64, darwin_x64, win32_x64, linux_x64, linux_arm64)
   */
  public static resolvePlatformKey(platform = process.platform, arch = process.arch): string {
    const cleanPlatform = (platform || process.platform).toLowerCase();
    const cleanArch = (arch || process.arch).toLowerCase();
    return `${cleanPlatform}_${cleanArch}`;
  }

  /**
   * Centralized resolution helper for engine release package filenames matching github release assets.
   * Format: ${engineId}-${platform}_${arch}.zip (e.g. whisper-darwin_arm64.zip, whisper-win32_x64.zip)
   */
  public static resolveReleaseFilename(engineId: string, platform = process.platform, arch = process.arch): string {
    const platformKey = RuntimeRepository.resolvePlatformKey(platform, arch);
    return `${engineId}-${platformKey}.zip`;
  }

  constructor() {
    this.registerDefaultDescriptors();
  }

  /**
   * Helper to make internal lookup key: id@version_platform_arch or id_platform_arch
   */
  private makeKey(id: string, version?: string, platform = process.platform, arch = process.arch): string {
    const platKey = RuntimeRepository.resolvePlatformKey(platform, arch);
    return version ? `${id}@${version}_${platKey}` : `${id}_${platKey}`;
  }

  /**
   * Registers a catalog runtime descriptor into the repository.
   */
  registerDescriptor(descriptor: RuntimeDescriptor, platform = process.platform, arch = process.arch): void {
    const versionedKey = this.makeKey(descriptor.id, descriptor.version, platform, arch);
    const defaultKey = this.makeKey(descriptor.id, undefined, platform, arch);

    this.descriptors.set(versionedKey, descriptor);
    this.descriptors.set(defaultKey, descriptor);
  }

  /**
   * Resolves a RuntimeDescriptor from catalog by runtime ID, version, platform, and arch.
   */
  async getDescriptor(
    runtimeId: string,
    version?: string,
    platform = process.platform,
    arch = process.arch
  ): Promise<RuntimeDescriptor | null> {
    const key = this.makeKey(runtimeId, version, platform, arch);
    const resolved = this.descriptors.get(key);
    if (resolved) return resolved;

    // Fallback to default platform key if version wasn't matched explicitly
    const fallbackKey = this.makeKey(runtimeId, undefined, platform, arch);
    return this.descriptors.get(fallbackKey) || null;
  }

  /**
   * Returns all registered catalog runtime descriptors.
   */
  async getAllDescriptors(): Promise<RuntimeDescriptor[]> {
    return Array.from(new Set(this.descriptors.values()));
  }

  /**
   * Populates default catalog entries for DubbiOvi official releases.
   */
  private registerDefaultDescriptors(): void {
    // Whisper runtime packages
    // Built from whisper.cpp v1.9.1
    // GitHub Release: v2.0.0-runtimes

    // Official Whisper.cpp v1.9.1 macOS ARM64 release package
    const whisperMacArm64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-darwin_arm64.zip',
      checksumSha256: 'ec25ef55bb79cbaffcab72ce0f65b9d825c3dff7c2b44021b107bb91583b3afc',
      estimatedSize: '1.26 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperMacArm64, 'darwin', 'arm64');

    // Official Whisper.cpp v1.9.1 macOS x64 release package
    const whisperMacX64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-darwin_x64.zip',
      checksumSha256: 'd1b2ede0ba03eb8e5456483e476772b99c1e4227d62682369de433230c750b7f',
      estimatedSize: '1.5 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperMacX64, 'darwin', 'x64');

    // Official Whisper.cpp v1.9.1 Windows x64 release package (AVX2 Optimized)
    const whisperWinX64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-win32_x64.zip',
      checksumSha256: 'f967f4ceb5a703c86a58d3b7036f24f5b260053d698c7b6063e3dc059fcd7413',
      estimatedSize: '1.25 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperWinX64, 'win32', 'x64');

    // Official Whisper.cpp v1.9.1 Windows x64 Baseline release package (Universal Baseline: No AVX2/FMA/F16C)
    const whisperWinX64Baseline: RuntimeDescriptor = {
      id: 'whisper-baseline',
      name: 'Whisper.cpp Engine (Baseline)',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-win32_x64_baseline.zip',
      checksumSha256: '4ea1cdb60325d4e0762af2d16b0bc3774fc93d587055f63bc9c4831f22d5a478',
      estimatedSize: '955 KB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperWinX64Baseline, 'win32', 'x64');

    // Piper Neural TTS runtime packages v1.0.0
    const piperMacArm64: RuntimeDescriptor = {
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts',
      version: '1.0.0',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/piper-darwin_arm64.zip',
      checksumSha256: '88d9a643f26464d8131975d85e99e9496dbe07ff2c908550c9fc28ad9ba33c61',
      estimatedSize: '34.2 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(piperMacArm64, 'darwin', 'arm64');

    const piperMacX64: RuntimeDescriptor = {
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts',
      version: '1.0.0',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/piper-darwin_x64.zip',
      checksumSha256: '74d8a58c8798f4cc0a2757269ca0f646e8a6536067df1420e22d12725f587df4',
      estimatedSize: '19.2 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(piperMacX64, 'darwin', 'x64');

    const piperWinX64: RuntimeDescriptor = {
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts',
      version: '1.0.0',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/piper-win32_x64.zip',
      checksumSha256: 'cdb038f0be3352012679e5c8873090797e8041695790717d9d64d8b438d05a73',
      estimatedSize: '22.5 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(piperWinX64, 'win32', 'x64');
  }
}

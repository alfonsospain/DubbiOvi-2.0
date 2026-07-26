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
      checksumSha256: '12308c4e5c79cad09709ccaf34accae46e2bec23ee80e2c0c7af9f2a77b86701',
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
      checksumSha256: '5aada9b0345efd95751eab8f38d9d3bcf98d52bda6d6c06be72b5537aba72bbe',
      estimatedSize: '1.5 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperMacX64, 'darwin', 'x64');

    // Official Whisper.cpp v1.9.1 Windows x64 release package placeholder
    const whisperWinX64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-win32_x64.zip',
      checksumSha256: 'c111a21521b1e3551ad3cfd40ed96ae8e7d29b89e43771f8a5e78d2295e8496a',
      estimatedSize: '2.0 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperWinX64, 'win32', 'x64');
  }
}

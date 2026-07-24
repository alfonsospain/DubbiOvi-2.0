import { RuntimeDescriptor } from './RuntimeTypes';

export class RuntimeRepository {
  private descriptors: Map<string, RuntimeDescriptor> = new Map();

  constructor() {
    this.registerDefaultDescriptors();
  }

  /**
   * Helper to make internal lookup key: id@version_platform_arch or id_platform_arch
   */
  private makeKey(id: string, version?: string, platform = process.platform, arch = process.arch): string {
    const platKey = `${platform}_${arch}`;
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
    // Official Whisper.cpp v1.9.1 macOS ARM64 release package
    const whisperMacArm64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-darwin_arm64.zip',
      checksumSha256: '1438405b9b4c8db5cfc30f37074b3f16b24c73a9b36ee7ebaa92fcdf8cc1cfad',
      estimatedSize: '1.26 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperMacArm64, 'darwin', 'arm64');

    // Official Whisper.cpp v1.9.1 macOS x64 release package placeholder
    const whisperMacX64: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/whisper-darwin_x64.zip',
      checksumSha256: 'd622207debfe2b91d0f4eba2b16915303497ecc737cdab8982a99ce2da4d5f1e',
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
      checksumSha256: 'd622207debfe2b91d0f4eba2b16915303497ecc737cdab8982a99ce2da4d5f1e',
      estimatedSize: '2.0 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };
    this.registerDescriptor(whisperWinX64, 'win32', 'x64');
  }
}

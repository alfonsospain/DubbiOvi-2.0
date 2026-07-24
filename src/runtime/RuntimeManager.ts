import fs from 'fs';
import path from 'path';
import {
  DownloadProgressCallback,
  InstalledRuntimeInfo,
  RuntimeDescriptor,
  RuntimeManifest,
  RuntimeStatus,
} from './RuntimeTypes';
import { RuntimeRegistry } from './RuntimeRegistry';
import { RuntimeDownloader } from './RuntimeDownloader';
import { RuntimeValidator } from './RuntimeValidator';
import { RuntimeInstaller } from './RuntimeInstaller';

export interface RuntimeManagerOptions {
  runtimesDir: string;
  cacheDir: string;
  appVersion?: string;
  registry?: RuntimeRegistry;
  downloader?: RuntimeDownloader;
  installer?: RuntimeInstaller;
}

export class RuntimeManager {
  private runtimesDir: string;
  private cacheDir: string;
  private appVersion: string;

  public registry: RuntimeRegistry;
  public downloader: RuntimeDownloader;
  public installer: RuntimeInstaller;

  constructor(options: RuntimeManagerOptions) {
    if (!options || !options.runtimesDir || !options.cacheDir) {
      throw new Error('RuntimeManager requires runtimesDir and cacheDir options.');
    }

    this.runtimesDir = options.runtimesDir;
    this.cacheDir = options.cacheDir;
    this.appVersion = options.appVersion || '2.0.0';

    this.registry = options.registry || new RuntimeRegistry();
    this.downloader = options.downloader || new RuntimeDownloader();
    this.installer = options.installer || new RuntimeInstaller();

    this.initializeStorage();
  }

  /**
   * Initializes workspace directories and loads local state.
   */
  public initializeStorage(): void {
    if (!fs.existsSync(this.runtimesDir)) {
      fs.mkdirSync(this.runtimesDir, { recursive: true });
    }
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    this.registry.loadLocalState(this.runtimesDir);
  }

  /**
   * Orchestrates complete atomic installation pipeline:
   * Download Runtime → Validate (SHA256 & Manifest) → Install → Register → Available
   */
  async installRuntime(
    descriptor: RuntimeDescriptor,
    onProgress?: DownloadProgressCallback,
    signal?: AbortSignal
  ): Promise<InstalledRuntimeInfo> {
    if (!descriptor || !descriptor.id || !descriptor.version || !descriptor.downloadUrl || !descriptor.checksumSha256) {
      throw new Error('Invalid RuntimeDescriptor: missing required fields (id, version, downloadUrl, checksumSha256).');
    }

    // Check if version is already installed and valid
    const existing = this.registry.get(descriptor.id, descriptor.version);
    if (existing && fs.existsSync(existing.executablePath)) {
      console.log(`[RuntimeManager] Runtime '${descriptor.id}' v${descriptor.version} is already installed.`);
      return existing;
    }

    const timestamp = Date.now();
    const tempZipPath = path.join(this.cacheDir, `${descriptor.id}_${descriptor.version}_${timestamp}.zip.tmp`);
    const stagingDir = path.join(this.cacheDir, `${descriptor.id}_${descriptor.version}_staging_${timestamp}`);
    const finalVersionedDir = path.join(this.runtimesDir, descriptor.id, descriptor.version);

    try {
      // -----------------------------------------------------------------------
      // Step 1: Download Archive
      // -----------------------------------------------------------------------
      console.log(`[RuntimeManager] [1/5] Downloading archive for '${descriptor.id}' v${descriptor.version}...`);
      await this.downloader.download(descriptor.downloadUrl, tempZipPath, onProgress, signal);

      // -----------------------------------------------------------------------
      // Step 2: Validate Authoritative Checksum BEFORE Extraction
      // -----------------------------------------------------------------------
      console.log(`[RuntimeManager] [2/5] Validating authoritative SHA-256 checksum...`);
      RuntimeValidator.validateChecksum(tempZipPath, descriptor.checksumSha256);

      // -----------------------------------------------------------------------
      // Step 3: Extract Archive into Temporary Staging Directory
      // -----------------------------------------------------------------------
      console.log(`[RuntimeManager] [3/5] Extracting archive to staging directory...`);
      await this.installer.extractToStaging(tempZipPath, stagingDir);

      // -----------------------------------------------------------------------
      // Step 4: Validate Manifest, Platform/Arch, API Version & Entrypoint
      // -----------------------------------------------------------------------
      console.log(`[RuntimeManager] [4/5] Validating manifest, version compatibility & entrypoint...`);
      const manifestPath = path.join(stagingDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Invalid package: missing manifest.json in package root.`);
      }

      const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      const validatedManifest: RuntimeManifest = RuntimeValidator.validateManifest(
        rawManifest,
        this.appVersion,
        process.platform,
        process.arch
      );

      // Ensure manifest checksum match
      validatedManifest.checksumSha256 = descriptor.checksumSha256;
      fs.writeFileSync(manifestPath, JSON.stringify(validatedManifest, null, 2), 'utf8');

      // Validate entrypoint executable existence & containment
      const resolvedExecPathInStaging = RuntimeValidator.validateExtractedExecutable(
        stagingDir,
        validatedManifest.executable
      );

      // -----------------------------------------------------------------------
      // Step 5: Atomic Promotion to Versioned Directory
      // -----------------------------------------------------------------------
      console.log(`[RuntimeManager] [5/5] Atomically promoting to ${finalVersionedDir}...`);
      this.installer.atomicPromote(stagingDir, finalVersionedDir);

      // Cleanup temporary ZIP file
      this.installer.cleanup([tempZipPath]);

      const finalExecPath = path.join(finalVersionedDir, validatedManifest.executable);

      const installedInfo: InstalledRuntimeInfo = {
        id: validatedManifest.id,
        name: validatedManifest.name,
        category: validatedManifest.category,
        version: validatedManifest.version,
        executablePath: finalExecPath,
        installedPath: finalVersionedDir,
        installedAt: new Date().toISOString(),
        manifest: validatedManifest,
        status: 'INSTALLED',
      };

      // Register installed runtime
      this.registry.register(installedInfo);
      console.log(`[RuntimeManager] Runtime '${installedInfo.id}' v${installedInfo.version} successfully installed & available!`);

      return installedInfo;
    } catch (error) {
      console.error(`[RuntimeManager] Installation failed for '${descriptor.id}' v${descriptor.version}:`, (error as Error).message);
      // Clean up temporary files on failure
      this.installer.cleanup([tempZipPath, stagingDir]);
      throw error;
    }
  }

  /**
   * Retrieves an installed runtime record from registry.
   */
  getRuntime(id: string, version?: string): InstalledRuntimeInfo | undefined {
    return this.registry.get(id, version);
  }

  /**
   * Returns list of all installed runtimes.
   */
  getAllRuntimes(): InstalledRuntimeInfo[] {
    return this.registry.getAll();
  }

  /**
   * Removes an installed runtime version from disk and registry.
   */
  uninstallRuntime(id: string, version: string): boolean {
    const info = this.registry.get(id, version);
    if (info && fs.existsSync(info.installedPath)) {
      try {
        fs.rmSync(info.installedPath, { recursive: true, force: true });
      } catch (err) {
        console.error(`[RuntimeManager] Error removing runtime folder ${info.installedPath}:`, err);
      }
    }
    return this.registry.unregister(id, version);
  }
}

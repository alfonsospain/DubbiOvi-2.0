import fs from 'fs';
import path from 'path';
import { InstalledRuntimeInfo, RuntimeCategory, RuntimeManifest } from './RuntimeTypes';

export class RuntimeRegistry {
  private runtimes: Map<string, InstalledRuntimeInfo> = new Map();

  /**
   * Generates internal map key: runtimeId@version or runtimeId (if latest)
   */
  private makeKey(id: string, version?: string): string {
    return version ? `${id}@${version}` : id;
  }

  /**
   * Registers an installed runtime record into the registry.
   */
  register(runtimeInfo: InstalledRuntimeInfo): void {
    if (!runtimeInfo || !runtimeInfo.id || !runtimeInfo.version) {
      throw new Error('Cannot register runtime: invalid runtimeInfo payload.');
    }
    const versionedKey = this.makeKey(runtimeInfo.id, runtimeInfo.version);
    this.runtimes.set(versionedKey, runtimeInfo);
    // Also set default/latest key
    this.runtimes.set(runtimeInfo.id, runtimeInfo);
  }

  /**
   * Unregisters an installed runtime from memory.
   */
  unregister(id: string, version?: string): boolean {
    const key = this.makeKey(id, version);
    const removed = this.runtimes.delete(key);
    if (version && this.runtimes.get(id)?.version === version) {
      this.runtimes.delete(id);
    }
    return removed;
  }

  /**
   * Retrieves an installed runtime info record by ID and optional version.
   */
  get(id: string, version?: string): InstalledRuntimeInfo | undefined {
    const key = this.makeKey(id, version);
    return this.runtimes.get(key) || (version ? undefined : this.runtimes.get(id));
  }

  /**
   * Checks if a runtime version is installed and registered.
   */
  has(id: string, version?: string): boolean {
    return !!this.get(id, version);
  }

  /**
   * Returns all currently installed runtimes.
   */
  getAll(): InstalledRuntimeInfo[] {
    // Unique list by versioned key
    const unique = new Map<string, InstalledRuntimeInfo>();
    for (const [key, val] of this.runtimes.entries()) {
      if (key.includes('@')) {
        unique.set(key, val);
      }
    }
    // Fallback if registered without @
    if (unique.size === 0) {
      for (const val of this.runtimes.values()) {
        unique.set(`${val.id}@${val.version}`, val);
      }
    }
    return Array.from(unique.values());
  }

  /**
   * Returns installed runtimes matching a specific category.
   */
  getByCategory(category: RuntimeCategory): InstalledRuntimeInfo[] {
    return this.getAll().filter((r) => r.category === category);
  }

  /**
   * Discovers and loads installed runtimes directly from userData/runtimes/{id}/{version}/ layout.
   */
  loadLocalState(runtimesDir: string): void {
    this.runtimes.clear();

    if (!fs.existsSync(runtimesDir)) {
      return;
    }

    try {
      const runtimeDirs = fs.readdirSync(runtimesDir);
      for (const runtimeId of runtimeDirs) {
        const idPath = path.join(runtimesDir, runtimeId);
        if (!fs.statSync(idPath).isDirectory()) continue;

        const versionDirs = fs.readdirSync(idPath);
        for (const version of versionDirs) {
          const versionPath = path.join(idPath, version);
          if (!fs.statSync(versionPath).isDirectory()) continue;

          const manifestPath = path.join(versionPath, 'manifest.json');
          if (fs.existsSync(manifestPath)) {
            try {
              const manifestContent = fs.readFileSync(manifestPath, 'utf8');
              const manifest: RuntimeManifest = JSON.parse(manifestContent);
              const execPath = path.join(versionPath, manifest.executable);

              if (fs.existsSync(execPath)) {
                const info: InstalledRuntimeInfo = {
                  id: manifest.id || runtimeId,
                  name: manifest.name || runtimeId,
                  category: manifest.category || 'asr',
                  version: manifest.version || version,
                  executablePath: execPath,
                  installedPath: versionPath,
                  installedAt: manifest.packagedAt || new Date().toISOString(),
                  manifest,
                  status: 'INSTALLED',
                };
                this.register(info);
              }
            } catch (err) {
              console.warn(`[RuntimeRegistry] Failed to read manifest at ${manifestPath}:`, err);
            }
          }
        }
      }
    } catch (err) {
      console.error(`[RuntimeRegistry] Error scanning runtimes directory ${runtimesDir}:`, err);
    }
  }
}

const fs = require('fs');
const path = require('path');
const DownloadManager = require('./download-manager');

/**
 * Service managing local AI engine binaries, local manifests, and dynamic model discovery.
 * Owned explicitly by the Electron main process (dependency injection).
 */
class LocalEngineManager {
  /**
   * @param {import('electron').App} app Electron application instance.
   * @param {import('./engine-registry')} registry EngineRegistry instance.
   */
  constructor(app, registry) {
    if (!app) {
      throw new Error('LocalEngineManager requires an Electron app instance.');
    }
    if (!registry) {
      throw new Error('LocalEngineManager requires an EngineRegistry instance.');
    }

    this.app = app;
    this.registry = registry;

    const userData = this.app.getPath('userData');
    this.enginesDir = path.join(userData, 'engines');
    this.modelsDir = path.join(userData, 'models');
    this.cacheDir = path.join(userData, 'cache');
    this.logsDir = path.join(userData, 'logs');
  }

  /**
   * Initializes workspace directories under app.getPath('userData').
   */
  initializeStorage() {
    const directories = [this.enginesDir, this.modelsDir, this.cacheDir, this.logsDir];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    // Ensure subdirectories for each registered engine
    const engines = this.registry.getAll();
    for (const engine of engines) {
      const engineDir = path.join(this.enginesDir, engine.id);
      const engineModelsDir = path.join(this.modelsDir, engine.id);

      if (!fs.existsSync(engineDir)) fs.mkdirSync(engineDir, { recursive: true });
      if (!fs.existsSync(engineModelsDir)) fs.mkdirSync(engineModelsDir, { recursive: true });

      // Initialize local manifest if not present
      const manifestPath = path.join(engineDir, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        const initialManifest = {
          id: engine.id,
          version: '1.0.0',
          executable: engine.executableName,
          installedAt: new Date().toISOString(),
          state: this.locateExecutable(engine.id) ? 'INSTALLED' : 'NOT_INSTALLED',
        };
        fs.writeFileSync(manifestPath, JSON.stringify(initialManifest, null, 2), 'utf8');
      }
    }
  }

  /**
   * Resolves the absolute path to an engine's binary executable.
   *
   * @param {string} engineId Unique engine identifier.
   * @returns {string} Fully resolved path to executable.
   */
  /**
   * Helper to recursively scan a directory for an executable or common binary aliases.
   * On non-Windows platforms, explicitly ignores .exe files.
   *
   * @param {string} dir Target directory to scan.
   * @param {string} targetName Base executable filename (e.g. 'whisper-cli').
   * @returns {string|null} Resolved executable path or null.
   */
  findExecutableInDir(dir, targetName) {
    if (!fs.existsSync(dir)) return null;

    const isWin = process.platform === 'win32';
    const possibleNames = isWin
      ? [targetName, 'whisper-cli.exe', 'main.exe', `${targetName}.exe`, 'whisper-cli', 'main']
      : [targetName, 'whisper-cli', 'main'];

    const normalizedPossible = Array.from(new Set(possibleNames.map((n) => n.toLowerCase())));

    const scan = (currentDir) => {
      try {
        const items = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const item of items) {
          const fullPath = path.join(currentDir, item.name);
          if (item.isDirectory()) {
            const result = scan(fullPath);
            if (result) return result;
          } else if (item.isFile()) {
            const lowerName = item.name.toLowerCase();
            if (!isWin && lowerName.endsWith('.exe')) {
              continue;
            }
            if (normalizedPossible.includes(lowerName)) {
              return fullPath;
            }
          }
        }
      } catch (_) {}
      return null;
    };

    return scan(dir);
  }

  /**
   * Resolves remote download URL for engine binary release package based on OS and architecture.
   *
   * @param {string} engineId Engine identifier.
   * @returns {string} Download URL string.
   */
  getEngineDownloadUrl(engineId) {
    const descriptor = this.registry.get(engineId);
    const platformKey = `${process.platform}_${process.arch}`;
    let selectedKey = null;
    let selectedUrl = null;

    if (descriptor && descriptor.release && descriptor.release.downloads) {
      const downloads = descriptor.release.downloads;
      if (downloads[platformKey]) {
        selectedKey = platformKey;
        selectedUrl = downloads[platformKey];
      } else {
        const fallbackKey = `${process.platform}_x64`;
        if (downloads[fallbackKey]) {
          selectedKey = fallbackKey;
          selectedUrl = downloads[fallbackKey];
        } else {
          const firstKey = Object.keys(downloads)[0];
          selectedKey = firstKey;
          selectedUrl = downloads[firstKey];
        }
      }
    }

    console.log(`[LocalEngineManager Platform Resolution Log]`);
    console.log(`  - process.platform: ${process.platform}`);
    console.log(`  - process.arch: ${process.arch}`);
    console.log(`  - selected package key: ${selectedKey}`);
    console.log(`  - selected download URL: ${selectedUrl}`);

    if (selectedUrl) return selectedUrl;
    throw new Error(`No registered binary download source found for engine '${engineId}' on ${process.platform}_${process.arch}.`);
  }

  /**
   * Resolves the absolute path to an engine's binary executable.
   *
   * @param {string} engineId Unique engine identifier.
   * @returns {string} Fully resolved path to executable.
   */
  locateExecutable(engineId) {
    const descriptor = this.registry.get(engineId);
    const execName = descriptor ? descriptor.executableName : (process.platform === 'win32' ? `${engineId}.exe` : engineId);
    const expectedPath = path.join(this.enginesDir, engineId, execName);

    const candidates = [
      // 1. User Data engines folder direct: userData/engines/{engineId}/{execName}
      expectedPath,
      // 2. App bundled path under bin/: appPath/bin/{execName}
      path.join(this.app.getAppPath(), 'bin', execName),
      // 3. App root path: appPath/{execName}
      path.join(this.app.getAppPath(), execName),
      // 4. User Data legacy bin path: userData/bin/{execName}
      path.join(this.app.getPath('userData'), 'bin', execName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // 5. Check recursively inside userData/engines/{engineId}/ for nested or aliased binaries
    const engineDir = path.join(this.enginesDir, engineId);
    const foundInDir = this.findExecutableInDir(engineDir, execName);
    if (foundInDir) {
      return foundInDir;
    }

    // Default target path fallback
    return expectedPath;
  }

  /**
   * Resolves the active model path for a given engine.
   *
   * @param {string} engineId Unique engine identifier.
   * @param {string} preferredModelName Model filename (e.g., 'ggml-tiny.bin').
   * @returns {string} Fully resolved model file path.
   */
  locateModel(engineId, preferredModelName) {
    if (!preferredModelName) {
      preferredModelName = 'ggml-tiny.bin';
    }

    const candidates = [
      // 1. Engine-specific model folder: userData/models/{engineId}/{preferredModelName}
      path.join(this.modelsDir, engineId, preferredModelName),
      // 2. User Data root models folder: userData/models/{preferredModelName}
      path.join(this.modelsDir, preferredModelName),
      // 3. User Data root path: userData/{preferredModelName}
      path.join(this.app.getPath('userData'), preferredModelName),
      // 4. App bundled model path: appPath/models/{preferredModelName}
      path.join(this.app.getAppPath(), 'models', preferredModelName),
      // 5. App root path: appPath/{preferredModelName}
      path.join(this.app.getAppPath(), preferredModelName),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    // Default target path
    return path.join(this.modelsDir, engineId, preferredModelName);
  }

  /**
   * Dynamically discovers installed models for an engine by scanning its models directory.
   *
   * @param {string} engineId Unique engine identifier.
   * @returns {Array<import('./src/lib/types/engine-types').ModelDescriptor>} Discovered models list.
   */
  listModels(engineId) {
    const descriptor = this.registry.get(engineId);
    const extensions = descriptor ? descriptor.supportedModelExtensions : [];
    const targetFolder = path.join(this.modelsDir, engineId);
    const models = [];

    if (!fs.existsSync(targetFolder)) {
      return models;
    }

    try {
      const files = fs.readdirSync(targetFolder);
      for (const file of files) {
        // Skip companion config files (.onnx.json) from listing as standalone models
        if (file.endsWith('.onnx.json') || file.endsWith('.json')) {
          continue;
        }

        const ext = path.extname(file).toLowerCase();
        if (extensions.length === 0 || extensions.includes(ext)) {
          const fullPath = path.join(targetFolder, file);
          const stat = fs.statSync(fullPath);

          if (stat.isFile()) {
            models.push({
              id: file,
              name: file.replace(ext, ''),
              filename: file,
              engineId,
              sizeBytes: stat.size,
              path: fullPath,
            });
          }
        }
      }
    } catch (err) {
      console.error(`[LocalEngineManager] Failed to list models for engine ${engineId}:`, err);
    }

    return models;
  }

  /**
   * Reads the local manifest file for a given engine.
   *
   * @param {string} engineId Engine identifier.
   * @returns {import('./src/lib/types/engine-types').LocalManifest|null} Manifest object.
   */
  readLocalManifest(engineId) {
    const manifestPath = path.join(this.enginesDir, engineId, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    try {
      const content = fs.readFileSync(manifestPath, 'utf8');
      return JSON.parse(content);
    } catch (err) {
      console.error(`[LocalEngineManager] Error reading manifest for ${engineId}:`, err);
      return null;
    }
  }

  /**
   * Writes local manifest data for an engine.
   *
   * @param {string} engineId Engine identifier.
   * @param {Object} manifestData Data to write.
   */
  writeLocalManifest(engineId, manifestData) {
    const engineDir = path.join(this.enginesDir, engineId);
    if (!fs.existsSync(engineDir)) {
      fs.mkdirSync(engineDir, { recursive: true });
    }
    const manifestPath = path.join(engineDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  }

  /**
   * Gets the current lifecycle state of an engine.
   *
   * @param {string} engineId Engine identifier.
   * @returns {import('./src/lib/types/engine-types').EngineState} Engine state string.
   */
  getEngineState(engineId) {
    const manifest = this.readLocalManifest(engineId);
    const execPath = this.locateExecutable(engineId);
    const execExists = fs.existsSync(execPath);

    if (!execExists) {
      return 'NOT_INSTALLED';
    }

    return manifest && manifest.state ? manifest.state : 'INSTALLED';
  }

  /**
   * Assembles full status object for an engine.
   *
   * @param {string} engineId Engine identifier.
   * @returns {import('./src/lib/types/engine-types').EngineStatus|null} Full status.
   */
  getEngineStatus(engineId) {
    const descriptor = this.registry.get(engineId);
    if (!descriptor) return null;

    const manifest = this.readLocalManifest(engineId);
    const execPath = this.locateExecutable(engineId);
    const execExists = fs.existsSync(execPath);

    return {
      id: descriptor.id,
      name: descriptor.name,
      category: descriptor.category,
      state: execExists ? (manifest?.state || 'INSTALLED') : 'NOT_INSTALLED',
      executablePath: execExists ? execPath : null,
      installedVersion: manifest?.version || null,
      availableModels: this.listModels(engineId),
    };
  }

  /**
   * Returns status for all registered engines.
   *
   * @returns {Array<import('./src/lib/types/engine-types').EngineStatus>} List of statuses.
   */
  getAllEngineStatuses() {
    return this.registry
      .getAll()
      .map((descriptor) => this.getEngineStatus(descriptor.id))
      .filter(Boolean);
  }

  /**
   * Resolves standard remote download URL for an engine model via EngineRegistry.
   *
   * @param {string} engineId Engine identifier (e.g., 'whisper', 'ollama').
   * @param {string} modelName Model filename (e.g., 'ggml-tiny.bin').
   * @returns {string} Download URL string.
   */
  getModelDownloadUrl(engineId, modelName) {
    const descriptor = this.registry.get(engineId);
    if (descriptor && Array.isArray(descriptor.knownModels)) {
      const modelMeta = descriptor.knownModels.find((m) => m.filename === modelName);
      if (modelMeta && modelMeta.downloadUrl) {
        return modelMeta.downloadUrl;
      }
    }
    throw new Error(`No registered download URL found for model '${modelName}' under engine '${engineId}'.`);
  }

  /**
   * Downloads a model file into the engine's local models directory using DownloadManager.
   *
   * @param {string} engineId Engine identifier.
   * @param {string} modelName Model filename (e.g., 'ggml-tiny.bin').
   * @param {function({ loaded: number, total: number }): void} [onProgress] Progress callback.
   * @returns {Promise<string>} Fully resolved path to installed model.
   */
  async downloadModel(engineId, modelName, onProgress) {
    const url = this.getModelDownloadUrl(engineId, modelName);
    const targetDir = path.join(this.modelsDir, engineId);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetPath = path.join(targetDir, modelName);
    const tempPath = path.join(this.cacheDir, `${engineId}_${modelName}.tmp`);

    try {
      await DownloadManager.downloadFile(url, tempPath, onProgress);
      fs.renameSync(tempPath, targetPath);

      // Piper models MUST have an accompanying .onnx.json config file
      if (engineId === 'piper' || modelName.endsWith('.onnx')) {
        const descriptor = this.registry.get(engineId);
        const modelMeta = descriptor?.knownModels?.find((m) => m.filename === modelName);
        const configUrl = modelMeta?.configUrl || `${url}.json`;
        const configFilename = `${modelName}.json`;
        const configTargetPath = path.join(targetDir, configFilename);
        const configTempPath = path.join(this.cacheDir, `${engineId}_${configFilename}.tmp`);

        console.log(`[LocalEngineManager] Downloading required Piper config: ${configUrl} -> ${configTargetPath}...`);
        await DownloadManager.downloadFile(configUrl, configTempPath);
        fs.renameSync(configTempPath, configTargetPath);
      }

      return targetPath;
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
      const configTempPath = path.join(this.cacheDir, `${engineId}_${modelName}.json.tmp`);
      if (fs.existsSync(configTempPath)) {
        try { fs.unlinkSync(configTempPath); } catch (_) {}
      }
      throw err;
    }
  }

  /**
   * Resolves remote download URL for engine binary release package based on OS and architecture.
   *
   * @param {string} engineId Engine identifier.
   * @returns {string} Download URL string.
   */
  getEngineDownloadUrl(engineId) {
    const descriptor = this.registry.get(engineId);
    if (descriptor && descriptor.release && descriptor.release.downloads) {
      const platformKey = `${process.platform}_${process.arch}`;
      const url = descriptor.release.downloads[platformKey] ||
                  descriptor.release.downloads[`${process.platform}_x64`] ||
                  Object.values(descriptor.release.downloads)[0];
      if (url) return url;
    }
    throw new Error(`No registered binary download source found for engine '${engineId}' on ${process.platform}_${process.arch}.`);
  }

  /**
   * Downloads and unpacks an engine executable release package into engines/{engineId}/.
   *
   * @param {string} engineId Engine identifier.
   * @param {function({ loaded: number, total: number }): void} [onProgress] Progress callback.
   * @returns {Promise<string>} Path to installed executable.
   */
  async installEngineBinary(engineId, onProgress) {
    const url = this.getEngineDownloadUrl(engineId);
    const descriptor = this.registry.get(engineId);
    const targetEngineDir = path.join(this.enginesDir, engineId);

    if (!fs.existsSync(targetEngineDir)) {
      fs.mkdirSync(targetEngineDir, { recursive: true });
    }

    const isZip = url.endsWith('.zip');
    const archiveExt = isZip ? '.zip' : (url.endsWith('.tgz') ? '.tgz' : '.tar.gz');
    const tempArchivePath = path.join(this.cacheDir, `${engineId}_release${archiveExt}`);

    try {
      // 1. Download engine archive
      await DownloadManager.downloadFile(url, tempArchivePath, onProgress);

      // 2. Unpack archive to engine directory
      await DownloadManager.unpackArchive(tempArchivePath, targetEngineDir);

      const execName = descriptor ? descriptor.executableName : (process.platform === 'win32' ? `${engineId}.exe` : engineId);
      const expectedPath = path.join(targetEngineDir, execName);

      // Search recursively in targetEngineDir for the extracted executable if not directly at expected path
      let actualExtractedPath = fs.existsSync(expectedPath) ? expectedPath : this.findExecutableInDir(targetEngineDir, execName);

      // If binary was extracted into a nested subfolder or with alias name, copy/flatten to expectedPath
      if (actualExtractedPath && actualExtractedPath !== expectedPath) {
        try {
          fs.copyFileSync(actualExtractedPath, expectedPath);
        } catch (copyErr) {
          console.warn(`[LocalEngineManager] Failed to copy extracted binary ${actualExtractedPath} to ${expectedPath}:`, copyErr);
        }
      }

      const finalExecPath = fs.existsSync(expectedPath) ? expectedPath : (actualExtractedPath || expectedPath);

      // 3. Set Unix executable permissions (0o755)
      let permissionsStr = 'N/A';
      if (fs.existsSync(finalExecPath) && process.platform !== 'win32') {
        try {
          fs.chmodSync(finalExecPath, 0o755);
          const stat = fs.statSync(finalExecPath);
          permissionsStr = (stat.mode & 0o777).toString(8);
        } catch (chmodErr) {
          console.warn(`[LocalEngineManager] Failed to set 0o755 permissions on ${finalExecPath}:`, chmodErr);
        }
      }

      const manifestPath = path.join(targetEngineDir, 'manifest.json');
      // 4. Write/update local manifest
      this.writeLocalManifest(engineId, {
        id: engineId,
        version: descriptor?.release?.version || '1.0.0',
        executable: execName,
        installedAt: new Date().toISOString(),
        state: 'INSTALLED',
      });

      const extractedFilename = actualExtractedPath ? path.basename(actualExtractedPath) : 'NOT_FOUND';
      const platformKey = `${process.platform}_${process.arch}`;

      // Detailed Diagnostic Debug Logging
      console.log(`[LocalEngineManager Diagnostic Log]`);
      console.log(`  - process.platform: ${process.platform}`);
      console.log(`  - process.arch: ${process.arch}`);
      console.log(`  - selected package key: ${platformKey}`);
      console.log(`  - selected download URL: ${url}`);
      console.log(`  - extracted executable filename: ${extractedFilename}`);
      console.log(`  - userData directory: ${this.app.getPath('userData')}`);
      console.log(`  - expected executable path: ${expectedPath}`);
      console.log(`  - actual extracted executable path: ${actualExtractedPath || 'NOT_FOUND'}`);
      console.log(`  - final executable path: ${finalExecPath}`);
      console.log(`  - fs.existsSync(expectedPath): ${fs.existsSync(expectedPath)}`);
      console.log(`  - executable permissions: ${permissionsStr}`);
      console.log(`  - manifest location: ${manifestPath}`);

      if (fs.existsSync(tempArchivePath)) {
        try { fs.unlinkSync(tempArchivePath); } catch (_) {}
      }

      return finalExecPath;
    } catch (err) {
      if (fs.existsSync(tempArchivePath)) {
        try { fs.unlinkSync(tempArchivePath); } catch (_) {}
      }
      throw err;
    }
  }
}

module.exports = LocalEngineManager;

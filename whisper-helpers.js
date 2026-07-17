const path = require('path');
const fs = require('fs');

/**
 * Service responsible for resolving the filesystem path of the precompiled whisper-cli executable.
 */
class WhisperBinaryLocator {
  /**
   * Resolves the path of the native binary.
   * 
   * @param {import('electron').App} app The Electron app instance.
   * @returns {string} Fully resolved path to the executable.
   */
  static locate(app) {
    const isDev = !app.isPackaged;
    
    // Search candidates in order of priority (app resources, local root, user directories)
    const possiblePaths = [
      // Packaged paths / Development paths under bin/
      path.join(app.getAppPath(), 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(app.getAppPath(), 'bin', process.platform === 'win32' ? 'main.exe' : 'main'),
      // Root paths
      path.join(app.getAppPath(), process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
      path.join(app.getAppPath(), process.platform === 'win32' ? 'main.exe' : 'main'),
      // AppData paths (e.g. for user-installed binaries)
      path.join(app.getPath('userData'), 'bin', process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli'),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default fallback to command line search
    return process.platform === 'win32' ? 'whisper-cli.exe' : 'whisper-cli';
  }
}

/**
 * Service responsible for resolving the active model file (.bin) from available directories.
 */
class WhisperModelManager {
  /**
   * Resolves the path of the active Whisper model file.
   * 
   * @param {import('electron').App} app The Electron app instance.
   * @param {string} [preferredModelName='ggml-tiny.bin'] The filename of the model.
   * @returns {string} Fully resolved path to the model file.
   */
  static resolveActiveModelPath(app, preferredModelName = 'ggml-tiny.bin') {
    const possibleModelPaths = [
      path.join(app.getAppPath(), 'models', preferredModelName),
      path.join(app.getAppPath(), preferredModelName),
      path.join(app.getPath('userData'), 'models', preferredModelName),
      path.join(app.getPath('userData'), preferredModelName),
    ];

    for (const p of possibleModelPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default target path (which will fail with a descriptive error message if missing)
    return path.join(app.getAppPath(), 'models', preferredModelName);
  }
}

module.exports = {
  WhisperBinaryLocator,
  WhisperModelManager,
};

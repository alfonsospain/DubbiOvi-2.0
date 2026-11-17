/**
 * Thin backward-compatibility wrappers for Whisper binary and model resolution.
 * All filesystem resolution logic is delegated to LocalEngineManager.
 */
class WhisperBinaryLocator {
  /**
   * Resolves the path of the native whisper-cli binary.
   * 
   * @param {import('electron').App} [app] The Electron app instance.
   * @param {import('./local-engine-manager')} [engineManager] Optional LocalEngineManager instance.
   * @param {'optimized'|'baseline'|string} [preferredVariant='baseline'] Target variant.
   * @returns {string} Fully resolved path to the executable.
   */
  static locate(app, engineManager, preferredVariant = 'baseline') {
    const manager = engineManager || (app && app.engineManager);
    if (manager && typeof manager.locateExecutable === 'function') {
      const targetEngine = preferredVariant === 'baseline' ? 'whisper-baseline' : 'whisper';
      const exec = manager.locateExecutable(targetEngine);
      if (exec && require('fs').existsSync(exec)) return exec;
    }

    // Direct fallback if manager instance is not attached
    const isWin = process.platform === 'win32';
    const path = require('path');
    const fs = require('fs');

    const appPath = app && typeof app.getAppPath === 'function' ? app.getAppPath() : __dirname;
    const userDataPath = app && typeof app.getPath === 'function' ? app.getPath('userData') : '';
    const resourcesPath = process.resourcesPath || (app && app.isPackaged ? path.join(appPath, '..') : '');

    // On Windows, the binary is whisper-cli.exe. On other OSes during tests or cross-platform
    // resolution of Windows bundled baseline, support both whisper-cli and whisper-cli.exe.
    const execNames = isWin ? ['whisper-cli.exe'] : ['whisper-cli.exe', 'whisper-cli'];
    const defaultExecName = isWin ? 'whisper-cli.exe' : 'whisper-cli';

    const candidatePaths = [];

    // If baseline variant is preferred, look for bundled baseline runtime first
    if (preferredVariant === 'baseline') {
      for (const name of execNames) {
        if (resourcesPath) {
          candidatePaths.push(path.join(resourcesPath, 'bin', 'whisper-baseline', name));
        }
        candidatePaths.push(path.join(appPath, 'bin', 'whisper-baseline', name));
        candidatePaths.push(path.join(process.cwd(), 'bin', 'whisper-baseline', name));
        if (userDataPath) {
          candidatePaths.push(path.join(userDataPath, 'runtimes', 'whisper-baseline', '1.9.1', 'bin', name));
        }
      }
    } else {
      // If optimized variant is preferred, look for managed runtime first
      for (const name of execNames) {
        if (userDataPath) {
          candidatePaths.push(path.join(userDataPath, 'runtimes', 'whisper', '1.9.1', 'bin', name));
          candidatePaths.push(path.join(userDataPath, 'engines', 'whisper', name));
        }
      }
    }

    // Generic fallback candidate locations
    for (const name of execNames) {
      if (resourcesPath) {
        candidatePaths.push(path.join(resourcesPath, 'bin', name));
        candidatePaths.push(path.join(resourcesPath, 'bin', 'whisper-baseline', name));
      }
      candidatePaths.push(path.join(appPath, 'bin', name));
      candidatePaths.push(path.join(appPath, 'bin', 'whisper-baseline', name));
      candidatePaths.push(path.join(process.cwd(), 'bin', name));
      candidatePaths.push(path.join(process.cwd(), 'bin', 'whisper-baseline', name));
      if (userDataPath) {
        candidatePaths.push(path.join(userDataPath, 'engines', 'whisper', name));
        candidatePaths.push(path.join(userDataPath, 'bin', name));
        candidatePaths.push(path.join(userDataPath, 'runtimes', 'whisper', '1.9.1', 'bin', name));
        candidatePaths.push(path.join(userDataPath, 'runtimes', 'whisper-baseline', '1.9.1', 'bin', name));
      }
      candidatePaths.push(path.join(appPath, name));
    }

    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        return p;
      }
    }

    return defaultExecName;
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
   * @param {import('./local-engine-manager')} [engineManager] Optional LocalEngineManager instance.
   * @returns {string} Fully resolved path to the model file.
   */
  static resolveActiveModelPath(app, preferredModelName = 'ggml-tiny.bin', engineManager) {
    const manager = engineManager || (app && app.engineManager);
    if (manager && typeof manager.locateModel === 'function') {
      return manager.locateModel('whisper', preferredModelName);
    }

    // Direct fallback if manager instance is not attached
    const path = require('path');
    const fs = require('fs');

    const possibleModelPaths = [
      path.join(app.getPath('userData'), 'models', 'whisper', preferredModelName),
      path.join(app.getPath('userData'), 'models', preferredModelName),
      path.join(app.getAppPath(), 'models', preferredModelName),
      path.join(app.getAppPath(), preferredModelName),
      path.join(app.getPath('userData'), preferredModelName),
    ];

    for (const p of possibleModelPaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return path.join(app.getPath('userData'), 'models', 'whisper', preferredModelName);
  }
}

/**
 * Normalizes an incoming language string for whisper-cli.
 * 'Auto-Detect', 'none', empty string, or 'auto' map to 'auto'.
 * Explicit language codes or tags (e.g. 'ES', 'es', 'es-ES') are normalized to lowercase ISO codes (e.g. 'es').
 *
 * @param {string} [language]
 * @returns {string}
 */
function normalizeWhisperLanguage(language) {
  const clean = (language || '').trim().toLowerCase();
  if (!clean || clean === 'auto-detect' || clean === 'none' || clean === 'auto') {
    return 'auto';
  }
  return clean.split('-')[0].split('_')[0];
}

/**
 * Builds command line arguments for whisper-cli.
 *
 * @param {Object} params
 * @param {string} params.modelPath
 * @param {string} params.audioPath
 * @param {string} [params.language]
 * @param {boolean} [params.isIntelMac]
 * @param {string} [params.outputPrefix]
 * @returns {string[]}
 */
function buildWhisperArgs({ modelPath, audioPath, language, isIntelMac, outputPrefix }) {
  const args = ['-m', modelPath, '-f', audioPath, '-oj'];

  if (outputPrefix) {
    args.push('-of', outputPrefix);
  }

  args.push('-l', normalizeWhisperLanguage(language));

  if (isIntelMac) {
    args.push('-ng', '-nfa');
  }

  return args;
}

module.exports = {
  WhisperBinaryLocator,
  WhisperModelManager,
  normalizeWhisperLanguage,
  buildWhisperArgs,
};


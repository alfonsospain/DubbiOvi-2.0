/**
 * Thin backward-compatibility wrappers for Whisper binary and model resolution.
 * All filesystem resolution logic is delegated to LocalEngineManager.
 */
class WhisperBinaryLocator {
  /**
   * Resolves the path of the native whisper-cli binary.
   * 
   * @param {import('electron').App} app The Electron app instance.
   * @param {import('./local-engine-manager')} [engineManager] Optional LocalEngineManager instance.
   * @returns {string} Fully resolved path to the executable.
   */
  static locate(app, engineManager) {
    const manager = engineManager || (app && app.engineManager);
    if (manager && typeof manager.locateExecutable === 'function') {
      return manager.locateExecutable('whisper');
    }

    // Direct fallback if manager instance is not attached
    const isWin = process.platform === 'win32';
    const execName = isWin ? 'whisper-cli.exe' : 'whisper-cli';
    const path = require('path');
    const fs = require('fs');

    const possiblePaths = [
      path.join(app.getPath('userData'), 'engines', 'whisper', execName),
      path.join(app.getAppPath(), 'bin', execName),
      path.join(app.getAppPath(), execName),
      path.join(app.getPath('userData'), 'bin', execName),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return execName;
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


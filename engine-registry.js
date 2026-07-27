/**
 * Central registry managing EngineDescriptor definitions across the application.
 */
class EngineRegistry {
  constructor() {
    /** @type {Map<string, import('./src/lib/types/engine-types').EngineDescriptor>} */
    this.descriptors = new Map();
  }

  /**
   * Registers an engine descriptor into the registry.
   *
   * @param {Object} descriptor Engine descriptor definition.
   * @param {string} descriptor.id Unique engine identifier.
   * @param {string} descriptor.name Human-readable engine name.
   * @param {'asr'|'mt'|'tts'|'llm'} descriptor.category Engine domain category.
   * @param {string} descriptor.executableName Platform-specific binary filename.
   * @param {string[]} descriptor.supportedModelExtensions Model file extensions for dynamic discovery.
   * @param {string} [descriptor.description] Brief description.
   */
  register(descriptor) {
    if (!descriptor || !descriptor.id || !descriptor.name || !descriptor.category || !descriptor.executableName) {
      throw new Error('Invalid EngineDescriptor. Required fields: id, name, category, executableName.');
    }

    this.descriptors.set(descriptor.id, {
      ...descriptor,
      supportedModelExtensions: descriptor.supportedModelExtensions || [],
    });
  }

  /**
   * Retrieves an engine descriptor by ID.
   *
   * @param {string} engineId Unique engine identifier.
   * @returns {Object|undefined} Engine descriptor or undefined.
   */
  get(engineId) {
    return this.descriptors.get(engineId);
  }

  /**
   * Returns all registered engine descriptors.
   *
   * @returns {Object[]} List of all engine descriptors.
   */
  getAll() {
    return Array.from(this.descriptors.values());
  }

  /**
   * Returns engine descriptors matching a specific domain category.
   *
   * @param {'asr'|'mt'|'tts'|'llm'} category Domain category.
   * @returns {Object[]} Matching engine descriptors.
   */
  getByCategory(category) {
    return this.getAll().filter((desc) => desc.category === category);
  }

  /**
   * Registers default known engines into the registry.
   */
  registerDefaults() {
    const isWin = process.platform === 'win32';

    // 1. Whisper.cpp Engine (ASR)
    this.register({
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      executableName: isWin ? 'whisper-cli.exe' : 'whisper-cli',
      supportedModelExtensions: ['.bin'],
      description: 'High performance local speech recognition powered by whisper.cpp',
      knownModels: [
        {
          filename: 'ggml-tiny.bin',
          name: 'Tiny (75 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
          estimatedSize: '~75 MB',
        },
        {
          filename: 'ggml-base.bin',
          name: 'Base (142 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
          estimatedSize: '~142 MB',
        },
        {
          filename: 'ggml-small.bin',
          name: 'Small (466 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
          estimatedSize: '~466 MB',
        },
      ],
      release: {
        version: '1.5.4',
        estimatedSize: '~12 MB',
        downloads: {
          darwin_arm64: 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip',
          darwin_x64: 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip',
          win32_x64: 'https://github.com/ggerganov/whisper.cpp/releases/download/v1.5.4/whisper-bin-x64.zip',
        },
      },
    });

    // 2. Ollama Engine (MT / LLM)
    this.register({
      id: 'ollama',
      name: 'Ollama Engine',
      category: 'llm',
      executableName: isWin ? 'ollama.exe' : 'ollama',
      supportedModelExtensions: ['.gguf', '.bin'],
      description: 'Local large language model runtime for translation and intelligence',
    });

    // 3. Piper Engine (TTS)
    this.register({
      id: 'piper',
      name: 'Piper Speech Engine',
      category: 'tts',
      executableName: isWin ? 'piper.exe' : 'piper',
      supportedModelExtensions: ['.onnx', '.json'],
      description: 'Fast, local neural text-to-speech engine',
      knownModels: [
        {
          filename: 'en_US-lessac-high.onnx',
          name: 'English (US) - Lessac High',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json',
          estimatedSize: '~102 MB',
        },
        {
          filename: 'es_ES-davefx-medium.onnx',
          name: 'Spanish (ES) - Dave FX Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json',
          estimatedSize: '~65 MB',
        },
        {
          filename: 'fr_FR-upmc-medium.onnx',
          name: 'French (FR) - UPMC Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx.json',
          estimatedSize: '~63 MB',
        },
      ],
    });

    // 4. Kokoro Engine (TTS)
    this.register({
      id: 'kokoro',
      name: 'Kokoro TTS Engine',
      category: 'tts',
      executableName: isWin ? 'kokoro.exe' : 'kokoro',
      supportedModelExtensions: ['.pth', '.onnx', '.bin'],
      description: 'Lightweight, high-quality local text-to-speech',
    });
  }
}

module.exports = EngineRegistry;

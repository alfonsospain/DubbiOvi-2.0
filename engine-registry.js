const path = require('path');

/**
 * Registry of supported native engine runtimes in DubbiOvi 2.0.
 * Defines versions, binaries, and platform targets for execution.
 */
class EngineRegistry {
  constructor() {
    this.engines = new Map();
    this.registerDefaults();
  }

  register(engineDescriptor) {
    if (!engineDescriptor.id) {
      throw new Error('Engine descriptor must have an id');
    }
    this.engines.set(engineDescriptor.id, engineDescriptor);
  }

  get(id) {
    return this.engines.get(id);
  }

  getEngine(id) {
    return this.engines.get(id);
  }

  getAll() {
    return Array.from(this.engines.values());
  }

  getAllEngines() {
    return Array.from(this.engines.values());
  }

  registerDefaults() {
    const isWin = process.platform === 'win32';

    // 1. Whisper Engine (ASR)
    this.register({
      id: 'whisper',
      name: 'Whisper C++ ASR Engine',
      category: 'asr',
      executableName: isWin ? 'main.exe' : 'main',
      supportedModelExtensions: ['.bin'],
      description: 'High-performance offline C++ speech recognition engine',
      knownModels: [
        {
          filename: 'ggml-tiny.bin',
          name: 'Whisper Tiny (39 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin',
          estimatedSize: '39 MB',
        },
        {
          filename: 'ggml-base.bin',
          name: 'Whisper Base (142 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
          estimatedSize: '142 MB',
        },
        {
          filename: 'ggml-small.bin',
          name: 'Whisper Small (466 MB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin',
          estimatedSize: '466 MB',
        },
        {
          filename: 'ggml-medium.bin',
          name: 'Whisper Medium (1.5 GB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin',
          estimatedSize: '1.5 GB',
        },
        {
          filename: 'ggml-large-v3.bin',
          name: 'Whisper Large v3 (3.1 GB)',
          downloadUrl: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin',
          estimatedSize: '3.1 GB',
        },
      ],
    });

    // 2. Ollama Engine (LLM / Translation)
    this.register({
      id: 'ollama',
      name: 'Ollama Local LLM',
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
          filename: 'en_US-amy-medium.onnx',
          name: 'English (US) - Amy Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json',
          estimatedSize: '~60 MB',
        },
        {
          filename: 'en_GB-alan-medium.onnx',
          name: 'English (UK) - Alan Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json',
          estimatedSize: '~64 MB',
        },
        {
          filename: 'es_ES-davefx-medium.onnx',
          name: 'Spanish (ES) - Dave FX Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/es_ES-davefx-medium.onnx.json',
          estimatedSize: '~65 MB',
        },
        {
          filename: 'es_MX-ald-medium.onnx',
          name: 'Spanish (MX) - Ald Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_MX/ald/medium/es_MX-ald-medium.onnx.json',
          estimatedSize: '~58 MB',
        },
        {
          filename: 'fr_FR-upmc-medium.onnx',
          name: 'French (FR) - UPMC Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/fr/fr_FR/upmc/medium/fr_FR-upmc-medium.onnx.json',
          estimatedSize: '~63 MB',
        },
        {
          filename: 'de_DE-thorsten-high.onnx',
          name: 'German (DE) - Thorsten High',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high/de_DE-thorsten-high.onnx.json',
          estimatedSize: '~115 MB',
        },
        {
          filename: 'it_IT-riccardo-x_low.onnx',
          name: 'Italian (IT) - Riccardo Low',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/it/it_IT/riccardo/x_low/it_IT-riccardo-x_low.onnx.json',
          estimatedSize: '~28 MB',
        },
        {
          filename: 'pt_BR-edresson-low.onnx',
          name: 'Portuguese (BR) - Edresson Low',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/pt/pt_BR/edresson/low/pt_BR-edresson-low.onnx.json',
          estimatedSize: '~29 MB',
        },
        {
          filename: 'zh_CN-huayan-medium.onnx',
          name: 'Chinese (CN) - Huayan Medium',
          downloadUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx',
          configUrl: 'https://huggingface.co/rhasspy/piper-voices/resolve/main/zh/zh_CN/huayan/medium/zh_CN-huayan-medium.onnx.json',
          estimatedSize: '~66 MB',
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

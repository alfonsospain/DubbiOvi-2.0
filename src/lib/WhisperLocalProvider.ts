import fs from 'fs';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { TranscriptionProvider, ProviderCapabilities, TranscriptResult, PreparedAudio } from './transcription-types';
import { parseTimestampToSeconds } from './utils';
import { RuntimeExecutionResult } from '../runtime/RuntimeExecutionResult';
import { RuntimeExecutionOptions } from '../runtime/RuntimeExecution';
import { RuntimeExecutor } from '../runtime/RuntimeExecutor';

/**
 * Execution result returned by WhisperLocalProvider.transcribeAudio.
 */
export interface WhisperExecutionResult {
  rawOutput: string;
  execution: RuntimeExecutionResult;
}

/**
 * Parser responsible for converting the JSON output from whisper-cli
 * into a strongly typed TranscriptResult conforming to the domain definition.
 */
export class WhisperLocalParser {
  public static parse(rawResult: any): TranscriptResult {
    // If conversion happened inside the Main Process, return TranscriptResult directly
    if (rawResult && Array.isArray(rawResult.takes)) {
      return rawResult as TranscriptResult;
    }

    // Support both whisper-cli top-level rawResult.transcription and nested rawResult.result.transcription
    const transcription = Array.isArray(rawResult?.transcription)
      ? rawResult.transcription
      : Array.isArray(rawResult?.result?.transcription)
      ? rawResult.result.transcription
      : [];

    const detectedLanguage = rawResult?.result?.language || rawResult?.params?.language || rawResult?.language || 'en';

    const takes = transcription.map((segment: any) => {
      // whisper.cpp output timestamps can be e.g. "00:00:02,300"
      // Replace commas with dots for parseTimestampToSeconds compatibility
      const fromTime = (segment.timestamps?.from || '00:00:00.000').replace(',', '.');
      const toTime = (segment.timestamps?.to || '00:00:00.000').replace(',', '.');

      return {
        id: uuidv4(),
        character: 'Speaker 1',
        time: `${fromTime} - ${toTime}`,
        startSeconds: parseTimestampToSeconds(fromTime),
        endSeconds: parseTimestampToSeconds(toTime),
        original: (segment.text || '').trim(),
        translation: '',
        notes: '',
        status: 'Pending' as const,
      };
    });

    return {
      detectedLanguage: detectedLanguage.toUpperCase(),
      takes,
      metadata: {
        modelName: typeof rawResult?.model === 'string' ? rawResult.model : rawResult?.model?.type || 'local-whisper-model',
      }
    };
  }
}

/**
 * TranscriptionProvider implementation for local whisper.cpp execution & runtime lifecycle management.
 */
export class WhisperLocalProvider implements TranscriptionProvider {
  public readonly id = 'whisper-local';
  public readonly runtimeId = 'whisper';
  public readonly name = 'Whisper Local (Offline)';
  public readonly capabilities: ProviderCapabilities = {
    supportsLanguageDetection: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'JA', 'ZH', 'IT', 'PT', 'RU', 'KO'],
    supportsWordTimestamps: true,
    supportsSpeakerDiarization: false,
    isOffline: true,
    requiresApiKey: false,
    audio: {
      format: 'wav',
      sampleRate: 16000,
      channels: 1,
      normalize: true,
    }
  };

  private activeModelName?: string;
  private targetVersion: string = '1.9.1';
  private executor?: RuntimeExecutor;

  /**
   * Constructs the provider with optional active model name, target version, and RuntimeExecutor.
   */
  constructor(activeModelName?: string, targetVersion = '1.9.1', executor?: RuntimeExecutor) {
    this.activeModelName = activeModelName;
    this.targetVersion = targetVersion;
    this.executor = executor;
  }

  /**
   * Checks whether the underlying Whisper engine runtime is installed via RuntimeRegistry IPC.
   */
  public async checkRuntimeStatus(version = this.targetVersion): Promise<{ isInstalled: boolean; info?: any }> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      return { isInstalled: false };
    }
    try {
      return await (window as any).electron.checkRuntimeInstalled(this.runtimeId, version);
    } catch (err) {
      console.error('[WhisperLocalProvider] Error checking runtime status:', err);
      return { isInstalled: false };
    }
  }

  /**
   * Fetches the catalog descriptor for the Whisper runtime via RuntimeRepository IPC.
   */
  public async getRuntimeDescriptor(version = this.targetVersion): Promise<any> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) return null;
    return (window as any).electron.getRuntimeDescriptor(this.runtimeId, version);
  }

  /**
   * Requests atomic installation of the Whisper runtime via RuntimeManager IPC.
   */
  public async ensureRuntimeInstalled(
    onProgress?: (progress: any) => void,
    version = this.targetVersion
  ): Promise<any> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      throw new Error('Whisper Local runtime installation is only supported inside the desktop app.');
    }

    const status = await this.checkRuntimeStatus(version);
    if (status.isInstalled && status.info) {
      return status.info;
    }

    let unsubProgress: (() => void) | null = null;
    if (onProgress && typeof (window as any).electron.onRuntimeDownloadProgress === 'function') {
      unsubProgress = (window as any).electron.onRuntimeDownloadProgress((data: any) => {
        if (data.runtimeId === this.runtimeId) {
          onProgress(data);
        }
      });
    }

    try {
      const installedInfo = await (window as any).electron.installRuntime(this.runtimeId, version);
      return installedInfo;
    } finally {
      if (unsubProgress) unsubProgress();
    }
  }

  /**
   * Locates the runtime executable through RuntimeRegistry.
   */
  public async getExecutablePath(version = this.targetVersion): Promise<string | null> {
    const status = await this.checkRuntimeStatus(version);
    return status.isInstalled && status.info ? status.info.executablePath : null;
  }

  /**
   * Transcribes a PreparedAudio object using local whisper.cpp execution via Electron IPC.
   */
  public async transcribe(
    audio: PreparedAudio,
    sourceLanguage?: string,
    apiKey?: string
  ): Promise<TranscriptResult> {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (!isElectron) {
      throw new Error('Whisper Local is only supported when running inside the desktop app (Electron).');
    }

    // Ensure runtime is installed before proceeding
    const status = await this.checkRuntimeStatus();
    if (!status.isInstalled) {
      throw new Error('Whisper Local runtime is missing. Please install the engine runtime first.');
    }

    // Convert PreparedAudio.blob to ArrayBuffer for IPC transfer
    const arrayBuffer = await audio.blob.arrayBuffer();

    let rawResult;
    try {
      rawResult = await (window as any).electron.runWhisperLocal(arrayBuffer, this.activeModelName, sourceLanguage);
    } catch (err: any) {
      console.error('Whisper Local transcription error:', err);
      throw new Error(`Whisper Local Error: ${err.message || String(err)}`);
    }

    if (!rawResult || !rawResult.result || !rawResult.result.transcription) {
      throw new Error('Whisper Local failed to generate a valid transcription result.');
    }

    return WhisperLocalParser.parse(rawResult);
  }

  /**
   * Milestone 7B — Direct execution of Whisper runtime against a local WAV audio file.
   *
   * Executes Whisper via RuntimeExecutor against a WAV audio file and returns the raw output
   * string without parsing, mapping, or inspecting domain data structures.
   *
   * @param audioPath Path to input WAV audio file.
   * @param modelPath Path to input Whisper model file.
   * @param options Runtime execution options (args, env, cwd, timeoutMs, signal, onStdout, onStderr, executor).
   */
  public async transcribeAudio(
    audioPath: string,
    modelPath: string,
    options?: Partial<RuntimeExecutionOptions> & { executor?: RuntimeExecutor; language?: string }
  ): Promise<WhisperExecutionResult> {
    // 1. Validate input parameters
    if (!audioPath || typeof audioPath !== 'string') {
      throw new Error('Invalid parameter: audioPath is required and must be a string.');
    }
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Audio file not found at path: ${audioPath}`);
    }
    const audioStat = fs.statSync(audioPath);
    if (!audioStat.isFile()) {
      throw new Error(`Audio path is not a file: ${audioPath}`);
    }

    if (!modelPath || typeof modelPath !== 'string') {
      throw new Error('Invalid parameter: modelPath is required and must be a string.');
    }
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Whisper model file not found at path: ${modelPath}`);
    }
    const modelStat = fs.statSync(modelPath);
    if (!modelStat.isFile()) {
      throw new Error(`Model path is not a file: ${modelPath}`);
    }

    // 2. Resolve RuntimeExecutor instance
    const executor = options?.executor || this.executor;
    if (!executor) {
      throw new Error('RuntimeExecutor instance is required to execute Whisper local runtime.');
    }

    // 3. Prepare temporary output file prefix
    const tempDir = os.tmpdir();
    const outputPrefix = path.join(tempDir, `whisper_out_${uuidv4()}`);
    const expectedJsonFile = `${outputPrefix}.json`;

    // 4. Build command line arguments compatible with Whisper CLI
    const whisperArgs: string[] = [
      '-m', modelPath,
      '-f', audioPath,
      '-oj',
      '-of', outputPrefix
    ];

    const hasExplicitLangInArgs = options?.args && options.args.some((a) => a === '-l' || a === '--language');
    if (!hasExplicitLangInArgs) {
      const cleanLang = (options?.language || '').trim().toLowerCase();
      const normalizedLang = (!cleanLang || cleanLang === 'auto-detect' || cleanLang === 'none' || cleanLang === 'auto')
        ? 'auto'
        : cleanLang.split('-')[0].split('_')[0];
      whisperArgs.push('-l', normalizedLang);
    }

    if (options?.args && Array.isArray(options.args)) {
      whisperArgs.push(...options.args);
    }

    // 5. Invoke RuntimeExecutor
    let executionResult: RuntimeExecutionResult;
    try {
      executionResult = await executor.execute({
        runtimeId: this.runtimeId,
        version: options?.version || this.targetVersion,
        args: whisperArgs,
        cwd: options?.cwd,
        env: options?.env,
        timeoutMs: options?.timeoutMs,
        signal: options?.signal,
        onStdout: options?.onStdout,
        onStderr: options?.onStderr,
      });
    } catch (err: any) {
      throw new Error(`Whisper runtime execution exception: ${err.message || String(err)}`);
    }

    // 6. Validate process execution outcome
    if (!executionResult.success || executionResult.exitCode !== 0) {
      const detail = executionResult.error || executionResult.stderr || `Exit code ${executionResult.exitCode}`;
      throw new Error(`Whisper runtime process execution failed: ${detail}`);
    }

    // 7. Read & clean up output JSON payload
    let rawOutput = '';
    const targetJsonPath = fs.existsSync(expectedJsonFile)
      ? expectedJsonFile
      : fs.existsSync(`${audioPath}.json`)
      ? `${audioPath}.json`
      : null;

    if (!targetJsonPath) {
      throw new Error(`Whisper output JSON file missing after process completion. Expected: ${expectedJsonFile}`);
    }

    try {
      rawOutput = fs.readFileSync(targetJsonPath, 'utf8');
    } catch (readErr: any) {
      throw new Error(`Failed to read Whisper output file: ${readErr.message}`);
    } finally {
      try {
        if (fs.existsSync(targetJsonPath)) {
          fs.unlinkSync(targetJsonPath);
        }
      } catch (_) {}
    }

    // Opaque payload validation: must exist and be non-empty string
    if (!rawOutput || typeof rawOutput !== 'string' || rawOutput.trim().length === 0) {
      throw new Error('Whisper runtime produced an empty output file.');
    }

    return {
      rawOutput,
      execution: executionResult,
    };
  }
}

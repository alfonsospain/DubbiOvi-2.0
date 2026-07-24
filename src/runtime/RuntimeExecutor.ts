import fs from 'fs';
import path from 'path';
import { RuntimeRegistry } from './RuntimeRegistry';
import { RuntimeExecutionOptions } from './RuntimeExecution';
import { RuntimeExecutionResult } from './RuntimeExecutionResult';
import { RuntimeProcess } from './RuntimeProcess';

export class RuntimeExecutor {
  private registry: RuntimeRegistry;

  constructor(registry: RuntimeRegistry) {
    if (!registry) {
      throw new Error('RuntimeExecutor requires a valid RuntimeRegistry instance.');
    }
    this.registry = registry;
  }

  /**
   * Executes an installed runtime by locating its binary via RuntimeRegistry.
   *
   * @param options Execution parameters (runtimeId, version, args, env, timeout, signal).
   * @returns Promise resolving to RuntimeExecutionResult.
   */
  public async execute(options: RuntimeExecutionOptions): Promise<RuntimeExecutionResult> {
    if (!options || !options.runtimeId) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: 'Invalid options: runtimeId is required for execution.',
      };
    }

    // 1. Locate installed runtime executable via RuntimeRegistry
    const runtimeInfo = this.registry.get(options.runtimeId, options.version);
    if (!runtimeInfo) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: `Runtime '${options.runtimeId}' ${options.version ? `v${options.version}` : ''} is not registered or installed.`,
      };
    }

    const execPath = runtimeInfo.executablePath;
    return this.executeDirect(execPath, options);
  }

  /**
   * Directly executes a specified executable path with options.
   *
   * @param executablePath Path to executable file.
   * @param options Execution parameters.
   * @returns Promise resolving to RuntimeExecutionResult.
   */
  public async executeDirect(
    executablePath: string,
    options: Partial<RuntimeExecutionOptions> = {}
  ): Promise<RuntimeExecutionResult> {
    if (!executablePath || typeof executablePath !== 'string') {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: 'Invalid executable path provided.',
      };
    }

    if (!fs.existsSync(executablePath)) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: `Executable file not found at path: ${executablePath}`,
      };
    }

    const stat = fs.statSync(executablePath);
    if (!stat.isFile()) {
      return {
        success: false,
        exitCode: null,
        stdout: '',
        stderr: '',
        durationMs: 0,
        error: `Target path is a directory, not an executable file: ${executablePath}`,
      };
    }

    // Ensure POSIX execution permissions on Unix platforms
    if (process.platform !== 'win32') {
      try {
        fs.chmodSync(executablePath, 0o755);
      } catch (_) {}
    }

    const runtimeProcess = new RuntimeProcess();
    return runtimeProcess.execute(executablePath, options);
  }
}

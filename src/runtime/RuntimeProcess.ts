import { spawn, ChildProcess } from 'child_process';
import { RuntimeExecutionResult } from './RuntimeExecutionResult';
import { RuntimeExecutionOptions } from './RuntimeExecution';

export class RuntimeProcess {
  private childProcess: ChildProcess | null = null;
  private timeoutTimer: NodeJS.Timeout | null = null;
  private startTime = 0;
  private isSettled = false;

  /**
   * Spawns OS process and manages full lifecycle to resolution.
   *
   * @param executablePath Validated path to executable binary.
   * @param options Execution options (args, env, cwd, timeout, signal).
   * @returns Promise resolving to RuntimeExecutionResult.
   */
  public execute(
    executablePath: string,
    options: Partial<RuntimeExecutionOptions> = {}
  ): Promise<RuntimeExecutionResult> {
    return new Promise<RuntimeExecutionResult>((resolve) => {
      const args = options.args || [];
      const cwd = options.cwd || undefined;
      const env = { ...process.env, ...options.env };
      const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 60000;
      const signal = options.signal;

      let stdoutData = '';
      let stderrData = '';
      this.startTime = Date.now();

      const finish = (result: Partial<RuntimeExecutionResult>) => {
        if (this.isSettled) return;
        this.isSettled = true;

        this.cleanup();
        const durationMs = Date.now() - this.startTime;

        const finalResult: RuntimeExecutionResult = {
          success: result.success ?? false,
          exitCode: result.exitCode ?? null,
          stdout: stdoutData,
          stderr: stderrData,
          durationMs,
          error: result.error,
        };

        resolve(finalResult);
      };

      // Check pre-aborted signal
      if (signal?.aborted) {
        return finish({
          success: false,
          exitCode: null,
          error: 'Execution cancelled by user signal before spawn.',
        });
      }

      try {
        this.childProcess = spawn(executablePath, args, { cwd, env });
      } catch (err: any) {
        return finish({
          success: false,
          exitCode: null,
          error: `Failed to spawn executable: ${err.message}`,
        });
      }

      if (!this.childProcess || !this.childProcess.pid) {
        return finish({
          success: false,
          exitCode: null,
          error: `Failed to start process at path ${executablePath}`,
        });
      }

      // Stream listeners with real-time incremental callback invocation
      this.childProcess.stdout?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stdoutData += text;
        if (options.onStdout) {
          try {
            options.onStdout(text);
          } catch (_) {}
        }
      });

      this.childProcess.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        stderrData += text;
        if (options.onStderr) {
          try {
            options.onStderr(text);
          } catch (_) {}
        }
      });

      // Write stdin if inputData provided
      if (options.inputData && this.childProcess.stdin) {
        try {
          this.childProcess.stdin.write(options.inputData);
          this.childProcess.stdin.end();
        } catch (_) {}
      }

      // Timeout handler
      if (timeoutMs > 0) {
        this.timeoutTimer = setTimeout(() => {
          this.kill();
          finish({
            success: false,
            exitCode: null,
            error: `Process execution timed out after ${timeoutMs}ms`,
          });
        }, timeoutMs);
      }

      // AbortSignal listener
      if (signal) {
        signal.addEventListener('abort', () => {
          this.kill();
          finish({
            success: false,
            exitCode: null,
            error: 'Process execution cancelled by AbortSignal.',
          });
        });
      }

      // Process completion events
      this.childProcess.on('error', (err: Error) => {
        finish({
          success: false,
          exitCode: null,
          error: `Child process error: ${err.message}`,
        });
      });

      this.childProcess.on('close', (code: number | null) => {
        finish({
          success: code === 0,
          exitCode: code,
        });
      });
    });
  }

  /**
   * Safely terminates the running child process.
   */
  public kill(): void {
    if (this.childProcess && !this.childProcess.killed) {
      try {
        this.childProcess.kill('SIGTERM');
        // Force kill if process does not exit in 500ms
        setTimeout(() => {
          if (this.childProcess && !this.childProcess.killed) {
            try {
              this.childProcess.kill('SIGKILL');
            } catch (_) {}
          }
        }, 500);
      } catch (_) {}
    }
  }

  /**
   * Cleans up timeout timers and handles.
   */
  private cleanup(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    this.childProcess = null;
  }
}

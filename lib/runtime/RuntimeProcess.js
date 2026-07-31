"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeProcess = void 0;
const child_process_1 = require("child_process");
class RuntimeProcess {
    constructor() {
        this.childProcess = null;
        this.timeoutTimer = null;
        this.startTime = 0;
        this.isSettled = false;
    }
    /**
     * Spawns OS process and manages full lifecycle to resolution.
     *
     * @param executablePath Validated path to executable binary.
     * @param options Execution options (args, env, cwd, timeout, signal).
     * @returns Promise resolving to RuntimeExecutionResult.
     */
    execute(executablePath, options = {}) {
        return new Promise((resolve) => {
            const args = options.args || [];
            const cwd = options.cwd || undefined;
            const env = { ...process.env, ...options.env };
            const timeoutMs = options.timeoutMs && options.timeoutMs > 0 ? options.timeoutMs : 60000;
            const signal = options.signal;
            let stdoutData = '';
            let stderrData = '';
            this.startTime = Date.now();
            const finish = (result) => {
                if (this.isSettled)
                    return;
                this.isSettled = true;
                this.cleanup();
                const durationMs = Date.now() - this.startTime;
                const finalResult = {
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
                this.childProcess = (0, child_process_1.spawn)(executablePath, args, { cwd, env });
            }
            catch (err) {
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
            this.childProcess.stdout?.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                stdoutData += text;
                if (options.onStdout) {
                    try {
                        options.onStdout(text);
                    }
                    catch (_) { }
                }
            });
            this.childProcess.stderr?.on('data', (chunk) => {
                const text = chunk.toString('utf8');
                stderrData += text;
                if (options.onStderr) {
                    try {
                        options.onStderr(text);
                    }
                    catch (_) { }
                }
            });
            // Write stdin if inputData provided
            if (options.inputData && this.childProcess.stdin) {
                try {
                    this.childProcess.stdin.write(options.inputData);
                    this.childProcess.stdin.end();
                }
                catch (_) { }
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
            this.childProcess.on('error', (err) => {
                finish({
                    success: false,
                    exitCode: null,
                    error: `Child process error: ${err.message}`,
                });
            });
            this.childProcess.on('close', (code) => {
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
    kill() {
        if (this.childProcess && !this.childProcess.killed) {
            try {
                this.childProcess.kill('SIGTERM');
                // Force kill if process does not exit in 500ms
                setTimeout(() => {
                    if (this.childProcess && !this.childProcess.killed) {
                        try {
                            this.childProcess.kill('SIGKILL');
                        }
                        catch (_) { }
                    }
                }, 500);
            }
            catch (_) { }
        }
    }
    /**
     * Cleans up timeout timers and handles.
     */
    cleanup() {
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        this.childProcess = null;
    }
}
exports.RuntimeProcess = RuntimeProcess;

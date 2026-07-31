"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeExecutor = void 0;
const fs_1 = __importDefault(require("fs"));
const RuntimeProcess_1 = require("./RuntimeProcess");
class RuntimeExecutor {
    constructor(registry) {
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
    async execute(options) {
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
    async executeDirect(executablePath, options = {}) {
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
        if (!fs_1.default.existsSync(executablePath)) {
            return {
                success: false,
                exitCode: null,
                stdout: '',
                stderr: '',
                durationMs: 0,
                error: `Executable file not found at path: ${executablePath}`,
            };
        }
        const stat = fs_1.default.statSync(executablePath);
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
                fs_1.default.chmodSync(executablePath, 0o755);
            }
            catch (_) { }
        }
        const runtimeProcess = new RuntimeProcess_1.RuntimeProcess();
        return runtimeProcess.execute(executablePath, options);
    }
}
exports.RuntimeExecutor = RuntimeExecutor;

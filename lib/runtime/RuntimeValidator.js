"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeValidator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
class RuntimeValidator {
    /**
     * Computes SHA-256 hash of a file.
     */
    static computeSha256(filePath) {
        if (!fs_1.default.existsSync(filePath)) {
            throw new Error(`File not found for checksum calculation: ${filePath}`);
        }
        const fileBuffer = fs_1.default.readFileSync(filePath);
        return crypto_1.default.createHash('sha256').update(fileBuffer).digest('hex');
    }
    /**
     * Validates file SHA-256 against authoritative expected checksum.
     */
    static validateChecksum(filePath, expectedChecksum) {
        const actualChecksum = this.computeSha256(filePath);
        if (actualChecksum.toLowerCase() !== expectedChecksum.trim().toLowerCase()) {
            throw new Error(`SHA-256 checksum mismatch! Expected: '${expectedChecksum}', Actual: '${actualChecksum}'`);
        }
    }
    /**
     * Validates ZIP entry paths to prevent path traversal attacks (Zip Slip).
     */
    static validateZipEntryPaths(entryPaths) {
        for (const entryPath of entryPaths) {
            // Normalize slashes
            const normalized = entryPath.replace(/\\/g, '/');
            // Check for path traversal or absolute paths
            if (normalized.startsWith('/') ||
                /^[a-zA-Z]:/.test(normalized) ||
                normalized.split('/').includes('..')) {
                throw new Error(`Security Exception: Unsafe path traversal detected in ZIP package entry: '${entryPath}'`);
            }
        }
    }
    /**
     * Validates manifest schema v2.0.0, API version, platform/arch compatibility, and minimum app version.
     */
    static validateManifest(manifest, currentAppVersion, expectedPlatform = process.platform, expectedArch = process.arch) {
        if (!manifest || typeof manifest !== 'object') {
            throw new Error('Invalid manifest: manifest object is missing or null.');
        }
        if (manifest.schemaVersion !== '2.0.0') {
            throw new Error(`Incompatible manifest schemaVersion '${manifest.schemaVersion}'. Expected '2.0.0'.`);
        }
        if (!manifest.id || typeof manifest.id !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "id" field.');
        }
        if (!manifest.name || typeof manifest.name !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "name" field.');
        }
        if (!manifest.category || !['asr', 'tts', 'llm', 'mt'].includes(manifest.category)) {
            throw new Error(`Invalid manifest: invalid "category" field '${manifest.category}'.`);
        }
        if (!manifest.version || typeof manifest.version !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "version" field.');
        }
        if (!manifest.executable || typeof manifest.executable !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "executable" field.');
        }
        if (!manifest.runtimeApiVersion || typeof manifest.runtimeApiVersion !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "runtimeApiVersion" field.');
        }
        if (!manifest.minimumDubbiOviVersion || typeof manifest.minimumDubbiOviVersion !== 'string') {
            throw new Error('Invalid manifest: missing or invalid "minimumDubbiOviVersion" field.');
        }
        // Platform & Architecture Compatibility Check
        if (manifest.platform && manifest.platform !== expectedPlatform) {
            throw new Error(`Platform mismatch! Package platform '${manifest.platform}' does not match host platform '${expectedPlatform}'.`);
        }
        if (manifest.arch && manifest.arch !== expectedArch) {
            throw new Error(`Architecture mismatch! Package arch '${manifest.arch}' does not match host arch '${expectedArch}'.`);
        }
        // Minimum Application Version Compatibility Check
        const minAppVer = manifest.minimumDubbiOviVersion;
        if (minAppVer && this.compareSemver(minAppVer, currentAppVersion) > 0) {
            throw new Error(`Incompatible runtime package! Requires DubbiOvi v${manifest.minimumDubbiOviVersion} or higher (current version is v${currentAppVersion}).`);
        }
        return manifest;
    }
    /**
     * Simple semver version comparison helper.
     * Returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal.
     */
    static compareSemver(v1, v2) {
        const parse = (v) => v.replace(/^v/, '').split('.').map((n) => parseInt(n, 10) || 0);
        const p1 = parse(v1);
        const p2 = parse(v2);
        for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
            const n1 = p1[i] || 0;
            const n2 = p2[i] || 0;
            if (n1 > n2)
                return 1;
            if (n1 < n2)
                return -1;
        }
        return 0;
    }
    /**
     * Validates entrypoint binary containment within staging directory and checks file status.
     */
    static validateExtractedExecutable(stagingDir, executableRelativePath) {
        const resolvedPath = path_1.default.resolve(stagingDir, executableRelativePath);
        // Containment check: resolved path MUST be inside stagingDir
        const relative = path_1.default.relative(stagingDir, resolvedPath);
        if (relative.startsWith('..') || path_1.default.isAbsolute(relative)) {
            throw new Error(`Security Exception: Executable path '${executableRelativePath}' escapes staging directory containment.`);
        }
        if (!fs_1.default.existsSync(resolvedPath)) {
            throw new Error(`Extracted executable entrypoint not found at: ${resolvedPath}`);
        }
        const stat = fs_1.default.statSync(resolvedPath);
        if (!stat.isFile()) {
            throw new Error(`Extracted executable entrypoint is not a valid file: ${resolvedPath}`);
        }
        return resolvedPath;
    }
}
exports.RuntimeValidator = RuntimeValidator;

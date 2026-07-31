"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeManager = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const RuntimeRegistry_1 = require("./RuntimeRegistry");
const RuntimeDownloader_1 = require("./RuntimeDownloader");
const RuntimeValidator_1 = require("./RuntimeValidator");
const RuntimeInstaller_1 = require("./RuntimeInstaller");
class RuntimeManager {
    constructor(options) {
        if (!options || !options.runtimesDir || !options.cacheDir) {
            throw new Error('RuntimeManager requires runtimesDir and cacheDir options.');
        }
        this.runtimesDir = options.runtimesDir;
        this.cacheDir = options.cacheDir;
        this.appVersion = options.appVersion || '2.0.0';
        this.registry = options.registry || new RuntimeRegistry_1.RuntimeRegistry();
        this.downloader = options.downloader || new RuntimeDownloader_1.RuntimeDownloader();
        this.installer = options.installer || new RuntimeInstaller_1.RuntimeInstaller();
        this.initializeStorage();
    }
    /**
     * Initializes workspace directories and loads local state.
     */
    initializeStorage() {
        if (!fs_1.default.existsSync(this.runtimesDir)) {
            fs_1.default.mkdirSync(this.runtimesDir, { recursive: true });
        }
        if (!fs_1.default.existsSync(this.cacheDir)) {
            fs_1.default.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.registry.loadLocalState(this.runtimesDir);
    }
    /**
     * Orchestrates complete atomic installation pipeline:
     * Download Runtime → Validate (SHA256 & Manifest) → Install → Register → Available
     */
    async installRuntime(descriptor, onProgress, signal) {
        if (!descriptor || !descriptor.id || !descriptor.version || !descriptor.downloadUrl || !descriptor.checksumSha256) {
            throw new Error('Invalid RuntimeDescriptor: missing required fields (id, version, downloadUrl, checksumSha256).');
        }
        // Check if version is already installed and valid
        const existing = this.registry.get(descriptor.id, descriptor.version);
        if (existing && fs_1.default.existsSync(existing.executablePath)) {
            console.log(`[RuntimeManager] Runtime '${descriptor.id}' v${descriptor.version} is already installed.`);
            return existing;
        }
        const timestamp = Date.now();
        const tempZipPath = path_1.default.join(this.cacheDir, `${descriptor.id}_${descriptor.version}_${timestamp}.zip.tmp`);
        const stagingDir = path_1.default.join(this.cacheDir, `${descriptor.id}_${descriptor.version}_staging_${timestamp}`);
        const finalVersionedDir = path_1.default.join(this.runtimesDir, descriptor.id, descriptor.version);
        try {
            // -----------------------------------------------------------------------
            // Step 1: Download Archive
            // -----------------------------------------------------------------------
            console.log(`[RuntimeManager] [1/5] Downloading archive for '${descriptor.id}' v${descriptor.version}...`);
            await this.downloader.download(descriptor.downloadUrl, tempZipPath, onProgress, signal);
            // -----------------------------------------------------------------------
            // Step 2: Validate Authoritative Checksum BEFORE Extraction
            // -----------------------------------------------------------------------
            console.log(`[RuntimeManager] [2/5] Validating authoritative SHA-256 checksum...`);
            RuntimeValidator_1.RuntimeValidator.validateChecksum(tempZipPath, descriptor.checksumSha256);
            // -----------------------------------------------------------------------
            // Step 3: Extract Archive into Temporary Staging Directory
            // -----------------------------------------------------------------------
            console.log(`[RuntimeManager] [3/5] Extracting archive to staging directory...`);
            await this.installer.extractToStaging(tempZipPath, stagingDir);
            // -----------------------------------------------------------------------
            // Step 4: Validate Manifest, Platform/Arch, API Version & Entrypoint
            // -----------------------------------------------------------------------
            console.log(`[RuntimeManager] [4/5] Validating manifest, version compatibility & entrypoint...`);
            const manifestPath = path_1.default.join(stagingDir, 'manifest.json');
            if (!fs_1.default.existsSync(manifestPath)) {
                throw new Error(`Invalid package: missing manifest.json in package root.`);
            }
            const rawManifest = JSON.parse(fs_1.default.readFileSync(manifestPath, 'utf8'));
            const validatedManifest = RuntimeValidator_1.RuntimeValidator.validateManifest(rawManifest, this.appVersion, process.platform, process.arch);
            // Ensure manifest checksum match
            validatedManifest.checksumSha256 = descriptor.checksumSha256;
            fs_1.default.writeFileSync(manifestPath, JSON.stringify(validatedManifest, null, 2), 'utf8');
            // Validate entrypoint executable existence & containment
            const resolvedExecPathInStaging = RuntimeValidator_1.RuntimeValidator.validateExtractedExecutable(stagingDir, validatedManifest.executable);
            // -----------------------------------------------------------------------
            // Step 5: Atomic Promotion to Versioned Directory
            // -----------------------------------------------------------------------
            console.log(`[RuntimeManager] [5/5] Atomically promoting to ${finalVersionedDir}...`);
            this.installer.atomicPromote(stagingDir, finalVersionedDir);
            // Cleanup temporary ZIP file
            this.installer.cleanup([tempZipPath]);
            const finalExecPath = path_1.default.join(finalVersionedDir, validatedManifest.executable);
            const installedInfo = {
                id: validatedManifest.id,
                name: validatedManifest.name,
                category: validatedManifest.category,
                version: validatedManifest.version,
                executablePath: finalExecPath,
                installedPath: finalVersionedDir,
                installedAt: new Date().toISOString(),
                manifest: validatedManifest,
                status: 'INSTALLED',
            };
            // Register installed runtime
            this.registry.register(installedInfo);
            console.log(`[RuntimeManager] Runtime '${installedInfo.id}' v${installedInfo.version} successfully installed & available!`);
            return installedInfo;
        }
        catch (error) {
            console.error(`[RuntimeManager] Installation failed for '${descriptor.id}' v${descriptor.version}:`, error.message);
            // Clean up temporary files on failure
            this.installer.cleanup([tempZipPath, stagingDir]);
            throw error;
        }
    }
    /**
     * Retrieves an installed runtime record from registry.
     */
    getRuntime(id, version) {
        return this.registry.get(id, version);
    }
    /**
     * Returns list of all installed runtimes.
     */
    getAllRuntimes() {
        return this.registry.getAll();
    }
    /**
     * Removes an installed runtime version from disk and registry.
     */
    uninstallRuntime(id, version) {
        const info = this.registry.get(id, version);
        if (info && fs_1.default.existsSync(info.installedPath)) {
            try {
                fs_1.default.rmSync(info.installedPath, { recursive: true, force: true });
            }
            catch (err) {
                console.error(`[RuntimeManager] Error removing runtime folder ${info.installedPath}:`, err);
            }
        }
        return this.registry.unregister(id, version);
    }
}
exports.RuntimeManager = RuntimeManager;

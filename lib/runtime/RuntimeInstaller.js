"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeInstaller = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const RuntimeValidator_1 = require("./RuntimeValidator");
class RuntimeInstaller {
    /**
     * Unpacks archive (.zip, .tar.gz) into temporary staging directory with path traversal checks.
     */
    async extractToStaging(archivePath, stagingDir) {
        if (!fs_1.default.existsSync(archivePath)) {
            const cleanCheck = archivePath.replace(/\.tmp$/i, '');
            if (fs_1.default.existsSync(cleanCheck)) {
                archivePath = cleanCheck;
            }
            else {
                throw new Error(`Archive file not found: ${archivePath}`);
            }
        }
        // Rename temporary archive (.zip.tmp) to clean archive extension (.zip) for Expand-Archive compatibility
        const cleanPath = archivePath.replace(/\.tmp$/i, '');
        if (archivePath !== cleanPath && fs_1.default.existsSync(archivePath)) {
            fs_1.default.renameSync(archivePath, cleanPath);
            archivePath = cleanPath;
        }
        if (fs_1.default.existsSync(stagingDir)) {
            fs_1.default.rmSync(stagingDir, { recursive: true, force: true });
        }
        fs_1.default.mkdirSync(stagingDir, { recursive: true });
        // 1. Perform Unpacking
        await new Promise((resolve, reject) => {
            const isZip = archivePath.endsWith('.zip');
            const isTar = archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz');
            let cmd = '';
            let args = [];
            if (process.platform === 'win32') {
                if (isZip) {
                    cmd = 'powershell';
                    args = ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${stagingDir}' -Force`];
                }
                else {
                    cmd = 'tar';
                    args = ['-xzf', archivePath, '-C', stagingDir];
                }
            }
            else {
                if (isZip) {
                    cmd = 'unzip';
                    args = ['-q', '-o', archivePath, '-d', stagingDir];
                }
                else if (isTar) {
                    cmd = 'tar';
                    args = ['-xzf', archivePath, '-C', stagingDir];
                }
                else {
                    return reject(new Error(`Unsupported archive format: ${archivePath}`));
                }
            }
            const child = (0, child_process_1.spawn)(cmd, args);
            let stderr = '';
            child.stderr?.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            child.on('error', (err) => reject(err));
            child.on('close', (code) => {
                if (code !== 0) {
                    return reject(new Error(`Archive extraction failed (exit code ${code}): ${stderr}`));
                }
                resolve();
            });
        });
        // 2. Validate all extracted entries against Path Traversal
        const extractedRelativeFiles = this.getRelativeFiles(stagingDir);
        RuntimeValidator_1.RuntimeValidator.validateZipEntryPaths(extractedRelativeFiles);
        // 3. Flatten top-level wrapper directory if extracted archive wraps contents in a single folder
        this.flattenSingleRootFolder(stagingDir);
        // 4. Set POSIX 0o755 permissions for executables and bin/ directory files on non-Windows
        if (process.platform !== 'win32') {
            const binDir = path_1.default.join(stagingDir, 'bin');
            if (fs_1.default.existsSync(binDir)) {
                const binFiles = fs_1.default.readdirSync(binDir);
                for (const file of binFiles) {
                    const filePath = path_1.default.join(binDir, file);
                    try {
                        fs_1.default.chmodSync(filePath, 0o755);
                    }
                    catch (_) { }
                }
            }
        }
    }
    /**
     * If an archive extracts into a single top-level wrapper directory, flattens its contents to stagingDir root.
     */
    flattenSingleRootFolder(stagingDir) {
        if (fs_1.default.existsSync(path_1.default.join(stagingDir, 'manifest.json'))) {
            return;
        }
        const items = fs_1.default.readdirSync(stagingDir);
        if (items.length === 1) {
            const subFolder = path_1.default.join(stagingDir, items[0]);
            if (fs_1.default.statSync(subFolder).isDirectory()) {
                const subItems = fs_1.default.readdirSync(subFolder);
                for (const item of subItems) {
                    fs_1.default.renameSync(path_1.default.join(subFolder, item), path_1.default.join(stagingDir, item));
                }
                fs_1.default.rmSync(subFolder, { recursive: true, force: true });
            }
        }
    }
    /**
     * Atomically promotes staging directory to final versioned installation directory.
     */
    atomicPromote(stagingDir, finalTargetDir) {
        if (!fs_1.default.existsSync(stagingDir)) {
            throw new Error(`Staging directory does not exist: ${stagingDir}`);
        }
        const parentDir = path_1.default.dirname(finalTargetDir);
        if (!fs_1.default.existsSync(parentDir)) {
            fs_1.default.mkdirSync(parentDir, { recursive: true });
        }
        // Backup / remove existing installation directory if present
        const backupDir = `${finalTargetDir}_backup_${Date.now()}`;
        let backedUp = false;
        if (fs_1.default.existsSync(finalTargetDir)) {
            try {
                fs_1.default.renameSync(finalTargetDir, backupDir);
                backedUp = true;
            }
            catch (_) {
                // If rename fails, try force removal
                fs_1.default.rmSync(finalTargetDir, { recursive: true, force: true });
            }
        }
        try {
            // Atomic rename from staging to final versioned location
            fs_1.default.renameSync(stagingDir, finalTargetDir);
            // Clean up backup after success
            if (backedUp && fs_1.default.existsSync(backupDir)) {
                try {
                    fs_1.default.rmSync(backupDir, { recursive: true, force: true });
                }
                catch (_) { }
            }
        }
        catch (err) {
            // Rollback backup if atomic promotion failed
            if (backedUp && fs_1.default.existsSync(backupDir)) {
                try {
                    if (fs_1.default.existsSync(finalTargetDir)) {
                        fs_1.default.rmSync(finalTargetDir, { recursive: true, force: true });
                    }
                    fs_1.default.renameSync(backupDir, finalTargetDir);
                }
                catch (_) { }
            }
            throw new Error(`Atomic promotion of runtime directory failed: ${err.message}`);
        }
    }
    /**
     * Helper to collect relative file paths inside a directory.
     */
    getRelativeFiles(dir, baseDir = dir) {
        let results = [];
        const list = fs_1.default.readdirSync(dir);
        list.forEach((file) => {
            const fullPath = path_1.default.join(dir, file);
            const stat = fs_1.default.statSync(fullPath);
            const relPath = path_1.default.relative(baseDir, fullPath).replace(/\\/g, '/');
            if (stat && stat.isDirectory()) {
                results = results.concat(this.getRelativeFiles(fullPath, baseDir));
            }
            else {
                results.push(relPath);
            }
        });
        return results;
    }
    /**
     * Cleans up temporary files or directories.
     */
    cleanup(targetPaths) {
        for (const targetPath of targetPaths) {
            const candidates = Array.from(new Set([targetPath, targetPath.replace(/\.tmp$/i, '')]));
            for (const p of candidates) {
                if (fs_1.default.existsSync(p)) {
                    try {
                        const stat = fs_1.default.statSync(p);
                        if (stat.isDirectory()) {
                            fs_1.default.rmSync(p, { recursive: true, force: true });
                        }
                        else {
                            fs_1.default.unlinkSync(p);
                        }
                    }
                    catch (_) { }
                }
            }
        }
    }
}
exports.RuntimeInstaller = RuntimeInstaller;

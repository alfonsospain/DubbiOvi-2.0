"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeRegistry = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class RuntimeRegistry {
    constructor() {
        this.runtimes = new Map();
    }
    /**
     * Generates internal map key: runtimeId@version or runtimeId (if latest)
     */
    makeKey(id, version) {
        return version ? `${id}@${version}` : id;
    }
    /**
     * Registers an installed runtime record into the registry.
     */
    register(runtimeInfo) {
        if (!runtimeInfo || !runtimeInfo.id || !runtimeInfo.version) {
            throw new Error('Cannot register runtime: invalid runtimeInfo payload.');
        }
        const versionedKey = this.makeKey(runtimeInfo.id, runtimeInfo.version);
        this.runtimes.set(versionedKey, runtimeInfo);
        // Also set default/latest key
        this.runtimes.set(runtimeInfo.id, runtimeInfo);
    }
    /**
     * Unregisters an installed runtime from memory.
     */
    unregister(id, version) {
        const key = this.makeKey(id, version);
        const removed = this.runtimes.delete(key);
        if (version && this.runtimes.get(id)?.version === version) {
            this.runtimes.delete(id);
        }
        return removed;
    }
    /**
     * Retrieves an installed runtime info record by ID and optional version.
     */
    get(id, version) {
        const key = this.makeKey(id, version);
        return this.runtimes.get(key) || (version ? undefined : this.runtimes.get(id));
    }
    /**
     * Checks if a runtime version is installed and registered.
     */
    has(id, version) {
        return !!this.get(id, version);
    }
    /**
     * Returns all currently installed runtimes.
     */
    getAll() {
        // Unique list by versioned key
        const unique = new Map();
        for (const [key, val] of this.runtimes.entries()) {
            if (key.includes('@')) {
                unique.set(key, val);
            }
        }
        // Fallback if registered without @
        if (unique.size === 0) {
            for (const val of this.runtimes.values()) {
                unique.set(`${val.id}@${val.version}`, val);
            }
        }
        return Array.from(unique.values());
    }
    /**
     * Returns installed runtimes matching a specific category.
     */
    getByCategory(category) {
        return this.getAll().filter((r) => r.category === category);
    }
    /**
     * Discovers and loads installed runtimes directly from userData/runtimes/{id}/{version}/ layout.
     */
    loadLocalState(runtimesDir) {
        this.runtimes.clear();
        if (!fs_1.default.existsSync(runtimesDir)) {
            return;
        }
        try {
            const runtimeDirs = fs_1.default.readdirSync(runtimesDir);
            for (const runtimeId of runtimeDirs) {
                const idPath = path_1.default.join(runtimesDir, runtimeId);
                if (!fs_1.default.statSync(idPath).isDirectory())
                    continue;
                const versionDirs = fs_1.default.readdirSync(idPath);
                for (const version of versionDirs) {
                    const versionPath = path_1.default.join(idPath, version);
                    if (!fs_1.default.statSync(versionPath).isDirectory())
                        continue;
                    const manifestPath = path_1.default.join(versionPath, 'manifest.json');
                    if (fs_1.default.existsSync(manifestPath)) {
                        try {
                            const manifestContent = fs_1.default.readFileSync(manifestPath, 'utf8');
                            const manifest = JSON.parse(manifestContent);
                            const execPath = path_1.default.join(versionPath, manifest.executable);
                            if (fs_1.default.existsSync(execPath)) {
                                const info = {
                                    id: manifest.id || runtimeId,
                                    name: manifest.name || runtimeId,
                                    category: manifest.category || 'asr',
                                    version: manifest.version || version,
                                    executablePath: execPath,
                                    installedPath: versionPath,
                                    installedAt: manifest.packagedAt || new Date().toISOString(),
                                    manifest,
                                    status: 'INSTALLED',
                                };
                                this.register(info);
                            }
                        }
                        catch (err) {
                            console.warn(`[RuntimeRegistry] Failed to read manifest at ${manifestPath}:`, err);
                        }
                    }
                }
            }
        }
        catch (err) {
            console.error(`[RuntimeRegistry] Error scanning runtimes directory ${runtimesDir}:`, err);
        }
    }
}
exports.RuntimeRegistry = RuntimeRegistry;

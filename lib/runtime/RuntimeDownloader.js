"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuntimeDownloader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const http_1 = __importDefault(require("http"));
const https_1 = __importDefault(require("https"));
const url_1 = require("url");
class RuntimeDownloader {
    /**
     * Downloads a remote file stream to destPath with progress reporting and cancellation support.
     *
     * @param url Remote HTTP/HTTPS URL string.
     * @param destPath Local file destination path.
     * @param onProgress Optional progress callback.
     * @param signal Optional AbortSignal for cancellation.
     * @returns Promise resolving to destination path when complete.
     */
    async download(url, destPath, onProgress, signal) {
        const destDir = path_1.default.dirname(destPath);
        if (!fs_1.default.existsSync(destDir)) {
            fs_1.default.mkdirSync(destDir, { recursive: true });
        }
        // Ensure clean temporary target
        if (fs_1.default.existsSync(destPath)) {
            try {
                fs_1.default.unlinkSync(destPath);
            }
            catch (_) { }
        }
        return new Promise((resolve, reject) => {
            let fileStream = null;
            let isAborted = false;
            const cleanup = () => {
                if (fileStream) {
                    fileStream.close();
                    fileStream = null;
                }
                if (fs_1.default.existsSync(destPath)) {
                    try {
                        fs_1.default.unlinkSync(destPath);
                    }
                    catch (_) { }
                }
            };
            if (signal) {
                if (signal.aborted) {
                    cleanup();
                    return reject(new Error('Download cancelled by user signal.'));
                }
                signal.addEventListener('abort', () => {
                    isAborted = true;
                    cleanup();
                    reject(new Error('Download cancelled by user signal.'));
                });
            }
            const executeRequest = (targetUrl, redirectCount = 0) => {
                if (isAborted)
                    return;
                if (redirectCount > 5) {
                    cleanup();
                    return reject(new Error('Too many HTTP redirects during download.'));
                }
                const parsedUrl = new url_1.URL(targetUrl);
                const protocol = parsedUrl.protocol === 'https:' ? https_1.default : http_1.default;
                const req = protocol.get(targetUrl, { timeout: 30000 }, (res) => {
                    if (isAborted)
                        return;
                    // Handle redirects (301, 302, 303, 307, 308)
                    if (res.statusCode &&
                        res.statusCode >= 300 &&
                        res.statusCode < 400 &&
                        res.headers.location) {
                        const redirectUrl = new url_1.URL(res.headers.location, targetUrl).toString();
                        return executeRequest(redirectUrl, redirectCount + 1);
                    }
                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        cleanup();
                        return reject(new Error(`HTTP ${res.statusCode || 'Error'}: Failed to download ${targetUrl}`));
                    }
                    const total = parseInt(res.headers['content-length'] || '0', 10);
                    let loaded = 0;
                    fileStream = fs_1.default.createWriteStream(destPath);
                    res.on('data', (chunk) => {
                        if (isAborted)
                            return;
                        loaded += chunk.length;
                        if (onProgress) {
                            const percentage = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
                            onProgress({ loaded, total, percentage });
                        }
                    });
                    res.pipe(fileStream);
                    fileStream.on('finish', () => {
                        if (isAborted)
                            return;
                        fileStream?.close(() => {
                            fileStream = null;
                            resolve(destPath);
                        });
                    });
                    fileStream.on('error', (err) => {
                        cleanup();
                        reject(err);
                    });
                });
                req.on('error', (err) => {
                    cleanup();
                    reject(new Error(`Network error during download: ${err.message}`));
                });
                req.on('timeout', () => {
                    req.destroy();
                    cleanup();
                    reject(new Error('Download network timeout after 30 seconds.'));
                });
            };
            executeRequest(url);
        });
    }
}
exports.RuntimeDownloader = RuntimeDownloader;

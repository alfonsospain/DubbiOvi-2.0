import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { DownloadProgressCallback } from './RuntimeTypes';

export class RuntimeDownloader {
  /**
   * Downloads a remote file stream to destPath with progress reporting and cancellation support.
   *
   * @param url Remote HTTP/HTTPS URL string.
   * @param destPath Local file destination path.
   * @param onProgress Optional progress callback.
   * @param signal Optional AbortSignal for cancellation.
   * @returns Promise resolving to destination path when complete.
   */
  async download(
    url: string,
    destPath: string,
    onProgress?: DownloadProgressCallback,
    signal?: AbortSignal
  ): Promise<string> {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Ensure clean temporary target
    if (fs.existsSync(destPath)) {
      try {
        fs.unlinkSync(destPath);
      } catch (_) {}
    }

    return new Promise<string>((resolve, reject) => {
      let fileStream: fs.WriteStream | null = null;
      let isAborted = false;

      const cleanup = () => {
        if (fileStream) {
          fileStream.close();
          fileStream = null;
        }
        if (fs.existsSync(destPath)) {
          try {
            fs.unlinkSync(destPath);
          } catch (_) {}
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

      const executeRequest = (targetUrl: string, redirectCount = 0) => {
        if (isAborted) return;

        if (redirectCount > 5) {
          cleanup();
          return reject(new Error('Too many HTTP redirects during download.'));
        }

        const parsedUrl = new URL(targetUrl);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        const req = protocol.get(targetUrl, { timeout: 30000 }, (res) => {
          if (isAborted) return;

          // Handle redirects (301, 302, 303, 307, 308)
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            const redirectUrl = new URL(res.headers.location, targetUrl).toString();
            return executeRequest(redirectUrl, redirectCount + 1);
          }

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            cleanup();
            return reject(
              new Error(`HTTP ${res.statusCode || 'Error'}: Failed to download ${targetUrl}`)
            );
          }

          const total = parseInt(res.headers['content-length'] || '0', 10);
          let loaded = 0;

          fileStream = fs.createWriteStream(destPath);

          res.on('data', (chunk: Buffer) => {
            if (isAborted) return;
            loaded += chunk.length;
            if (onProgress) {
              const percentage = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
              onProgress({ loaded, total, percentage });
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            if (isAborted) return;
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

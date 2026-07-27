const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

/**
 * Generic, engine-agnostic utility for downloading, checksum verification, and archive extraction.
 */
class DownloadManager {
  /**
   * Downloads a resource from a URL to a specified target file path.
   *
   * @param {string} url Resource URL to download.
   * @param {string} targetPath Absolute target file path.
   * @param {function({ loaded: number, total: number }): void} [onProgress] Progress callback.
   * @returns {Promise<void>}
   */
  static downloadFile(url, targetPath, onProgress) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;

      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const fileStream = fs.createWriteStream(targetPath);

      const request = client.get(url, (response) => {
        // Handle HTTP redirects (301, 302, 307, 308)
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          fileStream.close();
          fs.unlink(targetPath, () => {});
          const redirectUrl = new URL(response.headers.location, url).toString();
          console.log(`[DownloadManager] HTTP ${response.statusCode} redirecting from '${url}' to '${redirectUrl}'...`);
          return DownloadManager.downloadFile(redirectUrl, targetPath, onProgress)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          fileStream.close();
          fs.unlink(targetPath, () => {});
          return reject(new Error(`HTTP Download failed with status code: ${response.statusCode}`));
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let loadedBytes = 0;

        response.on('data', (chunk) => {
          loadedBytes += chunk.length;
          if (typeof onProgress === 'function') {
            onProgress({ loaded: loadedBytes, total: totalBytes });
          }
        });

        response.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close(() => resolve());
        });

        fileStream.on('error', (err) => {
          fileStream.close();
          fs.unlink(targetPath, () => {});
          reject(err);
        });
      });

      request.on('error', (err) => {
        fileStream.close();
        fs.unlink(targetPath, () => {});
        reject(err);
      });
    });
  }

  /**
   * Verifies the cryptographic hash of a file.
   *
   * @param {string} filePath Absolute path to file.
   * @param {string} expectedHash Expected hash string.
   * @param {string} [algorithm='sha256'] Hash algorithm ('sha256', 'md5', etc.).
   * @returns {Promise<boolean>}
   */
  static verifyHash(filePath, expectedHash, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(filePath)) {
        return resolve(false);
      }

      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(filePath);

      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => {
        const computedHash = hash.digest('hex');
        const cleanExpected = expectedHash.replace(/^sha256:/i, '').trim().toLowerCase();
        resolve(computedHash.toLowerCase() === cleanExpected);
      });
      stream.on('error', (err) => reject(err));
    });
  }

  /**
   * Extracts an archive (.tar.gz, .tgz, .zip) to a destination directory.
   *
   * @param {string} archivePath Absolute path to the archive file.
   * @param {string} destinationDir Absolute path to the destination directory.
   * @returns {Promise<void>}
   */
  static unpackArchive(archivePath, destinationDir) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(destinationDir)) {
        fs.mkdirSync(destinationDir, { recursive: true });
      }

      const isZip = archivePath.endsWith('.zip');
      const isTar = archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz') || archivePath.endsWith('.tar');

      let cmd = '';
      let args = [];

      if (process.platform === 'win32') {
        if (isZip) {
          cmd = 'powershell';
          args = ['-Command', `Expand-Archive -Path '${archivePath}' -DestinationPath '${destinationDir}' -Force`];
        } else {
          cmd = 'tar';
          args = ['-xzf', archivePath, '-C', destinationDir];
        }
      } else {
        if (isZip) {
          cmd = 'unzip';
          args = ['-o', archivePath, '-d', destinationDir];
        } else if (isTar) {
          cmd = 'tar';
          args = ['-xzf', archivePath, '-C', destinationDir];
        } else {
          return reject(new Error(`Unsupported archive format: ${archivePath}`));
        }
      }

      const child = spawn(cmd, args);
      let stderr = '';

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`Extraction failed with code ${code}: ${stderr}`));
        }
        resolve();
      });
    });
  }
}

module.exports = DownloadManager;

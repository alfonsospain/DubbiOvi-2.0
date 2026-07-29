import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { RuntimeValidator } from './RuntimeValidator';

export class RuntimeInstaller {
  /**
   * Unpacks archive (.zip, .tar.gz) into temporary staging directory with path traversal checks.
   */
  async extractToStaging(archivePath: string, stagingDir: string): Promise<void> {
    if (!fs.existsSync(archivePath)) {
      const cleanCheck = archivePath.replace(/\.tmp$/i, '');
      if (fs.existsSync(cleanCheck)) {
        archivePath = cleanCheck;
      } else {
        throw new Error(`Archive file not found: ${archivePath}`);
      }
    }

    // Rename temporary archive (.zip.tmp) to clean archive extension (.zip) for Expand-Archive compatibility
    const cleanPath = archivePath.replace(/\.tmp$/i, '');
    if (archivePath !== cleanPath && fs.existsSync(archivePath)) {
      fs.renameSync(archivePath, cleanPath);
      archivePath = cleanPath;
    }

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    // 1. Perform Unpacking
    await new Promise<void>((resolve, reject) => {
      const isZip = archivePath.endsWith('.zip');
      const isTar = archivePath.endsWith('.tar.gz') || archivePath.endsWith('.tgz');

      let cmd = '';
      let args: string[] = [];

      if (process.platform === 'win32') {
        if (isZip) {
          cmd = 'powershell';
          args = ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${archivePath}' -DestinationPath '${stagingDir}' -Force`];
        } else {
          cmd = 'tar';
          args = ['-xzf', archivePath, '-C', stagingDir];
        }
      } else {
        if (isZip) {
          cmd = 'unzip';
          args = ['-q', '-o', archivePath, '-d', stagingDir];
        } else if (isTar) {
          cmd = 'tar';
          args = ['-xzf', archivePath, '-C', stagingDir];
        } else {
          return reject(new Error(`Unsupported archive format: ${archivePath}`));
        }
      }

      const child = spawn(cmd, args);
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
    RuntimeValidator.validateZipEntryPaths(extractedRelativeFiles);

    // 3. Flatten top-level wrapper directory if extracted archive wraps contents in a single folder
    this.flattenSingleRootFolder(stagingDir);

    // 4. Set POSIX 0o755 permissions for executables and bin/ directory files on non-Windows
    if (process.platform !== 'win32') {
      const binDir = path.join(stagingDir, 'bin');
      if (fs.existsSync(binDir)) {
        const binFiles = fs.readdirSync(binDir);
        for (const file of binFiles) {
          const filePath = path.join(binDir, file);
          try {
            fs.chmodSync(filePath, 0o755);
          } catch (_) {}
        }
      }
    }
  }

  /**
   * If an archive extracts into a single top-level wrapper directory, flattens its contents to stagingDir root.
   */
  private flattenSingleRootFolder(stagingDir: string): void {
    if (fs.existsSync(path.join(stagingDir, 'manifest.json'))) {
      return;
    }
    const items = fs.readdirSync(stagingDir);
    if (items.length === 1) {
      const subFolder = path.join(stagingDir, items[0]);
      if (fs.statSync(subFolder).isDirectory()) {
        const subItems = fs.readdirSync(subFolder);
        for (const item of subItems) {
          fs.renameSync(path.join(subFolder, item), path.join(stagingDir, item));
        }
        fs.rmSync(subFolder, { recursive: true, force: true });
      }
    }
  }

  /**
   * Atomically promotes staging directory to final versioned installation directory.
   */
  atomicPromote(stagingDir: string, finalTargetDir: string): void {
    if (!fs.existsSync(stagingDir)) {
      throw new Error(`Staging directory does not exist: ${stagingDir}`);
    }

    const parentDir = path.dirname(finalTargetDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Backup / remove existing installation directory if present
    const backupDir = `${finalTargetDir}_backup_${Date.now()}`;
    let backedUp = false;

    if (fs.existsSync(finalTargetDir)) {
      try {
        fs.renameSync(finalTargetDir, backupDir);
        backedUp = true;
      } catch (_) {
        // If rename fails, try force removal
        fs.rmSync(finalTargetDir, { recursive: true, force: true });
      }
    }

    try {
      // Atomic rename from staging to final versioned location
      fs.renameSync(stagingDir, finalTargetDir);

      // Clean up backup after success
      if (backedUp && fs.existsSync(backupDir)) {
        try {
          fs.rmSync(backupDir, { recursive: true, force: true });
        } catch (_) {}
      }
    } catch (err) {
      // Rollback backup if atomic promotion failed
      if (backedUp && fs.existsSync(backupDir)) {
        try {
          if (fs.existsSync(finalTargetDir)) {
            fs.rmSync(finalTargetDir, { recursive: true, force: true });
          }
          fs.renameSync(backupDir, finalTargetDir);
        } catch (_) {}
      }
      throw new Error(`Atomic promotion of runtime directory failed: ${(err as Error).message}`);
    }
  }

  /**
   * Helper to collect relative file paths inside a directory.
   */
  private getRelativeFiles(dir: string, baseDir = dir): string[] {
    let results: string[] = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (stat && stat.isDirectory()) {
        results = results.concat(this.getRelativeFiles(fullPath, baseDir));
      } else {
        results.push(relPath);
      }
    });
    return results;
  }

  /**
   * Cleans up temporary files or directories.
   */
  cleanup(targetPaths: string[]): void {
    for (const targetPath of targetPaths) {
      const candidates = Array.from(new Set([targetPath, targetPath.replace(/\.tmp$/i, '')]));
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          try {
            const stat = fs.statSync(p);
            if (stat.isDirectory()) {
              fs.rmSync(p, { recursive: true, force: true });
            } else {
              fs.unlinkSync(p);
            }
          } catch (_) {}
        }
      }
    }
  }
}

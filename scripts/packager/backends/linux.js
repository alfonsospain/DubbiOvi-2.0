const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const BasePlatformPackager = require('./base');

class LinuxPackager extends BasePlatformPackager {
  prepareStaging() {
    const { srcDir, stagingDir, executable } = this.spec;

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    const srcExec = path.join(srcDir, executable);
    const destExec = path.join(stagingDir, executable);
    fs.copyFileSync(srcExec, destExec);

    // Include shared object (.so) files from source directory
    const srcFiles = fs.readdirSync(srcDir);
    for (const f of srcFiles) {
      if (f.includes('.so')) {
        fs.copyFileSync(path.join(srcDir, f), path.join(stagingDir, f));
      }
    }

    // Copy LICENSE and VERSION if present
    for (const docFile of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'VERSION']) {
      const candidates = [
        path.join(srcDir, docFile),
        path.join(path.dirname(srcDir), docFile),
        path.join(path.dirname(path.dirname(srcDir)), docFile),
      ];
      for (const cand of candidates) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
          fs.copyFileSync(cand, path.join(stagingDir, docFile));
          break;
        }
      }
    }
  }

  processRelocation() {
    const { stagingDir, executable } = this.spec;
    const patchelfCheck = spawnSync('patchelf', ['--version']);

    if (patchelfCheck.status === 0) {
      const files = fs.readdirSync(stagingDir);
      for (const file of files) {
        const filePath = path.join(stagingDir, file);
        if (file === executable || file.includes('.so')) {
          spawnSync('patchelf', ['--set-rpath', '$ORIGIN', filePath]);
        }
      }
      console.log('[LinuxPackager] Set ELF RPATH to $ORIGIN via patchelf.');
    } else {
      console.log('[LinuxPackager] patchelf not found. Ensure RPATH $ORIGIN is configured at build time.');
    }
  }

  applySignatures() {
    const { stagingDir } = this.spec;
    const files = fs.readdirSync(stagingDir);
    for (const f of files) {
      fs.chmodSync(path.join(stagingDir, f), 0o755);
    }
  }
}

module.exports = LinuxPackager;

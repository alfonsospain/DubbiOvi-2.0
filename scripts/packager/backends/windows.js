const fs = require('fs');
const path = require('path');
const BasePlatformPackager = require('./base');

class WindowsPackager extends BasePlatformPackager {
  prepareStaging() {
    const { srcDir, stagingDir, executable } = this.spec;
    const execBaseName = path.basename(executable);
    const execName = execBaseName.toLowerCase().endsWith('.exe') ? execBaseName : `${execBaseName}.exe`;

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }

    // Create clean bin/ directory inside staging directory
    const binDir = path.join(stagingDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const srcExec = path.join(srcDir, execName);
    const destExec = path.join(binDir, execName);

    if (!fs.existsSync(srcExec)) {
      throw new Error(`Source executable not found at: ${srcExec}`);
    }
    fs.copyFileSync(srcExec, destExec);

    // Copy all contents (binaries, DLLs, data directories like espeak-ng-data, models) from srcDir into binDir recursively
    const copyRecursive = (src, dest) => {
      const stats = fs.statSync(src);
      if (stats.isDirectory()) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const child of fs.readdirSync(src)) {
          copyRecursive(path.join(src, child), path.join(dest, child));
        }
      } else {
        fs.copyFileSync(src, dest);
      }
    };

    for (const item of fs.readdirSync(srcDir)) {
      copyRecursive(path.join(srcDir, item), path.join(binDir, item));
    }

    // Copy LICENSE and VERSION to staging root if present
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
    // Windows PE uses side-by-side DLL resolution in the executable folder (bin/).
    // No RPATH modification needed.
    console.log('[WindowsPackager] Side-by-side DLL resolution configured in bin/ folder.');
  }

  applySignatures() {
    console.log('[WindowsPackager] Executable prepared for distribution.');
  }
}

module.exports = WindowsPackager;

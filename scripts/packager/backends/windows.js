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

    // Include required DLL files into bin/ directory for side-by-side resolution
    const srcFiles = fs.readdirSync(srcDir);
    for (const f of srcFiles) {
      if (f.toLowerCase().endsWith('.dll')) {
        fs.copyFileSync(path.join(srcDir, f), path.join(binDir, f));
      }
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

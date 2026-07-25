const fs = require('fs');
const path = require('path');
const BasePlatformPackager = require('./base');

class WindowsPackager extends BasePlatformPackager {
  prepareStaging() {
    const { srcDir, stagingDir, executable } = this.spec;
    const execName = executable.endsWith('.exe') ? executable : `${executable}.exe`;

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    fs.mkdirSync(stagingDir, { recursive: true });

    const srcExec = path.join(srcDir, execName);
    const destExec = path.join(stagingDir, execName);
    fs.copyFileSync(srcExec, destExec);

    // Include required DLL files from source directory
    const srcFiles = fs.readdirSync(srcDir);
    for (const f of srcFiles) {
      if (f.toLowerCase().endsWith('.dll')) {
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
    // Windows PE uses side-by-side DLL resolution in the executable folder.
    // No RPATH modification needed.
    console.log('[WindowsPackager] Side-by-side DLL resolution configured.');
  }

  applySignatures() {
    console.log('[WindowsPackager] Executable prepared for distribution.');
  }
}

module.exports = WindowsPackager;

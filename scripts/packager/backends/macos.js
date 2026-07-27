const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const BasePlatformPackager = require('./base');

class MacOSPackager extends BasePlatformPackager {
  prepareStaging() {
    const { srcDir, stagingDir, executable } = this.spec;

    if (fs.existsSync(stagingDir)) {
      fs.rmSync(stagingDir, { recursive: true, force: true });
    }
    
    // Create clean bin/ directory inside staging directory
    const binDir = path.join(stagingDir, 'bin');
    fs.mkdirSync(binDir, { recursive: true });

    const execBaseName = path.basename(executable);
    const srcExec = path.join(srcDir, execBaseName);
    const destExec = path.join(binDir, execBaseName);
    
    if (!fs.existsSync(srcExec)) {
      throw new Error(`Source executable not found at: ${srcExec}`);
    }

    // Copy all contents (binaries, dylibs, data directories like espeak-ng-data) from srcDir into binDir recursively
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

    // Copy LICENSE and VERSION if present in srcDir or parent dirs
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

    // Strict Recursive Mach-O Dependency Resolution
    const visited = new Set();
    const queue = [srcExec];

    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);

      const otoolRes = spawnSync('otool', ['-L', current], { encoding: 'utf8' });
      if (otoolRes.status === 0) {
        const lines = otoolRes.stdout.split('\n');
        for (const line of lines) {
          const match = line.trim().match(/^(\S+\.dylib)/);
          if (match) {
            const rawLibPath = match[1];
            const libName = path.basename(rawLibPath);
            const candidates = [
              path.join(srcDir, libName),
              rawLibPath,
            ];

            for (const cand of candidates) {
              if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
                const targetInBin = path.join(binDir, libName);
                if (!fs.existsSync(targetInBin)) {
                  fs.copyFileSync(cand, targetInBin);
                  queue.push(cand);
                }
                break;
              }
            }
          }
        }
      }
    }
  }

  processRelocation() {
    const { stagingDir, executable } = this.spec;
    const binDir = path.join(stagingDir, 'bin');
    const execBaseName = path.basename(executable);

    if (!fs.existsSync(binDir)) return;

    const files = fs.readdirSync(binDir);
    const dylibs = files.filter((f) => f.endsWith('.dylib'));
    const binaries = [execBaseName, ...dylibs];

    // 1. Fix install name ID for all dylibs
    for (const lib of dylibs) {
      const libPath = path.join(binDir, lib);
      fs.chmodSync(libPath, 0o755);
      spawnSync('install_name_tool', ['-id', `@rpath/${lib}`, libPath]);
    }

    // 2. Remove absolute RPATHs and set @executable_path
    for (const bin of binaries) {
      const binPath = path.join(binDir, bin);
      fs.chmodSync(binPath, 0o755);

      const otoolRes = spawnSync('otool', ['-l', binPath], { encoding: 'utf8' });
      if (otoolRes.status === 0) {
        const lines = otoolRes.stdout.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('cmd LC_RPATH')) {
            const pathLine = lines[i + 2] || '';
            const match = pathLine.trim().match(/path\s+(\S+)/);
            if (match && match[1]) {
              spawnSync('install_name_tool', ['-delete_rpath', match[1], binPath]);
            }
          }
        }
      }

      spawnSync('install_name_tool', ['-add_rpath', '@executable_path', binPath]);
    }

    // 3. Fix inter-library dependencies to use @rpath/
    for (const bin of binaries) {
      const binPath = path.join(binDir, bin);
      for (const lib of dylibs) {
        const otoolRes = spawnSync('otool', ['-L', binPath], { encoding: 'utf8' });
        if (otoolRes.status === 0) {
          const lines = otoolRes.stdout.split('\n');
          for (const line of lines) {
            if (line.includes(lib) && !line.includes(`@rpath/${lib}`)) {
              const oldRef = line.trim().split(' ')[0];
              spawnSync('install_name_tool', ['-change', oldRef, `@rpath/${lib}`, binPath]);
            }
          }
        }
      }
    }
  }

  applySignatures() {
    const { stagingDir, executable } = this.spec;
    const binDir = path.join(stagingDir, 'bin');
    const execBaseName = path.basename(executable);

    if (!fs.existsSync(binDir)) return;

    const files = fs.readdirSync(binDir);
    for (const file of files) {
      const filePath = path.join(binDir, file);
      if (file === execBaseName || file.endsWith('.dylib')) {
        spawnSync('codesign', ['--force', '--deep', '-s', '-', filePath]);
      }
    }
  }
}

module.exports = MacOSPackager;

#!/usr/bin/env node

/**
 * DubbiOvi Platform-Agnostic Runtime Packager CLI Entrypoint
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createRuntimeManifest } = require('./spec');
const RuntimeValidator = require('./validator');

const MacOSPackager = require('./backends/macos');
const WindowsPackager = require('./backends/windows');
const LinuxPackager = require('./backends/linux');

function parseArgs() {
  const args = process.argv.slice(2);
  const spec = {
    engineId: '',
    engineName: '',
    category: '',
    version: '',
    executable: '',
    srcDir: '',
    outDir: './dist',
    minimumDubbiOviVersion: '2.0.0',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--engine-id' && args[i + 1]) spec.engineId = args[++i];
    else if (arg === '--engine-name' && args[i + 1]) spec.engineName = args[++i];
    else if (arg === '--category' && args[i + 1]) spec.category = args[++i];
    else if (arg === '--version' && args[i + 1]) spec.version = args[++i];
    else if (arg === '--exec' && args[i + 1]) spec.executable = args[++i];
    else if (arg === '--src-dir' && args[i + 1]) spec.srcDir = path.resolve(args[++i]);
    else if (arg === '--out-dir' && args[i + 1]) spec.outDir = path.resolve(args[++i]);
    else if (arg === '--min-app-version' && args[i + 1]) spec.minimumDubbiOviVersion = args[++i];
    else if (arg === '--help') {
      console.log(`
Usage: package-runtime [options]

Options:
  --engine-id        Engine ID (e.g. whisper, piper, kokoro, xtts) [Required]
  --engine-name      Engine display name [Required]
  --category         Category (asr, tts, llm, mt) [Required]
  --version          Engine version (e.g. 1.9.1) [Required]
  --exec             Executable filename (e.g. whisper-cli) [Required]
  --src-dir          Source build directory [Required]
  --out-dir          Output folder (default: ./dist)
  --min-app-version  Minimum DubbiOvi version required (default: 2.0.0)
`);
      process.exit(0);
    }
  }

  if (!spec.engineId || !spec.engineName || !spec.category || !spec.version || !spec.executable || !spec.srcDir) {
    console.error('Error: Missing required packaging arguments. Use --help for usage details.');
    process.exit(1);
  }

  return spec;
}

function computeSha256(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = crypto.createHash('sha256');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

function getRelativeFiles(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
    if (relPath === 'manifest.json') return;
    if (stat && stat.isDirectory()) {
      results = results.concat(getRelativeFiles(fullPath, baseDir));
    } else {
      results.push(relPath);
    }
  });
  return results;
}

async function run() {
  const spec = parseArgs();
  const platform = process.platform;
  const arch = process.arch;
  const platformKey = `${platform}_${arch}`;

  const packageName = `${spec.engineId}-${platformKey}`;
  spec.stagingDir = path.join(spec.outDir, packageName);
  spec.zipPath = path.join(spec.outDir, `${packageName}.zip`);
  spec.platform = platform;
  spec.arch = arch;

  // Standardize executable manifest entry to include bin/ prefix if present
  const execBase = path.basename(spec.executable);
  spec.executableManifestPath = `bin/${execBase}`;

  console.log(`=== DubbiOvi Modular Runtime Packager ===`);
  console.log(`Engine ID      : ${spec.engineId}`);
  console.log(`Engine Name    : ${spec.engineName}`);
  console.log(`Category       : ${spec.category}`);
  console.log(`Version        : ${spec.version}`);
  console.log(`Executable     : ${spec.executableManifestPath}`);
  console.log(`Platform / Arch: ${platform} (${arch})`);
  console.log(`Source Dir     : ${spec.srcDir}`);
  console.log(`Staging Dir    : ${spec.stagingDir}`);
  console.log(`==========================================`);

  // 1. Validation Phase
  console.log(`\n[Phase 1/4] Running Pre-Packaging Validation...`);
  const valResult = RuntimeValidator.validate(spec);
  if (!valResult.success) {
    console.error(`Validation Failed:\n  - ${valResult.errors.join('\n  - ')}`);
    process.exit(1);
  }
  if (valResult.warnings.length > 0) {
    console.warn(`Validation Warnings:\n  - ${valResult.warnings.join('\n  - ')}`);
  }

  // 2. Select Platform Packager Backend
  console.log(`\n[Phase 2/4] Executing Platform Backend (${platform})...`);
  let packager;
  if (platform === 'darwin') {
    packager = new MacOSPackager(spec);
  } else if (platform === 'win32') {
    packager = new WindowsPackager(spec);
  } else {
    packager = new LinuxPackager(spec);
  }

  packager.prepareStaging();
  packager.processRelocation();
  packager.applySignatures();

  // 3. Generate Manifest Schema v2.0.0
  console.log(`\n[Phase 3/4] Writing DubbiOvi Manifest Schema v2.0.0...`);
  const stagedFiles = getRelativeFiles(spec.stagingDir);
  const manifestData = createRuntimeManifest({
    ...spec,
    executable: spec.executableManifestPath,
    files: stagedFiles,
  });

  const manifestPath = path.join(spec.stagingDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(`  ✓ Written manifest.json to ${manifestPath}`);

  // 4. Archive & Compute Checksum
  console.log(`\n[Phase 4/4] Creating ZIP Archive & Calculating Checksum...`);
  if (!fs.existsSync(spec.outDir)) {
    fs.mkdirSync(spec.outDir, { recursive: true });
  }

  if (fs.existsSync(spec.zipPath)) {
    fs.unlinkSync(spec.zipPath);
  }

  const zipCmd = platform === 'win32'
    ? `powershell -Command "Compress-Archive -Path '${spec.stagingDir}\\*' -DestinationPath '${spec.zipPath}' -Force"`
    : `cd "${spec.outDir}" && zip -q -r "${path.basename(spec.zipPath)}" "${packageName}"`;

  spawnSync(zipCmd, { shell: true, stdio: 'inherit' });

  if (fs.existsSync(spec.zipPath)) {
    const initialChecksum = computeSha256(spec.zipPath);
    manifestData.checksumSha256 = initialChecksum;
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');

    // Re-archive so manifest.json inside the zip contains the checksum
    spawnSync(zipCmd, { shell: true, stdio: 'inherit' });
    const finalChecksum = computeSha256(spec.zipPath);
    manifestData.checksumSha256 = finalChecksum;
    fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');

    const checksumFilePath = `${spec.zipPath}.sha256`;
    fs.writeFileSync(checksumFilePath, `${finalChecksum}  ${path.basename(spec.zipPath)}\n`, 'utf8');

    console.log(`\n=================================================================`);
    console.log(` SUCCESS: DubbiOvi Engine Package successfully assembled!`);
    console.log(` Package Archive : ${spec.zipPath}`);
    console.log(` Manifest Schema : v2.0.0 (minDubbiOviVersion: ${spec.minimumDubbiOviVersion})`);
    console.log(` SHA-256 Checksum: ${finalChecksum}`);
    console.log(` Checksum File   : ${checksumFilePath}`);
    console.log(`=================================================================`);
  } else {
    console.error(`Error: Failed to generate package ZIP archive.`);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal Packager Error:', err);
  process.exit(1);
});

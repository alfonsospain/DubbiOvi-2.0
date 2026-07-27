import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync, spawnSync } from 'child_process';
import { RuntimeRepository } from '../src/runtime';

async function runRuntimePackagerTests() {
  console.log('=====================================================');
  console.log(' STARTING RUNTIME PACKAGER TEST SUITE');
  console.log('=====================================================');

  // -------------------------------------------------------------------------
  // Test 1: Centralized Platform Resolution & Release Filename Resolution
  // -------------------------------------------------------------------------
  console.log('\n[Test 1] Testing RuntimeRepository platform & filename resolution...');
  const keyMacArm = RuntimeRepository.resolvePlatformKey('darwin', 'arm64');
  const keyMacX64 = RuntimeRepository.resolvePlatformKey('darwin', 'x64');
  const keyWinX64 = RuntimeRepository.resolvePlatformKey('win32', 'x64');
  const keyLinuxX64 = RuntimeRepository.resolvePlatformKey('linux', 'x64');

  console.log('  ✓ darwin/arm64 key:', keyMacArm);
  console.log('  ✓ darwin/x64 key  :', keyMacX64);
  console.log('  ✓ win32/x64 key   :', keyWinX64);
  console.log('  ✓ linux/x64 key   :', keyLinuxX64);

  if (keyMacArm !== 'darwin_arm64' || keyWinX64 !== 'win32_x64') {
    throw new Error('FAILED: Platform key resolution mismatch!');
  }

  const fileMacArm = RuntimeRepository.resolveReleaseFilename('whisper', 'darwin', 'arm64');
  const fileWinX64 = RuntimeRepository.resolveReleaseFilename('whisper', 'win32', 'x64');
  console.log('  ✓ macOS Release filename  :', fileMacArm);
  console.log('  ✓ Windows Release filename:', fileWinX64);

  if (fileMacArm !== 'whisper-darwin_arm64.zip' || fileWinX64 !== 'whisper-win32_x64.zip') {
    throw new Error('FAILED: Release filename resolution mismatch!');
  }
  console.log('  ✓ PASSED: Centralized platform resolution functions verified.');

  // -------------------------------------------------------------------------
  // Test 2: Single-Command Packaging Execution (scripts/package-runtimes.js)
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Testing master packaging script execution...');
  const isWin = process.platform === 'win32';
  const sampleExecName = isWin ? 'piper.exe' : 'piper';
  const candidateExecs = [
    path.resolve(`./dist/.staging/piper-win32_x64/bin/${sampleExecName}`),
    path.resolve(`./dist/.staging/piper-darwin_x64/bin/${sampleExecName}`),
    path.resolve(`C:/Users/Alfonso/.gemini/antigravity-ide/brain/f2b4979b-fd89-42b1-82ab-cb096dbee848/scratch/win_extract/piper/${sampleExecName}`),
    path.resolve(`C:/Users/Alfonso/.gemini/antigravity-ide/brain/f2b4979b-fd89-42b1-82ab-cb096dbee848/scratch/mac_extract/piper/${sampleExecName}`),
    '/Volumes/AlfonsoSSD/GitHub/DubbiOvi-2.0/dist/whisper-darwin_arm64/bin/whisper-cli',
  ];
  const srcExec = candidateExecs.find((p) => fs.existsSync(p)) || candidateExecs[0];
  if (!fs.existsSync(srcExec)) {
    throw new Error(`Prerequisite binary missing at: ${srcExec}`);
  }

  const tempOutDir = path.join(os.tmpdir(), `packager_test_out_${Date.now()}`);
  fs.mkdirSync(tempOutDir, { recursive: true });

  try {
    const packagerScript = path.join(__dirname, '..', 'scripts', 'package-runtimes.js');
    const packagerArgs = [
      packagerScript,
      '--engine', 'piper',
      '--name', 'Piper Neural TTS Engine',
      '--category', 'tts',
      '--version', '1.0.0',
      '--exec', sampleExecName,
      '--src', path.dirname(srcExec),
      '--out', tempOutDir,
      '--platform', `${process.platform}_${process.arch}`,
    ];

    const runRes = spawnSync(process.execPath, packagerArgs, { encoding: 'utf8' });
    console.log(runRes.stdout);

    if (runRes.status !== 0) {
      throw new Error(`FAILED: Master packaging script exited with code ${runRes.status}:\n${runRes.stderr}`);
    }

    const targetZipName = `piper-${process.platform}_${process.arch}.zip`;
    const targetZipPath = path.join(tempOutDir, targetZipName);
    const targetShaPath = `${targetZipPath}.sha256`;

    if (!fs.existsSync(targetZipPath)) {
      throw new Error(`FAILED: Generated ZIP archive not found at ${targetZipPath}`);
    }
    if (!fs.existsSync(targetShaPath)) {
      throw new Error(`FAILED: Generated SHA-256 hash file not found at ${targetShaPath}`);
    }

    console.log('  ✓ Created package archive:', targetZipPath, `(${fs.statSync(targetZipPath).size} bytes)`);
    console.log('  ✓ Created checksum file   :', targetShaPath);

    // -------------------------------------------------------------------------
    // Test 3: Inspect ZIP Archive Structure & Manifest Version Fields
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Inspecting ZIP manifest.json versioning & schema...');
    let manifestRaw = '';
    if (process.platform === 'win32') {
      const pshRes = execSync(`powershell -Command "Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::OpenRead('${targetZipPath.replace(/\\/g, '\\\\')}').Entries | Where-Object Name -eq 'manifest.json' | ForEach-Object { (New-Object System.IO.StreamReader(\$_.Open())).ReadToEnd() }"`, { encoding: 'utf8' });
      manifestRaw = pshRes;
    } else {
      manifestRaw = execSync(`unzip -p "${targetZipPath}" manifest.json`, { encoding: 'utf8' });
    }

    const manifest = JSON.parse(manifestRaw);
    console.log('  ✓ manifestVersion   :', manifest.manifestVersion);
    console.log('  ✓ runtimeApiVersion  :', manifest.runtimeApiVersion);
    console.log('  ✓ schemaVersion      :', manifest.schemaVersion);
    console.log('  ✓ engine             :', manifest.engine);
    console.log('  ✓ binary             :', manifest.binary);
    console.log('  ✓ checksumSha256     :', manifest.checksumSha256);

    if (manifest.manifestVersion !== '2.0.0') {
      throw new Error(`FAILED: manifestVersion was '${manifest.manifestVersion}', expected '2.0.0'`);
    }
    if (manifest.runtimeApiVersion !== '2.0.0') {
      throw new Error(`FAILED: runtimeApiVersion was '${manifest.runtimeApiVersion}', expected '2.0.0'`);
    }
    if (manifest.engine !== 'piper' || manifest.id !== 'piper') {
      throw new Error('FAILED: manifest engine ID mismatch!');
    }
    if (!manifest.binary || !manifest.executable) {
      throw new Error('FAILED: manifest binary entry missing!');
    }

    // Verify SHA-256 hash file matches calculated archive SHA-256
    const zipBytes = fs.readFileSync(targetZipPath);
    const expectedHash = require('crypto').createHash('sha256').update(zipBytes).digest('hex');
    const shaContent = fs.readFileSync(targetShaPath, 'utf8').trim();

    console.log('  ✓ Calculated archive SHA-256:', expectedHash);
    console.log('  ✓ Checksum file content     :', shaContent);

    if (!shaContent.includes(expectedHash)) {
      throw new Error(`FAILED: .sha256 file content '${shaContent}' does not match calculated ZIP hash '${expectedHash}'`);
    }
    console.log('  ✓ PASSED: ZIP archive structure, manifest versioning fields, and SHA-256 integrity verified.');

    console.log('\n=====================================================');
    console.log(' ALL RUNTIME PACKAGER TESTS PASSED (100%)');
    console.log('=====================================================');
  } finally {
    if (fs.existsSync(tempOutDir)) {
      try {
        fs.rmSync(tempOutDir, { recursive: true, force: true });
      } catch (_) {}
    }
  }
}

runRuntimePackagerTests().catch((err) => {
  console.error('\n❌ Runtime Packager Test Error:', err);
  process.exit(1);
});

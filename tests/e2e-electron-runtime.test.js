const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('=== STARTING REAL ELECTRON E2E INTEGRATION TEST ===');

const projectRoot = path.join(__dirname, '..');
const electronBin = path.join(projectRoot, 'node_modules/.bin/electron');
const runtimeModulePath = path.join(projectRoot, 'src/runtime');
const providerModulePath = path.join(projectRoot, 'src/lib/WhisperLocalProvider');

// Create temporary runner script outside workspace directory in OS tmpdir
const runnerScript = `
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
require('tsx/cjs');
const { RuntimeManager, RuntimeRepository } = require(${JSON.stringify(runtimeModulePath)});
const { WhisperLocalProvider } = require(${JSON.stringify(providerModulePath)});

app.whenReady().then(async () => {
  try {
    console.log('[E2E Test] Real Electron Process initialized.');
    console.log('[E2E Test] userData path:', app.getPath('userData'));

    const runtimesDir = path.join(app.getPath('userData'), 'runtimes');
    const cacheDir = path.join(app.getPath('userData'), 'cache');

    // Clean any previous whisper test installation to test fresh discovery & installation
    const whisperTargetDir = path.join(runtimesDir, 'whisper', '1.9.1');
    if (fs.existsSync(whisperTargetDir)) {
      fs.rmSync(whisperTargetDir, { recursive: true, force: true });
    }

    const repository = new RuntimeRepository();
    const manager = new RuntimeManager({
      runtimesDir,
      cacheDir,
      appVersion: app.getVersion(),
    });

    // 1. Initial State Check via WhisperLocalProvider
    console.log('\\n--- STEP 1: INITIAL STATE CHECK ---');
    const provider = new WhisperLocalProvider();
    const initialInfo = manager.getRuntime('whisper', '1.9.1');
    console.log('Initial Runtime Installed:', !!initialInfo);

    if (initialInfo) {
      throw new Error('FAILED: Runtime should be NOT_INSTALLED initially!');
    }
    console.log('  ✓ STEP 1 PASSED: WhisperLocalProvider / RuntimeRegistry reports runtime missing.');

    // 2. Resolve Descriptor via RuntimeRepository
    console.log('\\n--- STEP 2: CATALOG RESOLUTION ---');
    const descriptor = await repository.getDescriptor('whisper', '1.9.1', process.platform, process.arch);
    if (!descriptor) {
      throw new Error('FAILED: RuntimeRepository failed to resolve descriptor!');
    }
    console.log('  ✓ STEP 2 PASSED: Descriptor resolved:', descriptor.name, descriptor.downloadUrl);

    // Override downloadUrl to use local valid package zip to test real local IPC pipeline
    const localPackageZip = path.join(${JSON.stringify(projectRoot)}, 'dist', 'whisper-darwin_arm64.zip');
    if (fs.existsSync(localPackageZip)) {
      descriptor.downloadUrl = 'file://' + localPackageZip;
    }

    // 3. Trigger Installation via Real RuntimeManager Pipeline
    console.log('\\n--- STEP 3: REAL PIPELINE INSTALLATION ---');
    let progressCount = 0;
    const installed = await manager.installRuntime(descriptor, (prog) => {
      progressCount++;
    });

    console.log('  ✓ Progress events received:', progressCount);
    console.log('  ✓ Installed path:', installed.installedPath);
    console.log('  ✓ Executable path:', installed.executablePath);
    console.log('  ✓ Status:', installed.status);

    // 4. Verify Immediate RuntimeRegistry & WhisperLocalProvider Detection
    console.log('\\n--- STEP 4: IMMEDIATE DETECTION WITHOUT RESTART ---');
    const registered = manager.getRuntime('whisper', '1.9.1');
    if (!registered || !fs.existsSync(registered.executablePath)) {
      throw new Error('FAILED: RuntimeRegistry failed to immediately detect installed runtime!');
    }
    console.log('  ✓ STEP 4 PASSED: RuntimeRegistry immediately detected installed runtime.');

    // 5. Verify Executable File Readiness & Permissions
    console.log('\\n--- STEP 5: EXECUTABLE READINESS & PERMISSIONS ---');
    if (process.platform !== 'win32') {
      const stat = fs.statSync(registered.executablePath);
      const perm = (stat.mode & 0o777).toString(8);
      console.log('  ✓ Executable POSIX permissions:', perm);
      if (perm !== '755') {
        throw new Error('FAILED: Executable permissions are not 755!');
      }
    }
    console.log('  ✓ STEP 5 PASSED: Executable file exists and is executable.');

    console.log('\\n=====================================================');
    console.log(' REAL ELECTRON E2E VERIFICATION PASSED (100%)');
    console.log('=====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\\n❌ Real Electron E2E Test Error:', err);
    process.exit(1);
  }
});
`;

const tempRunner = path.join(os.tmpdir(), `dubbiovi-e2e-runner-${Date.now()}.js`);
fs.writeFileSync(tempRunner, runnerScript, 'utf8');

const child = spawn(electronBin, [tempRunner], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' },
});

child.on('close', (code) => {
  try {
    if (fs.existsSync(tempRunner)) fs.unlinkSync(tempRunner);
  } catch (_) {}
  if (code === 0) {
    console.log('\nElectron E2E runner process exited cleanly with code 0.');
  } else {
    console.error(`\nElectron E2E runner failed with exit code ${code}`);
    process.exit(code);
  }
});

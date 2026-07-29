import fs from 'fs';
import path from 'path';
import { RuntimeManager } from '../src/runtime/RuntimeManager';

async function runRestartPersistenceTest() {
  console.log('=====================================================');
  console.log(' PIPER RESTART PERSISTENCE VALIDATION TEST');
  console.log('=====================================================');

  const testDir = path.resolve('./.restart_persistence_test_env');
  const runtimesDir = path.join(testDir, 'runtimes');
  const cacheDir = path.join(testDir, 'cache');
  const piperVersionDir = path.join(runtimesDir, 'piper', '1.0.0');
  const binDir = path.join(piperVersionDir, 'bin');

  try {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(binDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });

    const execName = process.platform === 'win32' ? 'piper.exe' : 'piper';
    const mockExecPath = path.join(binDir, execName);
    fs.writeFileSync(mockExecPath, 'mock binary');

    const manifest = {
      schemaVersion: '2.0.0',
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts',
      version: '1.0.0',
      executable: `bin/${execName}`,
      platform: process.platform,
      arch: process.arch,
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
      packagedAt: new Date().toISOString(),
      files: [`bin/${execName}`],
    };

    fs.writeFileSync(path.join(piperVersionDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    console.log('\n[Step 1] Initializing first RuntimeManager instance (App Launch 1)...');
    const manager1 = new RuntimeManager({
      runtimesDir,
      cacheDir,
      appVersion: '2.0.0',
    });

    const detected1 = manager1.getRuntime('piper', '1.0.0');
    if (!detected1 || !fs.existsSync(detected1.executablePath)) {
      throw new Error('FAILED: Initial RuntimeManager failed to detect pre-installed Piper runtime!');
    }
    console.log(`  ✓ Launch 1 detected Piper runtime at: ${detected1.executablePath}`);

    console.log('\n[Step 2] Simulating App Shutdown & Restart (Creating fresh RuntimeManager instance)...');
    const manager2 = new RuntimeManager({
      runtimesDir,
      cacheDir,
      appVersion: '2.0.0',
    });

    const detected2 = manager2.getRuntime('piper', '1.0.0');
    if (!detected2 || !fs.existsSync(detected2.executablePath)) {
      throw new Error('FAILED: Restarted RuntimeManager failed to detect Piper runtime across app restart!');
    }
    console.log(`  ✓ Launch 2 (After Restart) detected Piper runtime at: ${detected2.executablePath}`);

    const allRuntimes = manager2.getAllRuntimes();
    if (!allRuntimes.some((r) => r.id === 'piper')) {
      throw new Error('FAILED: getAllRuntimes() did not contain piper after restart!');
    }
    console.log(`  ✓ getAllRuntimes() returned ${allRuntimes.length} installed runtime(s) after restart.`);

    console.log('\n=====================================================');
    console.log(' PIPER RESTART PERSISTENCE VALIDATION PASSED (100%)');
    console.log('=====================================================');
  } finally {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  }
}

runRestartPersistenceTest().catch((err) => {
  console.error('\n❌ Restart Persistence Test Error:', err);
  process.exit(1);
});

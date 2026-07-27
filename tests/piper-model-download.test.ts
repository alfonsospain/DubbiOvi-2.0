import fs from 'fs';
import path from 'path';
import os from 'os';
import LocalEngineManager from '../local-engine-manager';
import EngineRegistry from '../engine-registry';

async function runPiperModelDownloadTest() {
  console.log('=====================================================');
  console.log(' PIPER MODEL & CONFIG DOWNLOAD INTEGRATION TEST');
  console.log('=====================================================');

  const testUserData = path.join(os.tmpdir(), `piper_model_test_${Date.now()}`);
  fs.mkdirSync(testUserData, { recursive: true });

  const mockApp = {
    getPath: (name: string) => {
      if (name === 'userData') return testUserData;
      return testUserData;
    },
    getAppPath: () => testUserData,
  };

  try {
    const registry = new EngineRegistry();
    registry.registerDefaults();

    const manager = new LocalEngineManager(mockApp as any, registry);
    manager.initializeStorage();

    const modelName = 'es_ES-davefx-medium.onnx';
    const configName = `${modelName}.json`;

    console.log(`\n[Test] Triggering model download for '${modelName}'...`);
    const installedModelPath = await manager.downloadModel('piper', modelName, (progress) => {
      if (progress.total > 0) {
        const pct = Math.round((progress.loaded / progress.total) * 100);
        if (pct % 25 === 0) {
          console.log(`  Download progress: ${pct}% (${progress.loaded}/${progress.total} bytes)`);
        }
      }
    });

    console.log(`  ✓ Installed Model Path: ${installedModelPath}`);

    // 1. Verify .onnx file on disk
    if (!fs.existsSync(installedModelPath)) {
      throw new Error(`FAILED: Model file not created at ${installedModelPath}`);
    }
    const modelStat = fs.statSync(installedModelPath);
    console.log(`  ✓ Model File Size: ${modelStat.size} bytes`);
    if (modelStat.size < 1000000) {
      throw new Error(`FAILED: Model file is unexpectedly small (${modelStat.size} bytes)`);
    }

    // 2. Verify companion .onnx.json config file on disk
    const expectedConfigPath = `${installedModelPath}.json`;
    console.log(`\n[Test] Verifying companion config file at '${expectedConfigPath}'...`);
    if (!fs.existsSync(expectedConfigPath)) {
      throw new Error(`FAILED: Companion config file not created at ${expectedConfigPath}`);
    }

    const configStat = fs.statSync(expectedConfigPath);
    console.log(`  ✓ Companion Config Size: ${configStat.size} bytes`);
    if (configStat.size < 100) {
      throw new Error(`FAILED: Companion config file is empty or corrupted (${configStat.size} bytes)`);
    }

    const configContent = JSON.parse(fs.readFileSync(expectedConfigPath, 'utf8'));
    console.log(`  ✓ Valid JSON Config: audio.sample_rate = ${configContent?.audio?.sample_rate}, espeak.voice = ${configContent?.espeak?.voice}`);

    console.log('\n=====================================================');
    console.log(' PIPER MODEL & CONFIG DOWNLOAD TEST PASSED (100%)');
    console.log('=====================================================');
  } finally {
    if (fs.existsSync(testUserData)) {
      try { fs.rmSync(testUserData, { recursive: true, force: true }); } catch (_) {}
    }
  }
}

runPiperModelDownloadTest().catch((err) => {
  console.error('\n❌ Piper Model Download Test Error:', err);
  process.exit(1);
});

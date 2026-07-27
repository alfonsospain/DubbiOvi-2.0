import fs from 'fs';
import path from 'path';
const DownloadManager = require('../download-manager');
import { RuntimeManager } from '../src/runtime/RuntimeManager';
import { RuntimeExecutor } from '../src/runtime/RuntimeExecutor';

async function runConfigDownloadAndSynthesisTest() {
  console.log('=====================================================');
  console.log(' PIPER DUAL-FILE (.onnx + .onnx.json) DOWNLOAD & SYNTHESIS TEST');
  console.log('=====================================================');

  const targetModelName = 'es_ES-davefx-medium.onnx';
  const targetConfigName = `${targetModelName}.json`;
  const modelsDir = path.resolve('./scratch/piper-e2e/models');

  if (!fs.existsSync(modelsDir)) {
    fs.mkdirSync(modelsDir, { recursive: true });
  }

  const modelPath = path.join(modelsDir, targetModelName);
  const configPath = path.join(modelsDir, targetConfigName);

  const modelUrl = `https://huggingface.co/rhasspy/piper-voices/resolve/main/es/es_ES/davefx/medium/${targetModelName}`;
  const configUrl = `${modelUrl}.json`;

  // 1. Download Model (.onnx) and Config (.onnx.json)
  console.log(`\n[Step 1] Downloading ${targetModelName}...`);
  if (!fs.existsSync(modelPath)) {
    await DownloadManager.downloadFile(modelUrl, modelPath);
  }
  console.log(`  ✓ Model File Path: ${modelPath} (${fs.statSync(modelPath).size} bytes)`);

  console.log(`\n[Step 2] Downloading ${targetConfigName}...`);
  if (!fs.existsSync(configPath)) {
    await DownloadManager.downloadFile(configUrl, configPath);
  }
  console.log(`  ✓ Config File Path: ${configPath} (${fs.statSync(configPath).size} bytes)`);

  // Verify both files exist
  console.log('\n[Step 3] Verifying presence of BOTH files in target directory...');
  const filesOnDisk = fs.readdirSync(modelsDir);
  console.log('  Files in models directory:', filesOnDisk);

  if (!fs.existsSync(modelPath) || !fs.existsSync(configPath)) {
    throw new Error(`FAILED: Required model files missing from ${modelsDir}!`);
  }
  console.log('  ✓ BOTH .onnx and .onnx.json files exist on disk!');

  // 2. Execute Speech Synthesis with Spanish Voice
  console.log('\n[Step 4] Executing Spanish speech synthesis via RuntimeExecutor...');
  const runtimesDir = path.resolve('./scratch/piper-e2e');
  const manager = new RuntimeManager({
    runtimesDir,
    cacheDir: path.resolve('./scratch/piper-e2e/cache'),
    appVersion: '2.0.0',
  });

  manager.registry.register({
    id: 'piper',
    name: 'Piper Neural TTS Engine',
    category: 'tts',
    version: '1.0.0',
    installedPath: path.resolve('./scratch/piper-e2e/bin'),
    executablePath: path.resolve('./scratch/piper-e2e/bin/piper'),
    manifest: {
      schemaVersion: '2.0.0',
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts',
      version: '1.0.0',
      executable: 'bin/piper',
      platform: process.platform as any,
      arch: process.arch as any,
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
      packagedAt: new Date().toISOString(),
      checksumSha256: 'mock',
      files: ['bin/piper'],
    },
    status: 'INSTALLED',
    installedAt: new Date().toISOString(),
  });

  const executor = new RuntimeExecutor(manager.registry);
  const outputWavPath = path.resolve('./scratch/piper-e2e/Audio/spanish_test.wav');

  const execResult = await executor.execute({
    runtimeId: 'piper',
    version: '1.0.0',
    args: ['--model', modelPath, '--output_file', outputWavPath],
    inputData: 'Prueba de síntesis de voz en español con el motor Piper.',
  });

  console.log(`  ✓ RuntimeExecutor Exit Code: ${execResult.exitCode}`);
  console.log(`  ✓ Execution Duration: ${execResult.durationMs} ms`);

  if (execResult.exitCode !== 0) {
    throw new Error(`FAILED: Spanish voice synthesis failed with exit code ${execResult.exitCode}: ${execResult.stderr}`);
  }

  // 3. Verify Generated Audio WAV File
  console.log('\n[Step 5] Verifying physical output WAV file...');
  if (!fs.existsSync(outputWavPath)) {
    throw new Error(`FAILED: Output WAV file not created at ${outputWavPath}`);
  }

  const stat = fs.statSync(outputWavPath);
  const headerBuf = fs.readFileSync(outputWavPath).subarray(0, 12);
  const isRiffWave = headerBuf.toString('ascii', 0, 4) === 'RIFF' && headerBuf.toString('ascii', 8, 12) === 'WAVE';

  console.log(`  ✓ Output WAV Path: ${outputWavPath}`);
  console.log(`  ✓ File Size: ${stat.size} bytes`);
  console.log(`  ✓ Valid RIFF/WAVE Header: ${isRiffWave}`);

  if (stat.size < 1000 || !isRiffWave) {
    throw new Error(`FAILED: Spanish WAV file is empty or invalid PCM!`);
  }

  console.log('\n=====================================================');
  console.log(' DUAL-FILE DOWNLOAD & SYNTHESIS TEST PASSED (100%)');
  console.log('=====================================================');
}

runConfigDownloadAndSynthesisTest().catch((err) => {
  console.error('\n❌ Dual-File Test Error:', err);
  process.exit(1);
});

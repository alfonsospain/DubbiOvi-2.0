import fs from 'fs';
import path from 'path';
import http from 'http';
import { RuntimeManager } from '../src/runtime/RuntimeManager';
import { RuntimeValidator } from '../src/runtime/RuntimeValidator';
import { RuntimeExecutor } from '../src/runtime/RuntimeExecutor';

async function runFreshInstallValidation() {
  console.log('=====================================================');
  console.log(' PIPER FRESH INSTALLATION END-TO-END VALIDATION');
  console.log('=====================================================');

  const zipPackagePath = path.resolve('./dist/piper-darwin_arm64.zip');
  if (!fs.existsSync(zipPackagePath)) {
    throw new Error(`FAILED: Target runtime package not found at ${zipPackagePath}`);
  }

  // Spin up local HTTP server to serve the ZIP file for RuntimeDownloader
  const zipBuffer = fs.readFileSync(zipPackagePath);
  const server = http.createServer((req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Length': zipBuffer.length,
    });
    res.end(zipBuffer);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  const downloadUrl = `http://127.0.0.1:${address.port}/piper-darwin_arm64.zip`;
  console.log(`[HTTP Mock Server] Serving runtime package at ${downloadUrl}...`);

  try {
    // 1. Setup Completely Isolated Test Environment Directory
    const isolatedDir = path.resolve('./.fresh_install_test_env');
    const runtimesDir = path.join(isolatedDir, 'runtimes');
    const cacheDir = path.join(isolatedDir, 'cache');
    const modelsDir = path.join(isolatedDir, 'models', 'piper');
    const audioDir = path.join(isolatedDir, 'Audio');

    console.log(`\n[Step 1] Initializing clean isolated test directory: ${isolatedDir}...`);
    if (fs.existsSync(isolatedDir)) {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    }
    fs.mkdirSync(runtimesDir, { recursive: true });
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.mkdirSync(modelsDir, { recursive: true });
    fs.mkdirSync(audioDir, { recursive: true });
    console.log('  ✓ Isolated storage directories created cleanly.');

    // 2. Initialize RuntimeManager in Isolated Mode
    console.log('\n[Step 2] Initializing RuntimeManager in isolated environment...');
    const manager = new RuntimeManager({
      runtimesDir,
      cacheDir,
      appVersion: '2.0.0',
    });

    const initialRuntime = manager.getRuntime('piper', '1.0.0');
    if (initialRuntime) {
      throw new Error('FAILED: Clean test environment should have no initial Piper runtime!');
    }
    console.log('  ✓ Verified zero initial Piper runtime installation.');

    // 3. Install Package using RuntimeInstaller
    console.log('\n[Step 3] Installing piper-darwin_arm64.zip via RuntimeManager / RuntimeInstaller...');
    const descriptor = {
      id: 'piper',
      name: 'Piper Neural TTS Engine',
      category: 'tts' as const,
      version: '1.0.0',
      downloadUrl,
      checksumSha256: '88d9a643f26464d8131975d85e99e9496dbe07ff2c908550c9fc28ad9ba33c61',
      estimatedSize: '34.2 MB',
      runtimeApiVersion: '2.0.0',
      minimumDubbiOviVersion: '2.0.0',
    };

    const installedInfo = await manager.installRuntime(descriptor);
    if (!installedInfo || !fs.existsSync(installedInfo.executablePath)) {
      throw new Error('FAILED: Runtime installation via RuntimeInstaller failed!');
    }
    console.log(`  ✓ Installed Executable Path: ${installedInfo.executablePath}`);
    console.log(`  ✓ Installation Status: ${installedInfo.status}`);

    // 4. Verify RuntimeManager Detection
    console.log('\n[Step 4] Verifying RuntimeManager detection...');
    const detected = manager.getRuntime('piper', '1.0.0');
    if (!detected || detected.status !== 'INSTALLED') {
      throw new Error('FAILED: RuntimeManager failed to detect installed runtime!');
    }
    console.log(`  ✓ RuntimeManager detected runtime '${detected.id}' v${detected.version}.`);

    // 5. Verify RuntimeValidator Checks
    console.log('\n[Step 5] Verifying RuntimeValidator manifest & executable checks...');
    const manifestPath = path.join(detected.installedPath, 'manifest.json');
    const rawManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const validatedManifest = RuntimeValidator.validateManifest(rawManifest, '2.0.0', process.platform, process.arch);
    const validatedExec = RuntimeValidator.validateExtractedExecutable(detected.installedPath, validatedManifest.executable);

    console.log(`  ✓ Manifest validated: ${validatedManifest.name} (${validatedManifest.version})`);
    console.log(`  ✓ Entrypoint executable validated: ${validatedExec}`);

    // 6. Download Voice Model into Isolated Directory
    console.log('\n[Step 6] Downloading test voice model into isolated directory...');
    const modelPath = path.join(modelsDir, 'en_US-lessac-high.onnx');
    const configPath = path.join(modelsDir, 'en_US-lessac-high.onnx.json');

    const modelUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx';
    const configUrl = 'https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/high/en_US-lessac-high.onnx.json';

    const downloadFile = async (url: string, dest: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
      const arrayBuffer = await res.arrayBuffer();
      fs.writeFileSync(dest, Buffer.from(arrayBuffer));
    };

    await downloadFile(modelUrl, modelPath);
    await downloadFile(configUrl, configPath);
    console.log(`  ✓ Voice model downloaded: ${modelPath} (${fs.statSync(modelPath).size} bytes)`);

    // 7. Execute Speech Synthesis via RuntimeExecutor (Clean Environment)
    console.log('\n[Step 7] Launching speech synthesis via RuntimeExecutor (Isolated Environment)...');
    const executor = new RuntimeExecutor(manager.registry);
    const outputWavPath = path.join(audioDir, 'fresh_install_synthesis.wav');

    const execResult = await executor.execute({
      runtimeId: 'piper',
      version: '1.0.0',
      args: ['--model', modelPath, '--output_file', outputWavPath],
      inputData: 'DubbiOvi fresh installation validation of Piper Local TTS on Apple Silicon.',
      env: {
        PATH: '/usr/bin:/bin', // Strip external Python/Homebrew PATHs to enforce 100% isolation
        PYTHONPATH: '',
      },
    });

    if (execResult.exitCode !== 0) {
      throw new Error(`FAILED: RuntimeExecutor failed with exit code ${execResult.exitCode}: ${execResult.stderr}`);
    }
    console.log(`  ✓ RuntimeExecutor Exit Code: ${execResult.exitCode}`);
    console.log(`  ✓ Execution Duration: ${execResult.durationMs} ms`);

    // 8. Verify Generated Physical Audio WAV File
    console.log('\n[Step 8] Verifying generated WAV audio file on disk...');
    if (!fs.existsSync(outputWavPath)) {
      throw new Error(`FAILED: Output WAV file not created at ${outputWavPath}`);
    }

    const wavStat = fs.statSync(outputWavPath);
    const headerBuf = fs.readFileSync(outputWavPath, { flag: 'r' }).subarray(0, 12);
    const isRiffWave = headerBuf.toString('ascii', 0, 4) === 'RIFF' && headerBuf.toString('ascii', 8, 12) === 'WAVE';

    if (wavStat.size < 1000 || !isRiffWave) {
      throw new Error(`FAILED: Output WAV invalid or empty (size: ${wavStat.size} bytes, isRiffWave: ${isRiffWave})`);
    }

    console.log(`  ✓ Physical WAV File: ${outputWavPath}`);
    console.log(`  ✓ File Size: ${wavStat.size} bytes`);
    console.log(`  ✓ Valid RIFF/WAVE Header: ${isRiffWave}`);

    // Clean up test environment
    fs.rmSync(isolatedDir, { recursive: true, force: true });

    console.log('\n=====================================================');
    console.log(' FRESH INSTALLATION VALIDATION PASSED (100%)');
    console.log(' PIPER-DARWIN_ARM64.ZIP IS PRODUCTION READY');
    console.log('=====================================================');
  } finally {
    server.close();
  }
}

runFreshInstallValidation().catch((err) => {
  console.error('\n❌ Fresh Install Validation Error:', err);
  process.exit(1);
});

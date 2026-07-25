import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import {
  RuntimeRegistry,
  RuntimeExecutor,
  InstalledRuntimeInfo,
} from '../src/runtime';
import { WhisperLocalProvider, WhisperExecutionResult } from '../src/lib/WhisperLocalProvider';

async function runMilestone7BTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 7B WHISPER RUNTIME EXECUTION TEST');
  console.log('=====================================================');

  const execPath = '/Volumes/AlfonsoSSD/GitHub/DubbiOvi-2.0/dist/whisper-darwin_arm64/bin/whisper-cli';
  const modelPath = '/Users/alfonso/Library/Application Support/dubbiovi/models/whisper/ggml-tiny.bin';
  const tempWavPath = path.join(os.tmpdir(), `milestone_7b_sample_${Date.now()}.wav`);

  if (!fs.existsSync(execPath)) {
    throw new Error(`Prerequisite binary missing at: ${execPath}`);
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error(`Prerequisite model missing at: ${modelPath}`);
  }

  // Generate real audio sample using macOS say + afconvert
  console.log('\n[Setup] Generating test audio WAV file...');
  try {
    const aiffPath = path.join(os.tmpdir(), `temp_speech_${Date.now()}.aiff`);
    execSync(`say -o "${aiffPath}" "Hello world, testing Whisper runtime execution in DubbiOvi."`);
    execSync(`afconvert -f WAVE -d LEI16@16000 "${aiffPath}" "${tempWavPath}"`);
    if (fs.existsSync(aiffPath)) fs.unlinkSync(aiffPath);
  } catch (err: any) {
    throw new Error(`Failed to generate test audio sample: ${err.message}`);
  }

  if (!fs.existsSync(tempWavPath)) {
    throw new Error(`Test WAV audio file creation failed at: ${tempWavPath}`);
  }
  console.log('  ✓ Generated test audio file at:', tempWavPath, `(${fs.statSync(tempWavPath).size} bytes)`);

  try {
    // Setup RuntimeRegistry & RuntimeExecutor
    const registry = new RuntimeRegistry();
    const installedInfo: InstalledRuntimeInfo = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      executablePath: execPath,
      installedPath: path.dirname(path.dirname(execPath)),
      installedAt: new Date().toISOString(),
      manifest: {
        schemaVersion: '2.0.0',
        minimumDubbiOviVersion: '2.0.0',
        runtimeApiVersion: '2.0.0',
        id: 'whisper',
        name: 'Whisper.cpp Engine',
        category: 'asr',
        version: '1.9.1',
        executable: 'bin/whisper-cli',
        platform: process.platform,
        arch: process.arch,
        packagedAt: new Date().toISOString(),
        files: ['bin/whisper-cli'],
        checksumSha256: null,
      },
      status: 'INSTALLED',
    };

    registry.register(installedInfo);
    const executor = new RuntimeExecutor(registry);
    const provider = new WhisperLocalProvider('ggml-tiny.bin', '1.9.1', executor);

    // -------------------------------------------------------------------------
    // Test 1: Runtime Discovery & Validation
    // -------------------------------------------------------------------------
    console.log('\n[Test 1] Verifying Runtime Discovery & Registry Status...');
    const registeredRuntime = registry.get('whisper', '1.9.1');
    if (!registeredRuntime || registeredRuntime.executablePath !== execPath) {
      throw new Error('FAILED: Runtime Discovery failed to resolve registered Whisper runtime.');
    }
    console.log('  ✓ PASSED: Runtime discovered & executable path verified:', registeredRuntime.executablePath);

    // -------------------------------------------------------------------------
    // Test 2: Full End-to-End Execution of transcribeAudio
    // -------------------------------------------------------------------------
    console.log('\n[Test 2] Executing WhisperLocalProvider.transcribeAudio()...');
    const result: WhisperExecutionResult = await provider.transcribeAudio(tempWavPath, modelPath, {
      executor,
      timeoutMs: 60000,
    });

    console.log('  ✓ Process Exit Code :', result.execution.exitCode);
    console.log('  ✓ Success Status    :', result.execution.success);
    console.log('  ✓ Duration (ms)     :', result.execution.durationMs);
    console.log('  ✓ Stdout Length     :', result.execution.stdout.length, 'bytes');
    console.log('  ✓ Stderr Length     :', result.execution.stderr.length, 'bytes');
    console.log('  ✓ Raw Output Length :', result.rawOutput.length, 'bytes');
    console.log('  ✓ Raw Output Snippet:\n', result.rawOutput.slice(0, 200) + '...');

    if (!result.execution.success || result.execution.exitCode !== 0) {
      throw new Error(`FAILED: Process exit code was ${result.execution.exitCode}, expected 0.`);
    }
    if (!result.rawOutput || typeof result.rawOutput !== 'string' || result.rawOutput.trim().length === 0) {
      throw new Error('FAILED: rawOutput payload is empty or invalid string.');
    }
    console.log('  ✓ PASSED: transcribeAudio executed successfully and returned opaque rawOutput.');

    // -------------------------------------------------------------------------
    // Test 3: Real-Time Incremental Streaming (onStdout / onStderr)
    // -------------------------------------------------------------------------
    console.log('\n[Test 3] Testing Real-Time Output Streaming Callbacks...');
    let stdoutChunks = 0;
    let stderrChunks = 0;

    const streamResult = await provider.transcribeAudio(tempWavPath, modelPath, {
      executor,
      onStdout: (chunk) => {
        stdoutChunks++;
      },
      onStderr: (chunk) => {
        stderrChunks++;
      },
    });

    console.log('  ✓ Stdout streaming chunks:', stdoutChunks);
    console.log('  ✓ Stderr streaming chunks:', stderrChunks);

    if (stdoutChunks === 0 && stderrChunks === 0) {
      throw new Error('FAILED: No real-time streaming chunks were received.');
    }
    console.log('  ✓ PASSED: Real-time output streaming callbacks received.');

    // -------------------------------------------------------------------------
    // Test 4: Error Handling — Missing Audio File
    // -------------------------------------------------------------------------
    console.log('\n[Test 4] Testing Error Handling: Missing Audio File...');
    let missingAudioFailed = false;
    try {
      await provider.transcribeAudio('/tmp/non_existent_audio_file.wav', modelPath, { executor });
    } catch (err: any) {
      missingAudioFailed = true;
      console.log('  ✓ Caught expected error:', err.message);
    }
    if (!missingAudioFailed) {
      throw new Error('FAILED: Missing audio file should have thrown an error!');
    }
    console.log('  ✓ PASSED: Missing audio file error handled cleanly.');

    // -------------------------------------------------------------------------
    // Test 5: Error Handling — Missing Model File
    // -------------------------------------------------------------------------
    console.log('\n[Test 5] Testing Error Handling: Missing Model File...');
    let missingModelFailed = false;
    try {
      await provider.transcribeAudio(tempWavPath, '/tmp/non_existent_model.bin', { executor });
    } catch (err: any) {
      missingModelFailed = true;
      console.log('  ✓ Caught expected error:', err.message);
    }
    if (!missingModelFailed) {
      throw new Error('FAILED: Missing model file should have thrown an error!');
    }
    console.log('  ✓ PASSED: Missing model file error handled cleanly.');

    // -------------------------------------------------------------------------
    // Test 6: Error Handling — Timeout Execution
    // -------------------------------------------------------------------------
    console.log('\n[Test 6] Testing Error Handling: Process Timeout...');
    let timeoutFailed = false;
    try {
      await provider.transcribeAudio(tempWavPath, modelPath, { executor, timeoutMs: 1 });
    } catch (err: any) {
      timeoutFailed = true;
      console.log('  ✓ Caught expected error:', err.message);
    }
    if (!timeoutFailed) {
      throw new Error('FAILED: Timeout execution should have thrown an error!');
    }
    console.log('  ✓ PASSED: Process timeout handled cleanly.');

    // -------------------------------------------------------------------------
    // Test 7: Error Handling — AbortSignal Cancellation
    // -------------------------------------------------------------------------
    console.log('\n[Test 7] Testing Error Handling: AbortSignal Cancellation...');
    const controller = new AbortController();
    controller.abort();

    let cancelFailed = false;
    try {
      await provider.transcribeAudio(tempWavPath, modelPath, { executor, signal: controller.signal });
    } catch (err: any) {
      cancelFailed = true;
      console.log('  ✓ Caught expected error:', err.message);
    }
    if (!cancelFailed) {
      throw new Error('FAILED: Cancellation should have thrown an error!');
    }
    console.log('  ✓ PASSED: AbortSignal process cancellation handled cleanly.');

    // -------------------------------------------------------------------------
    // Test 8: Architectural Invariance — Verify RuntimeExecutor remains untouched
    // -------------------------------------------------------------------------
    console.log('\n[Test 8] Verifying Architectural Invariance (RuntimeExecutor unchanged)...');
    const gitStatus = execSync('git status --porcelain src/runtime/RuntimeExecutor.ts src/runtime/RuntimeProcess.ts').toString().trim();
    if (gitStatus.length > 0) {
      throw new Error(`FAILED: Files inside RuntimeExecutor were modified!\n${gitStatus}`);
    }
    console.log('  ✓ PASSED: RuntimeExecutor & RuntimeProcess execution core remain 100% architecturally unchanged.');

    console.log('\n=====================================================');
    console.log(' ALL MILESTONE 7B TESTS PASSED SUCCESSFULLY (100%)');
    console.log('=====================================================');
  } finally {
    // Cleanup temporary generated WAV file
    if (fs.existsSync(tempWavPath)) {
      try {
        fs.unlinkSync(tempWavPath);
      } catch (_) {}
    }
  }
}

runMilestone7BTests().catch((err) => {
  console.error('\n❌ Milestone 7B Test Suite Error:', err);
  process.exit(1);
});

import fs from 'fs';
import path from 'path';
import {
  RuntimeRegistry,
  RuntimeExecutor,
  InstalledRuntimeInfo,
  RuntimeExecutionResult,
} from '../src/runtime';

async function runRuntimeExecutorTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 7A RUNTIME EXECUTOR TEST SUITE');
  console.log('=====================================================');

  const execPath = '/Volumes/AlfonsoSSD/GitHub/DubbiOvi-2.0/dist/whisper-darwin_arm64/bin/whisper-cli';
  if (!fs.existsSync(execPath)) {
    throw new Error(`Prerequisite binary missing at: ${execPath}`);
  }

  // Setup mock registry with registered Whisper runtime
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

  // -------------------------------------------------------------------------
  // Test 1: Standard Execution (whisper-cli --help)
  // -------------------------------------------------------------------------
  console.log('\n[Test 1] Executing whisper-cli --help via RuntimeExecutor...');
  const result: RuntimeExecutionResult = await executor.execute({
    runtimeId: 'whisper',
    version: '1.9.1',
    args: ['--help'],
    timeoutMs: 5000,
  });

  console.log('  ✓ Process Exit Code :', result.exitCode);
  console.log('  ✓ Success Status    :', result.success);
  console.log('  ✓ Duration (ms)     :', result.durationMs);
  console.log('  ✓ Stdout captured   :', result.stdout.length, 'bytes');
  console.log('  ✓ Stderr captured   :', result.stderr.length, 'bytes');
  console.log('  ✓ Stdout Snippet    :\n', result.stdout.split('\n').slice(0, 5).join('\n'));

  if (!result.success || result.exitCode !== 0) {
    throw new Error(`FAILED: Process exit code was ${result.exitCode}, expected 0.`);
  }

  const fullOutput = (result.stdout + '\n' + result.stderr).toLowerCase();
  if (!fullOutput.includes('usage:') && !fullOutput.includes('options:')) {
    throw new Error('FAILED: Process output does not contain expected whisper-cli usage documentation.');
  }
  console.log('  ✓ PASSED: whisper-cli --help executed cleanly with exitCode == 0.');

  // -------------------------------------------------------------------------
  // Test 2: Timeout Handling
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Testing Process Timeout Handling...');
  const timeoutResult = await executor.executeDirect(execPath, {
    args: ['--help'],
    timeoutMs: 1, // 1ms timeout to force timeout handler
  });

  console.log('  ✓ Timeout Error Result:', timeoutResult.error);
  if (timeoutResult.success) {
    throw new Error('FAILED: Timeout test should not have succeeded!');
  }
  console.log('  ✓ PASSED: Timeout handler terminated process correctly.');

  // -------------------------------------------------------------------------
  // Test 3: Cancellation via AbortSignal
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Testing Process Cancellation via AbortSignal...');
  const controller = new AbortController();
  controller.abort();

  const cancelResult = await executor.execute({
    runtimeId: 'whisper',
    version: '1.9.1',
    args: ['--help'],
    signal: controller.signal,
  });

  console.log('  ✓ Cancel Error Result:', cancelResult.error);
  if (cancelResult.success) {
    throw new Error('FAILED: Cancellation test should not have succeeded!');
  }
  console.log('  ✓ PASSED: AbortSignal cancellation handled correctly.');

  // -------------------------------------------------------------------------
  // Test 4: Unregistered Runtime Error Handling
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Testing Unregistered Runtime Handling...');
  const missingResult = await executor.execute({
    runtimeId: 'nonexistent-runtime',
    args: ['--help'],
  });

  console.log('  ✓ Unregistered Error Result:', missingResult.error);
  if (missingResult.success) {
    throw new Error('FAILED: Unregistered runtime should not succeed!');
  }
  console.log('  ✓ PASSED: Unregistered runtime cleanly rejected.');

  // -------------------------------------------------------------------------
  // Test 5: Incremental Output Streaming (onStdout / onStderr)
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Testing Real-Time Incremental Output Streaming...');
  let stdoutStreamChunks = 0;
  let stderrStreamChunks = 0;

  const streamResult = await executor.execute({
    runtimeId: 'whisper',
    version: '1.9.1',
    args: ['--help'],
    onStdout: (chunk) => {
      stdoutStreamChunks++;
    },
    onStderr: (chunk) => {
      stderrStreamChunks++;
    },
  });

  console.log('  ✓ Stdout stream chunks received:', stdoutStreamChunks);
  console.log('  ✓ Stderr stream chunks received:', stderrStreamChunks);

  if (stdoutStreamChunks === 0 && stderrStreamChunks === 0) {
    throw new Error('FAILED: No real-time streaming chunks received!');
  }
  console.log('  ✓ PASSED: Real-time incremental output streaming verified.');

  console.log('\n=====================================================');
  console.log(' ALL MILESTONE 7A RUNTIME EXECUTOR TESTS PASSED (100%)');
  console.log('=====================================================');
}

runRuntimeExecutorTests().catch((err) => {
  console.error('\n❌ Runtime Executor Test Suite Error:', err);
  process.exit(1);
});

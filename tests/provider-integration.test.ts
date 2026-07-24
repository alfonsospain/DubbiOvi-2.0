import { RuntimeRepository, RuntimeManager } from '../src/runtime';
import { WhisperLocalProvider } from '../src/lib/WhisperLocalProvider';

async function runMilestone6Tests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 6 PROVIDER INTEGRATION TEST SUITE');
  console.log('=====================================================');

  // 1. Test RuntimeRepository catalog lookup
  console.log('\n[Test 1] Testing RuntimeRepository catalog lookup...');
  const repository = new RuntimeRepository();

  const macArm64Descriptor = await repository.getDescriptor('whisper', '1.9.1', 'darwin', 'arm64');
  if (!macArm64Descriptor || macArm64Descriptor.id !== 'whisper' || macArm64Descriptor.version !== '1.9.1') {
    throw new Error('FAILED: RuntimeRepository failed to resolve darwin_arm64 descriptor!');
  }
  console.log('  ✓ PASSED: Resolved darwin_arm64 descriptor cleanly:', macArm64Descriptor.name, `(${macArm64Descriptor.downloadUrl})`);

  const winX64Descriptor = await repository.getDescriptor('whisper', '1.9.1', 'win32', 'x64');
  if (!winX64Descriptor || winX64Descriptor.id !== 'whisper') {
    throw new Error('FAILED: RuntimeRepository failed to resolve win32_x64 descriptor!');
  }
  console.log('  ✓ PASSED: Resolved win32_x64 descriptor cleanly:', winX64Descriptor.name);

  // 2. Test WhisperLocalProvider runtime discovery & installation request wiring
  console.log('\n[Test 2] Testing WhisperLocalProvider runtime status methods...');
  const provider = new WhisperLocalProvider();
  console.log('  ✓ Provider ID:', provider.id);
  console.log('  ✓ Provider Name:', provider.name);
  console.log('  ✓ Provider Capabilities (isOffline):', provider.capabilities.isOffline);

  // Mock electron context for unit environment
  (global as any).window = {
    electron: {
      checkRuntimeInstalled: async (runtimeId: string, version: string) => {
        return {
          isInstalled: true,
          info: {
            id: runtimeId,
            version,
            executablePath: '/mock/userData/runtimes/whisper/1.9.1/bin/whisper-cli',
            installedPath: '/mock/userData/runtimes/whisper/1.9.1',
            status: 'INSTALLED',
          },
        };
      },
      getRuntimeDescriptor: async (runtimeId: string, version: string) => {
        return repository.getDescriptor(runtimeId, version, 'darwin', 'arm64');
      },
      installRuntime: async (runtimeId: string, version: string) => {
        const desc = await repository.getDescriptor(runtimeId, version, 'darwin', 'arm64');
        return {
          id: runtimeId,
          version,
          executablePath: '/mock/userData/runtimes/whisper/1.9.1/bin/whisper-cli',
          installedPath: '/mock/userData/runtimes/whisper/1.9.1',
          status: 'INSTALLED',
          manifest: desc,
        };
      },
    },
  };

  const status = await provider.checkRuntimeStatus();
  if (!status.isInstalled || !status.info) {
    throw new Error('FAILED: WhisperLocalProvider checkRuntimeStatus failed with mock!');
  }
  console.log('  ✓ PASSED: WhisperLocalProvider detected installed runtime via IPC.');

  const execPath = await provider.getExecutablePath();
  if (execPath !== '/mock/userData/runtimes/whisper/1.9.1/bin/whisper-cli') {
    throw new Error('FAILED: WhisperLocalProvider getExecutablePath mismatch!');
  }
  console.log('  ✓ PASSED: WhisperLocalProvider resolved executable path:', execPath);

  const installedInfo = await provider.ensureRuntimeInstalled();
  if (!installedInfo || installedInfo.status !== 'INSTALLED') {
    throw new Error('FAILED: WhisperLocalProvider ensureRuntimeInstalled failed!');
  }
  console.log('  ✓ PASSED: WhisperLocalProvider requested & returned installed runtime info.');

  console.log('\n=====================================================');
  console.log(' ALL MILESTONE 6 PROVIDER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runMilestone6Tests().catch((err) => {
  console.error('❌ Milestone 6 Test Error:', err);
  process.exit(1);
});

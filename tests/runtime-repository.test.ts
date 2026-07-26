import { RuntimeRepository } from '../src/runtime';

async function runRuntimeRepositoryTests() {
  console.log('=====================================================');
  console.log(' STARTING RUNTIME REPOSITORY METADATA TEST SUITE');
  console.log('=====================================================');

  const repository = new RuntimeRepository();

  // 1. Verify Platform Key & Release Filename Resolution
  console.log('\n[Test 1] Testing Platform Key and Filename Resolution...');
  const darwinArm64Key = RuntimeRepository.resolvePlatformKey('darwin', 'arm64');
  const darwinX64Key = RuntimeRepository.resolvePlatformKey('darwin', 'x64');
  const win32X64Key = RuntimeRepository.resolvePlatformKey('win32', 'x64');

  if (darwinArm64Key !== 'darwin_arm64' || darwinX64Key !== 'darwin_x64' || win32X64Key !== 'win32_x64') {
    throw new Error('FAILED: resolvePlatformKey returned invalid keys!');
  }
  console.log('  ✓ resolvePlatformKey verified for darwin_arm64, darwin_x64, win32_x64');

  const darwinArm64File = RuntimeRepository.resolveReleaseFilename('whisper', 'darwin', 'arm64');
  const darwinX64File = RuntimeRepository.resolveReleaseFilename('whisper', 'darwin', 'x64');
  const win32X64File = RuntimeRepository.resolveReleaseFilename('whisper', 'win32', 'x64');

  if (
    darwinArm64File !== 'whisper-darwin_arm64.zip' ||
    darwinX64File !== 'whisper-darwin_x64.zip' ||
    win32X64File !== 'whisper-win32_x64.zip'
  ) {
    throw new Error('FAILED: resolveReleaseFilename returned invalid filenames!');
  }
  console.log('  ✓ resolveReleaseFilename verified for whisper packages');

  // 2. Verify Catalog Descriptors for Supported Platforms
  console.log('\n[Test 2] Verifying Descriptor Metadata for all Supported Platforms...');

  const platformsToTest: Array<{
    platform: NodeJS.Platform;
    arch: NodeJS.Architecture;
    expectedAsset: string;
    expectedSha256: string;
  }> = [
    {
      platform: 'darwin',
      arch: 'arm64',
      expectedAsset: 'whisper-darwin_arm64.zip',
      expectedSha256: 'ec25ef55bb79cbaffcab72ce0f65b9d825c3dff7c2b44021b107bb91583b3afc',
    },
    {
      platform: 'darwin',
      arch: 'x64',
      expectedAsset: 'whisper-darwin_x64.zip',
      expectedSha256: 'd1b2ede0ba03eb8e5456483e476772b99c1e4227d62682369de433230c750b7f',
    },
    {
      platform: 'win32',
      arch: 'x64',
      expectedAsset: 'whisper-win32_x64.zip',
      expectedSha256: 'f967f4ceb5a703c86a58d3b7036f24f5b260053d698c7b6063e3dc059fcd7413',
    },
  ];

  const sha256Regex = /^[a-f0-9]{64}$/i;
  const baseUrl = 'https://github.com/alfonsospain/DubbiOvi-2.0/releases/download/v2.0.0-runtimes/';

  for (const item of platformsToTest) {
    const desc = await repository.getDescriptor('whisper', '1.9.1', item.platform, item.arch);

    if (!desc) {
      throw new Error(`FAILED: Could not find descriptor for ${item.platform}_${item.arch}`);
    }

    console.log(`\n  Checking ${item.platform}_${item.arch}:`);
    console.log(`    - ID: ${desc.id}`);
    console.log(`    - Name: ${desc.name}`);
    console.log(`    - Version: ${desc.version}`);
    console.log(`    - URL: ${desc.downloadUrl}`);
    console.log(`    - SHA-256: ${desc.checksumSha256}`);

    if (desc.id !== 'whisper') {
      throw new Error(`FAILED: Invalid ID for ${item.platform}_${item.arch}`);
    }

    if (desc.version !== '1.9.1') {
      throw new Error(`FAILED: Invalid version for ${item.platform}_${item.arch}`);
    }

    const expectedUrl = `${baseUrl}${item.expectedAsset}`;
    if (desc.downloadUrl !== expectedUrl) {
      throw new Error(`FAILED: downloadUrl mismatch! Expected: ${expectedUrl}, Got: ${desc.downloadUrl}`);
    }

    if (desc.checksumSha256 !== item.expectedSha256) {
      throw new Error(`FAILED: checksumSha256 mismatch! Expected: ${item.expectedSha256}, Got: ${desc.checksumSha256}`);
    }

    if (!sha256Regex.test(desc.checksumSha256)) {
      throw new Error(`FAILED: SHA-256 format invalid for ${item.platform}_${item.arch}`);
    }
  }

  // 3. Verify Repository Single Source of Truth
  console.log('\n[Test 3] Verifying getAllDescriptors() metadata collection...');
  const all = await repository.getAllDescriptors();
  const whisperCount = all.filter((d) => d.id === 'whisper').length;
  const piperCount = all.filter((d) => d.id === 'piper').length;
  if (whisperCount < 3 || piperCount < 3) {
    throw new Error(`FAILED: Expected at least 3 Whisper and 3 Piper descriptors, got Whisper: ${whisperCount}, Piper: ${piperCount}`);
  }
  console.log(`  ✓ getAllDescriptors returned ${all.length} registered descriptors (Whisper: ${whisperCount}, Piper: ${piperCount}).`);

  console.log('\n=====================================================');
  console.log(' ALL RUNTIME REPOSITORY METADATA TESTS PASSED (100%)');
  console.log('=====================================================');
}

runRuntimeRepositoryTests().catch((err) => {
  console.error('\n❌ RuntimeRepository Test Error:', err);
  process.exit(1);
});

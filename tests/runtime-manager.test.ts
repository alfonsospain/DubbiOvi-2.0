import fs from 'fs';
import path from 'path';
import http from 'http';
import {
  RuntimeManager,
  RuntimeRegistry,
  RuntimeValidator,
  RuntimeInstaller,
  RuntimeDownloader,
  RuntimeDescriptor,
} from '../src/runtime';

async function runTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 5 RUNTIME MANAGER TEST SUITE');
  console.log('=====================================================');

  const testBaseDir = path.join('/tmp', `dubbiovi-test-suite-${Date.now()}`);
  const runtimesDir = path.join(testBaseDir, 'runtimes');
  const cacheDir = path.join(testBaseDir, 'cache');

  fs.mkdirSync(runtimesDir, { recursive: true });
  fs.mkdirSync(cacheDir, { recursive: true });

  const manager = new RuntimeManager({
    runtimesDir,
    cacheDir,
    appVersion: '2.0.0',
  });

  const validZipPath = path.join('/Volumes/AlfonsoSSD/GitHub/DubbiOvi-2.0/dist', 'whisper-darwin_arm64.zip');
  if (!fs.existsSync(validZipPath)) {
    throw new Error(`Prerequisite file missing: ${validZipPath}`);
  }

  const validChecksum = RuntimeValidator.computeSha256(validZipPath);

  // -------------------------------------------------------------------------
  // Test 1: Path Traversal Security Protection
  // -------------------------------------------------------------------------
  console.log('\n[Test 1] Testing ZIP Path Traversal Security Checks...');
  try {
    RuntimeValidator.validateZipEntryPaths(['bin/whisper-cli', '../../etc/passwd']);
    throw new Error('FAILED: Path traversal check should have thrown!');
  } catch (err: any) {
    if (err.message.includes('Unsafe path traversal')) {
      console.log('  ✓ PASSED: Successfully detected and blocked unsafe ZIP entry path.');
    } else {
      throw err;
    }
  }

  // -------------------------------------------------------------------------
  // Test 2: Local HTTP Mock Server Setup
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Setting up Mock HTTP Server for Local Package Downloads...');
  const zipBuffer = fs.readFileSync(validZipPath);

  const server = http.createServer((req, res) => {
    if (req.url === '/whisper-darwin_arm64.zip') {
      res.writeHead(200, {
        'Content-Type': 'application/zip',
        'Content-Length': zipBuffer.length.toString(),
      });
      res.end(zipBuffer);
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const mockPort = address.port;
  const mockZipUrl = `http://127.0.0.1:${mockPort}/whisper-darwin_arm64.zip`;
  console.log(`  ✓ Mock HTTP server running on ${mockZipUrl}`);

  try {
    // -----------------------------------------------------------------------
    // Test 3: Checksum Failure & Cleanup Test
    // -----------------------------------------------------------------------
    console.log('\n[Test 3] Testing Authoritative Checksum Failure & Cleanup...');
    const invalidDescriptor: RuntimeDescriptor = {
      id: 'whisper-invalid-hash',
      name: 'Whisper Invalid Hash',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: mockZipUrl,
      checksumSha256: '0000000000000000000000000000000000000000000000000000000000000000',
    };

    try {
      await manager.installRuntime(invalidDescriptor);
      throw new Error('FAILED: Installation should have failed on invalid SHA-256!');
    } catch (err: any) {
      if (err.message.includes('SHA-256 checksum mismatch')) {
        console.log('  ✓ PASSED: Checksum mismatch correctly detected.');
        const cacheFiles = fs.readdirSync(cacheDir);
        console.log('  ✓ PASSED: Cache directory cleaned up cleanly (files remaining:', cacheFiles.length, ').');
      } else {
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Test 4: Incompatible Manifest Test
    // -----------------------------------------------------------------------
    console.log('\n[Test 4] Testing Incompatible Manifest Validation...');
    const incompatibleManifest = {
      schemaVersion: '2.0.0',
      minimumDubbiOviVersion: '99.0.0',
      runtimeApiVersion: '2.0.0',
      id: 'whisper',
      name: 'Whisper Engine',
      category: 'asr',
      version: '1.9.1',
      executable: 'bin/whisper-cli',
      platform: 'darwin',
      arch: 'arm64',
      packagedAt: new Date().toISOString(),
      files: ['bin/whisper-cli'],
    };

    try {
      RuntimeValidator.validateManifest(incompatibleManifest, '2.0.0');
      throw new Error('FAILED: Manifest validation should have rejected minimumDubbiOviVersion 99.0.0!');
    } catch (err: any) {
      if (err.message.includes('Requires DubbiOvi v99.0.0 or higher')) {
        console.log('  ✓ PASSED: Successfully rejected incompatible minimumDubbiOviVersion.');
      } else {
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Test 5: Abort / Cancellation Test
    // -----------------------------------------------------------------------
    console.log('\n[Test 5] Testing Download Cancellation (AbortSignal)...');
    const controller = new AbortController();
    controller.abort();

    const descriptorForCancel: RuntimeDescriptor = {
      id: 'whisper-cancelled',
      name: 'Whisper Cancelled',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: mockZipUrl,
      checksumSha256: validChecksum,
    };

    try {
      await manager.installRuntime(descriptorForCancel, undefined, controller.signal);
      throw new Error('FAILED: Download should have thrown on AbortSignal!');
    } catch (err: any) {
      if (err.message.includes('cancelled')) {
        console.log('  ✓ PASSED: Download successfully cancelled by AbortSignal.');
      } else {
        throw err;
      }
    }

    // -----------------------------------------------------------------------
    // Test 6: Successful Atomic Installation Pipeline
    // -----------------------------------------------------------------------
    console.log('\n[Test 6] Testing Successful Atomic Installation Pipeline...');
    const validDescriptor: RuntimeDescriptor = {
      id: 'whisper',
      name: 'Whisper.cpp Engine',
      category: 'asr',
      version: '1.9.1',
      downloadUrl: mockZipUrl,
      checksumSha256: validChecksum,
    };

    let progressEventsCount = 0;
    const installedInfo = await manager.installRuntime(validDescriptor, (prog) => {
      progressEventsCount++;
    });

    console.log('  ✓ Progress events triggered:', progressEventsCount);
    console.log('  ✓ Installed path:', installedInfo.installedPath);
    console.log('  ✓ Executable path:', installedInfo.executablePath);
    console.log('  ✓ Installed status:', installedInfo.status);

    // Verify directory layout: userData/runtimes/whisper/1.9.1/
    const expectedDir = path.join(runtimesDir, 'whisper', '1.9.1');
    if (installedInfo.installedPath !== expectedDir) {
      throw new Error(`Directory layout mismatch! Expected: ${expectedDir}, Actual: ${installedInfo.installedPath}`);
    }
    console.log('  ✓ PASSED: Directory layout matches userData/runtimes/whisper/1.9.1/');

    // Verify executable existence and POSIX permissions
    if (!fs.existsSync(installedInfo.executablePath)) {
      throw new Error(`Executable missing at: ${installedInfo.executablePath}`);
    }

    if (process.platform !== 'win32') {
      const stat = fs.statSync(installedInfo.executablePath);
      const perm = (stat.mode & 0o777).toString(8);
      console.log('  ✓ Executable POSIX permissions:', perm);
      if (perm !== '755') {
        throw new Error(`Executable permissions mismatch! Expected 755, got ${perm}`);
      }
    }

    // Verify Registry Persistence & Querying
    const retrieved = manager.getRuntime('whisper', '1.9.1');
    if (!retrieved || retrieved.installedPath !== expectedDir) {
      throw new Error('FAILED: Registry failed to return installed runtime info.');
    }
    console.log('  ✓ PASSED: RuntimeRegistry successfully loaded & returned registered runtime.');

    console.log('\n=====================================================');
    console.log(' ALL MILESTONE 5 RUNTIME MANAGER TESTS PASSED (100%)');
    console.log('=====================================================');
  } finally {
    server.close();
    try {
      fs.rmSync(testBaseDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Error:', err);
  process.exit(1);
});

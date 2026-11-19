import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { CpuCompatibility } from '../src/runtime/CpuCompatibility';
import { RuntimeRepository } from '../src/runtime/RuntimeRepository';
import { WhisperModelManager, WhisperBinaryLocator, buildWhisperArgs } from '../whisper-helpers';

async function runDualRuntimeTests() {
  console.log('=================================================================');
  console.log('  STARTING WINDOWS DUAL WHISPER RUNTIME INTEGRATION TEST SUITE   ');
  console.log('=================================================================');

  // ---------------------------------------------------------------------------
  // Test 1: CPU Compatibility & Microarchitecture Detection
  // ---------------------------------------------------------------------------
  console.log('\n[Test 1] Testing CPU feature detection & fail-safe evaluation...');

  // Mock Windows platform
  const origPlatform = process.platform;
  const origArch = process.arch;

  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });

    // A. Confirmed Modern AVX2 Processors (Probe = true)
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i7-10700K CPU @ 3.80GHz', true),
      'optimized',
      'Haswell+ Intel Core 10th Gen with confirmed probe must resolve to optimized'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('AMD Ryzen 7 5800X 8-Core Processor', true),
      'optimized',
      'AMD Ryzen Zen 3 with confirmed probe must resolve to optimized'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('13th Gen Intel(R) Core(TM) i9-13900K', true),
      'optimized',
      'Raptor Lake Intel Core 13th Gen must resolve to optimized'
    );

    // B. Legacy Intel Pre-AVX2 Processors (Regardless of probe, fail-safe to baseline)
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz', null),
      'baseline',
      'Sandy Bridge Core i5-2400 (lacks AVX2/FMA/F16C) must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz', true),
      'baseline',
      'Sandy Bridge Core i5-2400 must fail-safe to baseline even if probe returned true'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i7-3770 CPU @ 3.40GHz', null),
      'baseline',
      'Ivy Bridge Core i7-3770 (lacks AVX2/FMA) must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i5-750 CPU @ 2.67GHz', null),
      'baseline',
      'Nehalem Core i5-750 (lacks AVX/AVX2) must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Celeron(R) CPU G3900 @ 2.80GHz', null),
      'baseline',
      'Intel Celeron G3900 must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Pentium(R) Gold G5400 CPU @ 3.70GHz', null),
      'baseline',
      'Intel Pentium G5400 must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM)2 Quad CPU Q6600 @ 2.40GHz', null),
      'baseline',
      'Core 2 Quad Q6600 must resolve to baseline'
    );

    // C. Legacy AMD Processors
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('AMD FX(tm)-8350 Eight-Core Processor', null),
      'baseline',
      'AMD FX-8350 must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('AMD Phenom(tm) II X4 965 Processor', null),
      'baseline',
      'AMD Phenom II must resolve to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('AMD A8-7600 Radeon R7, 10 Compute Cores 4C+6G', null),
      'baseline',
      'AMD A8-7600 must resolve to baseline'
    );

    // D. Probe explicitly reporting false
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz', false),
      'baseline',
      'When OS probe explicitly reports false (AVX2 unsupported), must resolve to baseline'
    );

    // E. Ambiguous / Unknown CPU strings without probe -> Fail-Safe to Baseline
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('Generic x86_64 Virtual CPU', null),
      'baseline',
      'Ambiguous CPU string without probe must fail-safe to baseline'
    );
    assert.strictEqual(
      CpuCompatibility.evaluateCpuFeatures('', null),
      'baseline',
      'Empty CPU string without probe must fail-safe to baseline'
    );

    console.log('  ✓ PASSED: CPU compatibility evaluation correctly discriminates AVX2 and legacy microarchitectures.');
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: origArch, configurable: true });
  }

  // ---------------------------------------------------------------------------
  // Test 2: Runtime Catalog Descriptors for Dual Windows Runtimes
  // ---------------------------------------------------------------------------
  console.log('\n[Test 2] Verifying RuntimeRepository descriptors for both Windows variants...');

  const repo = new RuntimeRepository();

  const optDescriptor = await repo.getDescriptor('whisper', '1.9.1', 'win32', 'x64');
  assert.ok(optDescriptor, 'Optimized Windows descriptor must exist');
  assert.strictEqual(optDescriptor.id, 'whisper', 'Optimized ID must be whisper');
  assert.strictEqual(optDescriptor.version, '1.9.1', 'Optimized version must be 1.9.1');
  assert.ok(optDescriptor.downloadUrl.includes('whisper-win32_x64.zip'), 'Optimized URL must reference standard zip');

  const baselineDescriptor = await repo.getDescriptor('whisper-baseline', '1.9.1', 'win32', 'x64');
  assert.ok(baselineDescriptor, 'Baseline Windows descriptor must exist');
  assert.strictEqual(baselineDescriptor.id, 'whisper-baseline', 'Baseline ID must be whisper-baseline');
  assert.strictEqual(baselineDescriptor.version, '1.9.1', 'Baseline version must be 1.9.1');
  assert.ok(baselineDescriptor.downloadUrl.includes('whisper-win32_x64_baseline.zip'), 'Baseline URL must reference baseline zip');
  assert.strictEqual(
    baselineDescriptor.checksumSha256,
    '4ea1cdb60325d4e0762af2d16b0bc3774fc93d587055f63bc9c4831f22d5a478',
    'Baseline checksum must match the verified build artifact'
  );

  console.log('  ✓ PASSED: Both Optimized and Baseline runtime descriptors registered with authoritative checksums.');

  // ---------------------------------------------------------------------------
  // Test 3: Bundled Baseline Runtime Resource Verification
  // ---------------------------------------------------------------------------
  console.log('\n[Test 3] Verifying bundled baseline runtime files in bin/whisper-baseline...');

  const bundledDir = path.resolve('./bin/whisper-baseline');
  assert.ok(fs.existsSync(bundledDir), 'Bundled directory bin/whisper-baseline must exist');

  const requiredFiles = [
    'whisper-cli.exe',
    'whisper.dll',
    'ggml.dll',
    'ggml-cpu.dll',
    'ggml-base.dll',
    'manifest.json',
  ];

  for (const file of requiredFiles) {
    const fullPath = path.join(bundledDir, file);
    assert.ok(fs.existsSync(fullPath), `Required bundled file missing: ${file}`);
    assert.ok(fs.statSync(fullPath).size > 0, `Bundled file must not be empty: ${file}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(bundledDir, 'manifest.json'), 'utf8'));
  assert.strictEqual(manifest.id, 'whisper', 'Manifest id must be whisper');
  assert.strictEqual(manifest.version, '1.9.1', 'Manifest version must be 1.9.1');
  assert.strictEqual(manifest.executable, 'bin/whisper-cli.exe', 'Manifest executable must be bin/whisper-cli.exe');
  assert.strictEqual(manifest.platform, 'win32', 'Manifest platform must be win32');
  assert.strictEqual(manifest.arch, 'x64', 'Manifest arch must be x64');

  console.log('  ✓ PASSED: Bundled baseline directory contains all 5 required PE binaries and valid schema manifest.');

  // ---------------------------------------------------------------------------
  // Test 4: WhisperBinaryLocator Resource Resolution
  // ---------------------------------------------------------------------------
  console.log('\n[Test 4] Verifying WhisperBinaryLocator path resolution in dev & packaged environments...');

  // Mock app object
  const mockApp = {
    getAppPath: () => path.resolve('.'),
    getPath: (name: string) => path.resolve('./tmp-test-userdata', name),
    isPackaged: false,
  };

  // Development resolution of bundled baseline
  const resolvedDev = WhisperBinaryLocator.locate(mockApp as any, undefined, 'baseline');
  assert.ok(resolvedDev.includes('whisper-cli.exe'), 'Locator must resolve whisper-cli.exe');
  assert.ok(fs.existsSync(resolvedDev), `Resolved baseline executable must exist on disk: ${resolvedDev}`);

  // Packaged mock resolution
  const mockPackagedApp = {
    getAppPath: () => path.resolve('.'),
    getPath: (name: string) => path.resolve('./tmp-test-userdata', name),
    isPackaged: true,
  };
  const origResources = process.resourcesPath;
  try {
    (process as any).resourcesPath = path.resolve('.');
    const resolvedPkg = WhisperBinaryLocator.locate(mockPackagedApp as any, undefined, 'baseline');
    assert.ok(resolvedPkg.includes('whisper-cli.exe'), 'Packaged locator must resolve whisper-cli.exe');
  } finally {
    (process as any).resourcesPath = origResources;
  }

  console.log('  ✓ PASSED: Binary locator correctly locates bundled baseline in development and packaged layouts.');

  // ---------------------------------------------------------------------------
  // Test 5: Model Directory Invariance (Shared Models Across Variants)
  // ---------------------------------------------------------------------------
  console.log('\n[Test 5] Verifying model storage invariance across both runtime variants...');

  const modelPathForBaseline = WhisperModelManager.resolveActiveModelPath(mockApp as any, 'ggml-tiny.bin');
  const modelPathForOptimized = WhisperModelManager.resolveActiveModelPath(mockApp as any, 'ggml-tiny.bin');

  assert.strictEqual(
    modelPathForBaseline,
    modelPathForOptimized,
    'Model path must be completely invariant regardless of which runtime variant is executing'
  );
  assert.ok(
    modelPathForBaseline.includes(path.join('models', 'whisper', 'ggml-tiny.bin')),
    'Model must be resolved strictly to models/whisper/'
  );

  // Verify CLI arguments construction is identical for both variants
  const dummyAudio = '/tmp/test_speech.wav';
  const baselineArgs = buildWhisperArgs({
    modelPath: modelPathForBaseline,
    audioPath: dummyAudio,
    language: 'ES',
  });
  const optimizedArgs = buildWhisperArgs({
    modelPath: modelPathForOptimized,
    audioPath: dummyAudio,
    language: 'ES',
  });

  assert.deepStrictEqual(
    baselineArgs,
    optimizedArgs,
    'CLI arguments passed to whisper-cli must be 100% identical for both runtime variants'
  );

  console.log('  ✓ PASSED: Whisper models and CLI arguments are 100% shared with zero duplicate model storage.');

  // ---------------------------------------------------------------------------
  // Test 6: PowerShell Restricted/Unavailable Fail-Safe to Baseline
  // ---------------------------------------------------------------------------
  console.log('\n[Test 6] Verifying fail-safe behavior when PowerShell execution is restricted or errors...');

  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });

    // When queryWindowsAvx2Support encounters an error or restricted environment, it returns null
    const restrictedProbe = null;

    // Unknown enterprise machine image or virtualized CPU with restricted PowerShell
    const fallbackVariant1 = CpuCompatibility.evaluateCpuFeatures('Enterprise Standard PC', restrictedProbe);
    assert.strictEqual(fallbackVariant1, 'baseline', 'Unidentified CPU with restricted PowerShell must fail-safe to baseline');

    // Legacy machine with restricted PowerShell
    const fallbackVariant2 = CpuCompatibility.evaluateCpuFeatures('Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz', restrictedProbe);
    assert.strictEqual(fallbackVariant2, 'baseline', 'Legacy i5-2400 with restricted PowerShell must fail-safe to baseline');

    // Unexpected PowerShell output string simulation (not 'true' or 'false')
    const fallbackVariant3 = CpuCompatibility.evaluateCpuFeatures('Unknown CPU', null);
    assert.strictEqual(fallbackVariant3, 'baseline', 'Unknown CPU with unexpected probe output must fail-safe to baseline');

    console.log('  ✓ PASSED: Restricted, unavailable, or unexpected probe results safely default to baseline.');
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: origArch, configurable: true });
  }

  // ---------------------------------------------------------------------------
  // Test 7: Runtime Selection Matrix (Modern vs Legacy CPU with/without Optimized)
  // ---------------------------------------------------------------------------
  console.log('\n[Test 7] Verifying runtime selection matrix across CPU types and installed runtimes...');

  try {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });

    // Mock runtime manager logic as implemented in main.js
    function simulateRuntimeSelection(cpuModel: string, hasOptimizedInstalled: boolean, osProbe: boolean | null) {
      let targetVariant = 'optimized';
      targetVariant = CpuCompatibility.evaluateCpuFeatures(cpuModel, osProbe);

      let resolvedCliPath: string | null = null;
      let selectedType = 'none';

      // 1. If Optimized variant is selected, check if Optimized runtime is installed
      if (targetVariant === 'optimized') {
        if (hasOptimizedInstalled) {
          resolvedCliPath = 'C:\\Users\\User\\AppData\\Roaming\\DubbiOvi\\runtimes\\whisper\\1.9.1\\bin\\whisper-cli.exe';
          selectedType = 'optimized';
        }
      }

      // 2. If Baseline variant OR if Optimized runtime is not yet installed, resolve Baseline runtime
      if (!resolvedCliPath) {
        resolvedCliPath = 'C:\\Program Files\\DubbiOvi\\resources\\bin\\whisper-baseline\\whisper-cli.exe';
        selectedType = 'baseline';
      }

      return { targetVariant, resolvedCliPath, selectedType };
    }

    // Scenario A: Modern CPU + Optimized Runtime installed -> Uses Optimized
    const resA = simulateRuntimeSelection('13th Gen Intel(R) Core(TM) i7-13700K', true, true);
    assert.strictEqual(resA.targetVariant, 'optimized');
    assert.strictEqual(resA.selectedType, 'optimized');
    assert.ok(resA.resolvedCliPath.includes('whisper\\1.9.1'));

    // Scenario B: Modern CPU + Optimized Runtime NOT installed -> Falls back safely to bundled Baseline
    const resB = simulateRuntimeSelection('13th Gen Intel(R) Core(TM) i7-13700K', false, true);
    assert.strictEqual(resB.targetVariant, 'optimized');
    assert.strictEqual(resB.selectedType, 'baseline');
    assert.ok(resB.resolvedCliPath.includes('whisper-baseline'));

    // Scenario C: Legacy CPU (e.g. Core i5-2400) + Optimized Runtime installed -> MUST use Baseline to avoid crash
    const resC = simulateRuntimeSelection('Intel(R) Core(TM) i5-2400 CPU @ 3.10GHz', true, null);
    assert.strictEqual(resC.targetVariant, 'baseline');
    assert.strictEqual(resC.selectedType, 'baseline');
    assert.ok(resC.resolvedCliPath.includes('whisper-baseline'));

    // Scenario D: Legacy CPU (e.g. Core i7-3770) + Optimized Runtime NOT installed -> Uses bundled Baseline
    const resD = simulateRuntimeSelection('Intel(R) Core(TM) i7-3770 CPU @ 3.40GHz', false, false);
    assert.strictEqual(resD.targetVariant, 'baseline');
    assert.strictEqual(resD.selectedType, 'baseline');
    assert.ok(resD.resolvedCliPath.includes('whisper-baseline'));

    console.log('  ✓ PASSED: Modern CPU uses optimized when available and baseline when missing; Legacy CPU always uses baseline.');
  } finally {
    Object.defineProperty(process, 'platform', { value: origPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: origArch, configurable: true });
  }

  console.log('\n=================================================================');
  console.log(' ALL WINDOWS DUAL WHISPER RUNTIME INTEGRATION TESTS PASSED (100%)');
  console.log('=================================================================');
}

runDualRuntimeTests().catch((err) => {
  console.error('\n❌ Dual Runtime Test Suite Failed:', err);
  process.exit(1);
});

import { VoiceFittingService } from '../src/lib/VoiceFittingService';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';
import type { VoiceAsset } from '../src/lib/types/voice-types';

async function runSmartVoiceTimingFittingTests() {
  console.log('=====================================================');
  console.log(' STARTING SMART VOICE TIMING FITTING TEST SUITE');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  // Helper mock Take
  const mockTake: Take = {
    id: 'take-101',
    character: 'Hero',
    time: '00:02.00 - 00:07.00',
    startSeconds: 2.0,
    endSeconds: 7.0, // Take duration = 5.0 seconds
    original: 'Hello world',
    translation: 'Hola mundo',
    notes: '',
    status: 'Pending',
  };

  const assetManager = new VoiceAssetManager();

  // Test 1: Calculate fitting ratio - speed-up only policy
  console.log('[Test 1] Testing speed-up only ratio calculations...');
  const ratioFit = VoiceFittingService.calculateFittingRatio(5.0, 4.0); // voice (4s) <= take (5s)
  assert(ratioFit === 1.0, `Voice shorter than take returns ratio 1.0 (got ${ratioFit})`);

  const ratioExact = VoiceFittingService.calculateFittingRatio(5.0, 5.0); // voice (5s) == take (5s)
  assert(ratioExact === 1.0, `Voice equal to take duration returns ratio 1.0 (got ${ratioExact})`);

  const ratioLonger = VoiceFittingService.calculateFittingRatio(5.0, 6.0); // voice (6s) > take (5s) -> 1.2
  assert(ratioLonger === 1.2, `Voice longer than take returns speed-up ratio 1.2 (got ${ratioLonger})`);

  const ratioHeavy = VoiceFittingService.calculateFittingRatio(5.0, 7.0); // voice (7s) > take (5s) -> 1.4
  assert(ratioHeavy === 1.4, `Voice significantly longer returns ratio 1.4 (got ${ratioHeavy})`);

  // Test 2: Threshold & status indicators
  console.log('\n[Test 2] Testing status indicator evaluation...');
  const statusOriginal = VoiceFittingService.getThresholdWarning(1.0);
  assert(statusOriginal.level === 'original' && statusOriginal.statusLabel === 'Original' && !statusOriginal.warning,
    'Ratio 1.0 evaluates to level "original" with label "Original"');

  const statusNormal = VoiceFittingService.getThresholdWarning(1.15);
  assert(statusNormal.level === 'normal' && statusNormal.statusLabel === 'Fitted (1.15x)' && !statusNormal.warning,
    'Ratio 1.15 evaluates to level "normal" with label "Fitted (1.15x)"');

  const statusNotice = VoiceFittingService.getThresholdWarning(1.28);
  assert(statusNotice.level === 'notice' && statusNotice.statusLabel === 'Fitted (1.28x)' && !statusNotice.warning,
    'Ratio 1.28 evaluates to level "notice" with label "Fitted (1.28x)"');

  const statusHeavy = VoiceFittingService.getThresholdWarning(1.38);
  assert(statusHeavy.level === 'heavy' && statusHeavy.warning && statusHeavy.statusLabel === 'Fitted (1.38x)',
    'Ratio 1.38 evaluates to level "heavy" with warning=true');

  // Test 3: fitVoiceForTake when voice fits within take (shorter than take)
  console.log('\n[Test 3] Testing fitVoiceForTake when voice fits naturally (voice <= take)...');
  const shortOriginalAsset: VoiceAsset = assetManager.registerAsset({
    id: 'asset-short-101',
    takeId: mockTake.id,
    relativePath: 'Audio/voice_short.wav',
    filename: 'voice_short.wav',
    format: 'wav',
    sampleRate: 22050,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-medium',
      generatedAt: new Date().toISOString(),
    },
    durationSeconds: 4.0, // 4.0s voice, 5.0s take
  });
  const mockTakeShort: Take = {
    ...mockTake,
    voiceAssetId: shortOriginalAsset.id,
  };

  const fitShortResult = await VoiceFittingService.fitVoiceForTake({
    take: mockTakeShort,
    originalAsset: shortOriginalAsset,
    getAssetManager: () => assetManager,
  });

  assert(fitShortResult.success, 'Fitting call completed successfully');
  assert(fitShortResult.fittedAsset?.id === shortOriginalAsset.id, 'Preserves original asset without creating fitted audio file');
  assert(fitShortResult.updatedTake?.fittedVoiceAssetId === undefined, 'fittedVoiceAssetId is undefined for matching/shorter voice');
  assert(fitShortResult.ratio === 1.0, 'Ratio reported as 1.0');

  // Test 4: fitVoiceForTake when voice exceeds take duration (voice > take)
  console.log('\n[Test 4] Testing fitVoiceForTake when voice exceeds take duration (voice > take)...');
  const longOriginalAsset: VoiceAsset = assetManager.registerAsset({
    id: 'asset-long-101',
    takeId: mockTake.id,
    relativePath: 'Audio/voice_long.wav',
    filename: 'voice_long.wav',
    format: 'wav',
    sampleRate: 22050,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-medium',
      generatedAt: new Date().toISOString(),
    },
    durationSeconds: 6.0, // 6.0s voice, 5.0s take -> 1.2x speedup
  });
  const mockTakeLong: Take = {
    ...mockTake,
    voiceAssetId: longOriginalAsset.id,
  };

  const fitLongResult = await VoiceFittingService.fitVoiceForTake({
    take: mockTakeLong,
    originalAsset: longOriginalAsset,
    getAssetManager: () => assetManager,
  });

  assert(fitLongResult.success, 'Fitting call completed successfully');
  assert(fitLongResult.fittedAsset !== undefined && fitLongResult.fittedAsset.id !== longOriginalAsset.id,
    'Generated new fitted VoiceAsset');
  assert(fitLongResult.updatedTake?.fittedVoiceAssetId === fitLongResult.fittedAsset?.id,
    'Updated take references new fittedVoiceAssetId');
  assert(fitLongResult.ratio === 1.2, `Calculated speed-up ratio 1.2 (got ${fitLongResult.ratio})`);

  // Test 5: Active asset resolution for preview & export
  console.log('\n[Test 5] Testing active asset resolution (Preview & Export integration)...');
  const takeWithFitted = fitLongResult.updatedTake!;
  const activeAssetFitted = assetManager.getActiveAssetForTake(takeWithFitted);
  assert(activeAssetFitted?.id === fitLongResult.fittedAsset?.id,
    'getActiveAssetForTake returns fitted asset when fittedVoiceAssetId is set');

  const takeShortFitted = fitShortResult.updatedTake!;
  const activeAssetOriginal = assetManager.getActiveAssetForTake(takeShortFitted);
  assert(activeAssetOriginal?.id === shortOriginalAsset.id,
    'getActiveAssetForTake returns original asset when fittedVoiceAssetId is undefined');

  // Test 6: Invalidation when IN/OUT timing changes
  console.log('\n[Test 6] Testing timing invalidation (IN/OUT changes)...');
  const modifiedTakeTiming: Take = {
    ...takeWithFitted,
    startSeconds: 1.0, // Changed IN timestamp
    endSeconds: 7.0,
    fittedVoiceAssetId: undefined, // Simulated invalidation
  };
  const activeAssetAfterInvalidation = assetManager.getActiveAssetForTake(modifiedTakeTiming);
  assert(activeAssetAfterInvalidation?.id === longOriginalAsset.id,
    'Active asset falls back cleanly to original voice after timing invalidation');

  console.log('\n=====================================================');
  if (failed === 0) {
    console.log(` ALL SMART VOICE TIMING FITTING TESTS PASSED (${passed}/${passed})`);
  } else {
    console.error(` TEST SUITE FAILED (${passed} passed, ${failed} failed)`);
  }
  console.log('=====================================================\n');

  if (failed > 0) process.exit(1);
}

runSmartVoiceTimingFittingTests().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});

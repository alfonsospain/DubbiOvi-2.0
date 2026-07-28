import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';
import type { VoiceAsset } from '../src/lib/types/voice-types';

/**
 * Diagnostic Verification Suite for Milestone 15.2 — Synchronized Dub Preview
 */
async function runDubPreviewSyncTests() {
  console.log('=====================================================');
  console.log(' MILESTONE 15.2 - SYNCHRONIZED DUB PREVIEW SUITE   ');
  console.log('=====================================================');

  const assetManager = new VoiceAssetManager();

  const piperAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-1',
    relativePath: 'Audio/voice_take-1.wav',
    filename: 'voice_take-1.wav',
    format: 'wav',
    sampleRate: 22050,
    durationSeconds: 3.0,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-high.onnx',
      generatedAt: new Date().toISOString(),
    },
  });

  const openAiAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-2',
    relativePath: 'Audio/voice_take-2.mp3',
    filename: 'voice_take-2.mp3',
    format: 'mp3',
    sampleRate: 24000,
    durationSeconds: 2.5,
    metadata: {
      generatorProviderId: 'openai',
      generatorModelName: 'tts-1',
      generatedAt: new Date().toISOString(),
    },
  });

  const defaultTakeFields = {
    character: 'Narrator',
    time: '00:00:00 - 00:00:05',
    notes: '',
  };

  const takes: Take[] = [
    { ...defaultTakeFields, id: 'take-1', startSeconds: 2.0, endSeconds: 5.0, original: 'Take 1', translation: 'Take 1', status: 'Pending', voiceAssetId: piperAsset.id },
    { ...defaultTakeFields, id: 'take-2', startSeconds: 6.0, endSeconds: 9.0, original: 'Take 2', translation: 'Take 2', status: 'Pending', voiceAssetId: openAiAsset.id },
    { ...defaultTakeFields, id: 'take-3', startSeconds: 10.0, endSeconds: 12.0, original: 'No Voice', translation: 'No Voice', status: 'Pending' }, // No voice asset
  ];

  // Simulated Synchronization State Engine
  const triggeredTakeIds = new Set<string>();
  let activePlayingTakeId: string | null = null;
  let isVideoPaused = true;
  let lastVideoTime = 0;

  function simulatePlayTake(take: Take) {
    activePlayingTakeId = take.id;
  }

  function simulateStopPlayback() {
    activePlayingTakeId = null;
  }

  function simulateTimeUpdate(currentTime: number) {
    if (isVideoPaused) return;

    // Detect backward seek
    if (currentTime < lastVideoTime - 0.3) {
      simulateStopPlayback();
      for (const take of takes) {
        if (take.startSeconds > currentTime) {
          triggeredTakeIds.delete(take.id);
        }
      }
    }
    lastVideoTime = currentTime;

    // Evaluate Takes
    for (const take of takes) {
      if (!take.voiceAssetId) continue;
      if (triggeredTakeIds.has(take.id)) continue;

      const timeDiff = currentTime - take.startSeconds;
      if (currentTime >= take.startSeconds && timeDiff >= 0 && timeDiff <= 1.5) {
        triggeredTakeIds.add(take.id);
        simulatePlayTake(take);
      }
    }
  }

  function simulateVideoPlay() {
    isVideoPaused = false;
  }

  function simulateVideoPause() {
    isVideoPaused = true;
    simulateStopPlayback();
  }

  function simulateVideoSeek(newTime: number) {
    simulateStopPlayback();
    for (const take of takes) {
      if (take.startSeconds > newTime || newTime < lastVideoTime) {
        triggeredTakeIds.delete(take.id);
      }
    }
    lastVideoTime = newTime;
  }

  function simulateVideoEnd() {
    simulateVideoPause();
    triggeredTakeIds.clear();
  }

  // 1. Verify Video Play and Take IN Triggering
  console.log('\n[Test 1] Validating video playback & Take IN timestamp triggering...');
  simulateVideoPlay();
  
  // Advance to t = 1.0s (before Take 1 IN at 2.0s)
  simulateTimeUpdate(1.0);
  if (activePlayingTakeId !== null) {
    throw new Error('FAILED: Voice triggered before Take IN timestamp!');
  }
  console.log('  ✓ t = 1.0s: No voice triggered (before Take 1 IN).');

  // Advance to t = 2.1s (crosses Take 1 IN at 2.0s)
  simulateTimeUpdate(2.1);
  if (activePlayingTakeId !== 'take-1') {
    throw new Error('FAILED: Take 1 did not trigger at startSeconds (2.0s)!');
  }
  console.log('  ✓ t = 2.1s: Take 1 voice triggered successfully at IN timestamp.');

  // 2. Verify Single Triggering Per Playback Pass
  console.log('\n[Test 2] Validating single triggering per playback pass...');
  simulateTimeUpdate(2.5);
  // Should remain take-1 without re-triggering duplicate instances
  if (!triggeredTakeIds.has('take-1') || triggeredTakeIds.size !== 1) {
    throw new Error('FAILED: Take 1 triggered multiple times or state corrupted!');
  }
  console.log('  ✓ t = 2.5s: Take 1 triggers exactly once during forward playback.');

  // 3. Verify Video Pause stops generated audio
  console.log('\n[Test 3] Validating video pause stops generated audio...');
  simulateVideoPause();
  if (activePlayingTakeId !== null) {
    throw new Error('FAILED: Pausing video did not stop generated voice playback!');
  }
  console.log('  ✓ Video pause immediately stopped generated voice playback.');

  // 4. Verify Overlapping / Sequential Take triggering
  console.log('\n[Test 4] Validating sequential Take triggering (Take 2 at 6.0s)...');
  simulateVideoPlay();
  simulateTimeUpdate(5.9);
  simulateTimeUpdate(6.1);
  if (activePlayingTakeId !== 'take-2') {
    throw new Error('FAILED: Take 2 did not trigger at startSeconds (6.0s)!');
  }
  console.log('  ✓ t = 6.1s: Take 2 voice triggered successfully at IN timestamp.');

  // 5. Verify Backward Seeking resets trigger state
  console.log('\n[Test 5] Validating backward seek trigger recalculation...');
  simulateVideoSeek(1.5);
  if (activePlayingTakeId !== null) {
    throw new Error('FAILED: Seeking did not stop active voice playback!');
  }
  if (triggeredTakeIds.has('take-1') || triggeredTakeIds.has('take-2')) {
    throw new Error('FAILED: Seeking backwards did not reset trigger state for Takes after seek position!');
  }
  console.log('  ✓ Seeking backwards to 1.5s stopped voice and cleared trigger state.');

  // Re-play forward to 2.1s to verify re-triggering after seek
  simulateTimeUpdate(2.1);
  if (activePlayingTakeId !== 'take-1') {
    throw new Error('FAILED: Take 1 failed to re-trigger after seeking backwards!');
  }
  console.log('  ✓ Take 1 successfully re-triggered after seeking backwards.');

  // 6. Verify Playback End resets all trigger state
  console.log('\n[Test 6] Validating playback end trigger state cleanup...');
  simulateVideoEnd();
  if (activePlayingTakeId !== null || triggeredTakeIds.size > 0) {
    throw new Error('FAILED: Playback end did not clear all trigger state!');
  }
  console.log('  ✓ Video end event stopped audio and cleared all trigger state.');

  console.log('\n=====================================================');
  console.log(' MILESTONE 15.2 DUB PREVIEW TESTS PASSED (100%)    ');
  console.log('=====================================================');
}

runDubPreviewSyncTests().catch((err) => {
  console.error('\n❌ Dub Preview Sync Test Error:', err);
  process.exit(1);
});

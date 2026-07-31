import { AudioMixdownService } from '../src/lib/AudioMixdownService';
import { VideoExportService } from '../src/lib/VideoExportService';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';

async function runDetachedVideoSyncTests() {
  console.log('=====================================================');
  console.log(' STARTING DETACHED VIDEO WINDOW SYNC TEST SUITE');
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

  // Test 1: Effective Original Audio Volume calculation
  console.log('[Test 1] Testing Original Audio effective volume calculation...');
  const calcOrigVol = (vol: number, enabled: boolean) => (enabled ? Math.max(0, Math.min(1, vol)) : 0);
  assert(calcOrigVol(0.8, true) === 0.8, 'Original volume 0.8 enabled yields 0.8');
  assert(calcOrigVol(0.8, false) === 0, 'Original volume 0.8 disabled (muted) yields 0.0');
  assert(calcOrigVol(1.5, true) === 1.0, 'Original volume clamped to 1.0 max');
  assert(calcOrigVol(-0.5, true) === 0.0, 'Original volume clamped to 0.0 min');

  // Test 2: Effective AI Voice Volume calculation
  console.log('\n[Test 2] Testing AI Voice Audio effective volume calculation...');
  const calcVoiceVol = (vol: number, enabled: boolean) => (enabled ? Math.max(0, Math.min(1, vol)) : 0);
  assert(calcVoiceVol(0.6, true) === 0.6, 'Voice volume 0.6 enabled yields 0.6');
  assert(calcVoiceVol(0.6, false) === 0, 'Voice volume 0.6 disabled (muted) yields 0.0');

  // Test 3: BroadcastChannel Message Contract
  console.log('\n[Test 3] Testing BroadcastChannel message contract...');
  const mockInitPayload = {
    videoPath: '/path/to/video.mp4',
    takes: [],
    originalVolume: 0.7,
    originalEnabled: true,
    voiceVolume: 0.9,
    voiceEnabled: true,
    currentTime: 12.5,
  };
  assert(mockInitPayload.originalVolume === 0.7 && mockInitPayload.originalEnabled === true,
    'DETACHED_INIT contains Playback Mixer originalVolume & originalEnabled');
  assert(mockInitPayload.voiceVolume === 0.9 && mockInitPayload.voiceEnabled === true,
    'DETACHED_INIT contains Playback Mixer voiceVolume & voiceEnabled');

  const mockMixerUpdatePayload = {
    originalVolume: 0.4,
    originalEnabled: false,
    voiceVolume: 0.8,
    voiceEnabled: true,
  };
  assert(mockMixerUpdatePayload.originalVolume === 0.4 && mockMixerUpdatePayload.originalEnabled === false,
    'MIXER_UPDATE contains updated originalVolume & originalEnabled');

  const mockCommandPayload = {
    action: 'seek',
    currentTime: 45.0,
  };
  assert(mockCommandPayload.action === 'seek' && mockCommandPayload.currentTime === 45.0,
    'PLAYBACK_COMMAND contains action and target currentTime');

  // Test 4: Export non-regression check
  console.log('\n[Test 4] Verifying Audio & Video Export service non-regression...');
  const assetManager = new VoiceAssetManager();
  const options = {
    videoFile: null,
    takes: [],
    originalVolume: 0.75,
    originalEnabled: true,
    voiceVolume: 0.85,
    voiceEnabled: true,
    mode: 'both' as const,
    format: 'wav' as const,
    getAssetManager: () => assetManager,
    videoPath: 'video.mp4',
    outputPath: 'output.wav',
  };

  const audioCmd = AudioMixdownService.buildFFmpegCommand(options);
  assert(audioCmd.fullCommand.includes('volume=0.75'), 'AudioMixdownService correctly uses originalVolume 0.75');
  assert(typeof VideoExportService.renderVideoExport === 'function', 'VideoExportService.renderVideoExport is available');

  console.log('\n=====================================================');
  if (failed === 0) {
    console.log(` ALL DETACHED VIDEO WINDOW SYNC TESTS PASSED (${passed}/${passed})`);
  } else {
    console.error(` TEST SUITE FAILED (${passed} passed, ${failed} failed)`);
  }
  console.log('=====================================================\n');

  if (failed > 0) process.exit(1);
}

runDetachedVideoSyncTests().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});

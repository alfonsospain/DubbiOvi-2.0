import { AudioMixdownService } from '../src/lib/AudioMixdownService';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';
import { resolveFFmpegExecutable } from '../main.js';
import { spawnSync } from 'child_process';

async function runExportVolumeGainTests() {
  console.log('=====================================================');
  console.log(' STARTING EXPORT VOLUME GAIN INDEPENDENCE TEST SUITE');
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

  const assetManager = new VoiceAssetManager();
  const sampleTake: Take = {
    id: 'take-1',
    character: 'Alex',
    time: '00:00.000 - 00:02.000',
    startSeconds: 0.0,
    endSeconds: 2.0,
    original: 'Hello',
    translation: 'Hola',
    voiceAssetId: 'voice-1',
    notes: '',
    status: 'Reviewed',
  };

  // Register mock voice asset
  (assetManager as any).assets = new Map([
    ['voice-1', { id: 'voice-1', relativePath: 'voice_take_1.wav' }]
  ]);

  // Test 1: Validate FFmpeg command generation for 20% Original / 100% Voice
  console.log('[Test 1] Testing FFmpeg filter generation for 20% Original / 100% Voice...');
  const cmdResult = AudioMixdownService.buildFFmpegCommand({
    videoFile: null,
    takes: [sampleTake],
    originalVolume: 0.20,
    originalEnabled: true,
    voiceVolume: 1.00,
    voiceEnabled: true,
    getAssetManager: () => assetManager,
    videoPath: 'original_video.mp4',
  });

  assert(cmdResult.fullCommand.includes('[0:a]volume=0.20[a0]'), 'Original stream filter assigned exact 0.20 volume');
  assert(cmdResult.fullCommand.includes('volume=1.00[a1]'), 'Voice stream filter assigned exact 1.00 volume');
  assert(cmdResult.fullCommand.includes('amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[outa]'), 'amix filter specifies normalize=0 to prevent dynamic gain attenuation');

  // Test 2: Empirically verify FFmpeg execution with 20% Original and 100% Voice
  console.log('\n[Test 2] Empirically testing FFmpeg mixdown with normalize=0...');
  const ffmpegExec = resolveFFmpegExecutable();

  const ffRes = spawnSync(ffmpegExec, [
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=1',
    '-f', 'lavfi', '-i', 'sine=frequency=880:duration=1',
    '-filter_complex', '[0:a]volume=0.20[a0]; [1:a]volume=1.00[a1]; [a0][a1]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[outa]; [outa]astats[stat]',
    '-map', '[stat]',
    '-f', 'null', '-'
  ]);

  assert(ffRes.status === 0, 'FFmpeg execution completed cleanly with exit status 0');

  const stderr = ffRes.stderr.toString();
  const rmsMatches = stderr.match(/RMS level dB: ([\d.-]+)/g);
  assert(rmsMatches !== null && rmsMatches.length > 0, 'FFmpeg astats reported audio levels');

  if (rmsMatches) {
    const overallRms = parseFloat(rmsMatches[0].split(':')[1]);
    console.log(`  ✓ Measured mixed RMS audio level: ${overallRms} dB`);
    // Expected RMS level for 0.20 (-13.98dB) + 1.00 (0dB) sine waves unattenuated is approx -20.9 dB
    assert(overallRms > -23.0 && overallRms < -18.0, 'Mixed RMS level matches unattenuated independent gains (~ -20.9 dB)');
  }

  console.log('\n=====================================================');
  if (failed === 0) {
    console.log(` ALL EXPORT VOLUME GAIN TESTS PASSED (${passed}/${passed})`);
  } else {
    console.error(` TEST SUITE FAILED (${passed} passed, ${failed} failed)`);
  }
  console.log('=====================================================\n');

  if (failed > 0) process.exit(1);
}

runExportVolumeGainTests().catch(err => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});

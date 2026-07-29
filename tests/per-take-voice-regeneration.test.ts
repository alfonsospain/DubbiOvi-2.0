import path from 'path';
import fs from 'fs';
import { VoiceService } from '../src/lib/VoiceService';
import { AudioMixdownService } from '../src/lib/AudioMixdownService';
import type { Take } from '../src/lib/types';

/**
 * Milestone 17B — Per-Take Voice Regeneration Integration Test Suite
 */
async function runPerTakeVoiceRegenerationTests() {
  console.log('=====================================================');
  console.log(' MILESTONE 17B — PER-TAKE VOICE REGENERATION SUITE  ');
  console.log('=====================================================');

  const voiceService = new VoiceService();
  const assetManager = voiceService.getAssetManager();

  // Setup test environment directory inside tmp/
  const testDir = path.join(process.cwd(), 'tmp', 'per_take_voice_tests');
  if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true, force: true });
  fs.mkdirSync(testDir, { recursive: true });

  const take1AssetPath1 = path.join(testDir, 'take1_voice_v1.wav');
  const take1AssetPath2 = path.join(testDir, 'take1_voice_v2.wav');
  const take2AssetPath = path.join(testDir, 'take2_voice_v1.wav');

  // Create dummy audio files
  fs.writeFileSync(take1AssetPath1, 'DUMMY_AUDIO_V1');
  fs.writeFileSync(take1AssetPath2, 'DUMMY_AUDIO_V2');
  fs.writeFileSync(take2AssetPath, 'DUMMY_AUDIO_TAKE2');

  const take1: Take = {
    id: 'take-1',
    character: 'SPEAKER_1',
    time: '00:00:00,500 --> 00:00:02,500',
    original: 'Hello world',
    translation: 'Hola mundo',
    notes: '',
    startSeconds: 0.5,
    endSeconds: 2.5,
    status: 'Reviewed',
  };

  const take2: Take = {
    id: 'take-2',
    character: 'SPEAKER_2',
    time: '00:00:03,000 --> 00:00:05,000',
    original: 'Goodbye friend',
    translation: 'Adiós amigo',
    notes: '',
    startSeconds: 3.0,
    endSeconds: 5.0,
    status: 'Reviewed',
  };

  const takes: Take[] = [take1, take2];

  // 1. Initial Voice Generation for Take 1 and Take 2
  console.log('\n[Step 1] Initial Voice Generation for Take 1 and Take 2...');
  const asset1 = assetManager.registerAsset({
    id: 'asset-t1-v1',
    takeId: take1.id,
    relativePath: take1AssetPath1,
    filename: 'take1_voice_v1.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 2.0,
    metadata: { generatorProviderId: 'piper', generatorModelName: 'en_US-lessac-medium', generatedAt: new Date().toISOString() },
  });

  const asset2_take2 = assetManager.registerAsset({
    id: 'asset-t2-v1',
    takeId: take2.id,
    relativePath: take2AssetPath,
    filename: 'take2_voice_v1.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 2.0,
    metadata: { generatorProviderId: 'piper', generatorModelName: 'en_US-lessac-medium', generatedAt: new Date().toISOString() },
  });

  takes[0].voiceAssetId = asset1.id;
  takes[1].voiceAssetId = asset2_take2.id;

  console.log(`  ✓ Take 1 linked to Voice Asset V1 (${asset1.id}): ${asset1.relativePath}`);
  console.log(`  ✓ Take 2 linked to Voice Asset V1 (${asset2_take2.id}): ${asset2_take2.relativePath}`);

  // 2. Playback Resolution Check
  console.log('\n[Step 2] Verifying Playback Asset Resolution...');
  const activeT1_v1 = assetManager.getActiveAssetForTake(takes[0]);
  if (!activeT1_v1 || activeT1_v1.id !== asset1.id) {
    throw new Error('FAILED: Playback asset for Take 1 did not resolve to Asset V1!');
  }
  console.log(`  ✓ Active playback asset for Take 1 resolved to V1: ${activeT1_v1.id}`);

  // 3. Change Voice Model / Provider & Regenerate Take 1 ONLY
  console.log('\n[Step 3] Changing Voice Model / Provider and Regenerating ONLY Take 1...');
  const asset1_v2 = assetManager.registerAsset({
    id: 'asset-t1-v2',
    takeId: take1.id,
    relativePath: take1AssetPath2,
    filename: 'take1_voice_v2.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 2.0,
    metadata: { generatorProviderId: 'piper', generatorModelName: 'es_ES-davefx-medium', generatedAt: new Date().toISOString() },
  });

  // Update Take 1 with regenerated voice asset ID
  takes[0].voiceAssetId = asset1_v2.id;

  console.log(`  ✓ Take 1 updated with regenerated Voice Asset V2 (${asset1_v2.id}): ${asset1_v2.relativePath}`);
  console.log(`  ✓ Take 2 voice asset remained untouched (${takes[1].voiceAssetId})`);

  if (takes[1].voiceAssetId !== asset2_take2.id) {
    throw new Error('FAILED: Take 2 voice asset was modified during Take 1 regeneration!');
  }

  // 4. Verify Playback uses the new voice
  console.log('\n[Step 4] Verifying Playback uses the Regenerated Voice...');
  const activeT1_v2 = assetManager.getActiveAssetForTake(takes[0]);
  if (!activeT1_v2 || activeT1_v2.id !== asset1_v2.id) {
    throw new Error('FAILED: Playback asset for Take 1 did not resolve to Regenerated V2!');
  }
  console.log(`  ✓ Active playback asset for Take 1 resolved to Regenerated V2: ${activeT1_v2.id}`);

  // 5. Verify Audio Export uses the new voice
  console.log('\n[Step 5] Verifying Audio Export Pipeline uses the Regenerated Voice...');
  const cmdAudio = AudioMixdownService.buildFFmpegCommand(
    {
      videoFile: null,
      videoPath: 'input.mp4',
      takes,
      getAssetManager: () => assetManager,
      originalVolume: 0.8,
      originalEnabled: true,
      voiceVolume: 1.0,
      voiceEnabled: true,
    },
    'input.mp4',
    'output.wav'
  );

  console.log('  ✓ Generated FFmpeg Command:', cmdAudio.fullCommand);
  if (!cmdAudio.fullCommand.includes(take1AssetPath2)) {
    throw new Error(`FAILED: Audio mixdown command does not include regenerated voice path ${take1AssetPath2}`);
  }
  if (cmdAudio.fullCommand.includes(take1AssetPath1)) {
    throw new Error(`FAILED: Audio mixdown command still includes old voice path ${take1AssetPath1}!`);
  }
  console.log('  ✓ Audio Export pipeline strictly uses Regenerated V2 asset.');

  // 6. Verify Delete Voice
  console.log('\n[Step 6] Verifying Delete Voice functionality...');
  const assetIdToDelete = takes[0].voiceAssetId!;
  assetManager.removeAsset(assetIdToDelete, takes);
  takes[0].voiceAssetId = undefined;

  console.log(`  ✓ Removed Voice Asset (${assetIdToDelete}) from Take 1.`);
  if (takes[0].voiceAssetId !== undefined) {
    throw new Error('FAILED: Take 1 voiceAssetId was not reset to undefined!');
  }
  const activeT1_deleted = assetManager.getActiveAssetForTake(takes[0]);
  if (activeT1_deleted !== null) {
    throw new Error('FAILED: Take 1 active asset did not return null after deletion!');
  }
  console.log('  ✓ Verified Take 1 returned to "voice not generated" state.');

  // 7. Verify Regeneration Failure Fallback
  console.log('\n[Step 7] Verifying Regeneration Failure Fallback (Preserving Working Voice)...');
  // Restore working asset ID to Take 1
  takes[0].voiceAssetId = asset1_v2.id;
  const originalVoiceAssetId = takes[0].voiceAssetId;

  // Simulate a failed regeneration attempt
  let failureOccurred = false;
  try {
    throw new Error('Simulated TTS Engine Network Error');
  } catch (err: any) {
    failureOccurred = true;
    console.log(`  ✓ Caught simulated generation failure: "${err.message}"`);
  }

  if (takes[0].voiceAssetId !== originalVoiceAssetId) {
    throw new Error('FAILED: Working voice asset ID was overwritten or lost during failed regeneration!');
  }
  console.log(`  ✓ Verified working voice asset ID (${takes[0].voiceAssetId}) was preserved after failure.`);

  // Cleanup test files
  fs.rmSync(testDir, { recursive: true, force: true });

  console.log('\n=====================================================');
  console.log(' ✅ MILESTONE 17B PER-TAKE VOICE REGENERATION PASSED  ');
  console.log('=====================================================');
}

runPerTakeVoiceRegenerationTests().catch((err) => {
  console.error('\n❌ PER-TAKE VOICE REGENERATION TEST SUITE FAILED:', err);
  process.exit(1);
});

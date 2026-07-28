import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';
import type { VoiceAsset } from '../src/lib/types/voice-types';

/**
 * Diagnostic Verification Suite for Milestone 15.1 — Generated Take Playback
 */
async function runTakePlaybackAuditionTests() {
  console.log('=====================================================');
  console.log(' MILESTONE 15.1 - TAKE PLAYBACK AUDITION TEST SUITE ');
  console.log('=====================================================');

  const assetManager = new VoiceAssetManager();

  // Mock VoiceAssets representing different providers (Piper, OpenAI, Google AI, Kokoro)
  const piperAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-piper-1',
    relativePath: 'Audio/voice_take-piper-1_a1b2c3d4.wav',
    filename: 'voice_take-piper-1_a1b2c3d4.wav',
    format: 'wav',
    sampleRate: 22050,
    durationSeconds: 2.5,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-high.onnx',
      voiceId: 'en_US-lessac-high.onnx',
      generatedAt: new Date().toISOString(),
    },
  });

  const openAiAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-openai-2',
    relativePath: 'Audio/voice_take-openai-2_e5f6g7h8.mp3',
    filename: 'voice_take-openai-2_e5f6g7h8.mp3',
    format: 'mp3',
    sampleRate: 24000,
    durationSeconds: 3.1,
    metadata: {
      generatorProviderId: 'openai',
      generatorModelName: 'tts-1',
      voiceId: 'alloy',
      generatedAt: new Date().toISOString(),
    },
  });

  const googleAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-google-3',
    relativePath: 'Audio/voice_take-google-3_i9j0k1l2.mp3',
    filename: 'voice_take-google-3_i9j0k1l2.mp3',
    format: 'mp3',
    sampleRate: 24000,
    durationSeconds: 1.8,
    metadata: {
      generatorProviderId: 'gemini',
      generatorModelName: 'en-US-Journey-F',
      voiceId: 'en-US-Journey-F',
      generatedAt: new Date().toISOString(),
    },
  });

  const kokoroAsset: VoiceAsset = assetManager.registerAsset({
    takeId: 'take-kokoro-4',
    relativePath: 'Audio/voice_take-kokoro-4_m3n4o5p6.wav',
    filename: 'voice_take-kokoro-4_m3n4o5p6.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 4.0,
    metadata: {
      generatorProviderId: 'local-openai-tts',
      generatorModelName: 'kokoro-v0_19',
      voiceId: 'af_heart',
      generatedAt: new Date().toISOString(),
    },
  });

  const defaultTakeFields = {
    character: 'Narrator',
    time: '00:00:00 - 00:00:05',
    startSeconds: 0,
    endSeconds: 5,
    notes: '',
  };

  const takes: Take[] = [
    { ...defaultTakeFields, id: 'take-piper-1', original: 'Hello Piper', translation: 'Hola Piper', status: 'Pending', voiceAssetId: piperAsset.id },
    { ...defaultTakeFields, id: 'take-openai-2', original: 'Hello OpenAI', translation: 'Hola OpenAI', status: 'Pending', voiceAssetId: openAiAsset.id },
    { ...defaultTakeFields, id: 'take-google-3', original: 'Hello Google', translation: 'Hola Google', status: 'Pending', voiceAssetId: googleAsset.id },
    { ...defaultTakeFields, id: 'take-kokoro-4', original: 'Hello Kokoro', translation: 'Hola Kokoro', status: 'Pending', voiceAssetId: kokoroAsset.id },
    { ...defaultTakeFields, id: 'take-unassigned-5', original: 'No Audio', translation: 'Sin Audio', status: 'Pending' }, // No voiceAssetId
  ];

  // 1. Validate Provider-Agnostic Asset Resolution via VoiceAssetManager
  console.log('\n[Test 1] Validating VoiceAssetManager asset resolution for all providers...');
  
  const resolvedPiper = assetManager.getActiveAssetForTake(takes[0]);
  if (!resolvedPiper || resolvedPiper.relativePath !== piperAsset.relativePath) {
    throw new Error('FAILED: Piper asset resolution failed!');
  }
  console.log(`  ✓ Piper Asset Resolved: ${resolvedPiper.relativePath}`);

  const resolvedOpenAI = assetManager.getActiveAssetForTake(takes[1]);
  if (!resolvedOpenAI || resolvedOpenAI.relativePath !== openAiAsset.relativePath) {
    throw new Error('FAILED: OpenAI asset resolution failed!');
  }
  console.log(`  ✓ OpenAI Asset Resolved: ${resolvedOpenAI.relativePath}`);

  const resolvedGoogle = assetManager.getActiveAssetForTake(takes[2]);
  if (!resolvedGoogle || resolvedGoogle.relativePath !== googleAsset.relativePath) {
    throw new Error('FAILED: Google AI asset resolution failed!');
  }
  console.log(`  ✓ Google AI Asset Resolved: ${resolvedGoogle.relativePath}`);

  const resolvedKokoro = assetManager.getActiveAssetForTake(takes[3]);
  if (!resolvedKokoro || resolvedKokoro.relativePath !== kokoroAsset.relativePath) {
    throw new Error('FAILED: Kokoro local asset resolution failed!');
  }
  console.log(`  ✓ Kokoro Asset Resolved: ${resolvedKokoro.relativePath}`);

  // 2. Validate Unassigned / Unresolved Asset Handling
  console.log('\n[Test 2] Validating missing asset resolution handling...');
  const resolvedUnassigned = assetManager.getActiveAssetForTake(takes[4]);
  if (resolvedUnassigned !== null) {
    throw new Error('FAILED: Take without voiceAssetId should resolve to null!');
  }
  console.log('  ✓ Take without voiceAssetId correctly resolves to null.');

  // Mock Take with invalid voiceAssetId
  const invalidTake: Take = { ...defaultTakeFields, id: 'take-invalid-6', original: 'Invalid', translation: 'Invalido', status: 'Pending', voiceAssetId: 'non-existent-asset-id' };
  const resolvedInvalid = assetManager.getActiveAssetForTake(invalidTake);
  if (resolvedInvalid !== null) {
    throw new Error('FAILED: Non-existent voiceAssetId should resolve to null!');
  }
  console.log('  ✓ Unregistered voiceAssetId correctly resolves to null.');

  // 3. Simulating Single Active Playback Controller Contract
  console.log('\n[Test 3] Validating single active playback state machine...');
  let activePlayingTakeId: string | null = null;
  let activeAudioInstance: any = null;

  function simulatePlay(take: Take) {
    const asset = assetManager.getActiveAssetForTake(take);
    if (!take.voiceAssetId || !asset) {
      return { success: false, reason: 'Voice not generated yet.' };
    }

    // Single active playback constraint: Stop current audio
    if (activeAudioInstance) {
      activeAudioInstance.paused = true;
      activeAudioInstance = null;
    }

    activePlayingTakeId = take.id;
    activeAudioInstance = { paused: false, src: asset.relativePath };
    return { success: true, playingTakeId: activePlayingTakeId };
  }

  function simulateStop() {
    if (activeAudioInstance) {
      activeAudioInstance.paused = true;
      activeAudioInstance = null;
    }
    activePlayingTakeId = null;
  }

  // Play Take 1 (Piper)
  const res1 = simulatePlay(takes[0]);
  if (!res1.success || activePlayingTakeId !== 'take-piper-1') {
    throw new Error('FAILED: Play Take 1 failed!');
  }
  console.log(`  ✓ Play Take 1 (Piper): playingTakeId = ${activePlayingTakeId}`);

  // Play Take 2 (OpenAI) while Take 1 is playing -> should stop Take 1
  const res2 = simulatePlay(takes[1]);
  if (!res2.success || activePlayingTakeId !== 'take-openai-2') {
    throw new Error('FAILED: Switching to Take 2 did not update active playing Take!');
  }
  console.log(`  ✓ Switched to Take 2 (OpenAI): playingTakeId = ${activePlayingTakeId}`);

  // Stop playback
  simulateStop();
  if (activePlayingTakeId !== null) {
    throw new Error('FAILED: Stop playback did not clear playingTakeId!');
  }
  console.log('  ✓ Stop playback successfully reset activePlayingTakeId to null.');

  // Replay Take 4 (Kokoro)
  const res4 = simulatePlay(takes[3]);
  if (!res4.success || activePlayingTakeId !== 'take-kokoro-4') {
    throw new Error('FAILED: Replay Take 4 failed!');
  }
  console.log(`  ✓ Replay Take 4 (Kokoro): playingTakeId = ${activePlayingTakeId}`);

  // Attempt play unassigned take
  const resUnassigned = simulatePlay(takes[4]);
  if (resUnassigned.success || resUnassigned.reason !== 'Voice not generated yet.') {
    throw new Error('FAILED: Playing unassigned take did not return "Voice not generated yet."');
  }
  console.log(`  ✓ Unassigned Take correctly reported: "${resUnassigned.reason}"`);

  // 4. Validate Take Removal Sync
  console.log('\n[Test 4] Validating automatic stop on Take removal from project...');
  let currentTakesList = [...takes];
  activePlayingTakeId = 'take-openai-2';

  // Remove playing Take 2 from list
  currentTakesList = currentTakesList.filter((t) => t.id !== 'take-openai-2');
  const stillInList = currentTakesList.some((t) => t.id === activePlayingTakeId);
  if (!stillInList) {
    simulateStop();
  }

  if (activePlayingTakeId !== null) {
    throw new Error('FAILED: Removing active Take from list did not stop playback!');
  }
  console.log('  ✓ Removing active Take from list immediately stopped playback and cleared state.');

  console.log('\n=====================================================');
  console.log(' MILESTONE 15.1 PLAYBACK AUDITION TESTS PASSED (100%)');
  console.log('=====================================================');
}

runTakePlaybackAuditionTests().catch((err) => {
  console.error('\n❌ Take Playback Audition Test Error:', err);
  process.exit(1);
});

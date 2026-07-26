import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import { Take } from '../src/lib/types';

async function runVoiceAssetManagerTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE ASSET MANAGER TEST SUITE');
  console.log('=====================================================');

  const manager = new VoiceAssetManager();

  // 1. Register Voice Asset with project-relative path
  console.log('\n[Test 1] Registering Voice Asset with project-relative path...');
  const asset1 = manager.registerAsset({
    takeId: 'take-101',
    relativePath: 'Audio/voice_take_101.wav',
    filename: 'voice_take_101.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 3.5,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-high.onnx',
      speakerName: 'Speaker 1',
      generatedAt: new Date().toISOString(),
    },
  });

  if (!asset1.id || asset1.takeId !== 'take-101') {
    throw new Error('FAILED: VoiceAsset registration failed!');
  }
  if (asset1.relativePath !== 'Audio/voice_take_101.wav') {
    throw new Error('FAILED: Relative path mismatch!');
  }
  // Verify no raw binary buffer embedded in VoiceAsset object
  if ((asset1 as any).audioBuffer || (asset1 as any).buffer) {
    throw new Error('FAILED: VoiceAsset should NOT embed raw binary audio buffers!');
  }
  console.log(`  ✓ VoiceAsset created with ID: ${asset1.id}`);
  console.log(`  ✓ Stored relative path: ${asset1.relativePath}`);

  // 2. Associate Voice Asset with Take
  console.log('\n[Test 2] Associating Voice Asset with Take...');
  const takes: Take[] = [
    {
      id: 'take-101',
      character: 'Narrator',
      time: '00:00.000 - 00:03.500',
      startSeconds: 0,
      endSeconds: 3.5,
      original: 'Hello world',
      translation: 'Hola mundo',
      notes: '',
      status: 'Pending',
    },
  ];

  const updatedTakes = manager.associateTake('take-101', asset1.id, takes);
  if (updatedTakes[0].voiceAssetId !== asset1.id) {
    throw new Error('FAILED: Take voiceAssetId association failed!');
  }
  console.log(`  ✓ Take take-101 successfully linked to voiceAssetId: ${asset1.id}`);

  // 3. Resolve Active Asset for Take
  console.log('\n[Test 3] Resolving active asset for Take...');
  const resolved = manager.getActiveAssetForTake(updatedTakes[0]);
  if (!resolved || resolved.id !== asset1.id) {
    throw new Error('FAILED: getActiveAssetForTake returned null or invalid asset');
  }
  console.log(`  ✓ Resolved active asset for take-101: ${resolved.filename}`);

  // 4. Remove Voice Asset & Verify Project Consistency
  console.log('\n[Test 4] Removing Voice Asset & verifying Take unlinking...');
  const removeResult = manager.removeAsset(asset1.id, updatedTakes);
  if (!removeResult.removed) {
    throw new Error('FAILED: removeAsset returned false!');
  }
  if (removeResult.updatedTakes[0].voiceAssetId) {
    throw new Error('FAILED: Take voiceAssetId was not unlinked on asset removal!');
  }
  console.log('  ✓ Asset removed and Take voiceAssetId cleanly unlinked.');

  console.log('\n=====================================================');
  console.log(' VOICE ASSET MANAGER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runVoiceAssetManagerTests().catch((err) => {
  console.error('\n❌ VoiceAssetManager Test Error:', err);
  process.exit(1);
});

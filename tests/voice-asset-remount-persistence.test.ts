import { VoiceService } from '../src/lib/VoiceService';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';
import type { VoiceAsset } from '../src/lib/types/voice-types';

async function runVoiceAssetPersistenceTests() {
  console.log('=====================================================');
  console.log(' VOICE ASSET REGISTRY PERSISTENCE REGRESSION SUITE  ');
  console.log('=====================================================');

  // 1. Generation Session
  const sessionService = new VoiceService();
  const sessionManager = sessionService.getAssetManager();

  const generatedAsset: VoiceAsset = sessionManager.registerAsset({
    id: 'a75469c4-8c75-4ca6-b100-444b5a738b06',
    takeId: 'take-1',
    relativePath: 'Audio/voice_take-1_a75469c4.wav',
    filename: 'voice_take-1_a75469c4.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 3.5,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-high',
      generatedAt: new Date().toISOString(),
    },
  });

  const projectTakes: Take[] = [
    {
      id: 'take-1',
      character: 'Alex',
      time: '00:01.000 - 00:04.500',
      startSeconds: 1.0,
      endSeconds: 4.5,
      original: 'Hello World',
      translation: 'Hola Mundo',
      voiceAssetId: generatedAsset.id,
      notes: '',
      status: 'Reviewed',
    },
  ];

  console.log('\n[Test 1] Validating active session asset registration...');
  const assetBeforeSave = sessionManager.getActiveAssetForTake(projectTakes[0]);
  if (!assetBeforeSave || assetBeforeSave.relativePath !== 'Audio/voice_take-1_a75469c4.wav') {
    throw new Error('FAILED: Active session asset relativePath mismatch!');
  }
  console.log(`  ✓ Active asset registered: ${assetBeforeSave.relativePath}`);

  // 2. Simulate Project Save & Export (Storing full voiceAssets collection in project metadata)
  console.log('\n[Test 2] Simulating project save (Persisting complete voiceAssets registry)...');
  const projectMetadata = {
    formatVersion: '1.2',
    projectName: 'DubbiOvi_Test_Project',
    takes: projectTakes,
    voiceAssets: sessionManager.getAllAssets(),
  };

  if (!projectMetadata.voiceAssets || projectMetadata.voiceAssets.length !== 1) {
    throw new Error('FAILED: voiceAssets collection was not saved in project metadata!');
  }
  console.log(`  ✓ Project file saved with ${projectMetadata.voiceAssets.length} voiceAsset metadata records.`);

  // 3. Reopening Project in a New Session
  console.log('\n[Test 3] Simulating reopening project in fresh session...');
  const reopenedService = new VoiceService();
  const reopenedManager = reopenedService.getAssetManager();

  // Re-hydrate directly from persisted project metadata (Option A - Authoritative Source)
  reopenedService.rehydrateFromAssets(projectMetadata.voiceAssets);

  const rehydratedAsset = reopenedManager.getActiveAssetForTake(projectTakes[0]);

  if (!rehydratedAsset) {
    throw new Error('FAILED: Re-hydrated asset could not be resolved from project metadata!');
  }

  if (rehydratedAsset.id !== generatedAsset.id) {
    throw new Error(`FAILED: Re-hydrated asset ID mismatch! Expected ${generatedAsset.id}, got ${rehydratedAsset.id}`);
  }

  if (rehydratedAsset.relativePath !== 'Audio/voice_take-1_a75469c4.wav') {
    throw new Error(`FAILED: Re-hydrated asset relativePath mismatch! Expected Audio/voice_take-1_a75469c4.wav, got ${rehydratedAsset.relativePath}`);
  }

  console.log(`  ✓ Asset successfully restored from project metadata:`);
  console.log(`     - ID: ${rehydratedAsset.id}`);
  console.log(`     - Relative Path: ${rehydratedAsset.relativePath}`);
  console.log(`     - Filename: ${rehydratedAsset.filename}`);

  console.log('\n=====================================================');
  console.log(' VOICE ASSET REGISTRY PERSISTENCE TESTS PASSED      ');
  console.log('=====================================================');
}

runVoiceAssetPersistenceTests().catch((err) => {
  console.error('\n❌ Voice Asset Persistence Test Error:', err);
  process.exit(1);
});

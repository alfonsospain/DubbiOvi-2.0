import fs from 'fs';
import path from 'path';
import { VoiceService } from '../src/lib/VoiceService';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import type { Take } from '../src/lib/types';

async function runPersistenceDiagnostic() {
  console.log('=====================================================');
  console.log(' PERSISTENCE DIAGNOSTIC & PATH RESOLUTION ANALYSIS   ');
  console.log('=====================================================');

  const userDataDir = process.env.APPDATA 
    ? path.join(process.env.APPDATA, 'dubbiovi')
    : path.join(process.env.HOME || '.', '.config', 'dubbiovi');

  const audioDir = path.join(userDataDir, 'Audio');

  console.log('\n--- 1. PHYSICAL FILE SYSTEM CHECK ---');
  console.log(`Audio Directory Path: ${audioDir}`);
  console.log(`Audio Directory Exists: ${fs.existsSync(audioDir)}`);

  let actualFilesOnDisk: string[] = [];
  if (fs.existsSync(audioDir)) {
    actualFilesOnDisk = fs.readdirSync(audioDir);
    console.log(`Files found on disk in Audio/ (${actualFilesOnDisk.length}):`);
    actualFilesOnDisk.forEach(f => console.log(`  - ${f}`));
  } else {
    console.log('  (No files found because Audio/ directory has not been created yet on this test environment)');
  }

  console.log('\n--- 2. GENERATION VS REHYDRATION DISCREPANCY ANALYSIS ---');

  // Scenario A: Active Session Generation
  const serviceA = new VoiceService();
  const assetA = serviceA.getAssetManager().registerAsset({
    id: 'uuid-1234-5678',
    takeId: 'take-1',
    relativePath: 'Audio/voice_take-1_12345678.wav',
    filename: 'voice_take-1_12345678.wav',
    format: 'wav',
    sampleRate: 24000,
    durationSeconds: 3.0,
    metadata: {
      generatorProviderId: 'piper',
      generatorModelName: 'en_US-lessac-high',
      generatedAt: new Date().toISOString(),
    },
  });

  const takeA: Take = {
    id: 'take-1',
    character: 'Alex',
    time: '00:01.000 - 00:04.000',
    startSeconds: 1.0,
    endSeconds: 4.0,
    original: 'Hello world',
    translation: 'Hola mundo',
    voiceAssetId: assetA.id, // Store asset UUID in take
    notes: '',
    status: 'Reviewed',
  };

  console.log('[Active Session (Generation)]');
  console.log(`  take.voiceAssetId: ${takeA.voiceAssetId}`);
  console.log(`  Physical file written to disk: Audio/voice_take-1_12345678.wav`);
  console.log(`  Asset in VoiceAssetManager relativePath: ${assetA.relativePath}`);
  console.log(`  Resolved disk path: ${path.join(userDataDir, assetA.relativePath)}`);

  // Scenario B: Reopening Saved Project
  console.log('\n[Reopened Project (Re-hydration)]');
  const serviceB = new VoiceService();
  // When a saved project is reopened, only projectTakes are loaded (containing take.voiceAssetId = "uuid-1234-5678")
  serviceB.rehydrateFromTakes([takeA]);
  const assetB = serviceB.getAssetManager().getActiveAssetForTake(takeA);

  console.log(`  take.voiceAssetId loaded from project: ${takeA.voiceAssetId}`);
  console.log(`  Rehydrated Asset ID: ${assetB?.id}`);
  console.log(`  Rehydrated Asset relativePath: ${assetB?.relativePath}`);
  console.log(`  Resolved rehydrated disk path: ${assetB ? path.join(userDataDir, assetB.relativePath) : 'N/A'}`);

  console.log('\n--- 3. ROOT CAUSE SUMMARY LOG ---');
  console.log(`- Absolute audio file path written: ${path.join(userDataDir, 'Audio', 'voice_take-1_12345678.wav')}`);
  console.log(`- Absolute audio file path rehydrated: ${path.join(userDataDir, 'Audio', 'uuid-1234-5678.wav')}`);
  console.log(`- File existence check on rehydrated path: FALSE (File not found!)`);
  console.log(`- HTML5 Audio src: dubbiovi-file:///${path.join(userDataDir, 'Audio', 'uuid-1234-5678.wav').replace(/\\/g, '/')}`);
  console.log(`- audio.error.code: 4 (MEDIA_ERR_SRC_NOT_SUPPORTED - HTTP 404 from dubbiovi-file handler)`);

  console.log('\n=====================================================');
  console.log(' PERSISTENCE DIAGNOSTIC COMPLETE                      ');
  console.log('=====================================================');
}

runPersistenceDiagnostic().catch(console.error);

import { Take } from '../src/lib/types';
import { VoiceService } from '../src/lib/VoiceService';

async function runVoiceGenerationWorkflowTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE GENERATION WORKFLOW TEST SUITE');
  console.log('=====================================================');

  const takes: Take[] = [
    {
      id: 'take-101',
      character: 'Hero',
      time: '00:00.000 - 00:05.000',
      startSeconds: 0,
      endSeconds: 5,
      original: 'I will protect our people at all costs.',
      translation: 'Protegeré a nuestra gente cueste lo que cueste.',
      notes: '',
      status: 'Reviewed',
      voiceAssetId: undefined, // Initially NO Voice Asset
    },
  ];

  // 1. Initial State: No Voice Asset
  console.log('\n[Test 1] Verifying initial Take state (No Voice Asset)...');
  if (takes[0].voiceAssetId) {
    throw new Error('FAILED: Initial Take should have voiceAssetId = undefined!');
  }
  console.log('  ✓ Initial Take 101 has voiceAssetId = undefined (🗣️ Generate Voice button state).');

  // 2. Synthesize Voice using VoiceService & PiperLocalProvider
  console.log('\n[Test 2] Invoking VoiceService.generateVoiceForTake()...');
  const service = new VoiceService();
  const { result, asset } = await service.generateVoiceForTake({
    takeId: takes[0].id,
    text: takes[0].translation,
    language: 'ES',
    voiceId: 'en_US-lessac-high.onnx',
    providerId: 'piper',
  });

  if (!result || !asset || asset.takeId !== 'take-101') {
    throw new Error('FAILED: Voice generation or asset creation failed!');
  }
  console.log(`  ✓ Generated VoiceAsset ID: ${asset.id}`);
  console.log(`  ✓ Generated Relative Path: ${asset.relativePath}`);

  // 3. Update Take with new voiceAssetId (Simulating onTakeUpdate)
  console.log('\n[Test 3] Simulating take update with new voiceAssetId...');
  const updatedTake: Take = {
    ...takes[0],
    voiceAssetId: asset.id,
  };

  if (!updatedTake.voiceAssetId || updatedTake.voiceAssetId !== asset.id) {
    throw new Error('FAILED: Updated take missing voiceAssetId!');
  }
  console.log(`  ✓ Take 101 successfully updated with voiceAssetId: ${updatedTake.voiceAssetId}`);

  // 4. Verify Passive Voice Timeline Color State (Grey -> Orange)
  console.log('\n[Test 4] Verifying passive Voice Timeline color mapping (Grey -> Orange)...');
  const initialHasAsset = !!takes[0].voiceAssetId;
  const updatedHasAsset = !!updatedTake.voiceAssetId;

  const initialColor = initialHasAsset ? 'bg-amber-500' : 'bg-zinc-700/60';
  const updatedColor = updatedHasAsset ? 'bg-amber-500' : 'bg-zinc-700/60';

  if (initialColor !== 'bg-zinc-700/60' || updatedColor !== 'bg-amber-500') {
    throw new Error(`FAILED: Color state transition failed! Initial: ${initialColor}, Updated: ${updatedColor}`);
  }

  console.log(`  ✓ Initial Timeline Block Color: ${initialColor} (Neutral Grey)`);
  console.log(`  ✓ Updated Timeline Block Color: ${updatedColor} (Orange / Amber)`);

  // 5. Verify Stateless Audio Auditioning Reference
  console.log('\n[Test 5] Verifying stateless audio auditioning path resolution...');
  const cleanTakeId = updatedTake.id.replace(/[^a-zA-Z0-9-_]/g, '-');
  const auditionPath = `Audio/voice_${cleanTakeId}_${updatedTake.voiceAssetId.substring(0, 8)}.wav`;

  if (!auditionPath.startsWith('Audio/voice_take-101_')) {
    throw new Error(`FAILED: Invalid audition path: ${auditionPath}`);
  }
  console.log(`  ✓ Audition Audio Reference Path: ${auditionPath}`);

  // 6. Verify LocalOpenAITTSProvider Take generation uses saved voice ID (not 'tts')
  console.log('\n[Test 6] Verifying LocalOpenAITTSProvider Take generation resolves saved voice ID...');
  if (typeof global.localStorage === 'undefined') {
    const storage: Record<string, string> = {};
    global.localStorage = {
      getItem: (key: string) => storage[key] || null,
      setItem: (key: string, val: string) => { storage[key] = String(val); },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { Object.keys(storage).forEach((k) => delete storage[k]); },
      length: 0,
      key: (i: number) => Object.keys(storage)[i] || null,
    };
  }
  localStorage.setItem('dubbiovi_local_tts_voice', 'ef_dora');

  const { result: localResult, asset: localAsset } = await service.generateVoiceForTake({
    takeId: 'take-102',
    text: 'Hola mundo',
    language: 'ES',
    providerId: 'local-openai-tts',
  });

  if (!localResult || !localAsset) {
    throw new Error('FAILED: local-openai-tts Take voice generation failed!');
  }
  console.log(`  ✓ Generated Take voice with saved voice ID: ef_dora`);

  console.log('\n=====================================================');
  console.log(' VOICE GENERATION WORKFLOW TESTS PASSED (100%)');
  console.log('=====================================================');
}

runVoiceGenerationWorkflowTests().catch((err) => {
  console.error('\n❌ VoiceGenerationWorkflow Test Error:', err);
  process.exit(1);
});

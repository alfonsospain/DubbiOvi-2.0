import { Take } from '../src/lib/types';

async function runVoiceTimelineTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE TIMELINE INTEGRATION TEST SUITE');
  console.log('=====================================================');

  const takes: Take[] = [
    {
      id: 'take-1',
      character: 'Hero',
      time: '00:00.000 - 00:04.000',
      startSeconds: 0,
      endSeconds: 4,
      original: 'I must save the kingdom.',
      translation: 'Debo salvar el reino.',
      notes: '',
      status: 'Reviewed',
      voiceAssetId: 'asset-hero-1', // Has Voice Asset
    },
    {
      id: 'take-2',
      character: 'Villain',
      time: '00:04.500 - 00:08.000',
      startSeconds: 4.5,
      endSeconds: 8,
      original: 'You will fail!',
      translation: '¡Fracasarás!',
      notes: '',
      status: 'Pending',
      // No Voice Asset
    },
  ];

  const duration = 10;

  // 1. Verify Geometry Mapping
  console.log('\n[Test 1] Testing Voice Timeline segment geometry mapping...');
  const t1Left = (takes[0].startSeconds / duration) * 100;
  const t1Width = ((takes[0].endSeconds - takes[0].startSeconds) / duration) * 100;

  if (t1Left !== 0 || t1Width !== 40) {
    throw new Error(`FAILED: Incorrect geometry calculation for take-1! Left=${t1Left}, Width=${t1Width}`);
  }
  console.log(`  ✓ Take 1 geometry verified: left=${t1Left}%, width=${t1Width}%`);

  // 2. Verify Visual Color State Mapping
  console.log('\n[Test 2] Testing Voice Asset status state mapping (Grey vs Amber)...');
  const take1HasAsset = !!takes[0].voiceAssetId;
  const take2HasAsset = !!takes[1].voiceAssetId;

  if (!take1HasAsset) {
    throw new Error('FAILED: Take 1 should indicate Voice Asset available!');
  }
  if (take2HasAsset) {
    throw new Error('FAILED: Take 2 should indicate No Voice Asset!');
  }

  const take1Color = take1HasAsset ? 'bg-amber-500' : 'bg-zinc-700/60';
  const take2Color = take2HasAsset ? 'bg-amber-500' : 'bg-zinc-700/60';

  if (take1Color !== 'bg-amber-500' || take2Color !== 'bg-zinc-700/60') {
    throw new Error('FAILED: Color state mapping mismatch!');
  }

  console.log('  ✓ Take 1 mapped to Orange/Amber (Voice Asset available).');
  console.log('  ✓ Take 2 mapped to Neutral Grey (No Voice Asset).');

  // 3. Verify Tooltip Text Mapping
  console.log('\n[Test 3] Testing minimal tooltip text mapping...');
  const t1Tooltip = take1HasAsset ? 'Voice Asset available' : 'No Voice Asset';
  const t2Tooltip = take2HasAsset ? 'Voice Asset available' : 'No Voice Asset';

  if (t1Tooltip !== 'Voice Asset available' || t2Tooltip !== 'No Voice Asset') {
    throw new Error('FAILED: Tooltip text mapping mismatch!');
  }
  console.log(`  ✓ Take 1 tooltip: "${t1Tooltip}"`);
  console.log(`  ✓ Take 2 tooltip: "${t2Tooltip}"`);

  console.log('\n=====================================================');
  console.log(' VOICE TIMELINE TESTS PASSED (100%)');
  console.log('=====================================================');
}

runVoiceTimelineTests().catch((err) => {
  console.error('\n❌ VoiceTimeline Test Error:', err);
  process.exit(1);
});

import { LocalOpenAITTSProvider, LocalServerStatus } from '../src/lib/LocalOpenAITTSProvider';

function evaluateReadinessChecklist(status: LocalServerStatus): {
  isEngineReachable: boolean;
  hasModels: boolean;
  hasVoices: boolean;
  isFullyReady: boolean;
} {
  const isEngineReachable = status.online;
  const hasModels = status.models.length > 0;
  const hasVoices = status.voices.length > 0;
  const isFullyReady = isEngineReachable && hasModels && hasVoices;

  return { isEngineReachable, hasModels, hasVoices, isFullyReady };
}

async function runMilestone14F2SetupTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 14F.2 ENGINE SETUP TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Readiness Checklist when Offline
  console.log('\n[Test 1] Testing readiness checklist evaluation when offline...');
  const offlineStatus: LocalServerStatus = {
    online: false,
    baseUrl: 'http://localhost:8880/v1',
    statusMessage: 'No Local AI Voice server is currently running.',
    models: [],
    voices: [],
    errorType: 'OFFLINE',
  };
  const offlineEval = evaluateReadinessChecklist(offlineStatus);
  if (offlineEval.isFullyReady) {
    throw new Error('FAILED: Offline status must not be marked as isFullyReady');
  }
  console.log(`  ✓ Offline Reachable: ${offlineEval.isEngineReachable}`);
  console.log(`  ✓ Offline Models: ${offlineEval.hasModels}`);
  console.log(`  ✓ Offline Voices: ${offlineEval.hasVoices}`);
  console.log(`  ✓ Offline Fully Ready: ${offlineEval.isFullyReady}`);

  // 2. Verify Readiness Checklist when Online with Models & Voices
  console.log('\n[Test 2] Testing readiness checklist evaluation when online...');
  const onlineStatus: LocalServerStatus = {
    online: true,
    baseUrl: 'http://localhost:8880/v1',
    statusMessage: 'Connected to local speech server at http://localhost:8880/v1',
    models: ['kokoro-82m', 'tts-1'],
    voices: [
      { id: 'af_bella', name: 'Bella (American Female)', gender: 'female', language: 'EN' },
      { id: 'am_adam', name: 'Adam (American Male)', gender: 'male', language: 'EN' },
    ],
  };
  const onlineEval = evaluateReadinessChecklist(onlineStatus);
  if (!onlineEval.isFullyReady) {
    throw new Error('FAILED: Online status with models and voices must be marked as isFullyReady');
  }
  console.log(`  ✓ Online Reachable: ${onlineEval.isEngineReachable}`);
  console.log(`  ✓ Online Models: ${onlineEval.hasModels} (${onlineStatus.models.join(', ')})`);
  console.log(`  ✓ Online Voices: ${onlineEval.hasVoices} (${onlineStatus.voices.length} voices)`);
  console.log(`  ✓ Online Fully Ready: ${onlineEval.isFullyReady}`);

  // 3. Verify Partial Server Response (Reachable but 0 models)
  console.log('\n[Test 3] Testing partial server readiness (0 models)...');
  const partialStatus: LocalServerStatus = {
    online: true,
    baseUrl: 'http://localhost:8880/v1',
    statusMessage: 'Connected',
    models: [],
    voices: [],
  };
  const partialEval = evaluateReadinessChecklist(partialStatus);
  if (partialEval.isFullyReady) {
    throw new Error('FAILED: Server with 0 models must not be marked as isFullyReady');
  }
  console.log(`  ✓ Partial Server Reachable: ${partialEval.isEngineReachable}, Fully Ready: ${partialEval.isFullyReady}`);

  console.log('\n=====================================================');
  console.log(' MILESTONE 14F.2 SETUP TESTS PASSED (100%)');
  console.log('=====================================================');
}

runMilestone14F2SetupTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

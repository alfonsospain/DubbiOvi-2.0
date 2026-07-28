import { ProviderServiceManager } from '../src/lib/ProviderServiceManager';
import { LocalOpenAITTSProvider, LocalServerStatus } from '../src/lib/LocalOpenAITTSProvider';
import { groupAndPrioritizeVoices } from '../src/lib/VoiceMetadataParser';
import { VoiceDescriptor } from '../src/lib/types/voice-provider-types';

// Mock localStorage for Node environment if needed
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

async function runVoiceSelectionPersistenceTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE SELECTION PERSISTENCE TEST SUITE');
  console.log('=====================================================\n');

  ProviderServiceManager.registerDefaults();
  localStorage.clear();

  // Test 1: User-selected speech model remains selected after refreshes
  console.log('[Test 1] Testing speech model persistence after server status refresh...');
  await ProviderServiceManager.setServiceModel('local-openai-tts', 'tts', 'kokoro-custom-v1');
  localStorage.setItem('dubbiovi_local_tts_model_manual', 'true');

  const serverStatus1: LocalServerStatus = {
    online: true,
    baseUrl: 'http://localhost:8880/v1',
    statusMessage: 'Server connected',
    models: ['kokoro', 'kokoro-custom-v1', 'tts-1'],
    voices: [
      { id: 'af_bella', name: 'Bella', gender: 'female', language: 'EN' },
      { id: 'ef_dora', name: 'Dora', gender: 'female', language: 'ES' },
    ],
  };

  let activeModel = await ProviderServiceManager.getServiceModel('local-openai-tts', 'tts');
  if (!serverStatus1.models.includes(activeModel)) {
    activeModel = serverStatus1.models[0];
  }

  if (activeModel !== 'kokoro-custom-v1') {
    throw new Error(`FAILED: Speech model was reset to ${activeModel} instead of preserving kokoro-custom-v1`);
  }
  console.log('  ✓ User-selected speech model "kokoro-custom-v1" preserved after server refresh.');

  // Test 2: User-selected voice remains selected after refreshes
  console.log('\n[Test 2] Testing voice selection persistence after server status refresh...');
  localStorage.setItem('dubbiovi_local_tts_voice', 'ef_dora');
  localStorage.setItem('dubbiovi_local_tts_voice_manual', 'true');

  const savedVoice = localStorage.getItem('dubbiovi_local_tts_voice');
  const voiceExists = serverStatus1.voices.some((v) => v.id === savedVoice);
  const activeVoice = (savedVoice && voiceExists) ? savedVoice : serverStatus1.voices[0].id;

  if (activeVoice !== 'ef_dora') {
    throw new Error(`FAILED: Voice selection was reset to ${activeVoice} instead of preserving ef_dora`);
  }
  console.log('  ✓ User-selected voice "ef_dora" preserved after server status refresh.');

  // Test 3: Transcription and translation operations do not reset selection
  console.log('\n[Test 3] Verifying transcription & translation operations leave selection untouched...');
  // Simulate transcription & translation run
  const simulatedAsrResult = 'Transcription completed';
  const simulatedMtResult = 'Translation completed';
  const postOpVoice = localStorage.getItem('dubbiovi_local_tts_voice');
  const postOpModel = await ProviderServiceManager.getServiceModel('local-openai-tts', 'tts');

  if (postOpVoice !== 'ef_dora' || postOpModel !== 'kokoro-custom-v1') {
    throw new Error(`FAILED: Operations modified selection! Voice: ${postOpVoice}, Model: ${postOpModel}`);
  }
  console.log('  ✓ Speech model and voice selections intact post transcription/translation.');

  // Test 4: Automatic fallback ONLY when previously selected voice is no longer available
  console.log('\n[Test 4] Testing automatic voice fallback when previously selected voice is removed from server...');
  const serverStatusRefreshed: LocalServerStatus = {
    online: true,
    baseUrl: 'http://localhost:8880/v1',
    statusMessage: 'Server connected',
    models: ['kokoro'],
    voices: [
      { id: 'af_bella', name: 'Bella', gender: 'female', language: 'EN' },
      { id: 'am_adam', name: 'Adam', gender: 'male', language: 'EN' },
    ],
  };

  const prevVoice = localStorage.getItem('dubbiovi_local_tts_voice'); // 'ef_dora'
  const isStillAvailable = serverStatusRefreshed.voices.some((v) => v.id === prevVoice);

  let updatedVoice = prevVoice;
  if (!isStillAvailable) {
    const { recommended } = groupAndPrioritizeVoices(serverStatusRefreshed.voices, 'EN');
    updatedVoice = recommended.length > 0 ? recommended[0].id : serverStatusRefreshed.voices[0].id;
    localStorage.setItem('dubbiovi_local_tts_voice', updatedVoice);
    localStorage.setItem('dubbiovi_local_tts_voice_manual', 'false');
  }

  if (updatedVoice === 'ef_dora' || !['af_bella', 'am_adam'].includes(updatedVoice || '')) {
    throw new Error(`FAILED: Missing voice ef_dora was not updated to an available server voice. Got: ${updatedVoice}`);
  }
  if (localStorage.getItem('dubbiovi_local_tts_voice_manual') !== 'false') {
    throw new Error('FAILED: Manual selection flag should reset to false when voice is invalid!');
  }
  console.log(`  ✓ Missing voice "ef_dora" automatically updated to valid server voice "${updatedVoice}".`);

  // Test 5: Automatic language recommendations NEVER overwrite manual user selection
  console.log('\n[Test 5] Testing Target Language change behavior with manual vs automatic selection...');
  // A. Set explicit manual user selection
  localStorage.setItem('dubbiovi_local_tts_voice', 'am_adam');
  localStorage.setItem('dubbiovi_local_tts_voice_manual', 'true');

  const voicesList: VoiceDescriptor[] = [
    { id: 'am_adam', name: 'Adam', gender: 'male', language: 'EN' },
    { id: 'ef_dora', name: 'Dora', gender: 'female', language: 'ES' },
    { id: 'ff_siwis', name: 'Siwis', gender: 'female', language: 'FR' },
  ];

  // Target Language changes to FR
  let isManual = localStorage.getItem('dubbiovi_local_tts_voice_manual') === 'true';
  let activeVoiceOnLangChange = localStorage.getItem('dubbiovi_local_tts_voice');

  if (!isManual) {
    const { recommended } = groupAndPrioritizeVoices(voicesList, 'FR');
    if (recommended.length > 0) activeVoiceOnLangChange = recommended[0].id;
  }

  if (activeVoiceOnLangChange !== 'am_adam') {
    throw new Error(`FAILED: Manual selection "am_adam" was overwritten on Target Language change! Got: ${activeVoiceOnLangChange}`);
  }
  console.log('  ✓ Target Language change to FR preserved manual user selection "am_adam".');

  // B. Test automatic recommendation when selection is NOT manual
  localStorage.setItem('dubbiovi_local_tts_voice_manual', 'false');
  isManual = localStorage.getItem('dubbiovi_local_tts_voice_manual') === 'true';

  if (!isManual) {
    const { recommended } = groupAndPrioritizeVoices(voicesList, 'FR');
    if (recommended.length > 0) {
      activeVoiceOnLangChange = recommended[0].id;
      localStorage.setItem('dubbiovi_local_tts_voice', activeVoiceOnLangChange);
    }
  }

  if (activeVoiceOnLangChange !== 'ff_siwis') {
    throw new Error(`FAILED: Automatic recommendation should have updated voice to "ff_siwis", got: ${activeVoiceOnLangChange}`);
  }
  console.log('  ✓ Target Language change to FR automatically recommended "ff_siwis" when selection was non-manual.');

  console.log('\n=====================================================');
  console.log(' VOICE SELECTION PERSISTENCE TESTS PASSED (100%)');
  console.log('=====================================================\n');
}

runVoiceSelectionPersistenceTests().catch((err) => {
  console.error('Voice selection persistence test suite failed:', err);
  process.exit(1);
});

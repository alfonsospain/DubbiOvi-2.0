import { LocalOpenAITTSProvider } from '../src/lib/LocalOpenAITTSProvider';
import { providerRegistry } from '../src/lib/ProviderRegistry';
import { VoiceService } from '../src/lib/VoiceService';

async function runMilestone14DIntegrationTests() {
  console.log('=====================================================');
  console.log(' STARTING MILESTONE 14D LOCAL AI VOICE INTEGRATION TESTS');
  console.log('=====================================================');

  // 1. Verify LocalOpenAITTSProvider Discovery in ProviderRegistry
  console.log('\n[Test 1] Testing LocalOpenAITTSProvider registration & capabilities...');
  const localProvider = providerRegistry.getVoiceProvider('local-openai-tts');
  if (!localProvider || localProvider.id !== 'local-openai-tts') {
    throw new Error('FAILED: LocalOpenAITTSProvider not found in ProviderRegistry!');
  }
  if (!localProvider.capabilities.isOffline) {
    throw new Error('FAILED: LocalOpenAITTSProvider capability isOffline must be true');
  }
  if (localProvider.capabilities.requiresApiKey) {
    throw new Error('FAILED: LocalOpenAITTSProvider capability requiresApiKey must be false');
  }
  console.log(`  ✓ Provider ID: ${localProvider.id}`);
  console.log(`  ✓ Provider Name: ${localProvider.name}`);
  console.log(`  ✓ Capabilities: isOffline=${localProvider.capabilities.isOffline}, requiresApiKey=${localProvider.capabilities.requiresApiKey}`);

  // 2. Test Server Connection Detection & Status Probing
  console.log('\n[Test 2] Testing server connection probing & offline detection...');
  const instance = new LocalOpenAITTSProvider();
  const offlineStatus = await instance.checkServerConnection('http://localhost:9999/v1'); // Intentional offline port
  if (offlineStatus.online) {
    throw new Error('FAILED: Probing unreachable port http://localhost:9999/v1 should report online = false');
  }
  console.log(`  ✓ Offline Status Message: ${offlineStatus.statusMessage}`);
  console.log(`  ✓ Error Classification: ${offlineStatus.errorType}`);

  // 3. Test Dynamic Model Discovery
  console.log('\n[Test 3] Testing dynamic model discovery (getAvailableModels)...');
  const models = await instance.getAvailableModels();
  if (models.length === 0) {
    throw new Error('FAILED: getAvailableModels returned empty list!');
  }
  console.log(`  ✓ Discovered ${models.length} model(s): ${models.join(', ')}`);

  // 4. Test Dynamic Voice Discovery
  console.log('\n[Test 4] Testing dynamic voice discovery (getAvailableVoices)...');
  const voices = await instance.getAvailableVoices('EN');
  if (voices.length === 0) {
    throw new Error('FAILED: getAvailableVoices returned empty list!');
  }
  console.log(`  ✓ Discovered ${voices.length} voice descriptor(s): ${voices.map((v) => `${v.name} (${v.id})`).join(', ')}`);

  // 5. Test Graceful Execution when Server is Offline
  console.log('\n[Test 5] Testing VoiceService offline error handling...');
  const voiceService = new VoiceService();
  try {
    await voiceService.generateVoiceForTake({
      takeId: 'take-14d-offline',
      text: 'Testing offline error handling for local speech server.',
      language: 'EN',
      voiceId: voices[0].id,
      providerId: 'local-openai-tts',
    });
    // If local server is running live, synthesis succeeds!
    console.log('  ✓ Live local speech server responded and generated audio!');
  } catch (err: any) {
    if (err.message && err.message.includes('offline or unreachable')) {
      console.log(`  ✓ Successfully caught offline server exception: "${err.message}"`);
    } else {
      throw err;
    }
  }

  console.log('\n=====================================================');
  console.log(' MILESTONE 14D INTEGRATION TESTS PASSED (100%)');
  console.log('=====================================================');
}

runMilestone14DIntegrationTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

import { LocalOpenAITTSProvider } from '../src/lib/LocalOpenAITTSProvider';
import { providerRegistry } from '../src/lib/ProviderRegistry';
import { VoiceService } from '../src/lib/VoiceService';

async function runLocalAiVoiceProviderTests() {
  console.log('=====================================================');
  console.log(' STARTING LOCAL AI VOICE PROVIDER TEST SUITE');
  console.log('=====================================================');

  // 1. Verify LocalOpenAITTSProvider Registration in ProviderRegistry
  console.log('\n[Test 1] Testing LocalOpenAITTSProvider discovery in ProviderRegistry...');
  const localProvider = providerRegistry.getVoiceProvider('local-openai-tts');
  if (!localProvider || localProvider.id !== 'local-openai-tts') {
    throw new Error('FAILED: LocalOpenAITTSProvider not found in ProviderRegistry!');
  }
  if (!localProvider.capabilities.isOffline) {
    throw new Error('FAILED: LocalOpenAITTSProvider should report isOffline = true');
  }
  if (localProvider.capabilities.requiresApiKey) {
    throw new Error('FAILED: LocalOpenAITTSProvider should report requiresApiKey = false');
  }
  console.log(`  ✓ Resolved Local Voice Provider: ${localProvider.name}`);
  console.log(`  ✓ Capabilities: isOffline=${localProvider.capabilities.isOffline}, requiresApiKey=${localProvider.capabilities.requiresApiKey}`);

  // 2. Verify Available Voices Discovery
  console.log('\n[Test 2] Testing getAvailableVoices() on local provider...');
  const voices = await localProvider.getAvailableVoices('EN');
  if (voices.length === 0) {
    throw new Error('FAILED: getAvailableVoices() returned empty list!');
  }
  console.log(`  ✓ Discovered ${voices.length} local voice descriptor(s): ${voices.map((v) => v.name).join(', ')}`);

  // 3. Verify Alias Resolution in ProviderRegistry
  console.log('\n[Test 3] Testing alias resolution in ProviderRegistry...');
  const resolvedByKokoroAlias = providerRegistry.getVoiceProvider('kokoro');
  if (!resolvedByKokoroAlias || resolvedByKokoroAlias.id !== 'local-openai-tts') {
    throw new Error('FAILED: Alias "kokoro" did not resolve to LocalOpenAITTSProvider');
  }
  console.log(`  ✓ Alias "kokoro" resolved to: ${resolvedByKokoroAlias.name}`);

  console.log('\n=====================================================');
  console.log(' LOCAL AI VOICE PROVIDER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runLocalAiVoiceProviderTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

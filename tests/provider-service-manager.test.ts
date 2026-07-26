import { ProviderServiceManager } from '../src/lib/ProviderServiceManager';

async function runProviderServiceManagerTests() {
  console.log('=====================================================');
  console.log(' STARTING PROVIDER SERVICE MANAGER TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Registered Service Capabilities for Gemini
  console.log('\n[Test 1] Querying Gemini provider service capabilities...');
  const geminiCaps = ProviderServiceManager.getCapabilitiesForProvider('gemini');
  if (geminiCaps.length !== 3) {
    throw new Error(`FAILED: Expected 3 Gemini service capabilities, got ${geminiCaps.length}`);
  }
  const types = geminiCaps.map((c) => c.serviceType);
  if (!types.includes('asr') || !types.includes('mt') || !types.includes('tts')) {
    throw new Error('FAILED: Missing expected Gemini service categories (asr, mt, tts)!');
  }
  console.log(`  ✓ Gemini exposes ${geminiCaps.length} service capabilities: ${types.join(', ')}`);

  // 2. Verify Independent Service Model Resolution
  console.log('\n[Test 2] Resolving service-specific models for OpenAI...');
  const asrModel = await ProviderServiceManager.getServiceModel('openai', 'asr');
  const mtModel = await ProviderServiceManager.getServiceModel('openai', 'mt');
  const ttsModel = await ProviderServiceManager.getServiceModel('openai', 'tts');

  if (asrModel !== 'whisper-1') throw new Error(`FAILED: OpenAI ASR model expected whisper-1, got ${asrModel}`);
  if (mtModel !== 'gpt-4o-mini') throw new Error(`FAILED: OpenAI MT model expected gpt-4o-mini, got ${mtModel}`);
  if (ttsModel !== 'tts-1') throw new Error(`FAILED: OpenAI TTS model expected tts-1, got ${ttsModel}`);

  console.log(`  ✓ OpenAI ASR Model: ${asrModel}`);
  console.log(`  ✓ OpenAI MT Model:  ${mtModel}`);
  console.log(`  ✓ OpenAI TTS Model: ${ttsModel}`);

  // 3. Verify Updating & Resolving Service Model Setting
  console.log('\n[Test 3] Updating service model for Gemini TTS...');
  await ProviderServiceManager.setServiceModel('gemini', 'tts', 'gemini-2.5-pro-tts');
  const updatedTtsModel = await ProviderServiceManager.getServiceModel('gemini', 'tts');
  if (updatedTtsModel !== 'gemini-2.5-pro-tts') {
    throw new Error(`FAILED: Updated Gemini TTS model expected gemini-2.5-pro-tts, got ${updatedTtsModel}`);
  }
  console.log(`  ✓ Successfully updated and resolved Gemini TTS Model: ${updatedTtsModel}`);

  console.log('\n=====================================================');
  console.log(' PROVIDER SERVICE MANAGER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runProviderServiceManagerTests().catch((err) => {
  console.error('\n❌ ProviderServiceManager Test Error:', err);
  process.exit(1);
});

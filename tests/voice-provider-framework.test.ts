import { providerRegistry } from '../src/lib/ProviderRegistry';
import { ProviderServiceManager } from '../src/lib/ProviderServiceManager';
import { VoiceService } from '../src/lib/VoiceService';

async function runVoiceProviderFrameworkTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE PROVIDER FRAMEWORK TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Provider Registry Voice Provider Discovery
  console.log('\n[Test 1] Testing Voice Provider discovery in ProviderRegistry...');
  const voiceProviders = providerRegistry.getAllVoiceProviders();
  if (voiceProviders.length < 1) {
    throw new Error('FAILED: ProviderRegistry has no registered Voice Providers!');
  }
  const stubProvider = providerRegistry.getVoiceProvider('stub-voice-provider');
  if (!stubProvider || stubProvider.id !== 'stub-voice-provider') {
    throw new Error('FAILED: Could not find StubVoiceProvider in ProviderRegistry!');
  }
  console.log(`  ✓ Found ${voiceProviders.length} Voice Provider(s) in ProviderRegistry: ${voiceProviders.map((p) => p.name).join(', ')}`);

  // 2. Verify Available Voices Query
  console.log('\n[Test 2] Querying available voices from StubVoiceProvider...');
  const voices = await stubProvider.getAvailableVoices('en');
  if (voices.length < 1) {
    throw new Error('FAILED: StubVoiceProvider returned empty voice list!');
  }
  console.log(`  ✓ Resolved ${voices.length} voice(s): ${voices.map((v) => v.name).join(', ')}`);

  // 3. Verify Service Model Resolution for TTS
  console.log('\n[Test 3] Verifying TTS service model resolution via ProviderServiceManager...');
  ProviderServiceManager.registerCapability({
    providerId: 'stub-voice-provider',
    serviceType: 'tts',
    defaultModel: 'stub-tts-model-v1',
    supportedModels: ['stub-tts-model-v1'],
  });

  const activeTtsModel = await ProviderServiceManager.getServiceModel('stub-voice-provider', 'tts');
  if (activeTtsModel !== 'stub-tts-model-v1') {
    throw new Error(`FAILED: Expected default TTS model stub-tts-model-v1, got ${activeTtsModel}`);
  }
  console.log(`  ✓ Resolved active TTS model for stub-voice-provider: ${activeTtsModel}`);

  // 4. Verify End-to-End Voice Generation via VoiceService
  console.log('\n[Test 4] Executing VoiceService.generateVoiceForTake()...');
  const service = new VoiceService();

  const { result, asset } = await service.generateVoiceForTake({
    takeId: 'take-202',
    text: 'Welcome to DubbiOvi voice production platform.',
    language: 'EN',
    voiceId: voices[0].id,
    providerId: stubProvider.id,
  });

  if (!result || result.takeId !== 'take-202') {
    throw new Error('FAILED: VoiceGenerationResult generation failed!');
  }
  if (!result.relativePath.startsWith('Audio/')) {
    throw new Error(`FAILED: VoiceGenerationResult relativePath missing 'Audio/' prefix: ${result.relativePath}`);
  }
  // Verify result contains zero raw binary audio buffer data
  if ((result as any).audioBuffer || (result as any).audioData || (result as any).buffer) {
    throw new Error('FAILED: VoiceGenerationResult must NOT contain raw binary audio buffers!');
  }

  if (!asset || asset.id !== result.id || asset.takeId !== 'take-202') {
    throw new Error('FAILED: VoiceAsset registration in VoiceAssetManager failed!');
  }

  console.log(`  ✓ Generated VoiceGenerationResult ID: ${result.id}`);
  console.log(`  ✓ Relative Audio Path: ${result.relativePath}`);
  console.log(`  ✓ Successfully registered VoiceAsset for take-202 in VoiceAssetManager.`);

  console.log('\n=====================================================');
  console.log(' VOICE PROVIDER FRAMEWORK TESTS PASSED (100%)');
  console.log('=====================================================');
}

runVoiceProviderFrameworkTests().catch((err) => {
  console.error('\n❌ VoiceProviderFramework Test Error:', err);
  process.exit(1);
});

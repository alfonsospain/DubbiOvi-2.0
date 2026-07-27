import { RuntimeRepository } from '../src/runtime/RuntimeRepository';
import { PiperModelManager } from '../src/lib/PiperModelManager';
import { PiperLocalProvider } from '../src/lib/PiperLocalProvider';
import { providerRegistry } from '../src/lib/ProviderRegistry';
import { VoiceService } from '../src/lib/VoiceService';

async function runPiperProviderTests() {
  console.log('=====================================================');
  console.log(' STARTING PIPER VOICE PROVIDER TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Piper Runtime Descriptor Registration in RuntimeRepository
  console.log('\n[Test 1] Testing Piper Runtime Descriptor in RuntimeRepository...');
  const repo = new RuntimeRepository();
  const darwinArm64Desc = await repo.getDescriptor('piper', '1.0.0', 'darwin', 'arm64');
  if (!darwinArm64Desc || darwinArm64Desc.id !== 'piper') {
    throw new Error('FAILED: Piper runtime descriptor for darwin_arm64 not found!');
  }
  console.log(`  ✓ Resolved Piper Runtime Descriptor: ${darwinArm64Desc.name} v${darwinArm64Desc.version}`);

  // 2. Verify Piper Model Manager Known Models Catalog
  console.log('\n[Test 2] Testing PiperModelManager known models catalog...');
  const known = PiperModelManager.getKnownModels();
  if (known.length < 3) {
    throw new Error(`FAILED: Expected at least 3 known Piper models, got ${known.length}`);
  }
  console.log(`  ✓ Piper known models catalog: ${known.map((m) => m.filename).join(', ')}`);

  const activeModel = await PiperModelManager.getActiveModelName();
  if (!activeModel) {
    throw new Error('FAILED: Piper active model resolution returned empty string!');
  }
  console.log(`  ✓ Active Piper model resolved: ${activeModel}`);

  // 3. Verify Piper Provider Capabilities & Voice Discovery
  console.log('\n[Test 3] Testing PiperLocalProvider discovery in ProviderRegistry...');
  const piperProvider = providerRegistry.getVoiceProvider('piper');
  if (!piperProvider || piperProvider.id !== 'piper') {
    throw new Error('FAILED: PiperLocalProvider not found in ProviderRegistry!');
  }
  if (!piperProvider.capabilities.isOffline) {
    throw new Error('FAILED: PiperLocalProvider should report isOffline = true');
  }

  const voices = await piperProvider.getAvailableVoices('EN');
  if (voices.length < 1) {
    throw new Error('FAILED: Piper getAvailableVoices returned empty list!');
  }
  console.log(`  ✓ Piper capability isOffline: ${piperProvider.capabilities.isOffline}`);
  console.log(`  ✓ Discovered Piper voice descriptors: ${voices.map((v) => v.name).join(', ')}`);

  // 4. Verify End-to-End Execution & Provider-Neutral Audio Filename Format
  console.log('\n[Test 4] Executing VoiceService.generateVoiceForTake() with PiperLocalProvider...');
  const voiceService = new VoiceService();
  const { result, asset } = await voiceService.generateVoiceForTake({
    takeId: 'take-303',
    text: 'Offline neural text-to-speech synthesis with Piper engine.',
    language: 'EN',
    voiceId: voices[0].id,
    providerId: 'piper',
  });

  if (!result || result.takeId !== 'take-303') {
    throw new Error('FAILED: Piper generation result failed!');
  }

  // Verify provider-neutral filename format (voice_<takeId>_<uuid>.wav)
  const isNeutralFormat = result.filename.startsWith('voice_take-303_') && result.filename.endsWith('.wav');
  if (!isNeutralFormat) {
    throw new Error(`FAILED: Filename is not provider-neutral! Got: ${result.filename}`);
  }

  if (!asset || asset.id !== result.id) {
    throw new Error('FAILED: VoiceAsset registration for Piper failed!');
  }

  console.log(`  ✓ Provider-Neutral Filename: ${result.filename}`);
  console.log(`  ✓ Relative Audio Path: ${result.relativePath}`);
  console.log(`  ✓ Generator Provider Metadata: ${result.metadata.generatorProviderId}`);

  console.log('\n=====================================================');
  console.log(' PIPER VOICE PROVIDER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runPiperProviderTests().catch((err) => {
  console.error('\n❌ PiperProvider Test Error:', err);
  process.exit(1);
});

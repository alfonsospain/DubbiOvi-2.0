import { WhisperModelManager, SUPPORTED_WHISPER_MODELS } from '../src/lib/WhisperModelManager';

async function runWhisperModelManagerTests() {
  console.log('=====================================================');
  console.log(' STARTING WHISPER MODEL MANAGER TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Available Models Catalog
  console.log('\n[Test 1] Testing getAvailableModels()...');
  const models = WhisperModelManager.getAvailableModels();
  if (models.length !== 4) {
    throw new Error(`FAILED: Expected 4 catalog models, got ${models.length}`);
  }
  console.log(`  ✓ Found ${models.length} supported Whisper models: ${models.map((m) => m.name).join(', ')}`);

  // 2. Verify Model Descriptor Resolution
  console.log('\n[Test 2] Testing getModelDescriptor()...');
  const tinyDesc = WhisperModelManager.getModelDescriptor('ggml-tiny.bin');
  if (!tinyDesc || tinyDesc.id !== 'tiny') {
    throw new Error('FAILED: Failed to resolve ggml-tiny.bin descriptor');
  }
  console.log('  ✓ Resolved ggml-tiny.bin successfully.');

  const baseDesc = WhisperModelManager.getModelDescriptor('base');
  if (!baseDesc || baseDesc.filename !== 'ggml-base.bin') {
    throw new Error('FAILED: Failed to resolve model by ID "base"');
  }
  console.log('  ✓ Resolved model by ID "base" successfully.');

  // 3. Verify Default Model Fallback
  console.log('\n[Test 3] Testing default active model fallback...');
  const active = await WhisperModelManager.getActiveModelName();
  if (!active || typeof active !== 'string') {
    throw new Error('FAILED: Invalid active model string returned');
  }
  console.log(`  ✓ Active model resolved: ${active}`);

  console.log('\n=====================================================');
  console.log(' WHISPER MODEL MANAGER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runWhisperModelManagerTests().catch((err) => {
  console.error('\n❌ WhisperModelManager Test Error:', err);
  process.exit(1);
});

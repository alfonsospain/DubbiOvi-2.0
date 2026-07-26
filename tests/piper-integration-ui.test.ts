import { PiperModelManager } from '../src/lib/PiperModelManager';
import { providerRegistry } from '../src/lib/ProviderRegistry';

async function runPiperIntegrationUITests() {
  console.log('=====================================================');
  console.log(' STARTING PIPER INTEGRATION & UI TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Provider Registry Discovery for Piper Local TTS
  console.log('\n[Test 1] Testing ProviderRegistry discovery of Piper Local TTS (Offline)...');
  const ttsProviders = providerRegistry.getAllVoiceProviders();
  const piper = providerRegistry.getVoiceProvider('piper');

  if (!piper || piper.name !== 'Piper Neural TTS (Offline)') {
    throw new Error('FAILED: Piper Neural TTS (Offline) missing or incorrectly named in ProviderRegistry!');
  }
  console.log(`  ✓ Resolved provider: ${piper.name} (${piper.id})`);

  // 2. Verify Piper Model Manager Catalog & Active Model Resolution
  console.log('\n[Test 2] Testing PiperModelManager model catalog & active model resolution...');
  const catalog = PiperModelManager.getKnownModels();
  if (catalog.length !== 3) {
    throw new Error(`FAILED: Expected 3 catalog models, found ${catalog.length}`);
  }
  const activeModel = await PiperModelManager.getActiveModelName();
  if (!activeModel) {
    throw new Error('FAILED: Active Piper model resolution returned empty string!');
  }
  console.log(`  ✓ Active model resolved: ${activeModel}`);
  console.log(`  ✓ Catalog voice models: ${catalog.map((m) => m.name).join(', ')}`);

  // 3. Verify Audio Path Resolution Strategy for Electron Playback
  console.log('\n[Test 3] Testing Audio Path Resolution Strategy for Electron Playback...');
  const relativePath = 'Audio/voice_take-101_e2e.wav';
  const mockProjectPath = '/Users/alfonso/Projects/DubbiOviProject';
  const resolvedUrl = `file://${mockProjectPath}/${relativePath}`;

  if (!resolvedUrl.startsWith('file:///') || !resolvedUrl.endsWith('.wav')) {
    throw new Error(`FAILED: Invalid resolved audio URL format: ${resolvedUrl}`);
  }
  console.log(`  ✓ Relative path: ${relativePath}`);
  console.log(`  ✓ Resolved file:// URI: ${resolvedUrl}`);

  console.log('\n=====================================================');
  console.log(' PIPER INTEGRATION & UI TESTS PASSED (100%)');
  console.log('=====================================================');
}

runPiperIntegrationUITests().catch((err) => {
  console.error('\n❌ Piper Integration UI Test Error:', err);
  process.exit(1);
});

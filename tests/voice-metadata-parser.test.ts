import { parseVoiceMetadata, groupAndPrioritizeVoices } from '../src/lib/VoiceMetadataParser';
import { VoiceDescriptor } from '../src/lib/types/voice-provider-types';

async function runVoiceMetadataParserTests() {
  console.log('=====================================================');
  console.log(' STARTING VOICE METADATA PARSER TEST SUITE');
  console.log('=====================================================');

  // 1. Test parsing Kokoro-style voice prefixes (af_, am_, bf_, ef_, jf_, zf_)
  console.log('\n[Test 1] Testing Kokoro voice prefix interpretation...');
  const bella = parseVoiceMetadata('af_bella');
  if (bella.displayName !== 'Bella' || bella.languageName !== 'English (US)' || bella.gender !== 'female' || bella.countryFlag !== '🇺🇸') {
    throw new Error(`FAILED: af_bella parsed incorrectly: ${JSON.stringify(bella)}`);
  }
  console.log(`  ✓ af_bella parsed: ${bella.countryFlag} ${bella.displayName} (${bella.languageName}, ${bella.gender})`);

  const adam = parseVoiceMetadata('am_adam');
  if (adam.displayName !== 'Adam' || adam.languageName !== 'English (US)' || adam.gender !== 'male') {
    throw new Error(`FAILED: am_adam parsed incorrectly: ${JSON.stringify(adam)}`);
  }
  console.log(`  ✓ am_adam parsed: ${adam.countryFlag} ${adam.displayName} (${adam.languageName}, ${adam.gender})`);

  const emma = parseVoiceMetadata('bf_emma');
  if (emma.displayName !== 'Emma' || emma.languageName !== 'English (UK)' || emma.countryFlag !== '🇬🇧') {
    throw new Error(`FAILED: bf_emma parsed incorrectly: ${JSON.stringify(emma)}`);
  }
  console.log(`  ✓ bf_emma parsed: ${emma.countryFlag} ${emma.displayName} (${emma.languageName}, ${emma.gender})`);

  const dora = parseVoiceMetadata('ef_dora');
  if (dora.displayName !== 'Dora' || dora.languageName !== 'Spanish' || dora.countryFlag !== '🇪🇸') {
    throw new Error(`FAILED: ef_dora parsed incorrectly: ${JSON.stringify(dora)}`);
  }
  console.log(`  ✓ ef_dora parsed: ${dora.countryFlag} ${dora.displayName} (${dora.languageName}, ${dora.gender})`);

  // 2. Test fallback for unknown / custom voice IDs
  console.log('\n[Test 2] Testing unknown / custom voice ID fallbacks...');
  const custom = parseVoiceMetadata('custom_female_speaker_1');
  if (!custom || custom.rawId !== 'custom_female_speaker_1' || custom.gender !== 'female') {
    throw new Error(`FAILED: custom voice ID fallback: ${JSON.stringify(custom)}`);
  }
  console.log(`  ✓ custom_female_speaker_1 parsed: ${custom.countryFlag} ${custom.displayName} (${custom.gender})`);

  // 3. Test Voice Grouping & Target Language Prioritization
  console.log('\n[Test 3] Testing groupAndPrioritizeVoices with target language ES...');
  const voiceDescriptors: VoiceDescriptor[] = [
    { id: 'af_bella', name: 'Bella', language: 'EN' },
    { id: 'ef_dora', name: 'Dora', language: 'ES' },
    { id: 'em_alex', name: 'Alex', language: 'ES' },
    { id: 'bf_emma', name: 'Emma', language: 'EN' },
  ];

  const { recommended, groups } = groupAndPrioritizeVoices(voiceDescriptors, 'ES');
  if (recommended.length !== 2 || recommended[0].displayName !== 'Dora' || recommended[1].displayName !== 'Alex') {
    throw new Error(`FAILED: Target language recommendations for ES should include Dora & Alex`);
  }
  console.log(`  ✓ Target Language ES Recommendations: ${recommended.map((r) => r.displayName).join(', ')}`);
  console.log(`  ✓ Total Language Groups: ${groups.length} (${groups.map((g) => g.languageName).join(', ')})`);

  console.log('\n=====================================================');
  console.log(' VOICE METADATA PARSER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runVoiceMetadataParserTests().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});

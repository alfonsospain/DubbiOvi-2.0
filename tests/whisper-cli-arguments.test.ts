import assert from 'assert';
const { buildWhisperArgs, normalizeWhisperLanguage } = require('../whisper-helpers');
import { WhisperLocalClientProvider } from '../src/lib/WhisperLocalClientProvider';
import { PreparedAudio } from '../src/lib/transcription-types';

async function runWhisperCliArgumentTests() {
  console.log('=====================================================');
  console.log(' STARTING WHISPER CLI ARGUMENT & LANGUAGE TEST SUITE');
  console.log('=====================================================');

  // -------------------------------------------------------------------------
  // Test 1: Language Normalization Unit Tests
  // -------------------------------------------------------------------------
  console.log('\n[Test 1] Verifying normalizeWhisperLanguage behavior...');

  // Auto-Detect / unspecified / fallback
  assert.strictEqual(normalizeWhisperLanguage('Auto-Detect'), 'auto', 'Auto-Detect should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage('auto-detect'), 'auto', 'auto-detect lowercase should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage('auto'), 'auto', 'auto should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage(''), 'auto', 'empty string should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage(undefined), 'auto', 'undefined should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage(null as any), 'auto', 'null should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage('none'), 'auto', 'none should normalize to auto');
  assert.strictEqual(normalizeWhisperLanguage('None'), 'auto', 'None should normalize to auto');

  // Explicit Spanish
  assert.strictEqual(normalizeWhisperLanguage('ES'), 'es', 'ES should normalize to es');
  assert.strictEqual(normalizeWhisperLanguage('es'), 'es', 'es should normalize to es');
  assert.strictEqual(normalizeWhisperLanguage('es-ES'), 'es', 'es-ES should normalize to es');
  assert.strictEqual(normalizeWhisperLanguage('es_ES'), 'es', 'es_ES should normalize to es');

  // Explicit English
  assert.strictEqual(normalizeWhisperLanguage('EN'), 'en', 'EN should normalize to en');
  assert.strictEqual(normalizeWhisperLanguage('en'), 'en', 'en should normalize to en');
  assert.strictEqual(normalizeWhisperLanguage('en-US'), 'en', 'en-US should normalize to en');

  // Other Multilingual ISO codes (French, Italian, German, Japanese, etc.)
  assert.strictEqual(normalizeWhisperLanguage('FR'), 'fr', 'FR should normalize to fr');
  assert.strictEqual(normalizeWhisperLanguage('IT'), 'it', 'IT should normalize to it');
  assert.strictEqual(normalizeWhisperLanguage('DE'), 'de', 'DE should normalize to de');
  assert.strictEqual(normalizeWhisperLanguage('JA'), 'ja', 'JA should normalize to ja');
  assert.strictEqual(normalizeWhisperLanguage('ZH'), 'zh', 'ZH should normalize to zh');

  console.log('  ✓ PASSED: Language normalization accurately handles Auto-Detect, Spanish, English, and multilingual codes.');

  // -------------------------------------------------------------------------
  // Test 2: CLI Argument Construction for Spanish, Auto-Detect, English, etc.
  // -------------------------------------------------------------------------
  console.log('\n[Test 2] Verifying buildWhisperArgs command-line construction...');

  const sampleModel = '/path/to/models/whisper/ggml-tiny.bin';
  const sampleAudio = '/tmp/sample_speech.wav';

  // Spanish
  const spanishArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'ES',
    isIntelMac: false,
  });
  console.log('  Spanish args:', spanishArgs.join(' '));
  assert.deepStrictEqual(
    spanishArgs,
    ['-m', sampleModel, '-f', sampleAudio, '-oj', '-l', 'es'],
    'Spanish args must include -l es'
  );

  // Auto-Detect
  const autoArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'Auto-Detect',
    isIntelMac: false,
  });
  console.log('  Auto-Detect args:', autoArgs.join(' '));
  assert.deepStrictEqual(
    autoArgs,
    ['-m', sampleModel, '-f', sampleAudio, '-oj', '-l', 'auto'],
    'Auto-Detect args must include -l auto'
  );

  // Missing / Undefined language
  const defaultArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: undefined,
    isIntelMac: false,
  });
  assert.deepStrictEqual(
    defaultArgs,
    ['-m', sampleModel, '-f', sampleAudio, '-oj', '-l', 'auto'],
    'Undefined language args must default to -l auto'
  );

  // English
  const englishArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'EN',
    isIntelMac: false,
  });
  console.log('  English args:', englishArgs.join(' '));
  assert.deepStrictEqual(
    englishArgs,
    ['-m', sampleModel, '-f', sampleAudio, '-oj', '-l', 'en'],
    'English args must include -l en'
  );

  // French & Italian (multilingual)
  const frenchArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'FR',
    isIntelMac: false,
  });
  assert(frenchArgs.includes('-l') && frenchArgs[frenchArgs.indexOf('-l') + 1] === 'fr');

  const italianArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'IT',
    isIntelMac: false,
  });
  assert(italianArgs.includes('-l') && italianArgs[italianArgs.indexOf('-l') + 1] === 'it');

  console.log('  ✓ PASSED: Spanish (-l es), Auto-Detect (-l auto), English (-l en), and multilingual args verified.');

  // -------------------------------------------------------------------------
  // Test 3: Intel macOS Flags Preservation (-ng, -nfa)
  // -------------------------------------------------------------------------
  console.log('\n[Test 3] Verifying Intel macOS flags preservation...');

  const intelArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'ES',
    isIntelMac: true,
  });
  console.log('  Intel Mac Spanish args:', intelArgs.join(' '));
  assert(intelArgs.includes('-l') && intelArgs[intelArgs.indexOf('-l') + 1] === 'es', 'Intel args must include -l es');
  assert(intelArgs.includes('-ng'), 'Intel args must preserve -ng (no GPU)');
  assert(intelArgs.includes('-nfa'), 'Intel args must preserve -nfa (no flash attention)');

  const nonIntelArgs = buildWhisperArgs({
    modelPath: sampleModel,
    audioPath: sampleAudio,
    language: 'ES',
    isIntelMac: false,
  });
  assert(!nonIntelArgs.includes('-ng'), 'Non-Intel args must NOT include -ng');
  assert(!nonIntelArgs.includes('-nfa'), 'Non-Intel args must NOT include -nfa');

  console.log('  ✓ PASSED: Intel Mac flags (-ng, -nfa) are preserved when isIntelMac is true, omitted otherwise.');

  // -------------------------------------------------------------------------
  // Test 4: Verification That No --translate or -tr Flags Are Present
  // -------------------------------------------------------------------------
  console.log('\n[Test 4] Verifying no translate-to-English flags (--translate, -tr)...');

  const allArgSets = [spanishArgs, autoArgs, defaultArgs, englishArgs, frenchArgs, italianArgs, intelArgs, nonIntelArgs];
  for (const args of allArgSets) {
    assert(!args.includes('-tr'), `Args must not contain -tr flag: ${args.join(' ')}`);
    assert(!args.includes('--translate'), `Args must not contain --translate flag: ${args.join(' ')}`);
  }

  console.log('  ✓ PASSED: Confirmed no --translate or -tr flags exist in any constructed CLI argument set.');

  // -------------------------------------------------------------------------
  // Test 5: WhisperLocalClientProvider Forwards sourceLanguage to IPC Bridge
  // -------------------------------------------------------------------------
  console.log('\n[Test 5] Verifying WhisperLocalClientProvider forwards sourceLanguage to Electron IPC...');

  let interceptedAudioBuffer: any = null;
  let interceptedModelPath: string | null = null;
  let interceptedLanguage: string | undefined = undefined;

  // Mock window.electron
  const fakeBlob = {
    arrayBuffer: async () => new ArrayBuffer(16),
  };
  const mockPreparedAudio: PreparedAudio = {
    blob: fakeBlob as any,
    format: 'wav',
    mimeType: 'audio/wav',
    sampleRate: 16000,
    channels: 1,
    duration: 5,
    normalizationApplied: false,
    sourceFileName: 'test.wav',
  };

  (globalThis as any).window = {
    electron: {
      checkRuntimeInstalled: async () => ({ isInstalled: true, info: { executablePath: '/bin/whisper-cli' } }),
      runWhisperLocal: async (audioBuffer: any, modelPath: string, language?: string) => {
        interceptedAudioBuffer = audioBuffer;
        interceptedModelPath = modelPath;
        interceptedLanguage = language;
        return {
          result: {
            language: language === 'ES' ? 'es' : 'en',
            transcription: [
              {
                timestamps: { from: '00:00:00,000', to: '00:00:02,000' },
                text: language === 'ES' ? 'Hola mundo' : 'Hello world',
              },
            ],
          },
        };
      },
    },
  };

  const provider = new WhisperLocalClientProvider('ggml-tiny.bin');

  // Test Spanish forwarding
  const spanishResult = await provider.transcribe(mockPreparedAudio, 'ES');
  assert.strictEqual(interceptedLanguage, 'ES', 'ClientProvider must forward "ES" to electron.runWhisperLocal');
  assert.strictEqual(spanishResult.detectedLanguage, 'ES');
  assert.strictEqual(spanishResult.takes[0].original, 'Hola mundo');

  // Test Auto-Detect forwarding
  const autoResult = await provider.transcribe(mockPreparedAudio, 'Auto-Detect');
  assert.strictEqual(interceptedLanguage, 'Auto-Detect', 'ClientProvider must forward "Auto-Detect"');

  // Test undefined forwarding
  await provider.transcribe(mockPreparedAudio, undefined);
  assert.strictEqual(interceptedLanguage, undefined, 'ClientProvider must forward undefined when not supplied');

  console.log('  ✓ PASSED: WhisperLocalClientProvider forwards sourceLanguage faithfully to Electron IPC.');

  console.log('\n=====================================================');
  console.log(' ALL WHISPER CLI ARGUMENT & LANGUAGE TESTS PASSED! ');
  console.log('=====================================================\n');
}

runWhisperCliArgumentTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});

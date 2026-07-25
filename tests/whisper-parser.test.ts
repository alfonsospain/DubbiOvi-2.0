import { WhisperLocalParser } from '../src/lib/WhisperLocalClientProvider';

async function testWhisperLocalParser() {
  console.log('=====================================================');
  console.log(' STARTING WHISPER LOCAL PARSER TEST SUITE');
  console.log('=====================================================');

  // Test 1: Real whisper-cli output JSON structure (top-level transcription array)
  console.log('\n[Test 1] Testing whisper-cli top-level transcription array schema...');
  const whisperCliJson = {
    systeminfo: 'WHISPER : CPU = 1 | METAL = 1',
    model: {
      type: 'tiny',
      multilingual: true,
    },
    params: {
      model: '/path/to/ggml-tiny.bin',
      language: 'en',
    },
    result: {
      language: 'en',
    },
    transcription: [
      {
        timestamps: {
          from: '00:00:00,000',
          to: '00:00:02,500',
        },
        text: ' Hello and welcome to DubbiOvi.',
      },
      {
        timestamps: {
          from: '00:00:02,500',
          to: '00:00:05,100',
        },
        text: ' This is local speech recognition.',
      },
    ],
  };

  const parsed1 = WhisperLocalParser.parse(whisperCliJson);
  console.log('  ✓ Detected Language:', parsed1.detectedLanguage);
  console.log('  ✓ Total Takes     :', parsed1.takes.length);
  console.log('  ✓ Take 1 Text     :', parsed1.takes[0]?.original);
  console.log('  ✓ Take 1 Duration :', parsed1.takes[0]?.time);
  console.log('  ✓ Take 1 Seconds  :', parsed1.takes[0]?.startSeconds, '->', parsed1.takes[0]?.endSeconds);

  if (parsed1.detectedLanguage !== 'EN') {
    throw new Error('FAILED: Detected language should be EN!');
  }
  if (parsed1.takes.length !== 2) {
    throw new Error(`FAILED: Expected 2 takes, got ${parsed1.takes.length}`);
  }
  if (parsed1.takes[0].original !== 'Hello and welcome to DubbiOvi.') {
    throw new Error(`FAILED: Take 1 text mismatch: ${parsed1.takes[0].original}`);
  }
  if (parsed1.takes[0].startSeconds !== 0 || parsed1.takes[0].endSeconds !== 2.5) {
    throw new Error('FAILED: Take 1 timestamps calculation incorrect!');
  }
  console.log('  ✓ PASSED: whisper-cli top-level schema parsed cleanly.');

  // Test 2: Legacy nested result.transcription array schema
  console.log('\n[Test 2] Testing legacy nested result.transcription schema...');
  const nestedJson = {
    result: {
      language: 'es',
      transcription: [
        {
          timestamps: {
            from: '00:01:10.000',
            to: '00:01:12.500',
          },
          text: ' Hola mundo.',
        },
      ],
    },
  };

  const parsed2 = WhisperLocalParser.parse(nestedJson);
  console.log('  ✓ Detected Language:', parsed2.detectedLanguage);
  console.log('  ✓ Take 1 Text     :', parsed2.takes[0]?.original);

  if (parsed2.detectedLanguage !== 'ES' || parsed2.takes[0].original !== 'Hola mundo.') {
    throw new Error('FAILED: Nested result.transcription schema parsing failed!');
  }
  console.log('  ✓ PASSED: Legacy nested schema parsed cleanly.');

  // Test 3: Pass-through already converted TranscriptResult
  console.log('\n[Test 3] Testing TranscriptResult pass-through...');
  const existingResult = {
    detectedLanguage: 'FR',
    takes: [
      {
        id: 'take-1',
        character: 'Speaker 1',
        time: '00:00:00 - 00:00:01',
        startSeconds: 0,
        endSeconds: 1,
        original: 'Bonjour',
        translation: '',
        notes: '',
        status: 'Pending' as const,
      },
    ],
  };

  const parsed3 = WhisperLocalParser.parse(existingResult);
  if (parsed3.detectedLanguage !== 'FR' || parsed3.takes[0].original !== 'Bonjour') {
    throw new Error('FAILED: Pass-through TranscriptResult failed!');
  }
  console.log('  ✓ PASSED: TranscriptResult pass-through verified.');

  console.log('\n=====================================================');
  console.log(' ALL WHISPER PARSER TESTS PASSED SUCCESSFULLY (100%)');
  console.log('=====================================================');
}

testWhisperLocalParser().catch((err) => {
  console.error('❌ Whisper Parser Test Error:', err);
  process.exit(1);
});

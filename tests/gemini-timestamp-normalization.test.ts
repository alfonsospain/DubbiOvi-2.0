/**
 * Regression Test Suite: Milestone B2.3I — Gemini Timestamp Normalization Fix
 *
 * Verifies:
 * 1. Non-standard Gemini timecodes MM:SS:mmm.xxx (e.g. 01:59:466.890 -> ~119.467s).
 * 2. Preservation of standard HH:MM:SS.mmm and HH:MM:SS,mmm timecodes.
 * 3. Does not classify timestamps as Gemini-specific merely due to decimal points.
 * 4. Explicit handling of ambiguous timestamps (e.g. 00:00:02.190 -> 2.19s without context).
 * 5. Validation of take boundaries (finite, nonnegative, ordered, bounded by media duration).
 * 6. Full 14-take sequence from live video validation fitting within 123s timeline.
 * 7. Preservation of original transcription text, take order, and existing Whisper parser.
 */

import {
  parseGeminiTimestamp,
  isGeminiNonStandardTimecode,
  formatSecondsToTimecode,
  normalizeGeminiTakes,
} from '../src/lib/gemini-asr-helpers';
import { GeminiParser } from '../src/lib/GeminiProvider';
import { parseTimestampToSeconds } from '../src/lib/utils';

function assertApprox(actual: number, expected: number, tolerance = 0.005, desc?: string) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `FAILED: ${desc || 'Value mismatch'}. Expected ~${expected}, got ${actual} (diff: ${Math.abs(actual - expected)})`
    );
  }
}

function assertStrict(actual: any, expected: any, desc?: string) {
  if (actual !== expected) {
    throw new Error(`FAILED: ${desc || 'Assertion failed'}. Expected ${expected}, got ${actual}`);
  }
}

async function runTests() {
  console.log('=== Running Gemini Timestamp Normalization Tests (B2.3I) ===\n');

  // -------------------------------------------------------------
  // Test 1: Non-standard Gemini timecodes MM:SS:mmm.xxx
  // -------------------------------------------------------------
  console.log('[Test 1] Non-standard Gemini timecodes MM:SS:mmm.xxx parsing...');
  // 01:59:466.890 -> 1 min, 59 sec, 466.890 ms -> 119.46689s
  const t1 = parseGeminiTimestamp('01:59:466.890');
  assertApprox(t1, 119.467, 0.001, '01:59:466.890');
  console.log(`  ✓ 01:59:466.890 -> ${t1.toFixed(3)}s`);

  // 00:21:406.890 -> 0 min, 21 sec, 406.890 ms -> 21.40689s
  const t2 = parseGeminiTimestamp('00:21:406.890');
  assertApprox(t2, 21.407, 0.001, '00:21:406.890');
  console.log(`  ✓ 00:21:406.890 -> ${t2.toFixed(3)}s`);

  // 00:13:96.890 -> 0 min, 13 sec, 96.890 ms -> 13.09689s
  const t3 = parseGeminiTimestamp('00:13:96.890');
  assertApprox(t3, 13.097, 0.001, '00:13:96.890');
  console.log(`  ✓ 00:13:96.890 -> ${t3.toFixed(3)}s`);

  // 01:32:006.890 -> 1 min, 32 sec, 6.890 ms -> 92.00689s
  const t4 = parseGeminiTimestamp('01:32:006.890');
  assertApprox(t4, 92.007, 0.001, '01:32:006.890');
  console.log(`  ✓ 01:32:006.890 -> ${t4.toFixed(3)}s`);

  // 02:02:646.890 -> 2 min, 2 sec, 646.890 ms -> 122.64689s
  const t5 = parseGeminiTimestamp('02:02:646.890');
  assertApprox(t5, 122.647, 0.001, '02:02:646.890');
  console.log(`  ✓ 02:02:646.890 -> ${t5.toFixed(3)}s`);

  // -------------------------------------------------------------
  // Test 2: Standard HH:MM:SS.mmm and HH:MM:SS,mmm preservation
  // -------------------------------------------------------------
  console.log('\n[Test 2] Standard timecode format preservation...');
  // Standard HH:MM:SS.mmm (0 hours, 1 min, 59.466s -> 119.466s)
  const std1 = parseGeminiTimestamp('00:01:59.466');
  assertApprox(std1, 119.466, 0.001, '00:01:59.466 (standard dot)');
  console.log(`  ✓ 00:01:59.466 -> ${std1.toFixed(3)}s`);

  // Standard HH:MM:SS,mmm with comma
  const std2 = parseGeminiTimestamp('00:01:59,466');
  assertApprox(std2, 119.466, 0.001, '00:01:59,466 (standard comma)');
  console.log(`  ✓ 00:01:59,466 -> ${std2.toFixed(3)}s`);

  // Multi-hour standard timecode: 01:23:45.678 -> 1h 23m 45.678s -> 5025.678s
  const std3 = parseGeminiTimestamp('01:23:45.678');
  assertApprox(std3, 5025.678, 0.001, '01:23:45.678 (multi-hour standard)');
  console.log(`  ✓ 01:23:45.678 -> ${std3.toFixed(3)}s`);

  // Short format MM:SS.mmm
  const std4 = parseGeminiTimestamp('01:59.466');
  assertApprox(std4, 119.466, 0.001, '01:59.466 (MM:SS.mmm)');
  console.log(`  ✓ 01:59.466 -> ${std4.toFixed(3)}s`);

  // -------------------------------------------------------------
  // Test 3: Decimal point in 3rd component does NOT falsely trigger Gemini mode
  // -------------------------------------------------------------
  console.log('\n[Test 3] False-positive protection (Requirement 5)...');
  assertStrict(isGeminiNonStandardTimecode('00:01:59.466'), false, 'Standard seconds with dot');
  assertStrict(isGeminiNonStandardTimecode('00:00:15.500'), false, 'Standard seconds with .500');
  assertStrict(isGeminiNonStandardTimecode('01:23:45.678'), false, 'Standard hours/min/sec with dot');
  assertStrict(isGeminiNonStandardTimecode('01:59:466.890'), true, 'Gemini ms >= 60');
  assertStrict(isGeminiNonStandardTimecode('00:21:406.890'), true, 'Gemini ms >= 60');
  assertStrict(isGeminiNonStandardTimecode('01:32:006.890'), true, 'Gemini 3-digit ms');
  console.log('  ✓ Standard timestamps with decimal points correctly identified as standard');

  // -------------------------------------------------------------
  // Test 4: Explicit handling of ambiguous timestamps (Requirement 6)
  // -------------------------------------------------------------
  console.log('\n[Test 4] Ambiguous timestamp handling (Requirement 6)...');
  // Without context: "00:00:02.190" must NOT be silently reinterpreted
  const ambigDefault = parseGeminiTimestamp('00:00:02.190');
  assertApprox(ambigDefault, 2.190, 0.001, '00:00:02.190 default (standard interpretation)');
  console.log(`  ✓ 00:00:02.190 without context -> standard ${ambigDefault.toFixed(3)}s`);

  // With explicit force context: "00:00:02.190" reinterpreted as Gemini format
  const ambigForced = parseGeminiTimestamp('00:00:02.190', { forceGeminiFormat: true });
  assertApprox(ambigForced, 0.002, 0.001, '00:00:02.190 forced Gemini format');
  console.log(`  ✓ 00:00:02.190 with explicit context -> Gemini format ${ambigForced.toFixed(3)}s`);

  // Context via media duration conflict:
  // "00:04:46.890": standard = 286.89s (exceeds 123s video). In context of mediaDuration=123, resolves to 4.047s
  const contextDuration = parseGeminiTimestamp('00:04:46.890', { mediaDuration: 123 });
  assertApprox(contextDuration, 4.047, 0.001, '00:04:46.890 with mediaDuration context');
  console.log(`  ✓ 00:04:46.890 with mediaDuration=123 context -> ${contextDuration.toFixed(3)}s`);

  // -------------------------------------------------------------
  // Test 5: Boundary validation (finite, nonnegative, ordered, bounded)
  // -------------------------------------------------------------
  console.log('\n[Test 5] Boundary validation (Requirement 7)...');
  const edgeTakes = normalizeGeminiTakes(
    [
      {
        character: 'Tester',
        startTime: 'invalid',
        endTime: '-00:01:00.000',
        original: 'Negative or invalid',
      },
      {
        character: 'Tester',
        startTime: '00:00:10.000',
        endTime: '00:00:05.000', // Inverted boundaries
        original: 'Inverted',
      },
      {
        character: 'Tester',
        startTime: '00:01:50.000',
        endTime: '00:02:30.000', // Exceeds 120s media duration
        original: 'Exceeding media duration',
      },
    ],
    120 // mediaDuration = 120s
  );

  assertStrict(edgeTakes[0].startSeconds >= 0, true, 'Take 1 startSeconds nonnegative');
  assertStrict(edgeTakes[0].endSeconds >= edgeTakes[0].startSeconds, true, 'Take 1 ordered');
  console.log(`  ✓ Invalid/negative timestamps clamped: [${edgeTakes[0].startSeconds}, ${edgeTakes[0].endSeconds}]`);

  assertStrict(edgeTakes[1].startSeconds <= edgeTakes[1].endSeconds, true, 'Take 2 ordered after inversion');
  console.log(`  ✓ Inverted boundaries resolved: [${edgeTakes[1].startSeconds}, ${edgeTakes[1].endSeconds}]`);

  assertStrict(edgeTakes[2].endSeconds <= 120, true, 'Take 3 clamped to media duration');
  console.log(`  ✓ Media duration boundary clamping: [${edgeTakes[2].startSeconds}, ${edgeTakes[2].endSeconds}]`);

  // -------------------------------------------------------------
  // Test 6: Full 14-take sequence from live video validation (2:03 min = 123s)
  // -------------------------------------------------------------
  console.log('\n[Test 6] Full 14-take live video dataset verification...');
  const liveTakesRaw = [
    { character: 'Speaker 1', startTime: '00:00:02.190', endTime: '00:04:46.890', original: "Discover Forestry Plus, Bayer's new global portfolio..." },
    { character: 'Speaker 1', startTime: '00:09:07.890', endTime: '00:11:47.890', original: 'Forestry Plus goes far beyond products...' },
    { character: 'Speaker 1', startTime: '00:13:96.890', endTime: '00:19:936.890', original: 'Forestry Plus provides additional solutions...' },
    { character: 'Speaker 1', startTime: '00:21:406.890', endTime: '00:26:156.890', original: 'While competitors only offer products, we...' },
    { character: 'Speaker 1', startTime: '00:26:996.890', endTime: '00:31:856.890', original: 'What we found out is that products are...' },
    { character: 'Speaker 1', startTime: '00:32:466.890', endTime: '00:40:596.890', original: "And that's why Forestry Plus offers support..." },
    { character: 'Speaker 1', startTime: '00:41:646.890', endTime: '00:50:236.890', original: 'With so much added value to offer, we...' },
    { character: 'Speaker 1', startTime: '00:50:806.890', endTime: '00:55:966.890', original: 'Forestry Plus is based on four pillars that...' },
    { character: 'Speaker 1', startTime: '00:56:696.890', endTime: '01:08:926.890', original: 'Through regular field and plantation visits...' },
    { character: 'Speaker 1', startTime: '01:10:276.890', endTime: '01:19:786.890', original: 'With our dynamic portfolio, we offer the...' },
    { character: 'Speaker 1', startTime: '01:20:806.890', endTime: '01:30:726.890', original: 'Our commitment to sustainability includes...' },
    { character: 'Speaker 1', startTime: '01:32:006.890', endTime: '01:43:726.890', original: 'We are part of an innovation-driven...' },
    { character: 'Speaker 1', startTime: '01:44:806.890', endTime: '01:54:926.890', original: 'Based on our passion for customers, we...' },
    { character: 'Speaker 1', startTime: '01:59:466.890', endTime: '02:02:646.890', original: 'Bayer, Science for a Better Life.' },
  ];

  const duration = 123.0; // 2 minutes 3 seconds
  const parsedResult = GeminiParser.parse(
    {
      detectedLanguage: 'EN',
      takes: liveTakesRaw,
    },
    duration
  );

  assertStrict(parsedResult.takes.length, 14, 'Take count preserved');
  assertStrict(parsedResult.detectedLanguage, 'EN', 'Detected language preserved');
  assertStrict(parsedResult.metadata.modelName, 'googleai/gemini-3.5-flash-lite', 'Model name preserved');

  console.log('  Normalized Takes Summary on 123s Timeline:');
  console.log('  -------------------------------------------------------------');
  console.log('  Take | Start (s) | End (s)   | Left %   | Width %  | Text preview');
  console.log('  -------------------------------------------------------------');

  parsedResult.takes.forEach((t, i) => {
    // 1. Validate finite & nonnegative
    if (!Number.isFinite(t.startSeconds) || t.startSeconds < 0) {
      throw new Error(`Take ${i + 1} startSeconds is invalid: ${t.startSeconds}`);
    }
    if (!Number.isFinite(t.endSeconds) || t.endSeconds < 0) {
      throw new Error(`Take ${i + 1} endSeconds is invalid: ${t.endSeconds}`);
    }

    // 2. Validate ordering: startSeconds <= endSeconds
    if (t.startSeconds > t.endSeconds) {
      throw new Error(`Take ${i + 1} startSeconds > endSeconds: ${t.startSeconds} > ${t.endSeconds}`);
    }

    // 3. Validate bounded within mediaDuration
    if (t.endSeconds > duration) {
      throw new Error(`Take ${i + 1} endSeconds exceeds media duration: ${t.endSeconds} > ${duration}`);
    }

    // 4. Validate timeline calculation
    const left = (t.startSeconds / duration) * 100;
    const width = ((t.endSeconds - t.startSeconds) / duration) * 100;

    if (left < 0 || left > 100) {
      throw new Error(`Take ${i + 1} left% out of bounds: ${left}%`);
    }
    if (width <= 0 || width > 100) {
      throw new Error(`Take ${i + 1} width% out of bounds: ${width}%`);
    }
    if (left + width > 100.01) {
      throw new Error(`Take ${i + 1} segment extends beyond timeline track: ${left + width}%`);
    }

    // 5. Validate text preservation
    assertStrict(t.original, liveTakesRaw[i].original, `Take ${i + 1} original text preserved`);

    const preview = t.original.slice(0, 25) + '...';
    console.log(
      `  #${String(i + 1).padStart(2, '0')}  | ${t.startSeconds.toFixed(3).padStart(9, ' ')} | ${t.endSeconds.toFixed(3).padStart(9, ' ')} | ${left.toFixed(1).padStart(6, ' ')}%  | ${width.toFixed(1).padStart(6, ' ')}%  | ${preview}`
    );
  });

  // Verify monotonicity across takes
  for (let i = 0; i < parsedResult.takes.length - 1; i++) {
    const cur = parsedResult.takes[i];
    const next = parsedResult.takes[i + 1];
    if (cur.startSeconds > next.startSeconds) {
      throw new Error(
        `Monotonicity violation between Take ${i + 1} (${cur.startSeconds}s) and Take ${i + 2} (${next.startSeconds}s)`
      );
    }
  }
  console.log('  ✓ Monotonic take sequence verified across all 14 takes');

  // -------------------------------------------------------------
  // Test 7: Shared parseTimestampToSeconds and Whisper isolation (Requirement 2)
  // -------------------------------------------------------------
  console.log('\n[Test 7] Shared parseTimestampToSeconds untouched (Requirement 2)...');
  // Whisper uses parseTimestampToSeconds for "00:01:23.450"
  const whisperVal = parseTimestampToSeconds('00:01:23.450');
  assertApprox(whisperVal, 83.45, 0.001, 'Shared parseTimestampToSeconds');
  console.log(`  ✓ parseTimestampToSeconds("00:01:23.450") -> ${whisperVal}s`);

  // Whisper overflow normalization
  const whisperOverflow = parseTimestampToSeconds('00:24:65.050');
  assertApprox(whisperOverflow, 1505.05, 0.001, 'Shared overflow normalization');
  console.log(`  ✓ parseTimestampToSeconds("00:24:65.050") -> ${whisperOverflow}s`);

  console.log('\n=== All Gemini Timestamp Normalization Tests Passed Successfully! ===');
}

runTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});

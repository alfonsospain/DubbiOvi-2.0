import { parseTimestampToSeconds } from '../src/lib/utils';

function runTimestampParserTests() {
  console.log('=====================================================');
  console.log(' STARTING TIMESTAMP PARSER & OVERFLOW TEST SUITE');
  console.log('=====================================================');

  // Test 1: Gemini timestamp overflow "00:24:65.050" -> 1505.05s
  console.log('\n[Test 1] Testing Gemini timestamp overflow (00:24:65.050)...');
  const t1 = parseTimestampToSeconds('00:24:65.050');
  console.log('  ✓ Parsed seconds:', t1);
  if (Math.abs(t1 - 1505.05) > 0.0001) {
    throw new Error(`FAILED: Expected 1505.05, got ${t1}`);
  }
  console.log('  ✓ PASSED: Overflow timestamp "00:24:65.050" correctly calculated to 1505.05 seconds.');

  // Test 2: Standard HH:MM:SS.mmm ("01:05:02.250")
  console.log('\n[Test 2] Testing standard HH:MM:SS.mmm (01:05:02.250)...');
  const t2 = parseTimestampToSeconds('01:05:02.250');
  console.log('  ✓ Parsed seconds:', t2);
  if (Math.abs(t2 - 3902.25) > 0.0001) {
    throw new Error(`FAILED: Expected 3902.25, got ${t2}`);
  }
  console.log('  ✓ PASSED: Standard timestamp parsed correctly.');

  // Test 3: Comma separator ("00:02:15,500")
  console.log('\n[Test 3] Testing comma millisecond separator (00:02:15,500)...');
  const t3 = parseTimestampToSeconds('00:02:15,500');
  console.log('  ✓ Parsed seconds:', t3);
  if (Math.abs(t3 - 135.5) > 0.0001) {
    throw new Error(`FAILED: Expected 135.5, got ${t3}`);
  }
  console.log('  ✓ PASSED: Comma millisecond separator handled.');

  // Test 4: MM:SS.mmm format ("12:34.567")
  console.log('\n[Test 4] Testing MM:SS.mmm format (12:34.567)...');
  const t4 = parseTimestampToSeconds('12:34.567');
  console.log('  ✓ Parsed seconds:', t4);
  if (Math.abs(t4 - (12 * 60 + 34.567)) > 0.0001) {
    throw new Error(`FAILED: Expected 754.567, got ${t4}`);
  }
  console.log('  ✓ PASSED: MM:SS.mmm format parsed correctly.');

  console.log('\n=====================================================');
  console.log(' ALL TIMESTAMP PARSER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runTimestampParserTests();

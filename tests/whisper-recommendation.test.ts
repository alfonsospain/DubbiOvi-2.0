import { WhisperRecommendationService } from '../src/lib/WhisperRecommendationService';

async function runWhisperRecommendationTests() {
  console.log('=====================================================');
  console.log(' STARTING WHISPER RECOMMENDATION SERVICE TEST SUITE');
  console.log('=====================================================');

  // 1. Verify Structured Recommendation Result Format
  console.log('\n[Test 1] Testing getRecommendation()...');
  const result = WhisperRecommendationService.getRecommendation();

  if (!result || typeof result !== 'object') {
    throw new Error('FAILED: getRecommendation did not return an object!');
  }

  if (!result.model || typeof result.model !== 'string') {
    throw new Error('FAILED: RecommendationResult missing valid model property!');
  }

  if (!result.reason || typeof result.reason !== 'string' || result.reason.trim().length === 0) {
    throw new Error('FAILED: RecommendationResult missing valid reason rationale string!');
  }

  console.log(`  ✓ Recommended Model: ${result.model}`);
  console.log(`  ✓ Advisory Rationale: "${result.reason}"`);

  console.log('\n=====================================================');
  console.log(' WHISPER RECOMMENDATION TESTS PASSED (100%)');
  console.log('=====================================================');
}

runWhisperRecommendationTests().catch((err) => {
  console.error('\n❌ WhisperRecommendation Test Error:', err);
  process.exit(1);
});

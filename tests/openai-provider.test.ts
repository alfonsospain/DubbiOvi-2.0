import { OpenAITranscriptionProvider, OpenAIParser } from '../src/lib/OpenAITranscriptionProvider';
import { providerRegistry } from '../src/lib/ProviderRegistry';
import { PreparedAudio } from '../src/lib/transcription-types';

async function testOpenAIProvider() {
  console.log('=====================================================');
  console.log(' STARTING OPENAI TRANSCRIPTION PROVIDER TEST SUITE');
  console.log('=====================================================');

  // Test 1: Provider Registry Registration & Resolution
  console.log('\n[Test 1] Testing ProviderRegistry registration & resolution...');
  const resolvedById = providerRegistry.get('openai-asr');
  const resolvedByAlias1 = providerRegistry.get('OpenAI');
  const resolvedByAlias2 = providerRegistry.get('OpenAI Whisper');

  if (!resolvedById || resolvedById.id !== 'openai-asr') {
    throw new Error('FAILED: Could not resolve openai-asr by ID!');
  }
  if (!resolvedByAlias1 || resolvedByAlias1.id !== 'openai-asr') {
    throw new Error('FAILED: Could not resolve openai-asr by alias "OpenAI"!');
  }
  if (!resolvedByAlias2 || resolvedByAlias2.id !== 'openai-asr') {
    throw new Error('FAILED: Could not resolve openai-asr by alias "OpenAI Whisper"!');
  }
  console.log('  ✓ Provider ID          :', resolvedById.id);
  console.log('  ✓ Provider Name        :', resolvedById.name);
  console.log('  ✓ Requires API Key     :', resolvedById.capabilities.requiresApiKey);
  console.log('  ✓ Is Offline           :', resolvedById.capabilities.isOffline);
  console.log('  ✓ PASSED: Provider registration and alias lookup verified.');

  // Test 2: OpenAIParser Response Parsing (verbose_json segments)
  console.log('\n[Test 2] Testing OpenAIParser verbose_json response parsing...');
  const mockVerboseJson = {
    task: 'transcribe',
    language: 'spanish',
    duration: 12.5,
    text: 'Hola a todos. Bienvenidos al estudio DubbiOvi.',
    segments: [
      {
        id: 0,
        seek: 0,
        start: 0.0,
        end: 3.5,
        text: ' Hola a todos.',
        tokens: [50364, 1234, 50539],
        temperature: 0.0,
      },
      {
        id: 1,
        seek: 350,
        start: 3.5,
        end: 7.25,
        text: ' Bienvenidos al estudio DubbiOvi.',
        tokens: [50539, 5678, 50726],
        temperature: 0.0,
      },
    ],
  };

  const parsed = OpenAIParser.parse(mockVerboseJson);
  console.log('  ✓ Detected Language    :', parsed.detectedLanguage);
  console.log('  ✓ Total Takes          :', parsed.takes.length);
  console.log('  ✓ Take 1 Text          :', parsed.takes[0].original);
  console.log('  ✓ Take 1 Time Range    :', parsed.takes[0].time);
  console.log('  ✓ Take 1 Seconds       :', parsed.takes[0].startSeconds, '->', parsed.takes[0].endSeconds);
  console.log('  ✓ Take 2 Text          :', parsed.takes[1].original);
  console.log('  ✓ Take 2 Time Range    :', parsed.takes[1].time);

  if (parsed.detectedLanguage !== 'SPANISH') {
    throw new Error(`FAILED: Expected SPANISH language, got ${parsed.detectedLanguage}`);
  }
  if (parsed.takes.length !== 2) {
    throw new Error(`FAILED: Expected 2 takes, got ${parsed.takes.length}`);
  }
  if (parsed.takes[0].original !== 'Hola a todos.') {
    throw new Error(`FAILED: Take 1 text mismatch: "${parsed.takes[0].original}"`);
  }
  if (parsed.takes[0].startSeconds !== 0 || parsed.takes[0].endSeconds !== 3.5) {
    throw new Error('FAILED: Take 1 timestamps calculation incorrect!');
  }
  if (parsed.takes[0].time !== '00:00:00.000 - 00:00:03.500') {
    throw new Error(`FAILED: Take 1 time formatting incorrect: "${parsed.takes[0].time}"`);
  }
  console.log('  ✓ PASSED: verbose_json response parsed cleanly.');

  // Test 3: OpenAIParser Fallback (Single Text Segment)
  console.log('\n[Test 3] Testing OpenAIParser fallback single text segment...');
  const mockFallbackJson = {
    text: 'Single segment fallback text.',
    language: 'en',
    duration: 4.2,
  };
  const parsedFallback = OpenAIParser.parse(mockFallbackJson);
  if (parsedFallback.takes.length !== 1 || parsedFallback.takes[0].original !== 'Single segment fallback text.') {
    throw new Error('FAILED: Single segment fallback parsing failed!');
  }
  console.log('  ✓ PASSED: Fallback single segment parsing verified.');

  // Test 4: Missing API Key Handling
  console.log('\n[Test 4] Testing missing API Key error handling...');
  const provider = new OpenAITranscriptionProvider();
  const mockBlob = new Blob(['mock audio data'], { type: 'audio/wav' });
  const mockPreparedAudio: PreparedAudio = {
    blob: mockBlob,
    format: 'wav',
    duration: 5.0,
    sampleRate: 16000,
    channels: 1,
  };

  try {
    await provider.transcribe(mockPreparedAudio, 'auto', '');
    throw new Error('FAILED: Transcribe should have thrown when API key is missing!');
  } catch (err: any) {
    console.log('  ✓ Caught expected error:', err.message);
    if (!err.message.includes('API key is required')) {
      throw new Error(`FAILED: Unexpected error message: ${err.message}`);
    }
  }
  console.log('  ✓ PASSED: Missing API key cleanly rejected.');

  // Test 5: HTTP Error Responses (401 Unauthorized, 429 Rate Limit)
  console.log('\n[Test 5] Testing HTTP 401 & 429 API error handling...');
  const originalFetch = global.fetch;

  // Mock 401
  global.fetch = (async () => {
    return {
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'Incorrect API key provided' } }),
      json: async () => ({ error: { message: 'Incorrect API key provided' } }),
    } as Response;
  }) as any;

  try {
    await provider.transcribe(mockPreparedAudio, 'auto', 'invalid-sk');
    throw new Error('FAILED: Transcribe should have thrown on 401!');
  } catch (err: any) {
    console.log('  ✓ Caught expected 401 error:', err.message);
    if (!err.message.includes('Invalid OpenAI API Key')) {
      throw new Error(`FAILED: Unexpected error message: ${err.message}`);
    }
  }

  // Mock 429
  global.fetch = (async () => {
    return {
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({ error: { message: 'Rate limit reached' } }),
      json: async () => ({ error: { message: 'Rate limit reached' } }),
    } as Response;
  }) as any;

  try {
    await provider.transcribe(mockPreparedAudio, 'auto', 'sk-valid-key');
    throw new Error('FAILED: Transcribe should have thrown on 429!');
  } catch (err: any) {
    console.log('  ✓ Caught expected 429 error:', err.message);
    if (!err.message.includes('rate limit exceeded')) {
      throw new Error(`FAILED: Unexpected error message: ${err.message}`);
    }
  }

  // Restore fetch
  global.fetch = originalFetch;
  console.log('  ✓ PASSED: HTTP error status responses handled correctly.');

  console.log('\n=====================================================');
  console.log(' ALL OPENAI TRANSCRIPTION PROVIDER TESTS PASSED (100%)');
  console.log('=====================================================');
}

testOpenAIProvider().catch((err) => {
  console.error('❌ OpenAI Provider Test Error:', err);
  process.exit(1);
});

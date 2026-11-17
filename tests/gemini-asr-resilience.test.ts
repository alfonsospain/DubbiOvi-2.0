import { getAudioTranscription } from '../src/app/actions';
import {
  sanitizeGeminiError,
  classifyGeminiAsrError,
  type AudioTranscriptionResult,
} from '../src/lib/gemini-asr-helpers';
import { GeminiProvider, GeminiParser } from '../src/lib/GeminiProvider';
import type { PreparedAudio } from '../src/lib/transcription-types';

function createDummyAudioBlob(): Blob {
  // Minimal valid 44-byte WAV header
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(16000, 24); // Sample rate 16000
  header.writeUInt32LE(32000, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write('data', 36);
  header.writeUInt32LE(0, 40); // 0 bytes data
  return new Blob([header], { type: 'audio/wav' });
}

function createDummyPreparedAudio(): PreparedAudio {
  return {
    blob: createDummyAudioBlob(),
    mimeType: 'audio/wav',
    sampleRate: 16000,
    channels: 1,
    duration: 1.0,
    format: 'wav',
    normalizationApplied: false,
    sourceFileName: 'test.mp4',
  };
}

function createFormData(apiKey: string = 'test-api-key-12345'): FormData {
  const formData = new FormData();
  formData.append('audio', createDummyAudioBlob(), 'test.wav');
  formData.append('sourceLang', 'EN');
  formData.append('apiKey', apiKey);
  return formData;
}

async function runGeminiAsrResilienceTests() {
  console.log('=====================================================');
  console.log(' STARTING GEMINI ASR ERROR TRANSPARENCY & RESILIENCE TESTS');
  console.log('=====================================================');

  const originalFetch = globalThis.fetch;

  try {
    // -------------------------------------------------------------
    // Test 1: Successful transcription pipeline
    // -------------------------------------------------------------
    console.log('\n[Test 1] Successful Gemini ASR transcription...');
    let fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedLanguage: 'EN',
                      takes: [
                        {
                          character: 'Narrator',
                          startTime: '00:00:01.000',
                          endTime: '00:00:04.250',
                          original: 'Welcome to DubbiOvi transcription.',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const successRes = await getAudioTranscription(createFormData(), 10);
    if (!successRes.success) {
      throw new Error(`Expected success, got error: ${successRes.error}`);
    }
    if (successRes.data.detectedLanguage !== 'EN') {
      throw new Error(`Expected detectedLanguage EN, got: ${successRes.data.detectedLanguage}`);
    }
    if (successRes.data.takes.length !== 1 || successRes.data.takes[0].original !== 'Welcome to DubbiOvi transcription.') {
      throw new Error(`Unexpected takes structure: ${JSON.stringify(successRes.data.takes)}`);
    }

    // Verify through GeminiProvider.transcribe
    const provider = new GeminiProvider();
    const transcriptResult = await provider.transcribe(createDummyPreparedAudio(), 'EN', 'test-key');
    if (!transcriptResult || transcriptResult.takes.length !== 1) {
      throw new Error('GeminiProvider.transcribe failed to return mapped takes');
    }
    if (transcriptResult.takes[0].character !== 'Narrator' || transcriptResult.takes[0].time !== '00:00:01.000 - 00:00:04.250') {
      throw new Error(`Incorrect GeminiProvider mapping: ${JSON.stringify(transcriptResult.takes[0])}`);
    }
    console.log('  ✓ Successfully transcribed audio and mapped domain takes via GeminiProvider.');

    // -------------------------------------------------------------
    // Test 2: HTTP 503 followed by successful retry (Controlled 1-retry)
    // -------------------------------------------------------------
    console.log('\n[Test 2] HTTP 503 followed by successful retry...');
    fetchCount = 0;
    const err503Payload = {
      error: {
        code: 503,
        message: 'This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.',
        status: 'UNAVAILABLE',
      },
    };

    globalThis.fetch = (async () => {
      fetchCount++;
      if (fetchCount === 1) {
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          text: async () => JSON.stringify(err503Payload),
          json: async () => err503Payload,
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedLanguage: 'ES',
                      takes: [
                        {
                          character: 'Speaker 1',
                          startTime: '00:00:00.500',
                          endTime: '00:00:02.000',
                          original: 'Hola mundo.',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedLanguage: 'ES',
                      takes: [
                        {
                          character: 'Speaker 1',
                          startTime: '00:00:00.500',
                          endTime: '00:00:02.000',
                          original: 'Hola mundo.',
                        },
                      ],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const retryRes = await getAudioTranscription(createFormData(), 20); // 20ms delay for fast test
    if (!retryRes.success) {
      throw new Error(`Expected retry to succeed, got failure: ${retryRes.error}`);
    }
    if (fetchCount !== 2) {
      throw new Error(`Expected exactly 2 fetch calls (1 initial + 1 retry), got ${fetchCount}`);
    }
    if (retryRes.data.detectedLanguage !== 'ES' || retryRes.data.takes[0].original !== 'Hola mundo.') {
      throw new Error(`Unexpected retry data: ${JSON.stringify(retryRes.data)}`);
    }
    console.log(`  ✓ HTTP 503 absorbed by single controlled retry (total calls: ${fetchCount}).`);

    // -------------------------------------------------------------
    // Test 3: Repeated HTTP 503 with clear user-facing error
    // -------------------------------------------------------------
    console.log('\n[Test 3] Repeated HTTP 503 with actionable error...');
    fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        text: async () => JSON.stringify(err503Payload),
        json: async () => err503Payload,
      } as Response;
    }) as any;

    const repeated503Res = await getAudioTranscription(createFormData(), 20);
    if (repeated503Res.success) {
      throw new Error('Expected repeated 503 to return failure!');
    }
    if (fetchCount !== 2) {
      throw new Error(`Expected exactly 2 fetch calls (bounded 1 retry), got ${fetchCount}`);
    }
    if (!repeated503Res.error.includes('temporarily unavailable due to high demand (HTTP 503)')) {
      throw new Error(`Expected actionable 503 error message, got: ${repeated503Res.error}`);
    }
    if (repeated503Res.statusCode !== 503) {
      throw new Error(`Expected statusCode 503, got: ${repeated503Res.statusCode}`);
    }

    // Verify GeminiProvider throws actionable error instead of "No response from AI service"
    let thrownErrorMsg = '';
    try {
      await provider.transcribe(createDummyPreparedAudio(), 'EN', 'test-key');
    } catch (err: any) {
      thrownErrorMsg = err.message;
    }
    if (thrownErrorMsg.includes('No response from AI service')) {
      throw new Error(`FAILED: Masking error "No response from AI service" was still thrown!`);
    }
    if (!thrownErrorMsg.includes('temporarily unavailable due to high demand (HTTP 503)')) {
      throw new Error(`Expected actionable 503 message from GeminiProvider, got: ${thrownErrorMsg}`);
    }
    console.log(`  ✓ Repeated 503 correctly returned actionable diagnostic message: "${thrownErrorMsg}"`);

    // -------------------------------------------------------------
    // Test 4: HTTP 429 without inappropriate retries
    // -------------------------------------------------------------
    console.log('\n[Test 4] HTTP 429 quota exhaustion without retry...');
    fetchCount = 0;
    const err429Payload = {
      error: {
        code: 429,
        message: 'RESOURCE_EXHAUSTED: Quota exceeded for quota metric GenerateContent.',
        status: 'RESOURCE_EXHAUSTED',
      },
    };
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => JSON.stringify(err429Payload),
        json: async () => err429Payload,
      } as Response;
    }) as any;

    const quotaRes = await getAudioTranscription(createFormData(), 20);
    if (quotaRes.success) {
      throw new Error('Expected HTTP 429 to return failure!');
    }
    if (fetchCount !== 1) {
      throw new Error(`Expected exactly 1 fetch call (HTTP 429 must NOT be retried), got ${fetchCount}`);
    }
    if (!quotaRes.error.includes('quota or rate limit exceeded (HTTP 429)')) {
      throw new Error(`Expected 429 quota error message, got: ${quotaRes.error}`);
    }
    if (quotaRes.statusCode !== 429) {
      throw new Error(`Expected statusCode 429, got: ${quotaRes.statusCode}`);
    }
    console.log(`  ✓ HTTP 429 handled immediately without inappropriate retries (total calls: ${fetchCount}).`);

    // -------------------------------------------------------------
    // Test 5: Invalid API key without retries
    // -------------------------------------------------------------
    console.log('\n[Test 5] Invalid API key without retry...');
    fetchCount = 0;
    const err400Payload = {
      error: {
        code: 400,
        message: 'API key not valid. Please pass a valid API key.',
        status: 'INVALID_ARGUMENT',
      },
    };
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: async () => JSON.stringify(err400Payload),
        json: async () => err400Payload,
      } as Response;
    }) as any;

    const invalidKeyRes = await getAudioTranscription(createFormData(), 20);
    if (invalidKeyRes.success) {
      throw new Error('Expected invalid API key to return failure!');
    }
    if (fetchCount !== 1) {
      throw new Error(`Expected exactly 1 fetch call (auth failure must NOT be retried), got ${fetchCount}`);
    }
    if (!invalidKeyRes.error.includes('Invalid or missing Google Gemini API key')) {
      throw new Error(`Expected auth error message, got: ${invalidKeyRes.error}`);
    }
    console.log(`  ✓ Authentication failure mapped cleanly without retries (total calls: ${fetchCount}).`);

    // -------------------------------------------------------------
    // Test 6: Empty takes array (silence / unintelligible audio)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Empty takes array preserved without fabrication...');
    fetchCount = 0;
    globalThis.fetch = (async () => {
      fetchCount++;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      detectedLanguage: 'EN',
                      takes: [],
                    }),
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const emptyRes = await getAudioTranscription(createFormData(), 20);
    if (!emptyRes.success) {
      throw new Error(`Expected empty takes response to succeed, got: ${emptyRes.error}`);
    }
    if (emptyRes.data.takes.length !== 0) {
      throw new Error(`Expected takes to be empty array, got: ${JSON.stringify(emptyRes.data.takes)}`);
    }

    const emptyTranscript = await provider.transcribe(createDummyPreparedAudio(), 'EN', 'test-key');
    if (emptyTranscript.takes.length !== 0) {
      throw new Error(`Expected GeminiProvider.transcribe to return 0 takes, got ${emptyTranscript.takes.length}`);
    }
    console.log('  ✓ Empty takes response preserved cleanly for downstream silence detection.');

    // -------------------------------------------------------------
    // Test 7: No API key leakage in errors or logs
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verify API key is redacted from error messages...');
    const sensitiveKey = 'AIzaSyBN_SECRET_KEY_1234567890ABCDE';
    const rawErrorWithKey = `Error fetching from https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${sensitiveKey}: [500 Internal Error]`;

    const sanitized = sanitizeGeminiError(rawErrorWithKey, sensitiveKey);
    if (sanitized.includes(sensitiveKey)) {
      throw new Error(`FAILED: Sensitive key leaked in sanitized message: ${sanitized}`);
    }
    if (!sanitized.includes('key=[REDACTED]')) {
      throw new Error(`FAILED: Expected key parameter to be replaced with [REDACTED], got: ${sanitized}`);
    }

    const classified = classifyGeminiAsrError(new Error(rawErrorWithKey), sensitiveKey);
    if (classified.error.includes(sensitiveKey)) {
      throw new Error(`FAILED: Sensitive key leaked in classified error: ${classified.error}`);
    }
    console.log('  ✓ Confirmed API credentials are comprehensively redacted from all error outputs.');

    console.log('\n=====================================================');
    console.log(' ALL GEMINI ASR RESILIENCE TESTS PASSED (100%)');
    console.log('=====================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runGeminiAsrResilienceTests().catch((err) => {
  console.error('\n❌ Gemini ASR Resilience Test Error:', err);
  process.exit(1);
});

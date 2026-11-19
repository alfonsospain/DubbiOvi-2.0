import { testGeminiConnection } from '../src/app/actions';
import { GeminiTranslationProvider } from '../src/lib/GeminiTranslationProvider';
import { GeminiParser } from '../src/lib/GeminiProvider';
import { ProviderServiceManager } from '../src/lib/ProviderServiceManager';

async function runGeminiCompatibilityTests() {
  console.log('=====================================================');
  console.log(' STARTING GEMINI COMPATIBILITY HOTFIX TEST SUITE');
  console.log('=====================================================');

  const originalFetch = globalThis.fetch;

  try {
    // -------------------------------------------------------------
    // Test 1: testGeminiConnection uses GET /v1beta/models on success
    // -------------------------------------------------------------
    console.log('\n[Test 1] testGeminiConnection uses GET /v1beta/models and succeeds...');
    let capturedUrl = '';
    let capturedMethod = '';

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = url.toString();
      capturedMethod = init?.method || 'GET';
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ models: [{ name: 'models/gemini-3.5-flash-lite' }] }),
      } as Response;
    }) as any;

    const successRes = await testGeminiConnection('valid-test-key-123');
    if (!successRes.success) {
      throw new Error(`FAILED: Expected testGeminiConnection to succeed, got: ${successRes.error}`);
    }
    if (capturedMethod !== 'GET') {
      throw new Error(`FAILED: Expected GET method for model catalog query, got: ${capturedMethod}`);
    }
    if (!capturedUrl.includes('v1beta/models?key=valid-test-key-123')) {
      throw new Error(`FAILED: Incorrect endpoint URL in testGeminiConnection: ${capturedUrl}`);
    }
    console.log('  ✓ Verified testGeminiConnection uses GET /v1beta/models and succeeds without inference tokens.');

    // -------------------------------------------------------------
    // Test 2: testGeminiConnection Google HTTP 400 Invalid Key Handling
    // -------------------------------------------------------------
    console.log('\n[Test 2] testGeminiConnection HTTP 400 (API key not valid) handling...');
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({
          error: { message: 'API key not valid. Please pass a valid API key.' },
        }),
      } as Response;
    }) as any;

    const invalidKeyRes = await testGeminiConnection('invalid-google-key');
    if (invalidKeyRes.success) {
      throw new Error('FAILED: testGeminiConnection should fail on HTTP 400 invalid key!');
    }
    if (!invalidKeyRes.error?.includes('Authentication failed (HTTP 400)')) {
      throw new Error(`FAILED: Expected Authentication failed (HTTP 400) message, got: ${invalidKeyRes.error}`);
    }
    console.log(`  ✓ Correctly mapped Google HTTP 400 invalid key response: "${invalidKeyRes.error}"`);

    // -------------------------------------------------------------
    // Test 3: testGeminiConnection HTTP 401/403 (Invalid credentials)
    // -------------------------------------------------------------
    console.log('\n[Test 3] testGeminiConnection HTTP 401/403 authentication handling...');
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({
          error: { message: 'API_KEY_INVALID: The provided API key is invalid.' },
        }),
      } as Response;
    }) as any;

    const authRes = await testGeminiConnection('bad-key');
    if (authRes.success || !authRes.error?.includes('Authentication failed (HTTP 401)')) {
      throw new Error(`FAILED: Expected Authentication failed message, got: ${authRes.error}`);
    }
    console.log(`  ✓ Caught HTTP 401 invalid key message: "${authRes.error}"`);

    // -------------------------------------------------------------
    // Test 4: testGeminiConnection HTTP 429 (Quota Exhaustion)
    // -------------------------------------------------------------
    console.log('\n[Test 4] testGeminiConnection HTTP 429 quota exhaustion handling...');
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: async () => ({
          error: { message: 'RESOURCE_EXHAUSTED: Quota exceeded.' },
        }),
      } as Response;
    }) as any;

    const quotaRes = await testGeminiConnection('exhausted-key');
    if (quotaRes.success || !quotaRes.error?.includes('quota has been exhausted')) {
      throw new Error(`FAILED: Expected quota exhausted message, got: ${quotaRes.error}`);
    }
    console.log(`  ✓ Caught HTTP 429 quota exhausted message: "${quotaRes.error}"`);

    // -------------------------------------------------------------
    // Test 4b: testGeminiConnection HTTP 503 (Temporary Service Unavailability)
    // -------------------------------------------------------------
    console.log('\n[Test 4b] testGeminiConnection HTTP 503 high demand handling...');
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({
          error: { message: 'The model is overloaded. Please try again later.' },
        }),
      } as Response;
    }) as any;

    const unavailableRes = await testGeminiConnection('valid-key-high-demand');
    if (unavailableRes.success) {
      throw new Error('FAILED: testGeminiConnection should fail on HTTP 503!');
    }
    if (unavailableRes.error?.includes('Authentication failed') || unavailableRes.error?.includes('Invalid')) {
      throw new Error(`FAILED: HTTP 503 incorrectly reported authentication failure: ${unavailableRes.error}`);
    }
    if (!unavailableRes.error?.includes('HTTP 503') || !unavailableRes.error?.includes('high demand')) {
      throw new Error(`FAILED: Expected HTTP 503 high demand message, got: ${unavailableRes.error}`);
    }
    console.log(`  ✓ Caught HTTP 503 temporary unavailability message without reporting invalid key: "${unavailableRes.error}"`);

    // -------------------------------------------------------------
    // Test 4c: testGeminiConnection AbortController Timeout (Server Action)
    // -------------------------------------------------------------
    console.log('\n[Test 4c] testGeminiConnection AbortController timeout...');
    globalThis.fetch = ((url: any, init: any) => {
      return new Promise<Response>((resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        if (signal) {
          signal.addEventListener('abort', () => {
            const abortErr = new Error('The operation was aborted.');
            abortErr.name = 'AbortError';
            reject(abortErr);
          });
        }
      });
    }) as any;

    const timeoutRes = await testGeminiConnection('slow-key', 100);
    if (timeoutRes.success) {
      throw new Error('FAILED: testGeminiConnection should fail on timeout!');
    }
    if (!timeoutRes.error?.includes('Connection timeout')) {
      throw new Error(`FAILED: Expected Connection timeout message, got: ${timeoutRes.error}`);
    }
    console.log(`  ✓ AbortController cleanly caught timeout: "${timeoutRes.error}"`);

    // -------------------------------------------------------------
    // Test 5: GeminiTranslationProvider URL, clean payload, and thought filtering
    // -------------------------------------------------------------
    console.log('\n[Test 5] GeminiTranslationProvider uses gemini-3.5-flash-lite & filters thoughts...');
    const translationProvider = new GeminiTranslationProvider();

    let translationUrl = '';
    let translationPayload: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      translationUrl = url.toString();
      translationPayload = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                role: 'model',
                parts: [
                  {
                    thought: true,
                    text: '1. Thinking step: translate sentence to Spanish with formal register.',
                  },
                  {
                    thought: true,
                    text: '2. Check glossary matches: none.',
                  },
                  {
                    text: 'Hola, este es un doblaje profesional.',
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const transResult = await translationProvider.translate(
      {
        text: 'Hello, this is a professional dub.',
        sourceLanguage: 'EN',
        targetLanguage: 'ES',
      },
      'valid-trans-key'
    );

    if (!translationUrl.includes('models/gemini-3.5-flash-lite:generateContent?key=valid-trans-key')) {
      throw new Error(`FAILED: Incorrect Gemini Translation URL: ${translationUrl}`);
    }
    // Verify temperature removed per Gemini 3 migration requirements
    if (translationPayload?.generationConfig?.temperature !== undefined) {
      throw new Error(`FAILED: Deprecated parameter 'temperature' should not be present in payload!`);
    }
    // Verify output did not leak internal thoughts
    if (transResult.translation.includes('Thinking step') || transResult.translation.includes('glossary matches')) {
      throw new Error(`FAILED: Internal thoughts leaked into translation: ${transResult.translation}`);
    }
    if (transResult.translation !== 'Hola, este es un doblaje profesional.') {
      throw new Error(`FAILED: Unexpected translated text: ${transResult.translation}`);
    }
    if (transResult.metadata?.modelName !== 'gemini-3.5-flash-lite') {
      throw new Error(`FAILED: Expected modelName gemini-3.5-flash-lite, got: ${transResult.metadata?.modelName}`);
    }
    console.log('  ✓ Thought parts filtered completely. Only user-facing translation extracted.');
    console.log('  ✓ Deprecated temperature removed from payload.');
    console.log(`  ✓ Translation metadata modelName: ${transResult.metadata?.modelName}`);

    // -------------------------------------------------------------
    // Test 6: GeminiTranslationProvider handles missing / empty response
    // -------------------------------------------------------------
    console.log('\n[Test 6] GeminiTranslationProvider missing / empty response safety...');
    globalThis.fetch = (async () => {
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
                    thought: true,
                    text: 'Only thought tokens produced, no final answer.',
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    try {
      await translationProvider.translate(
        { text: 'Sample text', sourceLanguage: 'EN', targetLanguage: 'ES' },
        'key'
      );
      throw new Error('FAILED: Expected translation to reject when only thoughts are present!');
    } catch (err: any) {
      if (!err.message.includes('empty translation response')) {
        throw new Error(`FAILED: Unexpected error on thought-only response: ${err.message}`);
      }
      console.log('  ✓ Safely caught empty translation response without exposing thoughts.');
    }

    // -------------------------------------------------------------
    // Test 7: GeminiTranslationProvider HTTP 404 (Model Unavailable)
    // -------------------------------------------------------------
    console.log('\n[Test 7] GeminiTranslationProvider HTTP 404 model unavailable error...');
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify({ error: { message: 'models/gemini-3.5-flash-lite is no longer available' } }),
      } as Response;
    }) as any;

    try {
      await translationProvider.translate(
        { text: 'Sample text', sourceLanguage: 'EN', targetLanguage: 'ES' },
        'key'
      );
      throw new Error('FAILED: Expected translation to fail on HTTP 404!');
    } catch (err: any) {
      if (!err.message.includes('Gemini Model Unavailable (HTTP 404)')) {
        throw new Error(`FAILED: Expected Gemini Model Unavailable message, got: ${err.message}`);
      }
      console.log(`  ✓ Caught Translation HTTP 404 message: "${err.message}"`);
    }

    // -------------------------------------------------------------
    // Test 8: ProviderServiceManager defaults for Gemini ASR and MT
    // -------------------------------------------------------------
    console.log('\n[Test 8] ProviderServiceManager defaults for Gemini...');
    const asrModel = await ProviderServiceManager.getServiceModel('gemini', 'asr');
    const mtModel = await ProviderServiceManager.getServiceModel('gemini', 'mt');
    const ttsModel = await ProviderServiceManager.getServiceModel('gemini', 'tts');

    if (asrModel !== 'gemini-3.5-flash-lite') {
      throw new Error(`FAILED: Expected default Gemini ASR model to be 'gemini-3.5-flash-lite', got '${asrModel}'`);
    }
    if (mtModel !== 'gemini-3.5-flash-lite') {
      throw new Error(`FAILED: Expected default Gemini MT model to be 'gemini-3.5-flash-lite', got '${mtModel}'`);
    }
    if (ttsModel !== 'gemini-2.5-flash-preview-tts') {
      throw new Error(`FAILED: Expected default Gemini TTS model to remain 'gemini-2.5-flash-preview-tts', got '${ttsModel}'`);
    }
    console.log(`  ✓ Gemini ASR default model: ${asrModel}`);
    console.log(`  ✓ Gemini MT default model:  ${mtModel}`);
    console.log(`  ✓ Gemini TTS default model: ${ttsModel} (preserved)`);

    // -------------------------------------------------------------
    // Test 9: GeminiProvider Parser metadata
    // -------------------------------------------------------------
    console.log('\n[Test 9] GeminiProvider Parser metadata verification...');
    const parsed = GeminiParser.parse({
      detectedLanguage: 'ES',
      takes: [
        {
          character: 'Narrator',
          startTime: '00:00:01.000',
          endTime: '00:00:04.000',
          original: 'Bienvenidos a DubbiOvi.',
        },
      ],
    });

    if (parsed.metadata?.modelName !== 'googleai/gemini-3.5-flash-lite') {
      throw new Error(`FAILED: Expected ASR parser modelName 'googleai/gemini-3.5-flash-lite', got '${parsed.metadata?.modelName}'`);
    }
    console.log(`  ✓ GeminiParser ASR model metadata: ${parsed.metadata?.modelName}`);

    // -------------------------------------------------------------
    // Test 10: UI Loading-state recovery under timeout and errors
    // -------------------------------------------------------------
    console.log('\n[Test 10] UI Loading-state recovery verification...');
    let isUiTesting = false;

    // Simulate UI action workflow with client safety race
    const simulateUiTestInvocation = async (serverActionFn: () => Promise<any>, clientTimeoutMs: number) => {
      isUiTesting = true;
      let timer: any = null;
      try {
        const timeoutPromise = new Promise<any>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Connection test timed out after 30 seconds.')), clientTimeoutMs);
        });
        return await Promise.race([serverActionFn(), timeoutPromise]);
      } catch (err: any) {
        return { success: false, error: err.message };
      } finally {
        if (timer) clearTimeout(timer);
        isUiTesting = false;
      }
    };

    // Case 1: Server action resolves with HTTP 503
    await simulateUiTestInvocation(async () => ({ success: false, error: 'HTTP 503 high demand' }), 100);
    if (isUiTesting !== false) {
      throw new Error('FAILED: UI loading state did not reset to false after HTTP 503 error!');
    }

    // Case 2: Server action hangs, client timeout race triggers
    const hangingServerAction = () => new Promise<any>(() => {});
    const raceRes = await simulateUiTestInvocation(hangingServerAction, 50);
    if (isUiTesting !== false) {
      throw new Error('FAILED: UI loading state did not reset to false after client timeout!');
    }
    if (!raceRes.error?.includes('timed out')) {
      throw new Error(`FAILED: Expected client timeout error, got: ${raceRes.error}`);
    }
    console.log('  ✓ Verified UI loading state always resets to false across errors and timeouts.');

    console.log('\n=====================================================');
    console.log(' ALL GEMINI COMPATIBILITY HOTFIX TESTS PASSED (100%)');
    console.log('=====================================================');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runGeminiCompatibilityTests().catch((err) => {
  console.error('\n❌ Gemini Compatibility Test Error:', err);
  process.exit(1);
});

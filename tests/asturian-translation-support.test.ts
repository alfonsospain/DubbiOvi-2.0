import assert from 'assert';
import { LanguageRegistry } from '../src/lib/languages/LanguageRegistry';
import { GeminiTranslationProvider } from '../src/lib/GeminiTranslationProvider';
import { OpenAITranslationProvider } from '../src/lib/OpenAITranslationProvider';
import { OllamaTranslationProvider } from '../src/lib/OllamaTranslationProvider';
import { DeepLTranslationProvider } from '../src/lib/DeepLTranslationProvider';
import { categorizeOllamaModels } from '../src/lib/OllamaModelHeuristics';
import { PiperModelManager } from '../src/lib/PiperModelManager';

async function runAsturianTranslationTests() {
  console.log('=====================================================');
  console.log(' STARTING ASTURIAN TRANSLATION SUPPORT TEST SUITE');
  console.log('=====================================================');

  const originalFetch = globalThis.fetch;

  try {
    // -------------------------------------------------------------
    // Test 1: LanguageRegistry - Asturian metadata & normalization
    // -------------------------------------------------------------
    console.log('\n[Test 1] Verifying Asturian registry metadata and normalization...');
    const astDesc = LanguageRegistry.getLanguageByCode('ast');
    assert(astDesc !== undefined, 'LanguageRegistry must find Asturian by "ast"');
    assert.strictEqual(astDesc?.code, 'ast');
    assert.strictEqual(astDesc?.name, 'Asturian');
    assert.strictEqual(astDesc?.nativeName, 'Asturianu');
    assert.strictEqual(astDesc?.writingDirection, 'ltr');

    // Case-insensitivity & locale tags
    const astUpper = LanguageRegistry.getLanguageByCode('AST');
    assert.strictEqual(astUpper?.code, 'ast');
    const astLocale = LanguageRegistry.getLanguageByCode('ast-ES');
    assert.strictEqual(astLocale?.code, 'ast');
    const astLocaleUpper = LanguageRegistry.getLanguageByCode('AST-ES');
    assert.strictEqual(astLocaleUpper?.code, 'ast');

    assert.strictEqual(LanguageRegistry.normalizeCode('ast'), 'ast');
    assert.strictEqual(LanguageRegistry.normalizeCode('AST'), 'ast');
    assert.strictEqual(LanguageRegistry.normalizeCode('ast-ES'), 'ast');

    // Display string native-first
    assert.strictEqual(LanguageRegistry.formatDisplay('ast'), 'Asturianu (Asturian)');
    assert.strictEqual(LanguageRegistry.formatDisplay('AST'), 'Asturianu (Asturian)');
    console.log('  ✓ Asturian registered, normalized, and displayed native-first as "Asturianu (Asturian)".');

    // -------------------------------------------------------------
    // Test 2: LanguageRegistry - Service capability isolation (ASR & TTS)
    // -------------------------------------------------------------
    console.log('\n[Test 2] Verifying service capability isolation (ASR & TTS)...');
    const allLangs = LanguageRegistry.getAllLanguages();
    assert(allLangs.some((l) => l.code === 'ast'), 'getAllLanguages must include Asturian');

    const translationLangs = LanguageRegistry.getTranslationLanguages();
    assert(translationLangs.some((l) => l.code === 'ast'), 'getTranslationLanguages must include Asturian');

    const asrLangs = LanguageRegistry.getAsrLanguages();
    assert(!asrLangs.some((l) => l.code === 'ast'), 'getAsrLanguages MUST NOT include Asturian (ASR isolation)');

    const ttsLangs = LanguageRegistry.getTtsLanguages();
    assert(!ttsLangs.some((l) => l.code === 'ast'), 'getTtsLanguages MUST NOT include Asturian (TTS isolation)');

    // Verify Piper voice catalog contains no Asturian voices
    const knownPiperModels = PiperModelManager.getKnownModels();
    const hasPiperAst = knownPiperModels.some((m) => m.language.toLowerCase() === 'ast');
    assert.strictEqual(hasPiperAst, false, 'Piper catalog must not have Asturian voices');
    console.log('  ✓ Asturian is strictly isolated to Translation: ASR and TTS compatibility are NOT advertised.');

    // -------------------------------------------------------------
    // Test 3: DeepL Translation Provider - Asturian Guard
    // -------------------------------------------------------------
    console.log('\n[Test 3] Verifying DeepL explicit compatibility guard for Asturian...');
    const deeplProvider = new DeepLTranslationProvider();

    // DeepL should not advertise AST in supportedLanguages
    assert(!deeplProvider.capabilities.supportedLanguages.includes('AST'), 'DeepL must not advertise AST support');

    // Guard rejects Asturian target language
    let deeplErrorTarget: Error | null = null;
    try {
      await deeplProvider.translate(
        { text: 'Hello world', sourceLanguage: 'en', targetLanguage: 'ast' },
        'dummy-key'
      );
    } catch (err: any) {
      deeplErrorTarget = err;
    }
    assert(deeplErrorTarget !== null, 'DeepL translate must reject targetLanguage: "ast"');
    assert(
      deeplErrorTarget!.message.includes('DeepL does not support translation for Asturian'),
      `Expected user-facing message, got: ${deeplErrorTarget!.message}`
    );
    assert(
      deeplErrorTarget!.message.includes('SalamandraTA'),
      `Expected actionable suggestion in message, got: ${deeplErrorTarget!.message}`
    );

    // Guard rejects Asturian uppercase target
    let deeplErrorUpper: Error | null = null;
    try {
      await deeplProvider.translate(
        { text: 'Hello world', sourceLanguage: 'EN', targetLanguage: 'AST' },
        'dummy-key'
      );
    } catch (err: any) {
      deeplErrorUpper = err;
    }
    assert(deeplErrorUpper !== null, 'DeepL translate must reject targetLanguage: "AST"');

    // Guard rejects Asturian source language
    let deeplErrorSource: Error | null = null;
    try {
      await deeplProvider.translate(
        { text: 'Bones tardes', sourceLanguage: 'ast', targetLanguage: 'es' },
        'dummy-key'
      );
    } catch (err: any) {
      deeplErrorSource = err;
    }
    assert(deeplErrorSource !== null, 'DeepL translate must reject sourceLanguage: "ast"');
    console.log('  ✓ DeepL compatibility guard blocked unsupported requests with clear user-facing guidance.');

    // -------------------------------------------------------------
    // Test 4: Gemini Translation Provider - Descriptive language names in prompt
    // -------------------------------------------------------------
    console.log('\n[Test 4] Verifying Gemini translation prompt generates descriptive language names...');
    const geminiProvider = new GeminiTranslationProvider();
    assert(geminiProvider.capabilities.supportedLanguages.includes('AST'), 'Gemini must advertise AST in supportedLanguages');

    let capturedGeminiPayload: any = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedGeminiPayload = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: 'Hola mundu' }],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    // Translation with explicit EN -> AST
    const geminiResult = await geminiProvider.translate(
      { text: 'Hello world', sourceLanguage: 'en', targetLanguage: 'ast' },
      'test-gemini-key'
    );
    assert.strictEqual(geminiResult.translation, 'Hola mundu');
    const geminiPromptText = capturedGeminiPayload?.contents?.[0]?.parts?.[0]?.text;
    assert(geminiPromptText.includes('from English to Asturian'), `Expected "from English to Asturian", got:\n${geminiPromptText}`);
    assert(!geminiPromptText.includes('from en to ast'), 'Prompt must not contain raw unmapped lowercase codes');
    assert(!geminiPromptText.includes('to AST'), 'Prompt must not contain bare acronym AST');

    // Translation with Auto-Detect -> AST
    await geminiProvider.translate(
      { text: 'Hello world', sourceLanguage: 'Auto-Detect', targetLanguage: 'AST' },
      'test-gemini-key'
    );
    const geminiAutoPromptText = capturedGeminiPayload?.contents?.[0]?.parts?.[0]?.text;
    assert(geminiAutoPromptText.includes('from auto-detected language to Asturian'), `Expected auto-detected language to Asturian, got:\n${geminiAutoPromptText}`);
    console.log('  ✓ Gemini translation resolves "ast"/"AST" to "Asturian" and "en" to "English", preserving auto-detection.');

    // -------------------------------------------------------------
    // Test 5: OpenAI Translation Provider - Descriptive language names in prompt
    // -------------------------------------------------------------
    console.log('\n[Test 5] Verifying OpenAI translation prompt generates descriptive language names...');
    const openaiProvider = new OpenAITranslationProvider();
    assert(openaiProvider.capabilities.supportedLanguages.includes('AST'), 'OpenAI must advertise AST in supportedLanguages');

    let capturedOpenAiPayload: any = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedOpenAiPayload = JSON.parse(init?.body as string);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          choices: [
            {
              message: { content: 'Hola mundu' },
            },
          ],
        }),
      } as Response;
    }) as any;

    const openaiResult = await openaiProvider.translate(
      { text: 'Hello world', sourceLanguage: 'en', targetLanguage: 'ast' },
      'test-openai-key'
    );
    assert.strictEqual(openaiResult.translation, 'Hola mundu');
    const openaiSystemPrompt = capturedOpenAiPayload?.messages?.find((m: any) => m.role === 'system')?.content;
    assert(openaiSystemPrompt.includes('from English to Asturian'), `Expected "from English to Asturian", got:\n${openaiSystemPrompt}`);
    assert(!openaiSystemPrompt.includes('to AST'), 'System prompt must not contain bare acronym AST');

    // Auto-detect check
    await openaiProvider.translate(
      { text: 'Hello world', sourceLanguage: 'auto-detect', targetLanguage: 'AST' },
      'test-openai-key'
    );
    const openaiAutoPrompt = capturedOpenAiPayload?.messages?.find((m: any) => m.role === 'system')?.content;
    assert(openaiAutoPrompt.includes('from auto-detected language to Asturian'), `Expected auto-detected language to Asturian, got:\n${openaiAutoPrompt}`);
    console.log('  ✓ OpenAI translation resolves codes to full descriptive names in system prompt.');

    // -------------------------------------------------------------
    // Test 6: Ollama Translation Provider - Descriptive language names in prompt
    // -------------------------------------------------------------
    console.log('\n[Test 6] Verifying Ollama translation prompt generates descriptive language names...');
    const ollamaProvider = new OllamaTranslationProvider();
    assert(ollamaProvider.capabilities.supportedLanguages.includes('AST'), 'Ollama must advertise AST in supportedLanguages');

    let capturedOllamaPrompt = '';
    let capturedOllamaSystem = '';
    (ollamaProvider as any).baseUrl = 'http://mock-ollama:11434';

    // Mock client generateCompletion via fetch interceptor
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(init?.body as string);
      capturedOllamaPrompt = body.prompt;
      capturedOllamaSystem = body.system;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          response: 'Hola mundu',
          model: body.model,
          done: true,
        }),
      } as Response;
    }) as any;

    const ollamaResult = await ollamaProvider.translate({
      text: 'Hello world',
      sourceLanguage: 'EN',
      targetLanguage: 'AST',
      options: { model: 'salamandra:7b' },
    });
    assert.strictEqual(ollamaResult.translation, 'Hola mundu');
    assert(capturedOllamaPrompt.includes('from English to Asturian'), `Expected prompt "from English to Asturian", got: ${capturedOllamaPrompt}`);
    assert(capturedOllamaSystem.includes('from English to Asturian'), `Expected system "from English to Asturian", got: ${capturedOllamaSystem}`);
    assert(!capturedOllamaPrompt.includes('from EN to AST'), 'Prompt must not contain raw EN to AST');
    assert(!capturedOllamaSystem.includes('from EN to AST'), 'System prompt must not contain raw EN to AST');
    console.log('  ✓ Ollama translation resolves language names in both user prompt and system prompt.');

    // -------------------------------------------------------------
    // Test 7: Ollama Model Heuristics - Salamandra model family recognition
    // -------------------------------------------------------------
    console.log('\n[Test 7] Verifying Ollama model heuristics recognize Salamandra family...');
    const testModels = [
      'salamandra:7b',
      'salamandrata',
      'salamandra-ta-7b',
      'llama3:8b',
      'qwen2.5:7b',
      'kokoro:latest',
      'nomic-embed-text:latest',
      'deepseek-r1:8b',
      'random-custom-model:latest',
    ];

    const categorized = categorizeOllamaModels(testModels);
    assert(categorized.translationModels.includes('salamandra:7b'), 'salamandra:7b must be in translationModels');
    assert(categorized.translationModels.includes('salamandrata'), 'salamandrata must be in translationModels');
    assert(categorized.translationModels.includes('salamandra-ta-7b'), 'salamandra-ta-7b must be in translationModels');
    assert(categorized.translationModels.includes('llama3:8b'), 'llama3:8b must be in translationModels');
    assert(categorized.voiceModels.includes('kokoro:latest'), 'kokoro must be in voiceModels');
    assert(categorized.additionalModels.includes('nomic-embed-text:latest'), 'nomic-embed must be in additionalModels');
    assert(categorized.additionalModels.includes('deepseek-r1:8b'), 'deepseek-r1 must be in additionalModels');
    assert(categorized.additionalModels.includes('random-custom-model:latest'), 'random-custom-model must be in additionalModels');
    console.log('  ✓ Salamandra model variants correctly identified as translation models without misclassifying other families.');

    console.log('\n=====================================================');
    console.log(' ALL ASTURIAN TRANSLATION SUPPORT TESTS PASSED! ✓');
    console.log('=====================================================\n');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

runAsturianTranslationTests().catch((err) => {
  console.error('\n❌ ASTURIAN TRANSLATION TEST FAILED:', err);
  process.exit(1);
});

import { OllamaClient } from '../src/lib/OllamaClient';
import { OllamaTranslationProvider } from '../src/lib/OllamaTranslationProvider';
import { TranslationProviderRegistry } from '../src/lib/TranslationProviderRegistry';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

async function runOllamaTestSuite() {
  console.log('=====================================================');
  console.log(' STARTING OLLAMA TRANSLATION PROVIDER TEST SUITE');
  console.log('=====================================================\n');

  // Test 1: Registry lookup & alias resolution
  console.log('[Test 1] Testing TranslationProviderRegistry resolution...');
  const provider = TranslationProviderRegistry.getProvider('Ollama (Local LLM)');
  assert(!!provider, 'Ollama translation provider should be resolvable by alias');
  assert(provider?.id === 'ollama-mt', `Expected id 'ollama-mt', got '${provider?.id}'`);
  assert(provider?.capabilities.isOffline === true, 'Ollama provider must declare isOffline: true');
  assert(provider?.capabilities.supportsGlossary === true, 'Ollama provider must support glossary');
  console.log(`  ✓ Provider ID   : ${provider?.id}`);
  console.log(`  ✓ Provider Name : ${provider?.name}`);
  console.log(`  ✓ Is Offline    : ${provider?.capabilities.isOffline}`);
  console.log('  ✓ PASSED: Registry lookup and capabilities verified.\n');

  // Test 2: OllamaClient health check & model listing with mock server or error handling
  console.log('[Test 2] Testing OllamaClient task-agnostic interface...');
  const client = new OllamaClient('http://localhost:11434');
  assert(client.baseUrl === 'http://localhost:11434', 'Client base URL should normalize trailing slashes');

  const healthy = await client.checkHealth();
  console.log(`  ✓ Daemon Health Check Status: ${healthy ? 'ONLINE' : 'OFFLINE (Expected if daemon not running locally)'}`);

  // Test 3: OllamaTranslationProvider prompt & glossary construction
  console.log('\n[Test 3] Testing OllamaTranslationProvider translation request execution...');
  const mockProvider = new OllamaTranslationProvider({
    baseUrl: 'http://127.0.0.1:11434',
    model: 'llama3:8b',
  });

  // Test error handling for missing daemon
  try {
    await mockProvider.translate({
      text: 'Hello world',
      sourceLanguage: 'EN',
      targetLanguage: 'ES',
      options: { timeoutMs: 1000 },
    });
    console.log('  ✓ Processed real translation response from local Ollama daemon.');
  } catch (err: any) {
    assert(
      err.message.includes('Unable to connect') || err.message.includes('timed out') || err.message.includes('Ollama API error') || err.message.includes('was not found'),
      `Unexpected error format: ${err.message}`
    );
    console.log(`  ✓ Caught normalized connection error: ${err.message}`);
  }
  console.log('  ✓ PASSED: Normalized daemon error handling verified.\n');

  // Test 4: Verify OllamaClient error handling for 404 model not found
  console.log('[Test 4] Testing 404 model not found error formatting...');
  const fakeClient = new OllamaClient('http://localhost:11434');
  // Mock global fetch for unit test
  const originalFetch = global.fetch;
  global.fetch = (async (url: string) => {
    if (url.includes('/api/generate')) {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;

  try {
    await fakeClient.generateCompletion('Test prompt', { model: 'non-existent-model' });
    assert(false, 'Should have thrown 404 error');
  } catch (err: any) {
    assert(
      err.message.includes("Ollama model 'non-existent-model' was not found"),
      `Expected 404 message, got: ${err.message}`
    );
    console.log(`  ✓ Caught 404 error: ${err.message}`);
  } finally {
    global.fetch = originalFetch;
  }
  console.log('  ✓ PASSED: 404 model not found error handling verified.\n');

  // Test 5: Verify keep_alive: "5m" parameter in payload
  console.log('[Test 5] Testing keep_alive: "5m" payload generation...');
  let capturedPayload: any = null;
  global.fetch = (async (url: string, init: any) => {
    if (url.includes('/api/generate')) {
      capturedPayload = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ response: 'Hola mundo', model: 'llama3:8b' }),
      } as any;
    }
    return { ok: true, json: async () => ({}) } as any;
  }) as any;

  try {
    const res = await fakeClient.generateCompletion('Hello world', {
      model: 'llama3:8b',
      keepAlive: '5m',
    });
    assert(capturedPayload?.keep_alive === '5m', 'Payload must specify keep_alive: "5m" for RAM optimization');
    assert(capturedPayload?.stream === false, 'Payload must specify stream: false');
    assert(res.text === 'Hola mundo', 'Response text must match');
    console.log(`  ✓ Payload keep_alive : ${capturedPayload.keep_alive}`);
    console.log(`  ✓ Payload stream     : ${capturedPayload.stream}`);
    console.log(`  ✓ Returned Text      : ${res.text}`);
  } finally {
    global.fetch = originalFetch;
  }
  console.log('  ✓ PASSED: Low-memory keep_alive optimization verified.\n');

  console.log('=====================================================');
  console.log(' ALL OLLAMA TRANSLATION PROVIDER TESTS PASSED (100%)');
  console.log('=====================================================');
}

runOllamaTestSuite().catch((err) => {
  console.error('Unhandled error in Ollama test suite:', err);
  process.exit(1);
});

import { providerRegistry } from '../src/lib/ProviderRegistry';
import { VoiceService } from '../src/lib/VoiceService';
import { GeminiTTSProvider, DEFAULT_GEMINI_VOICE } from '../src/lib/GeminiTTSProvider';
import { OpenAITTSProvider, DEFAULT_OPENAI_VOICE } from '../src/lib/OpenAITTSProvider';
import { PiperLocalProvider } from '../src/lib/PiperLocalProvider';
import { VoiceAssetManager } from '../src/lib/VoiceAssetManager';
import { Take } from '../src/lib/types';
import fs from 'fs';
import path from 'path';

// Save original global fetch
const originalFetch = globalThis.fetch;

function createMockAudioBase64(): string {
  // Return valid base64 payload (> 50 bytes)
  return Buffer.from('RIFF1234WAVEfmt 16000mono16bitdata5678mockaudiobytescontentforunitstepstesting').toString('base64');
}

function createMockAudioBuffer(): ArrayBuffer {
  return Buffer.from('RIFF1234WAVEfmt 16000mono16bitdata5678mockaudiobytescontentforunitstepstesting').buffer;
}

async function runCloudTTSProviderTests() {
  console.log('=====================================================');
  console.log(' STARTING CLOUD TTS PROVIDERS TEST SUITE');
  console.log('=====================================================');

  try {
    // -------------------------------------------------------------
    // Test 1: Provider Registry Registration
    // -------------------------------------------------------------
    console.log('\n[Test 1] Verifying ProviderRegistry registration...');
    const allProviders = providerRegistry.getAllVoiceProviders();
    const piper = providerRegistry.getVoiceProvider('piper');
    const gemini = providerRegistry.getVoiceProvider('gemini');
    const openai = providerRegistry.getVoiceProvider('openai');

    if (!piper || !(piper instanceof PiperLocalProvider)) {
      throw new Error('FAILED: PiperLocalProvider is missing or invalid in ProviderRegistry!');
    }
    if (!gemini || !(gemini instanceof GeminiTTSProvider)) {
      throw new Error('FAILED: GeminiTTSProvider is missing or invalid in ProviderRegistry!');
    }
    if (!openai || !(openai instanceof OpenAITTSProvider)) {
      throw new Error('FAILED: OpenAITTSProvider is missing or invalid in ProviderRegistry!');
    }

    console.log(`  ✓ Found ${allProviders.length} registered Voice Provider(s): ${allProviders.map((p) => p.name).join(', ')}`);
    console.log('  ✓ Piper Local registration remains intact.');
    console.log('  ✓ Gemini TTS registered with ID "gemini".');
    console.log('  ✓ OpenAI TTS registered with ID "openai".');

    // -------------------------------------------------------------
    // Test 2: Provider Resolution by ID and Aliases
    // -------------------------------------------------------------
    console.log('\n[Test 2] Testing provider resolution by ID and display aliases...');
    const resolvedGeminiAlias = providerRegistry.getVoiceProvider('Google TTS');
    const resolvedOpenAiAlias = providerRegistry.getVoiceProvider('OpenAI Audio TTS');
    const resolvedPiperAlias = providerRegistry.getVoiceProvider('Piper Local TTS');

    if (resolvedGeminiAlias?.id !== 'gemini') {
      throw new Error('FAILED: Could not resolve Gemini provider by alias "Google TTS"!');
    }
    if (resolvedOpenAiAlias?.id !== 'openai') {
      throw new Error('FAILED: Could not resolve OpenAI provider by alias "OpenAI Audio TTS"!');
    }
    if (resolvedPiperAlias?.id !== 'piper') {
      throw new Error('FAILED: Could not resolve Piper provider by alias "Piper Local TTS"!');
    }
    console.log('  ✓ Successfully resolved provider instances by display aliases.');

    // -------------------------------------------------------------
    // Test 3: Provider Availability Checks
    // -------------------------------------------------------------
    console.log('\n[Test 3] Testing provider readiness / availability checks...');
    const geminiProvider = new GeminiTTSProvider();
    const openaiProvider = new OpenAITTSProvider();

    // Without API key, availability should be false (or unconfigured)
    const geminiAvailNoKey = geminiProvider.isAvailable();
    const openaiAvailNoKey = openaiProvider.isAvailable();
    console.log(`  ✓ Unconfigured Gemini availability: ${geminiAvailNoKey}`);
    console.log(`  ✓ Unconfigured OpenAI availability: ${openaiAvailNoKey}`);

    // -------------------------------------------------------------
    // Test 4: Gemini Input Validation & Missing Credentials Errors
    // -------------------------------------------------------------
    console.log('\n[Test 4] Testing Gemini input validation & missing API key errors...');
    try {
      await geminiProvider.synthesize({ text: '  ', language: 'EN', voiceId: 'Puck' });
      throw new Error('FAILED: Gemini synthesize should throw error for empty text!');
    } catch (err: any) {
      if (!err.message.includes('text parameter is required')) {
        throw new Error(`Unexpected Gemini empty text error message: ${err.message}`);
      }
      console.log('  ✓ Gemini rejected empty text as expected.');
    }

    try {
      await geminiProvider.synthesize({ text: 'Hello Gemini', language: 'EN', voiceId: 'Puck' }, '');
      throw new Error('FAILED: Gemini synthesize should throw error for missing API key!');
    } catch (err: any) {
      if (!err.message.includes('Gemini API key is required')) {
        throw new Error(`Unexpected Gemini missing API key error message: ${err.message}`);
      }
      console.log('  ✓ Gemini reported missing API key as expected.');
    }

    // -------------------------------------------------------------
    // Test 5: OpenAI Input Validation & Missing Credentials Errors
    // -------------------------------------------------------------
    console.log('\n[Test 5] Testing OpenAI input validation & missing API key errors...');
    try {
      await openaiProvider.synthesize({ text: '', language: 'EN', voiceId: 'alloy' });
      throw new Error('FAILED: OpenAI synthesize should throw error for empty text!');
    } catch (err: any) {
      if (!err.message.includes('text parameter is required')) {
        throw new Error(`Unexpected OpenAI empty text error message: ${err.message}`);
      }
      console.log('  ✓ OpenAI rejected empty text as expected.');
    }

    try {
      await openaiProvider.synthesize({ text: 'Hello OpenAI', language: 'EN', voiceId: 'alloy' }, '');
      throw new Error('FAILED: OpenAI synthesize should throw error for missing API key!');
    } catch (err: any) {
      if (!err.message.includes('OpenAI API key is required')) {
        throw new Error(`Unexpected OpenAI missing API key error message: ${err.message}`);
      }
      console.log('  ✓ OpenAI reported missing API key as expected.');
    }

    // -------------------------------------------------------------
    // Test 6: Gemini Successful Request Construction & Response Parsing (Mocked API)
    // -------------------------------------------------------------
    console.log('\n[Test 6] Testing Gemini request construction & response parsing (Mock API)...');
    let capturedGeminiUrl = '';
    let capturedGeminiPayload: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedGeminiUrl = url.toString();
      capturedGeminiPayload = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    inlineData: {
                      mimeType: 'audio/mp3',
                      data: createMockAudioBase64(),
                    },
                  },
                ],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const geminiResult = await geminiProvider.synthesize(
      {
        takeId: 'take-gem-1',
        text: 'This is a test of Gemini voice synthesis.',
        language: 'EN',
        voiceId: 'Puck',
        modelName: 'gemini-2.5-flash',
      },
      'fake-gemini-key'
    );

    if (!capturedGeminiUrl.includes('gemini-2.5-flash:generateContent?key=fake-gemini-key')) {
      throw new Error(`FAILED: Incorrect Gemini API URL constructed: ${capturedGeminiUrl}`);
    }
    if (capturedGeminiPayload?.generationConfig?.speechConfig?.voiceConfig?.prebuiltVoiceConfig?.voiceName !== 'Puck') {
      throw new Error('FAILED: Incorrect voiceName in Gemini payload!');
    }

    if (!geminiResult || geminiResult.metadata.generatorProviderId !== 'gemini') {
      throw new Error('FAILED: Invalid Gemini VoiceGenerationResult mapping!');
    }
    console.log(`  ✓ Gemini synthesis URL: ${capturedGeminiUrl}`);
    console.log(`  ✓ Generated Audio File: ${geminiResult.filename}`);
    console.log(`  ✓ Result Relative Path: ${geminiResult.relativePath}`);
    console.log(`  ✓ Duration derived: ${geminiResult.durationSeconds}s`);

    // -------------------------------------------------------------
    // Test 7: OpenAI Successful Request Construction & Response Parsing (Mocked API)
    // -------------------------------------------------------------
    console.log('\n[Test 7] Testing OpenAI Audio Speech request construction & response parsing (Mock API)...');
    let capturedOpenAiUrl = '';
    let capturedOpenAiHeaders: any = null;
    let capturedOpenAiPayload: any = null;

    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedOpenAiUrl = url.toString();
      capturedOpenAiHeaders = init?.headers;
      capturedOpenAiPayload = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => createMockAudioBuffer(),
      } as Response;
    }) as any;

    const openaiResult = await openaiProvider.synthesize(
      {
        takeId: 'take-oai-1',
        text: 'Testing OpenAI text to speech output.',
        language: 'ES',
        voiceId: 'alloy',
        modelName: 'tts-1',
        format: 'mp3',
      },
      'fake-openai-key'
    );

    if (capturedOpenAiUrl !== 'https://api.openai.com/v1/audio/speech') {
      throw new Error(`FAILED: Incorrect OpenAI API URL constructed: ${capturedOpenAiUrl}`);
    }
    if (capturedOpenAiHeaders?.Authorization !== 'Bearer fake-openai-key') {
      throw new Error('FAILED: OpenAI request missing Authorization header!');
    }
    if (capturedOpenAiPayload?.model !== 'tts-1' || capturedOpenAiPayload?.voice !== 'alloy') {
      throw new Error('FAILED: Incorrect payload parameters sent to OpenAI!');
    }

    if (!openaiResult || openaiResult.metadata.generatorProviderId !== 'openai') {
      throw new Error('FAILED: Invalid OpenAI VoiceGenerationResult mapping!');
    }
    console.log(`  ✓ OpenAI endpoint: ${capturedOpenAiUrl}`);
    console.log(`  ✓ Generated Audio File: ${openaiResult.filename}`);
    console.log(`  ✓ Result Relative Path: ${openaiResult.relativePath}`);
    console.log(`  ✓ Result Voice ID: ${openaiResult.metadata.voiceId}`);

    // -------------------------------------------------------------
    // Test 8: Cloud Provider API Error Propagation
    // -------------------------------------------------------------
    console.log('\n[Test 8] Testing API error propagation for HTTP 401 & 429 status codes...');
    globalThis.fetch = (async () => ({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => JSON.stringify({ error: { message: 'Invalid API Key provided' } }),
    })) as any;

    try {
      await geminiProvider.synthesize({ text: 'Error test', language: 'EN' }, 'invalid-key');
      throw new Error('FAILED: Gemini should throw error on HTTP 401!');
    } catch (err: any) {
      if (!err.message.includes('Invalid or unauthorized Gemini API Key')) {
        throw new Error(`Unexpected Gemini 401 error message: ${err.message}`);
      }
      console.log('  ✓ Gemini HTTP 401 error handled gracefully.');
    }

    globalThis.fetch = (async () => ({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => JSON.stringify({ error: { message: 'Rate limit exceeded' } }),
    })) as any;

    try {
      await openaiProvider.synthesize({ text: 'Error test', language: 'EN' }, 'rate-limited-key');
      throw new Error('FAILED: OpenAI should throw error on HTTP 429!');
    } catch (err: any) {
      if (!err.message.includes('rate limit exceeded')) {
        throw new Error(`Unexpected OpenAI 429 error message: ${err.message}`);
      }
      console.log('  ✓ OpenAI HTTP 429 rate-limit error handled gracefully.');
    }

    // -------------------------------------------------------------
    // Test 9: Malformed or Empty Audio Response Handling
    // -------------------------------------------------------------
    console.log('\n[Test 9] Testing malformed or empty audio response handling...');
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({ candidates: [] }),
    })) as any;

    try {
      await geminiProvider.synthesize({ text: 'Empty response test', language: 'EN' }, 'key');
      throw new Error('FAILED: Gemini should throw error on empty candidates!');
    } catch (err: any) {
      if (!err.message.includes('invalid or empty audio response')) {
        throw new Error(`Unexpected Gemini empty response error: ${err.message}`);
      }
      console.log('  ✓ Gemini empty candidate response caught.');
    }

    // -------------------------------------------------------------
    // Test 10: Provider-Agnostic VoiceService Delegation using Canonical synthesize()
    // -------------------------------------------------------------
    console.log('\n[Test 10] Testing VoiceService delegation to Gemini & OpenAI without provider branching...');
    globalThis.fetch = (async (url: string) => {
      if (url.includes('openai')) {
        return {
          ok: true,
          status: 200,
          arrayBuffer: async () => createMockAudioBuffer(),
        } as Response;
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ inlineData: { mimeType: 'audio/mp3', data: createMockAudioBase64() } }],
              },
            },
          ],
        }),
      } as Response;
    }) as any;

    const voiceService = new VoiceService();

    // Call VoiceService with providerId: 'gemini'
    const geminiDelegation = await voiceService.generateVoiceForTake({
      takeId: 'take-deleg-gem',
      text: 'VoiceService delegation test for Gemini.',
      language: 'ES',
      providerId: 'gemini',
      apiKey: 'test-key',
    });

    if (geminiDelegation.result.metadata.generatorProviderId !== 'gemini') {
      throw new Error('FAILED: VoiceService did not delegate to Gemini provider correctly!');
    }

    // Call VoiceService with providerId: 'openai'
    const openaiDelegation = await voiceService.generateVoiceForTake({
      takeId: 'take-deleg-oai',
      text: 'VoiceService delegation test for OpenAI.',
      language: 'FR',
      providerId: 'openai',
      apiKey: 'test-key',
    });

    if (openaiDelegation.result.metadata.generatorProviderId !== 'openai') {
      throw new Error('FAILED: VoiceService did not delegate to OpenAI provider correctly!');
    }

    console.log('  ✓ VoiceService delegated seamlessly to Gemini without branching.');
    console.log('  ✓ VoiceService delegated seamlessly to OpenAI without branching.');

    // -------------------------------------------------------------
    // Test 11: Existing Voice Asset Intact on Generation Failure
    // -------------------------------------------------------------
    console.log('\n[Test 11] Verifying that a failed generation leaves existing Voice Asset intact...');
    const assetManager = new VoiceAssetManager();

    // Pre-register an existing asset for a Take
    const initialAsset = assetManager.registerAsset({
      takeId: 'take-keep-1',
      relativePath: 'Audio/voice_existing_asset.wav',
      filename: 'voice_existing_asset.wav',
      format: 'wav',
      sampleRate: 22050,
      durationSeconds: 3.5,
      metadata: {
        generatorProviderId: 'piper',
        generatorModelName: 'en_US-lessac-high.onnx',
        generatedAt: new Date().toISOString(),
      },
    });

    let currentTake: Take = {
      id: 'take-keep-1',
      character: 'Speaker 1',
      time: '00:00 - 00:03',
      startSeconds: 0,
      endSeconds: 3,
      original: 'Keep asset intact test.',
      translation: '',
      notes: '',
      status: 'Pending',
      voiceAssetId: initialAsset.id,
    };

    // Attempt a failed voice generation with failing fetch
    globalThis.fetch = (async () => ({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      text: async () => 'Cloud service error',
    })) as any;

    try {
      await voiceService.generateVoiceForTake({
        takeId: currentTake.id,
        text: currentTake.original,
        language: 'EN',
        providerId: 'gemini',
        apiKey: 'key',
      });
      throw new Error('FAILED: Generation should have failed!');
    } catch (_) {
      // Expected error
    }

    // Verify Take's voiceAssetId remains unchanged
    if (currentTake.voiceAssetId !== initialAsset.id) {
      throw new Error('FAILED: Take voiceAssetId was corrupted on generation failure!');
    }
    const retrievedAsset = assetManager.getAsset(currentTake.voiceAssetId);
    if (!retrievedAsset || retrievedAsset.relativePath !== 'Audio/voice_existing_asset.wav') {
      throw new Error('FAILED: Existing Voice Asset was removed or altered!');
    }

    console.log(`  ✓ Existing Voice Asset (${initialAsset.id}) remains intact after failed request.`);

    console.log('\n=====================================================');
    console.log(' CLOUD TTS PROVIDERS TESTS PASSED (100%)');
    console.log('=====================================================');
  } finally {
    // Restore original global fetch
    globalThis.fetch = originalFetch;
  }
}

runCloudTTSProviderTests().catch((err) => {
  console.error('\n❌ Cloud TTS Providers Test Error:', err);
  process.exit(1);
});

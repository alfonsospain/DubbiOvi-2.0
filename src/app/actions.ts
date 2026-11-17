'use server';

import { ai } from '@/ai/genkit';
import { analyzeSentiment } from '@/ai/flows/sentiment-analysis-takes';
import type {
  SentimentAnalysisInput,
  SentimentAnalysisOutput,
} from '@/ai/flows/sentiment-analysis-takes';

function getActiveApiKey(clientKey?: string | null): string | undefined {
  if (clientKey && clientKey.trim()) {
    return clientKey.trim();
  }
  return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || undefined;
}

export async function testGeminiConnection(
  apiKey: string,
  timeoutMs: number = 25000
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'Gemini API key is required.' };
  }
  const key = apiKey.trim();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
      }
    );

    if (res.ok) {
      return { success: true };
    }

    const status = res.status;
    let errMessage = `HTTP ${status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {}

    if (status === 429 || errMessage.includes('RESOURCE_EXHAUSTED') || errMessage.toLowerCase().includes('quota')) {
      return {
        success: false,
        error: 'Gemini API key accepted, but the current API quota has been exhausted. Please wait for the quota to reset or review billing.',
      };
    }

    if (status === 503 || errMessage.includes('UNAVAILABLE') || errMessage.toLowerCase().includes('high demand') || errMessage.toLowerCase().includes('overloaded')) {
      return {
        success: false,
        error: `Google Gemini service is temporarily unavailable (HTTP 503). The service is experiencing high demand. Please try again shortly. (${errMessage})`,
      };
    }

    // Google returns HTTP 400 with "API key not valid..." or HTTP 401/403 for invalid/unauthorized keys
    if (
      status === 401 ||
      status === 403 ||
      errMessage.includes('API_KEY_INVALID') ||
      errMessage.includes('API key not valid') ||
      (status === 400 && errMessage.toLowerCase().includes('api key'))
    ) {
      return {
        success: false,
        error: `Authentication failed (HTTP ${status}): Invalid or unauthorized Gemini API key.`,
      };
    }

    if (status === 404 || errMessage.includes('is not found') || errMessage.includes('no longer available') || errMessage.includes('not supported')) {
      return {
        success: false,
        error: `Endpoint unavailable (HTTP ${status}): ${errMessage}`,
      };
    }

    if (status === 400) {
      return {
        success: false,
        error: `Invalid request (HTTP 400): ${errMessage}`,
      };
    }

    return {
      success: false,
      error: `Gemini API Error (HTTP ${status}): ${errMessage}`,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError' || controller.signal.aborted) {
      return {
        success: false,
        error: `Connection timeout: Google Gemini API did not respond within ${Math.round(timeoutMs / 1000)} seconds. The service may be experiencing high demand; please retry.`,
      };
    }
    return {
      success: false,
      error: `Connection failure: Unable to reach Google Gemini API servers (${error.message || String(error)}).`,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function testOpenAiConnection(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'OpenAI API key is required.' };
  }
  const key = apiKey.trim();
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    if (res.ok) {
      return { success: true };
    }

    const status = res.status;
    let errDetail = `HTTP ${status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.error?.message) {
        errDetail = errJson.error.message;
      }
    } catch (_) {}

    if (status === 429 || errDetail.includes('insufficient_quota') || errDetail.toLowerCase().includes('quota')) {
      return {
        success: false,
        error: 'OpenAI API key accepted, but current API quota/credit limit has been exhausted. Please review your OpenAI billing.',
      };
    }

    if (status === 401 || status === 403) {
      return {
        success: false,
        error: `Authentication failed (HTTP ${status}): Invalid or unauthorized OpenAI API key.`,
      };
    }

    return { success: false, error: `OpenAI API Error (HTTP ${status}): ${errDetail}` };
  } catch (err: any) {
    return { success: false, error: `Connection failure: ${err.message || String(err)}` };
  }
}

export async function testDeepLConnection(
  apiKey: string
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey || !apiKey.trim()) {
    return { success: false, error: 'DeepL API key is required.' };
  }
  const key = apiKey.trim();
  const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
  try {
    const res = await fetch(`${host}/v2/usage`, {
      method: 'GET',
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
      },
    });

    if (res.ok) {
      return { success: true };
    }

    const status = res.status;
    let errorDetails = `HTTP ${status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      if (errJson?.message) {
        errorDetails = errJson.message;
      }
    } catch (_) {}

    if (status === 401 || status === 403) {
      return { success: false, error: `Authentication failed (HTTP ${status}): Invalid or unauthorized DeepL API key.` };
    }

    if (status === 429 || status === 456) {
      return { success: false, error: 'DeepL API key accepted, but translation quota has been reached.' };
    }

    return { success: false, error: errorDetails };
  } catch (err: any) {
    return { success: false, error: `Connection failure: ${err.message || String(err)}` };
  }
}

import { OllamaClient } from '@/lib/OllamaClient';

export async function testOllamaConnection(
  baseUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const client = new OllamaClient(baseUrl || 'http://localhost:11434');
    const healthy = await client.checkHealth();
    if (healthy) {
      return { success: true };
    }
    return {
      success: false,
      error: `Could not connect to Ollama daemon at ${baseUrl || 'http://localhost:11434'}. Ensure Ollama is running.`,
    };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

export async function fetchOllamaModelsAction(
  baseUrl: string
): Promise<{ success: boolean; models: string[]; error?: string }> {
  try {
    const client = new OllamaClient(baseUrl || 'http://localhost:11434');
    const models = await client.listModels();
    return {
      success: true,
      models: models.map((m) => m.name),
    };
  } catch (err: any) {
    return {
      success: false,
      models: [],
      error: err.message || String(err),
    };
  }
}

export async function getSentiment(
  text: string,
  apiKey?: string
): Promise<SentimentAnalysisOutput | null> {
  if (!text) {
    return null;
  }
  try {
    const activeKey = getActiveApiKey(apiKey);
    const input: SentimentAnalysisInput = { text, apiKey: activeKey };
    const result = await analyzeSentiment(input);
    return result;
  } catch (error) {
    console.error('Error in getSentiment server action:', error);
    return null;
  }
}

import { asrTranscriptionFlow } from '@/ai/flows/asr-transcription';
import type { AsrOutput } from '@/ai/flows/asr-transcription';
import {
  type AudioTranscriptionResult,
  classifyGeminiAsrError,
  sanitizeGeminiError,
} from '@/lib/gemini-asr-helpers';

export type { AudioTranscriptionResult };

export async function getAudioTranscription(
  formData: FormData,
  retryDelayMs: number = 2000
): Promise<AudioTranscriptionResult> {
  const file = formData.get('audio') as File;
  const sourceLang = formData.get('sourceLang') as string;
  const apiKey = formData.get('apiKey') as string | null;

  if (!file) {
    return {
      success: false,
      error: 'No audio data received for transcription.',
      statusCode: 400,
    };
  }

  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err: any) {
    return {
      success: false,
      error: `Failed to read audio file: ${sanitizeGeminiError(err?.message || String(err))}`,
      statusCode: 400,
    };
  }

  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  const mimeType = file.type || 'audio/wav';
  const activeKey = getActiveApiKey(apiKey);

  const flowInput = {
    audioBase64: base64Data,
    mimeType,
    sourceLanguage: sourceLang || undefined,
    apiKey: activeKey,
  };

  try {
    const result = await asrTranscriptionFlow(flowInput);
    return { success: true, data: result };
  } catch (firstError: any) {
    const classified = classifyGeminiAsrError(firstError, activeKey);

    // Controlled single retry strictly for transient HTTP 503 errors
    if (classified.isRetryable) {
      try {
        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
        const retryResult = await asrTranscriptionFlow(flowInput);
        return { success: true, data: retryResult };
      } catch (secondError: any) {
        const finalClassified = classifyGeminiAsrError(secondError, activeKey);
        console.error('Gemini ASR failed on retry:', finalClassified.error);
        return {
          success: false,
          error: finalClassified.error,
          statusCode: finalClassified.statusCode,
        };
      }
    }

    console.error('Gemini ASR failed:', classified.error);
    return {
      success: false,
      error: classified.error,
      statusCode: classified.statusCode,
    };
  }
}

import { TranslationProvider, TranslationCapabilities, TranslationRequest, TranslationResult } from './translation-types';
import { loadApiKey } from './apiKeyStorage';

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '(none)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * TranslationProvider implementation for Google Gemini REST API.
 */
export class GeminiTranslationProvider implements TranslationProvider {
  public readonly id = 'gemini-mt';
  public readonly name = 'Google Gemini Translation';
  public readonly capabilities: TranslationCapabilities = {
    supportsGlossary: true,
    supportsBatchTranslation: false,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU', 'JA', 'ZH', 'NL', 'PL', 'KO', 'AR'],
    isOffline: false,
    requiresApiKey: true,
  };

  public async translate(
    request: TranslationRequest,
    apiKey?: string
  ): Promise<TranslationResult> {
    const key = (apiKey || loadApiKey() || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.GOOGLE_API_KEY || process.env?.GOOGLE_GENAI_API_KEY : '') || '').trim();

    console.log('[Translation Diagnostic] selected provider ID: gemini-mt');
    console.log('[Translation Diagnostic] credential storage key requested: dubbiovi_gemini_api_key');
    console.log('[Translation Diagnostic] masked credential prefix/suffix supplied:', maskApiKey(key));
    console.log('[Translation Diagnostic] actual provider invoked: GeminiTranslationProvider (Google Gemini Translation)');

    if (!key) {
      throw new Error('Gemini API key is required. Please configure your Gemini API Key in Settings / AI Platforms.');
    }

    let prompt = `You are a professional translator. Translate the text from ${request.sourceLanguage || 'auto-detected language'} to ${request.targetLanguage}.\n\n`;

    if (request.glossary && Array.isArray(request.glossary) && request.glossary.length > 0) {
      prompt += 'Glossary terms to strictly enforce:\n';
      for (const entry of request.glossary) {
        prompt += `- "${entry.sourceTerm}" -> "${entry.targetTerm}"\n`;
      }
      prompt += '\n';
    }

    prompt += `Original Text: ${request.text}\nOutput ONLY the translated text without commentary:`;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    };

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
    } catch (fetchErr: any) {
      throw new Error(`Gemini API Connection Error: ${fetchErr.message || String(fetchErr)}`);
    }

    if (!response.ok) {
      const rawText = await response.text();
      let errDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.error?.message) {
          errDetail = errJson.error.message;
        }
      } catch (_) {}

      if (response.status === 429) {
        throw new Error('Gemini API key accepted, but the current API quota has been exhausted. Please wait for the quota to reset or review billing.');
      }

      throw new Error(`Gemini Translation Error (HTTP ${response.status}): ${errDetail}`);
    }

    const resJson = await response.json();
    const translatedText = resJson?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!translatedText) {
      throw new Error('Gemini API returned an empty translation response.');
    }

    return {
      translation: translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      metadata: {
        providerId: this.id,
        modelName: 'gemini-2.5-flash',
      },
    };
  }
}

import { TranslationProvider, TranslationCapabilities, TranslationRequest, TranslationResult } from './translation-types';
import { loadOpenAiApiKey } from './apiKeyStorage';

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '(none)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * TranslationProvider implementation for OpenAI Chat Completions API (GPT translation).
 */
export class OpenAITranslationProvider implements TranslationProvider {
  public readonly id = 'openai-mt';
  public readonly name = 'OpenAI GPT Translation';
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
    const key = (apiKey || loadOpenAiApiKey() || (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : '') || '').trim();

    console.log('[Translation Diagnostic] selected provider ID: openai-mt');
    console.log('[Translation Diagnostic] credential storage key requested: dubbiovi_openai_api_key');
    console.log('[Translation Diagnostic] masked credential prefix/suffix supplied:', maskApiKey(key));
    console.log('[Translation Diagnostic] actual provider invoked: OpenAITranslationProvider (OpenAI GPT Translation)');

    if (!key) {
      throw new Error('OpenAI API key is required. Please configure your OpenAI API Key in Settings / AI Platforms.');
    }

    let systemPrompt = `You are a professional translator. Translate the text from ${request.sourceLanguage || 'auto-detected language'} to ${request.targetLanguage}. Output ONLY the translated text without commentary or quotation marks.`;

    if (request.glossary && Array.isArray(request.glossary) && request.glossary.length > 0) {
      systemPrompt += '\n\nGlossary terms to strictly follow:\n';
      for (const entry of request.glossary) {
        systemPrompt += `- "${entry.sourceTerm}" -> "${entry.targetTerm}"\n`;
      }
    }

    const payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: request.text },
      ],
      temperature: 0.3,
    };

    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      throw new Error(`OpenAI API Connection Error: ${fetchErr.message || String(fetchErr)}`);
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
      throw new Error(`OpenAI Translation Error (HTTP ${response.status}): ${errDetail}`);
    }

    const resJson = await response.json();
    const translatedText = resJson?.choices?.[0]?.message?.content?.trim();

    if (!translatedText) {
      throw new Error('OpenAI API returned an empty translation response.');
    }

    return {
      translation: translatedText,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      metadata: {
        providerId: this.id,
        modelName: 'gpt-4o-mini',
      },
    };
  }
}

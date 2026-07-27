import { TranslationProvider, TranslationCapabilities, TranslationRequest, TranslationResult } from './translation-types';
import { loadDeepLApiKey } from './apiKeyStorage';

function maskApiKey(key?: string | null): string {
  if (!key || typeof key !== 'string') return '(none)';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '***';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

function normalizeDeepLTargetLang(lang: string): string {
  const norm = (lang || 'EN').trim().toUpperCase().split('-')[0].split('_')[0];
  if (norm === 'EN') return 'EN-US';
  if (norm === 'PT') return 'PT-PT';
  return norm;
}

/**
 * TranslationProvider implementation for DeepL Translation API.
 */
export class DeepLTranslationProvider implements TranslationProvider {
  public readonly id = 'deepl';
  public readonly name = 'DeepL Translation';
  public readonly capabilities: TranslationCapabilities = {
    supportsGlossary: true,
    supportsBatchTranslation: true,
    supportedLanguages: ['EN', 'ES', 'FR', 'DE', 'IT', 'PT', 'RU', 'JA', 'ZH', 'NL', 'PL'],
    isOffline: false,
    requiresApiKey: true,
  };

  public async translate(
    request: TranslationRequest,
    apiKey?: string
  ): Promise<TranslationResult> {
    const key = (apiKey || loadDeepLApiKey() || (typeof process !== 'undefined' ? process.env?.DEEPL_API_KEY : '') || '').trim();
    
    console.log('[Translation Diagnostic] selected provider ID: deepl');
    console.log('[Translation Diagnostic] credential storage key requested: dubbiovi_deepl_api_key');
    console.log('[Translation Diagnostic] masked credential prefix/suffix supplied:', maskApiKey(key));
    console.log('[Translation Diagnostic] actual provider invoked: DeepLTranslationProvider (DeepL Translation)');

    if (!key) {
      throw new Error('DeepL API key is required. Please configure your DeepL API Key in Settings / AI Platforms.');
    }

    const host = key.endsWith(':fx') ? 'https://api-free.deepl.com' : 'https://api.deepl.com';
    const targetLang = normalizeDeepLTargetLang(request.targetLanguage);
    const sourceLang = (request.sourceLanguage || '').trim().toUpperCase().split('-')[0].split('_')[0];

    const payload: Record<string, any> = {
      text: [request.text],
      target_lang: targetLang,
    };

    if (sourceLang && sourceLang !== 'AUTO-DETECT' && sourceLang !== 'NONE' && sourceLang !== 'AUTO') {
      payload.source_lang = sourceLang;
    }

    let response: Response;
    try {
      response = await fetch(`${host}/v2/translate`, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      throw new Error(`DeepL API Connection Error: ${fetchErr.message || String(fetchErr)}`);
    }

    if (!response.ok) {
      const rawText = await response.text();
      let errDetail = `HTTP ${response.status} ${response.statusText}`;
      try {
        const errJson = JSON.parse(rawText);
        if (errJson?.message) {
          errDetail = errJson.message;
        }
      } catch (_) {}
      throw new Error(`DeepL Translation Error (HTTP ${response.status}): ${errDetail}`);
    }

    const resJson = await response.json();
    const translatedText = resJson?.translations?.[0]?.text;
    if (!translatedText || typeof translatedText !== 'string') {
      throw new Error('DeepL API returned an empty or invalid translation response.');
    }

    // Apply client-side glossary terms if provided
    let finalTranslation = translatedText;
    if (request.glossary && Array.isArray(request.glossary)) {
      for (const entry of request.glossary) {
        if (entry.sourceTerm && entry.targetTerm) {
          const regex = new RegExp(`\\b${entry.sourceTerm}\\b`, 'gi');
          finalTranslation = finalTranslation.replace(regex, entry.targetTerm);
        }
      }
    }

    return {
      translation: finalTranslation,
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      metadata: {
        providerId: this.id,
        modelName: 'deepl-v2',
      },
    };
  }
}

'use server';
/**
 * @fileOverview AI-powered translation suggestions flow.
 *
 * - getTranslationSuggestion - A function that returns a translation suggestion.
 * - GetTranslationSuggestionInput - The input type for the getTranslationSuggestion function.
 * - GetTranslationSuggestionOutput - The return type for the getTranslationSuggestion function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { GlossaryEntry } from '@/lib/types';

const GlossaryEntrySchema = z.object({
  id: z.string(),
  sourceTerm: z.string(),
  targetTerm: z.string(),
  notes: z.string().optional(),
});

const GetTranslationSuggestionInputSchema = z.object({
  originalText: z.string().describe('The original text to translate.'),
  sourceLanguage: z.string().describe('The language of the original text.'),
  targetLanguage: z.string().describe('The language to translate the text into.'),
  glossary: z.array(GlossaryEntrySchema).optional().describe('A list of glossary terms to ensure consistent translation.'),
  apiKey: z.string().optional().describe('User provided Gemini API key.'),
  provider: z.string().optional().describe('Selected translation provider (Gemini, Ollama, OpenAI, DeepL).'),
  ollamaConfig: z.object({
    url: z.string().optional(),
    model: z.string().optional(),
  }).optional().describe('Ollama configuration (url, model).'),
});
export type GetTranslationSuggestionInput = z.infer<typeof GetTranslationSuggestionInputSchema>;

const GetTranslationSuggestionOutputSchema = z.object({
  translation: z.string().describe('The translated text.'),
});
export type GetTranslationSuggestionOutput = z.infer<typeof GetTranslationSuggestionOutputSchema>;

import { TranslationProviderRegistry } from '@/lib/TranslationProviderRegistry';
import { loadApiKey, loadDeepLApiKey, loadOpenAiApiKey } from '@/lib/apiKeyStorage';
import { LanguageRegistry } from '@/lib/languages/LanguageRegistry';

export async function getTranslationSuggestion(input: GetTranslationSuggestionInput): Promise<GetTranslationSuggestionOutput> {
  const providerName = input.provider || 'Gemini';

  console.log('[Translation Diagnostic] UI selection:', input.provider || '(None / Default)');
  console.log('[Translation Diagnostic] Stored provider configuration:', providerName);
  console.log('[Translation Diagnostic] Provider ID received by the service:', providerName);

  const resolvedProvider = TranslationProviderRegistry.getProvider(providerName);
  console.log('[Translation Diagnostic] Provider resolved by ProviderRegistry:', resolvedProvider ? resolvedProvider.id : 'None (Fallback)');
  console.log('[Translation Diagnostic] Actual provider instance invoked:', resolvedProvider ? `${resolvedProvider.constructor.name} (${resolvedProvider.name})` : 'Gemini Genkit Flow');

  if (resolvedProvider) {
    if (resolvedProvider.id === 'ollama-mt') {
      const baseUrl = input.ollamaConfig?.url || 'http://localhost:11434';
      const model = input.ollamaConfig?.model;
      const result = await resolvedProvider.translate({
        text: input.originalText,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
        glossary: input.glossary,
        options: { baseUrl, model },
      });
      return { translation: result.translation };
    }

    const apiKey = input.apiKey || (
      resolvedProvider.id === 'deepl' ? loadDeepLApiKey() :
      resolvedProvider.id === 'openai-mt' ? loadOpenAiApiKey() :
      loadApiKey()
    ) || undefined;

    const result = await resolvedProvider.translate({
      text: input.originalText,
      sourceLanguage: input.sourceLanguage,
      targetLanguage: input.targetLanguage,
      glossary: input.glossary,
    }, apiKey);

    return { translation: result.translation };
  }

  const activeKey = input.apiKey?.trim() || loadApiKey() || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY || undefined;
  return getTranslationSuggestionFlow({
    ...input,
    apiKey: activeKey,
  });
}

const translationPrompt = ai.definePrompt({
  name: 'translationPrompt',
  input: {schema: GetTranslationSuggestionInputSchema},
  output: {schema: GetTranslationSuggestionOutputSchema},
  prompt: `You are a translation expert.
Translate the given text from {{sourceLanguage}} to {{targetLanguage}}.

{{#if glossary}}
You MUST use the following glossary to ensure consistency.
Glossary:
{{#each glossary}}
- "{{sourceTerm}}" must be translated as "{{targetTerm}}"
{{/each}}
{{/if}}

Original text: {{{originalText}}}
Translation:`,
});

const getTranslationSuggestionFlow = ai.defineFlow(
  {
    name: 'getTranslationSuggestionFlow',
    inputSchema: GetTranslationSuggestionInputSchema,
    outputSchema: GetTranslationSuggestionOutputSchema,
  },
  async input => {
    const targetDesc = LanguageRegistry.getLanguageByCode(input.targetLanguage);
    const targetName = targetDesc ? targetDesc.name : input.targetLanguage;

    let sourceName = 'auto-detected language';
    if (input.sourceLanguage) {
      const srcClean = input.sourceLanguage.trim().toLowerCase();
      if (srcClean !== 'auto-detect' && srcClean !== 'auto' && srcClean !== 'none' && srcClean !== 'auto-detected language') {
        const srcDesc = LanguageRegistry.getLanguageByCode(input.sourceLanguage);
        sourceName = srcDesc ? srcDesc.name : input.sourceLanguage;
      }
    }

    const {output} = await translationPrompt(
      {
        originalText: input.originalText,
        sourceLanguage: sourceName,
        targetLanguage: targetName,
        glossary: input.glossary,
      },
      input.apiKey ? { config: { apiKey: input.apiKey } } : {}
    );
    
    if (!output) {
      return { translation: "" };
    }

    // Secondary check to apply glossary, as LLMs can sometimes ignore prompt instructions
    let translatedText = output.translation;
    if (input.glossary) {
      for (const entry of input.glossary) {
        // Use a case-insensitive regex to replace all occurrences of the source term
        const regex = new RegExp(`\\b${entry.sourceTerm}\\b`, 'gi');
        translatedText = translatedText.replace(regex, entry.targetTerm);
      }
    }

    return { translation: translatedText };
  }
);

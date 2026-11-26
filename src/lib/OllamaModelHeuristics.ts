/**
 * Pure heuristic utility to classify Ollama models for DubbiOvi configuration UI.
 * Categorization is treated as a heuristic so no model is ever lost or hidden.
 */

export interface CategorizedOllamaModels {
  translationModels: string[];
  voiceModels: string[];
  additionalModels: string[];
}

export function categorizeOllamaModels(models: string[]): CategorizedOllamaModels {
  const translationModels: string[] = [];
  const voiceModels: string[] = [];
  const additionalModels: string[] = [];

  for (const model of models) {
    const lower = model.toLowerCase();

    // 1. Voice / Speech Models
    if (
      lower.includes('kokoro') ||
      lower.includes('tts') ||
      lower.includes('speech') ||
      lower.includes('bark') ||
      lower.includes('parler')
    ) {
      voiceModels.push(model);
      continue;
    }

    // 2. Filter out pure embedding & reasoning models from translation
    const isEmbedding =
      lower.includes('embed') ||
      lower.includes('minilm') ||
      lower.includes('bge') ||
      lower.includes('e5') ||
      lower.includes('gte');

    const isReasoning =
      lower.includes('deepseek-r1') ||
      lower.includes('-r1') ||
      lower.includes(':r1') ||
      lower.includes('qwq') ||
      lower.includes('thinking');

    if (isEmbedding || isReasoning) {
      additionalModels.push(model);
      continue;
    }

    // 3. Known / standard translation & general LLMs
    if (
      lower.includes('llama') ||
      lower.includes('gemma') ||
      lower.includes('qwen') ||
      lower.includes('mistral') ||
      lower.includes('vicuna') ||
      lower.includes('phi') ||
      lower.includes('mixtral') ||
      lower.includes('deepseek') ||
      lower.includes('command-r') ||
      lower.includes('yi') ||
      lower.includes('solar') ||
      lower.includes('salamandra')
    ) {
      translationModels.push(model);
    } else {
      // Unknown or non-matching models fall back safely to additional models
      additionalModels.push(model);
    }
  }

  return {
    translationModels,
    voiceModels,
    additionalModels,
  };
}

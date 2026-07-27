/**
 * Platform Language Capability interfaces and helper functions.
 * Prepares extensible validation architecture for future milestones.
 */

export type LanguageCapabilityMode = 'Declared' | 'ModelDependent';

export interface PlatformLanguageCapability {
  platformId: string;
  platformName: string;
  mode: LanguageCapabilityMode;         // 'Declared' vs 'ModelDependent'
  declaredLanguageCodes?: string[];     // Array of ISO 639-1 language codes (when mode === 'Declared')
  supportsLanguageDetection?: boolean;  // Auto-detection support flag
  supportsLocales?: boolean;            // Locale specificity flag
}

/**
 * Validates whether a given source and target language pair is supported by an AI Platform capability.
 * (Prepared architectural helper for future validation milestones; does not block current execution).
 */
export function isLanguagePairSupported(
  capability: PlatformLanguageCapability,
  sourceCode: string,
  targetCode: string
): boolean {
  if (capability.mode === 'ModelDependent') {
    return true; // Capabilities depend on model loaded at runtime (e.g. Ollama, Whisper)
  }

  const normSource = sourceCode.trim().toLowerCase().split('-')[0];
  const normTarget = targetCode.trim().toLowerCase().split('-')[0];

  const declared = capability.declaredLanguageCodes?.map((c) => c.toLowerCase()) || [];

  const isSourceOk = declared.length === 0 || declared.includes(normSource);
  const isTargetOk = declared.length === 0 || declared.includes(normTarget);

  return isSourceOk && isTargetOk;
}

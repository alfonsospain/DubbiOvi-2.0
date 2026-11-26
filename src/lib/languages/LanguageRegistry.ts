/**
 * Centralized Language Registry Domain Model for DubbiOvi.
 * Single authoritative source for language metadata across the entire application.
 */

export type WritingDirection = 'ltr' | 'rtl';

export interface LocaleDescriptor {
  code: string;           // e.g., 'en-US', 'es-ES', 'es-MX', 'pt-BR'
  name: string;           // e.g., 'English (United States)'
  nativeName: string;     // e.g., 'Español (España)'
  countryCode?: string;   // ISO 3166-1 alpha-2 country code e.g., 'US', 'ES', 'MX'
}

export interface LanguageCapabilities {
  translation: boolean;
  asr: boolean;
  tts: boolean;
}

export interface LanguageDescriptor {
  code: string;                   // Standard ISO 639-1 or 639-3 code (lowercase, e.g. 'en', 'es', 'ast')
  name: string;                   // English name (e.g. 'Spanish', 'Asturian')
  nativeName: string;             // Native name (e.g. 'Español', 'Asturianu')
  writingDirection?: WritingDirection; // 'ltr' | 'rtl' (default: 'ltr')
  capabilities?: Partial<LanguageCapabilities>;
  locales?: LocaleDescriptor[];   // Extensible locale descriptors for future locale milestones
}

const REGISTRY: LanguageDescriptor[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    writingDirection: 'ltr',
    locales: [
      { code: 'en-US', name: 'English (United States)', nativeName: 'English (US)', countryCode: 'US' },
      { code: 'en-GB', name: 'English (United Kingdom)', nativeName: 'English (UK)', countryCode: 'GB' },
    ],
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    writingDirection: 'ltr',
    locales: [
      { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español (España)', countryCode: 'ES' },
      { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)', countryCode: 'MX' },
      { code: 'es-AR', name: 'Spanish (Argentina)', nativeName: 'Español (Argentina)', countryCode: 'AR' },
    ],
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    writingDirection: 'ltr',
    locales: [
      { code: 'fr-FR', name: 'French (France)', nativeName: 'Français (France)', countryCode: 'FR' },
      { code: 'fr-CA', name: 'French (Canada)', nativeName: 'Français (Canada)', countryCode: 'CA' },
    ],
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    writingDirection: 'ltr',
    locales: [
      { code: 'de-DE', name: 'German (Germany)', nativeName: 'Deutsch (Deutschland)', countryCode: 'DE' },
    ],
  },
  {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    writingDirection: 'ltr',
    locales: [
      { code: 'it-IT', name: 'Italian (Italy)', nativeName: 'Italiano (Italia)', countryCode: 'IT' },
    ],
  },
  {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    writingDirection: 'ltr',
    locales: [
      { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', countryCode: 'BR' },
      { code: 'pt-PT', name: 'Portuguese (Portugal)', nativeName: 'Português (Portugal)', countryCode: 'PT' },
    ],
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    writingDirection: 'ltr',
    locales: [
      { code: 'ja-JP', name: 'Japanese (Japan)', nativeName: '日本語 (日本)', countryCode: 'JP' },
    ],
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    writingDirection: 'ltr',
    locales: [
      { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文', countryCode: 'CN' },
      { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文', countryCode: 'TW' },
    ],
  },
  {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    writingDirection: 'ltr',
    locales: [
      { code: 'ru-RU', name: 'Russian (Russia)', nativeName: 'Русский (Россия)', countryCode: 'RU' },
    ],
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    writingDirection: 'ltr',
    locales: [
      { code: 'ko-KR', name: 'Korean (South Korea)', nativeName: '한국어 (대한민국)', countryCode: 'KR' },
    ],
  },
  {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    writingDirection: 'rtl',
    locales: [
      { code: 'ar-SA', name: 'Arabic (Saudi Arabia)', nativeName: 'العربية (السعودية)', countryCode: 'SA' },
    ],
  },
  {
    code: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    writingDirection: 'ltr',
  },
  {
    code: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    writingDirection: 'ltr',
  },
  {
    code: 'uk',
    name: 'Ukrainian',
    nativeName: 'Українська',
    writingDirection: 'ltr',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    writingDirection: 'ltr',
  },
  {
    code: 'ast',
    name: 'Asturian',
    nativeName: 'Asturianu',
    writingDirection: 'ltr',
    capabilities: {
      translation: true,
      asr: false,
      tts: false,
    },
    locales: [
      { code: 'ast-ES', name: 'Asturian (Spain)', nativeName: 'Asturianu (España)', countryCode: 'ES' },
    ],
  },
];

export class LanguageRegistry {
  /**
   * Return all registered language descriptors in the authoritative domain model.
   */
  public static getAllLanguages(): LanguageDescriptor[] {
    return [...REGISTRY];
  }

  /**
   * Return all registered languages that support text translation.
   */
  public static getTranslationLanguages(): LanguageDescriptor[] {
    return REGISTRY.filter((l) => l.capabilities?.translation !== false);
  }

  /**
   * Return all registered languages that support speech recognition (ASR).
   */
  public static getAsrLanguages(): LanguageDescriptor[] {
    return REGISTRY.filter((l) => l.capabilities?.asr !== false);
  }

  /**
   * Return all registered languages that support speech synthesis (TTS).
   */
  public static getTtsLanguages(): LanguageDescriptor[] {
    return REGISTRY.filter((l) => l.capabilities?.tts !== false);
  }

  /**
   * Normalize any legacy uppercase or locale-tagged language code to lower-case ISO code.
   * e.g. 'EN' -> 'en', 'en-US' -> 'en', 'ES' -> 'es'
   */
  public static normalizeCode(code?: string): string {
    if (!code) return 'en';
    const trimmed = code.trim().toLowerCase();
    const baseCode = trimmed.split('-')[0].split('_')[0];
    return baseCode || 'en';
  }

  /**
   * Find a LanguageDescriptor by code (case-insensitive, handles legacy codes like 'EN').
   */
  public static getLanguageByCode(code: string): LanguageDescriptor | undefined {
    const norm = this.normalizeCode(code);
    return REGISTRY.find((l) => l.code === norm);
  }

  /**
   * Format display string native-first: "NativeName (EnglishName)".
   * e.g. "Español (Spanish)", "日本語 (Japanese)", "English"
   */
  public static formatDisplay(code: string): string {
    const lang = this.getLanguageByCode(code);
    if (!lang) {
      return code.toUpperCase();
    }
    if (lang.nativeName === lang.name) {
      return lang.name;
    }
    return `${lang.nativeName} (${lang.name})`;
  }
}

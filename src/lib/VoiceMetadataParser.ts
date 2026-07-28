import { VoiceDescriptor } from './types/voice-provider-types';

export interface InterpretedVoiceMetadata {
  id: string;
  displayName: string;
  languageName: string;
  languageCode: string;
  countryFlag: string;
  gender: 'female' | 'male' | 'neutral';
  rawId: string;
}

const PREFIX_MAP: Record<
  string,
  { languageName: string; languageCode: string; countryFlag: string; gender: 'female' | 'male' | 'neutral' }
> = {
  af: { languageName: 'English (US)', languageCode: 'EN', countryFlag: '🇺🇸', gender: 'female' },
  am: { languageName: 'English (US)', languageCode: 'EN', countryFlag: '🇺🇸', gender: 'male' },
  bf: { languageName: 'English (UK)', languageCode: 'EN', countryFlag: '🇬🇧', gender: 'female' },
  bm: { languageName: 'English (UK)', languageCode: 'EN', countryFlag: '🇬🇧', gender: 'male' },
  ef: { languageName: 'Spanish', languageCode: 'ES', countryFlag: '🇪🇸', gender: 'female' },
  em: { languageName: 'Spanish', languageCode: 'ES', countryFlag: '🇪🇸', gender: 'male' },
  ff: { languageName: 'French', languageCode: 'FR', countryFlag: '🇫🇷', gender: 'female' },
  fm: { languageName: 'French', languageCode: 'FR', countryFlag: '🇫🇷', gender: 'male' },
  pf: { languageName: 'Portuguese', languageCode: 'PT', countryFlag: '🇵🇹', gender: 'female' },
  pm: { languageName: 'Portuguese', languageCode: 'PT', countryFlag: '🇵🇹', gender: 'male' },
  if: { languageName: 'Italian', languageCode: 'IT', countryFlag: '🇮🇹', gender: 'female' },
  im: { languageName: 'Italian', languageCode: 'IT', countryFlag: '🇮🇹', gender: 'male' },
  jf: { languageName: 'Japanese', languageCode: 'JA', countryFlag: '🇯🇵', gender: 'female' },
  jm: { languageName: 'Japanese', languageCode: 'JA', countryFlag: '🇯🇵', gender: 'male' },
  zf: { languageName: 'Chinese', languageCode: 'ZH', countryFlag: '🇨🇳', gender: 'female' },
  zm: { languageName: 'Chinese', languageCode: 'ZH', countryFlag: '🇨🇳', gender: 'male' },
};

/**
 * Parses raw neural voice IDs (e.g. af_bella, ef_dora, es_ES-davefx) into user-friendly metadata.
 */
export function parseVoiceMetadata(descriptor: VoiceDescriptor | string): InterpretedVoiceMetadata {
  const rawId = typeof descriptor === 'string' ? descriptor : descriptor.id;
  const rawName = typeof descriptor === 'string' ? descriptor : descriptor.name;

  if (!rawId || typeof rawId !== 'string') {
    return {
      id: rawId || 'unknown',
      displayName: 'Unknown Voice',
      languageName: 'General',
      languageCode: 'EN',
      countryFlag: '🌐',
      gender: 'neutral',
      rawId: String(rawId),
    };
  }

  const cleanId = rawId.trim();
  const lowerId = cleanId.toLowerCase();

  // 1. Check 2-letter prefix format (e.g. af_bella -> prefix 'af', name 'bella')
  const prefixMatch = lowerId.match(/^([a-z]{2})_(.+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const namePart = prefixMatch[2];

    if (PREFIX_MAP[prefix]) {
      const info = PREFIX_MAP[prefix];
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      return {
        id: cleanId,
        displayName: formattedName,
        languageName: info.languageName,
        languageCode: info.languageCode,
        countryFlag: info.countryFlag,
        gender: info.gender,
        rawId: cleanId,
      };
    }
  }

  // 2. Fallback checking ISO 2-letter language prefixes (e.g. es_davefx, fr_fr_upmc)
  if (lowerId.startsWith('es_')) {
    return {
      id: cleanId,
      displayName: rawName.replace(/^es_/i, '').replace(/_/g, ' '),
      languageName: 'Spanish',
      languageCode: 'ES',
      countryFlag: '🇪🇸',
      gender: lowerId.includes('f_') || lowerId.includes('female') ? 'female' : 'male',
      rawId: cleanId,
    };
  } else if (lowerId.startsWith('en_') || lowerId.startsWith('us_')) {
    return {
      id: cleanId,
      displayName: rawName.replace(/^en_/i, '').replace(/_/g, ' '),
      languageName: 'English',
      languageCode: 'EN',
      countryFlag: lowerId.includes('gb') || lowerId.includes('uk') ? '🇬🇧' : '🇺🇸',
      gender: lowerId.includes('f_') || lowerId.includes('female') ? 'female' : 'male',
      rawId: cleanId,
    };
  } else if (lowerId.startsWith('fr_')) {
    return {
      id: cleanId,
      displayName: rawName.replace(/^fr_/i, '').replace(/_/g, ' '),
      languageName: 'French',
      languageCode: 'FR',
      countryFlag: '🇫🇷',
      gender: lowerId.includes('f_') ? 'female' : 'male',
      rawId: cleanId,
    };
  }

  // 3. General Fallback for unknown / generic voice IDs
  const cleanDisplayName = rawName && rawName !== cleanId ? rawName : cleanId;
  const inferredGender: 'female' | 'male' | 'neutral' =
    lowerId.includes('female') || lowerId.includes('_f_') || lowerId.includes('f_')
      ? 'female'
      : lowerId.includes('male') || lowerId.includes('_m_') || lowerId.includes('m_')
      ? 'male'
      : 'neutral';

  return {
    id: cleanId,
    displayName: cleanDisplayName,
    languageName: typeof descriptor !== 'string' && descriptor.language ? descriptor.language : 'General',
    languageCode: typeof descriptor !== 'string' && descriptor.language ? descriptor.language.slice(0, 2).toUpperCase() : 'EN',
    countryFlag: '🌐',
    gender: inferredGender,
    rawId: cleanId,
  };
}

/**
 * Organizes a list of voices into language groups and prioritizes target project language.
 */
export function groupAndPrioritizeVoices(
  voices: VoiceDescriptor[],
  targetLanguageCode?: string
): {
  recommended: InterpretedVoiceMetadata[];
  groups: Array<{ languageName: string; languageCode: string; countryFlag: string; voices: InterpretedVoiceMetadata[] }>;
} {
  const parsed = voices.map((v) => parseVoiceMetadata(v));
  const normTarget = targetLanguageCode ? targetLanguageCode.trim().toUpperCase() : '';

  const recommended: InterpretedVoiceMetadata[] = [];
  const groupMap = new Map<string, { languageName: string; languageCode: string; countryFlag: string; voices: InterpretedVoiceMetadata[] }>();

  for (const voice of parsed) {
    if (normTarget && voice.languageCode.toUpperCase() === normTarget) {
      recommended.push(voice);
    }

    const groupKey = voice.languageName;
    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        languageName: voice.languageName,
        languageCode: voice.languageCode,
        countryFlag: voice.countryFlag,
        voices: [],
      });
    }
    groupMap.get(groupKey)!.voices.push(voice);
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => a.languageName.localeCompare(b.languageName));

  return { recommended, groups };
}

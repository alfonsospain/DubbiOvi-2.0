/**
 * @fileOverview Helper functions for Gemini ASR error classification, redaction, and diagnostics.
 */

import type { AsrOutput } from '@/ai/flows/asr-transcription';
import type { Take } from './types';
import { v4 as uuidv4 } from 'uuid';

export interface AudioTranscriptionSuccess {
  success: true;
  data: AsrOutput;
}

export interface AudioTranscriptionFailure {
  success: false;
  error: string;
  statusCode?: number;
}

export type AudioTranscriptionResult =
  | AudioTranscriptionSuccess
  | AudioTranscriptionFailure;

/**
 * Strips API keys or query params containing credentials from error messages.
 */
export function sanitizeGeminiError(message: string, activeKey?: string): string {
  if (!message) return 'Unknown error';
  let safe = message
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/AIzaSy[A-Za-z0-9_-]{33}/g, '[REDACTED]');
  if (activeKey && activeKey.length > 5) {
    safe = safe.split(activeKey).join('[REDACTED]');
  }
  return safe;
}

/**
 * Classifies Gemini ASR errors into user-friendly, actionable diagnostic messages.
 */
export function classifyGeminiAsrError(
  err: any,
  activeKey?: string
): { error: string; statusCode?: number; isRetryable: boolean } {
  const rawMsg = err?.message || String(err) || 'Unknown error occurred';
  const safeMsg = sanitizeGeminiError(rawMsg, activeKey);

  let statusCode: number | undefined = err?.status || err?.statusCode;
  if (!statusCode) {
    const match = rawMsg.match(/\[(\d{3})\s+[^\]]+\]|\b(400|401|403|404|429|500|503)\b/);
    if (match) {
      statusCode = parseInt(match[1] || match[2], 10);
    }
  }

  // 1. HTTP 503 - Service Unavailable / High Demand (Transient - eligible for controlled retry)
  if (statusCode === 503 || /503|service unavailable|high demand|overloaded/i.test(safeMsg)) {
    return {
      statusCode: 503,
      isRetryable: true,
      error: 'Google Gemini service is temporarily unavailable due to high demand (HTTP 503). Please retry in a few moments.',
    };
  }

  // 2. HTTP 429 - Rate limit / Quota exceeded (Permanent for immediate call)
  if (statusCode === 429 || /429|resource_exhausted|quota|rate limit/i.test(safeMsg)) {
    return {
      statusCode: 429,
      isRetryable: false,
      error: 'Google Gemini quota or rate limit exceeded (HTTP 429). Please check your plan or try again later.',
    };
  }

  // 3. Authentication failures (400 with invalid key, 401 unauthorized, 403 forbidden, missing key)
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    (statusCode === 400 && /api[ _]key|key not valid/i.test(safeMsg)) ||
    /api[ _]key|api_key_false_error|unauthorized|forbidden|invalid key/i.test(safeMsg)
  ) {
    return {
      statusCode: statusCode || 401,
      isRetryable: false,
      error: 'Invalid or missing Google Gemini API key. Please check your API key in AI Platforms settings.',
    };
  }

  // 4. Model not found (404)
  if (statusCode === 404 || /404|not found/i.test(safeMsg)) {
    return {
      statusCode: 404,
      isRetryable: false,
      error: 'The configured Google Gemini model was not found (HTTP 404).',
    };
  }

  // 5. Default/Unexpected failure
  return {
    statusCode,
    isRetryable: false,
    error: `Gemini transcription failed: ${safeMsg}`,
  };
}

/**
 * Formats decimal seconds into standard timecode string "HH:MM:SS.mmm".
 */
export function formatSecondsToTimecode(seconds: number): string {
  if (isNaN(seconds) || seconds < 0 || !Number.isFinite(seconds)) {
    return '00:00:00.000';
  }
  const totalMs = Math.round(seconds * 1000);
  const ms = totalMs % 1000;
  const totalSec = Math.floor(totalMs / 1000);
  const secs = totalSec % 60;
  const totalMin = Math.floor(totalSec / 60);
  const mins = totalMin % 60;
  const hours = Math.floor(totalMin / 60);

  const hStr = String(hours).padStart(2, '0');
  const mStr = String(mins).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');

  return `${hStr}:${mStr}:${sStr}.${msStr}`;
}

/**
 * Checks whether a timestamp string is unambiguously in Gemini non-standard "MM:SS:mmm.xxx" format.
 *
 * Rules:
 * 1. Must have 3 colon-separated segments: [minutes, seconds, milliseconds].
 * 2. Unambiguous non-standard indicators:
 *    - The 3rd segment is >= 60 (standard seconds cannot exceed 59).
 *    - The 3rd segment has 3 or more digits before the decimal point (e.g. "006.890", "156.890").
 * 3. Does NOT classify as Gemini-specific merely because the 3rd component contains a decimal point.
 */
export function isGeminiNonStandardTimecode(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim().replace(',', '.');
  const parts = trimmed.split(':').map(p => p.trim());
  if (parts.length !== 3) return false;

  const p2Float = parseFloat(parts[2]);
  if (!Number.isFinite(p2Float)) return false;

  // Criterion 1: Milliseconds >= 60 (impossible for standard seconds)
  if (p2Float >= 60) {
    return true;
  }

  // Criterion 2: 3 or more digits before the decimal point in the 3rd component
  const intPart = parts[2].split('.')[0];
  if (intPart.length >= 3) {
    return true;
  }

  return false;
}

export interface GeminiTimestampOptions {
  /**
   * Explicitly force interpretation as Gemini MM:SS:mmm.xxx even for ambiguous timestamps.
   */
  forceGeminiFormat?: boolean;
  /**
   * Media duration in seconds (if available), used as contextual evidence to disambiguate.
   */
  mediaDuration?: number;
}

/**
 * Parses a timestamp into absolute seconds.
 * Supports:
 * - Unambiguous Gemini non-standard format "MM:SS:mmm.xxx" (e.g. "01:59:466.890" -> 119.467s).
 * - Standard "HH:MM:SS.mmm" and "HH:MM:SS,mmm" (e.g. "00:01:59.466" -> 119.466s).
 * - Standard "MM:SS.mmm" (e.g. "01:59.466" -> 119.466s).
 * - Ambiguous timestamps (e.g. "00:00:02.190"): preserved as standard 2.190s unless sufficient context
 *   (e.g. forceGeminiFormat or mediaDuration conflict) is explicitly provided.
 */
export function parseGeminiTimestamp(
  raw: string,
  options?: GeminiTimestampOptions
): number {
  if (!raw || typeof raw !== 'string') {
    return 0;
  }

  const trimmed = raw.trim().replace(',', '.');
  const parts = trimmed.split(':').map(p => p.trim());

  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return Number.isFinite(val) ? Math.max(0, val) : 0;
  }

  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return 0;
    return Math.max(0, mins * 60 + secs);
  }

  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseFloat(parts[2]);

    if (!Number.isFinite(p0) || !Number.isFinite(p1) || !Number.isFinite(p2)) {
      return 0;
    }

    const isNonStandard = isGeminiNonStandardTimecode(raw);

    const standardSeconds = p0 * 3600 + p1 * 60 + p2;
    const geminiSeconds = p0 * 60 + p1 + p2 / 1000;

    // 1. Unambiguously non-standard Gemini format
    if (isNonStandard) {
      return Math.max(0, geminiSeconds);
    }

    // 2. Explicit force option provided by caller
    if (options?.forceGeminiFormat === true) {
      return Math.max(0, geminiSeconds);
    }

    // 3. Media duration context: if standard parsing exceeds duration but Gemini fits
    if (
      typeof options?.mediaDuration === 'number' &&
      Number.isFinite(options.mediaDuration) &&
      options.mediaDuration > 0
    ) {
      if (standardSeconds > options.mediaDuration && geminiSeconds <= options.mediaDuration) {
        return Math.max(0, geminiSeconds);
      }
    }

    // 4. Default / Ambiguous timestamps (e.g. "00:00:02.190", "00:01:59.466")
    // Preserve standard HH:MM:SS.mmm format when no sufficient non-standard context exists.
    return Math.max(0, standardSeconds);
  }

  return 0;
}

/**
 * Normalizes raw take boundaries from Gemini ASR.
 * - Detects whether the batch uses the Gemini non-standard format.
 * - Resolves timestamps appropriately.
 * - Validates that take boundaries are finite, nonnegative, ordered (startSeconds <= endSeconds),
 *   and within mediaDuration when available.
 * - Preserves original transcription text, character identities, and take ordering.
 */
export function normalizeGeminiTakes(
  rawTakes: any[],
  mediaDuration?: number
): Take[] {
  if (!Array.isArray(rawTakes) || rawTakes.length === 0) {
    return [];
  }

  // Detect whether the batch exhibits non-standard Gemini format
  const isBatchGemini = rawTakes.some(t => {
    let s = String(t?.startTime || '');
    let e = String(t?.endTime || '');
    if ((!s || !e) && typeof t?.time === 'string' && t.time.includes(' - ')) {
      const parts = t.time.split(' - ');
      s = s || parts[0];
      e = e || parts[1];
    }
    return isGeminiNonStandardTimecode(s) || isGeminiNonStandardTimecode(e);
  });

  return rawTakes.map((t, index) => {
    let rawStart = t?.startTime;
    let rawEnd = t?.endTime;

    if ((!rawStart || !rawEnd) && typeof t?.time === 'string' && t.time.includes(' - ')) {
      const parts = t.time.split(' - ');
      rawStart = rawStart || parts[0];
      rawEnd = rawEnd || parts[1];
    }

    rawStart = String(rawStart || '00:00:00.000');
    rawEnd = String(rawEnd || '00:00:00.000');

    let startSeconds = parseGeminiTimestamp(rawStart, {
      forceGeminiFormat: isBatchGemini,
      mediaDuration,
    });
    let endSeconds = parseGeminiTimestamp(rawEnd, {
      forceGeminiFormat: isBatchGemini,
      mediaDuration,
    });

    // Validate finite & nonnegative
    startSeconds = Number.isFinite(startSeconds) ? Math.max(0, startSeconds) : 0;
    endSeconds = Number.isFinite(endSeconds) ? Math.max(0, endSeconds) : startSeconds;

    // Validate ordering: startSeconds <= endSeconds
    if (endSeconds < startSeconds) {
      endSeconds = startSeconds;
    }

    // Validate within mediaDuration when available and applicable
    if (
      isBatchGemini &&
      typeof mediaDuration === 'number' &&
      Number.isFinite(mediaDuration) &&
      mediaDuration > 0
    ) {
      startSeconds = Math.min(startSeconds, mediaDuration);
      endSeconds = Math.min(endSeconds, mediaDuration);
      if (endSeconds < startSeconds) {
        endSeconds = startSeconds;
      }
    }

    const timeFormatted = isBatchGemini
      ? `${formatSecondsToTimecode(startSeconds)} - ${formatSecondsToTimecode(endSeconds)}`
      : `${rawStart} - ${rawEnd}`;

    return {
      id: t?.id || uuidv4(),
      character: t?.character || `Speaker ${index + 1}`,
      time: timeFormatted,
      startSeconds,
      endSeconds,
      original: t?.original || '',
      translation: t?.translation || '',
      notes: t?.notes || '',
      status: (t?.status === 'Reviewed' || t?.status === 'Locked') ? t.status : ('Pending' as const),
      voiceAssetId: t?.voiceAssetId,
      fittedVoiceAssetId: t?.fittedVoiceAssetId,
    };
  });
}

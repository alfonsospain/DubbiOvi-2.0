import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Take } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00:00,000';
  }
  const date = new Date(seconds * 1000);
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const secs = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = secs.toString().padStart(2, '0');
  const msStr = ms.toString().padStart(3, '0');

  return `${hStr}:${mStr}:${sStr},${msStr}`;
}

export function formatTimeForDisplay(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '00:00.000';
  }
  const totalSeconds = Math.floor(seconds);
  const ms = Math.floor((seconds % 1) * 1000);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(ms).padStart(3, '0')}`;
}

export function parseTimeToSeconds(time: string): number {
    const parts = time.split(/[:,.]/);
    if (parts.length === 4) { // HH:MM:SS.ms
        const [hours, minutes, seconds, milliseconds] = parts.map(Number);
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
    }
    if (parts.length === 3) { // MM:SS.ms
         const [minutes, seconds, milliseconds] = parts.map(Number);
         return minutes * 60 + seconds + milliseconds / 1000;
    }
    return 0;
}

export function toSRT(takes: Take[]): string {
  return takes
    .map((take, index) => {
      const startTime = formatTime(take.startSeconds).replace('.', ',');
      const endTime = formatTime(take.endSeconds).replace('.', ',');
      const text = take.translation || `[${take.character}: No translation]`;
      return `${index + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    })
    .join('\n');
}

export function toVTT(takes: Take[]): string {
  let vtt = 'WEBVTT\n\n';
  vtt += takes
    .map(take => {
      const startTime = formatTime(take.startSeconds).replace(',', '.');
      const endTime = formatTime(take.endSeconds).replace(',', '.');
      const text = take.translation
        ? `<v ${take.character}>${take.translation}`
        : `[${take.character}: No translation]`;
      return `${startTime} --> ${endTime}\n${text}\n`;
    })
    .join('\n');
  return vtt;
}

/**
 * Parses a timestamp in HH:MM:SS.mmm (or HH:MM:SS,mmm or MM:SS.mmm) format into absolute decimal seconds.
 * Supports mathematical overflow normalization (e.g. "00:24:65.050" -> 1505.05s).
 * 
 * @param timestamp The timestamp string.
 * @returns The absolute time in decimal seconds.
 */
export function parseTimestampToSeconds(timestamp: string): number {
  if (!timestamp || typeof timestamp !== 'string') {
    throw new Error('Invalid timestamp input: must be a non-empty string');
  }

  // Normalize comma to dot for decimal milliseconds and trim surrounding whitespace
  const trimmed = timestamp.trim().replace(',', '.');

  // Split into colon-separated segments: e.g. ["00", "24", "65.050"] or ["24", "65.050"]
  const parts = trimmed.split(':').map(p => p.trim());

  if (parts.length < 1 || parts.length > 3) {
    throw new Error(`Malformed timestamp: "${timestamp}". Expected format HH:MM:SS.mmm or MM:SS.mmm`);
  }

  let hours = 0;
  let minutes = 0;
  let secondsWithMs = '';

  if (parts.length === 3) {
    hours = parseInt(parts[0], 10);
    minutes = parseInt(parts[1], 10);
    secondsWithMs = parts[2];
  } else if (parts.length === 2) {
    minutes = parseInt(parts[0], 10);
    secondsWithMs = parts[1];
  } else {
    secondsWithMs = parts[0];
  }

  // Split seconds and decimal milliseconds part
  const secParts = secondsWithMs.split('.');
  const seconds = parseInt(secParts[0], 10);

  let milliseconds = 0;
  if (secParts.length > 1 && secParts[1].length > 0) {
    const msStr = secParts[1].trim();
    milliseconds = parseInt(msStr, 10) / Math.pow(10, msStr.length);
  }

  if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
    throw new Error(`Malformed timestamp: "${timestamp}". Numbers could not be parsed`);
  }

  return hours * 3600 + minutes * 60 + seconds + milliseconds;
}


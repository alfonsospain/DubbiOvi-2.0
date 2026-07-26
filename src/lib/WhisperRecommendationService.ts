export type WhisperModelId = 'ggml-tiny.bin' | 'ggml-base.bin' | 'ggml-small.bin' | 'ggml-medium.bin';

export interface RecommendationResult {
  model: WhisperModelId;
  reason: string;
}

/**
 * Independent recommendation service responsible exclusively for assessing hardware
 * capabilities and advising the optimal Whisper model.
 * The recommendation is strictly advisory and does not constrain user selection.
 */
export class WhisperRecommendationService {
  /**
   * Evaluates hardware environment (CPU logical cores, platform, estimated memory)
   * and returns a structured recommendation result with domain rationale.
   */
  public static getRecommendation(): RecommendationResult {
    let logicalCores = 4;
    if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
      logicalCores = navigator.hardwareConcurrency;
    }

    let memoryGB = 8;
    if (typeof navigator !== 'undefined' && (navigator as any).deviceMemory) {
      memoryGB = (navigator as any).deviceMemory;
    }

    if (memoryGB >= 16 && logicalCores >= 8) {
      return {
        model: 'ggml-small.bin',
        reason: 'Recommended for high-performance systems with 8+ CPU cores & 16GB+ RAM.',
      };
    }

    if (memoryGB >= 8 && logicalCores >= 4) {
      return {
        model: 'ggml-base.bin',
        reason: 'Recommended for balanced speed and accuracy on standard desktop hardware.',
      };
    }

    return {
      model: 'ggml-tiny.bin',
      reason: 'Recommended for maximum execution speed and lightweight memory usage.',
    };
  }
}

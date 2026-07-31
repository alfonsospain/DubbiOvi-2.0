import type { Take } from './types';
import type { VoiceAsset } from './types/voice-types';
import { VoiceAssetManager } from './VoiceAssetManager';

export type FittingStatusLevel = 'original' | 'normal' | 'notice' | 'heavy' | 'warn_speed';

export interface FittingStatusInfo {
  warning: boolean;
  level: FittingStatusLevel;
  message: string | null;
  statusLabel: string;
}

export interface FitVoiceOptions {
  take: Take;
  originalAsset: VoiceAsset;
  getAssetManager: () => VoiceAssetManager | null;
  projectPath?: string;
  minThreshold?: number; // default 1.0 (slowdown disabled)
  maxThreshold?: number; // default 1.35
}

export interface FitVoiceResult {
  success: boolean;
  fittedAsset?: VoiceAsset;
  updatedTake?: Take;
  ratio: number;
  warning: FittingStatusInfo;
  error?: string;
}

export class VoiceFittingService {
  /**
   * Calculates the timing ratio R = voiceDuration / takeDuration.
   * Speed-Up Only Policy:
   * If voiceDuration > takeDuration, audio speeds up by ratio (atempo = ratio > 1.0).
   * If voiceDuration <= takeDuration, voice fits natively within take, so ratio = 1.0 (no change).
   */
  public static calculateFittingRatio(takeDurationSeconds: number, voiceDurationSeconds: number): number {
    if (!takeDurationSeconds || takeDurationSeconds <= 0 || !voiceDurationSeconds || voiceDurationSeconds <= 0) {
      return 1.0;
    }
    if (voiceDurationSeconds <= takeDurationSeconds) {
      return 1.0;
    }
    const ratio = voiceDurationSeconds / takeDurationSeconds;
    return Math.round(ratio * 1000) / 1000;
  }

  /**
   * Evaluates the fitting status indicator for a given ratio.
   * Ratios:
   * <= 1.00x: Original (No fitting needed)
   * 1.00x - 1.20x: Fitted (Normal speed-up)
   * 1.20x - 1.35x: Fitted (Notice speed-up)
   * > 1.35x: Heavy adjustment (Warning status)
   */
  public static getThresholdWarning(
    ratio: number,
    minThreshold = 1.0,
    maxThreshold = 1.35
  ): FittingStatusInfo {
    if (ratio <= 1.0) {
      return {
        warning: false,
        level: 'original',
        message: null,
        statusLabel: 'Original',
      };
    }
    if (ratio > maxThreshold) {
      return {
        warning: true,
        level: 'heavy',
        message: `Heavy timing adjustment (${ratio.toFixed(2)}x speed)`,
        statusLabel: `Fitted (${ratio.toFixed(2)}x)`,
      };
    }
    if (ratio > 1.20) {
      return {
        warning: false,
        level: 'notice',
        message: `Fitted (${ratio.toFixed(2)}x speed)`,
        statusLabel: `Fitted (${ratio.toFixed(2)}x)`,
      };
    }
    return {
      warning: false,
      level: 'normal',
      message: null,
      statusLabel: `Fitted (${ratio.toFixed(2)}x)`,
    };
  }

  /**
   * Automatically adapts a generated VoiceAsset to match a Take's duration using FFmpeg atempo.
   * Speed-up Only:
   * - If voice fits take duration (voiceDuration <= takeDuration), preserves original VoiceAsset & clears fittedVoiceAssetId.
   * - If voice exceeds take duration (voiceDuration > takeDuration), generates speed-up fitted VoiceAsset.
   */
  public static async fitVoiceForTake(options: FitVoiceOptions): Promise<FitVoiceResult> {
    const { take, originalAsset, getAssetManager, projectPath, maxThreshold = 1.35 } = options;
    const manager = getAssetManager();

    const takeDuration = Math.max(0.1, take.endSeconds - take.startSeconds);
    const voiceDuration = originalAsset.durationSeconds || takeDuration;

    // Speed-up Only Policy: If voice fits within take, keep original asset & do not alter timing
    if (voiceDuration <= takeDuration + 0.001) {
      const updatedTake: Take = {
        ...take,
        fittedVoiceAssetId: undefined,
      };
      return {
        success: true,
        fittedAsset: originalAsset,
        updatedTake,
        ratio: 1.0,
        warning: {
          warning: false,
          level: 'original',
          message: null,
          statusLabel: 'Original',
        },
      };
    }

    const ratio = this.calculateFittingRatio(takeDuration, voiceDuration);
    const warningInfo = this.getThresholdWarning(ratio, 1.0, maxThreshold);

    const ext = originalAsset.format || 'wav';
    const fittedFilename = `fitted_${take.id}_${Date.now()}.${ext}`;
    const outputRelativePath = `Audio/${fittedFilename}`;

    if (typeof window !== 'undefined' && (window as any).electron?.adjustVoiceTiming) {
      const ipcRes = await (window as any).electron.adjustVoiceTiming({
        inputRelativePath: originalAsset.relativePath,
        outputRelativePath,
        ratio,
        targetDuration: takeDuration,
        projectPath,
      });

      if (!ipcRes.success) {
        return {
          success: false,
          ratio,
          warning: warningInfo,
          error: ipcRes.error || 'Failed to fit voice timing with FFmpeg.',
        };
      }

      const fittedAssetId = `fitted_${originalAsset.id}_${Date.now()}`;
      const newFittedAsset = manager
        ? manager.registerAsset({
            id: fittedAssetId,
            takeId: take.id,
            relativePath: ipcRes.relativePath || outputRelativePath,
            filename: fittedFilename,
            format: originalAsset.format,
            sampleRate: originalAsset.sampleRate,
            durationSeconds: takeDuration,
            metadata: {
              ...originalAsset.metadata,
              parentAssetId: originalAsset.id,
              isAdjusted: true,
              originalDuration: voiceDuration,
              takeDuration,
              adjustmentRatio: ratio,
              adjustedAt: new Date().toISOString(),
            },
          })
        : {
            id: fittedAssetId,
            takeId: take.id,
            relativePath: outputRelativePath,
            filename: fittedFilename,
            format: originalAsset.format,
            sampleRate: originalAsset.sampleRate,
            durationSeconds: takeDuration,
            metadata: {
              ...originalAsset.metadata,
              parentAssetId: originalAsset.id,
              isAdjusted: true,
              originalDuration: voiceDuration,
              takeDuration,
              adjustmentRatio: ratio,
              adjustedAt: new Date().toISOString(),
            },
          };

      const updatedTake: Take = {
        ...take,
        fittedVoiceAssetId: newFittedAsset.id,
      };

      return {
        success: true,
        fittedAsset: newFittedAsset,
        updatedTake,
        ratio,
        warning: warningInfo,
      };
    }

    // Fallback for non-Electron environment
    const fittedAssetId = `fitted_${originalAsset.id}_mock`;
    const mockFittedAsset = manager
      ? manager.registerAsset({
          id: fittedAssetId,
          takeId: take.id,
          relativePath: outputRelativePath,
          filename: fittedFilename,
          format: originalAsset.format,
          sampleRate: originalAsset.sampleRate,
          durationSeconds: takeDuration,
          metadata: {
            ...originalAsset.metadata,
            parentAssetId: originalAsset.id,
            isAdjusted: true,
            originalDuration: voiceDuration,
            takeDuration,
            adjustmentRatio: ratio,
            adjustedAt: new Date().toISOString(),
          },
        })
      : {
          id: fittedAssetId,
          takeId: take.id,
          relativePath: outputRelativePath,
          filename: fittedFilename,
          format: originalAsset.format,
          sampleRate: originalAsset.sampleRate,
          durationSeconds: takeDuration,
          metadata: {
            ...originalAsset.metadata,
            parentAssetId: originalAsset.id,
            isAdjusted: true,
            originalDuration: voiceDuration,
            takeDuration,
            adjustmentRatio: ratio,
            adjustedAt: new Date().toISOString(),
          },
        };

    return {
      success: true,
      fittedAsset: mockFittedAsset,
      updatedTake: {
        ...take,
        fittedVoiceAssetId: mockFittedAsset.id,
      },
      ratio,
      warning: warningInfo,
    };
  }
}

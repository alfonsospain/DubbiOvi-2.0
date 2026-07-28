import type { Take } from '@/lib/types';
import type { VoiceAssetManager } from '@/lib/VoiceAssetManager';

export interface AudioMixdownOptions {
  videoFile: File | null;
  videoUrl?: string | null;
  videoPath?: string | null;
  takes: Take[];
  getAssetManager: () => VoiceAssetManager | null;
  originalVolume: number; // 0.0 to 1.0
  originalEnabled: boolean;
  voiceVolume: number; // 0.0 to 1.0
  voiceEnabled: boolean;
  outputFormat?: 'wav' | 'mp3';
  projectPath?: string;
}

export interface FFmpegCommandResult {
  inputs: string[];
  filterComplex: string;
  outputArgs: string[];
  ffmpegArgs: string[];
  fullCommand: string;
}

export interface RenderMixdownResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  message?: string;
}

/**
 * Service module managing Audio Mixdown & Export for Milestone 15.4.
 *
 * Uses FFmpeg as the sole rendering engine.
 * Combines original video soundtrack and generated Take voice assets at their IN timestamps (startSeconds)
 * using Playback Mixer settings.
 */
export class AudioMixdownService {
  /**
   * Generates FFmpeg arguments and filter_complex string matching Playback Mixer settings.
   */
  public static buildFFmpegCommand(
    options: AudioMixdownOptions,
    videoInputPath = 'input_video.mp4',
    outputFilePath = 'dubbed_audio_mixdown.wav'
  ): FFmpegCommandResult {
    const inputs: string[] = [];
    const ffmpegArgs: string[] = ['-y'];
    const filterSegments: string[] = [];
    const mixInputLabels: string[] = [];

    const origVol = options.originalEnabled ? Math.max(0, Math.min(1, options.originalVolume)) : 0;
    const vVol = options.voiceEnabled ? Math.max(0, Math.min(1, options.voiceVolume)) : 0;

    // Input 0: Original Video / Audio
    inputs.push(`-i "${videoInputPath}"`);
    ffmpegArgs.push('-i', videoInputPath);

    if (options.originalEnabled && origVol > 0) {
      filterSegments.push(`[0:a]volume=${origVol.toFixed(2)}[a0]`);
      mixInputLabels.push('[a0]');
    }

    // Inputs 1..N: Valid Take Voice Assets
    const manager = options.getAssetManager();
    let inputIdx = 1;

    for (const take of options.takes) {
      if (!options.voiceEnabled || vVol === 0) continue;
      if (!take.voiceAssetId) continue;

      const asset = manager ? manager.getActiveAssetForTake(take) || manager.getAsset(take.voiceAssetId) : null;
      if (!asset || !asset.relativePath) continue;

      const delayMs = Math.round(Math.max(0, take.startSeconds) * 1000);
      const assetPath = asset.relativePath;

      inputs.push(`-i "${assetPath}"`);
      ffmpegArgs.push('-i', assetPath);

      filterSegments.push(
        `[${inputIdx}:a]adelay=delays=${delayMs}:all=1,volume=${vVol.toFixed(2)}[a${inputIdx}]`
      );
      mixInputLabels.push(`[a${inputIdx}]`);
      inputIdx++;
    }

    // Complex filter string assembly
    let filterComplex = '';
    if (mixInputLabels.length === 0) {
      // Silent output fallback
      filterComplex = 'anullsrc=r=44100:cl=stereo[outa]';
    } else if (mixInputLabels.length === 1) {
      filterComplex = filterSegments.join('; ') + `; ${mixInputLabels[0]}anull[outa]`;
    } else {
      filterComplex =
        filterSegments.join('; ') +
        `; ${mixInputLabels.join('')}amix=inputs=${mixInputLabels.length}:duration=longest:dropout_transition=0[outa]`;
    }

    const codec = options.outputFormat === 'mp3' ? 'libmp3lame' : 'pcm_s16le';
    const outputArgs = ['-map', '[outa]', '-c:a', codec, `"${outputFilePath}"`];

    ffmpegArgs.push('-filter_complex', filterComplex, '-map', '[outa]', '-c:a', codec, outputFilePath);

    const fullCommand = `ffmpeg ${inputs.join(' ')} -filter_complex "${filterComplex}" ${outputArgs.join(' ')}`;

    return {
      inputs,
      filterComplex,
      outputArgs,
      ffmpegArgs,
      fullCommand,
    };
  }

  /**
   * Executes FFmpeg audio mixdown directly via Electron IPC.
   */
  public static async renderFFmpegMixdown(
    options: AudioMixdownOptions,
    outputFilePath: string
  ): Promise<RenderMixdownResult> {
    try {
      const videoPath = options.videoPath || (options.videoFile as any)?.path || 'video.mp4';
      const cmdResult = AudioMixdownService.buildFFmpegCommand(options, videoPath, outputFilePath);

      if (typeof window !== 'undefined' && (window as any).electron?.renderAudioMixdown) {
        const res = await (window as any).electron.renderAudioMixdown({
          ffmpegArgs: cmdResult.ffmpegArgs,
          outputPath: outputFilePath,
          projectPath: options.projectPath,
        });

        if (res.success) {
          return {
            success: true,
            outputPath: res.outputPath,
            fileSize: res.fileSize,
          };
        } else {
          return {
            success: false,
            message: res.error || 'FFmpeg mixdown execution failed.',
          };
        }
      }

      // Return mock result if running outside Electron
      return {
        success: true,
        outputPath: outputFilePath,
        message: 'FFmpeg command generated successfully (running outside Electron environment).',
      };
    } catch (err: any) {
      console.error('[AudioMixdownService] FFmpeg mixdown error:', err);
      return {
        success: false,
        message: err?.message || 'Failed to execute FFmpeg mixdown.',
      };
    }
  }
}

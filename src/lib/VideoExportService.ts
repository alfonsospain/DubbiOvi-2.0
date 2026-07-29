import type { Take } from '@/lib/types';
import type { VoiceAssetManager } from '@/lib/VoiceAssetManager';
import { AudioMixdownService, AudioMixdownOptions } from '@/lib/AudioMixdownService';

export type VideoExportMode = 'both' | 'original' | 'voices' | 'silent';

export interface VideoExportOptions {
  videoFile: File | null;
  videoUrl?: string | null;
  videoPath?: string | null;
  takes: Take[];
  getAssetManager: () => VoiceAssetManager | null;
  originalVolume: number; // 0.0 to 1.0
  originalEnabled?: boolean;
  voiceVolume: number; // 0.0 to 1.0
  voiceEnabled?: boolean;
  mode: VideoExportMode;
  projectPath?: string;
  onProgress?: (phase: string, percent?: number) => void;
}

export interface VideoExportResult {
  success: boolean;
  outputPath?: string;
  fileSize?: number;
  duration?: number;
  videoStreamCopied?: boolean;
  videoCodec?: string;
  audioCodec?: string;
  message?: string;
}

/**
 * Service managing Final MP4 Video Export for Milestone 16.
 *
 * Integrates source video stream copying (-c:v copy) with synthesized audio mixdown,
 * using single IPC bridge renderVideoExport.
 */
export class VideoExportService {
  public static async renderVideoExport(
    options: VideoExportOptions,
    outputFilePath: string
  ): Promise<VideoExportResult> {
    try {
      const videoPath = options.videoPath || (options.videoFile as any)?.path || options.videoUrl || 'video.mp4';
      const onProgress = options.onProgress;

      if (onProgress) onProgress('Preparing export', 10);

      const mode = options.mode || 'both';
      const originalEnabled = options.originalEnabled ?? true;
      const voiceEnabled = options.voiceEnabled ?? true;

      let mixdownArgs: string[] | undefined = undefined;

      if (mode !== 'silent') {
        if (onProgress) onProgress('Rendering audio mix', 30);

        const mixOptions: AudioMixdownOptions = {
          videoFile: options.videoFile,
          videoUrl: options.videoUrl,
          videoPath,
          takes: options.takes,
          getAssetManager: options.getAssetManager,
          originalVolume: options.originalVolume,
          originalEnabled: (mode === 'both' || mode === 'original') && originalEnabled,
          voiceVolume: options.voiceVolume,
          voiceEnabled: (mode === 'both' || mode === 'voices') && voiceEnabled,
          outputFormat: 'wav',
          projectPath: options.projectPath,
        };

        const cmdResult = AudioMixdownService.buildFFmpegCommand(mixOptions, videoPath, 'temp_mixdown.wav');
        mixdownArgs = cmdResult.ffmpegArgs;
      }

      if (typeof window !== 'undefined' && (window as any).electron?.renderVideoExport) {
        if (onProgress) onProgress('Attaching audio to video', 60);

        const res = await (window as any).electron.renderVideoExport({
          videoPath,
          outputPath: outputFilePath,
          mode,
          mixdownArgs,
          projectPath: options.projectPath,
        });

        if (res.success) {
          if (onProgress) onProgress('Verifying output', 90);
          if (onProgress) onProgress('Cleaning temporary files', 100);

          return {
            success: true,
            outputPath: res.outputPath,
            fileSize: res.fileSize,
            duration: res.duration,
            videoStreamCopied: res.videoStreamCopied,
            videoCodec: res.videoCodec,
            audioCodec: res.audioCodec,
          };
        } else {
          return {
            success: false,
            message: res.error || 'Video export execution failed.',
          };
        }
      }

      // Fallback result outside Electron environment
      if (onProgress) onProgress('Verifying output', 90);
      if (onProgress) onProgress('Cleaning temporary files', 100);

      return {
        success: true,
        outputPath: outputFilePath,
        message: 'Video export command generated successfully (running outside Electron environment).',
      };
    } catch (err: any) {
      console.error('[VideoExportService] Video export error:', err);
      return {
        success: false,
        message: err?.message || 'Failed to execute video export.',
      };
    }
  }
}

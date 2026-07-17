import { ProviderCapabilities, PreparedAudio } from './transcription-types';

/**
 * Custom error indicating a feature/format is planned in the architecture but not yet implemented.
 */
export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Isolated audio extraction interface.
 * Decouples video decoding from the rest of the AudioPreparationService to facilitate
 * future replacement with FFmpeg.wasm, native Electron bindings, or cloud microservices.
 */
export interface AudioExtractor {
  extract(file: File): Promise<AudioBuffer>;
}

/**
 * Web Audio API implementation of AudioExtractor.
 * Runs in the browser using the window.AudioContext API.
 */
export class WebAudioExtractor implements AudioExtractor {
  public async extract(file: File): Promise<AudioBuffer> {
    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error('Web Audio API is not supported in this browser.');
    }
    const audioContext = new AudioContextClass();
    try {
      return await audioContext.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('WebAudioExtractor: Audio decoding failed:', error);
      throw new Error('Failed to decode video audio track using Web Audio API. The format or codec may be unsupported.');
    } finally {
      await audioContext.close();
    }
  }
}

/**
 * AudioEncoder interface for format-specific encoding.
 */
export interface AudioEncoder {
  encode(buffer: AudioBuffer): Blob;
  mimeType: string;
}

/**
 * Standard WAV format encoder.
 */
export class WavEncoder implements AudioEncoder {
  public get mimeType(): string {
    return 'audio/wav';
  }

  public encode(buffer: AudioBuffer): Blob {
    const sampleRate = buffer.sampleRate;
    const bitDepth = 16;
    const channels = buffer.numberOfChannels;
    
    let channelData: Float32Array;
    if (channels === 1) {
      channelData = buffer.getChannelData(0);
    } else {
      // Interleave channels for stereo/multi-channel WAV encoding
      const chan0 = buffer.getChannelData(0);
      const chan1 = buffer.getChannelData(1);
      channelData = new Float32Array(chan0.length * 2);
      for (let i = 0; i < chan0.length; i++) {
        channelData[i * 2] = chan0[i];
        channelData[i * 2 + 1] = chan1[i];
      }
    }
    
    const sampleCount = channelData.length;
    const bufferLength = sampleCount * 2; // 16-bit is 2 bytes per sample
    const wavBuffer = new ArrayBuffer(44 + bufferLength);
    const view = new DataView(wavBuffer);
    
    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + bufferLength, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, channels, true);
    /* sample rate */
    view.setUint32(24, sampleRate, true);
    /* byte rate (sample rate * channels * bytes per sample) */
    view.setUint32(28, sampleRate * channels * 2, true);
    /* block align (channels * bytes per sample) */
    view.setUint16(32, channels * 2, true);
    /* bits per sample */
    view.setUint16(34, bitDepth, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* chunk length */
    view.setUint32(40, bufferLength, true);
    
    // Write 16-bit PCM audio samples
    this.floatTo16BitPCM(view, 44, channelData);
    
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }

  private writeString(view: DataView, offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
}

/**
 * AudioPreparationService orchestrates the audio extraction, downmixing, normalization, 
 * resampling, and encoding stages based on provider-defined capabilities.
 */
export class AudioPreparationService {
  private extractor: AudioExtractor;

  /**
   * Constructs the service with a customizable extractor.
   * Defaults to WebAudioExtractor if none is provided.
   */
  constructor(extractor: AudioExtractor = new WebAudioExtractor()) {
    this.extractor = extractor;
  }

  /**
   * Prepares the audio from a video file according to provider capabilities.
   * 
   * @param videoFile The local video file.
   * @param providerCapabilities The capabilities configuration of the target ASR provider.
   * @returns A promise resolving to a strongly typed PreparedAudio object.
   */
  public async prepareAudio(
    videoFile: File,
    providerCapabilities?: ProviderCapabilities
  ): Promise<PreparedAudio> {
    // 1. Resolve target capabilities or apply defaults
    const audioCaps = providerCapabilities?.audio;
    const targetFormat = (audioCaps?.format || 'wav').toLowerCase();
    const targetSampleRate = audioCaps?.sampleRate || 16000;
    const targetChannels = audioCaps?.channels || 1;
    const targetNormalize = audioCaps?.normalize ?? false;

    // 2. Resolve target encoder early to fail fast if format is unsupported
    let encoder: AudioEncoder;
    if (targetFormat === 'wav') {
      encoder = new WavEncoder();
    } else if (targetFormat === 'mp3') {
      throw new NotImplementedError(
        `Encoding format "${targetFormat}" is not implemented yet. The AudioPreparationService architecture is established, but MP3 encoder libraries are not yet integrated.`
      );
    } else {
      throw new Error(`Unsupported audio format: ${targetFormat}`);
    }

    // --- STAGE 1: Extract Audio ---
    const rawBuffer = await this.extractor.extract(videoFile);
    const originalDuration = rawBuffer.duration;

    // --- STAGE 2: Downmix ---
    const downmixedChannels = this.downmix(rawBuffer, targetChannels);

    // --- STAGE 3: Normalize ---
    let normalizationApplied = false;
    if (targetNormalize) {
      normalizationApplied = this.normalize(downmixedChannels);
    }

    // --- STAGE 4: Resample ---
    const resampledBuffer = await this.resample(
      downmixedChannels,
      rawBuffer.sampleRate,
      targetSampleRate,
      targetChannels
    );

    // --- STAGE 5: Encode ---
    const blob = encoder.encode(resampledBuffer);

    // Return the strongly typed PreparedAudio representation
    return {
      blob,
      mimeType: encoder.mimeType,
      sampleRate: targetSampleRate,
      channels: targetChannels,
      duration: originalDuration,
      format: targetFormat,
      normalizationApplied,
      sourceFileName: videoFile.name,
      metadata: {
        originalSampleRate: rawBuffer.sampleRate,
        originalChannels: rawBuffer.numberOfChannels,
        processedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Stage 2 Downmixing: Downmixes or upmixes the channels to match target channels.
   */
  private downmix(audioBuffer: AudioBuffer, targetChannels: number): Float32Array[] {
    const numSrcChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;

    if (targetChannels === 1) {
      if (numSrcChannels === 1) {
        // Already mono, copy data to preserve original
        return [new Float32Array(audioBuffer.getChannelData(0))];
      }
      // Merge all source channels to a single mono channel
      const monoData = new Float32Array(length);
      for (let i = 0; i < length; i++) {
        let sum = 0;
        for (let c = 0; c < numSrcChannels; c++) {
          sum += audioBuffer.getChannelData(c)[i];
        }
        monoData[i] = sum / numSrcChannels;
      }
      return [monoData];
    } else {
      // Target: Stereo (2 channels)
      if (numSrcChannels >= 2) {
        // Keep first two channels
        return [
          new Float32Array(audioBuffer.getChannelData(0)),
          new Float32Array(audioBuffer.getChannelData(1)),
        ];
      } else {
        // Duplicate mono to stereo channels
        const left = new Float32Array(audioBuffer.getChannelData(0));
        const right = new Float32Array(left);
        return [left, right];
      }
    }
  }

  /**
   * Stage 3 Normalization: Performs peak normalization to 0.95 peak amplitude.
   * Returns true if scaling was applied, false otherwise.
   */
  private normalize(channelsData: Float32Array[], targetPeak = 0.95): boolean {
    let peak = 0;
    for (const data of channelsData) {
      for (let i = 0; i < data.length; i++) {
        const absVal = Math.abs(data[i]);
        if (absVal > peak) {
          peak = absVal;
        }
      }
    }

    if (peak > 0 && Math.abs(peak - targetPeak) > 0.001) {
      const factor = targetPeak / peak;
      for (const data of channelsData) {
        for (let i = 0; i < data.length; i++) {
          data[i] *= factor;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Stage 4 Resampling: Resamples channel data from source sample rate to target sample rate using OfflineAudioContext.
   */
  private async resample(
    channelsData: Float32Array[],
    sourceSampleRate: number,
    targetSampleRate: number,
    targetChannels: number
  ): Promise<AudioBuffer> {
    const sourceLength = channelsData[0].length;
    const duration = sourceLength / sourceSampleRate;

    if (sourceSampleRate === targetSampleRate) {
      // No resampling needed: construct an AudioBuffer wrapper
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContextClass();
      const buffer = ctx.createBuffer(targetChannels, sourceLength, targetSampleRate);
      for (let c = 0; c < targetChannels; c++) {
        buffer.copyToChannel(channelsData[c], c);
      }
      await ctx.close();
      return buffer;
    }

    const targetLength = Math.round(duration * targetSampleRate);
    const offlineCtx = new OfflineAudioContext(targetChannels, targetLength, targetSampleRate);

    // Create a source buffer using the pre-resampled channel data
    const sourceBuffer = offlineCtx.createBuffer(targetChannels, sourceLength, sourceSampleRate);
    for (let c = 0; c < targetChannels; c++) {
      sourceBuffer.copyToChannel(channelsData[c], c);
    }

    const sourceNode = offlineCtx.createBufferSource();
    sourceNode.buffer = sourceBuffer;
    sourceNode.connect(offlineCtx.destination);
    sourceNode.start(0);

    return await offlineCtx.startRendering();
  }
}

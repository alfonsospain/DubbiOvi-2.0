'use client';

import React, { useRef, useState, useEffect } from 'react';
import { formatTimeForDisplay } from '@/lib/utils';

export interface PlaybackController {
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  getCurrentTime: () => number;
  startPreview: (start: number, end: number) => void;
  stopPreview: () => void;
  isPreviewing: boolean;
}

interface AudioWaveformProps {
  videoFile: File | null;
  videoUrl?: string | null;
  currentTime: number;
  duration: number;
  tempInSeconds?: number | null;
  tempOutSeconds?: number | null;
  onTempInSecondsChange?: (val: number) => void;
  onTempOutSecondsChange?: (val: number) => void;
  playbackController?: PlaybackController;
  onSeek?: (time: number) => void;
}

enum DragTarget {
  None = 'none',
  InMarker = 'in',
  OutMarker = 'out',
  Playhead = 'playhead',
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  videoFile,
  videoUrl,
  currentTime,
  duration,
  tempInSeconds = null,
  tempOutSeconds = null,
  onTempInSecondsChange,
  onTempOutSecondsChange,
  playbackController,
  onSeek,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const inMarkerRef = useRef<HTMLDivElement>(null);
  const outMarkerRef = useRef<HTMLDivElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  const inTimecodeRef = useRef<HTMLSpanElement>(null);
  const outTimecodeRef = useRef<HTMLSpanElement>(null);

  const [peaks, setPeaks] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const decodingRef = useRef<string | null>(null);

  // Gesture State
  const dragRef = useRef<{
    target: DragTarget;
    currentIn: number;
    currentOut: number;
    rafId: number | null;
  }>({
    target: DragTarget.None,
    currentIn: tempInSeconds ?? 0,
    currentOut: tempOutSeconds ?? 0,
    rafId: null,
  });

  // Keep local variables in sync with parent props changes
  useEffect(() => {
    dragRef.current.currentIn = tempInSeconds ?? 0;
  }, [tempInSeconds]);

  useEffect(() => {
    dragRef.current.currentOut = tempOutSeconds ?? 0;
  }, [tempOutSeconds]);

  // Clean up animation frame on unmount
  useEffect(() => {
    return () => {
      if (dragRef.current.rafId !== null) {
        cancelAnimationFrame(dragRef.current.rafId);
      }
    };
  }, []);

  // Helper to trigger seeking without handling playback logic internally
  const performSeek = (time: number) => {
    if (onSeek) {
      onSeek(time);
    } else if (playbackController) {
      playbackController.seek(time);
    }
  };

  // Decode audio track asynchronously from videoFile or videoUrl
  useEffect(() => {
    if (!videoFile && !videoUrl) {
      setPeaks([]);
      return;
    }

    const decodeKey = videoFile ? videoFile.name : videoUrl!;
    if (decodingRef.current === decodeKey) return;
    decodingRef.current = decodeKey;

    setIsLoading(true);

    const decode = async () => {
      try {
        let arrayBuffer: ArrayBuffer;
        if (videoFile) {
          arrayBuffer = await videoFile.arrayBuffer();
        } else if (videoUrl) {
          const response = await fetch(videoUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status} fetching video for waveform`);
          arrayBuffer = await response.arrayBuffer();
        } else {
          return;
        }

        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) {
          throw new Error('Web Audio API not supported.');
        }

        const audioContext = new AudioContextClass();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        await audioContext.close();

        const channelData = audioBuffer.getChannelData(0);
        const numPeaks = 400;
        const step = Math.floor(channelData.length / numPeaks);
        const computedPeaks: number[] = [];

        for (let i = 0; i < numPeaks; i++) {
          let max = 0;
          const start = i * step;
          const end = Math.min(start + step, channelData.length);
          for (let j = start; j < end; j++) {
            const val = Math.abs(channelData[j]);
            if (val > max) max = val;
          }
          computedPeaks.push(max);
        }

        // Normalize peaks
        const maxPeak = Math.max(...computedPeaks);
        const normalized = maxPeak > 0 ? computedPeaks.map(p => p / maxPeak) : computedPeaks;

        setPeaks(normalized);
      } catch (err) {
        console.error('Waveform decoding failed:', err);
        decodingRef.current = null;
      } finally {
        setIsLoading(false);
      }
    };

    decode();
  }, [videoFile, videoUrl]);

  // Redraw waveform canvas when peaks or currentTime changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || peaks.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const numPeaks = peaks.length;
    const barWidth = width / numPeaks;
    const gap = 1; // 1px gap between bars

    // Draw background placeholder line
    const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');
    const unplayedColor = isLight ? '#cbd5e1' : '#1e293b';
    const playedColor = '#00C853';
    const playheadColor = '#36C95E';

    // Draw background placeholder line
    ctx.fillStyle = unplayedColor;
    ctx.fillRect(0, height / 2 - 1, width, 2);

    const progressRatio = duration > 0 ? currentTime / duration : 0;
    const activeIndex = Math.floor(progressRatio * numPeaks);

    for (let i = 0; i < numPeaks; i++) {
      const peakHeight = peaks[i] * height * 0.8; // Use 80% height to avoid touching borders
      const x = i * barWidth;
      const y = (height - peakHeight) / 2;

      // Color coding: green for played, adaptive grey for unplayed
      ctx.fillStyle = i <= activeIndex ? playedColor : unplayedColor;
      
      // Draw rounded/clean bars
      ctx.fillRect(x + gap, y, barWidth - gap, peakHeight);
    }

    // Draw synchronized playhead line: emerald green
    const playheadX = progressRatio * width;
    ctx.fillStyle = playheadColor;
    ctx.fillRect(playheadX - 1, 0, 2, height);
  }, [peaks, currentTime, duration]);

  // Coordinate Conversion Helpers
  const timeToX = (time: number): number => {
    if (duration <= 0) return 0;
    return (time / duration) * 100;
  };

  const xToTime = (clientX: number): number => {
    if (duration <= 0) return 0;
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(relativeX / rect.width, 1));
    return ratio * duration;
  };

  // Pointer Event Listeners for IN/OUT markers and waveform background playhead seek
  const handleMarkerPointerDown = (e: React.PointerEvent<HTMLDivElement>, target: DragTarget) => {
    if (e.button !== 0) return; // Left click only

    if (playbackController) {
      playbackController.stopPreview();
    }

    dragRef.current.target = target;
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };

  const handleContainerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Left click only

    // If marker drag is active, skip container seeking
    if (dragRef.current.target !== DragTarget.None) return;

    const clickedTime = xToTime(e.clientX);
    dragRef.current.target = DragTarget.Playhead;
    e.currentTarget.setPointerCapture(e.pointerId);
    performSeek(clickedTime);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const { target } = dragRef.current;
    if (target === DragTarget.None) return;

    e.preventDefault();

    const newTime = xToTime(e.clientX);

    if (target === DragTarget.Playhead) {
      performSeek(newTime);
      return;
    }

    const MIN_DURATION = 0.2; // Keep at least 200ms gap

    if (target === DragTarget.InMarker) {
      const clampedIn = Math.max(0, Math.min(newTime, dragRef.current.currentOut - MIN_DURATION));
      dragRef.current.currentIn = clampedIn;
      performSeek(clampedIn);
    } else if (target === DragTarget.OutMarker) {
      const clampedOut = Math.min(duration, Math.max(newTime, dragRef.current.currentIn + MIN_DURATION));
      dragRef.current.currentOut = clampedOut;
      performSeek(clampedOut);
    }

    // Schedule style redraw inside animation frame
    if (dragRef.current.rafId === null) {
      dragRef.current.rafId = requestAnimationFrame(updateDomStyles);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const { target, currentIn, currentOut } = dragRef.current;
    if (target === DragTarget.None) return;

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (_) {}

    dragRef.current.target = DragTarget.None;

    if (dragRef.current.rafId !== null) {
      cancelAnimationFrame(dragRef.current.rafId);
      dragRef.current.rafId = null;
    }

    // Dispatch committed timing change to parent state on release
    if (target === DragTarget.InMarker && onTempInSecondsChange) {
      onTempInSecondsChange(currentIn);
    } else if (target === DragTarget.OutMarker && onTempOutSecondsChange) {
      onTempOutSecondsChange(currentOut);
    }
  };

  // Direct DOM style and timecode updates
  const updateDomStyles = () => {
    dragRef.current.rafId = null;
    const { currentIn, currentOut } = dragRef.current;

    const inPct = timeToX(currentIn);
    const outPct = timeToX(currentOut);

    if (inMarkerRef.current) {
      inMarkerRef.current.style.left = `${inPct}%`;
    }
    if (outMarkerRef.current) {
      outMarkerRef.current.style.left = `${outPct}%`;
    }
    if (regionRef.current) {
      regionRef.current.style.left = `${inPct}%`;
      regionRef.current.style.width = `${outPct - inPct}%`;
    }

    if (inTimecodeRef.current) {
      inTimecodeRef.current.innerText = formatTimeForDisplay(currentIn);
    }
    if (outTimecodeRef.current) {
      outTimecodeRef.current.innerText = formatTimeForDisplay(currentOut);
    }
  };

  if (!videoFile && !videoUrl) return null;

  const initialInPct = tempInSeconds !== null && tempInSeconds !== undefined ? timeToX(tempInSeconds) : 0;
  const initialOutPct = tempOutSeconds !== null && tempOutSeconds !== undefined ? timeToX(tempOutSeconds) : 0;

  return (
    <div className="w-full bg-card border border-border/40 rounded-md p-2 flex flex-col gap-1.5 select-none">
      <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
        <span>Waveform</span>
        {isLoading ? (
          <span className="animate-pulse text-primary font-semibold">ANALYZING TRACK...</span>
        ) : (
          <span>LOADED</span>
        )}
      </div>
      <div 
        ref={containerRef}
        className="relative h-14 w-full bg-timeline-bg rounded overflow-hidden touch-none border border-border/20 cursor-pointer"
        onPointerDown={handleContainerPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={56}
          className="h-full w-full block pointer-events-none"
        />
        
        {/* Highlighted region segment */}
        {tempInSeconds !== null && tempOutSeconds !== null && duration > 0 && tempOutSeconds > tempInSeconds && (
          <div
            ref={regionRef}
            className="absolute top-0 bottom-0 bg-blue-500/10 border-l border-r border-blue-400/20 z-0 pointer-events-none"
            style={{
              left: `${initialInPct}%`,
              width: `${initialOutPct - initialInPct}%`,
            }}
          />
        )}

        {/* IN Marker */}
        {tempInSeconds !== null && duration > 0 && (
          <div
            ref={inMarkerRef}
            className="absolute top-0 bottom-0 w-0.5 bg-blue-500 z-10 cursor-ew-resize pointer-events-auto"
            style={{ left: `${initialInPct}%` }}
            onPointerDown={(e) => handleMarkerPointerDown(e, DragTarget.InMarker)}
            onPointerUp={handlePointerUp}
          >
            {/* Grab hitbox wrapper */}
            <div className="absolute -left-1.5 w-4 top-0 bottom-0 pointer-events-auto" />
            
            {/* Tooltip timecode */}
            <span
              ref={inTimecodeRef}
              className="absolute bottom-1 left-2 bg-blue-600/90 text-white font-mono text-[9px] px-1 rounded shadow pointer-events-none select-none"
            >
              {formatTimeForDisplay(tempInSeconds)}
            </span>
          </div>
        )}

        {/* OUT Marker */}
        {tempOutSeconds !== null && duration > 0 && (
          <div
            ref={outMarkerRef}
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 cursor-ew-resize pointer-events-auto"
            style={{ left: `${initialOutPct}%` }}
            onPointerDown={(e) => handleMarkerPointerDown(e, DragTarget.OutMarker)}
            onPointerUp={handlePointerUp}
          >
            {/* Grab hitbox wrapper */}
            <div className="absolute -left-1.5 w-4 top-0 bottom-0 pointer-events-auto" />
            
            {/* Tooltip timecode */}
            <span
              ref={outTimecodeRef}
              className="absolute bottom-1 right-2 bg-red-600/90 text-white font-mono text-[9px] px-1 rounded shadow pointer-events-none select-none"
            >
              {formatTimeForDisplay(tempOutSeconds)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioWaveform;

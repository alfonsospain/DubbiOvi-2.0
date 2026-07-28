'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { Take } from '@/lib/types';

export interface UseDubPreviewOptions {
  videoRef: React.RefObject<HTMLVideoElement>;
  takes: Take[];
  playTake: (take: Take, options?: { silent?: boolean }) => Promise<void>;
  stopPlayback: () => void;
  currentTime?: number;
  enabled?: boolean;
}

/**
 * Custom hook managing synchronized Dub Preview in DubbiOvi.
 *
 * Drives automatic Take voice auditioning when video playback reaches each Take's IN timestamp (startSeconds).
 * Reuses existing video events and playback clock. Zero polling / setInterval loops created.
 * Reuses Milestone 15.1 useTakePlayback.playTake(take) path without creating secondary playback pipelines.
 */
export function useDubPreview({
  videoRef,
  takes,
  playTake,
  stopPlayback,
  currentTime,
  enabled = true,
}: UseDubPreviewOptions): void {
  const triggeredTakeIdsRef = useRef<Set<string>>(new Set());
  const lastTimeRef = useRef<number>(0);

  /**
   * Evaluates current playback time against Take IN timestamps (startSeconds).
   * Triggers generated Take playback when crossing Take IN.
   * Overlapping Takes rule: most recently triggered Take replaces the previous one via playTake.
   */
  const checkAndTriggerDub = useCallback(
    (time: number) => {
      if (!enabled) return;

      const video = videoRef.current;
      if (!video || video.paused) return;

      // Handle backward seek detection during playback
      if (time < lastTimeRef.current - 0.3) {
        stopPlayback();
        // Clear triggers for takes that start after the new seek position
        for (const take of takes) {
          if (take.startSeconds > time) {
            triggeredTakeIdsRef.current.delete(take.id);
          }
        }
      }
      lastTimeRef.current = time;

      // Evaluate generated Takes
      for (const take of takes) {
        if (!take.voiceAssetId) continue;
        if (triggeredTakeIdsRef.current.has(take.id)) continue;

        // Check if playback clock has reached or passed Take IN timestamp (within reasonable window)
        const timeDiff = time - take.startSeconds;
        const takeEnd = take.endSeconds > take.startSeconds ? take.endSeconds : take.startSeconds + 30;

        if (time >= take.startSeconds && time <= takeEnd + 0.5 && timeDiff >= 0 && timeDiff <= 1.5) {
          triggeredTakeIdsRef.current.add(take.id);
          // Trigger playback silently (skips ungenerated Takes without displaying notifications)
          playTake(take, { silent: true }).catch((err) => {
            console.error('[useDubPreview] Trigger playTake error:', err);
          });
        }
      }
    },
    [enabled, videoRef, takes, playTake, stopPlayback]
  );

  // Monitor currentTime prop updates if passed from parent clock / rAF
  useEffect(() => {
    if (typeof currentTime === 'number') {
      checkAndTriggerDub(currentTime);
    }
  }, [currentTime, checkAndTriggerDub]);

  // Bind native video element events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      checkAndTriggerDub(video.currentTime);
    };

    const handlePause = () => {
      stopPlayback();
    };

    const handleSeekingOrSeeked = () => {
      stopPlayback();
      const newTime = video.currentTime;
      // Recalculate trigger set for new time
      for (const take of takes) {
        if (take.startSeconds > newTime || newTime < lastTimeRef.current) {
          triggeredTakeIdsRef.current.delete(take.id);
        }
      }
      lastTimeRef.current = newTime;
    };

    const handleEnded = () => {
      stopPlayback();
      triggeredTakeIdsRef.current.clear();
    };

    const handlePlay = () => {
      lastTimeRef.current = video.currentTime;
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeking', handleSeekingOrSeeked);
    video.addEventListener('seeked', handleSeekingOrSeeked);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('play', handlePlay);

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeking', handleSeekingOrSeeked);
      video.removeEventListener('seeked', handleSeekingOrSeeked);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('play', handlePlay);
    };
  }, [videoRef, takes, checkAndTriggerDub, stopPlayback]);

  // Clean up triggered IDs if takes list is updated or takes are deleted
  useEffect(() => {
    const validTakeIds = new Set(takes.map((t) => t.id));
    for (const id of Array.from(triggeredTakeIdsRef.current)) {
      if (!validTakeIds.has(id)) {
        triggeredTakeIdsRef.current.delete(id);
      }
    }
  }, [takes]);
}

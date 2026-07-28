'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Take } from '@/lib/types';
import type { VoiceAssetManager } from '@/lib/VoiceAssetManager';
import { useToast } from '@/hooks/use-toast';

export interface UseTakePlaybackOptions {
  takes: Take[];
  getAssetManager: () => VoiceAssetManager | null;
  voiceVolume?: number; // 0.0 to 1.0
  voiceEnabled?: boolean;
}

export interface UseTakePlaybackReturn {
  playingTakeId: string | null;
  isPlaying: (takeId: string) => boolean;
  playTake: (take: Take, options?: { silent?: boolean }) => Promise<void>;
  stopPlayback: () => void;
}

/**
 * Custom hook providing a provider-agnostic, single-responsibility playback controller
 * for generated voice assets in DubbiOvi.
 *
 * Strictly resolves audio paths via VoiceAssetManager. Never guesses path strings.
 * Manages media resource releases, rapid-click guards, and project/takes sync cleanup.
 */
export function useTakePlayback({
  takes,
  getAssetManager,
  voiceVolume = 1.0,
  voiceEnabled = true,
}: UseTakePlaybackOptions): UseTakePlaybackReturn {
  const { toast } = useToast();
  const [playingTakeId, setPlayingTakeId] = useState<string | null>(null);
  const playingAudioRef = useRef<HTMLAudioElement | null>(null);

  const effectiveVoiceVol = voiceEnabled ? Math.max(0, Math.min(1, voiceVolume)) : 0;
  const isMuted = !voiceEnabled || effectiveVoiceVol === 0;

  // Instantly apply volume updates to currently playing HTML5 Audio element
  useEffect(() => {
    if (playingAudioRef.current) {
      playingAudioRef.current.volume = effectiveVoiceVol;
      playingAudioRef.current.muted = isMuted;
    }
  }, [effectiveVoiceVol, isMuted]);

  /**
   * Helper to safely release HTML5 Audio resources and unbind event handlers.
   */
  const releaseAudioResource = useCallback((audio: HTMLAudioElement) => {
    try {
      audio.pause();
    } catch (_) {}
    audio.onended = null;
    audio.onerror = null;
    try {
      audio.removeAttribute('src');
      audio.load();
    } catch (_) {}
  }, []);

  /**
   * Stops active voice playback and resets state.
   */
  const stopPlayback = useCallback(() => {
    if (playingAudioRef.current) {
      releaseAudioResource(playingAudioRef.current);
      playingAudioRef.current = null;
    }
    setPlayingTakeId(null);
  }, [releaseAudioResource]);

  /**
   * Begins or toggles audition playback for a generated Take voice asset.
   */
  const playTake = useCallback(
    async (take: Take, options?: { silent?: boolean }): Promise<void> => {
      if (!take) return;
      const isSilent = options?.silent ?? false;

      // If user selects Play on the currently playing Take, treat as Stop toggle
      if (playingTakeId === take.id) {
        stopPlayback();
        return;
      }

      // If another Take is currently playing, stop it first before playing new Take
      if (playingAudioRef.current) {
        stopPlayback();
      }

      // Check if Take has an associated voiceAssetId
      if (!take.voiceAssetId) {
        if (!isSilent) {
          toast({
            title: 'Voice not generated yet.',
            description: 'Synthesize or assign a voice asset before auditioning.',
          });
        }
        return;
      }

      // Strictly resolve asset via VoiceAssetManager. Never reconstruct paths manually.
      const manager = getAssetManager();
      const asset = manager ? manager.getActiveAssetForTake(take) || manager.getAsset(take.voiceAssetId) : null;

      if (!asset || !asset.relativePath) {
        if (!isSilent) {
          toast({
            title: 'Voice not generated yet.',
            description: 'The associated voice asset could not be resolved from project metadata.',
          });
        }
        return;
      }

      // Resolve final Electron URL / path
      let audioUrl = asset.relativePath;
      if (typeof window !== 'undefined' && (window as any).electron?.resolveAudioPath) {
        try {
          audioUrl = await (window as any).electron.resolveAudioPath(asset.relativePath);
        } catch (err) {
          console.error('[useTakePlayback] Electron path resolution error:', err);
        }
      }

      // Create new HTML5 Audio instance
      const audio = new Audio(audioUrl);
      audio.volume = effectiveVoiceVol;
      audio.muted = isMuted;

      audio.onended = () => {
        releaseAudioResource(audio);
        if (playingAudioRef.current === audio) {
          playingAudioRef.current = null;
          setPlayingTakeId(null);
        }
      };

      audio.onerror = (e) => {
        console.error('[useTakePlayback] Audio playback error:', e);
        releaseAudioResource(audio);
        if (playingAudioRef.current === audio) {
          playingAudioRef.current = null;
          setPlayingTakeId(null);
        }
        if (!isSilent) {
          toast({
            title: 'Voice Playback Failed',
            description: 'Could not play generated audio file.',
            variant: 'destructive',
          });
        }
      };

      playingAudioRef.current = audio;
      setPlayingTakeId(take.id);

      try {
        await audio.play();
      } catch (err: any) {
        console.error('[useTakePlayback] audio.play() failed:', err);
        releaseAudioResource(audio);
        if (playingAudioRef.current === audio) {
          playingAudioRef.current = null;
          setPlayingTakeId(null);
        }
        if (!isSilent) {
          toast({
            title: 'Voice Playback Failed',
            description: err?.message || 'Could not play generated audio file.',
            variant: 'destructive',
          });
        }
      }
    },
    [playingTakeId, stopPlayback, getAssetManager, releaseAudioResource, toast]
  );

  /**
   * Helper to check if a specific take is currently playing.
   */
  const isPlaying = useCallback(
    (takeId: string): boolean => {
      return playingTakeId === takeId;
    },
    [playingTakeId]
  );

  /**
   * Automatically monitor `takes` list shifts.
   * If the currently playing Take disappears from the list or its asset link is removed,
   * immediately terminate playback.
   */
  useEffect(() => {
    if (!playingTakeId) return;
    const currentPlayingTake = takes.find((t) => t.id === playingTakeId);
    if (!currentPlayingTake || !currentPlayingTake.voiceAssetId) {
      stopPlayback();
    }
  }, [takes, playingTakeId, stopPlayback]);

  /**
   * Cleanup active playback and media resources on unmount.
   */
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  return {
    playingTakeId,
    isPlaying,
    playTake,
    stopPlayback,
  };
}

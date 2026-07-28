'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Film, AudioLines, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PlaybackMixerProps {
  originalVolume: number; // 0.0 to 1.0
  originalEnabled: boolean;
  onOriginalVolumeChange: (volume: number) => void;
  onOriginalEnabledChange: (enabled: boolean) => void;
  voiceVolume: number; // 0.0 to 1.0
  voiceEnabled: boolean;
  onVoiceVolumeChange: (volume: number) => void;
  onVoiceEnabledChange: (enabled: boolean) => void;
  className?: string;
}

/**
 * Compact Playback Mixer component positioned above the Timeline.
 * Controls live audio volume for Original Audio (HTML5 Video) and AI Voices (HTML5 Audio).
 *
 * Does NOT participate in playback triggering or synchronization decisions.
 */
export const PlaybackMixer: React.FC<PlaybackMixerProps> = ({
  originalVolume,
  originalEnabled,
  onOriginalVolumeChange,
  onOriginalEnabledChange,
  voiceVolume,
  voiceEnabled,
  onVoiceVolumeChange,
  onVoiceEnabledChange,
  className,
}) => {
  const effectiveOriginalPct = originalEnabled ? Math.round(originalVolume * 100) : 0;
  const effectiveVoicePct = voiceEnabled ? Math.round(voiceVolume * 100) : 0;

  return (
    <Card
      className={cn(
        'w-full bg-card/60 backdrop-blur border border-border/60 p-2 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs select-none',
        className
      )}
    >
      <div className="flex items-center gap-2 shrink-0 border-b sm:border-b-0 sm:border-r border-border/40 pb-1.5 sm:pb-0 sm:pr-3">
        <Volume2 className="h-3.5 w-3.5 text-primary" />
        <span className="font-bold text-[11px] uppercase tracking-wider text-muted-foreground">
          Playback Mixer
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full flex-grow">
        {/* Original Audio Section */}
        <div className="flex items-center gap-2.5 bg-secondary/20 p-1.5 rounded-md border border-border/30">
          <div className="flex items-center gap-1.5 shrink-0">
            <Checkbox
              id="mixer-original-enable"
              checked={originalEnabled}
              onCheckedChange={(checked) => onOriginalEnabledChange(!!checked)}
              className="h-3.5 w-3.5"
            />
            <label
              htmlFor="mixer-original-enable"
              className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-foreground hover:text-primary transition-colors"
            >
              <Film className="h-3.5 w-3.5 text-blue-400" />
              <span>Original Audio</span>
            </label>
          </div>

          <div className="flex-grow flex items-center gap-2">
            <Slider
              value={[originalVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={!originalEnabled}
              onValueChange={(vals) => onOriginalVolumeChange(vals[0] / 100)}
              className={cn('flex-grow', !originalEnabled && 'opacity-40 cursor-not-allowed')}
            />
            <span className="font-mono text-[10px] w-9 text-right font-medium text-muted-foreground shrink-0">
              {originalEnabled ? `${effectiveOriginalPct}%` : 'Off'}
            </span>
          </div>
        </div>

        {/* AI Voices Section */}
        <div className="flex items-center gap-2.5 bg-secondary/20 p-1.5 rounded-md border border-border/30">
          <div className="flex items-center gap-1.5 shrink-0">
            <Checkbox
              id="mixer-voice-enable"
              checked={voiceEnabled}
              onCheckedChange={(checked) => onVoiceEnabledChange(!!checked)}
              className="h-3.5 w-3.5"
            />
            <label
              htmlFor="mixer-voice-enable"
              className="flex items-center gap-1 cursor-pointer text-[11px] font-medium text-foreground hover:text-primary transition-colors"
            >
              <AudioLines className="h-3.5 w-3.5 text-amber-400" />
              <span>AI Voices</span>
            </label>
          </div>

          <div className="flex-grow flex items-center gap-2">
            <Slider
              value={[voiceVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={!voiceEnabled}
              onValueChange={(vals) => onVoiceVolumeChange(vals[0] / 100)}
              className={cn('flex-grow', !voiceEnabled && 'opacity-40 cursor-not-allowed')}
            />
            <span className="font-mono text-[10px] w-9 text-right font-medium text-muted-foreground shrink-0">
              {voiceEnabled ? `${effectiveVoicePct}%` : 'Off'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

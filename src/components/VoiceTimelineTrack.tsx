'use client';

import React from 'react';
import { Take } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface VoiceTimelineTrackProps {
  takes: Take[];
  duration: number;
  currentIndex: number;
  onTakeClick: (index: number) => void;
  onTakeDoubleClick?: (index: number) => void;
}

/**
 * Voice Timeline track row that mirrors the exact temporal block geometry of the Take Timeline.
 * Communicates voice asset availability cleanly via color:
 *  - Neutral Grey: No Voice Asset
 *  - Orange / Amber: Voice Asset available
 */
export const VoiceTimelineTrack: React.FC<VoiceTimelineTrackProps> = ({
  takes,
  duration,
  currentIndex,
  onTakeClick,
  onTakeDoubleClick,
}) => {
  if (duration <= 0) return null;

  return (
    <div className="relative h-6 w-full cursor-pointer select-none">
      <div className="relative h-full w-full">
        {takes.map((take, index) => {
          const left = (take.startSeconds / duration) * 100;
          const width = ((take.endSeconds - take.startSeconds) / duration) * 100;
          const hasVoiceAsset = !!take.voiceAssetId;

          return (
            <Tooltip key={`voice-${take.id}`} delayDuration={100}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'absolute top-0.5 bottom-0.5 rounded-sm transition-all duration-150 ease-linear',
                    hasVoiceAsset ? 'bg-amber-500' : 'bg-timeline-empty',
                    {
                      'ring-2 ring-amber-400 z-10': currentIndex === index && hasVoiceAsset,
                      'ring-2 ring-primary z-10': currentIndex === index && !hasVoiceAsset,
                      'opacity-80 hover:opacity-100': currentIndex !== index,
                    }
                  )}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTakeClick(index);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (onTakeDoubleClick) {
                      onTakeDoubleClick(index);
                    }
                  }}
                />
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs font-semibold">
                  {hasVoiceAsset ? 'Voice Asset available' : 'No Voice Asset'}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
};

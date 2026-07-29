'use client';

import React, { useEffect, useState } from 'react';
import type { Take } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Play,
  Pause,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
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

interface TimelineEditorProps {
  take: Take;
  index: number;
  takesCount: number;
  currentTime: number;
  duration: number;
  playbackController: PlaybackController;
  tempInSeconds: number | null;
  tempOutSeconds: number | null;
  setTempInSeconds: (val: number | null) => void;
  setTempOutSeconds: (val: number | null) => void;
  onSave: (inTime: number, outTime: number) => void;
  onCancel: () => void;
  onPrevTake: () => void;
  onNextTake: () => void;
  hasPrevTake: boolean;
  hasNextTake: boolean;
  takes: Take[];
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  take,
  index,
  takesCount,
  currentTime,
  duration,
  playbackController,
  tempInSeconds,
  tempOutSeconds,
  setTempInSeconds,
  setTempOutSeconds,
  onSave,
  onCancel,
  onPrevTake,
  onNextTake,
  hasPrevTake,
  hasNextTake,
  takes,
}) => {
  const [showAutoAdvance, setShowAutoAdvance] = useState(false);
  const [isTranslationCollapsed, setIsTranslationCollapsed] = useState(false);

  const hasUnsavedChanges =
    tempInSeconds !== take.startSeconds || tempOutSeconds !== take.endSeconds;

  const handlePrev = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard them and move to the previous take?')) {
        return;
      }
    }
    onPrevTake();
  };

  const handleNext = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard them and move to the next take?')) {
        return;
      }
    }
    onNextTake();
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard them and exit Timeline Editor?')) {
        return;
      }
    }
    onCancel();
  };

  const handleSave = () => {
    if (tempInSeconds === null || tempOutSeconds === null) {
      alert("Please capture both IN and OUT timecodes before saving.");
      return;
    }
    if (tempOutSeconds <= tempInSeconds) {
      alert("OUT timecode must be later than IN timecode.");
      return;
    }
    if (tempOutSeconds - tempInSeconds < 0.2) {
      alert("Selected take duration must be at least 0.2 seconds.");
      return;
    }
    onSave(tempInSeconds, tempOutSeconds);

    if (showAutoAdvance && hasNextTake) {
      setTimeout(() => {
        onNextTake();
      }, 50);
    }
  };

  const handleSetIn = () => {
    setTempInSeconds(playbackController.getCurrentTime());
  };

  const handleSetOut = () => {
    setTempOutSeconds(playbackController.getCurrentTime());
  };

  const handlePreviewInterval = () => {
    if (tempInSeconds === null || tempOutSeconds === null) return;
    playbackController.startPreview(tempInSeconds, tempOutSeconds);
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target) {
        const tagName = target.tagName.toLowerCase();
        const isInput =
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          target.hasAttribute('contenteditable') ||
          target.isContentEditable;
        if (isInput) return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
          e.preventDefault();
          if (playbackController.isPreviewing) {
            playbackController.stopPreview();
          } else {
            playbackController.togglePlayPause();
          }
          break;
        case 'i':
          e.preventDefault();
          handleSetIn();
          break;
        case 'o':
          e.preventDefault();
          handleSetOut();
          break;
        case 'enter':
          e.preventDefault();
          handleSave();
          break;
        case 'escape':
          e.preventDefault();
          handleCancel();
          break;
        case 'arrowup':
        case 'arrowleft':
          e.preventDefault();
          handlePrev();
          break;
        case 'arrowdown':
        case 'arrowright':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    playbackController,
    tempInSeconds,
    tempOutSeconds,
    take,
    index,
    hasNextTake,
    hasPrevTake,
    showAutoAdvance,
  ]);

  // Derived synchronization status check
  const isTakeSynchronized =
    typeof take.startSeconds === 'number' &&
    typeof take.endSeconds === 'number' &&
    take.endSeconds > take.startSeconds;

  // Check for overlaps with neighbor takes
  const overlapsPrev =
    index > 0 &&
    tempInSeconds !== null &&
    tempInSeconds < (takes[index - 1].endSeconds || 0);

  const overlapsNext =
    index < takesCount - 1 &&
    tempOutSeconds !== null &&
    tempOutSeconds > (takes[index + 1].startSeconds || Infinity);

  // Compute stats metrics
  const computedDuration = (tempOutSeconds ?? 0) - (tempInSeconds ?? 0);
  const linesCount = take.original
    ? take.original.split('\n').filter((line) => line.trim().length > 0).length
    : 0;
  const wordsCount = take.original
    ? take.original.trim().split(/\s+/).filter((word) => word.length > 0).length
    : 0;

  return (
    <Card className="flex flex-col h-full border bg-card text-card-foreground shadow-sm overflow-hidden">
      <CardHeader className="py-4 border-b shrink-0 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" /> Timeline Editor Mode
          </CardTitle>
          <CardDescription className="text-[11px] mt-0.5">
            Manually synchronize timing for individual script takes.
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={handleCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="flex-grow p-4 overflow-y-auto space-y-4 flex flex-col min-h-0 text-xs">
        {/* Take Navigation Header */}
        <div className="flex items-center justify-between border-b pb-2 shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Active Take</span>
            <span className="font-semibold text-sm">
              Take {index + 1} of {takesCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrev}
              disabled={!hasPrevTake}
              title="Previous Take (Up/Left)"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleNext}
              disabled={!hasNextTake}
              title="Next Take (Down/Right)"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Metadata Row */}
        <div className="grid grid-cols-3 gap-2 py-1.5 border-b shrink-0 text-[10px] text-muted-foreground font-mono">
          <div className="flex items-center gap-1">
            <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground/80">Duration:</span>
            <span className="font-semibold text-foreground">
              {computedDuration > 0 ? `${computedDuration.toFixed(3)}s` : '0.000s'}
            </span>
          </div>
          <div className="flex items-center gap-1 justify-center">
            <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground/80">Lines:</span>
            <span className="font-semibold text-foreground">{linesCount}</span>
          </div>
          <div className="flex items-center gap-1 justify-end">
            <span className="font-bold text-[9px] uppercase tracking-wider text-muted-foreground/80">Words:</span>
            <span className="font-semibold text-foreground">{wordsCount}</span>
          </div>
        </div>

        {/* Source Script Dialogue (Always Visible, Directly Below Header/Metadata) */}
        <div className="space-y-1.5 shrink-0">
          <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider block">Source Script Dialogue</span>
          <div className="p-3 bg-secondary/10 border rounded-md leading-relaxed text-foreground select-text font-serif italic max-h-48 overflow-y-auto whitespace-pre-wrap">
            {take.original ? take.original : "No source dialogue available."}
          </div>
        </div>

        {/* Take Context Display */}
        <div className="space-y-3.5 flex-grow min-h-0 overflow-y-auto">
          {/* Status & Timing State Sub-info */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div className="flex flex-col p-2 bg-secondary/15 rounded border text-[10px]">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Take Status</span>
              <span className="font-semibold mt-0.5">{take.status}</span>
            </div>
            <div className="flex flex-col p-2 bg-secondary/15 rounded border text-[10px]">
              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Timing State</span>
              <span className="font-semibold mt-0.5">
                {isTakeSynchronized ? 'Synchronized' : 'Estimated'}
              </span>
            </div>
          </div>

          {/* Collapsible Target translation if populated */}
          {take.translation && (
            <div className="space-y-1.5 border border-border/40 rounded-md overflow-hidden bg-secondary/5">
              <button
                onClick={() => setIsTranslationCollapsed(!isTranslationCollapsed)}
                className="w-full flex items-center justify-between p-2 hover:bg-secondary/10 transition-colors font-semibold text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                <span>Target Translation</span>
                {isTranslationCollapsed ? (
                  <ChevronRight className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>
              {!isTranslationCollapsed && (
                <div className="p-3 pt-0 whitespace-pre-wrap font-serif italic text-muted-foreground text-xs leading-relaxed max-h-36 overflow-y-auto select-text">
                  {take.translation}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Synchronization Controls */}
        <div className="space-y-3.5 border-t pt-4 shrink-0">
          <div className="grid grid-cols-2 gap-4">
            {/* IN Marker Panel */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wider">IN Timecode</span>
                <span className="font-mono text-xs font-semibold text-blue-400">
                  {tempInSeconds !== null ? formatTimeForDisplay(tempInSeconds) : '--:--.---'}
                </span>
              </div>
              <Button size="sm" variant="outline" className="w-full text-blue-400 border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 gap-1.5 h-9" onClick={handleSetIn}>
                <Clock className="h-3.5 w-3.5" /> Set IN (I)
              </Button>
            </div>

            {/* OUT Marker Panel */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-red-400 uppercase tracking-wider">OUT Timecode</span>
                <span className="font-mono text-xs font-semibold text-red-400">
                  {tempOutSeconds !== null ? formatTimeForDisplay(tempOutSeconds) : '--:--.---'}
                </span>
              </div>
              <Button size="sm" variant="outline" className="w-full text-red-400 border-red-500/20 bg-red-500/5 hover:bg-red-500/10 gap-1.5 h-9" onClick={handleSetOut}>
                <Clock className="h-3.5 w-3.5" /> Set OUT (O)
              </Button>
            </div>
          </div>

          {/* Validation Warnings */}
          {(overlapsPrev || overlapsNext) && (
            <div className="p-2.5 rounded-lg border border-amber-600/40 bg-amber-500/15 text-slate-700 dark:text-amber-200 text-[11px] leading-relaxed flex gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-slate-900 dark:text-amber-300">Timeline Overlaps Detected</p>
                {overlapsPrev && <p className="mt-0.5 text-slate-700 dark:text-amber-200/90">• Captures overlap with the previous take.</p>}
                {overlapsNext && <p className="mt-0.5 text-slate-700 dark:text-amber-200/90">• Captures overlap with the next take.</p>}
              </div>
            </div>
          )}

          {/* Preview Controller */}
          <div className="flex flex-col gap-2 bg-secondary/10 p-2.5 rounded-lg border">
            <div className="flex justify-between items-center text-[10px] text-muted-foreground font-mono">
              <span>PREVIEW CHANNEL</span>
              <span>PLAYHEAD: {formatTimeForDisplay(currentTime)}</span>
            </div>
            <div className="flex gap-2">
              {playbackController.isPreviewing ? (
                <Button variant="destructive" size="sm" className="w-full h-8 gap-1.5" onClick={() => playbackController.stopPreview()}>
                  <Pause className="h-3.5 w-3.5" /> Stop Preview
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full h-8 gap-1.5"
                  onClick={handlePreviewInterval}
                  disabled={tempInSeconds === null || tempOutSeconds === null || tempOutSeconds <= tempInSeconds}
                >
                  <Play className="h-3.5 w-3.5" /> Preview Interval
                </Button>
              )}
            </div>
          </div>

          {/* Footer Action Buttons */}
          <div className="space-y-2 border-t pt-3.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-advance"
                checked={showAutoAdvance}
                onChange={(e) => setShowAutoAdvance(e.target.checked)}
                className="rounded border-border h-3.5 w-3.5 bg-background focus:ring-primary accent-primary cursor-pointer"
              />
              <label htmlFor="auto-advance" className="text-[11px] text-muted-foreground select-none cursor-pointer font-medium">
                Auto-advance to next take on save
              </label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="w-full h-9" onClick={handleCancel}>
                Cancel
              </Button>
              <Button size="sm" className="w-full h-9 gap-1.5" onClick={handleSave} disabled={!hasUnsavedChanges}>
                <Save className="h-3.5 w-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

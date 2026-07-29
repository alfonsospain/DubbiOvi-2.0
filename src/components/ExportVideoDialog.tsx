'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film, AudioLines, Download, Loader2, Video, Volume2, VolumeX, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Take } from '@/lib/types';
import type { VoiceAssetManager } from '@/lib/VoiceAssetManager';
import { VideoExportService, VideoExportMode } from '@/lib/VideoExportService';
import { useToast } from '@/hooks/use-toast';

export interface ExportVideoDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoFile: File | null;
  videoUrl?: string | null;
  videoPath?: string | null;
  takes: Take[];
  getAssetManager: () => VoiceAssetManager | null;
  initialOriginalVolume: number; // 0.0 to 1.0
  initialOriginalEnabled: boolean;
  initialVoiceVolume: number; // 0.0 to 1.0
  initialVoiceEnabled: boolean;
  projectName?: string;
  projectPath?: string;
}

export const ExportVideoDialog: React.FC<ExportVideoDialogProps> = ({
  isOpen,
  onOpenChange,
  videoFile,
  videoUrl,
  videoPath,
  takes,
  getAssetManager,
  initialOriginalVolume,
  initialOriginalEnabled,
  initialVoiceVolume,
  initialVoiceEnabled,
  projectName = 'DubbiOvi_Project',
  projectPath,
}) => {
  const { toast } = useToast();
  const [originalVolume, setOriginalVolume] = useState(initialOriginalVolume);
  const [voiceVolume, setVoiceVolume] = useState(initialVoiceVolume);
  const [mode, setMode] = useState<VideoExportMode>('both');
  const [isExporting, setIsExporting] = useState(false);
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [progressPct, setProgressPct] = useState<number>(0);

  // Sync initial values whenever dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setOriginalVolume(initialOriginalVolume);
      setVoiceVolume(initialVoiceVolume);
      setCurrentPhase('');
      setProgressPct(0);
    }
  }, [isOpen, initialOriginalVolume, initialVoiceVolume]);

  const handleExport = async () => {
    setIsExporting(true);
    setCurrentPhase('Preparing export');
    setProgressPct(5);

    try {
      const cleanProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const defaultFilename = `${cleanProjectName}_final_export.mp4`;

      let targetFilePath = defaultFilename;

      // 1. Invoke native Electron Save As dialog
      if (typeof window !== 'undefined' && (window as any).electron?.showSaveDialog) {
        const saveRes = await (window as any).electron.showSaveDialog({
          defaultPath: defaultFilename,
          filters: [
            { name: 'MP4 Video File', extensions: ['mp4'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (saveRes.canceled || !saveRes.filePath) {
          setIsExporting(false);
          setCurrentPhase('');
          return;
        }

        targetFilePath = saveRes.filePath;
      }

      // 2. Render Video Export via VideoExportService
      const result = await VideoExportService.renderVideoExport(
        {
          videoFile,
          videoUrl,
          videoPath,
          takes,
          getAssetManager,
          originalVolume,
          originalEnabled: mode === 'both' || mode === 'original',
          voiceVolume,
          voiceEnabled: mode === 'both' || mode === 'voices',
          mode,
          projectPath,
          onProgress: (phase, pct) => {
            setCurrentPhase(phase);
            if (pct !== undefined) setProgressPct(pct);
          },
        },
        targetFilePath
      );

      if (!result.success) {
        throw new Error(result.message || 'FFmpeg video export failed.');
      }

      toast({
        title: 'Video Export Complete',
        description: `Successfully exported final MP4 video to: ${result.outputPath || targetFilePath}`,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('[ExportVideoDialog] Export error:', err);
      toast({
        title: 'Video Export Failed',
        description: err?.message || 'Could not export MP4 video.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
      setCurrentPhase('');
      setProgressPct(0);
    }
  };

  const isOrigDisabled = mode === 'voices' || mode === 'silent';
  const isVoiceDisabled = mode === 'original' || mode === 'silent';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Video className="h-4 w-4 text-primary" />
            Export Final Video (.mp4)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Export full resolution video with synchronized AI voice dubbing using original video stream copying.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-3">
          {/* Mode Selector */}
          <div className="bg-secondary/20 p-3 rounded-md border border-border/40 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Audio Track Mode
              </label>
              <Select value={mode} onValueChange={(val: VideoExportMode) => setMode(val)} disabled={isExporting}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue placeholder="Select Audio Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both" className="text-xs">Both Together</SelectItem>
                  <SelectItem value="original" className="text-xs">Original Only</SelectItem>
                  <SelectItem value="voices" className="text-xs">AI Voices Only</SelectItem>
                  <SelectItem value="silent" className="text-xs">Silent (No Audio)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">
              {mode === 'both' && 'Mix original soundtrack and AI Voice Takes using your volume settings.'}
              {mode === 'original' && 'Retain only original video audio track (AI voices muted).'}
              {mode === 'voices' && 'Replace original audio entirely with AI Voice Takes.'}
              {mode === 'silent' && 'Strip all audio tracks; output video stream only.'}
            </p>
          </div>

          {/* Original Audio Section */}
          <div className={cn(
            "bg-secondary/30 p-3 rounded-md border border-border/40 flex flex-col gap-2.5 transition-opacity",
            isOrigDisabled && "opacity-40"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Film className="h-3.5 w-3.5 text-blue-400" />
                <span>Original Audio Track Volume</span>
              </div>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {isOrigDisabled ? 'Muted' : `${Math.round(originalVolume * 100)}%`}
              </span>
            </div>
            <Slider
              value={[originalVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={isOrigDisabled || isExporting}
              onValueChange={(vals) => setOriginalVolume(vals[0] / 100)}
              className={cn((isOrigDisabled || isExporting) && 'cursor-not-allowed')}
            />
          </div>

          {/* AI Voices Section */}
          <div className={cn(
            "bg-secondary/30 p-3 rounded-md border border-border/40 flex flex-col gap-2.5 transition-opacity",
            isVoiceDisabled && "opacity-40"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <AudioLines className="h-3.5 w-3.5 text-amber-400" />
                <span>AI Voice Takes Volume</span>
              </div>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {isVoiceDisabled ? 'Muted' : `${Math.round(voiceVolume * 100)}%`}
              </span>
            </div>
            <Slider
              value={[voiceVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={isVoiceDisabled || isExporting}
              onValueChange={(vals) => setVoiceVolume(vals[0] / 100)}
              className={cn((isVoiceDisabled || isExporting) && 'cursor-not-allowed')}
            />
          </div>

          {/* Progress Indicator */}
          {isExporting && (
            <div className="bg-primary/10 p-3 rounded-md border border-primary/30 flex flex-col gap-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-medium text-primary">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {currentPhase || 'Exporting video...'}
                </span>
                <span className="font-mono text-xs font-bold">{progressPct}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-300 ease-out"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5">
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Exporting MP4...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export Video MP4
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

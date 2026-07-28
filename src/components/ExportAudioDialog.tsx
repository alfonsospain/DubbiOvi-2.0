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
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Film, AudioLines, Download, Loader2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Take } from '@/lib/types';
import type { VoiceAssetManager } from '@/lib/VoiceAssetManager';
import { AudioMixdownService } from '@/lib/AudioMixdownService';
import { useToast } from '@/hooks/use-toast';

export interface ExportAudioDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  videoFile: File | null;
  videoUrl?: string | null;
  takes: Take[];
  getAssetManager: () => VoiceAssetManager | null;
  initialOriginalVolume: number; // 0.0 to 1.0
  initialOriginalEnabled: boolean;
  initialVoiceVolume: number; // 0.0 to 1.0
  initialVoiceEnabled: boolean;
  projectName?: string;
  projectPath?: string;
}

/**
 * Export Audio Dialog for Milestone 15.4 — Audio Mixdown & Export.
 *
 * Uses native Electron Save As dialog and FFmpeg single rendering engine.
 */
export const ExportAudioDialog: React.FC<ExportAudioDialogProps> = ({
  isOpen,
  onOpenChange,
  videoFile,
  videoUrl,
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
  const [originalEnabled, setOriginalEnabled] = useState(initialOriginalEnabled);
  const [voiceVolume, setVoiceVolume] = useState(initialVoiceVolume);
  const [voiceEnabled, setVoiceEnabled] = useState(initialVoiceEnabled);
  const [format, setFormat] = useState<'wav' | 'mp3'>('wav');
  const [isExporting, setIsExporting] = useState(false);

  // Sync initial values whenever dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setOriginalVolume(initialOriginalVolume);
      setOriginalEnabled(initialOriginalEnabled);
      setVoiceVolume(initialVoiceVolume);
      setVoiceEnabled(initialVoiceEnabled);
    }
  }, [isOpen, initialOriginalVolume, initialOriginalEnabled, initialVoiceVolume, initialVoiceEnabled]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const cleanProjectName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_');
      const defaultFilename = `${cleanProjectName}_mixed_audio.${format}`;

      let targetFilePath = defaultFilename;

      // 1. Invoke native Electron Save As dialog if in Electron environment
      if (typeof window !== 'undefined' && (window as any).electron?.showSaveDialog) {
        const saveRes = await (window as any).electron.showSaveDialog({
          defaultPath: defaultFilename,
          filters: [
            { name: format === 'mp3' ? 'MP3 Audio File' : 'WAV Audio File', extensions: [format] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (saveRes.canceled || !saveRes.filePath) {
          setIsExporting(false);
          return;
        }

        targetFilePath = saveRes.filePath;
      }

      // 2. Render Audio Mixdown via FFmpeg engine directly
      const result = await AudioMixdownService.renderFFmpegMixdown(
        {
          videoFile,
          videoUrl,
          takes,
          getAssetManager,
          originalVolume,
          originalEnabled,
          voiceVolume,
          voiceEnabled,
          outputFormat: format,
          projectPath,
        },
        targetFilePath
      );

      if (!result.success) {
        throw new Error(result.message || 'FFmpeg audio mixdown rendering failed.');
      }

      toast({
        title: 'Audio Export Complete',
        description: `FFmpeg successfully rendered mixed audio to: ${result.outputPath || targetFilePath}`,
      });

      onOpenChange(false);
    } catch (err: any) {
      console.error('[ExportAudioDialog] Export error:', err);
      toast({
        title: 'Export Failed',
        description: err?.message || 'Could not render FFmpeg audio mixdown.',
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const effectiveOriginalPct = originalEnabled ? Math.round(originalVolume * 100) : 0;
  const effectiveVoicePct = voiceEnabled ? Math.round(voiceVolume * 100) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Music className="h-4 w-4 text-primary" />
            Export Audio Mixdown (FFmpeg Engine)
          </DialogTitle>
          <DialogDescription className="text-xs">
            Mix and render original video soundtrack with synthesized AI voice Takes matching your current preview settings.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-3">
          {/* Original Audio Section */}
          <div className="bg-secondary/30 p-3 rounded-md border border-border/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="export-orig-enable"
                  checked={originalEnabled}
                  onCheckedChange={(checked) => setOriginalEnabled(!!checked)}
                />
                <label
                  htmlFor="export-orig-enable"
                  className="flex items-center gap-1.5 cursor-pointer text-xs font-medium"
                >
                  <Film className="h-3.5 w-3.5 text-blue-400" />
                  <span>Original Audio Track</span>
                </label>
              </div>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {originalEnabled ? `${effectiveOriginalPct}%` : 'Muted'}
              </span>
            </div>
            <Slider
              value={[originalVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={!originalEnabled}
              onValueChange={(vals) => setOriginalVolume(vals[0] / 100)}
              className={cn(!originalEnabled && 'opacity-40 cursor-not-allowed')}
            />
          </div>

          {/* AI Voices Section */}
          <div className="bg-secondary/30 p-3 rounded-md border border-border/40 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="export-voice-enable"
                  checked={voiceEnabled}
                  onCheckedChange={(checked) => setVoiceEnabled(!!checked)}
                />
                <label
                  htmlFor="export-voice-enable"
                  className="flex items-center gap-1.5 cursor-pointer text-xs font-medium"
                >
                  <AudioLines className="h-3.5 w-3.5 text-amber-400" />
                  <span>AI Voice Takes</span>
                </label>
              </div>
              <span className="font-mono text-xs font-semibold text-muted-foreground">
                {voiceEnabled ? `${effectiveVoicePct}%` : 'Muted'}
              </span>
            </div>
            <Slider
              value={[voiceVolume * 100]}
              min={0}
              max={100}
              step={1}
              disabled={!voiceEnabled}
              onValueChange={(vals) => setVoiceVolume(vals[0] / 100)}
              className={cn(!voiceEnabled && 'opacity-40 cursor-not-allowed')}
            />
          </div>

          {/* Output Format Selector */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <label className="text-xs font-medium text-foreground">Output Format</label>
            <Select value={format} onValueChange={(val: 'wav' | 'mp3') => setFormat(val)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wav" className="text-xs">WAV (FFmpeg PCM)</SelectItem>
                <SelectItem value="mp3" className="text-xs">MP3 (FFmpeg LAME)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleExport} disabled={isExporting} className="gap-1.5">
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Rendering FFmpeg...
              </>
            ) : (
              <>
                <Download className="h-3.5 w-3.5" />
                Export Audio Mixdown
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

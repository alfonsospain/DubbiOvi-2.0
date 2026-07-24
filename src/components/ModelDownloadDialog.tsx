'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Cpu, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ModelDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  resourceType?: 'engine' | 'model';
  engineId?: string;
  engineName?: string;
  modelName?: string;
  estimatedSize?: string;
  onDownloadSuccess: () => void;
}

export const ModelDownloadDialog: React.FC<ModelDownloadDialogProps> = ({
  open,
  onClose,
  resourceType = 'model',
  engineId = 'whisper',
  engineName = 'Whisper Local',
  modelName = 'ggml-tiny.bin',
  estimatedSize = '~75 MB',
  onDownloadSuccess,
}) => {
  const { toast } = useToast();
  const [isDownloading, setIsDownloading] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [loadedMB, setLoadedMB] = useState(0);
  const [totalMB, setTotalMB] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setIsDownloading(false);
      setProgressPercent(0);
      setLoadedMB(0);
      setTotalMB(0);
      setErrorMessage(null);
    }
  }, [open]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const electron = (window as any).electron;
    if (!electron) return;

    let unsub: (() => void) | undefined;

    const handleProgress = (data: { loaded: number; total: number }) => {
      if (data.total > 0) {
        const pct = Math.min(100, Math.round((data.loaded / data.total) * 100));
        setProgressPercent(pct);
        setLoadedMB(parseFloat((data.loaded / (1024 * 1024)).toFixed(1)));
        setTotalMB(parseFloat((data.total / (1024 * 1024)).toFixed(1)));
      } else {
        setLoadedMB(parseFloat((data.loaded / (1024 * 1024)).toFixed(1)));
      }
    };

    if (resourceType === 'engine' && electron.onRuntimeDownloadProgress) {
      unsub = electron.onRuntimeDownloadProgress(handleProgress);
    } else if (resourceType === 'engine' && electron.onEngineDownloadProgress) {
      unsub = electron.onEngineDownloadProgress(handleProgress);
    } else if (resourceType === 'model' && electron.onModelDownloadProgress) {
      unsub = electron.onModelDownloadProgress(handleProgress);
    }

    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [resourceType]);

  const handleStartDownload = async () => {
    setIsDownloading(true);
    setErrorMessage(null);
    setProgressPercent(0);

    try {
      const electron = typeof window !== 'undefined' ? (window as any).electron : undefined;
      if (!electron) {
        throw new Error('Download is only supported in the desktop app environment.');
      }

      if (resourceType === 'engine') {
        const res = typeof electron.installRuntime === 'function'
          ? await electron.installRuntime(engineId, '1.9.1')
          : await electron.downloadEngineBinary(engineId);

        if (res && (res.executablePath || res.success)) {
          toast({
            title: 'Runtime Installed',
            description: `Successfully installed ${engineName} runtime into runtimes/${engineId}/.`,
          });
          onDownloadSuccess();
        } else {
          throw new Error(res?.error || 'Engine runtime installation failed.');
        }
      } else {
        const res = await electron.downloadEngineModel(engineId, modelName);
        if (res && res.success) {
          toast({
            title: 'Model Installed',
            description: `Successfully installed ${modelName} into models/${engineId}/.`,
          });
          onDownloadSuccess();
        } else {
          throw new Error(res?.error || 'Model download failed.');
        }
      }
    } catch (err: any) {
      console.error('[ModelDownloadDialog] Error:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during download.');
      toast({
        title: 'Download Failed',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const isEngine = resourceType === 'engine';
  const resourceTitle = isEngine ? `${engineName} Executable Binary` : `${engineName} Model`;
  const resourceDescription = isEngine
    ? `The native executable binary for ${engineName} is not installed on your machine.`
    : `The required model file ${modelName} (${estimatedSize}) is not installed on your machine.`;
  const buttonText = isEngine ? `Download Engine (${estimatedSize})` : `Download Model (${estimatedSize})`;

  return (
    <Dialog open={open} onOpenChange={(val) => !isDownloading && !val && onClose()}>
      <DialogContent className="max-w-md text-xs">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" /> {resourceTitle}
          </DialogTitle>
          <DialogDescription className="text-[11px] leading-normal pt-1">
            {resourceDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {errorMessage && (
            <div className="p-2.5 rounded border border-red-500/30 bg-red-500/10 text-red-400 text-[10.5px] flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-tight">{errorMessage}</div>
            </div>
          )}

          {isDownloading ? (
            <div className="space-y-2 p-3 rounded-lg border border-border bg-secondary/15">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Downloading {isEngine ? `${engineName} Binary` : modelName}...
                </span>
                <span className="font-bold text-primary">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>{loadedMB} MB downloaded</span>
                <span>{totalMB > 0 ? `${totalMB} MB total` : estimatedSize}</span>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-border/60 bg-secondary/10 text-[11px] space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Automatic Installation
              </p>
              <p className="text-muted-foreground leading-normal text-[10.5px]">
                Clicking <strong>{buttonText}</strong> will automatically download and unpack the resource into your local engine directory and proceed with your workflow.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
            disabled={isDownloading}
            className="text-xs h-8"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleStartDownload}
            disabled={isDownloading}
            className="text-xs font-bold h-8"
          >
            {isDownloading ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                {buttonText}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

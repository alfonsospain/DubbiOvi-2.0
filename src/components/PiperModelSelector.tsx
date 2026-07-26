'use client';

import React, { useState, useEffect } from 'react';
import { PiperModelManager, PiperModelDescriptor } from '@/lib/PiperModelManager';
import { VoiceService } from '@/lib/VoiceService';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, Volume2, HardDrive, Play, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PiperModelSelectorProps {
  onModelSelect?: (modelFilename: string) => void;
  onRequestDownload?: (modelFilename: string, estimatedSize: string) => void;
}

export const PiperModelSelector: React.FC<PiperModelSelectorProps> = ({
  onModelSelect,
  onRequestDownload,
}) => {
  const { toast } = useToast();
  const [activeModel, setActiveModel] = useState<string>('en_US-lessac-high.onnx');
  const [modelsStatus, setModelsStatus] = useState<
    Array<PiperModelDescriptor & { isInstalled: boolean }>
  >([]);
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const active = await PiperModelManager.getActiveModelName();
      setActiveModel(active);

      const known = PiperModelManager.getKnownModels();
      const installed = await PiperModelManager.listInstalledModels();
      const installedFilenames = new Set(installed.map((i) => i.filename.toLowerCase()));

      const status = known.map((m) => ({
        ...m,
        isInstalled: installedFilenames.has(m.filename.toLowerCase()),
      }));

      setModelsStatus(status);
    } catch (err) {
      console.error('[PiperModelSelector] Failed to load model status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSelectModel = async (filename: string) => {
    try {
      await PiperModelManager.setActiveModelName(filename);
      setActiveModel(filename);
      toast({
        title: 'Active Voice Model Updated',
        description: `Set active Piper model to ${filename}.`,
      });
      if (onModelSelect) onModelSelect(filename);
    } catch (err: any) {
      toast({
        title: 'Failed to set active model',
        description: err.message || String(err),
        variant: 'destructive',
      });
    }
  };

  const handleTestVoice = async (filename: string) => {
    setIsTestingVoice(true);
    try {
      const service = new VoiceService();
      const { result } = await service.generateVoiceForTake({
        takeId: 'test-preview',
        text: 'DubbiOvi local neural text to speech test.',
        language: 'EN',
        voiceId: filename,
        providerId: 'piper',
      });

      // Audition audio clip
      let resolvedUrl = `Audio/${result.filename}`;
      if (typeof window !== 'undefined' && (window as any).electron?.resolveAudioPath) {
        resolvedUrl = await (window as any).electron.resolveAudioPath(result.relativePath || result.filename);
      }

      const audio = new Audio(resolvedUrl);
      await audio.play().catch((e) => console.log('Audio playback preview notice:', e));

      toast({
        title: 'Voice Test Complete',
        description: `Synthesized test audio clip for ${filename}.`,
      });
    } catch (err: any) {
      toast({
        title: 'Voice Test Failed',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-primary" /> Piper Voice Models
        </h4>
        <span className="text-[10px] text-muted-foreground font-mono">
          Active: <strong className="text-primary">{activeModel}</strong>
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {modelsStatus.map((model) => {
          const isSelected = activeModel === model.filename;

          return (
            <div
              key={model.filename}
              className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-primary bg-primary/10 shadow-sm'
                  : 'border-border/60 bg-secondary/10 hover:bg-secondary/20'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    {model.name}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({model.estimatedSize})
                    </span>
                  </span>
                </div>

                <p className="text-[10.5px] text-muted-foreground leading-normal">
                  {model.description}
                </p>
              </div>

              <div className="pt-2 mt-2 border-t border-border/30 flex items-center justify-between">
                <span className="text-[10px]">
                  {model.isInstalled ? (
                    <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> Installed
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Not Downloaded</span>
                  )}
                </span>

                <div className="flex gap-1">
                  {!model.isInstalled && onRequestDownload && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2 font-semibold"
                      onClick={() => onRequestDownload(model.filename, model.estimatedSize)}
                    >
                      <Download className="h-2.5 w-2.5 mr-1" /> Download
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2 font-semibold text-amber-400 hover:text-amber-300"
                    onClick={() => handleTestVoice(model.filename)}
                    disabled={isTestingVoice}
                    title="Test Voice Synthesis"
                  >
                    {isTestingVoice ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Volume2 className="h-2.5 w-2.5 mr-1" />
                    )}
                    Test
                  </Button>

                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'secondary'}
                    className="h-6 text-[10px] px-2 font-semibold"
                    onClick={() => handleSelectModel(model.filename)}
                  >
                    {isSelected ? 'Active' : 'Select'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

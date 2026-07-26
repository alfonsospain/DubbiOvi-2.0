'use client';

import React, { useState, useEffect } from 'react';
import { WhisperModelManager, WhisperModelDescriptor } from '@/lib/WhisperModelManager';
import { WhisperRecommendationService, RecommendationResult } from '@/lib/WhisperRecommendationService';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Download, Sparkles, HardDrive } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WhisperModelSelectorProps {
  onModelSelect?: (modelFilename: string) => void;
  onRequestDownload?: (modelFilename: string, estimatedSize: string) => void;
}

export const WhisperModelSelector: React.FC<WhisperModelSelectorProps> = ({
  onModelSelect,
  onRequestDownload,
}) => {
  const { toast } = useToast();
  const [activeModel, setActiveModel] = useState<string>('ggml-tiny.bin');
  const [modelsStatus, setModelsStatus] = useState<
    Array<WhisperModelDescriptor & { isInstalled: boolean; modelPath: string | null }>
  >([]);
  const [recommendation, setRecommendation] = useState<RecommendationResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const active = await WhisperModelManager.getActiveModelName();
      setActiveModel(active);

      const status = await WhisperModelManager.getModelsStatus();
      setModelsStatus(status);

      const rec = WhisperRecommendationService.getRecommendation();
      setRecommendation(rec);
    } catch (err) {
      console.error('[WhisperModelSelector] Failed to load model status:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const handleSelectModel = async (filename: string) => {
    try {
      await WhisperModelManager.setActiveModelName(filename);
      setActiveModel(filename);
      toast({
        title: 'Active Model Updated',
        description: `Set active Whisper model to ${filename}.`,
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-primary" /> Whisper Model Manager
        </h4>
        <span className="text-[10px] text-muted-foreground font-mono">
          Active: <strong className="text-primary">{activeModel}</strong>
        </span>
      </div>

      {recommendation && (
        <div className="p-2.5 rounded-lg border border-amber-500/25 bg-amber-500/10 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Sparkles className="h-3.5 w-3.5" /> Recommended for this computer: {recommendation.model}
          </div>
          <p className="text-[10.5px] text-muted-foreground leading-normal pl-5">
            {recommendation.reason}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {modelsStatus.map((model) => {
          const isSelected = activeModel === model.filename;
          const isRecommended = recommendation?.model === model.filename;

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

                  {isRecommended && (
                    <span className="text-[9.5px] bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-semibold">
                      Recommended
                    </span>
                  )}
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

'use client';

import React, { useState, useEffect } from 'react';
import { PiperModelManager, PiperModelDescriptor } from '@/lib/PiperModelManager';
import { VoiceService } from '@/lib/VoiceService';
import { LanguageRegistry } from '@/lib/languages/LanguageRegistry';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Download, Volume2, HardDrive, Loader2, Globe, Info, Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PiperModelSelectorProps {
  onModelSelect?: (modelFilename: string) => void;
  onRequestDownload?: (modelFilename: string, estimatedSize: string) => Promise<void> | void;
}

export const PiperModelSelector: React.FC<PiperModelSelectorProps> = ({
  onModelSelect,
  onRequestDownload,
}) => {
  const { toast } = useToast();
  const [activeModel, setActiveModel] = useState<string>('');
  const [languageMapping, setLanguageMapping] = useState<Record<string, string>>({});
  const [modelsStatus, setModelsStatus] = useState<
    Array<PiperModelDescriptor & { isInstalled: boolean }>
  >([]);
  const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Compact Downloader State
  const [selectedDownloadLang, setSelectedDownloadLang] = useState<string>('EN');
  const [selectedDownloadModelFilename, setSelectedDownloadModelFilename] = useState<string>('');

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const active = await PiperModelManager.getActiveModelName();
      setActiveModel(active);

      const mapping = PiperModelManager.getLanguageVoiceMapping();
      setLanguageMapping(mapping);

      const known = PiperModelManager.getKnownModels();
      const installed = await PiperModelManager.listInstalledModels();
      const installedFilenames = new Set(installed.map((i) => i.filename.toLowerCase()));

      // 1. Map known catalog models to installation status
      const status: Array<PiperModelDescriptor & { isInstalled: boolean }> = known.map((m) => ({
        ...m,
        isInstalled: installedFilenames.has(m.filename.toLowerCase()),
      }));

      // 2. Include dynamically discovered custom models on disk not in standard catalog
      for (const inst of installed) {
        if (!known.some((k) => k.filename.toLowerCase() === inst.filename.toLowerCase())) {
          status.push({
            id: inst.filename,
            name: inst.filename.replace('.onnx', ''),
            filename: inst.filename,
            language: 'EN',
            gender: 'neutral',
            estimatedSize: 'Local',
            description: 'Custom installed voice model',
            isInstalled: true,
          });
        }
      }

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

  const installedModels = modelsStatus.filter((m) => m.isInstalled);
  const downloadableModels = modelsStatus.filter((m) => !m.isInstalled);

  // Distinct language codes available for download
  const availableDownloadLangs = Array.from(
    new Set(downloadableModels.map((m) => m.language.toUpperCase()))
  );

  // Sync compact downloader state when downloadableModels updates
  useEffect(() => {
    if (availableDownloadLangs.length > 0) {
      const currentLangValid = availableDownloadLangs.includes(selectedDownloadLang.toUpperCase());
      const targetLang = currentLangValid ? selectedDownloadLang.toUpperCase() : availableDownloadLangs[0];
      if (targetLang !== selectedDownloadLang) {
        setSelectedDownloadLang(targetLang);
      }

      const voicesForLang = downloadableModels.filter((m) => m.language.toUpperCase() === targetLang);
      const currentModelValid = voicesForLang.some((m) => m.filename === selectedDownloadModelFilename);
      if (!currentModelValid && voicesForLang.length > 0) {
        setSelectedDownloadModelFilename(voicesForLang[0].filename);
      }
    }
  }, [modelsStatus, selectedDownloadLang]);

  // Voices available for selected download language
  const voicesForSelectedLang = downloadableModels.filter(
    (m) => m.language.toUpperCase() === selectedDownloadLang.toUpperCase()
  );

  const currentDownloadModelDescriptor = downloadableModels.find(
    (m) => m.filename === selectedDownloadModelFilename
  ) || voicesForSelectedLang[0];

  const handleSelectModel = async (filename: string, language: string) => {
    try {
      await PiperModelManager.setPreferredVoiceForLanguage(language, filename);
      const updatedActive = await PiperModelManager.getActiveModelName();
      setActiveModel(updatedActive);
      const updatedMapping = PiperModelManager.getLanguageVoiceMapping();
      setLanguageMapping(updatedMapping);

      toast({
        title: 'Preferred Voice Updated',
        description: `Set ${filename} as preferred voice for ${LanguageRegistry.formatDisplay(language)}.`,
      });
      if (onModelSelect) onModelSelect(filename);
    } catch (err: any) {
      toast({
        title: 'Failed to set preferred voice',
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

      let resolvedUrl = `Audio/${result.filename}`;
      if (typeof window !== 'undefined' && (window as any).electron?.resolveAudioPath) {
        resolvedUrl = await (window as any).electron.resolveAudioPath(result.relativePath || result.filename);
      }

      const audio = new Audio(resolvedUrl);
      audio.onerror = (e) => console.error('[PiperModelSelector] Audio preview error:', e);
      await audio.play();

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

  const renderInstalledModelCard = (model: PiperModelDescriptor & { isInstalled: boolean }) => {
    const normLang = LanguageRegistry.normalizeCode(model.language).toUpperCase();
    const isGlobalActive = activeModel === model.filename;
    const isPreferredForLang = languageMapping[normLang] === model.filename;
    const isSelected = isGlobalActive || isPreferredForLang;
    const langDisplay = LanguageRegistry.formatDisplay(model.language);

    return (
      <div
        key={model.filename}
        className={`p-3 rounded-lg border text-xs transition-all flex flex-col justify-between ${
          isGlobalActive
            ? 'border-primary bg-primary/10 shadow-sm'
            : isPreferredForLang
            ? 'border-primary/40 bg-primary/5'
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
            <div className="flex items-center gap-1">
              {isGlobalActive ? (
                <Badge variant="default" className="text-[9px] py-0 px-1.5 font-bold bg-primary text-primary-foreground gap-0.5">
                  <Star className="h-2.5 w-2.5 fill-current" /> Active
                </Badge>
              ) : isPreferredForLang ? (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 font-semibold border-primary/40 text-primary gap-0.5">
                  <Star className="h-2.5 w-2.5 text-primary" /> Preferred ({normLang})
                </Badge>
              ) : null}
              <Badge variant="outline" className="text-[9.5px] font-mono bg-background/50">
                <Globe className="h-2.5 w-2.5 mr-1 text-primary" /> {langDisplay}
              </Badge>
            </div>
          </div>

          <p className="text-[10.5px] text-muted-foreground leading-normal">
            {model.description}
          </p>
        </div>

        <div className="pt-2 mt-2 border-t border-border/30 flex items-center justify-between">
          <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Installed
          </span>

          <div className="flex gap-1">
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
              variant={isGlobalActive ? 'default' : isPreferredForLang ? 'outline' : 'secondary'}
              className="h-6 text-[10px] px-2 font-semibold"
              onClick={() => handleSelectModel(model.filename, model.language)}
            >
              {isGlobalActive ? 'Active' : isPreferredForLang ? 'Preferred' : 'Select'}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <HardDrive className="h-3.5 w-3.5 text-primary" /> Piper Local Voice Models
        </h4>
        <span className="text-[10px] text-muted-foreground font-mono">
          Active: <strong className="text-primary">{activeModel || 'None Selected'}</strong>
        </span>
      </div>

      {/* 1. Installed Languages Section */}
      <div className="space-y-2">
        <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Installed Languages
        </h5>
        {installedModels.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {installedModels.map(renderInstalledModelCard)}
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-border/40 bg-secondary/10 text-[11px] text-muted-foreground flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span>No local voice packages installed yet. Select a language and voice below to download.</span>
          </div>
        )}
      </div>

      {/* 2. Download Additional Languages Section (Compact Downloader) */}
      <div className="space-y-2 pt-2 border-t border-border/40">
        <h5 className="text-[11px] font-bold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
          <Download className="h-3.5 w-3.5 text-primary" /> Download Additional Languages
        </h5>

        {downloadableModels.length > 0 && availableDownloadLangs.length > 0 ? (
          <div className="p-3 rounded-lg border border-border/55 bg-secondary/10 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Download Language Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="download-lang" className="text-xs font-semibold text-muted-foreground">
                  Download Language
                </Label>
                <select
                  id="download-lang"
                  value={selectedDownloadLang}
                  onChange={(e) => {
                    setSelectedDownloadLang(e.target.value);
                    const voices = downloadableModels.filter((m) => m.language.toUpperCase() === e.target.value.toUpperCase());
                    if (voices.length > 0) {
                      setSelectedDownloadModelFilename(voices[0].filename);
                    }
                  }}
                  className="h-9 text-xs font-medium bg-background/80 border border-border/80 rounded-md px-3 text-foreground w-full"
                >
                  {availableDownloadLangs.map((langCode) => (
                    <option key={langCode} value={langCode}>
                      ▼ {LanguageRegistry.formatDisplay(langCode)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Model Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="download-voice" className="text-xs font-semibold text-muted-foreground">
                  Voice Model
                </Label>
                <select
                  id="download-voice"
                  value={selectedDownloadModelFilename}
                  onChange={(e) => setSelectedDownloadModelFilename(e.target.value)}
                  className="h-9 text-xs font-medium bg-background/80 border border-border/80 rounded-md px-3 text-foreground w-full"
                >
                  {voicesForSelectedLang.map((m) => (
                    <option key={m.filename} value={m.filename}>
                      ▼ {m.name} ({m.estimatedSize})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action & Info Bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between pt-1 border-t border-border/30">
              <span className="text-[11px] text-muted-foreground leading-normal">
                {currentDownloadModelDescriptor?.description || 'Select a voice package to download.'}
              </span>

              <Button
                size="sm"
                onClick={async () => {
                  if (currentDownloadModelDescriptor && onRequestDownload) {
                    setIsDownloading(true);
                    try {
                      await onRequestDownload(
                        currentDownloadModelDescriptor.filename,
                        currentDownloadModelDescriptor.estimatedSize
                      );
                      // Refresh status immediately so installed model moves to Installed Languages!
                      await loadStatus();
                    } finally {
                      setIsDownloading(false);
                    }
                  }
                }}
                disabled={!currentDownloadModelDescriptor || !onRequestDownload || isDownloading}
                className="h-8 text-xs font-bold gap-1.5 shrink-0 text-primary-foreground bg-primary hover:bg-primary/90"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Downloading...
                  </>
                ) : (
                  <>
                    <Download className="h-3.5 w-3.5" /> Download Voice
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg border border-border/40 bg-secondary/10 text-[11px] text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>No additional downloadable voice models available. All catalog voice models are already installed.</span>
          </div>
        )}
      </div>
    </div>
  );
};

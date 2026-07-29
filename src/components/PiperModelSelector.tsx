'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PiperModelManager, PiperModelDescriptor } from '@/lib/PiperModelManager';
import { VoiceService } from '@/lib/VoiceService';
import { LanguageRegistry } from '@/lib/languages/LanguageRegistry';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Download,
  Volume2,
  HardDrive,
  Loader2,
  Globe,
  Info,
  Star,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PiperModelSelectorProps {
  onModelSelect?: (modelFilename: string) => void;
  onRequestDownload?: (
    modelFilename: string,
    estimatedSize: string,
    downloadUrl?: string,
    configUrl?: string
  ) => Promise<void> | void;
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
  const [isRemoving, setIsRemoving] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Collapsible Language Groups State
  const [expandedLangs, setExpandedLangs] = useState<Record<string, boolean>>({});

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

      // Fetch official Piper catalog from rhasspy/piper-voices (170+ voices, 49 languages)
      await PiperModelManager.fetchOfficialCatalog();

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
            description: 'Custom installed voice package',
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

  const installedModels = useMemo(() => modelsStatus.filter((m) => m.isInstalled), [modelsStatus]);
  const downloadableModels = useMemo(() => modelsStatus.filter((m) => !m.isInstalled), [modelsStatus]);

  const activeModelDescriptor = useMemo(
    () => modelsStatus.find((m) => m.filename === activeModel),
    [modelsStatus, activeModel]
  );

  // Group installed models by language
  const groupedInstalled = useMemo(() => {
    const groups: Record<string, Array<PiperModelDescriptor & { isInstalled: boolean }>> = {};
    for (const model of installedModels) {
      const langCode = LanguageRegistry.normalizeCode(model.language).toUpperCase();
      if (!groups[langCode]) groups[langCode] = [];
      groups[langCode].push(model);
    }
    return groups;
  }, [installedModels]);

  // Distinct language codes available for download in catalog
  const availableDownloadLangs = useMemo(() => {
    return Array.from(new Set(downloadableModels.map((m) => m.language.toUpperCase())));
  }, [downloadableModels]);

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
  }, [downloadableModels, availableDownloadLangs, selectedDownloadLang, selectedDownloadModelFilename]);

  // Voices available for selected download language
  const voicesForSelectedLang = useMemo(() => {
    return downloadableModels.filter(
      (m) => m.language.toUpperCase() === selectedDownloadLang.toUpperCase()
    );
  }, [downloadableModels, selectedDownloadLang]);

  const currentDownloadModelDescriptor = useMemo(() => {
    return (
      downloadableModels.find((m) => m.filename === selectedDownloadModelFilename) ||
      voicesForSelectedLang[0]
    );
  }, [downloadableModels, selectedDownloadModelFilename, voicesForSelectedLang]);

  const toggleLangExpand = (langCode: string) => {
    setExpandedLangs((prev) => ({
      ...prev,
      [langCode]: prev[langCode] === undefined ? false : !prev[langCode],
    }));
  };

  const handleSelectModel = async (filename: string, language: string) => {
    try {
      await PiperModelManager.setPreferredVoiceForLanguage(language, filename);
      const updatedActive = await PiperModelManager.getActiveModelName();
      setActiveModel(updatedActive);
      const updatedMapping = PiperModelManager.getLanguageVoiceMapping();
      setLanguageMapping(updatedMapping);

      toast({
        title: 'Voice Package Activated',
        description: `Activated ${filename} as active voice for ${LanguageRegistry.formatDisplay(language)}.`,
      });
      if (onModelSelect) onModelSelect(filename);
    } catch (err: any) {
      toast({
        title: 'Failed to activate voice package',
        description: err.message || String(err),
        variant: 'destructive',
      });
    }
  };

  const handleRemoveModel = async (filename: string, name: string) => {
    setIsRemoving(true);
    try {
      const removed = await PiperModelManager.removeModel(filename);
      if (removed) {
        toast({
          title: 'Voice Package Removed',
          description: `Successfully uninstalled ${name} from disk.`,
        });
        await loadStatus();
      } else {
        toast({
          title: 'Removal Error',
          description: `Could not delete ${filename} from disk.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Failed to remove package',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsRemoving(false);
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
        description: `Synthesized preview audio clip for ${filename}.`,
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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1.5">
            <span className="font-bold text-foreground text-xs truncate flex items-center gap-1.5">
              {model.name}
              <span className="text-[10px] text-muted-foreground font-normal shrink-0">
                ({model.estimatedSize})
              </span>
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <Badge variant="outline" className="text-[9.5px] font-medium bg-background/60 text-muted-foreground border-border/60">
                <Globe className="h-2.5 w-2.5 mr-1 text-primary" /> {langDisplay}
              </Badge>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground leading-normal line-clamp-2">
            {model.description}
          </p>
        </div>

        <div className="pt-2.5 mt-2.5 border-t border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {isGlobalActive ? (
              <Badge variant="default" className="text-[9.5px] py-0.5 px-2 font-semibold bg-primary text-primary-foreground gap-1">
                <CheckCircle2 className="h-3 w-3" /> Active Voice
              </Badge>
            ) : isPreferredForLang ? (
              <Badge variant="outline" className="text-[9.5px] py-0.5 px-2 font-semibold border-primary/40 text-primary bg-primary/10 gap-1">
                <Star className="h-3 w-3 fill-current text-primary" /> Preferred ({normLang})
              </Badge>
            ) : (
              <span className="text-[10.5px] text-muted-foreground flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Installed
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-2 font-semibold text-amber-950 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 hover:bg-amber-500/10"
              onClick={() => handleTestVoice(model.filename)}
              disabled={isTestingVoice}
              title="Test Voice Synthesis"
            >
              {isTestingVoice ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Volume2 className="h-3 w-3 mr-1" />
              )}
              Test
            </Button>

            <Button
              size="sm"
              variant={isGlobalActive ? 'secondary' : 'outline'}
              className={`h-7 text-[11px] px-2.5 font-semibold transition-colors ${
                isGlobalActive ? 'bg-primary/20 text-primary border border-primary/30 cursor-default' : 'hover:bg-secondary'
              }`}
              onClick={() => {
                if (!isGlobalActive) {
                  handleSelectModel(model.filename, model.language);
                }
              }}
              disabled={isGlobalActive}
            >
              {isGlobalActive ? 'Active' : 'Activate'}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] px-1.5 font-medium text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => handleRemoveModel(model.filename, model.name)}
              disabled={isRemoving}
              title="Uninstall Voice Package from disk"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 1. Dedicated Active Voice Status Section */}
      <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground">Active Voice Model</span>
          </div>
          {activeModelDescriptor ? (
            <Badge variant="default" className="text-[10px] py-0.5 px-2 font-semibold bg-primary text-primary-foreground gap-1">
              <CheckCircle2 className="h-3 w-3" /> Active
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-slate-900 dark:text-amber-400 font-bold border-amber-500/30 bg-amber-500/10">
              No Voice Selected
            </Badge>
          )}
        </div>

        {activeModelDescriptor ? (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-primary/15 text-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 font-bold text-foreground">
                <span>{activeModelDescriptor.name}</span>
                <Badge variant="outline" className="text-[9.5px] font-mono bg-background/60 text-muted-foreground border-border/60">
                  <Globe className="h-2.5 w-2.5 mr-1 text-primary" /> {LanguageRegistry.formatDisplay(activeModelDescriptor.language)}
                </Badge>
                <span className="text-[10px] text-muted-foreground font-normal">({activeModelDescriptor.estimatedSize})</span>
              </div>
              <div className="text-[11px] font-mono text-muted-foreground">
                {activeModelDescriptor.filename}
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px] font-medium gap-1.5 text-slate-900 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
              onClick={() => handleTestVoice(activeModelDescriptor.filename)}
              disabled={isTestingVoice}
            >
              {isTestingVoice ? <Loader2 className="h-3 w-3 animate-spin" /> : <Volume2 className="h-3 w-3" />}
              Test Active Voice
            </Button>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Select a voice package from the installed voice packages section below to activate offline synthesis.
          </p>
        )}
      </div>

      {/* 2. Installed Voice Packages Grouped by Language (Collapsible Sections) */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Installed Voice Packages ({Object.keys(groupedInstalled).length})
          </h5>
        </div>

        {Object.keys(groupedInstalled).length > 0 ? (
          <div className="space-y-2">
            {Object.entries(groupedInstalled).map(([langCode, models]) => {
              const isExpanded = expandedLangs[langCode] !== false; // Default expanded
              const langDisplay = LanguageRegistry.formatDisplay(langCode);
              const hasActive = models.some((m) => m.filename === activeModel);

              return (
                <div key={langCode} className="rounded-lg border border-border/50 bg-secondary/10 overflow-hidden">
                  {/* Language Group Collapsible Header */}
                  <div
                    onClick={() => toggleLangExpand(langCode)}
                    className="p-3 flex items-center justify-between cursor-pointer select-none hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-bold text-foreground">{langDisplay}</span>
                      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground border-border/60 bg-background/50">
                        {models.length} {models.length === 1 ? 'package' : 'packages'}
                      </Badge>
                      {hasActive && (
                        <Badge variant="default" className="text-[9.5px] py-0 px-1.5 bg-primary text-primary-foreground font-semibold">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <span className="text-[11px] text-muted-foreground font-mono mr-1">
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Collapsible Content Body */}
                  {isExpanded && (
                    <div className="p-3 pt-0 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2">
                      {models.map(renderInstalledModelCard)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10 text-xs text-muted-foreground flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>No local voice packages installed yet. Select a catalog language below to download a package.</span>
          </div>
        )}
      </div>

      {/* 3. Voice Package Catalog & Download Manager */}
      <div className="space-y-2.5 pt-3 border-t border-border/40">
        <h5 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5 text-primary" /> Voice Package Catalog & Download Manager
        </h5>

        {downloadableModels.length > 0 && availableDownloadLangs.length > 0 ? (
          <div className="p-3.5 rounded-lg border border-border/50 bg-secondary/10 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Download Language Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="download-lang" className="text-xs font-semibold text-muted-foreground">
                  Catalog Language
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
                  className="h-9 text-xs font-medium bg-background border border-border/70 rounded-md px-3 text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {availableDownloadLangs.map((langCode) => (
                    <option key={langCode} value={langCode}>
                      {LanguageRegistry.formatDisplay(langCode)} ({langCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Voice Model Dropdown */}
              <div className="space-y-1">
                <Label htmlFor="download-voice" className="text-xs font-semibold text-muted-foreground">
                  Voice Package
                </Label>
                <select
                  id="download-voice"
                  value={selectedDownloadModelFilename}
                  onChange={(e) => setSelectedDownloadModelFilename(e.target.value)}
                  className="h-9 text-xs font-medium bg-background border border-border/70 rounded-md px-3 text-foreground w-full focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {voicesForSelectedLang.map((m) => (
                    <option key={m.filename} value={m.filename}>
                      {m.name} ({m.estimatedSize})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Action & Description Bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between pt-2 border-t border-border/30">
              <span className="text-[11px] text-muted-foreground leading-normal max-w-md">
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
                        currentDownloadModelDescriptor.estimatedSize,
                        currentDownloadModelDescriptor.downloadUrl,
                        currentDownloadModelDescriptor.configUrl
                      );
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
                    <Download className="h-3.5 w-3.5" /> Download Voice Package
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3.5 rounded-lg border border-border/40 bg-secondary/10 text-xs text-muted-foreground flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>All catalog voice packages are currently installed on this system.</span>
          </div>
        )}
      </div>
    </div>
  );
};

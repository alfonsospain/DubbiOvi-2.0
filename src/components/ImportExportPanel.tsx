'use client';

import React, { useState } from 'react';
import type { Take } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { toSRT, toVTT, parseTimestampToSeconds } from '@/lib/utils';
import {
  HardDriveUpload,
  HardDriveDownload,
  FileText,
  UploadCloud,
  Sparkles,
  Loader2,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Copy,
  Download,
} from 'lucide-react';
import { Input } from './ui/input';
import { v4 as uuidv4 } from 'uuid';
import { AudioPreparationService } from '@/lib/AudioPreparationService';
import { providerRegistry } from '@/lib/ProviderRegistry';
import { loadApiKey, loadOpenAiApiKey } from '@/lib/apiKeyStorage';
import { SUPPORTED_LANGUAGES } from '@/lib/data';
import { ModelDownloadDialog } from './ModelDownloadDialog';
import { WhisperModelManager } from '@/lib/WhisperModelManager';
import { WhisperModelSelector } from './WhisperModelSelector';
import { ExecutionProgressTracker } from '@/runtime/progress/ExecutionProgressTracker';
import { ExecutionProgressDialog } from './ExecutionProgressDialog';
import { ExecutionJob } from '@/runtime/progress/ProgressTypes';

interface ImportExportPanelProps {
  takes: Take[];
  onImport: (takes: Take[]) => void;
  videoFile?: File | null;
  defaultSourceLang?: string;
  projectName?: string;
  onExportWordSource?: () => void;
  onExportWordTarget?: () => void;
  onExportWordBoth?: () => void;
  onExportExcel?: () => void;
  onExportCSV?: () => void;
  onSaveProjectAs?: () => void;
  transcriptionProvider?: string;
}

const STAGE_DETAILS = {
  preparing: {
    title: 'Preparing audio...',
    desc: 'Extracting the audio track from the video.'
  },
  optimizing: {
    title: 'Optimizing audio...',
    desc: 'Preparing the audio for speech recognition.'
  },
  uploading: {
    title: 'Sending audio to AI...',
    desc: 'Sending audio securely to the AI service.'
  },
  transcribing: {
    title: 'AI is transcribing...',
    desc: 'This may take several minutes for long videos. Please keep DubbiOvi open.'
  },
  generating: {
    title: 'Generating takes...',
    desc: 'Organizing the transcription into dialogue segments.'
  },
  completed: {
    title: 'Completed.',
    desc: 'All speech segments processed successfully.'
  }
};

const ImportExportPanel: React.FC<ImportExportPanelProps> = ({
  takes,
  onImport,
  videoFile,
  defaultSourceLang,
  projectName,
  onExportWordSource,
  onExportWordTarget,
  onExportWordBoth,
  onExportExcel,
  onExportCSV,
  onSaveProjectAs,
  transcriptionProvider,
}) => {
  const { toast } = useToast();
  const [importJson, setImportJson] = useState('');
  const [importScript, setImportScript] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionStage, setTranscriptionStage] = useState<'preparing' | 'optimizing' | 'uploading' | 'transcribing' | 'generating' | 'completed' | null>(null);
  const [selectedAsrLang, setSelectedAsrLang] = useState('Auto-Detect');
  const [hasApiKey, setHasApiKey] = useState(false);

  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [missingResourceDetails, setMissingResourceDetails] = useState<{
    resourceType: 'engine' | 'model';
    engineId: string;
    engineName: string;
    modelName?: string;
    estimatedSize: string;
  } | null>(null);

  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressJob, setProgressJob] = useState<ExecutionJob | null>(null);
  const trackerRef = React.useRef<ExecutionProgressTracker | null>(null);

  React.useEffect(() => {
    setHasApiKey(!!loadApiKey());
  }, []);

  const activeProvider = React.useMemo(() => {
    if (!transcriptionProvider || transcriptionProvider === 'None') {
      return null;
    }
    return providerRegistry.get(transcriptionProvider) || null;
  }, [transcriptionProvider]);

  const handleAsrTranscription = async () => {
    if (!videoFile) {
      toast({
        title: 'No Video Loaded',
        description: 'Please load a video file in the player first.',
        variant: 'destructive',
      });
      return;
    }

    if (!activeProvider) {
      toast({
        title: 'No Provider Selected',
        description: 'Please select a transcription provider in the Services tab.',
        variant: 'destructive',
      });
      return;
    }

    // Pre-flight check for local offline engines (Phase 1: Runtime Engine, Phase 2: Model)
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (isElectron && activeProvider.capabilities.isOffline) {
      // Phase 1: Check engine runtime installation state via Electron IPC bridge
      let isEngineInstalled = false;
      if (typeof (window as any).electron.checkRuntimeInstalled === 'function') {
        const runtimeStatus = await (window as any).electron.checkRuntimeInstalled('whisper', '1.9.1');
        isEngineInstalled = !!runtimeStatus?.isInstalled;
      } else if (typeof (window as any).electron.checkEngineBinary === 'function') {
        const binaryRes = await (window as any).electron.checkEngineBinary('whisper');
        isEngineInstalled = !!binaryRes?.installed;
      }

      if (!isEngineInstalled) {
        setMissingResourceDetails({
          resourceType: 'engine',
          engineId: 'whisper',
          engineName: activeProvider.name,
          estimatedSize: '~1.26 MB',
        });
        setDownloadDialogOpen(true);
        return;
      }

      // Phase 2: Check engine model file for active selected model
      const targetModel = await WhisperModelManager.getActiveModelName();
      const modelDesc = WhisperModelManager.getModelDescriptor(targetModel);
      const modelRes = await (window as any).electron.checkEngineModel('whisper', targetModel);
      if (modelRes && !modelRes.exists) {
        setMissingResourceDetails({
          resourceType: 'model',
          engineId: 'whisper',
          engineName: activeProvider.name,
          modelName: targetModel,
          estimatedSize: modelDesc?.estimatedSize || '~75 MB',
        });
        setDownloadDialogOpen(true);
        return;
      }
    }

    setIsTranscribing(true);

    const tracker = new ExecutionProgressTracker({
      title: 'Speech Recognition',
      provider: activeProvider.name,
      canCancel: true,
      steps: [
        { id: 'runtime-check', label: 'Runtime ready' },
        { id: 'model-check', label: 'Model loaded' },
        { id: 'audio-prep', label: 'Audio extracted & normalized' },
        { id: 'transcribing', label: 'Transcribing audio' },
        { id: 'generating-takes', label: 'Creating takes' },
      ],
    });

    trackerRef.current = tracker;
    tracker.subscribe((job) => setProgressJob(job));
    setProgressDialogOpen(true);
    tracker.start();

    try {
      tracker.setStep('runtime-check');
      tracker.setStep('model-check');

      tracker.setStep('audio-prep');
      const prepService = new AudioPreparationService();
      const preparedAudio = await prepService.prepareAudio(videoFile, activeProvider.capabilities);

      tracker.setStep('transcribing');
      const userApiKey = (activeProvider.id === 'openai-asr' ? loadOpenAiApiKey() : loadApiKey()) || undefined;
      const result = await activeProvider.transcribe(preparedAudio, selectedAsrLang, userApiKey);

      if (!result.takes || result.takes.length === 0) {
        throw new Error('No speech segments detected in this video.');
      }

      tracker.setStep('generating-takes');
      onImport(result.takes);

      tracker.complete();
      toast({
        title: 'Transcription Complete',
        description: `Imported ${result.takes.length} segments using ${activeProvider.name}.`,
      });
    } catch (err: any) {
      console.error(err);
      tracker.fail(err.message || String(err));
      toast({
        title: 'Transcription Failed',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleScriptImport = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Split text by paragraphs or double newlines
    const paragraphs = trimmed.split(/\n\s*\n+/);
    const newTakes: Take[] = paragraphs.map((p, index) => {
      let character = 'Character';
      let original = p.trim();

      // Check if paragraph starts with CHARACTER: or CHARACTER -
      const match = p.match(/^([^:\n-]+)(?:\s*[:\-]\s*)([\s\S]*)$/);
      if (match) {
        character = match[1].trim();
        original = match[2].trim();
      }

      return {
        id: uuidv4(),
        character,
        time: '00:00.000 - 00:05.000',
        startSeconds: 0,
        endSeconds: 5,
        original,
        translation: '',
        notes: '',
        status: 'Pending',
      };
    });

    onImport(newTakes);
    setImportScript('');
    toast({
      title: 'Script Imported',
      description: `Successfully loaded ${newTakes.length} takes.`,
    });
  };

  const handleJsonImport = () => {
    try {
      const data = JSON.parse(importJson);
      let parsedTakes: Take[] = [];
      if (Array.isArray(data)) {
        parsedTakes = data;
      } else if (data && Array.isArray(data.takes)) {
        parsedTakes = data.takes;
      } else {
        throw new Error('Invalid file format: list of takes not found.');
      }

      const formatted: Take[] = parsedTakes.map(t => ({
        id: t.id || uuidv4(),
        character: t.character || 'Unknown',
        time: t.time || '00:00.000 - 00:00.000',
        startSeconds: typeof t.startSeconds === 'number' ? t.startSeconds : 0,
        endSeconds: typeof t.endSeconds === 'number' ? t.endSeconds : 0,
        original: t.original || '',
        translation: t.translation || '',
        notes: t.notes || '',
        status: t.status || 'Pending',
      }));

      onImport(formatted);
      setImportJson('');
      toast({
        title: 'Project Loaded',
        description: `Imported ${formatted.length} takes successfully.`,
      });
    } catch (err: any) {
      toast({
        title: 'Import Failed',
        description: err.message || String(err),
        variant: 'destructive',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    if (file.name.endsWith('.docx')) {
      toast({
        title: 'Mammoth Docx Import',
        description: 'Reading Word script file...',
      });
      // Word file import requires Mammoth (usually handles async buffer)
      import('mammoth').then((mammoth) => {
        reader.onload = (event) => {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          mammoth.extractRawText({ arrayBuffer })
            .then((result) => {
              handleScriptImport(result.value);
            })
            .catch((err) => {
              console.error(err);
              toast({ title: 'Error reading .docx file', variant: 'destructive' });
            });
        };
        reader.readAsArrayBuffer(file);
      }).catch(err => {
        console.error(err);
        toast({ title: 'Failed to load docx parser', variant: 'destructive' });
      });
    } else {
      reader.onload = (ev) => {
        const text = ev.target?.result as string;
        handleScriptImport(text);
      };
      reader.readAsText(file);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Local helper to trigger downloads for text content (SRT, VTT, JSON, TXT)
  const downloadLocalFile = (content: string, ext: string, mime: string) => {
    const baseName = projectName ? projectName.trim() : 'untitled-project';
    const sanitized = baseName.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
    const filename = `${sanitized || 'project'}.${ext}`;

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Complete',
      description: `Saved "${filename}" successfully.`,
    });
  };

  // Local copy helper
  const copyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => toast({ title: 'Copied to Clipboard!' }))
      .catch(() => toast({ title: 'Copy Failed', variant: 'destructive' }));
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {/* Visual columns: Import left, Export right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Import Section */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm flex flex-col">
          <CardHeader className="pb-3 bg-secondary/5 border-b border-border/30">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <HardDriveUpload className="h-4.5 w-4.5 text-primary" /> Import Source
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Load dialogue segments or scripts into your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-grow">
            <Tabs defaultValue="script" className="w-full">
              <TabsList className="grid w-full grid-cols-3 h-8 text-[11px] p-0.5 bg-secondary/40">
                <TabsTrigger value="script" className="text-[11px] py-1">Script</TabsTrigger>
                <TabsTrigger value="json" className="text-[11px] py-1">JSON</TabsTrigger>
                <TabsTrigger value="asr" className="text-[11px] py-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3 text-amber-400" /> AI Transcribe
                </TabsTrigger>
              </TabsList>

              {/* Script Tab */}
              <TabsContent value="script" className="mt-3 space-y-3">
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Upload a plain text or Word file. Paragraphs split into takes automatically.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold h-8"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Upload File (.txt, .docx)
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".txt,.docx"
                  onChange={handleFileChange}
                />
                <Textarea
                  value={importScript}
                  onChange={e => setImportScript(e.target.value)}
                  className="h-36 font-mono text-[10.5px] p-2 resize-none"
                  placeholder="Or paste your plain script here (e.g. CHARACTER: Dialogue)..."
                />
                <Button
                  size="sm"
                  className="w-full text-xs font-semibold h-8"
                  onClick={() => handleScriptImport(importScript)}
                  disabled={!importScript.trim()}
                >
                  Import Script Text
                </Button>
              </TabsContent>

              {/* JSON Tab */}
              <TabsContent value="json" className="mt-3 space-y-3">
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Paste structured JSON code representing a previous export to restore.
                </p>
                <Textarea
                  value={importJson}
                  onChange={e => setImportJson(e.target.value)}
                  className="h-44 font-mono text-[10.5px] p-2 resize-none"
                  placeholder='Paste JSON containing {"takes": [...]} here...'
                />
                <Button
                  size="sm"
                  className="w-full text-xs font-semibold h-8"
                  onClick={handleJsonImport}
                  disabled={!importJson.trim()}
                >
                  Load Takes from JSON
                </Button>
              </TabsContent>

              {/* AI ASR Tab */}
              <TabsContent value="asr" className="mt-3 space-y-3">
                <p className="text-[11px] text-muted-foreground leading-normal">
                  Extract video audio and run speech-to-text transcription using the provider configured in the <strong>Services</strong> tab.
                </p>

                {/* Active Provider Indicator Badge */}
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/50 bg-secondary/15">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    Active Provider
                  </span>
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    {transcriptionProvider === 'None' ? (
                      '✍️ None (Manual)'
                    ) : activeProvider ? (
                      <>
                        <span>🎙️ {activeProvider.name}</span>
                        {activeProvider.capabilities.isOffline && (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded font-mono">
                            Offline
                          </span>
                        )}
                      </>
                    ) : (
                      transcriptionProvider
                    )}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">Audio Language</span>
                  <Select value={selectedAsrLang} onValueChange={setSelectedAsrLang} disabled={isTranscribing}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Auto-Detect">Auto-Detect Language (AI)</SelectItem>
                      {SUPPORTED_LANGUAGES.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {activeProvider && activeProvider.id === 'whisper-local' && (
                  <div className="pt-2 border-t border-border/40">
                    <WhisperModelSelector
                      onRequestDownload={(modelFilename, estimatedSize) => {
                        setMissingResourceDetails({
                          resourceType: 'model',
                          engineId: 'whisper',
                          engineName: activeProvider.name,
                          modelName: modelFilename,
                          estimatedSize,
                        });
                        setDownloadDialogOpen(true);
                      }}
                    />
                  </div>
                )}

                {transcriptionProvider === 'None' ? (
                  <div className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5 text-[10.5px] text-amber-400 leading-normal">
                    ⚠️ Transcription provider is set to <strong>None (Manual)</strong> in the <strong>Services</strong> tab. Select a provider (e.g. <strong>Whisper Local</strong> or <strong>Gemini</strong>) to transcribe automatically.
                  </div>
                ) : activeProvider && activeProvider.capabilities.requiresApiKey && !hasApiKey ? (
                  <div className="p-2.5 rounded border border-amber-500/20 bg-amber-500/5 text-[10.5px] flex flex-col gap-1">
                    <p className="font-bold text-amber-400 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" /> API Key Missing
                    </p>
                    <p className="text-muted-foreground leading-normal">
                      Please configure your API key for <strong>{activeProvider.name}</strong> in the <strong>Providers</strong> tab.
                    </p>
                  </div>
                ) : !videoFile ? (
                  <div className="p-2 border border-amber-500/20 rounded bg-amber-500/5 text-[10.5px] text-amber-500 font-medium">
                    ⚠️ Load a video in the media player to begin.
                  </div>
                ) : null}

                {isTranscribing && transcriptionStage && STAGE_DETAILS[transcriptionStage] && (
                  <div className="flex flex-col gap-1 p-2.5 rounded border border-border bg-secondary/20 text-[10.5px]">
                    <div className="flex items-center gap-1.5 font-bold text-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span>{STAGE_DETAILS[transcriptionStage].title}</span>
                    </div>
                    <p className="text-muted-foreground pl-5 leading-normal">
                      {STAGE_DETAILS[transcriptionStage].desc}
                    </p>
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={handleAsrTranscription}
                  disabled={
                    !videoFile ||
                    isTranscribing ||
                    !activeProvider ||
                    (activeProvider.capabilities.requiresApiKey && !hasApiKey)
                  }
                  className="w-full text-xs font-semibold h-8"
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Transcribing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                      Transcribe Video Audio
                    </>
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Export Section */}
        <Card className="border-border/60 bg-card/50 backdrop-blur-sm flex flex-col">
          <CardHeader className="pb-3 bg-secondary/5 border-b border-border/30">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <HardDriveDownload className="h-4.5 w-4.5 text-primary" /> Export Output
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Save your translation files in multiple professional formats.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-grow space-y-4">
            <div className="space-y-2.5">
              
              {/* Project .dubbiovi export */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">Project Workspace (.dubbiovi)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Contains all settings, takes, and glossary.</p>
                </div>
                <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={onSaveProjectAs}>
                  <Download className="h-3 w-3" /> Save As
                </Button>
              </div>

              {/* Subtitles SRT */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">SRT Subtitles (.srt)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Standard subtitle formatting with millisecond timestamps.</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(toSRT(takes))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={() => downloadLocalFile(toSRT(takes), 'srt', 'text/srt;charset=utf-8')}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>

              {/* Subtitles VTT */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">WebVTT Subtitles (.vtt)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">HTML5 compatible web video subtitle formatting.</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(toVTT(takes))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={() => downloadLocalFile(toVTT(takes), 'vtt', 'text/vtt;charset=utf-8')}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>

              {/* Word Document */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">Word Document (.docx)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Export script formatted for MS Word.</p>
                </div>
                <div className="flex flex-col gap-1 sm:flex-row sm:gap-1.5">
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold" onClick={onExportWordSource}>Source</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold" onClick={onExportWordTarget}>Target</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold" onClick={onExportWordBoth}>Both</Button>
                </div>
              </div>

              {/* Excel Worksheet */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">Excel Worksheet (.xlsx)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Tabular layout of characters, timings, and dialogues.</p>
                </div>
                <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={onExportExcel}>
                  <Download className="h-3 w-3" /> Download
                </Button>
              </div>

              {/* CSV file */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">CSV Table (.csv)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Timings and text formatted in comma-separated values.</p>
                </div>
                <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={onExportCSV}>
                  <Download className="h-3 w-3" /> Download
                </Button>
              </div>

              {/* JSON (Takes) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">Plain Takes JSON (.json)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Raw JSON list data containing only the takes list.</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(JSON.stringify({ takes }, null, 2))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={() => downloadLocalFile(JSON.stringify({ takes }, null, 2), 'json', 'application/json;charset=utf-8')}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>

              {/* TXT Script */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/10 border border-border/40 hover:bg-secondary/20 transition-colors">
                <div className="space-y-0.5">
                  <div className="text-[11px] font-bold text-foreground">Plain Text Script (.txt)</div>
                  <p className="text-[10px] text-muted-foreground leading-normal">Formatted text script listing characters and dialogue lines.</p>
                </div>
                <div className="flex gap-1.5">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => copyToClipboard(takes.map(t => `${t.character}: ${t.translation || t.original}`).join('\n\n'))}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="secondary" className="h-7 text-[10px] font-semibold flex items-center gap-1" onClick={() => downloadLocalFile(takes.map(t => `${t.character}: ${t.translation || t.original}`).join('\n\n'), 'txt', 'text/plain;charset=utf-8')}>
                    <Download className="h-3 w-3" /> Download
                  </Button>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>

      </div>

      {/* Missing Resource (Engine / Model) Download Dialog */}
      <ModelDownloadDialog
        open={downloadDialogOpen}
        onClose={() => setDownloadDialogOpen(false)}
        resourceType={missingResourceDetails?.resourceType}
        engineId={missingResourceDetails?.engineId}
        engineName={missingResourceDetails?.engineName}
        modelName={missingResourceDetails?.modelName}
        estimatedSize={missingResourceDetails?.estimatedSize}
        onDownloadSuccess={() => {
          setDownloadDialogOpen(false);
          setMissingResourceDetails(null);
          // Auto-resume transcription workflow after download completes!
          setTimeout(() => {
            handleAsrTranscription();
          }, 300);
        }}
      />

      {/* Generic Execution Progress Dialog (Milestone 8C & 8D) */}
      <ExecutionProgressDialog
        open={progressDialogOpen}
        job={progressJob}
        onCancelRequested={() => {
          if (trackerRef.current) {
            trackerRef.current.requestCancel();
          }
        }}
        onClose={() => {
          setProgressDialogOpen(false);
        }}
      />
    </div>
  );
};

export default ImportExportPanel;

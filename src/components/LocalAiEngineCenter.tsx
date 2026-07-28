'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Cpu,
  Layers,
  Volume2,
  ExternalLink,
  BookOpen,
  Terminal,
  Activity,
  Server,
  Clock,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
  Info,
  Wrench,
  Play,
} from 'lucide-react';
import { LocalOpenAITTSProvider, LocalServerStatus } from '@/lib/LocalOpenAITTSProvider';
import { parseVoiceMetadata, groupAndPrioritizeVoices } from '@/lib/VoiceMetadataParser';

export interface SystemDiagnostics {
  platform: 'darwin' | 'win32' | 'linux' | string;
  arch: 'arm64' | 'x64' | string;
  isAppleSilicon: boolean;
  dockerInstalled: boolean;
  dockerRunning: boolean;
  dockerVersion?: string;
  pythonInstalled: boolean;
  pythonVersion?: string;
}

export interface LocalAiEngineCenterProps {
  status: LocalServerStatus;
  baseUrl: string;
  onUrlChange: (url: string) => void;
  onTestConnection: (url?: string) => Promise<void>;
  isTesting: boolean;
  selectedModel: string;
  onModelSelect: (model: string) => void;
  selectedVoice: string;
  onVoiceSelect: (voice: string) => void;
  targetLanguage?: string;
}

const SUPPORTED_ENGINE_CATALOG = [
  {
    id: 'kokoro',
    name: 'Kokoro-FastAPI',
    statusTag: 'Recommended (First Validated Engine)',
    description: 'Ultra-fast 82M parameter neural speech model with OpenAI-compatible API.',
    dockerCmd: 'docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest',
    docsUrl: 'https://github.com/remsky/Kokoro-FastAPI',
    defaultPort: '8880',
    isValidated: true,
  },
  {
    id: 'xtts',
    name: 'XTTS-v2 Server',
    statusTag: 'Documentation Available (Experimental)',
    description: 'Multi-lingual voice cloning neural speech engine.',
    dockerCmd: 'docker run -p 8020:8020 ghcr.io/coqui-ai/tts:latest',
    docsUrl: 'https://github.com/coqui-ai/TTS',
    defaultPort: '8020',
    isValidated: false,
  },
  {
    id: 'parler',
    name: 'Parler-TTS Server',
    statusTag: 'Planned Support (Documentation Available)',
    description: 'High-quality expressive open-weight text-to-speech model.',
    dockerCmd: 'python -m parler_tts.server --port 8000',
    docsUrl: 'https://github.com/huggingface/parler-tts',
    defaultPort: '8000',
    isValidated: false,
  },
];

export function LocalAiEngineCenter({
  status,
  baseUrl,
  onUrlChange,
  onTestConnection,
  isTesting,
  selectedModel,
  onModelSelect,
  selectedVoice,
  onVoiceSelect,
  targetLanguage,
}: LocalAiEngineCenterProps) {
  const { toast } = useToast();
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [showGuidedSetup, setShowGuidedSetup] = useState(false);
  const [activeSetupTab, setActiveSetupTab] = useState<'docker' | 'python'>('docker');
  const [copiedCmd, setCopiedCmd] = useState<string | null>(null);

  // Audio Preview States
  const [isPreviewSynthesizing, setIsPreviewSynthesizing] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // System Diagnostics State
  const [sysDiag, setSysDiag] = useState<SystemDiagnostics>({
    platform: typeof process !== 'undefined' ? process.platform : 'darwin',
    arch: typeof process !== 'undefined' ? process.arch : 'arm64',
    isAppleSilicon: typeof process !== 'undefined' ? process.platform === 'darwin' && process.arch === 'arm64' : true,
    dockerInstalled: false,
    dockerRunning: false,
    pythonInstalled: false,
  });

  const [activeOsTab, setActiveOsTab] = useState<'mac' | 'windows'>('mac');

  // Detect OS & Environment on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).electron?.getSystemDiagnostics) {
      (window as any).electron.getSystemDiagnostics().then((diag: SystemDiagnostics) => {
        if (diag) {
          setSysDiag(diag);
          if (diag.platform === 'win32') {
            setActiveOsTab('windows');
          } else {
            setActiveOsTab('mac');
          }
        }
      });
    } else if (typeof navigator !== 'undefined') {
      const isWin = navigator.userAgent.includes('Windows');
      setActiveOsTab(isWin ? 'windows' : 'mac');
    }
  }, []);

  const refreshSystemDiagnostics = async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.getSystemDiagnostics) {
      const diag = await (window as any).electron.getSystemDiagnostics();
      if (diag) setSysDiag(diag);
    }
    await onTestConnection();
  };

  const handleCopyCmd = (cmd: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
      setCopiedCmd(cmd);
      setTimeout(() => setCopiedCmd(null), 2000);
    }
  };

  const handleOpenUrl = (url: string) => {
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Milestone 14F.3 — Voice Audition Preview Handler
  const handlePreviewVoice = async () => {
    if (!status.online || !selectedVoice) return;
    setIsPreviewSynthesizing(true);
    try {
      const provider = new LocalOpenAITTSProvider();
      const result = await provider.synthesize({
        text: 'Hello. This is a preview of the selected neural voice.',
        language: 'EN',
        voiceId: selectedVoice,
        takeId: 'preview-temp',
        modelName: selectedModel,
      });

      setIsPreviewSynthesizing(false);
      setIsPreviewPlaying(true);

      let resolvedUrl = result.relativePath;
      if (typeof window !== 'undefined' && (window as any).electron?.resolveAudioPath) {
        resolvedUrl = await (window as any).electron.resolveAudioPath(result.relativePath);
      }

      const audio = new Audio(resolvedUrl);
      audio.onended = () => {
        setIsPreviewPlaying(false);
      };
      audio.onerror = (e) => {
        console.error('[LocalAiEngineCenter] Audio preview error:', e);
        setIsPreviewPlaying(false);
      };

      await audio.play();
      toast({
        title: 'Voice Preview Playing',
        description: `Auditioning ${selectedVoice} (${selectedModel || 'kokoro'}).`,
      });
    } catch (err: any) {
      toast({
        title: 'Voice Preview Failed',
        description: err.message || 'Local speech server is offline or unreachable.',
        variant: 'destructive',
      });
      setIsPreviewSynthesizing(false);
      setIsPreviewPlaying(false);
    }
  };

  // Readiness conditions
  const isEngineReachable = status.online;
  const hasModels = status.models.length > 0;
  const hasVoices = status.voices.length > 0;
  const isFullyReady = isEngineReachable && hasModels && hasVoices;

  const targetLang = (targetLanguage || 'EN').toUpperCase();
  const { recommended, groups } = groupAndPrioritizeVoices(status.voices, targetLang);
  const activeVoiceMeta = parseVoiceMetadata(selectedVoice || (status.voices[0]?.id || 'af_bella'));

  const kokoroDockerCmd = 'docker run -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest';

  return (
    <div className="space-y-4">
      {/* 3-Tier Hierarchy Visualizer */}
      <div className="p-3.5 rounded-lg border border-border/60 bg-background/60 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Server className="h-3.5 w-3.5 text-primary" />
            Local Speech Hierarchy (3-Tier Engine Structure)
          </span>
          <Badge
            variant="outline"
            className={`text-[10px] font-bold px-2 py-0.5 border ${
              isFullyReady
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : status.online
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            {isFullyReady ? 'Local AI Voice Ready' : status.online ? 'Server Online' : 'Server Offline'}
          </Badge>
        </div>

        {/* Hierarchy Flow Diagram */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {/* Node 1: Engine Server */}
          <div className="p-2.5 rounded-md border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-sky-400" />
                1. Local Speech Engine
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-background">
                Endpoint
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground truncate" title={baseUrl}>
              {baseUrl}
            </p>
          </div>

          {/* Node 2: Dynamic Models */}
          <div className="p-2.5 rounded-md border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1">
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                2. Speech Models
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-background">
                {status.models.length} Discovered
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {status.models.length > 0 ? status.models.join(', ') : 'None detected'}
            </p>
          </div>

          {/* Node 3: Neural Voices */}
          <div className="p-2.5 rounded-md border border-border/80 bg-secondary/20 flex flex-col justify-between space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                3. Neural Voices
              </span>
              <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-background">
                {status.voices.length} Available
              </Badge>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground truncate">
              {status.voices.length > 0 ? `${status.voices.length} catalog voices` : 'Default catalog'}
            </p>
          </div>
        </div>
      </div>

      {/* Connection & Configuration Panel */}
      <div className="space-y-3 p-3.5 rounded-lg border border-border/60 bg-secondary/10">
        <div className="grid gap-1.5">
          <Label htmlFor="engine-center-url" className="text-xs font-semibold text-muted-foreground">
            Server Endpoint Base URL
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="engine-center-url"
              type="text"
              placeholder="http://localhost:8880/v1"
              value={baseUrl}
              onChange={(e) => onUrlChange(e.target.value)}
              className="h-9 text-xs font-mono bg-background/60 border-border/80 flex-1"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => refreshSystemDiagnostics()}
              disabled={isTesting}
              className="h-9 text-xs font-bold gap-1.5 shrink-0"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Probing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5 text-primary" /> Test Connection
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Actionable Status Panel */}
        {!status.online ? (
          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-2">
            <div className="flex items-center justify-between font-bold">
              <span className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                No Local AI Voice server is currently running.
              </span>
              <Button
                size="sm"
                onClick={() => setShowGuidedSetup(true)}
                className="h-7 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black gap-1"
              >
                <Wrench className="h-3.5 w-3.5" /> Set Up Kokoro-FastAPI
              </Button>
            </div>
            <p className="text-[11px] text-amber-300/80 leading-relaxed">
              Start an OpenAI-compatible speech server (such as Kokoro-FastAPI) and click Test Connection to detect it automatically.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pt-1 border-t border-border/40">
            <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                {status.statusMessage}
              </span>
              <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 text-[10px]">
                Kokoro Ready
              </Badge>
            </div>

            {/* Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Active Speech Model</Label>
                <select
                  value={selectedModel}
                  onChange={(e) => onModelSelect(e.target.value)}
                  className="h-9 text-xs font-mono bg-background/80 border border-border/80 rounded-md px-3 text-foreground w-full"
                >
                  {status.models.map((m) => (
                    <option key={m} value={m}>
                      ▼ {m}
                    </option>
                  ))}
                </select>
                {status.models.length > 1 && (
                  <p className="text-[10px] text-muted-foreground leading-tight pt-1 flex items-start gap-1">
                    <Info className="h-3 w-3 text-sky-400 shrink-0 mt-0.5" />
                    <span>This server exposes multiple OpenAI-compatible model aliases. All available voices are shared across them.</span>
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-foreground">Active Neural Voice</Label>
                <select
                  value={selectedVoice}
                  onChange={(e) => onVoiceSelect(e.target.value)}
                  className="h-9 text-xs font-mono bg-background/80 border border-border/80 rounded-md px-3 text-foreground w-full font-semibold"
                >
                  {recommended.length > 0 && (
                    <optgroup label={`⭐ Recommended for Target Language (${targetLang})`}>
                      {recommended.map((v) => (
                        <option key={`rec_${v.id}`} value={v.id}>
                          {v.countryFlag} {v.displayName} — {v.languageName} ({v.gender.toUpperCase()}) [{v.rawId}]
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {groups.map((group) => (
                    <optgroup key={group.languageName} label={`${group.countryFlag} ${group.languageName}`}>
                      {group.voices.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.countryFlag} {v.displayName} ({v.gender}) [{v.rawId}]
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            {/* Detailed Voice Metadata Inspector Badge */}
            {selectedVoice && (
              <div className="p-2 rounded-md bg-background/80 border border-border/70 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{activeVoiceMeta.countryFlag}</span>
                  <div>
                    <span className="font-bold text-foreground">{activeVoiceMeta.displayName}</span>
                    <span className="text-muted-foreground text-[10px] ml-1.5 font-semibold">({activeVoiceMeta.languageName})</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-bold px-1.5 py-0 ${
                      activeVoiceMeta.gender === 'female'
                        ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                        : activeVoiceMeta.gender === 'male'
                        ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {activeVoiceMeta.gender.toUpperCase()}
                  </Badge>
                  <span className="text-[10px] font-mono text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded border border-border/50">
                    ID: {activeVoiceMeta.rawId}
                  </span>
                </div>
              </div>
            )}

            {/* Milestone 14F.3 — Voice Preview Controls */}
            <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-border/30">
              <Button
                size="sm"
                variant="outline"
                onClick={handlePreviewVoice}
                disabled={!status.online || !selectedVoice || isPreviewSynthesizing || isPreviewPlaying}
                className="h-8 text-xs font-bold gap-1.5 border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
              >
                {isPreviewSynthesizing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Synthesizing Preview...
                  </>
                ) : isPreviewPlaying ? (
                  <>
                    <Volume2 className="h-3.5 w-3.5 animate-pulse text-emerald-400" /> Playing Preview...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-current" /> Preview Voice
                  </>
                )}
              </Button>
              <span className="text-[10px] text-muted-foreground italic">
                Audition selected model & neural voice without creating project assets.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={() => setShowGuidedSetup(!showGuidedSetup)}
          className="h-8 text-xs font-bold gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Wrench className="h-3.5 w-3.5" />
          {showGuidedSetup ? 'Hide Guided Setup' : 'Guided Setup: Kokoro-FastAPI'}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="h-8 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Activity className="h-3.5 w-3.5 text-sky-400" />
          {showDiagnostics ? 'Hide REST Diagnostics' : 'REST Diagnostics'}
        </Button>
      </div>

      {/* Guided Setup Panel for Kokoro-FastAPI */}
      {showGuidedSetup && (
        <div className="p-4 rounded-xl border border-primary/40 bg-card/90 shadow-md space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Set Up Kokoro-FastAPI
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold">
                  Recommended First Engine
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                DubbiOvi connects to local speech servers. All voice synthesis runs 100% offline on your machine.
              </p>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex items-center bg-secondary/60 p-0.5 rounded-lg border border-border/60 shrink-0">
              <button
                type="button"
                onClick={() => setActiveOsTab('mac')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeOsTab === 'mac' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                macOS (Terminal)
              </button>
              <button
                type="button"
                onClick={() => setActiveOsTab('windows')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  activeOsTab === 'windows' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Windows (PowerShell)
              </button>
            </div>
          </div>

          {/* Setup Option Tabs: Docker vs Python */}
          <div className="flex items-center gap-3 border-b border-border/40 pb-2">
            <button
              type="button"
              onClick={() => setActiveSetupTab('docker')}
              className={`text-xs font-bold pb-1 transition-all border-b-2 ${
                activeSetupTab === 'docker' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Option 1 — Docker Desktop (Recommended)
            </button>
            <button
              type="button"
              onClick={() => setActiveSetupTab('python')}
              className={`text-xs font-bold pb-1 transition-all border-b-2 ${
                activeSetupTab === 'python' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Option 2 — Native Python (Advanced)
            </button>
          </div>

          {/* Docker Setup Guide */}
          {activeSetupTab === 'docker' && (
            <div className="space-y-3">
              {activeOsTab === 'mac' ? (
                /* macOS Docker Guide */
                <ol className="space-y-3 list-decimal list-inside text-xs">
                  <li className="font-semibold text-foreground space-y-1.5">
                    <span>Install Docker Desktop for macOS</span>
                    <div className="pl-4 p-2 rounded bg-secondary/30 border border-border/50 text-[11px] font-medium text-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                      <span>
                        Detected hardware: <strong className="text-emerald-400">✓ {sysDiag.isAppleSilicon ? 'Apple Silicon' : 'Intel'}</strong>
                      </span>
                      <span className="text-muted-foreground text-[10px]">
                        Recommended installer: <strong>{sysDiag.isAppleSilicon ? 'Docker Desktop for Apple Silicon' : 'Docker Desktop for Intel Macs'}</strong>
                      </span>
                    </div>
                    <div className="pl-4 pt-1 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenUrl('https://www.docker.com/products/docker-desktop/')}
                        className="h-7 text-[11px] gap-1 font-bold"
                      >
                        Download Docker Desktop <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={refreshSystemDiagnostics} className="h-7 text-[11px] gap-1">
                        <RefreshCw className="h-3 w-3" /> Check Again
                      </Button>
                    </div>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Start Docker Desktop</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Open Docker Desktop from Applications. Ensure the status bar reports "Docker Desktop is running".
                    </p>
                    <div className="pl-4 pt-1">
                      {sysDiag.dockerRunning ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 font-bold">
                          <CheckCircle2 className="h-3 w-3" /> Docker Desktop Running
                        </Badge>
                      ) : sysDiag.dockerInstalled ? (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 font-bold">
                          <AlertTriangle className="h-3 w-3" /> Docker Desktop detected but not started
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
                          Docker status unverified
                        </Badge>
                      )}
                    </div>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Start Kokoro-FastAPI in Terminal</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Paste the following command into Terminal and press Enter:
                    </p>
                    <div className="pl-4 pt-1">
                      <div className="flex items-center justify-between bg-black/80 text-emerald-400 font-mono text-[11px] p-2.5 rounded-md border border-border/70">
                        <span className="truncate pr-2">{kokoroDockerCmd}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCmd(kokoroDockerCmd)}
                          className="h-6 text-[10px] font-bold text-white hover:text-emerald-400 shrink-0 gap-1"
                        >
                          {copiedCmd === kokoroDockerCmd ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedCmd === kokoroDockerCmd ? 'Copied' : 'Copy Command'}
                        </Button>
                      </div>
                    </div>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Wait for Initial Image & Voice Download</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      On first start, Docker will download Kokoro-FastAPI and prepackaged neural voices. Keep Terminal running.
                    </p>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Confirm Connection</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Return to DubbiOvi and click Test Connection.
                    </p>
                  </li>
                </ol>
              ) : (
                /* Windows Docker Guide */
                <ol className="space-y-3 list-decimal list-inside text-xs">
                  <li className="font-semibold text-foreground space-y-1">
                    <span>Install Docker Desktop for Windows (WSL 2 Backend)</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Download official Docker Desktop for Windows. Docker Desktop uses WSL 2 as its default backend.
                    </p>
                    <div className="pl-4 pt-1 flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenUrl('https://www.docker.com/products/docker-desktop/')}
                        className="h-7 text-[11px] gap-1 font-bold"
                      >
                        Download Docker Desktop <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={refreshSystemDiagnostics} className="h-7 text-[11px] gap-1">
                        <RefreshCw className="h-3 w-3" /> Check Again
                      </Button>
                    </div>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Start Docker Desktop</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Launch Docker Desktop from Start Menu and wait until the status bar shows engine ready.
                    </p>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Run PowerShell Command</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Paste the following command into PowerShell and press Enter:
                    </p>
                    <div className="pl-4 pt-1">
                      <div className="flex items-center justify-between bg-black/80 text-emerald-400 font-mono text-[11px] p-2.5 rounded-md border border-border/70">
                        <span className="truncate pr-2">{kokoroDockerCmd}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleCopyCmd(kokoroDockerCmd)}
                          className="h-6 text-[10px] font-bold text-white hover:text-emerald-400 shrink-0 gap-1"
                        >
                          {copiedCmd === kokoroDockerCmd ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedCmd === kokoroDockerCmd ? 'Copied' : 'Copy Command'}
                        </Button>
                      </div>
                    </div>
                  </li>

                  <li className="font-semibold text-foreground space-y-1">
                    <span>Return to DubbiOvi & Click Test Connection</span>
                    <p className="font-normal text-[11px] text-muted-foreground pl-4">
                      Keep PowerShell open while Kokoro is running.
                    </p>
                  </li>
                </ol>
              )}
            </div>
          )}

          {/* Native Python Setup Guide */}
          {activeSetupTab === 'python' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  Advanced Setup (Native Python 3.10+)
                </span>
                <p className="text-[11px] text-amber-300/80 mt-1">
                  For users running Python natively without Docker containers.
                </p>
              </div>

              <div className="space-y-2 font-mono text-[11px]">
                <div className="space-y-1">
                  <span className="font-sans font-bold text-foreground">1. Clone Kokoro-FastAPI Repository:</span>
                  <div className="flex items-center justify-between bg-black/80 text-sky-300 p-2 rounded border border-border/60">
                    <span>git clone https://github.com/remsky/Kokoro-FastAPI.git && cd Kokoro-FastAPI</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyCmd('git clone https://github.com/remsky/Kokoro-FastAPI.git && cd Kokoro-FastAPI')} className="h-5 text-[9px]">Copy</Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-sans font-bold text-foreground">2. Install Dependencies (uv or pip):</span>
                  <div className="flex items-center justify-between bg-black/80 text-sky-300 p-2 rounded border border-border/60">
                    <span>pip install -r requirements.txt</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyCmd('pip install -r requirements.txt')} className="h-5 text-[9px]">Copy</Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="font-sans font-bold text-foreground">3. Launch Server:</span>
                  <div className="flex items-center justify-between bg-black/80 text-emerald-400 p-2 rounded border border-border/60">
                    <span>python -m api.src.main</span>
                    <Button size="sm" variant="ghost" onClick={() => handleCopyCmd('python -m api.src.main')} className="h-5 text-[9px]">Copy</Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Guided Setup Readiness Checklist */}
          <div className="p-3.5 rounded-lg border border-border/70 bg-background/80 space-y-2.5">
            <div className="flex items-center justify-between font-bold text-foreground">
              <span className="flex items-center gap-1.5 text-xs">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Kokoro-FastAPI Readiness Checklist
              </span>
              <Button size="sm" variant="outline" onClick={refreshSystemDiagnostics} className="h-6 text-[10px] font-bold gap-1">
                <RefreshCw className="h-3 w-3" /> Re-evaluate Checklist
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              {/* Environment */}
              <div className="space-y-1 p-2 rounded bg-secondary/30 border border-border/50">
                <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">1. Environment</span>
                <div className="flex items-center gap-1.5">
                  {sysDiag.dockerInstalled ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Docker Desktop detected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {sysDiag.pythonInstalled ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Python detected ({sysDiag.pythonVersion || 'Python 3'})</span>
                </div>
              </div>

              {/* Engine */}
              <div className="space-y-1 p-2 rounded bg-secondary/30 border border-border/50">
                <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">2. Engine Server</span>
                <div className="flex items-center gap-1.5">
                  {isEngineReachable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Server Endpoint Reachable</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {isEngineReachable ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>OpenAI Speech Spec Compliant</span>
                </div>
              </div>

              {/* Discovery */}
              <div className="space-y-1 p-2 rounded bg-secondary/30 border border-border/50">
                <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">3. Discovery</span>
                <div className="flex items-center gap-1.5">
                  {hasModels ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Models Discovered ({status.models.length})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {hasVoices ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>Voices Discovered ({status.voices.length})</span>
                </div>
              </div>

              {/* Readiness Result */}
              <div className="space-y-1 p-2 rounded bg-secondary/30 border border-border/50">
                <span className="font-bold text-muted-foreground uppercase text-[10px] tracking-wider">4. Overall Status</span>
                <div className="flex items-center gap-1.5 pt-0.5 font-bold">
                  {isFullyReady ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span className="text-emerald-400">Local AI Voice Ready to Synthesize</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-amber-300">Setup Pending</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Panel with Explanations */}
      {showDiagnostics && (
        <div className="p-3 rounded-lg border border-border/60 bg-secondary/20 space-y-3 text-xs">
          <div className="flex items-center justify-between font-bold text-foreground">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-sky-400" />
              REST API Endpoint Diagnostics
            </span>
            <Badge variant="outline" className="text-[9px] font-mono">
              OpenAI Speech API Spec v1
            </Badge>
          </div>

          <div className="space-y-2 font-mono text-[11px]">
            {/* GET /v1/models */}
            <div className="p-2 rounded bg-background/70 border border-border/60 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-foreground">GET {baseUrl}/models</span>
                <span className={status.online ? 'text-emerald-400' : 'text-amber-400'}>
                  {status.online ? 'Available' : 'Offline'}
                </span>
              </div>
              <p className="font-sans text-[10px] text-muted-foreground">
                Checks which speech models are available on the server.
              </p>
            </div>

            {/* GET /v1/audio/voices */}
            <div className="p-2 rounded bg-background/70 border border-border/60 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-foreground">GET {baseUrl}/audio/voices</span>
                <span className={status.online ? 'text-emerald-400' : 'text-amber-400'}>
                  {status.online ? 'Available' : 'Offline'}
                </span>
              </div>
              <p className="font-sans text-[10px] text-muted-foreground">
                Checks which neural voices are available for speech synthesis.
              </p>
            </div>

            {/* POST /v1/audio/speech */}
            <div className="p-2 rounded bg-background/70 border border-border/60 space-y-1">
              <div className="flex items-center justify-between font-bold">
                <span className="text-foreground">POST {baseUrl}/audio/speech</span>
                <span className="text-sky-400">Available when generating speech</span>
              </div>
              <p className="font-sans text-[10px] text-muted-foreground">
                Used when DubbiOvi generates an audio voice take file.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Engine Guide Catalog */}
      <div className="p-3.5 rounded-lg border border-border/60 bg-secondary/20 space-y-3 text-xs">
        <div className="font-bold text-foreground flex items-center gap-1.5">
          <BookOpen className="h-4 w-4 text-amber-400" />
          Supported Local Speech Engine Catalog
        </div>

        <div className="space-y-2">
          {SUPPORTED_ENGINE_CATALOG.map((engine) => (
            <div key={engine.id} className="p-2.5 rounded border border-border/60 bg-background/50 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5 text-primary" />
                  {engine.name}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={`text-[9px] font-bold ${
                      engine.isValidated
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}
                  >
                    {engine.statusTag}
                  </Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenUrl(engine.docsUrl)}
                    className="h-5 text-[9px] font-semibold gap-1 px-1.5 text-primary hover:text-primary/80"
                  >
                    Docs <ExternalLink className="h-2.5 w-2.5" />
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">{engine.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

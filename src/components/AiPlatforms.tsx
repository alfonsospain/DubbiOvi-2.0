'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  loadApiKey,
  saveApiKey,
  clearApiKey,
  loadOpenAiApiKey,
  saveOpenAiApiKey,
  clearOpenAiApiKey,
  loadDeepLApiKey,
  saveDeepLApiKey,
  clearDeepLApiKey,
  loadOllamaConfig,
  saveOllamaConfig,
  clearOllamaConfig,
} from '@/lib/apiKeyStorage';
import {
  testGeminiConnection,
  testDeepLConnection,
  testOllamaConnection,
  fetchOllamaModelsAction,
} from '@/app/actions';
import { categorizeOllamaModels } from '@/lib/OllamaModelHeuristics';
import {
  Eye,
  EyeOff,
  Key,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Cpu,
  Download,
  Sparkles,
  Layers,
  Globe,
  Mic,
  Volume2,
  Clock,
  Info,
  Layers3,
} from 'lucide-react';
import { PiperModelSelector } from './PiperModelSelector';
import { WhisperModelSelector } from './WhisperModelSelector';
import { LocalOpenAITTSProvider, LocalServerStatus, DEFAULT_LOCAL_TTS_URL } from '@/lib/LocalOpenAITTSProvider';
import { LocalAiEngineCenter } from './LocalAiEngineCenter';

const OLLAMA_SPEECH_MODEL_STORAGE_KEY = 'dubbiovi_ollama_speech_model';

const CAPABILITY_CONFIG = {
  asr: { label: 'Speech Recognition', icon: Mic, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  translation: { label: 'Translation', icon: Globe, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  tts: { label: 'Voice Generation', icon: Volume2, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
};

function ProviderCapabilityBadges({ capabilities }: { capabilities: Array<'asr' | 'translation' | 'tts'> }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {capabilities.map((cap) => {
        const config = CAPABILITY_CONFIG[cap];
        const Icon = config.icon;
        return (
          <Badge
            key={cap}
            variant="outline"
            className={`text-[10px] font-semibold py-0.5 px-2 gap-1 border ${config.color}`}
          >
            <Icon className="h-3 w-3 shrink-0" />
            {config.label}
          </Badge>
        );
      })}
    </div>
  );
}

export default function AiPlatforms() {
  const { toast } = useToast();

  // Expanded card states
  const [expandedCards, setExpandedCards] = useState<{ [key: string]: boolean }>({
    google: true,
    openai: true,
    ollama: true,
    whisper: true,
    piper: true,
    localTts: true,
    deepl: false,
  });

  const toggleExpand = (key: string) => {
    setExpandedCards((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // 1. Google AI State
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isGeminiTesting, setIsGeminiTesting] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);

  // 2. OpenAI State
  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [isOpenAiTesting, setIsOpenAiTesting] = useState(false);
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);

  // 3. DeepL State
  const [deepLKeyInput, setDeepLKeyInput] = useState('');
  const [showDeepLKey, setShowDeepLKey] = useState(false);
  const [isDeepLTesting, setIsDeepLTesting] = useState(false);
  const [hasDeepLKey, setHasDeepLKey] = useState(false);

  // 4. Ollama State
  const [ollamaUrlInput, setOllamaUrlInput] = useState('http://localhost:11434');
  const [ollamaModelInput, setOllamaModelInput] = useState('');
  const [ollamaVoiceModelInput, setOllamaVoiceModelInput] = useState('');
  const [ollamaRawModels, setOllamaRawModels] = useState<string[]>([]);
  const [isOllamaTesting, setIsOllamaTesting] = useState(false);
  const [isOllamaFetching, setIsOllamaFetching] = useState(false);
  const [hasOllamaConfig, setHasOllamaConfig] = useState(false);

  // 5. Piper Local State
  const [isPiperInstalled, setIsPiperInstalled] = useState(false);
  const [isPiperInstalling, setIsPiperInstalling] = useState(false);

  // 6. Local AI Voice Provider State
  const [localTtsUrlInput, setLocalTtsUrlInput] = useState(DEFAULT_LOCAL_TTS_URL);
  const [localTtsStatus, setLocalTtsStatus] = useState<LocalServerStatus>({
    online: false,
    baseUrl: DEFAULT_LOCAL_TTS_URL,
    statusMessage: 'Server status unverified.',
    models: [],
    voices: [],
  });
  const [isLocalTtsTesting, setIsLocalTtsTesting] = useState(false);
  const [selectedLocalTtsModel, setSelectedLocalTtsModel] = useState('');
  const [selectedLocalTtsVoice, setSelectedLocalTtsVoice] = useState('');

  // Initial Load
  useEffect(() => {
    // Google AI
    const savedGemini = loadApiKey() || '';
    setGeminiKeyInput(savedGemini);
    setHasGeminiKey(!!savedGemini);

    // OpenAI
    const savedOpenAi = loadOpenAiApiKey() || '';
    setOpenAiKeyInput(savedOpenAi);
    setHasOpenAiKey(!!savedOpenAi);

    // DeepL
    const savedDeepL = loadDeepLApiKey() || '';
    setDeepLKeyInput(savedDeepL);
    setHasDeepLKey(!!savedDeepL);

    // Local AI Voice Server auto-probe on mount
    const localProvider = new LocalOpenAITTSProvider();
    const savedUrl = localProvider.getBaseUrl();
    setLocalTtsUrlInput(savedUrl);
    localProvider.checkServerConnection(savedUrl).then((status) => {
      setLocalTtsStatus(status);
      if (status.models.length > 0) setSelectedLocalTtsModel(status.models[0]);
      if (status.voices.length > 0) setSelectedLocalTtsVoice(status.voices[0].id);
    });

    // Ollama
    const savedOllama = loadOllamaConfig();
    if (savedOllama.url) setOllamaUrlInput(savedOllama.url);
    if (savedOllama.model) setOllamaModelInput(savedOllama.model);
    setHasOllamaConfig(!!(savedOllama.url && savedOllama.model));

    if (typeof window !== 'undefined') {
      const savedSpeech = localStorage.getItem(OLLAMA_SPEECH_MODEL_STORAGE_KEY) || '';
      setOllamaVoiceModelInput(savedSpeech);
    }

    checkPiperRuntime();
  }, []);

  const checkPiperRuntime = async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.checkEngineBinary) {
      try {
        const res = await (window as any).electron.checkEngineBinary('piper');
        setIsPiperInstalled(!!res?.installed);
      } catch (_) {}
    }
  };

  const handleInstallPiperRuntime = async () => {
    setIsPiperInstalling(true);
    try {
      if (typeof window !== 'undefined' && (window as any).electron?.installEngineBinary) {
        await (window as any).electron.installEngineBinary('piper');
        toast({
          title: 'Piper Engine Installed',
          description: 'Local Piper TTS engine binary was downloaded successfully.',
        });
        await checkPiperRuntime();
      }
    } catch (err: any) {
      toast({
        title: 'Installation Failed',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsPiperInstalling(false);
    }
  };

  // Handlers - Local AI Voice Provider
  const handleTestLocalTts = async (urlToTest?: string) => {
    setIsLocalTtsTesting(true);
    const targetUrl = urlToTest || localTtsUrlInput;
    try {
      const localProvider = new LocalOpenAITTSProvider();
      const status = await localProvider.checkServerConnection(targetUrl);
      setLocalTtsStatus(status);
      localProvider.saveBaseUrl(targetUrl);

      if (status.models.length > 0) setSelectedLocalTtsModel(status.models[0]);
      if (status.voices.length > 0) setSelectedLocalTtsVoice(status.voices[0].id);

      if (status.online) {
        toast({
          title: 'Local Speech Server Connected',
          description: status.statusMessage,
        });
      } else {
        toast({
          title: 'Local Server Offline',
          description: status.statusMessage,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Connection Probe Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsLocalTtsTesting(false);
    }
  };

  // Handlers - Google AI
  const handleGeminiSave = () => {
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Empty API Key',
        description: 'Please input a valid key or clear existing configurations.',
        variant: 'destructive',
      });
      return;
    }
    saveApiKey(trimmed);
    setHasGeminiKey(true);
    toast({
      title: 'Google AI API Key Saved',
      description: 'Your Google AI (Gemini) API Key has been saved locally.',
    });
  };

  const handleGeminiClear = () => {
    clearApiKey();
    setGeminiKeyInput('');
    setHasGeminiKey(false);
    toast({
      title: 'Google AI Key Cleared',
      description: 'Your Google AI API Key has been removed from local storage.',
    });
  };

  const handleGeminiTest = async () => {
    const trimmed = geminiKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Test Failed',
        description: 'Please enter an API Key to test.',
        variant: 'destructive',
      });
      return;
    }
    setIsGeminiTesting(true);
    try {
      const res = await testGeminiConnection(trimmed);
      if (res.success) {
        toast({
          title: 'Connection Successful',
          description: 'Google AI API Key is valid and working.',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: res.error || 'Invalid Google AI API Key or connection timeout.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Connection Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsGeminiTesting(false);
    }
  };

  // Handlers - OpenAI
  const handleOpenAiSave = () => {
    const trimmed = openAiKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Empty API Key',
        description: 'Please input a valid key or clear existing configurations.',
        variant: 'destructive',
      });
      return;
    }
    saveOpenAiApiKey(trimmed);
    setHasOpenAiKey(true);
    toast({
      title: 'OpenAI API Key Saved',
      description: 'Your OpenAI API Key has been saved locally.',
    });
  };

  const handleOpenAiClear = () => {
    clearOpenAiApiKey();
    setOpenAiKeyInput('');
    setHasOpenAiKey(false);
    toast({
      title: 'OpenAI API Key Cleared',
      description: 'Your OpenAI API Key has been removed from local storage.',
    });
  };

  const handleOpenAiTest = async () => {
    const trimmed = openAiKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Test Failed',
        description: 'Please enter an API Key to test.',
        variant: 'destructive',
      });
      return;
    }
    setIsOpenAiTesting(true);
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${trimmed}` },
      });
      if (res.ok) {
        toast({
          title: 'Connection Successful',
          description: 'OpenAI API Key is valid and working.',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: `HTTP ${res.status}: Invalid OpenAI API Key or quota error.`,
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Connection Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsOpenAiTesting(false);
    }
  };

  // Handlers - DeepL
  const handleDeepLSave = () => {
    const trimmed = deepLKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Empty API Key',
        description: 'Please input a valid key or clear existing configurations.',
        variant: 'destructive',
      });
      return;
    }
    saveDeepLApiKey(trimmed);
    setHasDeepLKey(true);
    toast({
      title: 'DeepL API Key Saved',
      description: 'Your DeepL API Key has been saved locally.',
    });
  };

  const handleDeepLClear = () => {
    clearDeepLApiKey();
    setDeepLKeyInput('');
    setHasDeepLKey(false);
    toast({
      title: 'DeepL API Key Cleared',
      description: 'Your DeepL API Key has been removed from local storage.',
    });
  };

  const handleDeepLTest = async () => {
    const trimmed = deepLKeyInput.trim();
    if (!trimmed) {
      toast({
        title: 'Test Failed',
        description: 'Please enter an API Key to test.',
        variant: 'destructive',
      });
      return;
    }
    setIsDeepLTesting(true);
    try {
      const res = await testDeepLConnection(trimmed);
      if (res.success) {
        toast({
          title: 'Connection Successful',
          description: 'DeepL API Key is valid and working.',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: res.error || 'Invalid DeepL API Key or connection error.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Connection Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsDeepLTesting(false);
    }
  };

  // Handlers - Ollama
  const handleOllamaSave = () => {
    const url = ollamaUrlInput.trim();
    const model = ollamaModelInput.trim();
    if (!url) {
      toast({
        title: 'Empty Connection URL',
        description: 'Please input a valid Ollama base URL (e.g. http://localhost:11434).',
        variant: 'destructive',
      });
      return;
    }
    saveOllamaConfig(url, model);
    if (typeof window !== 'undefined') {
      localStorage.setItem(OLLAMA_SPEECH_MODEL_STORAGE_KEY, ollamaVoiceModelInput.trim());
    }
    setHasOllamaConfig(!!(url && model));
    toast({
      title: 'Ollama Platform Configured',
      description: `Targeting ${url}${model ? ` with translation model '${model}'` : ''}.`,
    });
  };

  const handleOllamaClear = () => {
    clearOllamaConfig();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(OLLAMA_SPEECH_MODEL_STORAGE_KEY);
    }
    setOllamaUrlInput('http://localhost:11434');
    setOllamaModelInput('');
    setOllamaVoiceModelInput('');
    setOllamaRawModels([]);
    setHasOllamaConfig(false);
    toast({
      title: 'Ollama Configuration Reset',
      description: 'Ollama connection settings have been cleared.',
    });
  };

  const handleFetchOllamaModels = async () => {
    const url = ollamaUrlInput.trim() || 'http://localhost:11434';
    setIsOllamaFetching(true);
    try {
      const res = await fetchOllamaModelsAction(url);
      if (res.success && res.models.length > 0) {
        setOllamaRawModels(res.models);
        const { translationModels, voiceModels } = categorizeOllamaModels(res.models);

        if (!ollamaModelInput && translationModels.length > 0) {
          setOllamaModelInput(translationModels[0]);
        } else if (!ollamaModelInput && res.models.length > 0) {
          setOllamaModelInput(res.models[0]);
        }

        if (!ollamaVoiceModelInput && voiceModels.length > 0) {
          setOllamaVoiceModelInput(voiceModels[0]);
        }

        toast({
          title: 'Models Discovered',
          description: `Found ${res.models.length} installed model(s) in Ollama daemon.`,
        });
      } else if (res.success && res.models.length === 0) {
        toast({
          title: 'No Models Installed',
          description: 'Ollama daemon is active, but no models were found. Run `ollama pull llama3.1` in terminal.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Model Discovery Failed',
          description: res.error || 'Unable to connect to Ollama daemon.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Discovery Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsOllamaFetching(false);
    }
  };

  const handleOllamaTest = async () => {
    const url = ollamaUrlInput.trim() || 'http://localhost:11434';
    setIsOllamaTesting(true);
    try {
      const res = await testOllamaConnection(url);
      if (res.success) {
        toast({
          title: 'Connection Successful',
          description: `Ollama daemon is active at ${url}.`,
        });
        await handleFetchOllamaModels();
      } else {
        toast({
          title: 'Connection Failed',
          description: res.error || 'Could not connect to Ollama daemon.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Connection Error',
        description: err.message || String(err),
        variant: 'destructive',
      });
    } finally {
      setIsOllamaTesting(false);
    }
  };

  // Categorize Ollama models
  const categorizedOllama = categorizeOllamaModels(ollamaRawModels);

  return (
    <div className="space-y-4 pb-6">
      {/* Overview Banner */}
      <div className="p-3.5 rounded-xl border border-primary/20 bg-primary/5 flex items-center justify-between">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-primary" /> AI Platforms Ecosystem
          </h3>
          <p className="text-xs text-muted-foreground">
            Configure your AI credentials and models. Each platform exposes the capabilities it supports inside DubbiOvi.
          </p>
        </div>
      </div>

      {/* 1. Google AI Ecosystem Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('google')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">
              Google AI (Gemini Ecosystem)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Cloud Multilingual Speech Recognition & High-Fidelity Translation
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['asr', 'translation', 'tts']} />
          </div>
          <div className="flex items-center gap-2">
            {hasGeminiKey ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3" /> Disconnected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('google');
              }}
            >
              {expandedCards.google ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expandedCards.google && (
          <CardContent className="space-y-4 pt-0">
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-xs font-semibold text-muted-foreground">
                Google AI API Key
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="gemini-key"
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="Enter your Gemini API Key..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="pr-10 w-full h-9 text-xs font-mono"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 hover:bg-transparent h-8 w-8"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                </Button>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <Button size="sm" onClick={handleGeminiSave} disabled={isGeminiTesting} className="h-8 text-xs font-bold">
                  Save API Key
                </Button>
                <Button size="sm" variant="outline" onClick={handleGeminiTest} disabled={isGeminiTesting || !geminiKeyInput.trim()} className="h-8 text-xs font-bold">
                  {isGeminiTesting ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button size="sm" variant="secondary" onClick={handleGeminiClear} disabled={isGeminiTesting || !hasGeminiKey} className="h-8 text-xs font-bold">
                  Clear Key
                </Button>
              </div>

              <a
                href="https://aistudio.google.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Get Google AI Studio Key ↗
              </a>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 2. OpenAI Ecosystem Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('openai')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">
              OpenAI (Whisper Cloud & GPT)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Cloud Whisper Speech-to-Text & GPT Translation Services
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['asr', 'translation', 'tts']} />
          </div>
          <div className="flex items-center gap-2">
            {hasOpenAiKey ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Disconnected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('openai');
              }}
            >
              {expandedCards.openai ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedCards.openai && (
          <CardContent className="space-y-4 pt-0 text-xs">
            {/* Input */}
            <div className="space-y-1.5">
              <Label htmlFor="openai-api-key" className="text-xs font-semibold text-muted-foreground">
                OpenAI API Key
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="openai-api-key"
                  type={showOpenAiKey ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={openAiKeyInput}
                  onChange={(e) => setOpenAiKeyInput(e.target.value)}
                  className="pr-10 text-xs font-mono h-9 bg-background/50 border-border/80"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowOpenAiKey(!showOpenAiKey)}
                >
                  {showOpenAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleOpenAiSave} disabled={isOpenAiTesting} className="h-8 text-xs font-bold">
                Save Key
              </Button>
              <Button size="sm" variant="outline" onClick={handleOpenAiTest} disabled={isOpenAiTesting || !openAiKeyInput.trim()} className="h-8 text-xs font-bold gap-1.5">
                {isOpenAiTesting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleOpenAiClear} disabled={isOpenAiTesting || !hasOpenAiKey} className="h-8 text-xs font-bold">
                Clear Key
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 3. Ollama Local AI Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('ollama')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">
              Ollama (Local LLM Engine)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Offline local models (Llama 3.1, Gemma 3, Qwen 2.5, Mistral)
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['translation']} />
          </div>
          <div className="flex items-center gap-2">
            {hasOllamaConfig ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Disconnected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('ollama');
              }}
            >
              {expandedCards.ollama ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedCards.ollama && (
          <CardContent className="space-y-4 pt-0 text-xs">
            <div className="space-y-3 p-3 rounded-lg border border-border/55 bg-secondary/10">
              {/* Connection URL */}
              <div className="grid gap-1.5">
                <Label htmlFor="ollama-url" className="text-xs font-semibold text-muted-foreground">
                  Connection Base URL
                </Label>
                <Input
                  id="ollama-url"
                  type="text"
                  placeholder="http://localhost:11434"
                  value={ollamaUrlInput}
                  onChange={(e) => setOllamaUrlInput(e.target.value)}
                  className="h-9 text-xs font-mono bg-background/50 border-border/80"
                />
              </div>

              {/* Discovery Action */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Model Organization
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleFetchOllamaModels}
                  disabled={isOllamaFetching}
                  className="h-7 text-[11px] font-bold gap-1.5 px-2.5 text-primary border-primary/30 hover:bg-primary/10"
                >
                  <RefreshCw className={`h-3 w-3 ${isOllamaFetching ? 'animate-spin' : ''}`} />
                  Refresh Installed Models
                </Button>
              </div>

              {/* 1. Translation Models Category */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <Label htmlFor="ollama-translation-model" className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" /> Translation Models
                </Label>
                {categorizedOllama.translationModels.length > 0 ? (
                  <select
                    id="ollama-translation-model"
                    value={ollamaModelInput}
                    onChange={(e) => setOllamaModelInput(e.target.value)}
                    className="h-9 text-xs font-mono bg-background/80 border border-border/80 rounded-md px-3 text-foreground w-full"
                  >
                    {categorizedOllama.translationModels.map((m) => (
                      <option key={m} value={m}>
                        ▼ {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="ollama-translation-model"
                    type="text"
                    placeholder="llama3.1 (or click Refresh Installed Models)"
                    value={ollamaModelInput}
                    onChange={(e) => setOllamaModelInput(e.target.value)}
                    className="h-9 text-xs font-mono bg-background/50 border-border/80"
                  />
                )}
              </div>

              {/* 2. Additional Installed Models Section */}
              {categorizedOllama.additionalModels.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-muted-foreground" /> Additional Installed Models
                    </span>
                    <Badge variant="secondary" className="text-[10px] font-mono">
                      {categorizedOllama.additionalModels.length} detected
                    </Badge>
                  </div>
                  <p className="text-[10.5px] text-muted-foreground flex items-center gap-1.5 bg-secondary/20 p-2 rounded border border-border/30">
                    <Info className="h-3.5 w-3.5 shrink-0 text-primary" />
                    These models are detected on your Ollama installation but are not currently used by DubbiOvi.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {categorizedOllama.additionalModels.map((m) => (
                      <Badge key={m} variant="outline" className="font-mono text-[10.5px] bg-background/60 py-0.5 px-2">
                        • {m}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Save / Clear Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/40">
                <Button
                  size="sm"
                  onClick={handleOllamaSave}
                  disabled={isOllamaTesting || isOllamaFetching}
                  className="h-8 text-xs font-bold"
                >
                  Save Config
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOllamaTest}
                  disabled={isOllamaTesting || isOllamaFetching}
                  className="h-8 text-xs font-bold gap-1.5"
                >
                  {isOllamaTesting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Testing...
                    </>
                  ) : (
                    'Test Connection'
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleOllamaClear}
                  disabled={isOllamaTesting || isOllamaFetching || !hasOllamaConfig}
                  className="h-8 text-xs font-bold"
                >
                  Clear Config
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* 4. Whisper Local Ecosystem Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('whisper')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">Whisper Local (Offline ASR)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              High-performance offline C++ speech recognition engine (Apple Silicon CoreML & CUDA support)
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['asr']} />
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1 font-semibold">
              <CheckCircle2 className="h-3 w-3" /> Runtime Ready
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('whisper');
              }}
            >
              {expandedCards.whisper ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expandedCards.whisper && (
          <CardContent className="pt-0 p-4 border-t border-border/40 space-y-4">
            <WhisperModelSelector
              onRequestDownload={(filename, size) => {
                if (typeof window !== 'undefined' && (window as any).electron?.downloadEngineModel) {
                  (window as any).electron.downloadEngineModel('whisper', filename);
                  toast({
                    title: 'Downloading Whisper Model',
                    description: `Started downloading ${filename} (${size}).`,
                  });
                }
              }}
            />
          </CardContent>
        )}
      </Card>

      {/* 5. Piper Local Ecosystem Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('piper')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">Piper Local TTS (Offline)</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Fast, local neural text-to-speech engine running 100% offline
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['tts']} />
          </div>
          <div className="flex items-center gap-2">
            {isPiperInstalled ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1 font-semibold">
                <CheckCircle2 className="h-3 w-3" /> Runtime Ready
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px] font-semibold">
                Runtime Not Installed
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('piper');
              }}
            >
              {expandedCards.piper ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expandedCards.piper && (
          <CardContent className="pt-0 p-4 border-t border-border/40 space-y-4">
            {/* Runtime Header Action Bar */}
            <div className="p-3 rounded-lg border bg-secondary/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">Piper Engine Runtime (v1.0.0)</span>
                <span className="text-[11px] text-muted-foreground">
                  {isPiperInstalled
                    ? 'Engine binary is installed and registered in Runtime Framework.'
                    : 'Download native Piper engine binary to run TTS offline.'}
                </span>
              </div>
              {!isPiperInstalled && (
                <Button
                  size="sm"
                  onClick={handleInstallPiperRuntime}
                  disabled={isPiperInstalling}
                  className="h-8 text-xs font-bold gap-1.5 shrink-0"
                >
                  {isPiperInstalling ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Installing...
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5" /> Install Runtime
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Voice Model Management */}
            <PiperModelSelector
              onRequestDownload={async (filename, size, downloadUrl, configUrl) => {
                if (typeof window !== 'undefined' && (window as any).electron?.downloadEngineModel) {
                  toast({
                    title: 'Downloading Voice Package',
                    description: `Started downloading ${filename} (${size}).`,
                  });
                  try {
                    await (window as any).electron.downloadEngineModel('piper', filename, downloadUrl, configUrl);
                    toast({
                      title: 'Voice Package Installed',
                      description: `Successfully downloaded and installed ${filename}.`,
                    });
                  } catch (err: any) {
                    toast({
                      title: 'Download Failed',
                      description: err.message || String(err),
                      variant: 'destructive',
                    });
                  }
                }
              }}
            />
          </CardContent>
        )}
      </Card>

      {/* 6. Local AI Voice Server (OpenAI-Compatible) Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('localTts')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">
              Local AI Voice Server (OpenAI-Compatible)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Offline neural speech server (Kokoro, XTTS, StyleTTS, Parler, Bark)
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['tts']} />
          </div>
          <div className="flex items-center gap-2">
            {isLocalTtsTesting ? (
              <Badge variant="outline" className="bg-sky-500/10 text-sky-400 border-sky-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <Loader2 className="h-3 w-3 animate-spin text-sky-400" /> Detecting...
              </Badge>
            ) : localTtsStatus.online ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Connected
              </Badge>
            ) : localTtsStatus.errorType === 'TIMEOUT' ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <Clock className="h-3 w-3 text-amber-400" /> Connection Timeout
              </Badge>
            ) : localTtsStatus.errorType === 'SERVER_ERROR' ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Invalid Endpoint
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Server Offline
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('localTts');
              }}
            >
              {expandedCards.localTts ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {expandedCards.localTts && (
          <CardContent className="space-y-4 pt-0 text-xs">
            <LocalAiEngineCenter
              status={localTtsStatus}
              baseUrl={localTtsUrlInput}
              onUrlChange={(url) => setLocalTtsUrlInput(url)}
              onTestConnection={handleTestLocalTts}
              isTesting={isLocalTtsTesting}
              selectedModel={selectedLocalTtsModel}
              onModelSelect={(m) => setSelectedLocalTtsModel(m)}
              selectedVoice={selectedLocalTtsVoice}
              onVoiceSelect={(v) => setSelectedLocalTtsVoice(v)}
            />
          </CardContent>
        )}
      </Card>

      {/* 6. DeepL Ecosystem Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="p-4 sm:p-6 pb-3 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => toggleExpand('deepl')}
        >
          <div className="space-y-1.5">
            <CardTitle className="text-base font-bold text-foreground">
              DeepL Translation
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              API access credentials for high-fidelity machine translation
            </CardDescription>
            <ProviderCapabilityBadges capabilities={['translation']} />
          </div>
          <div className="flex items-center gap-2">
            {hasDeepLKey ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Disconnected
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand('deepl');
              }}
            >
              {expandedCards.deepl ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedCards.deepl && (
          <CardContent className="space-y-4 pt-0 text-xs">
            <div className="space-y-1.5">
              <Label htmlFor="deepl-api-key" className="text-xs font-semibold text-muted-foreground">
                DeepL API Key
              </Label>
              <div className="relative flex items-center">
                <Input
                  id="deepl-api-key"
                  type={showDeepLKey ? 'text' : 'password'}
                  placeholder="DeepL API Key (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx:fx)"
                  value={deepLKeyInput}
                  onChange={(e) => setDeepLKeyInput(e.target.value)}
                  className="pr-10 text-xs font-mono h-9 bg-background/50 border-border/80"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowDeepLKey(!showDeepLKey)}
                >
                  {showDeepLKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleDeepLSave} disabled={isDeepLTesting} className="h-8 text-xs font-bold">
                Save Key
              </Button>
              <Button size="sm" variant="outline" onClick={handleDeepLTest} disabled={isDeepLTesting || !deepLKeyInput.trim()} className="h-8 text-xs font-bold gap-1.5">
                {isDeepLTesting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleDeepLClear} disabled={isDeepLTesting || !hasDeepLKey} className="h-8 text-xs font-bold">
                Clear Key
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

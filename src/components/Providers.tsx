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
} from 'lucide-react';
import { PiperModelSelector } from './PiperModelSelector';

export default function Providers() {
  const { toast } = useToast();
  
  // Gemini State
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isGeminiTesting, setIsGeminiTesting] = useState(false);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isGeminiExpanded, setIsGeminiExpanded] = useState(true);

  // OpenAI State
  const [openAiKeyInput, setOpenAiKeyInput] = useState('');
  const [showOpenAiKey, setShowOpenAiKey] = useState(false);
  const [isOpenAiTesting, setIsOpenAiTesting] = useState(false);
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false);

  // DeepL State
  const [deepLKeyInput, setDeepLKeyInput] = useState('');
  const [showDeepLKey, setShowDeepLKey] = useState(false);
  const [isDeepLTesting, setIsDeepLTesting] = useState(false);
  const [hasDeepLKey, setHasDeepLKey] = useState(false);

  // Ollama State
  const [ollamaUrlInput, setOllamaUrlInput] = useState('http://localhost:11434');
  const [ollamaModelInput, setOllamaModelInput] = useState('');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [isOllamaTesting, setIsOllamaTesting] = useState(false);
  const [isOllamaFetching, setIsOllamaFetching] = useState(false);
  const [hasOllamaConfig, setHasOllamaConfig] = useState(false);

  // Piper Local TTS State
  const [isPiperExpanded, setIsPiperExpanded] = useState(true);
  const [isPiperInstalled, setIsPiperInstalled] = useState(false);
  const [isPiperInstalling, setIsPiperInstalling] = useState(false);

  const checkPiperRuntime = async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.checkEngineBinary) {
      try {
        const res = await (window as any).electron.checkEngineBinary('piper');
        setIsPiperInstalled(!!res?.installed);
      } catch (err) {
        console.error('[Providers] Error checking Piper runtime:', err);
      }
    }
  };

  const handleInstallPiperRuntime = async () => {
    if (typeof window !== 'undefined' && (window as any).electron?.downloadEngineBinary) {
      setIsPiperInstalling(true);
      try {
        await (window as any).electron.downloadEngineBinary('piper');
        setIsPiperInstalled(true);
        toast({
          title: 'Piper Runtime Installed',
          description: 'Successfully installed Piper Neural TTS runtime.',
        });
      } catch (err: any) {
        toast({
          title: 'Runtime Download Failed',
          description: err.message || String(err),
          variant: 'destructive',
        });
      } finally {
        setIsPiperInstalling(false);
      }
    }
  };

  // Placeholders Expansion States
  const [expandedProviders, setExpandedProviders] = useState<{ [key: string]: boolean }>({
    openai: false,
    deepl: false,
    ollama: false,
  });

  useEffect(() => {
    checkPiperRuntime();
    const savedGemini = loadApiKey() || '';
    setGeminiKeyInput(savedGemini);
    setHasGeminiKey(!!savedGemini);

    const savedOpenAi = loadOpenAiApiKey() || '';
    setOpenAiKeyInput(savedOpenAi);
    setHasOpenAiKey(!!savedOpenAi);

    const savedDeepL = loadDeepLApiKey() || '';
    setDeepLKeyInput(savedDeepL);
    setHasDeepLKey(!!savedDeepL);

    const savedOllama = loadOllamaConfig();
    if (savedOllama.url) setOllamaUrlInput(savedOllama.url);
    if (savedOllama.model) setOllamaModelInput(savedOllama.model);
    setHasOllamaConfig(!!(savedOllama.url && savedOllama.model));
  }, []);

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
      title: 'Gemini API Key Saved',
      description: 'Your Gemini API Key has been saved locally.',
    });
  };

  const handleGeminiClear = () => {
    clearApiKey();
    setGeminiKeyInput('');
    setHasGeminiKey(false);
    toast({
      title: 'Gemini API Key Cleared',
      description: 'Your Gemini API Key has been removed from local storage.',
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
          description: 'Gemini API Key is valid and working.',
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: res.error || 'Invalid Gemini API Key or connection timeout.',
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
    setHasOllamaConfig(!!(url && model));
    toast({
      title: 'Ollama Configuration Saved',
      description: `Targeting ${url}${model ? ` with model '${model}'` : ''}.`,
    });
  };

  const handleOllamaClear = () => {
    clearOllamaConfig();
    setOllamaUrlInput('http://localhost:11434');
    setOllamaModelInput('');
    setOllamaModels([]);
    setHasOllamaConfig(false);
    toast({
      title: 'Ollama Configuration Cleared',
      description: 'Ollama connection settings have been reset.',
    });
  };

  const handleFetchOllamaModels = async () => {
    const url = ollamaUrlInput.trim() || 'http://localhost:11434';
    setIsOllamaFetching(true);
    try {
      const res = await fetchOllamaModelsAction(url);
      if (res.success && res.models.length > 0) {
        setOllamaModels(res.models);
        if (!ollamaModelInput && res.models.length > 0) {
          setOllamaModelInput(res.models[0]);
        }
        toast({
          title: 'Models Discovered',
          description: `Found ${res.models.length} installed model(s) in Ollama daemon.`,
        });
      } else if (res.success && res.models.length === 0) {
        toast({
          title: 'No Models Installed',
          description: 'Ollama is running, but no models were found. Run `ollama pull llama3:8b` in your terminal.',
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
        // Auto-fetch models on successful test
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

  const toggleExpand = (provider: string) => {
    setExpandedProviders((prev) => ({
      ...prev,
      [provider]: !prev[provider],
    }));
  };

  return (
    <div className="space-y-4">
      {/* Gemini Provider Card (Fully Functional) */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Key className="h-4 w-4 text-primary" /> Gemini (Google AI Studio)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure your cloud transcription & translation key
            </CardDescription>
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
              onClick={() => setIsGeminiExpanded(!isGeminiExpanded)}
            >
              {isGeminiExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>

        {isGeminiExpanded && (
          <CardContent className="space-y-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="gemini-key" className="text-xs font-semibold text-muted-foreground">Gemini API Key</Label>
              <div className="relative flex items-center">
                <Input
                  id="gemini-key"
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="Enter your Gemini API Key..."
                  value={geminiKeyInput}
                  onChange={(e) => setGeminiKeyInput(e.target.value)}
                  className="pr-10 w-full h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0.5 hover:bg-transparent h-8 w-8"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                >
                  {showGeminiKey ? (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-border/50 bg-secondary/15 p-2.5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h4 className="text-[11px] font-bold text-foreground">Need a Gemini API Key?</h4>
                <p className="text-[10px] text-muted-foreground leading-normal">
                  Get a free Gemini API Key from Google AI Studio.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="shrink-0 h-7 text-[10px] font-bold">
                <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer">
                  Get API Key
                </a>
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={handleGeminiSave} disabled={isGeminiTesting} className="h-8 text-xs font-bold">
                Save API Key
              </Button>
              <Button size="sm" variant="outline" onClick={handleGeminiTest} disabled={isGeminiTesting || !geminiKeyInput.trim()} className="h-8 text-xs font-bold">
                {isGeminiTesting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  'Test Connection'
                )}
              </Button>
              <Button size="sm" variant="secondary" onClick={handleGeminiClear} disabled={isGeminiTesting || !hasGeminiKey} className="h-8 text-xs font-bold">
                Clear Key
              </Button>
            </div>

            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/35 text-[10px] text-muted-foreground border border-border/50">
              <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
              <div className="leading-relaxed space-y-1">
                <p>Your Gemini API Key is stored safely on your device in local storage.</p>
                <p>DubbiOvi does not transmit API keys to any external servers other than directly to Google API endpoints.</p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* OpenAI Card (Fully Functional) */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Key className="h-4 w-4 text-primary" /> OpenAI (Whisper Cloud & GPT)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure your cloud Whisper transcription & GPT API key
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasOpenAiKey ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Not Configured
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand('openai')}
            >
              {expandedProviders.openai ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedProviders.openai && (
          <CardContent className="space-y-4 pt-0 text-xs">
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
                  className="pr-10 text-xs font-mono h-9 bg-background/50 border-border/80 focus-visible:ring-primary"
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Testing...
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

      {/* DeepL Card (Fully Functional) */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Key className="h-4 w-4 text-primary" /> DeepL Translation
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              API access credentials for high-fidelity machine translation
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasDeepLKey ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Not Configured
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand('deepl')}
            >
              {expandedProviders.deepl ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedProviders.deepl && (
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
                  className="pr-10 text-xs font-mono h-9 bg-background/50 border-border/80 focus-visible:ring-primary"
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    Testing...
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


      {/* Ollama Local AI Card (Fully Functional) */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Key className="h-4 w-4 text-primary" /> Ollama (Local LLM Engine)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Offline local models (Llama 3, Qwen 2.5, DeepSeek R1, Mistral, Gemma 2)
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {hasOllamaConfig ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Configured
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/20 gap-1 px-2 py-0.5 text-[10px] font-bold">
                <AlertTriangle className="h-3 w-3 text-amber-400" /> Not Configured
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => toggleExpand('ollama')}
            >
              {expandedProviders.ollama ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        {expandedProviders.ollama && (
          <CardContent className="space-y-4 pt-0 text-xs">
            <div className="space-y-3 p-3 rounded-lg border border-border/55 bg-secondary/10">
              <div className="grid gap-1.5">
                <Label htmlFor="ollama-url" className="text-xs font-semibold text-muted-foreground">
                  Ollama Connection Base URL
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

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ollama-model" className="text-xs font-semibold text-muted-foreground">
                    Active Model Name
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleFetchOllamaModels}
                    disabled={isOllamaFetching}
                    className="h-6 text-[10px] font-bold gap-1 px-2 text-primary"
                  >
                    <RefreshCw className={`h-3 w-3 ${isOllamaFetching ? 'animate-spin' : ''}`} />
                    Refresh Models
                  </Button>
                </div>
                {ollamaModels.length > 0 ? (
                  <select
                    id="ollama-model"
                    value={ollamaModelInput}
                    onChange={(e) => setOllamaModelInput(e.target.value)}
                    className="h-9 text-xs font-mono bg-background/80 border border-border/80 rounded-md px-3 text-foreground"
                  >
                    {ollamaModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    id="ollama-model"
                    type="text"
                    placeholder="llama3:8b (or click Refresh Models)"
                    value={ollamaModelInput}
                    onChange={(e) => setOllamaModelInput(e.target.value)}
                    className="h-9 text-xs font-mono bg-background/50 border-border/80"
                  />
                )}
              </div>

              <div className="flex items-center gap-2 pt-1">
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
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      Testing...
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

      {/* Piper Local TTS Provider Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader
          className="py-3 px-4 flex flex-row items-center justify-between cursor-pointer select-none hover:bg-secondary/10 transition-colors"
          onClick={() => setIsPiperExpanded(!isPiperExpanded)}
        >
          <div className="flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold text-foreground">Piper Local TTS (Offline)</CardTitle>
              <CardDescription className="text-[11px] text-muted-foreground">
                Fast, local neural text-to-speech engine running 100% offline
              </CardDescription>
            </div>
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
            {isPiperExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {isPiperExpanded && (
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
              onRequestDownload={(filename, size) => {
                if (typeof window !== 'undefined' && (window as any).electron?.downloadEngineModel) {
                  (window as any).electron.downloadEngineModel('piper', filename);
                  toast({
                    title: 'Downloading Voice Model',
                    description: `Started downloading ${filename} (${size}).`,
                  });
                }
              }}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
}

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
} from '@/lib/apiKeyStorage';
import { testGeminiConnection, testDeepLConnection } from '@/app/actions';
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
} from 'lucide-react';

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

  // Placeholders Expansion States
  const [expandedProviders, setExpandedProviders] = useState<{ [key: string]: boolean }>({
    openai: false,
    deepl: false,
    ollama: false,
  });

  useEffect(() => {
    const savedGemini = loadApiKey() || '';
    setGeminiKeyInput(savedGemini);
    setHasGeminiKey(!!savedGemini);

    const savedOpenAi = loadOpenAiApiKey() || '';
    setOpenAiKeyInput(savedOpenAi);
    setHasOpenAiKey(!!savedOpenAi);

    const savedDeepL = loadDeepLApiKey() || '';
    setDeepLKeyInput(savedDeepL);
    setHasDeepLKey(!!savedDeepL);
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


      {/* Ollama Local AI Placeholder Card */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
              <Key className="h-4 w-4 text-muted-foreground" /> Ollama (Local AI Engine)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Offline local models for translation & transcription
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-secondary text-muted-foreground border-border gap-1 px-2 py-0.5 text-[10px] font-bold">
              Not Configured
            </Badge>
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
                <Label htmlFor="ollama-url" className="text-[11px] font-bold text-muted-foreground">Ollama Connection URL</Label>
                <Input id="ollama-url" placeholder="http://localhost:11434" disabled className="h-8 text-xs bg-secondary/20" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ollama-model" className="text-[11px] font-bold text-muted-foreground">Active Model Name</Label>
                <Input id="ollama-model" placeholder="llama3:8b" disabled className="h-8 text-xs bg-secondary/20" />
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" disabled className="h-8 font-bold text-xs">Save Configuration</Button>
                <Button size="sm" variant="outline" disabled className="h-8 font-bold text-xs">Test Connection</Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

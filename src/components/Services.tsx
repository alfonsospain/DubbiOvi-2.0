'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Cloud, Cpu, Keyboard, Shuffle, ArrowDown, CheckCircle2 } from 'lucide-react';

interface ServicesProps {
  workflowMode: string;
  setWorkflowMode: (mode: string) => void;
  transcriptionProvider: string;
  setTranscriptionProvider: (prov: string) => void;
  translationProvider: string;
  setTranslationProvider: (prov: string) => void;
  speechProvider: string;
  setSpeechProvider: (prov: string) => void;
}

const Services: React.FC<ServicesProps> = ({
  workflowMode,
  setWorkflowMode,
  transcriptionProvider,
  setTranscriptionProvider,
  translationProvider,
  setTranslationProvider,
  speechProvider,
  setSpeechProvider,
}) => {
  const isTranscriptionActive = transcriptionProvider !== 'None';
  const isTranslationActive = translationProvider !== 'None';
  const isSpeechActive = speechProvider !== 'None';

  const workflowOptions = [
    {
      id: 'manual',
      name: 'Manual',
      description: 'Human translation & timing without automation.',
      icon: Keyboard,
    },
    {
      id: 'cloud',
      name: 'Cloud',
      description: 'Ultra-fast API services (Gemini, OpenAI, DeepL).',
      icon: Cloud,
    },
    {
      id: 'local',
      name: 'Local',
      description: 'Offline local models (Whisper, Ollama).',
      icon: Cpu,
    },
    {
      id: 'hybrid',
      name: 'Hybrid',
      description: 'Combine local transcription with cloud translation.',
      icon: Shuffle,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Workflow Mode Selector */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">Workflow Mode</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Select the operational style for orchestration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3">
            {workflowOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = workflowMode === opt.id;
              return (
                <div
                  key={opt.id}
                  onClick={() => setWorkflowMode(opt.id)}
                  className={`flex flex-col items-start p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 select-none ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                      : 'border-border/60 hover:border-border hover:bg-secondary/20'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    />
                    <span className="text-xs font-bold text-foreground">{opt.name}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground leading-normal">
                    {opt.description}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Services Stage Providers */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold text-foreground">Services Stages</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Choose which AI Platform performs each workflow stage (model selection is configured in AI Platforms tab)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Transcription Stage */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="transcription-prov" className="text-xs font-semibold text-muted-foreground">
                Transcription Provider (ASR)
              </Label>
              {isTranscriptionActive && (
                <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  <CheckCircle2 className="h-3 w-3 text-primary" /> Active
                </span>
              )}
            </div>
            <Select
              value={transcriptionProvider}
              onValueChange={setTranscriptionProvider}
            >
              <SelectTrigger
                id="transcription-prov"
                className={`h-9 text-xs transition-all duration-200 ${
                  isTranscriptionActive
                    ? 'border-primary/60 bg-primary/5 text-foreground font-semibold shadow-sm focus:ring-primary/40'
                    : 'border-border/80'
                }`}
              >
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Whisper Local">Whisper Local (Offline)</SelectItem>
                <SelectItem value="Gemini">Gemini (Google Cloud)</SelectItem>
                <SelectItem value="OpenAI">OpenAI (Cloud Whisper)</SelectItem>
                <SelectItem value="None">None (Manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Translation Stage */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="translation-prov" className="text-xs font-semibold text-muted-foreground">
                Translation Provider (MT)
              </Label>
              {isTranslationActive && (
                <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  <CheckCircle2 className="h-3 w-3 text-primary" /> Active
                </span>
              )}
            </div>
            <Select
              value={translationProvider}
              onValueChange={setTranslationProvider}
            >
              <SelectTrigger
                id="translation-prov"
                className={`h-9 text-xs transition-all duration-200 ${
                  isTranslationActive
                    ? 'border-primary/60 bg-primary/5 text-foreground font-semibold shadow-sm focus:ring-primary/40'
                    : 'border-border/80'
                }`}
              >
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Gemini">Gemini (Google Cloud)</SelectItem>
                <SelectItem value="DeepL">DeepL (Cloud API)</SelectItem>
                <SelectItem value="OpenAI">OpenAI (Cloud GPT)</SelectItem>
                <SelectItem value="Ollama">Ollama (Local LLM)</SelectItem>
                <SelectItem value="None">None (Manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Speech Stage */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="speech-prov" className="text-xs font-semibold text-muted-foreground">
                Speech Provider (TTS)
              </Label>
              {isSpeechActive && (
                <span className="text-[10px] font-bold text-primary flex items-center gap-1 bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                  <CheckCircle2 className="h-3 w-3 text-primary" /> Active
                </span>
              )}
            </div>
            <Select
              value={speechProvider}
              onValueChange={setSpeechProvider}
            >
              <SelectTrigger
                id="speech-prov"
                className={`h-9 text-xs transition-all duration-200 ${
                  isSpeechActive
                    ? 'border-primary/60 bg-primary/5 text-foreground font-semibold shadow-sm focus:ring-primary/40'
                    : 'border-border/80'
                }`}
              >
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Piper Local TTS">Piper Local TTS (Offline)</SelectItem>
                <SelectItem value="Google TTS">Google Speech Synthesis</SelectItem>
                <SelectItem value="OpenAI">OpenAI Audio TTS</SelectItem>
                <SelectItem value="Ollama">Ollama (Local TTS)</SelectItem>
                <SelectItem value="None">None (Manual)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Visual Pipeline Preview */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-2 bg-secondary/10">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Pipeline Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-5 flex flex-col items-center gap-1.5">
          {/* Video Node */}
          <div className="flex items-center justify-center bg-secondary/60 text-secondary-foreground text-xs font-semibold px-4 py-1.5 rounded-full border border-border/80 min-w-[150px] text-center shadow-sm">
            🎬 Video
          </div>

          <ArrowDown className="h-4 w-4 text-muted-foreground/60 animate-pulse" />

          {/* Transcription Node */}
          <div
            className={`flex flex-col items-center justify-center text-xs font-medium px-4 py-2 rounded-lg border min-w-[180px] text-center transition-all duration-200 ${
              isTranscriptionActive
                ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/5'
                : 'border-border/80 bg-background text-foreground'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Transcription
              </span>
              {isTranscriptionActive && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </div>
            <span
              className={`font-semibold mt-0.5 ${
                isTranscriptionActive ? 'text-primary font-bold' : 'text-foreground'
              }`}
            >
              {transcriptionProvider === 'None' ? '✍️ Manual' : `🎙️ ${transcriptionProvider}`}
            </span>
          </div>

          <ArrowDown className="h-4 w-4 text-muted-foreground/60 animate-pulse" />

          {/* Translation Node */}
          <div
            className={`flex flex-col items-center justify-center text-xs font-medium px-4 py-2 rounded-lg border min-w-[180px] text-center transition-all duration-200 ${
              isTranslationActive
                ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/5'
                : 'border-border/80 bg-background text-foreground'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Translation
              </span>
              {isTranslationActive && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </div>
            <span
              className={`font-semibold mt-0.5 ${
                isTranslationActive ? 'text-primary font-bold' : 'text-foreground'
              }`}
            >
              {translationProvider === 'None' ? '✍️ Manual' : `🌐 ${translationProvider}`}
            </span>
          </div>

          <ArrowDown className="h-4 w-4 text-muted-foreground/60 animate-pulse" />

          {/* Speech Node */}
          <div
            className={`flex flex-col items-center justify-center text-xs font-medium px-4 py-2 rounded-lg border min-w-[180px] text-center transition-all duration-200 ${
              isSpeechActive
                ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm shadow-primary/5'
                : 'border-border/80 bg-background text-foreground'
            }`}
          >
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                Speech (TTS)
              </span>
              {isSpeechActive && <CheckCircle2 className="h-3 w-3 text-primary" />}
            </div>
            <span
              className={`font-semibold mt-0.5 ${
                isSpeechActive ? 'text-primary font-bold' : 'text-foreground'
              }`}
            >
              {speechProvider === 'None' ? '✍️ Manual' : `🔊 ${speechProvider}`}
            </span>
          </div>

          <ArrowDown className="h-4 w-4 text-muted-foreground/60 animate-pulse" />

          {/* Export Node */}
          <div className="flex items-center justify-center bg-primary/10 text-primary border border-primary/20 text-xs font-bold px-4 py-1.5 rounded-full min-w-[150px] text-center shadow-sm">
            📦 Export
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Services;

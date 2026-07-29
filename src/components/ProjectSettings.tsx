'use client';

import React from 'react';
import type { ProjectSettings, Take } from '@/lib/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { LanguageRegistry } from '@/lib/languages/LanguageRegistry';
import { formatTimeForDisplay } from '@/lib/utils';
import { FileVideo, BarChart2, Save, UserCheck, Shield, Palette, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';

interface ProjectSettingsProps {
  settings: ProjectSettings;
  onSettingsChange: (settings: ProjectSettings) => void;
  videoFile?: File | null;
  videoDuration?: number;
  takes?: Take[];
}

const ProjectSettingsComponent: React.FC<ProjectSettingsProps> = ({
  settings,
  onSettingsChange,
  videoFile = null,
  videoDuration = 0,
  takes = [],
}) => {
  const { theme, setTheme } = useTheme();
  const allLanguages = LanguageRegistry.getAllLanguages();

  const handleChange = (field: keyof ProjectSettings, value: string) => {
    if (field === 'projectName') {
      onSettingsChange({ ...settings, projectName: value, title: value });
    } else {
      onSettingsChange({ ...settings, [field]: value });
    }
  };

  // Compute statistics
  const totalTakes = takes.length;
  const pendingCount = takes.filter(t => t.status === 'Pending').length;
  const reviewedCount = takes.filter(t => t.status === 'Reviewed').length;
  const lockedCount = takes.filter(t => t.status === 'Locked').length;

  const originalWordCount = takes.reduce((sum, t) => {
    const text = t.original || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return sum + words;
  }, 0);

  const translationWordCount = takes.reduce((sum, t) => {
    const text = t.translation || '';
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return sum + words;
  }, 0);

  const pendingPercentage = totalTakes ? Math.round((pendingCount / totalTakes) * 100) : 0;
  const reviewedPercentage = totalTakes ? Math.round((reviewedCount / totalTakes) * 100) : 0;
  const lockedPercentage = totalTakes ? Math.round((lockedCount / totalTakes) * 100) : 0;

  // Normalized values for select components
  const normalizedSource = LanguageRegistry.getLanguageByCode(settings.sourceLang)?.code.toUpperCase() || settings.sourceLang;
  const normalizedTarget = LanguageRegistry.getLanguageByCode(settings.targetLang)?.code.toUpperCase() || settings.targetLang;

  return (
    <div className="space-y-6">
      {/* Project Metadata */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <UserCheck className="h-4 w-4 text-primary" /> Project Metadata
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Manage your project's basic properties and settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="projectName" className="text-xs font-semibold text-muted-foreground">Project Name</Label>
            <Input
              id="projectName"
              type="text"
              value={settings.projectName || settings.title || ''}
              onChange={e => handleChange('projectName', e.target.value)}
              className="w-full h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="translator" className="text-xs font-semibold text-muted-foreground">Translator</Label>
              <Input
                id="translator"
                type="text"
                value={settings.translator || ''}
                onChange={e => handleChange('translator', e.target.value)}
                className="w-full h-9 text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="institution" className="text-xs font-semibold text-muted-foreground">Institution</Label>
              <Input
                id="institution"
                type="text"
                placeholder="University / Organization"
                value={settings.institution || ''}
                onChange={e => handleChange('institution', e.target.value)}
                className="w-full h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="client" className="text-xs font-semibold text-muted-foreground">Client / Publisher</Label>
            <Input
              id="client"
              type="text"
              placeholder="Target publisher or production house"
              value={settings.client || ''}
              onChange={e => handleChange('client', e.target.value)}
              className="w-full h-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="source-lang" className="text-xs font-semibold text-muted-foreground">Source Language</Label>
              <Select
                value={normalizedSource}
                onValueChange={value => handleChange('sourceLang', value)}
              >
                <SelectTrigger id="source-lang" className="h-9 text-xs">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {allLanguages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code.toUpperCase()}>
                      {LanguageRegistry.formatDisplay(lang.code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="target-lang" className="text-xs font-semibold text-muted-foreground">Target Language</Label>
              <Select
                value={normalizedTarget}
                onValueChange={value => handleChange('targetLang', value)}
              >
                <SelectTrigger id="target-lang" className="h-9 text-xs">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  {allLanguages.map(lang => (
                    <SelectItem key={lang.code} value={lang.code.toUpperCase()}>
                      {LanguageRegistry.formatDisplay(lang.code)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance Section */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Customize the look and feel of DubbiOvi for your workspace environment.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground">Theme</Label>
          <RadioGroup
            value={theme}
            onValueChange={(val) => setTheme(val as 'dark' | 'light')}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="dark" id="theme-dark" className="peer sr-only" />
              <Label
                htmlFor="theme-dark"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Moon className="mb-2 h-5 w-5 text-primary" />
                <span className="text-xs font-semibold text-foreground">🌙 Dark</span>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="light" id="theme-light" className="peer sr-only" />
              <Label
                htmlFor="theme-light"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent/10 hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Sun className="mb-2 h-5 w-5 text-amber-500" />
                <span className="text-xs font-semibold text-foreground">☀️ Light</span>
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Video Information */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <FileVideo className="h-4 w-4 text-primary" /> Video Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="text-muted-foreground">File Name</span>
            <span className="font-semibold text-foreground max-w-[200px] truncate">
              {videoFile ? videoFile.name : 'No video file loaded'}
            </span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-semibold text-foreground">
              {videoDuration ? formatTimeForDisplay(videoDuration) : '00:00.000'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Project Statistics */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <BarChart2 className="h-4 w-4 text-primary" /> Project Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-secondary/20 rounded-lg border border-border/40 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Total Takes</span>
              <p className="text-xl font-bold text-foreground mt-1">{totalTakes}</p>
            </div>
            <div className="p-3 bg-secondary/20 rounded-lg border border-border/40 text-center">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Word Count</span>
              <p className="text-sm font-semibold text-foreground mt-1">Src: {originalWordCount}</p>
              <p className="text-sm font-semibold text-foreground">Tgt: {translationWordCount}</p>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-slate-900 dark:text-amber-400 font-bold">Pending</span>
                <span className="text-foreground">{pendingCount} ({pendingPercentage}%)</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pendingPercentage}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-blue-400">Reviewed</span>
                <span className="text-foreground">{reviewedCount} ({reviewedPercentage}%)</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${reviewedPercentage}%` }} />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[11px] font-medium">
                <span className="text-emerald-400">Locked</span>
                <span className="text-foreground">{lockedCount} ({lockedPercentage}%)</span>
              </div>
              <div className="h-1.5 w-full bg-secondary/40 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${lockedPercentage}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Autosave Status */}
      <Card className="border-border/60 bg-card/50 backdrop-blur-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
            <Save className="h-4 w-4 text-primary" /> Autosave Status
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs flex items-start gap-2 text-muted-foreground">
          <Shield className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <p className="font-semibold text-foreground mb-0.5">Autosave is Active</p>
            <p>Your work is dynamically synchronized with LocalStorage after every edit, split, merge, or import action.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectSettingsComponent;

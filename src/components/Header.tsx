'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarTrigger,
  MenubarSeparator,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@/components/ui/menubar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  FolderOpen,
  FileSpreadsheet,
  FileText,
  Plus,
  Save,
  HelpCircle,
  Copy,
  ExternalLink,
  Mail,
  Github,
  BookMarked,
  BookOpen,
  Globe,
  LogOut,
  FileCode,
} from 'lucide-react';
import { DubbiOviLogo } from './DubbiOviLogo';

interface HeaderProps {
  projectName: string;
  onNewProject: () => void;
  onOpenProject: (projectData: any, filePath: string | null) => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onExportExcel: () => void;
  onExportCSV: () => void;
  onExportWordSource: () => void;
  onExportWordTarget: () => void;
  onExportWordBoth: () => void;
  onExportGlossaryCSV: () => void;
  onExportGlossaryXLSX: () => void;
  onExportGlossaryJSON: () => void;
  onExportSRT: () => void;
  onExportVTT: () => void;
  onExportJSON: () => void;
  onImportClick: () => void;
  isDetached?: boolean;
  onDockVideo?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  projectName,
  onNewProject,
  onOpenProject,
  onSaveProject,
  onSaveProjectAs,
  onExportExcel,
  onExportCSV,
  onExportWordSource,
  onExportWordTarget,
  onExportWordBoth,
  onExportGlossaryCSV,
  onExportGlossaryXLSX,
  onExportGlossaryJSON,
  onExportSRT,
  onExportVTT,
  onExportJSON,
  onImportClick,
  isDetached = false,
  onDockVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const projectData = JSON.parse(event.target?.result as string);
          const filePath = (file as any).path || null;
          onOpenProject(projectData, filePath);
        } catch (err) {
          console.error(err);
          toast({
            title: 'Failed to Open Project',
            description: 'Invalid project format or corrupt file.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyCitation = () => {
    const citationText = `Rodríguez Fernández-Peña, A. C. (2026). DubbiOvi (Version 2.0.0 Workstation Edition). Alfonso Digital Lab, University of Oviedo. https://doi.org/10.5281/zenodo.XXXXX`;
    navigator.clipboard.writeText(citationText)
      .then(() => {
        toast({
          title: 'Citation Copied',
          description: 'Academic citation has been copied to your clipboard.',
        });
      })
      .catch(err => {
        console.error(err);
      });
  };

  const handleExit = () => {
    const isElectron = typeof window !== 'undefined' && (window as any).electron !== undefined;
    if (isElectron) {
      window.close();
    } else {
      if (confirm('Are you sure you want to exit? In standard browsers, this closes or redirects the current tab.')) {
        window.close();
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[#26355B] bg-[#0E1730] text-slate-100 px-4 sm:px-6 shadow-md">
      <DubbiOviLogo className="mr-2" />

      {/* Hidden input for project loading */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".dubbiovi"
        className="hidden"
      />

      {/* Top-Level Menubar */}
      <Menubar className="border-none bg-transparent h-auto p-0 gap-1 flex shrink-0">
        <MenubarMenu>
          <MenubarTrigger className="cursor-pointer hover:bg-[#13203D] text-[#A7B3D1] hover:text-white text-sm font-medium px-3 py-1 rounded-sm data-[state=open]:bg-[#13203D] data-[state=open]:text-white transition-colors">File</MenubarTrigger>
          <MenubarContent className="min-w-[14rem]">
            <MenubarItem onClick={onNewProject} className="cursor-pointer gap-2 text-xs">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" /> New Project
            </MenubarItem>
            <MenubarItem onClick={() => fileInputRef.current?.click()} className="cursor-pointer gap-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> Open Project...
            </MenubarItem>
            <MenubarItem onClick={onSaveProject} className="cursor-pointer gap-2 text-xs">
              <Save className="h-3.5 w-3.5 text-muted-foreground" /> Save Project
            </MenubarItem>
            <MenubarItem onClick={onSaveProjectAs} className="cursor-pointer gap-2 text-xs">
              <Save className="h-3.5 w-3.5 text-muted-foreground" /> Save Project As...
            </MenubarItem>
            <MenubarSeparator />
            
            <MenubarItem onClick={onImportClick} className="cursor-pointer gap-2 text-xs">
              <FolderOpen className="h-3.5 w-3.5 text-primary" /> Import Data...
            </MenubarItem>
            
            <MenubarSub>
              <MenubarSubTrigger className="cursor-pointer gap-2 text-xs focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground">
                <FolderOpen className="h-3.5 w-3.5 text-green-500" /> Export Data
              </MenubarSubTrigger>
              <MenubarSubContent className="min-w-[13rem]">
                <MenubarItem onClick={onExportWordSource} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-blue-400" /> Word: Source Text
                </MenubarItem>
                <MenubarItem onClick={onExportWordTarget} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-green-400" /> Word: Target Text
                </MenubarItem>
                <MenubarItem onClick={onExportWordBoth} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-purple-400" /> Word: Both Texts
                </MenubarItem>
                <MenubarItem onClick={onExportExcel} className="cursor-pointer gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" /> Excel Worksheet
                </MenubarItem>
                <MenubarItem onClick={onExportCSV} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-blue-500" /> CSV File
                </MenubarItem>
                <MenubarItem onClick={onSaveProjectAs} className="cursor-pointer gap-2 text-xs">
                  <Save className="h-3.5 w-3.5 text-indigo-400" /> Project (.dubbiovi)
                </MenubarItem>
                <MenubarItem onClick={onExportSRT} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-orange-500" /> SRT Subtitles
                </MenubarItem>
                <MenubarItem onClick={onExportVTT} className="cursor-pointer gap-2 text-xs">
                  <FileText className="h-3.5 w-3.5 text-cyan-400" /> WebVTT Subtitles
                </MenubarItem>
                <MenubarSeparator />
                <MenubarItem onClick={onExportGlossaryCSV} className="cursor-pointer gap-2 text-xs">
                  <BookMarked className="h-3.5 w-3.5 text-orange-400" /> Export Glossary: CSV
                </MenubarItem>
                <MenubarItem onClick={onExportGlossaryXLSX} className="cursor-pointer gap-2 text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" /> Export Glossary: Excel
                </MenubarItem>
              </MenubarSubContent>
            </MenubarSub>
            
            <MenubarSeparator />
            <MenubarItem onClick={handleExit} className="cursor-pointer gap-2 text-xs text-destructive focus:bg-destructive/10">
              <LogOut className="h-3.5 w-3.5 text-destructive" /> Exit
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger 
            onClick={() => setIsAboutOpen(true)} 
            className="cursor-pointer hover:bg-[#13203D] text-[#A7B3D1] hover:text-white text-sm font-medium px-3 py-1 rounded-sm data-[state=open]:bg-[#13203D] data-[state=open]:text-white transition-colors"
          >
            About
          </MenubarTrigger>
        </MenubarMenu>

        <MenubarMenu>
          <MenubarTrigger className="cursor-pointer hover:bg-[#13203D] text-[#A7B3D1] hover:text-white text-sm font-medium px-3 py-1 rounded-sm data-[state=open]:bg-[#13203D] data-[state=open]:text-white transition-colors">Help</MenubarTrigger>
          <MenubarContent>
            <MenubarItem onClick={() => setIsHelpOpen(true)} className="cursor-pointer gap-2 text-xs">
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /> Help & Contact
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      {/* Center metadata for spacing */}
      <div className="flex-grow" />

      {/* Project Name display on the right */}
      <div className="flex items-center gap-2 text-xs font-medium text-[#A7B3D1] px-3 py-1.5 rounded bg-[#13203D] max-w-[280px] truncate border border-[#26355B] shrink-0">
        <span className="text-[9px] uppercase text-[#A7B3D1]/70 font-bold shrink-0">Project:</span>
        <span className="text-white font-semibold truncate">{projectName}</span>
      </div>

      {isDetached && onDockVideo && (
        <Button
          size="sm"
          variant="destructive"
          onClick={onDockVideo}
          className="h-8 gap-1.5 text-xs font-bold shrink-0"
        >
          <ExternalLink className="h-3.5 w-3.5 rotate-180" /> Dock Video
        </Button>
      )}

      {/* About Modal */}
      <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0 gap-0 overflow-hidden border-border">
          {/* Dedicated Dark Header for Logo Legibility & Official Branding */}
          <div className="bg-[#0b132b] text-white p-5 border-b border-border/20 flex flex-col gap-1 select-none">
            <DialogTitle className="sr-only">About DubbiOvi</DialogTitle>
            <DubbiOviLogo />
            <p className="text-xs font-semibold text-emerald-400/90 mt-1">
              v2.0.0 Workstation Edition (September 2026)
            </p>
          </div>
          <div className="p-6 pt-4 space-y-4 text-xs leading-relaxed">
            <div>
              <span className="font-bold text-muted-foreground text-[10px] uppercase">Description</span>
              <p className="text-foreground mt-0.5">Audiovisual translation environment developed for teaching, research, and professional localization workflows.</p>
            </div>
            <div>
              <span className="font-bold text-muted-foreground text-[10px] uppercase">Developer</span>
              <p className="text-foreground mt-0.5">
                Alfonso C. Rodríguez Fernández-Peña<br />
                Department of English, French and German Philology<br />
                University of Oviedo
              </p>
            </div>
            <div>
              <span className="font-bold text-muted-foreground text-[10px] uppercase">DOI (Digital Object Identifier)</span>
              <p className="text-foreground mt-0.5 flex items-center gap-1.5 font-mono text-[11px]">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">https://doi.org/10.5281/zenodo.XXXXX</span>
                <span className="text-[10px] text-muted-foreground/70 font-sans font-medium">(Pending Zenodo Registration)</span>
              </p>
            </div>
            <div>
              <span className="font-bold text-muted-foreground text-[10px] uppercase">Copyright</span>
              <p className="text-foreground mt-0.5">© Universidad de Oviedo, 2026. All rights reserved.</p>
            </div>
            <div className="p-3 rounded-lg bg-secondary/40 border border-border/60 relative">
              <span className="font-bold text-[9px] text-muted-foreground uppercase tracking-wider block">Suggested Academic Citation</span>
              <pre className="font-mono text-[10.5px] mt-2 text-foreground whitespace-pre-wrap leading-normal font-medium bg-background/50 p-2.5 rounded border border-border/30">
                {`Rodríguez Fernández-Peña, A. C. (2026).\nDubbiOvi (Version 2.0.0 Workstation Edition).\nAlfonso Digital Lab, University of Oviedo.\nhttps://doi.org/10.5281/zenodo.XXXXX`}
              </pre>
              <Button size="sm" variant="secondary" onClick={handleCopyCitation} className="mt-2.5 w-full h-8 gap-1.5 text-xs">
                <Copy className="h-3.5 w-3.5" /> Copy Citation
              </Button>
            </div>
          </div>
          <div className="border-t px-6 pt-3 pb-2 flex flex-col items-center text-[10px] text-muted-foreground text-center space-y-0.5">
            <p>Built with Next.js, TypeScript, Local Storage, and Modular Service Chassis.</p>
            <p className="font-semibold text-foreground/80">University of Oviedo · 2026</p>
          </div>
          <DialogFooter className="px-6 pb-5 pt-2">
            <Button size="sm" onClick={() => setIsAboutOpen(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Help & Contact Modal */}
      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-1.5">
              <HelpCircle className="h-5 w-5 text-primary" /> Help & Contact
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 my-2 text-xs leading-normal">
            <p className="font-semibold text-foreground text-sm">Need help using DubbiOvi?</p>
            <p className="text-muted-foreground">
              For bug reports, feature requests, suggestions, teaching applications, research collaborations or academic partnerships, please contact:
            </p>
            <div className="p-3.5 rounded-lg bg-secondary/35 border border-border/40 space-y-2">
              <p className="font-bold text-foreground">Alfonso C. Rodríguez Fernández-Peña</p>
              <p className="text-muted-foreground">Department of English, French and German Philology</p>
              <p className="text-muted-foreground">University of Oviedo</p>
              <div className="pt-1.5 space-y-1.5 text-foreground font-medium">
                <p className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  Email: <a href="mailto:rodriguezalfonso@uniovi.es" className="text-primary hover:underline">rodriguezalfonso@uniovi.es</a>
                </p>
                <p className="flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                  User Manual: <a href="https://www.dubbiovi.com/manual" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dubbiovi.com/manual</a>
                </p>
                <p className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  Website: <a href="https://www.dubbiovi.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">www.dubbiovi.com</a>
                </p>
                <p className="flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                  DOI: <span className="text-muted-foreground font-mono text-[11px]">https://doi.org/10.5281/zenodo.XXXXX</span>
                </p>
              </div>
            </div>
            <p className="text-muted-foreground italic text-center font-medium mt-1">Thank you for helping improve DubbiOvi.</p>
          </div>
          <DialogFooter>
            <Button size="sm" onClick={() => setIsHelpOpen(false)} className="w-full sm:w-auto">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Header;

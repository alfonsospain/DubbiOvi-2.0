# DubbiOvi 2.0 Workspace UX/UI Proposal (Final)

DubbiOvi is transitioning from an AI-assisted translation tool into a modular audiovisual translation workstation. This document proposes the final workspace architecture redesign to establish the structural chassis for the application's long-term growth.

---

## 1. Workspace Architecture

The right-side workspace interface is organized into 6 specialized tabs:

1. **Takes**: The primary workspace panel. Stays identical in core functionality. Users edit, review, lock/unlock, merge, split, and enter the Timeline Editor from here.
2. **Project**: Centralized project-level metadata (Project Name, Translator Name, **Institution**, **Client**), **Video Information**, **Project Statistics**, and Autosave management. Contains project metadata only.
3. **Services**: Visual configuration of the project workflow: **Transcription**, **Translation**, **Speech (TTS)**, and **Workflow Mode**. Unifies selecting *which* providers are used.
4. **Providers**: Independent panel to configure *how* each provider behaves (credentials, endpoints, global settings). Completely decoupled from workflow orchestration.
5. **Glossary**: The term bank management panel. Stays identical in core functionality.
6. **Data**: The centralized exchange hub. Redesigned to separate **Import** and **Export** operations into two clearly distinct, separate visual sections with dedicated action buttons.

---

## 2. Reasoning Behind Every Tab

| Tab Name | Purpose | Rationale |
| :--- | :--- | :--- |
| **Takes** | Core Workspace | Translators spend 90% of their time here. Preserving it ensures no workflow disruption. |
| **Project** | Metadata & Context | Shows high-level project parameters (adding Institution and Client for corporate/academic projects) and real-time project statistics. |
| **Services** | Workflow Orchestration | Maps out the workflow stages. Users select which provider to use for each step. Decoupled from API keys. |
| **Providers** | Integrations & Keys | A dedicated settings area for credentials and endpoints. Avoids cluttering the services tab with technical API input fields. |
| **Glossary** | Translation Aids | Maintains access to key terminology definitions, boosting translation accuracy and consistency. |
| **Data** | IO Hub | Redesigned with distinct Import and Export panels. Unifies all data-exchange operations (Word, Excel, CSV, SRT, VTT, etc.) in a single control center. |

---

## 3. Top "File" Menu

The separate "Project" and "Export" menus are replaced with a single, standard desktop-grade **File** menu in the top header. This unifies app control and is accessible from anywhere:

- **New Project**
- **Open Project...**
- **Save Project**
- **Save Project As...**
- *[Separator]*
- **Import** (Quick navigation to the Data tab's Import section)
- **Export** (Submenu listing all formats: Word, Excel, CSV, Project, SRT, VTT, JSON, Glossary formats)
- *[Separator]*
- **Exit** (Closes the application window safely)

---

## 4. Services Configuration (Simplification)

The **Services** tab allows workflow configuration and provider selection only. Dynamic model configuration is omitted from this tab to simplify the interface:

- **Workflow Mode**: Visual selectable cards (Manual, Cloud, Local, Hybrid).
- **Transcription Provider**: Whisper, Gemini, Ollama, None
- **Translation Provider**: Gemini, DeepL, OpenAI, Ollama, None
- **Speech (TTS) Provider**: Ollama, OpenAI, Google TTS, None

The dynamic flow visualization is user-oriented:
```
Video
  ↓
Transcription (Selected Provider)
  ↓
Translation (Selected Provider)
  ↓
Speech (TTS) (Selected Provider)
  ↓
Export
```

---

## 5. ASCII Wireframes

### A. Project Tab
```
+-------------------------------------------------------------+
| PROJECT METADATA                                            |
+-------------------------------------------------------------+
| Project Name: [ DubbiOvi Redesign                         ] |
| Translator:   [ Alfonso                                   ] |
| Institution:  [ University of Oviedo                      ] |
| Client:       [ Academic Publisher / Self                 ] |
| Source Language: [ English (en)                         ]v|
| Target Language: [ Spanish (es)                         ]v|
+-------------------------------------------------------------+
| VIDEO INFORMATION                                           |
| File Name: video_interview_edit.mp4                         |
| Duration:  04:32.125 (272 seconds)                          |
+-------------------------------------------------------------+
| STATISTICS                                                  |
| Total Takes:  24              Reviewed: 12 (50%)            |
| Locked:       6 (25%)         Pending:  6 (25%)             |
| Words (Src):  1,420 words     Words (Tgt): 1,350 words      |
+-------------------------------------------------------------+
| AUTOSAVE STATUS                                             |
| [X] Enable Autosave to LocalStorage                         |
| Last Saved: 2026-07-16 22:56:47                             |
+-------------------------------------------------------------+
```

### B. Services Tab
```
+-------------------------------------------------------------+
| WORKFLOW CONFIGURATION                                      |
+-------------------------------------------------------------+
| Workflow Mode:                                              |
| +------------+  +------------+  +------------+  +------------+ |
| | [X] Manual |  | [ ] Cloud  |  | [ ] Local  |  | [ ] Hybrid | |
| +------------+  +------------+  +------------+  +------------+ |
+-------------------------------------------------------------+
| STAGES                                                      |
|                                                             |
| Transcription Provider:  [ Whisper (OpenAI)               ]v|
| Translation Provider:    [ Gemini (Google)                ]v|
| Speech (TTS) Provider:   [ None                           ]v|
+-------------------------------------------------------------+
| PIPELINE PREVIEW                                            |
|                                                             |
|                          Video                              |
|                            ↓                                |
|                Transcription (Whisper)                      |
|                            ↓                                |
|                  Translation (Gemini)                       |
|                            ↓                                |
|                     Speech (None)                           |
|                            ↓                                |
|                          Export                             |
+-------------------------------------------------------------+
```

### C. Providers Tab
```
+-------------------------------------------------------------+
| AVAILABLE PROVIDERS & API CREDENTIALS                       |
+-------------------------------------------------------------+
| +---------------------------------------------------------+ |
| | GEMINI (Google AI Studio)                 [ CONFIGURED ] | |
| | Key: ******************     Endpoint: [ Default       ] | |
| | Temp: [ 0.7  ]                                          | |
| | [ Configure ]                               [ Test Link] | |
| +---------------------------------------------------------+ |
| +---------------------------------------------------------+ |
| | OPENAI                                    [ NOT SET    ] | |
| | [ Configure ]                                            | |
| +---------------------------------------------------------+ |
| +---------------------------------------------------------+ |
| | OLLAMA (Local Model Server)               [ ACTIVE     ] | |
| | [ Configure ]                                            | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

### D. Data Tab (Redesigned)
```
+-------------------------------------------------------------+
| DATA PORTING & EXCHANGE                                     |
+-------------------------------------------------------------+
| IMPORT SECTION                                              |
| +---------------------------------------------------------+ |
| | Import Script File (.txt, .docx)                        | |
| | [ Select File to Upload ]                               | |
| |                                                         | |
| | Paste Script Text:                                      | |
| | [                                                     ] | |
| | [ Import Script Text ]                                  | |
| +---------------------------------------------------------+ |
|                                                             |
| EXPORT SECTION                                              |
| +---------------------------------------------------------+ |
| | Export Project/Subtitle/Script Files                    | |
| |                                                         | |
| | • Project (.dubbiovi) -> [ Export File ]  [ Copy JSON ] | |
| | • SRT Subtitles       -> [ Export File ]  [ Copy SRT  ] | |
| | • VTT Subtitles       -> [ Export File ]  [ Copy VTT  ] | |
| | • Word Document       -> [ Export File ]  [ Copy Script]| |
| | • Excel Worksheet     -> [ Export File ]                | |
| | • CSV File            -> [ Export File ]                | |
| +---------------------------------------------------------+ |
+-------------------------------------------------------------+
```

---

## 6. Advantages and Possible Drawbacks

### Advantages:
1. **Desktop Standard UX**: The unified top "File" menu is highly standard and intuitive.
2. **Simplified Services**: Decoupling dynamic model selection keeps the services interface focused on high-level workflow setup.
3. **Structured Data Hub**: Separating Import and Export vertically inside the Data tab prevents data overwrites or incorrect interactions.

### Drawbacks:
1. **Responsive Header Width**: A long File menu can take up space on smaller screens, handled using responsive menus or icon triggers.

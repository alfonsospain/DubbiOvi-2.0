# DubbiOvi 2.0 Transcription Provider Architecture Study (Final)

This document details the architectural design for the ASR (Automatic Speech Recognition) abstraction layer of DubbiOvi 2.0. The goal is to establish a generic, provider-agnostic interface that decouples the core application logic from specific AI engines (Gemini, Whisper, Ollama, OpenAI, etc.).

---

## 1. Current Transcription Flow

Currently, speech recognition is tightly coupled to Google Gemini. The following analysis outlines how it works:

```
[Client: UI]                               [Client: Audio Utils]                 [Server: Actions/Genkit]
ImportExportPanel.tsx                      audio-utils.ts                         actions.ts / asr-transcription.ts
┌────────────────────────┐                 ┌────────────────────────┐             ┌────────────────────────┐
│ 1. User clicks         ├────────────────►│ 2. Read file & decode  │             │                        │
│    "Transcribe Video"  │                 │    AudioContext        │             │                        │
│                        │                 └───────────┬────────────┘             │                        │
│                        │                             │ (16kHz mono PCM)         │                        │
│                        │                             ▼                          │                        │
│                        │                 ┌────────────────────────┐             │                        │
│                        │                 │ 3. Encode to WAV Blob  │             │                        │
│                        │                 └───────────┬────────────┘             │                        │
│                        │                             │ (WAV file)               │                        │
│                        │                             ▼                          │                        │
│ 4. Call Server Action  │◄───────────────────────────────────────────────────────┤                        │
│    getAudioTranscription                      (Uploads WAV in FormData)         │                        │
│    (FormData)          ├───────────────────────────────────────────────────────►│ 5. Convert to Base64   │
│                        │                                                        │    Call Genkit flow:   │
│                        │                                                        │    asrTranscriptionFlow│
│                        │                                                        └───────────┬────────────┘
│                        │                                                                    │
│                        │                                                                    ▼
│                        │                                                        ┌────────────────────────┐
│                        │                                                        │ 6. Send prompt + audio │
│                        │                                                        │    to Gemini-2.5-flash │
│                        │                                                        │    (Return structured) │
│                        │                                                        └───────────┬────────────┘
│                        │                                                                    │
│ 7. Parse result, map   │◄───────────────────────────────────────────────────────────────────┘
│    takes & timestamps  │                     (Returns AsrOutput JSON)
│    Update project state│
└────────────────────────┘
```

### Detailed Mapping:
- **Source Files**: 
  - [ImportExportPanel.tsx](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/components/ImportExportPanel.tsx) (Triggers extraction, sends server request, processes returned takes).
  - [audio-utils.ts](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/lib/audio-utils.ts) (Extracts mono audio track from video, downsamples to 16kHz via `OfflineAudioContext`, and encodes it to WAV).
  - [actions.ts](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/app/actions.ts) (Server action receiving FormData, converting audio file to Base64, and forwarding it to Genkit flow).
  - [asr-transcription.ts](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/ai/flows/asr-transcription.ts) (Genkit server-side flow encapsulating the Prompt design and Structured Output request with `googleai/gemini-2.5-flash`).
- **Where Takes and Timestamps are Created**: The structured model call in `asr-transcription.ts` instructs Gemini to segment the transcript into short takes (max 10s duration, split on pauses > 1.5s) and return timestamps in `"HH:MM:SS.mmm"` string format.
- **Where State is Updated**: In `ImportExportPanel.tsx`, timestamps are parsed into decimal seconds via `parseTimestampToSeconds()`. The mapped array of type `Take[]` is generated and loaded into the main workspace via the `onImport` prop callback which propagates directly back to `takes` state in `src/app/page.tsx`.

---

## 2. Provider Abstraction

To ensure that the core application never depends on a specific provider, we introduce a generic **Transcription Provider interface** that encapsulates provider-specific logic.

```typescript
import { Take } from '../types';

export interface TranscriptionProviderMetadata {
  modelName: string;
  apiVersion?: string;
  latencyMs?: number;
  tokensUsed?: number;
  costEstimate?: number;
}

export interface ProviderCapabilities {
  supportsLanguageDetection: boolean;
  supportedLanguages: string[]; // List of language codes
  supportsWordTimestamps: boolean;
  supportsSpeakerDiarization: boolean;
  isOffline: boolean;
}

export interface TranscriptResult {
  detectedLanguage: string;
  transcript?: string;
  takes: Take[];
  confidence?: number;
  metadata: TranscriptionProviderMetadata;
}

export interface TranscriptionProvider {
  id: string;
  name: string;
  capabilities: ProviderCapabilities;
  transcribe(audioFile: Blob, sourceLanguage?: string): Promise<TranscriptResult>;
}
```

The rest of the workspace application will only instantiate a selected provider and call its standard interface:

```typescript
const provider: TranscriptionProvider = ProviderRegistry.getInstance().get(selectedProviderId);
const result = await provider.transcribe(processedAudio, selectedLanguage);
```

---

## 3. Generic TranscriptResult Format

The output schema is designed to be fully independent of individual AI engine structures. Reusing the existing `Take` model ensures direct compatibility with the workspace state.

```json
{
  "detectedLanguage": "EN",
  "transcript": "Members of the jury, you must now retire...",
  "takes": [
    {
      "id": "c6a2e41f-82df-4228-a3f2-1bcf35e98218",
      "character": "Judge",
      "time": "00:02.000 - 00:06.500",
      "startSeconds": 2.0,
      "endSeconds": 6.5,
      "original": "Members of the jury, you must now retire to consider your verdict.",
      "translation": "",
      "notes": "",
      "status": "Pending"
    }
  ],
  "confidence": 0.98,
  "metadata": {
    "modelName": "whisper-large-v3",
    "latencyMs": 2400
  }
}
```

---

## 4. Audio Preparation Layer

We introduce an **AudioPreparationService** on the client side. This service optimizes raw video audio before transmission.

### Responsibilities:
1. **Extraction**: Decode video audio into standard floating-point samples.
2. **Channel Downmixing**: Mix multichannel audio (stereo/surround) into a unified mono signal.
3. **Resampling**: Resample raw sample rate to a standard ASR-optimized frequency (typically 16 kHz).
4. **Format Selection**: Compress to the format best suited for the selected provider:
   - **Cloud Providers** (Gemini, OpenAI Whisper API, Groq Whisper): Compress into **MP3** (16 kHz, mono, ~64kbps CBR) to minimize base64 payload sizes, reduce upload bandwidth, and speed up API response times.
   - **Local Providers** (Whisper Local): Output as raw **WAV** or **FLAC** to ensure low CPU-overhead local decoding.

> [!IMPORTANT]
> The `AudioPreparationService` decides the target audio format automatically based on the capability parameters of the selected `TranscriptionProvider`. The user must never manually configure WAV, MP3, or any internal transport formats.

---

## 5. Error Handling & Fallback Behavior

Transcription operations may encounter failures (network timeouts, invalid API credentials, offline local engines). The framework standardizes errors to guarantee reliability:

- **Error Propagation**: All providers must wrap raw API exceptions in custom `TranscriptionError` classes (e.g. `NetworkError`, `AuthenticationError`, `RateLimitError`).
- **Standard Handling**: The calling client captures these errors and shows descriptive notifications via Toast warnings rather than crashing the application.
- **Failover / Fallback Options**: 
  - If a cloud ASR fails due to a network connection loss, the workflow engine can automatically try a local engine fallback (if Whisper Local is installed and configured).
  - If an authentication failure occurs (e.g., invalid Gemini API key), the system alerts the user and opens the **Providers** configuration tab directly.

---

## 6. Future Providers Extensions

Adding a new ASR provider (e.g., Groq Whisper, AssemblyAI) becomes a structured, zero-risk extension:

1. **Create Provider Class**: Create a new class implementing the `TranscriptionProvider` interface (e.g., `src/lib/providers/GroqWhisperProvider.ts`).
2. **Register Provider**: Add the provider class to the ASR registry (`ProviderRegistry.getInstance().register(new GroqWhisperProvider())`).
3. **Update Services Tab**: The Services tab reads the registry dynamically. No other changes are required in `ImportExportPanel`, `TakesList`, or main workspace files.

---

## 7. Implementation Roadmap

### Milestone 1: Interface & Registry Base (Active Phase)
- Define types (`TranscriptionProviderMetadata`, `ProviderCapabilities`, `TranscriptResult`, `TranscriptionProvider`) in `src/lib/types/transcription.ts`.
- Create a `ProviderRegistry` class to register and query providers.

### Milestone 2: AudioPreparationService & MP3 Compression
- Restructure `src/lib/audio-utils.ts` into a cohesive `AudioPreparationService`.
- Implement client-side MP3 compression for Cloud targets.

### Milestone 3: Gemini Provider Refactoring
- Wrap the existing Genkit `asrTranscriptionFlow` inside a new `GeminiTranscriptionProvider` class.
- Verify that Gemini transcription functions identically with the new interface.

### Milestone 4: Whisper Cloud/Local Provider Placeholders
- Add `WhisperCloudProvider`.
- Add `WhisperLocalProvider`.

### Milestone 5: Workspace Integration
- Integrate the new provider interface directly into the redesigned **Data** tab.
- Let the active provider selection in the **Services** tab determine which `TranscriptionProvider` instance is triggered when clicking "Transcribe".

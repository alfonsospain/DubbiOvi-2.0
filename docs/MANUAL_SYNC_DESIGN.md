# Technical Design Proposal: Manual Take Synchronization Editor

This document outlines the focused technical design study for a **Manual Take Synchronization Editor** in **DubbiOvi 2.0**. It provides architectural guidelines, integration points, state models, and validation workflows to support synchronizing script-imported takes with video playback.

---

## A. Files and Functions Involved (Codebase Evidence)

The manual synchronization feature integrates into the core player-editor layout. The following files and functions are directly involved:

1. **`src/lib/types.ts`**:
   * *Evidence*: Contains the `Take` interface:
     ```typescript
     export interface Take {
       id: string;
       character: string;
       time: string;
       startSeconds: number;
       endSeconds: number;
       original: string;
       translation: string;
       notes: string;
       status: 'Pending' | 'Reviewed' | 'Locked';
     }
     ```
   * *Design Action*: Add an optional `synchronized?: boolean` flag to this interface to differentiate manually synchronized takes from script-imported estimates.

2. **`src/app/page.tsx`**:
   * *Evidence*: Manages the central states of the app:
     * `takes` (line 57): Holds the array of takes.
     * `currentIndex` (line 59): Tracks the selected take.
     * `currentTime` (line 65): Tracks current playback time.
     * `videoRef` (line 70): Ref hook reference to the HTML5 video element.
     * `syncAutosave` (lines 75-93): Callback handling local storage writes.
     * `handleTakeUpdate` (lines 314-331): Updates single takes in state and triggers autosave.
   * *Design Action*: The main page will orchestrate the transition into manual synchronization mode by introducing a new boolean state `isSyncModeActive` and passing it to the panels.

3. **`src/components/VideoPlayer.tsx`**:
   * *Evidence*: Controls playback speed, plays/pauses, and tracks time.
     * `handlePlayPause` (lines 110-118): controls native play/pause.
     * `handleTimeUpdate` (lines 152-161): updates current playhead state.
   * *Design Action*: Add an optional prop `isPlaying` or control functions via a forwardRef to trigger play/pause, seek, and loop operations directly from the synchronization panel.

4. **`src/components/TakesList.tsx`**:
   * *Evidence*: Tabular view of takes displaying characters, texts, and status selectors.
   * *Design Action*: Embed a "Sync" icon button in the `TakeRow` dropdown menu or tools column. Clicking this button toggles `isSyncModeActive` and opens the synchronization panel.

5. **`src/lib/utils.ts`**:
   * *Evidence*: Contains timestamp utilities.
     * `formatTimeForDisplay` (lines 27-39): formats seconds to `MM:SS.ms`.
   * *Design Action*: Reuse this utility to format the timing strings atomically.

---

## B. Comparison of Interface Options

To decide where the Manual Synchronization Mode should live, we compare three options:

| Criteria | Option 1: In the Main Window (Recommended) | Option 2: In the Detached Video Window | Option 3: In a Dedicated Third Window |
| :--- | :--- | :--- | :--- |
| **Description** | Embeds as an alternate view or tab in the right-hand panel of `page.tsx`. | Integrates the editor directly inside the detached video player page. | Opens a separate floating window specifically for timing/sync controls. |
| **User Experience (UX)** | High. Keeps the video screen on the left and editing panel on the right. Feels coherent and integrated. | Low/Medium. Requires the user to split focus across screens and open a separate window. | Medium. Spawns additional window overhead that must be positioned by the user. |
| **State Sync Complexity** | **None**. Interacts directly with the React state of the parent page. | **High**. Requires transferring state changes over `BroadcastChannel` and IPC back-and-forth. | **Extreme**. Requires building complex multi-window Electron state synchronization. |
| **Web Fallback Support** | **100%**. Works seamlessly in a standard web browser environment. | **Low**. Spawning child pages suffers from browser popup blockers and lack of native paths. | **None**. Impossible to do cleanly in a standard browser. |
| **Performance Impact** | Minimal. Reuses existing DOM nodes and elements. | High. Requires fetching the entire video over local network port stream (`/api/video`). | High. Spawns a new Chromium rendering process. |

### Recommendation: Option 1 (In the Main Window)
We recommend implementing the manual sync editor inside the **main window** (occupying the right tab panel when active). This ensures zero IPC synchronization latency, maintains web compatibility, and provides the most streamlined user experience.

---

## C. Proposed Component Architecture

When the user enters **Manual Sync Mode**, the right-hand container in [page.tsx](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/app/page.tsx) will switch from the normal `Tabs` component to a new [SyncPanel.tsx](file:///Users/alfonso/Documents/GitHub/DubbiOvi-2.0/src/components/SyncPanel.tsx) component.

```text
+-------------------------------------------------------------+
|                     Header (DubbiOvi Title)                 |
+------------------------------+------------------------------+
|                              | [Manual Sync Mode]           |
|                              | Take 3 of 12                 |
|       Video Player           +------------------------------+
|                              | Original Script Text:        |
|                              | "I rest my case, Your Honor."|
|                              |                              |
|                              +------------------------------+
|       Audio Waveform         | [Set IN (I)]  -> 00:12.450   |
|       (informative overlay)  | [Set OUT (O)] -> 00:15.800   |
|                              |                              |
|                              | [Play/Pause]  [Preview Loop] |
|                              | [Cancel (Esc)]  [Save (Enter)|
+------------------------------+------------------------------+
| Timeline (Interactive track, non-editable segments)        |
+-------------------------------------------------------------+
```

### Component Hierarchy:
* `DubbingStudioPro` (`src/app/page.tsx`)
  * `VideoPlayer` (left panel)
    * `AudioWaveform` (shows static IN/OUT marker lines on the canvas)
  * `SyncPanel` (right panel, active when `isSyncModeActive === true`)
    * `TextDisplay` (shows original and target texts)
    * `SyncControls` (time capture buttons, play controls, loop triggers)
  * `Timeline` (bottom panel)

---

## D. Synchronization State Model

The synchronization editor requires the following localized state variables:

```typescript
interface SyncPanelState {
  isSyncModeActive: boolean;    // Root flag toggling normal tabs vs sync mode
  syncTakeIndex: number;        // Index of the take currently being timed
  tempInSeconds: number | null;  // Temporary IN capture (null if untimed)
  tempOutSeconds: number | null; // Temporary OUT capture (null if untimed)
  isPreviewLooping: boolean;    // Toggle state for the preview loop
}
```

---

## E. Atomic State Updates

To ensure data integrity, timing updates must be performed atomically. When the user saves timing:

1. **Calculate the Formatted String**:
   ```typescript
   const formatTime = (secs: number): string => {
     const mins = Math.floor(secs / 60).toString().padStart(2, '0');
     const seconds = Math.floor(secs % 60).toString().padStart(2, '0');
     const ms = Math.round((secs % 1) * 1000).toString().padStart(3, '0');
     return `${mins}:${seconds}.${ms}`;
   };
   const timecodeString = `${formatTime(inTime)} - ${formatTime(outTime)}`;
   ```
2. **Apply Atomic Transition**:
   ```typescript
   const handleSaveSyncTiming = (index: number, inTime: number, outTime: number) => {
     setTakes(prevTakes => {
       const updated = [...prevTakes];
       updated[index] = {
         ...updated[index],
         startSeconds: inTime,
         endSeconds: outTime,
         time: timecodeString,
         synchronized: true, // Custom flag to mark verified times
       };
       // Immediately sync changes to localStorage
       syncAutosave(settings, updated, glossary, videoFile);
       return updated;
     });
   };
   ```

---

## F. Representation of Unsynchronized Takes

1. **Script Import Configuration**:
   * Plain-text and Word imports calculate estimated times using **2.5 words per second**.
   * By default, takes created this way will be marked with `synchronized: false`.
2. **UI Representation**:
   * **Takes Table**: Unsynchronized takes will display a grey warning badge or icon (e.g. `Clock` with dotted border) indicating `Estimated Timing`.
   * **Timeline**: Unsynchronized segments on the timeline will display in a distinctive desaturated grey-indigo shade, while synchronized segments display in their status-based colors (blue for Reviewed, green for Locked).

---

## G. Timing Validation Rules

When capturing or manually typing timing values, the editor enforces the following rules before allowing a save action:

1. **OUT > IN**: `tempOutSeconds` must be strictly greater than `tempInSeconds`. The editor enforces a minimum duration threshold of `0.2` seconds to prevent accidental double-taps.
2. **Duration Boundary**: Both values must satisfy:
   $$0 \le IN < OUT \le \text{videoDuration}$$
3. **Overlap Warnings**:
   * To prevent timing collisions while maintaining flexibility for overlapping dialogue:
     * Check if $IN < \text{takes}[index-1].endSeconds$. If true, render a yellow caution icon: *"Overlaps with Previous Take"*.
     * Check if $OUT > \text{takes}[index+1].startSeconds$. If true, render a yellow caution icon: *"Overlaps with Next Take"*.
   * Overlaps trigger warnings but do not block saving, as parallel audio streams exist in theatrical dubbing.
4. **Missing Video**:
   * If `videoUrl` is null, the "Capture" buttons are disabled and display a tooltip: *"Load a video file first to capture timecodes"*.

---

## H. Keyboard Shortcuts & Event Filtering

To ensure rapid manual timing, the editor registers standard hotkeys:

* **`Space`**: Play/Pause video.
* **`I`**: Set IN time.
* **`O`**: Set OUT time.
* **`Enter`**: Save timing.
* **`ArrowUp` / `ArrowLeft`**: Save timing and go to the previous take.
* **`ArrowDown` / `ArrowRight`**: Save timing and go to the next take.

### Prevention of Hotkey Collisions (Input Filtering Strategy)
To prevent shortcuts from firing while typing inside text fields (such as changing character names or editing translation text), the keydown listener uses an HTML element check:

```typescript
const handleKeyDown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;
  if (!target) return;

  const tagName = target.tagName.toLowerCase();
  const isInputField = 
    tagName === 'input' || 
    tagName === 'textarea' || 
    target.hasAttribute('contenteditable');

  // Block shortcut triggers if user is actively writing
  if (isInputField) {
    return;
  }

  // Handle hotkeys
  switch (e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      togglePlayPause();
      break;
    case 'i':
      e.preventDefault();
      captureInTime();
      break;
    case 'o':
      e.preventDefault();
      captureOutTime();
      break;
    case 'enter':
      e.preventDefault();
      saveTimingAndAdvance();
      break;
  }
};
```

---

## I. Preview & Loop Playback Logic

Previewing the selected timing interval operates inside a coordinate hook bound to the video playback tick:

```typescript
// Local effect inside SyncPanel
useEffect(() => {
  const video = videoRef.current;
  if (!video || !isPreviewLooping || tempInSeconds === null || tempOutSeconds === null) return;

  // Initialize playback at IN boundary
  video.currentTime = tempInSeconds;
  video.play().catch(err => console.error("Preview failed:", err));

  const handleTimeCheck = () => {
    if (video.currentTime >= (tempOutSeconds || video.duration)) {
      if (isPreviewLooping) {
        video.currentTime = tempInSeconds || 0;
      } else {
        video.pause();
      }
    }
  };

  video.addEventListener('timeupdate', handleTimeCheck);
  return () => {
    video.removeEventListener('timeupdate', handleTimeCheck);
  };
}, [isPreviewLooping, tempInSeconds, tempOutSeconds, videoRef]);
```

---

## J. Persistence Mechanics

* **Autosave**: Atomic updates to the takes state automatically trigger the existing callback:
  ```typescript
  syncAutosave(settings, newTakes, glossary, videoFile);
  ```
  This immediately writes the synchronized timecodes and the custom `synchronized: true` flag to `localStorage`.
* **`.dubbiovi` File Export**: The saved JSON export file structure handles the changes without modification, as the timing values populate the standard `startSeconds`, `endSeconds`, and `time` parameters.

---

## K. Compatibility & Exporter Implications

1. **SRT & VTT Subtitles**:
   * *Implication*: Since the custom timing modifies standard `startSeconds` and `endSeconds`, subtitle outputs will generate correct, valid timecode ranges.
   * *Constraint*: Unsynchronized takes might share overlapping estimated timecodes. A validation alert should display under the export tab if any `synchronized === false` takes exist: *"Warning: Your project contains unsynchronized takes. Subtitles may contain overlapping intervals."*
2. **Word, Excel, & CSV Exporters**:
   * *Implication*: Will fetch the updated `time` strings without issue. No schema migration required.

---

## L. Staged Implementation Plan

* **Stage 1: Core Layout & Toggle State (Milestone 1)**:
  * Integrate the `isSyncModeActive` state in `page.tsx`.
  * Build the right-side `SyncPanel` wrapper.
  * Implement transition transitions (entering and exiting sync mode).
* **Stage 2: Key Capture & Atomicity (Milestone 2)**:
  * Wire time capture logic to the video ref (`videoRef.current.currentTime`).
  * Add the atomic save handler `handleSaveSyncTiming` and verify `localStorage` persistence.
  * Connect hotkey keyboard listeners with target element filtering.
* **Stage 3: Loops & Validation Warnings (Milestone 3)**:
  * Code interval looping checks using standard `timeupdate` listeners.
  * Add overlap validation warnings and block invalid OUT < IN states.
  * Style unsynchronized takes inside the timeline and takes grid.

---

## M. Verification & Testing Checklist

### Automated Tests
1. **Validation Assertions**:
   * Assert that saving a timing configuration with OUT < IN throws an input error.
   * Assert that saving timing when `videoUrl` is empty throws a resource error.
2. **Atomic Updaters**:
   * Assert that updating timing at `index` preserves the take's `original`, `translation`, and `character` fields.

### Manual Verification
* [ ] Load a sample script via `.docx` import. Verify that takes load in a desaturated "Estimated" style on the timeline.
* [ ] Play the video, navigate to Take #2, and enter Sync Mode.
* [ ] Click "Set IN" at `00:05.100` and "Set OUT" at `00:08.500`. Verify that the temporary inputs display the captured values.
* [ ] Press the Spacebar. Verify the video plays/pauses.
* [ ] Focus on the "Character" input field and type the letter "I". Verify that it registers in the input text and does **not** reset the captured IN timecode.
* [ ] Toggle "Preview Loop". Verify the player loops playback between `00:05.100` and `00:08.500`.
* [ ] Press Enter. Verify that the timing saves, the editor advances to Take #3, and the changes are written to `localStorage`.

---

## N. Audio Waveform Overlay Strategy (Risks & Alternatives)

* **Primary Modifying Risk**:
  * Attempting to implement interactive slider selectors inside `AudioWaveform.tsx` is high-risk. Canvas dragging coordinates are prone to rendering delays, scale alignment errors, and code complexity that can destabilize the main playback monitors.
* **Safe Overlay Alternative**:
  * Keep the canvas element strictly non-interactive (mouse clicks propagate normally).
  * Draw two vertical bars directly onto the waveform canvas to represent the active take's IN and OUT boundaries:
    ```typescript
    // In AudioWaveform.tsx draw loop
    if (tempInSeconds !== null && duration > 0) {
      const inX = (tempInSeconds / duration) * canvasWidth;
      ctx.fillStyle = 'rgba(59, 130, 246, 0.5)'; // Translucent blue
      ctx.fillRect(inX - 1, 0, 2, canvasHeight);
    }
    ```
  * This provides immediate visual feedback of timing bounds relative to the audio track while preserving the performance and stability of the component.

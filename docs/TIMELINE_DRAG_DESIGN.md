# Technical Design Proposal: Interactive Timeline Waveform Editor

This document outlines the technical design study for evolving the DubbiOvi 2.0 Timeline Editor into an interactive, mouse-driven timeline editor. It adds support for dragging IN/OUT markers and regions directly on the waveform overlay while preserving the existing codebase architecture and local-first pipelines.

---

## A. Pointer Events API vs Mouse Events vs React Synthetic Events

To handle drag interactions, we recommend utilizing **React Synthetic Pointer Events** (`onPointerDown`, `onPointerMove`, `onPointerUp`).

### Comparison & Selection Rationale:
1. **Mouse Events**: Limited to mouse interactions. Requires duplicate coding to support trackpads, touch screens, and stylus inputs.
2. **React Synthetic Pointer Events (Selected)**: 
   * **Unified API**: Merges Mouse, Touch, and Pen interfaces into a single model, ensuring cross-device stability in both the Electron desktop shell and fallback web browsers.
   * **Pointer Capture**: Supports `e.currentTarget.setPointerCapture(e.pointerId)`. This locks pointer tracking to the target element. Even if the user drags their cursor outside the waveform container boundaries or off the screen, the drag action remains stable and does not get lost.
   * **Standardized gestures**: Blocks browser gestures (scroll, pinch-to-zoom) automatically when paired with the CSS property `touch-action: none`.

---

## B. Drag Target & Gesture Tracking Model

We define a clear, typed tracking structure to determine which element is currently targeted:

```typescript
export enum DragTarget {
  None = 'none',
  InMarker = 'in',
  OutMarker = 'out',
  Region = 'region'
}

interface DragState {
  target: DragTarget;
  startX: number;        // Pointer X coordinate on drag start
  startInSeconds: number;  // The take's initial IN time
  startOutSeconds: number; // The take's initial OUT time
}
```

This state is tracked inside a React `useRef` to prevent redundant component re-renders during active drag moves (see Section L).

---

## C. Coordinate-to-Time Conversion & Clamping

To map absolute screen pixel offsets to seconds, we calculate relative locations inside the waveform element container:

```typescript
const containerRect = containerRef.current.getBoundingClientRect();
const containerWidth = containerRect.width;

// Calculate click location relative to waveform left edge
const relativeX = clientX - containerRect.left;

// Convert to percentage ratio (clamped between 0 and 1)
const ratio = Math.max(0, Math.min(relativeX / containerWidth, 1));

// Convert to target timecode
const targetSeconds = ratio * videoDuration;
```

---

## D. Boundary Prevention (Clamping Rules)

Values are strictly clamped to keep them inside the valid range of the video:

* **IN Limit**: $0 \le IN \le videoDuration$
* **OUT Limit**: $0 \le OUT \le videoDuration$

---

## E. Crossing Prevention (Interval Thresholds)

To prevent the IN playhead from crossing or swapping coordinates with the OUT playhead:
* Define a constant $MIN\_DURATION = 0.200$ seconds (200 milliseconds).
* **When dragging the IN Marker**: Clamp the value:
  $$IN_{new} = \min(targetSeconds, OUT - MIN\_DURATION)$$
* **When dragging the OUT Marker**: Clamp the value:
  $$OUT_{new} = \max(targetSeconds, IN + MIN\_DURATION)$$

---

## F. Region Duration Maintenance

When dragging the highlighted middle region, both bounds must move in tandem while keeping take duration constant.

1. **Calculate Delta**:
   $$\Delta_{pixels} = clientX - startX$$
   $$\Delta_{seconds} = \frac{\Delta_{pixels}}{containerWidth} \times videoDuration$$
2. **Apply Offset**:
   $$IN_{target} = startInSeconds + \Delta_{seconds}$$
   $$OUT_{target} = startOutSeconds + \Delta_{seconds}$$
3. **Clamp Boundaries**:
   * If $IN_{target} < 0$:
     $$IN_{new} = 0$$
     $$OUT_{new} = duration_{original}$$
   * If $OUT_{target} > videoDuration$:
     $$OUT_{new} = videoDuration$$
     $$IN_{new} = videoDuration - duration_{original}$$

This guarantees the take duration does not shrink or stretch when moving the whole interval.

---

## G. Playback & Seeking Behavior

1. **Stop Active Previews**: Drag start (`onPointerDown`) immediately terminates any active interval previews by calling `playbackController.stopPreview()`.
2. **Real-time Video Seeking**:
   * Dragging the **IN Marker** or the **Region** seeks the video playhead to the new IN position.
   * Dragging the **OUT Marker** seeks the video playhead to the new OUT position.
3. **Throttling seeks**: Video decoders can lag when flooded with high-frequency seek requests. Seeks should be wrapped inside a `requestAnimationFrame` loop, updating the video currentTime only when the decoder thread is ready.

---

## H. PlaybackController Integration

The `TimelineEditor` remains isolated from the underlying HTML5 video tag, driving playhead actions using the abstract interface:
* **Trigger Seek**: Call `playbackController.seek(time)` on pointer move.
* **Stop Preview**: Call `playbackController.stopPreview()` on pointer down.

---

## I. Preparation for Zoom Support

To ensure that the coordinate calculations can support zoom levels in future releases without major refactoring, we decouple coordinates from the absolute video duration. 

We define two mapper helper functions:

```typescript
// Converts seconds to left-edge percentage offset
const timeToX = (time: number, duration: number, zoom = 1, offset = 0): number => {
  if (duration <= 0) return 0;
  const visibleDuration = duration / zoom;
  return ((time - offset) / visibleDuration) * 100;
};

// Converts relative pixel coordinates to seconds
const xToTime = (x: number, containerWidth: number, duration: number, zoom = 1, offset = 0): number => {
  if (containerWidth <= 0) return 0;
  const visibleDuration = duration / zoom;
  return offset + (x / containerWidth) * visibleDuration;
};
```

* **Current MVP**: Passes default values `zoom = 1` and `offset = 0`.
* **Zoom Update**: Adding zoom later will require updates *only* to these mapping utilities, keeping the rest of the pointer event listeners untouched.

---

## J. Preparation for Snapping Support

For future versions to support snapping timing bounds to neighbors or audio pauses:
* We define a snapping callback hook:
  ```typescript
  const getSnappedTime = (time: number): number => {
    // Current MVP: pass-through function
    return time;
  };
  ```
* In the future, this function can be updated to compare the time value against neighbor arrays (`takes[index-1].endSeconds` or silent indices) and snap if it falls within a 100ms threshold.

---

## K. Accessibility

1. **Target Hitboxes**: The visual vertical line markers are only 2px wide. We wrap them in transparent container divisions with a width of `12px` and set the hover cursor to `ew-resize`. This provides a large, easy-to-click target.
2. **Touch support**: Handled natively by Pointer Events. Setting `touch-action: none` on the container disables native scrolling while dragging.
3. **Keyboard Alternatives**: The standard keyboard shortcuts (`Space` to play/pause, `I` for IN, `O` for OUT, and Arrow keys) remain fully active as alternatives.

---

## L. Performance & Render-Throttle Architecture

### The Problem:
Scrubbing a marker triggers mouse move events up to 60 times per second. If each tick calls React state changes (`setTempInSeconds`), the whole component tree (including waveform canvas redraws, timelines, and inputs) will re-render, causing lag and interface freezes.

### The Solution (Render-Throttle Strategy):
1. **Ref-Based Drag Tracking**:
   * We track the current drag positions (`tempInRef`, `tempOutRef`) inside React `useRef` handles.
2. **Direct DOM Manipulation during Drag**:
   * The pointer move listener bypasses React state entirely. It directly manipulates the CSS styles of the DOM elements (`marker.style.left`, `highlight.style.width`) using `requestAnimationFrame`.
3. **Single State Commit on Pointer Release**:
   * We trigger the React state updates (`setTempInSeconds(finalIn)`, `setTempOutSeconds(finalOut)`) **only** when the user releases the mouse button (`onPointerUp`).
   * This guarantees smooth, GPU-accelerated dragging animations on screen while maintaining local state sync.

---

## M. System Compatibility
* **Electron**: Chromium supports the Pointer Events API.
* **Fallback Web Browsers**: Pointer Events are fully supported across all modern web browsers.

---

## N. Files Modified

1. **`src/components/AudioWaveform.tsx`**:
   * Expose callbacks: `onInSecondsChange(time)`, `onOutSecondsChange(time)`.
   * Add relative wrapper and pointer listeners (`onPointerDown`, `onPointerMove`, `onPointerUp`).
   * Update markers to have larger transparent hitboxes.
2. **`src/components/TimelineEditor.tsx`**:
   * Pass state setters down to `<AudioWaveform>`.
   * Bind the `playbackController` seek triggers.

---

## O. Risks & Mitigations

* **Laggy Video Seek**:
  * *Risk*: The video player might stutter or lock up if forced to seek repeatedly on every single pixel of movement.
  * *Mitigation*: Throttle seek events by only triggering `playbackController.seek` if the captured timecode shifts by more than `100ms`, or only seek the video playhead when the mouse pause duration exceeds `50ms`.

---

## P. Staged Implementation Plan

* **Stage 1: Hitbox Layout & Pointer Capture (Milestone 1)**:
  * Create the styled marker elements with larger transparent pointer hitboxes.
  * Register pointer event triggers and verify pointer captures on mouse down.
* **Stage 2: Ref-based Move & Direct CSS Positioning (Milestone 2)**:
  * Wire pointer move coordinates to update element `style.left` and `style.width` properties.
  * Verify fluid 60fps drag motions without React re-renders.
* **Stage 3: Video Seek & State Commits (Milestone 3)**:
  * Trigger playhead seeks on move events.
  * Commit timing changes to React state and trigger autosave on pointer up.

# PC UI phase 1 — 2026-09-23

Desktop presentation is isolated at min-width 761px in desktop-ui.js/css. Mobile retains its layout; its existing selection, thumbnail and replacement helpers are shared through scene-ui.js. Both adapters reparent original controls and restore them at the breakpoint. Shared palette tokens retain the mobile values.

No changes to app.js, renderer.js, encoder.js, audio-mixer.js, caption-style.js or style-editor.js.

Validation:
- Existing test-v4.cjs regression suite passed (timing, split/merge/undo, caption scopes, typography, renderer sizes).
- Browser: previous/next and thumbnail selection synchronize preview, current card and highlighted thumbnail, including last-scene disabled state.
- 20 generated cues, 20 media assignments, 4-second narration; media replacement retained cue count and timings.
- Camera movement and transition edits; current/all caption styles; mobile caption sheet and gallery; desktop/mobile selection and style retention.
- Project modal preserves title and BGM; 320px/390px mobile and 1100px desktop show one current card without horizontal page overflow.
- Existing 720p MP4 export completed with narration and BGM on final source.
- Mobile physical devices, all video codecs and every export resolution were not retested. Speech synchronization remains the existing estimated timing algorithm, not speech recognition.

Screenshot: pc-ui-final.jpg (local test sample).

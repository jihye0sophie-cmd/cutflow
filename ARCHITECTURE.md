# Cutflow architecture baseline

This document is the maintenance baseline for the current stable editor. The goal is to keep PC and mobile behavior aligned without re-introducing the version-patch layering that previously caused regressions.

## Runtime ownership

- `app.js`: canonical project state, playback clock, scene/caption timing, project bridge, export bridge.
- `renderer.js`: frame rendering only. It must not own UI state or DOM navigation.
- `audio-mixer.js`: preview/export audio clock and mix only.
- `scene-ui.js`: scene-level state bridge and scene selection/update events.
- `style-editor.js`: caption/title/channel style state.
- `timing-editor.js`: precision timing UI and edits.
- `auto-setup.js`: Quick Start ingestion and preprocessing.
- `mobile-v42.js`: mobile presentation/proxy layer. Do not duplicate core project state here.
- `desktop-ui.js`: desktop presentation/proxy layer. Do not duplicate core project state here.
- `history.js`: undo/redo snapshots through `CutflowProjectBridge`; it does not inject platform-specific buttons.

## Mobile preview invariants

- Normal mobile editing uses the lightweight preview source size.
- Fullscreen preview temporarily uses a native 1080 x 1920 source and restores the normal mobile preview size on close.
- Fullscreen preview is a fixed overlay, not the browser Fullscreen API and not a modal `<dialog>`.
- Preview canvases do not consume pointer events. Playback controls stay in their own interactive layer.
- Playback must never trigger a full mobile editor-panel rerender each frame.
- `nowPlaying` is not observed by the mobile MutationObserver.

## CSS ownership

- `mobile-v42.css`: mobile-only layout and project-settings presentation. The `canonical mobile editing runtime` section is the source of truth for header, preview, scrubber, transport, scene strip, editor scrolling, Safari safe areas and fullscreen preview.
- `desktop-ui.css`: desktop shell and desktop editor layout.
- `timing-editor.css`: shared timing editor.
- `auto-setup.css`: Quick Start internals shared by PC/mobile where appropriate.
- `style.css` / `studio.css`: base legacy/core presentation still required by the canonical DOM.

Do not append a new versioned override block when changing an existing canonical rule. Edit the owning rule in place. Version query strings in `index.html` are only cache-busters, not architecture layers.

## Render rules

- `renderCues()` and `renderScenes()` render current state only. They must not assign media, mutate scene/caption model data, or commit project/history state.
- Data preparation such as automatic cue-to-scene assignment happens explicitly at the operation that creates or restores data, before rendering.
- A user edit should produce one model mutation path, one history commit, and the minimum required render/event refresh.

## Event rules

- Core playback state is controlled through `window.CutflowPlayer`.
- Scene selection is controlled through `window.CutflowScene`.
- Platform UI controls may proxy those APIs but must not create a second state machine.
- Core update APIs emit their own `cutflow-*` events. Platform UI must not schedule an extra full refresh after a direct core update unless that control is only a DOM proxy.
- Standalone and caption-linked scene actions both route through `window.CutflowScene`; legacy DOM handlers must not maintain a second reorder/delete state path.
- Mobile refresh requests are coalesced into one animation-frame render; a later force refresh upgrades the already queued render instead of creating a second render.
- Desktop observer-driven refreshes and precision-timing refreshes are coalesced into one animation-frame update.
- Ordinary project edits may refresh the BGM summary silently; `cutflow-bgm-updated` is reserved for actual BGM state changes or explicit BGM restores.
- iPhone touch controls that must work during playback use the shared mobile tap binding and must not be rebound by render functions.
- MutationObservers may refresh settings/status UI, but must not observe values rewritten every animation frame or request attribute tracking for structural-only lists.

## Before merging editor changes

1. Parse every first-party JS file without syntax errors.
2. Check that literal DOM ID lookups resolve to current or generated markup.
3. Check for retired IDs/classes before adding compatibility CSS.
4. Verify normal mobile playback: play -> pause -> previous/next -> play.
5. Verify fullscreen mobile playback: open -> play -> pause -> play -> close.
6. Verify fullscreen canvas is 1080 x 1920 and normal mobile preview size is restored after closing.
7. Verify mobile editor panel still scrolls independently while the preview area remains fixed.
8. Verify desktop and mobile project settings still proxy the same underlying controls.
9. Bump only the assets that changed.

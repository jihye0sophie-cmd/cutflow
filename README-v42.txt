Cutflow v42 Mobile UI rebuild
=============================

Purpose
- Rebuild only the mobile presentation layer.
- Keep the existing editor engine and PC workflow intact.
- Do NOT move desktop DOM panels into the mobile UI.

Upload these files to the GitHub repository root:
1. index.html (replace)
2. mobile-v42.js (new)
3. mobile-v42.css (new)
4. build.cjs (replace)
5. package.json (replace)
6. test-mobile-v42.cjs (new)

Important
- Do not upload mobile-ui.js / mobile-ui.css / mobile-fullscreen.js / mobile-fullscreen.css from an old package.
- Those legacy files may remain in the repository, but v42 index/build no longer loads or publishes them.
- Keep all engine files and assets as they are.
- package-lock.json does not need replacement because dependencies did not change.

v42 mobile layout
- Header: Open / Save / Export
- Video preview + player + scrubber
- Persistent scene thumbnail strip + add scene
- Five tabs: Caption / Media / Narration / Template / BGM
- Fullscreen mobile preview

Existing function bridges
- Project open/save/export
- Scene select/add/replace/split/merge/delete
- Caption text/timing/color/style
- Scale / Position X / Position Y
- Motion / transition
- Video Trim / original audio / fades
- Script/TXT/narration/caption-range creation
- Silence cut
- Auto setup: script/narration/grid/single images/BGM/start
- Template/title/channel style
- BGM controls

Architecture
- Desktop DOM remains authoritative but hidden on mobile.
- Mobile controls proxy values/events to existing desktop controls.
- #mobileAppV42 never reparents .source-panel, .setup-panel, .timeline-panel, etc.
- Legacy mobile v19-v41 CSS/JS is not loaded in v42.

Verification performed
- mobile-v42.js syntax: PASS
- v42 architecture regression test: PASS
- static dist build: PASS
- dist contains mobile-v42.js/css: PASS
- dist excludes legacy mobile-ui.js/css: PASS

Note about browser automation
- The environment blocks Chromium access to localhost with ERR_BLOCKED_BY_ADMINISTRATOR,
  so final iPhone rendering could not be visually executed here. Static source/build verification passed.

Suggested commit summary:
feat: rebuild mobile UI as independent v42 shell

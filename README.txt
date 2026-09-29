Cutflow v41.3.2 mobile detection stabilization

Replace these three files in the repository root:
- index.html
- mobile-ui.css
- test-mobile-v41.cjs

Purpose:
- Fix iPhone/mobile browsers that expose a desktop-sized layout viewport.
- Activate the existing v41 mobile adapter even when max-width:760px is false.
- Apply mobile CSS on coarse-pointer touch devices as well.

No feature logic is changed. Existing mobile-ui.js remains unchanged.

Suggested commit:
fix: force v41.3.2 mobile UI on touch devices

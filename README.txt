Cutflow v41.3.3 mobile activation fix

Replace these files in the repository root:
- index.html
- mobile-ui.css
- test-mobile-v41.cjs

This version specifically fixes iPhone/iPad browsers that report a desktop-like layout viewport.
It forces the existing v41 mobile adapter on mobile user agents / Mac touch iPad mode / small touch devices, and adds a max-device-width CSS fallback.

Suggested commit summary:
fix: force v41.3.3 mobile layout on iPhone desktop viewport

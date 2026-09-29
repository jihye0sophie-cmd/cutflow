Cutflow v41.3.5 - full site package

This package contains the complete GitHub Pages site files from the latest successful deployment artifact,
with the v41.3.5 mobile/desktop UI mode fix overlaid.

How to use
1. Open the cutflow repository root on GitHub.
2. Keep the existing .github/workflows, package.json, package-lock.json, build.cjs, vite.config.mjs and other repo management files.
3. Upload/replace ALL files and the assets folder from this package at the repository root.
4. Commit the upload.
5. Wait until Actions > Deploy Cutflow to GitHub Pages completes successfully.
6. On iPhone, close the old tab and reopen the Pages URL. If needed, clear website data/cache for the site.

Validation performed
- 304 files in package
- 272 files under assets
- all 35 index.html local references exist
- all top-level JavaScript files passed node --check

Suggested commit summary
fix: replace full site with v41.3.5 unified UI mode build

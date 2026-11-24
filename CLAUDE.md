# Daybook: standalone offline app

## What this is
Daybook is Sean's personal planner: a single-page app for scheduling activities (workouts, photography practice, language study, chores, bills), checking them off, and viewing them by day, week and month. It was built on claude.ai as an artifact. `original/` holds that working version: `index.html` plus its photos (`slides/`) and syllabus page images (`docs/`).

The job here is to turn it into a standalone app that Sean installs on his iPhone home screen and that works with no internet.

## Goals, in priority order
1. **Works fully offline** after the first visit: app, data, photos and documents. Airplane mode must behave exactly like online.
2. **Installable PWA** on iPhone (Safari > Share > Add to Home Screen): web app manifest, icons, `display: standalone`, theme color, and a service worker that caches everything.
3. **Edge to edge** in portrait and landscape, using safe-area insets. No white overscroll; the background behind bounce areas should be the theme's deep color.
4. **Hosted free on GitHub Pages**, deployed from this repo.
5. **Keep every existing feature and the look.** Sean has tuned the design carefully; do not restyle.

## Storage: replace the claude.ai capabilities
The original calls `window.claude.use('db' | 'user' | 'assets' | 'downloads')`. None of these exist outside claude.ai. Replace them:
- **db / user** → IndexedDB (via a small wrapper, or `idb` from a CDN copied locally for offline). Keep the same document shapes: `library`, `meta`, `photos`, and one doc per month (`m-YYYY-MM` holding `{days: {"YYYY-MM-DD": [entries]}}`). The original already falls back to localStorage when `db` is null; IndexedDB is preferred because iOS can evict localStorage more readily.
- **assets** (uploaded photos) → store resized JPEG blobs in IndexedDB and render them with object URLs.
- **downloads** (backup file and calendar .ics) → a normal `<a download>` with a Blob URL, falling back to the Web Share API (`navigator.share` with a File) on iOS so Sean can save to Files or iCloud Drive.
- Call `navigator.storage.persist()` on first run.

## Data migration
Sean will export a backup from the claude.ai version (Edit > Your data > Back up to file). It's JSON: `{app:'daybook', format:1, saved, library, months, photos}`. **Restore from file must accept that exact format.** Photos uploaded on claude.ai are not in the backup and will be re-added; the 10 built-in photos in `slides/` are.

## Features to preserve (all in original/index.html)
- Tabs: Home, Week, Month, Docs, Edit. Branded gradient header, scrolling backup ticker, footer ("A Claude project by Sean Jarnagin").
- Home: crossfading photo slideshow (album, speed and zoom settings), "Make Today Yours", greeting, week/streak pills, Today card with check-off.
- Items: open → done → missed (red strikethrough) cycle; status set directly in the edit sheet.
- Add sheet: activity chips, nested group/option chips (multi-select), inline "+ Add" option, time, note, repeat weekly (days and weeks) or monthly (same date, or last day of month), and "This one / This & future" for editing or deleting a series.
- Edit tab: four sections (Activities, Themes, Home photos, Your data), collapsible activities and groups, rename, reorder, color dot cycles through slots.
- Themes: Sunset default; automatic holiday themes and opt-in season themes, listed in calendar order. Activity colors are slots 1 to 9 that change with the theme.
- Docs: Light & Lens syllabus and NIKKOR nomenclature (embedded HTML), Italian and Ukrainian syllabi (page images, tap to zoom).
- Week export to .ics for phone calendar alerts.
- Library version upgrades (`upgrade()`, `LIB_VER`) that merge defaults without overwriting Sean's edits.

## Known issues to fix
- iOS: inputs must be at least 16px to avoid focus zoom; double-tap zoom is disabled with `touch-action: manipulation`.
- Landscape margins and white overscroll were limits of the claude.ai viewer and should go away as a standalone PWA.

## Notifications
A web app can't schedule local notifications offline, and push needs a server and internet. Keep the .ics export as the reliable way to get alerts. Don't build push unless Sean asks.

## Later, not now
- Voice commands, online only (hide the mic when offline; tapping stays the default).
- Sunday weekly review card (both language syllabi call for one).

## Working rules
- Refactor `original/index.html` into a clean project (separate JS modules and CSS are fine), but test that every feature still works before deleting anything.
- Test on an iPhone-sized viewport in portrait and landscape, and in offline mode via the service worker.
- Never use em dashes in UI text; Sean prefers plain hyphens.
- Commit in small, described steps.

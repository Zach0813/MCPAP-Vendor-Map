# Developer Notes — Release history

This file contains technical, per-release developer notes. For each release create a new section `## vX.Y.Z — YYYY-MM-DD` with the following information:

- Files changed (short list)
- Short technical summary (why, how)
- Any migration or rollout notes


## Unreleased / 0.3.2 - upcoming
Date: 2025-10-30

### What's New
**Admin Business Address Autocomplete**
- Files: `templates/index.html`, `static/js/controls.js`
- Converted from textarea to single-line input; wired with legacy `google.maps.places.Autocomplete`
- PlaceAutocompleteElement proved inconsistent across Maps SDK builds; legacy API is stable and fully supported
- Controlled fallback (AutocompleteService + PlacesService) implemented during debugging but not shipped

### Changed
**Legend Icons**
- File: `static/style.css`
- Icon container size: 22px → 28px
- Improved vertical centering for better readability

**Vendor List UI**
- File: `static/style.css`
- Badge icons: 28px → 32px
- Font size: default → 15px (both booth IDs and vendor names)
- Row height: uniform via `min-height: 42px`
- Logo fit: `object-fit: contain` (preserves aspect ratios, no cropping)
- Typography: booth IDs bold, vendor names normal weight

**Live Logo Updates**
- Files: `static/js/controls.js`, `static/js/badges.js`
- `els.logoUrl` input handler now calls `MCPP.ensureLogoBadgeForBooth(booth, id)` immediately
- Exposed `ensureLogoBadgeForBooth` on MCPP namespace
- Logo badges appear/update on map instantly without requiring "Assign" or save

**UI Simplification**
- File: `static/js/controls.js`
- Removed on-map Locate/search control to declutter toolbar

### Bug Fixes
**Booth Deletion Overlay Cleanup**
- File: `static/js/controls.js` (delete handler)
- Enhanced to properly remove all map overlays: polygon, label, centerDbg, badgeOverlay, and S.logoBadges entries
- Uses correct removal APIs: `.remove()`, `.setMap(null)` depending on overlay type
- Overlays now disappear immediately without page refresh

### Rollout / QA Checklist
- No DB migrations required
- Verify Maps Places API key includes Places API access
- QA tests:
  1. Admin Business Address: focus input → verify Google Places suggestions → select address → confirm viewer populates
  2. Logo live update: enter logo URL → confirm badge appears on map immediately (zoom ≥ 20.75) without clicking "Assign"
  3. Booth deletion: delete booth → verify all overlays (label, logo, status badge) disappear immediately
  4. Vendor list: verify badges 32px, text 15px, uniform row heights, logos not cropped

# GUNOS V1 — Phase 1 Scaffold Design Document

**Platform:** GUNOS V1  
**Phase:** 1 — New Application Scaffold  
**Status:** Complete  
**Date:** 2026-03-13  

---

## 1. Overview

Phase 1 establishes the clean new application layer for GUNOS V1. This is a fresh top-level directory (`gunos_v1/`) that is entirely separate from the `guno_v6/` research and development environment. The `guno_v6/` directory remains fully intact and untouched as the reference/experimental branch.

The primary goal of Phase 1 is:

> Create a clean, city-aware application shell that can serve as the foundation for all subsequent GUNOS V1 development phases.

---

## 2. Directory Structure

```
gunos_v1/
├─ index.html              # GUNOS V1 main shell page
├─ src/
│  ├─ app/
│  │  └─ main.js           # App entry point — boot, city resolve, shell render
│  ├─ city/
│  │  ├─ city_loader.js    # GUNOS V1 city loader (adapted from guno_v6)
│  │  └─ city_ui.js        # City selector UI, URL param resolution
│  ├─ core/                # (Phase 3+) Play engine, rules, scoring
│  ├─ ui/                  # (Phase 2+) UI components
│  ├─ game/                # (Phase 3+) Game state management
│  └─ state/
│     └─ app_state.js      # Central app state container
├─ config/
│  └─ city_registry.json   # GUNOS V1 city registry (references guno_v6 packages)
├─ assets/
│  └─ images/              # (Future) Platform-level image assets
└─ docs/
   └─ phase1_scaffold.md   # This document
```

---

## 3. City Data Strategy

GUNOS V1 does **not** duplicate city data packages. All four city packages (Tokyo, Osaka, London, NYC) remain in `guno_v6/cities/`. The `gunos_v1/config/city_registry.json` references them via relative paths (`../guno_v6/cities/*/city_profile.json`).

This approach:
- Keeps `guno_v6` intact as the authoritative data source
- Avoids data duplication
- Allows GUNOS V1 to evolve independently at the application layer

When city packages need to be promoted to GUNOS V1-native packages (e.g., for V1.1), they can be copied and versioned independently at that point.

---

## 4. City-Aware Startup Flow

```
DOMContentLoaded
    │
    ▼
resolveActiveCityId()
    ├─ ?city= URL param present and valid → use param city
    └─ no param / invalid → use registry.default_city ("tokyo")
    │
    ▼
loadCityProfile(cityId)
    │  (loads city_profile.json from guno_v6/cities/)
    ▼
setActiveCity() → app_state.js
    │
    ▼
updateCityDisplay()    → updates #city-label, #city-name, document.title
renderCitySelector()   → populates #city-selector with city buttons
renderShellPanels()    → injects placeholder content into panel elements
    │
    ▼
Shell ready
```

---

## 5. URL Parameter Support

The `?city=` URL parameter is supported at startup:

| URL | Active City |
|-----|-------------|
| `index.html` | Tokyo (default) |
| `index.html?city=tokyo` | Tokyo |
| `index.html?city=osaka` | Osaka |
| `index.html?city=london` | London |
| `index.html?city=nyc` | New York City |
| `index.html?city=unknown` | Tokyo (fallback + notice) |

City selector buttons in the header reload the page with the appropriate `?city=` parameter.

---

## 6. Shell Layout (Phase 1 Placeholder)

The shell provides a 3-column layout with placeholder panels:

| Panel | Location | Phase |
|-------|----------|-------|
| **Hand** | Left column | Phase 3: play engine integration |
| **Map** | Center column (full height) | Phase 4: map-first gameplay |
| **Score** | Right column | Phase 5: scoring / result UX |
| **Log** | Bottom-left | Phase 3: play engine integration |
| **Info** | Bottom-right | Phase 2: main play layout |

All panels are placeholders in Phase 1. No gameplay logic is wired.

---

## 7. Branding

Per the GUNOS versioning policy (`guno_v6/docs/versioning_policy.md`):

- **Platform label:** `GUNOS V1`
- **City display format:** `GUNOS V1 · TOKYO` (header), `GUNO Tokyo` (footer)
- **Document title:** `GUNOS V1 · <CITY_LABEL>` (updated dynamically on city load)

---

## 8. Module Reuse from guno_v6

| Module | Reuse Strategy |
|--------|---------------|
| `city_loader.js` | Adapted — same API, updated base URL resolution for `gunos_v1/` root, dataset path resolution via `../guno_v6/` |
| `city_ui.js` | Adapted — same `resolveActiveCityId()` / `getCityIdFromUrl()` logic; new `renderCitySelector()` (button-based instead of `<select>`) |
| City data packages | Referenced via relative paths — not copied |
| `config/city_registry.json` | New GUNOS V1 registry (superset of guno_v6 registry with `display_label` and `platform` fields) |

Modules **not** carried over in Phase 1:
- `game_engine.js`, `play_engine.js`, `rules.js`, `scoring.js` (Phase 3+)
- `room_client.js`, `transport_supabase.js` (Phase 6+)
- `board.js`, `hand.js`, `log.js`, `result.js` (Phase 2+)

---

## 9. Phase 1 Completion Criteria

| Criterion | Status |
|-----------|--------|
| `gunos_v1/` exists with new scaffold | ✅ |
| `gunos_v1/index.html` loads successfully | ✅ |
| Page shows GUNOS V1 title | ✅ |
| Page shows active city label | ✅ |
| City selector present and functional | ✅ |
| Placeholder layout regions present | ✅ |
| Default city (Tokyo) loads on bare URL | ✅ |
| `?city=tokyo`, `?city=osaka`, `?city=london`, `?city=nyc` work | ✅ |
| `guno_v6/` remains untouched | ✅ |

---

## 10. What Comes Next

| Phase | Goal |
|-------|------|
| Phase 2 | Main play layout — replace placeholders with real panel structure |
| Phase 3 | Play engine integration — wire `game_engine.js`, hand, log |
| Phase 4 | Map-first gameplay — route visualization on map panel |
| Phase 5 | Scoring / result UX |
| Phase 6 | Multi-city runtime polish |
| Phase 7 | Final V1 presentation layer |

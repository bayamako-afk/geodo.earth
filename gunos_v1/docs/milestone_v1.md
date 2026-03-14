# GUNOS V1 Milestone Note

This document marks the completion of the first major GUNOS V1 milestone. GUNOS V1 is now a playable multi-city platform milestone based on the existing GUNO V6 core and data foundation. With its own dedicated application layer under `gunos_v1/`, this milestone represents a critical platform-level transition from single-city experimental work to a unified, multi-city playable runtime.

### 1. Milestone Summary

GUNOS V1 is now functionally playable. The platform successfully supports multiple real-world cities within a single application shell. The map has been elevated to the main gameplay surface, replacing text-heavy logs with rich SVG-based visual network growth. Comprehensive score and result UX exists to explain game outcomes clearly. This milestone is sufficient to treat GUNOS as a scalable platform rather than just a prototype.

| Area | Status |
|------|--------|
| Multi-city structure | Complete |
| Main runtime | Complete |
| Map-first gameplay | Complete |
| Score/result UX | Complete |
| Online | Smoke-tested only |
| Special systems | Deferred |

### 2. Completed Phases

The transition to V1 was achieved through six focused phases:

- **Phase 1 — Scaffold construction**: Established the `gunos_v1/` directory structure, created the platform entry point, and adapted the city loader to resolve existing `guno_v6` city profiles.
- **Phase 2 — Main play layout**: Rebuilt the application shell into a product-grade, map-first layout featuring a dedicated header bar, map panel, and bottom control panels.
- **Phase 3 — Play engine integration**: Connected the `guno_v6` play engine and deck generator to the new shell, enabling START/RESET functionality, turn progression, and live hand display.
- **Phase 4 — Map-first visualization**: Replaced placeholder map views with an SVG-based geographic renderer, visualizing station nodes, route edges, and real-time player ownership overlays.
- **Phase 5 — Score/result UX**: Integrated the final scoring engine, introduced live score tracking during gameplay, and built a comprehensive GAME OVER result panel to explain why a player won.
- **Phase 6 — Runtime clarity and cross-city polish**: Refined the UI with clear game state badges, turn counters, stronger network ownership glow, and cross-city descriptor texts to finalize the playable experience.

### 3. Supported Cities

GUNOS V1 currently supports four real-world city packages. All cities share the same engine but offer distinct network topologies.

- **Tokyo** (`data_ready: true`): Main runtime works perfectly. Features a dense baseline network with highly contested hub stations.
- **Osaka** (`data_ready: true`): Main runtime works perfectly. Features a compact balanced network.
- **London** (`data_ready: true`): Main runtime works perfectly. Features a transfer-heavy metro core. (Score schema differences successfully normalized).
- **NYC** (`data_ready: true`): Main runtime works perfectly. Features a long-distance Manhattan hub system.

### 4. Current Capabilities

GUNOS V1 can currently perform the following operations:
- City-aware startup and boot sequence
- Seamless city switching via UI selector or URL parameter (`?city=`)
- Load specific city packages and datasets without duplicating data
- Generate city-specific card decks based on actual station graphs
- Start and reset game sessions
- Play a turn-based runtime (PLAY 1 / AUTO ×20)
- Show real-time player ownership and network growth on the map
- Display live scores and detailed end-game result states
- Run consistently across multiple distinct city topologies
- Connect to a basic online layer (Supabase Realtime) which has passed initial smoke testing

### 5. Architecture Milestone Meaning

Architecturally, this milestone proves the viability of the separation of concerns:
- `guno_v6/` remains the source-of-truth engine and data environment. It is protected and unmodified.
- `gunos_v1/` is now the platform-facing application layer, consuming the engine as a library.
- City packages are fully reusable and independent of the UI layer.
- The exact same play engine now dynamically powers multiple real cities by simply swapping the injected data context.
- The map is now the gameplay centerpiece, proving that complex geographic graph data can be rendered dynamically in the browser.

### 6. What is Intentionally NOT Finished Yet

To maintain momentum, several features are intentionally deferred and are not considered part of the V1 milestone:
- Full online stabilization and multiplayer matchmaking UI
- Special card systems (e.g., event cards, action cards)
- Replay system or detailed turn history logs
- Large presentation polish (animations, sound effects, particle systems)
- Final launch packaging and deployment pipelines
- Deep gameplay balancing and route size tuning for every individual city
- Advanced route/network explanation UI (e.g., highlighting exactly which lines contributed to the route bonus)

These items are deferred intentionally to prioritize core platform stability, not forgotten.

### 7. Known Limitations / Known Issues

Current practical limitations of the V1 build include:
- Route and network live visibility may still be uneven across cities depending on node density.
- Some score components (like route bonuses) may be clearer in cities with longer lines than others.
- London and NYC maps may still need readability or tuning passes due to overlapping stations in dense areas.
- The online layer is only smoke-tested and not fully hardened against edge cases or disconnects.
- City comparison UI is still limited to a simple selector dropdown/button row.

### 8. What Belongs to V1.1

The forward-looking backlog for the next iteration (V1.1) includes:
- Online stabilization and robust room management
- Route/network visibility refinement (e.g., hover-to-highlight specific routes)
- Replay and turn history timeline UI
- Enhanced city comparison UI (stats, leaderboards)
- London and NYC specific visual tuning (decluttering)
- Additional quality-of-life improvements (tooltips, keyboard shortcuts)
- Better result explanations (visual breakdown of score sources on the map)

### 9. Recommended Milestone Statement

GUNOS V1 should now be treated as the first playable multi-city platform milestone, built on the validated GUNO V6 foundation and ready for iterative V1.x refinement.

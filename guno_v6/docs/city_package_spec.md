# GUNOS City Package / Pack Specification
## ROUTE_SIZE = 10 Standard

## 1. Purpose

This document defines the shared structure for city packages, the common pack/route rules required by the game engine, the `ROUTE_SIZE = 10` standard, and the separation between the core engine and city-specific data. All future city packages (Tokyo, Osaka, London, NYC, and beyond) must follow these specifications to ensure engine compatibility and stable gameplay.

## 2. Design Principles

- **Core Engine is City-Agnostic**: The game engine must remain independent of any specific city. It should rely solely on the data provided by the city packages.
- **City Differences Live Inside Packages**: All city-specific logic, data, and configurations must be encapsulated within the `cities/<cityId>/` directory.
- **Gameplay Abstraction**: The pack representation is a simplified game representation designed for balanced gameplay, not a full 1:1 dump of real-world routes.

## 3. ROUTE_SIZE = 10 Rule

Every route (collection) used in gameplay **must have exactly 10 slots**. 

While a real-world route's station count may be larger or smaller, the gameplay route size and the real-world station count are distinct concepts.

**Why is this required?**
- **Engine Compatibility**: The core game engine (e.g., `rules.js`) hardcodes `ROUTE_SIZE = 10` for evaluating map state and route completion.
- **Board Layout Stability**: A fixed slot count ensures UI/board rendering remains consistent across all routes and cities.
- **Scoring Stability**: Route scoring algorithms depend on the 10-slot limit to calculate occupancy and consecutive bonuses correctly.
- **Multi-City Comparison**: Standardizing the route size allows for fair cross-city comparisons and balance tuning.
- **Simulator Compatibility**: The AI simulator expects a uniform structure to evaluate strategies effectively.

## 4. City Package Structure

Each city package must follow this exact directory structure:

```text
cities/<cityId>/
  city_profile.json
  data/
    master/
      stations_master.json
      lines_master.json
      station_lines.json
    graph/
      station_graph.json
    derived/
      station_metrics.json
      line_metrics.json
    decks/
      deck_v1.json
    packs/
      pack_v1.json
```

## 5. city_profile.json Requirements

`city_profile.json` is the source of truth for all city-specific configurations. It must include the following minimum fields:

- `city_id`: Unique identifier (e.g., "osaka").
- `display_name`: Human-readable name.
- `country`: Country code.
- `language`: Primary language for the UI.
- `timezone`: Timezone string.
- `map`: Contains `center` coordinates and default `zoom` level.
- `dataset`: Paths to the JSON files listed in the package structure.
- `deck_defaults`: Default deck size and rarity targets.
- `status.data_ready`: Boolean flag indicating if the city is fully playable (used to prevent crashes on scaffolded cities).

## 6. Pack Specification

The `pack_v1.json` defines the playable board state:

- Each `collection` corresponds to a route/line.
- **Collection size must always be 10** (`"size": 10`).
- `layouts.default.slots` must reference exactly those 10 slots.
- The `collection_id`, `lc`, and collection keys must match exactly, including case sensitivity. Mismatched IDs will break pack loading and route scoring.

## 7. Representative Station Selection Rule

When compressing a real route into a 10-slot pack collection, follow these rules:

1. **Include First Station**: The starting terminus.
2. **Include Last Station**: The ending terminus.
3. **Choose Remaining 8**: Select based on `composite_score` (importance).
4. **Prioritize Hubs**: Focus on major transfer stations and key route character points.
5. **Avoid Geographic Bias**: Ensure an even spread across the route where possible, rather than clustering all selected stations in one area.

### Example: Osaka
The real-world Tanimachi Line (Osaka) has 26 stations. The pack representation still uses exactly 10 representative stations. The first and last stations are included, and the remaining 8 are chosen based on their hub scores and strategic importance.

## 8. Route Scoring Assumptions

Route scoring is strictly based on the 10-slot representation. Completion is evaluated as fractions of 10:
- 3/10
- 5/10
- 7/10
- 10/10 (Full Route)

Consecutive occupancy scoring is also calculated on top of this 10-slot abstraction.

## 9. Network Score Relationship

GUNOS employs a two-layer model for representing the city:

- **Pack Layer (Gameplay Abstraction)**: Uses the simplified 10-slot route representation for board placement and route scoring.
- **Graph Layer (Real Structure)**: `station_graph.json` represents the actual, uncompressed city network. Network scoring (e.g., shortest paths, global hub centrality) may still utilize this graph layer to reflect the true geography.

## 10. Deck Defaults

While route size is strictly fixed at 10, the `deck_size` can vary by city to accommodate different network densities and balance requirements. For example:
- **Tokyo**: 40 cards
- **Osaka**: 32 cards

## 11. Validation Checklist

Before marking a new city package as `data_ready: true`, ensure the following:

- [ ] `city_profile.json` loads correctly.
- [ ] `station_graph.json` is valid.
- [ ] `station_metrics.json` is valid.
- [ ] `line_metrics.json` is valid.
- [ ] Deck generation works without errors.
- [ ] Pack generation works without errors.
- [ ] **All collection sizes in the pack are exactly 10.**
- [ ] `play_engine` executes smoothly.
- [ ] The simulator does not produce pathological behavior (e.g., infinite loops, excessive turn counts).
- [ ] Route, Hub, and Network bonuses are non-zero in normal play.

## 12. Future Cities Note (London / NYC)

Future city packages, including London and NYC, **must** also follow the `ROUTE_SIZE = 10` standard. They must use the representative station selection method rather than raw, full-route station dumps.

## 13. Common Pitfalls

- **Confusing Real Route Length with Pack Route Size**: Never use the real station count for the pack collection `size`.
- **Collection ID Case Mismatch**: Ensure `layouts.default.slots` IDs match the keys in the `collections` object exactly.
- **Missing `status.data_ready`**: Forgetting this flag in `city_profile.json` will cause the UI to block loading.
- **Schema Drift**: Allowing different cities to use slightly different JSON structures.
- **Hardcoded Paths**: Accidentally leaving Tokyo-specific paths (`cities/tokyo/...`) in core engine code.

## 14. Summary

GUNOS uses a standardized 10-slot route collection model so that all cities can run on the same engine while still preserving their unique city-specific network character.

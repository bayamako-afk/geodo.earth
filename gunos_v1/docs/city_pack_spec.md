# GUNOS V1 City Pack Specification

This document defines the requirements and data structures for adding a new city to the GUNOS V1 game engine.

## Overview

GUNOS V1 separates the game engine from city-specific data. All city data resides in the `guno_v6/cities/` directory, while the game engine lives in `gunos_v1/`. To make a city playable in GUNOS V1, it must be registered in `gunos_v1/config/city_registry.json`.

## 1. Directory Structure

A city pack must follow this directory structure inside `guno_v6/cities/<city_id>/`:

```text
guno_v6/cities/<city_id>/
├── city_profile.json      # Main configuration and metadata
├── datasets/              # Or `dataset/` (both are supported)
│   ├── lines_master.json
│   ├── station_graph.json
│   ├── station_lines.json
│   └── station_metrics.json
```

## 2. City Registry Entry

To expose the city in the GUNOS V1 UI, add an entry to `gunos_v1/config/city_registry.json` under the `cities` array:

```json
{
  "city_id": "paris",
  "display_name": "Paris",
  "display_label": "PARIS",
  "profile": "../guno_v6/cities/paris/city_profile.json",
  "ui_trait": "dense historical metro network",
  "stats": {
    "node_count": 302,
    "avg_score": 4.5,
    "max_score": 15.0,
    "hub_pct": 90
  }
}
```

### Registry Fields:
- `city_id`: Unique lowercase identifier (matches directory name).
- `display_name`: Full human-readable name.
- `display_label`: Short, capitalized label for UI headers.
- `profile`: Relative path to the city profile from the `gunos_v1` root.
- `ui_trait`: A short descriptive phrase displayed in the map header and city compare panel.
- `stats`: Static statistics used in the city compare panel (calculated from the graph data).
  - `node_count`: Total number of stations.
  - `avg_score`: Expected average score per turn.
  - `max_score`: Theoretical maximum score for a single turn.
  - `hub_pct`: Percentage of stations considered hubs.

## 3. City Profile Requirements

The `city_profile.json` must contain at least the following sections:

```json
{
  "city_id": "paris",
  "display_name": "Paris",
  "status": {
    "data_ready": true
  },
  "datasets": {
    "station_graph": "cities/paris/datasets/station_graph.json",
    "station_lines": "cities/paris/datasets/station_lines.json",
    "station_metrics": "cities/paris/datasets/station_metrics.json",
    "lines_master": "cities/paris/datasets/lines_master.json"
  },
  "routes": {
    "total_stations": 302,
    "total_routes": 16,
    "featured_lines": ["M1", "M4", "M14"]
  },
  "scoring": {
    "hub_threshold": 4,
    "hub_multiplier": 1.5,
    "route_multiplier": 2.0,
    "route_completion_threshold": 0.33,
    "scale_factor": 1.0
  }
}
```

### Key Profile Fields:
- `datasets` (or `dataset`): Paths to the JSON data files, relative to the `guno_v6` root.
- `routes.featured_lines`: Array of line codes to display as colored badges in the map header.
- `scoring.scale_factor`: A multiplier applied to final scores to balance cities with vastly different topologies (e.g., London uses 4.5 to match Tokyo's baseline).

## 4. Dataset Requirements

1. **station_graph.json**: Defines the nodes (stations) and edges (connections). Must include `global_id`, `name`, and coordinates (`x`, `y` or `lon`, `lat` which the engine normalizes).
2. **station_lines.json**: Maps `global_id` to an array of line codes serving that station.
3. **station_metrics.json**: Contains pre-calculated metrics like `hub_degree`.
4. **lines_master.json**: Metadata for each line, including full names and colors.

*Note: For detailed dataset schemas, refer to the GUNO V6 documentation.*

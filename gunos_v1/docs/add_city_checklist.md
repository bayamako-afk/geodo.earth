# Add City Checklist

Follow these steps to add a new city to the GUNOS V1 platform.

## 1. Data Preparation (GUNO V6)

- [ ] Create directory `guno_v6/cities/<city_id>/`
- [ ] Generate or obtain the 4 required datasets and place them in `datasets/` (or `dataset/`):
  - [ ] `station_graph.json`
  - [ ] `station_lines.json`
  - [ ] `station_metrics.json`
  - [ ] `lines_master.json`
- [ ] Create `city_profile.json` in the city root directory.
- [ ] Verify `city_profile.json` contains valid `datasets` paths relative to the `guno_v6` root.
- [ ] Set `routes.featured_lines` in the profile for map header badges.
- [ ] Define initial `scoring` parameters (especially `hub_threshold`).

## 2. Platform Registration (GUNOS V1)

- [ ] Open `gunos_v1/config/city_registry.json`.
- [ ] Add a new object to the `cities` array:
  ```json
  {
    "city_id": "your_city",
    "display_name": "Full Name",
    "display_label": "SHORT",
    "profile": "../guno_v6/cities/your_city/city_profile.json",
    "ui_trait": "brief descriptive phrase",
    "stats": {
      "node_count": 0,
      "avg_score": 0.0,
      "max_score": 0.0,
      "hub_pct": 0
    }
  }
  ```
- [ ] Calculate or estimate the `stats` values for the new city to display in the comparison panel.

## 3. UI Adjustments

- [ ] Check if the featured lines specified in `city_profile.json` have defined colors in `gunos_v1/src/ui/map_panel.js` (`_lineColor` helper function). If not, add them.

## 4. Testing & Balancing

- [ ] Open `gunos_v1/index.html?city=your_city` in a browser.
- [ ] Verify the map renders correctly without errors.
- [ ] Verify the City Compare panel shows the new city and its stats.
- [ ] Run several AUTO games to observe scoring behavior.
- [ ] Adjust `scoring.scale_factor` in `city_profile.json` to ensure the final scores align roughly with the Tokyo baseline (around 100-150 points for a typical win).
- [ ] Adjust `scoring.hub_threshold` if necessary based on the city's specific topology.

## 5. Deployment

- [ ] **Crucial for CDN**: Open `gunos_v1/src/city/city_loader.js` and increment `REGISTRY_VERSION` (e.g., from `'2'` to `'3'`) to force the CDN to serve the new registry.
- [ ] Bump cache buster versions in `index.html` and relevant JS files (like `city_loader.js` in `main.js`) to ensure users get the new code.
- [ ] Commit all new files and changes.
- [ ] Push to GitHub.

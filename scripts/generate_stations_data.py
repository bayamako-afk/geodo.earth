#!/usr/bin/env python3
"""
Generate stations_data.js from all GeoJSON files in the repository.
Reads lines/ and stations/ directories, builds GEO_LINES and GEO_STATIONS arrays.
"""

import json
import os
import re
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LINES_DIR = os.path.join(REPO_ROOT, "guno_v5/src/geojson/lines")
STATIONS_DIR = os.path.join(REPO_ROOT, "guno_v5/src/geojson/stations")
OUTPUT_PATH = os.path.join(REPO_ROOT, "guno_v5/src/editor/stations_data.js")

def load_all_lines():
    """Load all line GeoJSON files and extract metadata."""
    lines = []
    for fname in sorted(os.listdir(LINES_DIR)):
        if not fname.endswith(".geojson"):
            continue
        slug = fname.replace(".geojson", "")
        fpath = os.path.join(LINES_DIR, fname)
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
            if not data.get("features"):
                continue
            props = data["features"][0]["properties"]
            lines.append({
                "slug": slug,
                "line_code": props.get("line_code", ""),
                "name_ja": props.get("official_name", props.get("name", "")),
                "color": props.get("color", "#999999"),
                "operator": props.get("operator", ""),
                "props": props,
            })
        except Exception as e:
            print(f"  Warning: failed to load {fname}: {e}")
    return lines

def load_all_stations(lines):
    """Load all station GeoJSON files and extract station data."""
    # Build slug -> line_code map
    slug_to_lc = {l["slug"]: l["line_code"] for l in lines}

    all_stations = []
    for fname in sorted(os.listdir(STATIONS_DIR)):
        if not fname.endswith("_stations.geojson"):
            continue
        slug = fname.replace("_stations.geojson", "")
        fpath = os.path.join(STATIONS_DIR, fname)
        try:
            with open(fpath, encoding="utf-8") as f:
                data = json.load(f)
            lc = slug_to_lc.get(slug, "")
            for feat in data.get("features", []):
                props = feat["properties"]
                coords = feat["geometry"]["coordinates"]
                order = props.get("station_order", 0)
                name_ja = props.get("name", "")
                all_stations.append({
                    "id": f"{lc}_{str(order).zfill(2)}",
                    "lc": lc,
                    "slug": slug,
                    "order": order,
                    "name_ja": name_ja,
                    "name_en": props.get("name_en", ""),
                    "coords": coords,
                    "cross_lines": [],  # will be computed below
                })
        except Exception as e:
            print(f"  Warning: failed to load {fname}: {e}")
    return all_stations

def compute_cross_lines(all_stations, threshold=0.003):
    """Compute cross_lines by finding stations with nearby coordinates from different lines."""
    # Build spatial index: group by rounded coordinates
    from collections import defaultdict
    coord_map = defaultdict(list)
    for st in all_stations:
        lon, lat = st["coords"]
        key = (round(lon, 3), round(lat, 3))
        coord_map[key].append(st)

    # For each station, find nearby stations from other lines
    for st in all_stations:
        lon, lat = st["coords"]
        cross = set()
        # Check nearby grid cells
        for dlon in [-0.002, 0, 0.002]:
            for dlat in [-0.002, 0, 0.002]:
                key = (round(lon + dlon, 3), round(lat + dlat, 3))
                for other in coord_map.get(key, []):
                    if other["lc"] != st["lc"] and other["lc"]:
                        # Check actual distance
                        dist = ((other["coords"][0] - lon) ** 2 + (other["coords"][1] - lat) ** 2) ** 0.5
                        if dist < threshold:
                            cross.add(other["lc"])
        st["cross_lines"] = sorted(cross)

    return all_stations

def update_geo_lines_station_counts(lines, all_stations):
    """Update station counts in lines based on actual loaded stations."""
    from collections import Counter
    counts = Counter(st["slug"] for st in all_stations)
    for line in lines:
        line["station_count"] = counts.get(line["slug"], 0)
    return lines

def format_js(lines, all_stations):
    """Format as JavaScript module."""
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")
    lines_js = json.dumps(
        [{"slug": l["slug"], "line_code": l["line_code"], "name_ja": l["name_ja"],
          "color": l["color"], "operator": l["operator"],
          "station_count": l["station_count"]} for l in lines],
        ensure_ascii=False, indent=2
    )
    stations_js = json.dumps(
        [{"id": s["id"], "lc": s["lc"], "slug": s["slug"], "order": s["order"],
          "name_ja": s["name_ja"], "name_en": s["name_en"],
          "coords": s["coords"], "cross_lines": s["cross_lines"]} for s in all_stations],
        ensure_ascii=False, indent=2
    )
    return f"""// Auto-generated from geojson — DO NOT EDIT MANUALLY
// Generated: {now}

export const GEO_LINES = {lines_js};

export const GEO_STATIONS = {stations_js};
"""

def main():
    print("Loading lines...", flush=True)
    lines = load_all_lines()
    print(f"  {len(lines)} lines found", flush=True)

    print("Loading stations...", flush=True)
    all_stations = load_all_stations(lines)
    print(f"  {len(all_stations)} stations found", flush=True)

    print("Computing cross_lines...", flush=True)
    all_stations = compute_cross_lines(all_stations)

    print("Updating station counts...", flush=True)
    lines = update_geo_lines_station_counts(lines, all_stations)

    print("Writing stations_data.js...", flush=True)
    js_content = format_js(lines, all_stations)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(js_content)
    print(f"  Written: {OUTPUT_PATH}", flush=True)

    # Summary
    print("\n=== Summary ===")
    for l in lines:
        print(f"  {l['slug']:40s} {l['line_code']:8s} {l['station_count']:3d} stations")

if __name__ == "__main__":
    main()

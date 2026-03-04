#!/usr/bin/env python3
"""
fetch_line_v2.py — Fetch railway GeoJSON from OSM Overpass API.

Improvements over v1:
  - Automatically detects up/down (上り/下り) relation pairs
  - Stores each direction as a separate LineString in GeometryCollection
    (matches the Yamanote Line format: 2 LineStrings = double track)
  - Filters out unrelated lines that share the same ref code
  - Robust stop deduplication with name-based ordering

Usage:
  python3 fetch_line_v2.py <route_id> <csv_path> <output_dir> [--force]

Options:
  --force   Overwrite existing files even if they already have data
"""

import sys
import json
import time
import re
import requests
import csv
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "geodo.earth-builder/1.0 (https://geodo.earth)"}

# Japanese operator keywords to filter OSM results to Japan
JAPAN_OPERATORS = [
    "旅客鉄道", "東日本", "西日本", "東海", "九州", "北海道", "四国",
    "東急", "京王", "小田急", "東武", "西武", "京成", "京急", "新京成",
    "相鉄", "東京メトロ", "都営", "ゆりかもめ", "臨海", "多摩都市",
    "埼玉高速", "東葉高速", "北総", "つくばエクスプレス", "りんかい",
    "横浜市", "横浜高速", "江ノ島", "湘南モノレール",
    "阪急", "阪神", "近鉄", "南海", "京阪", "大阪メトロ",
    "名古屋市", "名鉄", "地下鉄", "市営",
]

# Keywords indicating a direction-specific relation (up/down)
UP_KEYWORDS   = ["上り", "内回り", "外回り（上り）", "inbound"]
DOWN_KEYWORDS = ["下り", "外回り", "outbound"]
LOOP_KEYWORDS = ["外回り", "内回り"]  # 環状線

def overpass_query(query, retries=5, wait=8):
    """POST a query to Overpass API with retry logic."""
    for attempt in range(retries):
        try:
            resp = requests.post(
                OVERPASS_URL,
                data={"data": query},
                headers=HEADERS,
                timeout=120
            )
            if resp.status_code == 200:
                return resp.json()
            elif resp.status_code == 429:
                print(f"  [rate limit] waiting {wait}s...", flush=True)
                time.sleep(wait)
                wait = min(wait * 2, 90)
            elif resp.status_code in (504, 502, 503):
                print(f"  [HTTP {resp.status_code}] waiting {wait}s...", flush=True)
                time.sleep(wait)
            else:
                print(f"  [HTTP {resp.status_code}] {resp.text[:200]}", flush=True)
                time.sleep(wait)
        except requests.exceptions.Timeout:
            print(f"  [timeout] attempt {attempt+1}/{retries}", flush=True)
            time.sleep(wait)
        except Exception as e:
            print(f"  [error] {e}", flush=True)
            time.sleep(wait)
    return None

def is_japan_operator(tags):
    """Return True if this relation's operator is a Japanese railway."""
    op = tags.get("operator", "") + tags.get("operator:en", "")
    if not op:
        # If no operator tag, check network or name
        net = tags.get("network", "")
        name = tags.get("name", "")
        return any(kw in net or kw in name for kw in JAPAN_OPERATORS)
    return any(kw in op for kw in JAPAN_OPERATORS)

def classify_direction(tags):
    """
    Classify a relation as 'up', 'down', 'loop_outer', 'loop_inner', or 'unknown'.
    Based on name, from/to, and direction tags.
    """
    name = tags.get("name", "") + tags.get("name:ja", "")
    direction = tags.get("direction", "")
    from_tag = tags.get("from", "")
    to_tag = tags.get("to", "")

    # Loop lines (環状線)
    if "内回り" in name or "inbound" in direction:
        return "loop_inner"
    if "外回り" in name or "outbound" in direction:
        return "loop_outer"

    # Directional
    if any(kw in name for kw in UP_KEYWORDS):
        return "up"
    if any(kw in name for kw in DOWN_KEYWORDS):
        return "down"

    # Infer from from/to tags (e.g. 東京→高尾 = down, 高尾→東京 = up)
    # We can't reliably infer direction from station names alone, so leave as unknown
    return "unknown"

def name_match_score(osm_name, official_name):
    """
    Score how well an OSM relation name matches the official line name.
    Higher = better match. Returns 0 if clearly unrelated.
    Scoring:
      20 = exact match after normalization
      15 = official_name is fully contained in OSM name (e.g. '中央線快速' in 'JR中央線快速（下り）')
      10 = OSM name is fully contained in official_name
       5 = high character overlap
       1 = low overlap
    """
    if not osm_name:
        return 0
    # Normalize: strip JR prefix, direction suffixes, spaces, line codes
    def norm(s):
        s = re.sub(r'[\s\u3000]', '', s)
        s = s.replace('JR', '')
        s = re.sub(r'（(上り|下り|外回り|内回り|inbound|outbound)）', '', s)
        s = re.sub(r'[A-Z]{1,3}$', '', s)  # trailing line codes like JC, JY
        return s
    on = norm(osm_name)
    fn = norm(official_name)
    if on == fn:
        return 20
    if fn in on:
        return 15
    if on in fn:
        return 10
    # Character overlap
    overlap = sum(1 for c in fn if c in on)
    total = len(fn)
    if total == 0:
        return 0
    ratio = overlap / total
    if ratio >= 0.8:
        return 5
    if ratio >= 0.5:
        return 3
    return 1 if overlap > 0 else 0

def find_relation_candidates(line_code, official_name, operator_hint=""):
    """
    Find OSM relation IDs for this line.
    Returns a list of dicts: {id, name, direction, tags}
    Applies name-based filtering to avoid mixing unrelated lines that share ref codes.
    """
    route_types = "train|subway|light_rail|monorail|tram"

    # Strategy 1: ref code + Japan operator
    query = f"""
[out:json][timeout:60];
relation["ref"="{line_code}"]["route"~"{route_types}"];
out tags;
"""
    data = overpass_query(query)
    time.sleep(3)

    candidates = []
    if data:
        for e in data.get("elements", []):
            tags = e.get("tags", {})
            if tags.get("route") not in ("train", "subway", "light_rail", "monorail", "tram"):
                continue
            if not is_japan_operator(tags):
                continue
            direction = classify_direction(tags)
            candidates.append({
                "id": e["id"],
                "name": tags.get("name", ""),
                "direction": direction,
                "tags": tags,
                "score": name_match_score(tags.get("name", ""), official_name)
            })

    if candidates:
        print(f"  Found {len(candidates)} candidates by ref={line_code}", flush=True)
        for c in candidates:
            print(f"    id={c['id']}  name={c['name']}  dir={c['direction']}  score={c['score']}", flush=True)

        # Filter by name score: keep only those with score >= max_score * 0.8
        # This ensures '中央線快速'(score=20) excludes '中央線'(score=10) etc.
        max_score = max(c["score"] for c in candidates)
        if max_score >= 3:
            threshold = max(3, max_score * 0.8)
            filtered = [c for c in candidates if c["score"] >= threshold]
            if filtered:
                print(f"  After name filter: {len(filtered)} candidates (max_score={max_score}, threshold={threshold})", flush=True)
                return filtered
        return candidates

    # Strategy 2: fallback by name search
    print(f"  ref={line_code} found nothing, trying name search...", flush=True)
    for name_variant in [official_name, official_name.replace("線", "")]:
        query = f"""
[out:json][timeout:60];
relation["name"~"{name_variant}"]["route"~"{route_types}"];
out tags;
"""
        data = overpass_query(query)
        time.sleep(3)
        if data:
            for e in data.get("elements", []):
                tags = e.get("tags", {})
                if tags.get("route") not in ("train", "subway", "light_rail", "monorail", "tram"):
                    continue
                if not is_japan_operator(tags):
                    continue
                direction = classify_direction(tags)
                candidates.append({
                    "id": e["id"],
                    "name": tags.get("name", ""),
                    "direction": direction,
                    "tags": tags
                })
        if candidates:
            break

    print(f"  Found {len(candidates)} candidates by name", flush=True)
    for c in candidates:
        print(f"    id={c['id']}  name={c['name']}  dir={c['direction']}", flush=True)
    return candidates

def select_direction_pair(candidates, official_name):
    """
    From a list of candidates, select the best up/down (or outer/inner) pair.
    Returns (rel_id_a, rel_id_b) — two IDs for double track.
    Falls back to single relation if only one is found.
    """
    # Separate by direction
    downs  = [c for c in candidates if c["direction"] == "down"]
    ups    = [c for c in candidates if c["direction"] == "up"]
    outers = [c for c in candidates if c["direction"] == "loop_outer"]
    inners = [c for c in candidates if c["direction"] == "loop_inner"]
    unknowns = [c for c in candidates if c["direction"] == "unknown"]

    # Loop lines (山手線 etc.)
    if outers and inners:
        print(f"  Loop line detected: outer={outers[0]['id']}, inner={inners[0]['id']}", flush=True)
        return outers[0]["id"], inners[0]["id"]

    # Directional lines
    if downs and ups:
        print(f"  Direction pair: down={downs[0]['id']}, up={ups[0]['id']}", flush=True)
        return downs[0]["id"], ups[0]["id"]

    # Only one direction found — try to find the pair by name pattern
    if downs and not ups:
        # Try to find the up relation by replacing 下り→上り in name
        down_name = downs[0]["name"]
        up_name = down_name.replace("下り", "上り").replace("（下り）", "（上り）")
        if up_name != down_name:
            print(f"  Only down found, searching for up: {up_name}", flush=True)
            query = f"""
[out:json][timeout:60];
relation["name"="{up_name}"]["route"~"train|subway|light_rail|monorail|tram"];
out tags;
"""
            data = overpass_query(query)
            time.sleep(3)
            if data:
                for e in data.get("elements", []):
                    tags = e.get("tags", {})
                    if is_japan_operator(tags):
                        print(f"  Found up pair: id={e['id']}", flush=True)
                        return downs[0]["id"], e["id"]
        return downs[0]["id"], None

    if ups and not downs:
        return ups[0]["id"], None

    # Unknown direction — use first two if available
    if len(unknowns) >= 2:
        print(f"  Unknown direction, using first 2: {unknowns[0]['id']}, {unknowns[1]['id']}", flush=True)
        return unknowns[0]["id"], unknowns[1]["id"]
    if unknowns:
        return unknowns[0]["id"], None

    return None, None

def fetch_relation_geom(rel_id):
    """Fetch full geometry (ways with coordinates) for a relation."""
    query = f"""
[out:json][timeout:120];
relation({rel_id});
out geom qt;
"""
    return overpass_query(query)

def fetch_relation_stops(rel_id):
    """Fetch stop nodes with full tags for a relation."""
    # Try role=stop first
    query = f"""
[out:json][timeout:60];
relation({rel_id});
node(r:"stop");
out body;
"""
    data = overpass_query(query)
    if data and data.get("elements"):
        return data["elements"]

    time.sleep(3)
    # Try stop_entry_only
    query = f"""
[out:json][timeout:60];
relation({rel_id});
node(r:"stop_entry_only");
out body;
"""
    data = overpass_query(query)
    if data and data.get("elements"):
        return data["elements"]

    return []

def extract_track_coords(data):
    """Extract ordered way coordinates from relation geom response."""
    coords = []
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        for member in el.get("members", []):
            if member.get("type") == "way":
                geom = member.get("geometry", [])
                if geom:
                    coords.extend([[pt["lon"], pt["lat"]] for pt in geom])
    return coords

def extract_stops_from_geom(data):
    """Extract stop nodes from geom response (may lack name tags)."""
    stops = []
    seen = set()
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        for member in el.get("members", []):
            if member.get("type") != "node":
                continue
            if member.get("role", "") not in ("stop", "stop_entry_only", "stop_exit_only"):
                continue
            key = (round(member.get("lon", 0), 5), round(member.get("lat", 0), 5))
            if key in seen:
                continue
            seen.add(key)
            tags = member.get("tags", {})
            name = tags.get("name:ja") or tags.get("name") or ""
            stops.append({"name": name, "lon": member["lon"], "lat": member["lat"]})
    return stops

def parse_stop_nodes(nodes):
    """Parse stop nodes with tags into station list."""
    stops = []
    seen_names = set()
    for node in nodes:
        if node.get("type") != "node":
            continue
        tags = node.get("tags", {})
        name = tags.get("name:ja") or tags.get("name") or ""
        if not name or name in seen_names:
            continue
        seen_names.add(name)
        stops.append({"name": name, "lon": node["lon"], "lat": node["lat"]})
    return stops

def build_line_geojson(row, coords_list):
    """
    Build line GeoJSON with GeometryCollection.
    coords_list: list of coordinate arrays (one per direction).
    """
    props = {
        "type": "relation",
        "route": "train",
        "name": row["official_name"],
        "operator": row["operator"],
        "ref": row["line_code"],
        "line_slug": row["line_slug"],
        "route_id": row["route_id"],
        "operator_slug": row["operator_slug"],
        "official_name": row["official_name"],
        "name_en": row["name_en"],
        "data_type": "tracks",
        "source": row["source"],
        "source_url": row["source_url"],
        "aliases": row["aliases"],
        "color": row["color"],
        "line_code": row["line_code"],
        "railway": row["railway"]
    }
    geometries = [
        {"type": "LineString", "coordinates": c}
        for c in coords_list if c
    ]
    return {
        "type": "FeatureCollection",
        "name": row["line_slug"],
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": [{
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "GeometryCollection", "geometries": geometries}
        }]
    }

def build_stations_geojson(row, stations):
    """Build stations GeoJSON from station list."""
    features = []
    for i, st in enumerate(stations, 1):
        props = {
            "name": st["name"],
            "route_id": row["route_id"],
            "line_slug": row["line_slug"],
            "operator_slug": row["operator_slug"],
            "official_name": row["official_name"],
            "name_en": row["name_en"],
            "data_type": "stations",
            "source": row["source"],
            "source_url": row["source_url"],
            "station_order": i,
            "station_id": i,
            "aliases": row["aliases"],
            "color": row["color"],
            "line_code": row["line_code"],
            "operator": row["operator"],
            "railway": row["railway"]
        }
        features.append({
            "type": "Feature",
            "properties": props,
            "geometry": {"type": "Point", "coordinates": [st["lon"], st["lat"]]}
        })
    return {
        "type": "FeatureCollection",
        "name": f"{row['line_slug']}_stations",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": features
    }

def main():
    if len(sys.argv) < 4:
        print("Usage: fetch_line_v2.py <route_id> <csv_path> <output_dir> [--force]")
        sys.exit(1)

    route_id = sys.argv[1]
    csv_path = sys.argv[2]
    output_dir = sys.argv[3]
    force = "--force" in sys.argv

    rows = {}
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows[r["route_id"]] = r

    if route_id not in rows:
        print(f"route_id {route_id} not found in CSV")
        sys.exit(1)

    row = rows[route_id]
    slug = row["line_slug"]
    line_code = row["line_code"]
    print(f"\n[{route_id}] {row['official_name']} ({slug}, code={line_code})", flush=True)

    lines_dir = os.path.join(output_dir, "lines")
    stations_dir = os.path.join(output_dir, "stations")
    os.makedirs(lines_dir, exist_ok=True)
    os.makedirs(stations_dir, exist_ok=True)

    line_path = os.path.join(lines_dir, f"{slug}.geojson")
    stations_path = os.path.join(stations_dir, f"{slug}_stations.geojson")

    # Skip if already exists and not forced
    if not force and os.path.exists(line_path) and os.path.exists(stations_path):
        with open(stations_path) as f:
            sdata = json.load(f)
        if sdata.get("features"):
            n = len(sdata["features"])
            print(f"  Already exists ({n} stations). Use --force to overwrite.", flush=True)
            sys.exit(0)

    # Step 1: Find candidates
    print(f"  Searching OSM for ref={line_code}...", flush=True)
    candidates = find_relation_candidates(line_code, row["official_name"], row["operator"])

    if not candidates:
        print(f"  WARNING: No relations found. Writing empty files.", flush=True)
        line_geojson = build_line_geojson(row, [])
        stations_geojson = build_stations_geojson(row, [])
        with open(line_path, "w", encoding="utf-8") as f:
            json.dump(line_geojson, f, ensure_ascii=False, separators=(",", ": "))
        with open(stations_path, "w", encoding="utf-8") as f:
            json.dump(stations_geojson, f, ensure_ascii=False, separators=(",", ": "))
        print(f"  Written empty files.", flush=True)
        sys.exit(0)

    # Step 2: Select direction pair (up + down, or outer + inner)
    rel_a, rel_b = select_direction_pair(candidates, row["official_name"])
    print(f"  Selected: rel_a={rel_a}, rel_b={rel_b}", flush=True)

    if not rel_a:
        print(f"  WARNING: Could not determine primary relation.", flush=True)
        sys.exit(1)

    # Step 3: Fetch geometry and stops for each relation
    coords_a, coords_b = [], []
    all_stops = []
    seen_stop_names = set()

    def fetch_and_collect(rel_id, label):
        """Fetch geom + stops for one relation, return (coords, stops)."""
        time.sleep(3)
        print(f"  [{label}] Fetching geom for relation {rel_id}...", flush=True)
        geom_data = fetch_relation_geom(rel_id)
        coords = []
        stops = []
        if geom_data:
            coords = extract_track_coords(geom_data)
            # Try to get stop names from geom (may be empty)
            stops = [s for s in extract_stops_from_geom(geom_data) if s["name"]]

        if not stops:
            time.sleep(3)
            print(f"  [{label}] Fetching stops for relation {rel_id}...", flush=True)
            stop_nodes = fetch_relation_stops(rel_id)
            stops = parse_stop_nodes(stop_nodes)

        print(f"  [{label}] {len(coords)} track pts, {len(stops)} stops", flush=True)
        return coords, stops

    coords_a, stops_a = fetch_and_collect(rel_a, "dir-A")
    for s in stops_a:
        if s["name"] not in seen_stop_names:
            seen_stop_names.add(s["name"])
            all_stops.append(s)

    if rel_b:
        coords_b, stops_b = fetch_and_collect(rel_b, "dir-B")
        for s in stops_b:
            if s["name"] not in seen_stop_names:
                seen_stop_names.add(s["name"])
                all_stops.append(s)

    # Step 4: Sort stations by longitude (east→west for most Tokyo lines)
    # Detect if line runs mostly E-W or N-S
    if all_stops:
        lons = [s["lon"] for s in all_stops]
        lats = [s["lat"] for s in all_stops]
        lon_range = max(lons) - min(lons)
        lat_range = max(lats) - min(lats)
        if lon_range >= lat_range:
            # E-W line: sort east→west (descending lon)
            all_stops.sort(key=lambda s: -s["lon"])
        else:
            # N-S line: sort north→south (descending lat)
            all_stops.sort(key=lambda s: -s["lat"])

    # Step 5: Build GeoJSON
    coords_list = [c for c in [coords_a, coords_b] if c]
    line_geojson = build_line_geojson(row, coords_list)
    stations_geojson = build_stations_geojson(row, all_stops)

    # Step 6: Write files
    with open(line_path, "w", encoding="utf-8") as f:
        json.dump(line_geojson, f, ensure_ascii=False, separators=(",", ": "))
    print(f"  Written: {line_path}", flush=True)

    with open(stations_path, "w", encoding="utf-8") as f:
        json.dump(stations_geojson, f, ensure_ascii=False, separators=(",", ": "))
    print(f"  Written: {stations_path}", flush=True)

    # Summary
    total_pts = sum(len(c) for c in coords_list)
    n_geoms = len(coords_list)
    result = {
        "route_id": route_id,
        "slug": slug,
        "name": row["official_name"],
        "geometries": n_geoms,
        "track_points": total_pts,
        "station_count": len(all_stops),
        "status": "ok" if all_stops else "empty"
    }
    result_path = os.path.join(output_dir, f"result_{slug}.json")
    with open(result_path, "w") as f:
        json.dump(result, f)
    print(f"\n  ✓ Done: {n_geoms} LineStrings, {total_pts} track pts, {len(all_stops)} stations", flush=True)

if __name__ == "__main__":
    main()

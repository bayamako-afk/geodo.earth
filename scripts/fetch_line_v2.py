#!/usr/bin/env python3
"""
Fetch a single railway line from OSM Overpass API and generate GeoJSON files.
Uses ref (line_code) to find the correct relation.
Usage: python3 fetch_line_v2.py <route_id> <csv_path> <output_dir>
"""

import sys
import json
import time
import requests
import csv
import os

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "geodo.earth-builder/1.0 (https://geodo.earth)"}

def overpass_query(query, retries=4, wait=8):
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
                wait = min(wait * 2, 60)
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

def find_relation_ids(line_code, official_name, railway):
    """Find OSM relation IDs for this line using ref code."""
    # Try by ref code first
    query = f"""
[out:json][timeout:60];
relation["ref"="{line_code}"]["route"~"train|subway|light_rail|monorail|tram"]["operator"~"東日本|東急|京王|小田急|東武|西武|京成|京急|新京成|相鉄|東京メトロ|都営|ゆりかもめ|臨海|多摩都市"];
out tags;
"""
    data = overpass_query(query)
    if data:
        ids = [e["id"] for e in data.get("elements", [])
               if e.get("tags", {}).get("route") in ("train", "subway", "light_rail", "monorail", "tram")]
        if ids:
            return ids

    # Fallback: search by name
    for name_variant in [official_name, official_name.replace("線", "").strip()]:
        query = f"""
[out:json][timeout:60];
relation["name"~"{name_variant}"]["route"~"train|subway|light_rail|monorail|tram"];
out tags;
"""
        data = overpass_query(query)
        if data:
            ids = [e["id"] for e in data.get("elements", [])
                   if e.get("tags", {}).get("route") in ("train", "subway", "light_rail", "monorail", "tram")]
            if ids:
                return ids

    return []

def fetch_relation_geom(rel_id):
    """Fetch full geometry for a relation."""
    query = f"""
[out:json][timeout:120];
relation({rel_id});
out geom qt;
"""
    return overpass_query(query)

def fetch_relation_stops(rel_id):
    """Fetch stop nodes with tags for a relation."""
    query = f"""
[out:json][timeout:60];
relation({rel_id});
node(r:"stop");
out body;
"""
    data = overpass_query(query)
    if data:
        return data.get("elements", [])

    # Also try stop_entry_only
    query = f"""
[out:json][timeout:60];
(
  relation({rel_id});
  node(r:"stop");
  node(r:"stop_entry_only");
  node(r:"stop_exit_only");
);
out body;
"""
    data = overpass_query(query)
    return data.get("elements", []) if data else []

def extract_track_coords(data):
    """Extract way coordinates from relation geom response."""
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
    """Extract stop nodes from relation geom (fallback, no name tags)."""
    stops = []
    seen_pos = set()
    for el in data.get("elements", []):
        if el.get("type") != "relation":
            continue
        for member in el.get("members", []):
            if member.get("type") == "node" and member.get("role", "") in ("stop", "stop_entry_only", "stop_exit_only"):
                pos = (member.get("lon"), member.get("lat"))
                if pos not in seen_pos:
                    seen_pos.add(pos)
                    tags = member.get("tags", {})
                    name = tags.get("name:ja") or tags.get("name") or ""
                    stops.append({
                        "name": name,
                        "lon": member["lon"],
                        "lat": member["lat"]
                    })
    return stops

def parse_stop_nodes(nodes):
    """Parse stop nodes with tags."""
    stops = []
    seen_names = set()
    for node in nodes:
        if node.get("type") != "node":
            continue
        tags = node.get("tags", {})
        name = tags.get("name:ja") or tags.get("name") or ""
        pos_key = (round(node.get("lon", 0), 5), round(node.get("lat", 0), 5))
        if name and name not in seen_names:
            seen_names.add(name)
            stops.append({
                "name": name,
                "lon": node["lon"],
                "lat": node["lat"]
            })
    return stops

def build_line_geojson(row, coords):
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
    if coords:
        geometry = {
            "type": "GeometryCollection",
            "geometries": [{"type": "LineString", "coordinates": coords}]
        }
    else:
        geometry = {"type": "GeometryCollection", "geometries": []}

    return {
        "type": "FeatureCollection",
        "name": row["line_slug"],
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": [{"type": "Feature", "properties": props, "geometry": geometry}]
    }

def build_stations_geojson(row, stations):
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
        print("Usage: fetch_line_v2.py <route_id> <csv_path> <output_dir>")
        sys.exit(1)

    route_id = sys.argv[1]
    csv_path = sys.argv[2]
    output_dir = sys.argv[3]

    rows = {}
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for r in reader:
            rows[r["route_id"]] = r

    if route_id not in rows:
        print(f"route_id {route_id} not found")
        sys.exit(1)

    row = rows[route_id]
    slug = row["line_slug"]
    line_code = row["line_code"]
    print(f"[{route_id}] {row['official_name']} ({slug}, code={line_code})", flush=True)

    lines_dir = os.path.join(output_dir, "lines")
    stations_dir = os.path.join(output_dir, "stations")
    os.makedirs(lines_dir, exist_ok=True)
    os.makedirs(stations_dir, exist_ok=True)

    line_path = os.path.join(lines_dir, f"{slug}.geojson")
    stations_path = os.path.join(stations_dir, f"{slug}_stations.geojson")

    if os.path.exists(line_path) and os.path.exists(stations_path):
        # Check if non-empty
        with open(stations_path) as f:
            sdata = json.load(f)
        if sdata.get("features"):
            print(f"  Already exists ({len(sdata['features'])} stations), skipping.", flush=True)
            sys.exit(0)

    # Find relation IDs
    print(f"  Finding relations...", flush=True)
    rel_ids = find_relation_ids(line_code, row["official_name"], row["railway"])
    print(f"  Found relation IDs: {rel_ids}", flush=True)

    if not rel_ids:
        print(f"  WARNING: No relations found, writing empty files.", flush=True)
        line_geojson = build_line_geojson(row, [])
        stations_geojson = build_stations_geojson(row, [])
    else:
        # Use first relation for tracks, merge stops from all
        all_coords = []
        all_stops = []
        seen_stop_names = set()

        for rel_id in rel_ids[:3]:  # limit to 3 relations
            time.sleep(2)  # be polite
            print(f"  Fetching geom for relation {rel_id}...", flush=True)
            geom_data = fetch_relation_geom(rel_id)
            if geom_data:
                coords = extract_track_coords(geom_data)
                all_coords.extend(coords)
                # Try to get stops from geom first
                stops_from_geom = extract_stops_from_geom(geom_data)
                for s in stops_from_geom:
                    if s["name"] and s["name"] not in seen_stop_names:
                        seen_stop_names.add(s["name"])
                        all_stops.append(s)

            time.sleep(2)
            print(f"  Fetching stops for relation {rel_id}...", flush=True)
            stop_nodes = fetch_relation_stops(rel_id)
            stops = parse_stop_nodes(stop_nodes)
            for s in stops:
                if s["name"] and s["name"] not in seen_stop_names:
                    seen_stop_names.add(s["name"])
                    all_stops.append(s)

        print(f"  Total: {len(all_coords)} track points, {len(all_stops)} stations", flush=True)
        line_geojson = build_line_geojson(row, all_coords)
        stations_geojson = build_stations_geojson(row, all_stops)

    with open(line_path, "w", encoding="utf-8") as f:
        json.dump(line_geojson, f, ensure_ascii=False, separators=(",", ": "))
    print(f"  Written: {line_path}", flush=True)

    with open(stations_path, "w", encoding="utf-8") as f:
        json.dump(stations_geojson, f, ensure_ascii=False, separators=(",", ": "))
    print(f"  Written: {stations_path}", flush=True)

    result = {
        "route_id": route_id,
        "slug": slug,
        "name": row["official_name"],
        "track_points": len(line_geojson["features"][0]["geometry"].get("geometries", [{}])[0].get("coordinates", [])) if line_geojson["features"][0]["geometry"]["geometries"] else 0,
        "station_count": len(stations_geojson["features"]),
        "status": "ok" if stations_geojson["features"] else "empty"
    }
    result_path = os.path.join(output_dir, f"result_{slug}.json")
    with open(result_path, "w") as f:
        json.dump(result, f)
    print(f"  Result: {result}", flush=True)

if __name__ == "__main__":
    main()

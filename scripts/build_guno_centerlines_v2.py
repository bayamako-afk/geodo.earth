#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
GUNO Centerline Builder (derived layer) from 2-track line GeoJSONs.

Input:
- lines_dir: 2-line tracks (LineString/MultiLineString), EPSG:4326
- stations_dir: station points, EPSG:4326
  - Station files are expected as: <route_stem>_stations.geojson (preferred)
    e.g. tokyo-metro-ginza_stations.geojson

Output:
- out_dir/<route_stem>_centerline.geojson  (EPSG:4326)
- out_dir/_summary.csv  (per route stats, warnings)

Method (robust & simple):
1) Read route track lines, keep only LineString/MultiLineString, explode to LineString parts.
2) Project to metric CRS (auto UTM by bounds).
3) Remove/cut station-area complexity:
   - Build station buffer (default 80m) and remove line portions within buffer.
4) Choose two longest candidate LineStrings as left/right tracks.
5) Sample points along one track; find nearest points on the other; connect midpoints => centerline.
6) Simplify, merge, project back to EPSG:4326, write GeoJSON.

Requirements:
- geopandas
- shapely (>=2.0 recommended)
"""

import argparse
import math
from pathlib import Path
from typing import Optional, List, Tuple, Dict

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Point
from shapely.ops import unary_union, linemerge, nearest_points


# ---------- CRS helpers ----------

def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def project_to_metric(gdf: gpd.GeoDataFrame) -> Tuple[gpd.GeoDataFrame, Optional[str]]:
    """Project geographic CRS to auto UTM; return (projected_gdf, metric_crs_str)."""
    if gdf.crs is None:
        return gdf, None
    if not is_geographic_crs(gdf):
        return gdf, str(gdf.crs)

    minx, miny, maxx, maxy = gdf.total_bounds
    lon = (minx + maxx) / 2.0
    lat = (miny + maxy) / 2.0
    epsg = estimate_utm_epsg(lon, lat)
    out = gdf.to_crs(epsg=epsg)
    return out, str(out.crs)


# ---------- geometry utilities ----------

def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    # explode multilines into lines
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    return g


def read_stations_for_route(stations_dir: Path, route_stem: str) -> Tuple[Optional[gpd.GeoDataFrame], str, Optional[Path]]:
    """
    Try:
      1) <route_stem>_stations.geojson   (preferred)
      2) <route_stem>.geojson           (fallback)
      3) first file whose stem contains route_stem
      4) all_union fallback (union of all station files)
    Returns: (stations_gdf, stations_mode, stations_file_path_if_single)
    stations_mode: exact_suffix | exact | contains | all_union | none
    """
    # 1) exact with "_stations" suffix
    fp1 = stations_dir / f"{route_stem}_stations.geojson"
    if fp1.exists():
        st = gpd.read_file(fp1)
        return st, "exact_suffix", fp1

    # 2) exact stem match
    fp2 = stations_dir / f"{route_stem}.geojson"
    if fp2.exists():
        st = gpd.read_file(fp2)
        return st, "exact", fp2

    # 3) contains match
    contains = [p for p in stations_dir.glob("*.geojson") if route_stem in p.stem]
    if len(contains) >= 1:
        contains.sort(key=lambda p: len(p.stem))
        fp = contains[0]
        st = gpd.read_file(fp)
        return st, "contains", fp

    # 4) fallback union of all station files
    all_files = list(stations_dir.glob("*.geojson"))
    if not all_files:
        return None, "none", None

    frames = []
    for fp in all_files:
        try:
            tmp = gpd.read_file(fp)
            if len(tmp) > 0:
                frames.append(tmp)
        except Exception:
            continue

    if not frames:
        return None, "none", None

    st_all = pd.concat(frames, ignore_index=True)
    st_all = gpd.GeoDataFrame(st_all, geometry="geometry", crs=frames[0].crs)
    return st_all, "all_union", None


def stations_union_buffer(stations_m: gpd.GeoDataFrame, buffer_m: float):
    pts = stations_m[stations_m.geometry.geom_type.isin(["Point", "MultiPoint"])].copy()
    if len(pts) == 0:
        return None
    pts = pts.explode(index_parts=True, ignore_index=True)
    pts = pts[pts.geometry.geom_type == "Point"].copy()
    if len(pts) == 0:
        return None
    buf = pts.buffer(buffer_m)
    return unary_union(buf)


def cut_station_areas(lines_m: gpd.GeoDataFrame, station_buf_union) -> gpd.GeoDataFrame:
    """Remove portions inside station buffer. Result may become MultiLineString; explode again."""
    if station_buf_union is None:
        return lines_m

    def diff_geom(g):
        try:
            return g.difference(station_buf_union)
        except Exception:
            return g

    out = lines_m.copy()
    out["geometry"] = out.geometry.apply(diff_geom)
    out = out[out.geometry.notna() & ~out.geometry.is_empty].copy()
    out = out.explode(index_parts=True, ignore_index=True)
    out = out[out.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    out = out.explode(index_parts=True, ignore_index=True)
    out = out[out.geometry.geom_type == "LineString"].copy()
    out = out[out.geometry.notna() & ~out.geometry.is_empty].copy()
    return out


def orient_same_direction(a: LineString, b: LineString) -> Tuple[LineString, LineString]:
    """Ensure b direction roughly matches a by possibly reversing b."""
    a0, a1 = Point(a.coords[0]), Point(a.coords[-1])
    b0, b1 = Point(b.coords[0]), Point(b.coords[-1])

    d_same = a0.distance(b0) + a1.distance(b1)
    b_rev = LineString(list(reversed(list(b.coords))))
    d_rev = a0.distance(Point(b_rev.coords[0])) + a1.distance(Point(b_rev.coords[-1]))

    return (a, b_rev) if d_rev < d_same else (a, b)


def sample_midline(a: LineString, b: LineString, n: int = 200) -> Optional[LineString]:
    """Build midline by sampling points along a and matching nearest points on b."""
    if a.length == 0 or b.length == 0:
        return None
    a, b = orient_same_direction(a, b)

    pts = []
    for i in range(n + 1):
        t = i / n
        pa = a.interpolate(t, normalized=True)
        try:
            pb = nearest_points(pa, b)[1]
        except Exception:
            continue
        pts.append(((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0))

    if len(pts) < 2:
        return None

    cleaned = [pts[0]]
    for x, y in pts[1:]:
        px, py = cleaned[-1]
        if (x - px) ** 2 + (y - py) ** 2 > 0.25:  # >0.5m
            cleaned.append((x, y))

    if len(cleaned) < 2:
        return None
    return LineString(cleaned)


def best_two_longest(lines: List[LineString]) -> Optional[Tuple[LineString, LineString]]:
    if len(lines) < 2:
        return None
    sorted_lines = sorted(lines, key=lambda g: g.length, reverse=True)
    a = sorted_lines[0]
    for b in sorted_lines[1:]:
        if b.length <= 0:
            continue
        if a.centroid.distance(b.centroid) < 200:  # meters, loose
            return a, b
    return sorted_lines[0], sorted_lines[1]


def simplify_line(line: LineString, tol_m: float) -> LineString:
    try:
        s = line.simplify(tol_m, preserve_topology=True)
        if s.geom_type == "LineString" and len(s.coords) >= 2:
            return s
    except Exception:
        pass
    return line


# ---------- per-route processing ----------

def process_route(
    line_fp: Path,
    stations_dir: Path,
    station_buffer_m: float,
    sample_n: int,
    simplify_m: float,
) -> Dict:
    route_stem = line_fp.stem

    gdf = gpd.read_file(line_fp)
    gdf = gdf[gdf.geometry.notna() & ~gdf.geometry.is_empty].copy()
    gdf = gdf[gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    if len(gdf) == 0:
        return {"route": route_stem, "file": str(line_fp), "status": "NO_LINES"}

    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)

    lines = explode_lines(gdf)

    # stations (NOTE: function returns a tuple; must unpack)
    st, stations_mode, stations_fp = read_stations_for_route(stations_dir, route_stem)
    if st is not None and st.crs is None:
        st = st.set_crs(epsg=4326)

    # project to metric (NOTE: returns a tuple; must unpack)
    lines_m, metric_crs = project_to_metric(lines)
    if metric_crs is None:
        return {"route": route_stem, "file": str(line_fp), "status": "NO_CRS_METRIC", "stations_mode": stations_mode}

    if st is not None:
        st_m = st.to_crs(lines_m.crs) if st.crs != lines_m.crs else st
        station_buf_union = stations_union_buffer(st_m, buffer_m=station_buffer_m)
        lines_cut = cut_station_areas(lines_m, station_buf_union)
    else:
        lines_cut = lines_m

    merged = unary_union(list(lines_cut.geometry))
    merged = linemerge(merged) if merged is not None else None

    candidates: List[LineString] = []
    if merged is None:
        candidates = list(lines_cut.geometry)
    elif merged.geom_type == "LineString":
        candidates = [merged]
    elif merged.geom_type == "MultiLineString":
        candidates = list(merged.geoms)
    else:
        candidates = list(lines_cut.geometry)

    candidates = [c for c in candidates if c is not None and c.geom_type == "LineString" and c.length > 0]
    if len(candidates) > 10:
        candidates = sorted(candidates, key=lambda g: g.length, reverse=True)[:20]

    pair = best_two_longest(candidates)
    if pair is None:
        return {
            "route": route_stem,
            "file": str(line_fp),
            "status": "NOT_ENOUGH_TRACKS_AFTER_CUT",
            "stations_mode": stations_mode,
            "used_station_file": str(stations_fp) if stations_fp else None,
        }

    a, b = pair
    mid = sample_midline(a, b, n=sample_n)
    if mid is None:
        return {
            "route": route_stem,
            "file": str(line_fp),
            "status": "MIDLINE_FAILED",
            "stations_mode": stations_mode,
            "used_station_file": str(stations_fp) if stations_fp else None,
        }

    mid = simplify_line(mid, tol_m=simplify_m)

    out_m = gpd.GeoDataFrame(
        [{
            "route": route_stem,
            "derived": "guno_centerline",
            "stations_mode": stations_mode,
            "station_buffer_m": station_buffer_m if st is not None else None,
            "geometry": mid
        }],
        crs=lines_m.crs
    )
    out_4326 = out_m.to_crs(epsg=4326)

    return {
        "route": route_stem,
        "file": str(line_fp),
        "status": "OK",
        "metric_crs": metric_crs,
        "stations_mode": stations_mode,
        "in_parts": int(len(lines)),
        "cut_parts": int(len(lines_cut)),
        "mid_length_m": float(mid.length),
        "used_station_file": str(stations_fp) if stations_fp else None,
        "out_gdf": out_4326,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines-dir", required=True, help="2-line route GeoJSON folder (EPSG:4326)")
    ap.add_argument("--stations-dir", required=True, help="Station points folder (EPSG:4326)")
    ap.add_argument("--out-dir", required=True, help="Output folder for GUNO centerlines")
    ap.add_argument("--pattern", default="*.geojson", help="Input file pattern (default *.geojson)")
    ap.add_argument("--station-buffer-m", type=float, default=80.0, help="Station buffer meters to remove (default 80)")
    ap.add_argument("--sample-n", type=int, default=200, help="Sampling points along track (default 200)")
    ap.add_argument("--simplify-m", type=float, default=5.0, help="Simplify tolerance in meters (default 5)")
    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    stations_dir = Path(args.stations_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for fp in sorted(lines_dir.glob(args.pattern)):
        try:
            r = process_route(
                fp,
                stations_dir=stations_dir,
                station_buffer_m=args.station_buffer_m,
                sample_n=args.sample_n,
                simplify_m=args.simplify_m
            )
        except Exception as e:
            rows.append({"route": fp.stem, "file": str(fp), "status": f"ERROR: {type(e).__name__}: {e}"})
            continue

        if r.get("status") == "OK":
            out_fp = out_dir / f"{fp.stem}_centerline.geojson"
            r["out_gdf"].to_file(out_fp, driver="GeoJSON")
            rows.append({k: v for k, v in r.items() if k != "out_gdf"})
            rows[-1]["out_file"] = str(out_fp)
        else:
            rows.append({k: v for k, v in r.items() if k != "out_gdf"})

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "_summary.csv", index=False, encoding="utf-8-sig")
    print(f"[OK] wrote outputs into: {out_dir}")
    print(f"[OK] summary: {out_dir / '_summary.csv'}")


if __name__ == "__main__":
    main()

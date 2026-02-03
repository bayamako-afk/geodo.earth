#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import Optional, List, Tuple, Dict

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, MultiLineString
from shapely.ops import unary_union, linemerge, snap


# ---------- CRS helpers ----------
def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def to_metric_crs(gdf: gpd.GeoDataFrame) -> Tuple[gpd.GeoDataFrame, Optional[str]]:
    """Project to local UTM if input is geographic."""
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


# ---------- Geometry helpers ----------
def explode_lines_only(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Keep only line geometries; explode MultiLineString into LineString rows."""
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    return g


def geom_to_lines(geom) -> List[LineString]:
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    if geom.geom_type == "MultiLineString":
        return list(geom.geoms)
    return []


def find_station_file(stations_dir: Path, route_stem: str) -> Optional[Path]:
    """Prefer exact <route>_stations.geojson, else try fuzzy match."""
    exact = stations_dir / f"{route_stem}_stations.geojson"
    if exact.exists():
        return exact
    # fuzzy: any file containing route stem and ending with _stations.geojson
    hits = sorted(stations_dir.glob(f"*{route_stem}*_stations.geojson"))
    return hits[0] if hits else None


def score_line_by_stations(line: LineString, stations_m: gpd.GeoDataFrame, hit_dist_m: float) -> int:
    """Count stations within hit_dist_m from the line."""
    # Fast-ish: buffer then within()
    buf = line.buffer(hit_dist_m)
    return int(stations_m.within(buf).sum())


def merge_top_components(
    lines: List[LineString],
    stations_m: gpd.GeoDataFrame,
    hit_dist_m: float,
    target_ratio: float,
    max_components: int,
) -> Tuple[object, int, float]:
    """
    Pick 1..max_components components to maximize station coverage, without risky bridging.
    Greedy:
      - pick best single component
      - then add next component that increases covered stations most
    Returns merged geometry (Multi/Line), hit_count, hit_ratio.
    """
    if len(lines) == 0:
        return None, 0, 0.0
    total = len(stations_m)
    if total == 0:
        # no stations -> just choose longest
        best = max(lines, key=lambda g: g.length)
        return best, 0, 0.0

    # Precompute station hits per line
    # Represent coverage as boolean mask
    masks = []
    for ln in lines:
        buf = ln.buffer(hit_dist_m)
        masks.append(stations_m.within(buf).values)

    # 1) best single
    best_i = max(range(len(lines)), key=lambda i: (masks[i].sum(), lines[i].length))
    chosen = [best_i]
    covered = masks[best_i].copy()

    # 2) add components if it increases coverage
    while len(chosen) < max_components:
        current_ratio = covered.sum() / total
        if current_ratio >= target_ratio:
            break

        best_gain = 0
        best_j = None
        for j in range(len(lines)):
            if j in chosen:
                continue
            gain = ((covered | masks[j]).sum() - covered.sum())
            if gain > best_gain:
                best_gain = gain
                best_j = j

        if best_j is None or best_gain <= 0:
            break

        chosen.append(best_j)
        covered = (covered | masks[best_j])

    # Merge chosen components
    picked = [lines[i] for i in chosen]
    merged = linemerge(unary_union(picked))
    hit_count = int(covered.sum())
    hit_ratio = hit_count / total if total else 0.0
    return merged, hit_count, hit_ratio


def extract_guno_line_v3(
    line_gdf4326: gpd.GeoDataFrame,
    stations_gdf4326: gpd.GeoDataFrame,
    snap_tol_m: float,
    simplify_m: float,
    station_hit_m: float,
    target_station_ratio: float,
    max_components: int,
) -> Dict:
    """Main extraction: station-score driven component selection."""
    if line_gdf4326.crs is None:
        line_gdf4326 = line_gdf4326.set_crs(epsg=4326)
    if stations_gdf4326.crs is None:
        stations_gdf4326 = stations_gdf4326.set_crs(epsg=4326)

    # Ensure stations are points
    stations_gdf4326 = stations_gdf4326[stations_gdf4326.geometry.notna() & ~stations_gdf4326.geometry.is_empty].copy()
    # If any station is polygon/linestring, use centroid
    bad = ~stations_gdf4326.geometry.geom_type.isin(["Point", "MultiPoint"])
    if bad.any():
        stations_gdf4326.loc[bad, "geometry"] = stations_gdf4326.loc[bad, "geometry"].centroid

    lines = explode_lines_only(line_gdf4326)
    if len(lines) == 0:
        return {"status": "NO_LINES"}

    lines_m, metric_crs = to_metric_crs(lines)
    if metric_crs is None:
        return {"status": "NO_CRS"}

    stations_m = stations_gdf4326.to_crs(lines_m.crs)

    # Merge network lightly (no bridging). Snap helps close tiny gaps only.
    u = unary_union(list(lines_m.geometry))
    if snap_tol_m and snap_tol_m > 0:
        u = snap(u, u, snap_tol_m)

    merged = linemerge(u)
    comps = geom_to_lines(merged)

    if not comps:
        return {"status": "MERGE_FAILED", "metric_crs": metric_crs}

    # Choose best component(s) by station coverage
    chosen_geom, hit_count, hit_ratio = merge_top_components(
        comps, stations_m, station_hit_m, target_station_ratio, max_components
    )
    if chosen_geom is None:
        return {"status": "CHOOSE_FAILED", "metric_crs": metric_crs}

    # As a final: if still MultiLineString, take the longest piece as display line
    # (but only after station-coverage-driven merge of up to max_components).
    if chosen_geom.geom_type == "MultiLineString":
        pieces = list(chosen_geom.geoms)
        chosen_line = max(pieces, key=lambda g: g.length)
    elif chosen_geom.geom_type == "LineString":
        chosen_line = chosen_geom
    else:
        # fallback
        chosen_line = max(comps, key=lambda g: g.length)

    if simplify_m and simplify_m > 0:
        chosen_line = chosen_line.simplify(simplify_m, preserve_topology=True)

    out = gpd.GeoDataFrame([{"geometry": chosen_line}], crs=lines_m.crs).to_crs(epsg=4326)

    return {
        "status": "OK",
        "metric_crs": metric_crs,
        "length_m": float(chosen_line.length),
        "stations_total": int(len(stations_m)),
        "stations_hit": int(hit_count),
        "hit_ratio": float(hit_ratio),
        "out": out,
    }


def main():
    ap = argparse.ArgumentParser(
        description="V3: Extract GUNO representative line by station-hit scoring (robust for fragmented metro lines)."
    )
    ap.add_argument("--lines-dir", required=True, help="Input dir for route line GeoJSONs")
    ap.add_argument("--stations-dir", required=True, help="Input dir for per-route station GeoJSONs")
    ap.add_argument("--out-dir", required=True, help="Output dir")
    ap.add_argument("--pattern", default="*.geojson", help="Line file glob, e.g. tokyo-metro-*.geojson")
    ap.add_argument("--snap-tol-m", type=float, default=5.0, help="Self-snap tolerance meters (default 5)")
    ap.add_argument("--simplify-m", type=float, default=6.0, help="Simplify tolerance meters (default 6)")
    ap.add_argument("--station-hit-m", type=float, default=60.0, help="Station hit distance meters (default 60)")
    ap.add_argument("--target-station-ratio", type=float, default=0.92, help="Stop adding components when hit ratio reached")
    ap.add_argument("--max-components", type=int, default=3, help="Max components to merge by station coverage (default 3)")
    ap.add_argument("--keep-props-from", choices=["first", "none"], default="first",
                    help="Copy properties from first feature (default) or output geometry only")
    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    stations_dir = Path(args.stations_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    out_lines_dir = out_dir / "guno_lines"
    out_lines_dir.mkdir(parents=True, exist_ok=True)

    rows = []

    for fp in sorted(lines_dir.glob(args.pattern)):
        route_stem = fp.stem

        st_fp = find_station_file(stations_dir, route_stem)
        if st_fp is None:
            rows.append({"route": route_stem, "status": "NO_STATIONS_FILE"})
            continue

        try:
            gdf_line = gpd.read_file(fp)
            gdf_st = gpd.read_file(st_fp)

            r = extract_guno_line_v3(
                gdf_line,
                gdf_st,
                snap_tol_m=args.snap_tol_m,
                simplify_m=args.simplify_m,
                station_hit_m=args.station_hit_m,
                target_station_ratio=args.target_station_ratio,
                max_components=args.max_components,
            )

            if r["status"] == "OK":
                out = r["out"]

                if args.keep_props_from == "first" and len(gdf_line) > 0:
                    # copy all non-geometry properties from first feature
                    for k in gdf_line.columns:
                        if k != "geometry":
                            out[k] = gdf_line.iloc[0][k]

                out_fp = out_lines_dir / f"{route_stem}_guno_line.geojson"
                out.to_file(out_fp, driver="GeoJSON")

                rows.append({
                    "route": route_stem,
                    "status": "OK",
                    "stations_total": r["stations_total"],
                    "stations_hit": r["stations_hit"],
                    "hit_ratio": r["hit_ratio"],
                    "length_m": r["length_m"],
                    "metric_crs": r.get("metric_crs"),
                    "lines_file": str(fp),
                    "stations_file": str(st_fp),
                    "out_file": str(out_fp),
                })
            else:
                rows.append({
                    "route": route_stem,
                    "status": r["status"],
                    "metric_crs": r.get("metric_crs"),
                    "lines_file": str(fp),
                    "stations_file": str(st_fp),
                })

        except Exception as e:
            rows.append({
                "route": route_stem,
                "status": f"ERROR: {type(e).__name__}: {e}",
                "lines_file": str(fp),
                "stations_file": str(st_fp),
            })

    pd.DataFrame(rows).to_csv(out_dir / "_summary_guno_mainline_v3.csv", index=False, encoding="utf-8-sig")
    print("[OK] wrote:", out_lines_dir)
    print("[OK] summary:", out_dir / "_summary_guno_mainline_v3.csv")


if __name__ == "__main__":
    main()

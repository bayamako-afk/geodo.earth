#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import Optional, List, Tuple, Dict

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString
from shapely.ops import unary_union, linemerge, snap


def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def to_metric_crs(gdf: gpd.GeoDataFrame) -> Tuple[gpd.GeoDataFrame, Optional[str]]:
    """Project to a local metric CRS (UTM) if input is geographic."""
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


def explode_lines_only(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Keep only line geometries, explode MultiLineString to LineString rows."""
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    return g


def geom_to_lines(geom) -> List[LineString]:
    """Return list of LineString components from LineString/MultiLineString/others."""
    if geom is None or geom.is_empty:
        return []
    if geom.geom_type == "LineString":
        return [geom]
    if geom.geom_type == "MultiLineString":
        return list(geom.geoms)
    return []


def choose_longest_line(geom) -> Optional[LineString]:
    lines = geom_to_lines(geom)
    if not lines:
        return None
    return max(lines, key=lambda x: x.length)


def extract_mainline(
    gdf4326: gpd.GeoDataFrame,
    snap_tol_m: float,
    simplify_m: float,
) -> Dict:
    """Extract the longest connected line as 'mainline'."""
    if gdf4326.crs is None:
        gdf4326 = gdf4326.set_crs(epsg=4326)

    lines = explode_lines_only(gdf4326)
    if len(lines) == 0:
        return {"status": "NO_LINES"}

    lines_m, metric_crs = to_metric_crs(lines)
    if metric_crs is None:
        return {"status": "NO_CRS"}

    # Union + self-snap to close tiny gaps, then linemerge to connect.
    u = unary_union(list(lines_m.geometry))
    if snap_tol_m and snap_tol_m > 0:
        u = snap(u, u, snap_tol_m)

    merged = linemerge(u)

    # Pick longest component as the representative GUNO line
    main = choose_longest_line(merged)
    if main is None or main.length == 0:
        return {"status": "MERGE_FAILED", "metric_crs": metric_crs}

    if simplify_m and simplify_m > 0:
        main = main.simplify(simplify_m, preserve_topology=True)

    out = gpd.GeoDataFrame([{"geometry": main}], crs=lines_m.crs).to_crs(epsg=4326)
    return {
        "status": "OK",
        "metric_crs": metric_crs,
        "length_m": float(main.length),
        "out": out,
    }


def main():
    ap = argparse.ArgumentParser(
        description="Extract a single representative GUNO line (longest mainline) from multi-track line GeoJSONs."
    )
    ap.add_argument("--lines-dir", required=True, help="Input directory containing route line GeoJSONs (EPSG:4326)")
    ap.add_argument("--out-dir", required=True, help="Output directory")
    ap.add_argument("--pattern", default="*.geojson", help="File glob pattern, e.g. tokyo-metro-*.geojson")
    ap.add_argument("--snap-tol-m", type=float, default=3.0, help="Snap tolerance in meters to close tiny gaps (default 3m)")
    ap.add_argument("--simplify-m", type=float, default=6.0, help="Simplify tolerance in meters (default 6m)")
    ap.add_argument("--keep-props-from", choices=["first", "none"], default="first",
                   help="Keep properties: 'first' copies first feature props; 'none' outputs only geometry.")
    args = ap.parse_args()

    in_dir = Path(args.lines_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    out_lines_dir = out_dir / "guno_lines"
    out_lines_dir.mkdir(parents=True, exist_ok=True)

    rows = []

    for fp in sorted(in_dir.glob(args.pattern)):
        try:
            gdf = gpd.read_file(fp)
            if gdf.crs is None:
                gdf = gdf.set_crs(epsg=4326)

            # Extract mainline geometry
            r = extract_mainline(gdf, args.snap_tol_m, args.simplify_m)

            if r["status"] == "OK":
                # Optionally keep some properties
                if args.keep_props_from == "first" and len(gdf) > 0:
                    props = {}
                    for k in gdf.columns:
                        if k != "geometry":
                            props[k] = gdf.iloc[0][k]
                    out = r["out"].copy()
                    for k, v in props.items():
                        out[k] = v
                    # Put geometry last is not necessary; GeoJSON writer handles it.
                else:
                    out = r["out"]

                out_fp = out_lines_dir / f"{fp.stem}_guno_line.geojson"
                out.to_file(out_fp, driver="GeoJSON")

                rows.append({
                    "route": fp.stem,
                    "status": "OK",
                    "length_m": r.get("length_m"),
                    "metric_crs": r.get("metric_crs"),
                    "out_file": str(out_fp),
                })
            else:
                rows.append({
                    "route": fp.stem,
                    "status": r["status"],
                    "metric_crs": r.get("metric_crs"),
                })

        except Exception as e:
            rows.append({"route": fp.stem, "status": f"ERROR: {type(e).__name__}: {e}"})

    pd.DataFrame(rows).to_csv(out_dir / "_summary_guno_mainline.csv", index=False, encoding="utf-8-sig")
    print("[OK] wrote:", out_lines_dir)
    print("[OK] summary:", out_dir / "_summary_guno_mainline.csv")


if __name__ == "__main__":
    main()

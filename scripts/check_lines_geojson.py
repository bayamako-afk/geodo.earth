#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Line GeoJSON structural checker
- geometry type mix (Polygon etc.)
- validity (self-intersection etc.)
- empty / Z/M handling
- segment length stats & short-segment density
- duplicate geometries (exact WKB)
- endpoint "node degree" (junction detection)
- optional: station points buffer intersection check

Requires: geopandas, shapely
Optional (recommended): pyproj
"""

import argparse
import json
import math
from collections import Counter, defaultdict

import geopandas as gpd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import linemerge
from shapely.validation import explain_validity

try:
    from shapely import make_valid  # shapely>=2.0
except Exception:
    make_valid = None


def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False


def estimate_utm_epsg(lon: float, lat: float) -> int:
    # Rough UTM zone EPSG for Japan/anywhere
    zone = int(math.floor((lon + 180) / 6) + 1)
    if lat >= 0:
        return 32600 + zone  # WGS84 / UTM north
    else:
        return 32700 + zone  # south


def to_metric(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Project to a metric CRS if currently geographic (lon/lat)."""
    if gdf.crs is None:
        # unknown; return as-is (lengths may be nonsense)
        return gdf

    if not is_geographic_crs(gdf):
        return gdf

    # Use centroid of bounds to pick UTM
    minx, miny, maxx, maxy = gdf.total_bounds
    lon = (minx + maxx) / 2.0
    lat = (miny + maxy) / 2.0
    epsg = estimate_utm_epsg(lon, lat)
    return gdf.to_crs(epsg=epsg)


def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    """Explode MultiLineString into single parts (keeps other types)."""
    return gdf.explode(index_parts=True, ignore_index=False)


def geom_type_counts(gdf: gpd.GeoDataFrame) -> Counter:
    return Counter(gdf.geometry.geom_type.fillna("None"))


def wkb_duplicates(gdf: gpd.GeoDataFrame) -> int:
    # exact duplicates by WKB
    wkb = gdf.geometry.apply(lambda g: g.wkb_hex if g else None)
    return int(wkb.duplicated().sum())


def collect_endpoints(lines_gdf: gpd.GeoDataFrame, tol: float) -> dict:
    """
    Build endpoint node degrees with snapping tolerance (metric units).
    Returns:
      degree: dict[node_key]->deg
      node_map: dict[node_key]->Point (representative)
    """
    degree = defaultdict(int)
    node_map = {}

    def key_for_point(p: Point) -> tuple:
        # snap to grid of size tol
        if tol <= 0:
            return (p.x, p.y)
        return (round(p.x / tol) * tol, round(p.y / tol) * tol)

    for geom in lines_gdf.geometry:
        if geom is None or geom.is_empty:
            continue
        if geom.geom_type == "LineString":
            coords = list(geom.coords)
            if len(coords) < 2:
                continue
            p1 = Point(coords[0])
            p2 = Point(coords[-1])
            k1 = key_for_point(p1)
            k2 = key_for_point(p2)
            degree[k1] += 1
            degree[k2] += 1
            node_map.setdefault(k1, p1)
            node_map.setdefault(k2, p2)
        elif geom.geom_type == "MultiLineString":
            for part in geom.geoms:
                coords = list(part.coords)
                if len(coords) < 2:
                    continue
                p1 = Point(coords[0])
                p2 = Point(coords[-1])
                k1 = key_for_point(p1)
                k2 = key_for_point(p2)
                degree[k1] += 1
                degree[k2] += 1
                node_map.setdefault(k1, p1)
                node_map.setdefault(k2, p2)

    return {"degree": degree, "node_map": node_map}


def line_stats_metric(lines_metric: gpd.GeoDataFrame, short_m: float) -> dict:
    lengths = lines_metric.length
    desc = lengths.describe(percentiles=[0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99]).to_dict()
    short_mask = lengths < short_m
    return {
        "count": int(len(lines_metric)),
        "total_length_m": float(lengths.sum()),
        "length_describe_m": {k: float(v) for k, v in desc.items()},
        "short_segments_lt_m": float(short_m),
        "short_segments_count": int(short_mask.sum()),
        "short_segments_ratio": float(short_mask.mean()) if len(lines_metric) else 0.0,
    }


def validity_report(gdf: gpd.GeoDataFrame, max_examples: int = 10) -> dict:
    invalid_idx = []
    reasons = []
    for idx, geom in gdf.geometry.items():
        if geom is None or geom.is_empty:
            continue
        try:
            ok = geom.is_valid
        except Exception:
            ok = True
        if not ok:
            invalid_idx.append(idx)
            try:
                reasons.append((idx, explain_validity(geom)))
            except Exception:
                reasons.append((idx, "Invalid geometry"))
        if len(reasons) >= max_examples:
            break
    return {
        "invalid_count": int(sum((g is not None and (not g.is_empty) and (not g.is_valid)) for g in gdf.geometry)),
        "invalid_examples": [{"index": str(i), "reason": r} for i, r in reasons],
    }


def station_intersections(lines: gpd.GeoDataFrame, stations: gpd.GeoDataFrame, buffer_m: float) -> dict:
    # assume both already in same metric CRS
    buf = stations.buffer(buffer_m)
    mask = lines.intersects(buf.unary_union)
    return {
        "buffer_m": float(buffer_m),
        "lines_intersect_station_buffer_count": int(mask.sum()),
        "lines_intersect_station_buffer_ratio": float(mask.mean()) if len(lines) else 0.0,
    }


def main():
    ap = argparse.ArgumentParser(description="Check structure of line GeoJSON")
    ap.add_argument("lines_geojson", help="Input line GeoJSON path")
    ap.add_argument("--stations", help="Optional station points GeoJSON/GeoPackage/etc path", default=None)
    ap.add_argument("--station-buffer-m", type=float, default=80.0, help="Station buffer meters (default 80)")
    ap.add_argument("--short-m", type=float, default=10.0, help="Short segment threshold meters (default 10)")
    ap.add_argument("--node-tol-m", type=float, default=1.0, help="Endpoint snap tolerance meters for degree (default 1)")
    ap.add_argument("--max-degree-samples", type=int, default=20, help="Max junction sample nodes (default 20)")
    ap.add_argument("--out-report", default="line_check_report.json", help="Output JSON report")
    args = ap.parse_args()

    gdf = gpd.read_file(args.lines_geojson)
    report = {
        "input": args.lines_geojson,
        "crs": str(gdf.crs),
        "feature_count": int(len(gdf)),
        "geom_type_counts": dict(geom_type_counts(gdf)),
        "empty_geom_count": int(gdf.geometry.is_empty.sum()) if "geometry" in gdf else 0,
        "null_geom_count": int(gdf.geometry.isna().sum()) if "geometry" in gdf else 0,
        "exact_duplicate_geom_count": wkb_duplicates(gdf),
        "validity": validity_report(gdf),
    }

    # Separate line vs non-line
    is_line = gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])
    report["line_feature_count"] = int(is_line.sum())
    report["non_line_feature_count"] = int((~is_line).sum())

    # If non-line exists, list a few indices/types
    if report["non_line_feature_count"] > 0:
        nonline = gdf.loc[~is_line, ["geometry"]].copy()
        nonline["geom_type"] = nonline.geometry.geom_type
        examples = nonline.head(20)
        report["non_line_examples"] = [
            {"index": str(i), "geom_type": t}
            for i, t in zip(examples.index.astype(str), examples["geom_type"].tolist())
        ]

    # Work on lines only
    lines = gdf.loc[is_line].copy()
    if len(lines) == 0:
        report["error"] = "No LineString/MultiLineString features found."
        with open(args.out_report, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return

    # Explode multi-lines for segment stats / degrees
    lines_ex = explode_lines(lines)
    # Drop non-lines after explode safety
    lines_ex = lines_ex[lines_ex.geometry.geom_type == "LineString"].copy()

    # Metric projection for length/degree checks
    lines_m = to_metric(lines_ex)
    report["metric_crs"] = str(lines_m.crs)

    # Length stats + short segment density
    report["length_stats"] = line_stats_metric(lines_m, short_m=args.short_m)

    # Endpoint node degrees
    nodes = collect_endpoints(lines_m, tol=args.node_tol_m)
    degree = nodes["degree"]
    deg_values = list(degree.values())
    deg_counter = Counter(deg_values)

    # Junctions = degree >= 3 (common “構内/分岐” indicator)
    junction_nodes = [(k, d) for k, d in degree.items() if d >= 3]
    junction_nodes_sorted = sorted(junction_nodes, key=lambda x: x[1], reverse=True)

    report["node_degree"] = {
        "node_tol_m": float(args.node_tol_m),
        "degree_histogram": dict(sorted(deg_counter.items())),
        "junction_degree_ge_3_count": int(len(junction_nodes)),
        "junction_top_samples": [
            {"x": float(k[0]), "y": float(k[1]), "degree": int(d)}
            for (k, d) in junction_nodes_sorted[: args.max_degree_samples]
        ],
    }

    # Optional: station buffer intersection ratio
    if args.stations:
        st = gpd.read_file(args.stations)
        # project stations to same metric CRS used for lines_m
        if st.crs is None and lines_m.crs is not None:
            st = st.set_crs(lines_m.crs, allow_override=True)
        elif st.crs != lines_m.crs:
            st = st.to_crs(lines_m.crs)

        # keep points only
        st_points = st[st.geometry.geom_type.isin(["Point", "MultiPoint"])].copy()
        if len(st_points) == 0:
            report["stations_check"] = {"error": "No Point/MultiPoint geometries found in stations file."}
        else:
            # explode multipoints
            st_points = st_points.explode(index_parts=True, ignore_index=False)
            st_points = st_points[st_points.geometry.geom_type == "Point"].copy()
            report["stations_check"] = {
                "stations_file": args.stations,
                "stations_count": int(len(st_points)),
                **station_intersections(lines_m, st_points, buffer_m=args.station_buffer_m),
            }

    # Simple “risk flags”
    flags = []
    if report["non_line_feature_count"] > 0:
        flags.append("NON_LINE_GEOMETRY_PRESENT (Polygon/Point等が混在)")
    if report["validity"]["invalid_count"] > 0:
        flags.append("INVALID_GEOMETRY_PRESENT (自己交差など)")
    if report["length_stats"]["short_segments_ratio"] > 0.10:
        flags.append("MANY_SHORT_SEGMENTS (構内配線/ノイズの可能性)")
    if report["node_degree"]["junction_degree_ge_3_count"] > 0:
        flags.append("JUNCTIONS_DEGREE>=3_PRESENT (分岐/構内の可能性)")

    report["risk_flags"] = flags

    with open(args.out_report, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(json.dumps(report, ensure_ascii=False, indent=2))
    print(f"\n[OK] report written: {args.out_report}")


if __name__ == "__main__":
    main()

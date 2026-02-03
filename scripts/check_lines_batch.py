#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Batch structural checker for line GeoJSONs in a folder.

Outputs:
- reports/<name>_report.json (per file)
- reports/summary.csv (all files)
- reports/flags.geojson (one point per flagged file: worst junction or representative)
- reports/junctions_<name>.geojson (degree>=3 nodes)
- reports/endpoints_<name>.geojson (degree==1 nodes)

Requires: geopandas, shapely
"""

import argparse
import json
import math
import os
from pathlib import Path
from collections import Counter, defaultdict

import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from shapely.validation import explain_validity


def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def to_metric(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    if gdf.crs is None:
        return gdf
    if not is_geographic_crs(gdf):
        return gdf
    minx, miny, maxx, maxy = gdf.total_bounds
    lon = (minx + maxx) / 2.0
    lat = (miny + maxy) / 2.0
    epsg = estimate_utm_epsg(lon, lat)
    return gdf.to_crs(epsg=epsg)


def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    return gdf.explode(index_parts=True, ignore_index=False)


def geom_type_counts(gdf: gpd.GeoDataFrame) -> dict:
    return dict(Counter(gdf.geometry.geom_type.fillna("None")))


def wkb_duplicates(gdf: gpd.GeoDataFrame) -> int:
    wkb = gdf.geometry.apply(lambda g: g.wkb_hex if g else None)
    return int(wkb.duplicated().sum())


def validity_report(gdf: gpd.GeoDataFrame, max_examples: int = 10) -> dict:
    invalid_total = 0
    examples = []
    for idx, geom in gdf.geometry.items():
        if geom is None or geom.is_empty:
            continue
        if not geom.is_valid:
            invalid_total += 1
            if len(examples) < max_examples:
                try:
                    examples.append({"index": str(idx), "reason": explain_validity(geom)})
                except Exception:
                    examples.append({"index": str(idx), "reason": "Invalid geometry"})
    return {"invalid_count": int(invalid_total), "invalid_examples": examples}


def collect_endpoints(lines_gdf: gpd.GeoDataFrame, tol: float):
    degree = defaultdict(int)
    node_rep = {}

    def key(p: Point):
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
            k1, k2 = key(p1), key(p2)
            degree[k1] += 1
            degree[k2] += 1
            node_rep.setdefault(k1, p1)
            node_rep.setdefault(k2, p2)

        elif geom.geom_type == "MultiLineString":
            for part in geom.geoms:
                coords = list(part.coords)
                if len(coords) < 2:
                    continue
                p1 = Point(coords[0])
                p2 = Point(coords[-1])
                k1, k2 = key(p1), key(p2)
                degree[k1] += 1
                degree[k2] += 1
                node_rep.setdefault(k1, p1)
                node_rep.setdefault(k2, p2)

    return degree, node_rep


def length_stats(lines_metric: gpd.GeoDataFrame, short_m: float) -> dict:
    lengths = lines_metric.length
    desc = lengths.describe(percentiles=[0.01, 0.05, 0.1, 0.5, 0.9, 0.95, 0.99]).to_dict()
    short_mask = lengths < short_m
    return {
        "segments": int(len(lines_metric)),
        "total_length_m": float(lengths.sum()),
        "min_m": float(desc.get("min", float("nan"))),
        "p50_m": float(desc.get("50%", float("nan"))),
        "p90_m": float(desc.get("90%", float("nan"))),
        "max_m": float(desc.get("max", float("nan"))),
        "short_m_threshold": float(short_m),
        "short_count": int(short_mask.sum()),
        "short_ratio": float(short_mask.mean()) if len(lines_metric) else 0.0,
    }


def check_one(file_path: Path, short_m: float, node_tol_m: float, out_dir: Path):
    gdf = gpd.read_file(str(file_path))
    report = {
        "input": str(file_path),
        "crs": str(gdf.crs),
        "feature_count": int(len(gdf)),
        "geom_type_counts": geom_type_counts(gdf),
        "empty_geom_count": int(gdf.geometry.is_empty.sum()),
        "null_geom_count": int(gdf.geometry.isna().sum()),
        "exact_duplicate_geom_count": wkb_duplicates(gdf),
        "validity": validity_report(gdf),
    }

    is_line = gdf.geometry.geom_type.isin(["LineString", "MultiLineString"])
    report["line_feature_count"] = int(is_line.sum())
    report["non_line_feature_count"] = int((~is_line).sum())

    risk_flags = []
    if report["non_line_feature_count"] > 0:
        risk_flags.append("NON_LINE_GEOMETRY_PRESENT")
    if report["validity"]["invalid_count"] > 0:
        risk_flags.append("INVALID_GEOMETRY_PRESENT")
    if report["exact_duplicate_geom_count"] > 0:
        risk_flags.append("DUPLICATE_GEOMETRY_PRESENT")

    lines = gdf.loc[is_line].copy()
    if len(lines) == 0:
        report["risk_flags"] = risk_flags + ["NO_LINES_FOUND"]
        return report, None, None, None

    lines_ex = explode_lines(lines)
    lines_ex = lines_ex[lines_ex.geometry.geom_type == "LineString"].copy()

    lines_m = to_metric(lines_ex)
    report["metric_crs"] = str(lines_m.crs)
    report["length"] = length_stats(lines_m, short_m=short_m)

    if report["length"]["short_ratio"] > 0.10:
        risk_flags.append("MANY_SHORT_SEGMENTS")

    degree, node_rep = collect_endpoints(lines_m, tol=node_tol_m)
    deg_hist = dict(sorted(Counter(degree.values()).items()))

    junctions = [(k, d) for k, d in degree.items() if d >= 3]
    endpoints = [(k, d) for k, d in degree.items() if d == 1]

    report["node_degree"] = {
        "node_tol_m": float(node_tol_m),
        "degree_histogram": deg_hist,
        "junction_degree_ge_3_count": int(len(junctions)),
        "endpoints_degree_eq_1_count": int(len(endpoints)),
    }

    if len(junctions) > 0:
        risk_flags.append("JUNCTIONS_DEGREE>=3_PRESENT")

    report["risk_flags"] = risk_flags

    # ---- export points (junctions/endpoints) as GeoJSON for QGIS inspection
    junction_gdf = None
    endpoint_gdf = None

    if lines_m.crs is None:
        # Can't write reliable point files without CRS; still return report.
        return report, None, None, None

    if len(junctions) > 0:
        rows = []
        for (x, y), d in sorted(junctions, key=lambda x: x[1], reverse=True):
            rows.append({"degree": int(d), "geometry": Point(float(x), float(y))})
        junction_gdf = gpd.GeoDataFrame(rows, crs=lines_m.crs)

        out_j = out_dir / f"junctions_{file_path.stem}.geojson"
        junction_gdf.to_file(out_j, driver="GeoJSON")

    if len(endpoints) > 0:
        rows = []
        for (x, y), d in endpoints:
            rows.append({"degree": int(d), "geometry": Point(float(x), float(y))})
        endpoint_gdf = gpd.GeoDataFrame(rows, crs=lines_m.crs)

        out_e = out_dir / f"endpoints_{file_path.stem}.geojson"
        endpoint_gdf.to_file(out_e, driver="GeoJSON")

    # Representative point for "flags.geojson": top junction if exists else first endpoint else centroid
    rep_pt = None
    rep_kind = None
    rep_degree = None
    if len(junctions) > 0:
        (x, y), d = sorted(junctions, key=lambda x: x[1], reverse=True)[0]
        rep_pt = Point(float(x), float(y))
        rep_kind = "junction"
        rep_degree = int(d)
    elif len(endpoints) > 0:
        (x, y), d = endpoints[0]
        rep_pt = Point(float(x), float(y))
        rep_kind = "endpoint"
        rep_degree = int(d)
    else:
        try:
            rep_pt = lines_m.unary_union.centroid
            rep_kind = "centroid"
            rep_degree = None
        except Exception:
            rep_pt = None

    return report, lines_m.crs, rep_pt, (rep_kind, rep_degree)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="Folder containing line GeoJSON files")
    ap.add_argument("--pattern", default="*.geojson", help="Glob pattern (default *.geojson)")
    ap.add_argument("--short-m", type=float, default=10.0, help="Short segment threshold meters (default 10)")
    ap.add_argument("--node-tol-m", type=float, default=1.0, help="Endpoint snap tolerance meters (default 1)")
    ap.add_argument("--out", default="reports", help="Output folder (default ./reports)")
    args = ap.parse_args()

    in_dir = Path(args.dir)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(in_dir.glob(args.pattern))
    if not files:
        raise SystemExit(f"No files matched: {in_dir} / {args.pattern}")

    summary_rows = []
    flag_points = []
    flag_crs = None

    for fp in files:
        try:
            report, crs, rep_pt, rep_meta = check_one(fp, args.short_m, args.node_tol_m, out_dir)
        except Exception as e:
            report = {
                "input": str(fp),
                "error": f"FAILED_TO_READ_OR_PROCESS: {type(e).__name__}: {e}",
                "risk_flags": ["FAILED"],
            }
            crs, rep_pt, rep_meta = None, None, None

        # write per-file report
        report_path = out_dir / f"{fp.stem}_report.json"
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

        # summary row
        row = {
            "file": fp.name,
            "crs": report.get("crs"),
            "metric_crs": report.get("metric_crs"),
            "features": report.get("feature_count"),
            "line_features": report.get("line_feature_count"),
            "non_line_features": report.get("non_line_feature_count"),
            "invalid": report.get("validity", {}).get("invalid_count") if report.get("validity") else None,
            "dup_geom": report.get("exact_duplicate_geom_count"),
            "segments": report.get("length", {}).get("segments") if report.get("length") else None,
            "total_length_m": report.get("length", {}).get("total_length_m") if report.get("length") else None,
            "min_m": report.get("length", {}).get("min_m") if report.get("length") else None,
            "p50_m": report.get("length", {}).get("p50_m") if report.get("length") else None,
            "p90_m": report.get("length", {}).get("p90_m") if report.get("length") else None,
            "max_m": report.get("length", {}).get("max_m") if report.get("length") else None,
            "short_ratio": report.get("length", {}).get("short_ratio") if report.get("length") else None,
            "junctions_ge3": report.get("node_degree", {}).get("junction_degree_ge_3_count") if report.get("node_degree") else None,
            "endpoints_eq1": report.get("node_degree", {}).get("endpoints_degree_eq_1_count") if report.get("node_degree") else None,
            "risk_flags": "|".join(report.get("risk_flags", [])),
        }
        summary_rows.append(row)

        # flags.geojson representative point
        if rep_pt is not None and rep_meta is not None and crs is not None:
            if flag_crs is None:
                flag_crs = crs
            # If CRS differs across files, we still write only when equal (simple & safe)
            if str(crs) == str(flag_crs):
                kind, deg = rep_meta
                flag_points.append({
                    "file": fp.name,
                    "kind": kind,
                    "degree": deg,
                    "risk_flags": "|".join(report.get("risk_flags", [])),
                    "geometry": rep_pt
                })

    # write summary.csv
    df = pd.DataFrame(summary_rows)
    df.sort_values(by=["risk_flags", "junctions_ge3", "short_ratio"], ascending=False, inplace=True, na_position="last")
    summary_path = out_dir / "summary.csv"
    df.to_csv(summary_path, index=False, encoding="utf-8-sig")

    # write flags.geojson
    if flag_points and flag_crs is not None:
        fgdf = gpd.GeoDataFrame(flag_points, crs=flag_crs)
        fgdf.to_file(out_dir / "flags.geojson", driver="GeoJSON")

    print(f"[OK] Processed {len(files)} files")
    print(f"[OK] Wrote: {summary_path}")
    print(f"[OK] Wrote per-file reports + junctions_/endpoints_ GeoJSON into: {out_dir}")


if __name__ == "__main__":
    main()

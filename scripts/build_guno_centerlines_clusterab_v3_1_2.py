#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import List, Tuple, Optional, Dict

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Point
from shapely.ops import unary_union, linemerge, nearest_points


# ---------------- CRS helpers ----------------
def is_geographic_crs(gdf: gpd.GeoDataFrame) -> bool:
    try:
        return bool(gdf.crs and gdf.crs.is_geographic)
    except Exception:
        return False

def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)

def project_to_metric(gdf: gpd.GeoDataFrame) -> Tuple[gpd.GeoDataFrame, Optional[str]]:
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


# ---------------- Geometry helpers ----------------
def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    return g

def to_segments(line: LineString) -> List[LineString]:
    coords = list(line.coords)
    segs = []
    for i in range(len(coords)-1):
        if coords[i] != coords[i+1]:
            segs.append(LineString([coords[i], coords[i+1]]))
    return segs

def lines_to_segments(lines: List[LineString], min_seg_len_m: float) -> List[LineString]:
    segs = []
    for ln in lines:
        for s in to_segments(ln):
            if s.length >= min_seg_len_m:
                segs.append(s)
    return segs

def seg_angle_rad(seg: LineString) -> float:
    (x1, y1), (x2, y2) = list(seg.coords)
    return math.atan2(y2 - y1, x2 - x1)

def angle_diff(a: float, b: float) -> float:
    d = abs(a - b) % (2 * math.pi)
    return min(d, 2 * math.pi - d)

def pick_two_seeds(segs: List[LineString]) -> Tuple[LineString, LineString]:
    """
    v3.2: 「上下複線」を拾うseed選び
    - まず長い線分を起点(seedA)にする
    - その近傍(距離5〜80m)で、向きが近い(<=35deg)線分をseedBにする
    - 見つからなければ旧来の「遠い2本」へフォールバック
    """
    if not segs:
        return LineString(), LineString()

    # 長い順に起点候補
    candA = sorted(segs, key=lambda g: g.length, reverse=True)[:200]
    for seedA in candA:
        a_ang = seg_angle_rad(seedA)
        best = None
        best_d = 1e18
        # 近傍の並行線分を探す
        for s in segs:
            if s is seedA:
                continue
            d = seedA.distance(s)
            if d < 5 or d > 80:
                continue
            if angle_diff(a_ang, seg_angle_rad(s)) > math.radians(35):
                continue
            if d < best_d:
                best_d = d
                best = s
        if best is not None:
            return seedA, best

    # フォールバック（旧方式：離れてる2本）
    cand = sorted(segs, key=lambda g: g.length, reverse=True)[:200]
    best = None
    best_d = -1.0
    for i in range(len(cand)):
        ci = cand[i].centroid
        for j in range(i+1, len(cand)):
            d = ci.distance(cand[j].centroid)
            if d > best_d:
                best_d = d
                best = (cand[i], cand[j])
    return best if best else (segs[0], segs[0])


def assign_by_distance(segs, seedA, seedB):
    A, B = [], []
    for s in segs:
        dA = s.distance(seedA)
        dB = s.distance(seedB)
        (A if dA <= dB else B).append(s)
    return A, B

def merge_seed(cluster):
    return linemerge(unary_union(cluster))

def simplify_line(line, tol_m):
    try:
        return line.simplify(tol_m, preserve_topology=True)
    except Exception:
        return line

def orient_same_direction(a: LineString, b: LineString):
    a0, a1 = Point(a.coords[0]), Point(a.coords[-1])
    b0, b1 = Point(b.coords[0]), Point(b.coords[-1])
    d_same = a0.distance(b0) + a1.distance(b1)
    b_rev = LineString(list(reversed(b.coords)))
    d_rev = a0.distance(Point(b_rev.coords[0])) + a1.distance(Point(b_rev.coords[-1]))
    return (a, b_rev) if d_rev < d_same else (a, b)

def sample_midline(a: LineString, b: LineString, n: int):
    if a.length == 0 or b.length == 0:
        return None
    a, b = orient_same_direction(a, b)
    pts = []
    for i in range(n + 1):
        t = i / n
        pa = a.interpolate(t, normalized=True)
        pb = nearest_points(pa, b)[1]
        pts.append(((pa.x + pb.x) / 2, (pa.y + pb.y) / 2))
    if len(pts) < 2:
        return None
    return LineString(pts)

def as_lines(g):
    if g is None:
        return []
    if g.geom_type == "LineString":
        return [g]
    if g.geom_type == "MultiLineString":
        return list(g.geoms)
    return []


# ---------------- Main per-route ----------------
def process_route(line_fp: Path, simplify_m, seg_min_m, sample_n):
    route = line_fp.stem
    gdf = gpd.read_file(line_fp)
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)

    gdf = explode_lines(gdf)
    if len(gdf) == 0:
        return {"route": route, "status": "NO_LINES"}

    gdf_m, metric_crs = project_to_metric(gdf)
    if metric_crs is None:
        return {"route": route, "status": "NO_CRS"}

    segs = lines_to_segments(list(gdf_m.geometry), seg_min_m)
    if len(segs) < 20:
        return {"route": route, "status": "TOO_FEW_SEGS"}

    seedA, seedB = pick_two_seeds(segs)
    A, B = assign_by_distance(segs, seedA, seedB)

    oneA = merge_seed(A)
    oneB = merge_seed(B)

    partsA = [p for p in as_lines(oneA) if p.length >= 300]
    partsB = [p for p in as_lines(oneB) if p.length >= 300]

    mids = []
    for a in partsA:
        best_b = None
        best_d = 1e18
        for b in partsB:
            d = a.distance(b)
            if d < best_d:
                best_d = d
                best_b = b
        if best_b is None or best_d > 600:
            continue
        mid = sample_midline(a, best_b, sample_n)
        if mid and mid.length > 200:
            mids.append(mid)

    # fallback
    if not mids:
        a_long = max(partsA, key=lambda g: g.length, default=None)
        b_long = max(partsB, key=lambda g: g.length, default=None)
        if a_long and b_long:
            mid = sample_midline(a_long, b_long, sample_n)
            if mid:
                mids = [mid]

    if not mids:
        return {"route": route, "status": "MIDLINE_FAILED_MULTI"}

    mid_all = linemerge(unary_union(mids))
    mid_all = simplify_line(mid_all, simplify_m)

    outA = gpd.GeoDataFrame([{"route": route, "cluster": "A", "geometry": oneA}], crs=gdf_m.crs).to_crs(4326)
    outB = gpd.GeoDataFrame([{"route": route, "cluster": "B", "geometry": oneB}], crs=gdf_m.crs).to_crs(4326)
    outC = gpd.GeoDataFrame([{"route": route, "geometry": mid_all}], crs=gdf_m.crs).to_crs(4326)

    return {
        "route": route,
        "status": "OK",
        "outA": outA,
        "outB": outB,
        "outC": outC,
        "lenA_m": float(oneA.length),
        "lenB_m": float(oneB.length),
        "mid_length_m": float(mid_all.length),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pattern", default="tokyo-metro-*.geojson")
    ap.add_argument("--simplify-m", type=float, default=6.0)
    ap.add_argument("--seg-min-m", type=float, default=12.0)
    ap.add_argument("--sample-n", type=int, default=450)
    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    out_dir = Path(args.out_dir)
    outA_dir = out_dir / "onelines_ab"
    outC_dir = out_dir / "centerlines_guno"
    outA_dir.mkdir(parents=True, exist_ok=True)
    outC_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for fp in sorted(lines_dir.glob(args.pattern)):
        r = process_route(fp, args.simplify_m, args.seg_min_m, args.sample_n)
        if r.get("status") == "OK":
            r["outA"].to_file(outA_dir / f"{fp.stem}_A_oneline.geojson", driver="GeoJSON")
            r["outB"].to_file(outA_dir / f"{fp.stem}_B_oneline.geojson", driver="GeoJSON")
            r["outC"].to_file(outC_dir / f"{fp.stem}_centerline.geojson", driver="GeoJSON")
        rows.append({k: v for k, v in r.items() if k not in ("outA", "outB", "outC")})

    pd.DataFrame(rows).to_csv(out_dir / "_summary_clusterab.csv", index=False, encoding="utf-8-sig")
    print("[OK] done:", out_dir)


if __name__ == "__main__":
    main()

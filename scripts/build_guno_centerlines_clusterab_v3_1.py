#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import List, Tuple, Optional, Dict

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, Point, MultiLineString
from shapely.geometry.base import BaseGeometry
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


# ---------- geometry helpers ----------
def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    return g

def to_segments(line: LineString) -> List[LineString]:
    coords = list(line.coords)
    if len(coords) < 2:
        return []
    segs = []
    for i in range(len(coords)-1):
        a = coords[i]
        b = coords[i+1]
        if a == b:
            continue
        segs.append(LineString([a, b]))
    return segs

def lines_to_segments(lines: List[LineString], min_seg_len_m: float = 5.0) -> List[LineString]:
    segs = []
    for ln in lines:
        for s in to_segments(ln):
            if s.length >= min_seg_len_m:
                segs.append(s)
    return segs

def pick_two_seeds(segs: List[LineString]) -> Tuple[LineString, LineString]:
    # 最も離れている2つをざっくり選ぶ（O(n^2)避けるため上位だけ見る）
    # まず長い順に上位Nだけ候補に
    N = min(200, len(segs))
    cand = sorted(segs, key=lambda g: g.length, reverse=True)[:N]
    best = None
    best_d = -1.0
    for i in range(len(cand)):
        ci = cand[i].centroid
        for j in range(i+1, len(cand)):
            d = ci.distance(cand[j].centroid)
            if d > best_d:
                best_d = d
                best = (cand[i], cand[j])
    if best is None:
        return segs[0], segs[0]
    return best

def assign_by_distance(segs: List[LineString], seedA: LineString, seedB: LineString) -> Tuple[List[LineString], List[LineString]]:
    A, B = [], []
    for s in segs:
        p = s.centroid
        # 点→線距離で近い方へ
        dA = p.distance(seedA)
        dB = p.distance(seedB)
        (A if dA <= dB else B).append(s)
    return A, B

def merge_seed(cluster: List[LineString]) -> BaseGeometry:
    # ★ 全区間を保持（MultiLineString も許容）
    u = unary_union(cluster)
    m = linemerge(u)
    return m if m is not None else LineString()


def cluster_ab(segs: List[LineString], iters: int = 6) -> Tuple[List[LineString], List[LineString], BaseGeometry, BaseGeometry]:
    seedA, seedB = pick_two_seeds(segs)
    for _ in range(iters):
        A, B = assign_by_distance(segs, seedA, seedB)
        # 空になったらリセット
        if not A or not B:
            seedA, seedB = pick_two_seeds(segs)
            continue
        seedA = merge_seed(A)
        seedB = merge_seed(B)
    A, B = assign_by_distance(segs, seedA, seedB)
    return A, B, seedA, seedB

def simplify_line(geom: BaseGeometry, tol_m: float) -> BaseGeometry:
    """Simplify LineString/MultiLineString while keeping geometry type."""
    try:
        s = geom.simplify(tol_m, preserve_topology=True)
        if s is not None and not s.is_empty:
            return s
    except Exception:
        pass
    return geom


def as_lines(geom: BaseGeometry) -> List[LineString]:
    """Return component LineStrings from LineString/MultiLineString."""
    if geom is None:
        return []
    if geom.geom_type == "LineString":
        return [geom]  # type: ignore
    if geom.geom_type == "MultiLineString":
        return list(geom.geoms)  # type: ignore
    return []


def orient_same_direction(a: LineString, b: LineString) -> Tuple[LineString, LineString]:
    a0, a1 = Point(a.coords[0]), Point(a.coords[-1])
    b0, b1 = Point(b.coords[0]), Point(b.coords[-1])

    d_same = a0.distance(b0) + a1.distance(b1)
    b_rev = LineString(list(reversed(list(b.coords))))
    d_rev = a0.distance(Point(b_rev.coords[0])) + a1.distance(Point(b_rev.coords[-1]))
    return (a, b_rev) if d_rev < d_same else (a, b)

def sample_midline(a: LineString, b: LineString, n: int = 400) -> Optional[LineString]:
    if a.length == 0 or b.length == 0:
        return None
    a, b = orient_same_direction(a, b)

    pts = []
    for i in range(n + 1):
        t = i / n
        pa = a.interpolate(t, normalized=True)
        pb = nearest_points(pa, b)[1]
        pts.append(((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0))

    if len(pts) < 2:
        return None

    cleaned = [pts[0]]
    for x, y in pts[1:]:
        px, py = cleaned[-1]
        if (x - px) ** 2 + (y - py) ** 2 > 0.25:  # >0.5m
            cleaned.append((x, y))

    return LineString(cleaned) if len(cleaned) >= 2 else None


# ---------- per-route ----------
def process_route(line_fp: Path, simplify_m: float, seg_min_m: float, cluster_iters: int, sample_n: int) -> Dict:
    route = line_fp.stem

    gdf = gpd.read_file(line_fp)
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)

    gdf = explode_lines(gdf)
    if len(gdf) == 0:
        return {"route": route, "file": str(line_fp), "status": "NO_LINES"}

    gdf_m, metric_crs = project_to_metric(gdf)
    if metric_crs is None:
        return {"route": route, "file": str(line_fp), "status": "NO_CRS_METRIC"}

    lines = list(gdf_m.geometry)
    segs = lines_to_segments(lines, min_seg_len_m=seg_min_m)
    if len(segs) < 50:
        # セグメントが少ない路線は、そのまま最長2本でやる方が良い場合がある
        u = unary_union(lines)
        m = linemerge(u)
        if m.geom_type == "LineString":
            return {"route": route, "file": str(line_fp), "status": "TOO_SIMPLE", "metric_crs": metric_crs}
        return {"route": route, "file": str(line_fp), "status": "NOT_ENOUGH_SEGS", "metric_crs": metric_crs}

    A, B, seedA, seedB = cluster_ab(segs, iters=cluster_iters)

    oneA = merge_seed(A)
    oneB = merge_seed(B)

    # 代表線が短すぎるのはNG
    if oneA.length < 500 or oneB.length < 500:
        return {"route": route, "file": str(line_fp), "status": "CLUSTER_FAILED_WEAK", "metric_crs": metric_crs,
                "lenA_m": float(oneA.length), "lenB_m": float(oneB.length), "segs": len(segs)}

    oneA = simplify_line(oneA, simplify_m)
    oneB = simplify_line(oneB, simplify_m)

    # --- build centerline from Cluster A/B (supports MultiLineString) ---
    partsA = [p for p in as_lines(oneA) if p.length >= 300]
    partsB = [p for p in as_lines(oneB) if p.length >= 300]

    mids: List[LineString] = []

    for a in partsA:
        best_b = None
        best_d = 1e18
        for b in partsB:
            d = a.centroid.distance(b.centroid)
            if d < best_d:
                best_d = d
                best_b = b

        # Exclude weird pairs (yards/branches). Tune if needed.
        if best_b is None or best_d < 5 or best_d > 300:
            continue

        mid_part = sample_midline(a, best_b, n=sample_n)
        if mid_part is not None and mid_part.length > 200:
            mids.append(mid_part)

    if not mids:
        return {
            "route": route,
            "file": str(line_fp),
            "status": "MIDLINE_FAILED_MULTI",
            "metric_crs": metric_crs,
            "lenA_m": float(oneA.length),
            "lenB_m": float(oneB.length),
            "partsA": len(partsA),
            "partsB": len(partsB),
        }

    mid = linemerge(unary_union(mids))
    if mid is None or mid.is_empty:
        return {
            "route": route,
            "file": str(line_fp),
            "status": "MIDLINE_FAILED_MULTI_EMPTY",
            "metric_crs": metric_crs,
            "lenA_m": float(oneA.length),
            "lenB_m": float(oneB.length),
        }

    mid = simplify_line(mid, simplify_m)

    # 出力は4326へ
    outA = gpd.GeoDataFrame([{"route": route, "cluster": "A", "geometry": oneA}], crs=gdf_m.crs).to_crs(epsg=4326)
    outB = gpd.GeoDataFrame([{"route": route, "cluster": "B", "geometry": oneB}], crs=gdf_m.crs).to_crs(epsg=4326)
    outC = gpd.GeoDataFrame([{"route": route, "derived": "guno_centerline", "geometry": mid}], crs=gdf_m.crs).to_crs(epsg=4326)

    return {
        "route": route,
        "file": str(line_fp),
        "status": "OK",
        "metric_crs": metric_crs,
        "segs": int(len(segs)),
        "lenA_m": float(oneA.length),
        "lenB_m": float(oneB.length),
        "mid_length_m": float(mid.length),
        "outA": outA,
        "outB": outB,
        "outC": outC,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines-dir", required=True, help="2-track mixed lines dir")
    ap.add_argument("--out-dir", required=True, help="output dir")
    ap.add_argument("--pattern", default="tokyo-metro-*.geojson", help="which routes to process")
    ap.add_argument("--simplify-m", type=float, default=5.0)
    ap.add_argument("--seg-min-m", type=float, default=6.0)
    ap.add_argument("--cluster-iters", type=int, default=6)
    ap.add_argument("--sample-n", type=int, default=450)
    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    out_onelines = out_dir / "onelines_ab"
    out_center = out_dir / "centerlines_guno"
    out_onelines.mkdir(parents=True, exist_ok=True)
    out_center.mkdir(parents=True, exist_ok=True)

    rows = []
    for fp in sorted(lines_dir.glob(args.pattern)):
        try:
            r = process_route(fp, args.simplify_m, args.seg_min_m, args.cluster_iters, args.sample_n)
        except Exception as e:
            rows.append({"route": fp.stem, "file": str(fp), "status": f"ERROR: {type(e).__name__}: {e}"})
            continue

        if r.get("status") == "OK":
            # write A/B onelines
            r["outA"].to_file(out_onelines / f"{fp.stem}_A_oneline.geojson", driver="GeoJSON")
            r["outB"].to_file(out_onelines / f"{fp.stem}_B_oneline.geojson", driver="GeoJSON")
            # write centerline
            r["outC"].to_file(out_center / f"{fp.stem}_centerline.geojson", driver="GeoJSON")

        rows.append({k: v for k, v in r.items() if k not in ("outA", "outB", "outC")})

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "_summary_clusterab.csv", index=False, encoding="utf-8-sig")
    print("[OK] wrote:", out_dir)
    print("[OK] summary:", out_dir / "_summary_clusterab.csv")
    print("[OK] onelines:", out_onelines)
    print("[OK] centerlines:", out_center)


if __name__ == "__main__":
    main()

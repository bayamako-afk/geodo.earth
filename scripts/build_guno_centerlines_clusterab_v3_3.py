#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
build_guno_centerlines_clusterab_v3_3.py

目的:
- 2ライン相当の路線GeoJSON（LineString群が混在）を、空間的に「クラスタA/B」に分ける
- A/B をできるだけ 1本化（分断は MultiLineString のまま保持）
- GUNO表示用の中心線を、A/B（主成分）から生成する

v3.3 改善点（v3.1.x からの主な変更）
- seed選択を「遠い2本」ではなく「近傍で並行な2本」優先（縦割りクラスタを抑制）
- seed更新を数回反復（安定化）
- merge前に自己snap（端点ズレを吸収）して 1本化しやすくする
- centerlineはA/Bの“主成分（最大連結成分）”で生成（車庫・支線の影響を抑制）
"""

import argparse
import math
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any

import pandas as pd
import geopandas as gpd
from shapely.geometry import LineString, MultiLineString, Point
from shapely.ops import unary_union, linemerge, nearest_points, snap


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
    """EPSG:4326 など地理座標なら、路線中心付近のUTMへ投影してメートル系へ。"""
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
    """MultiLineString混在を LineString のみの行へ展開。"""
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
    segs: List[LineString] = []
    for i in range(len(coords) - 1):
        a = coords[i]
        b = coords[i + 1]
        if a == b:
            continue
        segs.append(LineString([a, b]))
    return segs


def lines_to_segments(lines: List[LineString], min_seg_len_m: float) -> List[LineString]:
    segs: List[LineString] = []
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


def pick_two_seeds_parallel(
    segs: List[LineString],
    min_d: float,
    max_d: float,
    max_angle_deg: float,
    topN: int = 300,
) -> Tuple[LineString, LineString]:
    """
    近傍で並行な2線分をseedにする（上下複線を拾いやすい）。
    見つからなければフォールバック（遠い2本）。
    """
    if not segs:
        return LineString(), LineString()

    candA = sorted(segs, key=lambda g: g.length, reverse=True)[: min(topN, len(segs))]
    max_angle = math.radians(max_angle_deg)

    for seedA in candA:
        a_ang = seg_angle_rad(seedA)
        best = None
        best_d = 1e18
        for s in segs:
            if s is seedA:
                continue
            d = seedA.distance(s)
            if d < min_d or d > max_d:
                continue
            if angle_diff(a_ang, seg_angle_rad(s)) > max_angle:
                continue
            # 近いほど良い
            if d < best_d:
                best_d = d
                best = s
        if best is not None:
            return seedA, best

    # fallback: farthest pair among long segments
    cand = candA
    best = None
    best_d = -1.0
    for i in range(len(cand)):
        ci = cand[i].centroid
        for j in range(i + 1, len(cand)):
            d = ci.distance(cand[j].centroid)
            if d > best_d:
                best_d = d
                best = (cand[i], cand[j])
    return best if best else (segs[0], segs[0])


def assign_by_distance(segs: List[LineString], seedA, seedB) -> Tuple[List[LineString], List[LineString]]:
    """線分を seedA/seedB のどちらに近いかで割当。距離は線→線の最短距離。"""
    A: List[LineString] = []
    B: List[LineString] = []
    for s in segs:
        dA = s.distance(seedA)
        dB = s.distance(seedB)
        (A if dA <= dB else B).append(s)
    return A, B


def snap_and_merge(geoms: List[LineString], snap_tol_m: float):
    """端点ズレを吸収するため自己snapしてから linemerge。"""
    u = unary_union(geoms)
    try:
        u2 = snap(u, u, snap_tol_m) if snap_tol_m and snap_tol_m > 0 else u
    except Exception:
        u2 = u
    try:
        m = linemerge(u2)
    except Exception:
        m = u2
    return m


def merge_seed(cluster: List[LineString], snap_tol_m: float):
    return snap_and_merge(cluster, snap_tol_m=snap_tol_m)


def simplify_geom(g, tol_m: float):
    try:
        return g.simplify(tol_m, preserve_topology=True)
    except Exception:
        return g


def as_lines(g) -> List[LineString]:
    if g is None:
        return []
    if g.geom_type == "LineString":
        return [g]
    if g.geom_type == "MultiLineString":
        return list(g.geoms)
    return []


def keep_main_component(g):
    """MultiLineStringなら最大長の1成分を返す。LineStringはそのまま。"""
    if g is None:
        return g
    if g.geom_type == "LineString":
        return g
    if g.geom_type == "MultiLineString":
        geoms = sorted(list(g.geoms), key=lambda x: x.length, reverse=True)
        return geoms[0] if geoms else g
    return g


def orient_same_direction(a: LineString, b: LineString) -> Tuple[LineString, LineString]:
    a0, a1 = Point(a.coords[0]), Point(a.coords[-1])
    b0, b1 = Point(b.coords[0]), Point(b.coords[-1])
    d_same = a0.distance(b0) + a1.distance(b1)
    b_rev = LineString(list(reversed(list(b.coords))))
    d_rev = a0.distance(Point(b_rev.coords[0])) + a1.distance(Point(b_rev.coords[-1]))
    return (a, b_rev) if d_rev < d_same else (a, b)


def sample_midline(a: LineString, b: LineString, n: int, dedupe_m: float = 0.5) -> Optional[LineString]:
    """a上を均等サンプル→bへ最近接→中点列をLineString化。"""
    if a is None or b is None:
        return None
    if a.length == 0 or b.length == 0:
        return None
    a, b = orient_same_direction(a, b)

    pts: List[Tuple[float, float]] = []
    for i in range(n + 1):
        t = i / n
        pa = a.interpolate(t, normalized=True)
        pb = nearest_points(pa, b)[1]
        pts.append(((pa.x + pb.x) / 2.0, (pa.y + pb.y) / 2.0))

    if len(pts) < 2:
        return None

    # remove near-duplicates
    cleaned = [pts[0]]
    thr2 = dedupe_m * dedupe_m
    for x, y in pts[1:]:
        px, py = cleaned[-1]
        if (x - px) ** 2 + (y - py) ** 2 > thr2:
            cleaned.append((x, y))

    if len(cleaned) < 2:
        return None
    return LineString(cleaned)


# ---------------- Per-route processing ----------------
def process_route(
    line_fp: Path,
    simplify_m: float,
    seg_min_m: float,
    cluster_iters: int,
    sample_n: int,
    seed_min_d: float,
    seed_max_d: float,
    seed_max_angle_deg: float,
    snap_tol_m: float,
    center_match_max_d: float,
) -> Dict[str, Any]:
    route = line_fp.stem

    gdf = gpd.read_file(line_fp)
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)

    gdf = explode_lines(gdf)
    if len(gdf) == 0:
        return {"route": route, "file": str(line_fp), "status": "NO_LINES"}

    gdf_m, metric_crs = project_to_metric(gdf)
    if metric_crs is None:
        return {"route": route, "file": str(line_fp), "status": "NO_CRS"}

    lines = list(gdf_m.geometry)
    segs = lines_to_segments(lines, min_seg_len_m=seg_min_m)
    if len(segs) < 50:
        return {"route": route, "file": str(line_fp), "status": "NOT_ENOUGH_SEGS", "segs": len(segs)}

    seedA, seedB = pick_two_seeds_parallel(
        segs,
        min_d=seed_min_d,
        max_d=seed_max_d,
        max_angle_deg=seed_max_angle_deg,
    )

    # iterate seed refinement
    for _ in range(max(1, cluster_iters)):
        A, B = assign_by_distance(segs, seedA, seedB)
        if not A or not B:
            break
        seedA = merge_seed(A, snap_tol_m=snap_tol_m)
        seedB = merge_seed(B, snap_tol_m=snap_tol_m)

    A, B = assign_by_distance(segs, seedA, seedB)
    if not A or not B:
        return {"route": route, "file": str(line_fp), "status": "CLUSTER_EMPTY", "segs": len(segs)}

    oneA = merge_seed(A, snap_tol_m=snap_tol_m)
    oneB = merge_seed(B, snap_tol_m=snap_tol_m)

    # simplify outputs a bit (visual)
    oneA_s = simplify_geom(oneA, simplify_m)
    oneB_s = simplify_geom(oneB, simplify_m)

    # centerline uses main components to avoid side branches
    mainA = keep_main_component(oneA_s)
    mainB = keep_main_component(oneB_s)

    if mainA is None or mainB is None or mainA.length < 500 or mainB.length < 500:
        return {
            "route": route,
            "file": str(line_fp),
            "status": "MAIN_TOO_SHORT",
            "lenA_m": float(getattr(mainA, "length", 0.0)),
            "lenB_m": float(getattr(mainB, "length", 0.0)),
            "segs": len(segs),
        }

    # Build centerline (single) between mainA and mainB; if too far, fallback to part-matching
    mids: List[LineString] = []
    if mainA.distance(mainB) <= center_match_max_d:
        mid = sample_midline(mainA, mainB, n=sample_n)
        if mid is not None and mid.length > 500:
            mids = [mid]
    if not mids:
        # part matching (when main comps are broken or distance too large at some segments)
        partsA = [p for p in as_lines(oneA_s) if p.length >= 300]
        partsB = [p for p in as_lines(oneB_s) if p.length >= 300]
        for a in partsA:
            best_b = None
            best_d = 1e18
            for b in partsB:
                d = a.distance(b)
                if d < best_d:
                    best_d = d
                    best_b = b
            if best_b is None or best_d > center_match_max_d:
                continue
            mp = sample_midline(a, best_b, n=max(200, sample_n // 2))
            if mp is not None and mp.length > 200:
                mids.append(mp)

    if not mids:
        return {
            "route": route,
            "file": str(line_fp),
            "status": "MIDLINE_FAILED",
            "segs": len(segs),
            "lenA_m": float(oneA_s.length) if hasattr(oneA_s, "length") else 0.0,
            "lenB_m": float(oneB_s.length) if hasattr(oneB_s, "length") else 0.0,
        }

    mid_all = linemerge(unary_union(mids))
    mid_all = simplify_geom(mid_all, simplify_m)

    # outputs back to EPSG:4326
    outA = gpd.GeoDataFrame([{"route": route, "cluster": "A", "geometry": oneA_s}], crs=gdf_m.crs).to_crs(epsg=4326)
    outB = gpd.GeoDataFrame([{"route": route, "cluster": "B", "geometry": oneB_s}], crs=gdf_m.crs).to_crs(epsg=4326)
    outC = gpd.GeoDataFrame([{"route": route, "derived": "guno_centerline", "geometry": mid_all}], crs=gdf_m.crs).to_crs(epsg=4326)

    # metrics
    numA = 1 if outA.geometry.iloc[0].geom_type == "LineString" else (len(list(outA.geometry.iloc[0].geoms)) if outA.geometry.iloc[0].geom_type == "MultiLineString" else 0)
    numB = 1 if outB.geometry.iloc[0].geom_type == "LineString" else (len(list(outB.geometry.iloc[0].geoms)) if outB.geometry.iloc[0].geom_type == "MultiLineString" else 0)

    return {
        "route": route,
        "file": str(line_fp),
        "status": "OK",
        "metric_crs": metric_crs,
        "segs": int(len(segs)),
        "lenA_m": float(oneA_s.length),
        "lenB_m": float(oneB_s.length),
        "mid_length_m": float(mid_all.length),
        "partsA": int(numA),
        "partsB": int(numB),
        "outA": outA,
        "outB": outB,
        "outC": outC,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines-dir", required=True, help="input lines dir (2-track mixed)")
    ap.add_argument("--out-dir", required=True, help="output root dir")
    ap.add_argument("--pattern", default="tokyo-metro-*.geojson", help="glob pattern for input files")

    ap.add_argument("--simplify-m", type=float, default=6.0)
    ap.add_argument("--seg-min-m", type=float, default=12.0)
    ap.add_argument("--cluster-iters", type=int, default=5)
    ap.add_argument("--sample-n", type=int, default=500)

    # seed pick tuning
    ap.add_argument("--seed-min-d", type=float, default=5.0, help="min distance between parallel seeds (m)")
    ap.add_argument("--seed-max-d", type=float, default=120.0, help="max distance between parallel seeds (m)")
    ap.add_argument("--seed-max-angle-deg", type=float, default=45.0, help="max angle difference for parallel seeds (deg)")

    # merge tuning
    ap.add_argument("--snap-tol-m", type=float, default=3.0, help="snap tolerance before linemerge (m)")

    # centerline matching
    ap.add_argument("--center-match-max-d", type=float, default=600.0, help="max A-B distance to pair for centerline (m)")

    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    out_dir = Path(args.out_dir)
    out_onelines = out_dir / "onelines_ab"
    out_center = out_dir / "centerlines_guno"
    out_onelines.mkdir(parents=True, exist_ok=True)
    out_center.mkdir(parents=True, exist_ok=True)

    rows: List[Dict[str, Any]] = []

    for fp in sorted(lines_dir.glob(args.pattern)):
        try:
            r = process_route(
                fp,
                simplify_m=args.simplify_m,
                seg_min_m=args.seg_min_m,
                cluster_iters=args.cluster_iters,
                sample_n=args.sample_n,
                seed_min_d=args.seed_min_d,
                seed_max_d=args.seed_max_d,
                seed_max_angle_deg=args.seed_max_angle_deg,
                snap_tol_m=args.snap_tol_m,
                center_match_max_d=args.center_match_max_d,
            )
        except Exception as e:
            rows.append({"route": fp.stem, "file": str(fp), "status": f"ERROR: {type(e).__name__}: {e}"})
            continue

        if r.get("status") == "OK":
            r["outA"].to_file(out_onelines / f"{fp.stem}_A_oneline.geojson", driver="GeoJSON")
            r["outB"].to_file(out_onelines / f"{fp.stem}_B_oneline.geojson", driver="GeoJSON")
            r["outC"].to_file(out_center / f"{fp.stem}_centerline.geojson", driver="GeoJSON")

        rows.append({k: v for k, v in r.items() if k not in ("outA", "outB", "outC")})

    df = pd.DataFrame(rows)
    df.to_csv(out_dir / "_summary_clusterab.csv", index=False, encoding="utf-8-sig")

    print("[OK] wrote:", out_dir)
    print("[OK] onelines_ab:", out_onelines)
    print("[OK] centerlines_guno:", out_center)
    print("[OK] summary:", out_dir / "_summary_clusterab.csv")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse, math
from pathlib import Path
from typing import Optional, List, Tuple

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, Point
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


def choose_longest_line(geom) -> Optional[LineString]:
    lines = geom_to_lines(geom)
    if not lines:
        return None
    return max(lines, key=lambda x: x.length)


def endpoints(line: LineString) -> Tuple[Point, Point]:
    c = list(line.coords)
    return Point(c[0]), Point(c[-1])


def connect_components(lines: List[LineString], connect_tol_m: float, max_links: int = 200) -> List[LineString]:
    """
    components間の端点が近いものを橋渡し線で接続する（誤接続防止で距離閾値あり）。
    """
    if len(lines) <= 1:
        return lines

    # 端点リスト
    ends = []
    for i, ln in enumerate(lines):
        a, b = endpoints(ln)
        ends.append((i, 0, a))
        ends.append((i, 1, b))

    connectors = []
    used = set()

    # 近い端点ペアを貪欲に結ぶ（同じcomponent同士は除外）
    for _ in range(max_links):
        best = None
        best_d = 1e18
        for i, si, pi in ends:
            for j, sj, pj in ends:
                if i == j:
                    continue
                key = tuple(sorted([(i, si), (j, sj)]))
                if key in used:
                    continue
                d = pi.distance(pj)
                if d < best_d:
                    best_d = d
                    best = (i, si, pi, j, sj, pj, key)
        if best is None or best_d > connect_tol_m:
            break

        i, si, pi, j, sj, pj, key = best
        used.add(key)
        connectors.append(LineString([(pi.x, pi.y), (pj.x, pj.y)]))

        # 一度つないだ端点を二重に使いすぎないように（軽い制限）
        ends = [(ii, ss, pp) for (ii, ss, pp) in ends if (ii, ss) not in [(i, si), (j, sj)]]

        if len(ends) < 4:
            break

    return lines + connectors


def extract_mainline(gdf4326: gpd.GeoDataFrame, snap_tol_m: float, connect_tol_m: float, simplify_m: float):
    if gdf4326.crs is None:
        gdf4326 = gdf4326.set_crs(epsg=4326)

    lines = explode_lines_only(gdf4326)
    if len(lines) == 0:
        return {"status": "NO_LINES"}

    lines_m, metric_crs = to_metric_crs(lines)
    if metric_crs is None:
        return {"status": "NO_CRS"}

    u = unary_union(list(lines_m.geometry))
    if snap_tol_m and snap_tol_m > 0:
        u = snap(u, u, snap_tol_m)

    merged = linemerge(u)
    comps = geom_to_lines(merged)

    # 分断が残る場合は端点ギャップで接続して再マージ
    if connect_tol_m and connect_tol_m > 0 and len(comps) > 1:
        comps2 = connect_components(comps, connect_tol_m=connect_tol_m)
        merged2 = linemerge(unary_union(comps2))
    else:
        merged2 = merged

    main = choose_longest_line(merged2)
    if main is None or main.length == 0:
        return {"status": "MERGE_FAILED", "metric_crs": metric_crs}

    if simplify_m and simplify_m > 0:
        main = main.simplify(simplify_m, preserve_topology=True)

    out = gpd.GeoDataFrame([{"geometry": main}], crs=lines_m.crs).to_crs(epsg=4326)
    total_len = float(sum([ln.length for ln in geom_to_lines(merged2)]))
    return {
        "status": "OK",
        "metric_crs": metric_crs,
        "length_m": float(main.length),
        "total_components_len_m": total_len,
        "ratio_main_to_total": float(main.length) / total_len if total_len > 0 else None,
        "out": out,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pattern", default="*.geojson")
    ap.add_argument("--snap-tol-m", type=float, default=10.0)       # ★デフォ10m
    ap.add_argument("--connect-tol-m", type=float, default=60.0)    # ★端点ギャップ橋渡し 60m
    ap.add_argument("--simplify-m", type=float, default=6.0)
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
            r = extract_mainline(gdf, args.snap_tol_m, args.connect_tol_m, args.simplify_m)
            if r["status"] == "OK":
                out_fp = out_lines_dir / f"{fp.stem}_guno_line.geojson"
                r["out"].to_file(out_fp, driver="GeoJSON")
                rows.append({
                    "route": fp.stem,
                    "status": "OK",
                    "length_m": r["length_m"],
                    "total_components_len_m": r["total_components_len_m"],
                    "ratio_main_to_total": r["ratio_main_to_total"],
                    "metric_crs": r["metric_crs"],
                    "out_file": str(out_fp),
                })
            else:
                rows.append({"route": fp.stem, "status": r["status"], "metric_crs": r.get("metric_crs")})
        except Exception as e:
            rows.append({"route": fp.stem, "status": f"ERROR: {type(e).__name__}: {e}"})

    pd.DataFrame(rows).to_csv(out_dir / "_summary_guno_mainline.csv", index=False, encoding="utf-8-sig")
    print("[OK] wrote:", out_lines_dir)
    print("[OK] summary:", out_dir / "_summary_guno_mainline.csv")


if __name__ == "__main__":
    main()

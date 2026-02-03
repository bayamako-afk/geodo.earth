#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
from pathlib import Path
from typing import List, Union

import geopandas as gpd
from shapely.geometry import LineString, MultiLineString
from shapely.ops import linemerge, unary_union


def chaikin_smooth_coords(coords, iterations=1):
    """
    Chaikin corner cutting (軽い平滑化).
    iterations=1〜2推奨。やりすぎると路線が痩せる/ズレる。
    """
    if len(coords) < 3:
        return coords

    for _ in range(iterations):
        new_coords = [coords[0]]
        for i in range(len(coords) - 1):
            p0 = coords[i]
            p1 = coords[i + 1]
            q = (0.75 * p0[0] + 0.25 * p1[0], 0.75 * p0[1] + 0.25 * p1[1])
            r = (0.25 * p0[0] + 0.75 * p1[0], 0.25 * p0[1] + 0.75 * p1[1])
            new_coords.extend([q, r])
        new_coords.append(coords[-1])
        coords = new_coords

    return coords


def smooth_linestring(ls: LineString, iterations: int) -> LineString:
    coords = list(ls.coords)
    sm = chaikin_smooth_coords(coords, iterations=iterations)
    return LineString(sm)


def remove_tiny_segments(ls: LineString, min_seg_len_deg: float) -> LineString:
    """
    EPSG:4326の度単位なので、超小さい値での間引き（トゲ取り用）。
    min_seg_len_deg は 1e-6〜5e-6 あたりが安全（東京付近で0.1〜0.5m程度）。
    """
    coords = list(ls.coords)
    if len(coords) < 3:
        return ls

    kept = [coords[0]]
    for i in range(1, len(coords) - 1):
        x0, y0 = kept[-1]
        x1, y1 = coords[i]
        dx = x1 - x0
        dy = y1 - y0
        if (dx * dx + dy * dy) ** 0.5 >= min_seg_len_deg:
            kept.append(coords[i])
    kept.append(coords[-1])

    if len(kept) < 2:
        return ls
    return LineString(kept)


def smooth_geometry(geom, iterations: int, simplify_deg: float, min_seg_len_deg: float):
    """
    LineString / MultiLineString 両対応で平滑化＋簡略化。
    できるだけ1本に寄せるが、無理に単LineString化はしない（GUNO前提）。
    """
    if geom is None or geom.is_empty:
        return geom

    # MultiLineString -> 各LineStringを処理
    if geom.geom_type == "MultiLineString":
        parts = []
        for ls in geom.geoms:
            s = smooth_linestring(ls, iterations)
            if simplify_deg and simplify_deg > 0:
                s = s.simplify(simplify_deg, preserve_topology=True)
            if min_seg_len_deg and min_seg_len_deg > 0:
                s = remove_tiny_segments(s, min_seg_len_deg)
            parts.append(s)

        merged = linemerge(unary_union(parts))
        # merged が LineString / MultiLineString どちらでもOK
        return merged

    if geom.geom_type == "LineString":
        s = smooth_linestring(geom, iterations)
        if simplify_deg and simplify_deg > 0:
            s = s.simplify(simplify_deg, preserve_topology=True)
        if min_seg_len_deg and min_seg_len_deg > 0:
            s = remove_tiny_segments(s, min_seg_len_deg)
        return s

    # 想定外はそのまま
    return geom


def main():
    ap = argparse.ArgumentParser(description="Batch smooth GUNO lines (Chaikin + simplify) for display.")
    ap.add_argument("--in-dir", required=True, help="Input dir containing *_guno_line.geojson")
    ap.add_argument("--out-dir", required=True, help="Output dir for smoothed lines")
    ap.add_argument("--pattern", default="*_guno_line.geojson", help="Glob pattern")
    ap.add_argument("--iterations", type=int, default=1, help="Chaikin iterations (1-2 recommended)")
    # EPSG:4326 なので度単位。6m ≒ 0.000054度（緯度方向）。丸めて 5e-5。
    ap.add_argument("--simplify-deg", type=float, default=5e-5, help="Simplify tolerance in degrees (default ~6m)")
    ap.add_argument("--min-seg-deg", type=float, default=2e-6, help="Remove tiny segments threshold in degrees")
    args = ap.parse_args()

    in_dir = Path(args.in_dir)
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    for fp in sorted(in_dir.glob(args.pattern)):
        try:
            gdf = gpd.read_file(fp)
            if len(gdf) == 0:
                rows.append({"file": fp.name, "status": "EMPTY"})
                continue

            # 1路線=1feature想定。複数あっても全て処理
            gdf_out = gdf.copy()
            gdf_out["geometry"] = gdf_out["geometry"].apply(
                lambda g: smooth_geometry(g, args.iterations, args.simplify_deg, args.min_seg_deg)
            )

            out_fp = out_dir / fp.name.replace("_guno_line.geojson", "_guno_line_smooth.geojson")
            gdf_out.to_file(out_fp, driver="GeoJSON")

            rows.append({"file": fp.name, "status": "OK", "out": str(out_fp)})
        except Exception as e:
            rows.append({"file": fp.name, "status": f"ERROR: {type(e).__name__}: {e}"})

    # summary
    import pandas as pd
    pd.DataFrame(rows).to_csv(out_dir / "_summary_smooth.csv", index=False, encoding="utf-8-sig")
    print("[OK] wrote:", out_dir)
    print("[OK] summary:", out_dir / "_summary_smooth.csv")


if __name__ == "__main__":
    main()

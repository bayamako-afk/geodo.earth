#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import List, Tuple

import geopandas as gpd
import pandas as pd
from shapely.geometry import LineString, Point
from shapely.ops import unary_union, linemerge, snap
import networkx as nx


# ---------------- CRS helpers ----------------
def estimate_utm_epsg(lon, lat):
    zone = int(math.floor((lon + 180) / 6) + 1)
    return 32600 + zone if lat >= 0 else 32700 + zone


def to_metric(gdf):
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)
    if not gdf.crs.is_geographic:
        return gdf, str(gdf.crs)

    minx, miny, maxx, maxy = gdf.total_bounds
    lon = (minx + maxx) / 2
    lat = (miny + maxy) / 2
    epsg = estimate_utm_epsg(lon, lat)
    out = gdf.to_crs(epsg=epsg)
    return out, f"EPSG:{epsg}"


# ---------------- Geometry helpers ----------------
def explode_lines(gdf):
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty]
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])]
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"]
    return g


def densify_edges(line):
    coords = list(line.coords)
    for i in range(len(coords) - 1):
        a = coords[i]
        b = coords[i + 1]
        seg = LineString([a, b])
        yield a, b, seg.length


def round_node(x, y, grid):
    return (int(round(x / grid)), int(round(y / grid)))


def build_graph(lines_m, grid_m):
    G = nx.Graph()
    for geom in lines_m.geometry:
        for (ax, ay), (bx, by), w in densify_edges(geom):
            na = round_node(ax, ay, grid_m)
            nb = round_node(bx, by, grid_m)
            if na == nb:
                continue
            if G.has_edge(na, nb):
                if w < G[na][nb]["weight"]:
                    G[na][nb]["weight"] = w
            else:
                G.add_edge(na, nb, weight=w)
    return G


def nearest_node(G, pt, grid_m, radius=50):
    cx, cy = round_node(pt.x, pt.y, grid_m)
    best = None
    best_d2 = 1e18
    for r in range(1, radius + 1):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                n = (cx + dx, cy + dy)
                if n not in G:
                    continue
                x = n[0] * grid_m
                y = n[1] * grid_m
                d2 = (x - pt.x) ** 2 + (y - pt.y) ** 2
                if d2 < best_d2:
                    best_d2 = d2
                    best = n
        if best is not None:
            break
    if best is None:
        raise RuntimeError("No nearby graph node for station")
    return best


def nodes_to_linestring(nodes, grid_m):
    return LineString([(n[0] * grid_m, n[1] * grid_m) for n in nodes])


# ---------------- Main batch ----------------
def main():
    ap = argparse.ArgumentParser(description="V4.1 batch: build GUNO main lines by station-order paths")
    ap.add_argument("--lines-dir", required=True)
    ap.add_argument("--stations-dir", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--pattern", default="*.geojson")
    ap.add_argument("--order-field", default="station_order")
    ap.add_argument("--node-grid-m", type=float, default=2.0)
    ap.add_argument("--snap-tol-m", type=float, default=3.0)
    ap.add_argument("--simplify-m", type=float, default=6.0)
    args = ap.parse_args()

    lines_dir = Path(args.lines_dir)
    stations_dir = Path(args.stations_dir)
    out_dir = Path(args.out_dir)
    out_lines_dir = out_dir / "guno_lines"
    out_lines_dir.mkdir(parents=True, exist_ok=True)

    summary_rows = []

    for line_fp in sorted(lines_dir.glob(args.pattern)):
        route = line_fp.stem
        st_fp = stations_dir / f"{route}_stations.geojson"
        if not st_fp.exists():
            summary_rows.append({"route": route, "status": "NO_STATIONS"})
            continue

        try:
            gdf_line = gpd.read_file(line_fp)
            gdf_st = gpd.read_file(st_fp)

            # stations → points
            gdf_st = gdf_st[gdf_st.geometry.notna() & ~gdf_st.geometry.is_empty]
            bad = ~gdf_st.geometry.geom_type.isin(["Point", "MultiPoint"])
            if bad.any():
                gdf_st.loc[bad, "geometry"] = gdf_st.loc[bad, "geometry"].centroid
            gdf_st = gdf_st.sort_values(args.order_field)

            lines = explode_lines(gdf_line)
            lines_m, metric_crs = to_metric(lines)
            st_m = gdf_st.to_crs(lines_m.crs)

            # snap & merge
            u = unary_union(list(lines_m.geometry))
            u = snap(u, u, args.snap_tol_m)
            merged = linemerge(u)

            tmp = gpd.GeoDataFrame(geometry=[merged], crs=lines_m.crs)
            tmp = explode_lines(tmp)

            G = build_graph(tmp, args.node_grid_m)

            # station nodes
            nodes = [nearest_node(G, pt, args.node_grid_m) for pt in st_m.geometry]

            paths = []
            gaps = 0
            for i in range(len(nodes) - 1):
                try:
                    p = nx.shortest_path(G, nodes[i], nodes[i + 1], weight="weight")
                    paths.append(nodes_to_linestring(p, args.node_grid_m))
                except nx.NetworkXNoPath:
                    gaps += 1

            if not paths:
                summary_rows.append({"route": route, "status": "NO_PATH"})
                continue

            geom = linemerge(unary_union(paths))
            geom = geom.simplify(args.simplify_m, preserve_topology=True)

            out_gdf = gpd.GeoDataFrame([{"geometry": geom}], crs=lines_m.crs).to_crs(epsg=4326)
            out_fp = out_lines_dir / f"{route}_guno_line.geojson"
            out_gdf.to_file(out_fp, driver="GeoJSON")

            summary_rows.append({
                "route": route,
                "status": "OK",
                "stations": len(nodes),
                "gaps": gaps,
                "metric_crs": metric_crs,
                "out_file": str(out_fp)
            })

        except Exception as e:
            summary_rows.append({"route": route, "status": f"ERROR: {e}"})

    pd.DataFrame(summary_rows).to_csv(out_dir / "_summary_guno_v4_1.csv",
                                      index=False, encoding="utf-8-sig")
    print("[OK] batch completed")


if __name__ == "__main__":
    main()

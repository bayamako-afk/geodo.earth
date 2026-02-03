#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import argparse
import math
from pathlib import Path
from typing import Dict, List, Tuple, Optional

import geopandas as gpd
from shapely.geometry import LineString, Point
from shapely.ops import unary_union, linemerge, snap

# networkx が無ければ: pip install networkx
import networkx as nx


def is_geographic(gdf: gpd.GeoDataFrame) -> bool:
    return bool(gdf.crs and getattr(gdf.crs, "is_geographic", False))


def estimate_utm_epsg(lon: float, lat: float) -> int:
    zone = int(math.floor((lon + 180) / 6) + 1)
    return (32600 + zone) if lat >= 0 else (32700 + zone)


def to_metric(gdf: gpd.GeoDataFrame) -> Tuple[gpd.GeoDataFrame, str]:
    if gdf.crs is None:
        gdf = gdf.set_crs(epsg=4326)
    if not is_geographic(gdf):
        return gdf, str(gdf.crs)

    minx, miny, maxx, maxy = gdf.total_bounds
    lon = (minx + maxx) / 2.0
    lat = (miny + maxy) / 2.0
    epsg = estimate_utm_epsg(lon, lat)
    out = gdf.to_crs(epsg=epsg)
    return out, str(out.crs)


def explode_lines(gdf: gpd.GeoDataFrame) -> gpd.GeoDataFrame:
    g = gdf.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.notna() & ~g.geometry.is_empty].copy()
    g = g[g.geometry.geom_type.isin(["LineString", "MultiLineString"])].copy()
    g = g.explode(index_parts=True, ignore_index=True)
    g = g[g.geometry.geom_type == "LineString"].copy()
    return g


def densify_to_edges(line: LineString) -> List[Tuple[Tuple[float, float], Tuple[float, float], float]]:
    coords = list(line.coords)
    edges = []
    for i in range(len(coords) - 1):
        a = coords[i]
        b = coords[i + 1]
        seg = LineString([a, b])
        edges.append((a, b, seg.length))
    return edges


def round_node(x: float, y: float, grid: float) -> Tuple[int, int]:
    # meters space: grid=1.0 -> 1m quantize
    return (int(round(x / grid)), int(round(y / grid)))


def build_graph(lines_m: gpd.GeoDataFrame, node_grid_m: float) -> nx.Graph:
    G = nx.Graph()
    for geom in lines_m.geometry:
        for (ax, ay), (bx, by), w in densify_to_edges(geom):
            na = round_node(ax, ay, node_grid_m)
            nb = round_node(bx, by, node_grid_m)
            if na == nb:
                continue
            # keep shortest if duplicate
            if G.has_edge(na, nb):
                if w < G[na][nb]["weight"]:
                    G[na][nb]["weight"] = w
                    G[na][nb]["a"] = (ax, ay)
                    G[na][nb]["b"] = (bx, by)
            else:
                G.add_edge(na, nb, weight=w, a=(ax, ay), b=(bx, by))
    return G


def nearest_graph_node(G: nx.Graph, pt: Point, node_grid_m: float, search_radius_cells: int = 50) -> Tuple[int, int]:
    # brute-force around quantized cell
    cx, cy = round_node(pt.x, pt.y, node_grid_m)
    best = None
    best_d2 = float("inf")

    # try expanding square search (fast enough for metro scale)
    for r in range(1, search_radius_cells + 1):
        for dx in range(-r, r + 1):
            for dy in range(-r, r + 1):
                n = (cx + dx, cy + dy)
                if n not in G:
                    continue
                x = n[0] * node_grid_m
                y = n[1] * node_grid_m
                d2 = (x - pt.x) ** 2 + (y - pt.y) ** 2
                if d2 < best_d2:
                    best_d2 = d2
                    best = n
        if best is not None and best_d2 <= (node_grid_m * r) ** 2:
            break

    if best is None:
        raise RuntimeError("No nearby graph node found for station point")
    return best


def guess_order_field(st_gdf: gpd.GeoDataFrame) -> Optional[str]:
    candidates = ["seq", "order", "station_order", "idx", "index", "no", "station_no"]
    cols = set(st_gdf.columns)
    for c in candidates:
        if c in cols:
            return c
    return None


def greedy_station_order(points: List[Point]) -> List[int]:
    # fallback: nearest-neighbor ordering starting from leftmost
    n = len(points)
    if n == 0:
        return []
    start = min(range(n), key=lambda i: (points[i].x, points[i].y))
    used = {start}
    order = [start]
    while len(order) < n:
        last = order[-1]
        best = None
        best_d2 = float("inf")
        for i in range(n):
            if i in used:
                continue
            d2 = points[last].distance(points[i]) ** 2
            if d2 < best_d2:
                best_d2 = d2
                best = i
        used.add(best)
        order.append(best)
    return order


def path_edges_to_linestring(path_nodes: List[Tuple[int, int]], node_grid_m: float) -> LineString:
    coords = [(n[0] * node_grid_m, n[1] * node_grid_m) for n in path_nodes]
    return LineString(coords)


def main():
    ap = argparse.ArgumentParser(description="V4: Rebuild GUNO main line by connecting station-to-station shortest paths on the track graph.")
    ap.add_argument("--line", required=True, help="Input line geojson (2-line / fragmented ok)")
    ap.add_argument("--stations", required=True, help="Route stations geojson (EPSG:4326)")
    ap.add_argument("--out", required=True, help="Output geojson path")
    ap.add_argument("--node-grid-m", type=float, default=3.0, help="Graph node quantize meters (default 3m)")
    ap.add_argument("--snap-tol-m", type=float, default=5.0, help="Snap tolerance meters (default 5m)")
    ap.add_argument("--simplify-m", type=float, default=6.0, help="Simplify meters (default 6m)")
    ap.add_argument("--order-field", default="", help="Station order field name (if empty, auto-detect/guess)")
    args = ap.parse_args()

    line_fp = Path(args.line)
    st_fp = Path(args.stations)
    out_fp = Path(args.out)
    out_fp.parent.mkdir(parents=True, exist_ok=True)

    gdf_line = gpd.read_file(line_fp)
    gdf_st = gpd.read_file(st_fp)

    if gdf_line.crs is None:
        gdf_line = gdf_line.set_crs(epsg=4326)
    if gdf_st.crs is None:
        gdf_st = gdf_st.set_crs(epsg=4326)

    # stations -> points (centroid fallback)
    gdf_st = gdf_st[gdf_st.geometry.notna() & ~gdf_st.geometry.is_empty].copy()
    bad = ~gdf_st.geometry.geom_type.isin(["Point", "MultiPoint"])
    if bad.any():
        gdf_st.loc[bad, "geometry"] = gdf_st.loc[bad, "geometry"].centroid
    gdf_st = gdf_st.explode(index_parts=True, ignore_index=True)
    gdf_st = gdf_st[gdf_st.geometry.geom_type == "Point"].copy()

    lines = explode_lines(gdf_line)

    lines_m, metric_crs = to_metric(lines)
    st_m = gdf_st.to_crs(lines_m.crs)

    # snap small gaps then merge
    u = unary_union(list(lines_m.geometry))
    if args.snap_tol_m and args.snap_tol_m > 0:
        u = snap(u, u, args.snap_tol_m)
    merged = linemerge(u)

    # build graph
    tmp = gpd.GeoDataFrame(geometry=[merged], crs=lines_m.crs)
    tmp = explode_lines(tmp)
    G = build_graph(tmp, args.node_grid_m)

    # station ordering
    order_field = args.order_field.strip() or guess_order_field(gdf_st)
    if order_field and order_field in gdf_st.columns:
        st_ordered = gdf_st.sort_values(order_field).reset_index(drop=True)
        st_m_ordered = st_ordered.to_crs(lines_m.crs)
    else:
        # fallback: greedy order
        pts = list(st_m.geometry)
        idxs = greedy_station_order(pts)
        st_m_ordered = st_m.iloc[idxs].reset_index(drop=True)
        st_ordered = gdf_st.iloc[idxs].reset_index(drop=True)

    # map stations to nearest graph nodes
    nodes = []
    for i, pt in enumerate(st_m_ordered.geometry):
        n = nearest_graph_node(G, pt, args.node_grid_m)
        nodes.append(n)

    # compute shortest paths between consecutive stations
    path_lines = []
    for i in range(len(nodes) - 1):
        a = nodes[i]
        b = nodes[i + 1]
        try:
            path_nodes = nx.shortest_path(G, a, b, weight="weight")
        except nx.NetworkXNoPath:
            # skip gap but keep info
            continue
        path_lines.append(path_edges_to_linestring(path_nodes, args.node_grid_m))

    if not path_lines:
        raise RuntimeError("No station-to-station paths could be built (graph too fragmented or stations far from track).")

    out_geom = linemerge(unary_union(path_lines))
    if args.simplify_m and args.simplify_m > 0:
        out_geom = out_geom.simplify(args.simplify_m, preserve_topology=True)

    out_gdf = gpd.GeoDataFrame([{"geometry": out_geom}], crs=lines_m.crs).to_crs(epsg=4326)
    out_gdf.to_file(out_fp, driver="GeoJSON")
    print("[OK] metric_crs:", metric_crs)
    print("[OK] wrote:", out_fp)


if __name__ == "__main__":
    main()

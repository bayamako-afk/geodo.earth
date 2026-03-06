#!/usr/bin/env python3
"""
大江戸線専用 GeoJSON 生成スクリプト
- 線路way: railway=subway + operator=東京都交通局 + name~大江戸 の115本を座標付き取得
- 駅ノード: リレーション 3355612 (光が丘→都庁前) の stop ノードを取得
- 路線形状: way-chaining で2方向 (都庁前→光が丘, 光が丘→都庁前) に分割
"""
import json, csv, os, sys, time, requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
HEADERS = {"User-Agent": "geodo.earth-builder/1.0"}
CSV_PATH = "/home/ubuntu/upload/route_master_final_100_with_slug.csv"
OUTPUT_DIR = "/tmp/geojson_oedo"
REPO_LINES = "/home/ubuntu/geodo.earth/guno_v5/src/geojson/lines"
REPO_STATIONS = "/home/ubuntu/geodo.earth/guno_v5/src/geojson/stations"

# 大江戸線のway ID一覧（OSMで事前特定済み）
OEDO_WAY_IDS = [
    230480688,365818023,563372006,662228442,662228443,662671506,662671523,662671532,
    662708789,662708799,662712691,662712692,662714495,662714496,662719969,662719976,
    662721009,662721010,662721011,663012536,663012537,663012538,663325687,663325696,
    663325700,663995205,663995206,664297233,664297234,665714727,666783506,666783507,
    666783508,666783509,666931401,666931403,669601075,669601076,670283233,670283240,
    670283248,670456185,670456186,670533319,670939875,670939876,670939877,670996845,
    671210668,675891484,675891485,675891486,687090948,693371481,693371482,697197613,
    697200519,759383308,759383309,759383310,831290418,831290419,831290420,831290421,
    831290443,831290444,831290445,831290446,831290447,831290450,831290451,831290452,
    831290453,831290454,831290479,831290480,831290481,831290482,831290484,834672577,
    834672578,834672579,834672580,849690844,849810671,849818819,849818820,849818821,
    849818822,851778060,851781862,852439996,852439997,852439998,852439999,852440001,
    852440002,858821669,858821670,858821671,858821672,858821673,858821674,858821675,
    858821676,863498575,863498576,894538234,1215817093,1215817094,1311049197,
    1311049198,1320384459,1371059504,1371059505
]

# 大江戸線の正しい駅順（都庁前→環状→都庁前→光が丘）
# 都庁前を起点として環状部を一周し、再び都庁前から放射部へ
CORRECT_STATION_ORDER = [
    "光が丘", "練馬春日町", "豊島園", "練馬", "新江古田", "落合南長崎",
    "中井", "東中野", "中野坂上", "西新宿五丁目", "都庁前",
    "新宿西口", "東新宿", "若松河田", "牛込柳町", "牛込神楽坂",
    "飯田橋", "春日", "本郷三丁目", "上野御徒町", "新御徒町",
    "蔵前", "両国", "森下", "清澄白河", "門前仲町",
    "月島", "勝どき", "築地市場", "汐留", "大門",
    "赤羽橋", "麻布十番", "六本木", "青山一丁目", "国立競技場",
    "代々木", "新宿", "都庁前"
]

def overpass_query(query, retries=5):
    for attempt in range(retries):
        try:
            resp = requests.post(OVERPASS_URL, data={"data": query},
                                 headers=HEADERS, timeout=120)
            if resp.status_code == 200:
                try:
                    return resp.json()
                except Exception:
                    pass
            wait = 8 * (attempt + 1)
            print(f"  [HTTP {resp.status_code}] waiting {wait}s...", flush=True)
            time.sleep(wait)
        except Exception as e:
            wait = 8 * (attempt + 1)
            print(f"  [error] {e} waiting {wait}s...", flush=True)
            time.sleep(wait)
    return None

def fetch_ways_with_geom(way_ids):
    """Fetch way geometries in batches."""
    all_ways = {}
    batch_size = 30
    for i in range(0, len(way_ids), batch_size):
        batch = way_ids[i:i+batch_size]
        ids_str = ",".join(str(x) for x in batch)
        query = f"[out:json][timeout:60];way(id:{ids_str});out geom;"
        print(f"  Fetching ways batch {i//batch_size + 1}/{(len(way_ids)+batch_size-1)//batch_size} ({len(batch)} ways)...", flush=True)
        data = overpass_query(query)
        if data:
            for el in data.get("elements", []):
                if el["type"] == "way":
                    geom = el.get("geometry", [])
                    if geom:
                        pts = [[pt["lon"], pt["lat"]] for pt in geom]
                        all_ways[el["id"]] = pts
        time.sleep(3)
    return all_ways

def chain_ways(ways_dict):
    """
    Chain ways by matching endpoints to form a continuous polyline.
    Returns list of coordinate arrays (may be multiple segments if gaps exist).
    """
    if not ways_dict:
        return []

    def pt_eq(a, b, tol=1e-6):
        return abs(a[0]-b[0]) < tol and abs(a[1]-b[1]) < tol

    remaining = [pts[:] for pts in ways_dict.values()]

    # Start with the longest way
    remaining.sort(key=lambda w: -len(w))
    chained = [remaining.pop(0)]

    max_iter = len(remaining) * 3 + 1
    itr = 0
    while remaining and itr < max_iter:
        itr += 1
        head = chained[0][0]
        tail = chained[-1][-1]
        matched = False
        for i, w in enumerate(remaining):
            if pt_eq(tail, w[0]):
                chained.append(w[:])
                remaining.pop(i)
                matched = True
                break
            elif pt_eq(tail, w[-1]):
                chained.append(list(reversed(w)))
                remaining.pop(i)
                matched = True
                break
            elif pt_eq(head, w[-1]):
                chained.insert(0, w[:])
                remaining.pop(i)
                matched = True
                break
            elif pt_eq(head, w[0]):
                chained.insert(0, list(reversed(w)))
                remaining.pop(i)
                matched = True
                break
        if not matched:
            # Gap — start new segment
            chained.append(remaining.pop(0))

    # Merge into coordinate list (skip duplicate junction points)
    coords = []
    for i, w in enumerate(chained):
        start = 1 if i > 0 else 0
        coords.extend(w[start:])

    print(f"  Chained {len(ways_dict)} ways -> {len(coords)} pts ({len(remaining)} unmatched)", flush=True)
    return coords

def fetch_stops_from_relation(rel_id):
    """Fetch stop nodes with tags from a relation."""
    query = f"""
[out:json][timeout:60];
relation({rel_id});
node(r:"stop");
out body;
"""
    data = overpass_query(query)
    if not data or not data.get("elements"):
        time.sleep(3)
        query2 = f"""
[out:json][timeout:60];
relation({rel_id});
node(r:"stop_entry_only");
out body;
"""
        data = overpass_query(query2)
    stops = []
    seen = set()
    if data:
        for el in data.get("elements", []):
            if el.get("type") != "node":
                continue
            tags = el.get("tags", {})
            name = tags.get("name:ja") or tags.get("name", "")
            if not name or name in seen:
                continue
            seen.add(name)
            stops.append({"name": name, "lon": el["lon"], "lat": el["lat"]})
    return stops

def sort_by_correct_order(stations, correct_order):
    """Sort stations by the predefined correct order."""
    order_map = {name: i for i, name in enumerate(correct_order)}
    def key(s):
        return order_map.get(s["name"], 999)
    return sorted(stations, key=key)

def project_onto_track(lon, lat, track):
    """Return cumulative distance along track to nearest projected point."""
    def dist2(ax, ay, bx, by):
        dx = ax - bx; dy = ay - by
        return dx*dx + dy*dy
    best_dist2 = float('inf')
    cum = 0.0
    best_cum = 0.0
    for i in range(len(track) - 1):
        ax, ay = track[i][0], track[i][1]
        bx, by = track[i+1][0], track[i+1][1]
        seg_len2 = dist2(ax, ay, bx, by)
        if seg_len2 == 0:
            t = 0.0
        else:
            t = ((lon-ax)*(bx-ax) + (lat-ay)*(by-ay)) / seg_len2
            t = max(0.0, min(1.0, t))
        px = ax + t*(bx-ax); py = ay + t*(by-ay)
        d2 = dist2(lon, lat, px, py)
        seg_len = seg_len2**0.5
        if d2 < best_dist2:
            best_dist2 = d2
            best_cum = cum + t*seg_len
        cum += seg_len
    return best_cum

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "lines"), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "stations"), exist_ok=True)

    # CSVから大江戸線の行を読む
    row = None
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            if r["line_slug"] == "toei-oedo":
                row = r
                break
    if not row:
        print("ERROR: toei-oedo not found in CSV")
        sys.exit(1)
    print(f"Route: {row['official_name']} ({row['line_slug']}, code={row['line_code']})", flush=True)

    # Step 1: 線路wayを座標付きで取得
    print(f"\nStep 1: Fetching {len(OEDO_WAY_IDS)} track ways...", flush=True)
    ways_dict = fetch_ways_with_geom(OEDO_WAY_IDS)
    print(f"  Got geometry for {len(ways_dict)}/{len(OEDO_WAY_IDS)} ways", flush=True)

    # Step 2: way-chaining で路線形状を構築
    print(f"\nStep 2: Chaining ways...", flush=True)
    coords_all = chain_ways(ways_dict)

    # 大江戸線は「6の字」形状なので、都庁前を境に環状部と放射部を分ける
    # 都庁前の座標: 約 (139.6919, 35.6899)
    # 方向A: 光が丘→都庁前（放射部）
    # 方向B: 都庁前→光が丘（環状部+放射部）
    # 実際には2リレーションをそのまま使う
    print(f"\nStep 3: Fetching stops from relation 3355612...", flush=True)
    time.sleep(5)
    stops_a = fetch_stops_from_relation(3355612)
    print(f"  Got {len(stops_a)} stops from rel 3355612", flush=True)

    time.sleep(5)
    print(f"  Fetching stops from relation 8019883...", flush=True)
    stops_b = fetch_stops_from_relation(8019883)
    print(f"  Got {len(stops_b)} stops from rel 8019883", flush=True)

    # 駅を統合（重複除去）
    all_stops = []
    seen_names = set()
    for s in stops_a + stops_b:
        if s["name"] not in seen_names:
            seen_names.add(s["name"])
            all_stops.append(s)
    print(f"  Total unique stops: {len(all_stops)}", flush=True)

    # 正しい駅順でソート
    all_stops = sort_by_correct_order(all_stops, CORRECT_STATION_ORDER)
    print(f"  Stations sorted by correct order", flush=True)
    for i, s in enumerate(all_stops):
        print(f"    [{i+1:2d}] {s['name']}", flush=True)

    # Step 4: 2方向のトラック座標を取得
    # rel 3355612 (光が丘→都庁前) と rel 8019883 (都庁前→光が丘) の形状を個別取得
    print(f"\nStep 4: Fetching track geometry for each direction...", flush=True)
    time.sleep(5)

    # 方向A: rel 3355612 のway
    query_a = f"""
[out:json][timeout:120];
relation(3355612);
way(r);
out geom;
"""
    data_a = overpass_query(query_a)
    ways_a = {}
    if data_a:
        for el in data_a.get("elements", []):
            if el["type"] == "way":
                role = el.get("role", "")
                if role in ("platform", "platform_entry_only", "platform_exit_only"):
                    continue
                geom = el.get("geometry", [])
                if geom:
                    ways_a[el["id"]] = [[pt["lon"], pt["lat"]] for pt in geom]
    print(f"  Dir-A: {len(ways_a)} track ways", flush=True)
    coords_a = chain_ways(ways_a) if ways_a else coords_all

    time.sleep(5)
    query_b = f"""
[out:json][timeout:120];
relation(8019883);
way(r);
out geom;
"""
    data_b = overpass_query(query_b)
    ways_b = {}
    if data_b:
        for el in data_b.get("elements", []):
            if el["type"] == "way":
                role = el.get("role", "")
                if role in ("platform", "platform_entry_only", "platform_exit_only"):
                    continue
                geom = el.get("geometry", [])
                if geom:
                    ways_b[el["id"]] = [[pt["lon"], pt["lat"]] for pt in geom]
    print(f"  Dir-B: {len(ways_b)} track ways", flush=True)
    coords_b = chain_ways(ways_b) if ways_b else coords_all

    # リレーションにwayが含まれない場合は全wayを使用
    if not coords_a and not coords_b:
        print("  No way geometry from relations, using all 115 ways", flush=True)
        coords_a = coords_all
        coords_b = list(reversed(coords_all))

    # Step 5: GeoJSON構築
    print(f"\nStep 5: Building GeoJSON...", flush=True)
    coords_list = [c for c in [coords_a, coords_b] if c]

    props = {
        "type": "relation", "route": "subway",
        "name": row["official_name"], "operator": row["operator"],
        "ref": row["line_code"], "line_slug": row["line_slug"],
        "route_id": row["route_id"], "operator_slug": row["operator_slug"],
        "official_name": row["official_name"], "name_en": row["name_en"],
        "data_type": "tracks", "source": row["source"],
        "source_url": row["source_url"], "aliases": row["aliases"],
        "color": row["color"], "line_code": row["line_code"],
        "railway": row["railway"]
    }
    line_geojson = {
        "type": "FeatureCollection",
        "name": row["line_slug"],
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": [{
            "type": "Feature", "properties": props,
            "geometry": {
                "type": "GeometryCollection",
                "geometries": [{"type": "LineString", "coordinates": c} for c in coords_list]
            }
        }]
    }

    stations_features = []
    for i, st in enumerate(all_stops, 1):
        sp = props.copy()
        sp.update({
            "name": st["name"], "data_type": "stations",
            "station_order": i, "station_id": i
        })
        stations_features.append({
            "type": "Feature", "properties": sp,
            "geometry": {"type": "Point", "coordinates": [st["lon"], st["lat"]]}
        })
    stations_geojson = {
        "type": "FeatureCollection",
        "name": f"{row['line_slug']}_stations",
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "features": stations_features
    }

    # Step 6: ファイル書き出し
    line_path = os.path.join(OUTPUT_DIR, "lines", f"{row['line_slug']}.geojson")
    stations_path = os.path.join(OUTPUT_DIR, "stations", f"{row['line_slug']}_stations.geojson")

    with open(line_path, "w", encoding="utf-8") as f:
        json.dump(line_geojson, f, ensure_ascii=False, separators=(",", ": "))
    with open(stations_path, "w", encoding="utf-8") as f:
        json.dump(stations_geojson, f, ensure_ascii=False, separators=(",", ": "))

    total_pts = sum(len(c) for c in coords_list)
    print(f"\n✓ Done: {len(coords_list)} LineStrings, {total_pts} track pts, {len(all_stops)} stations", flush=True)
    print(f"  {line_path}", flush=True)
    print(f"  {stations_path}", flush=True)

if __name__ == "__main__":
    main()

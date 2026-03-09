#!/usr/bin/env python3
"""
generate_v6_pack.py
GeoJSONの駅データからGUNO V6 Pack JSONを生成するスクリプト。

V6 Pack JSON構造:
  {
    pack_meta: { pack_version, pack_id, name, description, generated_by, generated_at }
    entities:  { [station_id]: { type, name_ja, name_en, cross_lines, ... } }
    collections: { [lc]: { kind, lc, name_ja, name_en, color, size, members: [station_id] } }
    layouts:   { default: { slots: [{ collection_id }] } }
    rules:     { deck_size, hand_size, ... }
  }
"""

import json
import os
from datetime import date

# ===== 設定 =====

BASE_DIR = "/home/ubuntu/geodo.earth"
GEOJSON_DIR = f"{BASE_DIR}/assets/geojson/stations"
OUTPUT_PATH = f"{BASE_DIR}/assets/guno/guno_pack_v6.json"

# V6で使用する路線の定義
ROUTES_CONFIG = [
    {
        "geojson_file": "jr-east-yamanote_stations.geojson",
        "lc": "JY",
        "name_ja": "山手線",
        "name_en": "Yamanote",
        "color": "#80C241",
        "deck_size": 10,
    },
    {
        "geojson_file": "tokyo-metro-marunouchi_stations.geojson",
        "lc": "M",
        "name_ja": "丸ノ内線",
        "name_en": "Marunouchi",
        "color": "#E60012",
        "deck_size": 10,
    },
    {
        "geojson_file": "tokyo-metro-ginza_stations.geojson",
        "lc": "G",
        "name_ja": "銀座線",
        "name_en": "Ginza",
        "color": "#F39700",
        "deck_size": 10,
    },
    {
        "geojson_file": "tokyo-metro-tozai_stations.geojson",
        "lc": "T",
        "name_ja": "東西線",
        "name_en": "Tozai",
        "color": "#009BBF",
        "deck_size": 10,
    },
]

# 駅名の日英マッピング
STATION_EN_MAP = {
    # 山手線
    "東京": "Tokyo", "神田": "Kanda", "秋葉原": "Akihabara",
    "御徒町": "Okachimachi", "上野": "Ueno", "鶯谷": "Uguisudani",
    "日暮里": "Nippori", "西日暮里": "Nishi-nippori", "田端": "Tabata",
    "駒込": "Komagome", "巣鴨": "Sugamo", "大塚": "Otsuka",
    "池袋": "Ikebukuro", "目白": "Mejiro", "高田馬場": "Takadanobaba",
    "新大久保": "Shin-okubo", "新宿": "Shinjuku", "代々木": "Yoyogi",
    "原宿": "Harajuku", "渋谷": "Shibuya", "恵比寿": "Ebisu",
    "目黒": "Meguro", "五反田": "Gotanda", "大崎": "Osaki",
    "品川": "Shinagawa", "高輪ゲートウェイ": "Takanawa-gateway",
    "田町": "Tamachi", "浜松町": "Hamamatsucho", "新橋": "Shimbashi",
    "有楽町": "Yurakucho",
    # 丸ノ内線
    "新大塚": "Shin-otsuka", "茗荷谷": "Myogadani",
    "後楽園": "Korakuen", "本郷三丁目": "Hongo-sanchome", "御茶ノ水": "Ochanomizu",
    "淡路町": "Awajicho", "大手町": "Otemachi",
    "銀座": "Ginza", "霞ケ関": "Kasumigaseki", "国会議事堂前": "Kokkai-gijidomae",
    "赤坂見附": "Akasaka-mitsuke", "四ツ谷": "Yotsuya", "四谷三丁目": "Yotsuya-sanchome",
    "新宿御苑前": "Shinjuku-gyoenmae", "新宿三丁目": "Shinjuku-sanchome",
    "西新宿": "Nishi-shinjuku", "中野坂上": "Nakano-sakaue",
    "新中野": "Shin-nakano", "東高円寺": "Higashi-koenji",
    "新高円寺": "Shin-koenji", "南阿佐ケ谷": "Minami-asagaya", "荻窪": "Ogikubo",
    # 銀座線
    "表参道": "Omotesando", "外苑前": "Gaien-mae",
    "青山一丁目": "Aoyama-itchome",
    "溜池山王": "Tameike-sanno", "虎ノ門": "Toranomon",
    "京橋": "Kyobashi", "日本橋": "Nihombashi",
    "三越前": "Mitsukoshimae",
    "末広町": "Suehirocho", "上野広小路": "Ueno-hirokoji",
    "稲荷町": "Inaricho", "田原町": "Tawaramachi", "浅草": "Asakusa",
    # 東西線
    "中野": "Nakano", "落合": "Ochiai",
    "早稲田": "Waseda", "神楽坂": "Kagurazaka",
    "飯田橋": "Iidabashi", "九段下": "Kudanshita",
    "竹橋": "Takebashi",
    "茅場町": "Kayabacho", "門前仲町": "Monzen-nakacho",
    "木場": "Kiba", "東陽町": "Tatsumi", "南砂町": "Minami-sunacho",
    "西葛西": "Nishi-kasai", "葛西": "Kasai",
    "浦安": "Urayasu", "南行徳": "Minami-gyotoku",
    "行徳": "Gyotoku", "妙典": "Myoden",
    "原木中山": "Baraki-nakayama", "西船橋": "Nishi-funabashi",
}


def load_geojson_stations(filepath):
    """GeoJSONから駅リストを読み込んでstation_order順にソートして返す。"""
    with open(filepath, encoding="utf-8") as f:
        data = json.load(f)
    features = data.get("features", [])
    stations = []
    for feat in features:
        props = feat.get("properties", {})
        stations.append(props)
    stations.sort(key=lambda p: int(p.get("station_order", 0)))
    return stations


def make_station_id(lc, order):
    """路線コードと順番から一意のstation_idを生成する。"""
    return f"{lc.lower()}-{order:02d}"


def generate_v6_pack():
    """V6 Pack JSONを生成する。"""
    entities = {}
    collections = {}
    layout_slots = []

    # 1パス目: 全路線の駅をentitiesに登録
    route_station_map = {}  # lc -> [(station_id, name_ja)]

    for route_cfg in ROUTES_CONFIG:
        geojson_path = os.path.join(GEOJSON_DIR, route_cfg["geojson_file"])
        if not os.path.exists(geojson_path):
            print(f"WARNING: GeoJSON not found: {geojson_path}")
            continue

        stations = load_geojson_stations(geojson_path)
        lc = route_cfg["lc"]
        deck_size = route_cfg["deck_size"]
        deck_stations = stations[:deck_size]

        route_station_map[lc] = []
        member_ids = []

        for i, station in enumerate(deck_stations):
            order = i + 1
            station_id = make_station_id(lc, order)
            name_ja = station.get("name", f"Station{order}")
            name_en = STATION_EN_MAP.get(name_ja, name_ja)

            entities[station_id] = {
                "type": "station",
                "name_ja": name_ja,
                "name_en": name_en,
                "station_code": station_id,
                "cross_lines": [],  # 2パス目で設定
            }

            member_ids.append(station_id)
            route_station_map[lc].append((station_id, name_ja))

        # コレクション登録
        collections[lc] = {
            "kind": "route",
            "lc": lc,
            "name_ja": route_cfg["name_ja"],
            "name_en": route_cfg["name_en"],
            "color": route_cfg["color"],
            "size": deck_size,
            "members": member_ids,
        }
        layout_slots.append({"collection_id": lc})
        print(f"  Route {lc} ({route_cfg['name_ja']}): {len(member_ids)} stations")

    # 2パス目: 乗換駅を検出して cross_lines を設定
    # 同じ name_ja を持つ駅が複数路線に存在する場合、相互に cross_lines を追加
    name_to_stations = {}  # name_ja -> [(lc, station_id)]
    for lc, station_list in route_station_map.items():
        for station_id, name_ja in station_list:
            if name_ja not in name_to_stations:
                name_to_stations[name_ja] = []
            name_to_stations[name_ja].append((lc, station_id))

    interchange_count = 0
    for name_ja, appearances in name_to_stations.items():
        if len(appearances) >= 2:
            # 乗換駅: 全ての出現に対して他の路線を cross_lines に追加
            all_lcs = [lc for lc, _ in appearances]
            for lc, station_id in appearances:
                cross = [other_lc for other_lc in all_lcs if other_lc != lc]
                entities[station_id]["cross_lines"] = cross
            interchange_count += 1
            lc_list = ", ".join(all_lcs)
            print(f"  Interchange: {name_ja} ({lc_list})")

    # Pack JSON 生成
    pack = {
        "pack_meta": {
            "pack_version": "1.0",
            "pack_id": "tokyo_core",
            "name": "Tokyo Core Lines",
            "description": "山手線・丸ノ内線・銀座線・東西線（各10駅）",
            "generated_by": "GUNO Deck Generator v1.0",
            "generated_at": str(date.today()),
        },
        "entities": entities,
        "collections": collections,
        "layouts": {
            "default": {
                "slots": layout_slots,
            }
        },
        "rules": {
            "deck_size": 10,
            "hand_size": 7,
            "guno_threshold": 10,
            "max_players": 4,
        },
    }

    return pack, interchange_count


if __name__ == "__main__":
    print("Generating GUNO V6 Pack JSON...")
    print(f"  Output: {OUTPUT_PATH}")
    print()

    pack, interchange_count = generate_v6_pack()

    # 統計
    entity_count = len(pack["entities"])
    collection_count = len(pack["collections"])
    total_cards = sum(col["size"] for col in pack["collections"].values())

    print()
    print(f"  Entities (stations): {entity_count}")
    print(f"  Collections (routes): {collection_count}")
    print(f"  Total deck cards: {total_cards}")
    print(f"  Interchange stations: {interchange_count}")

    # 出力
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to: {OUTPUT_PATH}")

    # バリデーション確認
    print("\nValidation check:")
    assert pack["pack_meta"]["pack_version"] == "1.0", "pack_version missing"
    assert "entities" in pack, "entities missing"
    assert "collections" in pack, "collections missing"
    assert "layouts" in pack, "layouts missing"
    assert "rules" in pack, "rules missing"
    for key in ["entities", "collections", "layouts", "rules"]:
        assert pack[key], f"{key} is empty"
    print("  All required fields present: OK")
    print("  pack_meta.pack_version: 1.0 OK")
    print("  entities: OK")
    print("  collections: OK")
    print("  layouts: OK")
    print("  rules: OK")
    print("\nPack JSON generation complete!")

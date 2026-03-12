"""
generate_osaka_master.py
Generate Osaka master data files for GUNO V6.

Selected lines (5 iconic Osaka lines with strong transfer structure):
  M  — Osaka Metro Midosuji Line (御堂筋線)
  T  — Osaka Metro Tanimachi Line (谷町線)
  Y  — Osaka Metro Yotsubashi Line (四つ橋線)
  HK — Hankyu Kyoto Line (阪急京都線)
  OC — JR Osaka Loop Line (大阪環状線)

Output:
  cities/osaka/data/master/stations_master.json
  cities/osaka/data/master/lines_master.json
  cities/osaka/data/master/station_lines.json
  cities/osaka/data/master/stations_master.csv
  cities/osaka/data/master/station_lines.csv
"""

import json, csv, math, hashlib, os
from datetime import datetime

ROOT = os.path.join(os.path.dirname(__file__), '..')
OSAKA_DIR = os.path.join(ROOT, 'cities', 'osaka', 'data', 'master')
os.makedirs(OSAKA_DIR, exist_ok=True)

# ── Helper ────────────────────────────────────────────────────────────────────

def make_id(lat, lon):
    """Generate a station_global_id from lat/lon (same style as Tokyo)."""
    lat_i = int(round(lat * 1000))
    lon_i = int(round(lon * 1000))
    return f"ST_{lat_i}_{lon_i}"

def slug(name_en):
    return name_en.lower().replace(' ', '-').replace('/', '-')

# ── Lines master ──────────────────────────────────────────────────────────────

LINES = [
    {
        "line_id": "M",
        "line_name": "御堂筋線",
        "line_name_en": "Midosuji Line",
        "operator_name": "大阪メトロ",
        "color": "#E5171F",
        "prefectures": ["大阪府"],
        "is_loop": False,
        "status": "active"
    },
    {
        "line_id": "T",
        "line_name": "谷町線",
        "line_name_en": "Tanimachi Line",
        "operator_name": "大阪メトロ",
        "color": "#522886",
        "prefectures": ["大阪府"],
        "is_loop": False,
        "status": "active"
    },
    {
        "line_id": "Y",
        "line_name": "四つ橋線",
        "line_name_en": "Yotsubashi Line",
        "operator_name": "大阪メトロ",
        "color": "#0066B3",
        "prefectures": ["大阪府"],
        "is_loop": False,
        "status": "active"
    },
    {
        "line_id": "HK",
        "line_name": "阪急京都線",
        "line_name_en": "Hankyu Kyoto Line",
        "operator_name": "阪急電鉄",
        "color": "#6C3B2A",
        "prefectures": ["大阪府", "京都府"],
        "is_loop": False,
        "status": "active"
    },
    {
        "line_id": "OC",
        "line_name": "大阪環状線",
        "line_name_en": "Osaka Loop Line",
        "operator_name": "JR西日本",
        "color": "#FF6600",
        "prefectures": ["大阪府"],
        "is_loop": True,
        "status": "active"
    },
]

# ── Station data ──────────────────────────────────────────────────────────────
# Each entry: (name_ja, name_kana, name_en, lat, lon, line_id, order, code)

RAW_STATIONS = [
    # --- Midosuji Line (M) ---
    ("江坂",     "えさか",       "Esaka",           34.7508, 135.4998, "M",  1, "M01"),
    ("東三国",   "ひがしみくに", "Higashi-Mikuni",  34.7367, 135.5013, "M",  2, "M02"),
    ("新大阪",   "しんおおさか", "Shin-Osaka",      34.7333, 135.5000, "M",  3, "M03"),
    ("西中島南方","にしなかじまみなみかた","Nishinakajima-Minamikata",34.7216,135.4966,"M",4,"M04"),
    ("中津",     "なかつ",       "Nakatsu",         34.7072, 135.4965, "M",  5, "M05"),
    ("梅田",     "うめだ",       "Umeda",           34.7026, 135.4982, "M",  6, "M06"),
    ("淀屋橋",   "よどやばし",   "Yodoyabashi",     34.6935, 135.5014, "M",  7, "M07"),
    ("本町",     "ほんまち",     "Honmachi",        34.6822, 135.4998, "M",  8, "M08"),
    ("心斎橋",   "しんさいばし", "Shinsaibashi",    34.6747, 135.5012, "M",  9, "M09"),
    ("なんば",   "なんば",       "Namba",           34.6665, 135.5013, "M", 10, "M10"),
    ("大国町",   "だいこくちょう","Daikoku-cho",     34.6568, 135.4982, "M", 11, "M11"),
    ("動物園前", "どうぶつえんまえ","Dobutsuen-mae",  34.6518, 135.5063, "M", 12, "M12"),
    ("天王寺",   "てんのうじ",   "Tennoji",         34.6462, 135.5133, "M", 13, "M13"),
    ("昭和町",   "しょうわちょう","Showa-cho",       34.6375, 135.5183, "M", 14, "M14"),
    ("西田辺",   "にしたなべ",   "Nishi-Tanabe",    34.6308, 135.5167, "M", 15, "M15"),
    ("長居",     "ながい",       "Nagai",           34.6178, 135.5183, "M", 16, "M16"),
    ("あびこ",   "あびこ",       "Abiko",           34.6043, 135.5183, "M", 17, "M17"),
    ("北花田",   "きたはなだ",   "Kita-Hanada",     34.5897, 135.5183, "M", 18, "M18"),
    ("新金岡",   "しんかなおか", "Shin-Kanaoka",    34.5758, 135.5183, "M", 19, "M19"),
    ("なかもず", "なかもず",     "Nakamozu",        34.5647, 135.5183, "M", 20, "M20"),

    # --- Tanimachi Line (T) ---
    ("大日",     "だいにち",     "Dainichi",        34.7583, 135.5367, "T",  1, "T01"),
    ("守口",     "もりぐち",     "Moriguchi",       34.7433, 135.5367, "T",  2, "T02"),
    ("太子橋今市","たいしばしいまいち","Taishibashi-Imaichi",34.7267,135.5367,"T",3,"T03"),
    ("千林大宮", "せんばやしおおみや","Senbayashi-Omiya",34.7167,135.5367,"T",4,"T04"),
    ("関目高殿", "せきめたかどの","Sekime-Takadono", 34.7067, 135.5367, "T",  5, "T05"),
    ("野江内代", "のえうちんだい","Noe-Uchindai",    34.6967, 135.5367, "T",  6, "T06"),
    ("都島",     "みやこじま",   "Miyakojima",      34.6933, 135.5283, "T",  7, "T07"),
    ("天神橋筋六丁目","てんじんばしすじろくちょうめ","Tenjinbashisuji 6-chome",34.7017,135.5133,"T",8,"T08"),
    ("中崎町",   "なかざきちょう","Nakazaki-cho",    34.7067, 135.5083, "T",  9, "T09"),
    ("東梅田",   "ひがしうめだ", "Higashi-Umeda",   34.7017, 135.5033, "T", 10, "T10"),
    ("南森町",   "みなみもりまち","Minami-Morimachi", 34.6933, 135.5083, "T", 11, "T11"),
    ("天満橋",   "てんまばし",   "Temmabashi",      34.6883, 135.5183, "T", 12, "T12"),
    ("谷町四丁目","たにまちよんちょうめ","Tanimachi 4-chome",34.6817,135.5183,"T",13,"T13"),
    ("谷町六丁目","たにまちろくちょうめ","Tanimachi 6-chome",34.6717,135.5183,"T",14,"T14"),
    ("谷町九丁目","たにまちきゅうちょうめ","Tanimachi 9-chome",34.6617,135.5183,"T",15,"T15"),
    ("四天王寺前夕陽ヶ丘","してんのうじまえゆうひがおか","Shitennoji-mae Yuhigaoka",34.6533,135.5183,"T",16,"T16"),
    ("天王寺",   "てんのうじ",   "Tennoji",         34.6462, 135.5133, "T", 17, "T17"),
    ("阿倍野",   "あべの",       "Abeno",           34.6383, 135.5133, "T", 18, "T18"),
    ("文の里",   "ふみのさと",   "Fuminosato",      34.6283, 135.5183, "T", 19, "T19"),
    ("田辺",     "たなべ",       "Tanabe",          34.6183, 135.5183, "T", 20, "T20"),
    ("駒川中野", "こまがわなかの","Komagawa-Nakano",  34.6083, 135.5183, "T", 21, "T21"),
    ("平野",     "ひらの",       "Hirano",          34.5983, 135.5267, "T", 22, "T22"),
    ("喜連瓜破", "きれうりわり", "Kire-Urizaru",    34.5883, 135.5367, "T", 23, "T23"),
    ("出戸",     "でと",         "Deto",            34.5783, 135.5367, "T", 24, "T24"),
    ("長原",     "ながはら",     "Nagahara",        34.5683, 135.5367, "T", 25, "T25"),
    ("八尾南",   "やおみなみ",   "Yao-Minami",      34.5583, 135.5367, "T", 26, "T26"),

    # --- Yotsubashi Line (Y) ---
    ("西梅田",   "にしうめだ",   "Nishi-Umeda",     34.6983, 135.4933, "Y",  1, "Y01"),
    ("肥後橋",   "ひごばし",     "Higobashi",       34.6900, 135.4967, "Y",  2, "Y02"),
    ("本町",     "ほんまち",     "Honmachi",        34.6822, 135.4998, "Y",  3, "Y03"),
    ("四ツ橋",   "よつばし",     "Yotsubashi",      34.6733, 135.4967, "Y",  4, "Y04"),
    ("なんば",   "なんば",       "Namba",           34.6665, 135.5013, "Y",  5, "Y05"),
    ("大国町",   "だいこくちょう","Daikoku-cho",     34.6568, 135.4982, "Y",  6, "Y06"),
    ("花園町",   "はなぞのちょう","Hanazonocho",     34.6467, 135.4967, "Y",  7, "Y07"),
    ("岸里",     "きしのさと",   "Kishinosato",     34.6367, 135.4967, "Y",  8, "Y08"),
    ("玉出",     "たまで",       "Tamade",          34.6267, 135.4967, "Y",  9, "Y09"),
    ("北加賀屋", "きたかがや",   "Kita-Kagaya",     34.6167, 135.4967, "Y", 10, "Y10"),
    ("住之江公園","すみのえこうえん","Suminoe-koen",  34.6067, 135.4967, "Y", 11, "Y11"),

    # --- Hankyu Kyoto Line (HK) ---
    ("梅田",     "うめだ",       "Umeda",           34.7026, 135.4982, "HK",  1, "HK01"),
    ("中津",     "なかつ",       "Nakatsu",         34.7072, 135.4965, "HK",  2, "HK02"),
    ("十三",     "じゅうそう",   "Juso",            34.7233, 135.4733, "HK",  3, "HK03"),
    ("崇禅寺",   "そうぜんじ",   "Sozenji",         34.7333, 135.4833, "HK",  4, "HK04"),
    ("淡路",     "あわじ",       "Awaji",           34.7417, 135.4883, "HK",  5, "HK05"),
    ("上新庄",   "かみしんじょう","Kamishinjyo",     34.7500, 135.5033, "HK",  6, "HK06"),
    ("相川",     "あいかわ",     "Aikawa",          34.7533, 135.5183, "HK",  7, "HK07"),
    ("正雀",     "しょうじゃく", "Shojaku",         34.7567, 135.5333, "HK",  8, "HK08"),
    ("摂津市",   "せっつし",     "Settsu-shi",      34.7683, 135.5467, "HK",  9, "HK09"),
    ("南茨木",   "みなみいばらき","Minami-Ibaraki",  34.7817, 135.5617, "HK", 10, "HK10"),
    ("茨木市",   "いばらきし",   "Ibaraki-shi",     34.8117, 135.5700, "HK", 11, "HK11"),
    ("総持寺",   "そうじじ",     "Sojiji",          34.8183, 135.5833, "HK", 12, "HK12"),
    ("富田",     "とんだ",       "Tonda",           34.8233, 135.5983, "HK", 13, "HK13"),
    ("高槻市",   "たかつきし",   "Takatsuki-shi",   34.8433, 135.6167, "HK", 14, "HK14"),
    ("上牧",     "かんまき",     "Kammaki",         34.8617, 135.6317, "HK", 15, "HK15"),
    ("水無瀬",   "みなせ",       "Minase",          34.8700, 135.6483, "HK", 16, "HK16"),
    ("大山崎",   "おおやまざき", "Oyamazaki",       34.8950, 135.6683, "HK", 17, "HK17"),

    # --- Osaka Loop Line (OC) ---
    ("大阪",     "おおさか",     "Osaka",           34.7025, 135.4959, "OC",  1, "OC01"),
    ("福島",     "ふくしま",     "Fukushima",       34.6967, 135.4783, "OC",  2, "OC02"),
    ("野田",     "のだ",         "Noda",            34.6883, 135.4700, "OC",  3, "OC03"),
    ("西九条",   "にしくじょう", "Nishi-Kujo",      34.6767, 135.4683, "OC",  4, "OC04"),
    ("弁天町",   "べんてんちょう","Bentenmachi",     34.6683, 135.4683, "OC",  5, "OC05"),
    ("大正",     "たいしょう",   "Taisho",          34.6617, 135.4733, "OC",  6, "OC06"),
    ("芦原橋",   "あしはらばし", "Ashiharabashi",   34.6533, 135.4817, "OC",  7, "OC07"),
    ("今宮",     "いまみや",     "Imamiya",         34.6483, 135.4933, "OC",  8, "OC08"),
    ("新今宮",   "しんいまみや", "Shin-Imamiya",    34.6467, 135.5017, "OC",  9, "OC09"),
    ("天王寺",   "てんのうじ",   "Tennoji",         34.6462, 135.5133, "OC", 10, "OC10"),
    ("寺田町",   "てらだちょう", "Teradacho",       34.6533, 135.5267, "OC", 11, "OC11"),
    ("桃谷",     "ももたに",     "Momotani",        34.6617, 135.5367, "OC", 12, "OC12"),
    ("鶴橋",     "つるはし",     "Tsuruhashi",      34.6683, 135.5433, "OC", 13, "OC13"),
    ("玉造",     "たまつくり",   "Tamatsukuri",     34.6733, 135.5383, "OC", 14, "OC14"),
    ("森ノ宮",   "もりのみや",   "Morinomiya",      34.6783, 135.5333, "OC", 15, "OC15"),
    ("大阪城公園","おおさかじょうこうえん","Osaka-jo Park",34.6833,135.5283,"OC",16,"OC16"),
    ("京橋",     "きょうばし",   "Kyobashi",        34.6933, 135.5317, "OC", 17, "OC17"),
    ("桜ノ宮",   "さくらのみや", "Sakuranomiya",    34.7017, 135.5217, "OC", 18, "OC18"),
    ("天満",     "てんま",       "Temma",           34.7083, 135.5133, "OC", 19, "OC19"),
    ("大阪",     "おおさか",     "Osaka",           34.7025, 135.4959, "OC", 20, "OC20"),  # loop end = start
]

# ── Build station registry (deduplicate by lat/lon) ───────────────────────────

station_map = {}  # station_global_id -> station dict
for row in RAW_STATIONS:
    name_ja, name_kana, name_en, lat, lon, line_id, order, code = row
    sid = make_id(lat, lon)
    if sid not in station_map:
        station_map[sid] = {
            "station_global_id": sid,
            "station_slug": slug(name_en),
            "station_name": name_ja,
            "station_name_kana": name_kana,
            "station_name_en": name_en,
            "prefecture_code": "27",
            "prefecture_name": "大阪府",
            "lat": lat,
            "lon": lon,
            "operators": [],
            "line_ids": [],
            "line_count": 0,
            "hub_degree_global": 0,
            "source_names": [name_ja],
            "aliases": [name_ja + "駅"],
            "status": "active"
        }
    st = station_map[sid]
    # Find operator for this line
    line_obj = next(l for l in LINES if l["line_id"] == line_id)
    op = line_obj["operator_name"]
    if op not in st["operators"]:
        st["operators"].append(op)
    if line_id not in st["line_ids"]:
        st["line_ids"].append(line_id)

# Compute derived fields
for sid, st in station_map.items():
    st["line_count"] = len(st["line_ids"])
    st["hub_degree_global"] = st["line_count"]

stations_master = list(station_map.values())

# ── Build station_lines ───────────────────────────────────────────────────────

# Build ordered list per line
line_station_order = {}  # line_id -> [(order, sid, code)]
for row in RAW_STATIONS:
    name_ja, name_kana, name_en, lat, lon, line_id, order, code = row
    sid = make_id(lat, lon)
    if line_id not in line_station_order:
        line_station_order[line_id] = []
    # Avoid duplicate loop-end entry for OC
    if not any(x[1] == sid and x[0] == order for x in line_station_order[line_id]):
        line_station_order[line_id].append((order, sid, code))

station_lines = []
for line_id, ordered in line_station_order.items():
    ordered.sort(key=lambda x: x[0])
    line_obj = next(l for l in LINES if l["line_id"] == line_id)
    n = len(ordered)
    for i, (order, sid, code) in enumerate(ordered):
        st = station_map[sid]
        is_transfer = st["line_count"] > 1
        is_terminal = (i == 0 or i == n - 1) and not line_obj["is_loop"]
        prev_sid = ordered[i - 1][1] if i > 0 else (ordered[n - 1][1] if line_obj["is_loop"] else None)
        next_sid = ordered[i + 1][1] if i < n - 1 else (ordered[0][1] if line_obj["is_loop"] else None)
        station_lines.append({
            "station_global_id": sid,
            "line_id": line_id,
            "line_name": line_obj["line_name"],
            "operator_name": line_obj["operator_name"],
            "line_station_code": code,
            "order_on_line": order,
            "is_transfer_station": is_transfer,
            "is_terminal": is_terminal,
            "adjacent_prev_station_id": prev_sid,
            "adjacent_next_station_id": next_sid,
        })

# ── Update lines_master with station_count ────────────────────────────────────

for line_obj in LINES:
    lid = line_obj["line_id"]
    count = len(line_station_order.get(lid, []))
    line_obj["station_count"] = count

# ── Write JSON ────────────────────────────────────────────────────────────────

with open(os.path.join(OSAKA_DIR, 'stations_master.json'), 'w', encoding='utf-8') as f:
    json.dump(stations_master, f, ensure_ascii=False, indent=2)
print(f"stations_master.json: {len(stations_master)} stations")

with open(os.path.join(OSAKA_DIR, 'lines_master.json'), 'w', encoding='utf-8') as f:
    json.dump(LINES, f, ensure_ascii=False, indent=2)
print(f"lines_master.json: {len(LINES)} lines")

with open(os.path.join(OSAKA_DIR, 'station_lines.json'), 'w', encoding='utf-8') as f:
    json.dump(station_lines, f, ensure_ascii=False, indent=2)
print(f"station_lines.json: {len(station_lines)} entries")

# ── Write CSV companions ──────────────────────────────────────────────────────

with open(os.path.join(OSAKA_DIR, 'stations_master.csv'), 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'station_global_id','station_slug','station_name','station_name_kana',
        'station_name_en','prefecture_code','prefecture_name','lat','lon',
        'line_count','hub_degree_global','status'
    ])
    writer.writeheader()
    for st in stations_master:
        writer.writerow({k: st[k] for k in writer.fieldnames})
print("stations_master.csv written")

with open(os.path.join(OSAKA_DIR, 'station_lines.csv'), 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=[
        'station_global_id','line_id','line_name','operator_name',
        'line_station_code','order_on_line','is_transfer_station','is_terminal',
        'adjacent_prev_station_id','adjacent_next_station_id'
    ])
    writer.writeheader()
    writer.writerows(station_lines)
print("station_lines.csv written")

print("\nDone. Summary:")
print(f"  Unique stations : {len(stations_master)}")
print(f"  Lines           : {len(LINES)}")
print(f"  Station-line rows: {len(station_lines)}")
for line_obj in LINES:
    print(f"  {line_obj['line_id']:4s} {line_obj['line_name']:12s} {line_obj['station_count']} stations")

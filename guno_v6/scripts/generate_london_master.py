"""
generate_london_master.py
Generate London master data package for GUNO V6.
Lines: Central, Northern, Piccadilly, District, Circle
Schema: aligned with Tokyo / Osaka
Transfer stations share a single slug across lines.
"""
import json, csv, os

OUT_DIR = "cities/london/data/master"
os.makedirs(OUT_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Canonical station registry
# Each entry: (slug, name_en, lat, lon)
# Shared slugs allow transfer detection across lines
# ─────────────────────────────────────────────────────────────────────────────
STATIONS = {
    # Central line
    "west_ruislip":         ("West Ruislip",                51.5694, -0.4363),
    "ruislip_gardens":      ("Ruislip Gardens",             51.5614, -0.4152),
    "south_ruislip":        ("South Ruislip",               51.5568, -0.3989),
    "northolt":             ("Northolt",                    51.5489, -0.3682),
    "greenford":            ("Greenford",                   51.5423, -0.3464),
    "perivale":             ("Perivale",                    51.5363, -0.3228),
    "hanger_lane":          ("Hanger Lane",                 51.5299, -0.2989),
    "ealing_broadway":      ("Ealing Broadway",             51.5149, -0.3016),
    "west_acton":           ("West Acton",                  51.5168, -0.2800),
    "north_acton":          ("North Acton",                 51.5228, -0.2640),
    "east_acton":           ("East Acton",                  51.5166, -0.2451),
    "white_city":           ("White City",                  51.5116, -0.2268),
    "shepherds_bush_mkt":   ("Shepherd's Bush Market",      51.5055, -0.2265),
    "goldhawk_road":        ("Goldhawk Road",               51.5016, -0.2267),
    "shepherds_bush":       ("Shepherd's Bush",             51.5049, -0.2188),
    "holland_park":         ("Holland Park",                51.5075, -0.2062),
    "notting_hill_gate":    ("Notting Hill Gate",           51.5094, -0.1963),
    "queensway":            ("Queensway",                   51.5107, -0.1875),
    "lancaster_gate":       ("Lancaster Gate",              51.5117, -0.1762),
    "marble_arch":          ("Marble Arch",                 51.5137, -0.1588),
    "bond_street":          ("Bond Street",                 51.5142, -0.1494),
    "oxford_circus":        ("Oxford Circus",               51.5152, -0.1415),
    "tottenham_court_rd":   ("Tottenham Court Road",        51.5165, -0.1304),
    "holborn":              ("Holborn",                     51.5174, -0.1200),
    "chancery_lane":        ("Chancery Lane",               51.5183, -0.1114),
    "st_pauls":             ("St. Paul's",                  51.5146, -0.0977),
    "bank":                 ("Bank",                        51.5133, -0.0886),
    "liverpool_street":     ("Liverpool Street",            51.5178, -0.0823),
    "bethnal_green":        ("Bethnal Green",               51.5272, -0.0553),
    "mile_end":             ("Mile End",                    51.5253, -0.0334),
    "stratford":            ("Stratford",                   51.5415, -0.0042),
    "leyton":               ("Leyton",                      51.5564, -0.0044),
    "leytonstone":          ("Leytonstone",                 51.5686,  0.0082),
    "snaresbrook":          ("Snaresbrook",                 51.5806,  0.0202),
    "south_woodford":       ("South Woodford",              51.5918,  0.0275),
    "woodford":             ("Woodford",                    51.6076,  0.0337),
    "buckhurst_hill":       ("Buckhurst Hill",              51.6268,  0.0468),
    "loughton":             ("Loughton",                    51.6413,  0.0560),
    "debden":               ("Debden",                      51.6453,  0.0840),
    "theydon_bois":         ("Theydon Bois",                51.6713,  0.1035),
    "epping":               ("Epping",                      51.6937,  0.1140),
    # Northern line
    "edgware":              ("Edgware",                     51.6133, -0.2756),
    "burnt_oak":            ("Burnt Oak",                   51.6026, -0.2657),
    "colindale":            ("Colindale",                   51.5952, -0.2503),
    "hendon_central":       ("Hendon Central",              51.5831, -0.2268),
    "brent_cross":          ("Brent Cross",                 51.5765, -0.2135),
    "golders_green":        ("Golders Green",               51.5724, -0.1943),
    "hampstead":            ("Hampstead",                   51.5665, -0.1783),
    "belsize_park":         ("Belsize Park",                51.5502, -0.1647),
    "chalk_farm":           ("Chalk Farm",                  51.5444, -0.1543),
    "camden_town":          ("Camden Town",                 51.5393, -0.1426),
    "mornington_crescent":  ("Mornington Crescent",         51.5343, -0.1389),
    "euston":               ("Euston",                      51.5282, -0.1337),
    "warren_street":        ("Warren Street",               51.5244, -0.1388),
    "goodge_street":        ("Goodge Street",               51.5205, -0.1347),
    "leicester_square":     ("Leicester Square",            51.5113, -0.1281),
    "charing_cross":        ("Charing Cross",               51.5081, -0.1248),
    "embankment":           ("Embankment",                  51.5074, -0.1223),
    "waterloo":             ("Waterloo",                    51.5036, -0.1143),
    "kennington":           ("Kennington",                  51.4882, -0.1053),
    "oval":                 ("Oval",                        51.4819, -0.1133),
    "stockwell":            ("Stockwell",                   51.4722, -0.1228),
    "clapham_north":        ("Clapham North",               51.4649, -0.1299),
    "clapham_common":       ("Clapham Common",              51.4614, -0.1384),
    "clapham_south":        ("Clapham South",               51.4549, -0.1480),
    "balham":               ("Balham",                      51.4432, -0.1527),
    "tooting_bec":          ("Tooting Bec",                 51.4352, -0.1609),
    "tooting_broadway":     ("Tooting Broadway",            51.4274, -0.1680),
    "colliers_wood":        ("Colliers Wood",               51.4197, -0.1882),
    "south_wimbledon":      ("South Wimbledon",             51.4140, -0.1919),
    "morden":               ("Morden",                      51.4023, -0.1948),
    # Piccadilly line
    "heathrow_t5":          ("Heathrow Terminal 5",         51.4733, -0.4890),
    "heathrow_t123":        ("Heathrow Terminals 2&3",      51.4713, -0.4524),
    "heathrow_t4":          ("Heathrow Terminal 4",         51.4583, -0.4479),
    "hatton_cross":         ("Hatton Cross",                51.4665, -0.4237),
    "hounslow_west":        ("Hounslow West",               51.4736, -0.3865),
    "hounslow_central":     ("Hounslow Central",            51.4719, -0.3669),
    "hounslow_east":        ("Hounslow East",               51.4724, -0.3455),
    "osterley":             ("Osterley",                    51.4811, -0.3522),
    "boston_manor":         ("Boston Manor",                51.4951, -0.3376),
    "northfields":          ("Northfields",                 51.4994, -0.3147),
    "south_ealing":         ("South Ealing",                51.5009, -0.3059),
    "acton_town":           ("Acton Town",                  51.5031, -0.2802),
    "chiswick_park":        ("Chiswick Park",               51.4944, -0.2678),
    "turnham_green":        ("Turnham Green",               51.4952, -0.2543),
    "stamford_brook":       ("Stamford Brook",              51.4951, -0.2408),
    "ravenscourt_park":     ("Ravenscourt Park",            51.4939, -0.2348),
    "hammersmith":          ("Hammersmith",                 51.4934, -0.2237),
    "barons_court":         ("Baron's Court",               51.4904, -0.2127),
    "west_kensington":      ("West Kensington",             51.4905, -0.2058),
    "earls_court":          ("Earl's Court",                51.4917, -0.1937),
    "gloucester_road":      ("Gloucester Road",             51.4944, -0.1831),
    "south_kensington":     ("South Kensington",            51.4941, -0.1738),
    "knightsbridge":        ("Knightsbridge",               51.5019, -0.1606),
    "hyde_park_corner":     ("Hyde Park Corner",            51.5027, -0.1527),
    "green_park":           ("Green Park",                  51.5067, -0.1428),
    "piccadilly_circus":    ("Piccadilly Circus",           51.5099, -0.1348),
    "covent_garden":        ("Covent Garden",               51.5129, -0.1243),
    "russell_square":       ("Russell Square",              51.5231, -0.1244),
    "kings_cross":          ("King's Cross St. Pancras",    51.5308, -0.1238),
    "caledonian_road":      ("Caledonian Road",             51.5436, -0.1194),
    "holloway_road":        ("Holloway Road",               51.5534, -0.1132),
    "arsenal":              ("Arsenal",                     51.5584, -0.1058),
    "finsbury_park":        ("Finsbury Park",               51.5642, -0.1006),
    "manor_house":          ("Manor House",                 51.5705, -0.0956),
    "turnpike_lane":        ("Turnpike Lane",               51.5901, -0.1034),
    "wood_green":           ("Wood Green",                  51.5975, -0.1095),
    "bounds_green":         ("Bounds Green",                51.6050, -0.1219),
    "arnos_grove":          ("Arnos Grove",                 51.6164, -0.1330),
    "southgate":            ("Southgate",                   51.6321, -0.1279),
    "oakwood":              ("Oakwood",                     51.6475, -0.1330),
    "cockfosters":          ("Cockfosters",                 51.6517, -0.1497),
    # District line (unique stations)
    "richmond":             ("Richmond",                    51.4633, -0.3013),
    "kew_gardens":          ("Kew Gardens",                 51.4777, -0.2849),
    "gunnersbury":          ("Gunnersbury",                 51.4918, -0.2750),
    "west_brompton":        ("West Brompton",               51.4869, -0.1946),
    "fulham_broadway":      ("Fulham Broadway",             51.4802, -0.1929),
    "parsons_green":        ("Parsons Green",               51.4749, -0.1998),
    "putney_bridge":        ("Putney Bridge",               51.4682, -0.2090),
    "east_putney":          ("East Putney",                 51.4607, -0.2121),
    "southfields":          ("Southfields",                 51.4452, -0.2065),
    "wimbledon_park":       ("Wimbledon Park",              51.4350, -0.2059),
    "wimbledon":            ("Wimbledon",                   51.4213, -0.2062),
    "sloane_square":        ("Sloane Square",               51.4924, -0.1565),
    "victoria":             ("Victoria",                    51.4965, -0.1447),
    "st_james_park":        ("St. James's Park",            51.4994, -0.1335),
    "westminster":          ("Westminster",                 51.5010, -0.1248),
    "temple":               ("Temple",                      51.5111, -0.1138),
    "blackfriars":          ("Blackfriars",                 51.5120, -0.1033),
    "mansion_house":        ("Mansion House",               51.5124, -0.0942),
    "cannon_street":        ("Cannon Street",               51.5113, -0.0904),
    "monument":             ("Monument",                    51.5100, -0.0858),
    "tower_hill":           ("Tower Hill",                  51.5098, -0.0765),
    "aldgate_east":         ("Aldgate East",                51.5151, -0.0726),
    "whitechapel":          ("Whitechapel",                 51.5196, -0.0600),
    "stepney_green":        ("Stepney Green",               51.5218, -0.0465),
    "bow_road":             ("Bow Road",                    51.5269, -0.0248),
    "bromley_by_bow":       ("Bromley-by-Bow",              51.5225, -0.0118),
    "west_ham":             ("West Ham",                    51.5286,  0.0053),
    "plaistow":             ("Plaistow",                    51.5318,  0.0200),
    "upton_park":           ("Upton Park",                  51.5352,  0.0349),
    "east_ham":             ("East Ham",                    51.5398,  0.0524),
    "barking":              ("Barking",                     51.5398,  0.0806),
    "upney":                ("Upney",                       51.5382,  0.1003),
    "becontree":            ("Becontree",                   51.5400,  0.1218),
    "dagenham_heathway":    ("Dagenham Heathway",           51.5418,  0.1401),
    "dagenham_east":        ("Dagenham East",               51.5443,  0.1601),
    "elm_park":             ("Elm Park",                    51.5491,  0.1895),
    "hornchurch":           ("Hornchurch",                  51.5540,  0.2137),
    "upminster_bridge":     ("Upminster Bridge",            51.5573,  0.2337),
    "upminster":            ("Upminster",                   51.5592,  0.2513),
    # Circle line (unique stations)
    "high_street_ken":      ("High Street Kensington",      51.5008, -0.1921),
    "bayswater":            ("Bayswater",                   51.5122, -0.1874),
    "paddington":           ("Paddington",                  51.5154, -0.1755),
    "edgware_road":         ("Edgware Road",                51.5199, -0.1686),
    "baker_street":         ("Baker Street",                51.5226, -0.1571),
    "great_portland_st":    ("Great Portland Street",       51.5242, -0.1441),
    "euston_square":        ("Euston Square",               51.5262, -0.1355),
    "farringdon":           ("Farringdon",                  51.5203, -0.1050),
    "barbican":             ("Barbican",                    51.5200, -0.0978),
    "moorgate":             ("Moorgate",                    51.5186, -0.0886),
    "aldgate":              ("Aldgate",                     51.5143, -0.0752),
}

# ─────────────────────────────────────────────────────────────────────────────
# 5 Lines with station slug lists (shared slugs = transfer stations)
# ─────────────────────────────────────────────────────────────────────────────
LINES = [
    {
        "line_id": "CEN", "line_name": "Central line", "color": "#DC241F", "is_loop": False,
        "slugs": [
            "west_ruislip","ruislip_gardens","south_ruislip","northolt","greenford",
            "perivale","hanger_lane","ealing_broadway","west_acton","north_acton",
            "east_acton","white_city","shepherds_bush_mkt","goldhawk_road","shepherds_bush",
            "holland_park","notting_hill_gate","queensway","lancaster_gate","marble_arch",
            "bond_street","oxford_circus","tottenham_court_rd","holborn","chancery_lane",
            "st_pauls","bank","liverpool_street","bethnal_green","mile_end",
            "stratford","leyton","leytonstone","snaresbrook","south_woodford",
            "woodford","buckhurst_hill","loughton","debden","theydon_bois","epping",
        ]
    },
    {
        "line_id": "NOR", "line_name": "Northern line", "color": "#000000", "is_loop": False,
        "slugs": [
            "edgware","burnt_oak","colindale","hendon_central","brent_cross",
            "golders_green","hampstead","belsize_park","chalk_farm","camden_town",
            "mornington_crescent","euston","warren_street","goodge_street","tottenham_court_rd",
            "leicester_square","charing_cross","embankment","waterloo","kennington",
            "oval","stockwell","clapham_north","clapham_common","clapham_south",
            "balham","tooting_bec","tooting_broadway","colliers_wood","south_wimbledon","morden",
        ]
    },
    {
        "line_id": "PIC", "line_name": "Piccadilly line", "color": "#003688", "is_loop": False,
        "slugs": [
            "heathrow_t5","heathrow_t123","heathrow_t4","hatton_cross","hounslow_west",
            "hounslow_central","hounslow_east","osterley","boston_manor","northfields",
            "south_ealing","acton_town","chiswick_park","turnham_green","stamford_brook",
            "ravenscourt_park","hammersmith","barons_court","west_kensington","earls_court",
            "gloucester_road","south_kensington","knightsbridge","hyde_park_corner","green_park",
            "piccadilly_circus","leicester_square","covent_garden","holborn","russell_square",
            "kings_cross","caledonian_road","holloway_road","arsenal","finsbury_park",
            "manor_house","turnpike_lane","wood_green","bounds_green","arnos_grove",
            "southgate","oakwood","cockfosters",
        ]
    },
    {
        "line_id": "DIS", "line_name": "District line", "color": "#00782A", "is_loop": False,
        "slugs": [
            "richmond","kew_gardens","gunnersbury","chiswick_park","turnham_green",
            "stamford_brook","ravenscourt_park","hammersmith","barons_court","west_kensington",
            "earls_court","west_brompton","fulham_broadway","parsons_green","putney_bridge",
            "east_putney","southfields","wimbledon_park","wimbledon",
            # main branch continues from earls_court
            "gloucester_road","south_kensington","sloane_square","victoria","st_james_park",
            "westminster","embankment","temple","blackfriars","mansion_house",
            "cannon_street","monument","tower_hill","aldgate_east","whitechapel",
            "stepney_green","mile_end","bow_road","bromley_by_bow","west_ham",
            "plaistow","upton_park","east_ham","barking","upney",
            "becontree","dagenham_heathway","dagenham_east","elm_park","hornchurch",
            "upminster_bridge","upminster",
        ]
    },
    {
        "line_id": "CIR", "line_name": "Circle line", "color": "#FFD329", "is_loop": True,
        "slugs": [
            "hammersmith","barons_court","west_kensington","earls_court","high_street_ken",
            "notting_hill_gate","bayswater","paddington","edgware_road","baker_street",
            "great_portland_st","euston_square","kings_cross","farringdon","barbican",
            "moorgate","liverpool_street","aldgate","tower_hill","monument",
            "cannon_street","mansion_house","blackfriars","temple","embankment",
            "westminster","st_james_park","victoria","sloane_square","south_kensington",
            "gloucester_road",
        ]
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# Compute line membership per station
# ─────────────────────────────────────────────────────────────────────────────
slug_lines = {}
for line in LINES:
    for slug in line["slugs"]:
        slug_lines.setdefault(slug, [])
        if line["line_id"] not in slug_lines[slug]:
            slug_lines[slug].append(line["line_id"])

# ─────────────────────────────────────────────────────────────────────────────
# station_global_id generator
# ─────────────────────────────────────────────────────────────────────────────
def make_station_id(lat, lon):
    lat_i = round(lat * 1000)
    lon_i = round(lon * 1000)
    sign_lat = "P" if lat_i >= 0 else "N"
    sign_lon = "P" if lon_i >= 0 else "N"
    return f"ST_{sign_lat}{abs(lat_i):05d}_{sign_lon}{abs(lon_i):05d}"

slug_to_id = {slug: make_station_id(lat, lon) for slug, (name, lat, lon) in STATIONS.items()}

# ─────────────────────────────────────────────────────────────────────────────
# Build stations_master
# ─────────────────────────────────────────────────────────────────────────────
# Only include stations that appear in at least one line
used_slugs = set()
for line in LINES:
    used_slugs.update(line["slugs"])

stations_master = []
for slug in sorted(used_slugs):
    name, lat, lon = STATIONS[slug]
    line_ids = slug_lines.get(slug, [])
    hub_degree = len(line_ids)
    stations_master.append({
        "station_global_id": slug_to_id[slug],
        "station_slug": slug,
        "station_name": name,
        "station_name_kana": "",
        "station_name_en": name,
        "prefecture_code": "ENG",
        "prefecture_name": "England",
        "lat": lat,
        "lon": lon,
        "operators": ["Transport for London"],
        "line_ids": line_ids,
        "line_count": hub_degree,
        "hub_degree_global": hub_degree,
        "source_names": [name],
        "aliases": [name + " station"],
        "status": "active",
    })

# ─────────────────────────────────────────────────────────────────────────────
# Build lines_master
# ─────────────────────────────────────────────────────────────────────────────
lines_master = []
for line in LINES:
    unique_slugs = list(dict.fromkeys(line["slugs"]))  # preserve order, deduplicate
    lines_master.append({
        "line_id": line["line_id"],
        "line_name": line["line_name"],
        "line_name_en": line["line_name"],
        "operator_name": "Transport for London",
        "color": line["color"],
        "prefectures": ["England"],
        "is_loop": line["is_loop"],
        "status": "active",
        "station_count": len(unique_slugs),
    })

# ─────────────────────────────────────────────────────────────────────────────
# Build station_lines
# ─────────────────────────────────────────────────────────────────────────────
station_lines = []
for line in LINES:
    slugs = line["slugs"]
    n = len(slugs)
    for i, slug in enumerate(slugs):
        sid = slug_to_id[slug]
        is_terminal = (i == 0 or i == n - 1)
        is_transfer = len(slug_lines.get(slug, [])) > 1
        prev_id = slug_to_id[slugs[i-1]] if i > 0 else None
        next_id = slug_to_id[slugs[i+1]] if i < n - 1 else None
        station_lines.append({
            "station_global_id": sid,
            "line_id": line["line_id"],
            "line_name": line["line_name"],
            "operator_name": "Transport for London",
            "line_station_code": f"{line['line_id']}{i+1:02d}",
            "order_on_line": i + 1,
            "is_transfer_station": is_transfer,
            "is_terminal": is_terminal,
            "adjacent_prev_station_id": prev_id,
            "adjacent_next_station_id": next_id,
        })

# ─────────────────────────────────────────────────────────────────────────────
# Write JSON + CSV
# ─────────────────────────────────────────────────────────────────────────────
with open(f"{OUT_DIR}/stations_master.json", "w", encoding="utf-8") as f:
    json.dump(stations_master, f, ensure_ascii=False, indent=2)
with open(f"{OUT_DIR}/lines_master.json", "w", encoding="utf-8") as f:
    json.dump(lines_master, f, ensure_ascii=False, indent=2)
with open(f"{OUT_DIR}/station_lines.json", "w", encoding="utf-8") as f:
    json.dump(station_lines, f, ensure_ascii=False, indent=2)

for fname, data in [("stations_master", stations_master), ("lines_master", lines_master), ("station_lines", station_lines)]:
    with open(f"{OUT_DIR}/{fname}.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(data[0].keys()))
        w.writeheader()
        for row in data:
            w.writerow({k: ("|".join(v) if isinstance(v, list) else v) for k, v in row.items()})

print(f"stations_master: {len(stations_master)} unique stations")
print(f"lines_master: {len(lines_master)} lines")
print(f"station_lines: {len(station_lines)} rows")
transfers = [s for s in stations_master if s["hub_degree_global"] > 1]
print(f"transfer stations: {len(transfers)}")
for t in sorted(transfers, key=lambda x: -x["hub_degree_global"]):
    print(f"  {t['station_name_en']} ({', '.join(t['line_ids'])}) degree={t['hub_degree_global']}")

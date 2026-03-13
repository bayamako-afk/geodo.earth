"""
generate_nyc_master.py
Generate NYC master data package for GUNO V6.
Lines: 1 (IRT Broadway-7th Ave), 4 (IRT Lexington Ave Express),
       A (IND 8th Ave Express), N (BMT Broadway), 7 (IRT Flushing)
Schema: aligned with Tokyo / Osaka / London
Transfer stations share a single slug across lines.
"""
import json, csv, os

OUT_DIR = "cities/nyc/data/master"
os.makedirs(OUT_DIR, exist_ok=True)

# ─────────────────────────────────────────────────────────────────────────────
# Canonical station registry
# Each entry: (name_en, lat, lon)
# Shared slugs allow transfer detection across lines
# ─────────────────────────────────────────────────────────────────────────────
STATIONS = {
    # ── 1 Train (IRT Broadway–7th Ave) ──────────────────────────────────────
    "van_cortlandt_242":    ("Van Cortlandt Park–242 St",          40.8895, -73.8988),
    "238_st":               ("238 St",                             40.8843, -73.9005),
    "231_st":               ("231 St",                             40.8784, -73.9042),
    "marble_hill_225":      ("Marble Hill–225 St",                 40.8740, -73.9099),
    "215_st":               ("215 St",                             40.8694, -73.9147),
    "207_st":               ("207 St",                             40.8647, -73.9191),
    "dyckman_st":           ("Dyckman St",                         40.8605, -73.9255),
    "191_st":               ("191 St",                             40.8557, -73.9295),
    "181_st":               ("181 St",                             40.8498, -73.9332),
    "168_st":               ("168 St–Washington Heights",          40.8402, -73.9397),
    "157_st":               ("157 St",                             40.8341, -73.9437),
    "145_st":               ("145 St",                             40.8259, -73.9481),
    "137_st_city_college":  ("137 St–City College",                40.8218, -73.9499),
    "125_st":               ("125 St",                             40.8157, -73.9543),
    "116_st_columbia":      ("116 St–Columbia University",         40.8079, -73.9632),
    "cathedral_pkwy_110":   ("Cathedral Pkwy–110 St",              40.8031, -73.9660),
    "103_st":               ("103 St",                             40.7999, -73.9681),
    "96_st":                ("96 St",                              40.7940, -73.9721),
    "86_st":                ("86 St",                              40.7885, -73.9760),
    "79_st":                ("79 St",                              40.7835, -73.9800),
    "72_st":                ("72 St",                              40.7780, -73.9823),
    "66_st_lincoln_ctr":    ("66 St–Lincoln Center",               40.7741, -73.9823),
    "59_st_columbus_circle":("59 St–Columbus Circle",              40.7682, -73.9819),
    "50_st":                ("50 St",                              40.7612, -73.9836),
    "times_sq_42":          ("Times Sq–42 St",                     40.7556, -73.9877),
    "34_st_penn":           ("34 St–Penn Station",                 40.7506, -73.9913),
    "28_st":                ("28 St",                              40.7472, -73.9942),
    "23_st":                ("23 St",                              40.7429, -73.9958),
    "18_st":                ("18 St",                              40.7400, -73.9977),
    "14_st":                ("14 St",                              40.7378, -73.9996),
    "christopher_st":       ("Christopher St–Sheridan Sq",         40.7333, -74.0027),
    "houston_st":           ("Houston St",                         40.7282, -74.0050),
    "canal_st":             ("Canal St",                           40.7226, -74.0056),
    "franklin_st":          ("Franklin St",                        40.7191, -74.0076),
    "chambers_st":          ("Chambers St",                        40.7141, -74.0087),
    "cortlandt_st":         ("Cortlandt St",                       40.7113, -74.0133),
    "rector_st":            ("Rector St",                          40.7079, -74.0132),
    "south_ferry":          ("South Ferry",                        40.7016, -74.0131),

    # ── 4 Train (IRT Lexington Ave Express) ─────────────────────────────────
    "woodlawn":             ("Woodlawn",                           40.9059, -73.8987),
    "mosholu_pkwy":         ("Mosholu Pkwy",                       40.8979, -73.8912),
    "norwood_205":          ("Norwood–205 St",                     40.8882, -73.8806),
    "bedford_pk_blvd":      ("Bedford Park Blvd",                  40.8731, -73.8831),
    "kingsbridge_rd":       ("Kingsbridge Rd",                     40.8683, -73.8979),
    "fordham_rd":           ("Fordham Rd",                         40.8620, -73.8972),
    "183_st":               ("183 St",                             40.8580, -73.8961),
    "176_st":               ("176 St",                             40.8487, -73.8958),
    "170_st":               ("170 St",                             40.8400, -73.8989),
    "167_st":               ("167 St",                             40.8327, -73.9028),
    "161_st_yankee":        ("161 St–Yankee Stadium",              40.8277, -73.9258),
    "149_st_grand_concourse":("149 St–Grand Concourse",            40.8189, -73.9272),
    "138_st_grand_concourse":("138 St–Grand Concourse",            40.8131, -73.9363),
    "125_st_lex":           ("125 St (Lex)",                       40.8043, -73.9377),
    "116_st_lex":           ("116 St (Lex)",                       40.7981, -73.9418),
    "110_st_lex":           ("110 St (Lex)",                       40.7924, -73.9443),
    "103_st_lex":           ("103 St (Lex)",                       40.7862, -73.9479),
    "96_st_lex":            ("96 St (Lex)",                        40.7843, -73.9475),
    "86_st_lex":            ("86 St (Lex)",                        40.7777, -73.9553),
    "77_st":                ("77 St",                              40.7736, -73.9596),
    "68_st_hunter":         ("68 St–Hunter College",               40.7683, -73.9637),
    "59_st_lex":            ("59 St (Lex)",                        40.7625, -73.9675),
    "51_st":                ("51 St",                              40.7574, -73.9718),
    "grand_central_42":     ("Grand Central–42 St",                40.7527, -73.9772),
    "33_st_park":           ("33 St (Park)",                       40.7465, -73.9843),
    "28_st_park":           ("28 St (Park)",                       40.7432, -73.9878),
    "23_st_park":           ("23 St (Park)",                       40.7398, -73.9895),
    "14_st_union_sq":       ("14 St–Union Sq",                     40.7352, -73.9903),
    "brooklyn_bridge":      ("Brooklyn Bridge–City Hall",          40.7130, -74.0040),
    "fulton_st":            ("Fulton St",                          40.7093, -74.0078),
    "wall_st":              ("Wall St",                            40.7073, -74.0110),
    "bowling_green":        ("Bowling Green",                      40.7046, -74.0141),
    "borough_hall":         ("Borough Hall",                       40.6925, -73.9899),
    "nevins_st":            ("Nevins St",                          40.6883, -73.9808),
    "atlantic_av_barclays": ("Atlantic Av–Barclays Ctr",           40.6843, -73.9779),
    "franklin_av":          ("Franklin Av",                        40.6818, -73.9584),
    "crown_heights_utica":  ("Crown Heights–Utica Av",             40.6696, -73.9294),
    "sutter_av_rutland":    ("Sutter Av–Rutland Rd",               40.6647, -73.9153),
    "saratoga_av":          ("Saratoga Av",                        40.6615, -73.9094),
    "rockaway_av":          ("Rockaway Av",                        40.6624, -73.9000),
    "junius_st":            ("Junius St",                          40.6606, -73.8929),
    "pennsylvania_av":      ("Pennsylvania Av",                    40.6640, -73.8879),
    "van_siclen_av":        ("Van Siclen Av",                      40.6649, -73.8793),
    "new_lots_av":          ("New Lots Av",                        40.6659, -73.8744),

    # ── A Train (IND 8th Ave Express) ────────────────────────────────────────
    "inwood_207":           ("Inwood–207 St",                      40.8679, -73.9211),
    "190_st":               ("190 St",                             40.8581, -73.9340),
    "175_st":               ("175 St",                             40.8470, -73.9370),
    "163_st_amsterdam":     ("163 St–Amsterdam Av",                40.8358, -73.9393),
    "155_st":               ("155 St",                             40.8299, -73.9416),
    "135_st":               ("135 St",                             40.8175, -73.9478),
    "81_st_museum":         ("81 St–Museum of Natural History",    40.7815, -73.9797),
    "42_st_port_authority": ("42 St–Port Authority Bus Terminal",  40.7572, -73.9903),
    "34_st_hudson_yards":   ("34 St–Hudson Yards",                 40.7548, -74.0019),
    "w_4_st":               ("W 4 St–Washington Sq",               40.7322, -74.0001),
    "spring_st":            ("Spring St",                          40.7262, -74.0030),
    "high_st_brooklyn_bridge":("High St–Brooklyn Bridge",          40.6993, -73.9900),
    "jay_st_metrotech":     ("Jay St–MetroTech",                   40.6921, -73.9851),
    "hoyt_schermerhorn":    ("Hoyt–Schermerhorn Sts",              40.6882, -73.9851),
    "nostrand_av":          ("Nostrand Av",                        40.6698, -73.9501),
    "kingston_throop":      ("Kingston–Throop Avs",                40.6680, -73.9405),
    "ralph_av":             ("Ralph Av",                           40.6784, -73.9200),
    "broadway_junction":    ("Broadway Junction",                  40.6783, -73.9049),
    "liberty_av":           ("Liberty Av",                         40.6745, -73.8866),
    "shepherd_av":          ("Shepherd Av",                        40.6742, -73.8716),
    "euclid_av":            ("Euclid Av",                          40.6751, -73.8720),
    "grant_av":             ("Grant Av",                           40.6773, -73.8659),
    "80_st":                ("80 St",                              40.6791, -73.8607),
    "88_st":                ("88 St",                              40.6804, -73.8556),
    "lefferts_blvd":        ("Ozone Park–Lefferts Blvd",           40.6852, -73.8486),
    "far_rockaway":         ("Far Rockaway–Mott Av",               40.6036, -73.7554),
    "rockaway_park":        ("Rockaway Park–Beach 116 St",         40.5805, -73.8132),

    # ── N Train (BMT Broadway) ────────────────────────────────────────────────
    "astoria_ditmars":      ("Astoria–Ditmars Blvd",               40.7754, -73.9120),
    "astoria_blvd":         ("Astoria Blvd",                       40.7706, -73.9301),
    "30_av":                ("30 Av",                              40.7663, -73.9305),
    "broadway_astoria":     ("Broadway (Astoria)",                 40.7614, -73.9269),
    "36_av":                ("36 Av",                              40.7561, -73.9299),
    "39_av":                ("39 Av–Dutch Kills",                  40.7519, -73.9299),
    "queensboro_plaza":     ("Queensboro Plaza",                   40.7506, -73.9404),
    "5_av_59":              ("5 Av/59 St",                         40.7648, -73.9731),
    "57_st_7_av":           ("57 St–7 Av",                         40.7638, -73.9776),
    "49_st":                ("49 St",                              40.7596, -73.9841),
    "34_st_herald_sq":      ("34 St–Herald Sq",                    40.7490, -73.9883),
    "8_st_nyu":             ("8 St–NYU",                           40.7307, -73.9921),
    "prince_st":            ("Prince St",                          40.7243, -73.9974),
    "canal_st_n":           ("Canal St (N)",                       40.7196, -74.0001),
    "city_hall_n":          ("City Hall (N)",                      40.7131, -74.0082),
    "whitehall_st":         ("Whitehall St–South Ferry",           40.7034, -74.0138),
    "court_st_n":           ("Court St",                           40.6941, -73.9918),
    "dekalb_av":            ("DeKalb Av",                          40.6906, -73.9818),
    "union_st_n":           ("Union St",                           40.6773, -73.9832),
    "4_av_9_st":            ("4 Av–9 St",                          40.6703, -73.9884),
    "prospect_av":          ("Prospect Av",                        40.6650, -73.9924),
    "25_st":                ("25 St",                              40.6603, -73.9985),
    "36_st_n":              ("36 St",                              40.6551, -74.0034),
    "45_st":                ("45 St",                              40.6487, -74.0095),
    "53_st_n":              ("53 St",                              40.6451, -74.0144),
    "59_st_4_av":           ("59 St (4 Av)",                       40.6412, -74.0175),
    "bay_ridge_95":         ("Bay Ridge–95 St",                    40.6163, -74.0305),

    # ── 7 Train (IRT Flushing) ────────────────────────────────────────────────
    "flushing_main":        ("Flushing–Main St",                   40.7596, -73.8300),
    "mets_willets_pt":      ("Mets–Willets Point",                 40.7543, -73.8456),
    "111_st_7":             ("111 St",                             40.7508, -73.8558),
    "junction_blvd":        ("Junction Blvd",                      40.7487, -73.8695),
    "jackson_hts_roosevelt":("Jackson Hts–Roosevelt Av",           40.7463, -73.8912),
    "90_st_elmhurst":       ("90 St–Elmhurst Av",                  40.7453, -73.8793),
    "82_st_jackson_hts":    ("82 St–Jackson Hts",                  40.7462, -73.8836),
    "74_st_broadway":       ("74 St–Broadway",                     40.7467, -73.8912),
    "69_st_fisk_av":        ("69 St–Fisk Av",                      40.7467, -73.9001),
    "61_st_woodside":       ("61 St–Woodside",                     40.7467, -73.9033),
    "52_st_lincoln_av":     ("52 St–Lincoln Av",                   40.7467, -73.9033),
    "46_st_bliss_st":       ("46 St–Bliss St",                     40.7467, -73.9033),
    "40_st_lowery":         ("40 St–Lowery St",                    40.7467, -73.9033),
    "33_st_rawson":         ("33 St–Rawson St",                    40.7467, -73.9033),
    "court_sq_7":           ("Court Sq",                           40.7472, -73.9453),
    "hunters_pt_av":        ("Hunters Point Av",                   40.7443, -73.9482),
    "vernon_jackson":       ("Vernon Blvd–Jackson Av",             40.7424, -73.9537),
    "5_av_42":              ("5 Av",                               40.7545, -73.9836),
}

# ─────────────────────────────────────────────────────────────────────────────
# Canonical line sequences (ordered station slugs per line)
# Transfer stations use the SAME slug across lines
# ─────────────────────────────────────────────────────────────────────────────
LINE_SLUGS = {
    "L1": [
        "van_cortlandt_242","238_st","231_st","marble_hill_225","215_st",
        "207_st","dyckman_st","191_st","181_st","168_st",
        "157_st","145_st","137_st_city_college","125_st","116_st_columbia",
        "cathedral_pkwy_110","103_st","96_st","86_st","79_st",
        "72_st","66_st_lincoln_ctr","59_st_columbus_circle","50_st","times_sq_42",
        "34_st_penn","28_st","23_st","18_st","14_st",
        "christopher_st","houston_st","canal_st","franklin_st","chambers_st",
        "cortlandt_st","rector_st","south_ferry",
    ],
    "L4": [
        "woodlawn","mosholu_pkwy","norwood_205","bedford_pk_blvd","kingsbridge_rd",
        "fordham_rd","183_st","176_st","170_st","167_st",
        "161_st_yankee","149_st_grand_concourse","138_st_grand_concourse","125_st_lex","116_st_lex",
        "110_st_lex","103_st_lex","96_st_lex","86_st_lex","77_st",
        "68_st_hunter","59_st_lex","51_st","grand_central_42","33_st_park",
        "28_st_park","23_st_park","14_st_union_sq","brooklyn_bridge","fulton_st",
        "wall_st","bowling_green","borough_hall","nevins_st","atlantic_av_barclays",
        "franklin_av","crown_heights_utica","sutter_av_rutland","saratoga_av","rockaway_av",
        "junius_st","pennsylvania_av","van_siclen_av","new_lots_av",
    ],
    "LA": [
        "inwood_207","207_st","190_st","181_st","175_st",
        "168_st","163_st_amsterdam","155_st","145_st","135_st",
        "125_st","116_st_columbia","cathedral_pkwy_110","103_st","96_st",
        "86_st","81_st_museum","72_st","59_st_columbus_circle","50_st",
        "42_st_port_authority","34_st_hudson_yards","23_st","14_st","w_4_st",
        "spring_st","canal_st","chambers_st","fulton_st","high_st_brooklyn_bridge",
        "jay_st_metrotech","hoyt_schermerhorn","nostrand_av","kingston_throop","ralph_av",
        "rockaway_av","broadway_junction","liberty_av","van_siclen_av","shepherd_av",
        "euclid_av","grant_av","80_st","88_st","lefferts_blvd",
    ],
    "LN": [
        "astoria_ditmars","astoria_blvd","30_av","broadway_astoria","36_av",
        "39_av","queensboro_plaza","59_st_lex","5_av_59","57_st_7_av",
        "49_st","times_sq_42","34_st_herald_sq","28_st","23_st",
        "14_st_union_sq","8_st_nyu","prince_st","canal_st_n","city_hall_n",
        "cortlandt_st","rector_st","whitehall_st","court_st_n","dekalb_av",
        "atlantic_av_barclays","union_st_n","4_av_9_st","prospect_av","25_st",
        "36_st_n","45_st","53_st_n","59_st_4_av","bay_ridge_95",
    ],
    "L7": [
        "flushing_main","mets_willets_pt","111_st_7","junction_blvd","jackson_hts_roosevelt",
        "90_st_elmhurst","82_st_jackson_hts","74_st_broadway","69_st_fisk_av","61_st_woodside",
        "52_st_lincoln_av","46_st_bliss_st","40_st_lowery","33_st_rawson","queensboro_plaza",
        "court_sq_7","hunters_pt_av","vernon_jackson","grand_central_42","5_av_42",
        "times_sq_42","34_st_hudson_yards",
    ],
}

# ─────────────────────────────────────────────────────────────────────────────
# Lines master
# ─────────────────────────────────────────────────────────────────────────────
LINES = [
    {"line_id": "L1", "line_name": "1 Train", "line_name_en": "1 Train",
     "color": "#EE352E", "operator": "MTA New York City Transit",
     "system": "IRT Broadway–7th Ave", "city": "nyc"},
    {"line_id": "L4", "line_name": "4 Train", "line_name_en": "4 Train",
     "color": "#00933C", "operator": "MTA New York City Transit",
     "system": "IRT Lexington Ave Express", "city": "nyc"},
    {"line_id": "LA", "line_name": "A Train", "line_name_en": "A Train",
     "color": "#2850AD", "operator": "MTA New York City Transit",
     "system": "IND 8th Ave Express", "city": "nyc"},
    {"line_id": "LN", "line_name": "N Train", "line_name_en": "N Train",
     "color": "#FCCC0A", "operator": "MTA New York City Transit",
     "system": "BMT Broadway", "city": "nyc"},
    {"line_id": "L7", "line_name": "7 Train", "line_name_en": "7 Train",
     "color": "#B933AD", "operator": "MTA New York City Transit",
     "system": "IRT Flushing", "city": "nyc"},
]

# ─────────────────────────────────────────────────────────────────────────────
# Build stations_master (unique stations)
# ─────────────────────────────────────────────────────────────────────────────
all_slugs_ordered = []
seen_slugs = set()
for slugs in LINE_SLUGS.values():
    for s in slugs:
        if s not in seen_slugs:
            seen_slugs.add(s)
            all_slugs_ordered.append(s)

missing = [s for s in all_slugs_ordered if s not in STATIONS]
if missing:
    print(f"WARNING: {len(missing)} slugs missing from STATIONS: {missing}")

stations_master = []
slug_to_gid = {}
for i, slug in enumerate(sorted(all_slugs_ordered), start=1):
    if slug not in STATIONS:
        continue
    name_en, lat, lon = STATIONS[slug]
    gid = f"nyc_{i:04d}"
    slug_to_gid[slug] = gid
    stations_master.append({
        "station_global_id": gid,
        "station_slug": slug,
        "station_name": name_en,
        "station_name_en": name_en,
        "station_name_local": name_en,
        "city": "nyc",
        "lat": lat,
        "lon": lon,
    })

# ─────────────────────────────────────────────────────────────────────────────
# Build station_lines (which stations belong to which lines)
# ─────────────────────────────────────────────────────────────────────────────
station_lines = []
seen_pairs = set()
for line_id, slugs in LINE_SLUGS.items():
    for order, slug in enumerate(slugs, start=1):
        gid = slug_to_gid.get(slug)
        if gid is None:
            continue
        pair = (gid, line_id)
        if pair not in seen_pairs:
            seen_pairs.add(pair)
            station_lines.append({
                "station_global_id": gid,
                "line_id": line_id,
                "order_in_line": order,
            })

# ─────────────────────────────────────────────────────────────────────────────
# Write JSON + CSV
# ─────────────────────────────────────────────────────────────────────────────
with open(f"{OUT_DIR}/stations_master.json", "w", encoding="utf-8") as f:
    json.dump(stations_master, f, ensure_ascii=False, indent=2)

with open(f"{OUT_DIR}/lines_master.json", "w", encoding="utf-8") as f:
    json.dump(LINES, f, ensure_ascii=False, indent=2)

with open(f"{OUT_DIR}/station_lines.json", "w", encoding="utf-8") as f:
    json.dump(station_lines, f, ensure_ascii=False, indent=2)

# CSV companions
if stations_master:
    with open(f"{OUT_DIR}/stations_master.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(stations_master[0].keys()))
        w.writeheader()
        w.writerows(stations_master)

with open(f"{OUT_DIR}/lines_master.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(LINES[0].keys()))
    w.writeheader()
    w.writerows(LINES)

if station_lines:
    with open(f"{OUT_DIR}/station_lines.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(station_lines[0].keys()))
        w.writeheader()
        w.writerows(station_lines)

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
all_unique_slugs = set(slug for slugs in LINE_SLUGS.values() for slug in slugs)
transfer_slugs = {s for s in all_unique_slugs
                  if sum(1 for slugs in LINE_SLUGS.values() if s in slugs) > 1}

print(f"stations_master: {len(stations_master)} unique stations")
print(f"lines_master: {len(LINES)} lines")
print(f"station_lines: {len(station_lines)} entries")
print(f"transfer stations: {len(transfer_slugs)}")
print("Transfer stations:")
for s in sorted(transfer_slugs):
    lines_with_s = [lid for lid, slugs in LINE_SLUGS.items() if s in slugs]
    print(f"  {s}: {lines_with_s}")

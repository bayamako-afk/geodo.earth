"""
generate_nyc_deck.py
Generate deck_v1.json and pack_v1.json for NYC.
- ROUTE_SIZE = 10 (engine constraint)
- pack_v1 schema matches Tokyo: collections.members = string ID array, entities = dict
- deck_size = 40, rarity by composite_score rank
- Lines: L1(1 Train), L4(4 Train), LA(A Train), LN(N Train), L7(7 Train)
"""
import json, csv, os, datetime
from collections import Counter

MASTER_DIR  = "cities/nyc/data/master"
DERIVED_DIR = "cities/nyc/data/derived"
DECKS_DIR   = "cities/nyc/data/decks"
PACKS_DIR   = "cities/nyc/data/packs"
for d in [DECKS_DIR, PACKS_DIR]:
    os.makedirs(d, exist_ok=True)

ROUTE_SIZE = 10
DECK_SIZE  = 40
RARITY_TARGETS = {"legendary": 1, "epic": 9, "rare": 10, "common": 20}

with open(f"{MASTER_DIR}/stations_master.json", encoding="utf-8") as f:
    stations_master = json.load(f)
with open(f"{MASTER_DIR}/station_lines.json", encoding="utf-8") as f:
    station_lines_data = json.load(f)
with open(f"{MASTER_DIR}/lines_master.json", encoding="utf-8") as f:
    lines_master = json.load(f)
with open(f"{DERIVED_DIR}/station_metrics.json", encoding="utf-8") as f:
    station_metrics_data = json.load(f)

id_to_metrics = {m["station_global_id"]: m for m in station_metrics_data["stations"]}
id_to_station = {s["station_global_id"]: s for s in stations_master}
slug_to_id    = {s["station_slug"]: s["station_global_id"] for s in stations_master}

# ─────────────────────────────────────────────────────────────────────────────
# Line slug sequences (ordered station slugs per line)
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

LINE_INFO = {l["line_id"]: l for l in lines_master}

# ─────────────────────────────────────────────────────────────────────────────
# Select 10 representative stations per line
# Rule: first + last + top-8 by composite_score (no duplicates within line)
# ─────────────────────────────────────────────────────────────────────────────
def select_10_stations(line_id, slugs):
    unique_slugs = list(dict.fromkeys(slugs))
    first_slug = unique_slugs[0]
    last_slug  = unique_slugs[-1]
    fixed = {first_slug, last_slug}

    scored = []
    for slug in unique_slugs:
        sid = slug_to_id.get(slug)
        if sid is None:
            continue
        m = id_to_metrics.get(sid, {})
        scored.append((slug, m.get("composite_score", 0.0)))

    scored_sorted = sorted(scored, key=lambda x: -x[1])
    top8 = [s for s, _ in scored_sorted if s not in fixed][:8]

    selected = [first_slug] + top8 + [last_slug]
    seen = set()
    result = []
    for slug in selected:
        if slug not in seen:
            seen.add(slug)
            result.append(slug)

    if len(result) < ROUTE_SIZE:
        for slug in unique_slugs:
            if slug not in seen:
                seen.add(slug)
                result.append(slug)
            if len(result) == ROUTE_SIZE:
                break
    return result[:ROUTE_SIZE]

# ─────────────────────────────────────────────────────────────────────────────
# Build collections and entities (Tokyo-compatible schema)
# ─────────────────────────────────────────────────────────────────────────────
collections = {}
entities    = {}
station_line_membership = {}  # sid -> [lc, ...]

for line_id, slugs in LINE_SLUGS.items():
    lc = line_id.lower()
    rep_slugs = select_10_stations(line_id, slugs)
    member_ids = []
    for order, slug in enumerate(rep_slugs, start=1):
        sid = slug_to_id.get(slug)
        if sid is None:
            print(f"WARNING: slug '{slug}' not found in slug_to_id")
            continue
        s = id_to_station.get(sid, {})
        entity_id = f"{lc}-{order:02d}"
        member_ids.append(entity_id)
        entities[entity_id] = {
            "type": "station",
            "name_ja": s.get("station_name", slug),
            "name_en": s.get("station_name_en", slug),
            "station_code": entity_id,
            "station_global_id": sid,
            "cross_lines": [],
        }
        if sid not in station_line_membership:
            station_line_membership[sid] = []
        station_line_membership[sid].append(lc)

    li = LINE_INFO.get(line_id, {})
    collections[lc] = {
        "kind": "line",
        "lc": lc,
        "name_ja": li.get("line_name", lc),
        "name_en": li.get("line_name_en", lc),
        "color": li.get("color", "#888888"),
        "size": ROUTE_SIZE,
        "members": member_ids,
    }

# Fill cross_lines for interchange stations
for entity_id, entity in entities.items():
    sid = entity.get("station_global_id")
    if sid:
        entity["cross_lines"] = station_line_membership.get(sid, [])

# Build slots for layouts.default
slots = []
for lc, col in collections.items():
    slots.append({
        "collection_id": lc,
        "line_id": lc.upper(),
        "line_name": col["name_en"],
        "color": col["color"],
        "size": ROUTE_SIZE,
    })

# ─────────────────────────────────────────────────────────────────────────────
# pack_v1.json (Tokyo-compatible schema)
# ─────────────────────────────────────────────────────────────────────────────
pack_v1 = {
    "pack_meta": {
        "pack_version": "1.0",
        "pack_id": "nyc_v1",
        "name": "NYC Subway Pack v1",
        "description": "5-line NYC Subway pack: 1/4/A/N/7 Trains",
        "generated_by": "generate_nyc_deck.py",
        "generated_at": datetime.date.today().isoformat(),
    },
    "layouts": {
        "default": {
            "slots": slots,
        }
    },
    "collections": collections,
    "entities": entities,
    "rules": {
        "route_size": ROUTE_SIZE,
        "allow_transfer_bonus": True,
    },
}

with open(f"{PACKS_DIR}/pack_v1.json", "w", encoding="utf-8") as f:
    json.dump(pack_v1, f, ensure_ascii=False, indent=2)

# ─────────────────────────────────────────────────────────────────────────────
# deck_v1.json
# Pool: all entity stations sorted by composite_score desc
# ─────────────────────────────────────────────────────────────────────────────
pool = []
for entity_id, entity in entities.items():
    sid = entity.get("station_global_id")
    m = id_to_metrics.get(sid, {})
    pool.append({
        "entity_id": entity_id,
        "station_global_id": sid,
        "station_name": entity["name_ja"],
        "station_name_en": entity["name_en"],
        "composite_score": m.get("composite_score", 0.0),
        "lc": entity_id.split("-")[0],
    })

pool.sort(key=lambda x: -x["composite_score"])

# Deduplicate by station_global_id (keep highest-scoring entity)
seen_sids = set()
deduped_pool = []
for item in pool:
    if item["station_global_id"] not in seen_sids:
        seen_sids.add(item["station_global_id"])
        deduped_pool.append(item)

selected_pool = deduped_pool[:DECK_SIZE]

# Assign rarity by rank
rarity_order = ["legendary", "epic", "rare", "common"]
assigned_rarities = []
for rarity in rarity_order:
    count = RARITY_TARGETS.get(rarity, 0)
    assigned_rarities.extend([rarity] * count)
while len(assigned_rarities) < len(selected_pool):
    assigned_rarities.append("common")

deck_cards = []
for i, item in enumerate(selected_pool):
    sid = item["station_global_id"]
    s = id_to_station.get(sid, {})
    assigned_rarity = assigned_rarities[i] if i < len(assigned_rarities) else "common"
    lc = item["lc"]
    col = collections.get(lc, {})
    entity_id = item["entity_id"]
    order = col.get("members", []).index(entity_id) + 1 if entity_id in col.get("members", []) else 1
    deck_cards.append({
        "card_id": f"NYC{i+1:03d}",
        "station_global_id": sid,
        "station_name": item["station_name"],
        "station_name_en": item["station_name_en"],
        "line_id": lc.upper(),
        "collection_id": lc,
        "order": order,
        "rarity": assigned_rarity,
        "composite_score": item["composite_score"],
    })

deck_v1 = {
    "deck_meta": {
        "deck_name": "nyc_v1",
        "city_id": "nyc",
        "version": "1.0",
        "deck_size": len(deck_cards),
        "generator": "generate_nyc_deck.py",
        "generated_at": datetime.date.today().isoformat(),
    },
    "cards": deck_cards,
}

with open(f"{DECKS_DIR}/deck_v1.json", "w", encoding="utf-8") as f:
    json.dump(deck_v1, f, ensure_ascii=False, indent=2)

with open(f"{DECKS_DIR}/deck_v1.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=list(deck_cards[0].keys()))
    w.writeheader()
    w.writerows(deck_cards)

# Report
rarity_dist = Counter(c["rarity"] for c in deck_cards)
print(f"pack_v1: {len(collections)} collections, {len(entities)} entities")
print(f"deck_v1: {len(deck_cards)} cards")
print(f"rarity distribution: {dict(rarity_dist)}")
print("Collection sizes:")
for lc, col in collections.items():
    print(f"  {lc}: size={col['size']}, members={len(col['members'])}")
print("Top 5 deck cards:")
for c in sorted(deck_cards, key=lambda x: -x["composite_score"])[:5]:
    print(f"  {c['card_id']} {c['station_name_en']} ({c['line_id']}) score={c['composite_score']} rarity={c['rarity']}")
print("Representative 10 stations per line:")
for lc, col in collections.items():
    names = [entities[eid]["name_en"] for eid in col["members"] if eid in entities]
    print(f"  {lc.upper()}: {names}")

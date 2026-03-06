#!/usr/bin/env python3
"""
build_guno_pack_v1.py
GUNO Pack v0.2 → v1.0 変換・Hub派生値付与（global + deck）・Validation・stats出力

使い方:
  python build_guno_pack_v1.py input_pack.json --out pack_with_hubs.json --stats hub_stats.json

オプション:
  --out      出力packファイルパス（省略時: <input>_v1.json）
  --stats    statsファイルパス（省略時: hub_stats.json）
  --dry-run  変換・検証のみ行い、ファイルを出力しない
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


# ─────────────────────────────────────────
# Hub Rank計算（共通）
# ─────────────────────────────────────────

def calc_hub_rank(hub_degree: int) -> str:
    if hub_degree >= 4:
        return "S"
    elif hub_degree == 3:
        return "A"
    elif hub_degree == 2:
        return "B"
    else:
        return "C"


# ─────────────────────────────────────────
# Step1: Deck路線セット取得
# ─────────────────────────────────────────

def get_deck_lines(pack: dict) -> set:
    """collectionsからroute種別のlcをセットで返す"""
    deck_lines = set()
    for col in pack.get("collections", {}).values():
        if col.get("kind") == "route" and col.get("lc"):
            deck_lines.add(col["lc"])
    return deck_lines


# ─────────────────────────────────────────
# Step2: Global Hub計算
# ─────────────────────────────────────────

def calc_global_hub(entity: dict) -> dict:
    """global hub値を計算して返す（hub_degree_global / hub_bonus_global / hub_rank_global）"""
    cross = entity.get("cross_lines") or []
    deg = 1 + len(cross)
    return {
        "hub_degree_global": deg,
        "hub_bonus_global": (deg - 1) * 2,
        "hub_rank_global": calc_hub_rank(deg),
    }


# ─────────────────────────────────────────
# Step3: Deck Hub計算
# ─────────────────────────────────────────

def calc_deck_hub(entity: dict, deck_lines: set) -> dict:
    """deck hub値を計算して返す（hub_degree_deck / hub_bonus_deck / hub_rank_deck）"""
    cross = entity.get("cross_lines") or []
    deck_cross = [lc for lc in cross if lc in deck_lines]
    deg = 1 + len(deck_cross)
    return {
        "hub_degree_deck": deg,
        "hub_bonus_deck": (deg - 1) * 2,
        "hub_rank_deck": calc_hub_rank(deg),
    }


# ─────────────────────────────────────────
# Step4: Station EntityにHub値を付与
# ─────────────────────────────────────────

def attach_hub_values(entity: dict, deck_lines: set) -> dict:
    """entityにglobal/deck両方のhub値を付与して返す"""
    if entity.get("type") != "station":
        return entity

    g = calc_global_hub(entity)
    d = calc_deck_hub(entity, deck_lines)

    # global hub
    entity["hub_degree_global"] = g["hub_degree_global"]
    entity["hub_bonus_global"]  = g["hub_bonus_global"]
    entity["hub_rank_global"]   = g["hub_rank_global"]

    # deck hub
    entity["hub_degree_deck"] = d["hub_degree_deck"]
    entity["hub_bonus_deck"]  = d["hub_bonus_deck"]
    entity["hub_rank_deck"]   = d["hub_rank_deck"]

    # エイリアス（global hubと同値）
    entity["hub_degree"] = g["hub_degree_global"]
    entity["hub_bonus"]  = g["hub_bonus_global"]
    entity["hub_rank"]   = g["hub_rank_global"]

    return entity


# ─────────────────────────────────────────
# v0.2 → v1.0 互換補完（仕様 §8.1）
# ─────────────────────────────────────────

def upgrade_pack(pack: dict) -> dict:
    """v0.2 packをv1.0形式に変換・補完する"""
    pack.setdefault("pack_meta", {})
    pack["pack_meta"]["pack_version"] = "1.0"
    pack["pack_meta"]["updated_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # station_code補完：entitiesキーをstation_codeとして補完
    for eid, entity in pack.get("entities", {}).items():
        if entity.get("type") == "station" and "station_code" not in entity:
            entity["station_code"] = eid

    return pack


# ─────────────────────────────────────────
# 必須Validation（仕様 §9.1）
# ─────────────────────────────────────────

def validate_pack(pack: dict) -> list:
    errors = []

    version = pack.get("pack_meta", {}).get("pack_version")
    if version != "1.0":
        errors.append(f"pack_meta.pack_version が '1.0' ではありません（現在: {version!r}）")

    entities = pack.get("entities")
    if not isinstance(entities, dict):
        errors.append("entities が辞書ではありません")
        return errors

    collections = pack.get("collections")
    if not isinstance(collections, dict):
        errors.append("collections が辞書ではありません")
        return errors

    for cid, col in collections.items():
        if col.get("kind") != "route":
            errors.append(f"collections[{cid!r}].kind が 'route' ではありません（現在: {col.get('kind')!r}）")
            continue

        members = col.get("members")
        if not isinstance(members, list):
            errors.append(f"collections[{cid!r}].members が配列ではありません")
            continue

        for eid in members:
            if eid is None:
                continue
            if eid not in entities:
                errors.append(f"collections[{cid!r}].members に未定義のentityID {eid!r} が含まれています")
            else:
                etype = entities[eid].get("type")
                if etype != "station":
                    errors.append(
                        f"collections[{cid!r}].members[{eid!r}].type が 'station' ではありません（現在: {etype!r}）"
                    )

    return errors


# ─────────────────────────────────────────
# Step5: Stats生成（global + deck）
# ─────────────────────────────────────────

def build_stats(pack: dict) -> dict:
    entities = pack.get("entities", {})
    stations = [e for e in entities.values() if e.get("type") == "station"]

    rank_global = {"S": 0, "A": 0, "B": 0, "C": 0}
    rank_deck   = {"S": 0, "A": 0, "B": 0, "C": 0}

    for s in stations:
        rg = s.get("hub_rank_global", "C")
        rd = s.get("hub_rank_deck", "C")
        if rg in rank_global:
            rank_global[rg] += 1
        if rd in rank_deck:
            rank_deck[rd] += 1

    return {
        "stations_processed": len(stations),
        "hub_rank_global": rank_global,
        "hub_rank_deck":   rank_deck,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ─────────────────────────────────────────
# メイン処理
# ─────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="GUNO Pack v0.2 → v1.0 変換・Hub付与（global+deck）・Validation・stats出力"
    )
    parser.add_argument("input", help="入力packファイル（JSON）")
    parser.add_argument("--out",   help="出力packファイルパス（省略時: <input>_v1.json）")
    parser.add_argument("--stats", default="hub_stats.json", help="statsファイルパス（省略時: hub_stats.json）")
    parser.add_argument("--dry-run", action="store_true", help="ファイルを出力せず検証のみ実行")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"❌ 入力ファイルが見つかりません: {input_path}", file=sys.stderr)
        sys.exit(1)

    try:
        with open(input_path, encoding="utf-8") as f:
            pack = json.load(f)
    except json.JSONDecodeError as e:
        print(f"❌ JSONパースエラー: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"📂 入力: {input_path}")
    print(f"   pack_version: {pack.get('pack_meta', {}).get('pack_version', '(なし)')}")
    print(f"   entities: {len(pack.get('entities', {}))} 件")
    print(f"   collections: {len(pack.get('collections', {}))} 件")

    # ── Step 1: Deck路線セット取得 ──
    deck_lines = get_deck_lines(pack)
    print(f"\n📋 Step 1: Deck路線セット取得...")
    print(f"   deck_lines: {sorted(deck_lines)}")

    # ── Step 2+3: v0.2 → v1.0 互換補完 ──
    print(f"\n🔄 Step 2: v0.2 → v1.0 互換補完...")
    pack = upgrade_pack(pack)
    print("   ✅ pack_version を 1.0 に更新")
    print("   ✅ station_code 補完完了")

    # ── Step 3+4: Hub派生値付与（global + deck）──
    print(f"\n🔢 Step 3: Hub派生値付与（global + deck）...")
    rank_global = {"S": 0, "A": 0, "B": 0, "C": 0}
    rank_deck   = {"S": 0, "A": 0, "B": 0, "C": 0}
    for eid, entity in pack.get("entities", {}).items():
        if entity.get("type") == "station":
            attach_hub_values(entity, deck_lines)
            rank_global[entity["hub_rank_global"]] += 1
            rank_deck[entity["hub_rank_deck"]] += 1
    total = sum(rank_global.values())
    print(f"   ✅ {total} 駅にhub値を付与")
    print(f"   global ランク: S={rank_global['S']} A={rank_global['A']} B={rank_global['B']} C={rank_global['C']}")
    print(f"   deck   ランク: S={rank_deck['S']}   A={rank_deck['A']}   B={rank_deck['B']}   C={rank_deck['C']}")

    # ── 必須Validation ──
    print(f"\n🔍 Step 4: 必須Validation...")
    errors = validate_pack(pack)
    if errors:
        print(f"   ❌ {len(errors)} 件のエラーが見つかりました:")
        for e in errors:
            print(f"      - {e}")
        if not args.dry_run:
            print("\n⚠ エラーがあるため出力を中止します。")
            sys.exit(1)
    else:
        print("   ✅ 必須Validation: すべてOK")

    if args.dry_run:
        print("\n🔎 --dry-run モード: ファイル出力をスキップしました")
        sys.exit(0)

    # ── Step 5: ファイル出力 ──
    out_path   = Path(args.out) if args.out else input_path.with_stem(input_path.stem + "_v1")
    stats_path = Path(args.stats)

    print(f"\n💾 Step 5: ファイル出力...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
    print(f"   ✅ pack出力: {out_path}")

    stats = build_stats(pack)
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"   ✅ stats出力: {stats_path}")

    print(f"\n🎉 完了！")
    print(f"   stations_processed : {stats['stations_processed']}")
    print(f"   hub_rank_global    : {stats['hub_rank_global']}")
    print(f"   hub_rank_deck      : {stats['hub_rank_deck']}")


if __name__ == "__main__":
    main()

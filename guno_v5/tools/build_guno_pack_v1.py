#!/usr/bin/env python3
"""
build_guno_pack_v1.py
GUNO Pack v0.2 → v1.0 変換・Hub派生値付与・Validation・stats出力

使い方:
  python build_guno_pack_v1.py input_pack.json --out pack_with_hubs.json --stats hub_stats.json

オプション:
  --out   出力packファイルパス（省略時: <input>_v1.json）
  --stats statsファイルパス（省略時: hub_stats.json）
  --dry-run  変換・検証のみ行い、ファイルを出力しない
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path


# ─────────────────────────────────────────
# Hub派生値計算（仕様 §7）
# ─────────────────────────────────────────

def calc_hub_degree(entity: dict) -> int:
    """hub_degree = 1 + len(cross_lines)"""
    cross = entity.get("cross_lines") or []
    return 1 + len(cross)


def calc_hub_bonus(hub_degree: int) -> int:
    """hub_bonus = (hub_degree - 1) * 2"""
    return (hub_degree - 1) * 2


def calc_hub_rank(hub_degree: int) -> str:
    """hub_rank: S/A/B/C"""
    if hub_degree >= 4:
        return "S"
    elif hub_degree == 3:
        return "A"
    elif hub_degree == 2:
        return "B"
    else:
        return "C"


def attach_hub_values(entity: dict) -> dict:
    """entityにhub_degree/hub_bonus/hub_rankを付与して返す"""
    if entity.get("type") != "station":
        return entity
    deg = calc_hub_degree(entity)
    entity["hub_degree"] = deg
    entity["hub_bonus"] = calc_hub_bonus(deg)
    entity["hub_rank"] = calc_hub_rank(deg)
    return entity


# ─────────────────────────────────────────
# v0.2 → v1.0 互換補完（仕様 §8.1）
# ─────────────────────────────────────────

def upgrade_pack(pack: dict) -> dict:
    """v0.2 packをv1.0形式に変換・補完する"""
    # pack_versionを1.0に更新
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

def validate_pack(pack: dict) -> list[str]:
    """必須検証を実行し、エラーメッセージのリストを返す（空=OK）"""
    errors = []

    # pack_versionチェック
    version = pack.get("pack_meta", {}).get("pack_version")
    if version != "1.0":
        errors.append(f"pack_meta.pack_version が '1.0' ではありません（現在: {version!r}）")

    # entitiesは辞書
    entities = pack.get("entities")
    if not isinstance(entities, dict):
        errors.append("entities が辞書ではありません")
        return errors  # 以降の検証が不可能なため早期リターン

    # collectionsは辞書
    collections = pack.get("collections")
    if not isinstance(collections, dict):
        errors.append("collections が辞書ではありません")
        return errors

    for cid, col in collections.items():
        # route.kind == "route"
        if col.get("kind") != "route":
            errors.append(f"collections[{cid!r}].kind が 'route' ではありません（現在: {col.get('kind')!r}）")
            continue

        members = col.get("members")
        if not isinstance(members, list):
            errors.append(f"collections[{cid!r}].members が配列ではありません")
            continue

        for eid in members:
            if eid is None:
                continue  # 未配置スロット（null）は許容
            # 全IDがentitiesに存在する
            if eid not in entities:
                errors.append(f"collections[{cid!r}].members に未定義のentityID {eid!r} が含まれています")
            else:
                # member_type_allowed: typeは"station"
                etype = entities[eid].get("type")
                if etype != "station":
                    errors.append(
                        f"collections[{cid!r}].members[{eid!r}].type が 'station' ではありません（現在: {etype!r}）"
                    )

    return errors


# ─────────────────────────────────────────
# stats生成（仕様 §8.2）
# ─────────────────────────────────────────

def build_stats(pack: dict) -> dict:
    """hub_stats.jsonの内容を生成する"""
    entities = pack.get("entities", {})
    stations = [e for e in entities.values() if e.get("type") == "station"]

    rank_count = {"S": 0, "A": 0, "B": 0, "C": 0}
    for s in stations:
        rank = s.get("hub_rank", "C")
        if rank in rank_count:
            rank_count[rank] += 1

    return {
        "stations_processed": len(stations),
        "hub_rank": rank_count,
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ─────────────────────────────────────────
# メイン処理
# ─────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="GUNO Pack v0.2 → v1.0 変換・Hub付与・Validation・stats出力"
    )
    parser.add_argument("input", help="入力packファイル（JSON）")
    parser.add_argument("--out", help="出力packファイルパス（省略時: <input>_v1.json）")
    parser.add_argument("--stats", default="hub_stats.json", help="statsファイルパス（省略時: hub_stats.json）")
    parser.add_argument("--dry-run", action="store_true", help="ファイルを出力せず検証のみ実行")
    args = parser.parse_args()

    # 入力ファイル読み込み
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

    # ── Step 1: v0.2 → v1.0 互換補完 ──
    print("\n🔄 Step 1: v0.2 → v1.0 互換補完...")
    pack = upgrade_pack(pack)
    print("   ✅ pack_version を 1.0 に更新")
    print("   ✅ station_code 補完完了")

    # ── Step 2: Hub派生値付与 ──
    print("\n🔢 Step 2: Hub派生値付与...")
    hub_counts = {"S": 0, "A": 0, "B": 0, "C": 0}
    for eid, entity in pack.get("entities", {}).items():
        if entity.get("type") == "station":
            attach_hub_values(entity)
            hub_counts[entity["hub_rank"]] += 1
    total = sum(hub_counts.values())
    print(f"   ✅ {total} 駅にhub_degree/hub_bonus/hub_rank を付与")
    print(f"   ランク分布: S={hub_counts['S']} A={hub_counts['A']} B={hub_counts['B']} C={hub_counts['C']}")

    # ── Step 3: 必須Validation ──
    print("\n🔍 Step 3: 必須Validation...")
    errors = validate_pack(pack)
    if errors:
        print(f"   ❌ {len(errors)} 件のエラーが見つかりました:")
        for e in errors:
            print(f"      - {e}")
        if not args.dry_run:
            print("\n⚠ エラーがあるため出力を中止します。--dry-run で詳細確認できます。")
            sys.exit(1)
    else:
        print("   ✅ 必須Validation: すべてOK")

    if args.dry_run:
        print("\n🔎 --dry-run モード: ファイル出力をスキップしました")
        sys.exit(0)

    # ── Step 4: ファイル出力 ──
    out_path = Path(args.out) if args.out else input_path.with_stem(input_path.stem + "_v1")
    stats_path = Path(args.stats)

    print(f"\n💾 Step 4: ファイル出力...")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(pack, f, ensure_ascii=False, indent=2)
    print(f"   ✅ pack出力: {out_path}")

    stats = build_stats(pack)
    with open(stats_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"   ✅ stats出力: {stats_path}")

    print(f"\n🎉 完了！")
    print(f"   stations_processed: {stats['stations_processed']}")
    print(f"   hub_rank: {stats['hub_rank']}")


if __name__ == "__main__":
    main()

from __future__ import annotations

import csv
import json
from pathlib import Path

# 入力（route_master）
CSV_PATH = Path(r"C:\GISWORK\geodo-data\route_master\route_master_final_100_with_slug.csv")

# 出力（geodo.earth 側）
OUT_JSON = Path(r"C:\GISWORK\geodo.earth\routes\routes.json")

# geodo.earth 側のGeoJSON配置（あなたの現行構成に合わせて）
LINE_URL_FMT = "../../assets/geojson/lines/{line_slug}.geojson"
ST_URL_FMT   = "../../assets/geojson/stations/{line_slug}_stations.geojson"


def split_aliases(val: str) -> list[str]:
    if not val:
        return []
    # CSVのaliasesが「丸ノ内」みたいに単独でも、複数でも吸収
    # 区切り候補: | , ; 、 ／ /
    for sep in ["|", ";", "／", "/", "、", ","]:
        if sep in val:
            parts = [p.strip() for p in val.split(sep)]
            return [p for p in parts if p]
    return [val.strip()]


def make_intro(official_name: str, start_date: str) -> str:
    sd = start_date.strip()
    if sd:
        return f"{official_name}のページです。<strong>{sd}</strong> 以降のデータ整備を進行中。"
    return f"{official_name}のページです。データ整備を進行中。"


def make_timeline(start_date: str) -> str:
    sd = start_date.strip()
    if sd:
        return f"<ul><li><strong>開業</strong>：{sd}</li><li><strong>現在</strong>：データ整備・更新中</li></ul>"
    return "<ul><li><strong>現在</strong>：データ整備・更新中</li></ul>"


def main() -> None:
    if not CSV_PATH.exists():
        raise FileNotFoundError(f"CSV not found: {CSV_PATH}")

    rows: list[dict] = []
    with CSV_PATH.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        required = [
            "route_id", "official_name", "name_en", "operator", "railway", "color",
            "aliases", "line_code", "start_date", "operator_slug", "line_slug",
            "source_url", "source",
        ]
        missing = [c for c in required if c not in reader.fieldnames]
        if missing:
            raise ValueError(f"route_master missing columns: {missing}")

        for r in reader:
            line_slug = (r.get("line_slug") or "").strip()
            if not line_slug:
                continue

            official_name = (r.get("official_name") or "").strip()
            name_en = (r.get("name_en") or "").strip()
            color = (r.get("color") or "").strip()
            start_date = (r.get("start_date") or "").strip()

            # routes.json 1件
            obj = {
                "line_slug": line_slug,
                "route_id": (r.get("route_id") or "").strip(),
                "title_ja": official_name or line_slug,
                "title_en": name_en,
                "operator": (r.get("operator") or "").strip(),
                "operator_slug": (r.get("operator_slug") or "").strip(),
                "railway": (r.get("railway") or "").strip(),
                "line_code": (r.get("line_code") or "").strip(),
                "line_color": color or "#1f77b4",
                "aliases": split_aliases((r.get("aliases") or "").strip()),
                "start_date": start_date,
                "source": (r.get("source") or "").strip(),
                "source_url": (r.get("source_url") or "").strip(),

                # 生成ページ用（テンプレ差し込み用）
                "description_meta": f"{official_name}（{name_en}）の鉄道史・路線データ（ジオ道）。",
                "intro_html": make_intro(official_name or line_slug, start_date),
                "direction_ja": "",  # station_orderが揃ったら後で自動化も可能
                "history_html": "（編集中）",
                "timeline_html": make_timeline(start_date),

                # GeoJSON参照先（geodo.earth 側）
                "line_geojson_url": LINE_URL_FMT.format(line_slug=line_slug),
                "stations_geojson_url": ST_URL_FMT.format(line_slug=line_slug),
            }
            rows.append(obj)

    # line_slug順で安定化
    rows.sort(key=lambda x: x["line_slug"])

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2),
        encoding="utf-8",
        newline="\n",
    )

    print(f"written: {OUT_JSON}  routes: {len(rows)}")


if __name__ == "__main__":
    main()

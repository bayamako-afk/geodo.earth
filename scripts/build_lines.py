from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(r"C:\GISWORK\geodo.earth")  # あなたのルートに合わせてOK
TEMPLATE = ROOT / "templates" / "line.template.html"
ROUTES_JSON = ROOT / "routes" / "routes.json"
OUT_LINES_DIR = ROOT / "lines"

def render(template: str, ctx: dict) -> str:
    # シンプル置換（Jinja不要）
    for k, v in ctx.items():
        template = template.replace("{{" + k + "}}", str(v))
    return template

def main() -> None:
    tpl = TEMPLATE.read_text(encoding="utf-8")
    routes = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))

    for r in routes:
        line_slug = r["line_slug"]

        ctx = {
            "LINE_SLUG": line_slug,
            "TITLE_JA": r.get("title_ja", line_slug),
            "DESCRIPTION_META": r.get("description_meta", ""),
            "INTRO_HTML": r.get("intro_html", ""),
            "DIRECTION_JA": r.get("direction_ja", ""),
            "HISTORY_HTML": r.get("history_html", ""),
            "TIMELINE_HTML": r.get("timeline_html", "<ul></ul>"),
            "LINE_COLOR": r.get("line_color", "#1f77b4"),
            "LINE_GEOJSON_URL": r.get("line_geojson_url", ""),
            "STATIONS_GEOJSON_URL": r.get("stations_geojson_url", ""),
        }

        out_dir = OUT_LINES_DIR / line_slug
        out_dir.mkdir(parents=True, exist_ok=True)
        out_file = out_dir / "index.html"

        html = render(tpl, ctx)

        # UTF-8 (BOMなし) で保存
        out_file.write_text(html, encoding="utf-8", newline="\n")
        print(f"written: {out_file}")

if __name__ == "__main__":
    main()

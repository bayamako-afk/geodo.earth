from __future__ import annotations

import json
import html
from pathlib import Path

ROOT = Path(r"C:\GISWORK\geodo.earth")
ROUTES_JSON = ROOT / "routes" / "routes.json"
TEMPLATE = ROOT / "templates" / "lines_index.template.html"
OUT_FILE = ROOT / "lines" / "index.html"


def esc(s: str) -> str:
    return html.escape(s or "")


def card_html(r: dict) -> str:
    line_slug = r.get("line_slug", "")
    title_ja = r.get("title_ja", line_slug)
    title_en = r.get("title_en", "")
    operator = r.get("operator", "")
    railway = r.get("railway", "")
    line_code = r.get("line_code", "")
    route_id = r.get("route_id", "")
    color = r.get("line_color") or r.get("color") or "#1f77b4"
    start_date = r.get("start_date", "")

    href = f"./{line_slug}/"

    meta_bits = []
    if operator:
        meta_bits.append(esc(operator))
    if railway:
        meta_bits.append(esc(railway))
    if start_date:
        meta_bits.append(f"開業: {esc(start_date)}")

    meta = " / ".join(meta_bits) if meta_bits else ""

    chips = []
    if line_code:
        chips.append(f'<span class="chip">code: {esc(line_code)}</span>')
    if route_id:
        chips.append(f'<span class="chip">route_id: {esc(route_id)}</span>')
    if line_slug:
        chips.append(f'<span class="chip mono">{esc(line_slug)}</span>')

    chips_html = f'<div class="chips">{"".join(chips)}</div>' if chips else ""

    en_html = f'<div class="muted" style="margin-top:2px;">{esc(title_en)}</div>' if title_en else ""

    return f"""
    <div class="card">
      <div class="titleRow">
        <span class="swatch" style="background:{esc(color)}"></span>
        <div>
          <div><a href="{esc(href)}"><strong>{esc(title_ja)}</strong></a></div>
          {en_html}
        </div>
      </div>
      <div class="meta">{meta}</div>
      {chips_html}
    </div>
    """


def main() -> None:
    if not ROUTES_JSON.exists():
        raise FileNotFoundError(f"routes.json not found: {ROUTES_JSON}")
    if not TEMPLATE.exists():
        raise FileNotFoundError(f"template not found: {TEMPLATE}")

    routes = json.loads(ROUTES_JSON.read_text(encoding="utf-8"))
    tpl = TEMPLATE.read_text(encoding="utf-8")

    # line_slug で安定ソート（必要なら operator → line_code の順などに変更可）
    routes.sort(key=lambda x: (x.get("operator_slug", ""), x.get("line_slug", "")))

    cards = "\n".join(card_html(r) for r in routes if r.get("line_slug"))
    out = tpl.replace("{{CARDS_HTML}}", cards)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(out, encoding="utf-8", newline="\n")
    print(f"written: {OUT_FILE}  cards: {len(routes)}")


if __name__ == "__main__":
    main()

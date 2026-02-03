from __future__ import annotations

import runpy
from pathlib import Path

ROOT = Path(r"C:\GISWORK\geodo.earth")
SCRIPTS = ROOT / "scripts"

# 実行順（上から順に実行）
PIPELINE = [
    "build_routes_json_from_route_master_v1.py",  # geodo-data/route_master → geodo.earth/routes/routes.json
    "build_lines.py",                             # routes.json → lines/<slug>/index.html
    "build_lines_index_v1.py",                    # routes.json → lines/index.html
]


def run_script(name: str) -> None:
    path = SCRIPTS / name
    if not path.exists():
        raise FileNotFoundError(f"Missing script: {path}")
    print(f"\n=== RUN: {name} ===")
    runpy.run_path(str(path), run_name="__main__")


def main() -> None:
    print("GeoDo build pipeline")
    print(f"root: {ROOT}")
    for s in PIPELINE:
        run_script(s)
    print("\nDONE ✅")


if __name__ == "__main__":
    main()

import os
from pathlib import Path

lines_dir = Path(r"C:\GISWORK\geodo.earth\assets\geojson\lines")
stations_dir = Path(r"C:\GISWORK\geodo.earth\assets\geojson\stations")

line_files = sorted(lines_dir.glob("*.geojson"))
station_files = sorted(stations_dir.glob("*.geojson"))

station_stems = {p.stem: p.name for p in station_files}

print(f"lines: {len(line_files)}  stations: {len(station_files)}\n")

miss = []
hit = []
for lf in line_files:
    if lf.stem in station_stems:
        hit.append((lf.name, station_stems[lf.stem]))
    else:
        miss.append(lf.name)

print("=== MATCHED (first 20) ===")
for a, b in hit[:20]:
    print(f"{a}  ->  {b}")

print("\n=== NOT MATCHED ===")
for m in miss:
    print(m)

print(f"\nmatched: {len(hit)}  not_matched: {len(miss)}")

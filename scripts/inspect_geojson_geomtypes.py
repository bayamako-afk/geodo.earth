import geopandas as gpd
from collections import Counter

fp = r"C:\GISWORK\geodo.earth\assets\geojson\lines\jr-east-yamanote.geojson"

gdf = gpd.read_file(fp)
print("rows:", len(gdf))
print("crs:", gdf.crs)
print("geom types:", Counter(gdf.geometry.geom_type.dropna()))
print("empty:", int(gdf.geometry.is_empty.sum()))
print("null:", int(gdf.geometry.isna().sum()))
print("example props:", list(gdf.columns)[:20])

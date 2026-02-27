// tools/create_degree_map.mjs
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const stationsDir = path.join(ROOT, "geojson", "stations");

// ファイル名から路線IDを作る：tokyo-metro-ginza_stations.geojson -> tokyo-metro-ginza
const routeIdFromFilename = (f) => f.replace(/_stations\.geojson$/i, "");

// 駅名の取り出し（GeoJSONの実データに合わせて候補を多めに）
function getStationName(props){
  return props?.name || props?.name_ja || props?.station_name || props?.["駅名"] || props?.["名称"] || null;
}

// ★や空白ゆれを吸収
const norm = (s) => (s || "").replaceAll("★","").trim();

const files = fs.readdirSync(stationsDir).filter(f => f.endsWith(".geojson"));

const degree = {}; // name -> Set(routeId)
for(const f of files){
  const routeId = routeIdFromFilename(f);
  const geo = JSON.parse(fs.readFileSync(path.join(stationsDir, f), "utf8"));
  for(const ft of (geo.features || [])){
    const name = norm(getStationName(ft.properties));
    if(!name) continue;
    degree[name] ??= new Set();
    degree[name].add(routeId);
  }
}

// 出力：駅名 -> 路線配列
const out = {};
for(const [name, set] of Object.entries(degree)){
  out[name] = [...set].sort();
}
fs.writeFileSync(path.join(ROOT, "degree_map.json"), JSON.stringify(out, null, 2), "utf8");
console.log(`Wrote degree_map.json (${Object.keys(out).length} stations) from ${files.length} files`);
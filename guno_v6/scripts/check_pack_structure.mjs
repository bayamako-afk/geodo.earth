import { readFileSync } from "fs";
import { loadPackFromObject } from "../src/data/pack_loader.js";

const raw = JSON.parse(readFileSync("cities/london/data/packs/pack_v1.json", "utf-8"));
const pd = loadPackFromObject(raw);
console.log("keys:", Object.keys(pd));
console.log("routes:", pd.routes);
console.log("stations:", pd.stations);
console.log("packId:", pd.packId);
console.log("routeList type:", typeof pd.routeList, Array.isArray(pd.routeList));
if (Array.isArray(pd.routeList)) console.log("routeList length:", pd.routeList.length);

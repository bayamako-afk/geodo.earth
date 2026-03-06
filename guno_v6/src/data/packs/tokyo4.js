// guno_v6/src/data/packs/tokyo4.js
// Built-in GUNO Pack: Tokyo 4 Lines (v1.0)
//
// This is the default pack used for local demo play.
// Stations: JY (山手線), M (丸ノ内線), G (銀座線), T (東西線) — 10 stations each
// Hub values are pre-calculated based on cross-line connections within this deck.

"use strict";

export const BUILT_IN_PACK = {
  pack_meta: {
    pack_id: "tokyo4-v1",
    pack_version: "1.0",
    title: "東京4路線パック",
    description: "山手線・丸ノ内線・銀座線・東西線の4路線パック",
  },
  entities: {
    // ─── JY: 山手線 ───
    "JY-01": { type:"station", lc:"JY", order:1,  name_ja:"★東京",       name_en:"★Tokyo",           cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-02": { type:"station", lc:"JY", order:2,  name_ja:"★神田",       name_en:"★Kanda",           cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-03": { type:"station", lc:"JY", order:3,  name_ja:"★上野",       name_en:"★Ueno",            cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-04": { type:"station", lc:"JY", order:4,  name_ja:"★池袋",       name_en:"★Ikebukuro",       cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-05": { type:"station", lc:"JY", order:5,  name_ja:"★高田馬場",   name_en:"★Takadanobaba",    cross_lines:["T"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-06": { type:"station", lc:"JY", order:6,  name_ja:"★新宿",       name_en:"★Shinjuku",        cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-07": { type:"station", lc:"JY", order:7,  name_ja:"★渋谷",       name_en:"★Shibuya",         cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "JY-08": { type:"station", lc:"JY", order:8,  name_ja:"目黒",         name_en:"Meguro",            cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "JY-09": { type:"station", lc:"JY", order:9,  name_ja:"品川",         name_en:"Shinagawa",         cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "JY-10": { type:"station", lc:"JY", order:10, name_ja:"★新橋",       name_en:"★Shimbashi",       cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },

    // ─── M: 丸ノ内線 ───
    "M-01":  { type:"station", lc:"M",  order:1,  name_ja:"★池袋",       name_en:"★Ikebukuro",       cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-02":  { type:"station", lc:"M",  order:2,  name_ja:"後楽園",       name_en:"Korakuen",          cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "M-03":  { type:"station", lc:"M",  order:3,  name_ja:"御茶ノ水",     name_en:"Ochanomizu",        cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "M-04":  { type:"station", lc:"M",  order:4,  name_ja:"★大手町",     name_en:"★Otemachi",        cross_lines:["T"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-05":  { type:"station", lc:"M",  order:5,  name_ja:"★東京",       name_en:"★Tokyo",           cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-06":  { type:"station", lc:"M",  order:6,  name_ja:"★銀座",       name_en:"★Ginza",           cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-07":  { type:"station", lc:"M",  order:7,  name_ja:"★赤坂見附",   name_en:"★Akasaka-mitsuke", cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-08":  { type:"station", lc:"M",  order:8,  name_ja:"四ツ谷",       name_en:"Yotsuya",           cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "M-09":  { type:"station", lc:"M",  order:9,  name_ja:"★新宿",       name_en:"★Shinjuku",        cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "M-10":  { type:"station", lc:"M",  order:10, name_ja:"中野坂上",     name_en:"Nakano-sakaue",     cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },

    // ─── G: 銀座線 ───
    "G-01":  { type:"station", lc:"G",  order:1,  name_ja:"★渋谷",       name_en:"★Shibuya",         cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-02":  { type:"station", lc:"G",  order:2,  name_ja:"表参道",       name_en:"Omotesando",        cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "G-03":  { type:"station", lc:"G",  order:3,  name_ja:"青山一丁目",   name_en:"Aoyama-itchome",    cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "G-04":  { type:"station", lc:"G",  order:4,  name_ja:"★赤坂見附",   name_en:"★Akasaka-mitsuke", cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-05":  { type:"station", lc:"G",  order:5,  name_ja:"★新橋",       name_en:"★Shimbashi",       cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-06":  { type:"station", lc:"G",  order:6,  name_ja:"★銀座",       name_en:"★Ginza",           cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-07":  { type:"station", lc:"G",  order:7,  name_ja:"★日本橋",     name_en:"★Nihombashi",      cross_lines:["T"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-08":  { type:"station", lc:"G",  order:8,  name_ja:"★神田",       name_en:"★Kanda",           cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-09":  { type:"station", lc:"G",  order:9,  name_ja:"★上野",       name_en:"★Ueno",            cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "G-10":  { type:"station", lc:"G",  order:10, name_ja:"浅草",         name_en:"Asakusa",           cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },

    // ─── T: 東西線 ───
    "T-01":  { type:"station", lc:"T",  order:1,  name_ja:"中野",         name_en:"Nakano",            cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-02":  { type:"station", lc:"T",  order:2,  name_ja:"落合",         name_en:"Ochiai",            cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-03":  { type:"station", lc:"T",  order:3,  name_ja:"★高田馬場",   name_en:"★Takadanobaba",    cross_lines:["JY"],       hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "T-04":  { type:"station", lc:"T",  order:4,  name_ja:"早稲田",       name_en:"Waseda",            cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-05":  { type:"station", lc:"T",  order:5,  name_ja:"飯田橋",       name_en:"Iidabashi",         cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-06":  { type:"station", lc:"T",  order:6,  name_ja:"九段下",       name_en:"Kudanshita",        cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-07":  { type:"station", lc:"T",  order:7,  name_ja:"★大手町",     name_en:"★Otemachi",        cross_lines:["M"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "T-08":  { type:"station", lc:"T",  order:8,  name_ja:"★日本橋",     name_en:"★Nihombashi",      cross_lines:["G"],        hub_degree_deck:2, hub_bonus_deck:2, hub_rank_deck:"B", hub_degree_global:2, hub_bonus_global:2, hub_rank_global:"B" },
    "T-09":  { type:"station", lc:"T",  order:9,  name_ja:"門前仲町",     name_en:"Monzen-nakacho",    cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
    "T-10":  { type:"station", lc:"T",  order:10, name_ja:"東陽町",       name_en:"Toyocho",           cross_lines:[],           hub_degree_deck:1, hub_bonus_deck:0, hub_rank_deck:"C", hub_degree_global:1, hub_bonus_global:0, hub_rank_global:"C" },
  },
  collections: {
    "route-JY": { kind:"route", lc:"JY", name_ja:"山手線",   name_en:"Yamanote",   color:"#9acd32", members:["JY-01","JY-02","JY-03","JY-04","JY-05","JY-06","JY-07","JY-08","JY-09","JY-10"] },
    "route-M":  { kind:"route", lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", color:"#e60012", members:["M-01","M-02","M-03","M-04","M-05","M-06","M-07","M-08","M-09","M-10"] },
    "route-G":  { kind:"route", lc:"G",  name_ja:"銀座線",   name_en:"Ginza",      color:"#f39700", members:["G-01","G-02","G-03","G-04","G-05","G-06","G-07","G-08","G-09","G-10"] },
    "route-T":  { kind:"route", lc:"T",  name_ja:"東西線",   name_en:"Tozai",      color:"#009bbf", members:["T-01","T-02","T-03","T-04","T-05","T-06","T-07","T-08","T-09","T-10"] },
  },
  layouts: {
    "layout-default": {
      name: "デフォルト",
      routes: ["route-JY","route-M","route-G","route-T"],
    },
  },
  rules: {
    hand_size: 7,
    stations_per_line: 10,
  },
};

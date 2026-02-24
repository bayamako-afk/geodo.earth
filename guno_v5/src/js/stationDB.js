// js/stationDB.js
// Tokyo 4 lines / 10 stations each (v5 split-ready)
//
// NOTE:
// - This file only provides data and small helpers.
// - guno_v5.js will consume these globals.

window.GUNO_POINT = 10;

// Assets
window.ASSET_BASE = "assets/";
window.CARD_ASSET_BASE = window.ASSET_BASE + "cards/";
window.SOUND_ASSET_BASE = window.ASSET_BASE + "sounds/";

// For card back (used for CPU hidden hands)
window.BACK_URL = window.CARD_ASSET_BASE + "GUNO_BACK.png";

// Stations DB used for gameplay and slot rendering
window.STATIONS_DB = [
  // --- JY ---
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:1,  st_ja:"★東京",       st_en:"★Tokyo",          color:"#00AA00", file:"JY_01_Tokyo"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:2,  st_ja:"★神田",       st_en:"★Kanda",          color:"#00AA00", file:"JY_02_Kanda"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:3,  st_ja:"★上野",       st_en:"★Ueno",           color:"#00AA00", file:"JY_03_Ueno"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:4,  st_ja:"★池袋",       st_en:"★Ikebukuro",      color:"#00AA00", file:"JY_04_Ikebukuro"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:5,  st_ja:"★高田馬場",   st_en:"★Takadanobaba",   color:"#00AA00", file:"JY_05_Takadanobaba"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:6,  st_ja:"★新宿",       st_en:"★Shinjuku",       color:"#00AA00", file:"JY_06_Shinjuku"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:7,  st_ja:"★渋谷",       st_en:"★Shibuya",        color:"#00AA00", file:"JY_07_Shibuya"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:8,  st_ja:"目黒",         st_en:"Meguro",          color:"#00AA00", file:"JY_08_Meguro"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:9,  st_ja:"品川",         st_en:"Shinagawa",       color:"#00AA00", file:"JY_09_Shinagawa"},
  {lc:"JY", name_ja:"山手線", name_en:"Yamanote", order:10, st_ja:"★新橋",       st_en:"★Shimbashi",      color:"#00AA00", file:"JY_10_Shimbashi"},

  // --- M ---
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:1,  st_ja:"★池袋",     st_en:"★Ikebukuro",      color:"#F62E36", file:"M_01_Ikebukuro"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:2,  st_ja:"後楽園",     st_en:"Korakuen",        color:"#F62E36", file:"M_02_Korakuen"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:3,  st_ja:"御茶ノ水",   st_en:"Ochanomizu",      color:"#F62E36", file:"M_03_Ochanomizu"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:4,  st_ja:"★大手町",   st_en:"★Otemachi",       color:"#F62E36", file:"M_04_Otemachi"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:5,  st_ja:"★東京",     st_en:"★Tokyo",          color:"#F62E36", file:"M_05_Tokyo"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:6,  st_ja:"★銀座",     st_en:"★Ginza",          color:"#F62E36", file:"M_06_Ginza"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:7,  st_ja:"★赤坂見附", st_en:"★Akasaka-mitsuke",color:"#F62E36", file:"M_07_Akasaka-mitsuke"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:8,  st_ja:"四ツ谷",     st_en:"Yotsuya",         color:"#F62E36", file:"M_08_Yotsuya"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:9,  st_ja:"★新宿",     st_en:"★Shinjuku",       color:"#F62E36", file:"M_09_Shinjuku"},
  {lc:"M",  name_ja:"丸ノ内線", name_en:"Marunouchi", order:10, st_ja:"中野坂上",   st_en:"Nakano-sakaue",   color:"#F62E36", file:"M_10_Nakano-sakaue"},

  // --- G ---
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:1,  st_ja:"★渋谷",       st_en:"★Shibuya",         color:"#FF9500", file:"G_01_Shibuya"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:2,  st_ja:"表参道",       st_en:"Omotesando",        color:"#FF9500", file:"G_02_Omotesando"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:3,  st_ja:"青山一丁目",   st_en:"Aoyama-itchome",    color:"#FF9500", file:"G_03_Aoyama-itchome"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:4,  st_ja:"★赤坂見附",   st_en:"★Akasaka-mitsuke", color:"#FF9500", file:"G_04_Akasaka-mitsuke"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:5,  st_ja:"★新橋",       st_en:"★Shimbashi",       color:"#FF9500", file:"G_05_Shimbashi"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:6,  st_ja:"★銀座",       st_en:"★Ginza",           color:"#FF9500", file:"G_06_Ginza"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:7,  st_ja:"★日本橋",     st_en:"★Nihombashi",      color:"#FF9500", file:"G_07_Nihombashi"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:8,  st_ja:"★神田",       st_en:"★Kanda",           color:"#FF9500", file:"G_08_Kanda"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:9,  st_ja:"★上野",       st_en:"★Ueno",            color:"#FF9500", file:"G_09_Ueno"},
  {lc:"G",  name_ja:"銀座線", name_en:"Ginza", order:10, st_ja:"浅草",         st_en:"Asakusa",           color:"#FF9500", file:"G_10_Asakusa"},

  // --- T ---
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:1,  st_ja:"中野",         st_en:"Nakano",            color:"#009BBF", file:"T_01_Nakano"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:2,  st_ja:"落合",         st_en:"Ochiai",            color:"#009BBF", file:"T_02_Ochiai"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:3,  st_ja:"★高田馬場",   st_en:"★Takadanobaba",     color:"#009BBF", file:"T_03_Takadanobaba"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:4,  st_ja:"早稲田",       st_en:"Waseda",            color:"#009BBF", file:"T_04_Waseda"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:5,  st_ja:"飯田橋",       st_en:"Iidabashi",         color:"#009BBF", file:"T_05_Iidabashi"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:6,  st_ja:"九段下",       st_en:"Kudanshita",        color:"#009BBF", file:"T_06_Kudanshita"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:7,  st_ja:"★大手町",     st_en:"★Otemachi",         color:"#009BBF", file:"T_07_Otemachi"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:8,  st_ja:"★日本橋",     st_en:"★Nihombashi",       color:"#009BBF", file:"T_08_Nihombashi"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:9,  st_ja:"門前仲町",     st_en:"Monzen-nakacho",    color:"#009BBF", file:"T_09_Monzen-nakacho"},
  {lc:"T",  name_ja:"東西線", name_en:"Tozai", order:10, st_ja:"東陽町",       st_en:"Toyocho",           color:"#009BBF", file:"T_10_Toyocho"},
];

// blackout card file names (if you ever use png fallback)
window.TEIDEN_FILES = { JY:"JY_TEIDEN", M:"M_TEIDEN", G:"G_TEIDEN", T:"T_TEIDEN" };

// GeoJSON slugs (must match your src/geojson folder naming)
window.LINE_SLUG = {
  JY: "jr-east-yamanote",
  M:  "tokyo-metro-marunouchi",
  G:  "tokyo-metro-ginza",
  T:  "tokyo-metro-tozai",
};

// Helpers
window.normStar = (s) => (s || "").replaceAll("★", "");
window.lineInfo = (lc) => window.STATIONS_DB.find(x => x.lc === lc);
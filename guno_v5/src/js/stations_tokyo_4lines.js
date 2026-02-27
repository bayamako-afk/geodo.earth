// stations_tokyo_4lines.js (data only)
// Generated from guno_V4_051.html (v4.05) for V5 split (100% compatible)

const GUNO_POINT = 10;
const IMAGE_BASE_URL = "https://geodo.earth/guno_v2/cards/";
const BACK_URL = "./assets/cards/GUNO_BACK.png";

const STATIONS_DB = [
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:1, st_ja:'★東京', st_en:'★Tokyo', color:'#00AA00', file:'JY_01_Tokyo'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:2, st_ja:'★神田', st_en:'★Kanda', color:'#00AA00', file:'JY_02_Kanda'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:3, st_ja:'★上野', st_en:'★Ueno', color:'#00AA00', file:'JY_03_Ueno'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:4, st_ja:'★池袋', st_en:'★Ikebukuro', color:'#00AA00', file:'JY_04_Ikebukuro'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:5, st_ja:'★高田馬場', st_en:'★Takadanobaba', color:'#00AA00', file:'JY_05_Takadanobaba'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:6, st_ja:'★新宿', st_en:'★Shinjuku', color:'#00AA00', file:'JY_06_Shinjuku'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:7, st_ja:'★渋谷', st_en:'★Shibuya', color:'#00AA00', file:'JY_07_Shibuya'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:8, st_ja:'目黒', st_en:'Meguro', color:'#00AA00', file:'JY_08_Meguro'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:9, st_ja:'品川', st_en:'Shinagawa', color:'#00AA00', file:'JY_09_Shinagawa'},
    {lc:'JY', name_ja:'山手線', name_en:'Yamanote', order:10, st_ja:'★新橋', st_en:'★Shimbashi', color:'#00AA00', file:'JY_10_Shimbashi'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:1, st_ja:'★池袋', st_en:'★Ikebukuro', color:'#F62E36', file:'M_01_Ikebukuro'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:2, st_ja:'後楽園', st_en:'Korakuen', color:'#F62E36', file:'M_02_Korakuen'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:3, st_ja:'御茶ノ水', st_en:'Ochanomizu', color:'#F62E36', file:'M_03_Ochanomizu'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:4, st_ja:'★大手町', st_en:'★Otemachi', color:'#F62E36', file:'M_04_Otemachi'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:5, st_ja:'★東京', st_en:'★Tokyo', color:'#F62E36', file:'M_05_Tokyo'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:6, st_ja:'★銀座', st_en:'★Ginza', color:'#F62E36', file:'M_06_Ginza'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:7, st_ja:'★赤坂見附', st_en:'★Akasaka-mitsuke', color:'#F62E36', file:'M_07_Akasaka-mitsuke'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:8, st_ja:'四ツ谷', st_en:'Yotsuya', color:'#F62E36', file:'M_08_Yotsuya'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:9, st_ja:'★新宿', st_en:'★Shinjuku', color:'#F62E36', file:'M_09_Shinjuku'},
    {lc:'M', name_ja:'丸ノ内線', name_en:'Marunouchi', order:10, st_ja:'中野坂上', st_en:'Nakano-sakaue', color:'#F62E36', file:'M_10_Nakano-sakaue'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:1, st_ja:'★渋谷', st_en:'★Shibuya', color:'#FF9500', file:'G_01_Shibuya'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:2, st_ja:'表参道', st_en:'Omotesando', color:'#FF9500', file:'G_02_Omotesando'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:3, st_ja:'青山一丁目', st_en:'Aoyama-itchome', color:'#FF9500', file:'G_03_Aoyama-itchome'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:4, st_ja:'★赤坂見附', st_en:'★Akasaka-mitsuke', color:'#FF9500', file:'G_04_Akasaka-mitsuke'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:5, st_ja:'★新橋', st_en:'★Shimbashi', color:'#FF9500', file:'G_05_Shimbashi'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:6, st_ja:'★銀座', st_en:'★Ginza', color:'#FF9500', file:'G_06_Ginza'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:7, st_ja:'★日本橋', st_en:'★Nihombashi', color:'#FF9500', file:'G_07_Nihombashi'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:8, st_ja:'★神田', st_en:'★Kanda', color:'#FF9500', file:'G_08_Kanda'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:9, st_ja:'★上野', st_en:'★Ueno', color:'#FF9500', file:'G_09_Ueno'},
    {lc:'G', name_ja:'銀座線', name_en:'Ginza', order:10, st_ja:'浅草', st_en:'Asakusa', color:'#FF9500', file:'G_10_Asakusa'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:1, st_ja:'中野', st_en:'Nakano', color:'#009BBF', file:'T_01_Nakano'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:2, st_ja:'落合', st_en:'Ochiai', color:'#009BBF', file:'T_02_Ochiai'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:3, st_ja:'★高田馬場', st_en:'★Takadanobaba', color:'#009BBF', file:'T_03_Takadanobaba'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:4, st_ja:'早稲田', st_en:'Waseda', color:'#009BBF', file:'T_04_Waseda'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:5, st_ja:'飯田橋', st_en:'Iidabashi', color:'#009BBF', file:'T_05_Iidabashi'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:6, st_ja:'九段下', st_en:'Kudanshita', color:'#009BBF', file:'T_06_Kudanshita'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:7, st_ja:'★大手町', st_en:'★Otemachi', color:'#009BBF', file:'T_07_Otemachi'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:8, st_ja:'★日本橋', st_en:'★Nihombashi', color:'#009BBF', file:'T_08_Nihombashi'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:9, st_ja:'門前仲町', st_en:'Monzen-nakacho', color:'#009BBF', file:'T_09_Monzen-nakacho'},
    {lc:'T', name_ja:'東西線', name_en:'Tozai', order:10, st_ja:'東陽町', st_en:'Toyocho', color:'#009BBF', file:'T_10_Toyocho'}
];
const TEIDEN_FILES = {'JY':'JY_TEIDEN', 'M':'M_TEIDEN', 'G':'G_TEIDEN', 'T':'T_TEIDEN'};

const STATION_DB_CARDS = [
  // --- JY ---
  { line:"JY", num:1, jp:"東京", en:"Tokyo" },
  { line:"JY", num:2, jp:"神田", en:"Kanda" },
  { line:"JY", num:3, jp:"秋葉原", en:"Akihabara" },
  { line:"JY", num:4, jp:"上野", en:"Ueno" },
  { line:"JY", num:5, jp:"日暮里", en:"Nippori" },
  { line:"JY", num:6, jp:"西日暮里", en:"Nishi-nippori" },
  { line:"JY", num:7, jp:"池袋", en:"Ikebukuro" },
  { line:"JY", num:8, jp:"新宿", en:"Shinjuku" },
  { line:"JY", num:9, jp:"渋谷", en:"Shibuya" },
  { line:"JY", num:10, jp:"品川", en:"Shinagawa" },

  // --- M ---
  { line:"M", num:1, jp:"池袋", en:"Ikebukuro" },
  { line:"M", num:2, jp:"後楽園", en:"Korakuen" },
  { line:"M", num:3, jp:"大手町", en:"Otemachi" },
  { line:"M", num:4, jp:"東京", en:"Tokyo" },
  { line:"M", num:5, jp:"銀座", en:"Ginza" },
  { line:"M", num:6, jp:"赤坂見附", en:"Akasaka-mitsuke" },
  { line:"M", num:7, jp:"四ツ谷", en:"Yotsuya" },
  { line:"M", num:8, jp:"新宿御苑", en:"Shinjuku-gyoemmae" },
  { line:"M", num:9, jp:"新宿", en:"Shinjuku" },
  { line:"M", num:10, jp:"中野坂上", en:"Nakano-sakaue" },

  // --- G ---
  { line:"G", num:1, jp:"渋谷", en:"Shibuya" },
  { line:"G", num:2, jp:"表参道", en:"Omotesando" },
  { line:"G", num:3, jp:"青山一丁目", en:"Aoyama-itchome" },
  { line:"G", num:4, jp:"赤坂見附", en:"Akasaka-mitsuke" },
  { line:"G", num:5, jp:"新橋", en:"Shimbashi" },
  { line:"G", num:6, jp:"銀座", en:"Ginza" },
  { line:"G", num:7, jp:"日本橋", en:"Nihombashi" },
  { line:"G", num:8, jp:"神田", en:"Kanda" },
  { line:"G", num:9, jp:"上野", en:"Ueno" },
  { line:"G", num:10, jp:"浅草", en:"Asakusa" },

  // --- T ---
  { line:"T", num:1, jp:"中野", en:"Nakano" },
  { line:"T", num:2, jp:"落合", en:"Ochiai" },
  { line:"T", num:3, jp:"高田馬場", en:"Takadanobaba" },
  { line:"T", num:4, jp:"早稲田", en:"Waseda" },
  { line:"T", num:5, jp:"飯田橋", en:"Iidabashi" },
  { line:"T", num:6, jp:"九段下", en:"Kudanshita" },
  { line:"T", num:7, jp:"大手町", en:"Otemachi" },
  { line:"T", num:8, jp:"日本橋", en:"Nihombashi" },
  { line:"T", num:9, jp:"門前仲町", en:"Monzen-nakacho" },
  { line:"T", num:10, jp:"東陽町", en:"Toyocho" },
];

/** 長い駅名だけ少し縮小 */

// Make sure globals are reachable in all browsers (compat-safe)
window.GUNO_POINT = GUNO_POINT;
window.IMAGE_BASE_URL = IMAGE_BASE_URL;
window.BACK_URL = BACK_URL;
window.STATIONS_DB = STATIONS_DB;
window.TEIDEN_FILES = TEIDEN_FILES;
window.STATION_DB_CARDS = STATION_DB_CARDS;

// ==============================
// DEGREE REAL (within current loaded station set)
// ==============================
(function applyDegreeReal(){
  // もし normStar がグローバルに無い場合に備えて、★を外す関数を自前で持つ
  const normStarLocal = (s) => (s || "").replace(/^★/,"").trim();

  const degreeMap = {}; // name -> Set(lines)

  STATIONS_DB.forEach(st => {
    const name = normStarLocal(st.st_ja);
    if (!degreeMap[name]) degreeMap[name] = new Set();
    degreeMap[name].add(st.lc); // まずは路線コードで集計（JY/M/G/Tなど）
  });

  STATIONS_DB.forEach(st => {
    const name = normStarLocal(st.st_ja);
    const degree = degreeMap[name] ? degreeMap[name].size : 1;

    st.degree_real = degree;
    st.degree_bonus = Math.max(0, degree - 1);
  });

  console.log("DEGREE CHECK (sample):",
    STATIONS_DB
      .filter(s => (s.degree_real||1) >= 2)
      .slice(0, 10)
      .map(s => ({ st_ja: s.st_ja, lc: s.lc, degree: s.degree_real, bonus: s.degree_bonus }))
  );
})();
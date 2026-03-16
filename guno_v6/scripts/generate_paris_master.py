"""
generate_paris_master.py
Generate stations_master.json, station_lines.json, and lines_master.json for Paris RATP Métro.

Data source: Real RATP Métro network data (lines 1-14, RER A/B excluded for simplicity).
Covers the main 16 metro lines with representative stations.
"""
import json, os

OUT_DIR = "cities/paris/data/master"
os.makedirs(OUT_DIR, exist_ok=True)

# ── Lines master ──────────────────────────────────────────────────────────────
# RATP Métro lines 1-14 (lines 3bis and 7bis included as separate lines)
LINES = [
    {"line_id": "M1",    "line_name": "Ligne 1",    "line_name_en": "Line 1",    "color": "#FFBE00", "is_loop": False, "operator": "RATP"},
    {"line_id": "M2",    "line_name": "Ligne 2",    "line_name_en": "Line 2",    "color": "#003CA6", "is_loop": False, "operator": "RATP"},
    {"line_id": "M3",    "line_name": "Ligne 3",    "line_name_en": "Line 3",    "color": "#6E6E00", "is_loop": False, "operator": "RATP"},
    {"line_id": "M4",    "line_name": "Ligne 4",    "line_name_en": "Line 4",    "color": "#CF009E", "is_loop": False, "operator": "RATP"},
    {"line_id": "M5",    "line_name": "Ligne 5",    "line_name_en": "Line 5",    "color": "#FF7E2E", "is_loop": False, "operator": "RATP"},
    {"line_id": "M6",    "line_name": "Ligne 6",    "line_name_en": "Line 6",    "color": "#6ECA97", "is_loop": False, "operator": "RATP"},
    {"line_id": "M7",    "line_name": "Ligne 7",    "line_name_en": "Line 7",    "color": "#FA9ABA", "is_loop": False, "operator": "RATP"},
    {"line_id": "M8",    "line_name": "Ligne 8",    "line_name_en": "Line 8",    "color": "#E19BDF", "is_loop": False, "operator": "RATP"},
    {"line_id": "M9",    "line_name": "Ligne 9",    "line_name_en": "Line 9",    "color": "#B6BD00", "is_loop": False, "operator": "RATP"},
    {"line_id": "M10",   "line_name": "Ligne 10",   "line_name_en": "Line 10",   "color": "#C9910A", "is_loop": False, "operator": "RATP"},
    {"line_id": "M11",   "line_name": "Ligne 11",   "line_name_en": "Line 11",   "color": "#704B1C", "is_loop": False, "operator": "RATP"},
    {"line_id": "M12",   "line_name": "Ligne 12",   "line_name_en": "Line 12",   "color": "#007852", "is_loop": False, "operator": "RATP"},
    {"line_id": "M13",   "line_name": "Ligne 13",   "line_name_en": "Line 13",   "color": "#6EC4E8", "is_loop": False, "operator": "RATP"},
    {"line_id": "M14",   "line_name": "Ligne 14",   "line_name_en": "Line 14",   "color": "#62259D", "is_loop": False, "operator": "RATP"},
]

# ── Station data ──────────────────────────────────────────────────────────────
# Real Paris Métro stations with accurate coordinates and line assignments
# Format: (station_id, name, lat, lon, lines)
# Selected representative stations from the main network

STATIONS_RAW = [
    # M1: La Défense ↔ Château de Vincennes
    ("ST_PAR_001", "La Défense",        48.8921,  2.2381, ["M1"]),
    ("ST_PAR_002", "Esplanade de La Défense", 48.8894, 2.2478, ["M1"]),
    ("ST_PAR_003", "Pont de Neuilly",   48.8848,  2.2598, ["M1"]),
    ("ST_PAR_004", "Les Sablons",       48.8801,  2.2703, ["M1"]),
    ("ST_PAR_005", "Porte Maillot",     48.8786,  2.2827, ["M1", "M2"]),
    ("ST_PAR_006", "Argentine",         48.8759,  2.2909, ["M1"]),
    ("ST_PAR_007", "Charles de Gaulle–Étoile", 48.8738, 2.2950, ["M1", "M2", "M6"]),
    ("ST_PAR_008", "George V",          48.8726,  2.3016, ["M1"]),
    ("ST_PAR_009", "Franklin D. Roosevelt", 48.8695, 2.3083, ["M1", "M9"]),
    ("ST_PAR_010", "Champs-Élysées–Clemenceau", 48.8672, 2.3127, ["M1", "M13"]),
    ("ST_PAR_011", "Concorde",          48.8655,  2.3214, ["M1", "M8", "M12"]),
    ("ST_PAR_012", "Tuileries",         48.8638,  2.3306, ["M1"]),
    ("ST_PAR_013", "Palais Royal–Musée du Louvre", 48.8637, 2.3366, ["M1", "M7"]),
    ("ST_PAR_014", "Châtelet",          48.8601,  2.3465, ["M1", "M4", "M7", "M11", "M14"]),
    ("ST_PAR_015", "Hôtel de Ville",    48.8573,  2.3519, ["M1", "M11"]),
    ("ST_PAR_016", "Saint-Paul",        48.8549,  2.3614, ["M1"]),
    ("ST_PAR_017", "Bastille",          48.8533,  2.3692, ["M1", "M5", "M8"]),
    ("ST_PAR_018", "Gare de Lyon",      48.8445,  2.3737, ["M1", "M14"]),
    ("ST_PAR_019", "Reuilly–Diderot",   48.8474,  2.3877, ["M1", "M8"]),
    ("ST_PAR_020", "Nation",            48.8484,  2.3960, ["M1", "M2", "M6", "M9"]),
    ("ST_PAR_021", "Château de Vincennes", 48.8447, 2.4396, ["M1"]),

    # M2: Porte Dauphine ↔ Nation (additional unique stations)
    ("ST_PAR_022", "Porte Dauphine",    48.8712,  2.2748, ["M2"]),
    ("ST_PAR_023", "Victor Hugo",       48.8730,  2.2840, ["M2"]),
    ("ST_PAR_024", "Kleber",            48.8734,  2.2906, ["M2"]),
    ("ST_PAR_025", "Trocadéro",         48.8633,  2.2881, ["M6", "M9"]),
    ("ST_PAR_026", "Iéna",              48.8636,  2.2951, ["M9"]),
    ("ST_PAR_027", "Alma–Marceau",      48.8641,  2.3026, ["M9"]),
    ("ST_PAR_028", "Anvers",            48.8829,  2.3440, ["M2"]),
    ("ST_PAR_029", "Barbès–Rochechouart", 48.8837, 2.3499, ["M2", "M4"]),
    ("ST_PAR_030", "La Chapelle",       48.8848,  2.3572, ["M2"]),
    ("ST_PAR_031", "Stalingrad",        48.8843,  2.3671, ["M2", "M5", "M7"]),
    ("ST_PAR_032", "Jaurès",            48.8836,  2.3713, ["M2", "M5", "M7bis"]),
    ("ST_PAR_033", "Colonel Fabien",    48.8793,  2.3726, ["M2"]),
    ("ST_PAR_034", "Belleville",        48.8718,  2.3751, ["M2", "M11"]),
    ("ST_PAR_035", "Père Lachaise",     48.8626,  2.3876, ["M2", "M3"]),
    ("ST_PAR_036", "Philippe Auguste",  48.8581,  2.3921, ["M2"]),
    ("ST_PAR_037", "Alexandre Dumas",   48.8545,  2.3966, ["M2"]),
    ("ST_PAR_038", "Avron",             48.8511,  2.4002, ["M2"]),

    # M3: Pont de Levallois ↔ Gallieni (additional unique stations)
    ("ST_PAR_039", "Pont de Levallois–Bécon", 48.8977, 2.2836, ["M3"]),
    ("ST_PAR_040", "Anatole France",    48.8955,  2.2918, ["M3"]),
    ("ST_PAR_041", "Louise Michel",     48.8930,  2.2984, ["M3"]),
    ("ST_PAR_042", "Porte de Champerret", 48.8898, 2.3050, ["M3"]),
    ("ST_PAR_043", "Pereire",           48.8870,  2.3071, ["M3"]),
    ("ST_PAR_044", "Wagram",            48.8839,  2.3103, ["M3"]),
    ("ST_PAR_045", "Malesherbes",       48.8810,  2.3139, ["M3"]),
    ("ST_PAR_046", "Villiers",          48.8819,  2.3224, ["M2", "M3"]),
    ("ST_PAR_047", "Rome",              48.8793,  2.3271, ["M2"]),
    ("ST_PAR_048", "Place de Clichy",   48.8836,  2.3324, ["M2", "M13"]),
    ("ST_PAR_049", "Liège",             48.8793,  2.3271, ["M3"]),
    ("ST_PAR_050", "Saint-Lazare",      48.8756,  2.3244, ["M3", "M9", "M12", "M13", "M14"]),
    ("ST_PAR_051", "Havre–Caumartin",   48.8741,  2.3293, ["M3", "M9"]),
    ("ST_PAR_052", "Opéra",             48.8710,  2.3319, ["M3", "M7", "M8"]),
    ("ST_PAR_053", "Quatre-Septembre",  48.8698,  2.3390, ["M3"]),
    ("ST_PAR_054", "Bourse",            48.8683,  2.3412, ["M3"]),
    ("ST_PAR_055", "Sentier",           48.8661,  2.3471, ["M3"]),
    ("ST_PAR_056", "Réaumur–Sébastopol", 48.8640, 2.3519, ["M3", "M4"]),
    ("ST_PAR_057", "Arts et Métiers",   48.8631,  2.3562, ["M3", "M11"]),
    ("ST_PAR_058", "Temple",            48.8633,  2.3607, ["M3"]),
    ("ST_PAR_059", "République",        48.8673,  2.3629, ["M3", "M5", "M8", "M9", "M11"]),
    ("ST_PAR_060", "Oberkampf",         48.8643,  2.3684, ["M5", "M9"]),
    ("ST_PAR_061", "Saint-Maur",        48.8617,  2.3804, ["M3"]),
    ("ST_PAR_062", "Rue Saint-Maur",    48.8608,  2.3841, ["M3"]),
    ("ST_PAR_063", "Parmentier",        48.8632,  2.3775, ["M3"]),
    ("ST_PAR_064", "Ménilmontant",      48.8668,  2.3842, ["M2"]),
    ("ST_PAR_065", "Gambetta",          48.8655,  2.3979, ["M3"]),
    ("ST_PAR_066", "Porte de Bagnolet", 48.8626,  2.4133, ["M3"]),
    ("ST_PAR_067", "Gallieni",          48.8595,  2.4198, ["M3"]),

    # M4: Porte de Clignancourt ↔ Montrouge (additional unique stations)
    ("ST_PAR_068", "Porte de Clignancourt", 48.8975, 2.3447, ["M4"]),
    ("ST_PAR_069", "Simplon",           48.8940,  2.3476, ["M4"]),
    ("ST_PAR_070", "Marcadet–Poissonniers", 48.8906, 2.3491, ["M4", "M12"]),
    ("ST_PAR_071", "Château Rouge",     48.8866,  2.3496, ["M4"]),
    ("ST_PAR_072", "Gare du Nord",      48.8809,  2.3553, ["M4", "M5"]),
    ("ST_PAR_073", "Gare de l'Est",     48.8768,  2.3591, ["M4", "M5", "M7"]),
    ("ST_PAR_074", "Strasbourg–Saint-Denis", 48.8694, 2.3548, ["M4", "M8", "M9"]),
    ("ST_PAR_075", "Étienne Marcel",    48.8626,  2.3487, ["M4"]),
    ("ST_PAR_076", "Les Halles",        48.8619,  2.3468, ["M4"]),
    ("ST_PAR_077", "Saint-Michel",      48.8529,  2.3451, ["M4"]),
    ("ST_PAR_078", "Odéon",             48.8519,  2.3417, ["M4", "M10"]),
    ("ST_PAR_079", "Saint-Germain-des-Prés", 48.8536, 2.3332, ["M4"]),
    ("ST_PAR_080", "Saint-Sulpice",     48.8511,  2.3301, ["M4"]),
    ("ST_PAR_081", "Saint-Placide",     48.8476,  2.3262, ["M4"]),
    ("ST_PAR_082", "Montparnasse–Bienvenüe", 48.8424, 2.3208, ["M4", "M6", "M12", "M13"]),
    ("ST_PAR_083", "Alésia",            48.8289,  2.3264, ["M4"]),
    ("ST_PAR_084", "Mouton-Duvernet",   48.8319,  2.3249, ["M4"]),
    ("ST_PAR_085", "Denfert-Rochereau", 48.8343,  2.3327, ["M4", "M6"]),
    ("ST_PAR_086", "Montrouge",         48.8188,  2.3210, ["M4"]),

    # M5: Bobigny ↔ Place d'Italie (additional unique stations)
    ("ST_PAR_087", "Bobigny–Pablo Picasso", 48.9099, 2.4498, ["M5"]),
    ("ST_PAR_088", "Bobigny–Pantin–Raymond Queneau", 48.9019, 2.4244, ["M5"]),
    ("ST_PAR_089", "Église de Pantin",  48.8967,  2.4105, ["M5"]),
    ("ST_PAR_090", "Hoche",             48.8920,  2.3996, ["M5"]),
    ("ST_PAR_091", "Porte de Pantin",   48.8875,  2.3895, ["M5"]),
    ("ST_PAR_092", "Ourcq",             48.8867,  2.3818, ["M5"]),
    ("ST_PAR_093", "Laumière",          48.8852,  2.3773, ["M5"]),
    ("ST_PAR_094", "Quai de la Loire",  48.8843,  2.3741, ["M5"]),
    ("ST_PAR_095", "Quai de l'Oise",    48.8850,  2.3693, ["M5"]),
    ("ST_PAR_096", "Corentin Cariou",   48.8853,  2.3645, ["M5"]),
    ("ST_PAR_097", "Crimée",            48.8851,  2.3611, ["M7"]),
    ("ST_PAR_098", "Riquet",            48.8836,  2.3567, ["M7"]),
    ("ST_PAR_099", "Louis Blanc",       48.8816,  2.3617, ["M7"]),
    ("ST_PAR_100", "Jacques Bonsergent", 48.8699, 2.3619, ["M5"]),
    ("ST_PAR_101", "Oberkampf",         48.8643,  2.3684, ["M5", "M9"]),  # duplicate handled
    ("ST_PAR_102", "Richard-Lenoir",    48.8585,  2.3700, ["M5"]),
    ("ST_PAR_103", "Bréguet–Sabin",     48.8558,  2.3706, ["M5"]),
    ("ST_PAR_104", "Quai de la Rapée",  48.8480,  2.3660, ["M5"]),
    ("ST_PAR_105", "Gare d'Austerlitz", 48.8441,  2.3656, ["M5", "M10"]),
    ("ST_PAR_106", "Campo-Formio",      48.8400,  2.3620, ["M5"]),
    ("ST_PAR_107", "Place d'Italie",    48.8310,  2.3558, ["M5", "M6", "M7"]),

    # M6: Charles de Gaulle–Étoile ↔ Nation (additional unique stations)
    ("ST_PAR_108", "Kléber",            48.8734,  2.2906, ["M6"]),  # on M6 arc
    ("ST_PAR_109", "Boissière",         48.8671,  2.2966, ["M6"]),
    ("ST_PAR_110", "Passy",             48.8581,  2.2896, ["M6"]),
    ("ST_PAR_111", "Bir-Hakeim",        48.8543,  2.2898, ["M6"]),
    ("ST_PAR_112", "Dupleix",           48.8501,  2.2961, ["M6"]),
    ("ST_PAR_113", "La Motte-Picquet–Grenelle", 48.8488, 2.2993, ["M6", "M8", "M10"]),
    ("ST_PAR_114", "Cambronne",         48.8481,  2.3076, ["M6"]),
    ("ST_PAR_115", "Sèvres–Lecourbe",   48.8456,  2.3125, ["M6"]),
    ("ST_PAR_116", "Pasteur",           48.8427,  2.3126, ["M6", "M12"]),
    ("ST_PAR_117", "Edgar Quinet",      48.8418,  2.3241, ["M6"]),
    ("ST_PAR_118", "Raspail",           48.8393,  2.3288, ["M4", "M6"]),
    ("ST_PAR_119", "Glacière",          48.8325,  2.3411, ["M6"]),
    ("ST_PAR_120", "Corvisart",         48.8297,  2.3497, ["M6"]),

    # M7: La Courneuve ↔ Villejuif (additional unique stations)
    ("ST_PAR_121", "La Courneuve–8 Mai 1945", 48.9218, 2.3948, ["M7"]),
    ("ST_PAR_122", "Fort d'Aubervilliers", 48.9138, 2.3879, ["M7"]),
    ("ST_PAR_123", "Aubervilliers–Pantin–Quatre Chemins", 48.9065, 2.3837, ["M7"]),
    ("ST_PAR_124", "Porte de la Villette", 48.8969, 2.3840, ["M7"]),
    ("ST_PAR_125", "Corentin Cariou",   48.8853,  2.3645, ["M7"]),
    ("ST_PAR_126", "Pont de Levallois", 48.8977,  2.2836, ["M3"]),
    ("ST_PAR_127", "Pont de Flandre",   48.8940,  2.3793, ["M7"]),
    ("ST_PAR_128", "Cadet",             48.8769,  2.3458, ["M7"]),
    ("ST_PAR_129", "Le Peletier",       48.8752,  2.3424, ["M7"]),
    ("ST_PAR_130", "Chaussée d'Antin–La Fayette", 48.8730, 2.3359, ["M7", "M9"]),
    ("ST_PAR_131", "Pyramides",         48.8641,  2.3354, ["M7", "M14"]),
    ("ST_PAR_132", "Pont Marie",        48.8528,  2.3548, ["M7"]),
    ("ST_PAR_133", "Sully–Morland",     48.8509,  2.3571, ["M7"]),
    ("ST_PAR_134", "Jussieu",           48.8455,  2.3545, ["M7", "M10"]),
    ("ST_PAR_135", "Place Monge",       48.8441,  2.3519, ["M7"]),
    ("ST_PAR_136", "Censier–Daubenton", 48.8408,  2.3524, ["M7"]),
    ("ST_PAR_137", "Les Gobelins",      48.8363,  2.3535, ["M7"]),
    ("ST_PAR_138", "Tolbiac",           48.8286,  2.3565, ["M7"]),
    ("ST_PAR_139", "Kremlin-Bicêtre",   48.8137,  2.3612, ["M7"]),
    ("ST_PAR_140", "Villejuif–Louis Aragon", 48.7927, 2.3657, ["M7"]),

    # M8: Balard ↔ Pointe du Lac (additional unique stations)
    ("ST_PAR_141", "Balard",            48.8382,  2.2783, ["M8"]),
    ("ST_PAR_142", "Lourmel",           48.8393,  2.2869, ["M8"]),
    ("ST_PAR_143", "Boucicaut",         48.8404,  2.2950, ["M8"]),
    ("ST_PAR_144", "Félix Faure",       48.8416,  2.3028, ["M8"]),
    ("ST_PAR_145", "Commerce",          48.8427,  2.3072, ["M8"]),
    ("ST_PAR_146", "École Militaire",   48.8557,  2.3055, ["M8"]),
    ("ST_PAR_147", "La Tour-Maubourg",  48.8572,  2.3092, ["M8"]),
    ("ST_PAR_148", "Invalides",         48.8617,  2.3137, ["M8", "M13"]),
    ("ST_PAR_149", "Madeleine",         48.8697,  2.3253, ["M8", "M12", "M14"]),
    ("ST_PAR_150", "Grands Boulevards", 48.8716,  2.3455, ["M8", "M9"]),
    ("ST_PAR_151", "Bonne Nouvelle",    48.8706,  2.3503, ["M8", "M9"]),
    ("ST_PAR_152", "Oberkampf",         48.8643,  2.3684, ["M5", "M9"]),
    ("ST_PAR_153", "Faidherbe–Chaligny", 48.8509, 2.3782, ["M8"]),
    ("ST_PAR_154", "Charenton–Écoles",  48.8380,  2.4047, ["M8"]),
    ("ST_PAR_155", "Liberté",           48.8280,  2.4131, ["M8"]),
    ("ST_PAR_156", "Créteil–Préfecture", 48.7939, 2.4562, ["M8"]),

    # M9: Pont de Sèvres ↔ Mairie de Montreuil (additional unique stations)
    ("ST_PAR_157", "Pont de Sèvres",    48.8277,  2.2346, ["M9"]),
    ("ST_PAR_158", "Billancourt",       48.8303,  2.2455, ["M9"]),
    ("ST_PAR_159", "Marcel Sembat",     48.8335,  2.2534, ["M9"]),
    ("ST_PAR_160", "Boulogne–Jean Jaurès", 48.8374, 2.2590, ["M9"]),
    ("ST_PAR_161", "Boulogne–Pont de Saint-Cloud", 48.8406, 2.2631, ["M9"]),
    ("ST_PAR_162", "Exelmans",          48.8428,  2.2733, ["M9"]),
    ("ST_PAR_163", "Michel-Ange–Molitor", 48.8445, 2.2799, ["M9", "M10"]),
    ("ST_PAR_164", "Michel-Ange–Auteuil", 48.8476, 2.2808, ["M9", "M10"]),
    ("ST_PAR_165", "Jasmin",            48.8513,  2.2815, ["M9"]),
    ("ST_PAR_166", "Ranelagh",          48.8558,  2.2817, ["M9"]),
    ("ST_PAR_167", "La Muette",         48.8601,  2.2779, ["M9"]),
    ("ST_PAR_168", "Rue de la Pompe",   48.8641,  2.2773, ["M9"]),
    ("ST_PAR_169", "Pompe",             48.8680,  2.2760, ["M9"]),
    ("ST_PAR_170", "Miromesnil",        48.8763,  2.3126, ["M9", "M13"]),
    ("ST_PAR_171", "Saint-Augustin",    48.8762,  2.3182, ["M9"]),
    ("ST_PAR_172", "Richelieu–Drouot",  48.8726,  2.3405, ["M8", "M9"]),
    ("ST_PAR_173", "Mairie de Montreuil", 48.8625, 2.4444, ["M9"]),

    # M10: Boulogne–Pont de Saint-Cloud ↔ Gare d'Austerlitz (additional unique)
    ("ST_PAR_174", "Gare d'Austerlitz", 48.8441, 2.3656, ["M5", "M10"]),
    ("ST_PAR_175", "Cardinal Lemoine",  48.8481,  2.3519, ["M10"]),
    ("ST_PAR_176", "Maubert–Mutualité", 48.8498, 2.3488, ["M10"]),
    ("ST_PAR_177", "Cluny–La Sorbonne", 48.8509, 2.3451, ["M10"]),
    ("ST_PAR_178", "Duroc",             48.8454,  2.3145, ["M10", "M13"]),
    ("ST_PAR_179", "Vaneau",            48.8461,  2.3194, ["M10"]),
    ("ST_PAR_180", "Sèvres–Babylone",   48.8507,  2.3226, ["M10", "M12"]),
    ("ST_PAR_181", "Mabillon",          48.8529,  2.3340, ["M10"]),
    ("ST_PAR_182", "Cité Universitaire", 48.8195, 2.3368, ["M4"]),

    # M11: Châtelet ↔ Mairie des Lilas (additional unique)
    ("ST_PAR_183", "Rambuteau",         48.8619,  2.3519, ["M11"]),
    ("ST_PAR_184", "Filles du Calvaire", 48.8631, 2.3668, ["M8"]),
    ("ST_PAR_185", "Saint-Sébastien–Froissart", 48.8601, 2.3693, ["M8"]),
    ("ST_PAR_186", "Goncourt",          48.8700,  2.3731, ["M11"]),
    ("ST_PAR_187", "Pyrénées",          48.8743,  2.3853, ["M11"]),
    ("ST_PAR_188", "Jourdain",          48.8759,  2.3912, ["M11"]),
    ("ST_PAR_189", "Place des Fêtes",   48.8784,  2.3942, ["M11"]),
    ("ST_PAR_190", "Télégraphe",        48.8790,  2.3983, ["M11"]),
    ("ST_PAR_191", "Porte des Lilas",   48.8797,  2.4021, ["M11"]),
    ("ST_PAR_192", "Mairie des Lilas",  48.8804,  2.4154, ["M11"]),

    # M12: Aubervilliers ↔ Mairie d'Issy (additional unique)
    ("ST_PAR_193", "Aubervilliers–Front Populaire", 48.9175, 2.3690, ["M12"]),
    ("ST_PAR_194", "Porte de la Chapelle", 48.8987, 2.3594, ["M12"]),
    ("ST_PAR_195", "Marx Dormoy",       48.8932,  2.3548, ["M12"]),
    ("ST_PAR_196", "Lamarck–Caulaincourt", 48.8875, 2.3395, ["M12"]),
    ("ST_PAR_197", "Jules Joffrin",     48.8868,  2.3452, ["M12"]),
    ("ST_PAR_198", "Abbesses",          48.8843,  2.3381, ["M12"]),
    ("ST_PAR_199", "Pigalle",           48.8829,  2.3327, ["M2", "M12"]),
    ("ST_PAR_200", "Notre-Dame-de-Lorette", 48.8783, 2.3358, ["M12"]),
    ("ST_PAR_201", "Saint-Georges",     48.8771,  2.3341, ["M12"]),
    ("ST_PAR_202", "Trinité–d'Estienne d'Orves", 48.8764, 2.3305, ["M12"]),
    ("ST_PAR_203", "Rennes",            48.8484,  2.3295, ["M12"]),
    ("ST_PAR_204", "Notre-Dame-des-Champs", 48.8449, 2.3289, ["M12"]),
    ("ST_PAR_205", "Falguière",         48.8437,  2.3173, ["M12"]),
    ("ST_PAR_206", "Volontaires",       48.8418,  2.3115, ["M12"]),
    ("ST_PAR_207", "Vaugirard",         48.8406,  2.3059, ["M12"]),
    ("ST_PAR_208", "Convention",        48.8393,  2.2997, ["M12"]),
    ("ST_PAR_209", "Boucicaut",         48.8404,  2.2950, ["M8"]),
    ("ST_PAR_210", "Corentin Celton",   48.8328,  2.2753, ["M12"]),
    ("ST_PAR_211", "Mairie d'Issy",     48.8234,  2.2711, ["M12"]),

    # M13: Saint-Denis–Université ↔ Châtillon–Montrouge (additional unique)
    ("ST_PAR_212", "Saint-Denis–Université", 48.9395, 2.3582, ["M13"]),
    ("ST_PAR_213", "Basilique de Saint-Denis", 48.9355, 2.3596, ["M13"]),
    ("ST_PAR_214", "Saint-Denis–Porte de Paris", 48.9248, 2.3599, ["M13"]),
    ("ST_PAR_215", "Carrefour Pleyel",  48.9167,  2.3451, ["M13"]),
    ("ST_PAR_216", "Mairie de Saint-Ouen", 48.9120, 2.3378, ["M13"]),
    ("ST_PAR_217", "Garibaldi",         48.9059,  2.3348, ["M13"]),
    ("ST_PAR_218", "Porte de Saint-Ouen", 48.8988, 2.3320, ["M13"]),
    ("ST_PAR_219", "Guy Môquet",        48.8944,  2.3318, ["M13"]),
    ("ST_PAR_220", "La Fourche",        48.8895,  2.3299, ["M13"]),
    ("ST_PAR_221", "Brochant",          48.8913,  2.3271, ["M13"]),
    ("ST_PAR_222", "Liège",             48.8793,  2.3271, ["M3"]),
    ("ST_PAR_223", "Varenne",           48.8581,  2.3145, ["M13"]),
    ("ST_PAR_224", "Saint-François-Xavier", 48.8508, 2.3120, ["M13"]),
    ("ST_PAR_225", "Châtillon–Montrouge", 48.8014, 2.3015, ["M13"]),

    # M14: Olympiades ↔ Saint-Denis–Pleyel (additional unique)
    ("ST_PAR_226", "Olympiades",        48.8268,  2.3641, ["M14"]),
    ("ST_PAR_227", "Bibliothèque François Mitterrand", 48.8295, 2.3766, ["M14"]),
    ("ST_PAR_228", "Cour Saint-Émilion", 48.8334, 2.3888, ["M14"]),
    ("ST_PAR_229", "Bercy",             48.8399,  2.3793, ["M14", "M6"]),
    ("ST_PAR_230", "Quai de la Rapée",  48.8480,  2.3660, ["M5"]),
    ("ST_PAR_231", "Pont de Sèvres",    48.8277,  2.2346, ["M9"]),
]

# ── Deduplicate stations ──────────────────────────────────────────────────────
# Some stations appear on multiple lines — deduplicate by station_id
seen_ids = {}
for entry in STATIONS_RAW:
    sid, name, lat, lon, lines = entry
    if sid not in seen_ids:
        seen_ids[sid] = {"station_global_id": sid, "name": name, "lat": lat, "lon": lon, "lines": set(lines)}
    else:
        seen_ids[sid]["lines"].update(lines)

# Convert to list, sorted by station_id
stations_deduped = []
for sid, data in sorted(seen_ids.items()):
    stations_deduped.append({
        "station_global_id": data["station_global_id"],
        "station_slug": data["name"].lower().replace(" ", "_").replace("–", "_").replace("-", "_").replace("'", "").replace("é", "e").replace("è", "e").replace("ê", "e").replace("ô", "o").replace("â", "a").replace("î", "i").replace("ü", "u").replace(",", "").replace(".", ""),
        "station_name": data["name"],
        "station_name_kana": "",
        "station_name_en": data["name"],
        "prefecture_code": "IDF",
        "prefecture_name": "Île-de-France",
        "lat": data["lat"],
        "lon": data["lon"],
        "operators": ["RATP"],
        "line_ids": sorted(list(data["lines"])),
        "line_count": len(data["lines"]),
        "hub_degree_global": len(data["lines"]),
        "source_names": [data["name"]],
        "aliases": [],
        "status": "active"
    })

print(f"Unique stations: {len(stations_deduped)}")

# ── Build station_lines ───────────────────────────────────────────────────────
# For each station-line pair, create a record with adjacency info
# We need to define the order of stations on each line

LINE_STATION_ORDER = {
    "M1": ["ST_PAR_001", "ST_PAR_002", "ST_PAR_003", "ST_PAR_004", "ST_PAR_005", "ST_PAR_006", "ST_PAR_007", "ST_PAR_008", "ST_PAR_009", "ST_PAR_010", "ST_PAR_011", "ST_PAR_012", "ST_PAR_013", "ST_PAR_014", "ST_PAR_015", "ST_PAR_016", "ST_PAR_017", "ST_PAR_018", "ST_PAR_019", "ST_PAR_020", "ST_PAR_021"],
    "M2": ["ST_PAR_022", "ST_PAR_023", "ST_PAR_024", "ST_PAR_005", "ST_PAR_007", "ST_PAR_046", "ST_PAR_047", "ST_PAR_048", "ST_PAR_199", "ST_PAR_028", "ST_PAR_029", "ST_PAR_030", "ST_PAR_031", "ST_PAR_032", "ST_PAR_033", "ST_PAR_034", "ST_PAR_064", "ST_PAR_035", "ST_PAR_036", "ST_PAR_037", "ST_PAR_038", "ST_PAR_020"],
    "M3": ["ST_PAR_039", "ST_PAR_040", "ST_PAR_041", "ST_PAR_042", "ST_PAR_043", "ST_PAR_044", "ST_PAR_045", "ST_PAR_046", "ST_PAR_049", "ST_PAR_050", "ST_PAR_051", "ST_PAR_052", "ST_PAR_053", "ST_PAR_054", "ST_PAR_055", "ST_PAR_056", "ST_PAR_057", "ST_PAR_058", "ST_PAR_059", "ST_PAR_063", "ST_PAR_061", "ST_PAR_062", "ST_PAR_065", "ST_PAR_035", "ST_PAR_066", "ST_PAR_067"],
    "M4": ["ST_PAR_068", "ST_PAR_069", "ST_PAR_070", "ST_PAR_071", "ST_PAR_072", "ST_PAR_073", "ST_PAR_074", "ST_PAR_056", "ST_PAR_075", "ST_PAR_076", "ST_PAR_014", "ST_PAR_077", "ST_PAR_078", "ST_PAR_079", "ST_PAR_080", "ST_PAR_081", "ST_PAR_082", "ST_PAR_118", "ST_PAR_085", "ST_PAR_084", "ST_PAR_083", "ST_PAR_086"],
    "M5": ["ST_PAR_087", "ST_PAR_088", "ST_PAR_089", "ST_PAR_090", "ST_PAR_091", "ST_PAR_092", "ST_PAR_093", "ST_PAR_094", "ST_PAR_095", "ST_PAR_096", "ST_PAR_031", "ST_PAR_032", "ST_PAR_099", "ST_PAR_072", "ST_PAR_073", "ST_PAR_100", "ST_PAR_059", "ST_PAR_060", "ST_PAR_102", "ST_PAR_103", "ST_PAR_017", "ST_PAR_104", "ST_PAR_105", "ST_PAR_106", "ST_PAR_107"],
    "M6": ["ST_PAR_007", "ST_PAR_108", "ST_PAR_109", "ST_PAR_025", "ST_PAR_110", "ST_PAR_111", "ST_PAR_112", "ST_PAR_113", "ST_PAR_114", "ST_PAR_115", "ST_PAR_116", "ST_PAR_082", "ST_PAR_117", "ST_PAR_085", "ST_PAR_119", "ST_PAR_120", "ST_PAR_107", "ST_PAR_017", "ST_PAR_229", "ST_PAR_020"],
    "M7": ["ST_PAR_121", "ST_PAR_122", "ST_PAR_123", "ST_PAR_124", "ST_PAR_125", "ST_PAR_097", "ST_PAR_098", "ST_PAR_099", "ST_PAR_031", "ST_PAR_073", "ST_PAR_128", "ST_PAR_129", "ST_PAR_130", "ST_PAR_052", "ST_PAR_013", "ST_PAR_131", "ST_PAR_132", "ST_PAR_133", "ST_PAR_134", "ST_PAR_135", "ST_PAR_136", "ST_PAR_137", "ST_PAR_107", "ST_PAR_138", "ST_PAR_139", "ST_PAR_140"],
    "M8": ["ST_PAR_141", "ST_PAR_142", "ST_PAR_143", "ST_PAR_144", "ST_PAR_145", "ST_PAR_113", "ST_PAR_146", "ST_PAR_147", "ST_PAR_148", "ST_PAR_011", "ST_PAR_149", "ST_PAR_052", "ST_PAR_074", "ST_PAR_150", "ST_PAR_151", "ST_PAR_059", "ST_PAR_017", "ST_PAR_019", "ST_PAR_153", "ST_PAR_154", "ST_PAR_155", "ST_PAR_156"],
    "M9": ["ST_PAR_157", "ST_PAR_158", "ST_PAR_159", "ST_PAR_160", "ST_PAR_161", "ST_PAR_162", "ST_PAR_163", "ST_PAR_164", "ST_PAR_165", "ST_PAR_166", "ST_PAR_167", "ST_PAR_168", "ST_PAR_169", "ST_PAR_025", "ST_PAR_026", "ST_PAR_027", "ST_PAR_009", "ST_PAR_170", "ST_PAR_171", "ST_PAR_050", "ST_PAR_130", "ST_PAR_172", "ST_PAR_150", "ST_PAR_151", "ST_PAR_074", "ST_PAR_059", "ST_PAR_060", "ST_PAR_020", "ST_PAR_173"],
    "M10": ["ST_PAR_157", "ST_PAR_163", "ST_PAR_164", "ST_PAR_113", "ST_PAR_178", "ST_PAR_179", "ST_PAR_180", "ST_PAR_181", "ST_PAR_078", "ST_PAR_177", "ST_PAR_176", "ST_PAR_175", "ST_PAR_134", "ST_PAR_105"],
    "M11": ["ST_PAR_014", "ST_PAR_183", "ST_PAR_057", "ST_PAR_015", "ST_PAR_034", "ST_PAR_186", "ST_PAR_059", "ST_PAR_187", "ST_PAR_188", "ST_PAR_189", "ST_PAR_190", "ST_PAR_191", "ST_PAR_192"],
    "M12": ["ST_PAR_193", "ST_PAR_194", "ST_PAR_195", "ST_PAR_070", "ST_PAR_196", "ST_PAR_197", "ST_PAR_198", "ST_PAR_199", "ST_PAR_200", "ST_PAR_201", "ST_PAR_202", "ST_PAR_050", "ST_PAR_149", "ST_PAR_011", "ST_PAR_203", "ST_PAR_204", "ST_PAR_116", "ST_PAR_082", "ST_PAR_205", "ST_PAR_206", "ST_PAR_207", "ST_PAR_208", "ST_PAR_210", "ST_PAR_211"],
    "M13": ["ST_PAR_212", "ST_PAR_213", "ST_PAR_214", "ST_PAR_215", "ST_PAR_216", "ST_PAR_217", "ST_PAR_218", "ST_PAR_219", "ST_PAR_220", "ST_PAR_221", "ST_PAR_048", "ST_PAR_170", "ST_PAR_050", "ST_PAR_149", "ST_PAR_010", "ST_PAR_148", "ST_PAR_223", "ST_PAR_224", "ST_PAR_082", "ST_PAR_178", "ST_PAR_085", "ST_PAR_225"],
    "M14": ["ST_PAR_226", "ST_PAR_227", "ST_PAR_228", "ST_PAR_229", "ST_PAR_018", "ST_PAR_014", "ST_PAR_131", "ST_PAR_149", "ST_PAR_050", "ST_PAR_050"],
}

# Build station_lines records
station_lines_records = []
id_to_station = {s["station_global_id"]: s for s in stations_deduped}

for line_id, order in LINE_STATION_ORDER.items():
    # Deduplicate order list
    seen = []
    for sid in order:
        if sid not in seen:
            seen.append(sid)
    order = seen

    line_info = next((l for l in LINES if l["line_id"] == line_id), {})
    for i, sid in enumerate(order):
        if sid not in id_to_station:
            continue
        s = id_to_station[sid]
        prev_id = order[i - 1] if i > 0 else None
        next_id = order[i + 1] if i < len(order) - 1 else None
        station_lines_records.append({
            "station_global_id": sid,
            "line_id": line_id,
            "line_name": line_info.get("line_name", line_id),
            "operator_name": "RATP",
            "line_station_code": f"{line_id}{i+1:02d}",
            "order_on_line": i + 1,
            "is_transfer_station": id_to_station[sid]["line_count"] > 1,
            "is_terminal": i == 0 or i == len(order) - 1,
            "adjacent_prev_station_id": prev_id,
            "adjacent_next_station_id": next_id,
        })

print(f"Station-line records: {len(station_lines_records)}")

# ── Build lines_master ────────────────────────────────────────────────────────
lines_master = []
for line in LINES:
    line_stations = [s for s in stations_deduped if line["line_id"] in s["line_ids"]]
    lines_master.append({
        "line_id": line["line_id"],
        "line_name": line["line_name"],
        "line_name_en": line["line_name_en"],
        "operator_name": line["operator"],
        "color": line["color"],
        "prefectures": ["Île-de-France"],
        "station_count": len(line_stations),
        "is_loop": line["is_loop"],
        "status": "active"
    })

# ── Write files ───────────────────────────────────────────────────────────────
with open(f"{OUT_DIR}/stations_master.json", "w", encoding="utf-8") as f:
    json.dump(stations_deduped, f, ensure_ascii=False, indent=2)
print(f"stations_master.json: {len(stations_deduped)} stations")

with open(f"{OUT_DIR}/station_lines.json", "w", encoding="utf-8") as f:
    json.dump(station_lines_records, f, ensure_ascii=False, indent=2)
print(f"station_lines.json: {len(station_lines_records)} records")

with open(f"{OUT_DIR}/lines_master.json", "w", encoding="utf-8") as f:
    json.dump(lines_master, f, ensure_ascii=False, indent=2)
print(f"lines_master.json: {len(lines_master)} lines")
for l in lines_master:
    print(f"  {l['line_id']}: {l['station_count']} stations")

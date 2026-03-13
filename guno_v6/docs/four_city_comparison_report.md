# GUNOS Four-City Comparison Report
## Tokyo / Osaka / London / NYC

### 1. Overview
GUNOS is a city-based railway strategy game engine designed to simulate and gamify real-world public transit networks. The core engine has now been successfully validated across four major global cities: Tokyo, Osaka, London, and New York City (NYC). By applying the same ruleset and simulation logic to these diverse urban environments, we have demonstrated that the GUNOS engine can dynamically generate distinct gameplay characteristics driven entirely by the underlying geographical and structural data of each city's transit network.

### 2. Why these four cities
The selection of these four cities was strategic, aiming to test the engine against different types of transit network topologies:

- **Tokyo**: Selected as the most difficult and high-density baseline city. Its complex, overlapping lines and numerous transfer hubs provide a rigorous test for the routing and scoring algorithms.
- **Osaka**: Chosen as the second domestic validation city. It offers a slightly smaller but highly balanced network, serving as a reliable benchmark against Tokyo's extreme density.
- **London**: The first overseas metro city integrated into the engine. The London Underground features a distinct hub-and-spoke model with deep historical roots, testing the engine's adaptability to non-grid layouts.
- **NYC**: The first North American metro city. The NYC Subway is characterized by long, linear routes traversing Manhattan and extending into the boroughs, presenting a unique challenge for route-building strategies.

### 3. Shared engine / shared rules
To ensure a valid comparison, all four cities were implemented using a strictly common technical basis:
- **City Package Structure**: Standardized directory layouts (`data/master`, `data/graph`, `data/derived`, `data/decks`, `data/packs`).
- **city_profile.json**: A unified configuration file defining map centers, featured lines, and deck defaults.
- **ROUTE_SIZE = 10**: A hard constraint applied universally; each selected line is represented by exactly 10 key stations to maintain balanced deck sizes.
- **Shared Play Engine & Simulator**: The exact same `game_simulator_v3.js` logic was used to run automated playtests across all cities.
- **Shared Deck Generator**: A common generator creates playable decks based on station rarity and composite scores.
- **Pack Layer vs Graph Layer**: Clear separation between the logical game entities (`pack_v1.json`) and the geographical routing data (`station_graph.json`).

### 4. City package summary table

| City | data_ready | deck_size | selected lines | notes |
|------|------------|-----------|----------------|-------|
| Tokyo | `true` | 40 | JY, G, M, T, Z | 86 stations, 100 edges. High density. |
| Osaka | `true` | 32 | M, T, Y, HK, OC | 85 stations, 90 edges. Balanced network. |
| London | `true` | 30 | CEN, NOR, PIC, DIS, CIR | 162 stations, 169 edges. Hub-centric. |
| NYC | `true` | 35 | L1, L4, LA, LN, L7 | 152 stations, 171 edges. Linear/Long-distance. |

### 5. Selected route sets by city
The starter packages for each city focus on five representative lines to ensure manageable yet strategic gameplay:

- **Tokyo**: Yamanote Line (JY), Ginza Line (G), Marunouchi Line (M), Tozai Line (T), Hanzomon Line (Z)
- **Osaka**: Midosuji Line (M), Tanimachi Line (T), Yotsubashi Line (Y), Hankyu Kyoto Line (HK), Osaka Loop Line (OC)
- **London**: Central line (CEN), Northern line (NOR), Piccadilly line (PIC), District line (DIS), Circle line (CIR)
- **NYC**: 1 Train (L1), 4 Train (L4), A Train (LA), N Train (LN), 7 Train (L7)

### 6. Data scale comparison
The underlying master data reveals the structural differences between the modeled networks:

| Metric | Tokyo | Osaka | London | NYC |
|--------|-------|-------|--------|-----|
| **Unique Stations** | 86 | 85 | 162 | 152 |
| **Lines** | 5 | 5 | 5 | 5 |
| **Graph Nodes** | 86 | 85 | 162 | 152 |
| **Graph Edges** | 100 | 90 | 169 | 171 |

*Note: The station counts represent the filtered master data for the 5 selected lines in each city, not the entire real-world network.*

### 7. Simulation results comparison
Running 50 automated games per city using `game_simulator_v3.js` yielded the following performance metrics:

| City | Deck Size | Avg Turns | Top Strategy | Win Rate (Top) |
|------|-----------|-----------|--------------|----------------|
| Tokyo | 40 | 101.1 | Hub | 30.0% |
| Osaka | 32 | 135.9 | Greedy | 36.0% |
| London | 30 | 128.6 | Hub | 30.0% |
| NYC | 35 | 135.0 | Hub | 36.0% |

### 8. Score structure comparison
The breakdown of average scores highlights how different network topologies reward different playstyles:

| City | Avg Score | Avg Route Bonus | Avg Network Bonus |
|------|-----------|-----------------|-------------------|
| Tokyo | 29.43 | 9.37 | 5.79 |
| Osaka | 36.59 | 11.37 | 7.55 |
| London | 37.05 | 11.10 | 9.99 |
| NYC | 37.29 | 11.95 | 8.49 |

- **Tokyo**: Shows the lowest average score and route bonus, reflecting the intense competition for overlapping central nodes.
- **London & NYC**: Higher network bonuses indicate that controlling key transfer hubs across expansive, sprawling networks yields significant rewards.
- **Osaka**: A balanced environment where the "Greedy" strategy (focusing on immediate high-value grabs) slightly outperforms others.

### 9. Top station comparison
The most frequently played and strategically valuable stations differ markedly by city:

- **Tokyo → Otemachi / Ginza**: In the simulation, Ginza emerged as the top station (played 36 times). These central hubs connect multiple high-traffic lines, making them critical chokepoints.
- **Osaka → Tennoji / Nakatsu**: Nakatsu was played 31 times in the simulation. Tennoji serves as a massive southern anchor, while Nakatsu acts as a crucial northern gateway on the Midosuji line.
- **London → Gloucester Road / Earl's Court**: Gloucester Road and Earl's Court are vital interchanges on the District and Piccadilly lines, controlling the western flow of the network.
- **NYC → Times Sq–42 St**: Played 46 times, this is the ultimate mega-hub, connecting the 1, N, and 7 trains (among others) right in the center of Manhattan.

### 10. Gameplay character by city
Based on the data and network topology, each city offers a distinct "flavor" of gameplay:

- **Tokyo**: *Dense route + hub competition.* The map is highly centralized. Players must aggressively fight for control of central transfer stations (like Ginza and Otemachi) early on, as route building is easily blocked by opponents.
- **Osaka**: *Balanced domestic network.* With strong north-south arteries (Midosuji) and the circular boundary (Loop Line), gameplay is more evenly distributed. Immediate tactical grabs ("Greedy" strategy) often pay off well here.
- **London**: *Hub-heavy transfers.* The network relies heavily on specific interchange stations rather than grid-like overlaps. Securing these key transfer points ("Hub" strategy) is essential for achieving high network bonuses.
- **NYC**: *Long-distance Manhattan-centered structure.* Routes are long and linear, often running parallel through Manhattan before diverging. The "Hub" strategy dominates because controlling central Manhattan bottlenecks (like Times Sq) dictates the flow of the entire game.

### 11. Technical lessons learned
- **ROUTE_SIZE = 10 worked well**: Enforcing a strict 10-station limit per line successfully normalized the scale across vastly different real-world networks, keeping deck sizes manageable (30-40 cards).
- **city_profile + city_loader abstraction worked**: The engine seamlessly switches between cities simply by loading different JSON profiles, proving the architecture's flexibility.
- **Pack schema consistency matters**: Aligning the `pack_v1.json` schema (specifically ensuring `collections.members` are string ID arrays) was crucial for cross-city compatibility.
- **City-specific deck defaults are useful**: Allowing `city_profile.json` to define target deck sizes and rarity distributions accommodated the natural variances in station importance across different cities.
- **Simulator is essential**: The `game_simulator_v3.js` proved invaluable for objectively validating balance. It immediately highlighted how structural differences (e.g., Tokyo's density vs. NYC's linearity) translate into strategic shifts.

### 12. Remaining issues / next improvements
- **London balance tuning**: While functional, the heavy reliance on western hubs (Gloucester Road) might require slight scoring adjustments to encourage broader map utilization.
- **NYC representative-station polish**: Ensuring the selected 10 stations per line perfectly capture the "feel" of the massive NYC subway might require manual curation beyond the automated composite score selection.
- **Cross-city comparison UI**: Developing a frontend dashboard to visualize these simulation stats side-by-side.
- **Future city additions**: With the pipeline validated, the engine is ready to ingest new topologies, such as Paris (dense historical), Seoul (grid-like), or Chicago (24/7 linear).

### 13. Conclusion
The integration and validation of Tokyo, Osaka, London, and NYC confirm that the core GUNOS engine is robust and highly adaptable. The shared ruleset successfully operates across all four cities, yet the unique geographical data of each location naturally produces distinct gameplay characteristics and strategic metas. GUNOS has clearly evolved from a single-city prototype into a versatile, multi-city simulation platform.

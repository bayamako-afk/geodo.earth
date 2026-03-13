# GUNOS Versioning and Naming Policy

### 1. Purpose
This document defines the official naming conventions and versioning policy for the GUNOS project. It establishes clear rules for naming the platform, the individual city games, and the internal city data packages. As the project has successfully evolved from a single-city prototype into a robust multi-city platform, maintaining consistent terminology is essential to align future development, documentation, debug tools, and city-package expansions.

### 2. Core distinction
The fundamental distinction in the project's terminology is between the platform and the games built upon it:

**GUNOS**
GUNOS refers to the **platform** itself. It encompasses the underlying architecture and shared systems, including:
- The shared game engine
- The play and routing engine
- The scoring engine
- The city loader abstraction
- The city-aware deck generator
- The automated simulator (`game_simulator_v3.js`)
- Debug and comparison tools
- Shared specifications (e.g., `ROUTE_SIZE = 10`)

**GUNO**
GUNO refers to an **individual city game** built on top of the GUNOS platform. It represents the playable experience for a specific geographical location.
Examples:
- GUNO Tokyo
- GUNO Osaka
- GUNO London
- GUNO NYC

### 3. Naming rules
To maintain clarity across all communications and codebases, the following naming rules apply:

**Platform naming**
The platform uses standard major/minor versioning.
- GUNOS V1
- GUNOS V1.1
- GUNOS V1.2
- GUNOS V2

**City game naming**
City games are identified by the "GUNO" prefix followed by the city name. They should not usually carry their own public major version numbers at this stage.
- GUNO Tokyo
- GUNO Osaka
- GUNO London
- GUNO NYC

**Internal city package naming**
Data packages representing the city networks are versioned internally. These labels are primarily for internal development and data-tracking use.
- Tokyo package v1
- Osaka package v1
- London package v1
- NYC package v1

### 4. Recommended 3-layer model
The project structure is organized into three distinct conceptual layers:

**Layer 1: Platform**
- GUNOS V1 (The underlying engine and shared logic)

**Layer 2: City games**
- GUNO Tokyo, GUNO Osaka, GUNO London, GUNO NYC (The playable products)

**Layer 3: Internal package versions**
- Tokyo package v1, Osaka package v1, etc. (The data powering the games)

### 5. What GUNOS version numbers mean
Platform versions reflect significant milestones in the engine's capabilities.

**GUNOS V1**
This represents the first true multi-city playable platform release. It includes:
- Multi-city directory and data structure
- `city_profile.json` integration
- Dynamic city loader
- City-aware deck generator
- City-aware simulator
- The `ROUTE_SIZE = 10` standard constraint
- Common schema specifications (`pack_v1.json`, `station_graph.json`)
- Initial playable city packages: Tokyo, Osaka, London, NYC

**GUNOS V1.x**
Minor platform updates are reserved for incremental improvements, such as:
- UI integration and frontend enhancements
- City switching logic improvements
- Simulator refinements and new strategy bots
- City package balancing adjustments
- Documentation and tooling improvements

**GUNOS V2**
A major version bump is reserved for structural overhauls, such as:
- Major rule or core gameplay redesigns
- Large-scale online or multiplayer architecture changes
- Major engine rewrites
- Implementation of platform-wide modding or marketplace systems

### 6. What city package versions mean
Each city package may evolve independently of the platform. Changes at this level involve data adjustments rather than engine logic:
- Modifying selected featured lines
- Updating representative station selections
- Adjusting deck defaults and rarity distributions
- Fixing schema issues in `pack_v1.json`
- Improving `station_graph.json` or metrics calculations

These changes should remain internal package revisions (e.g., updating "Tokyo package v1" to "Tokyo package v1.1") and should not result in public-facing product renaming.

### 7. Practical naming usage
When referring to the project in different contexts, use the following formats:

- **User-facing naming**: "Play GUNO Tokyo, powered by GUNOS."
- **Development-facing naming**: "Update the city loader in GUNOS V1 to support the new London package v1."
- **Debug / viewer naming**: Suggested branding for internal tools and debug UIs:
  - GUNOS V1 · TOKYO
  - GUNOS V1 · OSAKA
  - GUNOS V1 · LONDON
  - GUNOS V1 · NYC

### 8. Repository / documentation terminology
Consistency in documentation is critical:
- Use **GUNOS** when discussing the engine, simulator, shared rules, or platform architecture.
- Use **GUNO <City>** when discussing the specific gameplay experience, marketing, or user-facing product of a specific city.
- Use **city package** when discussing the JSON data files, graph data, or metrics specific to a location.

### 9. Recommended version ownership
The primary visible version number belongs to the **GUNOS platform**, not the individual city games. The preferred hierarchy is:

- **GUNOS V1**
  - GUNO Tokyo
  - GUNO Osaka
  - GUNO London
  - GUNO NYC

### 10. What belongs in GUNOS V1
As defined above, V1 encompasses the fully functional multi-city architecture, the standardized `ROUTE_SIZE=10` ruleset, the automated simulator, and the first four validated city packages (Tokyo, Osaka, London, NYC).

### 11. What belongs in V1.x
V1.x releases will contain iterative updates: UI polish, bug fixes in the simulator, minor balancing tweaks to existing city packages, and improvements to internal developer tooling.

### 12. What belongs in V2
V2 will be triggered by paradigm shifts: introduction of real-time multiplayer, complete scoring system overhauls, or fundamental changes to how the graph network is processed.

### 13. Things to avoid
To prevent confusion, developers and planners must avoid:
- **Mixing old single-game versioning with platform versioning.**
- **Publishing city-specific major versions too early.** (e.g., Do not use "GUNO Tokyo V2"; instead, update the Tokyo package within GUNOS V1.x).
- **Confusing GUNO and GUNOS in documentation.**

*Not preferred*: "We are releasing GUNO V2 with the new London engine."
*Preferred*: "We are updating GUNOS to V1.1, which includes improvements to GUNO London."

### 14. Recommended policy summary

**Platform:**
- GUNOS V1

**City games:**
- GUNO Tokyo
- GUNO Osaka
- GUNO London
- GUNO NYC

**Internal tracking:**
- Tokyo package v1
- Osaka package v1
- London package v1
- NYC package v1

### 15. Final statement
The project has officially transitioned and must now be treated as a comprehensive **GUNOS platform project**. **GUNOS is the underlying system**, while **GUNO represents each distinct city game** built upon it. All major platform versions and architectural changes will be managed strictly at the GUNOS level to ensure long-term scalability and consistency.

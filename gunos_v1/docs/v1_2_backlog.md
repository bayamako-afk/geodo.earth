# GUNOS V1.2 Backlog

## Phase Summary
GUNOS V1.2 is the next expansion phase following the successful completion of V1.1. While V1.1 focused on core visibility, UI/UX polish, and resolving immediate visual clutter (such as dense map labels and narrow-screen panel overflow), V1.2 shifts the focus toward deeper gameplay balance, mobile interaction refinement, and overall product maturity. This phase aims to elevate the game from a "functioning prototype" to a "compelling, balanced, and extensible game."

## Phase Theme
**UX / Balance Expansion**

## Backlog Principles
- **Prioritize player understanding**: Ensure new players can quickly grasp how scoring (Route+, Hub+) works.
- **Improve moment-to-moment usability**: Reduce friction in mobile and touch interactions.
- **Refine balance before adding larger systems**: Tune existing scoring mechanics before introducing new rules.
- **Keep tasks modular and testable**: Each task should be independently verifiable across all supported cities.

---

## Task List

### Task 01 — Mobile-First Interaction Polish
**Purpose**
Building upon the responsive layout improvements in V1.1, this task focuses on the actual *interaction* experience on mobile devices, ensuring that controls and touch targets feel natural and frictionless.

**Focus**
- Enlarge touch targets for core controls (START, PLAY, AUTO).
- Refine map pan/zoom interactions for touch screens.
- Optimize vertical spacing and scrolling behavior on narrow screens.
- Ensure the hand panel and card selection are easily operable with one hand.

**Expected Outcome**
A smoother, more intuitive mobile gameplay experience where players can comfortably play full matches without feeling constrained by the UI.

### Task 02 — Gameplay Balance Tuning
**Purpose**
With the Route+ and Hub+ scoring systems fully integrated and visible, it is time to analyze and adjust their impact on the final outcome to ensure strategic depth and fairness across different city topologies.

**Focus**
- Analyze Route+ completion frequency and adjust difficulty or rewards if necessary.
- Re-evaluate the weight of Hub+ versus base station scores.
- Address any cross-city score disparities (e.g., the massive gap between Tokyo/Osaka and London/NYC).
- Ensure that different strategies (e.g., focusing on hubs vs. completing long routes) are viable.

**Expected Outcome**
A more balanced and competitive scoring environment where player choices meaningfully impact the game, regardless of the selected city.

### Task 03 — Onboarding & Tutorial Layer
**Purpose**
New players often struggle to understand the nuances of the game's mechanics. This task introduces lightweight, non-intrusive onboarding elements to explain the core loop and scoring logic.

**Focus**
- Implement a brief, dismissible "How to Play" overlay or tooltip system.
- Provide contextual hints for Route+ and Hub+ mechanics during the first few turns.
- Clarify the difference between "Owned" stations and "Hub" networks.
- Keep explanations concise to avoid overwhelming the screen.

**Expected Outcome**
A smoother entry for first-time players, leading to quicker comprehension of the game's strategic depth without cluttering the UI.

### Task 04 — Result Drama & Feedback Enhancement
**Purpose**
The end-of-game experience should feel rewarding and clearly communicate the narrative of the match. This task enhances the visual and emotional payoff of the GAME OVER state.

**Focus**
- Introduce stronger visual cues for victory and defeat.
- Clearly highlight "Why you won / lost" (e.g., emphasizing a decisive Route+ completion or massive Hub+ bonus).
- Improve the animation or transition into the result panel.
- Make the final score breakdown feel more satisfying and dramatic.

**Expected Outcome**
A more engaging and memorable conclusion to each match, encouraging players to start another session.

### Task 05 — City Pack Extensibility Prep
**Purpose**
To prepare for future content expansions, the underlying data structures and configuration files must be refactored to seamlessly support new cities without requiring code changes.

**Focus**
- Audit current code for hardcoded city-specific assumptions or edge cases.
- Standardize the `city_registry.json` and graph data formats.
- Create a streamlined process or script for validating and importing new city data.
- Ensure dynamic UI elements (like the City Comparison panel) can automatically scale with new additions.

**Expected Outcome**
A robust, extensible architecture that allows new cities to be added quickly and safely, paving the way for V1.3 or future DLCs.

---

## Recommendation for Next Task
**Recommended First Task: Task 01 — Mobile-First Interaction Polish**

*Reasoning*: V1.1 Task 05 successfully established a responsive layout foundation. Moving immediately into Task 01 capitalizes on this momentum by refining the actual *feel* and usability of that layout on mobile devices. Ensuring the game is comfortable to play on narrow screens is a critical prerequisite before diving into deeper balance tuning or onboarding features.

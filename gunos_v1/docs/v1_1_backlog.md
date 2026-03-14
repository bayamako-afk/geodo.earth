# GUNOS V1.1 Backlog

### 1. Purpose

GUNOS V1 has successfully reached its first playable multi-city platform milestone. The purpose of the V1.1 release is to incrementally improve the current platform rather than replace it. The primary goal is to make the platform easier to play, easier to understand, and easier to compare across different cities, building upon the stable foundation established in V1.

### 2. V1.1 Design Principle

The core design principle for V1.1 is refinement over reinvention:
- Do not break the established V1 platform structure.
- Do not execute a major architecture rewrite.
- Do not introduce large new gameplay systems (e.g., special cards) yet.
- Focus entirely on the refinement and polish of the current user experience.

### 3. Recommended Backlog Pillars

The V1.1 backlog is organized into four strategic pillars to guide prioritization and development focus:

1. **Playability**: Enhancing the tactile feel and clarity of taking actions.
2. **Readability**: Improving how players understand the current game state and score.
3. **Multi-city comparison**: Making the platform's multi-city nature more visible and educational.
4. **Online stabilization**: Hardening the multiplayer layer for practical use.

### 4. Pillar A — Playability

This is the highest-priority pillar, focusing on the immediate moment-to-moment gameplay experience.

- **Route/network live visibility improvement**: Make the growth of networks more visceral. Stronger route progress visibility and clearer network growth highlights.
- **Playable action clarity**: Implement clearer highlighting for playable cards in the hand based on the current map state.
- **Turn flow polish**: Ensure smoother transitions and understanding between Start, Play 1, Auto ×20, and Reset states.

### 5. Pillar B — Readability

This pillar focuses on improving the player's understanding of the game state, scoring, and outcomes.

- **Score panel readability improvement**: Establish a clearer visual hierarchy between Station, Route, Hub, and Total Network scores.
- **Result panel clarity improvement**: Enhance the GAME OVER screen to better explain exactly *why* the winner won, making the breakdown instantly readable.
- **London / NYC readability tuning**: Improve dense-map readability for complex cities, addressing overlapping nodes or cluttered label areas.

### 6. Pillar C — Multi-city Comparison

This pillar aims to highlight the unique platform capability of running multiple distinct city topologies.

- **City comparison mini-panel**: Introduce a lightweight UI component to show key differences between cities.
- **City descriptor polish**: Expand the short descriptor texts into more meaningful strategic hints.
- **Lightweight 4-city comparison view**: Provide at-a-glance stats such as deck size differences, average game lengths (turns), and dominant strategies per city.

### 7. Pillar D — Online Stabilization

This is a medium-priority pillar. While the online layer passed smoke testing in V1, it requires practical hardening before wider use.

- **Session separation improvement**: Ensure `session_id` handling is robust across multiple concurrent games.
- **Stale room cleanup**: Implement reliable garbage collection for abandoned or disconnected sessions.
- **Join / sync UX improvement**: Polish the user experience for joining a room and synchronizing the initial game state.
- **Practical online validation**: Move beyond basic smoke testing to handle edge cases like mid-game disconnects and state reconciliation.

### 8. What Should NOT Belong to V1.1

To maintain focus, the following items are explicitly out of scope for the V1.1 release:

- Large special-card systems (event cards, action cards, wildcards).
- Major rule redesigns or core engine rewrites.
- Full replay system implementation or interactive turn history timelines.
- Modding support or marketplace systems.
- Full online-first architecture rewrite (the engine remains local-first with sync).
- Account management, login, or persistence platform buildouts.
- Large-scale city expansion (adding many new cities before refining the core four).

### 9. Suggested Priority Order

To maximize impact, the following implementation order is recommended:

1. Route / network visibility polish (Playability)
2. Score / result readability improvement (Readability)
3. City comparison mini-panel (Multi-city comparison)
4. London / NYC readability tuning (Readability)
5. Online stabilization tasks (Online stabilization)

### 10. Suggested Phased Interpretation

For sprint planning, the backlog can be optionally split into two sub-releases:

#### V1.1a (Core UX Focus)
- Playability improvements
- Readability enhancements

#### V1.1b (Platform Focus)
- City comparison features
- Online stabilization

### 11. Recommended "Now / Next / Later" View

A practical prioritization view for immediate action:

#### Now
- Route/network visibility polish
- Score panel polish
- Result panel polish

#### Next
- City comparison mini-panel
- London / NYC readability tuning

#### Later
- Online stabilization
- Replay conceptualization
- Larger system expansion (V1.2+)

### 12. Final Recommendation

GUNOS V1.1 should be treated strictly as a refinement release that preserves the current V1 foundation while significantly improving readability, playability, and multi-city clarity.

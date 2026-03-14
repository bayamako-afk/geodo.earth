/**
 * layout.js — GUNOS V1 Layout Orchestrator
 *
 * Coordinates the full Phase 2 play screen layout:
 *   - Header bar
 *   - Map panel (center, dominant)
 *   - Hand panel (bottom-left)
 *   - Score + Log panel (bottom-right)
 *
 * This module is the single entry point for rendering the complete UI.
 * main.js calls renderLayout() after city data is loaded.
 *
 * Phase 2: full layout structure with city-aware placeholders
 * Phase 3: individual panel modules updated in place
 * Phase 4: stationGraph passed to renderMapPanel for geographic base map
 */

import { renderHeaderBar, setHeaderStatus } from './header_bar.js?v=5';
import { renderMapPanel }   from './map_panel.js?v=5';
import { renderHandPanel }  from './hand_panel.js?v=5';
import { renderScorePanel } from './score_panel.js?v=5';

/**
 * Render the complete GUNOS V1 play screen layout.
 *
 * @param {Object} opts
 * @param {Object}   opts.profile        - Loaded city profile
 * @param {Object}   opts.registryEntry  - { city_id, display_name, display_label }
 * @param {Array}    opts.cities         - All available cities
 * @param {Function} opts.onStart        - Start button callback (stub in Phase 2)
 * @param {Function} opts.onReset        - Reset button callback (stub in Phase 2)
 */
export function renderLayout({ profile, registryEntry, cities, stationGraph, onStart, onReset }) {
  renderHeaderBar({ profile, registryEntry, cities, onStart, onReset });
  renderMapPanel({ profile, stationGraph: stationGraph ?? null });
  renderHandPanel({ profile });
  renderScorePanel({ profile });

  setHeaderStatus('Ready', 'idle');

  console.log(`[GUNOS V1] Layout rendered for city: ${profile.city_id}`);
}

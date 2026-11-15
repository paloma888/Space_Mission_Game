// Slice 2: Build & Launch Setup (owner: Person 2)
// Rocket, capsule parts and launch site. Ends when the player presses Lock In and the build is legal.
// The numbers live in recompute.js and the JSON files. Each screen lives in its own file.

import { CATALOG, LINES } from './catalog.js';
import * as math from './recompute.js';
import * as ui from '../../core/ui.js';
import { showShop } from './shop.js';
import { showRocket, showSite } from './vehicle.js';
import { showReview } from './review.js';
import { commit } from './common.js';

export const meta = { id: 'build', owner: 'Person 2' };
export { CATALOG };

// The one-argument version other slices call (brief section 5). Fills state.derived and rel.parts.
export const recompute = (state) => math.recompute(state, CATALOG);

// Our styles live in build.css because core/base.css belongs to Person 1.
function loadStyles() {
  if (document.getElementById('build-css')) return;
  const link = document.createElement('link');
  link.id = 'build-css';
  link.rel = 'stylesheet';
  link.href = new URL('./build.css', import.meta.url).href;
  document.head.append(link);
}

// The screens in order. Each one resolves when the player presses Next.
// Rocket first: it sets how heavy the capsule may be, so the shop can show the margin live.
const SCREENS = [showRocket, showShop, showSite, showReview];

export async function show(state, done) {
  loadStyles();
  // Mission 1 always flies to low Earth orbit (team decision: the orbit screen was cut).
  // recompute() and the polar data in sites.json still work, ready for Mission 2.
  state.orbit = 'leo';
  // Whatever is already in the build counts as paid. Screens only charge changes from here.
  recompute(state);
  ui.refresh();
  if (state.resume === 'build') state.resume = null; // Try Again: open on the rocket screen with the old build

  // ctx.paid: what the budget has already been charged. Each screen's choices are
  // charged when the player presses Next, so the dashboard budget only moves then.
  const ctx = { catalog: CATALOG, lines: LINES, recompute, paid: state.derived.spent };
  // No Back buttons (team decision): each screen runs once, in order, and its choice is final.
  for (const screen of SCREENS) {
    await screen(state, ctx);
    commit(state, ctx);
    // Step 6: the shady dealer pops up here, after the shop (screen === showShop),
    // comparing the player's part with a dealer part.
  }
  done();
}

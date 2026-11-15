// Slice 2: Build & Launch Setup (owner: Person 2)
// Capsule parts, rocket, launch site, orbit. Ends when the player presses Lock In and the build is legal.
// The numbers live in recompute.js and the JSON files. Each screen lives in its own file.

import { CATALOG, LINES } from './catalog.js';
import * as math from './recompute.js';
import * as ui from '../../core/ui.js';
import { showShop } from './shop.js';
import { showRocket, showSite, showOrbit } from './vehicle.js';
import { showReview } from './review.js';

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

// The screens in order. Each one resolves 'next' or 'back'.
// Rocket first: it sets how heavy the capsule may be, so the shop can show the margin live.
const SCREENS = [showRocket, showShop, showSite, showOrbit, showReview];

export async function show(state, done) {
  loadStyles();
  // Whatever is already in the build counts as paid. Screens only charge changes from here.
  recompute(state);
  ui.refresh();
  if (state.resume === 'build') state.resume = null; // Try Again: open on the rocket screen with the old build

  const ctx = { catalog: CATALOG, lines: LINES, recompute };
  let i = 0;
  while (i < SCREENS.length) {
    const result = await SCREENS[i](state, ctx);
    if (result === 'back') { i = Math.max(0, i - 1); continue; }
    // Step 6: the shady dealer pops up here, after the shop (SCREENS[i] === showShop),
    // comparing the player's part with a dealer part.
    i += 1;
  }
  done();
}

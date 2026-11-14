// Slice 2: Build & Launch Setup (owner: Person 2)
// Capsule parts, rocket, launch site, orbit. Ends when the player presses Lock In and the build is legal.
// The numbers live in recompute.js and the JSON files. Each screen lives in its own file.

import { CATALOG, LINES } from './catalog.js';
import * as math from './recompute.js';
import * as ui from '../../core/ui.js';
import { showShop } from './shop.js';

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

export async function show(state, done) {
  loadStyles();
  // Whatever is already in the build counts as paid. The shop only charges changes from here.
  recompute(state);
  ui.refresh();
  if (state.resume === 'build') state.resume = null; // Try Again: open on the shop with the old build

  const ctx = { catalog: CATALOG, lines: LINES, recompute };
  while (true) {
    await showShop(state, ctx);
    // Step 6: the shady dealer pops up here and compares the player's part with a dealer part.
    const next = await rocketPlaceholder(state);
    if (next === 'next') return done();
  }
}

// Temporary until step 4 builds the rocket, site and orbit screens.
function rocketPlaceholder(state) {
  return new Promise((resolve) => {
    const root = ui.screen('build/rocket_yard');
    root.classList.add('stub');
    const box = document.createElement('div');
    box.innerHTML = `<h1>Rocket, site and orbit</h1>
      <p>Coming in step 4. Capsule: ${state.derived.capsuleMass} t, budget $${state.budget}M.</p>`;
    root.append(box,
      ui.button('Back', () => resolve('back'), { variant: 'quiet' }),
      ui.button('Next', () => resolve('next')));
  });
}

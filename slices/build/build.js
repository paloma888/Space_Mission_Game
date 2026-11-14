// Slice 2: Build & Launch Setup (owner: Person 2)
// Capsule parts, rocket, launch site, orbit. Ends when the player presses Lock In and the build is legal.
// The screens are still a placeholder. The real numbers live in recompute.js and the JSON files.

import { CATALOG } from './catalog.js';
import * as math from './recompute.js';
import * as ui from '../../core/ui.js';

export const meta = { id: 'build', owner: 'Person 2' };
export { CATALOG };

// The one-argument version other slices call (brief section 5). Fills state.derived and rel.parts.
export const recompute = (state) => math.recompute(state, CATALOG);

export async function show(state, done) {
  recompute(state);
  ui.refresh();
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>Build & Launch Setup</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}

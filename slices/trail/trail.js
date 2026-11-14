// Slice 3: The Trail (owner: Person 3)
// Five weekly turns between hiring and launch week (Rulebook section 3,
// Slice 3 brief section 3).
//
// First version: each week plays one event, charges overhead and moves time on.
// Still to come: the staff assignment screen, the resolve step and the summary.

import * as ui from '../../core/ui.js';
import { checkEnd } from '../../core/state.js';
import { applyEffects, loadAllEvents, pickEvent, runEvent } from '../../core/events.js';

export const meta = { id: 'trail', owner: 'Person 3' };

const LAST_WEEK = 5;
const WEEKLY_OVERHEAD = 5; // $M. Moves to tasks.json with the resolve step.

export async function show(state, done) {
  await loadAllEvents();
  ui.music('build_loop');

  // Start from state.week so presets like midTrail pick up in the middle.
  for (let week = state.week; week <= LAST_WEEK; week++) {
    state.week = week;

    ui.screen('trail/trail_map');
    ui.sfx('trail-week');
    await ui.say('rosa', `Week ${week} of ${LAST_WEEK}. Day ${state.day}.`);

    const event = pickEvent(state, week);
    if (event) {
      const { ended } = await runEvent(state, event);
      if (ended) return done('finale');
    }

    // Overhead may push the budget to 0 or below (Rulebook 6.2). checkEnd catches it.
    applyEffects(state, { budget: -WEEKLY_OVERHEAD, day: 7 });
    if (checkEnd(state)) return done('finale');

    // Events can add days, so the launch window may open before week 5 is over.
    if (state.day >= state.windowOpens) break;
  }

  done();
}

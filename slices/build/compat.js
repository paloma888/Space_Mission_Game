// slices/build/compat.js: the "Will it fly?" panel (Slice 2 brief section 8).
// Shown on the rocket, site and review screens. Being too heavy is the
// main teaching moment, so it gets a red banner and a clunk sound.

import * as ui from '../../core/ui.js';
import { el, signed } from './common.js';
import { findRocket, liftFor } from './recompute.js';

let wasTooHeavy = false; // play the clunk only when the build *becomes* too heavy

// The lift to judge against. Before a site is picked we assume no site bonus,
// so Sparrow already shows as too small on the rocket screen.
export function currentLift(state, catalog) {
  if (!state.rocket) return null;
  if (state.site) return state.derived.liftCapacity;
  return liftFor(findRocket(catalog, state.rocket), { liftBonus: 0 }, state.orbit);
}

export function compatPanel(state, { catalog, lines }) {
  const d = state.derived;
  const box = el('div', 'compat');
  box.append(el('h2', null, 'Will it fly?'));
  const line = (label, text, mood) => {
    const row = el('div', `compat-row ${mood ?? ''}`);
    row.append(el('span', 'compat-label', label), el('span', null, text));
    box.append(row);
  };

  const lift = currentLift(state, catalog);
  const margin = lift == null ? null : Math.round((lift - d.capsuleMass) * 10) / 10;
  if (margin == null) {
    line('Mass', `Capsule ${d.capsuleMass.toFixed(1)} t. Pick a rocket to see if it fits.`);
  } else if (!d.capsuleMass) {
    // Rockets come before parts: nothing to weigh yet, so just say what the rocket can carry.
    line('Mass', `Your rocket lifts ${lift.toFixed(1)} t. Build a capsule lighter than that.`, 'ok');
  } else {
    const where = state.site ? '' : ' (before a site bonus)';
    line('Mass', `Capsule ${d.capsuleMass.toFixed(1)} t on a rocket that lifts ${lift.toFixed(1)} t${where}. `
      + `Margin ${signed(margin)} t.`, margin < 0 ? 'bad' : margin < 1 ? 'warn' : 'ok');
  }

  if (!d.powerSupply && !d.powerUse) {
    line('Power', 'No parts yet.');
  } else {
    line('Power', `Using ${d.powerUse} W of ${d.powerSupply} W.`, d.powerUse > d.powerSupply ? 'bad' : 'ok');
  }

  const radio = d.comms === 'none' ? 'No radio yet.' : d.comms === 'budget'
    ? 'Radio is Budget. Mission Control may miss early warnings.'
    : `Radio is ${d.comms === 'premium' ? 'Premium' : 'Standard'}. Mission Control hears you clearly.`;
  line('Radio', radio, d.comms === 'none' ? null : d.comms === 'budget' ? 'warn' : 'ok');

  const tooHeavy = margin != null && d.capsuleMass > 0 && margin < 0;
  if (tooHeavy) {
    const text = (lines.shop?.tooHeavy ?? 'Too heavy by {n} t.').replace('{n}', Math.abs(margin).toFixed(1));
    box.prepend(el('div', 'compat-banner', text));
    if (!wasTooHeavy) ui.sfx('build-clunk');
  }
  wasTooHeavy = tooHeavy;
  return box;
}

// slices/build/review.js: review and Lock In (Slice 2 brief section 11, amendment A5).
// Resolves 'back' or 'next'. 'next' means the build is locked and the checkpoint is saved.

import * as ui from '../../core/ui.js';
import { applyEffects } from '../../core/events.js';
import { saveCheckpoint, addFlag, removeFlag } from '../../core/state.js';
import { el, talk } from './common.js';
import { compatPanel } from './compat.js';
import { findRocket, findSite, installedParts, lockInProblems, hasShadyPart } from './recompute.js';

const ROWS = [
  ['Shell', (s) => s.parts.shell, 'shell'],
  ['Life support', (s) => s.parts.lifeSupport, 'lifeSupport'],
  ['Comms', (s) => s.parts.comms, 'comms'],
  ['Flight computer', (s) => s.parts.computer, 'computer'],
  ['Power', (s) => s.parts.power?.tier, 'power'],
];

export function showReview(state, ctx) {
  return new Promise((resolve) => {
    const { catalog, lines } = ctx;
    const root = ui.screen('build/rocket_yard');
    root.classList.add('vehicle');
    const head = el('div', 'v-head');
    head.append(el('h2', null, 'Review your mission'));
    const body = el('div', 'v-review');
    const foot = el('div', 'v-foot');
    root.append(head, body, foot);

    // Left: what you bought. Right: where and how it flies.
    const list = el('div', 'v-info');
    for (const [label, get, cat] of ROWS) {
      const tier = get(state);
      const group = cat === 'power' ? catalog.parts.power?.battery : catalog.parts[cat];
      list.append(row(label, group?.[tier]?.label ?? '--'));
    }
    list.append(row('Parts total', `$${installedParts(state.parts, catalog).reduce((n, p) => n + p.cost, 0)}M`));
    const rocket = findRocket(catalog, state.rocket);
    const site = findSite(catalog, state.site);
    const trip = el('div', 'v-info');
    trip.append(
      row('Rocket', rocket ? `${rocket.name} ($${rocket.cost}M)` : '--'),
      row('Site', site?.name.split(',')[0] ?? '--'),
      row('Orbit', state.orbit === 'polar' ? 'Polar' : 'Low Earth'),
      row('Launch fee', site ? `$${site.fee}M, paid in launch week` : '--'),
      row('Budget left', `$${state.budget}M`));
    body.append(list, trip);

    const problems = lockInProblems(state, catalog);
    const buttons = el('div', 'v-buttons');
    const lock = ui.button('Lock In', () => lockIn());
    if (problems.length) { lock.disabled = true; lock.title = problems[0]; }
    buttons.append(ui.button('Back', () => resolve('back'), { variant: 'quiet' }), lock);
    for (const p of problems) buttons.append(el('p', 'tier-why', p));
    foot.append(compatPanel(state, ctx), buttons);

    let locking = false;
    async function lockIn() {
      if (locking) return;
      locking = true;
      // Short on power is allowed, but only after a warning (brief section 11).
      if (!state.derived.powerOk) {
        await talk(root, 'hal', lines.hal?.lockPowerShort, { mood: 'sad' });
        const answer = await ui.ask('hal', lines.shop?.lockAnyway ?? 'Lock it in anyway?',
          [{ label: 'Lock it in' }, { label: 'Go back and fix it' }]);
        if (answer !== 0) { locking = false; return; }
      }
      // Saved before the shell's morale change, so a Try Again from this checkpoint
      // doesn't get the morale bonus (or penalty) twice when it locks in again.
      removeFlag(state, 'shady_part');
      saveCheckpoint(state, 'afterBuild');
      const shell = catalog.parts.shell?.[state.parts.shell];
      if (shell?.morale) applyEffects(state, { morale: shell.morale });
      if (hasShadyPart(state, catalog)) addFlag(state, 'shady_part');
      ui.sfx('build-lock');
      ui.refresh();
      await talk(root, 'rosa', lines.rosa?.lockIn);
      resolve('next');
    }
  });
}

function row(label, value) {
  const r = el('div', 'side-row');
  r.append(el('span', null, label), el('span', null, value));
  return r;
}

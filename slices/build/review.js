// slices/build/review.js: review and Lock In (Slice 2 brief section 11, amendment A5).
// Resolves when the build is locked and the checkpoint is saved. There is no Back button.

import * as ui from '../../core/ui.js';
import { applyEffects } from '../../core/events.js';
import { saveCheckpoint, addFlag, removeFlag } from '../../core/state.js';
import { el, art, talk } from './common.js';
import { compatPanel } from './compat.js';
import { findRocket, findSite, installedParts, lockInProblems, hasShadyPart } from './recompute.js';

// Listed top to bottom, the same order they stack in the rocket picture.
const PARTS = [
  { name: 'Shell', cat: 'shell', tier: (s) => s.parts.shell },
  { name: 'Life support', cat: 'lifeSupport', tier: (s) => s.parts.lifeSupport },
  { name: 'Comms', cat: 'comms', tier: (s) => s.parts.comms },
  { name: 'Flight computer', cat: 'computer', tier: (s) => s.parts.computer },
  { name: 'Battery', cat: 'power', tier: (s) => s.parts.power?.tier },
];
const partOf = (state, catalog, p) =>
  (p.cat === 'power' ? catalog.parts.power?.battery : catalog.parts[p.cat])?.[p.tier(state)] ?? null;

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

    // Left box: each part (and the rocket) on its own row, with a dotted line running
    // toward its section of the rocket picture in the box on the right.
    const rocket = findRocket(catalog, state.rocket);
    const site = findSite(catalog, state.site);
    const summary = el('div', 'v-info v-summary');
    const diagram = el('div', 'v-diagram');
    PARTS.forEach((p) => {
      const part = partOf(state, catalog, p);
      // A shady part shows the tier it pretends to be; the catch stays hidden.
      const tier = part?.looksLike ?? p.tier(state) ?? 'none';
      diagram.append(partRow(p.name, part?.label ?? '--', part ? `$${part.cost}M` : '', tier));
    });
    diagram.append(partRow('Rocket', rocket?.name ?? '--', rocket ? `$${rocket.cost}M` : '', 'rocket'));
    // Right box: the rocket art (554 x 580) shown at 254 x 266, right above Lock In.
    const rocketBox = el('div', 'v-info v-rocket-box');
    rocketBox.append(art(`art/sprites/${rocket?.sprite ?? 'rocket_condor'}.png`, 'v-rocket-sprite', rocket?.name ?? 'rocket'));
    // The dealer's mysterious component is part of the build, so it gets a mention (but no explanation).
    if (state.parts.warpCoil) rocketBox.append(el('p', 'v-component', lines.review?.component ?? '+ Mysterious component'));
    const partsCost = installedParts(state.parts, catalog).reduce((n, part) => n + part.cost, 0);
    summary.append(
      diagram,
      row('Launch site', site?.name.split(',')[0] ?? '--', '', 'v-push'),
      row('Launch fee', 'Paid in launch week', site ? `$${site.fee}M` : ''),
      row('Total', `${state.derived.capsuleMass} t capsule`, `$${partsCost + (rocket?.cost ?? 0)}M`, 'v-total'),
      row('Budget left', '', `$${state.budget}M`, 'v-total'));
    body.append(summary, rocketBox);

    const problems = lockInProblems(state, catalog);
    const buttons = el('div', 'v-buttons');
    const lock = ui.button('Lock In', () => lockIn());
    lock.classList.add('big-next');
    // Earlier screens only allow legal choices (no Back button), so this should stay empty.
    // It is kept as a safety net and so testers can see why if a rule ever slips.
    if (problems.length) { lock.disabled = true; lock.title = problems[0]; }
    buttons.append(lock);
    for (const p of problems) buttons.append(el('p', 'tier-why', p));
    buttons.append(el('p', 'final-note', lines.shop?.final ?? ''));
    foot.append(compatPanel(state, ctx), buttons);

    let locking = false;
    async function lockIn() {
      if (locking) return;
      locking = true;
      // (Short power was already confirmed in the shop, the last place it can be fixed.)
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

// One summary line: label, what you picked, and its price lined up on the right.
function row(label, value, price = '', extra = '') {
  const r = el('div', `v-row ${extra}`);
  r.append(el('span', 'v-row-label', label), el('span', null, value), el('span', 'v-row-price', price));
  return r;
}

// One part row: tier color mark, name, pick, price, then a dotted line toward the rocket.
function partRow(label, value, price, tier) {
  const r = el('div', `v-part tier-${tier}`);
  r.append(el('span', 'v-row-label', label), el('span', null, value), el('span', 'v-row-price', price),
    el('span', 'v-leader'));
  return r;
}

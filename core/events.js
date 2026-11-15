// core/events.js (owner: Person 3)
// The one place that changes budget, day, morale and hidden reliability, and
// the engine that picks and plays events. Every slice calls applyEffects() so
// the rules stay the same everywhere (Rulebook sections 4, 5 and 7.3, Slice 3
// brief section 6).

import * as ui from './ui.js';
import { clamp, addFlag, removeFlag, hasFlag, random, pick, checkEnd } from './state.js';

// Used in the "why" text of a greyed-out choice, e.g. 'Needs a logistics manager.'
const ROLE_NAMES = {
  engineer: 'an engineer',
  inspector: 'an inspector',
  meteorologist: 'a meteorologist',
  logistics: 'a logistics manager',
  pr: 'a PR lead',
};

const PROGRESS_KEYS = ['build', 'testing', 'training'];
const PROGRESS_LABELS = { build: 'Build', testing: 'Testing', training: 'Training' };

// One decimal for things the player sees, so 0.1 + 0.2 never shows as 0.30000000000000004.
const round1 = (n) => Math.round(n * 10) / 10;
// Reliability moves in steps of 0.01, so it needs finer rounding.
const round4 = (n) => Math.round(n * 10000) / 10000;
const asList = (v) => (Array.isArray(v) ? v : [v]);
const signed = (n) => (n > 0 ? `+${n}` : `${n}`);

// ---------- Effects

// Lowest skill goes first: losing your weakest person stings without ending the run.
function lowestSkill(staff, role) {
  const pool = role === 'any' ? staff : staff.filter((s) => s.role === role);
  return pool.reduce((low, s) => (low === null || s.skill < low.skill ? s : low), null);
}

/**
 * Applies an effects object (Rulebook 7.3) to the state.
 * Returns what really changed, e.g. [{ key: 'budget', delta: -20 }], so the
 * caller can show toasts. A delta is the real change after clamping, so
 * morale 95 with +10 reports +5.
 */
export function applyEffects(state, effects) {
  const changes = [];
  if (!effects) return changes;

  for (const [key, value] of Object.entries(effects)) {
    switch (key) {
      case 'budget':
      case 'day': {
        // Budget may go below 0 here. checkEnd() decides what that means.
        state[key] = round1(state[key] + value);
        changes.push({ key, delta: value });
        break;
      }
      case 'morale': {
        const before = state.morale;
        state.morale = round1(clamp(before + value, 0, 100));
        changes.push({ key, delta: round1(state.morale - before) });
        break;
      }
      case 'reliability': {
        state.rel.events = round4(state.rel.events + value);
        changes.push({ key, delta: value });
        break;
      }
      case 'progress': {
        for (const part of PROGRESS_KEYS) {
          if (value[part] === undefined) continue;
          const before = state.progress[part];
          state.progress[part] = round1(clamp(before + value[part], 0, 100));
          changes.push({ key: `progress.${part}`, delta: round1(state.progress[part] - before) });
        }
        break;
      }
      case 'flags': {
        for (const flag of value) {
          if (hasFlag(state, flag)) continue; // no duplicates
          addFlag(state, flag);
          changes.push({ key: 'flag', flag, delta: 1 });
        }
        break;
      }
      case 'removeFlags': {
        for (const flag of value) {
          if (!hasFlag(state, flag)) continue;
          removeFlag(state, flag);
          changes.push({ key: 'flag', flag, delta: -1 });
        }
        break;
      }
      case 'loseStaff': {
        const person = lowestSkill(state.staff, value);
        if (!person) break; // nobody with that role, so nothing happens
        state.staff = state.staff.filter((s) => s !== person);
        changes.push({ key: 'loseStaff', delta: -1, id: person.id, name: person.name });
        break;
      }
      default:
        // A typo in a JSON file should be loud in the console, not silently ignored.
        console.warn(`applyEffects: unknown effect key "${key}"`);
    }
  }

  ui.refresh();
  return changes;
}

/**
 * Turns the list from applyEffects into short lines for toasts and summaries,
 * e.g. ['-$20M', '+2 days']. Reliability and flags are left out on purpose:
 * the Rulebook keeps them hidden from the player.
 */
export function describeChanges(changes) {
  const lines = [];
  for (const c of changes) {
    if (c.delta === 0) continue;
    if (c.key === 'budget') lines.push(`${c.delta > 0 ? '+' : '-'}$${Math.abs(c.delta)}M`);
    else if (c.key === 'day') lines.push(`${signed(c.delta)} ${Math.abs(c.delta) === 1 ? 'day' : 'days'}`);
    else if (c.key === 'morale') lines.push(`Morale ${signed(c.delta)}`);
    else if (c.key.startsWith('progress.')) lines.push(`${PROGRESS_LABELS[c.key.slice(9)]} ${signed(c.delta)}`);
    else if (c.key === 'loseStaff') lines.push(`${c.name} left the team`);
  }
  return lines;
}

// ---------- Requirements

/**
 * Why a requirement fails, as a short line for the player, or '' if it passes.
 * req is a staff role string like 'engineer', or an object with any of
 * role, flag, notFlag, minBudget, site. Every part must pass.
 */
export function requirementWhy(state, req) {
  if (!req) return '';
  const r = typeof req === 'string' ? { role: req } : req;

  if (r.role && !state.staff.some((s) => s.role === r.role)) {
    return `Needs ${ROLE_NAMES[r.role] || `a ${r.role}`}.`;
  }
  if (r.flag && !hasFlag(state, r.flag)) return 'Not possible right now.';
  if (r.notFlag && hasFlag(state, r.notFlag)) return 'Too late for that now.';
  if (r.minBudget !== undefined && state.budget < r.minBudget) return `Needs $${r.minBudget}M.`;
  if (r.site && !asList(r.site).includes(state.site)) return 'Not at this launch site.';
  return '';
}

/** True when the requirement passes. For the reason it fails, use requirementWhy(). */
export function meetsRequirement(state, req) {
  return requirementWhy(state, req) === '';
}

// ---------- Loading events

const EVENT_SLICES = ['trail', 'build', 'launchweek'];
let allEvents = null;

/**
 * Loads events.json from the trail, build and launchweek slices. A missing,
 * empty or broken file is skipped, so nobody is blocked by another slice.
 * Call it once (with await) before pickEvent. Later calls reuse the result.
 */
export async function loadAllEvents() {
  if (allEvents) return allEvents;
  const lists = await Promise.all(EVENT_SLICES.map(async (slice) => {
    try {
      const res = await fetch(new URL(`../slices/${slice}/events.json`, import.meta.url));
      if (!res.ok) return [];
      const text = await res.text();
      return text.trim() ? JSON.parse(text) : [];
    } catch (err) {
      console.warn(`Could not read slices/${slice}/events.json. Skipping it.`, err);
      return [];
    }
  }));
  allEvents = lists.flat();
  return allEvents;
}

// ---------- Picking an event

// How many capsule parts were bought at the cheapest tier (for budgetTiersAtLeast).
// The parts list follows Amendment A3: a flight computer, and no abort system.
function budgetTierCount(state) {
  const p = state.parts || {};
  return [p.shell, p.lifeSupport, p.comms, p.computer, p.power?.tier].filter((t) => t === 'budget').length;
}

// Does a `when` block (Rulebook 7.3) hold right now? An empty block always does.
function whenMatches(state, when, week) {
  if (!when) return true;
  if (when.minWeek !== undefined && week < when.minWeek) return false;
  if (when.maxWeek !== undefined && week > when.maxWeek) return false;
  if (when.flagsAny && !when.flagsAny.some((f) => hasFlag(state, f))) return false;
  if (when.flagsNone && when.flagsNone.some((f) => hasFlag(state, f))) return false;
  if (when.siteIn && !when.siteIn.includes(state.site)) return false;
  if (when.rocketIn && !when.rocketIn.includes(state.rocket)) return false;
  if (when.staffHas && !asList(when.staffHas).some((role) => state.staff.some((s) => s.role === role))) return false;
  if (when.moraleBelow !== undefined && !(state.morale < when.moraleBelow)) return false;
  if (when.budgetBelow !== undefined && !(state.budget < when.budgetBelow)) return false;
  if (when.budgetTiersAtLeast !== undefined && budgetTierCount(state) < when.budgetTiersAtLeast) return false;
  // The three build gauges. The numbers used in events.json match the levels at
  // which the dashboard turns a gauge yellow, so an event never comes out of nowhere.
  const d = state.derived || {};
  if (when.commsIn && !when.commsIn.includes(d.comms)) return false;
  if (when.massMarginBelow !== undefined && !(d.massMargin < when.massMarginBelow)) return false;
  // powerLoadAbove is a share of the battery: 0.9 means "using more than 90% of the supply".
  if (when.powerLoadAbove !== undefined && !(d.powerSupply > 0 && d.powerUse > when.powerLoadAbove * d.powerSupply)) return false;
  return true;
}

/**
 * Chooses this week's event, or null if nothing fits.
 * Order: week 1 is always first_shipment, then any overdue guaranteed event,
 * then a weighted random pick. Events already in state.events never repeat.
 */
export function pickEvent(state, week) {
  if (!allEvents) {
    console.warn('pickEvent: call "await loadAllEvents()" first.');
    return null;
  }
  const candidates = allEvents.filter((e) =>
    !state.events.includes(e.id)
    && (!e.weeks || (week >= e.weeks[0] && week <= e.weeks[1]))
    && whenMatches(state, e.when, week));
  if (candidates.length === 0) return null;

  if (week === 1) {
    const first = candidates.find((e) => e.id === 'first_shipment');
    if (first) return first;
  }

  // A guaranteed event is a story beat the player must not miss, so once its
  // deadline week arrives it jumps the queue. Earliest deadline goes first.
  const overdue = candidates
    .filter((e) => e.guarantee && week >= e.guarantee.byWeek)
    .sort((a, b) => a.guarantee.byWeek - b.guarantee.byWeek);
  if (overdue.length > 0) return overdue[0];

  const weights = candidates.map((e) => {
    let w = e.weight ?? 1;
    for (const b of e.boost || []) if (whenMatches(state, b.when, week)) w *= b.mult;
    return w;
  });
  let ticket = random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) {
    ticket -= weights[i];
    if (ticket < 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

// ---------- Playing an event

// Who delivers the event. Rosa steps in when the written speaker was not hired,
// which is why event text is written in a neutral voice.
function resolveSpeaker(state, speaker) {
  if (speaker === 'crew' && state.crew.length) return { id: pick(state.crew).id, own: true };
  if (speaker === 'crew_jittery' && state.crew.length) {
    const jittery = state.crew.reduce((low, c) => (c.nerves < low.nerves ? c : low));
    return { id: jittery.id, own: true };
  }
  const present = speaker === 'rosa'
    || state.staff.some((s) => s.id === speaker)
    || state.crew.some((c) => c.id === speaker);
  return present ? { id: speaker, own: true } : { id: 'rosa', own: false };
}

// One chance roll across a choice's outcomes. The p values add up to 1.
function rollOutcome(outcomes) {
  let ticket = random();
  for (const o of outcomes) {
    ticket -= o.p;
    if (ticket < 0) return o;
  }
  return outcomes[outcomes.length - 1];
}

// Which sound fits what just happened. Losing reliability, morale or a person
// is bad news even when the player cannot see the number.
function resultSound(changes) {
  const hurt = changes.some((c) => c.key === 'loseStaff' || ((c.key === 'reliability' || c.key === 'morale') && c.delta < 0));
  if (hurt) return 'trail-bad';
  if (changes.some((c) => c.key === 'budget' && c.delta > 0)) return 'trail-cash';
  return 'trail-good';
}

// A small tag with what the choice changed, sitting on the top-right corner of the
// dialogue box, so the player reads the result line and its cost together.
// It lives inside the box, so it goes away when the box does.
function pinChanges(box, lines) {
  if (!box) return ui.toast(lines.join('   '), 2000); // no box to pin to: fall back to a toast
  const tag = document.createElement('div');
  tag.className = 'change-tag';
  tag.textContent = lines.join('   ');
  Object.assign(tag.style, {
    position: 'absolute', top: '-22px', right: '24px',
    padding: '8px 16px', whiteSpace: 'nowrap',
    background: 'var(--bg)', color: 'var(--accent)', border: '4px solid var(--frame-edge)',
  });
  box.append(tag);
  // Gone after 2 seconds, even if the player is still reading the line.
  setTimeout(() => tag.remove(), 2000);
}

/**
 * Plays one event: scene, dialogue, choice, effects, result line, toast.
 * Returns { choice, changes, ended }. `ended` is checkEnd(state): if it is not
 * null (for example 'bankrupt'), the caller should call done('finale').
 */
export async function runEvent(state, event) {
  const root = ui.screen(event.scene || 'trail/mission_floor');
  root.classList.add('trail-event'); // lets trail.css move the title box off the dashboard
  if (event.title) root.append(ui.panel(event.title));
  ui.sfx('trail-event');

  const speaker = resolveSpeaker(state, event.speaker);
  // The flavor line is in the written speaker's own voice, so Rosa never says it for them.
  // For 'crew' events it is a map of astronaut id to line, since any of them may speak.
  const flavor = typeof event.flavor === 'object' ? event.flavor?.[speaker.id] : event.flavor;
  if (flavor && speaker.own) await ui.say(speaker.id, flavor);

  const choices = event.choices.map((c) => {
    const why = requirementWhy(state, c.requires);
    return { label: c.label, disabled: why !== '', why };
  });
  const index = await ui.ask(speaker.id, event.text, choices);
  const choice = event.choices[index];

  const picked = choice.outcomes ? rollOutcome(choice.outcomes) : choice;
  const changes = applyEffects(state, picked.effects);
  ui.sfx(resultSound(changes));
  const lines = describeChanges(changes);
  if (picked.result) {
    // ui.say builds its dialogue box straight away, so the change tag can be pinned to it
    // and stays up exactly as long as the result line does.
    const saying = ui.say(speaker.id, picked.result);
    const boxes = document.querySelectorAll('#game .dialogue');
    if (lines.length) pinChanges(boxes[boxes.length - 1], lines);
    await saying;
  } else if (lines.length) {
    ui.toast(lines.join('   '), 2000);
  }

  state.events.push(event.id);
  return { choice: index, changes, ended: checkEnd(state) };
}

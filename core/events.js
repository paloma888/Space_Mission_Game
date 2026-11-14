// core/events.js (owner: Person 3)
// The one place that changes budget, day, morale and hidden reliability.
// Every slice calls applyEffects() so the rules stay the same everywhere
// (Rulebook sections 4, 5 and 7.3, Slice 3 brief section 6).
//
// pickEvent, runEvent and loadAllEvents come next. They need random() and
// ui.say / ui.ask from Person 1, which are not written yet.

// Namespace import on purpose: while core/ui.js is still empty, a named
// import of refresh would stop this whole file from loading.
import * as ui from './ui.js';

// Used in the "why" text of a greyed-out choice, e.g. 'Needs a logistics manager.'
const ROLE_NAMES = {
  engineer: 'an engineer',
  inspector: 'an inspector',
  meteorologist: 'a meteorologist',
  logistics: 'a logistics manager',
  pr: 'a PR lead',
};

const PROGRESS_KEYS = ['build', 'testing', 'training'];

// One decimal for things the player sees, so 0.1 + 0.2 never shows as 0.30000000000000004.
const round1 = (n) => Math.round(n * 10) / 10;
// Reliability moves in steps of 0.01, so it needs finer rounding.
const round4 = (n) => Math.round(n * 10000) / 10000;
const clamp0to100 = (n) => Math.min(100, Math.max(0, n));

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
        state.morale = round1(clamp0to100(before + value));
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
          state.progress[part] = round1(clamp0to100(before + value[part]));
          changes.push({ key: `progress.${part}`, delta: round1(state.progress[part] - before) });
        }
        break;
      }
      case 'flags': {
        for (const flag of value) {
          if (state.flags.includes(flag)) continue; // no duplicates
          state.flags.push(flag);
          changes.push({ key: 'flag', flag, delta: 1 });
        }
        break;
      }
      case 'removeFlags': {
        for (const flag of value) {
          if (!state.flags.includes(flag)) continue;
          state.flags = state.flags.filter((f) => f !== flag);
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

  // Optional call: ui.refresh does not exist until Person 1's core/ui.js lands.
  ui.refresh?.();
  return changes;
}

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
  if (r.flag && !state.flags.includes(r.flag)) return 'Not possible right now.';
  if (r.notFlag && state.flags.includes(r.notFlag)) return 'Too late for that now.';
  if (r.minBudget !== undefined && state.budget < r.minBudget) return `Needs $${r.minBudget}M.`;
  if (r.site) {
    const sites = Array.isArray(r.site) ? r.site : [r.site];
    if (!sites.includes(state.site)) return 'Not at this launch site.';
  }
  return '';
}

/** True when the requirement passes. For the reason it fails, use requirementWhy(). */
export function meetsRequirement(state, req) {
  return requirementWhy(state, req) === '';
}

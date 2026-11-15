// The weekly math for the trail (Slice 3 brief sections 4 and 5).
// No screen code in here, so the numbers are easy to check on their own.
// Every number comes from tasks.json, so tuning never touches this file.

import { clamp } from '../../core/state.js';
import { applyEffects } from '../../core/events.js';

export const TASK_IDS = ['build', 'testing', 'training', 'fundraise', 'rest'];
export const PROGRESS_IDS = ['build', 'testing', 'training'];

const round1 = (n) => Math.round(n * 10) / 10;

// How well a role fits a task: 1.0 for the best fit, less for everyone else.
function multiplier(task, role) {
  if (task.best?.includes(role)) return task.bestMult ?? 1;
  if (task.altMult?.[role] !== undefined) return task.altMult[role];
  return task.otherMult ?? 1;
}

/**
 * Works out what this week would produce without changing anything, so the
 * assignment screen can show a live preview. `assignments` maps a staff id to
 * a task id, e.g. { hal: 'build' }. People with no task yet are skipped.
 */
export function planWeek(state, assignments, tasks) {
  // A happy team works faster: 0.8 at morale 0, 1.2 at morale 100.
  const moraleFactor = 0.8 + 0.4 * (state.morale / 100);
  const plan = {
    build: tasks.build.baseline,
    testing: tasks.testing.baseline,
    training: tasks.training.baseline,
    funds: 0,
    rest: 0,
    tested: false,
  };

  for (const person of state.staff) {
    const taskId = assignments[person.id];
    const task = tasks[taskId];
    if (!task) continue;
    if (taskId === 'rest') {
      plan.rest += task.perPerson;
    } else if (taskId === 'fundraise') {
      plan.funds += task.base + task.perSkill * person.skill * multiplier(task, person.role);
    } else {
      plan[taskId] += (6 + 4 * person.skill) * multiplier(task, person.role) * moraleFactor;
      if (taskId === 'testing') plan.tested = true;
    }
  }

  plan.rest = Math.min(plan.rest, tasks.rest.weekCap);
  for (const key of [...PROGRESS_IDS, 'funds']) plan[key] = round1(plan[key]);
  return plan;
}

/** What budget and morale will be after this plan, for the preview. */
export function projectWeek(state, plan, tasks) {
  return {
    budget: round1(state.budget + plan.funds - tasks.weekly.overhead),
    morale: round1(clamp(clamp(state.morale + plan.rest, 0, 100) + tasks.weekly.moraleDrift, 0, 100)),
  };
}

/**
 * Applies a plan to the state in the order the brief lists.
 * Returns { changes, skippedTesting } so the screen can show what happened.
 */
export function resolveWeek(state, plan, tasks) {
  const changes = [
    ...applyEffects(state, { progress: { build: plan.build, testing: plan.testing, training: plan.training } }),
    ...applyEffects(state, { budget: plan.funds }),
    // Rest first, then the long-hours drift, so resting can never push past 100 and hide the drift.
    ...applyEffects(state, { morale: plan.rest }),
    ...applyEffects(state, { morale: tasks.weekly.moraleDrift }),
    ...applyEffects(state, { budget: -tasks.weekly.overhead }),
  ];

  if (!plan.tested) {
    state.skippedTestingWeeks += 1;
    if (state.skippedTestingWeeks >= 2) applyEffects(state, { flags: ['skipped_testing'] });
  }
  // Rulebook 6.3: testing helps reliability, every skipped week chips a little away.
  const rel = state.progress.testing / 100 * 0.10 - 0.01 * state.skippedTestingWeeks;
  state.rel.testing = Math.round(clamp(rel, -0.05, 0.10) * 10000) / 10000;

  return { changes, skippedTesting: !plan.tested };
}

/** Adds up repeated keys (e.g. fundraising and overhead both change budget) into one net change each. */
export function sumChanges(changes) {
  const totals = new Map();
  const others = [];
  for (const c of changes) {
    if (c.key === 'flag' || c.key === 'loseStaff') others.push(c);
    else totals.set(c.key, round1((totals.get(c.key) ?? 0) + c.delta));
  }
  return [...[...totals].map(([key, delta]) => ({ key, delta })), ...others];
}

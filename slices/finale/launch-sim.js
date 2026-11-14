// slices/finale/launch-sim.js: launch dice, score and report helpers. Owner: Person 5.
// Every function here is "pure": it reads state but never changes it and never touches the page.
// That lets balance.html run thousands of launches, and lets the animation replay exactly
// the result that was rolled, so the pictures and the numbers always agree.

import { launchProbability, clamp, random } from '../../core/state.js';

export const STAGES = ['liftoff', 'maxq', 'separation', 'orbit'];

// ---------- Crew saves (Rulebook 6.5)

export function saveChance(state) {
  const crew = state.crew ?? [];
  if (!crew.length) return 0.05; // a bare test state with no crew: assume the worst
  const bestEng = Math.max(...crew.map((c) => c.eng));
  const avgNerves = crew.reduce((sum, c) => sum + c.nerves, 0) / crew.length;
  const training = state.progress?.training ?? 0;
  return clamp(0.35 + 0.12 * bestEng + 0.05 * avgNerves + 0.10 * (training / 100), 0.05, 0.95);
}

// A power shortage is harder to fix than one broken part (Rulebook 6.5).
export function emergencySaveChance(state, type) {
  const base = saveChance(state);
  return type === 'power' ? Math.max(0.05, base - 0.25) : base;
}

// ---------- The launch (Slice 5 brief section 4)

export function resolveLaunch(state, rng = random) {
  const flags = state.flags ?? [];
  const derived = state.derived ?? {};
  const weather = state.launchWeather ?? {};
  const pStage = Math.pow(launchProbability(state), 1 / 4);
  const failOutcome = state.parts?.abort ? 'abort' : 'lost';
  const result = {
    stages: [], emergencies: [], outcome: null, failedStage: null, cause: null,
    flagsToAdd: [], scienceFlew: false,
  };

  for (const id of STAGES) {
    let passed;
    let cause = null;

    // Lightning can only strike at liftoff, and only in a real storm.
    if (id === 'liftoff' && weather.kind === 'storm' && (weather.risk ?? 0) >= 50) {
      const strikeChance = 0.30 * (flags.includes('lightning_ready') ? 0.5 : 1);
      if (rng() < strikeChance) {
        const saved = rng() < emergencySaveChance(state, 'lightning');
        result.flagsToAdd.push('lightning_strike');
        result.emergencies.push({ type: 'lightning', stage: 'liftoff', saved });
        if (!saved) { passed = false; cause = 'lightning'; }
      }
    }
    if (passed === undefined) passed = rng() < pStage;
    result.stages.push({ id, p: pStage, passed });

    if (!passed) {
      result.outcome = failOutcome;
      result.failedStage = id;
      result.cause = cause;
      return result;
    }

    // Secret ending: the warp coil only "works" on the very last day of the window.
    if (id === 'liftoff' && flags.includes('warp_coil') && state.launchDay === state.windowCloses) {
      result.outcome = 'aliens';
      for (const rest of STAGES.slice(1)) result.stages.push({ id: rest, p: pStage, passed: null, skipped: true });
      return result;
    }
  }

  // All four stages passed. Now the capsule has to survive orbit.
  // An unsaved emergency here is 'lost' even with an abort system: the escape tower is gone by now.
  const checks = [
    ['life_support', () => rng() < (derived.emergencyChance ?? 0)],
    ['solar', () => state.parts?.power?.type === 'solar' && rng() < (derived.solarFailChance ?? 0)],
    ['power', () => !(derived.powerOk ?? true)],
  ];
  for (const [type, happens] of checks) {
    if (!happens()) continue;
    const saved = rng() < emergencySaveChance(state, type);
    result.emergencies.push({ type, stage: 'orbit', saved });
    if (!saved) {
      result.outcome = 'lost';
      result.failedStage = 'orbit';
      result.cause = type;
      return result;
    }
  }

  result.outcome = 'orbit';
  result.scienceFlew = !!derived.scienceOk && !result.emergencies.some((e) => e.type === 'power');
  return result;
}

// An empty result for endings that never launched (bankrupt, window_closed).
export function noLaunch(outcome) {
  return { stages: [], emergencies: [], outcome, failedStage: null, cause: null, flagsToAdd: [], scienceFlew: false };
}

// ---------- Score, medals and badges (Rulebook 6.8)

const MEDALS = [
  { id: 'gold', min: 90 },
  { id: 'silver', min: 75 },
  { id: 'bronze', min: 60 },
];

export function medalFor(total, outcome) {
  if (outcome !== 'orbit' && outcome !== 'aliens') return null;
  return MEDALS.find((m) => total >= m.min)?.id ?? null;
}

// Labels and hints live in badges.json. The rules live here so they can be tested.
const BADGE_RULES = {
  measure_twice: (s) => (s.skippedTestingWeeks ?? 0) === 0,
  weather_wise: (s) => (s.scrubs ?? 0) === 0,
  under_budget: (s) => s.budget >= 150,
  team_player: (s) => !(s.flags ?? []).includes('overruled_nogo'),
  safety_first: (s) => !!s.parts?.abort,
};

export function computeScore(state, result = {}) {
  const outcome = result.outcome ?? state.outcome;
  const emergencies = result.emergencies ?? state.emergencies ?? [];
  const survived = emergencies.filter((e) => e.saved).length;
  const reached = outcome === 'orbit' || outcome === 'aliens';

  const lines = [
    { id: 'crew', label: 'Crew safety', max: 30, points: outcome === 'lost' ? 0 : Math.max(0, 30 - 10 * survived) },
    { id: 'orbit', label: 'Reached orbit', max: 30, points: reached ? 30 : 0 },
    { id: 'budget', label: 'Budget left', max: 15, points: 15 * Math.min(1, Math.max(0, state.budget) / 200) },
    {
      id: 'days', label: 'Days to spare', max: 10,
      points: state.launchDay == null ? 0 : 10 * clamp((state.windowCloses - state.launchDay) / 6, 0, 1),
    },
    { id: 'morale', label: 'Morale', max: 10, points: (10 * clamp(state.morale, 0, 100)) / 100 },
    { id: 'science', label: 'Science', max: 5, points: result.scienceFlew ? 5 : 0 },
  ];
  // Round away tiny floating-point noise so 75 never shows up as 74.9999999.
  const total = Math.round(lines.reduce((sum, l) => sum + l.points, 0) * 1e6) / 1e6;
  const medal = medalFor(total, outcome);
  let medalReason = null;
  if (!medal) medalReason = reached ? 'You reached orbit, but scored under 60.' : 'Medals are only for reaching orbit.';

  const badges = Object.entries(BADGE_RULES).map(([id, rule]) => ({ id, earned: rule(state) }));
  return { lines, total, medal, medalReason, badges };
}

// ---------- "What shaped your odds" (Slice 5 brief section 8). Words, never numbers.

export function oddsWords(state) {
  const rel = state.rel ?? {};
  const rocket = state.derived?.rocketReliability ?? 0.95;
  const pick = (value, steps) => steps.find(([min]) => value >= min).slice(1);
  const rows = [
    ['parts', 'Your parts', pick(rel.parts ?? 0, [[0.06, 'Helped a lot', 'good'], [0.03, 'Helped', 'good'], [0, 'Helped a little', 'neutral'], [-Infinity, 'Hurt', 'bad']])],
    ['testing', 'Your testing', pick(rel.testing ?? 0, [[0.06, 'Helped a lot', 'good'], [0.02, 'Helped', 'good'], [0, 'Barely helped', 'neutral'], [-Infinity, 'Hurt', 'bad']])],
    ['events', 'Choices on the trail', pick(rel.events ?? 0, [[0.02, 'Helped', 'good'], [-0.0095, 'Neutral', 'neutral'], [-0.0395, 'Hurt', 'bad'], [-Infinity, 'Hurt a lot', 'bad']])],
    ['rocket', 'Your rocket', pick(rocket, [[0.97, 'Proven', 'good'], [0.93, 'Good', 'neutral'], [-Infinity, 'Risky', 'bad']])],
    ['weather', 'The weather', pick(-(state.weatherPenalty ?? 0), [[-0.0499, 'No problem', 'good'], [-0.1499, 'Hurt a little', 'bad'], [-Infinity, 'Hurt a lot', 'bad']])],
    ['crew', 'Listening to the crew', (state.overrulePenalty ?? 0) > 0 ? ['You overruled them, and it hurt', 'bad'] : ['You listened', 'good']],
  ];
  return rows.map(([id, label, [words, tone]]) => ({ id, label, words, tone }));
}

// ---------- Choosing the history card (Slice 5 brief section 9)

export function cardMatches(card, state, result = {}) {
  const w = card.when ?? {};
  const outcome = result.outcome ?? state.outcome;
  const flags = new Set([...(state.flags ?? []), ...(result.flagsToAdd ?? [])]);
  if (w.outcome && !w.outcome.includes(outcome)) return false;
  if (w.flagsAny && !w.flagsAny.some((f) => flags.has(f))) return false;
  if (w.stage && w.stage !== result.failedStage) return false;
  if (w.emergency && !(result.emergencies ?? []).some((e) => e.saved && e.type !== 'lightning')) return false;
  return true;
}

export function pickHistoryCard(cards, state, result = {}) {
  let best = null;
  for (const card of cards) {
    // Strictly greater, so in a tie the first card loaded wins.
    if (cardMatches(card, state, result) && (!best || (card.when?.priority ?? 0) > (best.when?.priority ?? 0))) best = card;
  }
  if (best) return best;
  const outcome = result.outcome ?? state.outcome;
  if (outcome === 'abort' || outcome === 'lost') return cards.find((c) => c.id === 'generic_failure') ?? null;
  return null;
}

// The brain of the operation: slices/finale/launch-sim.js: launch dice, score and report helpers. 
// Owner: Person 5, aka La Mera Cabra, Erick 🐐
// Every function here is "pure": it reads state but never changes it and never touches the page.
// That lets balance.html run thousands of launches, and lets the animation replay exactly
// the result that was rolled, so the pictures and the numbers always agree.

// Borrow three tools that Person 1 _____ (Insert name) wrote in core/state.js. Nothing runs here: we get the
// functions themselves and call them later, for example launchProbability(state).
import { launchProbability, clamp, random } from '../../core/state.js';

//   launchProbability: turns every choice in slices 1 to 4 into one odds number (Rulebook 6.4)
//   clamp: keeps a number inside a range, e.g. never above 0.95
//   random: the seedable die. Returns a number from 0 up to 1


// a list of the four launch stages, in order. Used by resolveLaunch() and the animation.
export const STAGES = ['liftoff', 'maxq', 'separation', 'orbit']; 
// ---------- Crew saves (Rulebook 6.5)


/**
 * Job: works out how likely the crew is to fix a problem.
 * @param {Object} state - the shared backpack. Reads state.crew (eng and nerves) and state.progress.training.
 * @returns {number} - a chance from 0.05 to 0.95 (5% to 95%).
 */
export function saveChance(state) {
  const crew = state.crew ?? [];
  if (!crew.length) return 0.05; // a bare test state with no crew: assume the worst
  const bestEng = Math.max(...crew.map((c) => c.eng));                         // the crew's best engineer (1 to 5)
  const avgNerves = crew.reduce((sum, c) => sum + c.nerves, 0) / crew.length; // how calm they are on average
  const training = state.progress?.training ?? 0;                             // 0 to 100, from the trail (Slice 3)
  // Better engineers, calmer nerves and more training mean a better chance to fix a problem.
  // clamp keeps it between 5% (always some hope) and 95% (never a sure thing).
  return clamp(0.35 + 0.12 * bestEng + 0.05 * avgNerves + 0.10 * (training / 100), 0.05, 0.95);
}

/**
 * Job: the fix chance for one specific emergency.
 * A power shortage is harder to fix than one broken part (Rulebook 6.5), so it gets 0.25 less.
 * @param {Object} state - the shared backpack (passed on to saveChance).
 * @param {string} type - which emergency: 'life_support', 'solar', 'power' or 'lightning'.
 * @returns {number} - a chance from 0.05 to 0.95.
 */
export function emergencySaveChance(state, type) {
  const base = saveChance(state);
  return type === 'power' ? Math.max(0.05, base - 0.25) : base;
}

// ---------- The launch (Slice 5 brief section 4)

/**
 * @param {Object} state - the shared "backpack" filled by slices 1 to 4. We only read it, never change it.
 * @param {Function} rng - the die to roll. Normally random(); the tests pass a rigged die to force an ending.
 * @returns {Object} - the result of the launch simulation:
 *   stages      - list of { id, p, passed } for each stage rolled, e.g. { id: 'liftoff', p: 0.96, passed: true }
 *   emergencies - list of { type, stage, saved }, e.g. { type: 'power', stage: 'orbit', saved: false }
 *   outcome     - 'orbit', 'launch_failure', 'came_home_early' (or 'aliens', paused)
 *   failedStage - which stage went wrong ('liftoff' ... 'orbit'), or null
 *   cause       - why: 'lightning', 'life_support', 'solar', 'power', or null for a plain failed roll
 *   flagsToAdd  - flags finale.js adds to the state afterwards, e.g. ['lightning_strike']
 * ⭐
 */

export function resolveLaunch(state, rng = random) { 
  const flags = state.flags ?? [];          // story flags, e.g. 'warp_coil' ( ?? [] means "or empty if missing")
  const derived = state.derived ?? {};      // numbers Slice 2 worked out from the build
  const weather = state.launchWeather ?? {}; // launch-day weather Slice 4 picked

  // THE ODDS. launchProbability is the whole launch (for example 0.874 = 87%). All four stages
  // must pass, so each one gets the 4th root (0.967). Then 0.967 x 0.967 x 0.967 x 0.967 = 0.874 again.
  const pStage = Math.pow(launchProbability(state), 1 / 4);

  // The crew is always safe in this game (Amendment A2). A failed launch is a failed mission, nothing worse.

  // The answer we fill in and hand back. finale.js copies it into the state afterwards.
  const result = {
    //stages: each stage and whether it passed
    //emergencies: each emergency and whether the crew fixed it
    // outcome: 'orbit', 'launch_failure', 'came_home_early' (or 'aliens', currently paused)
    stages: [], emergencies: [], outcome: null, failedStage: null, cause: null, flagsToAdd: [],
  };

  // Go through 'liftoff', 'maxq', 'separation', 'orbit' in order.
  for (const id of STAGES) {
    let passed;        // stays undefined until something decides this stage
    let cause = null;  // why it failed, if it did (only lightning sets one here)

    // Lightning can only strike at liftoff, and only in a real storm.
    if (id === 'liftoff' && weather.kind === 'storm' && (weather.risk ?? 0) >= 50) {
      const strikeChance = 0.30 * (flags.includes('lightning_ready') ? 0.5 : 1); // 30%, or 15% if the team prepared
      if (rng() < strikeChance) {                                              // roll: did lightning hit?
        const saved = rng() < emergencySaveChance(state, 'lightning');         // roll: did the crew recover?
        result.flagsToAdd.push('lightning_strike');
        result.emergencies.push({ type: 'lightning', stage: 'liftoff', saved });
        if (!saved) { passed = false; cause = 'lightning'; }
      }
    }
    // THE DICE ROLL. Roll 0 to 1. Under the odds means the stage passes.
    // (Skipped if lightning already made it fail.)
    if (passed === undefined) passed = rng() < pStage;
    result.stages.push({ id, p: pStage, passed }); // write it down so the animation can replay it

    // WHAT A FAILURE MEANS. A failed stage ends the launch right here. The crew is safe.
    if (!passed) {
      result.outcome = 'launch_failure';
      result.failedStage = id;
      result.cause = cause;
      return result;
    }

    // Secret ending: the warp coil only "works" on the very last day of the window.
    // Paused for Mission 1 (Amendment A6): the coil isn't sold, so this never triggers. Kept for later.
    if (id === 'liftoff' && flags.includes('warp_coil') && state.launchDay === state.windowCloses) {
      result.outcome = 'aliens';
      for (const rest of STAGES.slice(1)) result.stages.push({ id: rest, p: pStage, passed: null, skipped: true });
      return result;
    }
  }

  // All four stages passed: we're in space! Now things can still break up there.
  // Fixed emergency: the mission goes on, but it costs points. Not fixed: the crew comes home early.
  const checks = [
    ['life_support', () => rng() < (derived.emergencyChance ?? 0)],
    // Solar is gone in Mission 1 (Amendment A3), so solarFailChance is 0. Kept for Mission 2.
    ['solar', () => state.parts?.power?.type === 'solar' && rng() < (derived.solarFailChance ?? 0)],
    ['power', () => !(derived.powerOk ?? true)],
  ];
  for (const [type, happens] of checks) {
    if (!happens()) continue;                                // no emergency of this kind: check the next one
    const saved = rng() < emergencySaveChance(state, type);  // roll: can the crew fix it?
    result.emergencies.push({ type, stage: 'orbit', saved });
    if (!saved) {
      result.outcome = 'came_home_early'; // reached space, couldn't finish the mission
      result.failedStage = 'orbit';
      result.cause = type;
      return result;
    }
  }

  // Made it through every roll. Success!
  result.outcome = 'orbit';
  return result;
}

/**
 * Job: an empty result for endings that never launched, so the report needs no special cases.
 * @param {string} outcome - 'bankrupt' or 'window_closed'.
 * @returns {Object} - same shape as resolveLaunch's result, with no stages or emergencies.
 */
export function noLaunch(outcome) {
  return { stages: [], emergencies: [], outcome, failedStage: null, cause: null, flagsToAdd: [] };
}

// Endings where the mission didn't get done. They get the "every launch has risk" history card.
export const FAILED_OUTCOMES = ['launch_failure', 'came_home_early'];

// ---------- Score, medals and badges (Rulebook 6.8)

const MEDALS = [
  { id: 'gold', min: 90 },
  { id: 'silver', min: 75 },
  { id: 'bronze', min: 60 },
];

/**
 * Job: picks the medal. Only a finished mission (orbit) can earn one.
 * @param {number} total - the score out of 100.
 * @param {string} outcome - how the game ended.
 * @returns {string|null} - 'gold' (90+), 'silver' (75+), 'bronze' (60+), or null for no medal.
 */
export function medalFor(total, outcome) {
  if (outcome !== 'orbit' && outcome !== 'aliens') return null;
  return MEDALS.find((m) => total >= m.min)?.id ?? null;
}

// Labels and hints live in badges.json. The rules live here so they can be tested: 
  // Badge  ⬇️          Earned when⬇️
  // Measure Twice -> testing was never skipped
  // Weather Wise -> no scrubs (no postponed launch days)
  // Under Budget -> $150M or more left
  // Team Player -> never launched through a No-Go
  // Honest Parts -> no shady parts bought

const BADGE_RULES = {
  measure_twice: (s) => (s.skippedTestingWeeks ?? 0) === 0,
  weather_wise: (s) => (s.scrubs ?? 0) === 0,
  under_budget: (s) => s.budget >= 150,
  team_player: (s) => !(s.flags ?? []).includes('overruled_nogo'),
  honest_parts: (s) => !(s.flags ?? []).includes('shady_part'), // Amendment A5: the shady dealer
};

/**
 * Job: the mission score out of 100, plus the medal and badges.
 * Changed from Rulebook 6.8 by Amendments A2 and A3 (written up as A11):
 *   "Crew safety" became "Smooth flight", and the 5 science points moved to Morale.
 * @param {Object} state - the shared backpack. Reads budget, launchDay, windowCloses, morale, flags.
 * @param {Object} result - what resolveLaunch (or noLaunch) returned. Reads outcome and emergencies.
 * @returns {Object}:
 *   lines       - 5 score rows { id, label, max, points }, e.g. { label: 'Morale', max: 15, points: 10.2 }
 *   total       - all points added up, out of 100
 *   medal       - 'gold', 'silver', 'bronze' or null
 *   medalReason - a short sentence explaining why there's no medal (null if there is one)
 *   badges      - 5 rows { id, earned }, e.g. { id: 'honest_parts', earned: true }
 * ⭐
 */
export function computeScore(state, result = {}) {
  const outcome = result.outcome ?? state.outcome;
  const emergencies = result.emergencies ?? state.emergencies ?? [];
  const fixed = emergencies.filter((e) => e.saved).length;
  const finished = outcome === 'orbit' || outcome === 'aliens';

  // Smooth flight: full marks for a clean flight, 10 off for each problem the crew fixed,
  // nothing if the mission didn't get done.
  const smooth = finished ? Math.max(0, 30 - 10 * fixed) : 0;
  // Reached orbit: half marks for getting to space but coming home early.
  const orbit = finished ? 30 : outcome === 'came_home_early' ? 15 : 0;

  const lines = [
    { id: 'smooth', label: 'Smooth flight', max: 30, points: smooth },
    { id: 'orbit', label: 'Reached orbit', max: 30, points: orbit },
    { id: 'budget', label: 'Budget left', max: 15, points: 15 * Math.min(1, Math.max(0, state.budget) / 200) },
    {
      id: 'days', label: 'Days to spare', max: 10,
      points: state.launchDay == null ? 0 : 10 * clamp((state.windowCloses - state.launchDay) / 6, 0, 1),
    },
    { id: 'morale', label: 'Morale', max: 15, points: (15 * clamp(state.morale, 0, 100)) / 100 },
  ];
  // Round away tiny floating-point noise so 75 never shows up as 74.9999999.
  const total = Math.round(lines.reduce((sum, l) => sum + l.points, 0) * 1e6) / 1e6;
  const medal = medalFor(total, outcome);
  let medalReason = null;
  if (!medal) {
    if (finished) medalReason = 'You reached orbit, but scored under 60.';
    else if (outcome === 'came_home_early') medalReason = 'The crew had to come home before the mission was done.';
    else medalReason = 'Medals are only for finishing the mission.';
  }

  const badges = Object.entries(BADGE_RULES).map(([id, rule]) => ({ id, earned: rule(state) }));
  return { lines, total, medal, medalReason, badges };
}

// ---------- "What shaped your odds" (Slice 5 brief section 8). Words, never numbers (user doesn't see #'s).

/**
 * Job: the "What shaped your odds" panel, turning six hidden numbers into plain words.
 * @param {Object} state - the shared backpack. Reads rel.parts, rel.testing, rel.events,
 *   derived.rocketReliability, weatherPenalty and overrulePenalty.
 * @returns {Array} - 6 rows { id, label, words, tone },
 *   e.g. { label: 'Your testing', words: 'Helped a lot', tone: 'good' }. tone picks the color.
 */
export function oddsWords(state) {
  const rel = state.rel ?? {};
  const rocket = state.derived?.rocketReliability ?? 0.95;
  // pick: walks down a list of [lowest value, words, tone] steps and returns the first one the value reaches.
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

/**
 * Job: checks whether one history card fits what happened.
 * Every condition in the card's `when` must hold:
 *   outcome   - the ending is in its list
 *   flagsAny  - at least one of its flags happened (for example cold_launch)
 *   stage     - it failed at that stage
 *   emergency - a problem was fixed in space (that's the Apollo 13 card)
 * @param {Object} card - one history card from a history.json file.
 * @param {Object} state - the shared backpack (for its flags).
 * @param {Object} result - what resolveLaunch returned.
 * @returns {boolean} - true if the card fits.
 */
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


/**
 * Job: chooses THE history card for the report: the matching card with the highest priority.
 * If nothing matches after a failed mission, it falls back to the "every launch has risk" card.
 * @param {Array} cards - every card from the trail, launchweek and finale history.json files.
 * @param {Object} state - the shared backpack.
 * @param {Object} result - what resolveLaunch returned.
 * @returns {Object|null} - one card, or null when there's no card to show.
 */
export function pickHistoryCard(cards, state, result = {}) {
  let best = null;
  for (const card of cards) {
    // Strictly greater, so in a tie the first card loaded wins.
    if (cardMatches(card, state, result) && (!best || (card.when?.priority ?? 0) > (best.when?.priority ?? 0))) best = card;
  }
  if (best) return best;
  const outcome = result.outcome ?? state.outcome;
  if (FAILED_OUTCOMES.includes(outcome)) return cards.find((c) => c.id === 'generic_failure') ?? null;
  return null;
}

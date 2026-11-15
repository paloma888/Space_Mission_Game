// core/state.js: the game's memory and the shared rules. Owner: Person 1.
// Follows RULEBOOK sections 4 (core API), 5 (game state), 6 (cross-slice rules) and 12 (presets).
// Every slice imports what it needs from here instead of writing its own copy.

// ---------- Small helpers

export function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

// Deep copy using the browser's built-in cloner (state holds only plain data).
const copy = (obj) => structuredClone(obj);

// ---------- Seedable random numbers
// Everyone uses random(), never Math.random, so ?seed=123 in the URL replays the same game.
// This is "mulberry32", a tiny, well-known pseudo-random generator: same seed, same numbers.

const urlSeed = Number(new URLSearchParams(location.search).get('seed'));
let seed = (urlSeed || Date.now()) >>> 0;

export function random() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296; // a number from 0 up to (not including) 1
}

export function roll(p) {
  return random() < p; // true with probability p, e.g. roll(0.3) is true about 30% of the time
}

export function pick(list) {
  return list[Math.floor(random() * list.length)];
}

// ---------- A fresh game (RULEBOOK section 5)

export function createState() {
  return {
    // time and money
    budget: 800, day: 1, week: 1, windowOpens: 36, windowCloses: 42,
    // people (briefing)
    crew: [], staff: [],
    // build (build)
    parts: {}, rocket: null, site: null, orbit: 'leo',
    derived: {
      capsuleMass: 0, liftCapacity: 0, massMargin: 0,
      powerSupply: 0, powerUse: 0, comms: 'none', rocketReliability: 0.95,
      powerOk: true, emergencyChance: 0, solarFailChance: 0, scienceOk: false, spent: 0,
    },
    // trail (trail)
    progress: { build: 0, testing: 0, training: 0 },
    skippedTestingWeeks: 0,
    // gauges
    morale: 70,
    rel: { base: 0.80, parts: 0, testing: 0, events: 0 }, // hidden: read it with getReliability()
    // launch week (launchweek)
    weather: null, launchDay: null, scrubs: 0,
    weatherPenalty: 0, overrulePenalty: 0, launchWeather: null,
    // story memory
    flags: [], events: [],
    // results (finale)
    outcome: null, stages: [], emergencies: [], score: null,
    // plumbing (Person 1)
    checkpoints: {}, resume: null,
    // Person 1 only: typed in the briefing, read by Person 5 for the mission patch.
    agencyName: 'Pioneer Space Agency',
  };
}

// ---------- Flags (RULEBOOK section 6.7 lists every allowed flag)

export function addFlag(state, f) {
  if (!state.flags.includes(f)) state.flags.push(f);
}
export function hasFlag(state, f) {
  return state.flags.includes(f);
}
export function removeFlag(state, f) {
  state.flags = state.flags.filter((x) => x !== f);
}

// ---------- Reliability and launch odds (RULEBOOK sections 6.3 and 6.4)

export function getReliability(state) {
  const r = state.rel;
  return clamp(r.base + r.parts + r.testing + r.events, 0.5, 0.98);
}

export function launchProbability(state) {
  return clamp(
    getReliability(state)
      * state.derived.rocketReliability
      * (1 - state.weatherPenalty)
      * (1 - state.overrulePenalty),
    0.05, 0.99);
}

// ---------- Checkpoints for Try Again (RULEBOOK sections 3 and 5)

export function saveCheckpoint(state, name) {
  // Save everything except older checkpoints, so copies don't nest inside each other.
  state.checkpoints[name] = copy({ ...state, checkpoints: {} });
}

export function loadCheckpoint(state, name) {
  const snap = state.checkpoints[name];
  if (!snap) return false;
  // Restore "in place": slices hold a reference to this same object, so we
  // empty it and refill it instead of making a new one.
  const keep = { checkpoints: state.checkpoints, resume: state.resume };
  for (const key of Object.keys(state)) delete state[key];
  Object.assign(state, copy(snap), keep);
  return true;
}

// ---------- Game-over checks the framework runs after every done() (RULEBOOK sections 3, 6.1, 6.2)

export function checkEnd(state) {
  if (state.outcome) return null;          // an ending is already decided
  if (state.launchDay != null) return null; // launch confirmed: the launch fee may take budget to 0 (team: confirm)
  if (state.budget <= 0) return 'bankrupt';
  if (state.day > state.windowCloses) return 'window_closed';
  return null;
}

// ---------- Test states (RULEBOOK section 12)
// Copies of the people from slices/briefing/candidates.json and staff.json.
// Keep these in sync if those stats change.

const PEOPLE = {
  amara: { id: 'amara', name: 'Amara Okonkwo', pilot: 4, eng: 2, nerves: 3, cost: 55, portrait: 'amara' },
  jun:   { id: 'jun',   name: 'Jun Takahashi', pilot: 2, eng: 4, nerves: 3, cost: 50, portrait: 'jun' },
  lucia: { id: 'lucia', name: 'Lucía Herrera', pilot: 3, eng: 2, nerves: 4, cost: 45, portrait: 'lucia' },
  hal:   { id: 'hal',  name: 'Hal Brennan', role: 'engineer', title: 'Chief Engineer', skill: 5, cost: 40, portrait: 'hal' },
  inez:  { id: 'inez', name: 'Inez Moreau', role: 'inspector', title: 'Quality Inspector', skill: 4, cost: 25, portrait: 'inez' },
  skye:  { id: 'skye', name: 'Skye Patel', role: 'meteorologist', title: 'Meteorologist', skill: 4, cost: 25, portrait: 'skye' },
};

function afterHiring() {
  const s = createState();
  s.crew = [PEOPLE.amara, PEOPLE.jun, PEOPLE.lucia].map(copy);
  s.staff = [PEOPLE.hal, PEOPLE.inez, PEOPLE.skye].map(copy);
  s.budget = 560; // 800 - (55 + 50 + 45) - (40 + 25 + 25)
  saveCheckpoint(s, 'afterHiring');
  return s;
}

function afterBuild() {
  const s = afterHiring();
  // Standard build from Amendment A7 (parts list from A3: no abort, no science, computer required).
  s.parts = {
    shell: 'standard', lifeSupport: 'standard',
    power: { type: 'battery', tier: 'standard' },
    comms: 'standard', computer: 'standard',
  };
  s.rocket = 'condor';
  s.site = 'canaveral';
  s.orbit = 'leo';
  s.budget = 190;
  s.rel.parts = 0.07;
  // Hard-coded so this file never has to fetch. A7 says to call Person 2's recompute() here once it merges.
  // scienceOk and solarFailChance stay false and 0 in Mission 1 (Amendment A4).
  Object.assign(s.derived, {
    capsuleMass: 7.3, liftCapacity: 12, massMargin: 4.7,
    powerSupply: 600, powerUse: 320, comms: 'standard', rocketReliability: 0.97,
    powerOk: true, emergencyChance: 0.08, solarFailChance: 0, scienceOk: false, spent: 370,
  });
  saveCheckpoint(s, 'afterBuild');
  return s;
}

function readyToLaunch() {
  const s = afterBuild();
  Object.assign(s, { day: 36, week: 5, budget: 85, morale: 68 });
  s.progress = { build: 100, testing: 70, training: 50 };
  s.rel.parts = 0.05;
  s.rel.testing = 0.07;
  return s;
}

function launched() {
  const s = readyToLaunch();
  Object.assign(s, { day: 37, launchDay: 37, budget: 45, weatherPenalty: 0.05 });
  s.launchWeather = { risk: 10, tempF: 75, kind: 'clear' };
  return s;
}

const PRESETS = {
  fresh: createState,
  afterHiring,
  afterBuild,
  midTrail() {
    const s = afterBuild();
    Object.assign(s, { week: 3, day: 15, budget: 115, morale: 66 });
    s.progress = { build: 60, testing: 30, training: 20 };
    s.rel.testing = clamp((30 / 100) * 0.10, -0.05, 0.10);
    return s;
  },
  readyToLaunch,
  readyToLaunchRisky() {
    const s = readyToLaunch();
    Object.assign(s, { day: 41, budget: 20, morale: 40, skippedTestingWeeks: 2 });
    s.progress = { build: 100, testing: 10, training: 0 };
    s.rel.testing = clamp((10 / 100) * 0.10 - 0.01 * 2, -0.05, 0.10);
    addFlag(s, 'skipped_testing');
    addFlag(s, 'reused_software');
    return s;
  },
  launched,
  launchedCold() {
    const s = launched();
    s.site = 'kodiak';
    s.launchWeather = { risk: 40, tempF: 28, kind: 'cold' };
    s.weatherPenalty = 0.225; // a freezing launch costs far more than launched's clear-sky 0.05
    s.overrulePenalty = 0.06;
    addFlag(s, 'cold_launch');
    addFlag(s, 'overruled_engineering');
    return s;
  },
  secret() {
    const s = launched();
    Object.assign(s, { day: 42, launchDay: 42 });
    s.parts.warpCoil = true;
    addFlag(s, 'warp_coil');
    return s;
  },
};

export const PRESET_NAMES = Object.keys(PRESETS);

export function fakeState(preset = 'fresh') {
  const make = PRESETS[preset];
  if (!make) {
    console.warn(`Unknown preset "${preset}". Using "fresh". Presets: ${PRESET_NAMES.join(', ')}`);
    return createState();
  }
  return make();
}
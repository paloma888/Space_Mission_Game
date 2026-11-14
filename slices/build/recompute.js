// slices/build/recompute.js: the build math (Slice 2 brief section 5, amendments A3 and A4).
// No DOM, no fetch, no randomness: give it a state and the catalog, it fills in
// state.derived and state.rel.parts. Fast enough to call after every click.
// Most code should use recompute(state) from build.js, which passes the catalog for you.

const round1 = (n) => Math.round(n * 10) / 10;
const round4 = (n) => Math.round(n * 10000) / 10000; // reliability moves in 0.01 steps

const POLAR_LIFT = 0.85; // a polar orbit costs 15% of lift

// Every installed part as its catalog entry. Unknown keys (old abort, science or
// warpCoil fields from before the amendments) are skipped instead of crashing (A9).
export function installedParts(parts, catalog) {
  const p = parts ?? {};
  return [
    catalog.parts.shell?.[p.shell],
    catalog.parts.lifeSupport?.[p.lifeSupport],
    p.power && catalog.parts.power?.[p.power.type]?.[p.power.tier],
    catalog.parts.comms?.[p.comms],
    catalog.parts.computer?.[p.computer],
  ].filter(Boolean);
}

export const findRocket = (catalog, id) => catalog.rockets.find((r) => r.id === id) ?? null;
export const findSite = (catalog, id) => catalog.sites.find((s) => s.id === id) ?? null;

// Lift for any rocket/site/orbit combo, so the rocket and site cards can show
// "what if" numbers without changing state.
export function liftFor(rocket, site, orbit) {
  if (!rocket || !site) return 0;
  return round1(rocket.lift * (1 + site.liftBonus) * (orbit === 'polar' ? POLAR_LIFT : 1));
}

export function recompute(state, catalog) {
  const p = state.parts ?? {};
  const list = installedParts(p, catalog);
  const rocket = findRocket(catalog, state.rocket);
  const site = findSite(catalog, state.site);
  const power = p.power && catalog.parts.power?.[p.power.type]?.[p.power.tier];
  const comms = catalog.parts.comms?.[p.comms];

  const d = state.derived;
  d.capsuleMass = round1(list.reduce((sum, part) => sum + part.mass, 0));
  d.liftCapacity = liftFor(rocket, site, state.orbit);
  d.massMargin = round1(d.liftCapacity - d.capsuleMass);
  // Only life support, comms and the computer use power. The battery supplies it.
  d.powerUse = list.reduce((sum, part) => sum + (part.power ?? 0), 0);
  d.powerSupply = power?.supply ?? 0;
  d.powerOk = d.powerSupply >= d.powerUse;
  // A shady radio reports as the tier it pretends to be. The catch stays hidden.
  d.comms = comms ? (comms.looksLike ?? p.comms) : 'none';
  d.rocketReliability = rocket ? rocket.reliability : 0.95;
  d.emergencyChance = catalog.parts.lifeSupport?.[p.lifeSupport]?.emergencyChance ?? 0;
  d.solarFailChance = 0; // battery only in Mission 1 (A4)
  d.scienceOk = false;   // no science in Mission 1 (A4)
  d.spent = list.reduce((sum, part) => sum + part.cost, 0) + (rocket?.cost ?? 0);

  state.rel.parts = round4(list.reduce((sum, part) => sum + part.rel, 0));
  return state;
}

// Why a site cannot take this rocket or orbit, or null if it can. Used to grey out cards.
export function siteProblem(site, rocketId, orbit) {
  if (!site) return null;
  if (rocketId && site.notRockets.includes(rocketId)) {
    const name = rocketId === 'pelican' ? 'Pelican' : 'That rocket';
    return `${name} is too big for ${site.name.split(',')[0]}.`;
  }
  if (orbit && !site.orbits.includes(orbit)) return 'This site cannot reach polar orbit.';
  return null;
}

// Every reason Lock In is blocked (brief section 11). Empty list means the build is legal.
// Call recompute first so derived is fresh.
export function lockInProblems(state, catalog) {
  const p = state.parts ?? {};
  const problems = [];
  if (!p.shell || !p.lifeSupport || !p.power?.tier || !p.comms || !p.computer) {
    problems.push('Pick a shell, life support, power, comms and a flight computer.');
  }
  if (!state.rocket) problems.push('Pick a rocket.');
  if (!state.site) problems.push('Pick a launch site.');
  if (!state.orbit) problems.push('Pick an orbit.');
  const why = siteProblem(findSite(catalog, state.site), state.rocket, state.orbit);
  if (why) problems.push(why);
  if (state.rocket && state.site && state.derived.massMargin < 0) {
    problems.push(`Too heavy by ${Math.abs(state.derived.massMargin).toFixed(1)} t.`);
  }
  if (state.budget < 0) problems.push('Not enough budget.');
  return problems;
}

// True if any shady part is installed. Lock In sets the shady_part flag from this (A5).
export const hasShadyPart = (state, catalog) =>
  installedParts(state.parts, catalog).some((part) => part.shady);

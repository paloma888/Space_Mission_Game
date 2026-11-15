// slices/build/checks.js: the Slice 2 test cases (brief section 16, updated for the amendments).
// Pure math, no screens. checks.html shows the results. Run them before every merge.

import { recompute, lockInProblems, siteProblem, findSite, hasShadyPart } from './recompute.js';

const tier = (t) => ({ shell: t, lifeSupport: t, power: { type: 'battery', tier: t }, comms: t, computer: t });

// A bare-bones state with only what the build math reads.
function build(parts, rocket = null, site = null, orbit = 'leo') {
  return { parts, rocket, site, orbit, budget: 560, derived: {}, rel: { parts: 0 } };
}

export function runChecks(catalog) {
  const results = [];
  const check = (name, actual, expected) =>
    results.push({ name, actual, expected, pass: Object.is(actual, expected) });
  const run = (...args) => recompute(build(...args), catalog);

  // 1. Standard everything on Condor at Canaveral, low orbit.
  let s = run(tier('standard'), 'condor', 'canaveral');
  check('1. Standard: mass', s.derived.capsuleMass, 7.3);
  check('1. Standard: margin', s.derived.massMargin, 2.7);
  check('1. Standard: power use', s.derived.powerUse, 320);
  check('1. Standard: power supply', s.derived.powerSupply, 600);
  check('1. Standard: reliability bonus', s.rel.parts, 0.07);
  check('1. Standard: spent', s.derived.spent, 370);
  check('1. Standard: comms', s.derived.comms, 'standard');
  check('1. Standard: legal', lockInProblems(s, catalog).length, 0);

  // 2. Cheapest capsule. With the retuned rockets it is the only build Sparrow can carry.
  s = run(tier('budget'));
  check('2. Cheapest: mass', s.derived.capsuleMass, 5.8);
  check('2. Cheapest: parts cost', s.derived.spent, 125);
  s = run(tier('budget'), 'sparrow', 'canaveral');
  check('2. Cheapest on Sparrow: margin', s.derived.massMargin, 0.7);
  check('2. Cheapest on Sparrow: legal', lockInProblems(s, catalog).length, 0);
  s = run(tier('standard'), 'sparrow', 'canaveral');
  check('2. Standard on Sparrow: margin', s.derived.massMargin, -0.8);
  check('2. Standard on Sparrow: blocked', lockInProblems(s, catalog).includes('Too heavy by 0.8 t.'), true);
  s = run(tier('standard'), 'sparrow', 'kourou');
  check('2. Sparrow at Kourou: lift', s.derived.liftCapacity, 7.2);
  check('2. Standard on Sparrow at Kourou: still too heavy', s.derived.massMargin < 0, true);

  // 3. Premium everything.
  s = run(tier('premium'), 'condor', 'canaveral');
  check('3. Premium: mass', s.derived.capsuleMass, 9.4);
  check('3. Premium on Condor: margin', s.derived.massMargin, 0.6);
  check('3. Premium: power', `${s.derived.powerUse}/${s.derived.powerSupply}`, '420/800');
  s = run(tier('premium'), 'condor', 'kodiak', 'polar');
  check('3. Premium polar at Kodiak: lift', s.derived.liftCapacity, 8.5);
  check('3. Premium polar at Kodiak: margin', s.derived.massMargin, -0.9);
  check('3. Premium polar at Kodiak: blocked', lockInProblems(s, catalog).includes('Too heavy by 0.9 t.'), true);
  s = run(tier('premium'), 'pelican', 'kodiak', 'polar');
  check('3. Premium polar at Kodiak on Pelican: lift', s.derived.liftCapacity, 11.9);
  check('3. Premium polar at Kodiak on Pelican: legal', lockInProblems(s, catalog).length, 0);

  // 4. Too much power for a budget battery.
  s = run({ ...tier('premium'), power: { type: 'battery', tier: 'budget' } });
  check('4. Over power: use', s.derived.powerUse, 420);
  check('4. Over power: supply', s.derived.powerSupply, 400);
  check('4. Over power: powerOk', s.derived.powerOk, false);

  // 6. Site rules.
  check('6. Pelican at Mahia is blocked', siteProblem(findSite(catalog, 'mahia'), 'pelican', 'leo'), 'Pelican is too big for Mahia.');
  check('6. Polar at Canaveral is blocked', siteProblem(findSite(catalog, 'canaveral'), 'condor', 'polar'), 'This site cannot reach polar orbit.');
  check('6. Polar at Kourou is blocked', siteProblem(findSite(catalog, 'kourou'), 'condor', 'polar'), 'This site cannot reach polar orbit.');
  check('6. Condor at Mahia polar is fine', siteProblem(findSite(catalog, 'mahia'), 'condor', 'polar'), null);

  // 7. Lift bonuses.
  check('7. Condor at Kourou: lift', run(tier('standard'), 'condor', 'kourou').derived.liftCapacity, 11);
  check('7. Condor polar at Kodiak: lift', run(tier('standard'), 'condor', 'kodiak', 'polar').derived.liftCapacity, 8.5);
  check('7. Condor at Sriharikota: lift', run(tier('standard'), 'condor', 'sriharikota').derived.liftCapacity, 10.5);

  // Dealer parts (amendment A5): same stats as the tier they copy, half the price,
  // hidden reliability penalty. Standard everything adds up to 0.07 before the swap.
  s = run({ ...tier('standard'), power: { type: 'battery', tier: 'shady_standard' } });
  check('Dealer battery: same supply as Standard', s.derived.powerSupply, 600);
  check('Dealer battery: same mass', s.derived.capsuleMass, 7.3);
  check('Dealer battery: reliability bonus', s.rel.parts, 0.01); // 0.07 - 0.06
  check('Dealer battery: half price (35 -> 18)', s.derived.spent, 203);
  s = run({ ...tier('standard'), comms: 'shady_standard' });
  check('Dealer radio: reports as Standard', s.derived.comms, 'standard');
  check('Dealer radio: reliability bonus', s.rel.parts, 0.02); // 0.07 - 0.05
  s = run({ ...tier('standard'), computer: 'shady_standard' });
  check('Dealer computer: reliability bonus', s.rel.parts, -0.02); // 0.07 - 0.09
  check('Dealer computer: half price (30 -> 15)', s.derived.spent, 205);
  s = run({ ...tier('budget'), power: { type: 'battery', tier: 'shady_budget' } });
  check('Dealer budget battery: supply', s.derived.powerSupply, 400);
  check('Dealer budget battery: half price (20 -> 10)', s.derived.spent, 115);
  check('Dealer premium radio: reports as Premium',
    run({ ...tier('premium'), comms: 'shady_premium' }).derived.comms, 'premium');

  // The dealer's mysterious component: +0.2 t, +$10M, hidden -0.03.
  s = run({ ...tier('standard'), warpCoil: true }, 'condor', 'canaveral');
  check('Mysterious component: mass', s.derived.capsuleMass, 7.5);
  check('Mysterious component: spent', s.derived.spent, 380);
  check('Mysterious component: reliability bonus', s.rel.parts, 0.04);
  check('Mysterious component: counts as a shady part', hasShadyPart(s, catalog), true);
  check('Mysterious component off: not shady', hasShadyPart(run(tier('standard')), catalog), false);

  // Half-empty and old-style states must not crash (amendment A9).
  s = run({});
  check('Empty build: mass', s.derived.capsuleMass, 0);
  check('Empty build: comms', s.derived.comms, 'none');
  s = run({ ...tier('standard'), abort: 'standard', science: 'plant', warpCoil: false });
  check('Old abort/science keys are ignored', s.derived.capsuleMass, 7.3);

  return results;
}

// Slice 4: Weather & Go/No-Go (owner: Person 4)
// What this slice does (RULEBOOK section 3): Forecast, pick a day, Go/No-Go poll, launch or hold. Ends with a launch decision.

import { random, roll, pick, clamp, hasFlag, launchProbability } from '../../core/state.js';
import { applyEffects } from '../../core/events.js';
import * as ui from '../../core/ui.js';
import { CATALOG } from '../build/catalog.js'; // Person 2's site list: fee and name per site

export const meta = { id: 'launchweek', owner: 'Person 4' };

const WAIT_COST = 10;     // $M per day waited (brief section 6)
const FORECAST_DAYS = 5;  // day cards shown at once
const SCRUB_RISK = 70;    // real risk at or above this scrubs the launch (brief section 7)
const SCRUB_COST = 15;    // $M (RULEBOOK 6.2)
const HOLD_COST = 10;     // $M (RULEBOOK 6.2)
const CRUNCH = { cost: 10, build: 15, morale: -3 }; // one Crunch Day (brief section 4)
const RAISE = { base: 8, pr: 14 };                  // $M from one day of fundraising (brief section 8)
const OVERRULE = { station: 0.06, crew: 0.02, crewMorale: -3 }; // brief section 8
const CREW_LIMIT_ADJUST = { amara: 1, priya: -1 };              // overconfident / nervous (brief section 8)
const VOTE_TEXT = { go: 'GO', nogo: 'NO-GO', unknown: 'UNKNOWN' };

// Small element helper (core/ui.js keeps its own private).
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Adds this slice's stylesheet once, so it works from index.html and test.html.
function loadStyles() {
  if (document.getElementById('lw-styles')) return;
  const link = el('link');
  link.id = 'lw-styles';
  link.rel = 'stylesheet';
  link.href = new URL('./launchweek.css', import.meta.url).href;
  document.head.append(link);
}

// Loads a JSON file from this folder. import.meta.url keeps the path right from index.html and test.html.
async function loadJson(name) {
  const res = await fetch(new URL(`./${name}`, import.meta.url));
  return res.json();
}

// Random line at a path in gonogo.json, e.g. ['hal', 'nogo', 'cold'], or the fallback if it's missing.
function lineAt(lines, path, fallback) {
  const list = path.reduce((node, key) => node?.[key], lines);
  return Array.isArray(list) && list.length ? pick(list) : fallback;
}

// Random number between lo and hi.
const between = ([lo, hi]) => lo + random() * (hi - lo);

// Picks one key from a { key: weight } object, e.g. { clear: 0.3, rain: 0.7 }.
function pickWeighted(weights) {
  let r = random() * Object.values(weights).reduce((a, b) => a + b, 0);
  for (const [key, w] of Object.entries(weights)) if ((r -= w) < 0) return key;
  return Object.keys(weights)[0];
}

// Bell-curve random number around mean (Box-Muller), so most values land near the mean.
export function gauss(mean, sd) {
  return mean + sd * Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

// Builds the true weather for every launch-window day in the RULEBOOK 6.6 format.
export function generateWeather(state, profiles) {
  const site = profiles.sites[state.site] ?? profiles.sites.canaveral;
  const weather = {};
  for (let day = state.windowOpens; day <= state.windowCloses; day++) {
    const tempF = Math.round(gauss(site.tempMean, site.tempSpread));
    let kind = pickWeighted(site.kinds);
    if (tempF <= 32 && roll(profiles.coldChance)) kind = 'cold';
    const range = profiles.kinds[kind];
    const risk = Math.round(clamp(between(range.risk) + between([-5, 5]), 0, 100));
    weather[day] = { risk, tempF, kind, wind: Math.round(between(range.wind)) };
  }
  return weather;
}

// The hired staff member with this role and the highest skill, or null if nobody has it.
function bestStaff(state, role) {
  return state.staff
    .filter((s) => s.role === role)
    .reduce((best, s) => (!best || s.skill > best.skill ? s : best), null);
}

// What the forecast says: the true risk blurred by noise that shrinks with skill and as the day gets closer.
// z is a fixed bell-curve number per day, so the same screen always shows the same forecast.
export function forecastRisk(actual, z, skill, daysAhead) {
  const base = skill > 0 ? Math.max(4, 24 - 4 * skill) : 24;
  const sigma = base * (0.5 + 0.25 * daysAhead);
  return clamp(actual + z * sigma, 0, 100);
}

// Card text for a forecast risk: an exact-ish number with a meteorologist, a rough band without.
function riskLabel(risk, skilled) {
  if (skilled) return `Trouble ${Math.round(risk / 5) * 5}%`;
  return risk < 30 ? 'Low' : risk < 60 ? 'Medium' : 'High';
}

// Pixel icon for a weather kind (art/icons/weather_<kind>.png). If the file is missing, shows the word instead.
function weatherIcon(kind) {
  const img = el('img', 'lw-icon');
  img.alt = kind;
  img.src = new URL(`../../art/icons/weather_${kind}.png`, import.meta.url).href;
  img.onerror = () => img.replaceWith(el('span', 'lw-icon-text', kind));
  return img;
}

// Shows the five-day forecast and resolves with the day the player picks.
function forecastScreen(state, site, noise, lines) {
  return new Promise((resolve) => {
    const root = ui.screen(`launchweek/site_${state.site}`);
    const met = bestStaff(state, 'meteorologist');
    const skill = met?.skill ?? 0;

    const talk = ui.panel();
    talk.classList.add('lw-talk');
    const speaker = met?.id ?? 'rosa';
    const line = lineAt(lines, [speaker, state.day > state.windowOpens ? 'sharper' : 'forecast'], "Here's the forecast.");
    talk.append(ui.portrait(speaker, 64), el('p', null, line));

    const days = el('div', 'lw-days');
    const go = ui.button('Pick a day', () => resolve(picked));
    go.disabled = true;
    let picked = null;

    const last = Math.min(state.day + FORECAST_DAYS - 1, state.windowCloses);
    for (let day = state.day; day <= last; day++) {
      const wait = day - state.day;
      const shown = forecastRisk(state.weather[day].risk, noise[day], skill, wait);
      const card = ui.button([
        `Day ${day}`,
        met ? state.weather[day].kind : '?',
        riskLabel(shown, skill > 0),
        wait ? `Wait ${wait}d, $${wait * WAIT_COST}M` : 'Today',
      ].join('\n'), () => {
        days.querySelector('.lw-picked')?.classList.remove('lw-picked');
        card.classList.add('lw-picked');
        picked = day;
        go.textContent = wait ? `Launch on Day ${day} (-$${wait * WAIT_COST}M)` : `Launch on Day ${day}`;
        go.disabled = false;
      }, { variant: 'quiet' });
      card.classList.add('lw-day');
      // Icon box sits above the text box, both the full width of the column.
      // Without a meteorologist the real weather stays hidden, same as the old "?".
      const iconBox = el('div', 'lw-icon-box');
      iconBox.append(weatherIcon(met ? state.weather[day].kind : 'unknown'));
      const column = el('div', 'lw-col');
      column.append(iconBox, card);
      days.append(column);
    }

    const footer = el('div', 'lw-footer');
    footer.append(el('p', 'small', `Launch fee $${site.fee}M at ${site.name}`), go);
    root.append(talk, days, footer);
  });
}

export async function show(state, done) {
  loadStyles();
  ui.screen(`launchweek/site_${state.site}`); // draw something before the JSON loads, so the fade-in isn't blank
  // Launch week starts on windowOpens at the earliest (brief section 3).
  if (state.day < state.windowOpens) applyEffects(state, { day: state.windowOpens - state.day });
  if (state.day > state.windowCloses) return done('finale');

  const [profiles, lines] = await Promise.all([loadJson('weather-profiles.json'), loadJson('gonogo.json')]);
  if (!state.weather) state.weather = generateWeather(state, profiles);
  const site = CATALOG.sites.find((s) => s.id === state.site) ?? { name: state.site, fee: 0 }; // fee 0 if the catalog failed
  const noise = Object.fromEntries(Object.keys(state.weather).map((d) => [d, gauss(0, 1)]));
  const ended = () => state.day > state.windowCloses || state.budget <= 0; // checkEnd makes it window_closed or bankrupt
  ui.music('launchweek_tense');

  if (!(await crunchDays(state, lines))) return giveUp(state, lines, done);
  if (ended()) return endEarly(state, lines, done);

  let today = null;
  while (true) {
    let day;
    do {
      day = await forecastScreen(state, site, noise, lines);
    } while (!(await waitUntil(state, day)));
    if (ended()) return endEarly(state, lines, done);
    today = await launchMorning(state, lines);
    if (ended()) return endEarly(state, lines, done);
    if (!today) continue; // scrubbed
    const decision = await poll(state, today, lines, site);
    if (decision === 'launch') break;
    if (decision === 'giveup') return giveUp(state, lines, done);
    if (ended()) return endEarly(state, lines, done);
  }

  await launch(state, today, site, lines);
  done();
}

// Tells the player why the mission ended before handing over, so the screen never just goes quiet.
async function endEarly(state, lines, done) {
  const key = state.budget <= 0 ? 'outOfMoney' : 'windowClosed';
  await ui.say('rosa', lineAt(lines, ['rosa', key], 'The mission ends here. The crew is safe.'));
  done(); // checkEnd turns the day or budget into the outcome
}

// Hands the launch to the finale (brief section 9): site fee, launch day, weather snapshot, penalty and cold flag.
async function launch(state, today, site, lines) {
  const { risk, tempF, kind, penalty } = today;
  applyEffects(state, { budget: -site.fee, ...(tempF <= 32 && { flags: ['cold_launch'] }) });
  state.launchDay = state.day;
  state.launchWeather = { risk, tempF, kind };
  state.weatherPenalty = penalty;
  ui.sfx('launchweek-countdown');
  await ui.say('rosa', lineAt(lines, ['rosa', 'countdown'], 'Ten, nine, eight... The rest is up to the rocket.'));
}

// Runs Crunch Days until the capsule is fully built (brief section 4). Returns false if the player gives up.
async function crunchDays(state, lines) {
  if (state.progress.build >= 100) return true;
  ui.screen(`launchweek/site_${state.site}`);
  while (state.progress.build < 100 && state.day <= state.windowCloses) {
    const intro = lineAt(lines, ['rosa', 'crunch'], "The capsule isn't finished. We can't fly half a capsule.");
    const choice = await ui.ask('rosa', `${intro} Build: ${state.progress.build}%.`, [
      { label: `Crunch Day (-$${CRUNCH.cost}M, +1 day)`, disabled: state.budget < CRUNCH.cost, why: 'Not enough budget' },
      { label: 'Give up' },
    ]);
    if (choice === 1) return false;
    applyEffects(state, { day: 1, budget: -CRUNCH.cost, morale: CRUNCH.morale, progress: { build: CRUNCH.build } });
  }
  return true;
}

// Ends the mission early as bankrupt when the player gives up (brief section 8).
async function giveUp(state, lines, done) {
  await ui.say('rosa', lineAt(lines, ['rosa', 'giveUp'], "We stop here. Not every mission flies, and that's okay."));
  state.outcome = 'bankrupt';
  done('finale');
}

// Launch-odds penalty from the real risk and temperature (brief section 7), capped at 0.25.
export function weatherPenalty({ risk, tempF }, state) {
  let penalty = (risk / 100) * 0.25;
  if (tempF <= 32) penalty += hasFlag(state, 'heaters_installed') ? 0.075 : 0.15;
  return Math.round(Math.min(penalty, 0.25) * 1000) / 1000;
}

// Reveals today's real weather. Returns { risk, tempF, kind, penalty }, or null after paying for a scrub.
async function launchMorning(state, lines) {
  const w = state.weather[state.day];
  ui.screen(`launchweek/site_${state.site}`);
  if (w.kind === 'storm') ui.sfx('launchweek-thunder');
  const speaker = bestStaff(state, 'meteorologist')?.id ?? 'rosa';
  await ui.say(speaker, `Launch morning, day ${state.day}. ${w.kind}, ${w.tempF}°F. Trouble chance ${w.risk}%.`);

  if (w.risk >= SCRUB_RISK) {
    ui.sfx('launchweek-scrub');
    applyEffects(state, { day: 1, budget: -SCRUB_COST });
    state.scrubs += 1;
    const reason = lineAt(lines, ['rosa', 'scrub', w.kind], 'Bad weather.');
    await ui.say('rosa', `${reason} We scrub today. That costs $${SCRUB_COST}M and a day.`);
    return null;
  }
  return { risk: w.risk, tempF: w.tempF, kind: w.kind, penalty: weatherPenalty(w, state) };
}

// Pays $10M per day waited and moves the clock to `day`. Returns false if the player backs out of a bankrupting wait.
async function waitUntil(state, day) {
  const wait = Math.max(0, day - state.day); // the dev panel's Next Day can move today past the picked card
  if (!wait) return true;
  const cost = wait * WAIT_COST;
  if (state.budget - cost <= 0) {
    const choice = await ui.ask('rosa', `Waiting costs $${cost}M. That would empty our budget and end the mission.`,
      [{ label: 'Wait anyway' }, { label: 'Go back' }]);
    if (choice === 1) return false;
  }
  applyEffects(state, { day: wait, budget: -cost });
  return true;
}

// Works out all six Go/No-Go votes (brief section 8) without touching state, so it can be tested alone.
// Each vote is { station, label, speaker, vote: 'go' | 'nogo' | 'unknown', reasons: [codes] }.
export function evaluatePoll(state, weather) {
  const flag = (f) => hasFlag(state, f);
  const cold = weather.tempF <= 32;
  const odds = launchProbability({ ...state, weatherPenalty: weather.penalty });
  const stations = {
    engineering: ['engineer', [
      odds < 0.70 && 'low_odds',
      state.derived.massMargin < 0.5 && 'thin_margin',
      flag('reused_software') && 'reused_software',
      flag('hidden_defect') && 'hidden_defect',
      flag('software_bug_open') && 'software_bug',
      cold && !flag('heaters_installed') && 'cold',
    ]],
    weather: ['meteorologist', [
      weather.risk >= 45 && 'risk_high',
      cold && 'cold',
      weather.kind === 'storm' && weather.risk >= 35 && !flag('lightning_ready') && 'lightning',
    ]],
    quality: ['inspector', [
      state.progress.testing < 60 && 'untested',
      flag('skipped_testing') && 'skipped_testing',
      flag('hidden_defect') && 'hidden_defect',
      flag('software_bug_open') && 'bug_open',
    ]],
  };

  const votes = Object.entries(stations).map(([station, [role, checks]]) => {
    const label = station[0].toUpperCase() + station.slice(1);
    const person = bestStaff(state, role);
    if (!person) return { station, label, speaker: 'rosa', vote: 'unknown', reasons: [] };
    const reasons = checks.filter(Boolean);
    return { station, label, speaker: person.id, vote: reasons.length ? 'nogo' : 'go', reasons };
  });

  // Crew worry: one per station No-Go, plus one for low morale. Calmer nerves mean a higher limit.
  const stationNogos = votes.filter((v) => v.vote === 'nogo').length;
  const worry = stationNogos + (state.morale < 40 ? 1 : 0);
  for (const a of state.crew) {
    const limit = Math.max(1, (a.nerves >= 4 ? 3 : a.nerves === 3 ? 2 : 1) + (CREW_LIMIT_ADJUST[a.id] ?? 0));
    const nogo = worry >= limit;
    votes.push({ station: 'crew', label: a.name, speaker: a.id, vote: nogo ? 'nogo' : 'go',
      reasons: nogo ? [stationNogos ? 'nervous' : 'morale'] : [] });
  }
  return votes;
}

// The line a voter says for their vote, with a plain fallback so a missing line never breaks the poll.
function voteLine(lines, v) {
  if (v.vote === 'unknown') return lineAt(lines, ['rosa', 'unknown', v.station], `Nobody is checking ${v.station}. I can't say.`);
  if (v.vote === 'go') return lineAt(lines, [v.speaker, 'go'], 'Go.');
  return lineAt(lines, [v.speaker, 'nogo', v.reasons[0]], 'No-go. I have concerns.');
}

// Launching through No-Go votes adds overrule flags, a morale cost per crew No-Go, and overrulePenalty (capped at 0.25).
function applyOverrule(state, nogos) {
  const stations = nogos.filter((v) => v.station !== 'crew');
  const crew = nogos.length - stations.length;
  const added = OVERRULE.station * stations.length + OVERRULE.crew * crew;
  state.overrulePenalty = Math.round(Math.min(0.25, state.overrulePenalty + added) * 100) / 100;
  applyEffects(state, {
    flags: ['overruled_nogo', ...stations.map((v) => `overruled_${v.station}`)],
    morale: OVERRULE.crewMorale * crew,
  });
}

// Plays the poll in the control room. Resolves 'launch', 'again' (after a hold or raising money) or 'giveup'.
async function poll(state, today, lines, site) {
  const root = ui.screen('launchweek/control_room');
  const board = ui.panel('Go/No-Go');
  board.classList.add('lw-board');
  root.append(board);

  const votes = evaluatePoll(state, today);
  for (const v of votes) {
    if (v.vote !== 'unknown') ui.sfx(v.vote === 'go' ? 'launchweek-go' : 'launchweek-nogo');
    await ui.say(v.speaker, voteLine(lines, v));
    board.append(el('div', `lw-vote lw-${v.vote}`, `${v.label}: ${VOTE_TEXT[v.vote]}`));
  }

  const nogos = votes.filter((v) => v.vote === 'nogo');
  const summary = lineAt(lines, ['rosa', 'summary', nogos.length ? 'somenogo' : 'allgo'], "It's your call, Flight Director.");
  const short = state.budget < site.fee;
  const raise = bestStaff(state, 'pr') ? RAISE.pr : RAISE.base;
  const choices = [
    { label: nogos.length ? 'Launch anyway' : 'Launch', disabled: short, why: 'Not enough budget for the launch fee.' },
    { label: `Hold (-$${HOLD_COST}M, +1 day)`, disabled: state.budget < HOLD_COST, why: 'Not enough budget' },
    ...(short ? [{ label: `Raise money (+$${raise}M, +1 day)` }, { label: 'Give up' }] : []),
  ];

  while (true) {
    const choice = await ui.ask('rosa', summary, choices);
    if (choice === 1) {
      applyEffects(state, { day: 1, budget: -HOLD_COST, progress: { testing: 10 } });
      await ui.say('rosa', lineAt(lines, ['rosa', 'summary', 'hold'], 'We hold for one more day of checks.'));
      return 'again';
    }
    if (choice === 2) {
      // Raising money costs a day, so on the last day it closes the window. Confirm first.
      if (state.day >= state.windowCloses) {
        const warn = lineAt(lines, ['rosa', 'lastDay'], 'This is our last day. Raising money closes the window.');
        if (await ui.ask('rosa', warn, [{ label: 'Raise money anyway' }, { label: 'Go back' }]) !== 0) continue;
      }
      applyEffects(state, { day: 1, budget: raise });
      await ui.say('rosa', lineAt(lines, ['rosa', 'raiseMoney'], 'A day of phone calls and handshakes. Every bit helps.'));
      return 'again';
    }
    if (choice === 3) return 'giveup';
    if (!nogos.length) {
      applyEffects(state, { morale: 3 });
      return 'launch';
    }
    const warning = lineAt(lines, ['rosa', 'summary', 'overruleWarning'], 'The team advised against this. Are you sure?');
    if (await ui.ask('rosa', warning, [{ label: 'Yes, launch' }, { label: 'Go back' }]) === 0) {
      applyOverrule(state, nogos);
      return 'launch';
    }
  }
}

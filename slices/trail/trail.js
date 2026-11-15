// Slice 3: The Trail (owner: Person 3)
// Five weekly turns between hiring and launch week (Rulebook section 3,
// Slice 3 brief section 3). Each week: header, assign staff, resolve, one
// event, summary. The math lives in week.js and the numbers in tasks.json.
//
// The rival ticker lives in rival.js and the trail map header in map.js.

import * as ui from '../../core/ui.js';
import { checkEnd, pick, clamp } from '../../core/state.js';
import { applyEffects, describeChanges, loadAllEvents, pickEvent, runEvent } from '../../core/events.js';
import { TASK_IDS, PROGRESS_IDS, planWeek, projectWeek, resolveWeek, sumChanges, crunchRules, withHigherPrices } from './week.js';
import { loadRival, mountTicker, rivalPercent } from './rival.js';
import { showMap } from './map.js';

export const meta = { id: 'trail', owner: 'Person 3' };

const LAST_WEEK = 5;
const PROGRESS_NAMES = { build: 'Build', testing: 'Testing', training: 'Training' };
// Same words the hiring screen uses for the three astronaut skills.
const CREW_STATS = [
  { id: 'pilot', label: 'Piloting' },
  { id: 'eng', label: 'Engineering' },
  { id: 'nerves', label: 'Nerves' },
];

// The slice brings its own stylesheet so index.html and test.html need no changes.
const css = document.createElement('link');
css.rel = 'stylesheet';
css.href = new URL('./trail.css', import.meta.url);
document.head.append(css);

// Rosa explains skipped testing once per game, not every week.
let warnedAboutTesting = false;

// Zenith's progress this week (0 to 100), or null when rival.json is missing.
let zenithPercent = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Bar text shows how far along you are out of the full 100, e.g. "Training 49.3 / 100".
const progressLabel = (id, value) => `${PROGRESS_NAMES[id]} ${value} / 100`;

// Three progress bars. Returns the pieces so callers can update them later.
function progressBars(state) {
  const box = el('div');
  const parts = {};
  for (const id of PROGRESS_IDS) {
    const wrap = el('div', 'trail-progress');
    const bar = ui.bar(state.progress[id], 100, progressLabel(id, state.progress[id]));
    const note = el('p', 'small', '');
    wrap.append(bar, note);
    box.append(wrap);
    parts[id] = { bar, note };
    // The rival's bar goes right under Build so the player can compare the two at a glance.
    if (id === 'build' && zenithPercent !== null) {
      const rival = el('div', 'trail-rival');
      rival.append(ui.bar(zenithPercent, 100, `Zenith ${zenithPercent} / 100`));
      box.append(rival);
    }
  }
  return { box, parts };
}

// Rosa's lines for the crunch week offer. If any is missing from tasks.json, the offer is skipped.
const CRUNCH_TEXT = ['crunchWarn', 'crunchAsk', 'crunchYes', 'crunchNo', 'crunchYesLine', 'crunchNoLine'];

// Asked once, when one or two weeks remain and the bars are not full.
// `left` is 'Two weeks left' or 'One week left'. Resolves true if the player wants a crunch week.
async function offerCrunch(state, tasks, left) {
  const root = ui.screen('trail/workshop');
  root.classList.add('trail');
  const panel = ui.panel(left);
  panel.classList.add('trail-summary');
  panel.append(progressBars(state).box); // the bars show how far there is still to go
  root.append(panel);
  ui.sfx('trail-event');

  const text = tasks.text;
  const more = (mult) => `+${Math.round((mult - 1) * 100)}%`;
  const overhead = crunchRules(tasks).weekly.overhead;
  await ui.say('rosa', text.crunchWarn.replace('{left}', left));
  const pick = await ui.ask('rosa', text.crunchAsk, [
    {
      label: `${text.crunchYes} (costs ${more(tasks.crunch.costMult)}, progress ${more(tasks.crunch.progressMult)})`,
      // Rulebook 6.2: a screen must not offer spending that would empty the budget.
      disabled: state.budget <= overhead,
      why: 'Not enough budget',
    },
    { label: text.crunchNo },
  ]);
  await ui.say('rosa', pick === 0 ? text.crunchYesLine : text.crunchNoLine);
  return pick === 0;
}

// Step B: the player gives every hired person one task. Resolves with { staffId: taskId }.
function assignScreen(state, tasks, week, crunch) {
  return new Promise((resolve) => {
    const root = ui.screen('trail/workshop');
    root.classList.add('trail');
    const assignments = {};

    const staffPanel = ui.panel(`Week ${week}: who does what?`);
    const tip = el('p', 'trail-tip small', 'Pick one job for each person.');

    // The Astronauts / Staff switch sits on the title's line, like the tabs on the hiring screen.
    // Both lists are built once and shown or hidden, so picked jobs survive a switch.
    const head = el('div', 'trail-head');
    const tabs = el('div', 'trail-tabs');
    const staffList = el('div');
    const crewList = el('div');
    const tabButtons = {
      crew: ui.button('Astronauts', () => showTab('crew'), { variant: 'quiet' }),
      staff: ui.button('Staff', () => showTab('staff'), { variant: 'quiet' }),
    };
    const lists = { crew: crewList, staff: staffList };
    function showTab(kind) {
      for (const id of Object.keys(lists)) {
        lists[id].hidden = id !== kind;
        tabButtons[id].classList.toggle('tab-on', id === kind);
        tabButtons[id].setAttribute('aria-pressed', String(id === kind)); // for screen readers
      }
    }
    for (const b of Object.values(tabButtons)) b.classList.add('tab-btn');
    tabs.append(tabButtons.crew, tabButtons.staff);
    head.append(staffPanel.querySelector('.panel-title'), tabs);
    staffPanel.append(head, staffList, crewList);

    const side = ui.panel(crunch ? 'Crunch week' : 'This week');
    const { box, parts } = progressBars(state);
    const totals = el('p', 'trail-totals');
    const start = ui.button('Start the Week', () => resolve(assignments));

    // Called after every click so the preview always matches the choices.
    function update() {
      const plan = planWeek(state, assignments, tasks);
      for (const id of PROGRESS_IDS) parts[id].note.textContent = `+${plan[id]} this week`;
      const after = projectWeek(state, plan, tasks);
      totals.textContent = `Budget $${after.budget}M. Morale ${after.morale}.`;
      start.disabled = state.staff.some((person) => !assignments[person.id]);
    }

    for (const person of state.staff) {
      const row = el('div', 'trail-row');
      const who = el('div', 'trail-who');
      who.append(el('div', null, person.name), el('div', null, person.title || person.role),
        ui.bar(person.skill, 5, `Skill ${person.skill}`));

      const buttons = el('div');
      for (const taskId of TASK_IDS) {
        const task = tasks[taskId];
        const b = ui.button(task.label, () => {
          assignments[person.id] = taskId;
          buttons.querySelectorAll('.task-on').forEach((on) => on.classList.remove('task-on'));
          b.classList.add('task-on');
          tip.textContent = `Rosa: ${task.tip}`;
          update();
        }, { variant: 'quiet' });
        b.classList.add('task-btn');
        b.title = `${task.name}. ${task.tip}`; // hover text with the task's full name
        // art/icons/<icon>.png. A missing icon just leaves a text-only button.
        const icon = el('img', 'task-icon');
        icon.alt = '';
        icon.onerror = () => icon.remove();
        icon.src = new URL(`../../art/icons/${task.icon}.png`, import.meta.url).href;
        b.prepend(icon);
        buttons.append(b);
      }
      row.append(ui.portrait(person.portrait || person.id, 64), who, buttons);
      staffList.append(row);
    }

    // The crew is shown to look at, not to assign: the Rulebook has no numbers for astronaut jobs.
    for (const astronaut of state.crew) {
      const row = el('div', 'trail-row');
      const who = el('div', 'trail-who');
      who.append(el('div', null, astronaut.name), el('div', null, 'Astronaut'));
      const stats = el('div', 'trail-stats');
      for (const stat of CREW_STATS) stats.append(ui.bar(astronaut[stat.id], 5, `${stat.label} ${astronaut[stat.id]}`));
      row.append(ui.portrait(astronaut.portrait || astronaut.id, 64), who, stats);
      crewList.append(row);
    }
    if (state.crew.length === 0) crewList.append(el('p', 'small', 'No astronauts on the crew yet.'));
    if (tasks.text?.crewTip) crewList.append(el('p', 'trail-tip small', `Rosa: ${tasks.text.crewTip}`));

    // Rosa's hint for this week's focus, so the player has a starting idea of which jobs to pick.
    const hint = tasks.text?.weekHints?.[week];
    if (hint) side.append(el('p', 'trail-hint', `Rosa: ${hint}`));
    side.append(box, totals, start, tip);
    root.append(staffPanel, side);
    showTab('staff'); // staff first: that is where this week's choices are made
    update();
  });
}

// Step C: show the bars filling up and a toast with the week's numbers.
async function showResolve(state, before, changes, week, crunch) {
  const root = ui.screen('trail/workshop');
  root.classList.add('trail');
  const panel = ui.panel(crunch ? `Week ${week}: crunch week!` : `Week ${week}: the team gets to work`);
  panel.classList.add('trail-summary');

  // Draw the bars at last week's values first, so the fill visibly grows.
  const { box, parts } = progressBars({ progress: before });
  panel.append(box);
  root.append(panel);
  ui.sfx('trail-progress');
  await wait(100);
  for (const id of PROGRESS_IDS) {
    parts[id].bar.querySelector('.bar-fill').style.width = `${state.progress[id]}%`;
    parts[id].bar.querySelector('.bar-label').textContent = progressLabel(id, state.progress[id]);
  }
  const lines = describeChanges(sumChanges(changes));
  if (lines.length) ui.toast(lines.join('   '), 2000);
  // A positive budget change here can only be fundraising money coming in.
  if (changes.some((c) => c.key === 'budget' && c.delta > 0)) ui.sfx('trail-cash');
  await wait(1800);
}

// Step E: a short list of everything that changed this week.
// Break room chatter: one hired person or astronaut says how the week felt, in their own voice.
// Their mood comes from the week: a crunch week, a tired team (morale under 45), or a good week.
function chatterLine(state, chatter, crunch) {
  const people = [...state.staff, ...state.crew].filter((p) => chatter[p.id]);
  if (!people.length) return null;
  const person = pick(people);
  const mood = crunch ? 'crunch' : state.morale < 45 ? 'tired' : 'good';
  const text = chatter[person.id][mood];
  if (!text) return null;
  const row = el('div', 'trail-chatter');
  const words = el('div');
  words.append(el('div', 'trail-chatter-name', person.name), el('div', null, `"${text}"`));
  row.append(ui.portrait(person.portrait || person.id, 64), words);
  return row;
}

function summaryScreen(state, changes, week, isLast, chatter, crunch) {
  return new Promise((resolve) => {
    const root = ui.screen('trail/workshop');
    root.classList.add('trail');
    const panel = ui.panel(`Week ${week} is done`);
    panel.classList.add('trail-summary');

    const list = el('ul');
    for (const line of describeChanges(sumChanges(changes))) list.append(el('li', null, line));
    panel.append(list, el('p', null, `Budget $${state.budget}M. Morale ${state.morale}.`));
    const talk = chatterLine(state, chatter, crunch);
    if (talk) panel.append(talk);
    panel.append(ui.button(isLast ? 'On to launch week' : 'Next week', resolve));
    root.append(panel);
  });
}

export async function show(state, done) {
  const [tasks, bulletins, chatter] = await Promise.all([
    fetch(new URL('./tasks.json', import.meta.url)).then((res) => res.json()),
    loadRival(),
    // Chatter is optional: a missing or broken file just means nobody talks on the summary.
    fetch(new URL('./chatter.json', import.meta.url)).then((res) => res.json()).catch(() => ({})),
    loadAllEvents(),
  ]);
  ui.music('build_loop');

  const ticker = mountTicker(bulletins);
  // Whatever way the trail ends, the ticker must not follow the player into the next slice.
  const finish = (next) => { ticker.remove(); done(next); };

  // The crunch week is offered once per trail, and only if tasks.json has its numbers and lines.
  const crunchReady = Boolean(tasks.crunch) && CRUNCH_TEXT.every((key) => tasks.text?.[key]);
  let crunchOffered = false;

  // Start from state.week so presets like midTrail pick up in the middle.
  for (let week = state.week; week <= LAST_WEEK; week++) {
    state.week = week;
    zenithPercent = rivalPercent(bulletins, week);
    ticker.setWeek(week);

    // A. Week header
    await showMap(week, LAST_WEEK, state.day);

    // Near the end, if the bars are not full, Rosa offers one crunch week:
    // everything costs more that week, but progress goes up faster.
    let rules = tasks;
    let crunch = false;
    const lastNow = week === LAST_WEEK || state.day + 7 >= state.windowOpens;
    const lastNext = week + 1 === LAST_WEEK || state.day + 14 >= state.windowOpens;
    const notDone = PROGRESS_IDS.some((id) => state.progress[id] < 100);
    if (crunchReady && !crunchOffered && (lastNow || lastNext) && notDone && state.staff.length > 0) {
      crunchOffered = true;
      crunch = await offerCrunch(state, tasks, lastNow ? 'One week left' : 'Two weeks left');
      if (crunch) rules = crunchRules(tasks);
    }

    // B. Assign staff
    let assignments = {};
    if (state.staff.length > 0) {
      assignments = await assignScreen(state, rules, week, crunch);
    } else {
      await ui.say('rosa', 'No staff this week. The crew will do what they can.');
    }

    // C. Resolve
    const before = { ...state.progress };
    const resolved = resolveWeek(state, planWeek(state, assignments, rules), rules);
    const weekChanges = [...resolved.changes];
    await showResolve(state, before, resolved.changes, week, crunch);
    if (resolved.skippedTesting && !warnedAboutTesting) {
      warnedAboutTesting = true;
      await ui.say('rosa', 'Nobody tested this week. Small flaws hide when no one looks. Measure twice, launch once.');
    }
    // Overhead may push the budget to 0 or below (Rulebook 6.2).
    if (checkEnd(state)) return finish('finale');

    // D. Event
    const event = pickEvent(state, week);
    if (event) {
      // In a crunch week, event prices go up too. The event's id and story stay the same.
      const played = await runEvent(state, crunch ? withHigherPrices(event, tasks.crunch.costMult) : event);
      weekChanges.push(...played.changes);
      if (played.ended) return finish('finale');
    }

    // E. Summary, then time moves on
    // Events can add days, so the launch window may open before week 5 is over.
    const isLast = week === LAST_WEEK || state.day + 7 >= state.windowOpens;
    await summaryScreen(state, weekChanges, week, isLast, chatter, crunch);
    // The last week only runs up to the window (Rulebook 6.1), so it can't push the day past windowCloses.
    applyEffects(state, { day: isLast ? clamp(state.windowOpens - state.day, 0, 7) : 7 });
    if (checkEnd(state)) return finish('finale');
    if (isLast) break;
  }

  finish();
}

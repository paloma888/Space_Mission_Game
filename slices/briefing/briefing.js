// Slice 1: Foundation, Briefing & Hiring (owner: Person 1)
// RULEBOOK section 3: title, Rosa's welcome, hiring. Ends with 3 astronauts and 0 to 6 staff in state.
// Slice 1 brief sections 9 and 10. All text lives in the JSON files next to this one.

import * as ui from '../../core/ui.js';
import { saveCheckpoint } from '../../core/state.js';
import { runHiring } from './hiring.js';
import { crewReactionVariant } from './hiring-rules.js';

export const meta = { id: 'briefing', owner: 'Person 1' };

const fileHere = (fileName) => new URL(`./${fileName}`, import.meta.url);

async function loadJson(fileName) {
  const response = await fetch(fileHere(fileName));
  if (!response.ok) throw new Error(`slices/briefing/${fileName}: ${response.status}`);
  return response.json();
}

// index.html only links base.css, so the slice adds its own stylesheet once.
function addStylesheet() {
  if (document.getElementById('briefing-css')) return;
  const link = document.createElement('link');
  link.id = 'briefing-css';
  link.rel = 'stylesheet';
  link.href = fileHere('briefing.css');
  document.head.append(link);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Lines may contain {agencyName}, filled in from state when they are shown.
const fillTokens = (text, state) => text.replaceAll('{agencyName}', state.agencyName);

// Plays dialogue lines (RULEBOOK 7.2). Passing the line as opts lets ui.say read line.mood.
// Checked before every line, so lines stop as soon as the player skips.
async function playLines(state, lines = [], skipControl) {
  for (const line of lines) {
    if (skipControl?.skipped) break;
    spotlightGauge(line.gauge);
    await ui.say(line.speaker, fillTokens(line.text, state), line);
  }
  spotlightGauge(null);
}

// ---------- Scene 0: title screen

function titleScreen(scene) {
  return new Promise((resolve) => {
    const root = ui.screen(scene.background, { dashboard: false });
    root.classList.add('briefing-title');
    const menu = el('div', 'briefing-menu');
    root.append(el('h1', 'briefing-logo', 'LAUNCH TRAIL'), menu);
    ui.music('briefing_title'); // starts after the first click, because browsers block autoplay

    const soundButton = () => {
      const toggle = ui.button(`Sound: ${ui.isMuted() ? 'Off' : 'On'}`, () => {
        ui.setMuted(!ui.isMuted());
        toggle.textContent = `Sound: ${ui.isMuted() ? 'Off' : 'On'}`;
      }, { variant: 'quiet' });
      return toggle;
    };

    const showMenu = () => menu.replaceChildren(
      ui.button('Press Start', () => {
        ui.unlock();
        ui.sfx('briefing-start');
        resolve();
      }),
      ui.button('How to Play', () => showSlide(0), { variant: 'quiet' }),
      ui.button('Credits', () => ui.card(creditsHtml(scene.credits)), { variant: 'quiet' }),
      soundButton(),
    );

    const showSlide = (slideIndex) => {
      const slides = scene.howToPlay;
      const slidePanel = ui.panel(`How to Play ${slideIndex + 1} of ${slides.length}`);
      slidePanel.append(el('p', null, slides[slideIndex]));
      slidePanel.append(ui.button('Back', () => (slideIndex === 0 ? showMenu() : showSlide(slideIndex - 1)), { variant: 'quiet' }));
      const isLast = slideIndex === slides.length - 1;
      slidePanel.append(ui.button(isLast ? 'Done' : 'Next', () => (isLast ? showMenu() : showSlide(slideIndex + 1))));
      menu.replaceChildren(slidePanel);
    };

    showMenu();
  });
}

// ui.card() takes HTML, so plain text is escaped first.
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
}
function creditsHtml(creditLines) {
  return `<h2>Credits</h2>${creditLines.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}`;
}

// ---------- Skip button for the briefing (brief section 9)

// One Skip button follows the player through scenes 1 to 5. It asks before skipping.
// race(promise) ends early when the player skips, so a scene never waits on a line that's gone.
function createSkipControl() {
  let resolveSkip;
  const skipControl = { skipped: false, promise: new Promise((resolve) => { resolveSkip = resolve; }) };

  const skipButton = ui.button('Skip', () => askToSkip(), { variant: 'quiet' });
  skipButton.classList.add('briefing-skip');
  // ui.say advances on any pointerdown, so stop it here or clicking Skip would also skip a line.
  skipButton.addEventListener('pointerdown', (event) => event.stopPropagation());

  let confirmPanel = null;
  function askToSkip() {
    if (confirmPanel || skipControl.skipped) return;
    confirmPanel = ui.panel('Skip the briefing?');
    confirmPanel.classList.add('briefing-skip-confirm');
    confirmPanel.addEventListener('pointerdown', (event) => event.stopPropagation());
    const closeConfirm = () => { confirmPanel.remove(); confirmPanel = null; };
    confirmPanel.append(
      ui.button('Yes, skip', () => {
        closeConfirm();
        skipControl.skipped = true;
        finishDialogueNow();
        resolveSkip();
      }),
      ui.button('No', closeConfirm, { variant: 'quiet' }),
    );
    skipButton.parentElement?.append(confirmPanel);
  }

  // A new scene clears the screen, which also removes any open confirm box.
  skipControl.attach = (root) => {
    confirmPanel = null;
    root.append(skipButton);
  };
  skipControl.race = (promise) => Promise.race([promise, skipControl.promise]);
  return skipControl;
}

// Removes the open dialogue box. A synthetic key press makes ui.say's typewriter finish
// right away, so its typing blips stop instead of playing over the next screen.
function finishDialogueNow() {
  document.querySelectorAll('#game .dialogue').forEach((box) => box.remove());
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
}

// ---------- Scene 3 helpers: show the dashboard and point at one gauge at a time

// Position of each gauge in core/dashboard.js (GAUGES order). Ask Person 2 before it changes.
const GAUGE_POSITION = { days: 1, morale: 2, comms: 3, mass: 4, power: 5, budget: 6 };

function spotlightGauge(gaugeId) {
  document.querySelectorAll('#dashboard .briefing-spotlight')
    .forEach((gauge) => gauge.classList.remove('briefing-spotlight'));
  const position = GAUGE_POSITION[gaugeId];
  if (position) {
    document.querySelector(`#dashboard .dash > :nth-child(${position})`)?.classList.add('briefing-spotlight');
  }
}

function slideInDashboard() {
  const dashboardElement = document.getElementById('dashboard');
  if (!dashboardElement) return;
  dashboardElement.classList.remove('briefing-slide-in');
  void dashboardElement.offsetWidth; // restart the animation
  dashboardElement.classList.add('briefing-slide-in');
}

// ---------- Scene pieces

function missionCard(cardData) {
  const cardPanel = ui.panel(cardData.title);
  cardPanel.classList.add('briefing-mission-card');
  const factList = el('ul');
  cardData.facts.forEach((fact) => factList.append(el('li', null, fact)));
  cardPanel.append(factList);
  return cardPanel;
}

function roadMap(stops) {
  const road = el('div', 'briefing-road');
  stops.forEach((stop, stopIndex) => {
    const stopPanel = ui.panel(`${stopIndex + 1}. ${stop.name}`);
    stopPanel.append(el('p', null, stop.text));
    road.append(stopPanel);
  });
  return road;
}

// Scene 1: the player names the agency. Empty input keeps the default name.
function askAgencyName(state, root, prompt) {
  return new Promise((resolve) => {
    const namePanel = ui.panel(prompt);
    namePanel.classList.add('briefing-name');
    const nameInput = el('input', 'briefing-name-input');
    nameInput.type = 'text';
    nameInput.maxLength = 24; // keeps "{agencyName} it is." inside 140 characters
    nameInput.value = state.agencyName;
    nameInput.setAttribute('aria-label', prompt);
    const confirmName = () => {
      state.agencyName = nameInput.value.trim() || 'Pioneer Space Agency';
      namePanel.remove();
      resolve();
    };
    nameInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') confirmName(); });
    namePanel.append(nameInput, ui.button('OK', confirmName));
    root.append(namePanel);
    nameInput.focus();
    nameInput.select();
  });
}

async function playScene(state, scene, skipControl) {
  const root = ui.screen(scene.background, { dashboard: scene.dashboard === true });
  root.classList.add('briefing-scene');
  skipControl.attach(root);
  if (scene.dashboard) slideInDashboard();
  if (scene.missionCard) root.append(missionCard(scene.missionCard));
  if (scene.stops) root.append(roadMap(scene.stops));

  await skipControl.race(playLines(state, scene.lines, skipControl));
  if (scene.agencyNamePrompt && !skipControl.skipped) {
    await skipControl.race(askAgencyName(state, root, scene.agencyNamePrompt));
    await skipControl.race(playLines(state, scene.afterName, skipControl));
  }
  spotlightGauge(null);
}

// Scenes 1 to 5 in order, skippable as a group.
const BRIEFING_SCENE_IDS = ['hangar', 'mission', 'dashboard', 'road', 'hiringTips'];

async function playBriefing(state, scenesById) {
  const skipControl = createSkipControl();
  for (const sceneId of BRIEFING_SCENE_IDS) {
    if (skipControl.skipped) break;
    await playScene(state, scenesById[sceneId], skipControl);
  }
}

// ---------- Entry point

export async function show(state, done) {
  addStylesheet();
  const [sceneData, candidates, staff] = await Promise.all(
    ['scenes.json', 'candidates.json', 'staff.json'].map(loadJson),
  );
  const scenesById = Object.fromEntries(sceneData.scenes.map((scene) => [scene.id, scene]));

  // Try Again from the report sets resume to 'hiring': skip scenes 0 to 5 (RULEBOOK section 3).
  if (state.resume !== 'hiring') {
    await titleScreen(scenesById.title);
    await playBriefing(state, scenesById);
  }

  await runHiring(state, { candidates, staff, hiringText: sceneData.hiring });
  state.resume = null; // cleared before saving, so the checkpoint doesn't resume again by itself
  saveCheckpoint(state, 'afterHiring');

  // Scene 6: Rosa reacts to the crew, then always ends with her tic.
  const reaction = scenesById.reaction;
  ui.screen(reaction.background);
  const variantLines = reaction.variants[crewReactionVariant(state.crew)] ?? [];
  await playLines(state, [...variantLines, ...reaction.lines]);
  done();
}

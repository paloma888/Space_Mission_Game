// slices/build/common.js: small helpers shared by the rocket, site and review screens.

import * as ui from '../../core/ui.js';
import { applyEffects } from '../../core/events.js';

export const asset = (path) => new URL(`../../${path}`, import.meta.url).href;

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Money is charged when the player presses Next, not on every click (team decision),
// so the dashboard budget only moves once a choice is final. ctx.paid is what has been
// charged so far; anything above it in derived.spent is still "on the counter".
export const pending = (state, ctx) => state.derived.spent - ctx.paid;
export const leftOver = (state, ctx) => state.budget - pending(state, ctx);

export function commit(state, ctx) {
  const diff = pending(state, ctx);
  if (diff) applyEffects(state, { budget: -diff });
  ctx.paid = state.derived.spent;
  ui.refresh();
}

// The cheapest legal capsule, so a rocket that leaves less than this is greyed out.
// Without Back buttons, the player could otherwise get stuck unable to afford parts.
export function cheapestCapsule(catalog) {
  const groups = [catalog.parts.shell, catalog.parts.lifeSupport, catalog.parts.comms,
    catalog.parts.computer, catalog.parts.power?.battery];
  return groups.reduce((sum, g) => sum + Math.min(...Object.values(g ?? {})
    .filter((p) => !p.shady).map((p) => p.cost)), 0);
}

// Someone talks. A see-through cover over `root` blocks clicks until they finish,
// so the player can't pick a card by accident mid-sentence.
export async function talk(root, speaker, texts, opts) {
  const list = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
  if (!list.length) return;
  const cover = el('div', 'shop-cover');
  root.append(cover);
  try {
    for (const text of list) await ui.say(speaker, text, opts);
  } finally {
    cover.remove();
  }
}

// Hal says each warning once per game, however often the player goes Back.
const halSaid = new Set();
export async function halOnce(root, lines, key) {
  if (!key || halSaid.has(key) || !lines.hal?.[key]) return;
  halSaid.add(key);
  await talk(root, 'hal', lines.hal[key], { mood: 'sad' });
}

// ---------- Sounds for this slice
// Plays one of our sounds, one at a time: a new sound stops the one before it, so they never
// pile up. Returns a promise that resolves when the sound ends, so a caller can wait before
// dialogue starts (the typing blips would otherwise talk over it). Respects the mute setting.
// Speeds: the jsfxr files stay as made; these just play them quicker (pitch stays the same).
const SOUND_SPEED = { 'build-next': 1.4, 'shady-deal': 1.4 };
const missingSounds = new Set(); // don't ask for a missing file again and again
let playing = null;

export function playSound(name) {
  return new Promise((resolve) => {
    if (ui.isMuted() || missingSounds.has(name)) return resolve();
    if (playing) playing.pause();
    const audio = new Audio(asset(`audio/sfx/${name}.wav`));
    audio.playbackRate = SOUND_SPEED[name] ?? 1;
    playing = audio;
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      if (playing === audio) playing = null;
      resolve();
    };
    audio.addEventListener('ended', done, { once: true });
    audio.addEventListener('pause', done, { once: true }); // stopped by the next sound
    audio.addEventListener('error', () => { missingSounds.add(name); done(); }, { once: true });
    audio.play().catch(done); // blocked before the first click, or missing: just carry on
    setTimeout(done, 3000); // never let a stuck sound hold up the game
  });
}

// Greys out a card the player can't pick. A real disabled button ignores clicks, so this one
// stays clickable and plays build-deny instead, letting the player know "no" was heard.
// aria-disabled tells screen readers the card is not available. Set it after any onclick.
export function lockCard(card) {
  card.classList.add('is-disabled');
  card.setAttribute('aria-disabled', 'true');
  card.onclick = () => playSound('build-deny');
  return card;
}

// The word players see instead of the hidden reliability number. It comes from
// `rating` in rockets.json; the cutoffs are only a fallback for a rocket without one.
export function reliabilityWord(rocket) {
  if (rocket.rating) return rocket.rating;
  if (rocket.reliability >= 0.96) return 'Proven';
  if (rocket.reliability >= 0.95) return 'Okay';
  return 'Risky';
}

export const signed = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}`;

// <img> that turns into a labeled box when the art file doesn't exist yet.
export function art(path, className, label) {
  const img = el('img', className);
  img.alt = '';
  img.onerror = () => img.replaceWith(el('div', `${className} placeholder-box`, label));
  img.src = asset(path);
  return img;
}

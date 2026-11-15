// slices/build/common.js: small helpers shared by the rocket, site, orbit and review screens.

import * as ui from '../../core/ui.js';
import { applyEffects } from '../../core/events.js';

export const asset = (path) => new URL(`../../${path}`, import.meta.url).href;

export function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// After a change, charge (or refund) only the difference in derived.spent,
// so going back and forth between screens never charges twice.
export function chargeChange(state, spentBefore) {
  const diff = state.derived.spent - spentBefore;
  if (diff) applyEffects(state, { budget: -diff });
  ui.refresh();
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

// slices/build/shop.js: the capsule shop (Slice 2 brief section 6, amendment A3).
// Five required categories, three tiers each. Picks are charged when the player presses Next
// (see commit() in common.js), so the dashboard budget only moves once a choice is final.

import * as ui from '../../core/ui.js';
import { installedParts } from './recompute.js';
import { currentLift } from './compat.js';
import { leftOver, lockCard, playSound } from './common.js';

// Power is last on purpose: pick what needs power first, then a battery big enough
// to cover it, the same way engineers size a power system.
const CATEGORIES = [
  { id: 'shell', name: 'Shell' },
  { id: 'lifeSupport', name: 'Life support' },
  { id: 'comms', name: 'Comms' },
  { id: 'computer', name: 'Flight computer' },
  { id: 'power', name: 'Power' },
];
const TIERS = ['budget', 'standard', 'premium']; // the shop never sells shady_* parts (that is the dealer's)

// Remembered for the whole game, so Hal and Rosa don't repeat themselves after Back.
const halSaid = new Set();
let introDone = false;

const asset = (path) => new URL(`../../${path}`, import.meta.url).href;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// ---------- Reading and writing one category

const group = (catalog, cat) => (cat === 'power' ? catalog.parts.power?.battery : catalog.parts[cat]) ?? {};
const pickedTier = (state, cat) => (cat === 'power' ? state.parts.power?.tier : state.parts[cat]) ?? null;

function setTier(state, cat, tier) {
  if (cat === 'power') state.parts.power = { type: 'battery', tier };
  else state.parts[cat] = tier;
}

const allPicked = (state) => CATEGORIES.every((c) => pickedTier(state, c.id));

// ---------- Hal's warnings (brief section 9). Each one plays once per game.

function halWarnings(state, ctx) {
  const p = state.parts;
  const d = state.derived;
  const out = [];
  if (p.lifeSupport === 'budget') out.push('budgetLifeSupport');
  if (p.computer === 'budget') out.push('budgetComputer');
  if (p.power?.tier) {
    if (d.powerUse > d.powerSupply) out.push('powerOver');
    else if (d.powerUse > 0.9 * d.powerSupply) out.push('powerTight');
  }
  if (CATEGORIES.every((c) => pickedTier(state, c.id) === 'premium') && leftOver(state, ctx) < 100) out.push('premiumBroke');
  return out.filter((key) => !halSaid.has(key));
}

// ---------- The screen. Resolves with 'next' when the player presses Next.

export function showShop(state, ctx) {
  const { catalog, lines, recompute } = ctx;
  return new Promise((resolve) => {
    state.parts ??= {};
    const root = ui.screen('build/assembly_hangar');
    root.classList.add('shop');
    const nav = el('div', 'shop-nav');
    const middle = el('div', 'shop-cards');
    const side = el('div', 'shop-side');
    root.append(nav, middle, side);

    // Start on the first category with nothing picked, so a fresh player reads top to bottom.
    let current = (CATEGORIES.find((c) => !pickedTier(state, c.id)) ?? CATEGORIES[0]).id;
    let talking = false;

    // While someone talks, a see-through cover stops clicks from picking cards by accident.
    async function talk(speaker, texts, opts) {
      const list = (Array.isArray(texts) ? texts : [texts]).filter(Boolean);
      if (!list.length) return;
      talking = true;
      const cover = el('div', 'shop-cover');
      root.append(cover);
      for (const text of list) await ui.say(speaker, text, opts);
      cover.remove();
      talking = false;
    }

    async function pick(cat, tier) {
      if (talking || pickedTier(state, cat) === tier) return;
      setTier(state, cat, tier);
      recompute(state);
      playSound('build-select');
      ui.refresh(); // mass and power gauges move now; the budget waits for Next
      // Stay on this category so the player can compare tiers before moving on.
      render();
      for (const key of halWarnings(state, ctx)) {
        halSaid.add(key);
        await talk('hal', lines.hal?.[key], { mood: 'sad' });
      }
    }

    function render() {
      renderNav();
      renderCards();
      renderSide();
    }

    function renderNav() {
      nav.replaceChildren(el('h2', null, lines.shop?.title ?? 'Build your capsule'));
      for (const c of CATEGORIES) {
        const b = el('button', 'shop-cat');
        b.type = 'button';
        // The mark gets its own box: ✓ isn't in the pixel font, and the fallback font sits lower.
        const done = Boolean(pickedTier(state, c.id));
        b.append(el('span', `cat-mark${done ? ' done' : ''}`, done ? '✓' : '·'), el('span', null, c.name));
        if (c.id === current) b.classList.add('on');
        b.onclick = () => { if (!talking) { current = c.id; render(); } };
        nav.append(b);
      }
    }

    function renderCards() {
      const parts = group(catalog, current);
      const chosen = pickedTier(state, current);
      const chosenCost = parts[chosen]?.cost ?? 0;
      middle.replaceChildren();
      // One Help per category: Rosa's explanation is about the part, not a single tier.
      const head = el('div', 'shop-head');
      const name = CATEGORIES.find((c) => c.id === current)?.name ?? '';
      const why = ui.button('Help', () => { if (!talking) talk('rosa', lines.rosa?.[current]); }, { variant: 'quiet' });
      why.classList.add('why-btn');
      head.append(el('h2', null, name), why);
      middle.append(head);
      for (const tier of TIERS) {
        const part = parts[tier];
        if (!part) continue;
        const card = el('button', `tier-card tier-${tier}`);
        card.type = 'button';
        if (tier === chosen) card.classList.add('chosen');
        card.append(icon(part.icon), el('div', 'tier-name', part.label));
        card.append(el('div', 'tier-stat', `$${part.cost}M · ${part.mass} t`));
        card.append(el('div', 'tier-stat', powerText(part)));
        card.append(el('div', 'tier-trade', part.tradeoff));
        // Swapping only costs the difference, so a card is affordable if the difference fits.
        card.onclick = () => pick(current, tier);
        if (tier !== chosen && part.cost - chosenCost > leftOver(state, ctx)) {
          lockCard(card); // clicking it plays build-deny instead of picking it
          card.append(el('div', 'tier-why', lines.shop?.noMoney ?? 'Not enough budget.'));
        }
        middle.append(card);
      }
      // A dealer part isn't one of the three cards, so say what is installed instead.
      if (chosen && !TIERS.includes(chosen) && parts[chosen]) {
        const note = (lines.shop?.dealerInstalled ?? 'Installed: {label}.').replace('{label}', parts[chosen].label);
        middle.append(el('p', 'shop-note', note));
      }
    }

    function renderSide() {
      const d = state.derived;
      side.replaceChildren(el('h2', null, 'Your capsule'));
      const row = (label, value) => {
        const r = el('div', 'side-row');
        r.append(el('span', null, label), el('span', null, value));
        side.append(r);
        return r;
      };
      // derived.spent includes the rocket, so add up the parts on their own.
      row('Total cost', `$${installedParts(state.parts, catalog).reduce((n, p) => n + p.cost, 0)}M`);
      const massRow = row('Mass', `${d.capsuleMass} t`);
      const massWhy = ui.button('?', () => { if (!talking) talk('rosa', lines.rosa?.mass); }, { variant: 'quiet' });
      massWhy.classList.add('why-mini');
      massRow.append(massWhy);
      // The rocket is already picked, so show the room left as parts go in.
      const lift = currentLift(state, catalog);
      const margin = lift == null ? null : Math.round((lift - d.capsuleMass) * 10) / 10;
      if (lift != null) {
        row('Lift', `${lift.toFixed(1)} t`);
        const marginRow = row('Margin', `${margin >= 0 ? '+' : ''}${margin.toFixed(1)} t`);
        marginRow.classList.add(margin < 0 ? 'bad' : margin < 1 ? 'warn' : 'ok');
      }
      // Before a battery is picked there is nothing to measure against, so the bar stays empty
      // instead of looking maxed out. Colors match the dashboard: yellow over 90%, red when over.
      const hasBattery = Boolean(state.parts.power?.tier);
      row('Power', hasBattery ? `${d.powerUse} / ${d.powerSupply} W` : `${d.powerUse} / -- W`);
      const powerBar = ui.bar(hasBattery ? d.powerUse : 0, Math.max(d.powerSupply, 1));
      if (hasBattery && d.powerUse > d.powerSupply) powerBar.classList.add('over');
      else if (hasBattery && d.powerUse > 0.9 * d.powerSupply) powerBar.classList.add('tight');
      side.append(powerBar);
      row('Radio', d.comms === 'none' ? '--' : d.comms.toUpperCase());
      // What the budget will be once Next charges these parts.
      row('Extra budget', `$${leftOver(state, ctx)}M`);

      // No Back button (team decision), so Next must only open when the capsule can fly:
      // later screens can add lift but never take it away (polar is checked there).
      const next = ui.button('Next', () => { if (!talking) leave(); });
      next.classList.add('shop-next', 'big-next');
      const why = !allPicked(state) ? lines.shop?.needAll
        : margin != null && margin < 0 ? lines.shop?.shopTooHeavy : null;
      side.append(next);
      if (why) {
        next.disabled = true;
        next.title = why;
        side.append(el('p', 'tier-why', why));
      }
      side.append(el('p', 'final-note', lines.shop?.final ?? ''));
    }

    // Short on power is allowed, but only after Hal's warning (brief section 11). It is asked
    // here because the shop is the last place parts can change: there is no Back button.
    async function leave() {
      if (!state.derived.powerOk) {
        talking = true;
        const cover = el('div', 'shop-cover');
        root.append(cover);
        await ui.say('hal', lines.hal?.lockPowerShort ?? 'Power is short.', { mood: 'sad' });
        const answer = await ui.ask('hal', lines.shop?.lockAnyway ?? 'Keep it anyway?',
          [{ label: 'Keep it' }, { label: 'Change parts' }]);
        cover.remove();
        talking = false;
        if (answer !== 0) return;
      }
      resolve('next');
    }

    render();
    if (!introDone) {
      introDone = true;
      talk('rosa', lines.rosa?.intro);
    }
  });
}

function powerText(part) {
  if (part.supply) return `Supplies ${part.supply} W`;
  return part.power ? `Uses ${part.power} W` : 'No power needed';
}

// The tier's part art (see "icon" in parts.json). Missing art becomes a labeled box, never an error.
function icon(name) {
  const img = el('img', 'tier-icon');
  img.alt = '';
  img.onerror = () => img.replaceWith(el('div', 'tier-icon placeholder-box', name));
  img.src = asset(`art/icons/${name}.png`);
  return img;
}

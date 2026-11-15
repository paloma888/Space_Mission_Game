// slices/build/dealer.js: the shady dealer (Slice 2 brief section 9, amendment A5).
// Right after the shop is paid for: a short scene ("...", "Psst. Over here.", Hal: "Don't.",
// "Let's make a deal."), then the deal screen. Offers ONE dealer part (same stats, half the
// price, a hidden reliability catch) as a trade-in for the player's battery, radio or
// flight computer, with the same stats as the tier they bought. The choice is final.

import * as ui from '../../core/ui.js';
import { random, addFlag } from '../../core/state.js';
import { el, talk, commit, playSound } from './common.js';
import { recompute as recomputeWith, findRocket, liftFor } from './recompute.js';

// Only these have a "dealer" template in parts.json. The dealer's version copies the
// tier the player bought (shady_standard for a Standard part), so the deal is
// "the same part for half the price" and the only catch is the hidden one.
const OFFERS = [
  { cat: 'power', name: 'Battery', noun: 'battery' },
  { cat: 'comms', name: 'Comms radio', noun: 'radio' },
  { cat: 'computer', name: 'Flight computer', noun: 'flight computer' },
];

const group = (catalog, cat) => (cat === 'power' ? catalog.parts.power?.battery : catalog.parts[cat]) ?? {};
const tierOf = (state, cat) => (cat === 'power' ? state.parts.power?.tier : state.parts[cat]);
const dealerTier = (state, cat) => `shady_${tierOf(state, cat)}`;
const withTier = (parts, cat, tier) =>
  (cat === 'power' ? { ...parts, power: { type: 'battery', tier } } : { ...parts, [cat]: tier });

// Offers that keep the mission possible, because there is no Back button: the capsule
// still fits the rocket (before any site bonus), the power still covers the parts,
// and the trade-in is affordable.
function qualifyingOffers(state, catalog) {
  const rocket = findRocket(catalog, state.rocket);
  const lift = rocket ? liftFor(rocket, { liftBonus: 0 }, state.orbit) : Infinity;
  return OFFERS.filter(({ cat }) => {
    const parts = group(catalog, cat);
    const mine = parts[tierOf(state, cat)];
    const shady = parts[dealerTier(state, cat)];
    if (!mine || !shady || mine.shady) return false;
    if (shady.cost - mine.cost > state.budget) return false;
    // Same mass and power as the player's tier today, but checked anyway in case
    // someone retunes parts.json later.
    const test = { parts: withTier(state.parts, cat, dealerTier(state, cat)), rocket: state.rocket, site: null,
      orbit: state.orbit, derived: {}, rel: { parts: 0 } };
    recomputeWith(test, catalog);
    if (test.derived.capsuleMass > lift) return false;
    // Never be the reason the power runs short (the shop already asked about that).
    if (state.derived.powerOk && !test.derived.powerOk) return false;
    return true;
  });
}

export async function showDealer(state, ctx) {
  const { catalog, lines } = ctx;
  const options = qualifyingOffers(state, catalog);
  if (!options.length) return; // nothing safe to sell, so the dealer stays hidden
  const offer = options[Math.floor(random() * options.length)]; // seeded, so ?seed= replays it
  const parts = group(catalog, offer.cat);
  const mine = parts[tierOf(state, offer.cat)];
  const offerTier = dealerTier(state, offer.cat);
  const shady = parts[offerTier];
  const D = lines.dealer ?? {};

  // The little scene before the deal: the dealer whispers, Hal objects, the dealer insists.
  // It plays over the shop that was just paid for; talk() blocks clicks until it ends.
  const game = document.getElementById('game');
  await playSound('shady-deal'); // the dealer's sound, the moment they appear
  await talk(game, 'myster', D.intro ?? ['...', 'Psst. Over here.']);
  await talk(game, 'hal', lines.hal?.dealer ?? "Don't.", { mood: 'sad' });
  // Say what the player just bought, so it is clear the dealer is offering a cheaper swap.
  const noticed = (D.noticed ?? '').replaceAll('{part}', `${mine.label.toLowerCase()} ${offer.noun}`)
    .replaceAll('{price}', mine.cost).replaceAll('{noun}', offer.noun);
  await talk(game, 'myster', [noticed, D.deal ?? "Let's make a deal."]);

  const overlay = el('div', 'dealer-overlay');
  const box = el('div', 'dealer-box');
  const head = el('div', 'dealer-head');
  head.append(ui.portrait('myster', 96),
    el('div', null, D.title ?? 'Psst.'),
    el('p', 'dealer-pitch', D.pitch?.[offer.cat] ?? ''));
  const cards = el('div', 'dealer-cards');
  cards.append(
    partCard(`Your ${offer.name.toLowerCase()}`, mine, mine, `Paid $${mine.cost}M`, D.yourWarranty, false),
    el('div', 'dealer-arrow', '→'),
    partCard("Dealer's offer", shady, mine, priceText(shady, mine), D.dealerWarranty, true));
  const after = state.budget - (shady.cost - mine.cost);
  const buttons = el('div', 'dealer-buttons');
  const take = ui.button(D.take ?? 'Take the deal', () => finish(true));
  const pass = ui.button(D.pass ?? 'No thanks', () => finish(false), { variant: 'quiet' });
  buttons.append(take, pass);
  box.append(head, cards, el('p', 'dealer-after', `Extra budget after the deal: $${after}M`), buttons);
  overlay.append(box);
  game.append(overlay);

  let decide;
  const chosen = new Promise((resolve) => { decide = resolve; });
  function finish(accepted) {
    take.disabled = pass.disabled = true;
    decide(accepted);
  }
  const accepted = await chosen;
  overlay.remove();
  if (!accepted) await playSound('shady-reject');
  if (accepted) {
    state.parts = withTier(state.parts, offer.cat, offerTier);
    ctx.recompute(state);
    commit(state, ctx); // trade-in: refund the old part, charge the dealer's price
    await playSound('shady-deal');
    await upsell(state, ctx, game, D);
  }
  // Rosa says nothing here on purpose (brief section 9).
  await talk(game, 'myster', accepted ? D.accept : D.decline);
}

// Only after a deal: the mysterious component. With a launch on the last
// day of the window, it sets up the secret ending (Rulebook 6.9). Never explained in the game.
// Offered only if it still fits on the rocket and the player can pay, since there is no Back.
async function upsell(state, ctx, game, D) {
  const component = ctx.catalog.parts.mysteriousComponent;
  if (!component || state.parts.warpCoil || component.cost > state.budget) return;
  const rocket = findRocket(ctx.catalog, state.rocket);
  const lift = rocket ? liftFor(rocket, { liftBonus: 0 }, state.orbit) : Infinity;
  if (state.derived.capsuleMass + component.mass > lift) return;

  const cover = el('div', 'shop-cover');
  game.append(cover);
  const answer = await ui.ask('myster', D.upsell ?? 'One more thing. Only $10M.',
    [{ label: D.upsellYes ?? 'Sure, why not' }, { label: D.upsellNo ?? 'No thanks' }]);
  cover.remove();
  if (answer === 0) {
    state.parts.warpCoil = true;
    addFlag(state, 'warp_coil'); // flag name from the Rulebook registry; Person 5's ending reads it
    ctx.recompute(state);
    commit(state, ctx);
    await playSound('shady-deal');
  }
  if (answer !== 0) await playSound('shady-reject');
  await talk(game, 'myster', answer === 0 ? D.upsellBought : D.upsellPassed);
}

function priceText(shady, mine) {
  const back = mine.cost - shady.cost;
  if (back > 0) return `Costs $${shady.cost}M (+$${back}M back)`;
  if (back < 0) return `Costs $${shady.cost}M ($${-back}M more)`;
  return `Costs $${shady.cost}M`;
}

// One side of the comparison. On the dealer's side, each stat gets ▲ (better) or ▼ (worse)
// next to the player's part. Reliability is hidden on purpose: only the warranty hints at it.
function partCard(title, part, mine, price, warranty, compare) {
  const card = el('div', `dealer-card${compare ? ' offer' : ''}`);
  card.append(el('h3', null, title), el('div', 'tier-name', part.label));
  const stat = (text, better) => {
    const row = el('div', 'dealer-stat', text);
    if (compare && better != null) row.append(el('span', better ? 'up' : 'down', better ? ' ▲' : ' ▼'));
    card.append(row);
  };
  if (part.supply != null) stat(`Supplies ${part.supply} W`, part.supply === mine.supply ? null : part.supply > mine.supply);
  if (part.power != null) stat(`Uses ${part.power} W`, part.power === mine.power ? null : part.power < mine.power);
  stat(`${part.mass} t`, part.mass === mine.mass ? null : part.mass < mine.mass);
  stat(price, part.cost === mine.cost ? null : part.cost < mine.cost);
  card.append(el('div', 'dealer-warranty', warranty ?? ''));
  return card;
}

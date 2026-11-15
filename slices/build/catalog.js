// slices/build/catalog.js: loads the build data once (Slice 2 brief section 12).
// Numbers live in parts.json, rockets.json and sites.json, words in lines.json,
// so tuning and rewriting never touch code. Other slices can import CATALOG
// to look up a site's fee or deliveryFactor.

import { expandDealerParts } from './recompute.js';

const load = async (file) => (await fetch(new URL(`./${file}`, import.meta.url))).json();

let catalog;
try {
  const [parts, rockets, sites] = await Promise.all(
    ['parts.json', 'rockets.json', 'sites.json'].map(load));
  catalog = { parts: expandDealerParts(parts), rockets, sites };
} catch (err) {
  // An empty catalog keeps the game running. Screens will show no cards.
  console.error('Could not load the build catalog in slices/build/. Is a JSON file broken?', err);
  catalog = { parts: {}, rockets: [], sites: [] };
}

// Missing lines just mean nobody speaks. The shop still works.
let lines;
try {
  lines = await load('lines.json');
} catch (err) {
  console.error('Could not load slices/build/lines.json. Is it broken?', err);
  lines = { rosa: {}, hal: {}, shop: {} };
}

export const CATALOG = catalog;
export const LINES = lines;

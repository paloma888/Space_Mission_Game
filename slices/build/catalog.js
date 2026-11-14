// slices/build/catalog.js: loads parts.json, rockets.json and sites.json once.
// Numbers live in JSON so tuning never touches code (Slice 2 brief section 12).
// Other slices can import CATALOG to look up a site's fee or deliveryFactor.

const load = async (file) => (await fetch(new URL(`./${file}`, import.meta.url))).json();

let catalog;
try {
  const [parts, rockets, sites] = await Promise.all(
    ['parts.json', 'rockets.json', 'sites.json'].map(load));
  catalog = { parts, rockets, sites };
} catch (err) {
  // An empty catalog keeps the game running. Screens will show no cards.
  console.error('Could not load the build catalog in slices/build/. Is a JSON file broken?', err);
  catalog = { parts: {}, rockets: [], sites: [] };
}

export const CATALOG = catalog;

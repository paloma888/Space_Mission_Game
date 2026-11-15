// slices/finale/sites/kourou.js: Kourou, French Guiana, drawn in code. Owner: Person 5, Erick.
// See sites/index.js for how the 3 layers (far, mid, near) and parallax work.

import {
  W, H, makeCanvas, drawPad, dot, box, hash2, noise3, RATES, mix, speckle, patch, padGravel, sprite,
} from './draw.js';

// ---------- 🦜 Kourou, French Guiana
// The Guiana Space Centre sits on a hot, wet coast at the edge of the Amazon rainforest, close to
// the equator. Looking out to sea: towering tropical clouds, an Atlantic turned brown near the
// shore by river mud, and the three small forested Îles du Salut on the horizon. Around the pad:
// red laterite dirt, tall lightning masts, a lumpy rainforest canopy with giant trees and morning
// mist, a flock of scarlet ibis, and in front, giant jungle leaves, a heliconia flower and a toucan.

const KO_SEA_TOP = 104;  // the horizon
const KO_SHORE = 116;    // where the waves break on the beach
const KO_MID_TOP = 120;  // the top of the rainforest canopy in the middle layer
const KO_GROUND_Y = 136; // where the near ground (the cleared launch area) starts

/**
 * Job: Kourou's 3 layers.
 * @param {Object} ink - colors by role (launch-anim.js).
 * @returns {Array} - [{ img, rate }] for far, mid and near.
 */
export function kourou(ink) {
  // This site's colors, named for what they paint. Each one is a palette color from `ink`.
  const c = {
    seaDeep: ink.sea, seaLight: ink.seaLight, mud: ink.rockShade, mudBrown: ink.trunk,
    foam: ink.sand, beach: ink.sandShade,
    leaf: ink.grassShade, leafLight: ink.grass, leafDark: ink.ring,
    trunk: ink.rockShade, trunkLight: ink.rock, branch: ink.trunk,
    cloud: ink.cloud, cloudShade: ink.seaLight, cloudBase: ink.rock, mist: ink.cloud,
    dirt: ink.stripe, dirtDark: ink.towerShade, dirtLight: ink.flameOuter,
    gravel: ink.rock, gravelLight: ink.sand,
    mast: ink.body, mastShade: ink.rock, mastBand: ink.tower,
    ibis: ink.stripe, ibisLight: ink.flameOuter,
    black: ink.space, yellow: ink.beacon, orange: ink.flameOuter, red: ink.alarm, eye: ink.seaLight,
  };
  return [
    { img: kourouFar(c), rate: RATES.far },
    { img: kourouMid(c), rate: RATES.mid },
    { img: kourouNear(c, ink), rate: RATES.near },
  ];
}

// Far: tropical clouds, the muddy-blue ocean, the Îles du Salut, the beach, then rainforest
// all the way down, and a flock of scarlet ibis in the sky.
function kourouFar(c) {
  const { canvas, g } = makeCanvas(W, H);
  cumulus(g, c, 46, KO_SEA_TOP, 34, 46);
  cumulus(g, c, 300, KO_SEA_TOP, 22, 26);

  // The ocean: deep blue far out, turning brown near the shore (mud carried by the Amazon's
  // rivers). Each row: [first color, second color, how much of the second].
  const ROWS = [
    [c.seaDeep, c.seaLight, 0], [c.seaDeep, c.seaLight, 0], [c.seaDeep, c.seaLight, 0.25],
    [c.seaDeep, c.seaLight, 0.5], [c.seaDeep, c.seaLight, 0.75], [c.seaLight, c.mud, 0],
    [c.seaLight, c.mud, 0.25], [c.seaLight, c.mud, 0.5], [c.seaLight, c.mud, 0.75],
    [c.mud, c.mudBrown, 0.25], [c.mud, c.mudBrown, 0.5], [c.mud, c.mudBrown, 0.5],
  ];
  for (let y = KO_SEA_TOP; y < KO_SHORE; y++) {
    const [a, b, t] = ROWS[y - KO_SEA_TOP];
    for (let x = 0; x < W; x++) {
      let color = mix(x, y, t) ? b : a;
      if (y > KO_SEA_TOP + 4 && hash2(x >> 2, y) < 0.03 && speckle(x, y, 0.6)) color = c.foam; // a few waves
      dot(g, x, y, color);
    }
  }
  salutIsland(g, c, 216, KO_SEA_TOP, 13, 7, [210, 221]); // Île Royale, the biggest
  salutIsland(g, c, 245, KO_SEA_TOP, 9, 5, [247]);       // Île Saint-Joseph
  salutIsland(g, c, 268, KO_SEA_TOP, 6, 4, []);          // Île du Diable, the smallest

  // Breaking waves (sandy, in this muddy water), then a strip of beach.
  for (let x = 0; x < W; x++) {
    dot(g, x, KO_SHORE, speckle(x, KO_SHORE, 0.65) ? c.foam : c.mudBrown);
    for (let y = KO_SHORE + 1; y < KO_SHORE + 3; y++) dot(g, x, y, speckle(x, y, 0.15) ? c.foam : c.beach);
  }
  canopy(g, c, KO_SHORE + 3, 2, 3, 11);   // faraway rainforest: small treetops

  // A flock of scarlet ibis flying in a V.
  for (const [dx, dy] of [[0, 0], [-6, 3], [6, 3], [-12, 6], [12, 6], [-18, 9], [17, 8]]) ibis(g, c, 118 + dx, 52 + dy);
  return canvas;
}

// Mid: the rainforest canopy with two giant trees poking out of it, and morning mist.
function kourouMid(c) {
  const { canvas, g } = makeCanvas(W, H);
  canopy(g, c, KO_MID_TOP, 4, 7, 23);
  giantTree(g, c, 72, KO_MID_TOP + 8, 26);
  giantTree(g, c, 262, KO_MID_TOP + 8, 20);

  // Mist rising off the forest: soft bands, thickest in the middle, breaking up in places.
  for (let y = KO_MID_TOP - 4; y < KO_MID_TOP + 10; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise3(x / 22, y / 6, 3.3);
      const density = (n - 0.45) * 1.8 * (1 - Math.abs(y - (KO_MID_TOP + 3)) / 8);
      if (mix(x, y, density)) dot(g, x, y, c.mist);
    }
  }
  return canvas;
}

// Near: red laterite dirt with patches of grass, a red dirt road, the gravel area, the pad, two
// lightning masts, and jungle plants framing the corners (with a heliconia flower and a toucan).
function kourouNear(c, ink) {
  const { canvas, g } = makeCanvas(W, H);

  // Red laterite soil (rich in iron, which makes it red), with darker and lighter specks, and
  // patches of low grass. The back edge is a strip of grass where the cleared land meets the forest.
  for (let y = KO_GROUND_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let color = speckle(x, y, 0.12) ? c.dirtDark : speckle(y, x, 0.05) ? c.dirtLight : c.dirt;
      if (y < KO_GROUND_Y + 4 || patch(x, y, 22) > 0.64) color = speckle(x, y, 0.35) ? c.leafLight : c.leaf;
      dot(g, x, y, color);
    }
  }
  for (let x = 0; x < W; x++) if (hash2(x, 31) < 0.5) dot(g, x, KO_GROUND_Y - 1, c.leafLight); // grass tips

  // The red dirt road, curving off to the left from the pad area: packed, lighter dirt with darker edges.
  for (let x = 0; x < 122; x++) {
    const centerY = 146 + ((x / 122) ** 2) * 22;
    const half = 2 + x * 0.04;
    const y0 = Math.round(centerY - half);
    const y1 = Math.round(centerY + half);
    for (let y = y0; y <= y1; y++) {
      const edge = y === y0 || y === y1;
      dot(g, x, y, edge ? c.dirtDark : speckle(x, y, 0.15) ? c.dirt : c.dirtLight);
    }
  }

  padGravel(g, c.gravel, c.gravelLight);
  drawPad(g, ink);
  lightningMast(g, c, 104, 152, 112);
  lightningMast(g, c, 218, 152, 112);

  // Jungle plants in the corners: giant leaves fanning out, with a heliconia flower on the right.
  for (const [deg, len] of [[-62, 46], [-38, 58], [-16, 52], [4, 38]]) bigLeaf(g, c, -6, 188, len, deg);
  for (const [deg, len] of [[-118, 46], [-142, 58], [-164, 52], [176, 38]]) bigLeaf(g, c, 326, 188, len, deg);
  heliconia(g, c, 290, 146);
  // A toucan perched on a branch at the right edge, drawn twice as big because it's close to us.
  for (let x = 268; x < W; x++) box(g, x, 145 - Math.round((x - 268) * 0.08), 1, 3, x % 7 ? c.branch : c.dirtDark);
  sprite(g, 272, 129, [
    '.kkk......',
    'kkekyooo..',
    'kkkyyoooor',
    'kkkyy.....',
    'kkkk......',
    '.kkk......',
    '..kk......',
    '..k.......',
  ], { k: c.black, e: c.eye, y: c.yellow, o: c.orange, r: c.red }, 2);
  return canvas;
}

// ---------- 🖌️ Things only Kourou draws

/**
 * Job: the rainforest canopy seen from a little above: rows of round, lumpy treetops overlapping
 *   like broccoli, lit on the top left, very dark in the gaps. Each new row is drawn over the one
 *   behind it, because nearer trees hide farther ones. Fills from `top` down to the bottom edge.
 * @param {number} top - the highest row the treetops reach.
 * @param {number} rMin - smallest treetop radius. @param {number} rMax - biggest.
 * @param {number} seed - makes each canopy different.
 */
function canopy(g, c, top, rMin, rMax, seed) {
  box(g, 0, top + rMax, W, H - top - rMax, c.leafDark); // deep shade behind the treetops
  for (let y = top + rMax; y < H + rMax; y += Math.round(rMax * 1.2)) {
    for (let x = -rMax; x < W + rMax;) {
      const r = rMin + Math.round(hash2(x + seed, y) * (rMax - rMin));
      const cx = x + Math.round((hash2(y, x + seed) - 0.5) * r);
      const cy = y + Math.round((hash2(x, y + seed) - 0.5) * 2);
      treetop(g, c, cx, cy, r);
      x += Math.round(r * 1.5);
    }
  }
}

// One round treetop: sunny on the top left, shady on the bottom right, with leafy speckles.
function treetop(g, c, cx, cy, r) {
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    for (let x = -half; x <= half; x++) {
      const light = (x + y) / r; // -1.4 at the top left, +1.4 at the bottom right
      let color = light < -0.55 ? c.leafLight : light > 0.6 ? c.leafDark : c.leaf;
      if (color === c.leaf && speckle(cx + x, cy + y, 0.12)) color = c.leafLight;
      dot(g, cx + x, cy + y, color);
    }
  }
}

// A giant rainforest tree (like a kapok) poking out above the canopy: a tall pale trunk with
// branches, and a wide, flat crown like an umbrella.
function giantTree(g, c, x, baseY, height) {
  const top = baseY - height;
  box(g, x, top, 2, height, c.trunk);
  dot(g, x, top + 3, c.trunkLight);
  for (let i = 1; i < 6; i++) { dot(g, x - i, top + 3 - (i >> 1), c.trunk); dot(g, x + 1 + i, top + 3 - (i >> 1), c.trunk); } // branches
  for (const [dx, dy, r] of [[-8, 0, 4], [9, 0, 4], [-3, -2, 5], [4, -2, 5]]) treetop(g, c, x + dx, top + dy, r);
}

// A tall lightning mast: a thin pole painted in red and white bands (so planes can see it), with
// a red light on top. Lightning hits the mast instead of the rocket.
function lightningMast(g, c, x, baseY, height) {
  for (let i = 0; i < height; i++) {
    const banded = Math.floor(i / 6) % 2 === 1 && i > height - 42; // red bands near the top
    dot(g, x, baseY - i, banded ? c.mastBand : c.mast);
    dot(g, x + 1, baseY - i, banded ? c.red : c.mastShade);
  }
  box(g, x - 1, baseY - height - 1, 4, 1, c.mastShade); // a small cap
  box(g, x, baseY - height - 2, 2, 1, c.red);            // the warning light
}

/**
 * Job: a tall tropical cloud: a stack of puffy balls on a flat base, piling up into a tower.
 *   Each ball is lit from the top left and shaded on its bottom right, and the balls higher up
 *   are drawn last, so they sit in front like real cloud bumps. A white cloud vanishes against the
 *   pale sky near the horizon, so its outline is drawn in the shade color.
 * @param {number} cx - the middle of its flat bottom. @param {number} baseY - the row of its bottom.
 * @param {number} halfW - half its width at the bottom. @param {number} height - how tall it grows.
 */
function cumulus(g, c, cx, baseY, halfW, height) {
  const puffs = [];
  for (let i = 0; i < 10; i++) {
    const level = i / 9;                                          // 0 at the bottom, 1 at the top
    const r = Math.max(3, Math.round((1 - level * 0.5) * halfW * 0.48));
    const px = cx + Math.round((hash2(i, cx) - 0.5) * halfW * (1.5 - level));
    const py = Math.min(baseY - r, Math.round(baseY - r - level * (height - r * 1.4)));
    puffs.push([px, py, r]);
  }
  // Fill in the balls, remembering each pixel's color, so the outline can be found afterwards.
  const shape = new Map();
  for (const [px, py, r] of puffs) {
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) {
        if (py + y >= baseY) continue;                            // the flat bottom
        const light = (x + y) / r;                                // -1.4 top left, +1.4 bottom right
        let color = light > 0.55 ? c.cloudShade : light > 0.15 && mix(px + x, py + y, 0.5) ? c.cloudShade : c.cloud;
        if (py + y >= baseY - 2) color = c.cloudBase;             // a grey, flat underside
        shape.set(`${px + x},${py + y}`, color);
      }
    }
  }
  for (const [key, color] of shape) {
    const [x, y] = key.split(',').map(Number);
    const edge = !shape.has(`${x - 1},${y}`) || !shape.has(`${x + 1},${y}`) || !shape.has(`${x},${y - 1}`);
    dot(g, x, y, edge && color !== c.cloudBase ? c.cloudShade : color);
  }
}

// One of the Îles du Salut: a small island covered in forest, with a few palm trees sticking up.
function salutIsland(g, c, cx, baseY, halfW, h, palms) {
  for (let x = cx - halfW; x <= cx + halfW; x++) {
    const top = Math.round(baseY - h * Math.sqrt(1 - ((x - cx) / (halfW + 1)) ** 2) - (hash2(x, 41) < 0.3 ? 1 : 0));
    for (let y = top; y < baseY; y++) dot(g, x, y, y === top ? c.leafLight : x > cx + 2 ? c.leafDark : c.leaf);
  }
  for (const px of palms) {                       // a thin trunk and a tiny star of leaves
    const ty = Math.round(baseY - h * Math.sqrt(1 - ((px - cx) / (halfW + 1)) ** 2)) - 1;
    box(g, px, ty - 4, 1, 4, c.trunk);
    for (const [dx, dy] of [[-2, 0], [-1, -1], [0, -1], [1, -1], [2, 0]]) dot(g, px + dx, ty - 5 + dy + 1, c.leaf);
  }
}

// A scarlet ibis flying: bright red wings, with lighter tips.
function ibis(g, c, x, y) {
  for (const [dx, dy] of [[-2, 1], [-1, 0], [0, 0], [1, 0], [2, 1]]) dot(g, x + dx, y + dy, c.ibis);
  dot(g, x - 3, y + 1, c.ibisLight);
  dot(g, x + 3, y + 1, c.ibisLight);
}

// A giant jungle leaf (like a banana leaf) growing from (x, y) at an angle in degrees: a long,
// wide leaf with a light middle vein, a darker edge, and a few rips from the wind.
function bigLeaf(g, c, x, y, len, deg) {
  const a = (deg * Math.PI) / 180;
  const [ux, uy] = [Math.cos(a), Math.sin(a)];  // along the leaf
  const [vx, vy] = [-uy, ux];                   // across the leaf
  for (let s = 0; s < len; s++) {
    if (s > 6 && hash2(s, x + len) < 0.12) continue;                // a rip in the leaf
    const half = Math.round(Math.sin((Math.PI * s) / len) * len * 0.16);
    for (let k = -half; k <= half; k++) {
      const color = k === 0 ? c.leafLight : Math.abs(k) > half - 1 ? c.leafDark : k < 0 ? c.leaf : c.leafLight;
      dot(g, Math.round(x + ux * s + vx * k), Math.round(y + uy * s + vy * k), color);
      dot(g, Math.round(x + ux * s + vx * k + 0.5), Math.round(y + uy * s + vy * k), color); // no gaps
    }
  }
}

// A heliconia flower: a hanging zig-zag of red "lobster claw" petals with yellow tips.
function heliconia(g, c, x, y) {
  box(g, x, y - 4, 1, 22, c.leaf);                                  // the stalk
  for (let i = 0; i < 6; i++) {
    const dir = i % 2 ? 1 : -1;
    const py = y + i * 3;
    for (let k = 0; k < 4; k++) dot(g, x + dir * k, py - (k >> 1), k === 3 ? c.yellow : c.red);
    dot(g, x + dir, py + 1, c.red);
  }
}

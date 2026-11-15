// slices/finale/sites/sriharikota.js: Sriharikota, India, drawn in code. Owner: Person 5, Erick.
// See sites/index.js for how the 3 layers (far, mid, near) and parallax work.

import {
  W, H, makeCanvas, drawPad, dot, box, disk, hash2, noise3, RATES, mix, speckle, patch, padGravel, scatterTufts, sprite,
} from './draw.js';

// ---------- 🦚 Sriharikota, India
// The Satish Dhawan Space Centre sits on Sriharikota, a flat, sandy barrier island between the
// Bay of Bengal and the big Pulicat lagoon. Looking out to sea: dark monsoon clouds with rain
// falling from them, little fishing boats, and the other launch pad's big service tower down the
// coast. Around the pad: neat rows of feathery casuarina trees, tall palmyra palms, a calm lagoon
// with pink flamingos (Pulicat is famous for them), and in front, coconut palms and a peacock,
// India's national bird.

const S_SEA_TOP = 106;  // the horizon
const S_SHORE = 117;    // where the waves break on the beach
const S_MID_BASE = 129; // the flat ground line in the middle layer
const S_GROUND_Y = 137; // where the near ground starts

/**
 * Job: Sriharikota's 3 layers.
 * @param {Object} ink - colors by role (launch-anim.js).
 * @returns {Array} - [{ img, rate }] for far, mid and near.
 */
export function sriharikota(ink) {
  // This site's colors, named for what they paint. Each one is a palette color from `ink`.
  const c = {
    seaDeep: ink.sea, seaLight: ink.seaLight, foam: ink.cloud,
    sand: ink.sand, sandShade: ink.sandShade,
    leaf: ink.grassShade, leafLight: ink.grass, leafDark: ink.ring,
    trunk: ink.rockShade, trunkLight: ink.rock, nut: ink.trunk, deadLeaf: ink.trunk,
    storm: ink.stormLight, stormDark: ink.stormDark, stormTop: ink.cloud,
    hull: ink.trunk, hullDark: ink.towerShade, sail: ink.sand,
    tower: ink.rock, towerShade: ink.rockShade, towerDark: ink.ring,
    pink: ink.sand, pinkDeep: ink.stripe, beak: ink.ring,
    peacock: ink.sea, peacockLight: ink.seaLight, tail: ink.grassShade, tailEye: ink.beacon, legs: ink.rock,
    gravel: ink.rock, gravelLight: ink.sand,
  };
  return [
    { img: sriharikotaFar(c), rate: RATES.far },
    { img: sriharikotaMid(c), rate: RATES.mid },
    { img: sriharikotaNear(c, ink), rate: RATES.near },
  ];
}

// Far: monsoon clouds with rain, the Bay of Bengal with fishing boats, the other pad's tower,
// the beach, then casuarina plantations in neat rows all the way down.
function sriharikotaFar(c) {
  const { canvas, g } = makeCanvas(W, H);
  monsoonCloud(g, c, 226, 100, 42, 54, true);
  monsoonCloud(g, c, 44, 101, 24, 30, false);

  // The Bay of Bengal: deep blue, lighter closer in, with whitecaps.
  const LIGHT = [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1];
  for (let y = S_SEA_TOP; y < S_SHORE; y++) {
    const light = LIGHT[y - S_SEA_TOP];
    for (let x = 0; x < W; x++) {
      let color = mix(x, y, light) ? c.seaLight : c.seaDeep;
      if (y > S_SEA_TOP + 3 && hash2(x >> 2, y) < 0.03 + light * 0.05 && speckle(x, y, 0.6)) color = c.foam;
      dot(g, x, y, color);
    }
  }
  boat(g, c, 92, 110);
  boat(g, c, 150, 113);

  // Breaking waves and a long sandy beach.
  for (let x = 0; x < W; x++) {
    dot(g, x, S_SHORE, speckle(x, S_SHORE, 0.7) ? c.foam : c.seaLight);
    dot(g, x, S_SHORE + 1, speckle(x, 71, 0.25) ? c.foam : c.sandShade);
    box(g, x, S_SHORE + 2, 1, 2, c.sand);
  }
  serviceTower(g, c, 282, S_SHORE + 3, 30);

  // Casuarina plantations seen from above: rows of feathery trees with strips of sand between.
  for (let y = S_SHORE + 4; y < H; y++) {
    const row = (y - (S_SHORE + 4)) % 5;           // 4 rows of trees, then 1 row of sand
    for (let x = 0; x < W; x++) {
      let color = speckle(x, y, 0.3) ? c.leafLight : speckle(y, x, 0.08) ? c.leafDark : c.leaf;
      if (row === 4) color = speckle(x, y, 0.3) ? c.sand : c.sandShade;
      dot(g, x, y, color);
    }
  }
  return canvas;
}

// Mid: flat sandy ground, a calm lagoon with flamingos, casuarina trees in a row, palmyra palms
// and a coconut palm.
function sriharikotaMid(c) {
  const { canvas, g } = makeCanvas(W, H);
  for (let y = S_MID_BASE; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const grassy = patch(x, y, 14) > 0.55;
      dot(g, x, y, grassy ? (speckle(x, y, 0.4) ? c.leafLight : c.leaf) : speckle(x, y, 0.15) ? c.sandShade : c.sand);
    }
  }
  lagoon(g, c, 52, S_MID_BASE + 6, 50, 5);
  for (const [x, dy] of [[30, 4], [42, 6], [61, 5], [74, 7]]) flamingo(g, c, x, S_MID_BASE + dy);

  for (let x = 132; x < W; x += 9) casuarina(g, c, x + Math.round(hash2(x, 3) * 4), S_MID_BASE + 1, 17 + Math.round(hash2(x, 4) * 7));
  palmyra(g, c, 116, S_MID_BASE + 1, 30);
  palmyra(g, c, 262, S_MID_BASE + 2, 26);
  coconutPalm(g, c, 98, S_MID_BASE + 2, 22, 1);
  return canvas;
}

// Near: sandy ground with grass, the gravel area, the pad, coconut palms in the corners, and a
// peacock showing off its tail.
function sriharikotaNear(c, ink) {
  const { canvas, g } = makeCanvas(W, H);
  for (let y = S_GROUND_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let color = speckle(x, y, 0.12) ? c.sandShade : c.sand;
      if (y < S_GROUND_Y + 3 || patch(x, y, 24) > 0.66) color = speckle(x, y, 0.4) ? c.leafLight : c.leaf;
      dot(g, x, y, color);
    }
  }
  for (let x = 0; x < W; x++) if (hash2(x, 61) < 0.5) dot(g, x, S_GROUND_Y - 1, c.leafLight); // grass tips
  scatterTufts(g, S_GROUND_Y, 60, c.leaf, c.leafLight);
  padGravel(g, c.gravel, c.gravelLight);
  drawPad(g, ink);

  // Coconut palms in the corners, farther ones first.
  coconutPalm(g, c, 58, 172, 52, 1);
  coconutPalm(g, c, 278, 174, 50, -1);
  coconutPalm(g, c, 20, 182, 72, 1);
  coconutPalm(g, c, 304, 182, 66, -1);

  peacock(g, c, 236, 176);
  return canvas;
}

// ---------- 🖌️ Things only Sriharikota draws

/**
 * Job: a dark monsoon cloud: puffy balls piled into a tall, heavy tower. Its tops catch the sun,
 *   its body is grey and its underside is dark. With `raining`, grey streaks of rain slant down
 *   from its flat bottom to the sea.
 * @param {number} cx - the middle of its flat bottom. @param {number} baseY - the row of its bottom.
 * @param {number} halfW - half its width. @param {number} height - how tall it grows.
 * @param {boolean} raining - draw rain under it.
 */
function monsoonCloud(g, c, cx, baseY, halfW, height, raining) {
  if (raining) {
    for (let y = baseY; y < S_SEA_TOP; y++) {
      for (let x = cx - halfW + 6; x < cx + halfW - 6; x++) {
        const streak = (x + Math.round(y * 0.5)) % 3 === 0;                 // slanting lines
        if (streak && noise3(x / 9, 0.5, 6.1) > 0.4 && mix(x, y, 0.7)) dot(g, x, y, c.storm);
      }
    }
  }
  // Lots of small puffs (not a few big ones), so the edge is bumpy like a cauliflower. Bottom
  // puffs first, so the higher ones sit in front. Shading steps are dithered, so they blend softly.
  for (let i = 0; i < 22; i++) {
    const level = i / 21;                                                   // 0 at the bottom, 1 at the top
    const r = Math.max(3, Math.round((1 - level * 0.4) * halfW * 0.3));
    const px = cx + Math.round((hash2(i, cx) - 0.5) * 2 * halfW * (1 - level * 0.6));
    const py = Math.min(baseY - r, Math.round(baseY - r - level * (height - r * 1.2)));
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y));
      for (let x = -half; x <= half; x++) {
        if (py + y >= baseY) continue;                                      // the flat bottom
        const light = (x + y) / r;                                          // -1.4 top left, +1.4 bottom right
        const b = mix(px + x, py + y, 0.5);
        let color = c.storm;
        if (light < -0.7) color = c.stormTop;                               // sunlit top
        else if (light < -0.35) color = b ? c.stormTop : c.storm;
        else if (light > 0.75) color = c.stormDark;                         // shady side
        else if (light > 0.35) color = b ? c.stormDark : c.storm;
        if (py + y >= baseY - 4) color = py + y >= baseY - 2 || b ? c.stormDark : c.storm; // the dark, heavy underside
        dot(g, px + x, py + y, color);
      }
    }
  }
}

/**
 * Job: a peacock showing off: its tail spread in a big green half-circle fan with gold eye-spots,
 *   and its blue body, neck and crested head standing in front of it.
 * @param {number} x - the middle of its feet. @param {number} baseY - the ground row.
 */
function peacock(g, c, x, baseY) {
  const fx = x;
  const fy = baseY - 8;   // the middle of the fan, behind the bird's back
  const R = 15;           // the fan's size
  for (let y = -R; y <= 0; y++) {
    for (let k = -R; k <= R; k++) {
      const d = Math.hypot(k, y);
      if (d > R || (d > R - 1 && speckle(fx + k, fy + y, 0.5))) continue; // a feathery edge
      const a = Math.atan2(y, k);
      const streak = Math.round(a * 9) % 2 === 0;                        // feathers fanning out
      dot(g, fx + k, fy + y, streak ? c.leafLight : c.tail);
    }
  }
  // Eye-spots: two rings of gold dots with a blue middle, around the fan.
  for (const [ring, count] of [[R - 3, 9], [R - 8, 6]]) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI + ((i + 0.5) / count) * Math.PI;                 // across the top half
      const ex = Math.round(fx + Math.cos(a) * ring);
      const ey = Math.round(fy + Math.sin(a) * ring);
      disk(g, ex, ey, 1, c.tailEye);
      dot(g, ex, ey, c.peacock);
    }
  }
  // The bird in front: a blue body, a long neck, a small head with a crest, a beak and legs.
  sprite(g, x - 3, baseY - 15, [
    '.c.c..',
    '..c...',
    '.bbby.',
    '..bl..',
    '..bl..',
    '.bbb..',
    '.bbbb.',
    'bbbbbb',
    'bbbbbb',
    '.bbbb.',
    '..bb..',
    '..g.g.',
    '..g.g.',
    '..g.g.',
    '.gg.gg',
  ], { c: c.peacockLight, b: c.peacock, l: c.peacockLight, y: c.sandShade, g: c.legs });
}

// A small fishing boat out at sea: a brown hull and a little triangle sail.
function boat(g, c, x, y) {
  box(g, x, y, 7, 1, c.hull);
  box(g, x + 1, y + 1, 5, 1, c.hullDark);
  for (let i = 0; i < 4; i++) box(g, x + 3, y - 1 - i, 4 - i, 1, c.sail);
  box(g, x + 2, y - 5, 1, 5, c.hullDark);                                   // the mast
}

// The other launch pad's tall service tower, far down the coast: a big boxy steel tower with
// platforms every few floors, a small crane on top, and a lightning mast next to it.
function serviceTower(g, c, x, baseY, h) {
  box(g, x, baseY - h, 8, h, c.tower);
  box(g, x + 6, baseY - h, 2, h, c.towerShade);
  for (let y = baseY - h + 3; y < baseY; y += 5) box(g, x, y, 8, 1, c.towerDark);
  box(g, x + 2, baseY - h - 4, 1, 4, c.towerDark);
  box(g, x + 1, baseY - h - 4, 4, 1, c.towerDark);
  box(g, x + 11, baseY - h - 10, 1, h + 10, c.towerDark);
}

// A calm, shallow lagoon: a flat oval of still water with streaks of reflected sky.
function lagoon(g, c, cx, cy, halfW, halfH) {
  for (let y = -halfH; y <= halfH; y++) {
    const half = Math.round(halfW * Math.sqrt(1 - (y / (halfH + 1)) ** 2));
    for (let x = -half; x <= half; x++) {
      const glint = hash2((cx + x) >> 3, cy + y) < 0.15 && speckle(cx + x, cy + y, 0.7);
      dot(g, cx + x, cy + y, glint ? c.foam : c.seaLight);
    }
  }
}

// A flamingo standing in the lagoon: pink body, a curved neck, a dark beak, and long legs.
// (x, y) = where its feet are.
function flamingo(g, c, x, y) {
  sprite(g, x, y - 7, [
    '..pk',
    '..p.',
    '.p..',
    'ppq.',
    'pqqp',
    '.d..',
    '.d..',
  ], { p: c.pink, q: c.pinkDeep, k: c.beak, d: c.pinkDeep });
}

// A casuarina tree: tall, slim and feathery, a bit like a pine. (x, baseY) = the foot of its trunk.
function casuarina(g, c, x, baseY, height) {
  box(g, x, baseY - 3, 1, 3, c.trunk);
  const w = Math.max(2, Math.round(height * 0.16));
  for (let i = 3; i < height; i++) {
    const t = (i - 3) / (height - 3);                         // 0 at the bottom of its leaves, 1 at the tip
    const half = Math.round(w * (1 - t) ** 0.6 + (hash2(i, x) - 0.5) * 1.5);
    for (let k = -half; k <= half; k++) {
      if (Math.abs(k) === half && speckle(x + k, baseY - i, 0.5)) continue; // feathery edges
      dot(g, x + k, baseY - i, speckle(x + k, baseY - i, 0.3) ? c.leafLight : k > 0 ? c.leafDark : c.leaf);
    }
  }
}

// A palmyra palm: a tall, straight, dark trunk with a round, spiky ball of fan-shaped leaves on
// top, and a few dead leaves hanging under it.
function palmyra(g, c, x, baseY, height) {
  box(g, x, baseY - height, 2, height, c.trunk);
  const cy = baseY - height - 3;
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2;
    for (let s = 1; s <= 6; s++) dot(g, Math.round(x + Math.cos(a) * s), Math.round(cy + Math.sin(a) * s * 0.8), s > 4 ? c.leafLight : c.leaf);
  }
  disk(g, x, cy, 2, c.leafDark);
  for (const dx of [-2, 0, 3]) box(g, x + dx, cy + 3, 1, 3, c.deadLeaf);
}

/**
 * Job: a coconut palm: a long, gently curving trunk with ring marks, a crown of long feathery
 *   fronds that arch up and droop at the tips, and a bunch of coconuts.
 * @param {number} x - the foot of the trunk. @param {number} baseY - that row.
 * @param {number} height - how tall. Taller = closer, so the trunk and fronds get thicker.
 * @param {number} lean - 1 or -1: which way it curves.
 */
function coconutPalm(g, c, x, baseY, height, lean) {
  const trunkW = height > 40 ? 3 : 2;
  let tx = x;
  let ty = baseY;
  for (let i = 0; i < height; i++) {
    tx = x + Math.round(Math.sin((i / height) * 1.3) * height * 0.22 * lean); // a graceful curve
    ty = baseY - i;
    box(g, tx, ty, trunkW, 1, i % 4 === 0 ? c.trunkLight : c.trunk);         // ring marks
  }
  const cx = tx + (trunkW >> 1);
  const cy = ty;
  const fronds = 9;
  for (let k = 0; k < fronds; k++) {
    const a = -Math.PI + (k / (fronds - 1)) * Math.PI;                    // from the left, over the top, to the right
    const len = height * (0.42 + hash2(k, x) * 0.12);
    for (let s = 1; s <= len; s++) {
      const fx = Math.round(cx + Math.cos(a) * s);
      const fy = Math.round(cy + Math.sin(a) * s * 0.6 + (s * s) / (len * 1.6)); // the droop
      dot(g, fx, fy, s > len * 0.7 ? c.leafLight : c.leaf);
      if (s > 3 && s % 2 === 0) {                                          // leaflets hanging off the frond
        dot(g, fx, fy + 1, c.leaf);
        if (height > 40) dot(g, fx, fy + 2, c.leafDark);
      }
    }
  }
  for (const [dx, dy] of [[-1, 2], [1, 2], [0, 3]]) disk(g, cx + dx, cy + dy, height > 40 ? 1 : 0, c.nut); // coconuts
}

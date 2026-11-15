// slices/finale/sites/mahia.js: Mahia, New Zealand, drawn in code. Owner: Person 5, Erick.
// See sites/index.js for how the 3 layers (far, mid, near) and parallax work.

import {
  W, H, makeCanvas, drawPad, dot, box, disk, hash2, noise3, RATES, mix, speckle, patch, padGravel, sprite,
} from './draw.js';

// ---------- 🐑 Mahia, New Zealand
// A small launch site at the tip of the Mahia Peninsula: remote sheep farmland on the edge of the
// Pacific. Looking out to sea: a long white cloud along the horizon (New Zealand's Māori name,
// Aotearoa, is often translated as "land of the long white cloud"), the clear, windy Pacific,
// pale layered cliffs across the water, and rocky reef shelves at the shore. Around the pad:
// rolling green paddocks with sheep, a woolshed with a red tin roof, a pōhutukawa tree with red
// flowers, and in front, cabbage trees and flax plants.

const M_SEA_TOP = 106;  // the horizon
const M_SHORE = 117;    // where the waves hit the reef
const M_MID_BASE = 129; // the foot of the rolling hills in the middle layer
const M_GROUND_Y = 136; // where the near ground starts

/**
 * Job: Mahia's 3 layers.
 * @param {Object} ink - colors by role (launch-anim.js).
 * @returns {Array} - [{ img, rate }] for far, mid and near.
 */
export function mahia(ink) {
  // This site's colors, named for what they paint. Each one is a palette color from `ink`.
  const c = {
    seaDeep: ink.sea, seaLight: ink.seaLight, foam: ink.cloud,
    cloud: ink.cloud, cloudShade: ink.seaLight,
    cliff: ink.sand, cliffShade: ink.sandShade, cliffDark: ink.rock,
    reef: ink.rockShade, reefDark: ink.ring,
    grass: ink.grass, grassShade: ink.grassShade, hedge: ink.ring,
    wool: ink.cloud, woolShade: ink.rock, face: ink.ring,
    wall: ink.sand, wallShade: ink.sandShade, roof: ink.stripe, roofShade: ink.towerShade,
    trunk: ink.rockShade, trunkLight: ink.rock, deadLeaf: ink.trunk,
    flower: ink.alarm, stalk: ink.trunk, post: ink.trunk, wire: ink.rockShade,
    gravel: ink.rock, gravelLight: ink.cloud,
  };
  return [
    { img: mahiaFar(c), rate: RATES.far },
    { img: mahiaMid(c), rate: RATES.mid },
    { img: mahiaNear(c, ink), rate: RATES.near },
  ];
}

// Far: the long white cloud, the Pacific, pale cliffs across the water, the reef, then farmland
// paddocks all the way down.
function mahiaFar(c) {
  const { canvas, g } = makeCanvas(W, H);
  longCloud(g, c, 8, 300, 74);

  // The Pacific: deep blue, lighter closer in, with lots of whitecaps (it's windy here).
  const LIGHT = [0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1];
  for (let y = M_SEA_TOP; y < M_SHORE; y++) {
    const light = LIGHT[y - M_SEA_TOP];
    for (let x = 0; x < W; x++) {
      let color = mix(x, y, light) ? c.seaLight : c.seaDeep;
      if (y > M_SEA_TOP + 2 && hash2(x >> 1, y) < 0.04 + light * 0.06 && speckle(x, y, 0.7)) color = c.foam;
      dot(g, x, y, color);
    }
  }
  paleCliffs(g, c, 0, 118);

  // The reef: flat shelves of dark rock with waves breaking on them, then green farmland.
  for (let x = 0; x < W; x++) {
    dot(g, x, M_SHORE, speckle(x, M_SHORE, 0.7) ? c.foam : c.seaLight);
    for (let y = M_SHORE + 1; y < M_SHORE + 3; y++) {
      const rock = patch(x, y, 6) > 0.45;
      dot(g, x, y, rock ? (speckle(x, y, 0.3) ? c.reefDark : c.reef) : speckle(x, y, 0.4) ? c.foam : c.seaLight);
    }
  }
  paddocks(g, c, M_SHORE + 3, 9);
  return canvas;
}

// Mid: rolling green hills with a fence, a flock of sheep, a woolshed and a pōhutukawa tree.
function mahiaMid(c) {
  const { canvas, g } = makeCanvas(W, H);
  // The hills' top edge: a big hill on the left, a smaller one on the right, gentle bumps between.
  const top = [];
  for (let x = 0; x < W; x++) {
    const big = 14 * Math.max(0, 1 - ((x - 64) / 76) ** 2);
    const small = 10 * Math.max(0, 1 - ((x - 252) / 60) ** 2);
    top[x] = Math.round(M_MID_BASE - Math.max(big, small) - 1.5 * noise3(x / 18, 2.5, 0.5));
  }
  // Grass, lit where the hill faces the sun (the left side of each hill) and shaded where it faces away.
  for (let x = 0; x < W; x++) {
    const facingSun = (top[Math.min(W - 1, x + 2)] - top[Math.max(0, x - 2)]) >= 0;
    for (let y = top[x]; y < H; y++) {
      const shade = facingSun ? 0.12 : 0.4;
      dot(g, x, y, y === top[x] ? c.grass : speckle(x, y, shade) ? c.grassShade : c.grass);
    }
  }
  farmFence(g, c, top, 150, 226);
  woolshed(g, c, 40, top[40] + 4);
  pohutukawa(g, c, 288, top[288] + 3);
  for (const [x, dy] of [[86, 6], [96, 9], [104, 5], [118, 10], [196, 8], [208, 5], [232, 9], [246, 6]]) {
    sheep(g, c, x, top[x] + dy, 1);
  }
  return canvas;
}

// Near: green pasture, the gravel area, the small pad, a sheep up close, and cabbage trees and
// flax framing the corners.
function mahiaNear(c, ink) {
  const { canvas, g } = makeCanvas(W, H);
  for (let y = M_GROUND_Y; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const darker = patch(x, y, 20) > 0.6 ? 0.45 : 0.22;     // patches of thicker grass
      dot(g, x, y, speckle(x, y, darker) ? c.grassShade : c.grass);
    }
  }
  for (let x = 0; x < W; x++) if (hash2(x, 37) < 0.5) dot(g, x, M_GROUND_Y - 1, c.grass); // grass tips
  padGravel(g, c.gravel, c.gravelLight);
  drawPad(g, ink);
  sheep(g, c, 226, 158, 2);

  // The corners: cabbage trees behind, flax clumps in front.
  cabbageTree(g, c, 34, 178, 86);
  cabbageTree(g, c, 290, 178, 80);
  cabbageTree(g, c, 64, 164, 38);
  for (const [x, y, size] of [[12, 182, 20], [86, 182, 15], [250, 183, 16], [306, 183, 20]]) flax(g, c, x, y, size);
  return canvas;
}

// ---------- 🖌️ Things only Mahia draws

// The long white cloud: a long, flat band of cloud with a puffy top, stretched along the sky.
// It sits high enough that the sky behind it is blue, so its white shows. Its underside is
// shaded, and its top edge is outlined so it never melts into the sky.
function longCloud(g, c, x0, x1, y) {
  for (let x = x0; x < x1; x++) {
    const ends = Math.min(1, Math.min(x - x0, x1 - x) / 40);       // thinner toward both ends
    const thick = Math.round(ends * (4 + 5 * noise3(x / 16, 1.3, 0.7)));
    if (thick <= 0) continue;
    for (let k = -thick; k <= 2; k++) {
      let color = c.cloud;
      if (k === -thick || k === 2) color = c.cloudShade;           // the top edge and the flat bottom
      else if (k >= 0 && mix(x, y + k, 0.5)) color = c.cloudShade; // a shaded underside
      dot(g, x, y + k, color);
    }
  }
}

// Pale cliffs across the water on the left: the far side of the bay. A green top, then a face of
// pale rock in layers (like a stack of pancakes), dropping to the sea.
function paleCliffs(g, c, x0, x1) {
  for (let x = x0; x < x1; x++) {
    const top = Math.round(96 + ((x - x0) / (x1 - x0)) ** 1.6 * 10 + (hash2(x >> 1, 51) < 0.3 ? 1 : 0)); // slopes down to the right
    for (let y = top; y < M_SEA_TOP + 2; y++) {
      let color = (y - top) % 3 === 2 ? c.cliffShade : c.cliff;   // the rock layers
      if (y - top < 2) color = c.grass;                            // grass on top
      else if (speckle(x, y, 0.08)) color = c.cliffDark;           // cracks and shadows
      dot(g, x, y, color);
    }
    dot(g, x, M_SEA_TOP + 2, speckle(x, 52, 0.6) ? c.foam : c.seaLight); // waves at the cliff's foot
  }
}

// Farmland seen from above, all the way down: a patchwork of paddocks (fields), some greener than
// others, split by dark hedgerows, with sheep as tiny white dots. `size` = how big the paddocks are.
function paddocks(g, c, top, size) {
  for (let y = top; y < H; y++) {
    const band = Math.floor((y - top) / size);                        // which row of paddocks
    const hedgeRow = (y - top) % size === 0 && y > top;
    for (let x = 0; x < W; x++) {
      const cell = Math.floor((x + band * 23) / (size * 4));         // which paddock in the row
      const hedgeCol = (x + band * 23) % (size * 4) === 0;
      let color = hash2(cell, band) < 0.4 ? (speckle(x, y, 0.4) ? c.grassShade : c.grass) : speckle(x, y, 0.12) ? c.grassShade : c.grass;
      if (hedgeRow || hedgeCol) color = speckle(x, y, 0.5) ? c.hedge : c.grassShade;
      else if (hash2(x, y + 99) < 0.006) color = c.wool;            // a faraway sheep
      dot(g, x, y, color);
    }
  }
}

// A sheep, facing right: a fluffy white body, a dark face and legs. scale 2 for a close-up one.
// (x, y) = where its feet stand.
function sheep(g, c, x, y, scale) {
  sprite(g, x, y - 4 * scale, [
    '.www..',
    'wwwwwf',
    'swwws.',
    '.f.f..',
  ], { w: c.wool, s: c.woolShade, f: c.face }, scale);
}

// A farm fence across the hill: a wooden post every 7 pixels with a wire, following the ground.
function farmFence(g, c, top, x0, x1) {
  for (let x = x0; x <= x1; x++) {
    const y = top[x] + 5;
    dot(g, x, y - 2, c.wire);
    if ((x - x0) % 7 === 0) box(g, x, y - 4, 1, 4, c.post);
  }
}

// A woolshed: a farm shed where sheep are shorn, with pale walls and a red corrugated-iron roof.
// (x, baseY) = its bottom-left corner.
function woolshed(g, c, x, baseY) {
  box(g, x, baseY - 7, 16, 7, c.wall);                             // the walls
  box(g, x + 11, baseY - 7, 5, 7, c.wallShade);                    // the shady end
  box(g, x + 3, baseY - 4, 3, 4, c.face);                          // a door
  for (let i = 0; i < 4; i++) box(g, x - 1 + i, baseY - 8 - i, 18 - i * 2, 1, i % 2 ? c.roofShade : c.roof); // the roof
}

// A pōhutukawa: New Zealand's coastal "Christmas tree", with a gnarled trunk, a wide dark-green
// crown, and bright red flowers.
function pohutukawa(g, c, x, baseY) {
  for (let i = 0; i < 9; i++) { dot(g, x - (i >> 2), baseY - i, c.trunk); dot(g, x + 1 + (i >> 1), baseY - i, c.trunk); } // two leaning trunks
  for (const [dx, dy, r] of [[-6, -10, 5], [3, -12, 6], [10, -9, 4]]) {
    const cx = x + dx, cy = baseY + dy;
    for (let y = -r; y <= r; y++) {
      const half = Math.round(Math.sqrt(r * r - y * y) * 1.3);       // a bit wider than tall
      for (let k = -half; k <= half; k++) {
        let color = (k + y) / r > 0.5 ? c.hedge : c.grassShade;
        if (hash2(cx + k, cy + y) < 0.22) color = c.flower;          // its red flowers
        dot(g, cx + k, cy + y, color);
      }
    }
  }
}

// A cabbage tree: a tall, thin trunk that splits into a few arms, each with a spiky tuft of long
// leaves on top and a skirt of old brown leaves hanging under it. (x, baseY) = the foot of the trunk.
function cabbageTree(g, c, x, baseY, height) {
  const fork = baseY - Math.round(height * 0.6);
  box(g, x, fork, 2, baseY - fork, c.trunk);
  dot(g, x, fork + 4, c.trunkLight);
  const arms = [[-9, -0.4], [0, -0.42], [8, -0.35]];
  for (const [dx, rise] of arms) {
    const tipX = x + dx;
    const tipY = fork - Math.round(height * -rise * 0.7);
    for (let i = 0; i <= 8; i++) dot(g, Math.round(x + (dx * i) / 8), Math.round(fork + ((tipY - fork) * i) / 8), c.trunk); // the arm
    tuft(g, c, tipX, tipY, Math.round(height * 0.16));
  }
}

// A spiky tuft of long, thin, green leaves bursting out in all directions, with a short skirt of
// old brown leaves hanging straight down under it.
function tuft(g, c, x, y, len) {
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    if (Math.sin(a) > 0.75) continue;                               // straight down is the skirt (below)
    for (let s = 1; s <= len; s++) {
      dot(g, Math.round(x + Math.cos(a) * s), Math.round(y + Math.sin(a) * s * 0.85), s > len - 3 ? c.grass : c.grassShade);
    }
  }
  for (let k = -2; k <= 2; k++) box(g, x + k, y + 2, 1, 3 + ((k + 2) % 2), c.deadLeaf); // the brown skirt
}

// A flax plant (harakeke): a fan of long, stiff, sword-like leaves, and tall stalks with red
// flowers near the top. (x, baseY) = the middle of its base. size = how tall the leaves are.
function flax(g, c, x, baseY, size) {
  for (const [deg, len] of [[-150, 0.8], [-130, 1], [-112, 1.05], [-96, 1.1], [-80, 1], [-62, 0.95], [-40, 0.75]]) {
    const a = (deg * Math.PI) / 180;
    const L = Math.round(size * len);
    for (let s = 0; s < L; s++) {
      const bend = (s * s) / (L * 6);                                // the tips bend over a little
      const px = Math.round(x + Math.cos(a) * s);
      const py = Math.round(baseY + Math.sin(a) * s + bend);
      dot(g, px, py, s > L - 3 ? c.grass : c.grassShade);
      dot(g, px + 1, py, c.hedge);                                   // a dark edge makes each leaf read
    }
  }
  for (const dx of [-3, 4]) {                                        // flower stalks, taller than the leaves
    const top = baseY - Math.round(size * 1.6);
    box(g, x + dx, top, 1, baseY - top, c.stalk);
    for (let i = 0; i < 6; i++) dot(g, x + dx + (i % 2 ? 1 : -1), top + 1 + i * 2, c.flower);
  }
}

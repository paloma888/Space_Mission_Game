// slices/finale/sites/draw.js: the shared toolbox for drawing launch sites. Owner: Person 5, Erick.
// Every site file (canaveral.js, kodiak.js, ...) imports its tools from here, so they all draw the
// same way: layer speeds, dithering, grass tufts, the gravel around the pad, islands, sprites.

export { W, H, makeCanvas, drawPad, dot, box, disk } from '../launch-art.js';
export { hash2, noise3 } from '../pixel.js';
import { W, H, dot } from '../launch-art.js';
import { hash2, noise3, BAYER } from '../pixel.js';

// How fast each layer slides, compared with the ground (1 = moves with the ground).
export const RATES = { far: 0.35, mid: 0.65, near: 1 };

// True for a share `t` (0 to 1) of the pixels, spread evenly by the BAYER pattern.
// mix(x, y, 0.5) gives a checkerboard-like 50/50 mix of two colors. Good for water and sky.
export const mix = (x, y, t) => BAYER[(y & 3) * 4 + (x & 3)] < t;
// True for a share `t` of the pixels, scattered unevenly. Good for plants and dirt, which
// would look like a checkerboard with mix().
export const speckle = (x, y, t) => hash2(x, y) < t;
// Soft, blotchy patches from 0 to 1, about `size` pixels across. Makes big areas less flat.
export const patch = (x, y, size) => noise3(x / size, y / (size * 0.5), 0.5);
// Half the width of the gravel area around the pad, at row y. It widens toward us.
export const padHalf = (y) => 46 + (y - 152) * 1.15;

// A small grass tuft: a dark root and three light blades.
export function tuft(g, x, y, base, tip) {
  dot(g, x, y, base);
  dot(g, x - 1, y - 1, tip);
  dot(g, x + 1, y - 1, tip);
  dot(g, x, y - 2, tip);
}

// Scatters `count` grass tufts over the near ground, but none on the gravel around the pad.
export function scatterTufts(g, groundY, count, base, tip) {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash2(i, 7) * W);
    const y = groundY + 7 + Math.floor(hash2(i, 8) * (H - groundY - 7));
    if (y >= 150 && Math.abs(x - 160) < padHalf(y) + 4) continue;
    tuft(g, x, y, base, tip);
  }
}

// The gravel area: a wide oval of crushed rock around the pad (it widens toward us), with a
// soft, dithered edge. Every site has one, so the pad always sits on the same kind of ground.
export function padGravel(g, base, light) {
  for (let y = 152; y < H; y++) {
    const half = padHalf(y);
    for (let x = Math.ceil(160 - half); x <= Math.floor(160 + half); x++) {
      const edge = Math.min(x - (160 - half), 160 + half - x); // how far inside the oval's edge
      if (edge < 3 && !mix(x, y, edge / 3)) continue;
      dot(g, x, y, hash2(x, y) < 0.15 ? light : base);
    }
  }
}

// A small rocky island far out at sea, with grass on top.
export function island(g, c, cx, baseY, halfW, h) {
  for (let x = cx - halfW; x <= cx + halfW; x++) {
    const top = Math.round(baseY - h * Math.sqrt(1 - ((x - cx) / (halfW + 1)) ** 2));
    for (let y = top; y < baseY; y++) dot(g, x, y, y - top < 2 ? c.grass : x > cx ? c.rockShade : c.rock);
  }
}

// Draws a tiny picture typed as rows of letters, like ['.kk.', 'kook']. Each letter is looked up
// in `colors` (for example { k: black, o: orange }); '.' or any letter not listed stays see-through.
// (x, y) is the picture's top-left corner. scale 2 draws every letter as a 2x2 block (for things
// close to us). Handy for animals and small details.
export function sprite(g, x, y, rows, colors, scale = 1) {
  rows.forEach((row, r) => [...row].forEach((ch, col) => {
    if (!colors[ch]) return;
    g.fillStyle = colors[ch];
    g.fillRect(x + col * scale, y + r * scale, scale, scale);
  }));
}

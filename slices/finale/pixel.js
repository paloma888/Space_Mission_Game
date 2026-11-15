// slices/finale/pixel.js: a small pixel-art toolbox shared by the launch animation and the 3D globe.
// Owner: Person 5. These used to live inside orbit-explorer.js. They moved here so both animations
// share ONE copy instead of two that could drift apart.

// ---------- Small math helpers

// Degrees to radians (JavaScript's Math.sin and Math.cos use radians).
export const rad = (d) => (d * Math.PI) / 180;
// Keeps a number between lo and hi. Same idea as clamp in core/state.js.
export const clampN = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// ---------- Dithering
// A 4x4 "ordered dither" pattern. With only 16 colors we can't fade smoothly, so instead we mix two
// colors in a checkerboard-like pattern: more of color B as we get further along. Old games did this.
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);

// ---------- Repeatable "randomness" for visuals
// hash() turns a number into a jumbled-looking number from 0 to 1. Same input, same output, every time.
// Stars, clouds, smoke and sparks use it instead of the game's random(), so visuals never use up the
// seeded dice (and ?seed=7 keeps replaying the same game).
export function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export const hash2 = (x, y) => hash(Math.imul(x, 73856093) ^ Math.imul(y, 19349663));
export const hash3 = (x, y, z) => hash(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791));

// Smooth blobs for clouds: blend the hash values at the 8 corners of the cube around a point.
export function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const fx = x - xi, fy = y - yi, fz = z - zi;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const lerp = (a, b, k) => a + (b - a) * k;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v),
    w);
}

// ---------- The team's palette (core/base.css --c0 to --c15)

/**
 * Job: reads the team's 16 colors from the page's CSS, so a palette swap changes our art too.
 * @returns {Object} - the same 16 colors in three forms:
 *   rgb - [[r, g, b], ...]    for math (finding the closest color)
 *   u32 - canvas-ready numbers for pixel-by-pixel drawing (the globe)
 *   hex - '#rrggbb' strings   for normal canvas drawing (the launch)
 */
export function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const rgb = [], u32 = [], hex = [];
  for (let i = 0; i < 16; i++) {
    const raw = (css.getPropertyValue(`--c${i}`).trim() || '#000000').replace('#', '');
    const n = parseInt(raw.length === 3 ? raw.replace(/./g, '$&$&') : raw.slice(0, 6), 16) || 0;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    rgb.push([r, g, b]);
    u32.push(((255 << 24) | (b << 16) | (g << 8) | r) >>> 0); // ImageData byte order is R, G, B, A
    hex.push(`#${n.toString(16).padStart(6, '0')}`);
  }
  return { rgb, u32, hex };
}

// How different two colors look. Plain RGB distance, weighted the way eyes see ("redmean"):
// we notice green differences most, and red and blue differences change with how red the colors are.
function colorDistance([r1, g1, b1], [r2, g2, b2]) {
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

// The palette number (0 to 15) that looks closest to an [r, g, b] color.
export function nearestColor(pal, rgb) {
  let best = 0, bestD = Infinity;
  pal.rgb.forEach((c, i) => {
    const d = colorDistance(c, rgb);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

/**
 * Job: picks palette colors by DESCRIPTION instead of by number.
 *   We describe each color by what it should look like ('#6a98d0' = "sky blue"), and this finds the
 *   closest of the team's 16. If the team swaps palettes again, everything still picks sensible colors.
 * @param {Object} pal - from readPalette().
 * @param {Object} wanted - { role: '#rrggbb' }, e.g. { ocean: '#5a8ad0', sand: '#ecc4a8' }.
 * @returns {Object} - { role: paletteNumber }, e.g. { ocean: 12, sand: 15 }.
 */
export function pickColors(pal, wanted) {
  const out = {};
  for (const [role, hex] of Object.entries(wanted)) {
    const n = parseInt(hex.replace('#', ''), 16);
    out[role] = nearestColor(pal, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  return out;
}

// The palette number closest to a darker version of color `index` (for shadows and dim lights).
export function darker(pal, index, amount = 0.55) {
  return nearestColor(pal, pal.rgb[index].map((v) => v * amount));
}

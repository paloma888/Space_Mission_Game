// slices/finale/orbit-explorer.js: the explorable orbit view for the winning endings. Owner: Erick 😼.
// A small "3D" globe drawn pixel by pixel on a 320x180 canvas and shown at 4x. It keeps the
// pixel-art look and needs no 3D library (Rulebook 11: no frameworks, no npm).
// Drag to spin, scroll or pinch to zoom, click the capsule, launch site, Sun or Moon to read about them.
//
// Earth art: if someone hand-draws art/sprites/earth_map.png (a flat world map, for example
// 128x64, palette colors only), the globe uses it automatically. Until then it uses the rough
// continent outlines at the bottom of this file.

import { button } from '../../core/ui.js';

const W = 320;
const H = 180;
const CX = W / 2;
const CY = 97; // a bit below center, because the dashboard covers the top 14 art pixels
const ZOOM_MIN = 28;
const ZOOM_MAX = 360;
const ZOOM_START = 62;
const STAR_FOCAL = 160; // how wide the sky looks. Bigger means a narrower view of the stars
const ORBIT_RADIUS = 1.12; // in Earth radii. Real low orbit is about 1.06; a bit higher reads better
const ORBIT_SECONDS = 24; // one lap on screen (the real one takes about 90 minutes)
const SPIN_SECONDS = 120; // one Earth turn on screen

// Palette indices (core/base.css --c0 to --c15). Each surface has a [day, dusk, night] color.
const OCEAN = 12, LAND = 3, DRY = 4, ICE = 7;
const TONES = { [OCEAN]: [12, 1, 1], [LAND]: [3, 5, 1], [DRY]: [4, 5, 1], [ICE]: [7, 6, 5] };
const CLOUD = [7, 6];
const CLOUD_CUTOFF = 0.66;
const CITY = 10;
const FIREWORK_COLORS = [8, 9, 10, 11, 12, 14];

// Real launch-site coordinates in degrees (rounded). Only used to place the blinking marker.
// The five sites from Amendment A1 (south and west are negative).
const SITES = {
  canaveral: { name: 'Cape Canaveral', lat: 28.5, lon: -80.6 },
  kodiak: { name: 'Kodiak', lat: 57.4, lon: -152.3 },
  kourou: { name: 'Kourou', lat: 5.2, lon: -52.8 },
  mahia: { name: 'Mahia', lat: -39.3, lon: 177.9 },
  sriharikota: { name: 'Sriharikota', lat: 13.7, lon: 80.2 },
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((n) => (n + 0.5) / 16);
// Degrees to radians (JavaScript's Math.sin and Math.cos use radians).
const rad = (d) => (d * Math.PI) / 180;
// Keeps a number between lo and hi. Same idea as clamp in core/state.js.
const clampN = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Job: puts the interactive 3D globe on the page and keeps it running until destroy() is called.
 *   Everything below lives inside this one function so the pieces can share the camera and canvas:
 *   setup (canvas, palette, Earth map, camera, Sun, Moon, stars, orbit) -> overlay (info box, zoom
 *   buttons) -> input (drag, pinch, wheel, keys, click) -> drawing helpers -> the tick() loop.
 * @param {HTMLElement} parent - where to put the globe (the screen from ui.screen()).
 * @param {Object} state - the shared backpack. Reads site, orbit, crew names and launchDay. Never changes it.
 * @param {Object} opts - { celebrate: true } for fireworks, { aliens: true } for the UFO (paused, A6).
 * @returns {Object} - { destroy }. Call destroy() to stop the loop and remove the globe from the page.
 * ⭐
 */
export function mountOrbitExplorer(parent, state, opts = {}) {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.className = 'fin-canvas';
  canvas.setAttribute('aria-label', 'Your capsule in orbit around the Earth. Drag to look around.');
  parent.append(canvas);
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(W, H);
  const buf = new Uint32Array(image.data.buffer);
  const pal = readPalette();
  const P = pal.u32;

  let surface = buildSurface();
  loadSurfaceArt(pal.rgb).then((s) => { if (s) surface = s; });

  // ---------- 📷 CAMERA ----------
  // yaw   = turn left/right, like shaking your head "no". Spins Earth like a desk globe on its stand.
  // pitch = tilt up/down, like nodding "yes". Shows more of the North or South Pole.
  // r     = Earth's radius on screen, in pixels. This IS the zoom: bigger r, bigger Earth.
  // vyaw, vpitch = leftover speed after a drag, so the globe glides to a stop.
  // Angles are in radians: a full turn is 2π (about 6.28), and 1 radian is about 57°.
  // Secret: the camera never moves. It turns the whole world in front of a camera that stays still
  // (toView). Like spinning a globe instead of walking around it: the picture looks the same.
  const site = SITES[state.site] ?? SITES.canaveral;
  const cam = { yaw: rad(site.lon) + 0.35, pitch: clampN(rad(site.lat) * 0.7, -1.2, 1.2), r: ZOOM_START, vyaw: 0, vpitch: 0 };
  const home = { ...cam };
  let cyw, syw, cp, sp; // cached sines and cosines of the camera angles, refreshed every frame
  const setCam = () => { cyw = Math.cos(cam.yaw); syw = Math.sin(cam.yaw); cp = Math.cos(cam.pitch); sp = Math.sin(cam.pitch); };
  setCam();

  // 📷 World to view: turn by yaw, then tilt by pitch (the standard sin/cos rotation formulas).
  // After this, x is right, y is up, and z points out of the screen at the player.
  const toView = (x, y, z) => {
    const x1 = x * cyw - z * syw;
    const z1 = x * syw + z * cyw;
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  };
  // View to world: the reverse turn. Answers "which point on the globe is under this pixel?"
  const fromView = (x, y, z) => {
    const y1 = y * cp + z * sp;
    const z1 = -y * sp + z * cp;
    return [x * cyw + z1 * syw, y1, z1 * cyw - x * syw];
  };

  // The Sun and Moon are placed relative to the starting view: the Sun lights the front-left,
  // and the Moon hides off to the right so the player can go looking for it.
  const sun = fromView(...normalize([-0.55, 0.45, 0.7]));
  const moon = fromView(...normalize([0.95, 0.25, -0.25]));

  const stars = Array.from({ length: 380 }, (_, i) => {
    const z = hash(i * 3 + 1) * 2 - 1;
    const a = hash(i * 3 + 2) * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    const b = hash(i * 3 + 3);
    return { d: [r * Math.cos(a), z, r * Math.sin(a)], c: b > 0.85 ? 7 : b > 0.5 ? 6 : 13 };
  });

  // ---------- The orbit. It is tilted at least as much as the launch site's latitude, because a
  // rocket can't reach a flatter orbit without extra fuel. It starts right over the launch site.
  const inc = state.orbit === 'polar' ? rad(90) : rad(Math.max(Math.abs(site.lat), 15));
  const theta0 = Math.asin(clampN(Math.sin(rad(site.lat)) / Math.sin(inc), -1, 1));
  const node = rad(site.lon) - Math.atan2(Math.sin(theta0) * Math.cos(inc), Math.cos(theta0));
  // The 3D position on the orbit circle at angle theta. The capsule moves by increasing theta over time.
  const orbitPoint = (theta, radius = ORBIT_RADIUS) => {
    const x = Math.sin(theta) * Math.cos(inc);
    const y = Math.sin(theta) * Math.sin(inc);
    const z = Math.cos(theta);
    const [rx, rz] = turnY(x, z, node);
    return [rx * radius, y * radius, rz * radius];
  };
  const siteDir = latLonToVec(site.lat, site.lon);

  // ---------- Overlay: info box and zoom buttons
  const info = document.createElement('div');
  info.className = 'panel fin-info';
  info.hidden = true;
  let infoTimer = null;
  // Shows the fact box (title and text) for 8 seconds after the player clicks something.
  const showInfo = (title, text) => {
    const h = document.createElement('h2');
    h.className = 'panel-title';
    h.textContent = title;
    const p = document.createElement('p');
    p.textContent = text;
    info.replaceChildren(h, p);
    info.hidden = false;
    clearTimeout(infoTimer);
    infoTimer = setTimeout(() => { info.hidden = true; }, 8000);
  };
  const zoom = document.createElement('div');
  zoom.className = 'fin-zoom';
  zoom.append(
    button('+', () => zoomBy(1.25), { variant: 'quiet' }),
    button('-', () => zoomBy(0.8), { variant: 'quiet' }),
    button('Reset', () => Object.assign(cam, home, { vyaw: 0, vpitch: 0 }), { variant: 'quiet' }),
  );
  parent.append(info, zoom);
  // Zoom = the Earth's size on screen. f above 1 zooms in, below 1 zooms out.
  const zoomBy = (f) => { cam.r = clampN(cam.r * f, ZOOM_MIN, ZOOM_MAX); touch(); };

  // ---------- Input: drag to spin (like grabbing the globe), wheel or pinch to zoom, click to inspect
  const pointers = new Map();
  let dragDistance = 0;
  let lastInteract = 0;
  let pinchStart = null;
  // Remembers when the player last did something, so the slow idle drift waits until they stop.
  const touch = () => { lastInteract = performance.now(); };
  // Converts a mouse or finger position on the page into a pixel on the 320x180 canvas.
  const toCanvas = (e) => {
    const box = canvas.getBoundingClientRect(); // includes the #app scale, so clicks land right
    return [((e.clientX - box.left) / box.width) * W, ((e.clientY - box.top) / box.height) * H];
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, toCanvas(e));
    if (pointers.size === 1) dragDistance = 0;
    if (pointers.size === 2) pinchStart = { dist: pinchDistance(), r: cam.r };
    cam.vyaw = cam.vpitch = 0;
    touch();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    const [x, y] = toCanvas(e);
    const [ox, oy] = pointers.get(e.pointerId);
    pointers.set(e.pointerId, [x, y]);
    if (pointers.size === 2 && pinchStart) {
      dragDistance = 99;
      cam.r = clampN(pinchStart.r * (pinchDistance() / pinchStart.dist), ZOOM_MIN, ZOOM_MAX);
    } else if (pointers.size === 1) {
      dragDistance += Math.abs(x - ox) + Math.abs(y - oy);
      // 📷 DRAG TO TURN: sideways movement changes yaw, up/down changes pitch.
      // Dividing by the zoom (cam.r) makes it feel like grabbing the surface: the spot under the
      // finger stays under the finger. Dragging one Earth-radius across turns it 1 radian (about 57°).
      cam.vyaw = -(x - ox) / cam.r;
      cam.vpitch = (y - oy) / cam.r;
      cam.yaw += cam.vyaw;
      cam.pitch = clampN(cam.pitch + cam.vpitch, -1.4, 1.4);
    }
    touch();
  });
  // Finger or mouse lifted. If it barely moved, it was a click, not a drag, so inspect what's there.
  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const pos = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (e.type === 'pointerup' && pointers.size === 0 && dragDistance < 3) inspect(...pos);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.r = clampN(cam.r * Math.exp(-e.deltaY * 0.0015), ZOOM_MIN, ZOOM_MAX);
    touch();
  }, { passive: false });
  // Keyboard controls: arrow keys spin, + and - zoom.
  const onKey = (e) => {
    const k = e.key;
    if (k === 'ArrowLeft') cam.yaw += 0.08;
    else if (k === 'ArrowRight') cam.yaw -= 0.08;
    else if (k === 'ArrowUp') cam.pitch = clampN(cam.pitch - 0.08, -1.4, 1.4);
    else if (k === 'ArrowDown') cam.pitch = clampN(cam.pitch + 0.08, -1.4, 1.4);
    else if (k === '+' || k === '=') zoomBy(1.15);
    else if (k === '-') zoomBy(1 / 1.15);
    else return;
    e.preventDefault();
    touch();
  };
  window.addEventListener('keydown', onKey);

  // How far apart two fingers are. Pinch zoom compares this to where the pinch started.
  function pinchDistance() {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
  }

  // ---------- Things on screen this frame, kept for click tests
  let spots = [];

  /**
   * Job: handles a click. Checks the clickable things drawn this frame (`spots`: capsule, launch
   *   site, Sun, Moon) and shows the first one under the click. If the click hits Earth instead,
   *   works out the latitude and longitude there and shows that.
   * @param {number} x - click position on the 320x180 canvas.
   * @param {number} y - same, up and down.
   */
  function inspect(x, y) {
    for (const s of spots) {
      if (Math.hypot(x - s.x, y - s.y) <= s.r) { showInfo(s.title, s.text); return; }
    }
    const dx = (x - CX) / cam.r;
    const dy = -(y - CY) / cam.r;
    if (dx * dx + dy * dy < 1) {
      const [wx, wy, wz] = fromView(dx, dy, Math.sqrt(1 - dx * dx - dy * dy));
      const [ex, ez] = turnY(wx, wz, -spinAt(now));
      const lat = Math.round((Math.asin(wy) * 180) / Math.PI);
      const lon = Math.round((Math.atan2(ex, ez) * 180) / Math.PI);
      showInfo('Earth', `Near ${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon)}°${lon >= 0 ? 'E' : 'W'}. From orbit, your crew can cross a whole ocean in under an hour.`);
    }
  }

  // ---------- Drawing
  // How far Earth has turned after t seconds (one full turn every SPIN_SECONDS).
  const spinAt = (t) => (t * Math.PI * 2) / SPIN_SECONDS;
  // A 3D point near Earth (capsule, orbit, site) -> a pixel on screen. `hidden` = behind the globe.
  const project = (p) => {
    const v = toView(...p);
    return { x: CX + v[0] * cam.r, y: CY - v[1] * cam.r, z: v[2], hidden: v[2] < 0 && v[0] * v[0] + v[1] * v[1] < 1 };
  };
  // A direction in the far-away sky (star, Sun, Moon) -> a pixel on screen, or null if it's behind you.
  const skyPoint = (d) => {
    const v = toView(...d);
    if (v[2] <= 0.05) return null;
    return { x: CX + (v[0] / v[2]) * STAR_FOCAL, y: CY - (v[1] / v[2]) * STAR_FOCAL };
  };
  // Colors one pixel with palette color c, ignoring anything off the edge of the canvas.
  const plot = (x, y, c) => {
    x |= 0; y |= 0;
    if (x >= 0 && y >= 0 && x < W && y < H) buf[y * W + x] = P[c];
  };

  // The Sun and Moon can sit behind the globe. Then a click there means Earth, not them.
  const behindEarth = (q) => Math.hypot(q.x - CX, q.y - CY) < cam.r;

  // Draws the stars, then the Sun and Moon, and makes the Sun and Moon clickable.
  function drawSky() {
    for (const s of stars) {
      const q = skyPoint(s.d);
      if (q) plot(q.x, q.y, s.c);
    }
    const sunAt = skyPoint(sun);
    if (sunAt) {
      disc(sunAt.x, sunAt.y, 7, () => 9);
      disc(sunAt.x, sunAt.y, 5, () => 10);
      if (!behindEarth(sunAt)) spots.push({ x: sunAt.x, y: sunAt.y, r: 9, title: 'The Sun', text: 'Sunlight takes about 8 minutes to reach Earth. Never look straight at the real one!' });
    }
    const moonAt = skyPoint(moon);
    if (moonAt) {
      const sv = toView(...sun);
      disc(moonAt.x, moonAt.y, 5, (nx, ny, nz, px, py) => {
        const light = nx * sv[0] + ny * sv[1] + nz * sv[2];
        if (light < -0.05) return 1;
        return (px * 7 + py * 3) % 11 === 0 ? 5 : 6; // a few crater pixels
      });
      if (!behindEarth(moonAt)) spots.push({ x: moonAt.x, y: moonAt.y, r: 8, title: 'The Moon', text: 'About 384,000 km away. Getting there is a mission for another day.' });
    }
  }

  // A small shaded ball at a screen point. colorAt gets the surface normal and pixel position.
  function disc(cx, cy, r, colorAt) {
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        const d2 = (x * x + y * y) / (r * r);
        if (d2 > 1) continue;
        plot(cx + x, cy + y, colorAt(x / r, -y / r, Math.sqrt(1 - d2), x + 99, y + 99));
      }
    }
  }

  /**
   * Job: draws the globe, one pixel at a time. For every pixel inside Earth's circle:
   *   1. Depth from the circle: sqrt(1 - x² - y²) gives the 3D point on the ball's surface.
   *   2. Undo the camera (fromView) and the planet's spin -> latitude and longitude.
   *   3. Look up that spot on the flat world map (ocean, land, desert or ice).
   *   4. Light it: how directly the Sun hits it picks a day, dusk or night color (with a checkerboard blend).
   *   5. Clouds on the day side, city lights on the night side of land.
   *   Pixels just outside the circle become the thin blue atmosphere glow.
   * @param {number} t - seconds since the globe started (clouds drift with it).
   * @param {number} spin - how far Earth has turned, in radians.
   * ⭐
   */
  function drawEarth(t, spin) {
    const R = cam.r;
    const outer = (R + 2) * (R + 2);
    const cs = Math.cos(spin), ss = Math.sin(spin);
    const [sx, sy, sz] = sun;
    const x0 = Math.max(0, Math.floor(CX - R - 2)), x1 = Math.min(W - 1, Math.ceil(CX + R + 2));
    const y0 = Math.max(0, Math.floor(CY - R - 2)), y1 = Math.min(H - 1, Math.ceil(CY + R + 2));
    const drift = t * 0.04;
    for (let py = y0; py <= y1; py++) {
      const dy = py + 0.5 - CY;
      for (let px = x0; px <= x1; px++) {
        const dx = px + 0.5 - CX;
        const d2 = dx * dx + dy * dy;
        if (d2 > outer) continue;
        const b = BAYER[(py & 3) * 4 + (px & 3)];

        // ---------- 🔵 THE 3D TRICK (Pythagoras) ----------
        // Earth's SIZE on screen is just R (the zoom). This math makes it look ROUND, not flat.
        // vx, vy = where this pixel sits inside the circle, as a fraction of the radius (-1 to 1).
        // n2 = vx² + vy²: how far from the center (squared). 1 or more means outside the circle.
        let vx = dx / R, vy = -dy / R;
        const n2 = vx * vx + vy * vy;

        if (n2 >= 1) { // thin glowing atmosphere just outside the edge
          const k = 1 / Math.sqrt(n2);
          const [wx, wy, wz] = fromView(vx * k, vy * k, 0);
          const light = wx * sx + wy * sy + wz * sz;
          if (light > -0.25 + b * 0.3) buf[py * W + px] = P[12];
          else if (light > -0.6) buf[py * W + px] = P[1];
          continue;
        }

        // 🔵 Round, like a ball (what we do): for each pixel, Pythagoras works out how much the ball
        //   bulges toward you at that spot. On a ball of radius 1, x² + y² + z² = 1, so z = √(1 − x² − y²).
        //   center -> z = 1 (surface faces you)    edge -> z = 0 (surface curves away)
        // (vx, vy, vz) is a real 3D point on the ball. That's what squeezes the map near the edges
        // and lets the Sun shade it like a ball. Without vz, the map would look like a flat sticker.
        const vz = Math.sqrt(1 - n2);
        // 📷 Undo the camera turn: which point on the actual globe is under this pixel?
        const [wx, wy, wz] = fromView(vx, vy, vz);
        // Earth-fixed position: undo the planet's spin so the map turns under the Sun.
        const ex = wx * cs - wz * ss;
        const ez = wz * cs + wx * ss;
        const lat = Math.asin(wy);
        const lon = Math.atan2(ex, ez);
        const mx = Math.min(surface.w - 1, Math.floor((lon / (Math.PI * 2) + 0.5) * surface.w));
        const my = Math.min(surface.h - 1, Math.floor((0.5 - lat / Math.PI) * surface.h));
        const kind = surface.data[my * surface.w + mx];
        const light = wx * sx + wy * sy + wz * sz;

        let c;
        // About 15% cloud cover. Raise CLOUD_CUTOFF for clearer skies, lower it for more clouds.
        const cloud = noise3(ex * 4 + drift, wy * 5, ez * 4) * 0.65 + noise3(ex * 9, wy * 9, ez * 9 + drift) * 0.35;
        if (cloud > CLOUD_CUTOFF && light > -0.05 + b * 0.1) {
          c = light > 0.15 ? CLOUD[0] : CLOUD[1];
        } else {
          c = shade(TONES[kind] ?? [kind, 5, 1], light, b);
          // City lights sprinkle the night side of the land.
          if (light < -0.12 && kind !== OCEAN && kind !== ICE
            && hash2(Math.floor((lon + Math.PI) * 57.3), Math.floor((lat + 2) * 57.3)) < 0.06) c = CITY;
        }
        buf[py * W + px] = P[c];
      }
    }
  }

  // Draws the dotted orbit line. Called twice: the back half before Earth, the front half after.
  function drawOrbit(front) {
    const n = Math.round(clampN(cam.r * 3, 90, 600));
    for (let i = 0; i < n; i += 2) { // every other point: a dotted line
      const q = project(orbitPoint((i / n) * Math.PI * 2));
      if ((q.z >= 0) === front) plot(q.x, q.y, front ? 6 : 5);
    }
  }

  // Draws a tiny picture typed as text rows, e.g. '.wbw.', where each letter maps to a palette color.
  function drawSprite(x, y, rows, colors, scale) {
    const h = rows.length, w = rows[0].length;
    for (let r = 0; r < h; r++) {
      for (let col = 0; col < w; col++) {
        const ch = rows[r][col];
        if (!(ch in colors)) continue; // '.' and any typo stay see-through
        for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) {
          plot(x + (col - w / 2) * scale + a, y + (r - h / 2) * scale + b, colors[ch]);
        }
      }
    }
  }

  const crewNames = (state.crew ?? []).map((c) => c.name.split(' ')[0]).join(', ') || 'your crew';
  const orbitName = state.orbit === 'polar' ? 'a polar orbit' : 'low Earth orbit';

  // Draws the capsule with a blinking light, and makes it clickable (crew names, speed, lap time).
  function drawCapsule(q, t) {
    const scale = cam.r > 140 ? 2 : 1;
    const blink = Math.floor(t * 2) % 2 ? 'r' : 'w';
    drawSprite(q.x, q.y, ['..w..', `.wbw.`, 'wwwww', `.g${blink}g.`], { w: 7, b: 12, g: 5, r: 8 }, scale);
    spots.push({ x: q.x, y: q.y, r: 7 * scale, title: 'Your capsule', text: `${crewNames} in ${orbitName}, going about 28,000 km/h. One lap around Earth takes about 90 minutes.` });
  }

  // The secret ending's saucer with a dancing alien on top (paused in Mission 1, Amendment A6).
  function drawUfo(q, t) {
    const f = Math.floor(t * 4) % 4;
    const arms = ['a.a', '.a.', 'a..', '..a'][f]; // a four-frame alien dance on the saucer's roof
    drawSprite(q.x, q.y - 1, [
      `..${arms}..`, '...a...', '..ggg..', f % 2 ? '.ywywy.' : '.wywyw.', 'ggggggg', '.l.l.l.',
    ], { a: 11, g: 6, w: 7, y: 10, l: f % 2 ? 10 : 9 }, cam.r > 140 ? 2 : 1);
    spots.push({ x: q.x, y: q.y, r: 9, title: 'Visitors!', text: 'Nobody at Mission Control can explain this. They seem to love your warp coil.' });
  }

  // The blinking red launch-site marker. It turns with Earth and hides on the far side.
  function drawSite(spin, t) {
    const [x, z] = turnY(siteDir[0], siteDir[2], spin);
    const q = project([x, siteDir[1], z]);
    if (q.z < 0.05) return;
    plot(q.x, q.y, 8);
    if (Math.floor(t * 2) % 2) { plot(q.x - 1, q.y, 7); plot(q.x + 1, q.y, 7); plot(q.x, q.y - 1, 7); plot(q.x, q.y + 1, 7); }
    const day = state.launchDay != null ? ` on day ${state.launchDay}` : '';
    spots.push({ x: q.x, y: q.y, r: 6, title: site.name, text: `Your rocket launched from here${day}. The Earth keeps turning under your crew.` });
  }

  // Fireworks are worked out from time alone, so nothing is stored per spark.
  // They use hash(), not the game's random(): visuals must not use up the seeded dice.
  function drawFireworks(t) {
    for (let k = 0; k < 10; k++) {
      const start = 0.2 + k * 0.55;
      const age = t - start;
      if (age < 0 || age > 1.6) continue;
      const ox = 40 + hash(k * 7 + 1) * 240;
      const oy = 26 + hash(k * 7 + 2) * 60;
      const color = FIREWORK_COLORS[k % FIREWORK_COLORS.length];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + hash(k * 50 + i) * 0.3;
        const speed = 30 + hash(k * 90 + i) * 22;
        const x = ox + Math.cos(a) * speed * age;
        const y = oy + Math.sin(a) * speed * age + 22 * age * age; // a little gravity
        plot(x, y, age > 1.1 ? 5 : color);
      }
    }
  }

  // ---------- Main loop
  let now = 0;
  let last = performance.now();
  const born = last;
  let frame = 0;
  touch();

  /**
   * Job: the main loop. The browser calls it about 60 times a second (requestAnimationFrame).
   *   Each time: move the camera (glide after a flick, slow drift when idle), turn Earth, then
   *   redraw everything back to front so near things cover far things:
   *   sky -> back of the orbit -> anything behind Earth -> Earth -> front of the orbit -> launch site
   *   -> capsule (and UFO) -> fireworks. Finally put the finished picture on the canvas.
   * @param {number} ms - the time the browser gives us, in milliseconds.
   * ⭐
   */
  function tick(ms) {
    // The first frame's timestamp can be a hair earlier than `born`, so never let time go negative.
    const dt = Math.max(0, Math.min(0.1, (ms - last) / 1000));
    last = ms;
    now = Math.max(0, (ms - born) / 1000);
    if (!pointers.size) { // glide after a flick, then drift slowly when left alone
      cam.yaw += cam.vyaw;
      cam.pitch = clampN(cam.pitch + cam.vpitch, -1.4, 1.4);
      cam.vyaw *= 0.92;
      cam.vpitch *= 0.92;
      if (!calm && ms - lastInteract > 6000) cam.yaw += dt * 0.03;
    }
    setCam();
    const spin = spinAt(now);
    spots = [];
    buf.fill(P[0]);
    drawSky();
    drawOrbit(false);
    const capsule = project(orbitPoint(theta0 + (now * Math.PI * 2) / ORBIT_SECONDS));
    const ufo = opts.aliens ? project(orbitPoint(theta0 + (now * Math.PI * 2) / ORBIT_SECONDS - 0.22, 1.2)) : null;
    if (capsule.z < 0 && !capsule.hidden) drawCapsule(capsule, now);
    if (ufo && ufo.z < 0 && !ufo.hidden) drawUfo(ufo, now);
    drawEarth(now, spin);
    drawOrbit(true);
    drawSite(spin, now);
    if (capsule.z >= 0) drawCapsule(capsule, now);
    if (ufo && ufo.z >= 0) drawUfo(ufo, now);
    if (opts.celebrate && !calm) drawFireworks(now);
    ctx.putImageData(image, 0, 0);
    spots.reverse(); // things drawn last are on top, so they get clicked first
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(frame);
      clearTimeout(infoTimer);
      window.removeEventListener('keydown', onKey);
      canvas.remove();
      info.remove();
      zoom.remove();
    },
  };
}

// ---------- Small math helpers

// Shrinks or stretches an arrow to length 1, keeping its direction.
function normalize([x, y, z]) {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

// Turn the (x, z) pair around Earth's axis by angle a (east is positive).
function turnY(x, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, z * c - x * s];
}

// Latitude and longitude (degrees) -> a 3D point on the globe's surface.
function latLonToVec(lat, lon) {
  const la = rad(lat), lo = rad(lon);
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

// Day color in sunlight, dusk color near the day-night line, night color in shadow,
// with an ordered dither between them so it looks hand-shaded in only 16 colors.
function shade(tones, light, b) {
  if (light > 0.2) return tones[0];
  if (light > 0) return light / 0.2 > b ? tones[0] : tones[1];
  if (light > -0.2) return (light + 0.2) / 0.2 > b ? tones[1] : tones[2];
  return tones[2];
}

// Repeatable "noise" for stars, clouds and sparks. Same input, same output, every time.
function hash(n) {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
const hash2 = (x, y) => hash(Math.imul(x, 73856093) ^ Math.imul(y, 19349663));
const hash3 = (x, y, z) => hash(Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791));

// Smooth blobs for clouds: blend the noise values at the 8 corners of the cube around a point.
function noise3(x, y, z) {
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

// ---------- Palette from core/base.css, so a palette swap changes the globe too

// Reads the 16 colors (--c0 to --c15) from the page's CSS, in two forms: [r, g, b] and canvas-ready numbers.
function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const rgb = [];
  const u32 = [];
  for (let i = 0; i < 16; i++) {
    const hex = (css.getPropertyValue(`--c${i}`).trim() || '#000000').replace('#', '');
    const n = parseInt(hex.length === 3 ? hex.replace(/./g, '$&$&') : hex.slice(0, 6), 16) || 0;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    rgb.push([r, g, b]);
    u32.push(((255 << 24) | (b << 16) | (g << 8) | r) >>> 0); // ImageData byte order is R, G, B, A
  }
  return { rgb, u32 };
}

// ---------- The Earth map: a hand-drawn PNG if one exists, otherwise rough continent outlines

// Tries to load a hand-drawn art/sprites/earth_map.png and snaps each pixel to the nearest palette color.
// Returns null if the file doesn't exist yet.
async function loadSurfaceArt(rgb) {
  const img = new Image();
  img.src = new URL('../../art/sprites/earth_map.png', import.meta.url).href;
  try { await img.decode(); } catch { return null; } // not drawn yet: keep the outline map
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const data = new Uint8Array(c.width * c.height);
  for (let i = 0; i < data.length; i++) {
    let best = 0, bestD = Infinity;
    rgb.forEach(([r, gg, b], k) => {
      const d = (px[i * 4] - r) ** 2 + (px[i * 4 + 1] - gg) ** 2 + (px[i * 4 + 2] - b) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    });
    data[i] = best;
  }
  return { w: c.width, h: c.height, data };
}

// Builds the 128x64 flat world map from the continent outlines below: ocean, land, desert or ice per cell.
function buildSurface() {
  const w = 128, h = 64;
  const data = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lon = -180 + ((x + 0.5) * 360) / w;
      const lat = 90 - ((y + 0.5) * 180) / h;
      let kind = Math.abs(lat) > 80 ? ICE : OCEAN;
      for (const shape of CONTINENTS) {
        if (!inside(shape.pts, lon, lat)) continue;
        if (shape.ice) kind = ICE;
        else if (Math.abs(lat) > 14 && Math.abs(lat) < 32 && hash2(x, y) > 0.35) kind = DRY; // desert belts
        else kind = LAND;
        break;
      }
      data[y * w + x] = kind;
    }
  }
  return { w, h, data };
}

// Is the point inside the outline? Count how many edges a line going right from it crosses.
function inside(pts, x, y) {
  let hit = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Very rough coastlines as [longitude, latitude, longitude, latitude, ...] in degrees.
// Placeholder geometry only. A hand-drawn earth_map.png replaces all of this.
const CONTINENTS = [
  { pts: [-168, 66, -162, 70, -140, 70, -125, 70, -95, 72, -80, 73, -65, 62, -55, 52, -66, 45, -70, 42, -76, 35, -81, 31, -80, 25, -82, 28, -84, 30, -90, 29, -97, 26, -97, 21, -87, 21, -88, 16, -83, 10, -79, 9, -80, 7, -85, 11, -92, 15, -105, 20, -110, 24, -112, 30, -117, 32, -121, 35, -124, 40, -124, 48, -130, 55, -140, 60, -150, 60, -158, 57, -165, 60] },
  { pts: [-120, 70, -80, 70, -70, 80, -90, 82, -120, 77] },
  { ice: true, pts: [-55, 60, -45, 60, -20, 70, -20, 80, -35, 83, -60, 82, -70, 78, -55, 70] },
  { pts: [-24, 64, -14, 64, -15, 66, -22, 66] },
  { pts: [-80, 8, -75, 11, -62, 10, -50, 0, -35, -5, -39, -15, -48, -25, -58, -35, -65, -42, -68, -52, -72, -50, -74, -40, -71, -30, -70, -18, -76, -12, -81, -5, -80, 0] },
  { pts: [-17, 15, -17, 21, -10, 30, -6, 35, 10, 37, 20, 32, 32, 31, 35, 28, 38, 18, 43, 12, 51, 12, 42, -2, 40, -15, 35, -24, 27, -34, 18, -34, 12, -18, 13, -5, 9, 4, -5, 5, -13, 8] },
  { pts: [44, -13, 50, -15, 48, -25, 44, -23] },
  { pts: [-10, 36, -9, 43, -2, 44, -1, 46, -5, 48, -2, 49, 2, 51, 5, 53, 8, 54, 8, 57, 5, 59, 5, 62, 10, 64, 15, 68, 20, 70, 26, 71, 30, 70, 40, 68, 55, 68, 60, 69, 70, 73, 80, 73, 100, 77, 115, 74, 130, 71, 140, 72, 160, 70, 180, 69, 180, 65, 178, 62, 163, 60, 160, 54, 156, 51, 156, 57, 150, 59, 142, 59, 141, 53, 140, 48, 135, 43, 130, 42, 129, 35, 126, 35, 125, 39, 121, 40, 122, 37, 120, 34, 122, 30, 120, 26, 116, 23, 110, 21, 108, 21, 109, 12, 105, 9, 103, 10, 100, 13, 100, 7, 103, 2, 100, 6, 98, 8, 98, 16, 94, 17, 92, 22, 88, 22, 86, 20, 80, 15, 78, 8, 76, 10, 73, 16, 72, 21, 70, 22, 67, 25, 57, 25, 56, 27, 50, 30, 48, 29, 50, 26, 51, 25, 54, 24, 56, 26, 59, 22, 52, 16, 43, 13, 39, 21, 35, 28, 34, 32, 36, 36, 27, 37, 26, 40, 24, 40, 22, 37, 19, 41, 13, 45, 18, 40, 16, 38, 9, 44, 3, 43, 0, 39, -2, 37, -6, 36] },
  { pts: [-5, 50, 2, 51, 0, 53, -2, 58, -6, 58, -5, 54, -3, 53] },
  { pts: [130, 31, 136, 34, 141, 36, 142, 40, 141, 45, 145, 44, 140, 41, 136, 37, 132, 34] },
  { pts: [95, 5, 106, -6, 102, -4] },
  { pts: [109, 1, 117, 7, 119, 1, 116, -4, 110, -3] },
  { pts: [131, -1, 141, -3, 150, -10, 141, -9, 137, -5] },
  { pts: [114, -22, 122, -18, 130, -12, 137, -12, 136, -15, 141, -11, 146, -19, 153, -26, 150, -37, 141, -38, 135, -35, 129, -32, 115, -34] },
  { pts: [172, -34, 178, -38, 174, -41, 168, -46, 167, -45] },
  { ice: true, pts: [-180, -90, 180, -90, 180, -78, 160, -70, 100, -66, 40, -68, 0, -70, -40, -78, -60, -73, -60, -64, -70, -70, -100, -73, -150, -77, -180, -78] },
];

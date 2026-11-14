// core/ui.js: shared screen helpers every slice uses. Owner: Person 1.
// Follows RULEBOOK section 4. Missing art or sound never crashes anything:
// images fall back to labeled boxes and sounds stay silent (RULEBOOK sections 4 and 9).

// Paths are built relative to this file, so they work from index.html and from any test.html.
const asset = (path) => new URL(`../${path}`, import.meta.url).href;

// ---------- Cast sheet (core/characters.json)

let characters = {};
try {
  const list = await (await fetch(new URL('./characters.json', import.meta.url))).json();
  characters = Object.fromEntries(list.map((c) => [c.id, c]));
} catch (err) {
  console.warn('Could not load core/characters.json. Speakers will show their id only.', err);
}
const nameOf = (id) => characters[id]?.name ?? id;

// ---------- Scale #app to fit the window at 16:9 (the game is drawn at 1280x720)

function fit() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
  document.documentElement.style.setProperty('--scale', scale);
}
window.addEventListener('resize', fit);
fit();

// ---------- Small DOM helper

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text; // textContent: safe, shows text exactly as written
  return node;
}
const game = () => document.getElementById('game');

// ---------- Screens

// Clears #game, sets a background like 'trail/mission_control', returns the root element.
export function screen(background) {
  const root = el('div', 'screen');
  game().replaceChildren(root);
  if (background) {
    root.classList.add('placeholder-bg');
    root.dataset.label = `background: ${background}`;
    const img = new Image();
    img.onload = () => {
      root.classList.remove('placeholder-bg');
      root.style.backgroundImage = `url("${img.src}")`;
    };
    img.src = asset(`art/backgrounds/${background}.png`);
  }
  return root;
}

// ---------- Portraits and moods (Amendment A10)

// Anything that isn't 'sad' counts as happy, so old calls and data lines with no mood
// look exactly as they did before moods existed.
export function normalizeMood(mood) {
  if (mood == null || mood === 'happy') return 'happy';
  if (mood === 'sad') return 'sad';
  console.warn(`Unknown mood "${mood}". Using happy. Moods are 'happy' or 'sad'.`);
  return 'happy';
}

// File names to try, in order: the requested mood, then happy.
// characters.json may give a character a `moods` list such as ["happy", "sad"]. If a list is
// there and leaves out 'sad', we skip the sad file so the console doesn't fill with 404s.
// If there's no list, we just try the file and fall through when it's missing.
function portraitFileNames(characterId, mood) {
  const moodsWithArt = characters[characterId]?.moods;
  const sadArtMayExist = !Array.isArray(moodsWithArt) || moodsWithArt.includes('sad');
  const fileNames = [];
  if (mood === 'sad' && sadArtMayExist) fileNames.push(`${characterId}_sad.png`);
  fileNames.push(`${characterId}.png`);
  return fileNames;
}

// <img> of a 64x64 portrait shown at `size` CSS pixels, in an optional mood.
// Fallback: mood file, then happy file, then a labeled colored box. Never throws.
// data-source on the final element tells you which one showed (handy in F12 and ui-demo.html).
export function portrait(characterId, size = 128, mood) {
  const wantedMood = normalizeMood(mood);
  const fileNames = portraitFileNames(characterId, wantedMood);
  let attemptIndex = 0;

  const img = el('img', 'portrait');
  img.alt = nameOf(characterId);
  img.width = size;
  img.height = size;
  img.dataset.mood = wantedMood;
  img.onload = () => { img.dataset.source = fileNames[attemptIndex]; };
  img.onerror = () => {
    attemptIndex += 1;
    if (attemptIndex < fileNames.length) {
      img.src = asset(`art/characters/${fileNames[attemptIndex]}`);
      return;
    }
    img.onerror = null;
    const placeholderBox = el('div', 'portrait placeholder-box', nameOf(characterId));
    placeholderBox.style.width = placeholderBox.style.height = `${size}px`;
    placeholderBox.dataset.mood = wantedMood;
    placeholderBox.dataset.source = 'placeholder';
    img.replaceWith(placeholderBox);
  };
  img.src = asset(`art/characters/${fileNames[0]}`);
  return img;
}

// ---------- Dialogue

function dialogueBox(speakerId, mood) {
  const box = el('div', 'dialogue');
  if (speakerId) box.append(portrait(speakerId, 128, mood));
  const body = el('div', 'dialogue-body');
  if (speakerId) body.append(el('div', 'dialogue-name', nameOf(speakerId)));
  const text = el('div', 'dialogue-text');
  body.append(text);
  box.append(body);
  game().append(box);
  return { box, body, text };
}

// Types text out letter by letter. A click or key press finishes it early.
function typewriter(node, text) {
  return new Promise((resolve) => {
    let i = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(timer);
      node.textContent = text;
      window.removeEventListener('pointerdown', finish);
      window.removeEventListener('keydown', finish);
      resolve();
    };
    const timer = setInterval(() => {
      i += 1;
      node.textContent = text.slice(0, i);
      if (i >= text.length) finish();
    }, 25);
    // Wait a moment so the click that opened this box doesn't skip it.
    setTimeout(() => {
      if (done) return;
      window.addEventListener('pointerdown', finish, { once: true });
      window.addEventListener('keydown', finish, { once: true });
    }, 50);
  });
}

// Shows one line with a portrait. Resolves when the player clicks or presses a key to continue.
// opts.mood is 'happy' (default) or 'sad'. A data line already has the right shape,
// so ui.say(line.speaker, line.text, line) picks up line.mood for free.
export async function say(speakerId, text, opts) {
  const { box, text: node } = dialogueBox(speakerId, opts?.mood);
  await typewriter(node, text);
  const hint = el('div', 'dialogue-hint', '▼');
  box.append(hint);
  await new Promise((resolve) => {
    const next = () => {
      window.removeEventListener('pointerdown', next);
      window.removeEventListener('keydown', next);
      resolve();
    };
    setTimeout(() => {
      window.addEventListener('pointerdown', next);
      window.addEventListener('keydown', next);
    }, 50);
  });
  box.remove();
}

// Shows a line plus choices [{ label, disabled, why }]. Resolves with the picked index.
// opts.mood works the same as in say().
export async function ask(speakerId, text, choices, opts) {
  const { box, body, text: node } = dialogueBox(speakerId, opts?.mood);
  await typewriter(node, text);
  return new Promise((resolve) => {
    const list = el('div', 'choices');
    choices.forEach((c, index) => {
      const b = button(c.label, () => { box.remove(); resolve(index); });
      if (c.disabled) {
        b.disabled = true;
        if (c.why) {
          b.title = c.why;
          b.append(el('span', 'why', ` (${c.why})`));
        }
      }
      list.append(b);
    });
    body.append(list);
    list.querySelector('button:not(:disabled)')?.focus();
  });
}

// ---------- Building blocks

export function button(label, onClick, opts = {}) {
  const b = el('button', `btn btn-${opts.variant ?? 'primary'}`, label);
  b.type = 'button';
  b.addEventListener('click', (e) => {
    e.stopPropagation(); // don't also count as "click to continue" for dialogue
    onClick?.(e);
  });
  return b;
}

export function panel(title) {
  const p = el('div', 'panel');
  if (title) p.append(el('h2', 'panel-title', title));
  return p;
}

export function bar(value, max, label) {
  const wrap = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.max(0, Math.min(100, (value / max) * 100))}%`;
  wrap.append(fill);
  if (label) wrap.append(el('span', 'bar-label', label));
  return wrap;
}

export function toast(text, ms = 2000) {
  const t = el('div', 'toast', text);
  document.getElementById('app')?.append(t) ?? document.body.append(t);
  setTimeout(() => t.remove(), ms);
}

// Modal card (history cards). `html` is our own trusted content. Resolves when closed.
export function card(html) {
  return new Promise((resolve) => {
    const overlay = el('div', 'card-overlay');
    const box = el('div', 'card');
    box.innerHTML = html;
    box.querySelectorAll('a').forEach((a) => { a.target = '_blank'; a.rel = 'noopener'; });
    box.append(button('Close', () => { overlay.remove(); resolve(); }));
    overlay.append(box);
    game().append(overlay);
  });
}

// ---------- Sound. Starts muted until the first click, because browsers block autoplay.

let unlocked = false;
let muted = false;
let currentMusic = null;
let wantedMusic = null;

function unlock() {
  unlocked = true;
  if (wantedMusic) music(wantedMusic);
}
window.addEventListener('pointerdown', unlock, { once: true });
window.addEventListener('keydown', unlock, { once: true });

export function sfx(name) {
  if (!unlocked || muted) return;
  const a = new Audio(asset(`audio/sfx/${name}.wav`));
  a.play().catch(() => {}); // missing file or blocked: stay silent
}

export function music(name) {
  wantedMusic = name;
  if (currentMusic) { currentMusic.pause(); currentMusic = null; }
  if (!name || !unlocked || muted) return;
  currentMusic = new Audio(asset(`audio/music/${name}.mp3`));
  currentMusic.loop = true;
  currentMusic.play().catch(() => {});
}

export function setMuted(value) {
  muted = value;
  if (muted && currentMusic) currentMusic.pause();
  if (!muted && wantedMusic) music(wantedMusic);
}
export const isMuted = () => muted;

// ---------- Dashboard

let boundState = null;

// screens.js calls this once so refresh() knows which state to show.
export function bindState(state) {
  boundState = state;
}

// dashboard.js imports this file, so a static import here would be circular. Loading it the
// first time refresh() runs means a missing, empty or broken dashboard.js can't stop ui.js loading.
let dashboardModulePromise = null;

// Re-render the dashboard from state. Call after changing budget, day, morale or reliability.
// The update lands a moment later (after the import), which is fine for a display.
export function refresh() {
  if (!boundState) return;
  dashboardModulePromise ??= import('./dashboard.js').catch((err) => {
    console.warn('core/dashboard.js could not load. The dashboard stays blank.', err);
    return {};
  });
  dashboardModulePromise.then((dashboardModule) => {
    try {
      dashboardModule.updateDashboard?.(boundState);
    } catch (err) {
      console.error('updateDashboard() crashed. Tell Person 2.', err);
    }
  });
}
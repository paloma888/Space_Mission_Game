// The rival agency, Zenith Aerospace (Slice 3 brief section 8).
// A news ticker along the bottom of every trail screen, plus a progress number
// for the small Zenith bar. It is flavor only and never changes the game state.

/** Loads rival.json: a list of { week, text, rivalPercent }. A missing file just means no ticker. */
export async function loadRival() {
  try {
    const res = await fetch(new URL('./rival.json', import.meta.url));
    return res.ok ? await res.json() : [];
  } catch (err) {
    console.warn('Could not read slices/trail/rival.json. The rival ticker is off.', err);
    return [];
  }
}

/** Zenith's progress for a week (0 to 100), or null if there is no data for it. */
export function rivalPercent(bulletins, week) {
  return bulletins.find((b) => b.week === week)?.rivalPercent ?? null;
}

/**
 * Adds the ticker to the page and returns { setWeek, remove }.
 * It is attached to #app, not #game, because ui.screen() empties #game on
 * every screen change and the ticker has to survive that.
 */
export function mountTicker(bulletins) {
  const strip = document.createElement('div');
  strip.className = 'rival-ticker';
  const text = document.createElement('span');
  text.className = 'rival-ticker-text';
  strip.append(text);
  (document.getElementById('app') ?? document.body).append(strip);

  let lines = [];
  let index = 0;
  const showLine = () => { text.textContent = lines.length ? `ZENITH NEWS: ${lines[index % lines.length]}` : ''; };

  // Swap to the week's other bulletin each time one has scrolled all the way across.
  text.addEventListener('animationiteration', () => { index += 1; showLine(); });

  return {
    setWeek(week) {
      lines = bulletins.filter((b) => b.week === week).map((b) => b.text);
      index = 0;
      strip.hidden = lines.length === 0;
      showLine();
      // Restart the scroll so a new week's news starts from the right-hand edge.
      text.style.animation = 'none';
      void text.offsetWidth; // reading a size makes the browser apply 'none' before we undo it
      text.style.animation = '';
    },
    remove() { strip.remove(); },
  };
}

// Slice 4: Weather & Go/No-Go (owner: Person 4)
// What this slice does (RULEBOOK section 3): Forecast, pick a day, Go/No-Go poll, launch or hold. Ends with a launch decision.
// Placeholder so the whole game can be clicked through at Checkpoint 1.
// Replace the body with real screens built with core/ui.js.

export const meta = { id: 'launchweek', owner: 'Person 4' };

export async function show(state, done) {
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>Weather & Go/No-Go</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}
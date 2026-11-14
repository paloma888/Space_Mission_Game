// Slice 3: The Trail (owner: Person 3)
// What this slice does (RULEBOOK section 3): Five weekly turns (assign staff, resolve the week, one event). Ends after week 5 or when day reaches windowOpens.
// Placeholder so the whole game can be clicked through at Checkpoint 1.
// Replace the body with real screens built with core/ui.js.

export const meta = { id: 'trail', owner: 'Person 3' };

export async function show(state, done) {
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>The Trail</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}
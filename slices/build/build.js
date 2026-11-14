// Slice 2: Build & Launch Setup (owner: Person 2)
// What this slice does (RULEBOOK section 3): Capsule parts, rocket, launch site, orbit. Ends when the player presses Lock In Build and the build is legal.
// Placeholder so the whole game can be clicked through at Checkpoint 1.
// Replace the body with real screens built with core/ui.js.

export const meta = { id: 'build', owner: 'Person 2' };

export async function show(state, done) {
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>Build & Launch Setup</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}
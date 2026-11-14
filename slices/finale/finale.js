// Slice 5: Launch & Report (owner: Person 5)
// What this slice does (RULEBOOK section 3): Launch animation, ending screen, mission report, Try Again or Play Again.
// Placeholder so the whole game can be clicked through at Checkpoint 1.
// Replace the body with real screens built with core/ui.js.

export const meta = { id: 'finale', owner: 'Person 5' };

export async function show(state, done) {
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>Launch & Report</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}
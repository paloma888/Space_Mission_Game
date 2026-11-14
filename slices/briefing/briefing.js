// Slice 1: Foundation, Briefing & Hiring (owner: Person 1)
// What this slice does (RULEBOOK section 3): Title, Rosa's welcome, hiring. Ends with 3 astronauts and 0 to 6 staff in state.
// Placeholder so the whole game can be clicked through at Checkpoint 1.
// Replace the body with real screens built with core/ui.js.

export const meta = { id: 'briefing', owner: 'Person 1' };

export async function show(state, done) {
  const game = document.getElementById('game');
  game.innerHTML = `
    <div class="stub">
      <h1>Foundation, Briefing & Hiring</h1>
      <p>Placeholder screen. Day ${state.day}, budget $${state.budget}M.</p>
      <button id="stub-next">Next</button>
    </div>`;
  // done() moves to the next slice. done('finale') jumps to the ending.
  document.getElementById('stub-next').onclick = () => done();
}
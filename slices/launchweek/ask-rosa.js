// Mission Control AI helper (owner: Person 4). RULEBOOK section 4.
// Returns { answer, sources: [{ title, url }] } or null.
// Until the Foundry service is live it always returns null, so every caller
// shows its scripted text. The game must keep working when this returns null.
// Never put API keys or secrets in this file: it runs in the player's browser.

const ENDPOINT = null; // TODO: the Mission Control AI URL once deployed

export async function askRosa(question, context) {
  if (!ENDPOINT) return null;
  try {
    // TODO: call the service and return { answer, sources }
    return null;
  } catch (err) {
    console.warn('askRosa failed, using scripted text instead', err);
    return null;
  }
}
# Launch Trail rules for Claude Code

The Shared Rulebook is loaded in full below. It is the one source of truth and beats any assumption, any slice brief, and anything else in this file. If something here seems to disagree with it, follow the Rulebook and tell the user so they can raise it in team chat.

@docs/RULEBOOK.md

After the Rulebook, read the amendments below. **Where an amendment disagrees with the Rulebook, follow the amendment.** Anything an amendment does not mention still follows the Rulebook.

@docs/RULEBOOK-AMENDMENTS.md

## Rules (Rulebook section 11)

- Plain HTML, CSS and JavaScript modules. No frameworks, no build step, no npm runtime dependencies.
- Work only inside the folder of the slice the user is working on. Never edit another slice or a core file you do not own. Say so and stop.
- Shared state lives in core/state.js. Change budget, day, morale and reliability only with applyEffects().
- Use random() from core/state.js, never Math.random.
- Every screen must run alone on slices/<name>/test.html with fakeState(preset).
- Missing art or sound must never crash anything. Use the built-in placeholders.
- All game text is plain, short, beginner-friendly and written in the character's voice from the cast sheet.
- Hand-made pixel art only. Never generate or add images. No NASA logos or real brands.
- Keep files small and readable. Comment the why, not the what.
- Append what you did with Claude to AI-USE.md under your slice's heading.

## How to apply them in every session

These points restate the Rulebook section noted after each one, so they're easy to check.

1. **Know the slice first.** If the user hasn't said which slice (1 to 5) they own, ask before editing anything. Their own files are listed in section 2 (slice folder plus any core files). The write permissions in section 5 decide which state fields their code may set.
2. **Start from fresh main.** Suggest `git pull origin main` before a new block of work. Branch name: `slice-<number>-<name>`, e.g. `slice-3-trail`. Commit every 30 to 45 minutes. Never force-push. Never push to `main` directly (section 10).
3. **Keep `main` green.** Merging to `main` deploys to Azure. Open a pull request only when the slice's `test.html` passes. During sleep shifts, the two people awake must not break `main` (section 2).
4. **Respect the freeze.** After Checkpoint 3 (Sun 7:00am Central), only bug fixes. If asked for a new feature after that, remind the user first (section 2).
5. **Use the core API, not your own copies.** Shared behavior goes through `core/state.js`, `core/ui.js`, `core/events.js` and `core/dashboard.js` exactly as listed in section 4. Call `ui.refresh()` after changing gauges (section 5). If a helper you need is missing, tell the user to ask its owner. Don't write a private replacement.
6. **Data formats are fixed.** People, dialogue, events, effects and history cards follow section 7 exactly. Dialogue lines are 140 characters or fewer. A new effect key, `requires` field or `when` field needs the core owner's agreement first.
7. **Flags come from the registry.** Use only flags listed in section 6.7. To add one, tell the user to add a row to the Rulebook's flag table first.
8. **Numbers come from the Rulebook.** Use the reliability, launch probability, emergency, score, medal and ending rules in section 6 as written. Don't invent new formulas.
9. **Never invent a fact or a URL.** History-card sources must be real NASA pages the author opened and checked. If unsure, write `TODO: verify` and tell the user (section 7.4).
10. **Tone and audience.** Beginner and youth. Jokes only for fictional failures. Real crew losses use `tone: "memorial"`, with a fade-out and plaque and no jokes. Astronaut tics never appear as jokes after a loss (sections 1 and 8).
11. **Art and sound specs.** Follow section 9 for sizes, file names, the single 16-color palette, the Press Start 2P sizes and the 500KB limit. Start audio muted until the first click.
12. **Mission Control AI is optional at runtime.** `askRosa()` may return `null`. Every screen that calls it must show the scripted text and keep working when it does. Never put API keys or secrets in the repo or in browser code.
13. **Test like the team tests.** Open pages through VS Code's Live Server, never by double-clicking: ES modules and `fetch()` fail from `file://`. Use `?preset=<name>&seed=123` (section 12) and check the browser console (F12) for errors before calling something done.

## How to talk to the user

- The team has mixed experience, and some are new to web development. After each change, give a short, plain-language summary of what changed, why, and how to test it (which `test.html` and preset). Skip long lectures.
- Define a technical term the first time you use it.
- If a request would break a rule above, say which rule and suggest the closest thing that doesn't.
- When you finish meaningful work, remind the user to add two or three lines to `AI-USE.md` under their slice's heading, or offer to write them.

## Keeping this file current

`docs/RULEBOOK.md` is a copy of the team's Shared Rulebook doc. When the Rulebook doc changes, Person 1 pastes the new version into `docs/RULEBOOK.md` in the same pull request. Run `/memory` in Claude Code to confirm the Rulebook import loaded.
# AI use log

Space Apps lets us use AI but requires us to say how, including Claude-written code. Whenever Claude writes or changes something meaningful (code, dialogue or a data file), add 2 or 3 lines under your heading. Person 1 turns this into the AI disclosure for the submission.

Example:
- Sat 2:15pm: Claude Code wrote the first version of the weekly turn loop in `trail.js`. I reviewed it and changed how overhead is charged.

## Planning (whole team)

- Sat morning: Claude (claude.ai) helped draft the game plan, slice split, timeline and `CLAUDE.md`.

## Person 1: Foundation, Briefing & Hiring

## Person 2: Build & Launch Setup

## Person 3: The Trail

- Sat: Claude Code wrote the first version of `applyEffects`, `meetsRequirement` and `requirementWhy` in `core/events.js` from the Slice 3 brief, and checked them with a throwaway script.
- Sat: Claude Code created `slices/trail/tasks.json` from the numbers in the Slice 3 brief.
- Sat: Claude Code wrote `loadAllEvents`, `pickEvent`, `runEvent` and `describeChanges` in `core/events.js`, and a first events-only weekly loop in `trail.js`.
- Sat: Claude Code wrote the staff assignment screen, the weekly resolve math (`week.js`), the week summary and `trail.css`, and checked them against the brief's test cases and a headless-browser playthrough.
- Sat: Claude Code wrote the Zenith rival ticker (`rival.js`), the Zenith progress bar and drafted the 10 bulletins in `rival.json`.
- Sat: Claude Code wrote the trail map week header with a moving marker (`map.js`, `map.json`), the icon slots and hover text on the task buttons, and the cash, good and bad sound hooks.
- Sat: Claude Code drafted the other 15 events in `events.json` with humor in each character's voice, including one flavor line per astronaut for the two crew events. I asked for the quirky tone.
- Sat: Claude Code drafted the first five events in `slices/trail/events.json` (text, flavor lines, choices and results) from the roster in the Slice 3 brief.

## Person 4: Weather & Go/No-Go

## Person 5: Launch & Report

- Sat 1:00pm: Claude Code wrote `launch-sim.js` (resolveLaunch, computeScore, odds words, history card picker), `balance.html` and `sim-tests.html` (brief test cases, all passing) from my Slice 5 brief.
- Sat 1:00pm: Claude Code built a first `finale.js` flow (text launch, endings, memorial plaque, report, Try Again menu) and drafted the ending texts in `endings.json` and `launch-text.json`. I will review the wording.
- Sat 1:00pm: Claude Code wrote `orbit-explorer.js`, an interactive pixel globe for the orbit and secret endings (drag, zoom, click the capsule, site, Sun or Moon). It is drawn in code with palette colors only, no generated images.- Sat afternoon: Following Amendments A1 to A3, Claude Code removed the memorial and abort endings, added the `launch_failure` and `came_home_early` outcomes, reworked the score (Smooth flight, Morale 15) and the Honest Parts badge, and drafted Amendment A11. I chose the rules; Claude wrote the code.
- Sat afternoon: Claude Code added beginner comments to `launch-sim.js`, `finale.js` and `orbit-explorer.js`, and slowed the text launch (T-5, a line every 3 seconds) at my request.

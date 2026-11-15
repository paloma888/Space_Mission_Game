# AI use log

Space Apps lets us use AI but requires us to say how, including Claude-written code. Whenever Claude writes or changes something meaningful (code, dialogue or a data file), add 2 or 3 lines under your heading. Person 1 turns this into the AI disclosure for the submission.

Example:
- Sat 2:15pm: Claude Code wrote the first version of the weekly turn loop in `trail.js`. I reviewed it and changed how overhead is charged.

## Planning (whole team)

- Sat morning: Claude (claude.ai) helped draft the game plan, slice split, timeline and `CLAUDE.md`.

## Person 1: Foundation, Briefing & Hiring

- Sat: Claude Code wrote amendment A10 (happy and sad portraits) and added mood support to `core/ui.js`, `core/base.css` and `core/ui-demo.html`.
- Sat: Claude Code made 13 targeted fixes to `core/state.js`, `core/ui.js` and `core/screens.js` (A7 preset, lazy dashboard refresh, mute memory, slice fades, lost-contact panel, dev panel buttons) and wrote `core/state-test.html`.
- Sat: Claude Code built the briefing slice (`briefing.js`, `hiring.js`, `hiring-rules.js`, `briefing.css`, test pages) and the data file layout with TODO placeholders. It later merged the character text I wrote back into the stat lists in `candidates.json` and `staff.json`.

## Person 2: Build & Launch Setup

- Sat: Claude Code drafted `docs/RULEBOOK-AMENDMENTS.md` from my Slice 2 design decisions (new sites, no crew loss, flight computer, shady parts) and added its import to `CLAUDE.md`. The team reviewed and approved the amendments.
- Sat: Claude Code wrote `parts.json`, `rockets.json`, `sites.json`, `recompute.js` and a checks page that tests the build math against my test cases. I supplied the numbers and checked the results.
- Sat: Claude Code wrote `core/dashboard.js` and its test page. I chose the gauge order and tuned the gauge widths.
- Sat: Claude Code wrote the capsule shop (`shop.js`, `build.css`) and first-draft Hal and Rosa lines in `lines.json`. I tested it and chose the category order (power last), one Why? per category, and no auto-advance.

## Person 3: The Trail

- Sat: Claude Code wrote the first version of `applyEffects`, `meetsRequirement` and `requirementWhy` in `core/events.js` from the Slice 3 brief, and checked them with a throwaway script.
- Sat: Claude Code created `slices/trail/tasks.json` from the numbers in the Slice 3 brief.

## Person 4: Weather & Go/No-Go

## Person 5: Launch & Report

- Sat 1:00pm: Claude Code wrote `launch-sim.js` (resolveLaunch, computeScore, odds words, history card picker), `balance.html` and `sim-tests.html` (brief test cases, all passing) from my Slice 5 brief.
- Sat 1:00pm: Claude Code built a first `finale.js` flow (text launch, endings, memorial plaque, report, Try Again menu) and drafted the ending texts in `endings.json` and `launch-text.json`. I will review the wording.
- Sat 1:00pm: Claude Code wrote `orbit-explorer.js`, an interactive pixel globe for the orbit and secret endings (drag, zoom, click the capsule, site, Sun or Moon). It is drawn in code with palette colors only, no generated images.
- Sat afternoon: Following Amendments A1 to A3, Claude Code removed the memorial and abort endings, added the `launch_failure` and `came_home_early` outcomes, reworked the score (Smooth flight, Morale 15) and the Honest Parts badge, and drafted Amendment A11. I chose the rules; Claude wrote the code.
- Sat afternoon: Claude Code added beginner comments to `launch-sim.js`, `finale.js` and `orbit-explorer.js`, and slowed the text launch (T-5, a line every 3 seconds) at my request.
- Sat evening: From my design (site-based scene, smoke, screen shake, camera follow, Kirby-style fly-away, white flash into the globe, power-flicker and red-alarm emergencies), Claude Code wrote the launch animation (`launch-anim.js`, `launch-art.js`) and a shared `pixel.js`. All art is drawn in code as placeholders until my team's hand-drawn sprites and backgrounds arrive. Claude also fixed the globe's colors for the team's new palette.

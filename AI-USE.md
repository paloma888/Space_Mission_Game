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
- Sat: Claude Code made layout fixes I asked for (How to Play buttons, Skip button position, hiring card alignment, staff list) and changed four astronaut stats in `candidates.json` and `core/state.js`, then re-ran the test pages.
- Sat: Claude Code redesigned the hiring screen into three-card pages with arrows, a see-through detail strip and a bottom bar, added `--border-grey` and portrait borders to `core/base.css`, and added paging checks to `hiring-test.html`.

## Person 2: Build & Launch Setup

- Sat: Claude Code drafted `docs/RULEBOOK-AMENDMENTS.md` from my Slice 2 design decisions (new sites, no crew loss, flight computer, shady parts) and added its import to `CLAUDE.md`. The team reviewed and approved the amendments.
- Sat: Claude Code wrote `parts.json`, `rockets.json`, `sites.json`, `recompute.js` and a checks page that tests the build math against my test cases. I supplied the numbers and checked the results.
- Sat: Claude Code wrote `core/dashboard.js` and its test page. I chose the gauge order and tuned the gauge widths.
- Sat: Claude Code wrote the capsule shop (`shop.js`, `build.css`) and first-draft Hal and Rosa lines in `lines.json`. I tested it and chose the category order (power last), one Why? per category, and no auto-advance.
- Sun: Claude Code built the rocket, launch-site map and review screens (`vehicle.js`, `compat.js`, `review.js`, `common.js`). It also reworked the flow to Rocket → Shop → Site → Review, with no Back buttons and money charged on Next. I designed the flow and the layouts and tuned them over many rounds.
- Sun: Claude Code wrote the shady dealer (`dealer.js`), the per-tier dealer parts and the mysterious component upsell, plus their lines in `lines.json`. I designed the dealer's scene, the trade-in and the upsell.
- Sun: Claude Code sized and wired in the rocket sprites and per-tier part art. The art itself is hand-drawn by our team; Claude did not make or edit any images.
- Sun: Claude Code generated the nine Slice 2 sound effects (`audio/sfx/build-*.wav`, `shady-whisper.wav`, `shady-reject.wav`, `shady-deal.wav`) with a small synth script that uses square waves and noise, the same way jsfxr does. I chose what each sound should be and listened to them.

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
- Sat 1:00pm: Claude Code wrote `orbit-explorer.js`, an interactive pixel globe for the orbit and secret endings (drag, zoom, click the capsule, site, Sun or Moon). It is drawn in code with palette colors only, no generated images.
- Sat afternoon: Following Amendments A1 to A3, Claude Code removed the memorial and abort endings, added the `launch_failure` and `came_home_early` outcomes, reworked the score (Smooth flight, Morale 15) and the Honest Parts badge, and drafted Amendment A11. I chose the rules; Claude wrote the code.
- Sat afternoon: Claude Code added beginner comments to `launch-sim.js`, `finale.js` and `orbit-explorer.js`, and slowed the text launch (T-5, a line every 3 seconds) at my request.
- Sat evening: From my design (site-based scene, smoke, screen shake, camera follow, Kirby-style fly-away, white flash into the globe, power-flicker and red-alarm emergencies), Claude Code wrote the launch animation (`launch-anim.js`, `launch-art.js`) and a shared `pixel.js`. All art is drawn in code as placeholders until my team's hand-drawn sprites and backgrounds arrive. Claude also fixed the globe's colors for the team's new palette.
- Sun early morning: From my plan, Claude Code built the report for endings with no launch (bankrupt, window closed). It added `endReason()` (8 reasons), the "How far you got" track, a score that counts only Morale, and locked badges, plus tests in `sim-tests.html`. I wrote Rosa's joke lines. Claude drafted the rest and 3 history cards (Webb, InSight, Artemis I) from NASA pages it read. Each card keeps a `todo` until I open and check its source myself.
- Sun morning: From my picks, Claude Code drew Cape Canaveral and Kodiak in code as layered scenes with parallax (`launch-sites.js`). It also built the secret ending: a flying saucer with a tractor beam in the launch, a bigger saucer on the globe, and a secret Close Encounter badge. All art is drawn in code with the team palette, no image files generated.
- Sun morning: From my inspiration pictures, Claude Code drew a deep sky for the globe in code (`explorer-sky.js`): Andromeda, the Milky Way band, a black hole and the Magellanic Clouds. Claude read NASA pages for the click facts. Each fact keeps a `todo` until I check its source myself.
- Sun morning: Claude Code split the launch sites into one file per site (`slices/finale/sites/`) and drew Kourou in code: rainforest, muddy-blue ocean, the Îles du Salut, red laterite, lightning masts, scarlet ibis and a toucan. It also gave the globe's Sun a glowing halo with turning rays.
- Sun morning: Claude Code drew Mahia in code: the long white cloud, pale layered cliffs, reef shelves, sheep paddocks, a woolshed, a pōhutukawa tree, cabbage trees and flax.
- Sun morning: Claude Code drew Sriharikota in code: monsoon clouds with rain, fishing boats, the other pad's service tower, casuarina rows, palmyra and coconut palms, a lagoon with flamingos, and a peacock. All five launch sites are now drawn in code.
- Sun morning: Claude Code fact-checked every history card and globe fact against its NASA page, sentence by sentence, and rewrote any phrase the page didn't support. It also added NASA sources for the Sun, Moon and capsule facts. I still open each link myself before removing its `todo`.

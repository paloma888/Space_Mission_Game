# Launch Trail Shared Rulebook

Nov 14, 2026 · @Audrey Ramirez

This is the one source of truth for how the five slices plug together. Every slice owner reads it before writing any code. Person 1 turns section 11 into the repo's CLAUDE.md so every Claude Code session follows the same rules. If a slice brief and this rulebook disagree, this rulebook wins and you say so in team chat.

## 1. The game in one page

Launch Trail is a pixel-art, Oregon Trail style game that runs in the browser. The player is the Flight Director of a tiny space agency with $800M and 42 days. They hire a crew and staff, build a capsule, pick a rocket, launch site and orbit, survive five weeks of build-up events, pick a launch day in the weather window, hear their crew vote Go or No-Go, and watch an animated launch. Every failure ends with the real NASA story it echoes, with the NASA source shown on screen.

**Mission 1 is won** when the capsule reaches orbit, the whole crew is alive, and the mission score is 60 or more.

**Tone rule.** Jokes are only for fictional failures. History cards about real crew losses (Challenger, Apollo 1, Columbia) are written with respect. A crewed failure in our game shows a fade-out and a memorial plaque, never a gag.

**Audience.** Beginner and youth. Plain words, short sentences. Rosa explains every concept the first time it shows up.

**What judges look for.** Storytelling with open data (every history card cites a NASA source on screen) and Art & Technology (hand-made pixel art and chiptune on a working simulation). Hand-made art is also how we avoid the AI-image watermark rule.

## 2. Who owns what and when it is due

| Slice | Entry file | Screens inside it | Core files it owns |
| --- | --- | --- | --- |
| 1. Foundation, Briefing & Hiring | `slices/briefing/briefing.js` | title, Rosa's cutscenes, hiring, credits | `index.html`, `core/state.js`, `core/screens.js`, `core/ui.js`, `core/base.css`, `core/characters.json` |
| 2. Build & Launch Setup | `slices/build/build.js` | capsule shop, rocket, site and orbit, build lock-in | `core/dashboard.js` |
| 3. The Trail | `slices/trail/trail.js` | weekly staff assignment, events, rival ticker | `core/events.js` |
| 4. Weather & Go/No-Go | `slices/launchweek/launchweek.js` | forecast, day pick, Go/No-Go poll, hold and scrub | `slices/launchweek/ask-rosa.js` |
| 5. Launch & Report | `slices/finale/finale.js` | launch animation, ending screen, mission report | none |

| Checkpoint | Due | What must be true |
| --- | --- | --- |
| 0. Kickoff | Sat 12:00pm | Repo live, CLAUDE.md in place, hello world deployed to Azure, palette and font chosen, slice folders exist with a stub `show()` each |
| 1. Skeleton | Sat 4:00pm | A player can click from the title to an ending on the live URL, with placeholders everywhere |
| 2. Playable | Sat 10:00pm | Every Mission 1 screen works with real rules and real numbers. One outsider has played it |
| 3. Polish and freeze | Sun 7:00am | Real art and sound in, all dialogue in, secret ending works, balance tuned. Only bug fixes after this |
| 4. Submission | Sun 10:30am | Demo video, project page and links done and tested, about 1 hour of buffer |

Sleep shifts. Three people sleep 11pm to 3am while two keep building, then they swap 3am to 7am. The two on shift must not break `main`. Work on your branch and merge only when your slice's test page passes.

## 3. Screen flow

The game is five slices played in this order.

1. **briefing** (Person 1). Title, Rosa's welcome, hiring. Ends with 3 astronauts and 0 to 6 staff in `state`.
2. **build** (Person 2). Capsule parts, rocket, launch site, orbit. Ends when the player presses Lock In Build and the build is legal.
3. **trail** (Person 3). Five weekly turns. Each turn is assign staff, resolve the week, one event. Ends after week 5 or when `day` reaches `windowOpens`.
4. **launchweek** (Person 4). Forecast, pick a day, Go/No-Go poll, launch or hold. Ends with a launch decision.
5. **finale** (Person 5). Launch animation, ending screen, mission report, Try Again or Play Again.

A slice calls `done()` to go to the next one. It calls `done('finale')` to jump straight to the ending (for example after going bankrupt). After every `done()` the framework runs `checkEnd(state)`. If it returns an outcome, the game is rerouted to `finale` automatically, so slices only need to set `state.outcome` themselves when they know the ending before `checkEnd` would.

**Resuming.** Try Again sets `state.resume` to `'hiring'` or `'build'`. The matching slice reads it in `show()` and skips straight to that screen with everything else preserved.

## 4. The slice contract and the core API

Every slice has one entry point.

```js
// slices/<name>/<name>.js
export const meta = { id: 'trail', owner: 'Person 3' };
export async function show(state, done) {
  // 1. build your screen with ui.screen(...)
  // 2. change state only as allowed in section 5
  // 3. call done() when your whole slice is finished, or done('finale') to jump
}
```

Every slice also has `slices/<name>/test.html`. It imports `fakeState(preset)` and runs only that slice, so nobody waits on anybody.

The shared helpers. Use these and nothing else for shared behavior. Never call `Math.random`, always the helpers, so `?seed=123` in the URL makes a run repeatable.

```js
// ---------- core/state.js (Person 1)
export function createState()                 // fresh state, see section 5
export function fakeState(preset)             // test states, see section 12
export function getReliability(state)         // clamp(base+parts+testing+events, 0.5, 0.98)
export function launchProbability(state)      // see section 6.4
export function saveCheckpoint(state, name)   // deep copy into state.checkpoints[name]
export function loadCheckpoint(state, name)   // restore that copy in place
export function checkEnd(state)               // 'bankrupt' | 'window_closed' | null
export function addFlag(state, f)  // also hasFlag, removeFlag
export function clamp(n, lo, hi)
export function random()                     // seedable. also roll(p) -> bool, pick(list)

// ---------- core/ui.js (Person 1)
export function screen(background)            // clears #game, sets background, returns root element
export function say(speakerId, text)          // dialogue box, portrait, typewriter. returns Promise
export function ask(speakerId, text, choices) // choices=[{label, disabled, why}] -> Promise<index>
export function button(label, onClick, opts)  // opts.variant 'primary' | 'quiet' | 'danger'
export function panel(title)                  // framed box element
export function bar(value, max, label)        // pixel progress bar element
export function portrait(characterId, size)   // <img>, falls back to a labeled colored box
export function toast(text, ms)
export function sfx(name) / music(name)       // audio/sfx/<name>.wav, audio/music/<name>.mp3
export function card(html)                    // modal card (history cards). Promise on close
export function refresh()                     // re-render the dashboard from state

// ---------- core/events.js (Person 3)
export function applyEffects(state, effects)  // section 7.3 lists every key
export function meetsRequirement(state, req)
export async function runEvent(state, event)   // plays it with ui.say and ui.ask, applies the pick
export function pickEvent(state, week)

// ---------- core/dashboard.js (Person 2)
export function mountDashboard(el)
export function updateDashboard(state)

// ---------- slices/launchweek/ask-rosa.js (Person 4)
export async function askRosa(question, context)  // -> { answer, sources: [{ title, url }] } or null
```

Placeholders are built in. `ui.portrait` and `ui.screen` draw a labeled colored box when an image file does not exist yet, and `ui.sfx` does nothing when a sound file does not exist yet. So nobody is ever blocked on art or sound.

## 5. Game state

One object, held in memory, passed to every `show()`.

```js
const state = {
  // time and money
  budget: 800,            // $M
  day: 1,                 // 1 to 42
  week: 1,                // trail turn, 1 to 5
  windowOpens: 36,        // first launch day
  windowCloses: 42,       // last launch day
  // people (briefing)
  crew: [],               // 3 astronaut objects, section 7.1
  staff: [],              // hired staff objects, section 7.1
  // build (build)
  parts: {},              // section 5.1
  rocket: null,           // 'sparrow' | 'condor' | 'condor_reflown' | 'pelican'
  site: null,             // 'canaveral' | 'vandenberg' | 'wallops' | 'kodiak' | 'kourou'
  orbit: 'leo',           // 'leo' | 'polar'
  derived: { capsuleMass: 0, liftCapacity: 0, massMargin: 0,
             powerSupply: 0, powerUse: 0, comms: 'none', rocketReliability: 0.95, powerOk: true, emergencyChance: 0, solarFailChance: 0, scienceOk: false, spent: 0 },
  // trail (trail)
  progress: { build: 0, testing: 0, training: 0 },   // 0 to 100 each
  skippedTestingWeeks: 0,
  // gauges
  morale: 70,             // 0 to 100
  rel: { base: 0.80, parts: 0, testing: 0, events: 0 },  // hidden. read with getReliability()
  // launch week (launchweek)
  weather: null,          // generated days, section 6.6
  launchDay: null,
  scrubs: 0,
  weatherPenalty: 0,      // 0 to 0.25
  overrulePenalty: 0,     // 0 to 0.25
  launchWeather: null,    // { risk, tempF, kind } snapshot on launch morning
  // story memory
  flags: [],              // section 6.7
  events: [],             // ids of events already shown
  // results (finale)
  outcome: null,          // 'orbit' | 'abort' | 'lost' | 'bankrupt' | 'window_closed' | 'aliens'
  stages: [], emergencies: [], score: null,
  // plumbing (Person 1)
  checkpoints: {}, resume: null
};
```

**5.1 The parts object.** `parts = { shell: 'standard', lifeSupport: 'standard', abort: 'standard', power: { type: 'battery', tier: 'standard' }, comms: 'standard', science: null, warpCoil: false }`. Tiers are `'budget' | 'standard' | 'premium'`. `abort` may be `null` (no abort system). `science` is `null`, `'plant'`, `'radiation'` or `'camera'`.

**Who may write which field.** Everyone may read everything. Write only your own, and change `budget`, `day`, `morale` and `rel.events` only through `applyEffects()`.

| Field | Written by | Notes |
| --- | --- | --- |
| `crew`, `staff` | Person 1 | Hiring subtracts cost through `applyEffects`. |
| `parts`, `rocket`, `site`, `orbit`, `derived.*`, `rel.parts` | Person 2 | `recompute(state)` in `build.js` refreshes all derived values after every change. |
| `progress.*`, `skippedTestingWeeks`, `rel.testing`, `week`, `events` | Person 3 | Also advances `day` by 7 each week. |
| `weather`, `launchDay`, `scrubs`, `weatherPenalty`, `overrulePenalty`, `launchWeather` | Person 4 | May also add flags. |
| `outcome`, `stages`, `emergencies`, `score` | Person 5 | Reads everything. |
| `budget`, `day`, `morale`, `rel.events`, `flags` | anyone, via `applyEffects` or `addFlag` | Always call `ui.refresh()` afterwards. |
| `checkpoints`, `resume` | Person 1 (helpers) | Person 1 saves `afterHiring`, Person 2 saves `afterBuild`. Person 5 loads them for Try Again. |

## 6. Rules that cross slices

These numbers are starting values. Person 5's balance page (`finale/balance.html`) will tell us how the game plays, and Person 2 and Person 3 tune numbers after the Checkpoint 2 playtest.

**6.1 Time.** The game starts on day 1. Each trail week adds 7 days. Events can add more days. The trail ends after week 5 or when `day` reaches 36, whichever comes first. Launch week runs one day at a time from `windowOpens` (36) to `windowCloses` (42). Waiting a day adds 1 to `day`. If `day` ever passes 42, the outcome is `window_closed`.

**6.2 Money.** Everything is in $M. Trail charges a $5M overhead every week. Launch week charges the launch site's fee once, when the player confirms the final launch. A hold costs $10M and a scrub costs $15M. If `budget` is 0 or below, the outcome is `bankrupt`. Spending that would take the budget below 0 is refused by the screen that offers it, except overhead, events and fees, which may push it to 0 or below.

**6.3 Reliability (hidden from the player).** `getReliability(state) = clamp(rel.base + rel.parts + rel.testing + rel.events, 0.5, 0.98)`.

- `rel.base` is 0.80.
- `rel.parts` is the sum of every installed part's reliability bonus. Person 2 recomputes it.
- `rel.testing = clamp(progress.testing / 100 * 0.10 - 0.01 * skippedTestingWeeks, -0.05, 0.10)`. Person 3 recomputes it every week.
- `rel.events` is the running total of every `reliability` effect from events. Only `applyEffects` changes it.

**6.4 Launch probability.** One function in `core/state.js` that everyone uses.

```js
launchProbability(state) = clamp(
  getReliability(state)
  * state.derived.rocketReliability
  * (1 - state.weatherPenalty)
  * (1 - state.overrulePenalty),
  0.05, 0.99)
```

The launch has four stages: liftoff, max-Q, separation, orbit. Each stage passes with probability `launchProbability ^ (1/4)`. Person 5 rolls them with `roll(p)`. A typical well-built game sits near 0.85 overall. A reckless one sits below 0.5.

**6.5 Crew skills and emergencies.** An emergency is a life support failure, a solar panel that does not deploy, or a power shortage. Save chance is `clamp(0.35 + 0.12 * bestEngineering + 0.05 * averageNerves + 0.10 * (progress.training / 100), 0.05, 0.95)`, where `bestEngineering` is the highest `eng` among the 3 crew and `averageNerves` is the mean `nerves`. Both are 1 to 5. Person 5 owns the roll. A power shortage has a save chance 0.25 lower (minimum 0.05).

**6.6 Weather handoff.** Person 4 writes `state.weather` as `{ '36': { risk, tempF, kind, wind }, ... }` for days 36 to 42, where `risk` is 0 to 100 and `kind` is `'clear' | 'rain' | 'fog' | 'wind' | 'storm' | 'cold'`. On launch confirmation Person 4 copies the chosen day into `state.launchWeather` and sets `weatherPenalty`. Person 5 reads only `launchWeather`, `weatherPenalty` and `overrulePenalty`.

**6.7 Flag registry.** Flags are strings in `state.flags`. Add a row here before you invent a flag.

| Flag | Set by | Read by | Meaning |
| --- | --- | --- | --- |
| `skipped_testing` | Person 3 | 4, 5 | `skippedTestingWeeks` reached 2. The inspector votes No-Go. Hubble card. |
| `reused_software` | Person 3 | 5 | Old software was reused without a retest. Ariane 5 card. |
| `wrong_units` | Person 3 | 5 | A hand-off was not double-checked. Mars Climate Orbiter card. |
| `hidden_defect` | Person 3 | 5 | A flaw shipped uninspected. Hubble card. |
| `software_bug_open` | Person 3 | 5 | A known bug was patched later. Ariane 5 card. |
| `cold_site` | Person 3 | 4 | The player ignored frost warnings at a cold site. |
| `heaters_installed` | Person 3 | 4 | Halves the cold-launch penalty. |
| `lightning_ready` | Person 3 | 5 | Halves the lightning strike chance at launch. |
| `cost_overrun` | Person 3 | 5 | The player ignored a cost review. James Webb card on bankruptcy. |
| `rival_rush` | Person 3 | none | Flavor for the report. |
| `cold_launch` | Person 4 | 5 | Launched with `tempF` at 32 or below. Challenger card. |
| `overruled_nogo` | Person 4 | 5 | The player launched through at least one No-Go. |
| `overruled_engineering`, `overruled_weather`, `overruled_quality` | Person 4 | 5 | Which station was overruled. |
| `warp_coil` | Person 2 | 5 | The shady Experimental Warp Coil was bought. |
| lightning\_strike | Person 5 | 4, 5 | Lightning struck during the launch. Apollo 12 card. |

**6.8 Score, medals and badges.** Person 5 owns the math.

| Part of score | Points | Rule |
| --- | --- | --- |
| Crew safety | 30 | 30 if everyone is alive, minus 10 for each emergency the crew survived, 0 if the crew is lost |
| Reached orbit | 30 | 30 for `orbit` or `aliens`, otherwise 0 |
| Budget left | 15 | `15 * min(1, budget / 200)` |
| Days to spare | 10 | `10 * clamp((windowCloses - launchDay) / 6, 0, 1)` |
| Morale | 10 | `10 * morale / 100` |
| Science | 5 | 5 if a science part flew and comms were Standard or Premium and power held, otherwise 0 |

Medals for an orbit or aliens ending are bronze at 60, silver at 75 and gold at 90. Below 60 the player reached orbit but gets no medal. Badges are Measure Twice (`skippedTestingWeeks` is 0), Weather Wise (`scrubs` is 0), Under Budget (budget left 150 or more), Team Player (no `overruled_nogo` flag) and Safety First (an abort system was on board).

**6.9 Endings.**

| Outcome | Trigger | Crew |
| --- | --- | --- |
| `orbit` | All four stages pass | alive |
| `abort` | A stage fails and an abort system is on board | alive |
| `lost` | A stage fails with no abort system, or an emergency in orbit is not saved | lost, memorial rule applies |
| `bankrupt` | Budget is 0 or below before launch | alive |
| `window_closed` | `day` passes 42 before launch | alive |
| `aliens` | `warp_coil` flag, `launchDay` is 42, and the liftoff stage passes | alive, secret |

## 7. Data formats

All game content is JSON in `slices/<name>/`. Code reads it with `fetch`. Writers can add content without touching code.

**7.1 People.**

```json
{ "id": "amara", "name": "Amara Okonkwo", "pilot": 5, "eng": 2, "nerves": 3, "cost": 55, "portrait": "amara" }
{ "id": "hal", "name": "Hal Brennan", "role": "engineer", "title": "Chief Engineer", "skill": 5, "cost": 40, "portrait": "hal" }
```

Staff roles are `engineer`, `inspector`, `meteorologist`, `logistics` and `pr`. Skills run 1 to 5.

**7.2 Dialogue line.** `{ "speaker": "rosa", "text": "Measure twice, launch once." }`. `speaker` is any id in `core/characters.json`. Lines are plain text, 140 characters or fewer, so they fit the dialogue box.

**7.3 Events and effects.**

```json
{
  "id": "stolen_valve",
  "weeks": [1, 5],
  "weight": 1,
  "when": {},
  "speaker": "marty",
  "title": "A shipment goes missing",
  "text": "Bad news, boss. The valve shipment never showed up.",
  "choices": [
    { "label": "Pay to rush a new one", "effects": { "budget": -20 }, "result": "Marty makes one very expensive phone call." },
    { "label": "Wait for the next truck", "effects": { "day": 7 }, "result": "A week of waiting. The valves finally arrive." },
    { "label": "Ask Hal to machine one in-house", "requires": "engineer", "effects": { "day": 2, "reliability": -0.03 }, "result": "Hal grumbles, then pulls it off." }
  ]
}
```

A choice may use `outcomes` instead of `effects` for a chance roll: `"outcomes": [ { "p": 0.5, "effects": {}, "result": "..." }, { "p": 0.5, "effects": { "reliability": -0.06 }, "result": "..." } ]`. The `p` values add up to 1.

| Effect key | Meaning |
| --- | --- |
| `budget`, `day`, `morale` | Added. Morale is clamped to 0 to 100 |
| `reliability` | Added to `rel.events` |
| `progress` | `{ build, testing, training }` added, each clamped to 0 to 100 |
| `flags`, `removeFlags` | Lists of flag names to add or remove |
| `loseStaff` | A role name. Removes the lowest-skill staff member with that role, if any. The value 'any' removes the lowest-skill staff member overall. Events may also use boost, guarantee and flavor (see the Slice 3 brief) |

`requires` is a staff role string like `'engineer'`, or an object with any of `role`, `flag`, `notFlag`, `minBudget`, `site`. A choice whose requirement is not met is shown greyed out with a short `why`. `when` may hold `minWeek`, `maxWeek`, `flagsAny`, `flagsNone`, `siteIn`, `rocketIn`, `staffHas`, `moraleBelow`, `budgetBelow` and `budgetTiersAtLeast`.

**7.4 History cards.** Each slice that triggers a failure keeps its cards in `slices/<name>/history.json`. The report screen loads every slice's file.

```json
{
  "id": "apollo13",
  "title": "Apollo 13, 1970",
  "tone": "hopeful",
  "story": "Two days into the trip to the Moon, an oxygen tank exploded...",
  "lesson": "Contingency plans and calm heads bring crews home.",
  "sources": [ { "title": "NASA Apollo 13 mission page", "url": "https://..." } ],
  "when": { "outcome": ["orbit"], "emergency": true, "priority": 5 }
}
```

`story` is 80 to 120 words. `lesson` is one sentence. `tone` is `'memorial'` for any real crew loss (shown with a fade-out and a plaque and never with a joke), otherwise `'hopeful'` or `'plain'`. `sources` must hold at least one real NASA page that the author opened and checked in a private browser window. Never invent a URL. `when` may hold `outcome` (list), `flagsAny`, `stage`, `emergency` and `priority`. The report picks the matching card with the highest priority.

## 8. Cast sheet

Every character speaks in the voice below in every slice. If you write a line, read it aloud in that voice first. Person 1 turns this table into `core/characters.json` at Checkpoint 0.

| Id | Name and job | Voice | Tic |
| --- | --- | --- | --- |
| `rosa` | Rosa Vega, retired Flight Director, tutor and narrator | Warm and plain. Explains with everyday comparisons like road trips and cooking. Never scary | Measure twice, launch once. |
| `hal` | Hal Brennan, Chief Engineer (engineer 5, $40M) | Gruff. Short sentences. Never says please. Secretly kind | I've seen this movie before. |
| `dev` | Dev Okafor, junior engineer (engineer 3, $20M) | Eager and a little breathless | Cool cool cool. |
| `inez` | Inez Moreau, quality inspector (inspector 4, $25M) | Dry deadpan. Loves checklists | Trust, but verify. |
| `skye` | Skye Patel, meteorologist (meteorologist 4, $25M) | Bubbly. A weather pun in every message | That forecast is looking up. |
| `marty` | Marty Kowalski, logistics manager (logistics 3, $20M) | Talks fast. Phone always ringing | Don't panic. Okay, panic a little. |
| `tasha` | Tasha Brooks, PR lead (pr 4, $25M) | Upbeat salesperson. Turns everything into a headline | That's a headline! |

| Id | Astronaut (pilot / eng / nerves, cost) | Strength and flaw | Tic |
| --- | --- | --- | --- |
| `amara` | Amara Okonkwo (5 / 2 / 3, $55M) | Ace pilot. Overconfident, skims checklists | Easy. |
| `jun` | Jun Takahashi (2 / 5 / 3, $50M) | Brilliant engineer. Talks to machines more than people | Technically... |
| `lucia` | Lucía Herrera (3 / 2 / 5, $45M) | Calm under pressure. Keeps worries to herself | Breathe. Then decide. |
| `dmitri` | Dmitri Volkov (4 / 3 / 3, $60M) | Veteran test pilot. Grumpy, dry humor | In my day... |
| `priya` | Priya Nair (2 / 4 / 2, $30M) | Rookie genius. Nervous | Sorry, quick question. |
| `sam` | Sam 'Sparks' Whitaker (3 / 3 / 3, $40M) | Does everything okay. Jokes at the wrong moment | Roger that, boss. |
| `zainab` | Zainab Al-Rashid (3 / 4 / 4, $65M) | Excellent all-rounder. Perfectionist, slows decisions | One more check. |
| `mateo` | Mateo Silva (2 / 2 / 4, $25M) | Cheerful and cheap, steady nerves. Forgetful | Wait, did we do that? |

A crewed failure never uses an astronaut's tic as a joke. After a real or fictional loss, the voice goes quiet and serious.

**Who draws which portrait.** Person 1 draws `rosa`, `amara`, `jun` and `lucia`. Person 2 draws `hal`, `dev`, `dmitri` and `priya`. Person 3 draws `marty`, `tasha`, `zainab` and `mateo`. Person 4 draws `skye`, `inez` and `sam`.

## 9. Look and sound

- **Resolution.** All art is made at 320 by 180 pixels and shown at 4 times size (1280 by 720) inside `#game`. The whole `#app` scales to fit the window and keeps 16:9. Every image uses `image-rendering: pixelated`.
- **Sizes.** Backgrounds 320 by 180, opaque PNG. Character portraits 64 by 64, transparent PNG. Part and UI icons 32 by 32. Sprites (rockets, capsule, UFO) are transparent PNGs, at most 64 by 128.
- **Palette.** One 16-color palette from Lospec, chosen by Person 1 at Checkpoint 0 and posted in chat. No other colors anywhere. Credit it on the credits screen.
- **Font.** Press Start 2P. Title 32px, body 16px, small 12px.
- **Names.** `art/characters/<id>.png`, `art/backgrounds/<slice>/<name>.png`, `art/icons/<name>.png`, `art/sprites/<name>.png`, `audio/sfx/<slice>-<name>.wav` (from jsfxr) and `audio/music/<name>.mp3` (from BeepBox). Lowercase and underscores. Keep each file under 500KB.
- **Hand-made only.** No AI-generated images. No NASA logos or mission insignia. No real company logos or rocket brands. Art that breaks this rule gets deleted.
- **Sound.** Short sound effects per screen, one calm loop for the build phase, one tense loop for launch week, one short fanfare per ending. Start muted until the player clicks, because browsers block autoplay.

## 10. Git and merging

1. Person 1 creates the repo and adds everyone at Checkpoint 0.
2. Your branch is `slice-<number>-<name>`, for example `slice-3-trail`.
3. Run `git pull origin main` before each block of work. Commit every 30 to 45 minutes. Never force-push.
4. Open a pull request to `main` when your test page passes and at every checkpoint. One other person skims it for five minutes and approves. Merging to `main` deploys to Azure automatically.
5. Edit only your own folder and files. If you need a change somewhere else, ask the owner in chat. A tiny fix is fine if you tell the owner.
6. If a merge conflict touches a file you do not own, take their version and tell the owner.
7. At each checkpoint, hold a 10 minute stand-up, merge, then play the deployed build together.

## 11. Working with Claude Code

Everyone has Claude Code. All five Claudes follow the same rules because Person 1 commits this text as `CLAUDE.md` at the repo root.

```
# Launch Trail rules for Claude Code
Read the Shared Rulebook before changing anything. It beats any assumption.
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
```

`AI-USE.md` at the repo root has one heading per person. Each person adds two or three lines whenever Claude wrote or changed something meaningful, such as code, dialogue or a data file. Person 1 turns it into the AI disclosure for the submission.

## 12. Test pages, presets and integration checks

`fakeState(preset)` returns a complete, legal state. Every slice's `test.html` accepts `?preset=<name>&seed=123`. Pressing the backtick key in the real game opens a dev panel (Person 1) that jumps to any slice with any preset.

| Preset | What it contains |
| --- | --- |
| `fresh` | `createState()` |
| `afterHiring` | Crew amara, jun, lucia. Staff hal, inez, skye. Budget 560. Checkpoint `afterHiring` saved |
| `afterBuild` | afterHiring plus Standard everything, plant experiment, condor at canaveral, leo. Budget 135. Checkpoint `afterBuild` saved |
| `midTrail` | afterBuild at week 3, day 15, progress build 60 testing 30 training 20, budget 115, morale 66 |
| `readyToLaunch` | Day 36, progress 100 / 70 / 50, budget 85, morale 68, `rel.parts` 0.05, `rel.testing` 0.07 |
| `readyToLaunchRisky` | Day 41, budget 20, progress 100 / 10 / 0, flags `skipped_testing` and `reused_software`, morale 40 |
| `launched` | readyToLaunch with `launchDay` 37, clear weather, `weatherPenalty` 0.05, budget 45 |
| `launchedCold` | `launched` at kodiak with `tempF` 28, flags `cold_launch` and `overruled_engineering`, `overrulePenalty` 0.06 |
| `secret` | `launched` with `warp_coil` set, `launchDay` 42 |

Integration checks at each checkpoint. Everyone runs them on the deployed URL, not on their laptop.

- **Checkpoint 1.** Click through title, briefing, hiring, build, trail, launch week and finale with placeholders, never getting stuck. Press the browser Back button and nothing breaks.
- **Checkpoint 2.** Play three full games. One must reach orbit, one must fail at launch, and one must go bankrupt. The dashboard values match what the screens say. One outsider plays with nobody helping.
- **Checkpoint 3.** Play the secret ending. Try Again works from the report. Mute works. Every history card shows its source link and every link opens.

## 13. Space Apps rules that affect us

- AI use is allowed but must be disclosed, including Claude-written code. That is what `AI-USE.md` is for.
- AI-generated images and video need a visible AI watermark and may not use NASA logos or mission insignia. We avoid the whole problem by drawing everything by hand.
- No promotion of commercial products. Rockets and companies stay fictional (Sparrow, Condor, Pelican, Zenith).
- NASA data or resources are required for global awards. Our history cards and their on-screen source links are how we meet that.
- The demo is a video of up to 30 seconds with English subtitles, or up to 7 slides, on a public link with no login.

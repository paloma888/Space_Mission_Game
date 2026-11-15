# Slice 5 notes: Launch & Report

Owner: Erick. Branch: `slice-5-finale`. This file is for the team and for the next Claude Code session.
The Rulebook and `docs/RULEBOOK-AMENDMENTS.md` still win over anything here.

| Who | Slice | Owns |
| --- | --- | --- |
| Audrey (Person 1) | Briefing & Hiring | `core/state.js`, `core/ui.js`, `core/screens.js`, the Rulebook |
| Daniel (Person 2) | Build & Launch Setup | `core/dashboard.js` |
| Sharon (Person 3) | The Trail | `core/events.js` |
| Paloma (Person 4) | Weather & Go/No-Go | `slices/launchweek/` |
| Erick (Person 5) | Launch & Report | `slices/finale/` |

## 1. Where things stand (Sat Nov 14, 2026, evening)

- Committed and pushed: the launch animation, `pixel.js`, the globe palette fix (commit `0f71226`, merged with main in `88984e8`).
- **Next task: the no-launch report (section 3).** Fully planned and approved by Erick. Not built yet.
- Then: the small altitude fix (section 4), then the rest of this push (section 5).

### What each file does

| File | Job |
| --- | --- |
| `finale.js` | The director. `show()` picks the ending, `playLaunch()` runs the launch, `report()` draws the mission report, `menu()` is Try Again |
| `launch-sim.js` | Pure math, no screens: `resolveLaunch` (rolls the launch once), `computeScore`, `oddsWords`, `pickHistoryCard` |
| `launch-anim.js` | The animated launch (camera, smoke, shake, emergencies, fly-away) |
| `launch-art.js` | Code-drawn placeholder art. The team's PNGs replace it automatically when they exist |
| `pixel.js` | Shared palette, color picking, `hash()`, dithering |
| `orbit-explorer.js` | The draggable 3D globe for the orbit ending |
| `endings.json`, `launch-text.json`, `badges.json` | All the words. Edit these, not the code |
| `history.json` | History cards for our endings (empty right now) |
| `test.html` | Runs Slice 5 alone. See section 6 |
| `sim-tests.html` | Checks the math. Everything must say PASS |
| `balance.html` | Plays thousands of games to see how the numbers feel |

## 2. Team decision: money rules (Amendment A13)

Agreed in team chat on Sat Nov 14. The full text and checklists are in A13.

| When | Rule |
| --- | --- |
| Build | Finishing with exactly $0 is fine |
| Trail weeks 1 and 2 | Debt is fine. A PR lead (Tasha or another PR hire) can run a fundraiser. Her salary is the price, so no PR lead means no fundraising |
| Start of week 3 and after | $0 or below means `bankrupt`. You're cooked |
| Launch week | Exactly $0 is fine. Below $0 means `bankrupt`. The launch fee may push it below $0 after you confirm |

⚠️ **Reminders for teammates (not our code, so we don't edit it):**
- **Sharon:** build the fundraiser (it needs a PR lead), allow debt in weeks 1 and 2, end the game if the budget is still $0 or below at the start of week 3, and set the new `fundraised` flag.
- **Audrey:** `checkEnd()` must not call it `bankrupt` during weeks 1 and 2. Today it ends the game the moment money hits $0, even right after the build.
- **Paloma:** in `launchweek.js`, use `budget < 0` in `ended()` and `endEarly()`, and warn in `waitUntil()` only when `budget - cost < 0`. Today, reaching exactly $0 ends the mission.

**Our part:** `endReason()` (below) treats launch-week bankruptcy as `budget < 0` and has a reason for going broke after a fundraiser. Our code must work before and after Sharon's, Audrey's and Paloma's changes land (A9).

## 3. Next task: the no-launch report

Only `bankrupt` and `window_closed` change. Endings where the rocket launched (orbit, launch failure, came home early) stay exactly as they are.

### 3.1 Screen

```
Left: Mission score         Middle: history card          Right: How far you got
 Smooth flight  - needs a     (real NASA story, lesson,     [x] Hiring    3 crew, 3 staff
                  launch       source link)                  [x] Build     Condor at Cape Canaveral
 Reached orbit  - needs...                                   [^] Trail     <- rocket marker
 Budget left    - needs...                                        Money ran out here, week 4
 Days to spare  - needs...                                   [ ] Launch week
 Morale         10 / 15                                      [ ] Launch
 Total          10 / 100
 "Launch the rocket to earn a medal."
 Badges greyed out: "Launch your ship to unlock badges"
Bottom: Rosa, 3 lines picked by the reason (joke, what happened, tip), What next? button
```

### 3.2 ⭐ `endReason(state)` in `launch-sim.js`

Pure function (reads, never changes anything, safe defaults so a thin test state can't crash it). Rules are checked top to bottom; the first match wins.

| # | Reason | Rule |
| --- | --- | --- |
| 1 | `gave_up` | `bankrupt` with budget above $0 (the player chose Give up in launch week) |
| 2 | `broke_overrun` | `bankrupt` and the `cost_overrun` flag is set |
| 3 | `broke_after_fundraise` | `bankrupt` and the `fundraised` flag is set (Sharon adds this flag, A13) |
| 4 | `broke_build` | `bankrupt` and (no `afterBuild` checkpoint, or that checkpoint's budget was under $40M) |
| 5 | `broke_trail` | `bankrupt` and launch week never started |
| 6 | `broke_launchweek` | `bankrupt` during launch week (budget below $0, A13) |
| 7 | `late_trail` | `window_closed` and launch week never started |
| 8 | `late_launchweek` | `window_closed` during launch week |

How the stages are told apart:
- **Build locked in:** Daniel's build slice saves the `afterBuild` checkpoint at Lock In. Its `budget` is the money left at that moment. Why rule 4: the trail costs at least $25M (5 weeks x $5M) plus surprises, so locking in with almost nothing is the real mistake. This still holds with A13: early debt only buys time, and without a PR lead nobody can pay it back.
- **Launch week started:** `launchweek.js` creates `state.weather` as soon as launch week starts (`if (!state.weather) state.weather = generateWeather(...)`).
- `giveUp()` in Paloma's `launchweek.js` sets `outcome = 'bankrupt'` even with money left. That's why rule 1 exists.

### 3.3 Score and badges (`computeScore`)

- Launched means the outcome is `orbit`, `launch_failure`, `came_home_early` or `aliens`.
- Not launched: every row except Morale gets `points: 0` and `locked: true`. The total is Morale only (max 15). Still saves `state.score`.
- No medal. `medalReason` = "Launch the rocket to earn a medal."
- All badges `earned: false, locked: true`.
- `report()` shows locked rows as "-" with a small grey "needs a launch", and greys out the badges under "Launch your ship to unlock badges", with the per-badge hints hidden.

### 3.4 ⭐ `progressTrack(state)` in `launch-sim.js` (right panel)

Returns 5 steps, each `done`, `stopped` or `todo`, with a detail line.

| Step | Done when | Detail |
| --- | --- | --- |
| Hiring | 3 crew hired | "3 crew, 3 staff" |
| Build | `afterBuild` checkpoint exists | "Condor at Cape Canaveral" (use the site names the globe already has) |
| Trail | launch week started | "Week 4 of 5" |
| Launch week | never, in these endings | "Day 39", plus scrubs if any |
| Launch | never | |

- The first unfinished step is `stopped` and gets the rocket marker plus a label: "Money ran out here", "Out of days here" or "Called off here".
- Draw the squares with CSS. Press Start 2P has no check mark or emoji glyphs.
- Rocket marker: `art/sprites/rocket_<id>.png` if it exists, otherwise the placeholder from `launch-art.js`.

### 3.5 History cards (`history.json`) ⚠️ TODO for the team

All three `history.json` files (trail, launchweek, finale) are empty, and history cards count for judging. Add these placeholder cards to `slices/finale/history.json`. Each one gets a `"todo"` field. When `report()` shows a card that has `todo`, it prints a yellow `console.warn` (F12) so unfinished cards are easy to spot. To finish a card: open the link in a private window, check the story against it, then delete the `todo` line. **Never invent a link.**

| Card | `when` | Real event | Candidate NASA source (open and check it) |
| --- | --- | --- | --- |
| James Webb Space Telescope | `outcome: ["bankrupt"]`, reasons 2 to 6, low priority | The budget was planned too low with too little reserve. It went far over budget and slipped for years, then launched in 2021 | https://www.nasa.gov/news-release/nasa-completes-webb-telescope-review-commits-to-launch-in-early-2021/ |
| InSight Mars lander | `reason: ["late_trail", "gave_up"]` | A leak in its seismometer was found before launch. It missed the March 2016 window. Mars windows come about every 26 months, so it launched in May 2018 | https://www.nasa.gov/news-release/nasa-suspends-2016-launch-of-insight-mission-to-mars/ and https://www.nasa.gov/news-release/nasa-targets-may-2018-launch-of-mars-insight-mission/ |
| Artemis I | `reason: ["late_launchweek"]` | Launch attempts in 2022 were scrubbed (one for a hydrogen leak). It took weeks of fixes and new dates before it flew | https://www.nasa.gov/blogs/missions/2022/09/03/artemis-i-launch-attempt-scrubbed/ |

- Write the stories at 80 to 120 words, with no numbers we haven't checked. The `tone` is `"plain"` or `"hopeful"` (no crew was lost in any of these).
- **New card condition `when.reason`** (a list of reasons from 3.2). `cardMatches()` checks it against `endReason()`. It's a small addition to Rulebook 7.4, so add it to the A11 note below.
- **Sharon:** the flag table says `cost_overrun` goes with a "James Webb card on bankruptcy", so she may write her own. Ours has a low priority, so hers wins if she does.

### 3.6 Ending text and Rosa's lines (`endings.json`)

Add a `reasons` object inside `bankrupt` and `window_closed`. Each reason has `rosa` (3 lines) and may have its own `title` and `text` for the ending screen. Keep the old `rosa` lines as the fallback. Line 1 is Erick's joke, line 2 says what happened, line 3 is a tip. All lines are 140 characters or fewer.

**broke_build**
1. "We're not that rich... Leave money for the road ahead."
2. "The build used up almost all our money before the trail even started."
3. "Next time, pick cheaper parts where it's safe and keep a cushion for the trip."

**broke_trail**
1. "Money doesn't grow on trees now. Save a cushion."
2. "Every week on the trail costs money, and surprises cost even more."
3. "Like gas money on a road trip, keep some extra for the bumps."

**broke_launchweek**
1. "Congratulations, you successfully funded the launchpad's parking fees. The rocket stays on the ground."
2. "Every day we wait costs money, and holds and scrubs cost even more."
3. "Sometimes the first good day is the best day. Pick it and go."

**broke_overrun**
1. "Remember that cost review? The flag is not getting any redder."
2. "That review was a warning light on the dashboard, and we drove right past it."
3. "When someone checks your spending, listen. Fixing it early is cheaper."

**broke_after_fundraise** (Claude's draft, Erick to approve)
1. "Tasha passed the hat, and we spent the hat too."
2. "The fundraiser bought us time, but the spending kept going."
3. "Extra money is a second chance. Spend it like it's the last one."

Idea, not yet decided: when `broke_trail` or `broke_build` happens with no PR lead on staff, swap line 3 for "Next time, a PR lead can run a fundraiser when money gets tight." It teaches the new rule.

**late_trail**
1. "You took the scenic route, and the launch window left without you."
2. "Some trail choices cost days. Those days added up fast."
3. "When a choice costs time, ask yourself if the time is worth it."

**late_launchweek**
1. "The forecast for tomorrow looks phenomenal. Shame the mission ended today."
2. "We waited for perfect weather, and the window closed while we waited."
3. "A launch window is like catching a train. A good-enough day beats a missed train."

**gave_up** (Claude's draft, Erick to approve. Title "Mission called off", text "You called off the launch. The crew is safe, and the rocket waits for another day.")
1. "Calling it off is a real Flight Director move. It takes guts."
2. "The capsule wasn't ready, and there wasn't enough time or money to finish it."
3. "Next time, keep the build moving on the trail so launch week starts with a full capsule."

### 3.7 Files to change (all in `slices/finale/`)

| File | Change |
| --- | --- |
| `launch-sim.js` | ⭐ `endReason()`, ⭐ `progressTrack()`, no-launch rules in `computeScore()`, `when.reason` in `cardMatches()` (pass the reason in) |
| `finale.js` | `report()`: locked rows and badges, the track instead of the odds when there was no launch, Rosa lines and ending title/text by reason, `console.warn` for `todo` cards |
| `finale.css` | Locked row and badge styles, track styles |
| `endings.json` | `reasons` (section 3.6) |
| `history.json` | The 3 cards (section 3.5) |
| `test.html` | `&endAt=` and friends (section 6) |
| `sim-tests.html` | Checks: all 8 reasons, Morale-only score, locked badges, the track stops at the right step |

Also: add a "No-launch endings" part to Amendment A11 (Morale-only score, locked badges, the progress track, `when.reason`), and log the work in `AI-USE.md` under Erick's heading (Person 5: Launch & Report).

## 4. Small fix: a bigger ≈ in the altitude counter

Press Start 2P has no ≈ glyph, so the browser borrows a small one from another font. In `launch-anim.js`, where the `ALTITUDE ≈ N KM` label is written, wrap the ≈ in its own `<span class="fin-approx">` and make it about 1.5 times bigger in `finale.css`, lined up with the text.

## 5. The rest of this push (planned, waiting on Erick's choices)

- **Smoother emergency transitions:**
  - No hard cut from the climb into space: keep climbing until the sky is black, fade the engine, separate the capsule, and slide the Earth's edge up from below.
  - A calm beat before each alarm.
  - Power as a "dying flashlight": a battery meter draining, the window dimming in palette steps, at most 3 flickers a second. Today it is a tiny random 10 per second flicker that looks glitchy.
  - The life support alarm fades in.
  - **Open:** a splashdown beat (parachutes, splash, "The crew is safe")?
- **Backgrounds:** the plan changed, and Erick now makes them. Rulebook: hand-made pixel art only, so Erick draws them (Piskel or Lospec, 320x180, team palette). Code support: layered PNGs (`sky`, `far`, `mid`, `ground`) with parallax, a `&guides=1` overlay on `test.html` showing the pad, rocket and horizon lines, and optional failure layers. **Open:** confirm with the team.
- **Galaxies:** real Andromeda (a tilted spiral: gold core, blue arms, pink star nurseries, dark dust lanes), the Large and Small Magellanic Clouds, and a Milky Way band, all clickable, with facts in `explorer-facts.json` (empty NASA source slots). The palette has no bright pink, so dither `#e5bda3` with `#bb6a52`. **Open:** code-drawn (like the globe) or Erick's hand-drawn sprite, and globe only or also in the black launch sky?
- **Sun aura and sunrise rim on the globe.** Palette roles already checked: sunCore `#f6dcb8` maps to c15, sunHalo `#b86850` to c2.

## 6. Testing

Open pages with VS Code Live Server, never by double-clicking. Check F12 for red errors.

Existing `test.html` options:
- `?outcome=orbit|launch_failure|came_home_early|bankrupt|window_closed`
- `&site=canaveral|kodiak|kourou|mahia|sriharikota`
- `&rocket=sparrow|condor|condor_reflown|pelican`
- `&weather=clear|rain|fog|wind|storm|cold`
- `&emergency=life_support|power` (fixed in orbit)
- `&cause=power|life_support|lightning`
- `&report=1` (skip straight to the report)

Add for section 3:
- `&endAt=build|trail|launchweek|giveup`
- `&lean=1` (locked in with almost no money)
- `&overrun=1` (`cost_overrun` flag)
- `&fundraised=1` (`fundraised` flag)

| URL | Should show |
| --- | --- |
| `?outcome=bankrupt&endAt=build` | broke_build, the track stops at Build |
| `?outcome=bankrupt&endAt=trail` | broke_trail, stops at Trail |
| `?outcome=bankrupt&endAt=trail&lean=1` | broke_build |
| `?outcome=bankrupt&endAt=trail&overrun=1` | broke_overrun |
| `?outcome=bankrupt&endAt=trail&fundraised=1` | broke_after_fundraise |
| `?outcome=bankrupt&endAt=launchweek` | broke_launchweek |
| `?outcome=bankrupt&endAt=giveup` | gave_up, "Mission called off", InSight card |
| `?outcome=window_closed&endAt=trail` | late_trail, InSight card |
| `?outcome=window_closed&endAt=launchweek` | late_launchweek, Artemis I card |

## 7. Next push (parked)

- Custom failure screens per failure type.
- Rosa explains the launch stages, and a clickable altitude equation (labeled as simplified, numbers checked with NASA).
- NASA sources in the globe's fact boxes.
- A settings menu with a reduce-motion toggle (coordinate with Audrey).
- A mission patch.
- A "Close Encounter" badge when the secret ending returns (A6).
- A mass penalty (needs Daniel and an amendment).
- A UI redesign from the team's design. Don't restyle until Erick shares it.

## 8. Team to-dos

- **Sharon:** ⚠️ the fundraiser and the early-debt rule (A13 checklist). The Webb card overlap (section 3.5). History cards for the trail.
- **Audrey:** the `checkEnd()` change for weeks 1 and 2 (A13).
- **Paloma:** the $0-in-launch-week change (A13). History cards for launch week.
- **Sharon and Paloma:** the history cards are empty everywhere, and they count for judging. Use the A11 outcome names in `when.outcome`.
- **Rocket artists:** at separation the game cuts the rocket picture 60% of the way down. The top flies on and the bottom falls away. Draw a seam there.
- **Everyone:** review A11 and A13.

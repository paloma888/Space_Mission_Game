# Launch Trail Rulebook Amendments

Changes to `docs/RULEBOOK.md`. **Where an amendment and the Rulebook disagree, the amendment wins.** Anything not mentioned here still follows the Rulebook.

How to add one: give it the next number, name the Rulebook section it changes, say who proposed it and who it affects, and post it in team chat. Merging an amendment to `main` needs a teammate's approval like any other pull request, and Person 1 (Rulebook owner) should be one of the reviewers.

Status tags: **ADOPTED** (merged and agreed), **PROPOSED** (written, waiting for team OK), **OPEN** (a question that still needs an answer). Until an amendment is ADOPTED, slices should keep working either way (see A9).

---

## A1. Launch sites (changes sections 5 and 6.6)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Persons 3, 4, 5.

`site` is one of `'canaveral' | 'kodiak' | 'kourou' | 'mahia' | 'sriharikota'`. `vandenberg` and `wallops` are removed.

| id | Site | Fee | Lift bonus | Orbits | Not allowed | deliveryFactor | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `canaveral` | Cape Canaveral, Florida | $40M | 0% | leo | | 1 | Thunderstorms, lightning |
| `kodiak` | Kodiak, Alaska | $15M | 0% | leo, polar | | 1 | Freezing temperatures |
| `kourou` | Kourou, French Guiana | $70M | +10% | leo | | 2 | Late deliveries |
| `mahia` | Mahia, New Zealand | $20M | 0% | leo, polar | `pelican` | 2 | Island, slow deliveries, small pads |
| `sriharikota` | Sriharikota, India | $30M | +5% | leo, polar | | 1 | Monsoon rain and wind |

Person 4 needs `art/backgrounds/launchweek/site_mahia.png` and `site_sriharikota.png` and weather for both. No real company names in game text.

## A2. The crew never dies (changes sections 1, 6.5, 6.8, 6.9)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Person 5 most.

The game is for kids, so no ending loses the crew. A failed launch is a failed mission and the crew is safe. The memorial tone rule still applies to real NASA history cards (Challenger, Apollo 1, Columbia).

- The `lost` and `abort` outcomes need new names and rules (OPEN, Person 5).
- The "Crew safety" score part and the Safety First badge need rework (OPEN, Person 5).
- What a life support emergency does now that it cannot lose the crew (OPEN, Persons 2 and 5).

## A3. Parts (changes section 5.1)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Persons 3, 5.

```js
parts = {
  shell: 'standard', lifeSupport: 'standard',
  power: { type: 'battery', tier: 'standard' },
  comms: 'standard', computer: 'standard'
}
```

- `abort` is removed (see A2).
- `science` is removed for Mission 1. Where its 5 score points go is OPEN (Person 5).
- `computer` (flight computer) is new and required. It can cause software-error events (Person 3) and its reliability bonus raises launch odds.
- Power is battery only. `type` stays in the data so solar can return in Mission 2.
- `warpCoil` is `true` only when the player buys the dealer's "mysterious component" (see A6).
- Dealer parts use the tiers `'shady_budget'`, `'shady_standard'` and `'shady_premium'` (see A5).

## A4. Derived fields (changes section 5)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Person 5.

`derived.solarFailChance` is always 0 and `derived.scienceOk` is always false in Mission 1. Both fields stay in `state` so code that reads them keeps working.

## A5. Shady dealer and the `shady_part` flag (changes section 6.7)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Persons 3, 5.

The shady dealer offers a trade-in after the shop: the same battery, radio or flight computer the player bought, for half the price, with a hidden reliability penalty (through `rel.parts`). It reports as the tier it copies, so other slices see no difference. New flag-registry row:

| Flag | Set by | Read by | Meaning |
| --- | --- | --- | --- |
| `shady_part` | Person 2 | 3, 5 | At least one shady part was installed at Lock In. |

## A6. Warp Coil comes back as a dealer upsell (changes sections 6.7, 6.9 and 12)

Status: PROPOSED (by Person 2, Nov 15, 2026), replacing the earlier "paused" version. Affects Person 5.

After the player takes the shady dealer's trade-in (A5), the dealer offers a "mysterious component" for $10M more. That is the Warp Coil: 0.2 t, no power, reliability -0.03 through `rel.parts`. Buying it sets `parts.warpCoil = true` and the `warp_coil` flag, and counts as a shady part for `shady_part`. It is offered only if it still fits on the rocket and the player can pay. The game never explains what it does.

The secret `aliens` ending works as in Rulebook 6.9: `warp_coil` flag, launch on the last day of the window (`launchDay === windowCloses`), and the liftoff stage passes. `launch-sim.js` already checks this. Checkpoint 3 requires the secret ending again.

## A7. Presets (changes section 12)

Status: ADOPTED (proposed by Person 2, approved by the team). Person 1 owns `core/state.js`.

`afterBuild`: standard shell, life support, battery, comms and computer, no abort, no science, Condor at Canaveral, leo. Budget 190, mass 7.3 t, margin +2.7 t (Condor lifts 10 t after the rocket retune), power 320 of 600 W, `rel.parts` 0.07, spent 370. Once `recompute` merges, the preset should call it instead of hard-coding `derived`.

## A8. Open questions

- Power over supply at launch: lower the launch odds, or block Lock In? (Persons 2, 5)
- Do comms and morale affect the Go/No-Go poll? (Person 4)
- Do morale and the flight computer affect events? (Person 3)

## A9. Working while amendments are PROPOSED

Write code that works under both the Rulebook and the amendment. For example, ignore unknown part keys instead of crashing, and keep removed `derived` fields at safe default values.

## A10. Happy and sad portraits (changes sections 1, 4, 7.2, 8 and 9)

Status: PROPOSED (proposed by Person 1 on Nov 14, 2026). Affects everyone who draws portraits or writes dialogue. Person 1 owns `core/ui.js`.

Every character now has two expressions, happy and sad. Happy is the default.

| Mood | File |
| --- | --- |
| `happy` | `art/characters/<id>.png` |
| `sad` | `art/characters/<id>_sad.png` |

- `ui.portrait(id, size, mood)` takes an optional `mood`, either `'happy'` or `'sad'`.
- `ui.say(id, text, opts)` and `ui.ask(id, text, choices, opts)` take an optional `opts.mood` with the same two values.
- A dialogue line written in data (section 7.2) may carry an optional `mood` field, for example `{ "speaker": "rosa", "text": "Hello.", "mood": "sad" }`. A missing `mood` means happy.
- Old calls still work. `ui.say('rosa', 'text')` with no mood behaves exactly as before.

**Fallback order when art is missing.** Try the requested mood file, then the happy file, then the colored placeholder box. A missing face must never throw an error.

**Tone rule.** In the `lost` ending (or whatever A2 renames it to) and in any real crew-loss history card, sad faces stay gentle and serious. Never use them for a joke.

## A11. Endings, emergencies and score after A2 and A3 (changes sections 5, 6.5, 6.8, 6.9 and 7.4)

Status: PROPOSED (proposed by Person 5 on Nov 14, 2026). Affects Persons 1, 2, 3 and 4. Answers the Person 5 OPEN items in A2 and A3.

**Outcomes.** `state.outcome` is one of `'orbit' | 'launch_failure' | 'came_home_early' | 'bankrupt' | 'window_closed' | 'aliens'`. `abort` and `lost` are removed. The crew is safe in every ending. `aliens` is the secret ending from A6 (the mysterious component, launching on the last day).

| Outcome | Trigger | Medal? |
| --- | --- | --- |
| `orbit` | All four stages pass, and every emergency in orbit is fixed | Yes, at 60 or more |
| `launch_failure` | Any of the four stages fails, including an unfixed lightning strike at liftoff | No |
| `came_home_early` | All four stages pass, then an emergency in orbit is not fixed. The crew reached space but ends the mission early | No |
| `bankrupt`, `window_closed` | Unchanged | No |

**Emergencies (section 6.5).** The save chance formula and the power penalty (0.25 lower) are unchanged. A fixed emergency lets the mission continue and costs 10 points of Smooth flight. An unfixed one ends the mission as `came_home_early`. Real examples: Gemini 8 (1966) and Apollo 13 (1970) both ended early and brought the crew home.

**Score (section 6.8).** Still out of 100. Crew safety becomes Smooth flight, and science's 5 points move to Morale.

| Part | Points | Rule |
| --- | --- | --- |
| Smooth flight | 30 | `orbit` or `aliens`: 30 minus 10 per fixed emergency. Otherwise 0 |
| Reached orbit | 30 | `orbit` or `aliens`: 30. `came_home_early`: 15. Otherwise 0 |
| Budget left | 15 | Unchanged |
| Days to spare | 10 | Unchanged |
| Morale | 15 | `15 * morale / 100` |

**Badges.** Safety First is replaced by Honest Parts: earned when the `shady_part` flag (A5) is not set. New secret badge, Close Encounter: earned in the `aliens` ending (A6). The report shows it only once it is earned, so it does not spoil the secret.

**What each person needs to change**

- **Persons 3 and 4 (history cards, section 7.4):** use the new names in `when.outcome`. Launch-time failures use `["launch_failure"]`. Problems that could also show up in orbit use `["launch_failure", "came_home_early"]`. Challenger keeps `tone: "memorial"`, because it is real history.
- **Persons 2, 3 and 4 (game text):** no line should mention an abort or escape system, or put the crew in danger.
- **Person 2:** the life support `emergencyChance` and `powerOk: false` now risk `came_home_early`, not a crew loss. For the A8 power question, Slice 5 currently treats power over supply as a certain emergency in orbit with a lower fix chance. Tell Person 5 if Lock In should block it instead.
- **Person 1:** update the `outcome` comment in section 5. A10's tone rule about the `lost` ending no longer applies, since that ending is gone.

**No-launch endings (`bankrupt`, `window_closed`).** Added by Erick (Person 5) on Sun Nov 15, 2026.

- **Score.** Every part except Morale needs a launch, so those parts show "needs a launch" and score 0. The total is Morale only (at most 10 since A14). No medal, and every badge is locked ("Launch your ship to earn a medal and unlock badges").
- **Why it ended.** `endReason(state)` in `slices/finale/launch-sim.js` gives one of 8 reasons:

  | Reason | When |
  | --- | --- |
  | `gave_up` | Give up in launch week |
  | `broke_overrun` | The `cost_overrun` flag is set |
  | `broke_after_fundraise` | The `fundraised` flag is set (A13) |
  | `broke_build` | No Lock In, or locked in with under $40M |
  | `broke_trail` | Money ran out on the trail |
  | `broke_launchweek` | Money ran out in launch week |
  | `late_trail` | Out of days on the trail |
  | `late_launchweek` | Out of days in launch week |

  Rosa's debrief and the history card both follow the reason.
- **How far you got.** In place of "What shaped your odds", the report shows a track: Hiring, Build, Trail, Launch week, Launch, with the player's rocket on the step where the game stopped.
- **New card condition (section 7.4).** A history card's `when` may hold `reason`, either one reason or a list, for example `"reason": ["late_trail", "gave_up"]`.
- **What other slices rely on.**
  - The build slice saves the `afterBuild` checkpoint at Lock In.
  - Launch week creates `state.weather` on its first day.
  - Give up sets `outcome` to `bankrupt` with money left.

  Tell Erick if any of these change.


## A12. Mission Control AI is out of scope for now (changes section 4)

Status: ADOPTED (proposed by Person 4, team decision Sat 2:45pm). Affects Persons 4, 5.

No Foundry or Azure AI service. `slices/launchweek/ask-rosa.js` stays a stub that always returns `null`. No screen may depend on it: every explanation uses scripted text in the character's voice. Person 5's report screen does not need the three "Why?" AI buttons. This overrides the `askRosa` parts of Rulebook section 4.

## A13. Money: early debt, fundraising and launching at $0 (changes sections 6.2 and 6.7)

Status: PROPOSED (agreed in team chat on Sat Nov 14, 2026; written up by Erick, Person 5). Affects Audrey (Person 1), Sharon (Person 3), Paloma (Person 4) and Erick (Person 5).

**Early debt (trail weeks 1 and 2).** The budget may go to $0 or below in trail weeks 1 and 2 without ending the game. If the budget is still $0 or below when week 3 starts, the game ends as `bankrupt`. From week 3 on, $0 or below is `bankrupt` right away, as before. Finishing the build with exactly $0 left is also allowed, because week 1 hasn't started yet.

**Fundraising.** Only possible with a PR lead on staff (`requires: "pr"`). The PR lead's salary, paid at hiring, is the price; the fundraiser itself costs nothing extra. Without a PR lead there is no fundraising, so early debt that isn't paid off by week 3 ends the game. Sharon decides how much it raises (for example, by PR skill), whether it is once only, and Tasha's lines.

New flag-registry row:

| Flag | Set by | Read by | Meaning |
| --- | --- | --- | --- |
| `fundraised` | Person 3 | 5 | A PR fundraiser ran on the trail. |

**Launching at $0 (launch week).** Exactly $0 is not bankrupt; only below $0 is. Example: with $10M left, the player waits one more day for $10M and launches that day with $0. The launch site fee charged on confirmation may take the budget below $0. That was already allowed: `checkEnd()` ignores the budget once `launchDay` is set.

What each person needs to change:
- **Sharon (Person 3), trail:**
  - [ ] Add a fundraising choice or event that needs a PR lead.
  - [ ] Allow debt in weeks 1 and 2.
  - [ ] End the game as `bankrupt` if the budget is $0 or below when week 3 starts, or any time after that.
  - [ ] Set the `fundraised` flag when a fundraiser runs.
- **Audrey (Person 1), `core/state.js`:**
  - [ ] In `checkEnd()`, don't return `bankrupt` while `state.week` is 1 or 2 and no launch day is set. The trail enforces the week-3 rule itself.
- **Paloma (Person 4), `launchweek.js`:**
  - [ ] Use `budget < 0` in `ended()` and `endEarly()`.
  - [ ] Warn in `waitUntil()` only when `budget - cost < 0`.
- **Erick (Person 5), report:**
  - [ ] Treat launch-week bankruptcy as `budget < 0`.
  - [ ] Add a "broke after fundraising" reason for Rosa.

## A14. Harder to win, and careful play pays (changes sections 6.3, 6.8 and the A11 score table)

Status: ADOPTED (proposed by Paloma, Person 4, from a playtest of about 150,000 simulated games; approved in team chat on Sun Nov 15, 2026). Affects Audrey (Person 1), Person 2, Sharon (Person 3) and Erick (Person 5). Person 1 should review the pull request.

**Why.** The playtest found that any clean orbit already earned bronze (Smooth flight 30 + Reached orbit 30 = 60). A random clicker won a medal 1 game in 3. Gold went mostly to the cheapest, most reckless play, because careful steps cost money and days and earned no points.

**Score.** Replaces the score table in A11. Still out of 100.

| Part | Points | Rule |
| --- | --- | --- |
| Smooth flight | 30 | Unchanged |
| Reached orbit | 25 | `orbit` or `aliens`: 25. `came_home_early`: 12.5. Otherwise 0 |
| Good calls | 20 | 5 each for the Measure Twice, Team Player and Honest Parts badges, plus 5 if `launchProbability` is 0.85 or more at launch |
| Budget left | 10 | `10 * min(1, budget / 200)` |
| Days to spare | 5 | `5 * clamp((windowCloses - launchDay) / 6, 0, 1)` |
| Morale | 10 | `10 * morale / 100` |

No-launch endings still score Morale only, now at most 10.

**Medals.** Bronze 70, silver 82, gold 92.

**Launch odds.**
- `rel.base` drops from 0.80 to 0.72 (`core/state.js`).
- Every budget-tier part has reliability -0.02 instead of 0.00 (`slices/build/parts.json`). Dealer copies of budget parts drop by the same amount.

**Bug fixes in the same pull request.** No rule changes. Listed so each owner knows.
- `slices/trail/trail.js`: the last trail week only adds days up to `windowOpens`, so the trail can no longer push the day past `windowCloses` (Rulebook 6.1).
- `slices/trail/week.js`: a week with nobody on Test is not a skipped week once Testing is at 100. The `rel.testing` formula moved into the exported `updateTestingReliability(state)`.
- `slices/launchweek/launchweek.js`: Hold's +10 testing now calls `updateTestingReliability()`, so it raises the launch odds. The formula stays in Slice 3.
- `slices/finale/finale.css`: score rows could stop one animation step short (a floating-point delay). They now use `steps(3, jump-start)`.
- Tests updated to the new numbers: `slices/finale/sim-tests.html`, `slices/finale/balance.html`, `core/state-test.html`.

**Result** (together with A15, 3,000 simulated games each):

| Player | Medal before | Medal after | Gold after |
| --- | --- | --- | --- |
| Random clicker | 32% | 15% | 0% |
| Follows Rosa's advice | 74% | 82% | 1.4% |
| Reckless (no testing, shady parts, ignores No-Go) | 47% | 26%, bronze only | 0% |
| Cheapest everything (Sparrow, budget parts, cheapest crew) | 80% | 41%, almost all bronze | 0% |

Luck still matters: a careful player loses about 1 launch in 6.

## A15. Crew skills change the launch odds (changes sections 6.3 and 6.4)

Status: ADOPTED (proposed by Paloma, Person 4, after testing 9 formulas on all 56 possible crews; approved in team chat on Sun Nov 15, 2026). Affects Audrey (Person 1, owns `core/state.js`) and Erick (Person 5).

**Why.** Before this, the Piloting stat was never used, and the cheapest crew scored best because the money saved counted in Budget left.

**Rule.** The best pilot flies the rocket and the best engineer keeps it reliable. 4 is the best on the roster, so a top pilot and a top engineer change nothing. Each point below 4 costs 0.05.

```js
getReliability(state) = clamp(rel.base + rel.parts + rel.testing + rel.events
                              - 0.05 * (4 - bestEngineering), 0.5, 0.98)
launchProbability(state) = clamp(getReliability(state)
                                 * derived.rocketReliability
                                 * (1 - 0.05 * (4 - bestPilot))
                                 * (1 - weatherPenalty)
                                 * (1 - overrulePenalty), 0.05, 0.99)
```

`bestPilot` and `bestEngineering` are the highest values among the 3 astronauts, read with `bestCrewSkill(state, skill)` from `core/state.js`. A state with no crew counts as 4. No new state fields.

**Report.** "What shaped your odds" gets a "Your astronauts" row: Top pilot and engineer, Nearly ready, or Missing key skills.

**Result.** The gap between the best and worst crews grew from 5.8 to 8.8 points, and the cheapest crew dropped from 9th to 34th of 56. The best crews pair Amara or Dmitri with Jun or Zainab. The worst have no engineer, which matches Rosa's "light engineering" warning at hiring.

If anyone changes an astronaut's stats in `candidates.json` (for example, adds a 5), tell Audrey: `CREW_TOP` in `core/state.js` may need to change, and the balance should be retested.

## A16. The launch window is days 40 to 46 (changes sections 5, 6.1, 6.6 and 12)

Status: PROPOSED (written by Paloma, Person 4, to match the code; Audrey to confirm). Affects everyone who reads `windowOpens` or `windowCloses`.

`createState()` in `core/state.js` sets `windowOpens: 40` and `windowCloses: 46`, and the presets use the same window (`readyToLaunch` on day 40, `launched` on day 41, `secret` on day 46). The Rulebook still says days 36 to 42. This amendment records what the code does.

- The trail still ends after week 5 (day 36 with no delays) or when the day reaches `windowOpens`.
- Launch week starts on day 40. The days between the end of the trail and day 40 pass for free.
- Code that reads `windowOpens` and `windowCloses` instead of typing 36 or 42 needs no change.

If Audrey prefers 36 to 42, change `createState()` and the presets instead, and mark this amendment withdrawn.
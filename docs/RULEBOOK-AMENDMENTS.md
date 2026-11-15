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
- `warpCoil` is removed for now (see A6).
- Shady parts may use a tier of `'shady'` (see A5).

## A4. Derived fields (changes section 5)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Person 5.

`derived.solarFailChance` is always 0 and `derived.scienceOk` is always false in Mission 1. Both fields stay in `state` so code that reads them keeps working.

## A5. Shady dealer and the `shady_part` flag (changes section 6.7)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Persons 3, 5.

The shady dealer sells cheap parts with premium-tier stats and a hidden reliability penalty (through `rel.parts`). New flag-registry row:

| Flag | Set by | Read by | Meaning |
| --- | --- | --- | --- |
| `shady_part` | Person 2 | 3, 5 | At least one shady part was installed at Lock In. |

## A6. Warp Coil and the secret ending are paused (changes sections 6.7, 6.9, 12 and Checkpoint 3)

Status: ADOPTED (proposed by Person 2, approved by the team). Affects Person 5.

The Warp Coil is not sold in Mission 1, so the `aliens` ending cannot trigger. The `warp_coil` flag name and the `secret` preset stay reserved so it can come back. Checkpoint 3 no longer requires the secret ending.

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

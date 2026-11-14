# Launch Trail

A pixel-art, Oregon Trail-style game for the 2026 NASA Space Apps Challenge ("Space Mission Design Game"). You run a tiny space agency and must get a three-person crew to orbit before the budget, the schedule or the weather runs out. Every failure ends with the real NASA story behind it.

**Read `docs/RULEBOOK.md` before writing any code.** It beats everything else, including this file.

## Run it on your laptop

1. Install VS Code and the **Live Server** extension.
2. Open this folder in VS Code, right-click `index.html`, then choose **Open with Live Server**.
3. Never open HTML files by double-clicking. JavaScript modules and `fetch()` don't work from `file://`, so you'll just see a blank page.

## Test one slice alone

Open `slices/<name>/test.html` with Live Server. Add `?preset=<name>&seed=123` to the address to pick a starting state (see RULEBOOK section 12 for presets). In the full game, press the backtick key (`) to open the dev panel.

## Slices

| # | Slice | Folder | Owner |
| --- | --- | --- | --- |
| 1 | Foundation, Briefing & Hiring | `slices/briefing/` | Person 1: Audrey R.|
| 2 | Build & Launch Setup | `slices/build/` | Person 2: Daniel U.|
| 3 | The Trail | `slices/trail/` | Person 3: Sharon O.|
| 4 | Weather & Go/No-Go | `slices/launchweek/` | Person 4: Paloma P.|
| 5 | Launch & Report | `slices/finale/` | Person 5: Erick G.|

## Workflow

- Work on your own branch: `slice-<number>-<name>`, for example `slice-3-trail`.
- Run `git pull origin main` before each block of work. Commit every 30 to 45 minutes.
- Open a pull request to `main` when your `test.html` passes. One teammate skims it. Merging to `main` deploys the game.
- Log what Claude did in `AI-USE.md` under your heading.

## Live game

URL: TODO, add once Azure Static Web Apps is connected.

## Credits

- Font: TODO
- Palette: TODO, add the Lospec palette name and link
- Sound effects: TODO
- History card sources are linked on each card in the game.
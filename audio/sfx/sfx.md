# Sound effects

- **Made with jsfxr** (free, in the browser). Export as `.wav`.
- **Files:** `audio/sfx/<slice>-<name>.wav`, for example `trail-event.wav`. Play it with `ui.sfx('trail-event')`.
- **Keep them short** (most under 1 second) and each file under 500KB.
- **Missing files are fine.** `ui.sfx()` stays silent until the file exists.
- Audio starts muted until the player's first click, because browsers block autoplay.

Suggested starters:

- **briefing:** `briefing-type` (typewriter tick), `briefing-hire`, `briefing-click`
- **build:** `build-buy`, `build-refuse` (can't afford / too heavy), `build-lockin`
- **trail:** `trail-event`, `trail-good`, `trail-bad`, `trail-week`
- **launchweek:** `launchweek-thunder`, `launchweek-go`, `launchweek-nogo`, `launchweek-scrub`
- **finale:** `finale-ignition`, `finale-stage`, `finale-boom`, `finale-abort`, `finale-orbit`
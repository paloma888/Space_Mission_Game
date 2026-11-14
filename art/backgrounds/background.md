# Backgrounds

- **Size:** 320 x 180 px, opaque PNG, shown at 4x (1280 x 720).
- **Colors:** we have the 16-color palette, but for now not going to use it.
- **Hand-made only:** no AI images, no NASA logos, no real company logos.
- **Files:** `art/backgrounds/<slice>/<name>.png`, lowercase_with_underscores, each under 500KB.
- **Missing files are fine.** `ui.screen()` draws a labeled colored box until the PNG exists, so code can use a name before the art is done.

Suggested names (agree in chat before coding against them). Each person draws their own slice's backgrounds.

| Slice | Folder | Files |
| --- | --- | --- |
| 1 Briefing | `briefing/` | `agency_hq.png`, `office.png` |
| 2 Build | `build/` | `hangar.png`, `rocket_yard.png` |
| 3 Trail | `trail/` | `mission_control.png`, `trail_map.png` |
| 4 Launch week | `launchweek/` | `canaveral.png`, `vandenberg.png`, `wallops.png`, `kodiak.png`, `kourou.png`, `control_room.png` |
| 5 Finale | `finale/` | `sky.png`, `orbit.png`, `space.png`, `ending_<outcome>.png` |

The launch-site file names match the `state.site` ids, so code can build the file name straight from the state. `ending_lost.png` is the memorial scene: quiet and respectful, with no jokes (RULEBOOK section 1).
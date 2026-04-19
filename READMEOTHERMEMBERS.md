# READMEOTHERMEMBERS

This build now keeps the sound setup, machine catalog, and shift clock timing in predictable folders and config files:

- Edit `src/constants/gameConstants.js`
- Edit machine definitions in `src/data/machineCatalog.js`
- Edit saved player settings in `src/state/gameSettings.js`
- Put sound files in `assets/sounds/`
- Put machine PNGs in `assets/machines/sprites/`

Sound setup:

- Every sound lives in the `SOUND_ASSETS` object.
- Sounds are now grouped by folder:
  - `assets/sounds/music/`
  - `assets/sounds/sfx/`
  - `assets/sounds/ui/`
  - `assets/sounds/voice/`
- If you add or replace a sound, the easiest path is to drop the file into the right folder and only change the filename or subfolder in `SOUND_ASSETS`.
- The opening flow currently looks for these files:
  - `assets/sounds/ui/ui_title_play.wav`
  - `assets/sounds/voice/phone_ring.wav`
  - `assets/sounds/voice/phone_voice_intro.wav`
- The opening phone call subtitles and per-line placeholder voice files now also look for:
  - `assets/sounds/voice/phone_intro_line_1.wav`
  - `assets/sounds/voice/phone_intro_line_2.wav`
  - `assets/sounds/voice/phone_intro_yes_line_3.wav`
  - `assets/sounds/voice/phone_intro_yes_line_4.wav`
  - `assets/sounds/voice/phone_intro_yes_line_5.wav`
  - `assets/sounds/voice/phone_intro_yes_line_6.wav`
  - `assets/sounds/voice/phone_intro_no_line_3.wav`
  - `assets/sounds/voice/phone_intro_no_line_4.wav`
- Factory outcome feedback also now looks for:
  - `assets/sounds/sfx/sfx_notification_alert.wav`
  - `assets/sounds/sfx/sfx_puzzle_fixed.wav`
- Placeholder copies exist right now so the flow makes noise even before real assets are added.
- Music on/off is now stored through `src/state/gameSettings.js` and reused by the factory, summary, ending, and briefing scenes.

Machine setup:

- Machine sprites live in `assets/machines/sprites/`.
- `src/data/machineCatalog.js` is the editable machine database/module.
- Each machine entry has:
  - a display `name`
  - a `sprite` path and fallback to the block placeholder if the PNG is missing
  - a `communicationChance`, so some units or machines stay silent on spawn
  - `possibleGrids`, which is a list of grid bundles
  - each `possibleGrids` entry contains:
    - `grid`, the 2D array
    - `dominos`, the domino list that travels with that grid choice
    - `impossible`, a boolean that marks whether the layout should be scrapped for a bonus
  - `openingDialogues`
  - `questionDialogues`, where every question has `yesDialogue` and `noDialogue`
- Shape grid values are:
  - `0` = open slot
  - `1` = locked frame or wall
  - `2` = charge slot with required pip value `1`
  - `3` = charge slot with required pip value `2`
  - `4` = charge slot with required pip value `3`
  - `5` = charge slot with required pip value `4`
- A grid cell can also be a coordinate pair like `[4, 2]`.
- Coordinate-pair cells are equality links. The linked destination cell must also point back to the source cell.
- Equality links act like open cells for placement, and the pair counts as complete when both linked cells are occupied by the same pip amount.
- During play, any placed open cell is encoded into a runtime value `10+pipCount`.
- During play, any placed charge cell is encoded into a runtime value like `21`, `32`, `43`, or `54`, where the first digit reflects the base charge slot and the second digit is the placed pip count.
- Charge cells always render their yellow required number in the puzzle overlay, even if debug values are enabled.
- Equality links render with a yellow `=` and a yellow connector line between the paired cells.
- Domino entries use:
  - `firstOptionAmount` for the top half pip count
  - `secondOptionAmount` for the bottom half pip count
- The game now picks a random machine entry, then randomly picks one grid bundle, one opening line, and one question branch whenever a machine spawns.
- Each spawned machine owns its own instantiated puzzle object now, so domino placements persist on that machine while it is active.
- Clicking the machine on the conveyor opens the domino/grid overlay.
- Dominoes can be placed on empty cells and charge cells, but never on `1` wall cells.
- Clicking a domino while it is still on the table now rotates it clockwise and lets you drag it in the same gesture.
- Dropping a domino back onto the table returns it to its original rack slot instead of leaving it wherever you released it.
- Matching a charge slot makes that slot glow, matching an equality pair highlights both linked cells and their connector, and solving the whole grid lights every domino pip so the unit is safe to accept.
- Runtime domino state now stores `rotationIndex` quarter-turns so horizontal and upside-down placements keep the pip order aligned with the visible clockwise rotation.
- The top-right screen is now the always-on factory comms panel.
- Robot or machine opening lines and questions type into that panel when the communication chance passes, and its `✓` / `X` buttons are used for the machine yes/no response prompt.
- There are now non-robot machine entries called `Breakroom Brewer`, `Mechanic Broom`, and `Future Lounge Chair`.
- Those non-robot machines currently use generated placeholder textures from `src/scenes/Boot.js` when there is no PNG in `assets/machines/sprites/`.
- The conveyor movement speed is controlled in `MACHINE_PRESENTATION.conveyorSpeedPxPerSecond` inside `src/constants/gameConstants.js`, so the machine slides in at a constant speed.
- The domino overlay sizing and timing are controlled in `MACHINE_PUZZLE` inside `src/constants/gameConstants.js`.
- The overlay now uses saved domino state, so placed dominoes can be picked back up and moved again.
- There are starter PNGs in `assets/machines/sprites/` now:
  - `assembler-alpha.png`
  - `audit-drone.png`
  - `courier-shell.png`
  - `sentry-frame.png`

Clock setup:

- `SHIFT_CLOCK.realMsPerAdvanceChunk` controls how much real time passes before the clock advances by `SHIFT_CLOCK.inGameMinutesPerAdvanceChunk`.
- Right now it is set to `20000`, which means 20 real seconds equals 2 in-game hours.
- For the original pace the game request described, change `realMsPerAdvanceChunk` to `60000`.
- The clock updates in 5-minute steps because `SHIFT_CLOCK.displayStepMinutes` is `5`.

Intro phone call setup:

- `FIRST_SHIFT_INTRO.silenceBeforePhoneMs` controls the silent wait before the phone ring.
- `FIRST_SHIFT_INTRO.caseArrivalDelayMs` controls how long the factory waits before sending the first machine after the shift starts.
- `FIRST_SHIFT_INTRO.fallbackVoiceMs` is only used if the voice sound is missing.
- `FIRST_SHIFT_INTRO.lineGapMs` controls the pause between spoken subtitle lines.
- The scripted opening call now lives in `FIRST_SHIFT_INTRO.script` inside `src/constants/gameConstants.js`.
- `FIRST_SHIFT_INTRO.script.intro` holds the shared opening lines.
- `FIRST_SHIFT_INTRO.script.yes` is the branch when the player answers `✓` to the line-2 question.
- `FIRST_SHIFT_INTRO.script.no` is the branch when the player answers `X` to the line-2 question.
- Each scripted line is now its own editable object with:
  - `id`
  - `text`
  - `voiceAsset`
- The current call subtitle IDs are `line1`, `line2`, `line3`, `line4`, `line5`, and `line6`.
- The phone call now waits for both the typed subtitle line and the matching voice clip to finish before the next subtitle line appears.
- Right now the new per-line voice files can all be replaced independently later, but they still load through `SOUND_ASSETS` like the rest of the optional audio.

Scene flow:

- Title goes straight to the factory scene.
- The manager briefing scene is no longer part of the active game flow.
- End of shift goes straight to the next game scene or the period transition scene.
- The main factory scene now uses conveyor-floor decision buttons for `SCRAP` and `ACCEPT`.
- The top-left HUD now has a mini machine circuit display that mirrors the live puzzle state, including placed cells, charge numbers, equality links, domino bridges, and pip badges on occupied target cells.
- Scrapping an `impossible: true` puzzle gives a pay bonus.
- Scrapping a fixable unit gives a pay deduction and a top-right notification.
- Accepting a unit before the puzzle is fully solved gives a pay deduction and a top-right notification.
- The older hammer/scanner/rulebook inspection screen is still in `src/scenes/Game.js`, but it is intentionally disabled for now.
- The settings panel only exists in the factory scene and pauses the shift timer while it is open.

Debug setup:

- `FACTORY_DEBUG.enabled` is the main positive debug switch in `src/constants/gameConstants.js`.
- When `FACTORY_DEBUG.enabled` and `FACTORY_DEBUG.showPuzzleGridValues` are both true, the domino overlay prints each live cell value directly on the grid.
- `FACTORY_DEBUG.workbenchEnabled` is the separate legacy workbench switch and is currently set to `false`.
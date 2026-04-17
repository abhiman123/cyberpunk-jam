# You're Just a Machine — Claude Code Build Spec

## Read Before Starting

This is a complete overhaul of a broken prototype. Do not patch existing files. Delete and rewrite everything listed below. The data files are mostly fine and should be preserved or updated as specified.

---

## Step 0: Cleanup

### Delete entirely — do not recreate
- `src/scenes/Workshop.js`
- `src/scenes/Station.js`
- `src/fx/CyberpunkPipeline.js`
- `src/systems/FloorSketchLayout.js`
- `src/fx/Voice.js`

### Rewrite from scratch
- `package.json`
- `main.js`
- `src/GameState.js`
- `src/scenes/Boot.js`
- `src/scenes/Briefing.js`
- `src/scenes/Game.js`
- `src/scenes/Summary.js`
- `src/scenes/Transition.js`
- `src/scenes/End.js`
- `src/systems/RulebookOverlay.js`

### Keep unchanged
- `src/fx/Animations.js`
- `src/fx/applyCyberpunkLook.js`
- `src/data/rules.json`
- `src/data/briefings.json`
- `src/data/notifications.json`
- `src/data/schedule.json`
- `index.html`
- `flake.nix`, `flake.lock`

### Update schema only
- `src/data/cases.json` — see Section 1

---

## Section 1: cases.json Schema Update

Replace the existing `inspectionZones` array on every case with a `zones` object. Every case has exactly **4 zones**: `A`, `B`, `C`, `D`. Each zone has exactly two fields: `hammer` and `scanner`. Both are plain strings.

Zone identities:
- A = Head / top region
- B = Torso / main body
- C = Left component
- D = Right component

Tool mapping rule:
- `hammer` → physical observations (damage, plating condition, structural status)
- `scanner` → data-layer observations (serial numbers, manufacture dates, service logs, modification flags, status codes)

Take all the data that currently lives in `inspectionZones[].label` and redistribute it into the correct zone and tool field. Every zone must have both a hammer and scanner result — invent plausible placeholder text for any gaps.

`isFinalCase: true` on C-11 only. All others are `false`. No other fields change.

---

## Section 2: package.json

One fix: change `"type": "commonjs"` to `"type": "module"`. This was causing silent failures with ES module imports. Nothing else changes.

---

## Section 3: main.js

Scene list: `Boot, Briefing, Game, Summary, Transition, End`. That is all. No Workshop, no Station. Boot starts Briefing directly.

---

## Section 4: GameState.js

Plain JS object export. Fields:

- `period` (1–3), `day` (1–2)
- `totalMistakes` — cumulative across all shifts
- `paycheckTotal` — running balance starting at 0
- `casesProcessedThisShift` — resets each shift
- `activeRules` — array of rule IDs in effect
- `rulebookSeenRules` — Set of rule IDs already shown in briefing

Methods:

- `isLastDay()` — true only when period === 3 and day === 2
- `advanceDay()` — increment day; when day exceeds 2, increment period and reset day to 1; update `activeRules` (period 2 adds rules 4–5, period 3 adds rules 6–7); reset `casesProcessedThisShift`
- `reset()` — everything back to starting values

---

## Section 5: Boot.js

1. Show a simple loading bar while assets load
2. Load all 5 JSON files from `src/data/`
3. Attempt to load audio files from `assets/audio/`. All optional — missing files must not crash the game. Keys to load:
   - `sfx_approve`, `sfx_scrap`, `sfx_repair` — ruling action sounds
   - `sfx_error` — incorrect ruling
   - `sfx_reveal` — zone inspection reveal
   - `music_manager` — manager's theme, plays during briefing and End scene manager dialogue
   - `music_clocking_in` — beginning of shift (first third of timer)
   - `music_workday` — mid shift (middle third of timer) — Julien's "Work day" composition
   - `music_cutting_it_close` — end of shift (final third of timer) — Julien's "Cutting it Close" composition
   - `music_payday` — Summary screen between shifts — Julien's "Corporate" composition, loops
   - `music_fired` — End scene title card only — should be silence or near-silence per sound doc
4. Generate all placeholder textures procedurally using Phaser graphics calls:
   - `bg_p1`, `bg_p2`, `bg_p3` — 1280×720, progressively colder colors (warm brown → cool gray → cold blue)
   - `unit_placeholder` — the unit sprite
   - `tool_hammer`, `tool_scanner` — small square icons
   - `manager_human`, `manager_robot` — for briefing/ending
   - `family_photo` — small desk prop
5. Start `Briefing` when done

When real art is ready, it gets added as `this.load.image()` calls in `preload()` and the corresponding placeholder generation is removed. No other code changes needed to swap art in.

---

## Section 6: Briefing.js

What it shows:
- Manager sprite left side (human or robot based on `managerType` in briefings.json)
- Briefing text, typewriter-revealed character by character
- Any rules whose `period` matches current period AND are not yet in `GameState.rulebookSeenRules` — shown below the briefing text, highlighted. Mark them as seen after displaying.
- Background and accent color vary by period (warm period 1 → cold period 3)

ACKNOWLEDGED button behavior:
- Greyed out and non-functional until typewriter finishes
- If clicked before typewriter finishes: skip to full text immediately and activate the button
- If clicked when active: fade to Game scene

**Music:** Play `music_manager` looping on scene create — this is the manager's theme, which also plays during the manager dialogue in the End scene. Stop it before transitioning to Game.

---

## Section 7: Game.js

### Architecture

The Game scene has two sub-states controlled by a `_screen` flag: `'conveyor'` and `'inspection'`. These are two containers toggled visible/invisible. A third HUD container is always visible. **Do not split these into separate scenes.** The shift timer runs as a single ms counter through both states.

### Shift Timer

- Durations: Period 1 = 180,000ms, Period 2 = 135,000ms, Period 3 = 90,000ms
- Tracked as elapsed ms incremented in `update(delta)`
- Displayed as a draining bar, top-right corner, always visible
- Color: green above 60%, amber above 25%, red at 25% and below
- When elapsed >= duration: call `_endShift()` immediately
- **No per-unit timer exists.** Player can spend the whole shift on one unit if they want.

### Music System

The shift has three music tracks that play sequentially based on how much time remains. Think of the shift as divided into thirds:

- **First third** (timer above 66%): play `music_clocking_in` — "Clocking In", the beginning-of-shift theme
- **Middle third** (timer between 33% and 66%): crossfade to `music_workday` — Julien's "Work Day" composition
- **Final third** (timer below 33%): crossfade to `music_cutting_it_close` — Julien's "Cutting it Close" composition

Implementation:
- Start `music_clocking_in` looping when the Game scene creates
- Each frame in `update()`, check which third the timer is in
- When the threshold is crossed, fade the current track out over ~2 seconds and fade the next track in over ~2 seconds simultaneously
- Each track should start at volume 0 and fade in — don't hard-cut between tracks
- Use a `_musicPhase` flag (`1`, `2`, or `3`) so the crossfade only triggers once per threshold, not every frame
- On `_endShift()`: fade out whichever track is currently playing before transitioning

The briefing scene plays `music_manager` (manager's theme). The End scene also uses `music_manager` during the robot manager's dialogue sequence. Both loop.

### HUD Layer (always visible)

- Top bar, full width
- Period and day label (left)
- Cases processed this shift (center)
- Paycheck balance (right)
- Shift timer bar (top-right)
- Violations count (right)

### Screen 1 — Conveyor View

**Belt:**
- Continuous scrolling animation using diagonal lines moving left, updated in `update()`
- One active unit on the belt showing name and ID
- Clicking the unit opens Screen 2
- After a ruling, old unit slides off left, new unit slides in from right
- Cases loop infinitely (reshuffle when list exhausted) until timer ends
- Exception: if the processed case has `isFinalCase: true` and `GameState.isLastDay()` is true, do not load another case — call `_endShift(true)`

**Left control panel (matches Image 1):**
- Green monitor screen with status text that updates based on game state
- Three physical dot buttons: red/SCRAP, yellow/REPAIR, green/APPROVE — decorative only on this screen, not interactive

**Other:**
- Pendant light with slow looping alpha flicker tween
- Decorative boxes along the bottom
- Background image keyed to current period

### Screen 2 — Inspection View

**Left half — Unit display:**
- Unit name and description at top
- Unit sprite (placeholder rect) centered
- 4 zone buttons overlaid on the sprite (A, B, C, D), each a clickable sub-region
- Zones start default appearance; get a highlight after being inspected with any tool
- Inspection log panel below — appends one line per new zone+tool combination revealed, max 6 lines visible, does not duplicate entries

**Bottom-right — Tool Bar (gold panel, matches Image 2):**
- HAMMER button and SCANNER button with icons
- Clicking selects the tool — selected tool gets a visual highlight border
- Clicking a zone with a selected tool: appends result to log, highlights zone
- Clicking a zone with no tool selected: show an error hint message, no crash
- Clicking same zone + same tool again: no duplicate log entry, no error

**Top-right — Ruling Panel (gray panel, matches Image 2):**
- SCRAP (red dot), REPAIR (yellow dot), APPROVE (cyan dot) — vertical layout
- Clicking any button calls `_submitRuling(action)` immediately, no confirmation

**Other:**
- Small rulebook button `[B] RULEBOOK` triggering RulebookOverlay
- Feedback text at bottom of screen: fades in on ruling, fades out after ~1.5s

### Ruling Logic

Paycheck delta: +$0.00000003 correct, -$0.00000003 incorrect.

Correct ruling:
- Increment `GameState.paycheckTotal` and `GameState.casesProcessedThisShift`
- Green camera flash, play approve/repair/scrap sound if loaded
- Show feedback text in green
- After 1.4s: close inspection, slide unit off, load next case

Incorrect ruling:
- Decrement `GameState.paycheckTotal`, increment `GameState.totalMistakes`
- Red camera flash, camera shake, play error sound if loaded
- Call `glitchBurst()` from `applyCyberpunkLook.js`
- Show feedback text in red with the case's `incorrectFeedback` string
- After 1.4s: close inspection, slide unit off, load next case

### End of Shift

Pass to Summary: shift mistake count, shift paycheck delta, cases processed, notification text from `notifications.json` for current period/day.

If `fromFinalCase` is true AND `GameState.isLastDay()`: go to End instead of Summary.

---

## Section 8: Summary.js

Display:
- Period and day header
- QC assessment: violation count or "NO VIOLATIONS"
- Cases processed this shift
- Paycheck delta and running total
- World event notification from `notifications.json` — apply a slow random flicker tween to this text

NEXT SHIFT button:
- Call `GameState.advanceDay()`
- If period changed: start `Transition` with the new period number passed as data
- If same period: start `Briefing`

**Music:** Play `music_payday` looping on scene create — Julien's "Corporate" composition. This loops and plays between every shift. Stop before transitioning.

---

## Section 9: Transition.js

Full-screen title card. Shows period name ("PERIOD ONE / TWO / THREE") and a one-line subtitle. Fade in, hold, auto-advance to `Briefing` after ~2.5s. Background color matches period scheme.

---

## Section 10: End.js

Sequence in order:

1. Period 3 background. Family photo on desk. Background light rects visible.
2. 2-second pause. No music playing at all — silence from the moment this scene starts.
3. Robot manager sprite slides in from off-screen left via tween. Start `music_manager` looping here — the manager's theme plays during his dialogue.
4. Three lines of dialogue, typewriter-revealed one at a time. Each line waits for the previous to finish, then pauses 900ms before the next begins.
5. After all three lines: 1-second pause.
6. Camera shake.
7. Camera tilt — **use a tween on `this.cameras.main.rotation` to ~0.26 radians over 1200ms**. Do NOT call `rotateTo()` — it does not exist in Phaser 4.
8. Background lights flicker off left-to-right, 150ms apart each.
9. Family photo fades out.
10. Camera fades to black.
11. 1.5-second silence.
12. Camera rotation reset to 0. Camera fades back in.
13. Title card fades in: `you're just a machine.` (lowercase)
14. 4.5 seconds later: PLAY AGAIN button fades in and becomes interactive.
15. PLAY AGAIN: call `GameState.reset()`, start `Briefing`.

**Music:** `music_manager` plays during steps 3–5 (manager dialogue). Stop it at step 6 (the shake) — from that point until the title card, everything is silent. After step 11 (blackout complete, camera fading back in), start `music_fired`. Per the sound doc this is intentional silence or near-silence — "like you just fall in a void." If the file doesn't exist, leave it silent. Do not fall back to any other track.

---

## Section 11: RulebookOverlay.js

Full-screen overlay, depth above everything else in the scene.

Contents:
- Dark teal semi-transparent background
- Scanline graphic
- Header: "DIRECTIVE MANUAL — ACTIVE RULES"
- All active rules listed, one per line with rule ID prefix
- Rules new to this period (passed in at construction) highlighted in yellow with `[NEW]` tag
- Footer: "[B] or [ESC] to close"

Behavior:
- `toggle()`, `show()`, `hide()` methods
- `isVisible()` method — Game.js uses this to block ruling submission while open
- B key and ESC key both close it
- Short fade in/out (~120ms)
- Constructed once per Game scene, destroyed on scene shutdown

---

## Section 12: Critical Constraints

**Phaser 4 camera rotation:**
In End.js, the tilt effect must be a tween targeting `this.cameras.main.rotation` as a numeric property. `rotateTo()` does not exist in Phaser 4. This will throw if used.

**No PostFXPipeline:**
`CyberpunkPipeline.js` is deleted and must not be recreated. The only visual effects file is `applyCyberpunkLook.js`, which uses Phaser 4's `cam.filters.external` API. Import it in Game.js and call it once on scene create.

**No per-unit timer:**
Do not add any countdown to individual units. Only the shift timer exists.

**Audio is fully optional:**
Every `this.sound.play()` call must be guarded with a check that the audio key exists in the cache. The game must run identically with or without audio files present.

**Single Game scene for both screens:**
Screen 1 and Screen 2 are container visibility toggles inside one scene. The shift timer is one counter. Do not route between them via `this.scene.start()`.

---

## Section 13: Verification Checklist

Run through this manually. Every item must pass before considering the build done.

- [ ] `npm run dev` launches with no console errors
- [ ] All JSON files load without 404s (check browser network tab)
- [ ] Boot transitions directly to Briefing — no other scenes
- [ ] Briefing typewriter can be skipped by clicking ACKNOWLEDGED early
- [ ] ACKNOWLEDGED is greyed out until text is done or skipped
- [ ] Briefing transitions to Game on click
- [ ] Shift timer bar visible and draining in top-right on both screens
- [ ] Clicking the belt unit opens the inspection view
- [ ] Selecting a tool gives it a visible highlight
- [ ] Clicking a zone with no tool selected shows an error message, does not crash
- [ ] Clicking zone with hammer logs that zone's hammer text
- [ ] Clicking zone with scanner logs that zone's scanner text
- [ ] Clicking same zone + same tool twice does not duplicate the log entry
- [ ] Zone gets visual highlight after first use
- [ ] Correct ruling: green flash, paycheck increments, unit exits, next unit arrives
- [ ] Incorrect ruling: red flash, shake, error message cites specific rule, paycheck deducts
- [ ] Rulebook opens with B key, closes with B or ESC
- [ ] Shift timer reaching zero ends the shift regardless of which screen is active
- [ ] Summary shows correct mistake count, paycheck delta, cases processed, notification
- [ ] NEXT SHIFT → Briefing (same period) or Transition (new period)
- [ ] Transition auto-advances to Briefing
- [ ] Period 2 briefing highlights rules 4 and 5 as new
- [ ] Period 3 briefing highlights rules 6 and 7 as new
- [ ] Period 3 Day 2 final case goes to End, not Summary
- [ ] End: manager slides in, dialogue types line by line
- [ ] End: shake → tilt → lights out → fade to black → title card → play again
- [ ] Play Again resets all state, returns to Briefing at Period 1 Day 1
- [ ] `music_manager` plays during Briefing and stops before Game starts
- [ ] `music_clocking_in` plays at shift start (timer above 66%)
- [ ] `music_workday` crossfades in when timer hits 66%
- [ ] `music_cutting_it_close` crossfades in when timer hits 33%
- [ ] Music crossfades do not retrigger every frame — `_musicPhase` flag prevents this
- [ ] All music stops before transitioning out of Game scene
- [ ] `music_payday` plays on Summary screen
- [ ] `music_manager` plays during End scene manager dialogue, stops at the shake
- [ ] Silence from the shake through the blackout
- [ ] `music_fired` plays after blackout on title card (or silence if file missing)

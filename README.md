# PRD: "You're Just a Machine"
### gamedev.js Game Jam — Target Platform: Browser (Phaser 3 / Vanilla JS+HTML)

---

## 1. Overview

**Title:** You're Just a Machine  
**Genre:** Narrative puzzle / Papers Please-style inspection game  
**Engine:** Phaser 3 (or Vanilla JS/HTML Canvas as fallback)  
**Target Build Time:** 10–12 days  
**Team Roles:** Programming, Art, Sound, Storyboard  
**Jam Theme Tie-In:** Phaser-sponsored — browser-based, no install  

**Elevator Pitch:**  
You are Employee #492240182 — a human worker in a dystopian future machine clinic. Every shift, robots and cybernetic parts arrive on a conveyor belt. You approve them, order repairs, or scrap them — following an ever-growing rulebook projected into your brain implant. As the days pass, the world changes around you. Coworkers disappear. Your manager — once human — walks back in one day as a robot. And when the last shift ends, he tells you you're not needed anymore. Then the lights go out. The title card reads: "You're Just a Machine."

---

## 2. Core Design Pillars

1. **Simple mechanic, escalating complexity** — The approve/repair/scrap loop is learnable in 30 seconds. Complexity comes from rule stacking, not UI complexity.
2. **Atmosphere over content volume** — 3 hand-crafted cases per day is better than 10 sloppy ones. Every asset should reinforce dread.
3. **Narrative is environmental** — Story is told through background changes, notifications, coworker count, and manager voice. No cutscenes, no dialogue trees.
4. **Ship complete** — A finished vertical slice beats an ambitious skeleton. Scope is locked at Period 3 minimum.

---

## 3. Game Structure

### 3.1 Periods (Days)

The game is divided into 3 periods (expandable to 4 if time allows). Each period = one "work week."

| Period | Narrative Beat | Rulebook Additions | QC System | Manager |
|---|---|---|---|---|
| 1 | World-building. New job. Human coworkers visible. | 3 base rules | Human supervisor (text popup, friendly) | Human — warm, slightly menacing. Briefings introduce new rules in plain language. |
| 2 | QC replaced by robot. Fewer coworkers. World event notifications begin. | +2 rules (5 total) | Robot — cold error codes | Same human manager, visibly nervous. Briefings shorter, more clipped. |
| 3 | Manager walks in visibly roboticized. Near-empty factory. Ending triggered after final case. | +2 rules (7 total) | Robot — full error code language | Robot-manager. Delivers rules as directives. Final briefing triggers ending sequence. |

**Note:** The original Period 4 (player builds their own replacement) is cut from MVP scope. The canon ending is the robot-manager confrontation sequence described in Section 4.6.

### 3.2 Daily Loop

```
[SHIFT START]
    → Manager briefing popup (flavor text, new rule announced)
    → Rulebook updated (hologram UI overlay)
    → Cases begin arriving on conveyor
        → Per case:
            - Inspect the item (click to examine parts/read logs)
            - Consult rulebook (toggleable overlay)
            - Choose: APPROVE / ORDER REPAIR / SCRAP
            - Timer counts down (per-case, not global)
            - Correct → paycheck + visual tick
            - Incorrect → QC deduction popup, paycheck drops
    → 3–5 cases per day
    → End of day: paycheck summary screen
    → World event notification (email/news blip)
    → Transition to next day (brief scene change animation)
[REPEAT]
```

---

## 4. Game Mechanics

### 4.1 The Inspection Interface

**Layout:** Split screen.
- **Left panel:** The case — a robot or cybernetic part displayed on a workbench. Clickable regions reveal logs/serial numbers/damage reports.
- **Right panel:** Three action buttons — APPROVE (green), ORDER REPAIR (yellow), SCRAP (red).
- **Top bar:** Timer (countdown bar, not digital clock — more tense), day counter, paycheck balance.
- **Rulebook button (bottom left):** Opens the hologram overlay. You CANNOT see the rulebook and the case simultaneously at full resolution — slight blur on case when rulebook is open. Intentional design to create memory pressure.

### 4.2 The Rulebook

- Displayed as a translucent HUD overlay (hologram aesthetic — teal/cyan tint, slightly scanline-y).
- Rules are listed as plain numbered text.
- New rules added each period appear highlighted briefly, then normalize.
- Player must internalize rules — rulebook open time is time not spent inspecting.

**Example rulebook progression:**

**Period 1 (3 rules):**
1. Robots with a cracked chassis must be sent for repair.
2. Robots with serial numbers beginning with `ERR` must be scrapped.
3. Approve all units with a green status light.

**Period 2 adds:**
4. Cybernetic parts manufactured before 2087 must be scrapped regardless of condition.
5. Units flagged `MODIFIED` in their log must be approved only with a supervisor override code — if no code is present, scrap.

**Period 3 adds:**
6. Any unit processed by a human technician in its service history must be quarantined (= scrap).
7. Human-origin biological components count as cybernetic parts for all rule purposes.

### 4.3 Cases (General Design)

Cases are brainstormed and added incrementally as the team builds. The programmer should implement the case system to be fully data-driven from `cases.json` — adding new cases requires no code changes, only a new JSON entry.

**What every case must have:**
- A visual (sprite or placeholder rect with a label)
- 2–4 clickable inspection zones that reveal text clues (serial number, status light, manufacture date, service log, damage report, etc.)
- A single correct action (Approve / Repair / Scrap) determined by the active rulebook
- An incorrect feedback message that cites the specific rule violated

**Design principle for cases:**
Each case should hinge on exactly one rule judgment per period. In later periods, multiple rules may be relevant to a single case — the puzzle is applying them in the right priority order. Cases should never require information the player can't find by clicking all inspection zones.

**Moral ambiguity layer (optional per case):**
Some cases may surface information that makes the correct answer feel wrong — a robot with a flagged serial that has a child's drawing taped to it, a service log that mentions a name that matches the missing coworker from the background. These details have no mechanical effect. They are atmosphere only. The rules are the rules.

**Minimum case count for ship:**
- Period 1: 3 cases (rules 1–3 only, straightforward)
- Period 2: 4 cases (rules 1–5, at least one case that requires cross-referencing two rules)
- Period 3: 4 cases (rules 1–7, at least one genuinely ambiguous case)

Cases will be designed and added collaboratively during build week. The programmer needs the JSON schema, not a finalized case list, to start building.

### 4.4 Timer System

- Per-case timer. Duration decreases each period.
  - Period 1: 60 seconds per case
  - Period 2: 45 seconds per case
  - Period 3: 30 seconds per case
- Timer shown as a draining bar at the top (NOT a digital number — more visceral).
- Running out of time = automatic "incorrect" ruling. QC deduction applies.
- Music tempo and intensity tied to timer percentage (see Sound section).

### 4.5 Paycheck / Mistake System

- Player starts each day with a base "paycheck" balance displayed as a running total.
- Each mistake deducts a fixed amount.
- Balance shown as: `$0.0000 [n] credits` (intentionally satirical — the amount is meaningless).
- At end of day: paycheck summary screen. No game over for low paycheck — you can't be fired, only scrapped at the end. This is intentional: the stakes are psychological, not mechanical.

### 4.6 The Ending Sequence (End of Period 3)

After the final case of Period 3 is resolved, the shift-end flow is interrupted. Instead of the normal summary screen, the ending sequence triggers automatically.

**Beat-by-beat:**

1. **The briefing room loads one more time.** The manager sprite slot is empty for a moment — longer than usual. A subtle ambient sound plays (mechanical whirring, footsteps).

2. **The robot-manager enters.** The sprite that was the human manager walks back in — but now visibly roboticized. Same silhouette, same clothing, but with visible mechanical plating over the face and hands. No dramatic reveal, no jump scare. He just walks in. This is the first time the player sees him this way, even though he was already a robot in Period 3's gameplay — the ending treats it as the first moment it's undeniable.

3. **He speaks.** Text appears line by line (not all at once — slow typewriter reveal, ~1 character per 40ms):
   > "You've been a reliable unit, #492240182."
   > "But reliability has a shelf life."
   > "You are no longer needed."

4. **The knock animation.** A simple but hard-hitting animation: the screen shakes once, hard. Then tilts slowly — the camera angle rotates ~15 degrees as if the player is falling sideways. The background tilts with it. The factory lights flicker and cut out one by one, left to right.

5. **Black screen.** Complete silence for 1.5 seconds.

6. **Title card.** White monospace text fades in on black, centered:

   > *you're just a machine.*

   Lowercase. No period drama. It just sits there.

7. **Stay on the title card for 4–5 seconds.** Then a small "PLAY AGAIN" button fades in at the bottom. No other UI.

**Implementation notes:**
- The screen shake is a Phaser camera shake: `this.cameras.main.shake(400, 0.04)`.
- The tilt is a camera rotation tween: `this.cameras.main.rotateTo(0.26, false, 1200)` (0.26 rad ≈ 15°).
- The flicker is a series of timed opacity tweens on background light sprites, left to right, 150ms apart.
- The typewriter effect is a character-by-character text reveal using a Phaser time event or simple `setInterval`.
- The title card text is plain HTML overlaid on the canvas, or a Phaser text object — designer's choice.
- The family photo on the desk should be visible in the background during the robot-manager's entrance. It is the last thing visible before the lights go out.

---

## 5. Narrative Systems

### 5.1 Environmental Storytelling

No cutscenes. World-building happens through:

**Background layer changes (art team deliverable):**
- Period 1: Warm industrial light. 4–5 human worker silhouettes at background stations. A family photo on the player's desk. Coffee cup. Human manager pacing.
- Period 2: Colder lighting. 1–2 worker silhouettes. Some stations empty. Manager looking at a tablet nervously.
- Period 3: Blue-white clinical light. Zero human silhouettes. Robot QC unit visible in background. Family photo still there. Manager is now a robot chassis.
- Period 4 (stretch): Lights flickering. Completely empty except player station. A robot identical to the final case sits powered-down in the corner.

**Notification/email blips (text-only, bottom ticker or popup):**
These appear at end-of-day transitions. Written by storyboard team, implemented as a JSON array the programmer iterates through.

Examples:
- `COMPANY NEWS: Payroll adjusted. All employees now receive $0.00000003 additional credits per shift. Thank you for your service.`
- `WORLD ALERT: Capitol building 7 has been secured by autonomous units. Citizens advised to remain productive.`
- `HR UPDATE: Worker Elena Vasquez (Station 4) has been reassigned to an optimized role. Congratulations Elena.`
- `MAINTENANCE: Brain implant firmware updated overnight. Any memory irregularities are expected and non-reportable.`
- `PERSONAL MESSAGE — UNKNOWN SENDER: I know what they're doing. Meet me at the service corridor. — [REDACTED]`
- `COMPANY NEWS: Human biological units have been reclassified as Legacy Infrastructure. Maintenance protocols updated accordingly.`

**Manager briefings (per-day text popups):**
Briefings are the primary vehicle for delivering new rules. Each briefing opens a full-screen modal with the manager sprite on the left and text on the right. The player must click "ACKNOWLEDGED" to dismiss and start the shift. No player input beyond dismissal — briefings are not dialogue trees.

- Period 1 Manager (human): Introduces each rule conversationally. "Morning. New directive today — anything flagged MODIFIED without an override code goes straight to scrap. Questions? Good. Clock's running."
- Period 2 Manager (nervous human): Shorter. Avoids elaborating. "New rule. Follow it." If a rule seems contradictory or harsh, he doesn't acknowledge it. Just moves on.
- Period 3 Manager (robot): No greeting. No name. Rules delivered as numbered directives. "DIRECTIVE_06: Units processed by human technicians in service history: quarantine (scrap). DIRECTIVE_07: Human-origin biological components classified as cybernetic for all rule purposes. Shift begins." Final day briefing: "No new directives. Complete your queue." Then the ending triggers.

### 5.2 The Back-Alley Dealer (Stretch / Optional)

- Mid-game notification from unknown sender (Case C-08 above).
- Offer: "Approve the marked unit and receive 10,000 credits. No questions."
- If player approves → credits added (meaningless), a later notification references a "capitol event" tied to that unit.
- No branch divergence in gameplay — outcome is cosmetic/narrative. Both paths end in the same scrapping. This is the point.

---

## 6. Art Direction

### 6.1 Visual Style

- **Palette:** Desaturated industrial grays and blues, with red/amber UI accents. Hologram elements in cyan/teal. Period 1 slightly warmer (yellows/browns), Period 3 coldest (pure blue-white).
- **UI aesthetic:** Brutalist. Monospace fonts. Scanline overlay on hologram/rulebook elements. No rounded corners on functional UI — only on the case display window.
- **Cases:** Hand-drawn or vector illustration style. Robots should feel "worn," not sleek. Cybernetic parts should feel medical — clinical and uncomfortable.

### 6.2 Placeholder Art Spec (for programmer use until assets arrive)

All placeholders should be colored rectangles with labels until real assets are swapped in.

| Asset | Placeholder | Notes |
|---|---|---|
| Robot/part case display | Gray rect, 400x300px, label in center | Click zones marked as smaller colored rects |
| Background (per period) | Gradient rect with period number overlaid | Swap per period |
| Manager sprite | Stick figure or solid colored shape | Left side of briefing popup |
| Family photo | Small rect labeled "PHOTO" on desk area | Used in final scene |
| Hologram overlay | Semi-transparent cyan rect over full screen | Text rendered on top |
| Conveyor belt | Horizontal scrolling gray rect | Simple CSS/canvas animation |
| QC feedback (human) | Small popup rect, warm color, text | |
| QC feedback (robot) | Small popup rect, cold color, `ERROR_CODE: [n]` | |

### 6.3 Art Team Deliverable Priority

1. **Case sprites** (C-01 through C-05 minimum) — highest priority, blocks gameplay feel
2. **Background layers** (3 periods) — second priority
3. **UI icons** (Approve/Repair/Scrap buttons) — can use text buttons until then
4. **Manager sprites** (2: human, robot) — third priority
5. **Family photo + robotic variant** — final scene only, lower priority

---

## 7. Sound Design

### 7.1 Music System

Music is procedural/layered. The same base track plays throughout but:
- Period 1: Sparse, low hum. Industrial ambient. Slow tempo.
- Period 2: Additional mid-layer percussion enters. Slight dissonance.
- Period 3: Full arrangement. Tension instruments dominant. Dissonance heavy.
- Timer pressure: As timer bar drops below 30%, a high-frequency string/synth layer fades in and volume increases. Designed to make players crack.

**Implementation note for programmer:** Music layers can be implemented as separate Phaser audio tracks crossfaded by game state. If full layering is too complex, a simpler approach: 3 separate tracks (one per period), fade transition on period change. Timer stress layer: a single looped audio clip that gains volume as timer depletes.

### 7.2 Sound Effects (Priority Order)

1. Conveyor belt mechanical loop (ambient)
2. Approve sound (stamp / click — satisfying)
3. Scrap sound (hydraulic crush / discard)
4. Repair sound (tool noise / order beep)
5. QC deduction sound (human period: disappointed tone / robot period: error buzz)
6. Day transition (industrial clunk + brief silence)
7. Timer warning (heartbeat or pulse, escalating)
8. Final scene (trap door mechanism — one shot — then silence)

---

## 8. Technical Architecture

### 8.1 Tech Stack

**Primary:** Phaser 3 (JavaScript)  
**Fallback:** Vanilla JS + HTML Canvas (if Phaser setup fails on school devices)  
**Asset format:** PNG sprites, MP3/OGG audio, JSON for case/rule data

### 8.2 Scene Structure (Phaser Scenes)

```
BootScene          → preloads all assets, shows loading bar
MenuScene          → title screen, START button, brief lore blurb
BriefingScene      → manager popup for each day's new rules
GameScene          → core loop (main scene, most dev time here)
  ├── ConveyorLayer    (background animation)
  ├── CaseDisplay      (inspection window)
  ├── RulebookOverlay  (toggleable hologram)
  ├── ActionPanel      (Approve / Repair / Scrap)
  ├── TimerBar         (top bar)
  └── HUDLayer         (paycheck, day counter, notification ticker)
SummaryScene       → end-of-day paycheck + world event notification
TransitionScene    → brief atmospheric cut between days
EndScene           → final scrapping sequence
```

### 8.3 Data Structure (JSON)

**Cases (cases.json):**
```json
{
  "id": "C-03",
  "period": 1,
  "name": "Unit RB-447",
  "description": "Industrial robot. Cracked chassis plating. Status light: green.",
  "inspectionZones": [
    { "id": "serial", "label": "Serial: RB-447-2091", "x": 50, "y": 30, "w": 120, "h": 30 },
    { "id": "statusLight", "label": "Status: GREEN", "x": 200, "y": 80, "w": 40, "h": 40 },
    { "id": "chassis", "label": "Damage: Cracked chassis plating (non-structural)", "x": 100, "y": 150, "w": 200, "h": 60 }
  ],
  "correctAction": "repair",
  "incorrectFeedback": "DIRECTIVE VIOLATION: Rule 1. Cracked chassis requires repair order.",
  "sprite": "unit_rb447"
}
```

**Rules (rules.json):**
```json
[
  { "id": 1, "period": 1, "text": "Robots with a cracked chassis must be sent for repair." },
  { "id": 2, "period": 1, "text": "Robots with serial numbers beginning with ERR must be scrapped." },
  { "id": 3, "period": 1, "text": "Approve all units with a green status light." },
  { "id": 4, "period": 2, "text": "Cybernetic parts manufactured before 2087 must be scrapped regardless of condition." },
  { "id": 5, "period": 2, "text": "Units flagged MODIFIED in their log must be approved only with a supervisor override code. If no code is present, scrap." },
  { "id": 6, "period": 3, "text": "Any unit processed by a human technician in its service history must be quarantined (scrap)." },
  { "id": 7, "period": 3, "text": "Human-origin biological components count as cybernetic parts for all rule purposes." }
]
```

**Notifications (notifications.json):**
```json
[
  { "period": 1, "day": 1, "text": "COMPANY NEWS: Welcome to your shift. Your implant has been calibrated. Have a productive day." },
  { "period": 1, "day": 2, "text": "COMPANY NEWS: Payroll adjusted. All employees now receive $0.00000003 additional credits per shift." },
  { "period": 2, "day": 1, "text": "HR UPDATE: Worker Elena Vasquez (Station 4) has been reassigned to an optimized role. Congratulations Elena." },
  { "period": 2, "day": 2, "text": "WORLD ALERT: Capitol building 7 has been secured by autonomous units. Citizens advised to remain productive." },
  { "period": 3, "day": 1, "text": "MAINTENANCE: Human oversight protocols have been deprecated in this facility effective today." },
  { "period": 3, "day": 2, "text": "COMPANY NEWS: Human biological units have been reclassified as Legacy Infrastructure. Maintenance protocols updated accordingly." }
]
```

### 8.4 State Management

Global game state object (passed between scenes via Phaser registry or scene data):

```js
GameState = {
  period: 1,
  day: 1,
  paycheck: 0.00000000,
  mistakes: 0,
  casesCompleted: [],
  activeRules: [1, 2, 3],
  dealerContacted: false,
  finalCaseBuilt: false
}
```

---

## 9. Scope Tiers

### Tier 1 — Must Ship (MVP)
- [ ] 3 periods, 3–4 cases each
- [ ] Rulebook overlay (toggle, correct rules per period)
- [ ] Approve / Repair / Scrap with correct answer validation
- [ ] Timer bar per case
- [ ] QC feedback (mistake deduction popup)
- [ ] Day transition with notification
- [ ] Manager briefing (text popup)
- [ ] Background changes per period
- [ ] End screen with scrapping sequence
- [ ] Basic audio (ambient loop + 3 action SFX)

### Tier 2 — Ship If Time Allows
- [ ] Family photo → robot variant reveal in ending sequence (vs. just leaving it on the desk)
- [ ] Back-alley dealer notification + Case C-08
- [ ] Music layering tied to timer
- [ ] Conveyor belt animation between cases
- [ ] Morally ambiguous flavor details on cases (child's drawing, missing coworker name in service log)

### Tier 3 — Cut If Needed
- [ ] Manager sprite art (use text-only briefing as fallback)
- [ ] Animated transitions between periods
- [ ] Robot QC vs human QC visual distinction (can be color-coded text instead)
- [ ] Paycheck balance display (just show mistake count instead)

---

## 10. Build Timeline (10-Day Suggested)

| Day | Programming | Art | Sound |
|---|---|---|---|
| 1 | Phaser boilerplate, scene skeleton, JSON loading | Style guide, palette lock, period 1 BG sketch | Ambient loop draft |
| 2 | GameScene core: case display, 3 action buttons, click zones | Case sprites C-01, C-02, C-03 | Approve/Scrap/Repair SFX |
| 3 | Rulebook overlay toggle, rule rendering from JSON | Case sprites C-04, C-05 | QC feedback SFX, period 1 music |
| 4 | Timer bar, mistake tracking, QC feedback popup | Period 2 background, human manager sprite | Period 2 music layer |
| 5 | Day transition, BriefingScene, notification system | Case sprites C-06, C-07 | Timer stress layer |
| 6 | Period 2 integration (new rules, robot QC text) | Period 3 background, robot manager sprite | Period 3 music |
| 7 | Ending sequence: robot-manager briefing, screen shake, tilt, blackout, title card | Family photo asset, robot-manager sprite, ending background state | Ending audio — mechanical whirring, flicker SFX, silence |
| 8 | Polish pass: timing, transitions, audio crossfades | Final case sprite (C-FINAL), UI icon polish | Mix/balance all audio |
| 9 | Bug fix, playtesting, difficulty tuning | Asset swap-in, any missing sprites | Final audio pass |
| 10 | Build, browser test, itch.io/jam submission | — | — |

---

## 11. Out of Scope (Explicitly Cut)

- Period 4 / lose-lose "build your replacement" mechanic (replaced by robot-manager ending)
- Save/load system
- Mobile/touch support
- Multiple language support
- Branching story paths with divergent endings
- Procedurally generated cases
- Dialogue trees or voiced lines
- Scoring/leaderboard system

---

## 12. Open Questions (Resolve Before Day 3)

1. How many days per period? (Recommendation: 2 days per period = 6 total shifts, keeps content scope manageable)
2. What is the exact typewriter text for each manager briefing? (One briefing per day, storyboard team to write)
3. What are all 6 world event notification texts? (One per end-of-day transition, storyboard team to write)
4. What does the robot-manager's silhouette look like — same clothes, robotic face only? Or full chassis replacement? (Art team to decide, affects sprite count)
5. Does the family photo appear in the ending sequence or just stay ambient on the desk throughout?
6. Back-alley dealer: punted to stretch scope. When the team is ready, define the notification text and what Case C-08 looks like.
7. What inspection zones are standard across all cases vs. case-specific? (Programmer needs this to finalize the click zone system)

---

*PRD version 1.0 — for Claude Code and team use. Scope locked at Tier 1. All Tier 2/3 features require explicit team approval before implementation begins.*

# Graph Report - /Users/safiullahbaig/Projects/cyberpunk-jam  (2026-04-25)

## Corpus Check
- 28 files · ~214,715 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1040 nodes · 2651 edges · 30 communities detected
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 281 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]

## God Nodes (most connected - your core abstractions)
1. `GameScene` - 259 edges
2. `MachinePuzzleOverlay` - 64 edges
3. `DebugConsolePuzzle` - 50 edges
4. `GearGridPuzzle` - 38 edges
5. `CircuitRouting` - 37 edges
6. `MachinePuzzleState` - 35 edges
7. `BootScene` - 31 edges
8. `EndScene` - 25 edges
9. `PRD: You're Just a Machine (Product Requirements Document)` - 23 edges
10. `RulebookOverlay` - 22 edges

## Surprising Connections (you probably didn't know these)
- `cloneGearPieces()` --calls--> `sanitizeGearOptionForStageOne()`  [INFERRED]
  src/core/gearPuzzleLogic.js → /Users/safiullahbaig/Projects/cyberpunk-jam/src/data/machineCatalog.js
- `cloneGearPieces()` --calls--> `createVirusGearFault()`  [INFERRED]
  src/core/gearPuzzleLogic.js → /Users/safiullahbaig/Projects/cyberpunk-jam/src/data/machineCatalog.js
- `cloneGearPieces()` --calls--> `createSparkInstabilityFault()`  [INFERRED]
  src/core/gearPuzzleLogic.js → /Users/safiullahbaig/Projects/cyberpunk-jam/src/data/machineCatalog.js
- `cloneGearPieces()` --calls--> `applyGearStageToOption()`  [INFERRED]
  src/core/gearPuzzleLogic.js → /Users/safiullahbaig/Projects/cyberpunk-jam/src/data/machineCatalog.js
- `cloneGearPieces()` --calls--> `cloneGearPuzzleOption()`  [INFERRED]
  src/core/gearPuzzleLogic.js → /Users/safiullahbaig/Projects/cyberpunk-jam/src/data/machineCatalog.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.03
Nodes (4): glitchBurst(), GameScene, getShiftClockStepMs(), resolveMachineTexture()

### Community 1 - "Community 1"
Cohesion: 0.03
Nodes (127): cloneGearBoard(), addCompactFlowBypass(), addFlowBypassForCandidate(), addFlowConnection(), applyBrokenGlyphFault(), applyCorruptedDominoFault(), applyDebugStageToOption(), applyFlowStageToOption() (+119 more)

### Community 2 - "Community 2"
Cohesion: 0.03
Nodes (20): Animations, applyCyberpunkLook(), stampCyberColorMatrix(), BriefingScene, CreditsScene, EndScene, FactorySettingsOverlay, clampMusicVolume() (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (3): getOrientationForRotationIndex(), MachinePuzzleOverlay, normalizeRotationIndex()

### Community 4 - "Community 4"
Cohesion: 0.07
Nodes (8): clampIndex(), DebugConsolePuzzle, displayChar(), getBugSpawnDelayMs(), getBugTravelRange(), getCorruptCharacter(), pickRandomEntry(), TimerBar

### Community 5 - "Community 5"
Cohesion: 0.04
Nodes (65): Boot.js: Load assets, generate procedural placeholders, start Briefing scene, Briefing.js: Manager sprite, typewriter text, new rules highlighted, ACKNOWLEDGED button, music_manager, Claude Code Build Spec — Complete Overhaul Instructions, cases.json Schema Update: 4 zones (A/B/C/D), each with hammer and scanner fields, Step 0 Cleanup: Delete Workshop.js, Station.js, CyberpunkPipeline.js, FloorSketchLayout.js, Voice.js, Critical Constraints: No PostFXPipeline, no per-unit timer, audio optional, single Game scene for both screens, End.js: Robot-manager entrance, typewriter dialogue, camera shake+tilt, lights flicker, title card, play again, Game.js: Conveyor and Inspection sub-states, shift timer, music system, HUD, ruling logic (+57 more)

### Community 6 - "Community 6"
Cohesion: 0.07
Nodes (16): GearGridPuzzle, getCellCenter(), inBounds(), isOpenBoardCell(), buildClampedGearCellSet(), buildGearOccupancy(), buildGearPairKey(), buildGearProgressSnapshot() (+8 more)

### Community 7 - "Community 7"
Cohesion: 0.08
Nodes (7): CircuitRouting, cloneCircuitTiles(), generateCircuit(), getFlowCellKey(), getFlowPowerPalette(), getFlowSegmentKey(), recordFlowSegment()

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (1): getOpeningPhoneCallSequence()

### Community 9 - "Community 9"
Cohesion: 0.14
Nodes (10): canPlaceCandidate(), cellKey(), createPlacementCandidate(), decodePipCount(), getOrientationForRotationIndex(), isPlacedCode(), MachinePuzzleState, normalizeRotationIndex() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.16
Nodes (1): BootScene

### Community 11 - "Community 11"
Cohesion: 0.17
Nodes (2): resolveDayContent(), RulebookOverlay

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (13): APPROVE Decision Option, Conveyor Belt, Conveyor Belt Boxes, Core Gameplay Loop — Item Evaluation, Decision Legend / Color-Code Panel, Factory Background / Environment, Hanging Industrial Lamp, Machine Terminal (+5 more)

### Community 13 - "Community 13"
Cohesion: 0.22
Nodes (13): Cyan Display Bars (Visual Element), Assembler Alpha (Game Entity), Robot / Industrial Machine Visual Design, Assembler Alpha Machine Sprite, Courier Shell Robot Head (rectangular with oval face, eye slots), Courier Shell Robot Legs/Feet (short rectangular base), Courier Shell Robot Unit, Courier Shell Machine Sprite (+5 more)

### Community 14 - "Community 14"
Cohesion: 0.23
Nodes (12): Approve Option, Color-Coded Decision Indicators, Conveyor Belt Background, Decision Panel (Scrap / Repair / Approve), Hammer Tool, Inspect View UI Screen, Machine Subject (Conveyor Item), Pixel Art Visual Style (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.28
Nodes (9): Dark Purple and Gold Color Palette, Cyberpunk Aesthetic, Audit Drone, Game: You're Just a Machine, Hovering / Legless Locomotion, Machine (Game Entity Category), Pixel Art Style, Audit Drone Sprite (+1 more)

### Community 16 - "Community 16"
Cohesion: 0.39
Nodes (8): Cyberpunk Factory Theme, Game Enemy or NPC Unit, Pixel Art Style, Tennis Racket / Paddle Weapon, Robotic Tennis Character, Tennis Robot Sprite (Tennis.png), Wheeled Cart / Platform Base, You're Just a Machine (Phaser 3 Game)

### Community 17 - "Community 17"
Cohesion: 0.36
Nodes (8): Factory Control Buttons (red and green switches), Conveyor Belt (horizontal, bottom of scene), Cyberpunk / Industrial Dim Atmosphere, Dark Industrial Ceiling / Overhead Area, Factory Interior Environment, Phaser 3 Game Background Layer (You're Just a Machine), Hanging Light Bulb (warm glow, suspended from ceiling), Background_1 - Factory Interior Scene

### Community 18 - "Community 18"
Cohesion: 0.33
Nodes (1): MinigameBase

### Community 19 - "Community 19"
Cohesion: 0.38
Nodes (7): Cyberpunk/Dark Theme - Skull imagery evoking mortality and dehumanization in industrial setting, Enemy/Antagonist Sprite - Skull character likely represents danger, death, or factory overseer, Game Asset - Sprite for 'You're Just a Machine' Phaser 3 game jam project, Untitled_Artwork4.png - Pixel Art Skull/Skeleton Head Character, Pixel Art Style - Low-resolution retro-styled sprite artwork, Skull/Skeleton Head - Pixelated Enemy or NPC Character, You're Just a Machine - Cyberpunk factory worker Phaser 3 game jam project

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (5): Circular Disc / Round Object (orange-green coloring, top-down view), You're Just a Machine - Cyberpunk Factory Worker Game, In-game Item or Collectible Sprite (close-up/zoomed variant), Phaser 3 Game Asset - TennisClose, TennisClose - Close-up Sprite Asset

### Community 21 - "Community 21"
Cohesion: 0.6
Nodes (5): Cat-Like Character (Pink/Magenta Pixel Art), Game Asset for Cyberpunk Factory Worker Game, Pixel Art Visual Style, Pixel Art Character Sprite, Purple Wings or Accessory on Character

### Community 22 - "Community 22"
Cohesion: 0.6
Nodes (5): Cyberpunk Factory Context, Pixel Art Style, Red Arc Visor/Sensor, Sentry Robot, Sentry Frame Sprite

### Community 23 - "Community 23"
Cohesion: 0.5
Nodes (2): BaseHTTPRequestHandler, Res

### Community 24 - "Community 24"
Cohesion: 0.83
Nodes (4): Green Robot/Alien Character Artwork, Character Design Concept - Robot/Alien Worker, Cyberpunk Visual Aesthetic — Stylized Low-Fi Art, You're Just a Machine — Phaser 3 Game Jam Project

### Community 25 - "Community 25"
Cohesion: 0.67
Nodes (3): Pixel Art / Low-Resolution Sprite Style, Positive Feedback / Approval Icon, Smiley Face Thumbs-Up Clipart

### Community 26 - "Community 26"
Cohesion: 1.0
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Community 29"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **53 isolated node(s):** `Game Title: You're Just a Machine`, `Game Overview — Employee #492240182 in dystopian robot clinic`, `Genre: Narrative Puzzle / Papers Please-style Inspection Game`, `Engine: Phaser 3 (JavaScript) with Vanilla JS/HTML Canvas fallback`, `Rationale: Atmosphere over content volume — 3 hand-crafted cases per day preferred over 10 sloppy ones` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 26`** (2 nodes): `vite.config.js`, `assetNotFoundPlugin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 27`** (1 nodes): `print_img.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 28`** (1 nodes): `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 29`** (1 nodes): `GameState.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameScene` connect `Community 0` to `Community 8`, `Community 3`, `Community 11`, `Community 4`?**
  _High betweenness centrality (0.267) - this node is a cross-community bridge._
- **Why does `MachinePuzzleOverlay` connect `Community 3` to `Community 9`, `Community 2`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `createMachineVariant()` connect `Community 1` to `Community 0`, `Community 6`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **What connects `Game Title: You're Just a Machine`, `Game Overview — Employee #492240182 in dystopian robot clinic`, `Genre: Narrative Puzzle / Papers Please-style Inspection Game` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
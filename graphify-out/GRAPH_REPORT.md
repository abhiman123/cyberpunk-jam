# Graph Report - .  (2026-04-20)

## Corpus Check
- 61 files · ~96,284 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1012 nodes · 2602 edges · 29 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 264 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Game Scene Core Loop|Game Scene Core Loop]]
- [[_COMMUNITY_Puzzle Logic & Gear System|Puzzle Logic & Gear System]]
- [[_COMMUNITY_Animation & Visual FX|Animation & Visual FX]]
- [[_COMMUNITY_Machine Puzzle Overlay|Machine Puzzle Overlay]]
- [[_COMMUNITY_Debug Console Puzzle|Debug Console Puzzle]]
- [[_COMMUNITY_Build Specs & Scene Design|Build Specs & Scene Design]]
- [[_COMMUNITY_Gear Grid Puzzle|Gear Grid Puzzle]]
- [[_COMMUNITY_Circuit Routing Puzzle|Circuit Routing Puzzle]]
- [[_COMMUNITY_Charge Group Placement|Charge Group Placement]]
- [[_COMMUNITY_Boot Scene & Asset Loading|Boot Scene & Asset Loading]]
- [[_COMMUNITY_Rulebook Overlay|Rulebook Overlay]]
- [[_COMMUNITY_Factory Settings Overlay|Factory Settings Overlay]]
- [[_COMMUNITY_Desk Items & Mini Port|Desk Items & Mini Port]]
- [[_COMMUNITY_Input Handling & Controls|Input Handling & Controls]]
- [[_COMMUNITY_Gameplay UI & Conveyor|Gameplay UI & Conveyor]]
- [[_COMMUNITY_Machine Sprites (AssemblerCourier)|Machine Sprites (Assembler/Courier)]]
- [[_COMMUNITY_Inspection View UI|Inspection View UI]]
- [[_COMMUNITY_Audit Drone & Cyberpunk Assets|Audit Drone & Cyberpunk Assets]]
- [[_COMMUNITY_Sound & Game Constants|Sound & Game Constants]]
- [[_COMMUNITY_Tennis Robot Enemy|Tennis Robot Enemy]]
- [[_COMMUNITY_Factory Background Environment|Factory Background Environment]]
- [[_COMMUNITY_Skull Enemy Artwork|Skull Enemy Artwork]]
- [[_COMMUNITY_TennisClose Item Sprite|TennisClose Item Sprite]]
- [[_COMMUNITY_Cat Character Artwork|Cat Character Artwork]]
- [[_COMMUNITY_Sentry Machine Sprite|Sentry Machine Sprite]]
- [[_COMMUNITY_Green Robot Character Art|Green Robot Character Art]]
- [[_COMMUNITY_Approval Icon Asset|Approval Icon Asset]]
- [[_COMMUNITY_Entry Point|Entry Point]]
- [[_COMMUNITY_GameState Module|GameState Module]]

## God Nodes (most connected - your core abstractions)
1. `GameScene` - 279 edges
2. `MachinePuzzleOverlay` - 62 edges
3. `DebugConsolePuzzle` - 51 edges
4. `GearGridPuzzle` - 36 edges
5. `MachinePuzzleState` - 31 edges
6. `BootScene` - 29 edges
7. `CircuitRouting` - 28 edges
8. `RulebookOverlay` - 27 edges
9. `EndScene` - 23 edges
10. `PRD: You're Just a Machine (Product Requirements Document)` - 23 edges

## Surprising Connections (you probably didn't know these)
- `main.js — ES Module Entry Script` --references--> `Game.js: Conveyor and Inspection sub-states, shift timer, music system, HUD, ruling logic`  [INFERRED]
  index.html → CLAUDE_CODE_INSTRUCTIONS (1).md
- `main.js — ES Module Entry Script` --references--> `Phaser Scene Structure: BootScene, MenuScene, BriefingScene, GameScene, SummaryScene, TransitionScene, EndScene`  [INFERRED]
  index.html → README.md
- `Briefing.js: Manager sprite, typewriter text, new rules highlighted, ACKNOWLEDGED button, music_manager` --references--> `Game Periods (Days 1-3): World-building, QC robot replacement, Roboticized manager ending`  [INFERRED]
  CLAUDE_CODE_INSTRUCTIONS (1).md → README.md
- `Domino/Grid Puzzle System: Grid values 0-5, equality links, charge slots, runtime encoding 10+pipCount` --conceptually_related_to--> `Inspection Interface: Split screen — case left, action buttons right, timer bar, rulebook overlay`  [INFERRED]
  READMEOTHERMEMBERS.md → README.md
- `Rebellious Umbrella: Special machine behavior — proposes rebellion quest to player via phone panel yes/no flow` --conceptually_related_to--> `Back-Alley Dealer (Stretch): Side quest — approve marked unit for credits, no branch divergence`  [INFERRED]
  diff.txt → README.md

## Communities

### Community 0 - "Game Scene Core Loop"
Cohesion: 0.03
Nodes (3): glitchBurst(), GameScene, resolveMachineTexture()

### Community 1 - "Puzzle Logic & Gear System"
Cohesion: 0.04
Nodes (114): cloneGearBoard(), addFlowBypassForCandidate(), addFlowConnection(), addStandardFlowServiceLoop(), applyBrokenGlyphFault(), applyCorruptedDominoFault(), applyDebugStageToOption(), applyFlowStageToOption() (+106 more)

### Community 2 - "Animation & Visual FX"
Cohesion: 0.04
Nodes (9): Animations, applyCyberpunkLook(), stampCyberColorMatrix(), BriefingScene, EndScene, StateMachine, SummaryScene, TitleScene (+1 more)

### Community 3 - "Machine Puzzle Overlay"
Cohesion: 0.09
Nodes (3): getOrientationForRotationIndex(), MachinePuzzleOverlay, normalizeRotationIndex()

### Community 4 - "Debug Console Puzzle"
Cohesion: 0.08
Nodes (6): clampIndex(), DebugConsolePuzzle, displayChar(), getCorruptCharacter(), pickRandomEntry(), TimerBar

### Community 5 - "Build Specs & Scene Design"
Cohesion: 0.04
Nodes (65): Boot.js: Load assets, generate procedural placeholders, start Briefing scene, Briefing.js: Manager sprite, typewriter text, new rules highlighted, ACKNOWLEDGED button, music_manager, Claude Code Build Spec — Complete Overhaul Instructions, cases.json Schema Update: 4 zones (A/B/C/D), each with hammer and scanner fields, Step 0 Cleanup: Delete Workshop.js, Station.js, CyberpunkPipeline.js, FloorSketchLayout.js, Voice.js, Critical Constraints: No PostFXPipeline, no per-unit timer, audio optional, single Game scene for both screens, End.js: Robot-manager entrance, typewriter dialogue, camera shake+tilt, lights flicker, title card, play again, Game.js: Conveyor and Inspection sub-states, shift timer, music system, HUD, ruling logic (+57 more)

### Community 6 - "Gear Grid Puzzle"
Cohesion: 0.08
Nodes (16): GearGridPuzzle, getCellCenter(), inBounds(), isOpenBoardCell(), buildClampedGearCellSet(), buildGearOccupancy(), buildGearPairKey(), buildGearProgressSnapshot() (+8 more)

### Community 7 - "Circuit Routing Puzzle"
Cohesion: 0.09
Nodes (7): CircuitRouting, cloneCircuitTiles(), generateCircuit(), getFlowCellKey(), getFlowPowerPalette(), getFlowSegmentKey(), recordFlowSegment()

### Community 8 - "Charge Group Placement"
Cohesion: 0.13
Nodes (12): buildChargeGroupCluster(), canPlaceCandidate(), cellKey(), createPlacementCandidate(), decodePipCount(), getOrientationForRotationIndex(), isChargeCode(), isPlacedCode() (+4 more)

### Community 9 - "Boot Scene & Asset Loading"
Cohesion: 0.17
Nodes (1): BootScene

### Community 10 - "Rulebook Overlay"
Cohesion: 0.13
Nodes (1): RulebookOverlay

### Community 11 - "Factory Settings Overlay"
Cohesion: 0.13
Nodes (12): FactorySettingsOverlay, clampMusicVolume(), getGameSettings(), getMusicVolume(), getStorage(), isMusicEnabled(), normalizeSettings(), readStoredSettings() (+4 more)

### Community 12 - "Desk Items & Mini Port"
Cohesion: 0.16
Nodes (0): 

### Community 13 - "Input Handling & Controls"
Cohesion: 0.12
Nodes (1): MinigameBase

### Community 14 - "Gameplay UI & Conveyor"
Cohesion: 0.22
Nodes (13): APPROVE Decision Option, Conveyor Belt, Conveyor Belt Boxes, Core Gameplay Loop — Item Evaluation, Decision Legend / Color-Code Panel, Factory Background / Environment, Hanging Industrial Lamp, Machine Terminal (+5 more)

### Community 15 - "Machine Sprites (Assembler/Courier)"
Cohesion: 0.22
Nodes (13): Cyan Display Bars (Visual Element), Assembler Alpha (Game Entity), Robot / Industrial Machine Visual Design, Assembler Alpha Machine Sprite, Courier Shell Robot Head (rectangular with oval face, eye slots), Courier Shell Robot Legs/Feet (short rectangular base), Courier Shell Robot Unit, Courier Shell Machine Sprite (+5 more)

### Community 16 - "Inspection View UI"
Cohesion: 0.23
Nodes (12): Approve Option, Color-Coded Decision Indicators, Conveyor Belt Background, Decision Panel (Scrap / Repair / Approve), Hammer Tool, Inspect View UI Screen, Machine Subject (Conveyor Item), Pixel Art Visual Style (+4 more)

### Community 17 - "Audit Drone & Cyberpunk Assets"
Cohesion: 0.28
Nodes (9): Dark Purple and Gold Color Palette, Cyberpunk Aesthetic, Audit Drone, Game: You're Just a Machine, Hovering / Legless Locomotion, Machine (Game Entity Category), Pixel Art Style, Audit Drone Sprite (+1 more)

### Community 18 - "Sound & Game Constants"
Cohesion: 0.25
Nodes (2): getOpeningPhoneCallSequence(), getShiftClockStepMs()

### Community 19 - "Tennis Robot Enemy"
Cohesion: 0.39
Nodes (8): Cyberpunk Factory Theme, Game Enemy or NPC Unit, Pixel Art Style, Tennis Racket / Paddle Weapon, Robotic Tennis Character, Tennis Robot Sprite (Tennis.png), Wheeled Cart / Platform Base, You're Just a Machine (Phaser 3 Game)

### Community 20 - "Factory Background Environment"
Cohesion: 0.36
Nodes (8): Factory Control Buttons (red and green switches), Conveyor Belt (horizontal, bottom of scene), Cyberpunk / Industrial Dim Atmosphere, Dark Industrial Ceiling / Overhead Area, Factory Interior Environment, Phaser 3 Game Background Layer (You're Just a Machine), Hanging Light Bulb (warm glow, suspended from ceiling), Background_1 - Factory Interior Scene

### Community 21 - "Skull Enemy Artwork"
Cohesion: 0.38
Nodes (7): Cyberpunk/Dark Theme - Skull imagery evoking mortality and dehumanization in industrial setting, Enemy/Antagonist Sprite - Skull character likely represents danger, death, or factory overseer, Game Asset - Sprite for 'You're Just a Machine' Phaser 3 game jam project, Untitled_Artwork4.png - Pixel Art Skull/Skeleton Head Character, Pixel Art Style - Low-resolution retro-styled sprite artwork, Skull/Skeleton Head - Pixelated Enemy or NPC Character, You're Just a Machine - Cyberpunk factory worker Phaser 3 game jam project

### Community 22 - "TennisClose Item Sprite"
Cohesion: 0.5
Nodes (5): Circular Disc / Round Object (orange-green coloring, top-down view), You're Just a Machine - Cyberpunk Factory Worker Game, In-game Item or Collectible Sprite (close-up/zoomed variant), Phaser 3 Game Asset - TennisClose, TennisClose - Close-up Sprite Asset

### Community 23 - "Cat Character Artwork"
Cohesion: 0.6
Nodes (5): Cat-Like Character (Pink/Magenta Pixel Art), Game Asset for Cyberpunk Factory Worker Game, Pixel Art Visual Style, Pixel Art Character Sprite, Purple Wings or Accessory on Character

### Community 24 - "Sentry Machine Sprite"
Cohesion: 0.6
Nodes (5): Cyberpunk Factory Context, Pixel Art Style, Red Arc Visor/Sensor, Sentry Robot, Sentry Frame Sprite

### Community 25 - "Green Robot Character Art"
Cohesion: 0.83
Nodes (4): Green Robot/Alien Character Artwork, Character Design Concept - Robot/Alien Worker, Cyberpunk Visual Aesthetic — Stylized Low-Fi Art, You're Just a Machine — Phaser 3 Game Jam Project

### Community 26 - "Approval Icon Asset"
Cohesion: 0.67
Nodes (3): Pixel Art / Low-Resolution Sprite Style, Positive Feedback / Approval Icon, Smiley Face Thumbs-Up Clipart

### Community 27 - "Entry Point"
Cohesion: 1.0
Nodes (0): 

### Community 28 - "GameState Module"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **53 isolated node(s):** `Game Title: You're Just a Machine`, `Game Overview — Employee #492240182 in dystopian robot clinic`, `Genre: Narrative Puzzle / Papers Please-style Inspection Game`, `Engine: Phaser 3 (JavaScript) with Vanilla JS/HTML Canvas fallback`, `Rationale: Atmosphere over content volume — 3 hand-crafted cases per day preferred over 10 sloppy ones` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Entry Point`** (1 nodes): `main.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `GameState Module`** (1 nodes): `GameState.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GameScene` connect `Game Scene Core Loop` to `Machine Puzzle Overlay`, `Debug Console Puzzle`, `Rulebook Overlay`, `Factory Settings Overlay`, `Desk Items & Mini Port`, `Input Handling & Controls`, `Sound & Game Constants`?**
  _High betweenness centrality (0.340) - this node is a cross-community bridge._
- **Why does `MachinePuzzleOverlay` connect `Machine Puzzle Overlay` to `Charge Group Placement`, `Animation & Visual FX`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `GearGridPuzzle` connect `Gear Grid Puzzle` to `Animation & Visual FX`?**
  _High betweenness centrality (0.080) - this node is a cross-community bridge._
- **What connects `Game Title: You're Just a Machine`, `Game Overview — Employee #492240182 in dystopian robot clinic`, `Genre: Narrative Puzzle / Papers Please-style Inspection Game` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Game Scene Core Loop` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Puzzle Logic & Gear System` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Animation & Visual FX` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
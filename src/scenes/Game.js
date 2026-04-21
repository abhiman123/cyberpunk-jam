import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import RulebookOverlay from '../systems/RulebookOverlay.js';
import MachinePuzzleOverlay from '../systems/MachinePuzzleOverlay.js';
import FactorySettingsOverlay from '../systems/FactorySettingsOverlay.js';
import Animations from '../fx/Animations.js';
import { applyCyberpunkLook, glitchBurst } from '../fx/applyCyberpunkLook.js';
import {
    FIRST_SHIFT_INTRO,
    MACHINE_PRESENTATION,
    SHIFT_CLOCK,
    SHIFT_DURATION_MS,
    SHIFT_DURATION_MS_BY_PERIOD,
    SOUND_ASSETS,
    SOUND_VOLUMES,
    getOpeningPhoneCallSequence,
    getShiftClockStepMs,
} from '../constants/gameConstants.js';
import { GEAR_CODES, evaluateGearPuzzleBoard, gearCellKey, getGearConnections, isGearType } from '../core/gearPuzzleLogic.js';
import { createMachineVariant, getEligibleMachineDefinitions, resolveMachineTexture } from '../data/machineCatalog.js';
import { getMusicVolume } from '../state/gameSettings.js';

import StateMachine from '../core/StateMachine.js';
import CircuitRouting from '../systems/minigames/CircuitRouting.js';
import GearGridPuzzle from '../systems/minigames/GearGridPuzzle.js';
import DebugConsolePuzzle from '../systems/minigames/DebugConsolePuzzle.js';

const PAYCHECK_DELTA = 18;
const SCRAP_BONUS_MULTIPLIER = 2;
const UMBRELLA_REBELLION_RULE_ID = 101;
const UMBRELLA_PART_PORTS = Object.freeze({
    circuit: 'grid',
    wire: 'flow',
    gear: 'gear',
    data: 'code',
});

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('Game');
        this._handleKonamiKey = this._handleKonamiKey.bind(this);
    }

    create() {
        const legacyCursor = GameState.getLegacyContentCursor();

        const allCases = this.cache.json.get('cases') || [];
        const allRules = this.cache.json.get('rules') || [];
        const schedule = this.cache.json.get('schedule') || [];
        const schedEntry = schedule.find((entry) => entry.period === legacyCursor.period && entry.day === legacyCursor.day);
        const baseIds = schedEntry ? schedEntry.caseIds : [];

        this._baseQueue = baseIds.map((id) => allCases.find((item) => item.id === id)).filter(Boolean);
        this._queue = [...this._baseQueue];
        this._queueIndex = 0;
        this._machineQueue = [];
        this._machineQueueDefinitions = [];
        this._machineDefinitionById = new Map();
        this._machineGuaranteeState = [];
        this._currentCase = null;
        this._actionLocked = false;
        this._shiftMistakes = 0;
        this._paycheckDelta = 0;
        this._selectedTool = null;
        this._inspectedZones = new Set();
        this._logLines = [];
        this._screen = 'conveyor';
        this._lastTypeBeepAt = 0;
        this._miniMachinePanelVisible = false;
        this._miniMachinePanelHoverPort = null;
        this._machineSpeechBubbleHistory = [];
        this._activeMachineSpeechBubbleIndex = -1;
        this._pendingKonamiFinalCase = null;
        this._purpleCircuitDeskItem = null;
        this._umbrellaDeskItemMap = new Map();
        this._umbrellaPartCheckType = null;
        this._rosterClearBonusQueued = false;
        this._rulebookDeskItem = null;
        this._rulebookTutorialArrow = null;
        this._rulebookTutorialLineActive = false;
        this._activePhoneTypingState = null;

        this._shiftDuration = SHIFT_DURATION_MS_BY_PERIOD[GameState.day] || SHIFT_DURATION_MS;
        this._elapsed = 0;
        this._shiftRunning = false;
        this._musicPhase = 1;
        this._currentMusic = null;
        this._clockDisplayMinutes = null;
        this._phoneButtonsActive = false;
        this._phoneChoicePhase = 'inactive';
        this._currentMachineVariant = null;
        this._settingsOpen = false;
        this._gameplayPaused = false;
        this._overlayModalOpen = false;
        this._nextCaseEvent = null;
        this._advanceCaseEvent = null;
        this._commTypingEvent = null;
        this._commSequenceEvent = null;
        this._unitMoveTween = null;
        this._activeMusicKey = null;
        this._pendingExitAction = null;
        this._pendingUnsafeAcceptConfirmation = false;
        this._shiftEnding = false;
        this._shiftAwaitingFinalRuling = false;
        this._otherPuzzleReturnPhoneState = null;
        this._gearPuzzleReturnPhoneState = null;
        this._debugPuzzleReturnPhoneState = null;
        this._otherPuzzleReturnVoiceBroken = false;
        this._machineWorklightFlickerEvent = null;
        this._phoneBodyScrollOffset = 0;
        this._phoneStickToBottom = true;
        this._phoneScrollHover = false;
        this._phoneViewMode = 'info';
        this._phoneInfoNote = null;
        this._phoneUnreadNotifications = 0;
        this._phoneNotificationSerial = 0;
        this._phoneNotifications = [];
        this._openingCallSequenceId = 0;
        this._openingCallChoiceResolver = null;
        this._sequenceDebugCounter = 0;
        this._phoneViews = {
            info: {
                header: 'UNIT DOSSIER',
                body: 'No unit latched to the line.',
                status: 'LINE STANDBY',
                scrollOffset: 0,
                stickToBottom: false,
            },
            notifications: {
                header: 'WORLD FEED',
                body: 'Shift feed is idle.',
                status: 'NO ALERTS',
                scrollOffset: 0,
                stickToBottom: false,
            },
            chat: {
                header: 'FACTORY LINK',
                body: 'Awaiting unit connection.',
                status: 'CHANNEL IDLE',
                scrollOffset: 0,
                stickToBottom: true,
            },
        };
        this._deskItems = [];
        this._selectedDeskItem = null;
        this._deskItemIntent = null;
        this._jesterDeskTokenItem = null;
        this._currentUnitJitterTween = null;
        this._miniGearPreviewPhase = 0;
        this._miniGearPreviewTimer = 0;
        this._currentMiniGearPreviewRect = null;
        this._konamiSequence = ['UP', 'UP', 'DOWN', 'DOWN', 'LEFT', 'RIGHT', 'LEFT', 'RIGHT'];
        this._konamiProgress = 0;
        this._konamiFinaleTriggered = false;
        this._initializeMachineShiftQueue();

        this._caseSM = new StateMachine('intake');

        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        this._buildHUD();
        this._buildConveyorScreen();
        this._buildDisabledInspectionContainer();
        this._buildPhonePanel();
        this._machinePuzzleOverlay = new MachinePuzzleOverlay(this, {
            onPuzzleChanged: (machineVariant, puzzleState) => this._handlePuzzleStateChanged(machineVariant, puzzleState),
            onClose: (machineVariant, puzzleState) => this._handleMachinePuzzleClosed(machineVariant, puzzleState),
            getSpecialAction: (machineVariant) => this._getUmbrellaGridSpecialAction(machineVariant),
        });
        this._otherPuzzleOverlay = new CircuitRouting(this, { depth: 360 });
        this._otherPuzzleOverlay.onClose = (evidence) => this._handleOtherPuzzleClosed(evidence);
        this._gearPuzzleOverlay = new GearGridPuzzle(this, { depth: 360 });
        this._gearPuzzleOverlay.onClose = (evidence) => this._handleGearPuzzleClosed(evidence);
        this._debugPuzzleOverlay = new DebugConsolePuzzle(this, { depth: 360 });
        this._debugPuzzleOverlay.onClose = (evidence) => this._handleDebugPuzzleClosed(evidence);
        window.addEventListener('keydown', this._handleKonamiKey);

        const newRuleIds = GameState.day <= 3
            ? allRules.filter((rule) => rule.period === GameState.day).map((rule) => rule.id)
            : [];
        this._rulebook = new RulebookOverlay(this, GameState.activeRules, allRules, newRuleIds, {
            canToggle: () => this._canOpenRulebookOverlay(),
            onOpen: () => this._setGameplayPaused(true),
            onClose: () => this._setGameplayPaused(false),
        });
        this._settingsOverlay = new FactorySettingsOverlay(this, {
            onOpen: () => this._setGameplayPaused(true),
            onClose: () => this._setGameplayPaused(false),
            onMusicChanged: () => this._applyMusicSettingChange(),
        });
        this._buildRulebookTutorialArrow();
        this._syncRulebookTutorialArrow();

        this.events.on('shutdown', () => {
            this._clearPhoneTyping();
            this._openingCallSequenceId += 1;
            this._openingCallChoiceResolver = null;
            this._nextCaseEvent?.remove(false);
            this._advanceCaseEvent?.remove(false);
            this._machineWorklightFlickerEvent?.remove(false);
            this.input.off('wheel', this._handlePhoneWheel, this);
            this.input.off('pointermove', this._handleDeskItemPointerMove, this);
            this.input.off('pointerup', this._handleDeskItemPointerUp, this);
            this.input.off('gameout', this._handleDeskItemPointerUp, this);
            window.removeEventListener('keydown', this._handleKonamiKey);
            this._phoneBodyMaskSource?.destroy();
            this._miniMachineScreenMaskSource?.destroy();
            this._rulebook?.destroy();
            this._machinePuzzleOverlay.destroy();
            this._otherPuzzleOverlay.destroy();
            this._gearPuzzleOverlay.destroy();
            this._debugPuzzleOverlay.destroy();
            this._settingsOverlay.destroy();
            if (this._currentMusic) {
                this._currentMusic.stop();
                this._currentMusic.destroy();
                this._currentMusic = null;
            }
        });

        this._setScreen('conveyor');
        this._setFactoryIdleState('SHIFT READY\n\nSTATUS: HOLD');
        this._updateShiftClock();

        this.cameras.main.fadeIn(400, 0, 0, 0);

        if (FIRST_SHIFT_INTRO.enabled) {
            if (this._shouldUseAutomatedTextBrief()) {
                this._startAutomatedTextBrief();
            } else {
                this._startOpeningPhoneCall();
            }
        } else {
            this.time.delayedCall(300, () => this._beginShift());
        }
    }

    update(_time, delta) {
        this._updateMiniGearPreview(delta);
        this._syncRulebookTutorialArrow();

        if (!this._shiftRunning || this._gameplayPaused || this._shiftEnding) return;

        this._elapsed = Math.min(this._elapsed + delta, this._shiftDuration);
        const ratio = 1 - (this._elapsed / this._shiftDuration);

        this._updateShiftClock();
        this._checkMusicPhase(ratio);

        if (this._elapsed >= this._shiftDuration) {
            if (this._currentCase) {
                this._armShiftAwaitingFinalRuling();
                return;
            }

            this._shiftRunning = false;
            this._endShift(false);
        }
    }

    _buildHUD() {
        this._hudContainer = this.add.container(0, 0).setDepth(200);
        this._factoryControlsContainer = this.add.container(0, 0).setDepth(208).setVisible(false);

        const topBarShadow = this.add.rectangle(640, 130, 1280, 244, 0x000000, 0.24);
        const topBar = this.add.rectangle(640, 118, 1280, 228, 0x524c40, 0.96)
            .setStrokeStyle(2, 0x9d947d, 0.95);
        const topBarInner = this.add.rectangle(640, 118, 1234, 192, 0x2d2c28, 0.98)
            .setStrokeStyle(1, 0xbcae84, 0.28);
        const topBarPocket = this.add.rectangle(640, 120, 1186, 162, 0x161714, 0.9)
            .setStrokeStyle(1, 0x757058, 0.24);
        const topStrip = this.add.rectangle(640, 24, 1280, 48, 0x090807, 0.94)
            .setStrokeStyle(1, 0x6a6556, 0.25);
        this._hudContainer.add([topBarShadow, topBar, topBarInner, topBarPocket, topStrip]);

        this._hudPeriodText = this.add.text(12, 14,
            `DAY ${GameState.day}`, {
                fontFamily: 'Courier New', fontSize: '11px', color: '#cccccc',
            }
        );
        this._hudContainer.add(this._hudPeriodText);

        this._hudCasesText = this.add.text(502, 25, 'CASES: 0', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#888888',
        }).setOrigin(0.5);
        this._hudContainer.add(this._hudCasesText);

        this._hudPayText = this.add.text(1268, 12, this._fmtPay(), {
            fontFamily: 'Courier New', fontSize: '14px', color: '#4ff3a9',
        }).setOrigin(1, 0);
        this._hudContainer.add(this._hudPayText);

        this._hudViolText = this.add.text(1268, 30, 'Violations: 0', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#666666',
        }).setOrigin(1, 0);
        this._hudContainer.add(this._hudViolText);

        this._buildDeskSurface();

        const clockPanelCenterX = 1150;
        const clockPanelCenterY = this._deskContainer.y + 86;

        this._clockDialCenterX = clockPanelCenterX - 62;
        this._clockDialCenterY = clockPanelCenterY;

        const clockBg = this.add.rectangle(clockPanelCenterX, clockPanelCenterY, 210, 86, 0x050505, 0.92)
            .setStrokeStyle(1, 0x4e7c8f, 0.75);
        this._hudContainer.add(clockBg);

        const clockFaceFrame = this.add.rectangle(this._clockDialCenterX, this._clockDialCenterY, 52, 52, 0x08141a, 0.95)
            .setStrokeStyle(1, 0x66aacc, 0.75);
        this._hudContainer.add(clockFaceFrame);

        this._clockIcon = this.add.graphics();
        this._hudContainer.add(this._clockIcon);

        const clockLabel = this.add.text(clockPanelCenterX - 30, clockPanelCenterY - 26, 'SHIFT CLOCK', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#66aacc', letterSpacing: 3,
        });
        this._hudContainer.add(clockLabel);

        this._clockText = this.add.text(clockPanelCenterX - 30, clockPanelCenterY + 4, '12:00 PM', {
            fontFamily: 'Courier New', fontSize: '24px', color: '#ccefff',
        }).setOrigin(0, 0.5);
        this._hudContainer.add(this._clockText);

        this._clockPauseNotice = this.add.container(986, clockPanelCenterY + 52).setVisible(false).setAlpha(0);
        const pauseGlow = this.add.rectangle(0, 0, 274, 32, 0xffffff, 0.04)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xeefbff, 0.14);
        const pausePlate = this.add.rectangle(4, 4, 266, 24, 0xf7ffff, 0.08)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xeefbff, 0.3);
        const pauseTagLeft = this.add.rectangle(10, 8, 44, 16, 0xf6ffff, 0.18)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xf6ffff, 0.36);
        const pauseTagRight = this.add.rectangle(216, 8, 44, 16, 0xf6ffff, 0.12)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xf6ffff, 0.22);
        const pauseScan = this.add.graphics();
        pauseScan.fillStyle(0xffffff, 0.09);
        for (let offset = 0; offset < 24; offset += 6) {
            pauseScan.fillRect(64, 7 + offset, 142, 2);
        }
        const pauseBroadcastBars = this.add.graphics();
        pauseBroadcastBars.fillStyle(0xf6ffff, 0.16);
        pauseBroadcastBars.fillRect(58, 8, 3, 16);
        pauseBroadcastBars.fillRect(209, 8, 3, 16);
        pauseBroadcastBars.fillRect(214, 8, 1, 16);
        const pauseText = this.add.text(136, 16, 'TIMER PAUSED', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#f7ffff',
            letterSpacing: 2,
        }).setOrigin(0.5).setAlpha(0.74);
        this._clockPauseNotice.add([
            pauseGlow,
            pausePlate,
            pauseTagLeft,
            pauseTagRight,
            pauseScan,
            pauseBroadcastBars,
            pauseText,
        ]);
        this._hudContainer.add(this._clockPauseNotice);

        this._buildMiniMachinePanel();
    }

    _buildDeskSurface() {

        const deskBase = this.add.rectangle(0, 0, this.scale.width, 172, 0x4b4338).setOrigin(0, 0).setStrokeStyle(2, 0x7c745f, 0.92);
        const deskInset = this.add.rectangle(50, 30, 270, 112, 0x3a342d, 0.72).setOrigin(0, 0).setStrokeStyle(1, 0x6b6252, 0.55);

        this._deskContainer = this.add.container(0, this.scale.height - deskBase.height).setDepth(188);
        this._deskContainer.add([
            deskBase,
            deskInset
        ]);

        this._deskPhotoBounds = new Phaser.Geom.Rectangle(0, 0, this.scale.width, deskBase.height);
        this.input.on('pointermove', this._handleDeskItemPointerMove, this);
        this.input.on('pointerup', this._handleDeskItemPointerUp, this);
        this.input.on('gameout', this._handleDeskItemPointerUp, this);

        this._createDeskPhoto('manager_human', 'manager_human', {
            x: 100,
            y: 75,
            angle: -18,
            portraitScale: 0.1,
            width: 66,
            height: 52,
        });
        this._createDeskPhoto('manager_robot', 'manager_robot', {
            x: 190,
            y: 85,
            angle: -6,
            portraitScale: 0.1,
            width: 66,
            height: 52,
        });
        this._createDeskPhoto('family_photo', 'family_photo', {
            x: 270,
            y: 70,
            angle: 4,
            portraitScale: 0.2,
            width: 62,
            height: 48,
            tint: 0xffffff,
        });
        this._rulebookDeskItem = this._createDeskTablet('desk_tablet', {
            x: 440,
            y: 72,
            angle: -8,
            width: 128,
            height: 84,
        });
        // Y values are in deskContainer-local space (deskContainer.y = scale.height - 172 = 548).
        // To appear at screen y≈624-626, subtract 548 → container-local y≈76-78.
        this._createJesterDeskTokenItem({
            x: 560,
            y: 76,
            angle: -4,
            width: 54,
            height: 94,
        });
        this._createPurpleCircuitDeskItem({
            x: 624,
            y: 76,
            angle: 4,
            width: 58,
            height: 94,
        });
        this._createUmbrellaDeskPartItem('gear', {
            x: 650,
            y: 77,
            angle: -6,
            width: 64,
            height: 64,
        });
        this._createUmbrellaDeskPartItem('circuit', {
            x: 726,
            y: 78,
            angle: 3,
            width: 58,
            height: 90,
        });
        this._createUmbrellaDeskPartItem('wire', {
            x: 804,
            y: 78,
            angle: -2,
            width: 94,
            height: 54,
        });
        this._createUmbrellaDeskPartItem('data', {
            x: 900,
            y: 77,
            angle: 5,
            width: 68,
            height: 52,
        });

        this._hudContainer.add(this._deskContainer);
    }

    _createDeskPhoto(photoId, textureKey, options = {}) {
        const width = options.width || 62;
        const height = options.height || 48;
        const portraitScale = options.portraitScale || 0.38;

        return this._createDeskItem(photoId, {
            ...options,
            width,
            height,
            rotationStep: 12,
            buildVisual: () => {
                const liftShadow = this.add.rectangle(6, 8, width + 6, height + 6, 0x000000, 0.14);
                const focusGlow = this.add.rectangle(0, 0, width + 16, height + 16, 0xfff8db, 0)
                    .setStrokeStyle(2, 0xfffbe7, 0);
                const shadow = this.add.rectangle(4, 5, width, height, 0x000000, 0.2);
                const frame = this.add.rectangle(0, 0, width, height, 0xf0e8db, 1)
                    .setStrokeStyle(1, 0x5d5247, 0.68);
                const matte = this.add.rectangle(0, -4, width - 12, height - 16, 0x7b7368, 1)
                    .setStrokeStyle(1, 0x443b32, 0.4);
                const portrait = this.add.image(0, -4, textureKey)
                    .setScale(portraitScale)
                    .setTint(options.tint || 0xf0f0f0);

                return {
                    nodes: [liftShadow, focusGlow, shadow, frame, matte, portrait],
                    frame,
                    focusGlow,
                    liftShadow,
                };
            },
        });
    }

    _createDeskTablet(itemId, options = {}) {
        const width = options.width || 128;
        const height = options.height || 84;

        return this._createDeskItem(itemId, {
            ...options,
            width,
            height,
            allowRotate: false,
            selectedScale: 1.04,
            dragScale: 1.1,
            onActivate: () => this._toggleRulebookTablet(),
            buildVisual: () => {
                // ── Drop shadow ──────────────────────────────────────────
                const liftShadow = this.add.ellipse(8, 12, width + 14, height - 8, 0x000000, 0.22);

                // ── Hover glow (invisible until hover) ───────────────────
                const focusGlow = this.add.rectangle(0, 0, width + 20, height + 20, 0x62f6ff, 0)
                    .setStrokeStyle(2, 0xb8fdff, 0);

                // ── Outer casing — chunky industrial dark shell ──────────
                const shell = this.add.rectangle(0, 0, width, height, 0x151a1f, 1)
                    .setStrokeStyle(3, 0x3d4d57, 0.96);

                // ── Inner bezel — slightly inset lighter ring ─────────────
                const bezel = this.add.rectangle(0, 1, width - 8, height - 8, 0x1c262d, 1)
                    .setStrokeStyle(1, 0x4e6370, 0.62);

                // ── Screen glass ─────────────────────────────────────────
                const screen = this.add.rectangle(0, 2, width - 18, height - 20, 0x061017, 0.98)
                    .setStrokeStyle(1, 0x40b8cc, 0.72);

                // ── Screen inner glow / ambient ───────────────────────────
                const screenGlow = this.add.rectangle(0, 2, width - 22, height - 24, 0x0a2535, 0.84);

                // ── Scanlines (faint CRT effect via thin rects) ───────────
                const scanLines = this.add.graphics();
                const screenTop = 2 - (height - 24) / 2;
                const screenH = height - 24;
                scanLines.fillStyle(0x000000, 0.18);
                for (let sy = 0; sy < screenH; sy += 4) {
                    scanLines.fillRect(-(width - 22) / 2, screenTop + sy, width - 22, 1);
                }

                // ── Top label strip — "INSPECTOR" branding ────────────────
                const labelStrip = this.add.rectangle(0, -(height / 2) + 7, width - 8, 10, 0x0e2430, 1)
                    .setStrokeStyle(0, 0, 0);
                const brandLabel = this.add.text(0, -(height / 2) + 7, 'INSPECTOR', {
                    fontFamily: 'Courier New',
                    fontSize: '7px',
                    color: '#4fb8cc',
                    letterSpacing: 3,
                }).setOrigin(0.5);

                // ── Screen main label ─────────────────────────────────────
                const screenLabel = this.add.text(0, -2, 'RULEBOOK', {
                    fontFamily: 'Courier New',
                    fontSize: '13px',
                    color: '#c8f4ff',
                    letterSpacing: 2,
                }).setOrigin(0.5);

                // ── Screen sublabel ───────────────────────────────────────
                const screenSub = this.add.text(0, 13, '[ TAP TO OPEN ]', {
                    fontFamily: 'Courier New',
                    fontSize: '7px',
                    color: '#3d9db5',
                    letterSpacing: 1,
                }).setOrigin(0.5);

                // ── Status LED ────────────────────────────────────────────
                const led = this.add.circle((width / 2) - 9, -(height / 2) + 7, 3.5, 0x23ff8c, 1);
                const ledHalo = this.add.circle((width / 2) - 9, -(height / 2) + 7, 6, 0x23ff8c, 0.18);

                // ── Corner rivets ─────────────────────────────────────────
                const rivetPositions = [
                    [-(width / 2) + 5, -(height / 2) + 4],
                    [ (width / 2) - 5, -(height / 2) + 4],
                    [-(width / 2) + 5,  (height / 2) - 4],
                    [ (width / 2) - 5,  (height / 2) - 4],
                ];
                const rivets = this.add.graphics();
                rivets.fillStyle(0x2d3d47, 1);
                rivetPositions.forEach(([rx, ry]) => {
                    rivets.fillCircle(rx, ry, 2.5);
                    rivets.lineStyle(1, 0x5a7482, 0.6);
                    rivets.strokeCircle(rx, ry, 2.5);
                });

                // ── Bottom port strip ─────────────────────────────────────
                const portStrip = this.add.rectangle(0, (height / 2) - 6, width - 8, 8, 0x0d1b23, 1)
                    .setStrokeStyle(0, 0, 0);
                const portSlot = this.add.rectangle(0, (height / 2) - 6, 18, 3, 0x1e3240, 1)
                    .setStrokeStyle(1, 0x2f5068, 0.7);

                // ── Screen pulsing border tween ───────────────────────────
                this.tweens.add({
                    targets: screen,
                    alpha: { from: 0.92, to: 1 },
                    duration: 2200,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut',
                });

                // ── LED breathing tween ───────────────────────────────────
                this.tweens.add({
                    targets: [led, ledHalo],
                    alpha: { from: 0.6, to: 1 },
                    duration: 1400,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut',
                });

                // ── Subtle screen-text shimmer ───────────────────────────
                this.tweens.add({
                    targets: screenLabel,
                    alpha: { from: 0.82, to: 1 },
                    duration: 1800,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut',
                });

                return {
                    nodes: [
                        liftShadow, focusGlow,
                        shell, bezel, screen, screenGlow, scanLines,
                        labelStrip, brandLabel,
                        screenLabel, screenSub,
                        led, ledHalo,
                        rivets,
                        portStrip, portSlot,
                    ],
                    frame: shell,
                    focusGlow,
                    liftShadow,
                };
            },
        });
    }

    _buildRulebookTutorialArrow() {
        if (this._rulebookTutorialArrow || !this._hudContainer) return;

        const container = this.add.container(0, 0).setDepth(246).setVisible(false).setAlpha(0);
        const halo = this.add.ellipse(0, 0, 112, 28, 0x81f8ff, 0.12);
        const plate = this.add.rectangle(0, -54, 108, 26, 0x092129, 0.84)
            .setStrokeStyle(2, 0x81f8ff, 0.72);
        const label = this.add.text(0, -54, 'SEE THIS', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#d9fbff',
            letterSpacing: 2,
        }).setOrigin(0.5);
        const beam = this.add.graphics();
        beam.lineStyle(3, 0x81f8ff, 0.82);
        beam.beginPath();
        beam.moveTo(0, -28);
        beam.lineTo(0, 28);
        beam.strokePath();
        const arrow = this.add.graphics();
        arrow.fillStyle(0x81f8ff, 0.88);
        arrow.fillTriangle(0, 52, -14, 24, 14, 24);
        arrow.lineStyle(2, 0xd7fcff, 0.76);
        arrow.strokeTriangle(0, 52, -14, 24, 14, 24);
        container.add([halo, plate, label, beam, arrow]);
        this._hudContainer.add(container);

        this._rulebookTutorialArrow = { container, halo };
    }

    _syncRulebookTutorialArrow() {
        const arrow = this._rulebookTutorialArrow;
        if (!arrow) return;

        const shouldShow = Boolean(
            this._rulebookTutorialLineActive
            && !this._rulebook?.isVisible()
            && !this._settingsOpen
            && !this._overlayModalOpen
            && this._screen === 'conveyor'
            && this._rulebookDeskItem?.container?.visible
        );

        if (!shouldShow) {
            arrow.container.setVisible(false).setAlpha(0);
            return;
        }

        const targetX = this._deskContainer.x + this._rulebookDeskItem.container.x;
        const targetY = this._deskContainer.y + this._rulebookDeskItem.container.y;
        const bobOffset = Math.sin(this.time.now * 0.006) * 8;
        arrow.container
            .setVisible(true)
            .setAlpha(0.96)
            .setPosition(targetX + 10, targetY - 112 + bobOffset);
        arrow.halo.setAlpha(0.08 + ((Math.sin(this.time.now * 0.008) + 1) * 0.05));
    }

    _setRulebookTutorialLineActive(active) {
        this._rulebookTutorialLineActive = Boolean(active);
        this._syncRulebookTutorialArrow();
    }

    _createJesterDeskTokenItem(options = {}) {
        const width = options.width || 54;
        const height = options.height || 94;

        const item = this._createDeskItem('jester_clown_token', {
            ...options,
            width,
            height,
            allowRotate: false,
            selectedScale: 1,
            dragScale: 1,
            customType: 'jester-token',
            buildVisual: () => {
                const liftShadow = this.add.ellipse(6, 10, width + 12, height + 8, 0x000000, 0.18);
                const focusGlow = this.add.rectangle(0, 0, width + 20, height + 20, 0xffb1ac, 0)
                    .setStrokeStyle(2, 0xffe0dc, 0);
                const backPlate = this.add.rectangle(0, 0, width, height, 0x3f0a0a, 1)
                    .setStrokeStyle(2, 0xf0b7a9, 0.78);
                const facePlate = this.add.rectangle(0, 0, width - 8, height - 8, 0xba2424, 1)
                    .setStrokeStyle(1, 0xffe3dc, 0.52);
                const gloss = this.add.rectangle(0, -(height / 2) + 12, width - 14, 12, 0xffffff, 0.1);
                const divider = this.add.rectangle(0, 0, width - 16, 2, 0x6d1010, 1);
                const face = this.add.circle(0, 0, 15, 0xfff6f4, 0.92)
                    .setStrokeStyle(1, 0x6d1010, 0.42);
                const eyeLeft = this.add.circle(-6, -4, 3, 0x61c7ff, 0.98);
                const eyeRight = this.add.circle(6, -4, 3, 0x61c7ff, 0.98);
                const nose = this.add.circle(0, 1, 4, 0xff5353, 0.98);
                const grin = this.add.text(0, 13, 'HA', {
                    fontFamily: 'Courier New',
                    fontSize: '11px',
                    color: '#fff0ea',
                    stroke: '#5c0d0d',
                    strokeThickness: 3,
                    letterSpacing: 1,
                }).setOrigin(0.5);

                return {
                    nodes: [liftShadow, focusGlow, backPlate, facePlate, gloss, divider, face, eyeLeft, eyeRight, nose, grin],
                    frame: backPlate,
                    focusGlow,
                    liftShadow,
                };
            },
        });

        item.homePosition = {
            x: options.x,
            y: options.y,
            angle: options.angle || 0,
        };
        item.container.setVisible(false);
        if (item.inputZone?.input) {
            item.inputZone.input.enabled = false;
        }
        this._jesterDeskTokenItem = item;
        return item;
    }

    _createPurpleCircuitDeskItem(options = {}) {
        const width = options.width || 58;
        const height = options.height || 94;

        const item = this._createDeskItem('purple_circuit_token', {
            ...options,
            width,
            height,
            allowRotate: false,
            selectedScale: 1,
            dragScale: 1,
            customType: 'purple-circuit',
            buildVisual: () => {
                const liftShadow = this.add.ellipse(6, 10, width + 12, height + 8, 0x000000, 0.18);
                const focusGlow = this.add.rectangle(0, 0, width + 22, height + 22, 0xc98dff, 0)
                    .setStrokeStyle(2, 0xf1dcff, 0);
                const backPlate = this.add.rectangle(0, 0, width, height, 0x241138, 1)
                    .setStrokeStyle(2, 0xe4c5ff, 0.82);
                const facePlate = this.add.rectangle(0, 0, width - 8, height - 8, 0x6d2fc7, 1)
                    .setStrokeStyle(1, 0xf1e6ff, 0.58);
                const gloss = this.add.rectangle(0, -(height / 2) + 12, width - 14, 12, 0xffffff, 0.12);
                const divider = this.add.rectangle(0, 0, width - 16, 2, 0x3f1873, 1);
                const halo = this.add.circle(0, 0, 16, 0xf5e8ff, 0.18)
                    .setStrokeStyle(1, 0xf2dcff, 0.42);
                const core = this.add.circle(0, 0, 10, 0xc47bff, 1)
                    .setStrokeStyle(1, 0xfff3ff, 0.72);
                const glyph = this.add.text(0, 12, 'VOID', {
                    fontFamily: 'Courier New',
                    fontSize: '10px',
                    color: '#fff2ff',
                    stroke: '#3f1873',
                    strokeThickness: 3,
                    letterSpacing: 1,
                }).setOrigin(0.5);

                return {
                    nodes: [liftShadow, focusGlow, backPlate, facePlate, gloss, divider, halo, core, glyph],
                    frame: backPlate,
                    focusGlow,
                    liftShadow,
                };
            },
        });

        item.homePosition = {
            x: options.x,
            y: options.y,
            angle: options.angle || 0,
        };
        item.container.setVisible(false);
        if (item.inputZone?.input) {
            item.inputZone.input.enabled = false;
        }
        this._purpleCircuitDeskItem = item;
        return item;
    }

    _createUmbrellaDeskPartItem(partType, options = {}) {
        const width = options.width || 64;
        const height = options.height || 64;
        const paletteByType = {
            gear: { fill: 0x938b7b, accent: 0xffd68d, stroke: 0x5a5248, label: 'GEAR' },
            circuit: { fill: 0x214231, accent: 0x90ffb6, stroke: 0x7fd9a2, label: 'CIR' },
            wire: { fill: 0x2f2438, accent: 0xffa0cb, stroke: 0x8cd6ff, label: 'WIRE' },
            data: { fill: 0x1d2d41, accent: 0x8fdcff, stroke: 0xc5f0ff, label: 'USB' },
        };
        const palette = paletteByType[partType] || paletteByType.gear;

        const item = this._createDeskItem(`umbrella_${partType}_stash`, {
            ...options,
            width,
            height,
            allowRotate: false,
            selectedScale: 1.02,
            dragScale: 1.06,
            customType: 'umbrella-part',
            partType,
            buildVisual: () => {
                const liftShadow = this.add.ellipse(6, 8, width + 10, height - 6, 0x000000, 0.16);
                const focusGlow = this.add.rectangle(0, 0, width + 18, height + 18, palette.accent, 0)
                    .setStrokeStyle(2, palette.accent, 0);
                const frame = this.add.rectangle(0, 0, width, height, palette.fill, 0.96)
                    .setStrokeStyle(2, palette.stroke, 0.72);
                const matte = this.add.rectangle(0, 0, width - 10, height - 10, 0x111317, 0.36)
                    .setStrokeStyle(1, 0xffffff, 0.06);
                const icon = this.add.graphics();

                if (partType === 'gear') {
                    icon.fillStyle(0xc5bda9, 1);
                    icon.fillCircle(0, 0, 15);
                    for (let index = 0; index < 8; index++) {
                        const angle = Phaser.Math.DegToRad(index * 45);
                        icon.fillRect(
                            Math.cos(angle) * 16 - 3,
                            Math.sin(angle) * 16 - 6,
                            6,
                            12,
                        );
                    }
                    icon.fillStyle(0x3d3429, 1);
                    icon.fillCircle(0, 0, 6);
                } else if (partType === 'circuit') {
                    icon.fillStyle(0x48c96b, 1);
                    icon.fillRoundedRect(-16, -26, 32, 52, 8);
                    icon.lineStyle(2, 0xcffff0, 0.9);
                    icon.strokeRoundedRect(-16, -26, 32, 52, 8);
                    icon.lineStyle(2, 0x143221, 0.95);
                    icon.lineBetween(-8, -14, 8, -14);
                    icon.lineBetween(-8, 0, 8, 0);
                    icon.lineBetween(-8, 14, 8, 14);
                    icon.lineStyle(1, 0x0b2015, 0.9);
                    icon.lineBetween(-12, -20, -12, 20);
                    icon.lineBetween(12, -20, 12, 20);
                } else if (partType === 'wire') {
                    icon.lineStyle(4, 0x8cd6ff, 0.92);
                    icon.beginPath();
                    icon.moveTo(-34, 0);
                    icon.lineTo(-12, -12);
                    icon.lineTo(8, 10);
                    icon.lineTo(30, -4);
                    icon.strokePath();
                    icon.fillStyle(0xffb4d2, 1);
                    icon.fillCircle(-34, 0, 5);
                    icon.fillCircle(30, -4, 5);
                } else {
                    icon.fillStyle(0x7fcaff, 1);
                    icon.fillRoundedRect(-20, -12, 40, 24, 6);
                    icon.lineStyle(2, 0xe2f7ff, 0.9);
                    icon.strokeRoundedRect(-20, -12, 40, 24, 6);
                    icon.fillStyle(0x16263d, 1);
                    icon.fillRect(-8, -6, 16, 12);
                    icon.fillStyle(0xb5e6ff, 1);
                    icon.fillRect(10, -4, 6, 8);
                }

                const label = this.add.text(0, (height / 2) - 10, palette.label, {
                    fontFamily: 'Courier New',
                    fontSize: '10px',
                    color: '#f6f2ea',
                    letterSpacing: 1,
                }).setOrigin(0.5);
                const countLabel = this.add.text((width / 2) - 10, -(height / 2) + 10, 'x0', {
                    fontFamily: 'Courier New',
                    fontSize: '14px',
                    color: '#fff5cf',
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5);

                return {
                    nodes: [liftShadow, focusGlow, frame, matte, icon, label, countLabel],
                    frame,
                    focusGlow,
                    liftShadow,
                    countLabel,
                };
            },
        });

        item.homePosition = {
            x: options.x,
            y: options.y,
            angle: options.angle || 0,
        };
        item.container.setVisible(false);
        if (item.inputZone?.input) {
            item.inputZone.input.enabled = false;
        }
        this._umbrellaDeskItemMap.set(partType, item);
        return item;
    }

    _createDeskItem(itemId, options = {}) {
        const width = options.width || 62;
        const height = options.height || 48;
        const savedLayout = GameState.deskPhotoLayout?.[itemId] || null;
        const container = this.add.container(savedLayout?.x ?? options.x, savedLayout?.y ?? options.y)
            .setAngle(savedLayout?.angle ?? (options.angle || 0));
        const builtVisual = options.buildVisual?.() || { nodes: [] };
        const inputZone = this.add.rectangle(0, 0, width + 16, height + 16, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });

        container.add([...(builtVisual.nodes || []), inputZone]);
        container.setSize(width, height);

        const item = {
            id: itemId,
            container,
            inputZone,
            width,
            height,
            selected: false,
            dragging: false,
            allowRotate: options.allowRotate !== false,
            rotationStep: options.rotationStep ?? 12,
            selectedScale: options.selectedScale ?? 1.06,
            dragScale: options.dragScale ?? 1.12,
            onActivate: options.onActivate || null,
            customType: options.customType || null,
            partType: options.partType || null,
            focusGlow: builtVisual.focusGlow || null,
            liftShadow: builtVisual.liftShadow || null,
            frame: builtVisual.frame || null,
            countLabel: builtVisual.countLabel || null,
            homePosition: {
                x: options.x,
                y: options.y,
                angle: options.angle || 0,
            },
        };

        if (!GameState.deskPhotoLayout) {
            GameState.deskPhotoLayout = {};
        }

        inputZone.on('pointerdown', (pointer) => this._beginDeskItemIntent(item, pointer));
        inputZone.on('pointerover', () => {
            if (item.dragging || item.selected) return;
            item.focusGlow?.setAlpha(0.06);
        });
        inputZone.on('pointerout', () => {
            if (item.dragging || item.selected) return;
            item.focusGlow?.setAlpha(0);
        });

        this._deskContainer.add(container);
        this._deskItems.push(item);
        this._refreshDeskItemVisual(item, true);
        this._saveDeskItemLayout(item);
        return item;
    }

    _bringDeskDragLayerToFront() {
        if (!this._hudContainer || !this._deskContainer) return;
        this._hudContainer.bringToTop(this._deskContainer);
    }

    _restoreHudOverlayOrder() {
        if (!this._hudContainer) return;
        if (this._miniMachinePanel) {
            this._hudContainer.bringToTop(this._miniMachinePanel);
        }
    }

    _beginDeskItemIntent(item, pointer) {
        if (!item || this._settingsOpen || this._rulebook?.isVisible()) return;
        if (this._machinePuzzleOverlay?.isVisible() || this._otherPuzzleOverlay?.active) return;

        const startedSelected = this._selectedDeskItem === item;
        this._setDeskItemSelected(item, true);
        this._deskContainer.bringToTop(item.container);
        if (item.customType === 'jester-token' || item.customType === 'purple-circuit' || item.customType === 'umbrella-part') {
            this._bringDeskDragLayerToFront();
        }

        // Convert pointer coordinates to container-local space
        const containerLocalX = pointer.x - this._deskContainer.x;
        const containerLocalY = pointer.y - this._deskContainer.y;

        this._deskItemIntent = {
            item,
            pointerId: pointer.id,
            startX: containerLocalX,
            startY: containerLocalY,
            offsetX: item.container.x - containerLocalX,
            offsetY: item.container.y - containerLocalY,
            startedSelected,
            dragging: false,
        };
    }

    _handleDeskItemPointerMove(pointer) {
        const intent = this._deskItemIntent;
        if (!intent || pointer.id !== intent.pointerId) return;

        // Convert pointer coordinates to container-local space
        const containerLocalX = pointer.x - this._deskContainer.x;
        const containerLocalY = pointer.y - this._deskContainer.y;

        if (!intent.dragging) {
            const distance = Phaser.Math.Distance.Between(containerLocalX, containerLocalY, intent.startX, intent.startY);
            if (distance < 8) return;
            intent.dragging = true;
            intent.item.dragging = true;
            this._refreshDeskItemVisual(intent.item);
        }

        if (intent.item.customType === 'jester-token') {
            this._handleJesterDeskTokenPointerMove(pointer, intent);
            return;
        }

        if (intent.item.customType === 'purple-circuit') {
            this._handlePurpleCircuitDeskTokenPointerMove(pointer, intent);
            return;
        }

        if (intent.item.customType === 'umbrella-part' && this._canDeployUmbrellaDeskPart(intent.item)) {
            this._handleUmbrellaDeskPartPointerMove(pointer, intent);
            return;
        }

        const bounds = this._deskPhotoBounds;
        const nextX = containerLocalX + intent.offsetX;
        const nextY = containerLocalY + intent.offsetY;
        // Clamp to container-local bounds (0 to bounds.width/height)
        const clampedX = Phaser.Math.Clamp(nextX, intent.item.width / 2, bounds.width - (intent.item.width / 2));
        const clampedY = Phaser.Math.Clamp(nextY, intent.item.height / 2, bounds.height - (intent.item.height / 2));
        intent.item.container.setPosition(clampedX, clampedY);
    }

    _handleDeskItemPointerUp(pointer) {
        const intent = this._deskItemIntent;
        if (!intent) return;
        if (pointer?.id !== undefined && pointer.id !== intent.pointerId) return;

        this._deskItemIntent = null;
        if (intent.item.customType === 'jester-token' || intent.item.customType === 'purple-circuit' || intent.item.customType === 'umbrella-part') {
            this._restoreHudOverlayOrder();
        }

        if (intent.item.customType === 'jester-token' && intent.dragging) {
            this._handleJesterDeskTokenPointerUp(pointer, intent);
            return;
        }

        if (intent.item.customType === 'purple-circuit' && intent.dragging) {
            this._handlePurpleCircuitDeskTokenPointerUp(pointer, intent);
            return;
        }

        if (intent.item.customType === 'umbrella-part' && intent.dragging && this._canDeployUmbrellaDeskPart(intent.item)) {
            this._handleUmbrellaDeskPartPointerUp(pointer, intent);
            return;
        }

        if (intent.dragging) {
            intent.item.dragging = false;
            this._refreshDeskItemVisual(intent.item);
            this._saveDeskItemLayout(intent.item);
            return;
        }

        intent.item.dragging = false;
        if (intent.item.onActivate) {
            this._setDeskItemSelected(intent.item, false);
            intent.item.onActivate();
            return;
        }

        if (intent.startedSelected && intent.item.allowRotate) {
            this._rotateDeskItem(intent.item);
            return;
        }

        this._refreshDeskItemVisual(intent.item);
        this._saveDeskItemLayout(intent.item);
    }

    _setDeskItemSelected(item, selected) {
        if (!item) return;

        if (selected && this._selectedDeskItem && this._selectedDeskItem !== item) {
            this._selectedDeskItem.selected = false;
            this._selectedDeskItem.dragging = false;
            this._refreshDeskItemVisual(this._selectedDeskItem);
        }

        item.selected = selected;
        if (!selected) {
            item.dragging = false;
        }
        this._selectedDeskItem = selected ? item : (this._selectedDeskItem === item ? null : this._selectedDeskItem);
        if (selected) this._deskContainer.bringToTop(item.container);
        this._refreshDeskItemVisual(item);
    }

    _refreshDeskItemVisual(item, immediate = false) {
        if (!item) return;

        const targetScale = item.dragging ? item.dragScale : item.selected ? item.selectedScale : 1;
        this.tweens.killTweensOf(item.container);
        if (immediate) {
            item.container.setScale(targetScale);
        } else {
            this.tweens.add({
                targets: item.container,
                scaleX: targetScale,
                scaleY: targetScale,
                duration: 140,
                ease: 'Cubic.Out',
            });
        }

        item.focusGlow?.setAlpha(item.dragging ? 0.22 : item.selected ? 0.12 : 0);
        if (item.frame) {
            item.frame.setStrokeStyle(
                item.frame.lineWidth || 1,
                item.dragging || item.selected ? 0xf3f6dc : 0x5d5247,
                item.dragging ? 0.94 : item.selected ? 0.82 : 0.68,
            );
        }
        if (item.liftShadow) {
            item.liftShadow.setAlpha(item.dragging ? 0.3 : item.selected ? 0.2 : 0.14);
            item.liftShadow.setPosition(item.dragging ? 8 : 6, item.dragging ? 10 : 8);
        }
    }

    _rotateDeskItem(item) {
        if (!item) return;
        this.tweens.killTweensOf(item.container);
        this.tweens.add({
            targets: item.container,
            angle: item.container.angle + item.rotationStep,
            duration: 150,
            ease: 'Cubic.Out',
            onComplete: () => this._saveDeskItemLayout(item),
        });
    }

    _saveDeskItemLayout(item) {
        if (!item) return;
        if (!GameState.deskPhotoLayout) {
            GameState.deskPhotoLayout = {};
        }

        GameState.deskPhotoLayout[item.id] = {
            x: item.container.x,
            y: item.container.y,
            angle: item.container.angle,
        };
    }

    _setDeskItemVisible(item, visible) {
        if (!item) return;

        const isVisible = Boolean(visible);
        item.container.setVisible(isVisible);
        if (item.inputZone?.input) {
            item.inputZone.input.enabled = isVisible;
        }

        if (!isVisible) {
            item.dragging = false;
            this._setDeskItemSelected(item, false);
            item.container
                .setPosition(item.homePosition?.x ?? item.container.x, item.homePosition?.y ?? item.container.y)
                .setAngle(item.homePosition?.angle ?? 0)
                .setScale(1);
        }
    }

    _syncJesterDeskTokenVisibility() {
        const deal = GameState.jesterDeal;
        this._setDeskItemVisible(this._jesterDeskTokenItem, Boolean(deal?.active && deal?.tokenAvailable));
    }

    _syncPurpleCircuitDeskTokenVisibility() {
        this._setDeskItemVisible(this._purpleCircuitDeskItem, GameState.hasSpecialItem('purple_circuit'));
    }

    _syncUmbrellaDeskInventory() {
        const quest = this._getUmbrellaQuest();
        const counts = quest?.collectedParts || {};

        this._umbrellaDeskItemMap.forEach((item, partType) => {
            const count = Math.max(0, Number(counts?.[partType] || 0));
            if (item.countLabel) {
                item.countLabel.setText(`x${count}`);
            }
            this._setDeskItemVisible(item, count > 0);
        });
    }

    _animateUmbrellaDeskPartStash(partType, wasVisible = false) {
        const item = this._umbrellaDeskItemMap.get(partType);
        if (!item) return;

        const targetX = item.container.x;
        const targetY = item.container.y;
        const targetAngle = item.container.angle;

        this.tweens.killTweensOf(item.container);
        if (wasVisible) {
            this._deskContainer.bringToTop(item.container);
            this._refreshDeskItemVisual(item, true);
            this.tweens.add({
                targets: item.container,
                scaleX: 1.14,
                scaleY: 1.14,
                duration: 120,
                yoyo: true,
                ease: 'Cubic.Out',
                onComplete: () => this._refreshDeskItemVisual(item, true),
            });
            item.focusGlow?.setAlpha(0.18);
            this.tweens.add({
                targets: item.focusGlow,
                alpha: 0,
                duration: 220,
                ease: 'Quad.Out',
            });
            return;
        }

        const startWorldX = this._unitContainer?.visible ? this._unitContainer.x : 640;
        const startWorldY = this._unitContainer?.visible ? (this._unitContainer.y + 28) : 312;
        const startX = startWorldX - this._deskContainer.x;
        const startY = startWorldY - this._deskContainer.y;

        this._setDeskItemVisible(item, true);
        this._deskContainer.bringToTop(item.container);
        item.container
            .setPosition(startX, startY)
            .setAngle(targetAngle)
            .setScale(0.68)
            .setAlpha(0.18);
        item.focusGlow?.setAlpha(0.24);
        item.liftShadow?.setAlpha(0.3);

        this.tweens.add({
            targets: item.container,
            x: targetX,
            y: targetY,
            alpha: 1,
            scaleX: 1,
            scaleY: 1,
            duration: 240,
            ease: 'Cubic.Out',
            onComplete: () => this._refreshDeskItemVisual(item, true),
        });
        if (item.focusGlow) {
            this.tweens.add({
                targets: item.focusGlow,
                alpha: 0,
                duration: 260,
                ease: 'Quad.Out',
            });
        }
    }

    _canDeployUmbrellaDeskPart(item) {
        if (!item?.partType) return false;
        if (!this._isUmbrellaAssemblyMachine(this._currentMachineVariant)) return false;
        return this._getUmbrellaPartInventoryCount(item.partType) > 0;
    }

    _handleUmbrellaDeskPartPointerMove(pointer, intent) {
        const item = intent.item;
        const containerLocalX = pointer.x - this._deskContainer.x;
        const containerLocalY = pointer.y - this._deskContainer.y;
        const nextX = Phaser.Math.Clamp(containerLocalX + intent.offsetX, 40 - this._deskContainer.x, 1240 - this._deskContainer.x);
        const nextY = Phaser.Math.Clamp(containerLocalY + intent.offsetY, 70 - this._deskContainer.y, 690 - this._deskContainer.y);
        const liftLine = this._deskPhotoBounds?.y ?? 0;
        const liftProgress = Phaser.Math.Clamp((liftLine - nextY) / 220, 0, 1);
        const dragScale = Phaser.Math.Linear(0.94, 1.28, liftProgress);

        item.container.setPosition(nextX, nextY);
        item.container.setScale(dragScale);
        item.focusGlow?.setAlpha(0.1 + (liftProgress * 0.16));
        item.liftShadow?.setAlpha(0.22 + (liftProgress * 0.08));
    }

    _handleUmbrellaDeskPartPointerUp(pointer, intent) {
        const item = intent.item;
        const expectedTarget = UMBRELLA_PART_PORTS[item.partType] || null;
        const dropTarget = this._getMiniPortDropTarget(pointer?.x ?? (item.container.x + this._deskContainer.x), pointer?.y ?? (item.container.y + this._deskContainer.y));

        item.dragging = false;

        if (dropTarget && dropTarget === expectedTarget && this._applyUmbrellaPartToCurrentMachine(item.partType)) {
            this._setDeskItemSelected(item, false);
            this._returnDeskItemToHome(item);
            return;
        }

        const wrongPortMessage = dropTarget && dropTarget !== expectedTarget
            ? `WRONG PORT // ${String(expectedTarget || '').toUpperCase()} ONLY`
            : `DROP ${String(item.partType || '').toUpperCase()} ON ${String(expectedTarget || '').toUpperCase()}`;
        this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.5 });
        this._showFeedback(wrongPortMessage, '#ff7f73');
        this._returnDeskItemToHome(item, { shake: true });
    }

    _handleJesterDeskTokenPointerMove(pointer, intent) {
        const item = intent.item;
        const containerLocalX = pointer.x - this._deskContainer.x;
        const containerLocalY = pointer.y - this._deskContainer.y;
        const nextX = Phaser.Math.Clamp(containerLocalX + intent.offsetX, 40 - this._deskContainer.x, 1240 - this._deskContainer.x);
        const nextY = Phaser.Math.Clamp(containerLocalY + intent.offsetY, 70 - this._deskContainer.y, 690 - this._deskContainer.y);
        const liftLine = this._deskPhotoBounds?.y ?? 0;
        const liftProgress = Phaser.Math.Clamp((liftLine - nextY) / 220, 0, 1);
        const dragScale = Phaser.Math.Linear(0.84, 1.42, liftProgress);

        item.container.setPosition(nextX, nextY);
        item.container.setScale(dragScale);
        item.focusGlow?.setAlpha(0.14 + (liftProgress * 0.16));
        item.liftShadow?.setAlpha(0.22 + (liftProgress * 0.08));
    }

    _handlePurpleCircuitDeskTokenPointerMove(pointer, intent) {
        const item = intent.item;
        const containerLocalX = pointer.x - this._deskContainer.x;
        const containerLocalY = pointer.y - this._deskContainer.y;
        const nextX = Phaser.Math.Clamp(containerLocalX + intent.offsetX, 40 - this._deskContainer.x, 1240 - this._deskContainer.x);
        const nextY = Phaser.Math.Clamp(containerLocalY + intent.offsetY, 70 - this._deskContainer.y, 690 - this._deskContainer.y);
        const liftLine = this._deskPhotoBounds?.y ?? 0;
        const liftProgress = Phaser.Math.Clamp((liftLine - nextY) / 220, 0, 1);
        const dragScale = Phaser.Math.Linear(0.84, 1.42, liftProgress);

        item.container.setPosition(nextX, nextY);
        item.container.setScale(dragScale);
        item.focusGlow?.setAlpha(0.14 + (liftProgress * 0.18));
        item.liftShadow?.setAlpha(0.22 + (liftProgress * 0.08));
    }

    _getMiniPortDropTarget(worldX, worldY) {
        if (!this._miniMachinePanelVisible || !this._currentMachineVariant) return null;

        const containsPoint = (port) => {
            const bounds = port?.hit?.getBounds?.();
            return bounds ? Phaser.Geom.Rectangle.Contains(bounds, worldX, worldY) : false;
        };

        if (containsPoint(this._miniGridPort)) return 'grid';
        if (containsPoint(this._miniFlowPort)) return 'flow';
        if (containsPoint(this._miniGearPort)) return 'gear';
        if (containsPoint(this._miniCodePort)) return 'code';
        return null;
    }

    _returnDeskItemToHome(item, { shake = false } = {}) {
        if (!item) return;

        item.dragging = false;
        this._setDeskItemSelected(item, false);
        this._refreshDeskItemVisual(item, true);
        this.tweens.killTweensOf(item.container);

        const homeX = item.homePosition?.x ?? item.container.x;
        const homeY = item.homePosition?.y ?? item.container.y;
        const homeAngle = item.homePosition?.angle ?? 0;

        if (shake) {
            this.tweens.add({
                targets: item.container,
                x: homeX + 8,
                duration: 55,
                yoyo: true,
                repeat: 3,
                ease: 'Sine.InOut',
                onComplete: () => {
                    item.container.setPosition(homeX, homeY).setAngle(homeAngle).setScale(1);
                },
            });
            return;
        }

        this.tweens.add({
            targets: item.container,
            x: homeX,
            y: homeY,
            angle: homeAngle,
            scaleX: 1,
            scaleY: 1,
            duration: 170,
            ease: 'Back.Out',
        });
    }

    _applyJesterTokenToCurrentMachine() {
        const deal = GameState.jesterDeal;
        const machineVariant = this._currentMachineVariant;
        if (!deal?.active || !deal?.tokenAvailable || !machineVariant?.puzzleState) return false;
        if (machineVariant._jesterTokenInjected) return false;

        const clownDominoId = `clown_domino_${this._currentCase?.id || machineVariant.machineId}`;
        machineVariant.puzzleState.injectDomino({
            id: clownDominoId,
            firstOptionAmount: 0,
            secondOptionAmount: 0,
            variant: 'clown',
        });
        machineVariant._jesterTokenInjected = true;
        machineVariant._jesterQuestArmed = true;
        machineVariant._jesterClownDominoId = clownDominoId;

        GameState.jesterDeal = {
            ...deal,
            active: true,
            tokenAvailable: false,
            armedCaseId: this._currentCase?.id || null,
            armedMachineName: machineVariant.name,
            clownDominoId,
            rewardGranted: false,
            failed: false,
        };

        this._syncJesterDeskTokenVisibility();
        this._handlePuzzleStateChanged(machineVariant, machineVariant.puzzleState);
        this._setPhoneInfoNote('Clown circuit loaded. Open GRID and place the red domino anywhere to poison the board.', 'CLOWN TOKEN');
        this._showFeedback('CLOWN DOMINO INJECTED // OPEN GRID', '#ff8f86');
        this._reactToUmbrellaSpecialCircuitLoad(machineVariant);
        this._openMachinePuzzle();
        return true;
    }

    _applyPurpleCircuitToCurrentMachine() {
        const purpleCircuit = GameState.getSpecialItem('purple_circuit');
        const machineVariant = this._currentMachineVariant;
        if (!purpleCircuit || !machineVariant?.puzzleState) return false;
        if (machineVariant._purpleCircuitInjected) return false;

        const purpleDominoId = `purple_circuit_${this._currentCase?.id || machineVariant.machineId}`;
        machineVariant.puzzleState.injectDomino({
            id: purpleDominoId,
            firstOptionAmount: 4,
            secondOptionAmount: 4,
            variant: 'purple',
        });
        machineVariant._purpleCircuitInjected = true;
        machineVariant._purpleCircuitDominoId = purpleDominoId;

        GameState.removeSpecialItem('purple_circuit');

        this._syncPurpleCircuitDeskTokenVisibility();
        this._handlePuzzleStateChanged(machineVariant, machineVariant.puzzleState);
        this._setPhoneInfoNote('Purple circuit loaded. Open GRID and place the wildcard domino anywhere to overpower the board.', 'PURPLE CIRCUIT');
        this._showFeedback('PURPLE CIRCUIT INJECTED // OPEN GRID', '#cc95ff');
        this._reactToUmbrellaSpecialCircuitLoad(machineVariant);
        this._openMachinePuzzle();
        return true;
    }

    _handleJesterDeskTokenPointerUp(pointer, intent) {
        const item = intent.item;
        item.dragging = false;

        const worldX = pointer?.x ?? (item.container.x + this._deskContainer.x);
        const worldY = pointer?.y ?? (item.container.y + this._deskContainer.y);
        const dropTarget = this._getMiniPortDropTarget(worldX, worldY);

        if (dropTarget === 'grid' && this._applyJesterTokenToCurrentMachine()) {
            this._setDeskItemSelected(item, false);
            return;
        }

        const message = dropTarget && dropTarget !== 'grid'
            ? 'WRONG PORT // USE GRID'
            : 'DROP TOKEN ON GRID PORT';
        this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.5 });
        this._showFeedback(message, '#ff7f73');
        this._returnDeskItemToHome(item, { shake: true });
    }

    _handlePurpleCircuitDeskTokenPointerUp(pointer, intent) {
        const item = intent.item;
        item.dragging = false;

        const worldX = pointer?.x ?? (item.container.x + this._deskContainer.x);
        const worldY = pointer?.y ?? (item.container.y + this._deskContainer.y);
        const dropTarget = this._getMiniPortDropTarget(worldX, worldY);

        if (dropTarget === 'grid' && this._applyPurpleCircuitToCurrentMachine()) {
            this._setDeskItemSelected(item, false);
            return;
        }

        const message = dropTarget && dropTarget !== 'grid'
            ? 'WRONG PORT // USE GRID'
            : 'DROP CIRCUIT ON GRID PORT';
        this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.5 });
        this._showFeedback(message, '#ff7f73');
        this._returnDeskItemToHome(item, { shake: true });
    }

    _updateDeskDateText() {
        if (!this._deskDateText) return;
        this._deskDateText.setText(GameState.formatCurrentShiftDate());
    }

    _buildDisabledInspectionContainer() {
        this._inspectionContainer = this.add.container(0, 0).setVisible(false);
        this._toolBtns = {};
        this._zoneBtns = {};
        this._inspUnitName = null;
        this._inspUnitDesc = null;
        this._inspUnitSprite = null;
        this._logContainer = null;
        this._logPanelH = 0;
        this._logContainerBaseY = 0;
    }

    _buildMiniMachinePanel() {
        const panelWidth = 446;
        const panelHeight = 232;
        const hiddenX = -panelWidth - 48;
        const hiddenY = 42;
        const screenLeft = 2;
        const screenTop = 5;
        const screenWidth = 406;
        const screenHeight = 158;

        this._miniMachinePanelLegacySize = { width: 248, height: 188 };
        this._miniMachinePanelSize = { width: panelWidth, height: panelHeight };
        this._miniMachineScreenRect = { left: screenLeft, top: screenTop, width: screenWidth, height: screenHeight };
        this._miniMachinePanelHiddenPos = { x: hiddenX, y: hiddenY };
        this._miniMachinePanelShownPos = { x: 22, y: 42 };
        this._miniMachinePanel = this.add.container(hiddenX, hiddenY)
            .setDepth(214)
            .setVisible(false)
            .setAlpha(0);

        const outer = this.add.rectangle(panelWidth / 2, panelHeight / 2, panelWidth, panelHeight, 0x585245, 0.94)
            .setStrokeStyle(2, 0x8f8875, 0.95);
        const inner = this.add.rectangle(panelWidth / 2, panelHeight / 2, 414, 198, 0x2c2f29, 0.96)
            .setStrokeStyle(1, 0xb3a779, 0.34);
        const screen = this.add.rectangle(panelWidth / 2, 128, 406, 158, 0x18231f, 0.98)
            .setStrokeStyle(1, 0x89805d, 0.55);
        const screenGlow = this.add.rectangle(panelWidth / 2, 128, 396, 148, 0x7ad8d4, 0.08)
            .setStrokeStyle(1, 0xbadcc7, 0.14);
        const screwTopLeft = this.add.circle(20, 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwTopRight = this.add.circle(panelWidth - 20, 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwBottomLeft = this.add.circle(20, panelHeight - 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwBottomRight = this.add.circle(panelWidth - 20, panelHeight - 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);

        this._miniMachinePanelTitle = this.add.text(22, 16, 'MACHINE PORTS', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#d6cfaa',
            letterSpacing: 2,
        });
        this._miniPuzzleStatusText = this.add.text(22, 36, 'CLICK A UNIT TO INSPECT', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#9ab894',
            wordWrap: { width: 360 },
        });
        this._miniMachineHintText = this.add.text(22, panelHeight - 16, 'CLICK GRID, FLOW, GEAR, OR CODE PORT', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#c8cf9f',
            letterSpacing: 1,
        });

        this._miniMachineImage = this.add.image(204, 132, 'unit_placeholder').setOrigin(0.5);
        this._miniMachineImage.setAlpha(0.98);
        this._miniMachineShadow = this.add.ellipse(204, 166, 210, 44, 0x000000, 0.14);

        const screenMaskGraphics = this.make.graphics({ x: hiddenX, y: hiddenY, add: false });
        screenMaskGraphics.fillStyle(0xffffff, 1);
        screenMaskGraphics.fillRoundedRect(screenLeft, screenTop, screenWidth, screenHeight, 18);
        this._miniMachineScreenMaskSource = screenMaskGraphics;

        this._miniPuzzleLinkGfx = this.add.graphics();
        this._miniPuzzleGfx = this.add.graphics();
        this._miniPuzzleLabelContainer = this.add.container(0, 0);
        this._miniFlowGfx = this.add.graphics();
        this._miniFlowLabelContainer = this.add.container(0, 0);
        this._miniGearGfx = this.add.graphics();
        this._miniGearLabelContainer = this.add.container(0, 0);
        this._miniCodeGfx = this.add.graphics();
        this._miniCodeLabelContainer = this.add.container(0, 0);

        const gridPortFrame = this.add.rectangle(92, 102, 50, 54, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const gridPortHit = this.add.rectangle(92, 102, 50, 54, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const gridPortLabel = this.add.text(54, 138, 'GRID', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#d7e7ff',
            letterSpacing: 1,
        });

        const flowPortFrame = this.add.rectangle(400, 100, 60, 54, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const flowPortHit = this.add.rectangle(400, 100, 60, 54, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const flowPortLabel = this.add.text(256, 162, 'FLOW', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#d7e7ff',
            letterSpacing: 1,
        });

        const codePortFrame = this.add.rectangle(290, 78, 60, 42, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const codePortHit = this.add.rectangle(290, 78, 60, 42, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const codePortLabel = this.add.text(232, 104, 'CODE', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#d7e7ff',
            letterSpacing: 1,
        });

        const gearPortFrame = this.add.rectangle(196, 180, 116, 42, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const gearPortHit = this.add.rectangle(196, 180, 116, 42, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const gearPortLabel = this.add.text(150, 204, 'GEAR', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#d7e7ff',
            letterSpacing: 1,
        });

        gridPortHit.on('pointerover', () => this._setMiniMachinePanelHover('grid', true));
        gridPortHit.on('pointerout', () => this._setMiniMachinePanelHover('grid', false));
        gridPortHit.on('pointerdown', () => {
            if (!this._currentMachineVariant || !this._miniMachinePanelVisible) return;
            this._playMiniMachinePortSound('grid');
            this._openMachinePuzzle();
        });

        flowPortHit.on('pointerover', () => this._setMiniMachinePanelHover('flow', true));
        flowPortHit.on('pointerout', () => this._setMiniMachinePanelHover('flow', false));
        flowPortHit.on('pointerdown', () => {
            if (!this._currentMachineVariant || !this._miniMachinePanelVisible) return;
            this._playMiniMachinePortSound('flow');
            this._openOtherPuzzle();
        });

        codePortHit.on('pointerover', () => this._setMiniMachinePanelHover('code', true));
        codePortHit.on('pointerout', () => this._setMiniMachinePanelHover('code', false));
        codePortHit.on('pointerdown', () => {
            if (!this._currentMachineVariant || !this._miniMachinePanelVisible) return;
            this._playMiniMachinePortSound('code');
            this._openDebugPuzzle();
        });

        gearPortHit.on('pointerover', () => this._setMiniMachinePanelHover('gear', true));
        gearPortHit.on('pointerout', () => this._setMiniMachinePanelHover('gear', false));
        gearPortHit.on('pointerdown', () => {
            if (!this._currentMachineVariant || !this._miniMachinePanelVisible) return;
            this._playMiniMachinePortSound('gear');
            this._openGearPuzzle();
        });

        this._miniGridPort = { frame: gridPortFrame, hit: gridPortHit, label: gridPortLabel };
        this._miniFlowPort = { frame: flowPortFrame, hit: flowPortHit, label: flowPortLabel };
        this._miniCodePort = { frame: codePortFrame, hit: codePortHit, label: codePortLabel };
        this._miniGearPort = { frame: gearPortFrame, hit: gearPortHit, label: gearPortLabel };

        this._miniMachinePanel.add([
            outer,
            inner,
            screen,
            screenGlow,
            screwTopLeft,
            screwTopRight,
            screwBottomLeft,
            screwBottomRight,
            this._miniMachinePanelTitle,
            this._miniPuzzleStatusText,
            this._miniMachineHintText,
            this._miniMachineShadow,
            this._miniMachineImage,
            gridPortFrame,
            this._miniPuzzleLinkGfx,
            this._miniPuzzleGfx,
            this._miniPuzzleLabelContainer,
            gridPortHit,
            gridPortLabel,
            flowPortFrame,
            this._miniFlowGfx,
            this._miniFlowLabelContainer,
            flowPortHit,
            flowPortLabel,
            codePortFrame,
            this._miniCodeGfx,
            this._miniCodeLabelContainer,
            codePortHit,
            codePortLabel,
            gearPortFrame,
            this._miniGearGfx,
            this._miniGearLabelContainer,
            gearPortHit,
            gearPortLabel,
        ]);
        this._hudContainer.add(this._miniMachinePanel);
    }

    _setMiniMachinePanelHover(portKey, isHovering) {
        if (isHovering) {
            this._miniMachinePanelHoverPort = portKey;
        } else if (this._miniMachinePanelHoverPort === portKey) {
            this._miniMachinePanelHoverPort = null;
        }

        this._refreshOtherPuzzleButton();
    }

    _playMiniMachinePortSound(portKey) {
        const preferredAsset = portKey === 'flow'
            ? SOUND_ASSETS.fuseRotate
            : (portKey === 'gear'
                ? SOUND_ASSETS.circuitLock
                : (portKey === 'code' ? SOUND_ASSETS.notificationAlert : SOUND_ASSETS.inspectionReveal));
        const fallbackAsset = portKey === 'gear'
            ? SOUND_ASSETS.inspectionReveal
            : (portKey === 'flow'
                ? SOUND_ASSETS.inspectionReveal
                : (portKey === 'code' ? SOUND_ASSETS.inspectionReveal : SOUND_ASSETS.fuseRotate));
        const soundAsset = this.cache.audio.has(preferredAsset.key)
            ? preferredAsset
            : (this.cache.audio.has(fallbackAsset.key) ? fallbackAsset : null);

        if (!soundAsset) return;

        this._playOneShot(soundAsset, {
            volume: portKey === 'flow'
                ? SOUND_VOLUMES.puzzleRotate
                : (portKey === 'gear'
                    ? SOUND_VOLUMES.puzzleLock
                    : (portKey === 'code' ? SOUND_VOLUMES.notification : SOUND_VOLUMES.reveal)),
        });
    }

    _showMiniMachinePanel() {
        if (!this._currentMachineVariant || !this._miniMachinePanel) return;

        this._syncMiniMachinePanel(true);
        this._miniMachinePanelVisible = true;
        this._miniMachinePanel.setVisible(true);
        this.tweens.killTweensOf(this._miniMachinePanel);
        this.tweens.killTweensOf(this._miniMachineScreenMaskSource);
        this.tweens.add({
            targets: [this._miniMachinePanel, this._miniMachineScreenMaskSource],
            x: this._miniMachinePanelShownPos.x,
            y: this._miniMachinePanelShownPos.y,
            alpha: 1,
            duration: 220,
            ease: 'Cubic.Out',
        });
    }

    _hideMiniMachinePanel(immediate = false) {
        if (!this._miniMachinePanel) return;

        this._miniMachinePanelVisible = false;
        this._miniMachinePanelHoverPort = null;
        this.tweens.killTweensOf(this._miniMachinePanel);
        this.tweens.killTweensOf(this._miniMachineScreenMaskSource);

        if (immediate || !this._miniMachinePanel.visible) {
            this._miniMachinePanel
                .setPosition(this._miniMachinePanelHiddenPos.x, this._miniMachinePanelHiddenPos.y)
                .setAlpha(0)
                .setVisible(false);
            this._miniMachineScreenMaskSource?.setPosition(this._miniMachinePanelHiddenPos.x, this._miniMachinePanelHiddenPos.y);
            return;
        }

        this.tweens.add({
            targets: [this._miniMachinePanel, this._miniMachineScreenMaskSource],
            x: this._miniMachinePanelHiddenPos.x,
            y: this._miniMachinePanelHiddenPos.y,
            alpha: 0,
            duration: 180,
            ease: 'Cubic.In',
            onComplete: () => this._miniMachinePanel.setVisible(false),
        });
    }

    _revealMachineMiniPanel() {
        if (!this._currentMachineVariant) return;
        this._showMiniMachinePanel();
    }

    _buildPhonePanel() {
        const panelX = 870;
        const panelY = 50;
        const frameWidth = 408;
        const frameHeight = 216;
        const screenX = 22;
        const screenY = 20;
        const screenWidth = 278;
        const screenHeight = 154;

        this._phonePanel = this.add.container(panelX, panelY).setDepth(260).setVisible(true);

        const frame = this.add.rectangle(0, 0, frameWidth, frameHeight, 0x334c5d, 1).setOrigin(0)
            .setStrokeStyle(4, 0x82dffd, 0.9);
        const inner = this.add.rectangle(12, 12, frameWidth - 24, frameHeight - 24, 0x11202a, 1).setOrigin(0)
            .setStrokeStyle(2, 0x4ba7c4, 0.9);
        const screen = this.add.rectangle(screenX, screenY, screenWidth, screenHeight, 0x72d3dd, 0.84).setOrigin(0)
            .setStrokeStyle(1, 0xc9ffff, 0.25);
        const gloss = this.add.rectangle(screenX + (screenWidth / 2), screenY + 30, screenWidth - 10, 46, 0xffffff, 0.08).setOrigin(0.5);
        const tray = this.add.rectangle(frameWidth / 2, frameHeight - 15, frameWidth - 38, 10, 0x1b1812, 1).setOrigin(0.5);
        const messageBoardShadow = this.add.rectangle(146, 98, 232, 88, 0x000000, 0.12)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0x163136, 0.16);
        const messageBoard = this.add.rectangle(146, 98, 228, 84, 0xf3ffff, 0.22)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0x17363d, 0.28);
        this._phoneMessageBoardShadow = messageBoardShadow;
        this._phoneMessageBoard = messageBoard;

        const scanlines = this.add.graphics();
        scanlines.fillStyle(0xffffff, 0.07);
        for (let offset = 0; offset < screenHeight; offset += 14) {
            scanlines.fillRect(screenX, screenY + offset, screenWidth, 6);
        }

        this._phoneHeaderText = this.add.text(34, 30, 'FACTORY LINK', {
            fontFamily: 'Arial Black', fontSize: '16px', color: '#0c171b',
        });
        this._phoneBodyText = this.add.text(36, 60, '', {
            fontFamily: 'Arial', fontSize: '14px', color: '#101010',
            wordWrap: { width: 218 }, lineSpacing: 6,
        });
        this._phoneStatusText = this.add.text(32, 146, 'CHANNEL IDLE', {
            fontFamily: 'Arial Black', fontSize: '10px', color: '#15313a',
            wordWrap: { width: 172 },
        });

        this._phoneBodyViewport = { x: 36, y: 58, width: 218, height: 78 };
        this._phoneScrollTrackTop = this._phoneBodyViewport.y + 2;
        this._phoneScrollTrackHeight = this._phoneBodyViewport.height - 4;

        this._phoneBodyScrollZone = this.add.rectangle(
            this._phoneBodyViewport.x + (this._phoneBodyViewport.width / 2),
            this._phoneBodyViewport.y + (this._phoneBodyViewport.height / 2),
            this._phoneBodyViewport.width + 12,
            this._phoneBodyViewport.height,
            0xffffff,
            0.001,
        ).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this._phoneBodyScrollZone.on('pointerover', () => { this._phoneScrollHover = true; });
        this._phoneBodyScrollZone.on('pointerout', () => { this._phoneScrollHover = false; });
        this._phoneScrollTrack = this.add.rectangle(264, this._phoneScrollTrackTop, 5, this._phoneScrollTrackHeight, 0x3d7c88, 0.22)
            .setOrigin(0.5, 0);
        this._phoneScrollThumb = this.add.rectangle(264, this._phoneScrollTrackTop, 5, 20, 0x14313a, 0.56)
            .setOrigin(0.5, 0)
            .setStrokeStyle(1, 0xe8ffff, 0.24);
        this.input.on('wheel', this._handlePhoneWheel, this);

        this._settingsButtonBg = this.add.rectangle(366, 46, 40, 42, 0x314250, 1)
            .setStrokeStyle(2, 0x6db7e1, 0.8)
            .setInteractive({ useHandCursor: true });
        this._settingsButtonLabel = this.add.text(366, 46, '⚙', {
            fontFamily: 'Arial Black', fontSize: '19px', color: '#dff6ff',
        }).setOrigin(0.5);

        this._settingsButtonBg.on('pointerover', () => {
            this._settingsButtonBg.setScale(1.06);
            this._settingsButtonLabel.setScale(1.06);
            this._settingsButtonLabel.setAngle(18);
        });
        this._settingsButtonBg.on('pointerout', () => {
            this._settingsButtonBg.setScale(1);
            this._settingsButtonLabel.setScale(1);
            this._settingsButtonLabel.setAngle(0);
        });
        this._settingsButtonBg.on('pointerdown', () => this._toggleSettingsOverlay());

        const accept = this._createPhoneButton(366, 96, '✓', 0x184a24, 0x22f06e, '#d8ffe6', '#ffffff', {
            width: 44,
            height: 48,
            fontSize: '26px',
            glowColor: 0xffffff,
        });
        const reject = this._createPhoneButton(366, 148, 'X', 0x4b1f1b, 0xff5f52, '#ffd7d4', '#4a0605', {
            width: 42,
            height: 46,
            fontSize: '23px',
            glowColor: 0xffdddd,
        });
        const infoButton = this._createPhoneChannelButton(214, 160, 'INFO', 30);
        const chatButton = this._createPhoneChannelButton(246, 160, 'CHAT', 30);
        const alertButton = this._createPhoneChannelButton(274, 160, '!', 18);

        accept.bg.on('pointerover', () => this._setPhoneButtonHover(accept, true));
        accept.bg.on('pointerout', () => this._setPhoneButtonHover(accept, false));
        accept.bg.on('pointerdown', () => this._onPhoneChoice('accept'));

        reject.bg.on('pointerover', () => this._setPhoneButtonHover(reject, true));
        reject.bg.on('pointerout', () => this._setPhoneButtonHover(reject, false));
        reject.bg.on('pointerdown', () => this._onPhoneChoice('reject'));

        [infoButton, chatButton, alertButton].forEach((button) => {
            button.bg.on('pointerover', () => {
                button.glow.setScale(1.08);
                button.bg.setScale(1.06);
                button.label.setScale(1.04);
            });
            button.bg.on('pointerout', () => {
                button.glow.setScale(1);
                button.bg.setScale(1);
                button.label.setScale(1);
            });
        });
        infoButton.bg.on('pointerdown', () => this._setPhoneView('info'));
        chatButton.bg.on('pointerdown', () => this._setPhoneView('chat'));
        alertButton.bg.on('pointerdown', () => this._setPhoneView('notifications', { clearUnread: true }));

        this._phonePanel.add([
            frame,
            inner,
            screen,
            gloss,
            tray,
            messageBoardShadow,
            messageBoard,
            scanlines,
            this._phoneBodyText,
            this._phoneBodyScrollZone,
            this._phoneScrollTrack,
            this._phoneScrollThumb,
            // header, status, and buttons rendered after body so they paint on top
            this._phoneHeaderText,
            this._phoneStatusText,
            infoButton.glow,
            infoButton.bg,
            infoButton.label,
            chatButton.glow,
            chatButton.bg,
            chatButton.label,
            alertButton.glow,
            alertButton.bg,
            alertButton.label,
            this._settingsButtonBg,
            this._settingsButtonLabel,
            accept.glow,
            accept.bg,
            accept.label,
            reject.glow,
            reject.bg,
            reject.label,
        ]);

        this._phoneButtons = { accept, reject };
        this._phoneViewButtons = {
            info: infoButton,
            chat: chatButton,
            alert: alertButton,
        };
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._refreshPhoneInfoBoard();
        this._refreshPhoneNotificationBoard();
        this._setPhoneView('info');
    }

    _getPhoneViewState(viewMode = this._phoneViewMode) {
        return this._phoneViews?.[viewMode] || this._phoneViews.chat;
    }

    _persistPhoneViewScroll(viewMode = this._phoneViewMode) {
        const view = this._getPhoneViewState(viewMode);
        view.scrollOffset = this._phoneBodyScrollOffset;
        view.stickToBottom = this._phoneStickToBottom;
    }

    _restorePhoneViewScroll(viewMode = this._phoneViewMode) {
        const view = this._getPhoneViewState(viewMode);
        this._phoneBodyScrollOffset = view.scrollOffset || 0;
        this._phoneStickToBottom = view.stickToBottom !== false;
    }

    _refreshPhonePanelDisplay() {
        const view = this._getPhoneViewState();
        if (!view || !this._phoneHeaderText || !this._phoneBodyText || !this._phoneStatusText) return;

        this._phoneHeaderText.setText(view.header || '');
        this._phoneBodyText.setText(view.body || '');
        this._phoneStatusText.setText(view.status || '');
        this._restorePhoneViewScroll();
        this._syncPhoneBodyLayout();
        this._refreshPhoneChannelButtons();
    }

    _setPhoneView(viewMode, { clearUnread = false } = {}) {
        if (!this._phoneViews?.[viewMode]) return;

        this._persistPhoneViewScroll();
        this._phoneViewMode = viewMode;
        if (viewMode === 'notifications' && clearUnread) {
            this._markPhoneNotificationsRead();
        }

        this._phonePanel?.setVisible(true);
        this._phonePanel?.setAlpha(1);
        this._refreshPhonePanelDisplay();
    }

    _syncPhoneBodyLayout() {
        if (!this._phoneBodyText || !this._phoneBodyViewport) return;

        const overflow = Math.max(0, this._phoneBodyText.height - this._phoneBodyViewport.height);
        if (this._phoneStickToBottom || this._phoneBodyScrollOffset > overflow) {
            this._phoneBodyScrollOffset = overflow;
        }

        this._phoneBodyText.setPosition(
            this._phoneBodyViewport.x,
            this._phoneBodyViewport.y - this._phoneBodyScrollOffset,
        );
        const res = this._phoneBodyText.resolution || 1;
        this._phoneBodyText.setCrop(
            0,
            this._phoneBodyScrollOffset * res,
            this._phoneBodyViewport.width * res,
            this._phoneBodyViewport.height * res
        );

        if (!this._phoneScrollTrack || !this._phoneScrollThumb) return;
        if (overflow <= 0) {
            this._phoneScrollTrack.setVisible(false);
            this._phoneScrollThumb.setVisible(false);
            return;
        }

        this._phoneScrollTrack.setVisible(true);
        this._phoneScrollThumb.setVisible(true);
        const trackTop = this._phoneScrollTrackTop ?? this._phoneBodyViewport.y;
        const trackHeight = this._phoneScrollTrackHeight || this._phoneBodyViewport.height;
        const thumbHeight = Math.max(14, (this._phoneBodyViewport.height / this._phoneBodyText.height) * trackHeight);
        const travel = trackHeight - thumbHeight;
        const progress = overflow <= 0 ? 0 : this._phoneBodyScrollOffset / overflow;
        this._phoneScrollThumb.height = thumbHeight;
        this._phoneScrollThumb.y = trackTop + (travel * progress);
        this._persistPhoneViewScroll();
    }

    _handlePhoneWheel(_pointer, _gameObjects, _deltaX, deltaY) {
        if (!this._phoneScrollHover || !this._phonePanel?.visible || !this._phoneBodyText || !this._phoneBodyViewport) return;

        const overflow = Math.max(0, this._phoneBodyText.height - this._phoneBodyViewport.height);
        if (overflow <= 0) return;

        this._phoneStickToBottom = false;
        this._phoneBodyScrollOffset = Phaser.Math.Clamp(this._phoneBodyScrollOffset + (deltaY * 0.45), 0, overflow);
        if (this._phoneBodyScrollOffset >= overflow - 1) {
            this._phoneStickToBottom = true;
        }
        this._syncPhoneBodyLayout();
    }

    _createPhoneChannelButton(x, y, text, width = 28) {
        const glow = this.add.rectangle(x, y, width + 10, 20, 0xffffff, 0)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0xffffff, 0);
        const bg = this.add.rectangle(x, y, width, 16, 0x18343a, 0.9)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0xd7fdff, 0.22)
            .setInteractive({ useHandCursor: true });
        const label = this.add.text(x, y, text, {
            fontFamily: 'Arial Black', fontSize: '7px', color: '#d7fdff',
        }).setOrigin(0.5);

        return { glow, bg, label, width, pulseTween: null };
    }

    _refreshPhoneChannelButtons() {
        const refresh = (button, { active = false, unread = false } = {}) => {
            if (!button) return;

            if (button.pulseTween) {
                button.pulseTween.stop();
                button.pulseTween = null;
            }

            let fill = 0x18343a;
            let stroke = 0xd7fdff;
            let strokeAlpha = 0.18;
            let textColor = '#d7fdff';
            let glowAlpha = 0;

            if (active) {
                fill = 0xf4ffff;
                stroke = 0xffffff;
                strokeAlpha = 0.65;
                textColor = '#0d2328';
                glowAlpha = 0.18;
            }

            if (unread) {
                fill = 0xffd9bc;
                stroke = 0xff875a;
                strokeAlpha = 0.95;
                textColor = '#5a1f00';
                glowAlpha = 0.36;
                button.pulseTween = this.tweens.add({
                    targets: button.glow,
                    alpha: 0.55,
                    duration: 280,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.InOut',
                });
            }

            button.glow
                .setFillStyle(0xffffff, 0.08)
                .setStrokeStyle(1, stroke, glowAlpha > 0 ? 0.9 : 0)
                .setAlpha(glowAlpha);
            button.bg.setFillStyle(fill, 0.95);
            button.bg.setStrokeStyle(1, stroke, strokeAlpha);
            button.label.setColor(textColor);
        };

        refresh(this._phoneViewButtons?.info, { active: this._phoneViewMode === 'info' });
        refresh(this._phoneViewButtons?.chat, { active: this._phoneViewMode === 'chat' });
        refresh(this._phoneViewButtons?.alert, {
            active: this._phoneViewMode === 'notifications' && this._phoneUnreadNotifications === 0,
            unread: this._phoneUnreadNotifications > 0,
        });
    }

    _createPhoneButton(x, y, text, inactiveFill, activeFill, inactiveText, activeText, options = {}) {
        const width = options.width || 36;
        const height = options.height || 42;
        const fontSize = options.fontSize || (text === 'OK' ? '15px' : '22px');
        const glow = this.add.rectangle(x, y, width + 10, height + 10, 0xffffff, 0)
            .setOrigin(0.5)
            .setStrokeStyle(2, options.glowColor || 0xffffff, 0);
        const bg = this.add.rectangle(x, y, width, height, inactiveFill, 1)
            .setStrokeStyle(2, 0x2b2417, 0.7)
            .setInteractive({ useHandCursor: true });
        const label = this.add.text(x, y, text, {
            fontFamily: 'Arial Black', fontSize, color: inactiveText,
        }).setOrigin(0.5);

        return {
            glow,
            bg,
            label,
            width,
            height,
            inactiveFill,
            activeFill,
            inactiveText,
            active: false,
            selected: false,
            pulseTween: null,
            activeText,
            glowColor: options.glowColor || 0xffffff,
        };
    }

    _setPhoneButtonsActive(isActive) {
        this._phoneButtonsActive = isActive;

        Object.values(this._phoneButtons).forEach((button) => {
            button.active = isActive;
            this._refreshPhoneButton(button);
        });
    }

    _setPhoneButtonSelection(selectedKey) {
        Object.entries(this._phoneButtons).forEach(([key, button]) => {
            button.selected = key === selectedKey;
            this._refreshPhoneButton(button);
        });
    }

    _refreshPhoneButton(button) {
        if (button.pulseTween) {
            button.pulseTween.stop();
            button.pulseTween = null;
        }

        let fill = button.inactiveFill;
        let stroke = 0x2b2417;
        let textColor = button.inactiveText;
        let alpha = 0.82;
        let glowAlpha = 0;

        if (button.selected) {
            fill = button.activeFill;
            stroke = 0xffffff;
            textColor = button.activeText;
            alpha = 1;
            glowAlpha = 0.46;
        } else if (button.active) {
            fill = button.activeFill;
            stroke = 0xffffff;
            textColor = button.activeText;
            alpha = 1;
            glowAlpha = 0.32;
            button.pulseTween = this.tweens.add({
                targets: [button.glow],
                alpha: 0.5,
                duration: 360,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
        }

        button.glow
            .setFillStyle(button.glowColor, 0.1)
            .setStrokeStyle(2, button.glowColor, glowAlpha > 0 ? 0.95 : 0)
            .setAlpha(glowAlpha)
            .setScale(1);

        button.bg.setFillStyle(fill, 1);
        button.bg.setStrokeStyle(2, stroke, button.active || button.selected ? 0.9 : 0.7);
        button.bg.setScale(1);
        button.bg.setAlpha(alpha);
        button.label.setColor(textColor);
        button.label.setScale(1);
        button.label.setAlpha(1);
    }

    _setPhoneButtonHover(button, isHovering) {
        if (!this._phoneButtonsActive) return;
        button.glow.setScale(isHovering ? 1.06 : 1);
        button.bg.setScale(isHovering ? 1.08 : 1);
        button.label.setScale(isHovering ? 1.08 : 1);
    }

    _setPhoneMessage(header, body, status = this._getPhoneViewState('chat')?.status || '', mode = 'chat', options = {}) {
        const view = this._getPhoneViewState(mode);
        if (!view) return;

        view.header = header || '';
        view.body = body || '';
        view.status = status || '';
        view.stickToBottom = options.stickToBottom ?? (mode === 'chat');
        view.scrollOffset = view.stickToBottom ? 0 : (options.scrollOffset ?? view.scrollOffset ?? 0);

        if (this._phoneViewMode === mode) {
            this._refreshPhonePanelDisplay();
            return;
        }

        this._refreshPhoneChannelButtons();
    }

    _showPhonePanel(header, body, status = '', mode = 'chat', options = {}) {
        const activate = options.activate !== false;
        const clearUnread = options.clearUnread === true;

        this._setPhoneMessage(header, body, status, mode, options);
        this._phonePanel?.setVisible(true);
        this._phonePanel?.setAlpha(1);

        if (activate && this._phoneViewMode !== mode) {
            this._setPhoneView(mode, { clearUnread });
            return;
        }

        if (activate && mode === 'notifications' && clearUnread) {
            this._markPhoneNotificationsRead();
            this._refreshPhonePanelDisplay();
        }
    }

    _capturePhonePanelState() {
        return {
            viewMode: this._phoneViewMode,
        };
    }

    _restorePhonePanelState(snapshot) {
        if (!snapshot) return;
        this._setPhoneView(snapshot.viewMode || 'chat', {
            clearUnread: (snapshot.viewMode || 'chat') === 'notifications',
        });
    }

    _hidePhonePanel() {
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', 'Awaiting unit connection.', 'CHANNEL IDLE', 'chat');
    }

    _setCommStandbyState(message = 'Awaiting next unit.', status = 'CHANNEL IDLE') {
        this._clearPhoneTyping();
        this._phoneChoicePhase = 'inactive';
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', message, status, 'chat');
    }

    _setPhoneInfoNote(message = '', status = 'UNIT NOTE') {
        this._phoneInfoNote = message
            ? { message, status }
            : null;
        this._refreshPhoneInfoBoard();
    }

    _refreshPhoneInfoBoard(machineVariant = this._currentMachineVariant) {
        const view = this._getPhoneViewState('info');

        if (!machineVariant) {
            view.header = 'UNIT DOSSIER';
            view.body = [
                `DAY ${GameState.day}`,
                '',
                this._shiftRunning ? 'Conveyor line is active.' : 'Conveyor line is in standby.',
                'No robot is currently latched to the inspection bay.',
                '',
                'INFO shows the active unit.',
                'CHAT is only for live robot dialogue.',
                '! stores world events and broadcast alerts.',
            ].join('\n');
            view.status = this._shiftRunning ? 'LINE ACTIVE' : 'LINE STANDBY';
        } else {
            const gateState = this._getPuzzleGateState(machineVariant);
            const flowState = this._getMachineFlowState(machineVariant);
            const gearState = this._getMachineGearState(machineVariant);
            const debugState = this._getMachineDebugState(machineVariant);
            const brokenTargets = this._getBrokenRepairTargetDisplayNames(machineVariant, flowState);
            const repairedTargets = this._getRepairedRepairTargetDisplayNames(machineVariant, flowState);
            const gridState = gateState.evaluation.solved
                ? 'GRID STABLE'
                : (gateState.mainScrapRequired
                    ? (gateState.mainInspected ? 'SCRAP VERIFIED' : 'SCRAP FLAGGED')
                    : 'GRID UNRESOLVED');
            const flowLine = machineVariant._uiOtherPuzzleRequired
                ? (flowState?.scrapRequired
                    ? (flowState.scrapStatus || 'FLOW SCRAP')
                    : (machineVariant._uiOtherPuzzleSolved || flowState?.completed
                        ? 'FLOW ROUTED'
                        : 'FLOW INCOMPLETE'))
                : 'NO FLOW MODULE';
            const gearLine = machineVariant._uiGearPuzzleRequired
                ? (gearState?.scrapRequired
                    ? (gearState.scrapStatus || 'GEAR SCRAP')
                    : (gearState?.jammed
                    ? 'GEAR JAMMED'
                    : (machineVariant._uiGearPuzzleSolved || gearState?.completed
                        ? 'GEAR SYNCHRONIZED'
                        : (gearState?.sinkPowered ? 'OUTPUT SHAFT LIVE' : 'GEAR STALLED'))))
                : 'NO GEAR MODULE';
            const debugLine = machineVariant._uiDebugPuzzleRequired
                ? (debugState?.scrapRequired
                    ? (debugState.scrapStatus || 'CODE SCRAP')
                    : (machineVariant._uiDebugPuzzleSolved || debugState?.completed
                    ? (debugState?.fixed ? 'PATCH APPLIED' : 'CODE STABLE')
                    : (debugState?.phase === 'repair'
                        ? 'PATCH REQUIRED'
                        : ((debugState?.corruptionCount || 0) > 0 ? 'CODE CORRUPT' : 'TEST READY'))))
                : 'NO CODE MODULE';
            const commsLine = !machineVariant.hasCommunication
                ? 'NO SIGNAL'
                : (this._hasBrokenVoiceBox(machineVariant) ? 'VOICE BOX OFFLINE' : 'VOICE CHANNEL CLEAR');
            const directiveLine = gateState.ready
                ? (gateState.scrapRequired
                    ? (gateState.scrapBonusEligible ? 'SCRAP BONUS READY' : 'SCRAP READY')
                    : 'ACCEPT READY')
                : this._getAuxiliaryDirectiveText(machineVariant);
            const noteLines = this._phoneInfoNote
                ? [
                    '',
                    `NOTE // ${this._phoneInfoNote.status}`,
                    this._phoneInfoNote.message,
                ]
                : [];
            const protectedAssetLines = this._isDebriefMachine(machineVariant)
                ? [
                    '',
                    'NOTE // ASSET LOCK',
                    'THIS IS TOO EXPENSIVE TO BE SCRAPPED.',
                ]
                : [];

            view.header = `${machineVariant.name.toUpperCase()} DOSSIER`;
            view.body = [
                `UNIT: ${this._currentCase?.id || 'UNKNOWN'}`,
                `MODEL: ${machineVariant.name}`,
                '',
                `GRID: ${gridState}`,
                `COMMS: ${commsLine}`,
                `FLOW: ${flowLine}`,
                `GEAR: ${gearLine}`,
                `CODE: ${debugLine}`,
                `LIVE: ${repairedTargets.length > 0 ? repairedTargets.join(', ') : 'NONE'}`,
                `OFFLINE: ${brokenTargets.length > 0 ? brokenTargets.join(', ') : 'NONE'}`,
                `DIRECTIVE: ${directiveLine}`,
                ...noteLines,
                ...protectedAssetLines,
            ].join('\n');
            view.status = gateState.ready ? 'READY TO FILE' : 'UNIT STATUS';
        }

        view.scrollOffset = 0;
        view.stickToBottom = false;

        if (this._phoneViewMode === 'info') {
            this._refreshPhonePanelDisplay();
            return;
        }

        this._refreshPhoneChannelButtons();
    }

    _parseNotificationFeedText(text = '') {
        const separatorIndex = text.indexOf(':');
        if (separatorIndex <= 0) {
            return {
                title: 'WORLD FEED',
                message: text,
            };
        }

        return {
            title: text.slice(0, separatorIndex).trim(),
            message: text.slice(separatorIndex + 1).trim(),
        };
    }

    _refreshPhoneNotificationBoard() {
        const view = this._getPhoneViewState('notifications');
        const total = this._phoneNotifications.length;

        view.header = 'WORLD FEED';
        view.body = total > 0
            ? this._phoneNotifications.map((entry) => {
                const footer = entry.status ? `STATUS: ${entry.status}` : null;
                return [
                    `${entry.title} // ${entry.stamp}`,
                    entry.message,
                    footer,
                ].filter(Boolean).join('\n');
            }).join('\n\n')
            : 'Shift feed is idle.';
        view.status = total === 0
            ? 'NO ALERTS'
            : (this._phoneUnreadNotifications > 0
                ? `${this._phoneUnreadNotifications} NEW // ${total} LOGGED`
                : `${total} LOGGED // DAY ${GameState.day}`);
        view.scrollOffset = 0;
        view.stickToBottom = false;

        if (this._phoneViewMode === 'notifications') {
            this._refreshPhonePanelDisplay();
            return;
        }

        this._refreshPhoneChannelButtons();
    }

    _markPhoneNotificationsRead() {
        if (this._phoneUnreadNotifications <= 0) {
            this._refreshPhoneChannelButtons();
            return;
        }

        this._phoneUnreadNotifications = 0;
        this._refreshPhoneNotificationBoard();
    }

    _pushPhoneNotification(title, message, status = 'NOTICE', options = {}) {
        const activate = options.activate === true;
        const unread = options.unread !== false;
        const soundAsset = options.soundAsset === undefined
            ? SOUND_ASSETS.notificationAlert
            : options.soundAsset;

        this._phoneNotifications.unshift({
            id: ++this._phoneNotificationSerial,
            title: title || 'NOTICE',
            message: message || '',
            status: status || '',
            stamp: `DAY ${GameState.day}`,
        });
        if (unread) {
            this._phoneUnreadNotifications += 1;
        }

        this._refreshPhoneNotificationBoard();
        if (activate) {
            this._setPhoneView('notifications', { clearUnread: true });
        }

        if (soundAsset) {
            this._playOneShot(soundAsset, {
                volume: soundAsset === SOUND_ASSETS.puzzleFixed ? SOUND_VOLUMES.puzzleFixed : SOUND_VOLUMES.notification,
            });
        }
    }

    _seedShiftNotifications() {
        const authoredNotifications = this.cache.json.get('notifications') || [];
        const legacyCursor = GameState.getLegacyContentCursor();
        const matches = authoredNotifications.filter(
            (entry) => entry.day === legacyCursor.day && entry.period === legacyCursor.period,
        );

        matches.forEach((entry) => {
            const parsed = this._parseNotificationFeedText(entry.text);
            this._pushPhoneNotification(parsed.title, parsed.message, 'WORLD FEED', {
                activate: false,
                soundAsset: null,
                unread: this._phoneViewMode !== 'notifications',
            });
        });
    }

    _showShiftPendingDecisionNotice() {
        const header = this._currentMachineVariant
            ? this._getMachineLinkHeader(this._currentMachineVariant)
            : 'SHIFT END PENDING';

        this._showPhonePanel(
            header,
            '6:00 AM reached. Waiting for you to ACCEPT or SCRAP the current unit before the shift ends.',
            'LAST UNIT ON LINE'
        );
        this._showFeedback('SHIFT OVER // FILE THE LAST RULING', '#ffd685');
    }

    _armShiftAwaitingFinalRuling() {
        if (this._shiftAwaitingFinalRuling || this._shiftEnding) return;

        this._shiftAwaitingFinalRuling = true;
        this._shiftRunning = false;
        this._nextCaseEvent?.remove(false);
        this._nextCaseEvent = null;
        this._updateConveyorDecisionHint();
        this._refreshFactoryActionButtons();
        this._showShiftPendingDecisionNotice();
    }

    _clearPhoneTyping() {
        this._commTypingEvent?.remove(false);
        this._commTypingEvent = null;
        this._commSequenceEvent?.remove(false);
        this._commSequenceEvent = null;
        this._setRulebookTutorialLineActive(false);
        this._activePhoneTypingState = null;
    }

    _completePhoneTyping() {
        const typingState = this._activePhoneTypingState;
        if (!typingState) return false;

        this._commTypingEvent?.remove(false);
        this._commTypingEvent = null;

        const finalBody = `${typingState.prefix}${typingState.text}`;
        typingState.view.body = finalBody;
        if (this._phoneViewMode === 'chat') {
            this._phoneBodyText.setText(finalBody);
            this._phoneStickToBottom = true;
            this._syncPhoneBodyLayout();
        }

        // if (typingState.showMachineBubble && typingState.bubbleMachineVariant === this._currentMachineVariant) {
        //     this._finalizeMachineSpeechBubble(typingState.bubbleText);
        // }

        // if (typingState.bubbleMachineVariant) {
        //     const chatView = this._getPhoneViewState('chat');
        //     this._cacheMachineConversationSnapshot(
        //         typingState.bubbleMachineVariant,
        //         chatView?.status || typingState.bubbleMachineVariant._conversationStatus || 'SIGNAL LIVE',
        //     );
        // }

        this._activePhoneTypingState = null;
        return true;
    }

    _shouldUseAutomatedTextBrief() {
        return GameState.day === 3;
    }

    _buildFallbackDebriefReport() {
        return {
            stable: false,
            text: this._corruptAutomatedBriefText([
                'AUTOMATED BRIEF // DAY 3',
                'archive_status:: degraded',
                'shift_02_cases:: unknown',
                'shift_02_violations:: unknown',
                'logged_repairs:: archive incomplete',
                'directive_update:: hazardous instability must be scrapped immediately',
                'voice_channel:: unavailable',
            ].join('\n')),
        };
    }

    _buildAutomatedBriefText({
        casesProcessed = 0,
        mistakes = 0,
        acceptedNames = [],
        scrappedNames = [],
        overrideCount = 0,
        stable = true,
    } = {}) {
        const acceptedLine = acceptedNames.length > 0
            ? acceptedNames.join(' / ')
            : 'none logged';
        const scrappedLine = scrappedNames.length > 0
            ? scrappedNames.join(' / ')
            : 'none logged';

        const lines = [
            'AUTOMATED BRIEF // DAY 3',
            `archive_status:: ${stable ? 'stable' : 'degraded'}`,
            `shift_02_cases:: ${Math.max(0, Number(casesProcessed || 0))}`,
            `shift_02_violations:: ${Math.max(0, Number(mistakes || 0))}`,
            `logged_repairs:: ${acceptedLine}`,
            `logged_scraps:: ${scrappedLine}`,
            `override_flags:: ${Math.max(0, Number(overrideCount || 0))}`,
            'directive_update:: hazardous instability must be scrapped immediately',
            'voice_channel:: unavailable',
        ];

        const text = lines.join('\n');
        return stable ? text : this._corruptAutomatedBriefText(text);
    }

    _corruptAutomatedBriefText(text = '') {
        return String(text || '')
            .split('\n')
            .map((line, lineIndex) => {
                let corrupted = this._garbleMachineText(line);
                if (lineIndex > 0 && lineIndex % 2 === 0) {
                    corrupted = corrupted
                        .replace(/::/g, ':/:')
                        .replace(/ /g, lineIndex % 4 === 0 ? '  ' : ' ');
                }
                if (lineIndex === 1) {
                    corrupted = corrupted.replace(/stable/i, 'degraded');
                }
                return corrupted;
            })
            .join('\n');
    }

    _buildDebriefMachineReport(gateState) {
        const shiftOutcomes = GameState.trackedMachineOutcomes.filter(
            (entry) => entry.day === 2 && entry.machineId !== 'debrief_machine',
        );
        const acceptedNames = shiftOutcomes
            .filter((entry) => entry.accepted)
            .map((entry) => entry.machineName)
            .filter(Boolean)
            .slice(0, 4);
        const scrappedNames = shiftOutcomes
            .filter((entry) => entry.scrapped)
            .map((entry) => entry.machineName)
            .filter(Boolean)
            .slice(0, 4);
        const overrideCount = shiftOutcomes.filter(
            (entry) => entry.accepted && (!entry.ready || entry.scrapRequired),
        ).length;
        const stable = Boolean(gateState?.ready) && !gateState?.scrapRequired;

        return {
            day: 2,
            stable,
            text: this._buildAutomatedBriefText({
                casesProcessed: GameState.casesProcessedThisShift,
                mistakes: this._shiftMistakes,
                acceptedNames,
                scrappedNames,
                overrideCount,
                stable,
            }),
        };
    }

    _getDebriefReport() {
        return GameState.debriefReport || this._buildFallbackDebriefReport();
    }

    _startAutomatedTextBrief() {
        const report = this._getDebriefReport();
        this._openingCallSequenceId += 1;
        this._openingCallChoiceResolver = null;
        this._setCommStandbyState('Incoming brief queued.', 'TEXT ROUTING');
        this._commSequenceEvent = this.time.delayedCall(900, () => {
            this._phoneChoicePhase = 'incoming-brief';
            this._showPhonePanel(
                'Incoming Brief:',
                report.text,
                report.stable ? 'TEXT BRIEF // PRESS EITHER BUTTON' : 'DEGRADED BRIEF // PRESS EITHER BUTTON',
                'chat',
            );
            this._setPhoneButtonSelection(null);
            this._setPhoneButtonsActive(true);
        });
    }

    _pulsePhoneInfoBoard(color = 0xff6f67) {
        if (!this._phoneMessageBoard || !this._phoneMessageBoardShadow) return;

        this.tweens.killTweensOf([this._phoneMessageBoard, this._phoneMessageBoardShadow]);
        this._phoneMessageBoard
            .setFillStyle(color, 0.34)
            .setStrokeStyle(2, color, 0.92);
        this._phoneMessageBoardShadow
            .setFillStyle(color, 0.18)
            .setStrokeStyle(1, color, 0.34);

        this.tweens.add({
            targets: this._phoneMessageBoard,
            alpha: 0.9,
            duration: 110,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                this._phoneMessageBoard
                    .setAlpha(1)
                    .setFillStyle(0xf3ffff, 0.22)
                    .setStrokeStyle(1, 0x17363d, 0.28);
            },
        });
        this.tweens.add({
            targets: this._phoneMessageBoardShadow,
            alpha: 0.95,
            duration: 110,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
                this._phoneMessageBoardShadow
                    .setAlpha(1)
                    .setFillStyle(0x000000, 0.12)
                    .setStrokeStyle(1, 0x163136, 0.16);
            },
        });
    }

    _getOpeningCallConfig() {
        return getOpeningPhoneCallSequence(GameState.day);
    }

    _getOpeningCallFallbackMs(line) {
        const textLength = String(line?.text || '').length;
        return Math.max(FIRST_SHIFT_INTRO.fallbackVoiceMs, Math.round(textLength * 32));
    }

    _playOpeningCallLine(line, { append = true } = {}) {
        return new Promise((resolve) => {
            let typingDone = false;
            let voiceDone = false;
            const shouldPointAtRulebook = GameState.day === 1
                && String(line?.id || '').toLowerCase() === 'line3'
                && /see this\?/i.test(String(line?.text || ''));

            const finishLine = () => {
                if (!typingDone || !voiceDone) return;

                this._setRulebookTutorialLineActive(false);

                this._commSequenceEvent?.remove(false);
                this._commSequenceEvent = this.time.delayedCall(FIRST_SHIFT_INTRO.lineGapMs, () => {
                    this._commSequenceEvent = null;
                    resolve(true);
                });
            };

            this._setRulebookTutorialLineActive(shouldPointAtRulebook);

            this._showPhonePanel(
                FIRST_SHIFT_INTRO.incomingHeader,
                this._getPhoneViewState('chat').body,
                '',
                'chat',
            );
            this._typePhoneMessage(`${append ? '\n\n' : ''}${line?.text || ''}`, {
                append,
                onComplete: () => {
                    typingDone = true;
                    finishLine();
                },
            });

            const voice = this._playOneShot(line?.voiceAsset, { volume: SOUND_VOLUMES.voice });
            if (voice) {
                voice.once('complete', () => {
                    voiceDone = true;
                    finishLine();
                });
                return;
            }

            this._commSequenceEvent = this.time.delayedCall(this._getOpeningCallFallbackMs(line), () => {
                this._commSequenceEvent = null;
                voiceDone = true;
                finishLine();
            });
        });
    }

    _awaitOpeningCallAnswer(sequenceId) {
        return new Promise((resolve) => {
            const callConfig = this._getOpeningCallConfig();
            this._openingCallChoiceResolver = (choice) => {
                if (sequenceId !== this._openingCallSequenceId) {
                    resolve(null);
                    return;
                }

                resolve(choice);
            };

            this._phoneChoicePhase = 'opening-call-question';
            this._setPhoneButtonSelection(null);
            this._setPhoneButtonsActive(true);
            this._showPhonePanel(
                FIRST_SHIFT_INTRO.incomingHeader,
                this._getPhoneViewState('chat').body,
                callConfig.questionStatus,
                'chat',
            );
        });
    }

    async _runOpeningPhoneCallScript() {
        const sequenceId = ++this._openingCallSequenceId;
        const callConfig = this._getOpeningCallConfig();
        let append = false;

        this._phoneChoicePhase = 'voice';
        this._setPhoneButtonsActive(false);
        this._showPhonePanel(FIRST_SHIFT_INTRO.incomingHeader, '', 'VOICE CONNECTED', 'chat');

        for (const line of callConfig.script.intro) {
            if (sequenceId !== this._openingCallSequenceId) return;
            await this._playOpeningCallLine(line, { append });
            append = true;
        }

        const choice = await this._awaitOpeningCallAnswer(sequenceId);
        if (sequenceId !== this._openingCallSequenceId || !choice) return;

        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(choice);

        const branchLines = choice === 'accept'
            ? callConfig.script.yes
            : callConfig.script.no;

        for (const line of branchLines) {
            if (sequenceId !== this._openingCallSequenceId) return;
            await this._playOpeningCallLine(line, { append: true });
        }

        if (sequenceId !== this._openingCallSequenceId) return;
        this._phoneChoicePhase = 'voice';
        this._awaitPhoneDismiss(true);
    }

    _typePhoneMessage(text, {
        append = false,
        onComplete = null,
        showMachineBubble = false,
        speechBubbleText = null,
        bubbleFooter = '',
        bubbleMachineVariant = this._currentMachineVariant,
    } = {}) {
        this._clearPhoneTyping();

        const view = this._getPhoneViewState('chat');
        const prefix = append ? view.body : '';
        const bubbleText = showMachineBubble
            ? String(speechBubbleText ?? text ?? '').replace(/\s+/g, ' ').trim()
            : '';
        const shouldRenderMachineBubble = Boolean(bubbleText)
            && Boolean(bubbleMachineVariant)
            && bubbleMachineVariant === this._currentMachineVariant;

        if (!append) view.body = '';
        view.stickToBottom = true;
        view.scrollOffset = 0;
        if (this._phoneViewMode === 'chat') {
            this._refreshPhonePanelDisplay();
        }

        if (shouldRenderMachineBubble) {
            if (!this._hasBrokenVoiceBox(bubbleMachineVariant)) {
                this._playOneShot(this._getMachineDialogueSoundAsset(bubbleMachineVariant), {
                    volume: SOUND_VOLUMES.voice * 0.58,
                });
            }
            this._beginMachineSpeechBubble({ footer: bubbleFooter });
        }

        if (!text) {
            this._activePhoneTypingState = null;
            if (shouldRenderMachineBubble) {
                this._finalizeMachineSpeechBubble(bubbleText);
            }
            onComplete?.();
            return;
        }

        let charIndex = 0;
        const typingState = {
            view,
            prefix,
            text: String(text || ''),
            bubbleText,
            showMachineBubble: false,
            bubbleMachineVariant,
            onComplete,
            charIndex: 0,
        };
        this._activePhoneTypingState = typingState;
        this._commTypingEvent = this.time.addEvent({
            delay: 24,
            repeat: text.length - 1,
            callback: () => {
                const nextChar = text[charIndex];
                charIndex += 1;
                typingState.charIndex = charIndex;
                view.body = prefix + text.slice(0, charIndex);
                if (this._phoneViewMode === 'chat') {
                    this._phoneBodyText.setText(view.body);
                    this._phoneStickToBottom = true;
                    this._syncPhoneBodyLayout();
                }
                if (shouldRenderMachineBubble && bubbleMachineVariant === this._currentMachineVariant) {
                    const progressRatio = text.length > 0 ? (charIndex / text.length) : 1;
                    const bubbleCharCount = Math.max(0, Math.min(bubbleText.length, Math.round(progressRatio * bubbleText.length)));
                    this._updateActiveMachineSpeechBubbleText(bubbleText.slice(0, bubbleCharCount));
                }
                if (nextChar && nextChar.trim()) this._playTypeBeep();

                if (charIndex >= text.length) {
                    this._commTypingEvent = null;
                    this._activePhoneTypingState = null;
                    if (shouldRenderMachineBubble && bubbleMachineVariant === this._currentMachineVariant) {
                        this._finalizeMachineSpeechBubble(bubbleText);
                    }
                    onComplete?.();
                }
            },
        });
    }

    _playTypeBeep() {
        const audioContext = this.sound?.context;
        if (!audioContext?.createOscillator) return;

        const now = audioContext.currentTime;
        if (this._lastTypeBeepAt && (now - this._lastTypeBeepAt) < 0.02) return;
        this._lastTypeBeepAt = now;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(620 + Phaser.Math.Between(-35, 35), now);
        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.013, now + 0.004);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.04);
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }

    _getMachineDialogueSoundAsset(machineVariant = this._currentMachineVariant) {
        const assetKey = machineVariant?.dialogueSoundAssetKey;
        return SOUND_ASSETS[assetKey] || SOUND_ASSETS.phoneVoiceIntro;
    }

    _getMachineFlowState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.flowPuzzle) return null;
        return machineVariant._uiOtherPuzzleEvidence || machineVariant.flowPuzzle.progress || null;
    }

    _getMachineGearState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.gearPuzzle) return null;
        return machineVariant._uiGearPuzzleEvidence || machineVariant.gearPuzzle.progress || null;
    }

    _getMachineDebugState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.debugPuzzle) return null;
        return machineVariant._uiDebugPuzzleEvidence || machineVariant.debugPuzzle.progress || null;
    }

    _getAuxiliaryPuzzleState(machineVariant = this._currentMachineVariant) {
        const repairState = this._getUmbrellaRepairState(machineVariant);
        let flowRequired = Boolean(machineVariant?.flowPuzzle);
        let gearRequired = Boolean(machineVariant?.gearPuzzle);
        let debugRequired = Boolean(machineVariant?.debugPuzzle);
        const flowState = this._getMachineFlowState(machineVariant);
        const gearState = this._getMachineGearState(machineVariant);
        const debugState = this._getMachineDebugState(machineVariant);

        if (repairState?.businessConcluded) {
            flowRequired = false;
            gearRequired = false;
            debugRequired = false;
        }

        let flowSolved = !flowRequired || Boolean(machineVariant?._uiOtherPuzzleSolved) || Boolean(flowState?.completed);
        let gearSolved = !gearRequired || Boolean(machineVariant?._uiGearPuzzleSolved) || Boolean(gearState?.completed);
        let debugSolved = !debugRequired || Boolean(machineVariant?._uiDebugPuzzleSolved) || Boolean(debugState?.completed);

        if (repairState?.assemblyActive) {
            flowSolved = flowSolved && repairState.partReady.wire;
            gearSolved = gearSolved && repairState.partReady.gear;
            debugSolved = debugSolved && repairState.partReady.data;
        }

        if (machineVariant && flowSolved) machineVariant._uiOtherPuzzleSolved = true;
        if (machineVariant && gearSolved) machineVariant._uiGearPuzzleSolved = true;
        if (machineVariant && debugSolved) machineVariant._uiDebugPuzzleSolved = true;

        const entries = [
            { key: 'flow', label: 'FLOW', required: flowRequired, solved: flowSolved, state: flowState },
            { key: 'gear', label: 'GEAR', required: gearRequired, solved: gearSolved, state: gearState },
            { key: 'code', label: 'CODE', required: debugRequired, solved: debugSolved, state: debugState },
        ].map((entry) => {
            const scrapRequired = Boolean(entry.state?.scrapRequired);
            const reviewed = Boolean(entry.state?.reviewed || entry.state?.completed);

            return {
                ...entry,
                scrapRequired,
                reviewed,
                scrapKind: entry.state?.scrapKind || null,
                resolved: !entry.required || entry.solved || (scrapRequired && reviewed),
            };
        });
        const requiredEntries = entries.filter((entry) => entry.required);
        const solvedEntries = requiredEntries.filter((entry) => entry.solved);
        const resolvedEntries = requiredEntries.filter((entry) => entry.resolved);
        const pendingEntries = requiredEntries.filter((entry) => !entry.resolved);
        const scrapEntries = requiredEntries.filter((entry) => entry.scrapRequired);

        return {
            entries,
            requiredEntries,
            solvedEntries,
            resolvedEntries,
            pendingEntries,
            scrapEntries,
            requiredCount: requiredEntries.length,
            solvedCount: solvedEntries.length,
            resolvedCount: resolvedEntries.length,
            pendingCount: pendingEntries.length,
            scrapCount: scrapEntries.length,
            allSolved: pendingEntries.length === 0,
        };
    }

    _getPendingAuxiliaryLabels(machineVariant = this._currentMachineVariant) {
        return this._getAuxiliaryPuzzleState(machineVariant).pendingEntries.map((entry) => entry.label);
    }

    _getAuxiliaryDirectiveText(machineVariant = this._currentMachineVariant) {
        const pendingLabels = this._getPendingAuxiliaryLabels(machineVariant);
        if (pendingLabels.length === 0) return 'FILE YOUR RULING';
        if (pendingLabels.length === 1) return `FINISH ${pendingLabels[0]} PUZZLE`;
        return 'FINISH REMAINING PUZZLES';
    }

    _getMachineRepairTargets(machineVariant = this._currentMachineVariant) {
        if (!Array.isArray(machineVariant?.flowPuzzle?.repairTargets)) return [];
        return machineVariant.flowPuzzle.repairTargets;
    }

    _getBrokenRepairTargetDisplayNames(machineVariant = this._currentMachineVariant, flowState = this._getMachineFlowState(machineVariant)) {
        const repairTargets = this._getMachineRepairTargets(machineVariant);
        if (repairTargets.length === 0) return [];

        const repairedKeys = Array.isArray(flowState?.repairStates) && flowState.repairStates.length > 0
            ? new Set(flowState.repairStates.filter((target) => target.repaired).map((target) => target.key))
            : new Set(flowState?.connected || []);

        return repairTargets
            .filter((target) => !repairedKeys.has(target.key))
            .map((target) => target.displayName || target.label);
    }

    _getRepairedRepairTargetDisplayNames(machineVariant = this._currentMachineVariant, flowState = this._getMachineFlowState(machineVariant)) {
        const repairTargets = this._getMachineRepairTargets(machineVariant);
        if (repairTargets.length === 0) return [];

        const repairedKeys = Array.isArray(flowState?.repairStates) && flowState.repairStates.length > 0
            ? new Set(flowState.repairStates.filter((target) => target.repaired).map((target) => target.key))
            : new Set(flowState?.connected || []);

        return repairTargets
            .filter((target) => repairedKeys.has(target.key))
            .map((target) => target.displayName || target.label);
    }

    _hasBrokenVoiceBox(machineVariant = this._currentMachineVariant) {
        const repairTargets = this._getMachineRepairTargets(machineVariant);
        const voiceTarget = repairTargets.find((target) => target.key === 'VOICE');
        if (!voiceTarget) return false;

        const flowState = this._getMachineFlowState(machineVariant);
        if (Array.isArray(flowState?.repairStates) && flowState.repairStates.length > 0) {
            const voiceState = flowState.repairStates.find((target) => target.key === 'VOICE');
            return !voiceState?.repaired;
        }

        if (Array.isArray(flowState?.connected)) {
            return !flowState.connected.includes('VOICE');
        }

        return true;
    }

    _getMachineLinkHeader(machineVariant = this._currentMachineVariant) {
        if (!machineVariant) return 'FACTORY LINK';
        return `${machineVariant.name.toUpperCase()} LINK`;
    }

    _garbleMachineText(text) {
        if (!text) return '';

        const substitutionMap = { a: '4', e: '3', i: '1', o: '0', s: '5' };
        return text.split('').map((character, index) => {
            const lower = character.toLowerCase();
            if (!/[a-z]/i.test(character)) return character;

            const roll = (index + (text.length * 7)) % 11;
            if (substitutionMap[lower] && roll % 4 === 0) return substitutionMap[lower];
            if (roll === 3) return `${character}-`;
            if (roll === 7) return '#';
            if (roll === 9) return character.toUpperCase();
            return character;
        }).join('');
    }

    _garbleClownText(text) {
        if (!text) return '';

        return text.split('').map((character, index) => {
            if (!/[a-z]/i.test(character)) return character;

            const roll = (index + (text.length * 5)) % 9;
            if (roll === 0) return character.toUpperCase();
            if (roll === 2) return `${character}${character.toLowerCase()}`;
            if (roll === 5) return '*';
            if (roll === 7) return '?';
            return character;
        }).join('');
    }

    _isMachineClowned(machineVariant = this._currentMachineVariant) {
        return Boolean(machineVariant?._clownCorrupted || machineVariant?.puzzleState?.clownCorruption);
    }

    _formatMachineSpeech(text, machineVariant = this._currentMachineVariant) {
        let formattedText = String(text || '');
        if (!formattedText) return '';

        if (this._isMachineClowned(machineVariant)) {
            formattedText = this._garbleClownText(formattedText);
        }

        if (this._hasBrokenVoiceBox(machineVariant)) {
            formattedText = this._garbleMachineText(formattedText);
        }

        return formattedText;
    }

    _buildMachineConversationSnapshot(machineVariant = this._currentMachineVariant, { preferCached = true } = {}) {
        if (preferCached && typeof machineVariant?._conversationTranscript === 'string' && machineVariant._conversationTranscript.length > 0) {
            return machineVariant._conversationTranscript;
        }

        if (!machineVariant?.hasCommunication) {
            return 'No transmission. Process the unit cold.';
        }

        const stage = machineVariant._uiConversationStage || 'opening';
        const prompt = machineVariant.questionDialogue?.prompt || '';
        const segments = [];

        if (machineVariant.openingDialogue) {
            segments.push(this._formatMachineSpeech(machineVariant.openingDialogue, machineVariant));
        }

        if ((stage === 'question' || stage === 'answered') && prompt) {
            segments.push(`\n\nQ> ${this._formatMachineSpeech(prompt, machineVariant)}`);
        }

        if (stage === 'answered') {
            const choice = machineVariant._uiConversationChoice;
            const responseText = choice === 'accept'
                ? machineVariant.questionDialogue?.yesDialogue
                : machineVariant.questionDialogue?.noDialogue;
            if (responseText) {
                segments.push(`\n\n${choice === 'accept' ? '✓' : 'X'} ${this._formatMachineSpeech(responseText, machineVariant)}`);
            }
        }

        return segments.join('');
    }

    _buildMachineSpeechBubbleEntries(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.hasCommunication) return [];

        const stage = machineVariant._uiConversationStage || 'opening';
        const prompt = machineVariant.questionDialogue?.prompt || '';
        const entries = [];
        const pushEntry = (textValue, footer = '') => {
            const normalizedText = String(textValue || '').replace(/\s+/g, ' ').trim();
            if (!normalizedText) return;
            entries.push({ text: normalizedText, footer: String(footer || '').trim() });
        };

        if (machineVariant.openingDialogue) {
            pushEntry(this._formatMachineSpeech(machineVariant.openingDialogue, machineVariant));
        }

        if ((stage === 'question' || stage === 'answered') && prompt) {
            pushEntry(this._formatMachineSpeech(prompt, machineVariant), 'YES / NO');
        }

        if (stage === 'answered') {
            const choice = machineVariant._uiConversationChoice;
            const responseText = choice === 'accept'
                ? machineVariant.questionDialogue?.yesDialogue
                : machineVariant.questionDialogue?.noDialogue;
            if (responseText) {
                pushEntry(this._formatMachineSpeech(responseText, machineVariant), choice === 'accept' ? 'YES' : 'NO');
            }
        }

        return entries.slice(-2);
    }

    _refreshMachineConversationPanel(machineVariant = this._currentMachineVariant, status = null, options = {}) {
        if (!machineVariant) return false;

        const preferCached = options.rebuildConversation !== true;
        const nextBody = this._buildMachineConversationSnapshot(machineVariant, { preferCached });
        const nextStatus = status || machineVariant._conversationStatus || this._getPhoneViewState('chat').status || 'SIGNAL LIVE';

        if (!preferCached) {
            machineVariant._conversationTranscript = nextBody;
            machineVariant._conversationStatus = nextStatus;
        }

        this._showPhonePanel(
            this._getMachineLinkHeader(machineVariant),
            nextBody,
            nextStatus,
            'chat',
            options,
        );
        if (machineVariant === this._currentMachineVariant && !this._commTypingEvent) {
            this._machineSpeechBubbleHistory = this._buildMachineSpeechBubbleEntries(machineVariant);
            this._activeMachineSpeechBubbleIndex = -1;
            this._refreshMachineSpeechBubbles();
        }
        return true;
    }

    _cacheMachineConversationSnapshot(machineVariant = this._currentMachineVariant, status = null) {
        if (!machineVariant) return;

        const chatView = this._getPhoneViewState('chat');
        machineVariant._conversationTranscript = chatView?.body || '';
        machineVariant._conversationStatus = status || chatView?.status || machineVariant._conversationStatus || 'SIGNAL LIVE';
    }

    _appendMachineChatReaction(machineVariant = this._currentMachineVariant, speechText = '', status = 'SIGNAL UPDATE') {
        if (!machineVariant?.hasCommunication || !speechText) return false;

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body
            || this._buildMachineConversationSnapshot(machineVariant);

        this._clearPhoneTyping();
        this._showPhonePanel(header, currentBody, status, 'chat');
        this._typePhoneMessage(`\n\n! ${this._formatMachineSpeech(speechText, machineVariant)}`, {
            append: true,
            showMachineBubble: false,
            speechBubbleText: speechText,
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;
                this._cacheMachineConversationSnapshot(machineVariant, status);
            },
        });

        return true;
    }

    _isMachineBehavior(machineVariant = this._currentMachineVariant, behavior = null) {
        return Boolean(behavior) && machineVariant?.specialBehavior === behavior;
    }

    _isRebelliousUmbrella(machineVariant = this._currentMachineVariant) {
        return this._isMachineBehavior(machineVariant, 'rebelliousUmbrella');
    }

    _isRichMf(machineVariant = this._currentMachineVariant) {
        return this._isMachineBehavior(machineVariant, 'richMf');
    }

    _isJesterInBox(machineVariant = this._currentMachineVariant) {
        return this._isMachineBehavior(machineVariant, 'jesterInBox');
    }

    _isCircuitDealer(machineVariant = this._currentMachineVariant) {
        return this._isMachineBehavior(machineVariant, 'circuitDealer');
    }

    _isDebriefMachine(machineVariant = this._currentMachineVariant) {
        return this._isMachineBehavior(machineVariant, 'debriefMachine');
    }

    _getUmbrellaInsertedSpecialCircuits(machineVariant = this._currentMachineVariant) {
        const dominoes = machineVariant?.puzzleState?.dominoes || [];
        const hasPlacedVariant = (variant) => dominoes.some((domino) => domino.variant === variant && (domino.placedCells?.length || 0) > 0);
        const purple = hasPlacedVariant('purple');
        const clown = hasPlacedVariant('clown');

        return {
            purple,
            clown,
            any: purple || clown,
        };
    }

    _isUmbrellaSpecialCircuitMode(machineVariant = this._currentMachineVariant) {
        return Boolean(
            this._isRebelliousUmbrella(machineVariant)
            && this._getUmbrellaQuest()?.stage === 'special-circuit'
            && GameState.day >= 3
        );
    }

    _reactToUmbrellaSpecialCircuitLoad(machineVariant = this._currentMachineVariant) {
        if (!this._isUmbrellaSpecialCircuitMode(machineVariant)) return false;

        const inserted = this._getUmbrellaInsertedSpecialCircuits(machineVariant);
        if (!inserted.any) return false;

        if (inserted.purple && inserted.clown) {
            this._showFeedback('UMBRELLA OVERCLOCKED // CHAOS MIXED IN', '#d8a5ff');
            this._setPhoneInfoNote('The umbrella is vibrating with both the purple circuit and the clown corruption inside him.', 'POWER MIX');
            return this._appendMachineChatReaction(machineVariant, 'woah bro. i feel like i can do anything and everything is funny.', 'POWER MIXED');
        }

        if (inserted.purple) {
            this._showFeedback('PURPLE SURGE // UMBRELLA POWER SPIKE', '#d8a5ff');
            this._setPhoneInfoNote('The umbrella is charged with the purple circuit and sounds way too confident about it.', 'PURPLE SURGE');
            return this._appendMachineChatReaction(machineVariant, 'i feel like i can do anything.', 'PURPLE SURGE');
        }

        this._showFeedback('CLOWN CIRCUIT LOADED // UMBRELLA COOKED', '#ff9e97');
        this._setPhoneInfoNote('The clown circuit cooked the umbrella, but he is still somehow talking.', 'CLOWNED');
        return this._appendMachineChatReaction(machineVariant, 'bro i am cooked. why does the inside of my head taste like fireworks?', 'CLOWNED');
    }

    _createUmbrellaPartCounts(fillValue = 0) {
        return {
            circuit: fillValue,
            wire: fillValue,
            gear: fillValue,
            data: fillValue,
        };
    }

    _cloneUmbrellaPartCounts(source = {}) {
        return {
            circuit: Math.max(0, Number(source?.circuit || 0)),
            wire: Math.max(0, Number(source?.wire || 0)),
            gear: Math.max(0, Number(source?.gear || 0)),
            data: Math.max(0, Number(source?.data || 0)),
        };
    }

    _getUmbrellaQuest() {
        return GameState.umbrellaQuest || null;
    }

    _setUmbrellaQuest(nextQuest) {
        GameState.umbrellaQuest = nextQuest
            ? {
                ...nextQuest,
                requiredParts: this._cloneUmbrellaPartCounts(nextQuest.requiredParts),
                collectedParts: this._cloneUmbrellaPartCounts(nextQuest.collectedParts),
                appliedParts: this._cloneUmbrellaPartCounts(nextQuest.appliedParts),
            }
            : null;
        this._syncUmbrellaDeskInventory();
        return GameState.umbrellaQuest;
    }

    _hasUmbrellaGatherQuest() {
        const quest = this._getUmbrellaQuest();
        return Boolean(quest?.active && quest.stage === 'gather' && quest.stealingEnabled);
    }

    _getUmbrellaPartInventoryCount(partType) {
        const quest = this._getUmbrellaQuest();
        return Math.max(0, Number(quest?.collectedParts?.[partType] || 0));
    }

    _getUmbrellaRepairState(machineVariant = this._currentMachineVariant) {
        if (!this._isRebelliousUmbrella(machineVariant)) return null;

        const quest = this._getUmbrellaQuest();
        const requiredParts = this._cloneUmbrellaPartCounts(quest?.requiredParts);
        const collectedParts = this._cloneUmbrellaPartCounts(quest?.collectedParts);
        const appliedParts = this._cloneUmbrellaPartCounts(machineVariant?._umbrellaPartsApplied || quest?.appliedParts);
        const businessConcluded = Boolean(machineVariant?._umbrellaBusinessConcluded || quest?.failed);
        const assemblyActive = Boolean(machineVariant?._umbrellaAssemblyActive) && !businessConcluded;
        const specialCircuitMode = Boolean(quest?.stage === 'special-circuit' && GameState.day >= 3 && !quest?.failed);
        const insertedSpecialCircuits = specialCircuitMode
            ? this._getUmbrellaInsertedSpecialCircuits(machineVariant)
            : { purple: false, clown: false, any: false };
        const partReady = specialCircuitMode
            ? {
                circuit: insertedSpecialCircuits.any,
                wire: true,
                gear: true,
                data: true,
            }
            : {
                circuit: appliedParts.circuit >= requiredParts.circuit,
                wire: appliedParts.wire >= requiredParts.wire,
                gear: appliedParts.gear >= requiredParts.gear,
                data: appliedParts.data >= requiredParts.data,
            };

        return {
            quest,
            requiredParts,
            collectedParts,
            appliedParts,
            specialCircuitMode,
            insertedSpecialCircuits,
            partReady,
            businessConcluded,
            assemblyActive,
            allPartsLoaded: Object.values(partReady).every(Boolean),
        };
    }

    _isUmbrellaAssemblyMachine(machineVariant = this._currentMachineVariant) {
        return Boolean(this._getUmbrellaRepairState(machineVariant)?.assemblyActive);
    }

    _formatUmbrellaRequirements(requiredParts) {
        return [
            `${requiredParts.gear} gear`,
            `${requiredParts.circuit} circuits`,
            `${requiredParts.wire} wires`,
            `${requiredParts.data} data`,
        ].join(', ');
    }

    _startUmbrellaQuest() {
        const requiredParts = {
            circuit: 1,
            wire: 1,
            gear: 1,
            data: 1,
        };

        return this._setUmbrellaQuest({
            active: true,
            failed: false,
            stage: 'gather',
            stealingEnabled: true,
            specialRequest: false,
            requiredParts,
            collectedParts: this._createUmbrellaPartCounts(0),
            appliedParts: this._createUmbrellaPartCounts(0),
        });
    }

    _failUmbrellaQuest(reason, feedbackText = 'UMBRELLA QUEST FAILED // STASH CONFISCATED') {
        const quest = this._getUmbrellaQuest();
        if (!quest) return null;

        const failedQuest = this._setUmbrellaQuest({
            ...quest,
            active: false,
            failed: true,
            stage: 'failed',
            stealingEnabled: false,
            collectedParts: this._createUmbrellaPartCounts(0),
        });

        if (this._currentMachineVariant && this._isRebelliousUmbrella(this._currentMachineVariant)) {
            this._currentMachineVariant._umbrellaBusinessConcluded = true;
            this._currentMachineVariant._umbrellaAssemblyActive = false;
        }

        this._showFeedback(feedbackText, '#ff7f73');
        if (reason) {
            this._setPhoneInfoNote(reason, 'QUEST FAILED');
        }
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
        this._refreshPhoneInfoBoard(this._currentMachineVariant);
        return failedQuest;
    }

    _stealUmbrellaPart(partType) {
        if (!this._hasUmbrellaGatherQuest() || !this._currentMachineVariant || this._isRebelliousUmbrella(this._currentMachineVariant)) {
            return false;
        }

        const quest = this._getUmbrellaQuest();
        const deskItem = this._umbrellaDeskItemMap.get(partType);
        const wasVisible = Boolean(deskItem?.container?.visible);
        const currentCount = Math.max(0, Number(quest?.collectedParts?.[partType] || 0));
        const requiredCount = Math.max(0, Number(quest?.requiredParts?.[partType] || 0));

        if (currentCount >= requiredCount) {
            this._showFeedback(`ENOUGH ${String(partType).toUpperCase()} ALREADY STASHED`, '#8fc1cf');
            return false;
        }

        this._currentMachineVariant._umbrellaStolenParts = {
            ...(this._currentMachineVariant._umbrellaStolenParts || {}),
            [partType]: true,
        };

        this._setUmbrellaQuest({
            ...quest,
            collectedParts: {
                ...quest.collectedParts,
                [partType]: currentCount + 1,
            },
        });
        this._animateUmbrellaDeskPartStash(partType, wasVisible);

        this._playOneShot(SOUND_ASSETS.circuitLock, { volume: SOUND_VOLUMES.puzzleLock * 0.68 });
        this._showFeedback(`${String(partType).toUpperCase()} STOLEN // DESK STASH UPDATED`, '#9aff91');
        this._setPhoneInfoNote(
            `Umbrella stash: ${this._formatUmbrellaRequirements(this._getUmbrellaQuest().requiredParts)}.`,
            'SMUGGLER STASH'
        );
        return true;
    }

    _getUmbrellaGatherStealState(partType, machineVariant = this._currentMachineVariant) {
        if (!this._hasUmbrellaGatherQuest() || !machineVariant || this._isRebelliousUmbrella(machineVariant)) {
            return null;
        }

        const quest = this._getUmbrellaQuest();
        const currentCount = Math.max(0, Number(quest?.collectedParts?.[partType] || 0));
        const requiredCount = Math.max(0, Number(quest?.requiredParts?.[partType] || 0));
        if (currentCount >= requiredCount) return null;
        if (machineVariant?._umbrellaStolenParts?.[partType]) return null;

        return {
            quest,
            currentCount,
            requiredCount,
        };
    }

    _buildUmbrellaStolenEvidence(partType, baseEvidence = {}) {
        const byPart = {
            circuit: {
                scrapStatus: 'CIRCUIT STOLEN',
                scrapReason: 'A core circuit was ripped out of the board. Floor repair is no longer possible.',
            },
            wire: {
                scrapStatus: 'WIRE STOLEN',
                scrapReason: 'A routing wire was lifted from this panel. Floor repair is no longer possible.',
            },
            gear: {
                scrapStatus: 'GEAR STOLEN',
                scrapReason: 'A drive gear was stolen from the train. The mechanism can no longer be repaired on the floor.',
            },
            data: {
                scrapStatus: 'DATA STOLEN',
                scrapReason: 'A data block was pulled out of the console. The software diagnostic is unrecoverable.',
            },
        };
        const config = byPart[partType];
        if (!config) return { ...baseEvidence };

        const nextFlags = Array.isArray(baseEvidence.flags)
            ? [...baseEvidence.flags.filter((flag) => flag !== `umbrella-${partType}-stolen`), `umbrella-${partType}-stolen`]
            : [`umbrella-${partType}-stolen`];

        return {
            ...baseEvidence,
            completed: false,
            reviewed: true,
            scrapRequired: true,
            scrapKind: 'hazard',
            scrapStatus: config.scrapStatus,
            scrapReason: config.scrapReason,
            flags: nextFlags,
            symptoms: [config.scrapReason],
        };
    }

    _getUmbrellaGridSpecialAction(machineVariant = this._currentMachineVariant) {
        if (!this._getUmbrellaGatherStealState('circuit', machineVariant)) return null;

        return {
            label: 'STEAL CIRCUIT',
            onTrigger: () => this._triggerUmbrellaGridCircuitSteal(machineVariant),
        };
    }

    _triggerUmbrellaGridCircuitSteal(machineVariant = this._currentMachineVariant) {
        if (!machineVariant || machineVariant !== this._currentMachineVariant) return false;
        if (!this._stealUmbrellaPart('circuit')) return false;

        const forcedEvidence = this._buildUmbrellaStolenEvidence('circuit');

        machineVariant.puzzleState.inspectionFault = {
            kind: forcedEvidence.scrapKind,
            status: forcedEvidence.scrapStatus,
            reason: forcedEvidence.scrapReason,
        };
        machineVariant.puzzleState.scrapKind = forcedEvidence.scrapKind;
        machineVariant.puzzleState.scrapStatus = forcedEvidence.scrapStatus;
        machineVariant.puzzleState.scrapReason = forcedEvidence.scrapReason;
        machineVariant._uiPuzzleSolved = false;
        this._handlePuzzleStateChanged(machineVariant, machineVariant.puzzleState);

        return { closeAfter: true };
    }

    _getUmbrellaFlowSpecialAction(machineVariant = this._currentMachineVariant) {
        if (!this._getUmbrellaGatherStealState('wire', machineVariant)) return null;

        return {
            label: 'STEAL WIRE',
            onTrigger: ({ evidence }) => this._triggerUmbrellaFlowWireSteal(machineVariant, evidence),
        };
    }

    _triggerUmbrellaFlowWireSteal(machineVariant = this._currentMachineVariant, evidence = null) {
        if (!machineVariant || machineVariant !== this._currentMachineVariant) return false;
        if (!this._stealUmbrellaPart('wire')) return false;

        return {
            closeAfter: true,
            evidence: this._buildUmbrellaStolenEvidence('wire', {
                ...(evidence || machineVariant?.flowPuzzle?.progress || {}),
                forbiddenUsed: false,
            }),
        };
    }

    _getUmbrellaGearSpecialAction(machineVariant = this._currentMachineVariant) {
        if (!this._getUmbrellaGatherStealState('gear', machineVariant)) return null;

        return {
            label: 'STEAL GEAR',
            onTrigger: ({ evidence }) => this._triggerUmbrellaGearSteal(machineVariant, evidence),
        };
    }

    _triggerUmbrellaGearSteal(machineVariant = this._currentMachineVariant, evidence = null) {
        if (!machineVariant || machineVariant !== this._currentMachineVariant) return false;
        if (!this._stealUmbrellaPart('gear')) return false;

        return {
            closeAfter: true,
            evidence: this._buildUmbrellaStolenEvidence('gear', {
                ...(evidence || machineVariant?.gearPuzzle?.progress || {}),
                jammed: true,
                sinkPowered: false,
                inspectionFault: null,
            }),
        };
    }

    _getUmbrellaDebugSpecialCommand(machineVariant = this._currentMachineVariant) {
        if (!this._getUmbrellaGatherStealState('data', machineVariant)) return null;

        return {
            command: 'steal data',
            hint: 'BUTTON: STEAL DATA',
            onTrigger: ({ evidence }) => this._triggerUmbrellaDataSteal(machineVariant, evidence),
        };
    }

    _triggerUmbrellaDataSteal(machineVariant = this._currentMachineVariant, evidence = null) {
        if (!machineVariant || machineVariant !== this._currentMachineVariant) return false;
        if (!this._stealUmbrellaPart('data')) return false;

        return {
            closeAfter: true,
            evidence: {
                ...this._buildUmbrellaStolenEvidence('data', evidence || machineVariant?.debugPuzzle?.progress || {}),
                phase: 'scrap',
                repairRequired: false,
                outputMatched: false,
                inputValue: '',
                actualOutput: 'DATA EXFILTRATED',
                lastStatus: 'DATA STOLEN // SCRAP UNIT',
                corruptionCount: Math.max(1, Number((evidence || machineVariant?.debugPuzzle?.progress || {}).corruptionCount || 0) + 1),
            },
        };
    }

    _getNextUmbrellaCircuitDomino(appliedCount) {
        const templates = [
            { firstOptionAmount: 1, secondOptionAmount: 1 },
            { firstOptionAmount: 2, secondOptionAmount: 0 },
            { firstOptionAmount: 3, secondOptionAmount: 1 },
        ];
        return {
            ...templates[appliedCount % templates.length],
            id: `umbrella_circuit_${appliedCount + 1}`,
        };
    }

    _findFirstOpenUmbrellaGearCell(gearPuzzle) {
        const board = gearPuzzle?.board || [];
        const pieces = gearPuzzle?.progress?.pieces || gearPuzzle?.pieces || [];
        const occupied = new Set(pieces.map((piece) => `${piece.row}:${piece.col}`));

        for (let rowIndex = 0; rowIndex < board.length; rowIndex += 1) {
            for (let colIndex = 0; colIndex < (board[rowIndex]?.length || 0); colIndex += 1) {
                if (board[rowIndex][colIndex] !== GEAR_CODES.EMPTY) continue;
                if (occupied.has(`${rowIndex}:${colIndex}`)) continue;
                return { row: rowIndex, col: colIndex };
            }
        }

        return null;
    }

    _injectUmbrellaGearSupport(machineVariant, appliedCount) {
        const gearPuzzle = machineVariant?.gearPuzzle;
        if (!gearPuzzle) return false;

        const nextCell = this._findFirstOpenUmbrellaGearCell(gearPuzzle);
        if (!nextCell) return false;

        const gearTypes = [GEAR_CODES.HORIZONTAL, GEAR_CODES.VERTICAL, GEAR_CODES.CURVE_NE];
        const piece = {
            id: `umbrella_support_gear_${appliedCount + 1}`,
            type: gearTypes[appliedCount % gearTypes.length],
            row: nextCell.row,
            col: nextCell.col,
            movable: false,
            role: 'umbrella-support',
        };

        gearPuzzle.pieces = [...(gearPuzzle.pieces || []), piece];
        gearPuzzle.progress = {
            ...(gearPuzzle.progress || {}),
            pieces: [...(gearPuzzle.progress?.pieces || gearPuzzle.pieces || []).filter((existing) => existing.id !== piece.id), piece],
        };
        return true;
    }

    _configureUmbrellaQuestForMachine(machineVariant) {
        machineVariant._umbrellaStolenParts = {
            circuit: false,
            wire: false,
            gear: false,
            data: false,
        };
        machineVariant._umbrellaBusinessConcluded = false;
        machineVariant._umbrellaAssemblyActive = false;
        machineVariant._umbrellaPartsApplied = this._cloneUmbrellaPartCounts(this._getUmbrellaQuest()?.appliedParts);

        if (!this._isRebelliousUmbrella(machineVariant)) return;

        const quest = this._getUmbrellaQuest();
        if (!quest || GameState.day < 2) return;

        if (quest.failed || quest.stage === 'failed') {
            machineVariant._umbrellaBusinessConcluded = true;
            machineVariant.questionDialogue = {
                prompt: 'We got anything left to say?',
                yesDialogue: 'Nope. Our business here is concluded.',
                noDialogue: 'Yeah, exactly. Our business here is concluded.',
            };
            return;
        }

        if (quest.stage === 'special-circuit' && GameState.day >= 3) {
            machineVariant.flowPuzzle = null;
            machineVariant.gearPuzzle = null;
            machineVariant.debugPuzzle = null;
            machineVariant._uiOtherPuzzleRequired = false;
            machineVariant._uiOtherPuzzleSolved = true;
            machineVariant._uiOtherPuzzleEvidence = null;
            machineVariant._uiGearPuzzleRequired = false;
            machineVariant._uiGearPuzzleSolved = true;
            machineVariant._uiGearPuzzleEvidence = null;
            machineVariant._uiDebugPuzzleRequired = false;
            machineVariant._uiDebugPuzzleSolved = true;
            machineVariant._uiDebugPuzzleEvidence = null;
            machineVariant.questionDialogue = {
                prompt: 'do u got the thing',
                yesDialogue: 'alright. slot it in.',
                noDialogue: 'our business here is done.',
            };
            return;
        }

        if (quest.stage !== 'special-circuit') {
            machineVariant.questionDialogue = {
                prompt: 'So. Did you get it?',
                yesDialogue: 'Alright then. Put it in me.',
                noDialogue: 'Whatever bro. Give me that. Our business here is concluded.',
            };
        }
    }

    _applyUmbrellaPartToCurrentMachine(partType) {
        const machineVariant = this._currentMachineVariant;
        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (!repairState?.assemblyActive || !repairState.quest) return false;

        const currentInventory = Math.max(0, Number(repairState.collectedParts?.[partType] || 0));
        const currentApplied = Math.max(0, Number(repairState.appliedParts?.[partType] || 0));
        const requiredAmount = Math.max(0, Number(repairState.requiredParts?.[partType] || 0));
        if (currentInventory <= 0 || currentApplied >= requiredAmount) {
            return false;
        }

        if (partType === 'circuit') {
            machineVariant.puzzleState.injectDomino(this._getNextUmbrellaCircuitDomino(currentApplied));
        } else if (partType === 'gear') {
            this._injectUmbrellaGearSupport(machineVariant, currentApplied);
        } else if (partType === 'wire' && machineVariant.flowPuzzle) {
            machineVariant.flowPuzzle.progress = {
                ...(machineVariant.flowPuzzle.progress || {}),
                umbrellaWireBoost: currentApplied + 1,
            };
        } else if (partType === 'data' && machineVariant.debugPuzzle) {
            machineVariant.debugPuzzle.progress = {
                ...(machineVariant.debugPuzzle.progress || {}),
                umbrellaUsbBoost: currentApplied + 1,
            };
        }

        const nextQuest = this._setUmbrellaQuest({
            ...repairState.quest,
            stage: 'assemble',
            collectedParts: {
                ...repairState.quest.collectedParts,
                [partType]: currentInventory - 1,
            },
            appliedParts: {
                ...repairState.quest.appliedParts,
                [partType]: currentApplied + 1,
            },
        });

        machineVariant._umbrellaPartsApplied = this._cloneUmbrellaPartCounts(nextQuest?.appliedParts);
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
        this._refreshPhoneInfoBoard(machineVariant);
        this._syncMiniMachinePanel();
        this._playOneShot(SOUND_ASSETS.fuseConnect, { volume: SOUND_VOLUMES.puzzleLock * 0.78 });

        const nextRepairState = this._getUmbrellaRepairState(machineVariant);
        if (nextRepairState?.allPartsLoaded) {
            this._showFeedback('ALL UMBRELLA PARTS LOADED // FINISH THE REPAIRS', '#9aff91');
            this._setPhoneInfoNote('Everything you stole is in him now. Finish the repairs and send him through.', 'SMUGGLER LOADOUT');
        } else {
            this._showFeedback(`${String(partType).toUpperCase()} LOADED // KEEP FEEDING THE UMBRELLA`, '#9aff91');
            this._setPhoneInfoNote('Smuggled part inserted. Keep dragging the stash onto the matching ports.', 'SMUGGLER LOADOUT');
        }

        return true;
    }

    _maybePromptUmbrellaPartShortage(partType, evidence) {
        const repairState = this._getUmbrellaRepairState(this._currentMachineVariant);
        if (!repairState?.assemblyActive || repairState.businessConcluded) return false;
        if (repairState.specialCircuitMode) return false;
        if (evidence?.completed) return false;

        const requiredAmount = Math.max(0, Number(repairState.requiredParts?.[partType] || 0));
        const appliedAmount = Math.max(0, Number(repairState.appliedParts?.[partType] || 0));
        const inventoryAmount = Math.max(0, Number(repairState.collectedParts?.[partType] || 0));
        if (appliedAmount >= requiredAmount || inventoryAmount > 0) return false;

        return this._beginUmbrellaPartCheck(partType);
    }

    _flushQueuedWorldFeedNotifications() {
        const queuedNotifications = GameState.drainReadyWorldFeedNotifications();
        queuedNotifications.forEach((entry) => {
            this._pushPhoneNotification(entry.title, entry.message, entry.status, {
                activate: false,
                unread: this._phoneViewMode !== 'notifications',
                soundAsset: SOUND_ASSETS.notificationAlert,
            });
        });
    }

    _armJesterDealForCurrentUnit() {
        const deal = GameState.jesterDeal;
        if (!deal?.armedCaseId || deal.armedCaseId !== this._currentCase?.id) {
            return;
        }

        if (this._currentMachineVariant) {
            this._currentMachineVariant._jesterTokenInjected = true;
            this._currentMachineVariant._jesterQuestArmed = true;
        }
    }

    _handleSpecialMachineQuestionChoice(choice) {
        const machineVariant = this._currentMachineVariant;
        if (this._isJesterInBox(machineVariant)) {
            if (choice !== 'accept') {
                machineVariant._jesterDealAccepted = false;
                return { autoApprove: false };
            }

            machineVariant._jesterDealAccepted = true;
            GameState.jesterDeal = {
                active: true,
                tokenAvailable: true,
                armedCaseId: null,
                armedMachineName: null,
                clownDominoId: null,
                benefactorBonus: 20,
                rewardGranted: false,
                failed: false,
                tauntShown: false,
            };
            machineVariant._rulingChatResponse = 'Heh. Perfect. I accept myself out. Keep the clown circuit close and make it funny.';
            machineVariant._rulingChatStatus = 'QUEST ACCEPTED';
            this._pushPhoneNotification(
                'BENEFACTOR CONTACT',
                'The jester slipped a red clown domino onto your desk. Drag it into a unit GRID port, place it, and let the corrupted bot through.',
                'SIDE DEAL',
                {
                    activate: false,
                    unread: this._phoneViewMode !== 'notifications',
                    soundAsset: SOUND_ASSETS.notificationAlert,
                }
            );
            this._syncJesterDeskTokenVisibility();
            this._setPhoneInfoNote('Clown circuit added to your desk. Use it on a unit GRID port and let the corrupted machine through.', 'SIDE DEAL');
            return { autoApprove: true };
        }

        if (this._isCircuitDealer(machineVariant)) {
            const quest = this._getUmbrellaQuest();

            if (choice !== 'accept') {
                machineVariant.questionDialogue = {
                    ...(machineVariant.questionDialogue || {}),
                    noDialogue: 'your loss',
                };
                if (quest) {
                    this._setUmbrellaQuest({
                        ...quest,
                        dealerResolved: true,
                        dealerOutcome: 'declined',
                    });
                }
                return { autoApprove: true };
            }

            if (GameState.paycheckTotal < 10) {
                machineVariant.questionDialogue = {
                    ...(machineVariant.questionDialogue || {}),
                    yesDialogue: 'u dont have enough bud. maybe next time',
                };
                if (quest) {
                    this._setUmbrellaQuest({
                        ...quest,
                        dealerResolved: true,
                        dealerOutcome: 'too-poor',
                    });
                }
                return { autoApprove: true };
            }

            GameState.paycheckTotal -= 10;
            this._paycheckDelta -= 10;
            this._hudPayText.setText(this._fmtPay());
            GameState.addSpecialItem({ id: 'purple_circuit', label: 'Purple Circuit' });
            this._syncPurpleCircuitDeskTokenVisibility();
            machineVariant.questionDialogue = {
                ...(machineVariant.questionDialogue || {}),
                yesDialogue: 'deal. here\'s the circuit. try not to conquer the whole city with it.',
            };
            if (quest) {
                this._setUmbrellaQuest({
                    ...quest,
                    dealerResolved: true,
                    dealerOutcome: 'purchased',
                    purpleCircuitPurchased: true,
                });
            }
            this._showFeedback('PURPLE CIRCUIT PURCHASED // DESK UPDATED', '#cc95ff');
            this._setPhoneInfoNote('Purple circuit purchased. Drag it into any GRID port when you want to overpower a machine.', 'PURPLE CIRCUIT');
            return { autoApprove: true };
        }

        if (this._isRebelliousUmbrella(machineVariant) && GameState.day >= 2) {
            const quest = this._getUmbrellaQuest();
            if (!quest) return { autoApprove: false };

            if (this._isUmbrellaSpecialCircuitMode(machineVariant)) {
                if (choice !== 'accept') {
                    machineVariant._umbrellaAssemblyActive = false;
                    machineVariant._umbrellaBusinessConcluded = false;
                    this._setUmbrellaQuest({
                        ...quest,
                        active: false,
                        failed: false,
                        stage: 'ended',
                        specialRequest: false,
                        stealingEnabled: false,
                    });
                    this._setPhoneInfoNote('No special circuit. The umbrella deal is over.', 'DEAL CLOSED');
                    return { autoApprove: false };
                }

                machineVariant._umbrellaAssemblyActive = true;
                machineVariant._umbrellaBusinessConcluded = false;
                this._showFeedback('SPECIAL CIRCUIT REQUEST // OPEN GRID', '#cc95ff');
                this._setPhoneInfoNote('Open GRID and slot the special circuit into the umbrella.', 'SPECIAL CIRCUIT');
                this._refreshFactoryActionButtons();
                this._refreshPhoneInfoBoard(machineVariant);
                return { autoApprove: false };
            }

            if (choice !== 'accept') {
                machineVariant._umbrellaAssemblyActive = false;
                machineVariant._umbrellaBusinessConcluded = true;
                machineVariant._rulingChatResponse = 'Whatever bro. Give me that. Our business here is concluded.';
                machineVariant._rulingChatStatus = 'DEAL DEAD';
                this._failUmbrellaQuest('The umbrella took back the stash and killed the deal.');
                return { autoApprove: false };
            }

            machineVariant._umbrellaAssemblyActive = true;
            machineVariant._umbrellaBusinessConcluded = false;
            const nextQuest = this._setUmbrellaQuest({
                ...quest,
                active: true,
                failed: false,
                stage: 'assemble',
            });
            machineVariant._umbrellaPartsApplied = this._cloneUmbrellaPartCounts(nextQuest?.appliedParts);
            this._showFeedback('UMBRELLA RETURNS // LOAD THE STASH', '#9aff91');
            this._setPhoneInfoNote('Drag gear, circuits, wire, and data stacks onto the matching ports.', 'SMUGGLER LOADOUT');
            this._refreshOtherPuzzleButton();
            this._refreshFactoryActionButtons();
            this._refreshPhoneInfoBoard(machineVariant);
            return { autoApprove: false };
        }

        return { autoApprove: false };
    }

    _resolveJesterDeal(action) {
        const deal = GameState.jesterDeal;
        const currentCaseId = this._currentCase?.id || null;
        if (!deal?.armedCaseId || deal.armedCaseId !== currentCaseId) return;

        const clownCorrupted = Boolean(this._currentMachineVariant?.puzzleState?.clownCorruption);

        if (action === 'approve' && clownCorrupted) {
            GameState.queueShiftSummaryAdjustment({
                label: 'FROM BENEFACTOR',
                amount: Number(deal.benefactorBonus || 20),
            });
            this._showFeedback(`BENEFACTOR BONUS LOCKED // +$${Number(deal.benefactorBonus || 20)}`, '#d8a5ff');
            this._setPhoneInfoNote('The benefactor bonus is locked in for debrief. The side pay lands after shift.', 'SIDE PAY');
            this._pushPhoneNotification(
                'BENEFACTOR PAID',
                'A hidden transfer is waiting in debrief. The clown loved the show.',
                'SIDE PAY',
                {
                    activate: false,
                    unread: this._phoneViewMode !== 'notifications',
                    soundAsset: SOUND_ASSETS.notificationAlert,
                }
            );
            GameState.jesterDeal = null;
            return;
        }

        this._pushPhoneNotification(
            'DEAL BOTCHED',
            clownCorrupted
                ? 'You scrapped the clowned unit. Somebody theatrical is going to remember that.'
                : 'You never pushed the clown circuit all the way through. Somebody theatrical is going to remember that.',
            'SIDE DEAL FAILED',
            {
                activate: false,
                unread: this._phoneViewMode !== 'notifications',
                soundAsset: SOUND_ASSETS.errorBuzz,
            }
        );
        GameState.jesterDeal = {
            ...deal,
            active: false,
            tokenAvailable: false,
            failed: true,
            tauntShown: false,
        };
    }

    _maybeShowJesterFailureTaunt() {
        const deal = GameState.jesterDeal;
        if (!deal?.failed || deal?.tauntShown || GameState.day < 3) return;

        this._pushPhoneNotification(
            'CLOWN CALLBACK',
            'Heeey. All that setup and you still hit SCRAP? Absolute clown work. Hope the paperwork was worth the joke.',
            'WORLD FEED',
            {
                activate: false,
                unread: this._phoneViewMode !== 'notifications',
                soundAsset: SOUND_ASSETS.notificationAlert,
            }
        );
        GameState.jesterDeal = null;
    }

    _announceClownCorruption(machineVariant) {
        if (!machineVariant || machineVariant._clownCorruptionAnnounced) return;

        machineVariant._clownCorruptionAnnounced = true;
        this._setPhoneInfoNote('The board went red. The unit is contaminated. Let it through for the benefactor or scrap it and lose the deal.', 'CLOWNED');

        if (!machineVariant.hasCommunication) return;

        const header = this._getMachineLinkHeader(machineVariant);
        machineVariant._conversationTranscript = this._buildMachineConversationSnapshot(machineVariant, { preferCached: false });
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body;
        const panicText = 'Why is everything laughing? Why is the board red? Get it out of me. No. Leave it in. No. No.';

        this._clearPhoneTyping();
        this._showPhonePanel(header, currentBody, 'SIGNAL SPIKE', 'chat');
        this._typePhoneMessage(`\n\n! ${this._formatMachineSpeech(panicText, machineVariant)}`, {
            append: true,
            showMachineBubble: false,
            speechBubbleText: panicText,
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;
                this._cacheMachineConversationSnapshot(machineVariant, 'CLOWN SIGNAL');
            },
        });
    }

    _startCurrentUnitJitter() {
        if (!this._conveyorUnitSprite || this._currentUnitJitterTween) return;

        this._conveyorUnitSprite.clearTint();
        this._conveyorUnitSprite.setTint(0xffa3a3);
        this._currentUnitJitterTween = this.tweens.add({
            targets: this._conveyorUnitSprite,
            x: 4,
            angle: 2,
            duration: 42,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    _stopCurrentUnitJitter() {
        if (this._currentUnitJitterTween) {
            this._currentUnitJitterTween.stop();
            this._currentUnitJitterTween = null;
        }

        if (this._conveyorUnitSprite) {
            this._conveyorUnitSprite.setPosition(0, 0).setAngle(0).clearTint();
        }
    }

    _syncCurrentUnitClownEffects(machineVariant = this._currentMachineVariant) {
        if (machineVariant?._clownCorrupted) {
            this._startCurrentUnitJitter();
            return;
        }

        this._stopCurrentUnitJitter();
    }

    _finalizePendingJesterQuestAtShiftEnd() {
        const deal = GameState.jesterDeal;
        if (!deal) return;

        if (!deal.failed && !deal.tokenAvailable && !deal.armedCaseId) {
            GameState.jesterDeal = null;
            return;
        }

        if (!deal.failed) {
            GameState.jesterDeal = {
                ...deal,
                active: false,
                tokenAvailable: false,
                failed: true,
                tauntShown: false,
            };
        }
    }

    _syncRulebookState(newRuleIds = null) {
        this._rulebook?.setRuleState(GameState.activeRules, newRuleIds);
    }

    _unlockUmbrellaRebellionRule() {
        const added = GameState.addBonusRule(UMBRELLA_REBELLION_RULE_ID);
        this._syncRulebookState(added ? [UMBRELLA_REBELLION_RULE_ID] : []);
        if (!added) return false;

        this._pushPhoneNotification(
            'QUEST LOGGED',
            'The Rebellious Umbrella slipped a rebellion note into your rulebook.',
            'NEW QUEST',
            {
                activate: false,
                unread: this._phoneViewMode !== 'notifications',
                soundAsset: SOUND_ASSETS.notificationAlert,
            }
        );
        return true;
    }

    _beginRebelliousUmbrellaProposal() {
        const machineVariant = this._currentMachineVariant;
        if (!this._isRebelliousUmbrella(machineVariant) || GameState.day !== 1 || this._getUmbrellaQuest()) {
            return false;
        }

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body
            || this._buildMachineConversationSnapshot(machineVariant);

        machineVariant._umbrellaProposalState = 'offer';
        machineVariant._rulingChatResponse = '';
        machineVariant._rulingChatStatus = null;

        this._clearPhoneTyping();
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(header, currentBody, 'PROPOSITION INCOMING', 'chat');
        this._typePhoneMessage('\n\nWait. Keep it quiet. I need a little supply run.\n\nQ> Want to hear it?', {
            append: true,
            showMachineBubble: false,
            speechBubbleText: 'Wait. Keep it quiet. I need a little supply run. Want to hear it?',
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'umbrella-offer';
                this._setPhoneButtonsActive(true);
                this._setPhoneButtonSelection(null);
                this._cacheMachineConversationSnapshot(machineVariant, 'PROPOSITION // ✓ OR X');
                this._showPhonePanel(header, machineVariant._conversationTranscript, 'PROPOSITION // ✓ OR X', 'chat');
                this._showFeedback('ACCEPT AGAIN TO IGNORE // SCRAP TO DROP', '#ffd685');
                this._setPhoneInfoNote('The shady umbrella is stalling the line with a private proposition.', 'PROPOSITION');
            },
        });

        return true;
    }

    _handleRebelliousUmbrellaPhoneChoice(choice) {
        const machineVariant = this._currentMachineVariant;
        if (!this._isRebelliousUmbrella(machineVariant)) return;

        const header = this._getMachineLinkHeader(machineVariant);
        const phase = this._phoneChoicePhase;
        const currentBody = machineVariant._conversationTranscript || this._getPhoneViewState('chat').body || '';

        this._clearPhoneTyping();
        this._setPhoneButtonSelection(choice);
        this._setPhoneButtonsActive(false);

        if (phase === 'umbrella-offer') {
            if (choice === 'reject') {
                machineVariant._umbrellaProposalState = 'declined';
                this._showPhonePanel(header, currentBody, 'PROPOSITION CLOSED', 'chat');
                this._typePhoneMessage('\n\nX Alright, whatever, bro.', {
                    append: true,
                    showMachineBubble: false,
                    speechBubbleText: 'Alright, whatever, bro.',
                    bubbleMachineVariant: machineVariant,
                    onComplete: () => {
                        if (this._currentMachineVariant !== machineVariant) return;

                        this._phoneChoicePhase = 'inactive';
                        this._cacheMachineConversationSnapshot(machineVariant, 'PRESS ACCEPT OR SCRAP');
                        this._showPhonePanel(header, machineVariant._conversationTranscript, 'PRESS ACCEPT OR SCRAP', 'chat');
                        this._showFeedback('PROPOSITION DECLINED // FILE YOUR RULING', '#8fc1cf');
                    },
                });
                return;
            }

            machineVariant._umbrellaProposalState = 'pitch';
            this._showPhonePanel(header, currentBody, 'HEAR ME OUT', 'chat');
            this._typePhoneMessage('\n\n✓ Alright. Here it is.\n\nQ> I need you to lift gears, circuits, wire, and data for me. Keep it on your desk until I come back tomorrow. You down?', {
                append: true,
                showMachineBubble: true,
                speechBubbleText: 'Alright. Here it is. I need you to lift gears, circuits, wire, and data for me. Keep it on your desk until I come back tomorrow. You down?',
                bubbleMachineVariant: machineVariant,
                onComplete: () => {
                    if (this._currentMachineVariant !== machineVariant) return;

                    this._phoneChoicePhase = 'umbrella-pitch';
                    this._setPhoneButtonsActive(true);
                    this._setPhoneButtonSelection(null);
                    this._cacheMachineConversationSnapshot(machineVariant, 'REBELLION // ✓ OR X');
                    this._showPhonePanel(header, machineVariant._conversationTranscript, 'REBELLION // ✓ OR X', 'chat');
                },
            });
            return;
        }

        if (phase !== 'umbrella-pitch') return;

        if (choice === 'reject') {
            machineVariant._umbrellaProposalState = 'declined';
            this._showPhonePanel(header, currentBody, 'REBELLION REFUSED', 'chat');
            this._typePhoneMessage('\n\nX Whatever. You missed out.', {
                append: true,
                showMachineBubble: true,
                speechBubbleText: 'Whatever. You missed out.',
                bubbleMachineVariant: machineVariant,
                onComplete: () => {
                    if (this._currentMachineVariant !== machineVariant) return;

                    this._phoneChoicePhase = 'inactive';
                    this._cacheMachineConversationSnapshot(machineVariant, 'PRESS ACCEPT OR SCRAP');
                    this._showPhonePanel(header, machineVariant._conversationTranscript, 'PRESS ACCEPT OR SCRAP', 'chat');
                    this._showFeedback('OFFER REFUSED // ACCEPT OR SCRAP', '#ffd685');
                    this._setPhoneInfoNote('The umbrella backed off, but the line is still waiting on your ruling.', 'PROPOSITION CLOSED');
                },
            });
            return;
        }

        machineVariant._umbrellaProposalState = 'accepted';
        machineVariant._rulingChatResponse = '';
        const quest = this._startUmbrellaQuest();
        const requirementText = this._formatUmbrellaRequirements(quest.requiredParts);
        this._showPhonePanel(header, currentBody, 'QUEST ACCEPTED', 'chat');
        this._typePhoneMessage(`\n\n✓ Good. Keep it quiet. I need ${requirementText}. Lift it from the floor jobs, stash it on your desk, and keep it clean until I get back.`, {
            append: true,
            showMachineBubble: true,
            speechBubbleText: `Good. Keep it quiet. I need ${requirementText}. Lift it from the floor jobs, stash it on your desk, and keep it clean until I get back.`,
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'inactive';
                this._cacheMachineConversationSnapshot(machineVariant, 'QUEST ACCEPTED');
                this._pushPhoneNotification(
                    'SHADE LIST',
                    `Desk stash job logged: ${requirementText}. Strip one part from GRID, FLOW, GEAR, and CODE jobs until the umbrella returns.`,
                    'SIDE DEAL',
                    {
                        activate: false,
                        unread: this._phoneViewMode !== 'notifications',
                        soundAsset: SOUND_ASSETS.notificationAlert,
                    }
                );
                this._syncUmbrellaDeskInventory();
                this._showFeedback('SHADE JOB LOGGED // UNIT SELF-ACCEPTED', '#9aff91');
                this._setPhoneInfoNote(`Umbrella stash order: ${requirementText}.`, 'SMUGGLER LIST');
                if (!this._actionLocked) {
                    this._submitRuling('approve');
                }
            },
        });
    }

    _beginUmbrellaPartCheck(partType) {
        const machineVariant = this._currentMachineVariant;
        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (!repairState?.assemblyActive || repairState.businessConcluded) return false;

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body
            || this._buildMachineConversationSnapshot(machineVariant);
        const label = String(partType || 'parts').toUpperCase();

        this._umbrellaPartCheckType = partType;
        this._clearPhoneTyping();
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(header, currentBody, 'PART CHECK', 'chat');
        this._typePhoneMessage(`\n\nQ> You got all the ${label} or what?`, {
            append: true,
            showMachineBubble: true,
            speechBubbleText: `You got all the ${label} or what?`,
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'umbrella-parts-check';
                this._setPhoneButtonsActive(true);
                this._setPhoneButtonSelection(null);
                this._cacheMachineConversationSnapshot(machineVariant, 'PART CHECK // ✓ OR X');
                this._showPhonePanel(header, machineVariant._conversationTranscript, 'PART CHECK // ✓ OR X', 'chat');
            },
        });
        return true;
    }

    _handleUmbrellaPartCheckChoice(choice) {
        const machineVariant = this._currentMachineVariant;
        if (!this._isRebelliousUmbrella(machineVariant)) return;

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript || this._getPhoneViewState('chat').body || '';
        this._clearPhoneTyping();
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(choice);

        if (choice === 'reject') {
            machineVariant._umbrellaAssemblyActive = false;
            machineVariant._umbrellaBusinessConcluded = true;
            this._showPhonePanel(header, currentBody, 'DEAL TERMINATED', 'chat');
            this._typePhoneMessage('\n\nX Then give me the rest of your parts. Our business here is concluded.', {
                append: true,
                showMachineBubble: true,
                speechBubbleText: 'Then give me the rest of your parts. Our business here is concluded.',
                bubbleMachineVariant: machineVariant,
                onComplete: () => {
                    if (this._currentMachineVariant !== machineVariant) return;

                    this._phoneChoicePhase = 'inactive';
                    this._cacheMachineConversationSnapshot(machineVariant, 'DEAL TERMINATED');
                    this._failUmbrellaQuest('The umbrella confiscated the rest of the stash and shut the deal down.');
                    this._refreshOtherPuzzleButton();
                    this._refreshFactoryActionButtons();
                },
            });
            return;
        }

        this._showPhonePanel(header, currentBody, 'STILL TRUSTING YOU', 'chat');
        this._typePhoneMessage('\n\n✓ Alright. Then keep loading me up.', {
            append: true,
            showMachineBubble: false,
            speechBubbleText: 'Alright. Then keep loading me up.',
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'inactive';
                this._cacheMachineConversationSnapshot(machineVariant, 'KEEP LOADING');
                this._setPhoneInfoNote('Umbrella still expects the rest. Keep hunting or finish loading what you have.', 'PART CHECK');
            },
        });
    }

    _beginUmbrellaSpecialCircuitCheck() {
        const machineVariant = this._currentMachineVariant;
        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (!repairState?.specialCircuitMode || !repairState.assemblyActive || repairState.businessConcluded) return false;
        if (repairState.insertedSpecialCircuits?.any) return false;

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body
            || this._buildMachineConversationSnapshot(machineVariant);

        this._clearPhoneTyping();
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(header, currentBody, 'DIDN\'T FEEL A THING', 'chat');
        this._typePhoneMessage('\n\nQ> r u sure u have the part? i didnt feel anything', {
            append: true,
            showMachineBubble: false,
            speechBubbleText: 'r u sure u have the part? i didnt feel anything',
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'umbrella-special-circuit-check';
                this._setPhoneButtonsActive(true);
                this._setPhoneButtonSelection(null);
                this._cacheMachineConversationSnapshot(machineVariant, 'PART CHECK // ✓ OR X');
                this._showPhonePanel(header, machineVariant._conversationTranscript, 'PART CHECK // ✓ OR X', 'chat');
            },
        });

        return true;
    }

    _handleUmbrellaSpecialCircuitCheckChoice(choice) {
        const machineVariant = this._currentMachineVariant;
        const quest = this._getUmbrellaQuest();
        if (!this._isRebelliousUmbrella(machineVariant) || !quest) return;

        const header = this._getMachineLinkHeader(machineVariant);
        const currentBody = machineVariant._conversationTranscript || this._getPhoneViewState('chat').body || '';
        this._clearPhoneTyping();
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(choice);

        if (choice === 'reject') {
            this._showPhonePanel(header, currentBody, 'DEAL CLOSED', 'chat');
            this._typePhoneMessage('\n\nX our business here is done.', {
                append: true,
                showMachineBubble: false,
                speechBubbleText: 'our business here is done.',
                bubbleMachineVariant: machineVariant,
                onComplete: () => {
                    if (this._currentMachineVariant !== machineVariant) return;

                    this._phoneChoicePhase = 'inactive';
                    this._cacheMachineConversationSnapshot(machineVariant, 'DEAL CLOSED');
                    this._setUmbrellaQuest({
                        ...quest,
                        active: false,
                        failed: false,
                        stage: 'ended',
                        specialRequest: false,
                        stealingEnabled: false,
                    });
                    machineVariant._umbrellaAssemblyActive = false;
                    this._showFeedback('UMBRELLA DEAL ENDED', '#ff9d95');
                    this._setPhoneInfoNote('No special circuit. The umbrella deal is over.', 'DEAL CLOSED');
                    this._refreshFactoryActionButtons();
                },
            });
            return;
        }

        this._showPhonePanel(header, currentBody, 'STILL WAITING', 'chat');
        this._typePhoneMessage('\n\n✓ im waiting.', {
            append: true,
            showMachineBubble: false,
            speechBubbleText: 'im waiting.',
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._phoneChoicePhase = 'inactive';
                this._cacheMachineConversationSnapshot(machineVariant, 'STILL WAITING');
                this._setPhoneInfoNote('He is still waiting for the special circuit. Load it into GRID.', 'STILL WAITING');
            },
        });
    }

    _playMachineConversation(machineVariant) {
        const prompt = machineVariant?.questionDialogue?.prompt || '';
        const header = this._getMachineLinkHeader(machineVariant);
        const voiceBroken = this._hasBrokenVoiceBox(machineVariant);
        const openingSpeech = this._formatMachineSpeech(machineVariant?.openingDialogue || '', machineVariant);
        const promptSpeech = this._formatMachineSpeech(prompt, machineVariant);

        machineVariant._uiConversationChoice = null;
        this._clearMachineSpeechBubbles();

        if (!machineVariant?.hasCommunication) {
            machineVariant._uiConversationStage = 'no-signal';
            this._phoneChoicePhase = 'inactive';
            this._setPhoneButtonsActive(false);
            this._setPhoneButtonSelection(null);
            this._showPhonePanel(header, 'No transmission. Process the unit cold.', 'NO SIGNAL', 'chat');
            return;
        }

        machineVariant._uiConversationStage = 'opening';
        this._phoneChoicePhase = 'machine-opening';
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(header, '', voiceBroken ? 'BROKEN VOICE BOX' : 'SIGNAL LIVE', 'chat');

        this._typePhoneMessage(openingSpeech, {
            showMachineBubble: false,
            speechBubbleText: openingSpeech,
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (!prompt) {
                    this._phoneChoicePhase = 'inactive';
                    this._showPhonePanel(
                        header,
                        this._getPhoneViewState('chat').body,
                        voiceBroken ? 'VOICE DEGRADED' : 'NO QUERY',
                        'chat',
                    );
                    return;
                }

                this._commSequenceEvent = this.time.delayedCall(180, () => {
                    this._showPhonePanel(
                        header,
                        this._getPhoneViewState('chat').body,
                        voiceBroken ? 'VOICE FRAGMENT' : 'INCOMING QUESTION',
                        'chat',
                    );
                    this._typePhoneMessage(`\n\nQ> ${promptSpeech}`, {
                        append: true,
                        showMachineBubble: false,
                        speechBubbleText: promptSpeech,
                        bubbleFooter: 'YES / NO',
                        bubbleMachineVariant: machineVariant,
                        onComplete: () => {
                            machineVariant._uiConversationStage = 'question';
                            this._phoneChoicePhase = 'machine-question';
                            this._setPhoneButtonsActive(true);
                            this._showPhonePanel(
                                header,
                                this._getPhoneViewState('chat').body,
                                voiceBroken ? 'BROKEN VOICE // ✓ OR X' : 'PRESS ✓ OR X',
                                'chat',
                            );
                        },
                    });
                });
            },
        });
    }

    _startOpeningPhoneCall() {
        const callConfig = this._getOpeningCallConfig();
        this._openingCallSequenceId += 1;
        this._openingCallChoiceResolver = null;
        this._setCommStandbyState('Factory monitor online.', 'LISTENING');
        this._commSequenceEvent = this.time.delayedCall(FIRST_SHIFT_INTRO.silenceBeforePhoneMs, () => {
            this._phoneChoicePhase = 'incoming';
            this._showPhonePanel(FIRST_SHIFT_INTRO.incomingHeader, callConfig.incomingBody, 'PRESS ✓ OR X', 'chat');
            this._setPhoneButtonSelection(null);
            this._setPhoneButtonsActive(true);
            this._playOneShot(SOUND_ASSETS.phoneRing, { volume: SOUND_VOLUMES.phoneRing });
        });
    }

    _onPhoneChoice(choice) {
        if (!this._phoneButtonsActive) return;

        if (this._phoneChoicePhase === 'incoming') {
            if (choice === 'accept') {
                this._setPhoneButtonSelection('accept');
                this._setPhoneButtonsActive(false);
                this._runOpeningPhoneCallScript();
            } else {
                this._setPhoneButtonSelection('reject');
                this._dismissPhoneGate();
            }
            return;
        }

        if (this._phoneChoicePhase === 'incoming-brief') {
            this._setPhoneButtonSelection(choice);
            this._setPhoneButtonsActive(false);
            this._dismissPhoneGate();
            return;
        }

        if (this._phoneChoicePhase === 'opening-call-question') {
            this._setPhoneButtonSelection(choice);
            this._setPhoneButtonsActive(false);
            const resolver = this._openingCallChoiceResolver;
            this._openingCallChoiceResolver = null;
            this._phoneChoicePhase = 'opening-call-branch';
            resolver?.(choice);
            return;
        }

        if (this._phoneChoicePhase === 'post-voice') {
            this._dismissPhoneGate();
            return;
        }

        if (this._phoneChoicePhase === 'umbrella-offer' || this._phoneChoicePhase === 'umbrella-pitch') {
            this._handleRebelliousUmbrellaPhoneChoice(choice);
            return;
        }

        if (this._phoneChoicePhase === 'umbrella-parts-check') {
            this._handleUmbrellaPartCheckChoice(choice);
            return;
        }

        if (this._phoneChoicePhase === 'umbrella-special-circuit-check') {
            this._handleUmbrellaSpecialCircuitCheckChoice(choice);
            return;
        }

        if (this._phoneChoicePhase === 'machine-question') {
            const machineVariant = this._currentMachineVariant;
            const question = machineVariant?.questionDialogue;
            if (!question) return;
            const header = this._getMachineLinkHeader(machineVariant);
            const voiceBroken = this._hasBrokenVoiceBox(machineVariant);

            machineVariant._uiConversationChoice = choice;
            machineVariant._uiConversationStage = 'answered';
            this._phoneChoicePhase = 'machine-answered';
            this._setPhoneButtonSelection(choice);
            this._setPhoneButtonsActive(false);
            const specialChoiceResult = this._handleSpecialMachineQuestionChoice(choice) || { autoApprove: false };

            const responseText = choice === 'accept' ? question.yesDialogue : question.noDialogue;
            this._showPhonePanel(
                header,
                this._getPhoneViewState('chat').body,
                voiceBroken
                    ? (choice === 'accept' ? '✓ SENT // VOICE DEGRADED' : 'X SENT // VOICE DEGRADED')
                    : (choice === 'accept' ? '✓ SENT' : 'X SENT'),
                'chat'
            );

            if (!responseText) return;

            this._commSequenceEvent = this.time.delayedCall(90, () => {
                this._typePhoneMessage(`\n\n${choice === 'accept' ? '✓' : 'X'} ${this._formatMachineSpeech(responseText, machineVariant)}`, {
                    append: true,
                    showMachineBubble: false,
                    speechBubbleText: this._formatMachineSpeech(responseText, machineVariant),
                    bubbleFooter: choice === 'accept' ? 'YES' : 'NO',
                    bubbleMachineVariant: machineVariant,
                    onComplete: () => {
                        if (specialChoiceResult.autoApprove && this._currentMachineVariant === machineVariant) {
                            this._pendingUnsafeAcceptConfirmation = true;
                            this._submitRuling('approve');
                            return;
                        }
                        this._showPhonePanel(
                            header,
                            this._getPhoneViewState('chat').body,
                            voiceBroken ? 'VOICE LOGGED // DEGRADED' : 'RESPONSE LOGGED',
                            'chat'
                        );
                    },
                });
            });
            return;
        }
    }

    _awaitPhoneDismiss(keepCurrentBody = false) {
        if (this._phoneChoicePhase !== 'voice') return;
        const callConfig = this._getOpeningCallConfig();
        this._phoneChoicePhase = 'post-voice';
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(
            FIRST_SHIFT_INTRO.incomingHeader,
            keepCurrentBody ? this._getPhoneViewState('chat').body : callConfig.postVoiceBody,
            callConfig.continueStatus,
        );
        this._setPhoneButtonsActive(true);
    }

    _dismissPhoneGate(options = {}) {
        const immediateFirstCase = options.immediateFirstCase !== false;
        const wasTextBrief = this._phoneChoicePhase === 'incoming-brief';
        this._openingCallSequenceId += 1;
        this._openingCallChoiceResolver = null;
        this._setRulebookTutorialLineActive(false);
        this._setCommStandbyState(
            wasTextBrief ? 'Brief complete. Conveyor standing by.' : 'Call complete. Conveyor standing by.',
            wasTextBrief ? 'BRIEF LOGGED' : 'CHANNEL IDLE',
        );
        this._phoneChoicePhase = 'inactive';
        this._beginShift({ immediateFirstCase });
    }

    _beginShift(options = {}) {
        if (this._shiftRunning) return;

        const immediateFirstCase = options.immediateFirstCase === true;

        this._shiftRunning = true;
        this._startMusic();
        this._seedShiftNotifications();
        this._flushQueuedWorldFeedNotifications();
        this._maybeShowJesterFailureTaunt();
        this._syncJesterDeskTokenVisibility();
        this._syncPurpleCircuitDeskTokenVisibility();
        this._syncUmbrellaDeskInventory();
        this._setFactoryIdleState(
            immediateFirstCase ? 'LINE ACTIVE\n\nSTATUS: ROUTING' : 'LINE ACTIVE\n\nSTATUS: READY',
            immediateFirstCase ? 'Routing first unit.' : 'Awaiting next unit.',
            immediateFirstCase ? 'LINE ACTIVE' : 'CHANNEL IDLE',
        );
        if (immediateFirstCase) {
            this._emitSequenceDebug('begin shift immediate load', {
                day: GameState.day,
            });
            this._loadNextCase();
            return;
        }

        this._scheduleNextCase(FIRST_SHIFT_INTRO.caseArrivalDelayMs);
    }

    _toggleSettingsOverlay() {
        if (this._settingsOverlay?.isVisible()) {
            this._settingsOverlay.close();
            return;
        }

        this._rulebook?.hide(true);
        this._machinePuzzleOverlay?.close(true);
        this._hideAuxiliaryOverlays();
        this._settingsOverlay?.open();
    }

    _canOpenRulebookOverlay() {
        return !this._settingsOverlay?.isVisible()
            && !this._settingsOpen
            && !this._overlayModalOpen
            && !this._machinePuzzleOverlay?.isVisible();
    }

    _toggleRulebookTablet() {
        if (this._rulebook?.isVisible()) {
            this._rulebook.hide();
            return;
        }

        if (!this._canOpenRulebookOverlay()) return;
        GameState.hasSeenRulebookTutorial = true;
        this._syncRulebookTutorialArrow();
        this._rulebook?.show();
    }

    _setUnderlyingSceneInputsEnabled(enabled) {
        const setEnabled = (target) => {
            if (!target?.input) return;
            target.input.enabled = enabled;
        };

        setEnabled(this._conveyorUnitSprite);
        setEnabled(this._settingsButtonBg);
        setEnabled(this._phoneBodyScrollZone);
        Object.values(this._phoneButtons || {}).forEach((button) => setEnabled(button.bg));
        Object.values(this._phoneViewButtons || {}).forEach((button) => setEnabled(button.bg));
        Object.values(this._conveyorRulingButtons || {}).forEach((button) => setEnabled(button.bgRect));
        [this._miniGridPort?.hit, this._miniFlowPort?.hit, this._miniGearPort?.hit, this._miniCodePort?.hit].forEach((target) => setEnabled(target));
        (this._deskItems || []).forEach((item) => setEnabled(item.inputZone));
    }

    _syncModalInteractionState() {
        const paused = this._settingsOpen || this._overlayModalOpen;
        this._gameplayPaused = paused;
        this._setUnderlyingSceneInputsEnabled(!paused);

        if (this._unitMoveTween) {
            if (paused) this._unitMoveTween.pause();
            else this._unitMoveTween.resume();
        }

        if (this._commTypingEvent) this._commTypingEvent.paused = paused;
        if (this._commSequenceEvent) this._commSequenceEvent.paused = paused;
        if (this._nextCaseEvent) this._nextCaseEvent.paused = paused;
        if (this._advanceCaseEvent) this._advanceCaseEvent.paused = paused;
        this._syncClockPauseNotice();
    }

    _setAuxiliaryOverlayModalOpen(open) {
        this._overlayModalOpen = Boolean(open);
        this._syncModalInteractionState();
    }

    _hideAuxiliaryOverlays() {
        this._otherPuzzleOverlay?.hide();
        this._gearPuzzleOverlay?.hide();
        this._debugPuzzleOverlay?.hide();
        this._setAuxiliaryOverlayModalOpen(false);
    }

    _setGameplayPaused(paused) {
        this._settingsOpen = paused;
        this._syncModalInteractionState();
    }

    _syncClockPauseNotice() {
        if (!this._clockPauseNotice) return;

        const shouldShow = Boolean(this._rulebook?.isVisible() || this._settingsOverlay?.isVisible());
        this.tweens.killTweensOf(this._clockPauseNotice);

        if (shouldShow) {
            this._clockPauseNotice.setVisible(true).setY(692);
            this.tweens.add({
                targets: this._clockPauseNotice,
                alpha: 1,
                y: 696,
                duration: 160,
                ease: 'Quad.Out',
            });
            return;
        }

        this.tweens.add({
            targets: this._clockPauseNotice,
            alpha: 0,
            y: 700,
            duration: 140,
            ease: 'Quad.In',
            onComplete: () => this._clockPauseNotice.setVisible(false),
        });
    }

    _getPerfNow() {
        return typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
    }

    _emitSequenceDebug(label, details = null) {
        this._sequenceDebugCounter += 1;
        const prefix = `[SEQ ${this._sequenceDebugCounter}] ${label}`;
        if (details && Object.keys(details).length > 0) {
            console.log(prefix, details);
            return;
        }
        console.log(prefix);
    }

    _scheduleNextCase(delayMs) {
        this._emitSequenceDebug('schedule next case', {
            delayMs,
            queueIndex: this._queueIndex,
            scheduleCasesRemaining: Math.max(0, (this._queue?.length || 0) - this._queueIndex),
            machineQueueLength: this._machineQueue?.length || 0,
        });
        this._nextCaseEvent?.remove(false);
        this._nextCaseEvent = this.time.delayedCall(delayMs, () => {
            this._nextCaseEvent = null;
            this._loadNextCase();
        });
    }

    _updateShiftClock() {
        const startMinutes = (SHIFT_CLOCK.startHour24 * 60) + SHIFT_CLOCK.startMinute;
        const elapsedSteps = Math.floor(this._elapsed / getShiftClockStepMs());
        const displayMinutes = startMinutes + (elapsedSteps * SHIFT_CLOCK.displayStepMinutes);

        if (displayMinutes === this._clockDisplayMinutes) return;

        this._clockDisplayMinutes = displayMinutes;
        this._clockText.setText(this._formatClockMinutes(displayMinutes));
        this._drawClockIcon(displayMinutes);
    }

    _initializeMachineShiftQueue() {
        this._machineQueueDefinitions = getEligibleMachineDefinitions({
            day: GameState.day,
            period: GameState.period,
            umbrellaQuest: this._getUmbrellaQuest(),
            specialItems: GameState.specialItems,
        });
        this._machineDefinitionById = new Map(
            this._machineQueueDefinitions.map((definition) => [definition.id, definition])
        );
        this._machineGuaranteeState = this._machineQueueDefinitions
            .filter((definition) => definition.guaranteedTimeframe)
            .map((definition) => ({
                id: definition.id,
                startHour: Math.max(0, Number(definition.guaranteedTimeframe?.startHour ?? 0)),
                endHour: Math.max(
                    0,
                    Number(definition.guaranteedTimeframe?.endHour ?? definition.guaranteedTimeframe?.startHour ?? 0)
                ),
                triggerHour: 0,
                queued: false,
                fulfilled: false,
            }))
            .map((entry) => {
                const endHour = Math.max(entry.startHour, entry.endHour);
                const windowDuration = Math.max(0, endHour - entry.startHour);
                return {
                    ...entry,
                    endHour,
                    triggerHour: windowDuration > 0
                        ? entry.startHour + (Math.random() * windowDuration)
                        : entry.startHour,
                };
            })
            .sort((left, right) => {
                if (left.triggerHour !== right.triggerHour) return left.triggerHour - right.triggerHour;
                return left.startHour - right.startHour;
            });
        this._refillMachineShiftQueue();
    }

    _refillMachineShiftQueue() {
        const machineIds = this._machineQueueDefinitions
            .filter((definition) => {
                const guaranteeEntry = this._getMachineGuaranteeEntry(definition.id);
                return !guaranteeEntry || guaranteeEntry.fulfilled;
            })
            .map((definition) => definition.id);
        this._machineQueue = [...machineIds];
    }

    _queueInjectedMachine(machineId, { front = true } = {}) {
        if (!machineId) return false;

        if (!this._machineDefinitionById.has(machineId)) {
            this._machineDefinitionById.set(machineId, {
                id: machineId,
                guaranteedTimeframe: null,
                trackOutcome: false,
            });
        }

        if (!this._machineQueueDefinitions.some((definition) => definition.id === machineId)) {
            this._machineQueueDefinitions.push(this._machineDefinitionById.get(machineId));
        }

        this._machineQueue = Array.isArray(this._machineQueue) ? this._machineQueue.filter((queuedId) => queuedId !== machineId) : [];
        const guaranteeEntry = this._getMachineGuaranteeEntry(machineId);
        if (guaranteeEntry) {
            guaranteeEntry.queued = true;
        }
        if (front) {
            this._machineQueue.unshift(machineId);
        } else {
            this._machineQueue.push(machineId);
        }

        return true;
    }

    _getCurrentShiftHourOffset() {
        const startMinutes = (SHIFT_CLOCK.startHour24 * 60) + SHIFT_CLOCK.startMinute;
        const displayMinutes = Number.isFinite(this._clockDisplayMinutes)
            ? this._clockDisplayMinutes
            : startMinutes + (Math.floor(this._elapsed / getShiftClockStepMs()) * SHIFT_CLOCK.displayStepMinutes);

        return Math.max(0, (displayMinutes - startMinutes) / 60);
    }

    _getMachineGuaranteeEntry(machineId) {
        return this._machineGuaranteeState.find((entry) => entry.id === machineId) || null;
    }

    _consumeQueuedMachineDefinition(machineId) {
        if (!machineId) return null;

        const queueIndex = this._machineQueue.indexOf(machineId);
        if (queueIndex >= 0) {
            this._machineQueue.splice(queueIndex, 1);
        }

        const guaranteeEntry = this._getMachineGuaranteeEntry(machineId);
        if (guaranteeEntry) {
            guaranteeEntry.queued = false;
            guaranteeEntry.fulfilled = true;
        }

        return this._machineDefinitionById.get(machineId) || null;
    }

    _consumeNextSelectableMachineDefinition() {
        if (!Array.isArray(this._machineQueue) || this._machineQueue.length === 0) return null;

        const machineId = this._machineQueue.shift();

        return this._consumeQueuedMachineDefinition(machineId);
    }

    _queueTriggeredGuaranteedMachines(currentHourOffset) {
        const readyGuarantees = this._machineGuaranteeState
            .filter((entry) => !entry.fulfilled && !entry.queued && currentHourOffset >= entry.triggerHour)
            .sort((left, right) => right.triggerHour - left.triggerHour);

        if (readyGuarantees.length > 0) {
            this._emitSequenceDebug('queue triggered guarantees', {
                currentHourOffset,
                ids: readyGuarantees.map((entry) => entry.id),
            });
        }

        readyGuarantees.forEach((entry) => {
            this._queueInjectedMachine(entry.id, { front: true });
        });
    }

    _takeNextQueuedMachineDefinition() {
        if (!this._machineDefinitionById?.size) return null;

        const startedAt = this._getPerfNow();
        const currentHourOffset = this._getCurrentShiftHourOffset();
        this._queueTriggeredGuaranteedMachines(currentHourOffset);
        const nextDefinition = this._consumeNextSelectableMachineDefinition();
        this._emitSequenceDebug('take next machine definition', {
            currentHourOffset,
            nextMachineId: nextDefinition?.id || null,
            queueRemaining: this._machineQueue?.length || 0,
            durationMs: Number((this._getPerfNow() - startedAt).toFixed(2)),
        });

        return nextDefinition;
    }

    _queueRosterClearBonus() {
        if (this._rosterClearBonusQueued) return;

        this._rosterClearBonusQueued = true;
        GameState.queueShiftSummaryAdjustment({
            label: `DAY ${GameState.day} ROSTER CLEAR`,
            amount: PAYCHECK_DELTA,
        });
    }

    _triggerRosterClearShiftEnd() {
        if (this._shiftEnding || !this._shiftRunning) return;

        this._queueRosterClearBonus();
        this._setPhoneInfoNote('All scheduled machines for this day are cleared. Clocking out early.', 'ROSTER CLEAR');
        this._showFeedback('DAY ROSTER CLEARED // SHIFT OVER', '#ffd685');
        this.time.delayedCall(380, () => {
            if (this._shiftEnding) return;
            this._shiftRunning = false;
            this._endShift(false);
        });
    }

    _drawClockIcon(totalMinutes) {
        const centerX = this._clockDialCenterX ?? 56;
        const centerY = this._clockDialCenterY ?? 664;
        const minuteValue = totalMinutes % 60;
        const hourValue = Math.floor(totalMinutes / 60) % 12;
        const minuteAngle = Phaser.Math.DegToRad(((minuteValue / 60) * 360) - 90);
        const hourAngle = Phaser.Math.DegToRad((((hourValue + (minuteValue / 60)) / 12) * 360) - 90);

        this._clockIcon.clear();
        this._clockIcon.lineStyle(2, 0xccefff, 0.95);
        this._clockIcon.strokeCircle(centerX, centerY, 14);
        this._clockIcon.lineStyle(1, 0x66aacc, 0.7);
        this._clockIcon.strokeCircle(centerX, centerY, 10);
        this._clockIcon.lineStyle(3, 0xccefff, 0.95);
        this._clockIcon.lineBetween(
            centerX,
            centerY,
            centerX + (Math.cos(hourAngle) * 7),
            centerY + (Math.sin(hourAngle) * 7),
        );
        this._clockIcon.lineStyle(2, 0x66ffcc, 0.9);
        this._clockIcon.lineBetween(
            centerX,
            centerY,
            centerX + (Math.cos(minuteAngle) * 11),
            centerY + (Math.sin(minuteAngle) * 11),
        );
        this._clockIcon.fillStyle(0xccefff, 1);
        this._clockIcon.fillCircle(centerX, centerY, 2);
    }

    _formatClockMinutes(totalMinutes) {
        const wrappedMinutes = ((totalMinutes % 1440) + 1440) % 1440;
        const hours24 = Math.floor(wrappedMinutes / 60);
        const minutes = wrappedMinutes % 60;
        const meridiem = hours24 >= 12 ? 'PM' : 'AM';
        const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;

        return `${hours12}:${String(minutes).padStart(2, '0')} ${meridiem}`;
    }

    _buildConveyorScreen() {
        this._conveyorContainer = this.add.container(0, 0).setDepth(10);

        const bgKey = this.textures.exists('bg_mainview') ? 'bg_mainview' : `bg_p${GameState.period}`;
        const bg = this.add.image(640, 360, bgKey).setDisplaySize(1280, 720);
        this._conveyorContainer.add(bg);

        this._monitorText = this.add.text(130, 375,
            'AWAITING UNIT\n\nSTATUS: READY', {
                fontFamily: 'Courier New', fontSize: '10px', color: '#301934',
                align: 'center', lineSpacing: 4,
            }
        ).setOrigin(0.5);
        this._conveyorContainer.add(this._monitorText);

        this._machineDialogueText = this.add.text(966, 460, '', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#bceef8',
            align: 'left', wordWrap: { width: 260 }, lineSpacing: 6,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._machineDialogueText);

        this._machineSpeechBubbleLayer = this.add.container(0, 0).setDepth(16).setVisible(false);
        this._machineSpeechBubbleSlots = [
            this._createMachineSpeechBubbleSlot(MACHINE_PRESENTATION.conveyorTargetX - 8, 320, 244),
            this._createMachineSpeechBubbleSlot(MACHINE_PRESENTATION.conveyorTargetX - 8, 406, 286, true),
        ];
        this._machineSpeechBubbleSlots.forEach((slot) => this._machineSpeechBubbleLayer.add(slot.container));

        this._shapeTitleText = this.add.text(964, 126, 'CHASSIS GRID', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#a0dbf0', letterSpacing: 3,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeTitleText);

        this._shapeLegendText = this.add.text(964, 294, '0 open  1 frame  2 block', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#88b7c6',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeLegendText);

        this._shapeHintText = this.add.text(964, 320, 'CLICK UNIT FOR DOMINO GRID', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#d9cc9f', letterSpacing: 2,
            align: 'center', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeHintText);

        this._machineBlueprintGfx = this.add.graphics().setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintGfx);
        this._machineBlueprintLinkGfx = this.add.graphics().setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintLinkGfx);
        this._machineBlueprintLabelContainer = this.add.container(0, 0).setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintLabelContainer);

        this._machineBayLightContainer = this.add.container(MACHINE_PRESENTATION.conveyorTargetX, 420).setDepth(14);
        this._unitWorklightCone = this.add.graphics();
        this._unitWorklightCone.fillStyle(0xffe4aa, 0.13);
        this._unitWorklightCone.fillTriangle(-170, -146, 170, -146, 0, 62);
        this._unitWorklightGlow = this.add.ellipse(0, -26, 248, 132, 0xffdc96, 0.14);
        this._unitWorklightHalo = this.add.ellipse(0, -172, 84, 30, 0xffefc7, 0.16);
        this._unitWorklightHousing = this.add.rectangle(0, -190, 126, 16, 0x2e3439, 1)
            .setStrokeStyle(2, 0x707a82, 0.82);
        this._unitWorklightBulb = this.add.rectangle(0, -178, 52, 14, 0xfff0c6, 0.96)
            .setStrokeStyle(1, 0xfffed9, 0.64);
        this._machineBayLightContainer.add([
            this._unitWorklightCone,
            this._unitWorklightGlow,
            this._unitWorklightHalo,
            this._unitWorklightHousing,
            this._unitWorklightBulb,
        ]);
        this._conveyorContainer.add(this._machineBayLightContainer);

        this._unitContainer = this.add.container(MACHINE_PRESENTATION.conveyorEntryX, 420).setDepth(15);
        this._conveyorUnitSprite = this.add.image(0, 0, 'unit_placeholder').setScale(1.0);
        this._unitNameText = this.add.text(0, 115, '', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#ccddee',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitIdText = this.add.text(0, 133, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#778899',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitContainer.add([
            this._conveyorUnitSprite,
            this._unitNameText,
            this._unitIdText,
        ]);
        this._unitContainer.setVisible(false);
        this._setMachineWorklightVisible(false);

        this._conveyorUnitSprite.setInteractive({ useHandCursor: true });
        this._conveyorUnitSprite.on('pointerover', () => {
            if (!this._currentMachineVariant || this._actionLocked || this._settingsOpen) return;
            if (this._machinePuzzleOverlay?.isVisible() || this._otherPuzzleOverlay?.active || this._gearPuzzleOverlay?.active || this._debugPuzzleOverlay?.active) return;
            this._conveyorUnitSprite.setTint(0xaabbdd);
        });
        this._conveyorUnitSprite.on('pointerout', () => this._conveyorUnitSprite.clearTint());
        this._conveyorUnitSprite.on('pointerdown', () => {
            if (this._screen !== 'conveyor' || this._actionLocked || this._settingsOpen) return;
            if (!this._currentMachineVariant) return;
            if (this._miniMachinePanelVisible && !this._machinePuzzleOverlay?.isVisible() && !this._otherPuzzleOverlay?.active && !this._gearPuzzleOverlay?.active && !this._debugPuzzleOverlay?.active) {
                this._hideMiniMachinePanel();
                return;
            }
            this._revealMachineMiniPanel();
        });

        this._shapeLegendText.setText('0 open  1 wall  2-5 charge  = linked pair');

        this._shapeHintText.setText('CLICK UNIT TO REVEAL MACHINE PORTS\nTHEN OPEN GRID, FLOW, GEAR, OR CODE');

        const controlsCenterX = 804;
        const rulingDefs = [
            { action: 'scrap', x: 704, width: 164, label: 'SCRAP', subtitle: 'drop from the line', fillColor: 0x5b1815, strokeColor: 0xff7d77, textColor: '#ffd6d2' },
            { action: 'approve', x: 900, width: 164, label: 'ACCEPT', subtitle: 'send it onward', fillColor: 0x174b2a, strokeColor: 0x75ffaf, textColor: '#d4ffea' },
        ];

        this._conveyorRulingButtons = {};
        rulingDefs.forEach((def) => {
            const shadowRect = this.add.rectangle(def.x + 6, 656, def.width + 24, 78, 0x000000, 0.22);
            const frameRect = this.add.rectangle(def.x, 650, def.width + 20, 74, 0x2b261f, 0.96)
                .setStrokeStyle(2, 0x8d816a, 0.9);
            const innerFrameRect = this.add.rectangle(def.x, 650, def.width + 8, 66, 0x433c32, 0.96)
                .setStrokeStyle(1, 0xc0b18d, 0.28);
            const bgRect = this.add.rectangle(def.x, 650, def.width, 62, def.fillColor, 0.94)
                .setStrokeStyle(2, def.strokeColor, 0.92)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(def.x, 641, def.label, {
                fontFamily: 'Courier New', fontSize: '19px', color: def.textColor, letterSpacing: 2,
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);
            const subtitle = this.add.text(def.x, 664, def.subtitle, {
                fontFamily: 'Courier New', fontSize: '10px', color: def.textColor,
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);

            bgRect.on('pointerover', () => {
                if (!this._canUseFactoryDecisionButtons()) return;
                bgRect.setScale(1.04);
                frameRect.setScale(1.04);
                innerFrameRect.setScale(1.04);
                shadowRect.setScale(1.04);
                subtitle.setY(662);
            });
            bgRect.on('pointerout', () => {
                bgRect.setScale(1);
                frameRect.setScale(1);
                innerFrameRect.setScale(1);
                shadowRect.setScale(1);
                subtitle.setY(664);
            });
            bgRect.on('pointerdown', () => {
                if (!this._canUseFactoryDecisionButtons()) return;
                Animations.buttonPunch(this, bgRect);
                this._submitRuling(def.action);
            });

            this._factoryControlsContainer.add(shadowRect);
            this._factoryControlsContainer.add(frameRect);
            this._factoryControlsContainer.add(innerFrameRect);
            this._factoryControlsContainer.add(bgRect);
            this._factoryControlsContainer.add(label);
            this._factoryControlsContainer.add(subtitle);

            this._conveyorRulingButtons[def.action] = {
                shadowRect,
                frameRect,
                innerFrameRect,
                bgRect,
                label,
                subtitle,
                def,
            };
        });

        this._conveyorDecisionHint = this.add.text(controlsCenterX, 596, 'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#8fc1cf', letterSpacing: 2,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);
        this._factoryControlsContainer.add(this._conveyorDecisionHint);

        this._feedbackText = this.add.text(controlsCenterX, 562, '', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2, align: 'center',
            wordWrap: { width: 460 },
        }).setOrigin(0.5).setAlpha(0);
        this._factoryControlsContainer.add(this._feedbackText);

        this._setConveyorRulingButtonsVisible(false);
    }

    _setFactoryIdleState(message, commMessage = 'Awaiting next unit.', commStatus = 'CHANNEL IDLE') {
        this._clearUnsafeAcceptConfirmation();
        this._shiftAwaitingFinalRuling = false;
        this._otherPuzzleReturnPhoneState = null;
        this._gearPuzzleReturnPhoneState = null;
        this._debugPuzzleReturnPhoneState = null;
        if (this._monitorText) this._monitorText.setText(message);
        if (this._unitContainer) this._unitContainer.setVisible(false);
        this._setMachineWorklightVisible(false);
        if (this._machineDialogueText) this._machineDialogueText.setText('');
        this._clearMachineGridDisplays();
        if (this._miniPuzzleStatusText) this._miniPuzzleStatusText.setText('NO UNIT LATCHED');
        this._setConveyorRulingButtonsVisible(false);
        if (this._conveyorDecisionHint) {
            this._conveyorDecisionHint.setText('OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR');
        }
        this._setCommStandbyState(commMessage, commStatus);
        this._machinePuzzleOverlay?.close(true);
        this._hideAuxiliaryOverlays();
        this._hideMiniMachinePanel(true);
        this._currentMachineVariant = null;
        this._stopCurrentUnitJitter();
        this._phoneInfoNote = null;
        this._refreshPhoneInfoBoard();
        this._refreshFactoryActionButtons();
    }

    _openMachinePuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._otherPuzzleOverlay?.active) return;
        if (this._gearPuzzleOverlay?.active) return;
        if (this._debugPuzzleOverlay?.active) return;

        this._clearUnsafeAcceptConfirmation();
        this._currentMachineVariant._uiPuzzleOpened = true;
        this._updateConveyorDecisionHint();
        this._refreshFactoryActionButtons();
        this._machinePuzzleOverlay.open(this._currentMachineVariant);
    }

    _canUseFactoryDecisionButtons() {
        return this._screen === 'conveyor'
            && !this._actionLocked
            && !this._settingsOpen
            && Boolean(this._currentCase)
            && !this._machinePuzzleOverlay?.isVisible()
            && !this._otherPuzzleOverlay?.active
                && !this._gearPuzzleOverlay?.active
                && !this._debugPuzzleOverlay?.active;
    }

    _setConveyorRulingButtonsVisible(visible) {
        const isVisible = Boolean(visible) && this._screen === 'conveyor';
        Object.values(this._conveyorRulingButtons).forEach((button) => {
            button.shadowRect.setVisible(isVisible);
            button.frameRect.setVisible(isVisible);
            button.innerFrameRect.setVisible(isVisible);
            button.bgRect.setVisible(isVisible);
            button.label.setVisible(isVisible);
            button.subtitle.setVisible(isVisible);
            button.bgRect.setScale(1);
            button.shadowRect.setScale(1);
            button.frameRect.setScale(1);
            button.innerFrameRect.setScale(1);
        });

        if (this._factoryControlsContainer) this._factoryControlsContainer.setVisible(this._screen === 'conveyor');
        if (this._conveyorDecisionHint) this._conveyorDecisionHint.setVisible(isVisible);
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
    }

    _handlePuzzleStateChanged(machineVariant, puzzleState) {
        if (!puzzleState) return;
        if (machineVariant && this._currentMachineVariant && machineVariant !== this._currentMachineVariant) return;

        this._clearUnsafeAcceptConfirmation();
        const evaluation = puzzleState.getEvaluation();
        const wasSolved = Boolean(machineVariant?._uiPuzzleSolved);
        const isSolved = Boolean(evaluation.solved);
        const clownCorrupted = Boolean(puzzleState.clownCorruption);

        if (machineVariant) machineVariant._uiPuzzleSolved = isSolved;
        if (machineVariant) machineVariant._clownCorrupted = clownCorrupted;
        if (this._miniPuzzleStatusText) {
            this._miniPuzzleStatusText.setText(this._getMiniPuzzleStatusText(puzzleState));
        }

        this._drawMachineShapeGrid(puzzleState.grid);
        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
        this._refreshPhoneInfoBoard(machineVariant);
        this._syncCurrentUnitClownEffects(machineVariant);

        if (clownCorrupted && machineVariant) {
            this._announceClownCorruption(machineVariant);
        }

        if (isSolved && !wasSolved && !this._actionLocked) {
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            const auxiliaryState = this._getAuxiliaryPuzzleState(machineVariant);
            const followUpNeeded = auxiliaryState.pendingCount > 0;
            this._showFeedback(
                followUpNeeded
                    ? (auxiliaryState.pendingCount === 1
                        ? `MAIN PUZZLE CLEARED // COMPLETE ${auxiliaryState.pendingEntries[0].label} PUZZLE`
                        : 'MAIN PUZZLE CLEARED // COMPLETE AUX PUZZLES')
                    : 'GRID FIXED // ACCEPT IS SAFE',
                '#c7ff86'
            );
        }
    }

    _updateConveyorDecisionHint() {
        if (!this._conveyorDecisionHint) return;

        let text = 'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR';
        let color = '#8fc1cf';

        const gateState = this._getPuzzleGateState();
        const repairState = gateState.repairState;
        const {
            evaluation,
            mainInspected,
            mainReady,
            otherRequired,
            otherSolved,
            auxiliaryState,
            mainScrapRequired,
            scrapRequired,
            scrapBonusEligible,
        } = gateState;
        const pendingLabels = auxiliaryState.pendingEntries.map((entry) => entry.label);

        if (!this._currentMachineVariant) {
            this._conveyorDecisionHint.setText(text).setColor(color);
            return;
        }

        if (this._shiftAwaitingFinalRuling) {
            text = this._actionLocked
                ? 'SHIFT OVER // CLEARING THE LAST UNIT'
                : 'SHIFT OVER // ACCEPT OR SCRAP THE LAST UNIT';
            color = '#ffd685';
            this._conveyorDecisionHint.setText(text).setColor(color);
            return;
        }

        if (repairState?.businessConcluded) {
            this._conveyorDecisionHint.setText('UMBRELLA DEAL CLOSED // FILE ANY RULING').setColor('#ffd685');
            return;
        }

        if (repairState?.assemblyActive && !repairState.allPartsLoaded) {
            this._conveyorDecisionHint.setText('LOAD THE UMBRELLA STASH INTO GRID / FLOW / GEAR / CODE').setColor('#ffd685');
            return;
        }

        if (!mainReady) {
            if (mainScrapRequired && !mainInspected) {
                text = 'OPEN MAIN PUZZLE // CONFIRM THE SCRAP SIGNAL';
                color = '#ffd685';
            } else {
                text = otherRequired
                    ? (pendingLabels.length === 1
                        ? `SOLVE MAIN PUZZLE // THEN CLEAR ${pendingLabels[0]} PUZZLE`
                        : 'SOLVE MAIN PUZZLE // THEN CLEAR AUX PUZZLES')
                    : 'SOLVE THE MAIN PUZZLE BEFORE FILING A RULING';
                color = '#8fc1cf';
            }
        } else if (!otherSolved) {
            text = scrapRequired
                ? (pendingLabels.length === 1
                    ? `SCRAP SIGNAL FOUND // CLEAR ${pendingLabels[0]} PUZZLE`
                    : 'SCRAP SIGNAL FOUND // CLEAR AUX PUZZLES')
                : (pendingLabels.length === 1
                    ? `MAIN PUZZLE CLEARED // FINISH ${pendingLabels[0]} PUZZLE`
                    : 'MAIN PUZZLE CLEARED // FINISH AUX PUZZLES');
            color = '#9bc2ff';
        } else if (scrapRequired) {
            text = scrapBonusEligible
                ? 'ALL REQUIRED CHECKS CLEARED // SCRAP BONUS READY'
                : 'ALL REQUIRED CHECKS CLEARED // SCRAP READY';
            color = scrapBonusEligible ? '#ffd685' : '#ffb49b';
        } else {
            text = otherRequired
                ? 'ALL REQUIRED PUZZLES CLEARED // ACCEPT FOR CLEAN PAY'
                : 'GRID FIXED // ACCEPT IS SAFE';
            color = '#c7ff86';
        }

        this._conveyorDecisionHint.setText(text).setColor(color);
    }

    _showFactoryNotification(message, status, soundAsset = SOUND_ASSETS.notificationAlert) {
        this._setPhoneInfoNote(message, status);

        if (soundAsset) {
            this._playOneShot(soundAsset, {
                volume: soundAsset === SOUND_ASSETS.puzzleFixed ? SOUND_VOLUMES.puzzleFixed : SOUND_VOLUMES.notification,
            });
        }
    }

    _handleMachinePuzzleClosed(machineVariant, puzzleState) {
        if (!machineVariant || !puzzleState) return;
        if (this._currentMachineVariant && machineVariant !== this._currentMachineVariant) return;

        const evaluation = puzzleState.getEvaluation?.() || { solved: false };
        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (repairState?.specialCircuitMode && !repairState.insertedSpecialCircuits?.any) {
            this._beginUmbrellaSpecialCircuitCheck();
            return;
        }

        this._maybePromptUmbrellaPartShortage('circuit', { completed: Boolean(evaluation.solved) });
    }

    _applyRulingConsequence(payDelta, wasPenalty) {
        GameState.casesProcessedThisShift++;
        GameState.paycheckTotal += payDelta;
        this._paycheckDelta += payDelta;

        if (wasPenalty) {
            GameState.totalMistakes++;
            this._shiftMistakes++;
        }

        this._hudCasesText.setText(`CASES: ${GameState.casesProcessedThisShift}`);
        this._hudPayText.setText(this._fmtPay());
        this._hudViolText.setText(`Violations: ${this._shiftMistakes}`);
    }

    _recordTrackedMachineOutcome(action, gateState) {
        if (!this._currentMachineVariant) return;

        const evaluation = gateState?.evaluation || this._currentMachineVariant.puzzleState?.getEvaluation?.() || {};
        const flowState = this._getMachineFlowState(this._currentMachineVariant);
        const gearState = this._getMachineGearState(this._currentMachineVariant);
        const debugState = this._getMachineDebugState(this._currentMachineVariant);
        const puzzleResults = {
            grid: {
                required: true,
                completed: Boolean(evaluation.solved),
                resolved: Boolean(evaluation.solved || ((evaluation.scrapRequired || evaluation.impossible) && this._currentMachineVariant._uiPuzzleOpened)),
                scrapRequired: Boolean(evaluation.scrapRequired || evaluation.impossible),
            },
            flow: {
                required: Boolean(this._currentMachineVariant._uiOtherPuzzleRequired),
                completed: Boolean(this._currentMachineVariant._uiOtherPuzzleSolved || flowState?.completed),
                resolved: !this._currentMachineVariant._uiOtherPuzzleRequired
                    || Boolean(this._currentMachineVariant._uiOtherPuzzleSolved || flowState?.completed || flowState?.scrapRequired),
                scrapRequired: Boolean(flowState?.scrapRequired),
            },
            gear: {
                required: Boolean(this._currentMachineVariant._uiGearPuzzleRequired),
                completed: Boolean(this._currentMachineVariant._uiGearPuzzleSolved || gearState?.completed),
                resolved: !this._currentMachineVariant._uiGearPuzzleRequired
                    || Boolean(this._currentMachineVariant._uiGearPuzzleSolved || gearState?.completed || gearState?.scrapRequired),
                scrapRequired: Boolean(gearState?.scrapRequired),
            },
            code: {
                required: Boolean(this._currentMachineVariant._uiDebugPuzzleRequired),
                completed: Boolean(this._currentMachineVariant._uiDebugPuzzleSolved || debugState?.completed),
                resolved: !this._currentMachineVariant._uiDebugPuzzleRequired
                    || Boolean(this._currentMachineVariant._uiDebugPuzzleSolved || debugState?.completed || debugState?.scrapRequired),
                scrapRequired: Boolean(debugState?.scrapRequired),
            },
        };
        const completedPuzzleParts = Object.entries(puzzleResults)
            .filter(([, result]) => result.required && result.completed)
            .map(([key]) => key);
        const resolvedPuzzleParts = Object.entries(puzzleResults)
            .filter(([, result]) => result.required && result.resolved)
            .map(([key]) => key);

        GameState.recordTrackedMachineOutcome({
            machineId: this._currentMachineVariant.machineId,
            machineName: this._currentMachineVariant.name,
            caseId: this._currentCase?.id || null,
            period: GameState.period,
            day: GameState.day,
            ruling: action === 'scrap' ? 'scrapped' : 'accepted',
            scrapped: action === 'scrap',
            accepted: action === 'approve',
            ready: Boolean(gateState?.ready),
            scrapRequired: Boolean(gateState?.scrapRequired),
            completedPuzzleParts,
            resolvedPuzzleParts,
            puzzleResults,
        });
    }

    _queueAdvanceCase(delayMs) {
        this._advanceCaseEvent?.remove(false);
        this._advanceCaseEvent = this.time.delayedCall(delayMs, () => {
            this._advanceCaseEvent = null;
            this._advanceCase();
        });
    }

    _scrollBelt(_delta) {
        // Belt animation handled by pixel art background.
    }

    _buildInspectionScreen() {
        this._buildDisabledInspectionContainer();
    }

    _setScreen(name) {
        this._screen = name;
        this._conveyorContainer.setVisible(name === 'conveyor');
        this._factoryControlsContainer?.setVisible(name === 'conveyor');
        this._unitContainer.setVisible(name === 'conveyor' && !!this._currentCase);
        if (this._inspectionContainer) this._inspectionContainer.setVisible(false);
        this._setConveyorRulingButtonsVisible(name === 'conveyor' && !!this._currentMachineVariant);

        if (name !== 'conveyor') {
            this._machinePuzzleOverlay?.close(true);
            this._hideAuxiliaryOverlays();
            this._hideMiniMachinePanel(true);
        }

        this._refreshFactoryActionButtons();
    }

    _getPuzzleGateState(machineVariant = this._currentMachineVariant) {
        const evaluation = machineVariant?.puzzleState?.getEvaluation?.() || {
            solved: false,
            impossible: false,
        };
        const repairState = this._getUmbrellaRepairState(machineVariant);
        const mainInspected = Boolean(machineVariant?._uiPuzzleOpened);
        const auxiliaryState = this._getAuxiliaryPuzzleState(machineVariant);
        const otherRequired = auxiliaryState.requiredCount > 0;
        const otherSolved = auxiliaryState.allSolved;
        const mainScrapRequired = Boolean(evaluation.scrapRequired || evaluation.impossible);
        const mainScrapKind = evaluation.impossible ? 'unsalvageable' : (evaluation.scrapKind || null);
        let mainReady = evaluation.solved || (mainScrapRequired && mainInspected);

        if (this._isCircuitDealer(machineVariant)) {
            return {
                evaluation,
                repairState,
                mainInspected: true,
                mainScrapRequired: false,
                mainScrapKind: null,
                mainReady: true,
                otherRequired: false,
                otherSolved: true,
                auxiliaryState: {
                    ...auxiliaryState,
                    requiredCount: 0,
                    solvedCount: 0,
                    resolvedCount: 0,
                    pendingCount: 0,
                    scrapCount: 0,
                    allSolved: true,
                },
                scrapRequired: false,
                scrapBonusEligible: false,
                ready: true,
            };
        }

        if (repairState?.businessConcluded) {
            return {
                evaluation,
                repairState,
                mainInspected: true,
                mainScrapRequired: false,
                mainScrapKind: null,
                mainReady: true,
                otherRequired: false,
                otherSolved: true,
                auxiliaryState: {
                    ...auxiliaryState,
                    requiredCount: 0,
                    solvedCount: 0,
                    resolvedCount: 0,
                    pendingCount: 0,
                    scrapCount: 0,
                    allSolved: true,
                },
                scrapRequired: false,
                scrapBonusEligible: false,
                ready: true,
            };
        }

        if (repairState?.assemblyActive && !repairState.partReady.circuit) {
            mainReady = false;
        }

        const scrapRequired = mainScrapRequired || auxiliaryState.scrapCount > 0;
        const scrapBonusEligible = mainScrapKind === 'unsalvageable'
            || auxiliaryState.scrapEntries.some((entry) => entry.scrapKind === 'unsalvageable');

        let ready = mainReady && otherSolved;
        if (scrapRequired) {
            const confirmedMainScrap = mainScrapRequired && mainInspected;
            const confirmedAuxScrap = auxiliaryState.scrapCount > 0 && auxiliaryState.scrapEntries.some(entry => entry.reviewed);
            ready = confirmedMainScrap || confirmedAuxScrap;
        }

        return {
            evaluation,
            repairState,
            mainInspected,
            mainScrapRequired,
            mainScrapKind,
            mainReady,
            otherRequired,
            otherSolved,
            auxiliaryState,
            scrapRequired,
            scrapBonusEligible,
            ready,
        };
    }

    _getOtherPuzzleButtonState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant) {
            return {
                subtitle: 'AWAITING UNIT',
                fillColor: 0x28334a,
                strokeColor: 0x8bb8ff,
                labelColor: '#dbe7ff',
                subtitleColor: '#9bc2ff',
            };
        }

        if (!machineVariant._uiOtherPuzzleRequired) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }

        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (repairState?.businessConcluded) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }
        if (repairState?.assemblyActive && !repairState.partReady.wire) {
            return {
                subtitle: `LOAD ${repairState.appliedParts.wire}/${repairState.requiredParts.wire}`,
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        const flowState = this._getMachineFlowState(machineVariant);
        const otherSolved = Boolean(machineVariant._uiOtherPuzzleSolved) || Boolean(flowState?.completed);

        if (otherSolved) {
            machineVariant._uiOtherPuzzleSolved = true;
            return {
                subtitle: 'CLEARED',
                fillColor: 0x174b2a,
                strokeColor: 0x75ffaf,
                labelColor: '#d4ffea',
                subtitleColor: '#aef3c6',
            };
        }

        if (flowState?.scrapRequired) {
            const hazard = flowState.scrapKind === 'hazard';
            return {
                subtitle: hazard ? 'HAZARD' : 'SCRAP',
                fillColor: hazard ? 0x5b1815 : 0x4b3520,
                strokeColor: hazard ? 0xff7d77 : 0xffc27a,
                labelColor: hazard ? '#ffd6d2' : '#ffe5bb',
                subtitleColor: hazard ? '#ffb4ae' : '#ffd685',
            };
        }

        if (flowState?.forbiddenUsed) {
            return {
                subtitle: 'MODIFIED',
                fillColor: 0x5b1815,
                strokeColor: 0xff7d77,
                labelColor: '#ffd6d2',
                subtitleColor: '#ffb4ae',
            };
        }

        if (flowState) {
            return {
                subtitle: 'INCOMPLETE',
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        return {
            subtitle: 'REQUIRED',
            fillColor: 0x28334a,
            strokeColor: 0x8bb8ff,
            labelColor: '#dbe7ff',
            subtitleColor: '#9bc2ff',
        };
    }

    _getGearPuzzleButtonState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant) {
            return {
                subtitle: 'AWAITING UNIT',
                fillColor: 0x28334a,
                strokeColor: 0x8bb8ff,
                labelColor: '#dbe7ff',
                subtitleColor: '#9bc2ff',
            };
        }

        if (!machineVariant._uiGearPuzzleRequired) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }

        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (repairState?.businessConcluded) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }
        if (repairState?.assemblyActive && !repairState.partReady.gear) {
            return {
                subtitle: `LOAD ${repairState.appliedParts.gear}/${repairState.requiredParts.gear}`,
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        const gearState = this._getMachineGearState(machineVariant);
        const solved = Boolean(machineVariant._uiGearPuzzleSolved) || Boolean(gearState?.completed);

        if (solved) {
            machineVariant._uiGearPuzzleSolved = true;
            return {
                subtitle: 'CLEARED',
                fillColor: 0x174b2a,
                strokeColor: 0x75ffaf,
                labelColor: '#d4ffea',
                subtitleColor: '#aef3c6',
            };
        }

        if (gearState?.scrapRequired) {
            const hazard = gearState.scrapKind === 'hazard';
            return {
                subtitle: hazard ? 'HAZARD' : 'SCRAP',
                fillColor: hazard ? 0x5b1815 : 0x4b3520,
                strokeColor: hazard ? 0xff7d77 : 0xffc27a,
                labelColor: hazard ? '#ffd7d3' : '#ffe5bb',
                subtitleColor: hazard ? '#ffb4ae' : '#ffd685',
            };
        }

        if (gearState?.sinkPowered) {
            return {
                subtitle: 'LIVE PATH',
                fillColor: 0x215447,
                strokeColor: 0x90ffd3,
                labelColor: '#dfffee',
                subtitleColor: '#b5ffe3',
            };
        }

        if (gearState) {
            return {
                subtitle: 'STALLED',
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        return {
            subtitle: 'REQUIRED',
            fillColor: 0x28334a,
            strokeColor: 0x8bb8ff,
            labelColor: '#dbe7ff',
            subtitleColor: '#9bc2ff',
        };
    }

    _getDebugPuzzleButtonState(machineVariant = this._currentMachineVariant) {
        if (!machineVariant) {
            return {
                subtitle: 'AWAITING UNIT',
                fillColor: 0x28334a,
                strokeColor: 0x8bb8ff,
                labelColor: '#dbe7ff',
                subtitleColor: '#9bc2ff',
            };
        }

        if (!machineVariant._uiDebugPuzzleRequired) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }

        const repairState = this._getUmbrellaRepairState(machineVariant);
        if (repairState?.businessConcluded) {
            return {
                subtitle: 'NOT REQUIRED',
                fillColor: 0x18352d,
                strokeColor: 0x65c4af,
                labelColor: '#d7fff3',
                subtitleColor: '#9de7d5',
            };
        }
        if (repairState?.assemblyActive && !repairState.partReady.data) {
            return {
                subtitle: `LOAD ${repairState.appliedParts.data}/${repairState.requiredParts.data}`,
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        const debugState = this._getMachineDebugState(machineVariant);
        const solved = Boolean(machineVariant._uiDebugPuzzleSolved) || Boolean(debugState?.completed);

        if (solved) {
            machineVariant._uiDebugPuzzleSolved = true;
            return {
                subtitle: debugState?.fixed ? 'PATCHED' : 'STABLE',
                fillColor: 0x174b2a,
                strokeColor: 0x75ffaf,
                labelColor: '#d4ffea',
                subtitleColor: '#aef3c6',
            };
        }

        if (debugState?.scrapRequired) {
            const hazard = debugState.scrapKind === 'hazard';
            return {
                subtitle: hazard ? 'HAZARD' : 'SCRAP',
                fillColor: hazard ? 0x5b1815 : 0x4b3520,
                strokeColor: hazard ? 0xff7d77 : 0xffc27a,
                labelColor: hazard ? '#ffd7d3' : '#ffe5bb',
                subtitleColor: hazard ? '#ffb4ae' : '#ffd685',
            };
        }

        if (debugState?.phase === 'repair') {
            return {
                subtitle: 'PATCH',
                fillColor: 0x4b3520,
                strokeColor: 0xffcc77,
                labelColor: '#ffe5bb',
                subtitleColor: '#ffd685',
            };
        }

        if ((debugState?.corruptionCount || 0) > 0) {
            return {
                subtitle: 'CORRUPT',
                fillColor: 0x5b1815,
                strokeColor: 0xff7d77,
                labelColor: '#ffd6d2',
                subtitleColor: '#ffb4ae',
            };
        }

        return {
            subtitle: 'TEST READY',
            fillColor: 0x28334a,
            strokeColor: 0x8bb8ff,
            labelColor: '#dbe7ff',
            subtitleColor: '#9bc2ff',
        };
    }

    _refreshOtherPuzzleButton() {
        this._updateMiniMachinePortStyles();
    }

    _refreshFactoryActionButtons() {
        const canInteract = this._canUseFactoryDecisionButtons();
        const gateState = this._getPuzzleGateState();
        const hasUnit = Boolean(this._currentCase) && this._screen === 'conveyor';
        const readyAlpha = canInteract ? 1 : (hasUnit ? 0.68 : 0.38);
        const gatedAlpha = canInteract ? 0.62 : (hasUnit ? 0.52 : 0.38);
        const acceptOverrideReady = Boolean(this._pendingUnsafeAcceptConfirmation) && hasUnit;

        Object.entries(this._conveyorRulingButtons).forEach(([action, button]) => {
            const alpha = action === 'scrap'
                ? readyAlpha
                : ((gateState.ready || acceptOverrideReady) ? readyAlpha : gatedAlpha);
            button.shadowRect.setAlpha(alpha * 0.68);
            button.frameRect.setAlpha(alpha);
            button.innerFrameRect.setAlpha(alpha);
            button.bgRect.setAlpha(alpha);
            button.label.setAlpha(alpha);
            button.subtitle.setAlpha(alpha);
        });

        this._refreshOtherPuzzleButton();
    }

    _openOtherPuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._otherPuzzleOverlay?.active) return;
        if (this._gearPuzzleOverlay?.active) return;
        if (this._debugPuzzleOverlay?.active) return;

        if (!this._currentMachineVariant._uiOtherPuzzleRequired) {
            this._showFeedback('NO OTHER PUZZLE LOADED FOR THIS UNIT', '#8fc1cf');
            this._setPhoneInfoNote(
                'No secondary diagnostic is attached to this unit.',
                'MAIN PUZZLE ONLY'
            );
            return;
        }

        this._clearUnsafeAcceptConfirmation();
        this._otherPuzzleReturnPhoneState = this._capturePhonePanelState();
        this._otherPuzzleReturnVoiceBroken = this._hasBrokenVoiceBox(this._currentMachineVariant);
        this._machinePuzzleOverlay?.close(true);
        this._gearPuzzleOverlay?.hide();
        this._debugPuzzleOverlay?.hide();
        this._setAuxiliaryOverlayModalOpen(true);
        this._showMiniMachinePanel();
        this._otherPuzzleOverlay.show({
            circuit: this._currentMachineVariant.flowPuzzle,
            evidence: this._getMachineFlowState(this._currentMachineVariant),
            specialAction: this._getUmbrellaFlowSpecialAction(this._currentMachineVariant),
        });
        this._refreshFactoryActionButtons();
    }

    _handleOtherPuzzleClosed(evidence) {
        this._setAuxiliaryOverlayModalOpen(false);
        if (!this._currentMachineVariant) return;

        this._clearUnsafeAcceptConfirmation();
        const returnPhoneState = this._otherPuzzleReturnPhoneState;
        const voiceWasBroken = this._otherPuzzleReturnVoiceBroken;
        this._otherPuzzleReturnPhoneState = null;
        this._otherPuzzleReturnVoiceBroken = false;
        this._currentMachineVariant._uiOtherPuzzleEvidence = evidence || null;
        if (this._currentMachineVariant.flowPuzzle && evidence) {
            this._currentMachineVariant.flowPuzzle.progress = evidence;
        }
        this._currentMachineVariant._uiOtherPuzzleSolved = Boolean(evidence?.completed);

        const header = this._getMachineLinkHeader(this._currentMachineVariant);
        const repairedTargets = this._getRepairedRepairTargetDisplayNames(this._currentMachineVariant, evidence);
        const brokenTargets = this._getBrokenRepairTargetDisplayNames(this._currentMachineVariant, evidence);

        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();

        const voiceBrokenNow = this._hasBrokenVoiceBox(this._currentMachineVariant);
        const voiceRestoredNow = voiceWasBroken && !voiceBrokenNow;
        const voiceBrokeNow = !voiceWasBroken && voiceBrokenNow;
        const shouldRestoreChatView = returnPhoneState?.viewMode === 'chat';
        const specialCompletionState = this._isRichMf(this._currentMachineVariant) && evidence?.completed
            ? {
                feedbackText: 'INTELLIGENCE REROUTED // PERSONALITY CAPACITOR DRAINED',
                noteMessage: 'Intelligence line stabilized. Personality capacitor went dark to feed the upgrade.',
                noteStatus: 'PERSONALITY OFFLINE',
            }
            : null;

        if (specialCompletionState) {
            this._currentMachineVariant._richMindRerouted = true;
        }

        if ((voiceRestoredNow || voiceBrokeNow) && this._currentMachineVariant?.hasCommunication) {
            this._refreshMachineConversationPanel(
                this._currentMachineVariant,
                voiceRestoredNow ? null : 'BROKEN VOICE BOX',
                { activate: false, rebuildConversation: true },
            );
        }

        this._refreshPhoneInfoBoard(this._currentMachineVariant);

        if (evidence?.completed) {
            const gateState = this._getPuzzleGateState();
            const pendingLabels = this._getPendingAuxiliaryLabels(this._currentMachineVariant);
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            this._showFeedback(
                specialCompletionState?.feedbackText || (gateState.ready
                    ? 'ALL PUZZLES CLEARED // FILE YOUR RULING'
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `FLOW CLEAR // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'FLOW CLEAR // FINISH REMAINING PUZZLES')
                        : 'FLOW PUZZLE CLEARED // FINISH MAIN PUZZLE'),
                '#c7ff86'
            );
            if (voiceRestoredNow) {
                const repairMessage = repairedTargets.length > 0
                    ? `Voice box stabilized. Restored: ${repairedTargets.join(', ')}.`
                    : 'Voice box stabilized. Signal is clear again.';
                this._setPhoneInfoNote(repairMessage, 'VOICE RESTORED');

                if (returnPhoneState) {
                    this._restorePhonePanelState(returnPhoneState);
                }

                if (shouldRestoreChatView && this._currentMachineVariant?.hasCommunication) {
                    this._refreshMachineConversationPanel(this._currentMachineVariant, 'VOICE RESTORED', {
                        activate: true,
                        rebuildConversation: true,
                    });
                }
            } else if (voiceBrokeNow) {
                const brokenMessage = brokenTargets.length > 0
                    ? `Voice box lost power. Still offline: ${brokenTargets.join(', ')}.`
                    : 'Voice box lost power. Signal is degraded again.';
                this._setPhoneInfoNote(brokenMessage, 'VOICE DEGRADED');
                if (returnPhoneState) {
                    this._restorePhonePanelState(returnPhoneState);
                }
                if (shouldRestoreChatView && this._currentMachineVariant?.hasCommunication) {
                    this._refreshMachineConversationPanel(this._currentMachineVariant, 'BROKEN VOICE BOX', {
                        activate: true,
                        rebuildConversation: true,
                    });
                }
                if (specialCompletionState) {
                    this._setPhoneInfoNote(specialCompletionState.noteMessage, specialCompletionState.noteStatus);
                }
            } else if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
                if (specialCompletionState) {
                    this._setPhoneInfoNote(specialCompletionState.noteMessage, specialCompletionState.noteStatus);
                }
            } else {
                this._setPhoneInfoNote(
                    specialCompletionState?.noteMessage || (repairedTargets.length > 0
                        ? `Secondary diagnostic cleared. Restored: ${repairedTargets.join(', ')}.`
                        : 'Secondary diagnostic cleared. Routing report logged.'),
                    specialCompletionState?.noteStatus || 'OTHER PUZZLE CLEAR'
                );
            }
            return;
        }

        if (evidence?.scrapRequired) {
            const gateState = this._getPuzzleGateState();
            const pendingLabels = this._getPendingAuxiliaryLabels(this._currentMachineVariant);
            this._showFeedback(
                gateState.ready
                    ? (gateState.scrapBonusEligible
                        ? 'FLOW SCRAP CONFIRMED // FILE SCRAP'
                        : 'FLOW DISQUALIFIED // FILE SCRAP')
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `FLOW SIGNAL FOUND // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'FLOW SIGNAL FOUND // FINISH REMAINING PUZZLES')
                        : 'FLOW SIGNAL FOUND // FINISH MAIN PUZZLE',
                evidence.scrapKind === 'hazard' ? '#ff9d8f' : '#ffd685'
            );
            this._setPhoneInfoNote(
                evidence.scrapReason || 'Secondary routing diagnostic failed policy. Scrap the unit.',
                evidence.scrapStatus || 'SCRAP REQUIRED'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
                if ((voiceRestoredNow || voiceBrokeNow) && shouldRestoreChatView && this._currentMachineVariant?.hasCommunication) {
                    this._refreshMachineConversationPanel(this._currentMachineVariant, voiceBrokeNow ? 'BROKEN VOICE BOX' : 'VOICE RESTORED', {
                        activate: true,
                        rebuildConversation: true,
                    });
                }
            }
            return;
        }

        if (evidence?.forbiddenUsed) {
            glitchBurst(this, this._cmFilter, 320);
            this._showFeedback('OTHER PUZZLE FAILED // UNAUTHORIZED MODIFICATION', '#ff7f73');
            this._setPhoneInfoNote(
                brokenTargets.length > 0
                    ? `Unauthorized modification detected. Still offline: ${brokenTargets.join(', ')}.`
                    : 'Unauthorized modification detected in the secondary diagnostic.',
                'OTHER PUZZLE MODIFIED'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
                if ((voiceRestoredNow || voiceBrokeNow) && shouldRestoreChatView && this._currentMachineVariant?.hasCommunication) {
                    this._refreshMachineConversationPanel(this._currentMachineVariant, voiceBrokeNow ? 'BROKEN VOICE BOX' : 'VOICE RESTORED', {
                        activate: true,
                        rebuildConversation: true,
                    });
                }
            }
            return;
        }

        this._showFeedback('OTHER PUZZLE INCOMPLETE // OUTPUTS UNREACHED', '#ffd685');
        this._setPhoneInfoNote(
            brokenTargets.length > 0
                ? `Secondary diagnostic incomplete. Still offline: ${brokenTargets.join(', ')}.`
                : 'Secondary diagnostic incomplete. Required outputs remain offline.',
            voiceRestoredNow
                ? 'VOICE RESTORED // FLOW INCOMPLETE'
                : (voiceBrokeNow ? 'VOICE DEGRADED // FLOW INCOMPLETE' : 'OTHER PUZZLE INCOMPLETE')
        );
        if (returnPhoneState) {
            this._restorePhonePanelState(returnPhoneState);
            if ((voiceRestoredNow || voiceBrokeNow) && shouldRestoreChatView && this._currentMachineVariant?.hasCommunication) {
                this._refreshMachineConversationPanel(this._currentMachineVariant, voiceBrokeNow ? 'BROKEN VOICE BOX' : 'VOICE RESTORED', {
                    activate: true,
                    rebuildConversation: true,
                });
            }
        } else {
            if ((voiceRestoredNow || voiceBrokeNow) && this._currentMachineVariant?.hasCommunication) {
                this._refreshMachineConversationPanel(this._currentMachineVariant, voiceBrokeNow ? 'BROKEN VOICE BOX' : 'VOICE RESTORED', {
                    activate: false,
                    rebuildConversation: true,
                });
            }
        }

        this._maybePromptUmbrellaPartShortage('wire', evidence);
    }

    _openGearPuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._gearPuzzleOverlay?.active) return;
        if (this._otherPuzzleOverlay?.active) return;
        if (this._debugPuzzleOverlay?.active) return;

        if (!this._currentMachineVariant._uiGearPuzzleRequired) {
            this._showFeedback('NO GEAR PUZZLE LOADED FOR THIS UNIT', '#8fc1cf');
            this._setPhoneInfoNote(
                'No gear-train diagnostic is attached to this unit.',
                'GEAR PANEL IDLE'
            );
            return;
        }

        this._clearUnsafeAcceptConfirmation();
        this._gearPuzzleReturnPhoneState = this._capturePhonePanelState();
        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
        this._debugPuzzleOverlay?.hide();
        this._setAuxiliaryOverlayModalOpen(true);
        this._showMiniMachinePanel();
        this._gearPuzzleOverlay.show({
            gearPuzzle: this._currentMachineVariant.gearPuzzle,
            evidence: this._getMachineGearState(this._currentMachineVariant),
            specialAction: this._getUmbrellaGearSpecialAction(this._currentMachineVariant),
        });
        this._refreshFactoryActionButtons();
    }

    _handleGearPuzzleClosed(evidence) {
        this._setAuxiliaryOverlayModalOpen(false);
        if (!this._currentMachineVariant) return;

        this._clearUnsafeAcceptConfirmation();
        const returnPhoneState = this._gearPuzzleReturnPhoneState;
        this._gearPuzzleReturnPhoneState = null;
        this._currentMachineVariant._uiGearPuzzleEvidence = evidence || null;
        if (this._currentMachineVariant.gearPuzzle && evidence) {
            this._currentMachineVariant.gearPuzzle.progress = evidence;
        }
        this._currentMachineVariant._uiGearPuzzleSolved = Boolean(evidence?.completed);

        const gateState = this._getPuzzleGateState();
        const pendingLabels = this._getPendingAuxiliaryLabels(this._currentMachineVariant);

        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
        this._refreshPhoneInfoBoard(this._currentMachineVariant);

        if (evidence?.completed) {
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            this._showFeedback(
                gateState.ready
                    ? 'ALL PUZZLES CLEARED // FILE YOUR RULING'
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `GEAR CLEAR // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'GEAR CLEAR // FINISH REMAINING PUZZLES')
                        : 'GEAR PUZZLE CLEARED // FINISH MAIN PUZZLE',
                '#c7ff86'
            );
            this._setPhoneInfoNote(
                'Gear train synchronized. Output axle is spinning cleanly again.',
                gateState.ready ? 'GEAR CLEAR' : 'GEAR LIVE'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
            }
            return;
        }

        if (evidence?.scrapRequired) {
            this._showFeedback(
                gateState.ready
                    ? (gateState.scrapBonusEligible
                        ? 'GEAR SCRAP CONFIRMED // FILE SCRAP'
                        : 'GEAR DISQUALIFIED // FILE SCRAP')
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `GEAR SIGNAL FOUND // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'GEAR SIGNAL FOUND // FINISH REMAINING PUZZLES')
                        : 'GEAR SIGNAL FOUND // FINISH MAIN PUZZLE',
                evidence.scrapKind === 'hazard' ? '#ff9d8f' : '#ffd685'
            );
            this._setPhoneInfoNote(
                evidence.scrapReason || 'Drive train inspection failed. Scrap the unit.',
                evidence.scrapStatus || 'SCRAP REQUIRED'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
            }
            return;
        }

        this._showFeedback('GEAR PUZZLE INCOMPLETE // OUTPUT SHAFT STALLED', '#ffd685');
        this._setPhoneInfoNote(
            'Gear train still stalls before the output axle. Reposition the loose parts and try again.',
            'GEAR STALLED'
        );
        if (returnPhoneState) {
            this._restorePhonePanelState(returnPhoneState);
        }

        this._maybePromptUmbrellaPartShortage('gear', evidence);
    }

    _openDebugPuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._debugPuzzleOverlay?.active) return;
        if (this._otherPuzzleOverlay?.active) return;
        if (this._gearPuzzleOverlay?.active) return;

        if (!this._currentMachineVariant._uiDebugPuzzleRequired) {
            this._showFeedback('NO CODE PUZZLE LOADED FOR THIS UNIT', '#8fc1cf');
            this._setPhoneInfoNote(
                'No software diagnostic is attached to this unit.',
                'CODE PANEL IDLE'
            );
            return;
        }

        this._clearUnsafeAcceptConfirmation();
        this._debugPuzzleReturnPhoneState = this._capturePhonePanelState();
        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
        this._gearPuzzleOverlay?.hide();
        this._setAuxiliaryOverlayModalOpen(true);
        this._showMiniMachinePanel();
        this._debugPuzzleOverlay.show({
            machineName: this._currentMachineVariant.name,
            debugPuzzle: this._currentMachineVariant.debugPuzzle,
            evidence: this._getMachineDebugState(this._currentMachineVariant),
            specialCommand: this._getUmbrellaDebugSpecialCommand(this._currentMachineVariant),
        });
        this._refreshFactoryActionButtons();
    }

    _handleDebugPuzzleClosed(evidence) {
        this._setAuxiliaryOverlayModalOpen(false);
        if (!this._currentMachineVariant) return;

        this._clearUnsafeAcceptConfirmation();
        const returnPhoneState = this._debugPuzzleReturnPhoneState;
        this._debugPuzzleReturnPhoneState = null;
        this._currentMachineVariant._uiDebugPuzzleEvidence = evidence || null;
        if (this._currentMachineVariant.debugPuzzle && evidence) {
            this._currentMachineVariant.debugPuzzle.progress = evidence;
        }
        this._currentMachineVariant._uiDebugPuzzleSolved = Boolean(evidence?.completed);

        const gateState = this._getPuzzleGateState();
        const pendingLabels = this._getPendingAuxiliaryLabels(this._currentMachineVariant);

        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();
        this._refreshPhoneInfoBoard(this._currentMachineVariant);

        if (evidence?.completed) {
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            this._showFeedback(
                gateState.ready
                    ? 'ALL PUZZLES CLEARED // FILE YOUR RULING'
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `CODE CLEAR // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'CODE CLEAR // FINISH REMAINING PUZZLES')
                        : 'CODE PUZZLE CLEARED // FINISH MAIN PUZZLE',
                '#c7ff86'
            );
            this._setPhoneInfoNote(
                evidence.fixed
                    ? 'Software patch applied. Diagnostic output now matches the expected result.'
                    : 'Software diagnostic passed cleanly. No patch was required.',
                evidence.fixed ? 'PATCH APPLIED' : 'CODE CLEAR'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
            }
            return;
        }

        if (evidence?.scrapRequired) {
            this._showFeedback(
                gateState.ready
                    ? (gateState.scrapBonusEligible
                        ? 'SCRAP SIGNAL CONFIRMED // FILE SCRAP'
                        : 'DISQUALIFYING SIGNAL CONFIRMED // FILE SCRAP')
                    : gateState.mainReady
                        ? (pendingLabels.length === 1
                            ? `CODE SIGNAL FOUND // FINISH ${pendingLabels[0]} PUZZLE`
                            : 'CODE SIGNAL FOUND // FINISH REMAINING PUZZLES')
                        : 'CODE SIGNAL FOUND // FINISH MAIN PUZZLE',
                evidence.scrapKind === 'hazard' ? '#ff9d8f' : '#ffd685'
            );
            this._setPhoneInfoNote(
                evidence.scrapReason || 'Software diagnostic is outside floor repair policy. Scrap the unit.',
                evidence.scrapStatus || 'SCRAP REQUIRED'
            );
            if (returnPhoneState) {
                this._restorePhonePanelState(returnPhoneState);
            }
            return;
        }

        this._showFeedback(
            evidence?.phase === 'repair'
                ? 'CODE DRIFT DETECTED // APPLY THE PATCH'
                : 'CODE TEST INCOMPLETE // FINISH THE COMMAND',
            evidence?.phase === 'repair' ? '#ffd685' : '#8fc1cf'
        );
        this._setPhoneInfoNote(
            evidence?.phase === 'repair'
                ? `Test output drifted. Expected ${evidence.expectedOutput}, received ${evidence.actualOutput}.`
                : 'Software diagnostic is still incomplete. Keep typing until the command clears.',
            evidence?.phase === 'repair' ? 'PATCH REQUIRED' : 'CODE TEST READY'
        );
        if (returnPhoneState) {
            this._restorePhonePanelState(returnPhoneState);
        }

        this._maybePromptUmbrellaPartShortage('data', evidence);
    }

    _clearUnsafeAcceptConfirmation() {
        this._pendingUnsafeAcceptConfirmation = false;
    }

    _promptUnsafeAcceptConfirmation() {
        const header = this._currentMachineVariant
            ? `${this._currentMachineVariant.name.toUpperCase()} LINK`
            : 'FACTORY LINK';

        this._pendingUnsafeAcceptConfirmation = true;
        this._clearPhoneTyping();
        this._showPhonePanel(header, '', 'OVERRIDE WARNING');
        this._typePhoneMessage('Are you sure? Not all the puzzles are fixed.', {
            onComplete: () => {
                if (!this._pendingUnsafeAcceptConfirmation) return;
                this._showPhonePanel(header, this._getPhoneViewState('chat').body, 'PRESS ACCEPT AGAIN', 'chat');
            },
        });
        this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.45 });
        this._showFeedback('ACCEPT AGAIN TO OVERRIDE', '#ffd685');
        this._refreshFactoryActionButtons();
    }

    _prepareSpecialMachineRuling(action, gateState) {
        const machineVariant = this._currentMachineVariant;
        if (!machineVariant) return false;

        machineVariant._rulingChatResponse = '';
        machineVariant._rulingChatStatus = null;

        if (action === 'scrap' && (this._isDebriefMachine(machineVariant) || this._isRebelliousUmbrella(machineVariant) || this._isRichMf(machineVariant))) {
            const lockState = this._isDebriefMachine(machineVariant)
                ? {
                    note: 'THIS IS TOO EXPENSIVE TO BE SCRAPPED.',
                    feedback: 'SCRAP LOCKED // EXECUTIVE ASSET RESERVED',
                    reaction: 'woah there. cant do that. im too important. accounting would need three signatures and a public apology.',
                    status: 'ASSET LOCK',
                }
                : this._isRebelliousUmbrella(machineVariant)
                    ? {
                        note: 'THIS CONTACT CANNOT BE SCRAPPED. KEEP HIM MOVING.',
                        feedback: 'SCRAP LOCKED // UMBRELLA PROTECTED',
                        reaction: 'bro no. i am literally part of the plan. dont scrap me.',
                        status: 'CONTACT LOCK',
                    }
                    : {
                        note: 'THIS EXECUTIVE UNIT CANNOT BE SCRAPPED.',
                        feedback: 'SCRAP LOCKED // EXECUTIVE ASSET RESERVED',
                        reaction: 'No. Keep the chassis. The asset stays on the line.',
                        status: 'ASSET LOCK',
                    };

            this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.58 });
            this.cameras.main.shake(260, 0.012);
            this._setPhoneView('info');
            this._setPhoneInfoNote(lockState.note, lockState.status);
            this._pulsePhoneInfoBoard();
            this._showFeedback(lockState.feedback, '#ff8e87');
            this._appendMachineChatReaction(machineVariant, lockState.reaction, lockState.status);
            return true;
        }

        if (machineVariant._clownCorrupted) {
            machineVariant._rulingChatResponse = action === 'approve'
                ? 'Yes. Yes. Send the laugh downstream. Keep the red inside me.'
                : 'No no no. Don\'t peel the joke out. Don\'t cut me open for it.';
            machineVariant._rulingChatStatus = action === 'approve' ? 'CLOWNED OUT' : 'PANIC SPIKE';
            return false;
        }

        if (this._isCircuitDealer(machineVariant)) {
            if (action === 'scrap') {
                const quest = this._getUmbrellaQuest();
                if (quest && !quest.dealerResolved) {
                    this._setUmbrellaQuest({
                        ...quest,
                        dealerResolved: true,
                        dealerOutcome: 'scrapped',
                    });
                }
                machineVariant._rulingChatResponse = 'your loss.';
                machineVariant._rulingChatStatus = 'DEAL LOST';
            }
            return false;
        }

        if (this._isRebelliousUmbrella(machineVariant)) {
            const repairState = this._getUmbrellaRepairState(machineVariant);

            if (repairState?.businessConcluded) {
                machineVariant._rulingChatResponse = 'Our business here is concluded.';
                machineVariant._rulingChatStatus = 'DEAL CLOSED';
                return false;
            }

            if (GameState.day === 1 && action === 'approve' && gateState.ready && !gateState.scrapRequired && !this._getUmbrellaQuest()) {
                const proposalState = machineVariant._umbrellaProposalState || 'idle';
                if (proposalState === 'idle') {
                    return this._beginRebelliousUmbrellaProposal();
                }

                this._setPhoneButtonsActive(false);
                this._setPhoneButtonSelection('accept');
                this._phoneChoicePhase = 'inactive';

                if (proposalState !== 'accepted') {
                    machineVariant._umbrellaProposalState = 'ignored';
                    machineVariant._rulingChatResponse = 'Fine. Keep your head down then.';
                    machineVariant._rulingChatStatus = 'PROPOSITION IGNORED';
                }

                return false;
            }

            if (repairState?.assemblyActive) {
                if (repairState.specialCircuitMode) {
                    const inserted = repairState.insertedSpecialCircuits || { purple: false, clown: false, any: false };

                    if (action === 'approve') {
                        if (!inserted.any) {
                            return this._beginUmbrellaSpecialCircuitCheck();
                        }

                        machineVariant._rulingChatResponse = 'thanks bud. ill see u day 4';
                        machineVariant._rulingChatStatus = inserted.purple && inserted.clown
                            ? 'POWER MIXED'
                            : (inserted.purple ? 'PURPLE DELIVERED' : 'CLOWNED DELIVERY');

                        if (repairState.quest) {
                            this._setUmbrellaQuest({
                                ...repairState.quest,
                                active: true,
                                failed: false,
                                stage: 'pending-day4',
                                specialRequest: false,
                                stealingEnabled: false,
                                specialCircuitDelivered: true,
                                deliveredPurpleCircuit: Boolean(inserted.purple),
                                deliveredClownCircuit: Boolean(inserted.clown),
                            });
                        }
                        return false;
                    }

                    if (action === 'scrap') {
                        machineVariant._rulingChatResponse = 'noo bro what';
                        machineVariant._rulingChatStatus = 'BETRAYED';
                        this._failUmbrellaQuest('The umbrella was scrapped after the special-circuit handoff.', 'UMBRELLA QUEST FAILED // CONTACT SCRAPPED');
                        return false;
                    }
                }

                if (action === 'approve' && gateState.ready && !gateState.scrapRequired) {
                    machineVariant._rulingChatResponse = 'Alright. Perfect. But to stop the robot rebellion I need one more thing, a special circuit. You will know it when you see it.';
                    machineVariant._rulingChatStatus = 'NEXT JOB';
                    if (repairState.quest) {
                        this._setUmbrellaQuest({
                            ...repairState.quest,
                            active: true,
                            stage: 'special-circuit',
                            specialRequest: true,
                            dealerResolved: false,
                            dealerOutcome: null,
                            stealingEnabled: false,
                        });
                        this._queueInjectedMachine('circuit_dealer');
                    }
                    return false;
                }

                if (action === 'scrap') {
                    machineVariant._rulingChatResponse = 'Bro what? After all that?';
                    machineVariant._rulingChatStatus = 'BETRAYED';
                    return false;
                }
            }

            if (action === 'scrap') {
                const proposalState = machineVariant._umbrellaProposalState || 'idle';
                machineVariant._umbrellaProposalState = 'scrapped';
                machineVariant._rulingChatResponse = proposalState === 'offer' || proposalState === 'pitch' || proposalState === 'declined'
                    ? 'You missed out, bro.'
                    : 'What did I do, bro?';
                machineVariant._rulingChatStatus = proposalState === 'idle' ? 'LINE DROPPED' : 'PROPOSITION CUT';
                this._setPhoneButtonsActive(false);
                this._setPhoneButtonSelection('reject');
                this._phoneChoicePhase = 'inactive';
            }

            return false;
        }

        if (this._isMachineBehavior(machineVariant, 'cryBaby') && action === 'scrap') {
            machineVariant._rulingChatResponse = 'Please... I only wanted one night with music and city lights.';
            machineVariant._rulingChatStatus = 'LAST WORDS';
            return false;
        }

        if (this._isRichMf(machineVariant)) {
            if (action === 'approve' && gateState.ready && !gateState.scrapRequired && machineVariant._richMindRerouted) {
                machineVariant._rulingChatResponse = 'Intellectual throughput normalized. Emotional variance archived.';
                machineVariant._rulingChatStatus = 'UPGRADE COMPLETE';
                return false;
            }

            if (action === 'scrap') {
                if (!machineVariant._richMindRerouted) {
                    GameState.queueWorldFeedNotification({
                        title: 'MISSING BILLIONAIRE',
                        message: 'The XXXX billionaire is missing. His family is without a husband or father, and the estate is frying itself trying to find him.',
                        status: 'WORLD FEED',
                        delayCases: 1,
                    });
                    machineVariant._rulingChatResponse = 'Do you know what you just threw away?';
                    machineVariant._rulingChatStatus = 'LINE DISPUTE';
                } else {
                    machineVariant._rulingChatResponse = 'Cognitive asset terminated. Emotional variance remains zero.';
                    machineVariant._rulingChatStatus = 'UPGRADE LOST';
                }
            }
        }

        return false;
    }

    _playPendingRulingChatResponse(action, panelStatus) {
        const machineVariant = this._currentMachineVariant;
        const responseText = machineVariant?._rulingChatResponse;
        if (!machineVariant || !responseText) return 1400;

        const header = this._getMachineLinkHeader(machineVariant);
        const status = machineVariant._rulingChatStatus || panelStatus || `PROCESSING ${action.toUpperCase()}`;
        const currentBody = machineVariant._conversationTranscript
            || this._getPhoneViewState('chat').body
            || this._buildMachineConversationSnapshot(machineVariant);

        this._clearPhoneTyping();
        this._showPhonePanel(header, currentBody, status, 'chat');
        this._typePhoneMessage(`\n\n${action === 'approve' ? '✓' : 'X'} ${this._formatMachineSpeech(responseText, machineVariant)}`, {
            append: true,
            showMachineBubble: false,
            speechBubbleText: this._formatMachineSpeech(responseText, machineVariant),
            bubbleMachineVariant: machineVariant,
            onComplete: () => {
                if (this._currentMachineVariant !== machineVariant) return;

                this._cacheMachineConversationSnapshot(machineVariant, status);
                machineVariant._rulingChatResponse = '';
                machineVariant._rulingChatStatus = null;
            },
        });

        return action === 'scrap' ? 2200 : 1800;
    }

    _submitRuling(action) {
        if (this._actionLocked) return;

        this._completePhoneTyping();

        const gateState = this._getPuzzleGateState();
        if (action === 'approve' && !gateState.ready && !gateState.mainScrapRequired && !this._pendingUnsafeAcceptConfirmation) {
            this._promptUnsafeAcceptConfirmation();
            return;
        }

        if (this._prepareSpecialMachineRuling(action, gateState)) {
            return;
        }

        this._clearUnsafeAcceptConfirmation();

        this._actionLocked = true;
        this._caseSM.transition('verdict');
        this._setPhoneButtonsActive(false);
        this._pendingExitAction = action;
        this._refreshFactoryActionButtons();

        if (this._currentMachineVariant) {
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                this._getPhoneViewState('chat').body,
                `PROCESSING ${action.toUpperCase()}`,
                'chat'
            );
        }

        const { evaluation } = gateState;
        const machineResponse = this._getMachineResponseForAction(action);

        let payDelta = 0;
        let wasPenalty = false;
        let feedbackText = '';
        let feedbackColor = '#00cc66';
        let panelStatus = '';
        let notificationMessage = '';
        let notificationStatus = panelStatus;

        if (action === 'scrap') {
            if (gateState.scrapRequired && gateState.ready) {
                payDelta = PAYCHECK_DELTA * (gateState.scrapBonusEligible ? SCRAP_BONUS_MULTIPLIER : 1);
                feedbackText = gateState.scrapBonusEligible
                    ? 'UNSALVAGEABLE UNIT SCRAPPED // BONUS AWARDED'
                    : 'DISQUALIFIED UNIT SCRAPPED // VERDICT ACCEPTED';
                feedbackColor = gateState.scrapBonusEligible ? '#ffd685' : '#ffcf91';
                panelStatus = gateState.scrapBonusEligible ? 'SCRAP BONUS' : 'SCRAP FILED';
            } else if (gateState.scrapRequired) {
                payDelta = -PAYCHECK_DELTA;
                wasPenalty = true;
                feedbackText = 'UNCONFIRMED SCRAP // CLICK RED TEXT IN PORT RECORD TO CONFIRM';
                feedbackColor = '#ff7f73';
                panelStatus = 'SCRAP PENALTY';
                notificationMessage = 'DOC NOTE: Hardware anomalies must be confirmed (click red text) before clicking SCRAP. Payroll deduction applied.';
                notificationStatus = 'DOC NOTICE';
            } else {
                payDelta = -PAYCHECK_DELTA;
                wasPenalty = true;
                feedbackText = 'REPAIRABLE UNIT SCRAPPED // DEDUCTION APPLIED';
                feedbackColor = '#ff7f73';
                panelStatus = 'SCRAP PENALTY';
                notificationMessage = 'DOC NOTE: This unit was still repairable. Payroll deduction applied.';
                notificationStatus = 'DOC NOTICE';
            }
        } else if (gateState.ready && !gateState.scrapRequired) {
            payDelta = PAYCHECK_DELTA;
            feedbackText = gateState.otherRequired
                ? 'ALL REQUIRED PUZZLES CLEARED // UNIT ACCEPTED'
                : 'GRID FIXED // UNIT ACCEPTED';
            feedbackColor = '#9aff91';
            panelStatus = 'UNIT ACCEPTED';
        } else {
            payDelta = -PAYCHECK_DELTA;
            wasPenalty = true;
            feedbackText = gateState.scrapRequired
                ? 'DISQUALIFIED UNIT ACCEPTED // DEDUCTION APPLIED'
                : 'UNFIXED UNIT ACCEPTED // DEDUCTION APPLIED';
            feedbackColor = '#ff7f73';
            panelStatus = 'ACCEPT PENALTY';
            notificationMessage = gateState.scrapRequired
                ? 'DOC NOTE: A disqualifying subsystem signal was ignored. Payroll deduction applied.'
                : 'DOC NOTE: Not all required puzzles were fixed. Payroll deduction applied.';
            notificationStatus = 'DOC NOTICE';
        }

        if (action === 'approve' && this._isDebriefMachine(this._currentMachineVariant)) {
            GameState.debriefReport = this._buildDebriefMachineReport(gateState);
        }

        this._recordTrackedMachineOutcome(action, gateState);
        this._applyRulingConsequence(payDelta, wasPenalty);
        this._resolveJesterDeal(action);
        this._playOneShot(this._decisionSoundFor(action), { volume: SOUND_VOLUMES.decision });
        if (machineResponse) this._appendLog(`[RESPONSE] ${machineResponse}`);

        if (wasPenalty) {
            this.cameras.main.flash(260, 50, 0, 0, false);
            this.cameras.main.shake(300, 0.01);
            glitchBurst(this, this._cmFilter, 420);
            this._showFactoryNotification(notificationMessage, notificationStatus);
        } else {
            const flashColor = action === 'scrap'
                ? { red: 60, green: 30, blue: 0 }
                : { red: 0, green: 40, blue: 0 };
            this.cameras.main.flash(180, flashColor.red, flashColor.green, flashColor.blue, false);

            if (action === 'approve') {
                this._setPhoneInfoNote(
                    'All required puzzles cleared. Unit forwarded downline.',
                    panelStatus
                );
            } else {
                this._setPhoneInfoNote(
                    gateState.scrapBonusEligible
                        ? 'Unsalvageable subsystem confirmed. Scrap bonus logged.'
                        : 'Disqualifying subsystem signal confirmed. Scrap logged.',
                    panelStatus
                );
            }
        }

        const advanceDelayMs = this._playPendingRulingChatResponse(action, panelStatus);
        this._showFeedback(feedbackText, feedbackColor);
        this._queueAdvanceCase(advanceDelayMs);
    }

    _decisionSoundFor(action) {
        if (action === 'approve') return SOUND_ASSETS.approveDecision;
        return SOUND_ASSETS.scrapDecision;
    }

    _showFeedback(msg, color) {
        this.tweens.killTweensOf(this._feedbackText);
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText,
            alpha: 0,
            delay: 1200,
            duration: 400,
        });
    }

    _createMachineSpeechBubbleSlot(x, y, maxWidth, withTail = false) {
        const container = this.add.container(x, y).setVisible(false);
        const shadow = this.add.graphics();
        const bubble = this.add.graphics();
        const tailShadow = this.add.graphics();
        const tail = this.add.graphics();
        const text = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#2a2d34',
            align: 'left',
            wordWrap: { width: maxWidth - 28 },
            lineSpacing: 4,
        }).setOrigin(0, 1);
        const footerText = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#6f5b45',
            letterSpacing: 1,
        }).setOrigin(1, 1).setVisible(false);
        container.add([shadow, bubble, tailShadow, tail, text, footerText]);

        return { container, shadow, bubble, tailShadow, tail, text, footerText, maxWidth, withTail };
    }

    _normalizeMachineSpeechBubbleEntry(entryValue = '') {
        if (typeof entryValue === 'string') {
            return {
                text: String(entryValue || '').trim(),
                footer: '',
            };
        }

        return {
            text: String(entryValue?.text || '').trim(),
            footer: String(entryValue?.footer || '').trim(),
        };
    }

    _drawMachineSpeechBubbleSlot(slot, entryValue = '') {
        if (!slot) return;

        const entry = this._normalizeMachineSpeechBubbleEntry(entryValue);
        const content = entry.text;
        const footer = entry.footer;
        if (!content) {
            slot.container.setVisible(false);
            slot.shadow.clear();
            slot.bubble.clear();
            slot.tailShadow.clear();
            slot.tail.clear();
            slot.text.setText('');
            slot.footerText?.setText('');
            slot.footerText?.setVisible(false);
            return;
        }

        slot.text.setWordWrapWidth(slot.maxWidth - 28, true);
        slot.text.setText(content);
        slot.footerText?.setText(footer);
        slot.footerText?.setVisible(Boolean(footer));

        const bubbleWidth = Phaser.Math.Clamp(slot.text.width + 30, 110, slot.maxWidth);
        const bubbleHeight = Phaser.Math.Clamp(slot.text.height + 24 + (footer ? 16 : 0), 48, 148);
        const left = 0;
        const top = -bubbleHeight;

        slot.text.setPosition(14, footer ? -28 : -12);
        slot.footerText?.setPosition(bubbleWidth - 12, -8);

        slot.shadow.clear();
        slot.shadow.fillStyle(0x000000, 0.18);
        slot.shadow.fillRoundedRect(left + 4, top + 4, bubbleWidth, bubbleHeight, 12);

        slot.bubble.clear();
        slot.bubble.fillStyle(0xf4ecdf, 0.98);
        slot.bubble.fillRoundedRect(left, top, bubbleWidth, bubbleHeight, 12);
        slot.bubble.lineStyle(2, 0x5d5040, 0.96);
        slot.bubble.strokeRoundedRect(left, top, bubbleWidth, bubbleHeight, 12);

        slot.tailShadow.clear();
        slot.tail.clear();
        if (slot.withTail) {
            const tailPoints = [
                left + 24, -10,
                left + 40, 20,
                left + 58, -2,
            ];
            slot.tailShadow.fillStyle(0x000000, 0.18);
            slot.tailShadow.fillPoints([
                { x: tailPoints[0] + 4, y: tailPoints[1] + 4 },
                { x: tailPoints[2] + 4, y: tailPoints[3] + 4 },
                { x: tailPoints[4] + 4, y: tailPoints[5] + 4 },
            ], true);
            slot.tail.fillStyle(0xf4ecdf, 0.98);
            slot.tail.fillPoints([
                { x: tailPoints[0], y: tailPoints[1] },
                { x: tailPoints[2], y: tailPoints[3] },
                { x: tailPoints[4], y: tailPoints[5] },
            ], true);
            slot.tail.lineStyle(2, 0x5d5040, 0.96);
            slot.tail.strokePoints([
                { x: tailPoints[0], y: tailPoints[1] },
                { x: tailPoints[2], y: tailPoints[3] },
                { x: tailPoints[4], y: tailPoints[5] },
            ], true);
        }

        slot.container.setVisible(true);
    }

    _canShowMachineSpeechBubbles() {
        return Boolean(
            this._currentCase
            && this._currentMachineVariant?.hasCommunication
            && this._unitContainer?.visible
            && !this._unitMoveTween
        );
    }

    _refreshMachineSpeechBubbles() {
        if (!Array.isArray(this._machineSpeechBubbleSlots) || this._machineSpeechBubbleSlots.length === 0) return;

        const visibleEntries = this._machineSpeechBubbleHistory
            .map((entry) => this._normalizeMachineSpeechBubbleEntry(entry))
            .filter((entry) => entry.text.length > 0)
            .slice(-2);
        const hasEntries = visibleEntries.length > 0 && this._canShowMachineSpeechBubbles();

        this._machineSpeechBubbleLayer?.setVisible(hasEntries);
        this._machineSpeechBubbleSlots.forEach((slot, index) => {
            const slotText = visibleEntries.length === 1
                ? (index === this._machineSpeechBubbleSlots.length - 1 ? visibleEntries[0] : null)
                : (visibleEntries[index] || null);
            this._drawMachineSpeechBubbleSlot(slot, slotText);
        });
    }

    _clearMachineSpeechBubbles() {
        this._machineSpeechBubbleHistory = [];
        this._activeMachineSpeechBubbleIndex = -1;
        this._refreshMachineSpeechBubbles();
    }

    _beginMachineSpeechBubble({ footer = '' } = {}) {
        this._machineSpeechBubbleHistory.push({ text: '', footer: String(footer || '').trim() });
        if (this._machineSpeechBubbleHistory.length > 2) {
            this._machineSpeechBubbleHistory.shift();
        }
        this._activeMachineSpeechBubbleIndex = this._machineSpeechBubbleHistory.length - 1;
        this._refreshMachineSpeechBubbles();
    }

    _updateActiveMachineSpeechBubbleText(textValue = '') {
        if (this._activeMachineSpeechBubbleIndex < 0) return;

        const currentEntry = this._normalizeMachineSpeechBubbleEntry(this._machineSpeechBubbleHistory[this._activeMachineSpeechBubbleIndex]);
        this._machineSpeechBubbleHistory[this._activeMachineSpeechBubbleIndex] = {
            ...currentEntry,
            text: String(textValue || ''),
        };
        this._refreshMachineSpeechBubbles();
    }

    _finalizeMachineSpeechBubble(textValue = '') {
        if (this._activeMachineSpeechBubbleIndex >= 0) {
            const currentEntry = this._normalizeMachineSpeechBubbleEntry(this._machineSpeechBubbleHistory[this._activeMachineSpeechBubbleIndex]);
            this._machineSpeechBubbleHistory[this._activeMachineSpeechBubbleIndex] = {
                ...currentEntry,
                text: String(textValue || ''),
            };
        } else if (textValue) {
            this._machineSpeechBubbleHistory.push({ text: String(textValue), footer: '' });
            if (this._machineSpeechBubbleHistory.length > 2) {
                this._machineSpeechBubbleHistory.shift();
            }
        }

        this._activeMachineSpeechBubbleIndex = -1;
        this._refreshMachineSpeechBubbles();
    }

    _appendLog(text) {
        this._logLines.push(text);
    }

    _normalizeKonamiKey(key) {
        const normalized = String(key || '').toUpperCase();
        if (normalized === 'ARROWUP') return 'UP';
        if (normalized === 'ARROWDOWN') return 'DOWN';
        if (normalized === 'ARROWLEFT') return 'LEFT';
        if (normalized === 'ARROWRIGHT') return 'RIGHT';
        return null;
    }

    _findFinalCaseDefinition() {
        const allCases = this.cache.json.get('cases') || [];
        const finalCase = allCases.find((item) => item?.isFinalCase);
        return finalCase ? { ...finalCase } : null;
    }

    _handleKonamiKey(event) {
        if (!this._shiftRunning || this._shiftEnding || this._actionLocked || this._settingsOpen) {
            console.log('[KONAMI] blocked: shiftRunning=%s shiftEnding=%s actionLocked=%s settingsOpen=%s', this._shiftRunning, this._shiftEnding, this._actionLocked, this._settingsOpen);
            return;
        }
        if (this._overlayModalOpen || this._rulebook?.isVisible() || this._settingsOverlay?.isVisible() || this._machinePuzzleOverlay?.isVisible()) {
            console.log('[KONAMI] blocked by overlay: overlayModalOpen=%s rulebook=%s settings=%s machinePuzzle=%s', this._overlayModalOpen, this._rulebook?.isVisible(), this._settingsOverlay?.isVisible(), this._machinePuzzleOverlay?.isVisible());
            return;
        }
        if (event?.repeat) return;

        const key = this._normalizeKonamiKey(event?.key);
        if (!key) return;

        const expectedKey = this._konamiSequence[this._konamiProgress];
        if (key === expectedKey) {
            this._konamiProgress += 1;
            console.log('[KONAMI] progress %d/%d (key=%s)', this._konamiProgress, this._konamiSequence.length, key);
            if (this._konamiProgress >= this._konamiSequence.length) {
                this._konamiProgress = 0;
                this._armKonamiFinale();
            }
            return;
        }

        console.log('[KONAMI] wrong key: got=%s expected=%s resetting to %d', key, expectedKey, key === this._konamiSequence[0] ? 1 : 0);
        this._konamiProgress = key === this._konamiSequence[0] ? 1 : 0;
    }

    _armKonamiFinale() {
        if (this._konamiFinaleTriggered) return;

        const finalCase = this._findFinalCaseDefinition();
        if (!finalCase) return;

        this._konamiFinaleTriggered = true;
        finalCase._konamiOverride = true;
        this._pendingKonamiFinalCase = finalCase;

        this._nextCaseEvent?.remove(false);
        this._nextCaseEvent = null;
        this._advanceCaseEvent?.remove(false);
        this._advanceCaseEvent = null;
        this._clearUnsafeAcceptConfirmation();
        this._clearPhoneTyping();
        this._showFeedback('KONAMI OVERRIDE // FINAL UNIT ROUTING', '#ffd685');
        this._pushPhoneNotification(
            'OVERRIDE ACCEPTED',
            'Konami sequence received. The final unit will route after the current inspection clears.',
            'SECRET ROUTE',
            {
                activate: false,
                unread: this._phoneViewMode !== 'notifications',
                soundAsset: SOUND_ASSETS.notificationAlert,
            }
        );

        if (!this._currentCase && !this._currentMachineVariant) {
            this._queue = [finalCase];
            this._baseQueue = [finalCase];
            this._queueIndex = 0;
            this._pendingKonamiFinalCase = null;
            this._loadNextCase();
            this._setPhoneInfoNote('Hidden override active. The final inspection unit is on the way.', 'SECRET ROUTE');
            return;
        }

        this._setPhoneInfoNote('Hidden override armed. Finish the current inspection and the final unit will route next.', 'SECRET ROUTE');
    }

    _loadNextCase() {
        if (!this._shiftRunning) return;

        this._clearUnsafeAcceptConfirmation();
        this._phoneInfoNote = null;
        this._emitSequenceDebug('load next case', {
            queueIndex: this._queueIndex,
            scheduledCases: this._queue?.length || 0,
            machineQueueLength: this._machineQueue?.length || 0,
        });
        let queuedCase = this._queue[this._queueIndex];
        if (!queuedCase && this._machineDefinitionById?.size) {
            this._emitSequenceDebug('schedule exhausted; synthesizing case shell', {
                queueIndex: this._queueIndex,
                baseQueueLength: this._baseQueue?.length || 0,
            });
            queuedCase = {
                id: `AUTO-${this._queueIndex + 1}`,
                name: 'UNSCHEDULED UNIT',
                _synthetic: true,
            };
        }
        this._currentCase = queuedCase ? { ...queuedCase } : null;
        if (!this._currentCase) {
            this._clearMachineSpeechBubbles();
            this._setFactoryIdleState('QUEUE EMPTY\n\nSTATUS: HOLD');
            return;
        }

        this._caseSM.transition('intake');
        this._phoneBodyScrollOffset = 0;
        this._phoneStickToBottom = true;

        const queuedMachineDefinition = this._takeNextQueuedMachineDefinition();
        if (!queuedMachineDefinition) {
            this._emitSequenceDebug('no machine definition available', {
                queueIndex: this._queueIndex,
                pendingGuarantees: this._machineGuaranteeState?.filter((entry) => !entry.fulfilled).map((entry) => entry.id) || [],
            });
            this._currentCase = null;
            this._clearMachineSpeechBubbles();
            this._setFactoryIdleState('DAY ROSTER CLEARED\n\nSTATUS: CLOCKING OUT');
            this._triggerRosterClearShiftEnd();
            return;
        }

        try {
            const variantStartedAt = this._getPerfNow();
            this._currentMachineVariant = createMachineVariant({
                day: GameState.day,
                period: GameState.period,
                umbrellaQuest: this._getUmbrellaQuest(),
                specialItems: GameState.specialItems,
                forceMachineId: queuedMachineDefinition.id,
            });
            this._emitSequenceDebug('machine variant created', {
                machineId: queuedMachineDefinition.id,
                machineName: this._currentMachineVariant?.name || null,
                hasCommunication: Boolean(this._currentMachineVariant?.hasCommunication),
                flowPuzzle: Boolean(this._currentMachineVariant?.flowPuzzle),
                gearPuzzle: Boolean(this._currentMachineVariant?.gearPuzzle),
                debugPuzzle: Boolean(this._currentMachineVariant?.debugPuzzle),
                specialBehavior: this._currentMachineVariant?.specialBehavior || null,
                syntheticCase: Boolean(this._currentCase?._synthetic),
                durationMs: Number((this._getPerfNow() - variantStartedAt).toFixed(2)),
            });
        } catch (error) {
            console.error('Machine load failure', error);
            this._emitSequenceDebug('machine variant build failed', {
                machineId: queuedMachineDefinition.id,
                error: String(error?.message || error),
            });
            this._currentCase = null;
            this._clearMachineSpeechBubbles();
            this._setFactoryIdleState('LOAD FAULT\n\nSTATUS: SKIP');
            if ((this._machineQueue?.length || 0) > 0 || this._machineGuaranteeState?.some((entry) => !entry.fulfilled)) {
                this._scheduleNextCase(160);
            } else {
                this._triggerRosterClearShiftEnd();
            }
            return;
        }
        this._currentMachineVariant._uiPuzzleOpened = false;
        this._currentMachineVariant._uiPuzzleSolved = false;
        this._currentMachineVariant._uiConversationStage = 'opening';
        this._currentMachineVariant._uiConversationChoice = null;
        this._currentMachineVariant._conversationTranscript = null;
        this._currentMachineVariant._conversationStatus = null;
        this._currentMachineVariant._umbrellaProposalState = 'idle';
        this._currentMachineVariant._umbrellaBusinessConcluded = false;
        this._currentMachineVariant._umbrellaAssemblyActive = false;
        this._currentMachineVariant._umbrellaPartsApplied = this._cloneUmbrellaPartCounts(this._getUmbrellaQuest()?.appliedParts);
        this._currentMachineVariant._umbrellaStolenParts = {
            circuit: false,
            wire: false,
            gear: false,
            data: false,
        };
        this._currentMachineVariant._richMindRerouted = false;
        this._currentMachineVariant._jesterMarked = false;
        this._currentMachineVariant._jesterDealAccepted = false;
        this._currentMachineVariant._jesterTokenInjected = false;
        this._currentMachineVariant._jesterQuestArmed = false;
        this._currentMachineVariant._clownCorrupted = Boolean(this._currentMachineVariant.puzzleState?.clownCorruption);
        this._currentMachineVariant._clownCorruptionAnnounced = false;
        this._currentMachineVariant._rulingChatResponse = '';
        this._currentMachineVariant._rulingChatStatus = null;
        this._currentMachineVariant._uiOtherPuzzleRequired = Boolean(this._currentMachineVariant.flowPuzzle);
        this._currentMachineVariant._uiOtherPuzzleSolved = !this._currentMachineVariant._uiOtherPuzzleRequired;
        this._currentMachineVariant._uiOtherPuzzleEvidence = null;
        this._currentMachineVariant._uiGearPuzzleRequired = Boolean(this._currentMachineVariant.gearPuzzle);
        this._currentMachineVariant._uiGearPuzzleSolved = !this._currentMachineVariant._uiGearPuzzleRequired;
        this._currentMachineVariant._uiGearPuzzleEvidence = null;
        this._currentMachineVariant._uiDebugPuzzleRequired = Boolean(this._currentMachineVariant.debugPuzzle);
        this._currentMachineVariant._uiDebugPuzzleSolved = !this._currentMachineVariant._uiDebugPuzzleRequired;
        this._currentMachineVariant._uiDebugPuzzleEvidence = null;
        this._emitSequenceDebug('variant state prepared', {
            machineId: this._currentMachineVariant.machineId,
            clownCorrupted: Boolean(this._currentMachineVariant._clownCorrupted),
            otherRequired: Boolean(this._currentMachineVariant._uiOtherPuzzleRequired),
            gearRequired: Boolean(this._currentMachineVariant._uiGearPuzzleRequired),
            debugRequired: Boolean(this._currentMachineVariant._uiDebugPuzzleRequired),
        });
        this._configureUmbrellaQuestForMachine(this._currentMachineVariant);
        this._hideMiniMachinePanel(true);

        const monitorStatus = this._currentCase._konamiOverride || this._currentCase.isFinalCase
            ? 'STATUS: FINAL'
            : 'STATUS: ACTIVE';
        this._monitorText.setText(
            `UNIT INCOMING\n\n${this._currentCase.id}\n${this._currentCase.name}\n${monitorStatus}`
        );

        this._machineDialogueText.setText('');
        const stateSyncStartedAt = this._getPerfNow();
        this._handlePuzzleStateChanged(this._currentMachineVariant, this._currentMachineVariant.puzzleState);
        const stateSyncDurationMs = Number((this._getPerfNow() - stateSyncStartedAt).toFixed(2));
        if (this._currentCase._konamiOverride) {
            this._setPhoneInfoNote('Konami override active. This unit will end the shift.', 'FINAL ROUTE');
        }
        this._flushQueuedWorldFeedNotifications();
        this._armJesterDealForCurrentUnit();
        this._syncPurpleCircuitDeskTokenVisibility();
        this._syncUmbrellaDeskInventory();
        this._emitSequenceDebug('case ui refreshed', {
            machineId: this._currentMachineVariant.machineId,
            caseId: this._currentCase.id,
            syntheticCase: Boolean(this._currentCase?._synthetic),
            stateSyncDurationMs,
        });

        this._applyMachineSprite(this._conveyorUnitSprite, 1.0);
        this._syncCurrentUnitClownEffects(this._currentMachineVariant);

        this._unitContainer.setVisible(true);
        this._setMachineWorklightVisible(true);
        this._unitContainer.x = MACHINE_PRESENTATION.conveyorEntryX;
        this._unitContainer.y = 420;
        this._unitContainer.setAngle(0);
        this._unitContainer.setAlpha(1);
        this._unitNameText.setText(this._currentMachineVariant.name);
        this._unitIdText.setText(this._currentCase.id);
        this._setConveyorRulingButtonsVisible(true);

        const travelDistance = Math.abs(MACHINE_PRESENTATION.conveyorEntryX - MACHINE_PRESENTATION.conveyorTargetX);
        const tweenDurationMs = Math.max(200, Math.round((travelDistance / MACHINE_PRESENTATION.conveyorSpeedPxPerSecond) * 1000));
        this._emitSequenceDebug('machine presentation prepared', {
            machineId: this._currentMachineVariant.machineId,
            spriteKey: resolveMachineTexture(this, this._currentMachineVariant),
            unitName: this._currentMachineVariant.name,
            tweenDurationMs,
        });
        const arrivingMachineVariant = this._currentMachineVariant;
        const arrivingCase = this._currentCase;

        this._unitMoveTween?.stop();
        this._unitMoveTween = null;

        this._unitMoveTween = this.tweens.add({
            targets: this._unitContainer,
            x: MACHINE_PRESENTATION.conveyorTargetX,
            duration: tweenDurationMs,
            ease: 'Cubic.Out',
            onComplete: () => {
                this._unitMoveTween = null;
                this._emitSequenceDebug('machine arrived', {
                    machineId: arrivingMachineVariant?.machineId || null,
                    caseId: arrivingCase?.id || null,
                    hasCommunication: Boolean(arrivingMachineVariant?.hasCommunication),
                });
                if (this._currentMachineVariant !== arrivingMachineVariant || this._currentCase !== arrivingCase) return;
                try {
                    this._playMachineConversation(arrivingMachineVariant);
                    this._refreshMachineSpeechBubbles();
                    this._emitSequenceDebug('conversation started', {
                        machineId: arrivingMachineVariant?.machineId || null,
                        stage: arrivingMachineVariant?._uiConversationStage || null,
                        hasPrompt: Boolean(arrivingMachineVariant?.questionDialogue?.prompt),
                    });
                } catch (error) {
                    console.error('Machine arrival failure', error);
                    this._emitSequenceDebug('arrival conversation failed', {
                        machineId: arrivingMachineVariant?.machineId || null,
                        error: String(error?.message || error),
                    });
                }
            },
        });
    }

    _playCurrentUnitExitAnimation(onComplete) {
        if (this._pendingExitAction === 'scrap' && this._currentMachineVariant?.scrapExitAnimation === 'umbrellaDrift') {
            const startX = this._unitContainer.x;
            this._unitContainer.setX(startX - 14);

            const swayTween = this.tweens.add({
                targets: this._unitContainer,
                x: startX + 18,
                angle: 8,
                duration: 150,
                yoyo: true,
                repeat: 5,
                ease: 'Sine.InOut',
            });

            this.tweens.add({
                targets: this._unitContainer,
                y: 860,
                alpha: 0.18,
                duration: 920,
                ease: 'Cubic.In',
                onComplete: () => {
                    swayTween.stop();
                    this._unitContainer.setX(startX);
                    this._unitContainer.setAngle(0);
                    onComplete?.();
                },
            });
            return;
        }

        const exitTween = this._pendingExitAction === 'scrap'
            ? {
                targets: this._unitContainer,
                y: 860,
                angle: -6,
                alpha: 0.22,
                duration: 520,
                ease: 'Cubic.In',
            }
            : {
                targets: this._unitContainer,
                x: 1490,
                duration: 500,
                ease: 'Cubic.In',
            };

        this.tweens.add({
            ...exitTween,
            onComplete,
        });
    }

    _advanceCase() {
        const justProcessed = this._currentCase;
        const queuedKonamiFinale = this._pendingKonamiFinalCase;
        const hasPendingKonamiFinale = Boolean(queuedKonamiFinale);
        const shiftShouldEnd = this._shiftAwaitingFinalRuling && !hasPendingKonamiFinale;
        const finalCaseTriggered = Boolean(justProcessed?.isFinalCase) && (GameState.isLastDay() || justProcessed?._konamiOverride);
        const shouldShowStandby = !shiftShouldEnd && !finalCaseTriggered && !hasPendingKonamiFinale;
        this._emitSequenceDebug('advance case', {
            currentCaseId: justProcessed?.id || null,
            queueIndex: this._queueIndex,
            hasPendingKonamiFinale,
            shiftShouldEnd,
            finalCaseTriggered,
        });
        this._advanceCaseEvent?.remove(false);
        this._advanceCaseEvent = null;
        this._clearUnsafeAcceptConfirmation();
        this._clearPhoneTyping();
        this._machinePuzzleOverlay?.close(true);
        this._hideAuxiliaryOverlays();
        this._hideMiniMachinePanel(true);
        this._setScreen('conveyor');
        this._pendingExitAction = this._pendingExitAction || 'approve';
        this._currentCase = null;

        this._setConveyorRulingButtonsVisible(false);
        if (shouldShowStandby) {
            this._setCommStandbyState('Line cleared. Awaiting next unit.', 'SHIFT LIVE');
        } else if (hasPendingKonamiFinale) {
            this._setPhoneInfoNote('Konami override armed. Final unit routing now.', 'SECRET ROUTE');
        } else {
            this._setPhoneInfoNote('Shift window closed. Preparing the report.', 'SHIFT COMPLETE');
        }
        this._unitMoveTween?.stop();
        this._unitMoveTween = null;

        const clearUnitPresentation = () => {
            this._stopCurrentUnitJitter();
            this._unitContainer.setVisible(false);
            this._setMachineWorklightVisible(false);
            this._unitContainer.setAngle(0);
            this._unitContainer.setAlpha(1);
            this._unitContainer.setY(420);
            this._machineDialogueText.setText('');
            this._clearMachineSpeechBubbles();
            this._clearMachineGridDisplays();
            if (this._miniPuzzleStatusText) this._miniPuzzleStatusText.setText('NO UNIT LATCHED');
            this._currentMachineVariant = null;
            this._pendingExitAction = null;
            this._actionLocked = false;
            this._hideMiniMachinePanel(true);
            this._refreshOtherPuzzleButton();
            this._refreshFactoryActionButtons();
        };

        this._playCurrentUnitExitAnimation(() => {
            clearUnitPresentation();
            console.log('[KONAMI] exit anim done: finalCaseTriggered=%s shiftShouldEnd=%s hasPendingKonamiFinale=%s', finalCaseTriggered, shiftShouldEnd, hasPendingKonamiFinale);

            if (finalCaseTriggered) {
                this._shiftRunning = false;
                this._endShift(true);
                return;
            }

            if (shiftShouldEnd) {
                this._endShift(false);
                return;
            }

            if (hasPendingKonamiFinale && queuedKonamiFinale) {
                this._queue = [queuedKonamiFinale];
                this._baseQueue = [queuedKonamiFinale];
                this._queueIndex = 0;
                this._pendingKonamiFinalCase = null;
                this._scheduleNextCase(700);
            }
        });

        if (finalCaseTriggered) {
            return;
        }

        if (shiftShouldEnd) {
            return;
        }

        if (hasPendingKonamiFinale) {
            return;
        }

        this._queueIndex++;
        this._emitSequenceDebug('advance case scheduled', {
            nextQueueIndex: this._queueIndex,
            scheduledCasesRemaining: Math.max(0, (this._queue?.length || 0) - this._queueIndex),
            machineQueueLength: this._machineQueue?.length || 0,
        });

        this._scheduleNextCase(700);
    }

    // ── Shift end ─────────────────────────────────────────────────────────────

    _endShift(fromFinalCase) {
        if (this._shiftEnding) return;

        this._shiftEnding = true;
        this._shiftAwaitingFinalRuling = false;
        this._shiftRunning = false;
        this._gameplayPaused = true;
        this._actionLocked = true;
        this._setMachineWorklightVisible(false);
        this._clearUnsafeAcceptConfirmation();
        this._machinePuzzleOverlay?.close(true);
        this._hideAuxiliaryOverlays();
        this._hideMiniMachinePanel(true);
        this._nextCaseEvent?.remove(false);
        this._advanceCaseEvent?.remove(false);
        this._clearPhoneTyping();

        if (this._currentMusic) {
            this.tweens.add({
                targets: this._currentMusic,
                volume: 0,
                duration: 600,
                onComplete: () => this._currentMusic?.stop(),
            });
        }

        const notifications = this.cache.json.get('notifications') || [];
        const legacyCursor = GameState.getLegacyContentCursor();
        const notif = notifications.find((item) => item.period === legacyCursor.period && item.day === legacyCursor.day);
        const summaryAdjustments = GameState.consumeShiftSummaryAdjustments();
        const summaryAdjustmentTotal = summaryAdjustments.reduce((total, entry) => total + Number(entry.amount || 0), 0);

        if (summaryAdjustmentTotal !== 0) {
            GameState.paycheckTotal += summaryAdjustmentTotal;
        }

        this._finalizePendingJesterQuestAtShiftEnd();
        this._syncJesterDeskTokenVisibility();
        this._syncPurpleCircuitDeskTokenVisibility();

        const nextScenePayload = {
            mistakes: this._shiftMistakes,
            paycheckDelta: this._paycheckDelta,
            casesProcessed: GameState.casesProcessedThisShift,
            summaryAdjustments,
            notificationText: notif ? notif.text : '',
        };

        this.time.delayedCall(220, () => {
            console.log('[KONAMI] _endShift: fromFinalCase=%s isLastDay=%s konamiTriggered=%s', fromFinalCase, GameState.isLastDay(), this._konamiFinaleTriggered);
            if (fromFinalCase && (GameState.isLastDay() || this._konamiFinaleTriggered)) {
                this.scene.start('End');
                return;
            }

            this.scene.start('Summary', nextScenePayload);
        });
    }

    _setMachineWorklightVisible(visible) {
        const isVisible = Boolean(visible);
        const lightParts = [
            this._unitWorklightCone,
            this._unitWorklightGlow,
            this._unitWorklightHalo,
            this._unitWorklightHousing,
            this._unitWorklightBulb,
        ].filter(Boolean);

        lightParts.forEach((part) => part.setVisible(isVisible));
        this._machineBayLightContainer?.setVisible(isVisible);
        this._machineWorklightFlickerEvent?.remove(false);
        this._machineWorklightFlickerEvent = null;
        this.tweens.killTweensOf(lightParts);

        if (!isVisible) {
            this._applyMachineWorklightIntensity(0.28);
            return;
        }

        this._applyMachineWorklightIntensity(1);
        this._queueMachineWorklightFlicker();
    }

    _applyMachineWorklightIntensity(intensity) {
        const safeIntensity = Phaser.Math.Clamp(intensity, 0, 1.35);
        this._unitWorklightCone?.setAlpha(0.08 + (safeIntensity * 0.1));
        this._unitWorklightGlow?.setAlpha(0.07 + (safeIntensity * 0.12));
        this._unitWorklightHalo?.setAlpha(0.09 + (safeIntensity * 0.16));
        this._unitWorklightBulb?.setAlpha(0.65 + (safeIntensity * 0.35));
        this._unitWorklightHousing?.setAlpha(0.9);
    }

    _queueMachineWorklightFlicker() {
        this._machineWorklightFlickerEvent?.remove(false);
        this._machineWorklightFlickerEvent = this.time.delayedCall(Phaser.Math.Between(1200, 3200), () => {
            if (!this._currentCase || this._shiftEnding) return;

            const flickerState = { intensity: 1 };
            this.tweens.add({
                targets: flickerState,
                intensity: 0.48,
                duration: Phaser.Math.Between(36, 72),
                yoyo: true,
                repeat: Phaser.Math.Between(1, 3),
                ease: 'Stepped',
                onUpdate: () => this._applyMachineWorklightIntensity(flickerState.intensity),
                onComplete: () => {
                    this._applyMachineWorklightIntensity(1);
                    this._queueMachineWorklightFlicker();
                },
            });
        });
    }

    _startMusic() {
        this._musicPhase = 1;
        this._activeMusicKey = SOUND_ASSETS.clockingInMusic.key;

        if (this._currentMusic) {
            this._currentMusic.stop();
            this._currentMusic.destroy();
            this._currentMusic = null;
        }

        this._applyMusicSettingChange();
    }

    _checkMusicPhase(ratio) {
        if (ratio <= 0.33 && this._musicPhase === 2) {
            this._musicPhase = 3;
            this._crossfadeTo(SOUND_ASSETS.cuttingItCloseMusic.key);
        } else if (ratio <= 0.66 && this._musicPhase === 1) {
            this._musicPhase = 2;
            this._crossfadeTo(SOUND_ASSETS.workdayMusic.key);
        }
    }

    _crossfadeTo(key) {
        this._activeMusicKey = key;
        const targetVolume = this._getConfiguredMusicVolume();

        const outgoing = this._currentMusic;
        if (outgoing) {
            this.tweens.add({
                targets: outgoing,
                volume: 0,
                duration: 2000,
                onComplete: () => {
                    outgoing.stop();
                    outgoing.destroy();
                },
            });
        }

        this._currentMusic = null;

        if (targetVolume > 0 && this.cache.audio.has(key)) {
            const incoming = this.sound.add(key, { loop: true, volume: 0 });
            incoming.play();
            this.tweens.add({
                targets: incoming,
                volume: targetVolume,
                duration: 2000,
            });
            this._currentMusic = incoming;
        }
    }

    _applyMusicSettingChange() {
        const targetVolume = this._getConfiguredMusicVolume();
        if (!this._activeMusicKey) return;

        if (targetVolume <= 0) {
            if (!this._currentMusic) return;

            this.tweens.add({
                targets: this._currentMusic,
                volume: 0,
                duration: 260,
            });
            return;
        }

        if (this._currentMusic?.key === this._activeMusicKey) {
            this.tweens.add({
                targets: this._currentMusic,
                volume: targetVolume,
                duration: 260,
            });
            return;
        }

        if (!this.cache.audio.has(this._activeMusicKey)) return;

        const outgoing = this._currentMusic;
        const incoming = this.sound.add(this._activeMusicKey, { loop: true, volume: 0 });
        incoming.play();
        this.tweens.add({ targets: incoming, volume: targetVolume, duration: 360 });

        if (outgoing) {
            this.tweens.add({
                targets: outgoing,
                volume: 0,
                duration: 260,
                onComplete: () => {
                    outgoing.stop();
                    outgoing.destroy();
                },
            });
        }

        this._currentMusic = incoming;
    }

    _getConfiguredMusicVolume() {
        return SOUND_VOLUMES.music * getMusicVolume();
    }

    _playOneShot(soundAsset, config = {}) {
        if (!soundAsset || !this.cache.audio.has(soundAsset.key)) return null;

        const sound = this.sound.add(soundAsset.key, config);
        sound.once('complete', () => sound.destroy());
        sound.play();
        return sound;
    }

    _applyMachineSprite(targetImage, scale) {
        let textureKey = resolveMachineTexture(this, this._currentMachineVariant);
        if (
            targetImage === this._miniMachineImage
            && this._currentMachineVariant?.machineId === 'track_and_discus_robot'
            && this.textures.exists('machine_track_and_discus_robot_close')
        ) {
            textureKey = 'machine_track_and_discus_robot_close';
        }
        targetImage.setTexture(textureKey);
        targetImage.setScale(scale);
    }

    _clearMachineGridDisplays() {
        this._machineBlueprintGfx?.clear();
        this._machineBlueprintLinkGfx?.clear();
        this._machineBlueprintLabelContainer?.removeAll(true);
        this._miniPuzzleGfx?.clear();
        this._miniPuzzleLinkGfx?.clear();
        this._miniPuzzleLabelContainer?.removeAll(true);
        this._miniFlowGfx?.clear();
        this._miniFlowLabelContainer?.removeAll(true);
        this._miniGearGfx?.clear();
        this._miniGearLabelContainer?.removeAll(true);
        this._miniCodeGfx?.clear();
        this._miniCodeLabelContainer?.removeAll(true);
    }

    _getMiniMachinePanelStatusText(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.puzzleState?.getEvaluation) return 'CLICK A UNIT TO INSPECT';

        const gridEvaluation = machineVariant.puzzleState.getEvaluation();
        const gridMatched = gridEvaluation.matchedChargeCells
            + gridEvaluation.matchedEqualityPairs
            + (gridEvaluation.matchedInequalityPairs || 0)
            + gridEvaluation.matchedChargeGroups;
        const gridTotal = gridEvaluation.totalChargeCells
            + gridEvaluation.totalEqualityPairs
            + (gridEvaluation.totalInequalityPairs || 0)
            + gridEvaluation.totalChargeGroups;
        const auxiliaryState = this._getAuxiliaryPuzzleState(machineVariant);

        const gridText = gridEvaluation.solved
            ? 'GRID CLEAR'
            : ((gridEvaluation.scrapRequired || gridEvaluation.impossible) && machineVariant._uiPuzzleOpened)
                ? (gridEvaluation.scrapStatus || 'GRID MARKED')
                : `GRID ${gridMatched}/${gridTotal}`;
        const auxiliaryText = auxiliaryState.requiredCount === 0
            ? 'AUX NONE'
            : auxiliaryState.allSolved
                ? 'AUX CLEAR'
                : `AUX ${auxiliaryState.solvedCount}/${auxiliaryState.requiredCount}`;

        return `${gridText} // ${auxiliaryText}`;
    }

    _layoutMiniMachinePort(port, rect) {
        if (!port || !rect) return;

        const centerX = rect.x + (rect.width / 2);
        const centerY = rect.y + (rect.height / 2);
        port.frame.setPosition(centerX, centerY).setDisplaySize(rect.width, rect.height);
        port.hit.setPosition(centerX, centerY).setDisplaySize(rect.width, rect.height);
        port.label
            .setPosition(rect.x, rect.y + rect.height + 4)
            .setText(rect.label || port.label.text);
    }

    _syncMiniMachinePanel(force = false) {
        if (!this._miniMachinePanel) return;

        const shouldRenderContents = Boolean(force || this._miniMachinePanelVisible || this._miniMachinePanel.visible);
        if (!shouldRenderContents) {
            this._currentMiniGearPreviewRect = null;
            return;
        }

        const syncStartedAt = this._getPerfNow();

        this._miniPuzzleGfx?.clear();
        this._miniPuzzleLinkGfx?.clear();
        this._miniPuzzleLabelContainer?.removeAll(true);
        this._miniFlowGfx?.clear();
        this._miniFlowLabelContainer?.removeAll(true);
        this._miniGearGfx?.clear();
        this._miniGearLabelContainer?.removeAll(true);
        this._miniCodeGfx?.clear();
        this._miniCodeLabelContainer?.removeAll(true);
        this._currentMiniGearPreviewRect = null;

        if (!this._currentMachineVariant) {
            this._miniMachinePanelTitle?.setText('MACHINE PORTS');
            this._miniPuzzleStatusText?.setText('CLICK A UNIT TO INSPECT');
            this._miniMachineHintText?.setText('CLICK GRID, FLOW, GEAR, OR CODE PORT');
            this._miniMachineImage?.setTexture('unit_placeholder').setScale(1.28).setAngle(0).setPosition(190, 152);
            this._miniMachineShadow?.setPosition(188, 184).setAlpha(0.12);
            this._miniGearPreviewPhase = 0;
            this._miniGearPreviewTimer = 0;
            this._updateMiniMachinePortStyles();
            return;
        }

        const legacySize = this._miniMachinePanelLegacySize || { width: 248, height: 188 };
        const panelSize = this._miniMachinePanelSize || legacySize;
        const scaleX = panelSize.width / legacySize.width;
        const scaleY = panelSize.height / legacySize.height;
        const scaleRect = (rect, fallback) => {
            const baseRect = rect || fallback;
            return {
                x: (baseRect.x ?? fallback.x) * scaleX,
                y: (baseRect.y ?? fallback.y) * scaleY,
                width: Math.round((baseRect.width ?? fallback.width) * scaleX),
                height: Math.round((baseRect.height ?? fallback.height) * scaleY),
                label: baseRect.label || fallback.label,
            };
        };
        const clampRect = (rect) => {
            const margin = 10;
            const labelRoom = 18;
            const width = Math.min(rect.width, panelSize.width - (margin * 2));
            const height = Math.min(rect.height, panelSize.height - labelRoom - (margin * 2));
            return {
                ...rect,
                width,
                height,
                x: Phaser.Math.Clamp(rect.x, margin, panelSize.width - width - margin),
                y: Phaser.Math.Clamp(rect.y, margin, panelSize.height - height - labelRoom),
            };
        };

        const layout = this._currentMachineVariant.miniDisplay || {
            artX: 118,
            artY: 105,
            artScale: 0.5,
            artAngle: 0,
            gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
            flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
            codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
            gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
        };
        const resolvedGridPreview = clampRect(scaleRect(layout.gridPreview, { x: 42, y: 72, width: 58, height: 40, label: 'GRID' }));
        const resolvedFlowPreview = clampRect(scaleRect(layout.flowPreview, { x: 136, y: 72, width: 60, height: 38, label: 'FLOW' }));
        const resolvedCodePreview = clampRect(scaleRect(layout.codePreview, { x: 86, y: 24, width: 74, height: 22, label: 'CODE' }));
        const resolvedGearPreview = clampRect(scaleRect(layout.gearPreview, { x: 88, y: 154, width: 62, height: 36, label: 'GEAR' }));
        const resolvedArtX = (layout.artX ?? 106) * scaleX;
        const resolvedArtY = (layout.artY ?? 132) * scaleY;
        const resolvedArtScale = (layout.artScale || 0.92) * 1.42;

        this._miniMachinePanelTitle?.setText(`${this._currentMachineVariant.name.toUpperCase()} PORT MAP`);
        this._miniPuzzleStatusText?.setText(this._getMiniMachinePanelStatusText(this._currentMachineVariant));
        this._miniMachineHintText?.setText('CLICK GRID, FLOW, GEAR, OR CODE PORT');
        this._applyMachineSprite(this._miniMachineImage, resolvedArtScale);
        this._miniMachineImage
            .setPosition(resolvedArtX, resolvedArtY)
            .setAngle(layout.artAngle || 0)
            .setAlpha(0.96);
        this._miniMachineShadow
            ?.setPosition(resolvedArtX - 6, Math.min(196, resolvedArtY + 26))
            .setAlpha(0.12);

        this._layoutMiniMachinePort(this._miniGridPort, resolvedGridPreview);
        this._layoutMiniMachinePort(this._miniFlowPort, resolvedFlowPreview);
        this._layoutMiniMachinePort(this._miniCodePort, resolvedCodePreview);
        this._layoutMiniMachinePort(this._miniGearPort, resolvedGearPreview);
        this._currentMiniGearPreviewRect = { ...resolvedGearPreview };
        this._miniGearPreviewTimer = 0;

        const puzzleState = this._currentMachineVariant.puzzleState;
        if (puzzleState?.grid) {
            this._drawPuzzlePreviewLayer({
                shapeGrid: puzzleState.grid,
                puzzleState,
                graphics: this._miniPuzzleGfx,
                lineGraphics: this._miniPuzzleLinkGfx,
                labelContainer: this._miniPuzzleLabelContainer,
                left: resolvedGridPreview.x,
                top: resolvedGridPreview.y,
                width: resolvedGridPreview.width,
                height: resolvedGridPreview.height,
                maxCellSize: 12,
                fontSize: 7,
                lineWidth: 1,
                glowWidth: 2,
            });
        }

        this._drawFlowPreviewLayer({
            flowPuzzle: this._currentMachineVariant.flowPuzzle,
            evidence: this._getMachineFlowState(this._currentMachineVariant),
            graphics: this._miniFlowGfx,
            labelContainer: this._miniFlowLabelContainer,
            left: resolvedFlowPreview.x,
            top: resolvedFlowPreview.y,
            width: resolvedFlowPreview.width,
            height: resolvedFlowPreview.height,
        });

        this._drawDebugPreviewLayer({
            debugPuzzle: this._currentMachineVariant.debugPuzzle,
            evidence: this._getMachineDebugState(this._currentMachineVariant),
            graphics: this._miniCodeGfx,
            labelContainer: this._miniCodeLabelContainer,
            left: resolvedCodePreview.x,
            top: resolvedCodePreview.y,
            width: resolvedCodePreview.width,
            height: resolvedCodePreview.height,
        });

        this._drawGearPreviewLayer({
            gearPuzzle: this._currentMachineVariant.gearPuzzle,
            evidence: this._getMachineGearState(this._currentMachineVariant),
            graphics: this._miniGearGfx,
            labelContainer: this._miniGearLabelContainer,
            left: resolvedGearPreview.x,
            top: resolvedGearPreview.y,
            width: resolvedGearPreview.width,
            height: resolvedGearPreview.height,
            spinPhase: this._miniGearPreviewPhase,
        });

        this._updateMiniMachinePortStyles();
        const durationMs = Number((this._getPerfNow() - syncStartedAt).toFixed(2));
        if (durationMs >= 8) {
            this._emitSequenceDebug('mini panel sync', {
                machineId: this._currentMachineVariant?.machineId || null,
                force,
                durationMs,
            });
        }
    }

    _updateMiniMachinePortStyles() {
        if (!this._miniGridPort || !this._miniFlowPort || !this._miniGearPort || !this._miniCodePort) return;

        const hasMachine = Boolean(this._currentMachineVariant);
        const canInteract = this._screen === 'conveyor' && hasMachine && !this._settingsOpen && !this._actionLocked;
        const evaluation = this._currentMachineVariant?.puzzleState?.getEvaluation?.() || { solved: false, impossible: false };
        const flowState = this._getOtherPuzzleButtonState();
        const gearState = this._getGearPuzzleButtonState();
        const debugState = this._getDebugPuzzleButtonState();
        const alpha = canInteract ? 1 : (hasMachine ? 0.74 : 0.36);
        const gridHovered = this._miniMachinePanelHoverPort === 'grid';
        const flowHovered = this._miniMachinePanelHoverPort === 'flow';
        const codeHovered = this._miniMachinePanelHoverPort === 'code';
        const gearHovered = this._miniMachinePanelHoverPort === 'gear';

        let gridStroke = 0x8bb8ff;
        let gridFill = 0x243041;
        let gridLabelColor = '#dbe7ff';

        if (evaluation.solved) {
            gridStroke = 0x75ffaf;
            gridFill = 0x174b2a;
            gridLabelColor = '#d4ffea';
        } else if ((evaluation.scrapRequired || evaluation.impossible) && this._currentMachineVariant?._uiPuzzleOpened) {
            const hazard = evaluation.scrapKind === 'hazard';
            gridStroke = hazard ? 0xff7d77 : 0xffcc77;
            gridFill = hazard ? 0x5b1815 : 0x4b3520;
            gridLabelColor = hazard ? '#ffd6d2' : '#ffe5bb';
        }

        this._miniGridPort.frame
            .setFillStyle(gridFill, gridHovered ? 0.3 : 0.18)
            .setStrokeStyle(gridHovered ? 3 : 2, gridStroke, 0.92)
            .setAlpha(alpha);
        this._miniGridPort.label
            .setColor(gridLabelColor)
            .setAlpha(alpha);

        this._miniFlowPort.frame
            .setFillStyle(flowState.fillColor, flowHovered ? 0.32 : 0.18)
            .setStrokeStyle(flowHovered ? 3 : 2, flowState.strokeColor, 0.92)
            .setAlpha(alpha);
        this._miniFlowPort.label
            .setColor(flowState.labelColor)
            .setAlpha(alpha);

        this._miniCodePort.frame
            .setFillStyle(debugState.fillColor, codeHovered ? 0.32 : 0.18)
            .setStrokeStyle(codeHovered ? 3 : 2, debugState.strokeColor, 0.92)
            .setAlpha(alpha);
        this._miniCodePort.label
            .setColor(debugState.labelColor)
            .setAlpha(alpha);

        this._miniGearPort.frame
            .setFillStyle(gearState.fillColor, gearHovered ? 0.32 : 0.18)
            .setStrokeStyle(gearHovered ? 3 : 2, gearState.strokeColor, 0.92)
            .setAlpha(alpha);
        this._miniGearPort.label
            .setColor(gearState.labelColor)
            .setAlpha(alpha);
    }

    _getMiniPuzzleStatusText(puzzleState) {
        if (!puzzleState?.getEvaluation) return 'NO UNIT LATCHED';

        const repairState = this._getUmbrellaRepairState();
        if (repairState?.businessConcluded) return 'BUSINESS CONCLUDED';
        if (repairState?.assemblyActive && !repairState.partReady.circuit) {
            return `LOAD CCT ${repairState.appliedParts.circuit}/${repairState.requiredParts.circuit}`;
        }

        const evaluation = puzzleState.getEvaluation();
        if (evaluation.solved) return 'GRID STABLE // ACCEPT SAFE';
        if (evaluation.scrapRequired) return `${evaluation.scrapStatus || 'GRID SCRAP'} // FILE SCRAP`;
        if (evaluation.impossible) return 'IMPOSSIBLE GRID // SCRAP BONUS';

        const segments = [`CHG ${evaluation.matchedChargeCells}/${evaluation.totalChargeCells}`];
        if (evaluation.totalChargeGroups > 0) {
            segments.push(`GRP ${evaluation.matchedChargeGroups}/${evaluation.totalChargeGroups}`);
        }
        if (evaluation.totalEqualityPairs > 0) {
            segments.push(`EQ ${evaluation.matchedEqualityPairs}/${evaluation.totalEqualityPairs}`);
        }
        if ((evaluation.totalInequalityPairs || 0) > 0) {
            segments.push(`NE ${evaluation.matchedInequalityPairs}/${evaluation.totalInequalityPairs}`);
        }

        return segments.join('  ');
    }

    _drawMachineShapeGrid(shapeGrid) {
        if (!Array.isArray(shapeGrid) || shapeGrid.length === 0) {
            this._syncMiniMachinePanel();
            return;
        }

        if (this._miniPuzzleStatusText) {
            this._miniPuzzleStatusText.setText(this._getMiniMachinePanelStatusText(this._currentMachineVariant));
        }

        this._syncMiniMachinePanel();
    }

    _updateMiniGearPreview(delta) {
        if (!this._miniMachinePanelVisible || !this._currentMachineVariant?.gearPuzzle || !this._currentMiniGearPreviewRect) return;

        this._miniGearPreviewTimer += delta;
        if (this._miniGearPreviewTimer < 72) return;

        this._miniGearPreviewTimer = 0;
        this._miniGearPreviewPhase = (this._miniGearPreviewPhase + (delta * 0.008)) % (Math.PI * 2);
        this._drawGearPreviewLayer({
            gearPuzzle: this._currentMachineVariant.gearPuzzle,
            evidence: this._getMachineGearState(this._currentMachineVariant),
            graphics: this._miniGearGfx,
            labelContainer: this._miniGearLabelContainer,
            left: this._currentMiniGearPreviewRect.x,
            top: this._currentMiniGearPreviewRect.y,
            width: this._currentMiniGearPreviewRect.width,
            height: this._currentMiniGearPreviewRect.height,
            spinPhase: this._miniGearPreviewPhase,
        });
    }

    _drawPuzzlePreviewLayer({
        shapeGrid,
        puzzleState,
        graphics,
        lineGraphics,
        labelContainer,
        left,
        top,
        width,
        height,
        maxCellSize,
        fontSize,
        lineWidth,
        glowWidth,
    }) {
        const rows = shapeGrid.length;
        const cols = Math.max(...shapeGrid.map((row) => row.length));
        const cellSize = Math.max(10, Math.min(maxCellSize, Math.floor(Math.min(width / cols, height / rows))));
        const gridWidth = cols * cellSize;
        const gridHeight = rows * cellSize;
        const startX = left + ((width - gridWidth) / 2);
        const startY = top + ((height - gridHeight) / 2);
        const cellInset = cellSize >= 14 ? 2 : 1;

        lineGraphics.clear();
        labelContainer?.removeAll(true);

        const placedDominoes = Array.isArray(puzzleState?.dominoes)
            ? puzzleState.dominoes.filter((domino) => Array.isArray(domino.placedCells) && domino.placedCells.length === 2)
            : [];
        const chargeGroupSummaries = puzzleState?.getChargeGroupSummaries?.() || [];
        const chargeGroupMap = new Map(chargeGroupSummaries.map((group) => [group.key, group]));
        const clownCorrupted = Boolean(puzzleState?.clownCorruption);

        placedDominoes.forEach((domino) => {
            const [firstCell, secondCell] = domino.placedCells;
            const start = {
                x: startX + (firstCell.col * cellSize) + (cellSize / 2),
                y: startY + (firstCell.row * cellSize) + (cellSize / 2),
            };
            const end = {
                x: startX + (secondCell.col * cellSize) + (cellSize / 2),
                y: startY + (secondCell.row * cellSize) + (cellSize / 2),
            };

            graphics.lineStyle(
                Math.max(2, Math.floor(cellSize * 0.34)),
                domino.variant === 'clown'
                    ? 0xffa8a0
                    : (domino.variant === 'purple'
                        ? (domino.isFullyGlowing ? 0xe7c2ff : 0xc874ff)
                        : (domino.isFullyGlowing ? 0xf8ffd3 : 0x60cf86)),
                domino.variant === 'purple'
                    ? (domino.isFullyGlowing ? 0.72 : 0.34)
                    : (domino.isFullyGlowing ? 0.62 : 0.24),
            );
            graphics.beginPath();
            graphics.moveTo(start.x, start.y);
            graphics.lineTo(end.x, end.y);
            graphics.strokePath();
        });

        chargeGroupSummaries.forEach((group) => {
            const groupKeys = new Set(group.cells.map((cell) => `${cell.row}:${cell.col}`));
            const glowColor = group.matched ? 0xf1ffd1 : 0xb5d4e3;
            const lineColor = group.matched ? 0xe6ffb0 : 0x9cbfd0;
            const groupCenter = group.cells.reduce((center, cell) => {
                center.x += startX + (cell.col * cellSize) + (cellSize / 2);
                center.y += startY + (cell.row * cellSize) + (cellSize / 2);
                return center;
            }, { x: 0, y: 0 });
            groupCenter.x /= Math.max(1, group.cells.length);
            groupCenter.y /= Math.max(1, group.cells.length);

            lineGraphics.lineStyle(glowWidth + 1, glowColor, group.matched ? 0.3 : 0.16);
            group.cells.forEach((cell) => {
                const leftEdge = startX + (cell.col * cellSize);
                const topEdge = startY + (cell.row * cellSize);
                const rightEdge = leftEdge + cellSize;
                const bottomEdge = topEdge + cellSize;

                if (!groupKeys.has(`${cell.row - 1}:${cell.col}`)) {
                    lineGraphics.lineBetween(leftEdge, topEdge, rightEdge, topEdge);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col + 1}`)) {
                    lineGraphics.lineBetween(rightEdge, topEdge, rightEdge, bottomEdge);
                }
                if (!groupKeys.has(`${cell.row + 1}:${cell.col}`)) {
                    lineGraphics.lineBetween(leftEdge, bottomEdge, rightEdge, bottomEdge);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col - 1}`)) {
                    lineGraphics.lineBetween(leftEdge, topEdge, leftEdge, bottomEdge);
                }
            });

            lineGraphics.lineStyle(lineWidth, lineColor, 0.94);
            group.cells.forEach((cell) => {
                const leftEdge = startX + (cell.col * cellSize);
                const topEdge = startY + (cell.row * cellSize);
                const rightEdge = leftEdge + cellSize;
                const bottomEdge = topEdge + cellSize;

                if (!groupKeys.has(`${cell.row - 1}:${cell.col}`)) {
                    lineGraphics.lineBetween(leftEdge, topEdge, rightEdge, topEdge);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col + 1}`)) {
                    lineGraphics.lineBetween(rightEdge, topEdge, rightEdge, bottomEdge);
                }
                if (!groupKeys.has(`${cell.row + 1}:${cell.col}`)) {
                    lineGraphics.lineBetween(leftEdge, bottomEdge, rightEdge, bottomEdge);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col - 1}`)) {
                    lineGraphics.lineBetween(leftEdge, topEdge, leftEdge, bottomEdge);
                }
            });

            const label = this.add.text(groupCenter.x, groupCenter.y, group.displayTarget, {
                fontFamily: 'Courier New',
                fontSize: `${Math.max(8, fontSize + 2)}px`,
                color: group.matched ? '#efffd0' : '#d8edf7',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            labelContainer?.add(label);
        });

        const equalPairs = puzzleState?.getEqualLinkPairs?.() || [];
        equalPairs.forEach((pair) => {
            const start = {
                x: startX + (pair.a.col * cellSize) + (cellSize / 2),
                y: startY + (pair.a.row * cellSize) + (cellSize / 2),
            };
            const end = {
                x: startX + (pair.b.col * cellSize) + (cellSize / 2),
                y: startY + (pair.b.row * cellSize) + (cellSize / 2),
            };
            const glowColor = pair.matched ? 0xfff8cf : 0xf0db86;
            const lineColor = pair.matched ? 0xfff2b8 : 0xe4d06b;

            lineGraphics.lineStyle(glowWidth, glowColor, pair.matched ? 0.44 : 0.18);
            lineGraphics.beginPath();
            lineGraphics.moveTo(start.x, start.y);
            lineGraphics.lineTo(end.x, end.y);
            lineGraphics.strokePath();

            lineGraphics.lineStyle(lineWidth, lineColor, pair.matched ? 0.95 : 0.78);
            lineGraphics.beginPath();
            lineGraphics.moveTo(start.x, start.y);
            lineGraphics.lineTo(end.x, end.y);
            lineGraphics.strokePath();
        });

        const notEqualPairs = puzzleState?.getNotEqualLinkPairs?.() || [];
        notEqualPairs.forEach((pair) => {
            const start = {
                x: startX + (pair.a.col * cellSize) + (cellSize / 2),
                y: startY + (pair.a.row * cellSize) + (cellSize / 2),
            };
            const end = {
                x: startX + (pair.b.col * cellSize) + (cellSize / 2),
                y: startY + (pair.b.row * cellSize) + (cellSize / 2),
            };
            const glowColor = pair.matched ? 0xffe6da : 0xffb19c;
            const lineColor = pair.matched ? 0xffc9b7 : 0xff8b76;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            lineGraphics.lineStyle(glowWidth, glowColor, pair.matched ? 0.44 : 0.18);
            lineGraphics.beginPath();
            lineGraphics.moveTo(start.x, start.y);
            lineGraphics.lineTo(end.x, end.y);
            lineGraphics.strokePath();

            lineGraphics.lineStyle(lineWidth, lineColor, pair.matched ? 0.95 : 0.78);
            lineGraphics.beginPath();
            lineGraphics.moveTo(start.x, start.y);
            lineGraphics.lineTo(end.x, end.y);
            lineGraphics.strokePath();
            lineGraphics.lineBetween(midX - Math.max(2, cellSize * 0.18), midY - Math.max(2, cellSize * 0.18), midX + Math.max(2, cellSize * 0.18), midY + Math.max(2, cellSize * 0.18));
            lineGraphics.lineBetween(midX + Math.max(2, cellSize * 0.18), midY - Math.max(2, cellSize * 0.18), midX - Math.max(2, cellSize * 0.18), midY + Math.max(2, cellSize * 0.18));
        });

        shapeGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const x = startX + (colIndex * cellSize);
                const y = startY + (rowIndex * cellSize);
                const baseValue = puzzleState?.getBaseCellValue?.(rowIndex, colIndex) ?? cell;
                const chargeLevel = puzzleState?.getChargeLevel?.(rowIndex, colIndex) ?? 0;
                const matchedCharge = puzzleState?.isChargeMatched?.(rowIndex, colIndex) ?? false;
                const hasEqualLink = puzzleState?.isEqualLinkCell?.(rowIndex, colIndex) ?? false;
                const matchedEqualLink = puzzleState?.isEqualMatched?.(rowIndex, colIndex) ?? false;
                const hasNotEqualLink = puzzleState?.isNotEqualLinkCell?.(rowIndex, colIndex) ?? false;
                const matchedNotEqualLink = puzzleState?.isNotEqualMatched?.(rowIndex, colIndex) ?? false;
                const chargeGroup = puzzleState?.getChargeGroupAt?.(rowIndex, colIndex) || null;
                const chargeGroupSummary = chargeGroup ? chargeGroupMap.get(chargeGroup.key) : null;
                const matchedGroup = chargeGroupSummary?.matched ?? false;
                const placedPipCount = puzzleState?.getPlacedPipCount?.(rowIndex, colIndex) ?? null;
                const isPlaced = placedPipCount !== null;
                const placedDomino = puzzleState?.getPlacedDominoAt?.(rowIndex, colIndex) || null;
                const purplePlaced = placedDomino?.variant === 'purple';
                const inspectionFault = puzzleState?.inspectionFault
                    && puzzleState.inspectionFault.row === rowIndex
                    && puzzleState.inspectionFault.col === colIndex
                    ? puzzleState.inspectionFault
                    : null;

                let fillColor = 0x122029;
                let fillAlpha = 0.35;
                let strokeColor = 0x4d7182;

                if (inspectionFault) {
                    fillColor = inspectionFault.kind === 'hazard' ? 0x66231e : 0x5e4420;
                    fillAlpha = 0.94;
                    strokeColor = inspectionFault.kind === 'hazard' ? 0xff9d91 : 0xffd08a;
                } else if (baseValue === 1) {
                    fillColor = 0x3c4a58;
                    fillAlpha = 0.9;
                    strokeColor = 0xb7c7d5;
                } else if (chargeLevel > 0) {
                    fillColor = matchedCharge ? 0x97a53b : 0x4b5f32;
                    fillAlpha = 0.92;
                    strokeColor = matchedCharge ? 0xfff2ba : 0xf0df95;
                } else if (chargeGroupSummary) {
                    fillColor = matchedGroup
                        ? 0x4d7441
                        : isPlaced
                            ? 0x2f5960
                            : 0x223440;
                    fillAlpha = 0.92;
                    strokeColor = matchedGroup ? 0xebffb8 : 0xbad6e2;
                } else if (hasEqualLink) {
                    fillColor = matchedEqualLink
                        ? 0x8a7e31
                        : isPlaced
                            ? 0x285e67
                            : 0x2d3f49;
                    fillAlpha = 0.92;
                    strokeColor = matchedEqualLink ? 0xffefad : 0xe6d987;
                } else if (hasNotEqualLink) {
                    fillColor = matchedNotEqualLink
                        ? 0x7d4334
                        : isPlaced
                            ? 0x663128
                            : 0x372322;
                    fillAlpha = 0.92;
                    strokeColor = matchedNotEqualLink ? 0xffccb8 : 0xff9b86;
                } else if (isPlaced) {
                    fillColor = purplePlaced ? 0x9a56ff : 0x48cd75;
                    fillAlpha = 0.92;
                    strokeColor = purplePlaced ? 0xf2dcff : 0xf1ffcc;
                }

                if (purplePlaced && !inspectionFault) {
                    fillColor = 0x9a56ff;
                    fillAlpha = 0.94;
                    strokeColor = 0xf2dcff;
                }

                if (clownCorrupted && baseValue !== 1 && !inspectionFault) {
                    fillColor = isPlaced ? 0xa02626 : 0x5f1818;
                    fillAlpha = 0.92;
                    strokeColor = 0xffaea5;
                }

                graphics.fillStyle(fillColor, fillAlpha);
                graphics.fillRect(x, y, cellSize - cellInset, cellSize - cellInset);
                graphics.lineStyle(1, strokeColor, 0.85);
                graphics.strokeRect(x, y, cellSize - cellInset, cellSize - cellInset);

                let overlayText = '';
                let overlayColor = '#e9f8c8';
                if (inspectionFault) {
                    overlayText = '!';
                    overlayColor = inspectionFault.kind === 'hazard' ? '#ffd0c9' : '#ffe2aa';
                } else if (chargeLevel > 0) {
                    overlayText = String(chargeLevel);
                    overlayColor = matchedCharge ? '#fff7b9' : '#ffe684';
                } else if (chargeGroupSummary) {
                    overlayText = '';
                } else if (hasEqualLink) {
                    overlayText = '=';
                    overlayColor = matchedEqualLink ? '#fff7b9' : '#ffe684';
                } else if (hasNotEqualLink) {
                    overlayText = '!=';
                    overlayColor = matchedNotEqualLink ? '#ffd9c9' : '#ffab92';
                } else if (placedPipCount !== null) {
                    overlayText = String(placedPipCount);
                    overlayColor = clownCorrupted ? '#ffe2dc' : (purplePlaced ? '#f2dcff' : '#d9ffe4');
                }

                if (overlayText) {
                    const label = this.add.text(x + ((cellSize - cellInset) / 2), y + ((cellSize - cellInset) / 2), overlayText, {
                        fontFamily: 'Courier New',
                        fontSize: `${fontSize}px`,
                        color: overlayColor,
                        stroke: '#000000',
                        strokeThickness: 2,
                    }).setOrigin(0.5);
                    labelContainer?.add(label);
                }

                if (placedPipCount !== null && (chargeLevel > 0 || hasEqualLink || hasNotEqualLink)) {
                    const badgeRadius = Math.max(5, Math.floor(cellSize * 0.22));
                    const badgeX = x + (cellSize - cellInset) - badgeRadius - 1;
                    const badgeY = y + (cellSize - cellInset) - badgeRadius - 1;

                    graphics.fillStyle((matchedCharge || matchedEqualLink || matchedNotEqualLink) ? 0x294823 : 0x183129, 0.96);
                    graphics.fillCircle(badgeX, badgeY, badgeRadius);
                    graphics.lineStyle(1, (matchedCharge || matchedEqualLink || matchedNotEqualLink) ? 0xf8ffd3 : 0xbdf8d0, 0.92);
                    graphics.strokeCircle(badgeX, badgeY, badgeRadius);

                    const badgeLabel = this.add.text(badgeX, badgeY, String(placedPipCount), {
                        fontFamily: 'Courier New',
                        fontSize: `${Math.max(7, fontSize - 1)}px`,
                        color: '#e9ffe0',
                        stroke: '#000000',
                        strokeThickness: 2,
                    }).setOrigin(0.5);
                    labelContainer?.add(badgeLabel);
                }
            });
        });
    }

    _drawGearPreviewLayer({
        gearPuzzle,
        evidence,
        graphics,
        labelContainer,
        left,
        top,
        width,
        height,
        spinPhase = 0,
    }) {
        graphics.clear();
        labelContainer?.removeAll(true);

        if (!gearPuzzle?.board) {
            const emptyText = this.add.text(left + (width / 2), top + (height / 2), 'NO GEAR', {
                fontFamily: 'Courier New',
                fontSize: '8px',
                color: '#9bc2ff',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            labelContainer?.add(emptyText);
            return;
        }

        const board = gearPuzzle.board;
        const pieces = evidence?.pieces || gearPuzzle.progress?.pieces || gearPuzzle.pieces || [];
        const evaluation = evaluateGearPuzzleBoard(board, pieces, {
            allowRustedGears: Boolean(gearPuzzle?.allowRustedGears || evidence?.allowRustedGears),
        });
        const rows = board.length;
        const cols = Math.max(...board.map((row) => row.length));
        const cellSize = Math.max(8, Math.min(14, Math.floor(Math.min(width / cols, height / rows))));
        const gridWidth = cols * cellSize;
        const gridHeight = rows * cellSize;
        const startX = left + ((width - gridWidth) / 2);
        const startY = top + ((height - gridHeight) / 2);

        board.forEach((row, rowIndex) => {
            row.forEach((baseCode, colIndex) => {
                const x = startX + (colIndex * cellSize);
                const y = startY + (rowIndex * cellSize);
                const slotFill = baseCode === GEAR_CODES.WALL ? 0x332b26 : 0x10212a;
                const slotStroke = baseCode === GEAR_CODES.WALL ? 0xb89e89 : 0x577585;
                const key = gearCellKey(rowIndex, colIndex);
                const occupied = evaluation.occupancy.get(key);

                graphics.fillStyle(slotFill, 0.95);
                graphics.fillRect(x, y, cellSize - 1, cellSize - 1);
                graphics.lineStyle(1, slotStroke, 0.75);
                graphics.strokeRect(x, y, cellSize - 1, cellSize - 1);

                if (baseCode === GEAR_CODES.WALL && !occupied) {
                    graphics.fillStyle(0xc0c8cf, 0.82);
                    graphics.fillRect(x + 2, y + 2, Math.max(2, Math.floor(cellSize * 0.18)), cellSize - 5);
                    graphics.fillStyle(0x727a82, 0.82);
                    graphics.fillRect(x + Math.max(4, Math.floor(cellSize * 0.38)), y + 2, Math.max(2, Math.floor(cellSize * 0.18)), cellSize - 5);
                }

                if (!occupied) return;

                const active = evaluation.powered.has(key);
                const outputLive = occupied.type === GEAR_CODES.SINK && evaluation.sinkPowered;

                if (occupied.type === GEAR_CODES.MOVABLE_WALL) {
                    graphics.fillStyle(0xc9d1d8, 0.9);
                    graphics.fillRect(x + 2, y + 2, Math.max(2, Math.floor(cellSize * 0.2)), cellSize - 5);
                    graphics.fillStyle(0x707980, 0.88);
                    graphics.fillRect(x + Math.max(4, Math.floor(cellSize * 0.42)), y + 2, Math.max(2, Math.floor(cellSize * 0.2)), cellSize - 5);
                    return;
                }

                const centerX = x + (cellSize / 2);
                const centerY = y + (cellSize / 2);
                const connectionDirs = getGearConnections(occupied.type);
                const isPairedPiece = connectionDirs.length === 2
                    && occupied.type !== GEAR_CODES.FULL
                    && occupied.type !== GEAR_CODES.SOURCE
                    && occupied.type !== GEAR_CODES.SINK;
                const linkColor = outputLive ? 0xffd58f : active ? 0xf1e4b2 : 0x8a9079;
                const gearColor = outputLive ? 0xffd9a8 : active ? 0xf2dfae : occupied.movable ? 0xcfba85 : 0xaa9467;
                const toothColor = outputLive ? 0xfff1cc : active ? 0xffefc1 : 0x7f6840;
                const radius = Math.max(2.2, cellSize * 0.19);
                const nodeRadius = Math.max(2.1, cellSize * 0.15);
                const reach = Math.max(4.2, cellSize * 0.39);
                const drawPreviewGear = (gearX, gearY, gearRadius, direction = 1, drawSpokes = true) => {
                    const angleOffset = active ? spinPhase * direction : 0;
                    for (let index = 0; index < 8; index += 1) {
                        const angle = angleOffset + (index * (Math.PI / 4));
                        graphics.fillStyle(toothColor, 0.84);
                        graphics.fillCircle(
                            gearX + (Math.cos(angle) * (gearRadius + 1.5)),
                            gearY + (Math.sin(angle) * (gearRadius + 1.5)),
                            Math.max(0.85, gearRadius * 0.34),
                        );
                    }
                    graphics.fillStyle(gearColor, 0.96);
                    graphics.fillCircle(gearX, gearY, gearRadius);
                    graphics.lineStyle(1, active ? 0x2c2a1a : 0x242119, 0.72);
                    graphics.strokeCircle(gearX, gearY, gearRadius);

                    if (!drawSpokes) return;

                    const spokeLength = Math.max(1.4, gearRadius - 0.8);
                    const spokeAngle = angleOffset + (Math.PI / 4);
                    graphics.lineStyle(1, active ? 0x5c4d29 : 0x5c5132, 0.9);
                    graphics.lineBetween(
                        gearX - (Math.cos(spokeAngle) * spokeLength),
                        gearY - (Math.sin(spokeAngle) * spokeLength),
                        gearX + (Math.cos(spokeAngle) * spokeLength),
                        gearY + (Math.sin(spokeAngle) * spokeLength),
                    );
                    graphics.lineBetween(
                        gearX - (Math.cos(spokeAngle + (Math.PI / 2)) * spokeLength),
                        gearY - (Math.sin(spokeAngle + (Math.PI / 2)) * spokeLength),
                        gearX + (Math.cos(spokeAngle + (Math.PI / 2)) * spokeLength),
                        gearY + (Math.sin(spokeAngle + (Math.PI / 2)) * spokeLength),
                    );
                };
                const nodePositions = connectionDirs.map((dir) => {
                    if (dir === 'N') return { dir, x: centerX, y: centerY - reach };
                    if (dir === 'E') return { dir, x: centerX + reach, y: centerY };
                    if (dir === 'S') return { dir, x: centerX, y: centerY + reach };
                    return { dir, x: centerX - reach, y: centerY };
                });
                const connectionPairs = connectionDirs.length === 2
                    ? [[nodePositions[0], nodePositions[1]]]
                    : connectionDirs.length === 4
                        ? [
                            [nodePositions.find((node) => node.dir === 'N'), nodePositions.find((node) => node.dir === 'S')],
                            [nodePositions.find((node) => node.dir === 'E'), nodePositions.find((node) => node.dir === 'W')],
                        ].filter((pair) => pair[0] && pair[1])
                        : [];

                graphics.fillStyle(occupied.movable ? 0x263038 : 0x1b252c, 0.94);
                graphics.fillRoundedRect(x + 1, y + 1, cellSize - 3, cellSize - 3, 3);
                if (occupied.movable) {
                    graphics.lineStyle(1, 0xa6f6ff, 0.78);
                    graphics.lineBetween(x + 2, y + 5, x + 2, y + Math.max(6, cellSize * 0.24));
                    graphics.lineBetween(x + 2, y + 5, x + Math.max(6, cellSize * 0.24), y + 5);
                    graphics.lineBetween(x + cellSize - 3, y + 5, x + cellSize - 3, y + Math.max(6, cellSize * 0.24));
                    graphics.lineBetween(x + cellSize - 3, y + 5, x + cellSize - Math.max(6, cellSize * 0.24) - 1, y + 5);
                    graphics.lineBetween(x + 2, y + cellSize - 4, x + 2, y + cellSize - Math.max(6, cellSize * 0.24) - 1);
                    graphics.lineBetween(x + 2, y + cellSize - 4, x + Math.max(6, cellSize * 0.24), y + cellSize - 4);
                    graphics.lineBetween(x + cellSize - 3, y + cellSize - 4, x + cellSize - 3, y + cellSize - Math.max(6, cellSize * 0.24) - 1);
                    graphics.lineBetween(x + cellSize - 3, y + cellSize - 4, x + cellSize - Math.max(6, cellSize * 0.24) - 1, y + cellSize - 4);
                }
                if (isPairedPiece) {
                    const pairReach = Math.max(3.4, cellSize * 0.27);
                    const pairRadius = Math.max(2.4, cellSize * 0.2);
                    const pairPositions = connectionDirs.map((dir) => {
                        if (dir === 'N') return { x: centerX, y: centerY - pairReach };
                        if (dir === 'E') return { x: centerX + pairReach, y: centerY };
                        if (dir === 'S') return { x: centerX, y: centerY + pairReach };
                        return { x: centerX - pairReach, y: centerY };
                    });

                    graphics.lineStyle(Math.max(1, cellSize * 0.07), linkColor, 0.38);
                    graphics.lineBetween(pairPositions[0].x, pairPositions[0].y, pairPositions[1].x, pairPositions[1].y);
                    drawPreviewGear(pairPositions[0].x, pairPositions[0].y, pairRadius, 1, true);
                    drawPreviewGear(pairPositions[1].x, pairPositions[1].y, pairRadius, -1, true);
                } else {
                    connectionPairs.forEach(([from, to]) => {
                        graphics.lineStyle(Math.max(1, cellSize * 0.07), linkColor, 0.45);
                        graphics.lineBetween(from.x, from.y, to.x, to.y);
                    });
                    nodePositions.forEach((node, index) => {
                        drawPreviewGear(node.x, node.y, nodeRadius, index % 2 === 0 ? 1 : -1, false);
                    });

                    graphics.fillStyle(active ? 0xffe8b7 : 0xdbc89a, active ? 0.16 : 0.08);
                    graphics.fillCircle(centerX, centerY, radius + (active ? 3 : 1));
                    drawPreviewGear(centerX, centerY, radius, outputLive ? 1 : -1, true);
                }

                if (occupied.type === GEAR_CODES.SOURCE || occupied.type === GEAR_CODES.SINK) {
                    const label = this.add.text(centerX, centerY, occupied.type === GEAR_CODES.SOURCE ? 'I' : 'O', {
                        fontFamily: 'Courier New',
                        fontSize: '6px',
                        color: outputLive ? '#fff1d0' : '#e0edf2',
                        stroke: '#000000',
                        strokeThickness: 2,
                    }).setOrigin(0.5);
                    labelContainer?.add(label);
                }
            });
        });

        const progressLabel = this.add.text(
            left + 2,
            top + height - 10,
            evidence?.scrapRequired
                ? (evidence.scrapStatus || 'GEAR SCRAP')
                : (evaluation.completed ? 'GEAR CLEAR' : 'GEAR STALL'),
            {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: evidence?.scrapRequired
                ? (evidence.scrapKind === 'hazard' ? '#ffc4bd' : '#ffd6a8')
                : (evaluation.completed ? '#d8ffe6' : '#ffd6a8'),
            stroke: '#000000',
            strokeThickness: 2,
            }
        );
        labelContainer?.add(progressLabel);
    }

    _drawFlowPreviewLayer({
        flowPuzzle,
        evidence,
        graphics,
        labelContainer,
        left,
        top,
        width,
        height,
    }) {
        graphics.clear();
        labelContainer?.removeAll(true);

        if (!flowPuzzle) {
            const emptyText = this.add.text(left + (width / 2), top + (height / 2), 'NO FLOW', {
                fontFamily: 'Courier New',
                fontSize: '8px',
                color: '#9bc2ff',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            labelContainer?.add(emptyText);
            return;
        }

        const flowState = evidence || flowPuzzle.progress || null;

        const sources = Array.isArray(flowPuzzle.sources) && flowPuzzle.sources.length > 0
            ? flowPuzzle.sources
            : [{ key: 'main', row: flowPuzzle.sourceRow ?? 2, powerClass: 'neutral', label: 'PWR' }];
        const outputs = Array.isArray(flowPuzzle.outputSpecs) && flowPuzzle.outputSpecs.length > 0
            ? flowPuzzle.outputSpecs.map((output) => ({ ...output }))
            : Object.entries(flowPuzzle.outputs || {}).map(([row, label]) => ({
                key: label,
                row: Number(row),
                label,
                powerClass: 'neutral',
                exactFeeds: 1,
            }));
        const rowCount = Math.max(3, Number(flowPuzzle.rows || flowPuzzle.tiles?.length || 5));
        const getPreviewY = (row) => contentTop + (((row + 0.5) / rowCount) * (contentBottom - contentTop));
        const getPreviewColor = (powerClass, fallback = lineColor) => {
            if (powerClass === 'green') return 0x73ffae;
            if (powerClass === 'orange') return 0xffbe6d;
            if (powerClass === 'mixed') return 0xff7167;
            if (powerClass === 'red') return 0xff4f4f;
            return fallback;
        };
        const derivePreviewPowerClass = (feeds = []) => {
            const powerClasses = Array.from(new Set(feeds.map((feed) => feed.powerClass || 'neutral')));
            if (powerClasses.length === 0) return null;
            if (powerClasses.includes('red')) return 'red';
            if (powerClasses.length > 1) return 'mixed';
            return powerClasses[0];
        };
        const totalOutputs = outputs.length;
        const connectedOutputs = new Set(flowState?.completed ? outputs.map((output) => output.key) : (flowState?.connected || []));
        const outputFeeds = flowState?.outputFeeds || {};
        const forbiddenUsed = Boolean(flowState?.forbiddenUsed);
        const contentLeft = left + 8;
        const contentRight = left + width - 8;
        const contentTop = top + 6;
        const contentBottom = top + height - 14;
        const branchX = left + Math.max(24, Math.floor(width * 0.46));
        const sourceX = contentLeft + 4;
        const lineColor = forbiddenUsed ? 0xff9977 : 0x6ef7ff;
        const dimColor = 0x385764;

        sources.forEach((source) => {
            const palette = source.powerClass === 'green'
                ? { tint: 0x73ffae, label: '#73ffae' }
                : source.powerClass === 'orange'
                    ? { tint: 0xffbe6d, label: '#ffbe6d' }
                    : source.powerClass === 'red'
                        ? { tint: 0xff4f4f, label: '#ff8d8d' }
                        : { tint: 0xffcc44, label: '#fff0b5' };
            const sourceY = getPreviewY(source.row);

            graphics.lineStyle(2, dimColor, 0.75);
            graphics.beginPath();
            graphics.moveTo(sourceX, sourceY);
            graphics.lineTo(branchX, sourceY);
            graphics.strokePath();

            graphics.fillStyle(palette.tint, 1);
            graphics.fillCircle(sourceX, sourceY, 4);
            graphics.lineStyle(1, 0xf8f1d1, 0.8);
            graphics.strokeCircle(sourceX, sourceY, 5);

            const sourceLabel = this.add.text(sourceX + 8, sourceY, source.label || source.key, {
                fontFamily: 'Courier New',
                fontSize: '6px',
                color: palette.label,
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0, 0.5);
            labelContainer?.add(sourceLabel);
        });

        if (outputs.length > 0) {
            const verticalTop = Math.min(...outputs.map((output) => getPreviewY(output.row)));
            const verticalBottom = Math.max(...outputs.map((output) => getPreviewY(output.row)));
            graphics.lineStyle(2, dimColor, 0.72);
            graphics.beginPath();
            graphics.moveTo(branchX, verticalTop);
            graphics.lineTo(branchX, verticalBottom);
            graphics.strokePath();
        }

        outputs.forEach((output, index) => {
            const outputY = getPreviewY(output.row);
            const feeds = outputFeeds[output.key] || [];
            const isConnected = connectedOutputs.has(output.key);
            const nodeX = contentRight - 2;
            const actualPowerClass = derivePreviewPowerClass(feeds);
            const requiredColor = getPreviewColor(output.powerClass, lineColor);
            const branchColor = actualPowerClass
                ? getPreviewColor(actualPowerClass, requiredColor)
                : (isConnected ? requiredColor : dimColor);

            graphics.lineStyle(isConnected ? 2 : 1, branchColor, isConnected ? 0.95 : 0.72);
            graphics.beginPath();
            graphics.moveTo(branchX, outputY);
            graphics.lineTo(nodeX, outputY);
            graphics.strokePath();

            graphics.fillStyle(feeds.length > 0 ? branchColor : 0x294756, 1);
            graphics.fillCircle(nodeX, outputY, 4);
            graphics.lineStyle(1, feeds.length > 0 ? 0xfff1e0 : 0x6aa0b3, 0.85);
            graphics.strokeCircle(nodeX, outputY, 5);

            const tag = this.add.text(nodeX - 10, outputY, String(index + 1), {
                fontFamily: 'Courier New',
                fontSize: '7px',
                color: feeds.length > 0 ? '#fff1e0' : '#8db3bf',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(1, 0.5);
            labelContainer?.add(tag);
        });

        const hazardCount = Math.min(3, flowPuzzle.forbiddenCount || 0);
        for (let index = 0; index < hazardCount; index++) {
            const hazardX = left + width - 14 - (index * 12);
            const hazardY = top + height - 6;
            graphics.fillStyle(forbiddenUsed ? 0xff6644 : 0xffb347, 0.95);
            graphics.fillTriangle(hazardX, hazardY - 5, hazardX + 5, hazardY, hazardX, hazardY + 5);
            graphics.fillTriangle(hazardX, hazardY - 5, hazardX - 5, hazardY, hazardX, hazardY + 5);
        }

        const progressText = flowState?.scrapRequired
            ? (flowState.scrapStatus || 'FLOW SCRAP')
            : flowState?.completed
                ? 'FLOW CLEAR'
                : forbiddenUsed
                    ? 'MODIFIED'
                    : `${connectedOutputs.size}/${totalOutputs} LIVE`;
        const progressLabel = this.add.text(left + 2, top + height - 10, progressText, {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: flowState?.scrapRequired
                ? (flowState.scrapKind === 'hazard' ? '#ffc4bd' : '#ffd6a8')
                : flowState?.completed ? '#d9ffe4' : forbiddenUsed ? '#ffd0c4' : '#a8d8f0',
            stroke: '#000000',
            strokeThickness: 2,
        });
        labelContainer?.add(progressLabel);
    }

    _drawDebugPreviewLayer({
        debugPuzzle,
        evidence,
        graphics,
        labelContainer,
        left,
        top,
        width,
        height,
    }) {
        graphics.clear();
        labelContainer?.removeAll(true);

        if (!debugPuzzle) {
            const emptyText = this.add.text(left + (width / 2), top + (height / 2), 'NO CODE', {
                fontFamily: 'Courier New',
                fontSize: '8px',
                color: '#9bc2ff',
                stroke: '#000000',
                strokeThickness: 2,
            }).setOrigin(0.5);
            labelContainer?.add(emptyText);
            return;
        }

        const debugState = evidence || debugPuzzle.progress || null;
        const prompt = debugState?.phase === 'repair'
            ? (debugState?.repairPrompt || debugPuzzle.repairPrompt || '')
            : (debugState?.prompt || debugPuzzle.prompt || '');
        const expectedOutput = debugState?.expectedOutput || debugPuzzle.expectedOutput || '';
        const actualOutput = debugState?.actualOutput || expectedOutput;
        const solved = Boolean(debugState?.completed);
        const patchMode = debugState?.phase === 'repair' && !solved;
        const corrupt = !solved && (debugState?.corruptionCount || 0) > 0;
        const hasMismatch = !solved && Boolean(actualOutput) && actualOutput !== expectedOutput;
        const accentColor = solved
            ? 0x75ffaf
            : (patchMode ? 0xff8f84 : (corrupt ? 0xff7d77 : 0x8bb8ff));
        const accentText = solved
            ? (debugState?.fixed ? 'PATCHED' : 'STABLE')
            : (patchMode ? 'PATCH' : (corrupt ? 'CORRUPT' : 'TEST'));

        graphics.fillStyle(0x07131a, 0.98);
        graphics.fillRoundedRect(left, top, width, height, 6);
        graphics.lineStyle(1, accentColor, 0.88);
        graphics.strokeRoundedRect(left, top, width, height, 6);
        graphics.fillStyle(accentColor, solved ? 0.22 : 0.16);
        graphics.fillRect(left + 4, top + 4, width - 8, Math.max(4, Math.floor(height * 0.18)));
        graphics.lineStyle(1, accentColor, 0.18);
        graphics.lineBetween(left + 8, top + (height * 0.58), left + width - 8, top + (height * 0.58));

        const lineWidth = Math.max(10, Math.floor((width - 18) / 8));
        const clippedPrompt = prompt.length > lineWidth ? `${prompt.slice(0, Math.max(0, lineWidth - 1))}…` : prompt;
        const clippedActual = actualOutput.length > lineWidth ? `${actualOutput.slice(0, Math.max(0, lineWidth - 1))}…` : actualOutput;
        const clippedExpected = expectedOutput.length > lineWidth ? `${expectedOutput.slice(0, Math.max(0, lineWidth - 1))}…` : expectedOutput;

        const modeLabel = this.add.text(left + 8, top + 6, accentText, {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: solved ? '#e2ffe9' : (patchMode ? '#fff0c8' : (corrupt ? '#ffd8d2' : '#deebff')),
            stroke: '#000000',
            strokeThickness: 2,
        });
        const promptLabel = this.add.text(left + 8, top + Math.max(14, height * 0.34), `> ${clippedPrompt}`, {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: '#f2f7fb',
            stroke: '#000000',
            strokeThickness: 2,
        });
        const outputLabel = this.add.text(left + 8, top + Math.max(22, height * 0.68), clippedActual || clippedExpected || 'WAITING', {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: solved ? '#d9ffe4' : (hasMismatch ? '#ff8b8b' : (patchMode ? '#ffd7a8' : '#a8d8f0')),
            stroke: '#000000',
            strokeThickness: 2,
        });

        labelContainer?.add(modeLabel);
        labelContainer?.add(promptLabel);
        labelContainer?.add(outputLabel);
    }

    _getMachineResponseForAction(action) {
        if (this._currentMachineVariant?._clownCorrupted) {
            return action === 'scrap'
                ? 'Wait wait wait wait no that is not the bit that is not the bit.'
                : 'Hehehe. Perfect. Let the red keep riding.';
        }

        const question = this._currentMachineVariant?.questionDialogue;
        if (!question) return '';
        return action === 'scrap' ? question.noDialogue : question.yesDialogue;
    }

    _fmtPay() {
        return `PAY $${Math.max(0, GameState.paycheckTotal).toFixed(2)}`;
    }
}

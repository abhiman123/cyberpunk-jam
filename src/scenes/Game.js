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
    SHIFT_DURATION_MS_BY_PERIOD,
    SOUND_ASSETS,
    SOUND_VOLUMES,
    getShiftClockStepMs,
} from '../constants/gameConstants.js';
import { createMachineVariant, resolveMachineTexture } from '../data/machineCatalog.js';
import { isMusicEnabled } from '../state/gameSettings.js';

import StateMachine from '../core/StateMachine.js';
import CircuitRouting from '../systems/minigames/CircuitRouting.js';

const PAYCHECK_DELTA = 0.00000003;
const SCRAP_BONUS_MULTIPLIER = 2;

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        const { period, day } = GameState;

        const allCases = this.cache.json.get('cases');
        const allRules = this.cache.json.get('rules');
        const schedule = this.cache.json.get('schedule');
        const schedEntry = schedule.find((entry) => entry.period === period && entry.day === day);
        const baseIds = schedEntry ? schedEntry.caseIds : [];

        this._baseQueue = baseIds.map((id) => allCases.find((item) => item.id === id)).filter(Boolean);
        this._queue = [...this._baseQueue];
        this._queueIndex = 0;
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

        this._shiftDuration = SHIFT_DURATION_MS_BY_PERIOD[period] || SHIFT_DURATION_MS_BY_PERIOD[1];
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
        this._nextCaseEvent = null;
        this._advanceCaseEvent = null;
        this._commTypingEvent = null;
        this._commSequenceEvent = null;
        this._unitMoveTween = null;
        this._activeMusicKey = null;
        this._pendingExitAction = null;
        this._pendingUnsafeAcceptConfirmation = false;

        this._caseSM = new StateMachine('intake');

        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        this._buildHUD();
        this._buildConveyorScreen();
        this._buildDisabledInspectionContainer();
        this._buildPhonePanel();
        this._machinePuzzleOverlay = new MachinePuzzleOverlay(this, {
            onPuzzleChanged: (machineVariant, puzzleState) => this._handlePuzzleStateChanged(machineVariant, puzzleState),
        });
        this._otherPuzzleOverlay = new CircuitRouting(this, { depth: 360 });
        this._otherPuzzleOverlay.onClose = (evidence) => this._handleOtherPuzzleClosed(evidence);

        const newRuleIds = allRules.filter((rule) => rule.period === period).map((rule) => rule.id);
        this._rulebook = new RulebookOverlay(this, GameState.activeRules, allRules, newRuleIds);
        this._settingsOverlay = new FactorySettingsOverlay(this, {
            onOpen: () => this._setGameplayPaused(true),
            onClose: () => this._setGameplayPaused(false),
            onMusicChanged: () => this._applyMusicSettingChange(),
        });

        this.events.on('shutdown', () => {
            this._clearPhoneTyping();
            this._nextCaseEvent?.remove(false);
            this._advanceCaseEvent?.remove(false);
            this._rulebook?.destroy();
            this._machinePuzzleOverlay.destroy();
            this._otherPuzzleOverlay.destroy();
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

        if (FIRST_SHIFT_INTRO.enabled && !GameState.hasSeenOpeningPhoneCall) {
            GameState.hasSeenOpeningPhoneCall = true;
            this._startOpeningPhoneCall();
        } else {
            this.time.delayedCall(300, () => this._beginShift());
        }
    }

    update(_time, delta) {
        if (!this._shiftRunning || this._gameplayPaused) return;

        this._elapsed = Math.min(this._elapsed + delta, this._shiftDuration);
        const ratio = 1 - (this._elapsed / this._shiftDuration);

        this._updateShiftClock();
        this._checkMusicPhase(ratio);

        if (this._elapsed >= this._shiftDuration) {
            this._shiftRunning = false;
            this._endShift(false);
        }
    }

    _buildHUD() {
        this._hudContainer = this.add.container(0, 0).setDepth(200);

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
            `PERIOD ${GameState.period}  |  DAY ${GameState.day}`, {
                fontFamily: 'monospace', fontSize: '11px', color: '#cccccc',
            }
        );
        this._hudContainer.add(this._hudPeriodText);

        this._hudCasesText = this.add.text(502, 25, 'CASES: 0', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#888888',
        }).setOrigin(0.5);
        this._hudContainer.add(this._hudCasesText);

        this._hudPayText = this.add.text(1268, 14, this._fmtPay(), {
            fontFamily: 'Courier New', fontSize: '11px', color: '#00cc88',
        }).setOrigin(1, 0);
        this._hudContainer.add(this._hudPayText);

        this._hudViolText = this.add.text(1268, 30, 'Violations: 0', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#666666',
        }).setOrigin(1, 0);
        this._hudContainer.add(this._hudViolText);

        this._buildDeskSurface();

        this._clockDialCenterX = 1088;
        this._clockDialCenterY = 646;

        const clockBg = this.add.rectangle(1126, 648, 260, 86, 0x050505, 0.92)
            .setStrokeStyle(1, 0x4e7c8f, 0.75);
        this._hudContainer.add(clockBg);

        const clockFaceFrame = this.add.rectangle(this._clockDialCenterX, this._clockDialCenterY, 52, 52, 0x08141a, 0.95)
            .setStrokeStyle(1, 0x66aacc, 0.75);
        this._hudContainer.add(clockFaceFrame);

        this._clockIcon = this.add.graphics();
        this._hudContainer.add(this._clockIcon);

        const clockLabel = this.add.text(1120, 622, 'SHIFT CLOCK', {
            fontFamily: 'monospace', fontSize: '10px', color: '#66aacc', letterSpacing: 3,
        });
        this._hudContainer.add(clockLabel);

        this._clockText = this.add.text(1120, 652, '12:00 PM', {
            fontFamily: 'Courier New', fontSize: '24px', color: '#ccefff',
        }).setOrigin(0, 0.5);
        this._hudContainer.add(this._clockText);

        this._buildMiniMachinePanel();
    }

    _buildDeskSurface() {
        this._deskContainer = this.add.container(0, 0).setDepth(188);

        const deskShadow = this.add.rectangle(640, 640, 1280, 184, 0x000000, 0.28);
        const deskBase = this.add.rectangle(640, 632, 1280, 172, 0x4b4338, 0.98)
            .setStrokeStyle(2, 0x7c745f, 0.92);
        const deskTopLip = this.add.rectangle(640, 560, 1280, 18, 0x2e2b24, 0.98)
            .setStrokeStyle(1, 0x6f6853, 0.7);
        const deskTop = this.add.rectangle(640, 578, 1280, 26, 0x666158, 0.96)
            .setStrokeStyle(1, 0x92876b, 0.55);
        const deskInset = this.add.rectangle(220, 630, 270, 112, 0x3a342d, 0.72)
            .setStrokeStyle(1, 0x6b6252, 0.55);
        const deskDate = this.add.text(74, 670, '12.05.82', {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#8d815a',
        }).setAlpha(0.85);

        this._deskPhotoBounds = new Phaser.Geom.Rectangle(62, 574, 272, 104);

        this._deskContainer.add([
            deskShadow,
            deskBase,
            deskTopLip,
            deskTop,
            deskInset,
            deskDate,
        ]);

        this._createDeskPhoto(182, 620, 'manager_human', {
            angle: -18,
            portraitScale: 0.42,
            width: 66,
            height: 52,
        });
        this._createDeskPhoto(216, 628, 'manager_robot', {
            angle: -6,
            portraitScale: 0.42,
            width: 66,
            height: 52,
        });
        this._createDeskPhoto(258, 622, 'family_photo', {
            angle: 4,
            portraitScale: 1,
            width: 62,
            height: 48,
            tint: 0xffffff,
        });

        this._hudContainer.add(this._deskContainer);
    }

    _createDeskPhoto(x, y, textureKey, options = {}) {
        const width = options.width || 62;
        const height = options.height || 48;
        const portraitScale = options.portraitScale || 0.38;
        const card = this.add.container(x, y).setAngle(options.angle || 0);
        const shadow = this.add.rectangle(4, 5, width, height, 0x000000, 0.2);
        const frame = this.add.rectangle(0, 0, width, height, 0xf0e8db, 1)
            .setStrokeStyle(1, 0x5d5247, 0.68);
        const matte = this.add.rectangle(0, -4, width - 12, height - 16, 0x7b7368, 1)
            .setStrokeStyle(1, 0x443b32, 0.4);
        const portrait = this.add.image(0, -4, textureKey)
            .setScale(portraitScale)
            .setTint(options.tint || 0xf0f0f0);

        card.add([shadow, frame, matte, portrait]);
        card.setSize(width, height);
        card.setInteractive(
            new Phaser.Geom.Rectangle(-(width / 2), -(height / 2), width, height),
            Phaser.Geom.Rectangle.Contains,
        );

        this.input.setDraggable(card);
        card.on('dragstart', () => this._deskContainer.bringToTop(card));
        card.on('drag', (_pointer, dragX, dragY) => {
            const bounds = this._deskPhotoBounds;
            const clampedX = Phaser.Math.Clamp(dragX, bounds.x + (width / 2), bounds.x + bounds.width - (width / 2));
            const clampedY = Phaser.Math.Clamp(dragY, bounds.y + (height / 2), bounds.y + bounds.height - (height / 2));
            card.setPosition(clampedX, clampedY);
        });

        this._deskContainer.add(card);
        return card;
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
        const screenLeft = 20;
        const screenTop = 50;
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
        const screwTopLeft = this.add.circle(24, 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwTopRight = this.add.circle(panelWidth - 24, 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwBottomLeft = this.add.circle(24, panelHeight - 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const screwBottomRight = this.add.circle(panelWidth - 24, panelHeight - 22, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);

        this._miniMachinePanelTitle = this.add.text(22, 16, 'MACHINE PORTS', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#d6cfaa',
            letterSpacing: 2,
        });
        this._miniPuzzleStatusText = this.add.text(22, 36, 'CLICK A UNIT TO INSPECT', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#9ab894',
        });
        this._miniMachineHintText = this.add.text(22, panelHeight - 24, 'CLICK GRID OR FLOW PORT', {
            fontFamily: 'monospace',
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
        const screenMask = screenMaskGraphics.createGeometryMask();
        this._miniMachineScreenMaskSource = screenMaskGraphics;
        this._miniMachineImage.setMask(screenMask);
        this._miniMachineShadow.setMask(screenMask);

        this._miniPuzzleLinkGfx = this.add.graphics();
        this._miniPuzzleGfx = this.add.graphics();
        this._miniPuzzleLabelContainer = this.add.container(0, 0);
        this._miniFlowGfx = this.add.graphics();
        this._miniFlowLabelContainer = this.add.container(0, 0);

        const gridPortFrame = this.add.rectangle(92, 102, 96, 54, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const gridPortHit = this.add.rectangle(92, 102, 96, 54, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const gridPortLabel = this.add.text(54, 138, 'GRID', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#d7e7ff',
            letterSpacing: 1,
        });

        const flowPortFrame = this.add.rectangle(300, 128, 104, 54, 0x091116, 0.2)
            .setStrokeStyle(2, 0x8bb8ff, 0.82);
        const flowPortHit = this.add.rectangle(300, 128, 104, 54, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        const flowPortLabel = this.add.text(256, 162, 'FLOW', {
            fontFamily: 'monospace',
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

        this._miniGridPort = { frame: gridPortFrame, hit: gridPortHit, label: gridPortLabel };
        this._miniFlowPort = { frame: flowPortFrame, hit: flowPortHit, label: flowPortLabel };

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
        const preferredAsset = portKey === 'flow' ? SOUND_ASSETS.fuseRotate : SOUND_ASSETS.inspectionReveal;
        const fallbackAsset = portKey === 'flow' ? SOUND_ASSETS.inspectionReveal : SOUND_ASSETS.fuseRotate;
        const soundAsset = this.cache.audio.has(preferredAsset.key)
            ? preferredAsset
            : (this.cache.audio.has(fallbackAsset.key) ? fallbackAsset : null);

        if (!soundAsset) return;

        this._playOneShot(soundAsset, {
            volume: portKey === 'flow' ? SOUND_VOLUMES.puzzleRotate : SOUND_VOLUMES.reveal,
        });
    }

    _showMiniMachinePanel() {
        if (!this._currentMachineVariant || !this._miniMachinePanel) return;

        this._syncMiniMachinePanel();
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
        const panelX = 786;
        const panelY = 34;
        const frameWidth = 436;
        const frameHeight = 226;
        const screenX = 26;
        const screenY = 24;
        const screenWidth = 304;
        const screenHeight = 160;

        this._phonePanel = this.add.container(panelX, panelY).setDepth(260).setVisible(true);

        const frame = this.add.rectangle(0, 0, frameWidth, frameHeight, 0x334c5d, 1).setOrigin(0)
            .setStrokeStyle(4, 0x82dffd, 0.9);
        const inner = this.add.rectangle(12, 12, frameWidth - 24, frameHeight - 24, 0x11202a, 1).setOrigin(0)
            .setStrokeStyle(2, 0x4ba7c4, 0.9);
        const screen = this.add.rectangle(screenX, screenY, screenWidth, screenHeight, 0x72d3dd, 0.84).setOrigin(0)
            .setStrokeStyle(1, 0xc9ffff, 0.25);
        const gloss = this.add.rectangle(screenX + (screenWidth / 2), screenY + 34, screenWidth - 10, 52, 0xffffff, 0.08).setOrigin(0.5);
        const tray = this.add.rectangle(frameWidth / 2, frameHeight - 15, frameWidth - 42, 10, 0x1b1812, 1).setOrigin(0.5);

        const scanlines = this.add.graphics();
        scanlines.fillStyle(0xffffff, 0.07);
        for (let offset = 0; offset < screenHeight; offset += 14) {
            scanlines.fillRect(screenX, screenY + offset, screenWidth, 6);
        }

        this._phoneHeaderText = this.add.text(40, 34, 'FACTORY LINK', {
            fontFamily: 'Arial Black', fontSize: '18px', color: '#101010',
        });
        this._phoneBodyText = this.add.text(42, 78, '', {
            fontFamily: 'Arial', fontSize: '20px', color: '#101010',
            wordWrap: { width: 236 }, lineSpacing: 8,
        });
        this._phoneStatusText = this.add.text(42, 190, 'CHANNEL IDLE', {
            fontFamily: 'Arial', fontSize: '12px', color: '#15313a',
        });

        this._phoneBodyViewport = { x: 42, y: 78, width: 236, height: 98 };
        const phoneBodyMaskGraphics = this.make.graphics({ x: panelX, y: panelY, add: false });
        phoneBodyMaskGraphics.fillStyle(0xffffff, 1);
        phoneBodyMaskGraphics.fillRect(
            this._phoneBodyViewport.x,
            this._phoneBodyViewport.y,
            this._phoneBodyViewport.width,
            this._phoneBodyViewport.height,
        );
        this._phoneBodyMaskSource = phoneBodyMaskGraphics;
        this._phoneBodyText.setMask(phoneBodyMaskGraphics.createGeometryMask());

        this._settingsButtonBg = this.add.rectangle(390, 50, 42, 46, 0x314250, 1)
            .setStrokeStyle(2, 0x6db7e1, 0.8)
            .setInteractive({ useHandCursor: true });
        this._settingsButtonLabel = this.add.text(390, 50, '⚙', {
            fontFamily: 'Arial Black', fontSize: '21px', color: '#dff6ff',
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

        const accept = this._createPhoneButton(390, 104, '✓', 0x184a24, 0x22f06e, '#d8ffe6', '#ffffff', {
            width: 44,
            height: 50,
            fontSize: '27px',
            glowColor: 0xffffff,
        });
        const reject = this._createPhoneButton(390, 162, 'X', 0x4b1f1b, 0xff5f52, '#ffd7d4', '#4a0605', {
            width: 42,
            height: 48,
            fontSize: '24px',
            glowColor: 0xffdddd,
        });

        accept.bg.on('pointerover', () => this._setPhoneButtonHover(accept, true));
        accept.bg.on('pointerout', () => this._setPhoneButtonHover(accept, false));
        accept.bg.on('pointerdown', () => this._onPhoneChoice('accept'));

        reject.bg.on('pointerover', () => this._setPhoneButtonHover(reject, true));
        reject.bg.on('pointerout', () => this._setPhoneButtonHover(reject, false));
        reject.bg.on('pointerdown', () => this._onPhoneChoice('reject'));

        this._phonePanel.add([
            frame,
            inner,
            screen,
            gloss,
            tray,
            scanlines,
            this._phoneHeaderText,
            this._phoneBodyText,
            this._phoneStatusText,
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
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', 'Awaiting unit connection.', 'CHANNEL IDLE');
        this._syncPhoneBodyLayout();
    }

    _syncPhoneBodyLayout() {
        if (!this._phoneBodyText || !this._phoneBodyViewport) return;

        const overflow = Math.max(0, this._phoneBodyText.height - this._phoneBodyViewport.height);
        this._phoneBodyText.setPosition(this._phoneBodyViewport.x, this._phoneBodyViewport.y - overflow);
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

    _setPhoneMessage(header, body, status = this._phoneStatusText?.text || '') {
        this._phoneHeaderText.setText(header || '');
        this._phoneBodyText.setText(body || '');
        this._syncPhoneBodyLayout();
        if (this._phoneStatusText) this._phoneStatusText.setText(status || '');
    }

    _showPhonePanel(header, body, status = '') {
        this._setPhoneMessage(header, body, status);
        this._phonePanel.setVisible(true);
        this._phonePanel.setAlpha(1);
    }

    _hidePhonePanel() {
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', '', 'CHANNEL IDLE');
    }

    _setCommStandbyState(message = 'Awaiting next unit.', status = 'CHANNEL IDLE') {
        this._clearPhoneTyping();
        this._phoneChoicePhase = 'inactive';
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', message, status);
    }

    _clearPhoneTyping() {
        this._commTypingEvent?.remove(false);
        this._commTypingEvent = null;
        this._commSequenceEvent?.remove(false);
        this._commSequenceEvent = null;
    }

    _typePhoneMessage(text, { append = false, onComplete = null } = {}) {
        this._clearPhoneTyping();

        const prefix = append ? this._phoneBodyText.text : '';
        if (!append) this._phoneBodyText.setText('');

        if (!text) {
            onComplete?.();
            return;
        }

        let charIndex = 0;
        this._commTypingEvent = this.time.addEvent({
            delay: 24,
            repeat: text.length - 1,
            callback: () => {
                const nextChar = text[charIndex];
                charIndex += 1;
                this._phoneBodyText.setText(prefix + text.slice(0, charIndex));
                this._syncPhoneBodyLayout();
                if (nextChar && nextChar.trim()) this._playTypeBeep();

                if (charIndex >= text.length) {
                    this._commTypingEvent = null;
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

    _playMachineConversation(machineVariant) {
        const prompt = machineVariant?.questionDialogue?.prompt || '';

        if (!machineVariant?.hasCommunication) {
            this._phoneChoicePhase = 'inactive';
            this._setPhoneButtonsActive(false);
            this._setPhoneButtonSelection(null);
            this._showPhonePanel(`${machineVariant.name.toUpperCase()} LINK`, 'No transmission. Process the unit cold.', 'NO SIGNAL');
            return;
        }

        this._phoneChoicePhase = 'machine-opening';
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(`${machineVariant.name.toUpperCase()} LINK`, '', 'SIGNAL LIVE');

        this._typePhoneMessage(machineVariant.openingDialogue || '', {
            onComplete: () => {
                if (!prompt) {
                    this._phoneChoicePhase = 'inactive';
                    this._showPhonePanel(`${machineVariant.name.toUpperCase()} LINK`, this._phoneBodyText.text, 'NO QUERY');
                    return;
                }

                this._commSequenceEvent = this.time.delayedCall(180, () => {
                    this._showPhonePanel(`${machineVariant.name.toUpperCase()} LINK`, this._phoneBodyText.text, 'INCOMING QUESTION');
                    this._typePhoneMessage(`\n\nQ> ${prompt}`, {
                        append: true,
                        onComplete: () => {
                            this._phoneChoicePhase = 'machine-question';
                            this._setPhoneButtonsActive(true);
                            this._showPhonePanel(`${machineVariant.name.toUpperCase()} LINK`, this._phoneBodyText.text, 'PRESS ✓ OR X');
                        },
                    });
                });
            },
        });
    }

    _startOpeningPhoneCall() {
        this._setCommStandbyState('Factory monitor online.', 'LISTENING');
        this._commSequenceEvent = this.time.delayedCall(FIRST_SHIFT_INTRO.silenceBeforePhoneMs, () => {
            this._phoneChoicePhase = 'incoming';
            this._showPhonePanel(FIRST_SHIFT_INTRO.incomingHeader, FIRST_SHIFT_INTRO.incomingBody, 'PRESS ✓ OR X');
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
                this._showPhonePanel(FIRST_SHIFT_INTRO.incomingHeader, this._phoneBodyText.text, 'VOICE CONNECTED');
                this._phoneChoicePhase = 'voice';
                this._setPhoneButtonsActive(false);

                const voice = this._playOneShot(SOUND_ASSETS.phoneVoiceIntro, { volume: SOUND_VOLUMES.voice });
                if (voice) {
                    voice.once('complete', () => this._awaitPhoneDismiss());
                } else {
                    this._commSequenceEvent = this.time.delayedCall(FIRST_SHIFT_INTRO.fallbackVoiceMs, () => this._awaitPhoneDismiss());
                }
            } else {
                this._setPhoneButtonSelection('reject');
                this._dismissPhoneGate();
            }
            return;
        }

        if (this._phoneChoicePhase === 'post-voice') {
            this._dismissPhoneGate();
            return;
        }

        if (this._phoneChoicePhase === 'machine-question') {
            const question = this._currentMachineVariant?.questionDialogue;
            if (!question) return;

            this._phoneChoicePhase = 'machine-answered';
            this._setPhoneButtonSelection(choice);
            this._setPhoneButtonsActive(false);

            const responseText = choice === 'accept' ? question.yesDialogue : question.noDialogue;
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                this._phoneBodyText.text,
                choice === 'accept' ? '✓ SENT' : 'X SENT'
            );

            if (!responseText) return;

            this._commSequenceEvent = this.time.delayedCall(90, () => {
                this._typePhoneMessage(`\n\n${choice === 'accept' ? '✓' : 'X'} ${responseText}`, {
                    append: true,
                    onComplete: () => {
                        this._showPhonePanel(
                            `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                            this._phoneBodyText.text,
                            'RESPONSE LOGGED'
                        );
                    },
                });
            });
            return;
        }
    }

    _awaitPhoneDismiss() {
        if (this._phoneChoicePhase !== 'voice') return;
        this._phoneChoicePhase = 'post-voice';
        this._setPhoneButtonSelection(null);
        this._showPhonePanel(FIRST_SHIFT_INTRO.incomingHeader, FIRST_SHIFT_INTRO.postVoiceBody, 'PRESS ✓ OR X');
        this._setPhoneButtonsActive(true);
    }

    _dismissPhoneGate() {
        this._setCommStandbyState('Call complete. Conveyor standing by.', 'CHANNEL IDLE');
        this._phoneChoicePhase = 'inactive';
        this._beginShift();
    }

    _beginShift() {
        if (this._shiftRunning) return;

        this._shiftRunning = true;
        this._startMusic();
        this._setFactoryIdleState('LINE ACTIVE\n\nSTATUS: READY');
        this._scheduleNextCase(FIRST_SHIFT_INTRO.caseArrivalDelayMs);
    }

    _toggleSettingsOverlay() {
        if (this._settingsOverlay?.isVisible()) {
            this._settingsOverlay.close();
            return;
        }

        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
        this._settingsOverlay?.open();
    }

    _setGameplayPaused(paused) {
        this._settingsOpen = paused;
        this._gameplayPaused = paused;

        if (this._unitMoveTween) {
            if (paused) this._unitMoveTween.pause();
            else this._unitMoveTween.resume();
        }

        if (this._commTypingEvent) this._commTypingEvent.paused = paused;
        if (this._commSequenceEvent) this._commSequenceEvent.paused = paused;
        if (this._nextCaseEvent) this._nextCaseEvent.paused = paused;
        if (this._advanceCaseEvent) this._advanceCaseEvent.paused = paused;
    }

    _scheduleNextCase(delayMs) {
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
                fontFamily: 'monospace', fontSize: '10px', color: '#301934',
                align: 'center', lineSpacing: 4,
            }
        ).setOrigin(0.5);
        this._conveyorContainer.add(this._monitorText);

        this._machineDialogueText = this.add.text(966, 460, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#bceef8',
            align: 'left', wordWrap: { width: 260 }, lineSpacing: 6,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._machineDialogueText);

        this._shapeTitleText = this.add.text(964, 126, 'CHASSIS GRID', {
            fontFamily: 'monospace', fontSize: '10px', color: '#a0dbf0', letterSpacing: 3,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeTitleText);

        this._shapeLegendText = this.add.text(964, 294, '0 open  1 frame  2 block', {
            fontFamily: 'monospace', fontSize: '10px', color: '#88b7c6',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeLegendText);

        this._shapeHintText = this.add.text(964, 320, 'CLICK UNIT FOR DOMINO GRID', {
            fontFamily: 'monospace', fontSize: '10px', color: '#d9cc9f', letterSpacing: 2,
            align: 'center', stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5).setVisible(false);
        this._conveyorContainer.add(this._shapeHintText);

        this._machineBlueprintGfx = this.add.graphics().setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintGfx);
        this._machineBlueprintLinkGfx = this.add.graphics().setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintLinkGfx);
        this._machineBlueprintLabelContainer = this.add.container(0, 0).setVisible(false);
        this._conveyorContainer.add(this._machineBlueprintLabelContainer);

        this._unitContainer = this.add.container(MACHINE_PRESENTATION.conveyorEntryX, 420).setDepth(15);
        this._conveyorUnitSprite = this.add.image(0, 0, 'unit_placeholder').setScale(1.0);
        this._unitNameText = this.add.text(0, 115, '', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ccddee',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitIdText = this.add.text(0, 133, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#778899',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitContainer.add([this._conveyorUnitSprite, this._unitNameText, this._unitIdText]);
        this._unitContainer.setVisible(false);

        this._conveyorUnitSprite.setInteractive({ useHandCursor: true });
        this._conveyorUnitSprite.on('pointerover', () => this._conveyorUnitSprite.setTint(0xaabbdd));
        this._conveyorUnitSprite.on('pointerout', () => this._conveyorUnitSprite.clearTint());
        this._conveyorUnitSprite.on('pointerdown', () => {
            if (this._screen !== 'conveyor' || this._actionLocked || this._settingsOpen) return;
            if (!this._currentMachineVariant) return;
            this._revealMachineMiniPanel();
        });

        this._shapeLegendText.setText('0 open  1 wall  2-5 charge  = linked pair');

        this._shapeHintText.setText('CLICK UNIT TO REVEAL MACHINE PORTS\nTHEN OPEN GRID OR FLOW');

        const rulingDefs = [
            { action: 'scrap', x: 844, width: 164, label: 'SCRAP', subtitle: 'drop from the line', fillColor: 0x5b1815, strokeColor: 0xff7d77, textColor: '#ffd6d2' },
            { action: 'approve', x: 1048, width: 164, label: 'ACCEPT', subtitle: 'send it onward', fillColor: 0x174b2a, strokeColor: 0x75ffaf, textColor: '#d4ffea' },
        ];

        this._conveyorRulingButtons = {};
        rulingDefs.forEach((def) => {
            const bgRect = this.add.rectangle(def.x, 650, def.width, 62, def.fillColor, 0.94)
                .setStrokeStyle(2, def.strokeColor, 0.92)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(def.x, 641, def.label, {
                fontFamily: 'Courier New', fontSize: '19px', color: def.textColor, letterSpacing: 2,
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);
            const subtitle = this.add.text(def.x, 664, def.subtitle, {
                fontFamily: 'monospace', fontSize: '10px', color: def.textColor,
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);

            bgRect.on('pointerover', () => {
                if (!this._canUseFactoryDecisionButtons()) return;
                bgRect.setScale(1.04);
                subtitle.setY(662);
            });
            bgRect.on('pointerout', () => {
                bgRect.setScale(1);
                subtitle.setY(664);
            });
            bgRect.on('pointerdown', () => {
                if (!this._canUseFactoryDecisionButtons()) return;
                Animations.buttonPunch(this, bgRect);
                this._submitRuling(def.action);
            });

            this._conveyorContainer.add(bgRect);
            this._conveyorContainer.add(label);
            this._conveyorContainer.add(subtitle);

            this._conveyorRulingButtons[def.action] = {
                bgRect,
                label,
                subtitle,
                def,
            };
        });

        this._conveyorDecisionHint = this.add.text(946, 596, 'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR', {
            fontFamily: 'monospace', fontSize: '11px', color: '#8fc1cf', letterSpacing: 2,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);
        this._conveyorContainer.add(this._conveyorDecisionHint);

        this._feedbackText = this.add.text(946, 562, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 2, align: 'center',
            wordWrap: { width: 460 },
        }).setOrigin(0.5).setAlpha(0);
        this._conveyorContainer.add(this._feedbackText);

        this._setConveyorRulingButtonsVisible(false);
    }

    _setFactoryIdleState(message) {
        this._clearUnsafeAcceptConfirmation();
        if (this._monitorText) this._monitorText.setText(message);
        if (this._unitContainer) this._unitContainer.setVisible(false);
        if (this._machineDialogueText) this._machineDialogueText.setText('');
        this._clearMachineGridDisplays();
        if (this._miniPuzzleStatusText) this._miniPuzzleStatusText.setText('NO UNIT LATCHED');
        this._setConveyorRulingButtonsVisible(false);
        if (this._conveyorDecisionHint) {
            this._conveyorDecisionHint.setText('OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR');
        }
        this._setCommStandbyState('Awaiting next unit.', 'CHANNEL IDLE');
        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
        this._hideMiniMachinePanel(true);
        this._currentMachineVariant = null;
        this._refreshFactoryActionButtons();
    }

    _openMachinePuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._otherPuzzleOverlay?.active) return;

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
            && !this._otherPuzzleOverlay?.active;
    }

    _setConveyorRulingButtonsVisible(visible) {
        const isVisible = Boolean(visible) && this._screen === 'conveyor';
        Object.values(this._conveyorRulingButtons).forEach((button) => {
            button.bgRect.setVisible(isVisible);
            button.label.setVisible(isVisible);
            button.subtitle.setVisible(isVisible);
            button.bgRect.setScale(1);
        });

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

        if (machineVariant) machineVariant._uiPuzzleSolved = isSolved;
        if (this._miniPuzzleStatusText) {
            this._miniPuzzleStatusText.setText(this._getMiniPuzzleStatusText(puzzleState));
        }

        this._drawMachineShapeGrid(puzzleState.grid);
        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();

        if (isSolved && !wasSolved && !this._actionLocked) {
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            const followUpNeeded = Boolean(machineVariant?._uiOtherPuzzleRequired) && !machineVariant?._uiOtherPuzzleSolved;
            this._showFeedback(
                followUpNeeded ? 'MAIN PUZZLE CLEARED // COMPLETE OTHER PUZZLE' : 'GRID FIXED // ACCEPT IS SAFE',
                '#c7ff86'
            );
        }
    }

    _updateConveyorDecisionHint() {
        if (!this._conveyorDecisionHint) return;

        let text = 'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR';
        let color = '#8fc1cf';

        const gateState = this._getPuzzleGateState();
        const { evaluation, mainInspected, mainReady, otherRequired, otherSolved } = gateState;

        if (!this._currentMachineVariant) {
            this._conveyorDecisionHint.setText(text).setColor(color);
            return;
        }

        if (!mainReady) {
            if (evaluation.impossible && !mainInspected) {
                text = 'OPEN MAIN PUZZLE // CONFIRM THE IMPOSSIBLE GRID';
                color = '#ffd685';
            } else {
                text = otherRequired
                    ? 'SOLVE MAIN PUZZLE // THEN CLEAR OTHER PUZZLE'
                    : 'SOLVE THE MAIN PUZZLE BEFORE FILING A RULING';
                color = '#8fc1cf';
            }
        } else if (!otherSolved) {
            text = evaluation.impossible
                ? 'GRID IMPOSSIBLE // COMPLETE OTHER PUZZLE TO SCRAP'
                : 'MAIN PUZZLE CLEARED // FINISH OTHER PUZZLE';
            color = '#9bc2ff';
        } else if (evaluation.impossible) {
            text = 'IMPOSSIBLE GRID CONFIRMED // SCRAP BONUS READY';
            color = '#ffd685';
        } else {
            text = otherRequired
                ? 'BOTH PUZZLES CLEARED // ACCEPT FOR CLEAN PAY'
                : 'GRID FIXED // ACCEPT IS SAFE';
            color = '#c7ff86';
        }

        this._conveyorDecisionHint.setText(text).setColor(color);
    }

    _showFactoryNotification(message, status, soundAsset = SOUND_ASSETS.notificationAlert) {
        const header = this._currentMachineVariant
            ? `${this._currentMachineVariant.name.toUpperCase()} LINK`
            : 'FACTORY LINK';

        this._showPhonePanel(header, message, status);

        if (soundAsset) {
            this._playOneShot(soundAsset, {
                volume: soundAsset === SOUND_ASSETS.puzzleFixed ? SOUND_VOLUMES.puzzleFixed : SOUND_VOLUMES.notification,
            });
        }
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
        this._unitContainer.setVisible(name === 'conveyor' && !!this._currentCase);
        if (this._inspectionContainer) this._inspectionContainer.setVisible(false);
        this._setConveyorRulingButtonsVisible(name === 'conveyor' && !!this._currentMachineVariant);

        if (name !== 'conveyor') {
            this._machinePuzzleOverlay?.close(true);
            this._otherPuzzleOverlay?.hide();
            this._hideMiniMachinePanel(true);
        }

        this._refreshFactoryActionButtons();
    }

    _getPuzzleGateState(machineVariant = this._currentMachineVariant) {
        const evaluation = machineVariant?.puzzleState?.getEvaluation?.() || {
            solved: false,
            impossible: false,
        };
        const mainInspected = Boolean(machineVariant?._uiPuzzleOpened);
        const otherRequired = Boolean(machineVariant?._uiOtherPuzzleRequired);
        const otherSolved = !otherRequired || Boolean(machineVariant?._uiOtherPuzzleSolved);
        const mainReady = evaluation.solved || (evaluation.impossible && mainInspected);

        return {
            evaluation,
            mainInspected,
            mainReady,
            otherRequired,
            otherSolved,
            ready: mainReady && otherSolved,
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

        if (machineVariant._uiOtherPuzzleSolved) {
            return {
                subtitle: 'CLEARED',
                fillColor: 0x174b2a,
                strokeColor: 0x75ffaf,
                labelColor: '#d4ffea',
                subtitleColor: '#aef3c6',
            };
        }

        if (machineVariant._uiOtherPuzzleEvidence?.forbiddenUsed) {
            return {
                subtitle: 'MODIFIED',
                fillColor: 0x5b1815,
                strokeColor: 0xff7d77,
                labelColor: '#ffd6d2',
                subtitleColor: '#ffb4ae',
            };
        }

        if (machineVariant._uiOtherPuzzleEvidence) {
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
            button.bgRect.setAlpha(alpha);
            button.label.setAlpha(alpha);
            button.subtitle.setAlpha(alpha);
        });

        this._refreshOtherPuzzleButton();
    }

    _openOtherPuzzle() {
        if (!this._currentMachineVariant) return;
        if (this._otherPuzzleOverlay?.active) return;

        if (!this._currentMachineVariant._uiOtherPuzzleRequired) {
            this._showFeedback('NO OTHER PUZZLE LOADED FOR THIS UNIT', '#8fc1cf');
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                'No secondary diagnostic is attached to this unit.',
                'MAIN PUZZLE ONLY'
            );
            return;
        }

        if (this._currentMachineVariant._uiOtherPuzzleSolved) {
            this._showFeedback('OTHER PUZZLE ALREADY CLEARED', '#c7ff86');
            return;
        }

        this._clearUnsafeAcceptConfirmation();
        this._machinePuzzleOverlay?.close(true);
        this._showMiniMachinePanel();
        this._otherPuzzleOverlay.show({ circuit: this._currentMachineVariant.flowPuzzle });
        this._refreshFactoryActionButtons();
    }

    _handleOtherPuzzleClosed(evidence) {
        if (!this._currentMachineVariant) return;

        this._clearUnsafeAcceptConfirmation();
        this._currentMachineVariant._uiOtherPuzzleEvidence = evidence || null;
        this._currentMachineVariant._uiOtherPuzzleSolved = Boolean(evidence?.completed);

        this._updateConveyorDecisionHint();
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();

        if (evidence?.completed) {
            const gateState = this._getPuzzleGateState();
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            this._showFeedback(
                gateState.mainReady ? 'BOTH PUZZLES CLEARED // FILE YOUR RULING' : 'OTHER PUZZLE CLEARED // FINISH MAIN PUZZLE',
                '#c7ff86'
            );
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                'Secondary diagnostic cleared. Routing report logged.',
                'OTHER PUZZLE CLEAR'
            );
            return;
        }

        if (evidence?.forbiddenUsed) {
            glitchBurst(this, this._cmFilter, 320);
            this._showFeedback('OTHER PUZZLE FAILED // UNAUTHORIZED MODIFICATION', '#ff7f73');
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                'Unauthorized modification detected in the secondary diagnostic.',
                'OTHER PUZZLE MODIFIED'
            );
            return;
        }

        this._showFeedback('OTHER PUZZLE INCOMPLETE // OUTPUTS UNREACHED', '#ffd685');
        this._showPhonePanel(
            `${this._currentMachineVariant.name.toUpperCase()} LINK`,
            'Secondary diagnostic incomplete. Required outputs remain offline.',
            'OTHER PUZZLE INCOMPLETE'
        );
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
                this._showPhonePanel(header, this._phoneBodyText.text, 'PRESS ACCEPT AGAIN');
            },
        });
        this._playOneShot(SOUND_ASSETS.errorBuzz, { volume: SOUND_VOLUMES.decision * 0.45 });
        this._showFeedback('ACCEPT AGAIN TO OVERRIDE', '#ffd685');
        this._refreshFactoryActionButtons();
    }

    _submitRuling(action) {
        if (this._actionLocked) return;

        const gateState = this._getPuzzleGateState();
        if (action === 'approve' && !gateState.ready && !this._pendingUnsafeAcceptConfirmation) {
            this._promptUnsafeAcceptConfirmation();
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
                this._phoneBodyText.text,
                `PROCESSING ${action.toUpperCase()}`
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
            if (evaluation.impossible) {
                payDelta = PAYCHECK_DELTA * SCRAP_BONUS_MULTIPLIER;
                feedbackText = 'IMPOSSIBLE UNIT SCRAPPED // BONUS AWARDED';
                feedbackColor = '#ffd685';
                panelStatus = 'SCRAP BONUS';
            } else {
                payDelta = -PAYCHECK_DELTA;
                wasPenalty = true;
                feedbackText = 'REPAIRABLE UNIT SCRAPPED // DEDUCTION APPLIED';
                feedbackColor = '#ff7f73';
                panelStatus = 'SCRAP PENALTY';
                notificationMessage = 'DOC NOTE: This unit was still repairable. Payroll deduction applied.';
                notificationStatus = 'DOC NOTICE';
            }
        } else if (evaluation.solved) {
            payDelta = PAYCHECK_DELTA;
            feedbackText = 'BOTH PUZZLES CLEARED // UNIT ACCEPTED';
            feedbackColor = '#9aff91';
            panelStatus = 'UNIT ACCEPTED';
        } else {
            payDelta = -PAYCHECK_DELTA;
            wasPenalty = true;
            feedbackText = 'UNFIXED UNIT ACCEPTED // DEDUCTION APPLIED';
            feedbackColor = '#ff7f73';
            panelStatus = 'ACCEPT PENALTY';
            notificationMessage = 'DOC NOTE: Not all required puzzles were fixed. Payroll deduction applied.';
            notificationStatus = 'DOC NOTICE';
        }

        this._applyRulingConsequence(payDelta, wasPenalty);
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
                this._showPhonePanel(
                    `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                    'All required puzzles cleared. Unit forwarded downline.',
                    panelStatus
                );
            } else {
                this._showPhonePanel(
                    `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                    'Impossible grid confirmed. Scrap bonus logged.',
                    panelStatus
                );
            }
        }

        this._showFeedback(feedbackText, feedbackColor);
        this._queueAdvanceCase(1400);
    }

    _decisionSoundFor(action) {
        if (action === 'approve') return SOUND_ASSETS.approveDecision;
        return SOUND_ASSETS.scrapDecision;
    }

    _showFeedback(msg, color) {
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText,
            alpha: 0,
            delay: 1200,
            duration: 400,
        });
    }

    _appendLog(text) {
        this._logLines.push(text);
    }

    _loadNextCase() {
        if (!this._shiftRunning) return;

        this._clearUnsafeAcceptConfirmation();
        this._currentCase = this._queue[this._queueIndex];
        if (!this._currentCase) {
            this._setFactoryIdleState('QUEUE EMPTY\n\nSTATUS: HOLD');
            return;
        }

        this._caseSM.transition('intake');

        this._currentMachineVariant = createMachineVariant({
            day: GameState.day,
            period: GameState.period,
        });
        this._currentMachineVariant._uiPuzzleOpened = false;
        this._currentMachineVariant._uiPuzzleSolved = false;
        this._currentMachineVariant._uiOtherPuzzleRequired = Boolean(this._currentMachineVariant.flowPuzzle);
        this._currentMachineVariant._uiOtherPuzzleSolved = !this._currentMachineVariant._uiOtherPuzzleRequired;
        this._currentMachineVariant._uiOtherPuzzleEvidence = null;
        this._hideMiniMachinePanel(true);

        this._monitorText.setText(
            `UNIT INCOMING\n\n${this._currentCase.id}\n${this._currentCase.name}\nSTATUS: ACTIVE`
        );

        this._machineDialogueText.setText('');
        this._handlePuzzleStateChanged(this._currentMachineVariant, this._currentMachineVariant.puzzleState);
        this._playMachineConversation(this._currentMachineVariant);
        this._syncMiniMachinePanel();

        this._applyMachineSprite(this._conveyorUnitSprite, 1.0);

        this._unitContainer.setVisible(true);
        this._unitContainer.x = MACHINE_PRESENTATION.conveyorEntryX;
        this._unitContainer.y = 420;
        this._unitContainer.setAngle(0);
        this._unitContainer.setAlpha(1);
        this._unitNameText.setText(this._currentMachineVariant.name);
        this._unitIdText.setText(this._currentCase.id);
        this._setConveyorRulingButtonsVisible(true);
        this._refreshOtherPuzzleButton();
        this._refreshFactoryActionButtons();

        const travelDistance = Math.abs(MACHINE_PRESENTATION.conveyorEntryX - MACHINE_PRESENTATION.conveyorTargetX);
        const tweenDurationMs = Math.max(200, Math.round((travelDistance / MACHINE_PRESENTATION.conveyorSpeedPxPerSecond) * 1000));

        this._unitMoveTween?.stop();
        this._unitMoveTween = null;

        this._unitMoveTween = this.tweens.add({
            targets: this._unitContainer,
            x: MACHINE_PRESENTATION.conveyorTargetX,
            duration: tweenDurationMs,
            ease: 'Cubic.Out',
            onComplete: () => {
                this._unitMoveTween = null;
            },
        });
    }

    _advanceCase() {
        const justProcessed = this._currentCase;
        this._advanceCaseEvent?.remove(false);
        this._advanceCaseEvent = null;
        this._actionLocked = false;
        this._clearUnsafeAcceptConfirmation();
        this._clearPhoneTyping();
        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
        this._hideMiniMachinePanel(true);
        this._setScreen('conveyor');
        this._pendingExitAction = this._pendingExitAction || 'approve';
        this._currentCase = null;

        this._setConveyorRulingButtonsVisible(false);
        this._setCommStandbyState('Line cleared. Awaiting next unit.', 'SHIFT LIVE');
        this._unitMoveTween?.stop();
        this._unitMoveTween = null;

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

        const clearUnitPresentation = () => {
            this._unitContainer.setVisible(false);
            this._unitContainer.setAngle(0);
            this._unitContainer.setAlpha(1);
            this._unitContainer.setY(420);
            this._machineDialogueText.setText('');
            this._clearMachineGridDisplays();
            if (this._miniPuzzleStatusText) this._miniPuzzleStatusText.setText('NO UNIT LATCHED');
            this._currentMachineVariant = null;
            this._pendingExitAction = null;
            this._hideMiniMachinePanel(true);
            this._refreshOtherPuzzleButton();
            this._refreshFactoryActionButtons();
        };

        this.tweens.add({
            ...exitTween,
            onComplete: () => {
                clearUnitPresentation();
            },
        });

        if (justProcessed?.isFinalCase && GameState.isLastDay()) {
            this.time.delayedCall(600, () => {
                this._shiftRunning = false;
                this._endShift(true);
            });
            return;
        }

        this._queueIndex++;
        if (this._queueIndex >= this._queue.length) {
            this._queue = [...this._baseQueue].sort(() => Math.random() - 0.5);
            this._queueIndex = 0;
        }

        this._scheduleNextCase(700);
    }

    // ── Shift end ─────────────────────────────────────────────────────────────

    _endShift(fromFinalCase) {
        this._clearUnsafeAcceptConfirmation();
        this._machinePuzzleOverlay?.close(true);
        this._otherPuzzleOverlay?.hide();
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

        const notifications = this.cache.json.get('notifications');
        const { period, day } = GameState;
        const notif = notifications.find((item) => item.period === period && item.day === day);

        const nextScenePayload = {
            mistakes: this._shiftMistakes,
            paycheckDelta: this._paycheckDelta,
            casesProcessed: GameState.casesProcessedThisShift,
            notificationText: notif ? notif.text : '',
        };

        this.time.delayedCall(260, () => {
            if (fromFinalCase && GameState.isLastDay()) {
                this.scene.start('End');
                return;
            }

            this.scene.start('Summary', nextScenePayload);
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

        if (this.cache.audio.has(key)) {
            const incoming = this.sound.add(key, { loop: true, volume: 0 });
            incoming.play();
            this.tweens.add({
                targets: incoming,
                volume: isMusicEnabled() ? SOUND_VOLUMES.music : 0,
                duration: 2000,
            });
            this._currentMusic = incoming;
        }
    }

    _applyMusicSettingChange() {
        if (!this._activeMusicKey) return;

        if (!isMusicEnabled()) {
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
                volume: SOUND_VOLUMES.music,
                duration: 260,
            });
            return;
        }

        if (!this.cache.audio.has(this._activeMusicKey)) return;

        const outgoing = this._currentMusic;
        const incoming = this.sound.add(this._activeMusicKey, { loop: true, volume: 0 });
        incoming.play();
        this.tweens.add({ targets: incoming, volume: SOUND_VOLUMES.music, duration: 360 });

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

    _playOneShot(soundAsset, config = {}) {
        if (!soundAsset || !this.cache.audio.has(soundAsset.key)) return null;

        const sound = this.sound.add(soundAsset.key, config);
        sound.once('complete', () => sound.destroy());
        sound.play();
        return sound;
    }

    _applyMachineSprite(targetImage, scale) {
        const textureKey = resolveMachineTexture(this, this._currentMachineVariant);
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
    }

    _getMiniMachinePanelStatusText(machineVariant = this._currentMachineVariant) {
        if (!machineVariant?.puzzleState?.getEvaluation) return 'CLICK A UNIT TO INSPECT';

        const gridEvaluation = machineVariant.puzzleState.getEvaluation();
        const flowOutputs = Object.keys(machineVariant.flowPuzzle?.outputs || {});
        const flowConnected = machineVariant._uiOtherPuzzleSolved
            ? flowOutputs.length
            : (machineVariant._uiOtherPuzzleEvidence?.connected?.length || 0);

        const gridText = gridEvaluation.solved
            ? 'GRID CLEAR'
            : gridEvaluation.impossible && machineVariant._uiPuzzleOpened
                ? 'GRID MARKED'
                : `GRID ${gridEvaluation.matchedChargeCells}/${gridEvaluation.totalChargeCells}`;
        const flowText = !machineVariant.flowPuzzle
            ? 'FLOW NONE'
            : machineVariant._uiOtherPuzzleSolved
                ? 'FLOW CLEAR'
                : machineVariant._uiOtherPuzzleEvidence?.forbiddenUsed
                    ? 'FLOW MOD'
                    : `FLOW ${flowConnected}/${flowOutputs.length}`;

        return `${gridText} // ${flowText}`;
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

    _syncMiniMachinePanel() {
        if (!this._miniMachinePanel) return;

        this._miniPuzzleGfx?.clear();
        this._miniPuzzleLinkGfx?.clear();
        this._miniPuzzleLabelContainer?.removeAll(true);
        this._miniFlowGfx?.clear();
        this._miniFlowLabelContainer?.removeAll(true);

        if (!this._currentMachineVariant) {
            this._miniMachinePanelTitle?.setText('MACHINE PORTS');
            this._miniPuzzleStatusText?.setText('CLICK A UNIT TO INSPECT');
            this._miniMachineHintText?.setText('CLICK GRID OR FLOW PORT');
            this._miniMachineImage?.setTexture('unit_placeholder').setScale(1.28).setAngle(0).setPosition(190, 152);
            this._miniMachineShadow?.setPosition(188, 184).setAlpha(0.12);
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

        const layout = this._currentMachineVariant.miniDisplay || {
            artX: 106,
            artY: 132,
            artScale: 0.92,
            artAngle: 0,
            gridPreview: { x: 42, y: 72, width: 58, height: 40, label: 'GRID' },
            flowPreview: { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' },
        };
        const resolvedGridPreview = scaleRect(layout.gridPreview, { x: 42, y: 72, width: 58, height: 40, label: 'GRID' });
        const resolvedFlowPreview = scaleRect(layout.flowPreview, { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' });
        const resolvedArtX = (layout.artX ?? 106) * scaleX;
        const resolvedArtY = (layout.artY ?? 132) * scaleY;
        const resolvedArtScale = (layout.artScale || 0.92) * 1.42;

        this._miniMachinePanelTitle?.setText(`${this._currentMachineVariant.name.toUpperCase()} PORT MAP`);
        this._miniPuzzleStatusText?.setText(this._getMiniMachinePanelStatusText(this._currentMachineVariant));
        this._miniMachineHintText?.setText('CLICK GRID OR FLOW PORT');
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
            evidence: this._currentMachineVariant._uiOtherPuzzleEvidence,
            graphics: this._miniFlowGfx,
            labelContainer: this._miniFlowLabelContainer,
            left: resolvedFlowPreview.x,
            top: resolvedFlowPreview.y,
            width: resolvedFlowPreview.width,
            height: resolvedFlowPreview.height,
        });

        this._updateMiniMachinePortStyles();
    }

    _updateMiniMachinePortStyles() {
        if (!this._miniGridPort || !this._miniFlowPort) return;

        const hasMachine = Boolean(this._currentMachineVariant);
        const canInteract = this._screen === 'conveyor' && hasMachine && !this._settingsOpen && !this._actionLocked;
        const evaluation = this._currentMachineVariant?.puzzleState?.getEvaluation?.() || { solved: false, impossible: false };
        const flowState = this._getOtherPuzzleButtonState();
        const alpha = canInteract ? 1 : (hasMachine ? 0.74 : 0.36);
        const gridHovered = this._miniMachinePanelHoverPort === 'grid';
        const flowHovered = this._miniMachinePanelHoverPort === 'flow';

        let gridStroke = 0x8bb8ff;
        let gridFill = 0x243041;
        let gridLabelColor = '#dbe7ff';

        if (evaluation.solved) {
            gridStroke = 0x75ffaf;
            gridFill = 0x174b2a;
            gridLabelColor = '#d4ffea';
        } else if (evaluation.impossible && this._currentMachineVariant?._uiPuzzleOpened) {
            gridStroke = 0xffcc77;
            gridFill = 0x4b3520;
            gridLabelColor = '#ffe5bb';
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
    }

    _getMiniPuzzleStatusText(puzzleState) {
        if (!puzzleState?.getEvaluation) return 'NO UNIT LATCHED';

        const evaluation = puzzleState.getEvaluation();
        if (evaluation.solved) return 'GRID STABLE // ACCEPT SAFE';
        if (evaluation.impossible) return 'IMPOSSIBLE GRID // SCRAP BONUS';

        return `CHG ${evaluation.matchedChargeCells}/${evaluation.totalChargeCells}  EQ ${evaluation.matchedEqualityPairs}/${evaluation.totalEqualityPairs}`;
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
                domino.isFullyGlowing ? 0xf8ffd3 : 0x60cf86,
                domino.isFullyGlowing ? 0.62 : 0.24,
            );
            graphics.beginPath();
            graphics.moveTo(start.x, start.y);
            graphics.lineTo(end.x, end.y);
            graphics.strokePath();
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

        shapeGrid.forEach((row, rowIndex) => {
            row.forEach((cell, colIndex) => {
                const x = startX + (colIndex * cellSize);
                const y = startY + (rowIndex * cellSize);
                const baseValue = puzzleState?.getBaseCellValue?.(rowIndex, colIndex) ?? cell;
                const chargeLevel = puzzleState?.getChargeLevel?.(rowIndex, colIndex) ?? 0;
                const matchedCharge = puzzleState?.isChargeMatched?.(rowIndex, colIndex) ?? false;
                const hasEqualLink = puzzleState?.isEqualLinkCell?.(rowIndex, colIndex) ?? false;
                const matchedEqualLink = puzzleState?.isEqualMatched?.(rowIndex, colIndex) ?? false;
                const placedPipCount = puzzleState?.getPlacedPipCount?.(rowIndex, colIndex) ?? null;
                const isPlaced = placedPipCount !== null;

                let fillColor = 0x122029;
                let fillAlpha = 0.35;
                let strokeColor = 0x4d7182;

                if (baseValue === 1) {
                    fillColor = 0x3c4a58;
                    fillAlpha = 0.9;
                    strokeColor = 0xb7c7d5;
                } else if (chargeLevel > 0) {
                    fillColor = matchedCharge ? 0x97a53b : 0x4b5f32;
                    fillAlpha = 0.92;
                    strokeColor = matchedCharge ? 0xfff2ba : 0xf0df95;
                } else if (hasEqualLink) {
                    fillColor = matchedEqualLink
                        ? 0x8a7e31
                        : isPlaced
                            ? 0x285e67
                            : 0x2d3f49;
                    fillAlpha = 0.92;
                    strokeColor = matchedEqualLink ? 0xffefad : 0xe6d987;
                } else if (isPlaced) {
                    fillColor = 0x48cd75;
                    fillAlpha = 0.92;
                    strokeColor = 0xf1ffcc;
                }

                graphics.fillStyle(fillColor, fillAlpha);
                graphics.fillRect(x, y, cellSize - cellInset, cellSize - cellInset);
                graphics.lineStyle(1, strokeColor, 0.85);
                graphics.strokeRect(x, y, cellSize - cellInset, cellSize - cellInset);

                let overlayText = '';
                let overlayColor = '#e9f8c8';
                if (chargeLevel > 0) {
                    overlayText = String(chargeLevel);
                    overlayColor = matchedCharge ? '#fff7b9' : '#ffe684';
                } else if (hasEqualLink) {
                    overlayText = '=';
                    overlayColor = matchedEqualLink ? '#fff7b9' : '#ffe684';
                } else if (placedPipCount !== null) {
                    overlayText = String(placedPipCount);
                    overlayColor = '#d9ffe4';
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

                if (placedPipCount !== null && (chargeLevel > 0 || hasEqualLink)) {
                    const badgeRadius = Math.max(5, Math.floor(cellSize * 0.22));
                    const badgeX = x + (cellSize - cellInset) - badgeRadius - 1;
                    const badgeY = y + (cellSize - cellInset) - badgeRadius - 1;

                    graphics.fillStyle((matchedCharge || matchedEqualLink) ? 0x294823 : 0x183129, 0.96);
                    graphics.fillCircle(badgeX, badgeY, badgeRadius);
                    graphics.lineStyle(1, (matchedCharge || matchedEqualLink) ? 0xf8ffd3 : 0xbdf8d0, 0.92);
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

        const outputs = Object.entries(flowPuzzle.outputs || {}).map(([row, label]) => ({ row: Number(row), label }));
        const totalOutputs = outputs.length;
        const connectedOutputs = new Set(evidence?.completed ? outputs.map((output) => output.label) : (evidence?.connected || []));
        const forbiddenUsed = Boolean(evidence?.forbiddenUsed);
        const contentLeft = left + 8;
        const contentRight = left + width - 8;
        const contentTop = top + 6;
        const contentBottom = top + height - 14;
        const branchX = left + Math.max(24, Math.floor(width * 0.46));
        const sourceX = contentLeft + 4;
        const sourceY = contentTop + (((flowPuzzle.sourceRow + 0.5) / 5) * (contentBottom - contentTop));
        const lineColor = forbiddenUsed ? 0xff9977 : 0x6ef7ff;
        const dimColor = 0x385764;

        graphics.lineStyle(2, dimColor, 0.75);
        graphics.beginPath();
        graphics.moveTo(sourceX, sourceY);
        graphics.lineTo(branchX, sourceY);
        graphics.strokePath();

        if (outputs.length > 0) {
            const verticalTop = Math.min(...outputs.map((output) => contentTop + (((output.row + 0.5) / 5) * (contentBottom - contentTop))));
            const verticalBottom = Math.max(...outputs.map((output) => contentTop + (((output.row + 0.5) / 5) * (contentBottom - contentTop))));
            graphics.lineStyle(2, dimColor, 0.72);
            graphics.beginPath();
            graphics.moveTo(branchX, verticalTop);
            graphics.lineTo(branchX, verticalBottom);
            graphics.strokePath();
        }

        graphics.fillStyle(0xffcc44, 1);
        graphics.fillCircle(sourceX, sourceY, 4);
        graphics.lineStyle(1, 0xfff0b5, 0.8);
        graphics.strokeCircle(sourceX, sourceY, 5);

        outputs.forEach((output, index) => {
            const outputY = contentTop + (((output.row + 0.5) / 5) * (contentBottom - contentTop));
            const isConnected = connectedOutputs.has(output.label);
            const nodeX = contentRight - 2;
            const branchColor = isConnected ? lineColor : dimColor;

            graphics.lineStyle(isConnected ? 2 : 1, branchColor, isConnected ? 0.95 : 0.72);
            graphics.beginPath();
            graphics.moveTo(branchX, outputY);
            graphics.lineTo(nodeX, outputY);
            graphics.strokePath();

            graphics.fillStyle(isConnected ? 0x62ffb0 : 0x294756, 1);
            graphics.fillCircle(nodeX, outputY, 4);
            graphics.lineStyle(1, isConnected ? 0xe8fff1 : 0x6aa0b3, 0.85);
            graphics.strokeCircle(nodeX, outputY, 5);

            const tag = this.add.text(nodeX - 10, outputY, String(index + 1), {
                fontFamily: 'Courier New',
                fontSize: '7px',
                color: isConnected ? '#dfffee' : '#8db3bf',
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

        const progressText = evidence?.completed
            ? 'FLOW CLEAR'
            : forbiddenUsed
                ? 'MODIFIED'
                : `${connectedOutputs.size}/${totalOutputs} LIVE`;
        const progressLabel = this.add.text(left + 2, top + height - 10, progressText, {
            fontFamily: 'Courier New',
            fontSize: '7px',
            color: evidence?.completed ? '#d9ffe4' : forbiddenUsed ? '#ffd0c4' : '#a8d8f0',
            stroke: '#000000',
            strokeThickness: 2,
        });
        labelContainer?.add(progressLabel);
    }

    _getMachineResponseForAction(action) {
        const question = this._currentMachineVariant?.questionDialogue;
        if (!question) return '';
        return action === 'scrap' ? question.noDialogue : question.yesDialogue;
    }

    _fmtPay() {
        return `$${Math.max(0, GameState.paycheckTotal).toFixed(8)}`;
    }
}

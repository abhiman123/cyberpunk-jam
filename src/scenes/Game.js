import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import RulebookOverlay from '../systems/RulebookOverlay.js';
import MachinePuzzleOverlay from '../systems/MachinePuzzleOverlay.js';
import FactorySettingsOverlay from '../systems/FactorySettingsOverlay.js';
import Animations from '../fx/Animations.js';
import { applyCyberpunkLook, glitchBurst } from '../fx/applyCyberpunkLook.js';
import {
    FACTORY_DEBUG,
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
import ChassisBay from '../ui/ChassisBay.js';
import StampPress from '../ui/StampPress.js';
import CircuitRouting from '../systems/minigames/CircuitRouting.js';

const SHIFT_MS       = { 1: 180000, 2: 135000, 3: 90000 };
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

        this._baseQueue   = baseIds.map((id) => allCases.find((item) => item.id === id)).filter(Boolean);
        this._queue   = [...this._baseQueue];
        this._queueIndex   = 0;
        this._currentCase   = null;
        this._actionLocked = false;
        this._shiftMistakes = 0;
        this._paycheckDelta = 0;
        this._selectedTool = null;
        this._inspectedZones = new Set();
        this._logLines = [];

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

        this._logLines      = [];

        // ── Per-case state machine ────────────────────────────────────────────
        // intake → diagnose → verdict → transition
        this._caseSM = new StateMachine('intake');

        // ── Cyberpunk look ────────────────────────────────────────────────────
        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        this._buildHUD();
        this._buildConveyorScreen();
        if (FACTORY_DEBUG.workbenchEnabled) {
            this._buildInspectionScreen();
        } else {
            // Legacy inspection screen retained below, but disabled while the
            // factory-only gameplay flow is active.
            this._buildDisabledInspectionContainer();
        }
        this._buildPhonePanel();
        this._machinePuzzleOverlay = new MachinePuzzleOverlay(this, {
            onPuzzleChanged: (machineVariant, puzzleState) => this._handlePuzzleStateChanged(machineVariant, puzzleState),
        });
        this._settingsOverlay = new FactorySettingsOverlay(this, {
            onOpen: () => this._setGameplayPaused(true),
            onClose: () => this._setGameplayPaused(false),
            onMusicChanged: () => this._applyMusicSettingChange(),
        });

        const newRuleIds = allRules.filter((rule) => rule.period === period).map((rule) => rule.id);
        this._rulebook = FACTORY_DEBUG.workbenchEnabled
            ? new RulebookOverlay(this, GameState.activeRules, allRules, newRuleIds)
            : null;
        this.events.on('shutdown', () => {
            this._rulebook?.destroy();
            this._machinePuzzleOverlay.destroy();
            this._settingsOverlay.destroy();
        });

        this._buildInspectionScreen();
        this._buildMinigame();

        // ── Shift timer ───────────────────────────────────────────────────────
        this._shiftDuration = SHIFT_MS[period] || 180000;
        this._elapsed       = 0;
        this._shiftRunning  = false;
        this._musicPhase    = 1;
        this._currentMusic  = null;

        // ── Rulebook ──────────────────────────────────────────────────────────
        const newRuleIds = allRules.filter(r => r.period === period).map(r => r.id);
        this._rulebook = new RulebookOverlay(this, GameState.activeRules, allRules, newRuleIds);
        this.events.on('shutdown', () => {
            this._rulebook.destroy();
            this._chassisBay?.destroy();
            this._stampPress?.destroy();
            this._minigame?.destroy();
        });

        // ── Start ─────────────────────────────────────────────────────────────
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

        const topBar = this.add.rectangle(640, 25, 1280, 50, 0x050505, 0.9);
        this._hudContainer.add(topBar);

        this._hudPeriodText = this.add.text(12, 14,
            `PERIOD ${GameState.period}  |  DAY ${GameState.day}`, {
                fontFamily: 'monospace', fontSize: '11px', color: '#cccccc',
            }
        );
        this._hudContainer.add(this._hudPeriodText);

        this._hudCasesText = this.add.text(640, 25, 'CASES: 0', {
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

        const clockBg = this.add.rectangle(142, 664, 240, 74, 0x050505, 0.92)
            .setStrokeStyle(1, 0x336688, 0.75);
        this._hudContainer.add(clockBg);

        const clockFaceFrame = this.add.rectangle(56, 664, 44, 44, 0x08141a, 0.95)
            .setStrokeStyle(1, 0x66aacc, 0.75);
        this._hudContainer.add(clockFaceFrame);

        this._clockIcon = this.add.graphics();
        this._hudContainer.add(this._clockIcon);

        const clockLabel = this.add.text(84, 646, 'SHIFT CLOCK', {
            fontFamily: 'monospace', fontSize: '10px', color: '#66aacc', letterSpacing: 3,
        });
        this._hudContainer.add(clockLabel);

        this._clockText = this.add.text(84, 670, '12:00 PM', {
            fontFamily: 'Courier New', fontSize: '24px', color: '#ccefff',
        }).setOrigin(0, 0.5);
        this._hudContainer.add(this._clockText);

        const miniPanelOuter = this.add.rectangle(174, 172, 248, 188, 0x585245, 0.94)
            .setStrokeStyle(2, 0x8f8875, 0.95);
        const miniPanelInner = this.add.rectangle(174, 172, 224, 164, 0x2c2f29, 0.96)
            .setStrokeStyle(1, 0xb3a779, 0.34);
        const miniPanelScreen = this.add.rectangle(174, 188, 206, 108, 0x1a211d, 0.98)
            .setStrokeStyle(1, 0x89805d, 0.55);
        const miniScrewTopLeft = this.add.circle(70, 92, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const miniScrewTopRight = this.add.circle(278, 92, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const miniScrewBottomLeft = this.add.circle(70, 252, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);
        const miniScrewBottomRight = this.add.circle(278, 252, 6, 0x6f685a, 1).setStrokeStyle(1, 0x2e2a23, 0.9);

        this._miniPuzzleTitleText = this.add.text(78, 103, 'UNIT CIRCUIT', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#d6cfaa',
            letterSpacing: 2,
        });
        this._miniPuzzleStatusText = this.add.text(78, 122, 'NO UNIT LATCHED', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#9ab894',
        });
        this._miniPuzzleLinkGfx = this.add.graphics();
        this._miniPuzzleGfx = this.add.graphics();
        this._miniPuzzleLabelContainer = this.add.container(0, 0);

        this._hudContainer.add(miniPanelOuter);
        this._hudContainer.add(miniPanelInner);
        this._hudContainer.add(miniPanelScreen);
        this._hudContainer.add(miniScrewTopLeft);
        this._hudContainer.add(miniScrewTopRight);
        this._hudContainer.add(miniScrewBottomLeft);
        this._hudContainer.add(miniScrewBottomRight);
        this._hudContainer.add(this._miniPuzzleTitleText);
        this._hudContainer.add(this._miniPuzzleStatusText);
        this._hudContainer.add(this._miniPuzzleLinkGfx);
        this._hudContainer.add(this._miniPuzzleGfx);
        this._hudContainer.add(this._miniPuzzleLabelContainer);
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

    _buildPhonePanel() {
        this._phonePanel = this.add.container(968, 22).setDepth(260).setVisible(true);

        const frame = this.add.rectangle(0, 0, 290, 206, 0x334c5d, 1).setOrigin(0)
            .setStrokeStyle(4, 0x82dffd, 0.9);
        const inner = this.add.rectangle(12, 12, 266, 182, 0x11202a, 1).setOrigin(0)
            .setStrokeStyle(2, 0x4ba7c4, 0.9);
        const screen = this.add.rectangle(24, 24, 196, 150, 0x72d3dd, 0.84).setOrigin(0)
            .setStrokeStyle(1, 0xc9ffff, 0.25);
        const gloss = this.add.rectangle(122, 141, 196, 48, 0xffffff, 0.08).setOrigin(0.5);
        const tray = this.add.rectangle(145, 189, 250, 8, 0x1b1812, 1).setOrigin(0.5);

        const scanlines = this.add.graphics();
        scanlines.fillStyle(0xffffff, 0.07);
        for (let offset = 0; offset < 150; offset += 14) {
            scanlines.fillRect(24, 24 + offset, 196, 6);
        }

        this._phoneHeaderText = this.add.text(38, 38, 'FACTORY LINK', {
            fontFamily: 'Arial Black', fontSize: '16px', color: '#101010',
        });
        this._phoneBodyText = this.add.text(38, 74, '', {
            fontFamily: 'Arial', fontSize: '18px', color: '#101010',
            wordWrap: { width: 168 }, lineSpacing: 7,
        });
        this._phoneStatusText = this.add.text(38, 176, 'CHANNEL IDLE', {
            fontFamily: 'Arial', fontSize: '12px', color: '#15313a',
        });

        this._settingsButtonBg = this.add.rectangle(248, 54, 36, 42, 0x314250, 1)
            .setStrokeStyle(2, 0x6db7e1, 0.8)
            .setInteractive({ useHandCursor: true });
        this._settingsButtonLabel = this.add.text(248, 54, '⚙', {
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

        const accept = this._createPhoneButton(248, 108, '✓', 0x284333, 0x31e36a, '#c8f0d9', '#0d2d12');
        const reject = this._createPhoneButton(248, 160, 'X', 0x4b1f1b, 0xff5f52, '#ffd7d4', '#4a0605');

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
            accept.bg,
            accept.label,
            reject.bg,
            reject.label,
        ]);

        this._phoneButtons = { accept, reject };
        this._setPhoneButtonsActive(false);
        this._setPhoneButtonSelection(null);
        this._showPhonePanel('FACTORY LINK', 'Awaiting unit connection.', 'CHANNEL IDLE');
    }

    _createPhoneButton(x, y, text, inactiveFill, activeFill, inactiveText, activeText) {
        const bg = this.add.rectangle(x, y, 36, 42, inactiveFill, 1)
            .setStrokeStyle(2, 0x2b2417, 0.7)
            .setInteractive({ useHandCursor: true });
        const label = this.add.text(x, y, text, {
            fontFamily: 'Arial Black', fontSize: text === 'OK' ? '15px' : '22px', color: inactiveText,
        }).setOrigin(0.5);

        return {
            bg,
            label,
            inactiveFill,
            activeFill,
            inactiveText,
            active: false,
            selected: false,
            pulseTween: null,
            activeText,
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

        if (button.selected) {
            fill = button.activeFill;
            stroke = 0xf3d89d;
            textColor = button.activeText;
            alpha = 1;
        } else if (button.active) {
            fill = button.activeFill;
            stroke = 0xf3d89d;
            textColor = button.activeText;
            alpha = 1;
            button.pulseTween = this.tweens.add({
                targets: [button.bg, button.label],
                alpha: 0.76,
                duration: 360,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
        }

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
        button.bg.setScale(isHovering ? 1.08 : 1);
        button.label.setScale(isHovering ? 1.08 : 1);
    }

    _setPhoneMessage(header, body, status = this._phoneStatusText?.text || '') {
        this._phoneHeaderText.setText(header || '');
        this._phoneBodyText.setText(body || '');
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
        const centerX = 56;
        const centerY = 664;
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
        }).setOrigin(0.5, 0.5);
        this._conveyorContainer.add(this._shapeTitleText);

        this._shapeLegendText = this.add.text(964, 294, '0 open  1 frame  2 block', {
            fontFamily: 'monospace', fontSize: '10px', color: '#88b7c6',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5);
        this._conveyorContainer.add(this._shapeLegendText);

        this._shapeHintText = this.add.text(964, 320, 'CLICK UNIT FOR DOMINO GRID', {
            fontFamily: 'monospace', fontSize: '10px', color: '#d9cc9f', letterSpacing: 2,
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5, 0.5);
        this._conveyorContainer.add(this._shapeHintText);

        this._machineBlueprintGfx = this.add.graphics();
        this._conveyorContainer.add(this._machineBlueprintGfx);
        this._machineBlueprintLinkGfx = this.add.graphics();
        this._conveyorContainer.add(this._machineBlueprintLinkGfx);
        this._machineBlueprintLabelContainer = this.add.container(0, 0);
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
            this._openMachinePuzzle();
        });

        this._shapeLegendText.setText('0 open  1 wall  2-5 charge  = linked pair');

        const rulingDefs = [
            { action: 'scrap', x: 844, label: 'SCRAP', subtitle: 'drop from the line', fillColor: 0x5b1815, strokeColor: 0xff7d77, textColor: '#ffd6d2' },
            { action: 'approve', x: 1048, label: 'ACCEPT', subtitle: 'send it onward', fillColor: 0x174b2a, strokeColor: 0x75ffaf, textColor: '#d4ffea' },
        ];

        this._conveyorRulingButtons = {};
        rulingDefs.forEach((def) => {
            const bgRect = this.add.rectangle(def.x, 650, 164, 62, def.fillColor, 0.94)
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
        this._currentMachineVariant = null;
    }

    _openMachinePuzzle() {
        if (!this._currentMachineVariant) return;
        this._machinePuzzleOverlay.open(this._currentMachineVariant);
    }

    _canUseFactoryDecisionButtons() {
        return this._screen === 'conveyor'
            && !this._actionLocked
            && !this._settingsOpen
            && Boolean(this._currentCase);
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
    }

    _handlePuzzleStateChanged(machineVariant, puzzleState) {
        if (!puzzleState) return;
        if (machineVariant && this._currentMachineVariant && machineVariant !== this._currentMachineVariant) return;

        const evaluation = puzzleState.getEvaluation();
        const wasSolved = Boolean(machineVariant?._uiPuzzleSolved);
        const isSolved = Boolean(evaluation.solved);

        if (machineVariant) machineVariant._uiPuzzleSolved = isSolved;
        if (this._miniPuzzleStatusText) {
            this._miniPuzzleStatusText.setText(this._getMiniPuzzleStatusText(puzzleState));
        }

        this._drawMachineShapeGrid(puzzleState.grid);
        this._updateConveyorDecisionHint(evaluation);

        if (isSolved && !wasSolved && !this._actionLocked) {
            this._playOneShot(SOUND_ASSETS.puzzleFixed, { volume: SOUND_VOLUMES.puzzleFixed });
            this._showFeedback('GRID FIXED // ACCEPT IS SAFE', '#c7ff86');
        }
    }

    _updateConveyorDecisionHint(evaluation = null) {
        if (!this._conveyorDecisionHint) return;

        let text = 'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR';
        let color = '#8fc1cf';

        if (evaluation?.solved) {
            text = 'CHARGE MATCH CONFIRMED // ACCEPT FOR CLEAN PAY';
            color = '#c7ff86';
        } else if (evaluation?.impossible) {
            text = 'GRID MARKED IMPOSSIBLE // SCRAP FOR BONUS';
            color = '#ffd685';
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
        this._inspectionContainer = this.add.container(0, 0).setDepth(10);

        // Dark workbench background
        const bg = this.add.rectangle(640, 360, 1280, 720, 0x070a0c, 1);
        this._inspectionContainer.add(bg);

        // Subtle grid overlay
        const grid = this.add.graphics();
        grid.lineStyle(1, 0x112233, 0.4);
        for (let x = 0; x < 1280; x += 80) grid.lineBetween(x, 50, x, 720);
        for (let y = 50; y < 720; y += 80) grid.lineBetween(0, y, 1280, y);
        this._inspectionContainer.add(grid);

        // Docket header strip
        const docketStrip = this.add.rectangle(640, 70, 1280, 38, 0x0a1418, 0.95);
        this._inspectionContainer.add(docketStrip);

        this._caseNameText = this.add.text(20, 60, '', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#cce0ff',
        });
        this._inspectionContainer.add(this._caseNameText);

        this._caseDescText = this.add.text(20, 80, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#778899',
        });
        this._inspectionContainer.add(this._caseDescText);

        // Chassis Bay — left/center
        this._chassisBay = new ChassisBay(this, 320, 340);
        this._inspectionContainer.add(this._chassisBay.container);
        this._chassisBay.onPanelOpened = (info) => this._onPanelOpened(info);
        this._chassisBay.onDiagnosticLaunch = (caseData) => this._launchDiagnostic(caseData);

        // Stamp Press — right
        this._stampPress = new StampPress(this, 960, 340);
        this._inspectionContainer.add(this._stampPress.container);
        this._stampPress.onStamp = (action) => this._submitRuling(action);

        // Inspection log — bottom strip
        const LOG_X = 20, LOG_Y = 592, LOG_W = 1240, LOG_H = 108;
        const logBg = this.add.rectangle(LOG_X + LOG_W / 2, LOG_Y + LOG_H / 2, LOG_W, LOG_H, 0x000000, 0.7)
            .setStrokeStyle(1, 0x224455, 0.8);
        const logBg = this.add.rectangle(255, 590, 480, 185, 0x000000, 0.55);
        this._inspectionContainer.add(logBg);

        const logHeader = this.add.text(LOG_X + 8, LOG_Y + 4, 'INSPECTION LOG', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#44aaaa', letterSpacing: 2,
        });
        this._inspectionContainer.add(logHeader);

        const LOG_X = 15;
        const LOG_TOP = 503;
        const LOG_W = 480;
        const LOG_H = 178;
        const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
        maskShape.fillRect(LOG_X, LOG_TOP, LOG_W, LOG_H);
        const logMask = maskShape.createGeometryMask();

        this._logContainerBaseY = LOG_TOP + 4;
        this._logContainer = this.add.container(LOG_X + 6, this._logContainerBaseY);
        this._logContainer.setMask(logMask);
        this._inspectionContainer.add(this._logContainer);

        this._logLineHeight = 16;
        this._logScrollY = 0;
        this._logPanelH = LOG_H;
        // Fixed text slots — one text object per visible row, positioned within panel
        const SLOT_H = 15;
        const LOG_INNER_Y = LOG_Y + 20;
        const LOG_INNER_H = LOG_H - 24;
        this._logSlotCount = Math.floor(LOG_INNER_H / SLOT_H);
        this._logSlots = [];
        for (let i = 0; i < this._logSlotCount; i++) {
            const t = this.add.text(LOG_X + 12, LOG_INNER_Y + i * SLOT_H, '', {
                fontFamily: 'Courier New', fontSize: '10px', color: '#00cc88',
            }).setVisible(false);
            this._inspectionContainer.add(t);
            this._logSlots.push(t);
        }
        this._logHistory  = []; // { text, color }
        this._logScrollIdx = 0; // index of first visible entry

        const scrollHint = this.add.text(LOG_X + LOG_W - 8, LOG_Y + 4, '↑↓ scroll', {
            fontFamily: 'Courier New', fontSize: '9px', color: '#336677',
        }).setOrigin(1, 0);
        this._inspectionContainer.add(scrollHint);

        this.input.on('wheel', (pointer, _objects, _dx, dy) => {
            if (this._screen !== 'inspection') return;
            const maxScroll = Math.max(0, (this._logLines.length * this._logLineHeight) - LOG_H + 8);
            this._logScrollY = Phaser.Math.Clamp(this._logScrollY + (dy * 0.4), 0, maxScroll);
            this._updateLogScroll();
        });

        const rulingDefs = [
            { y: 140, label: 'SCRAP', fillColor: 0xff3322, dotColor: 0xff3322, textColor: '#ff6655', action: 'scrap' },
            { y: 285, label: 'REPAIR', fillColor: 0xffcc00, dotColor: 0xffcc00, textColor: '#ffdd44', action: 'repair' },
            { y: 425, label: 'APPROVE', fillColor: 0x00cc44, dotColor: 0x00cc44, textColor: '#44ff88', action: 'approve' },
        ];
        rulingDefs.forEach((def) => {
            const btnBg = this.add.rectangle(960, def.y, 580, 68, def.fillColor, 0.18)
                .setStrokeStyle(2, def.fillColor, 0.85)
                .setInteractive({ useHandCursor: true });
            const dot = this.add.circle(690, def.y, 9, def.dotColor, 1.0);
            const label = this.add.text(970, def.y, def.label, {
                fontFamily: 'monospace', fontSize: '20px', color: def.textColor,
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);

            btnBg.on('pointerover', () => btnBg.setFillStyle(def.fillColor, 0.35));
            btnBg.on('pointerout', () => btnBg.setFillStyle(def.fillColor, 0.18));
            btnBg.on('pointerdown', () => {
                if (this._screen !== 'inspection') return;
                if (this._actionLocked || this._rulebook.isVisible()) return;
                Animations.buttonPunch(this, btnBg);
                this._submitRuling(def.action);
            });

            this._inspectionContainer.add(btnBg);
            this._inspectionContainer.add(dot);
            this._inspectionContainer.add(label);
        });

        const toolDefs = [
            { x: 790, key: 'hammer', label: 'HAMMER' },
            { x: 1130, key: 'scanner', label: 'SCANNER' },
        ];
        this._toolBtns = {};
        toolDefs.forEach((tool) => {
            const bg = this.add.rectangle(tool.x, 605, 240, 170, 0xaa8800, 0.15)
                .setStrokeStyle(2, 0xaa8800, 0.6)
                .setInteractive({ useHandCursor: true });
            const label = this.add.text(tool.x, 667, tool.label, {
                fontFamily: 'monospace', fontSize: '13px', color: '#ccaa33',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5);

            bg.on('pointerover', () => {
                if (this._selectedTool !== tool.key) bg.setFillStyle(0xffdd44, 0.22);
            });
            bg.on('pointerout', () => {
                if (this._selectedTool !== tool.key) bg.setFillStyle(0xaa8800, 0.15);
            });
            bg.on('pointerdown', () => this._onToolSelect(tool.key));

            this._inspectionContainer.add(bg);
            this._inspectionContainer.add(label);
            this._toolBtns[tool.key] = { bg, label };
        });

        const rbBg = this.add.rectangle(960, 696, 320, 38, 0x001a1a, 0.6)
            if (ptr.y < LOG_Y || ptr.y > LOG_Y + LOG_H) return;
            const maxIdx = Math.max(0, this._logHistory.length - this._logSlotCount);
            this._logScrollIdx = Phaser.Math.Clamp(
                this._logScrollIdx + (dy > 0 ? 1 : -1), 0, maxIdx
            );
            this._redrawLog();
        });

        // Rulebook button — small, bottom
        const rbBg = this.add.rectangle(1180, 570, 180, 28, 0x001a1a, 0.8)
            .setStrokeStyle(1, 0x00aaaa, 0.7)
            .setInteractive({ useHandCursor: true });
        const rbText = this.add.text(1180, 570, '[B] RULEBOOK', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#00dddd',
        }).setOrigin(0.5);
        rbBg.on('pointerover', () => rbBg.setFillStyle(0x00aaaa, 0.22));
        rbBg.on('pointerout', () => rbBg.setFillStyle(0x001a1a, 0.8));
        rbBg.on('pointerdown', () => {
            if (this._screen !== 'inspection') return;
            Animations.buttonPunch(this, rbBg);
            this._rulebook.toggle();
        });
        this._inspectionContainer.add(rbBg);
        this._inspectionContainer.add(rbText);
        this._inspectionContainer.add([rbBg, rbTxt]);

        // Return-to-conveyor button
        const backBg = this.add.rectangle(100, 570, 180, 28, 0x1a1a00, 0.8)
            .setStrokeStyle(1, 0xaaaa00, 0.7)
            .setInteractive({ useHandCursor: true });
        const backTxt = this.add.text(100, 570, '◀ BELT', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#dddd00',
        }).setOrigin(0.5);
        backBg.on('pointerover', () => backBg.setFillStyle(0xaaaa00, 0.22));
        backBg.on('pointerout',  () => backBg.setFillStyle(0x1a1a00, 0.8));
        backBg.on('pointerdown', () => {
            if (this._screen !== 'inspection' || this._actionLocked) return;
            this._setScreen('conveyor');
        });
        this._inspectionContainer.add([backBg, backTxt]);

        this._feedbackText = this.add.text(640, 548, '', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 1, align: 'center',
            wordWrap: { width: 900 },
        }).setOrigin(0.5).setAlpha(0);
        this._inspectionContainer.add(this._feedbackText);
    }

    _buildMinigame() {
        this._minigame = new CircuitRouting(this);
        this._minigame.onClose = (evidence) => this._onMinigameClose(evidence);
    }

    // ── Screen toggle ─────────────────────────────────────────────────────────

    _setScreen(name) {
        this._screen = name;
        this._conveyorContainer.setVisible(name === 'conveyor');
        this._unitContainer.setVisible(name === 'conveyor' && !!this._currentCase);
        if (this._inspectionContainer) this._inspectionContainer.setVisible(false);
        this._setConveyorRulingButtonsVisible(name === 'conveyor' && !!this._currentMachineVariant);

        if (name !== 'conveyor') {
            this._machinePuzzleOverlay?.close(true);
        }
    }
        this._unitContainer.setVisible(name === 'conveyor');
        this._inspectionContainer.setVisible(name === 'inspection');
    }

    // ── Panel / minigame handling ─────────────────────────────────────────────

    _onPanelOpened({ panel, label, findings }) {
        if (!findings.length) return;
        this._appendLog(`[${panel}] ${label}:`);
        findings.forEach(f => this._appendLog(`  ${f}`));
        if (this.cache.audio.has('sfx_reveal')) this.sound.play('sfx_reveal', { volume: 0.7 });
    _onToolSelect(tool) {
        this._selectedTool = tool;
        Object.entries(this._toolBtns).forEach(([key, button]) => {
            if (key === tool) {
                button.bg.setFillStyle(0xffcc44, 0.4).setStrokeStyle(2, 0xffcc44, 1.0);
                button.label.setColor('#ffee88');
            } else {
                button.bg.setFillStyle(0xaa8800, 0.15).setStrokeStyle(2, 0xaa8800, 0.6);
                button.label.setColor('#ccaa33');
            }
        });
    }

    _onZoneClick(zoneId) {
        if (!this._currentCase) return;
        if (!this._selectedTool) {
            this._showFeedback('Select a tool first.', '#ff9933');
            return;
        }

        const key = `${zoneId}:${this._selectedTool}`;
        this._inspectedZones.add(key);

        const result = this._currentCase.zones[zoneId][this._selectedTool];
        this._appendLog(`[${zoneId}/${this._selectedTool.toUpperCase()}] ${result}`);
        this._highlightZone(zoneId);
        this._playOneShot(SOUND_ASSETS.inspectionReveal, { volume: SOUND_VOLUMES.reveal });
    }

    _launchDiagnostic(caseData) {
        if (!this._logContainer) return;
        if (!caseData.circuit) return;
        this._minigame.show(caseData);
    }

    _appendLog(text) {
        const idx = this._logLines.length;
        this._logLines.push(text);
        if (!this._logContainer) return;

        const lineObj = this.add.text(0, idx * this._logLineHeight, text, {
            fontFamily: 'monospace', fontSize: '10px', color: '#00cc88',
            wordWrap: { width: 460 }, lineSpacing: 3,
        });
        this._logContainer.add(lineObj);
        Animations.glitchText(this, lineObj, { duration: 120, finalAlpha: 1 });
    _onMinigameClose(evidence) {
        this._chassisBay.markDiagnosticComplete(evidence);
        const allOutputsReached = (evidence.missing ?? []).length === 0;

        if (evidence.completed) {
            this._appendLog('[DIAG] Circuit routes complete. No modifications.', '#00ff88');
        } else if (evidence.forbiddenUsed && allOutputsReached) {
            this._appendLog('[DIAG] Outputs routed — UNAUTHORIZED MODIFICATION DETECTED.', '#ff4444');
            glitchBurst(this, this._cmFilter, 300);
        } else {
            this._appendLog('[DIAG] Diagnostic incomplete — outputs unreached.', '#ffcc44');
        }
        (evidence.symptoms || []).forEach(s => this._appendLog(`  • ${s}`, '#aabbcc'));
        (evidence.flags || []).forEach(f => this._appendLog(`  ⚠ ${f}`, '#ff6644'));

        const totalHeight = this._logLines.length * this._logLineHeight;
        if (totalHeight > this._logPanelH) {
            this._logScrollY = totalHeight - this._logPanelH + 8;
            this._updateLogScroll();
        }
    }

    _highlightZone(zoneId) {
        const zone = this._zoneBtns[zoneId];
        if (!zone || zone.highlighted) return;
        zone.highlighted = true;
        zone.rect.setFillStyle(0x003322, 0.35).setStrokeStyle(2, 0x00cc88, 1);
        zone.label.setColor('#00cc88');
        // Unlock verdict if every output was routed (forbidden use is additional evidence, not a gate)
        if (allOutputsReached) {
            this._diagnosticDone = true;
            this._stampPress.setGated(false);
            this._showFeedback('DIAGNOSTIC COMPLETE — FILE YOUR RULING', '#00eeee');
        } else {
            this._showFeedback('OUTPUTS UNREACHED — RETURN TO DIAGNOSTIC', '#ffaa44');
        }
    }

    _appendLog(text, color = '#00cc88') {
        this._logHistory.push({ text, color });
        // Auto-scroll to bottom
        this._logScrollIdx = Math.max(0, this._logHistory.length - this._logSlotCount);
        this._redrawLog();
    }

    _redrawLog() {
        for (let i = 0; i < this._logSlotCount; i++) {
            const entry = this._logHistory[this._logScrollIdx + i];
            const slot = this._logSlots[i];
            if (entry) {
                slot.setText(entry.text).setColor(entry.color).setVisible(true);
            } else {
                slot.setText('').setVisible(false);
            }
        }
    }

    _submitRuling(action) {
        if (this._actionLocked) return;
        this._actionLocked = true;
        this._caseSM.transition('verdict');
        this._setPhoneButtonsActive(false);
        this._pendingExitAction = action;

        if (this._currentMachineVariant) {
            this._showPhonePanel(
                `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                this._phoneBodyText.text,
                `PROCESSING ${action.toUpperCase()}`
            );
        }

        const puzzleState = this._currentMachineVariant?.puzzleState;
        const evaluation = puzzleState?.getEvaluation?.() || { solved: false, impossible: false };
        const machineResponse = this._getMachineResponseForAction(action);

        let payDelta = 0;
        let wasPenalty = false;
        let feedbackText = '';
        let feedbackColor = '#00cc66';
        let panelStatus = '';
        let notificationMessage = '';

        if (action === 'scrap') {
            if (evaluation.impossible) {
                payDelta = PAYCHECK_DELTA * SCRAP_BONUS_MULTIPLIER;
                feedbackText = 'IMPOSSIBLE UNIT SCRAPPED // BONUS AWARDED';
                feedbackColor = '#ffd685';
                panelStatus = 'SCRAP BONUS';
            } else {
                payDelta = -PAYCHECK_DELTA;
                wasPenalty = true;
                feedbackText = 'FIXABLE UNIT SCRAPPED // DEDUCTION APPLIED';
                feedbackColor = '#ff7f73';
                panelStatus = 'SCRAP PENALTY';
                notificationMessage = 'Fixable unit scrapped. Payroll deduction applied.';
            }
        } else if (evaluation.solved) {
            payDelta = PAYCHECK_DELTA;
            feedbackText = 'FIX VERIFIED // UNIT ACCEPTED';
            feedbackColor = '#9aff91';
            panelStatus = 'UNIT ACCEPTED';
        } else {
            payDelta = -PAYCHECK_DELTA;
            wasPenalty = true;
            feedbackText = 'UNIT ACCEPTED BEFORE FIX // DEDUCTION APPLIED';
            feedbackColor = '#ff7f73';
            panelStatus = 'ACCEPT PENALTY';
            notificationMessage = 'Unit passed before the charge grid was solved. Payroll deduction applied.';
        }

        this._applyRulingConsequence(payDelta, wasPenalty);
        this._playOneShot(this._decisionSoundFor(action), { volume: SOUND_VOLUMES.decision });
        if (machineResponse) this._appendLog(`[RESPONSE] ${machineResponse}`);

        if (wasPenalty) {
            this.cameras.main.flash(260, 50, 0, 0, false);
            this.cameras.main.shake(300, 0.01);
            glitchBurst(this, this._cmFilter, 420);
            this._showFactoryNotification(notificationMessage, panelStatus);
        } else {
            const flashColor = action === 'scrap'
                ? { red: 60, green: 30, blue: 0 }
                : { red: 0, green: 40, blue: 0 };
            this.cameras.main.flash(180, flashColor.red, flashColor.green, flashColor.blue, false);

            if (action === 'approve') {
                this._showPhonePanel(
                    `${this._currentMachineVariant.name.toUpperCase()} LINK`,
                    'Charge map cleared. Unit forwarded downline.',
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
            this._showFeedback(this._currentCase.incorrectFeedback, '#ff4444');
        }

        this.time.delayedCall(1600, () => this._advanceCase());
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

    _loadNextCase() {
        if (!this._shiftRunning) return;

        this._currentCase = this._queue[this._queueIndex];
        if (!this._currentCase) {
            this._setFactoryIdleState('QUEUE EMPTY\n\nSTATUS: HOLD');
            return;
        }

        this._caseSM.transition('intake');

        this._currentMachineVariant = createMachineVariant();
        const machineQuestion = this._currentMachineVariant.questionDialogue?.prompt;

        this._monitorText.setText(
            `UNIT INCOMING\n\n${this._currentCase.id}\n${this._currentCase.name}\nSTATUS: ACTIVE`
        );

        this._machineDialogueText.setText('');
        this._handlePuzzleStateChanged(this._currentMachineVariant, this._currentMachineVariant.puzzleState);
        this._playMachineConversation(this._currentMachineVariant);

        this._applyMachineSprite(this._conveyorUnitSprite, 1.0);
        if (this._inspUnitSprite) this._applyMachineSprite(this._inspUnitSprite, 1.6);

        this._logLines = [];
        if (this._logContainer) this._logContainer.removeAll(true);
        this._logScrollY = 0;
        this._updateLogScroll();
        if (this._currentMachineVariant.openingDialogue) {
            this._appendLog(`[OPENING] ${this._currentMachineVariant.openingDialogue}`);
        }
        if (machineQuestion) {
            this._appendLog(`[QUESTION] ${machineQuestion}`);
        }

        this._unitContainer.setVisible(true);
        this._unitContainer.x = MACHINE_PRESENTATION.conveyorEntryX;
        this._unitContainer.y = 420;
        this._unitContainer.setAlpha(1);
        this._unitNameText.setText(this._currentMachineVariant.name);
        this._unitIdText.setText(this._currentCase.name);
        this._setConveyorRulingButtonsVisible(true);

        const travelDistance = Math.abs(MACHINE_PRESENTATION.conveyorEntryX - MACHINE_PRESENTATION.conveyorTargetX);
        const tweenDurationMs = Math.max(200, Math.round((travelDistance / MACHINE_PRESENTATION.conveyorSpeedPxPerSecond) * 1000));
        if (this._monitorText) {
            this._monitorText.setText(
                `UNIT INCOMING\n\n${this._currentCase.id}\nSTATUS: ACTIVE`
            );
        }

        this._caseNameText.setText(`${this._currentCase.id} — ${this._currentCase.name}`);
        this._caseDescText.setText(this._currentCase.description);
        this._chassisBay.loadCase(this._currentCase);
        this._stampPress.reset();
        this._diagnosticDone = false;
        if (this._currentCase.circuit) {
            this._stampPress.setGated(true, 'LOCKED — RUN DIAGNOSTIC FIRST');
        }

        this._unitContainer.x = 1450;
        this._unitNameText.setText(this._currentCase.name);
        this._unitIdText.setText(this._currentCase.id);

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

        this._inspectedZones = new Set();
        this._logLines = [];
        if (this._logContainer) this._logHistory = [];
        this._logScrollIdx = 0;
        this._logSlots.forEach(s => s.setText('').setVisible(false));
        this._actionLocked = false;
        this._diagnosticDone = false;

        this._setScreen('conveyor');
        this._selectedTool = null;
        this._pendingExitAction = this._pendingExitAction || 'approve';
        this._clearPhoneTyping();

        Object.entries(this._toolBtns).forEach(([, button]) => {
            button.bg.setFillStyle(0xaa8800, 0.15).setStrokeStyle(2, 0xaa8800, 0.6);
            button.label.setColor('#ccaa33');
        });
        Object.entries(this._zoneBtns).forEach(([, zone]) => {
            zone.highlighted = false;
            zone.rect.setFillStyle(0x001122, 0).setStrokeStyle(1, 0x336688, 0.6);
            zone.label.setColor('#446688');
        });

        this._machinePuzzleOverlay?.close(true);
        this._setConveyorRulingButtonsVisible(false);
        this._setCommStandbyState('Line cleared. Awaiting next unit.', 'SHIFT LIVE');
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
            onComplete: () => {
                this._unitContainer.setVisible(false);
                this._unitContainer.setAngle(0);
                this._unitContainer.setAlpha(1);
                this._machineDialogueText.setText('');
                this._clearMachineGridDisplays();
                if (this._miniPuzzleStatusText) this._miniPuzzleStatusText.setText('NO UNIT LATCHED');
                this._currentMachineVariant = null;
                this._pendingExitAction = null;
            },
        });

            targets: this._unitContainer, x: -250, duration: 500, ease: 'Cubic.In',
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
        this._machinePuzzleOverlay?.close(true);

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

        this.time.delayedCall(700, () => {
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => {
                if (fromFinalCase && GameState.isLastDay()) {
                    this.scene.start('End');
                } else {
                    this.scene.start('Summary', {
                        mistakes: this._shiftMistakes,
                        paycheckDelta: this._paycheckDelta,
                        casesProcessed: GameState.casesProcessedThisShift,
                        notificationText: notif ? notif.text : '',
                    });
                }
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

        if (isMusicEnabled() && this.cache.audio.has(key)) {
            const incoming = this.sound.add(key, { loop: true, volume: 0 });
            incoming.play();
            this.tweens.add({ targets: incoming, volume: SOUND_VOLUMES.music, duration: 2000 });
            this._currentMusic = incoming;
        }
    }

    _applyMusicSettingChange() {
        if (!this._activeMusicKey) return;

        if (!isMusicEnabled()) {
            if (!this._currentMusic) return;

            const outgoing = this._currentMusic;
            this._currentMusic = null;
            this.tweens.add({
                targets: outgoing,
                volume: 0,
                duration: 260,
                onComplete: () => {
                    outgoing.stop();
                    outgoing.destroy();
                },
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

        const incoming = this.sound.add(this._activeMusicKey, { loop: true, volume: 0 });
        incoming.play();
        this.tweens.add({ targets: incoming, volume: SOUND_VOLUMES.music, duration: 360 });
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
    }

    _getMiniPuzzleStatusText(puzzleState) {
        if (!puzzleState?.getEvaluation) return 'NO UNIT LATCHED';

        const evaluation = puzzleState.getEvaluation();
        if (evaluation.solved) return 'GRID STABLE // ACCEPT SAFE';
        if (evaluation.impossible) return 'IMPOSSIBLE GRID // SCRAP BONUS';

        return `CHG ${evaluation.matchedChargeCells}/${evaluation.totalChargeCells}  EQ ${evaluation.matchedEqualityPairs}/${evaluation.totalEqualityPairs}`;
    }

    _drawMachineShapeGrid(shapeGrid) {
        if (!this._machineBlueprintGfx) return;

        this._clearMachineGridDisplays();
        if (!Array.isArray(shapeGrid) || shapeGrid.length === 0) return;

        const puzzleState = this._currentMachineVariant?.puzzleState;
        if (this._miniPuzzleStatusText) {
            this._miniPuzzleStatusText.setText(this._getMiniPuzzleStatusText(puzzleState));
        }

        this._drawPuzzlePreviewLayer({
            shapeGrid,
            puzzleState,
            graphics: this._machineBlueprintGfx,
            lineGraphics: this._machineBlueprintLinkGfx,
            labelContainer: this._machineBlueprintLabelContainer,
            left: MACHINE_PRESENTATION.blueprintOriginX - 92,
            top: MACHINE_PRESENTATION.blueprintOriginY - 92,
            width: 184,
            height: 184,
            maxCellSize: MACHINE_PRESENTATION.blueprintCellSize,
            fontSize: 10,
            lineWidth: 2,
            glowWidth: 4,
        });

        this._drawPuzzlePreviewLayer({
            shapeGrid,
            puzzleState,
            graphics: this._miniPuzzleGfx,
            lineGraphics: this._miniPuzzleLinkGfx,
            labelContainer: this._miniPuzzleLabelContainer,
            left: 74,
            top: 138,
            width: 200,
            height: 96,
            maxCellSize: 14,
            fontSize: 9,
            lineWidth: 1,
            glowWidth: 3,
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

    _getMachineResponseForAction(action) {
        const question = this._currentMachineVariant?.questionDialogue;
        if (!question) return '';
        return action === 'scrap' ? question.noDialogue : question.yesDialogue;
    }

    _fmtPay() {
        return `$${Math.max(0, GameState.paycheckTotal).toFixed(8)}`;
    }
}

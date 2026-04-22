import * as Phaser from 'phaser';
import MinigameBase from './MinigameBase.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../../constants/gameConstants.js';

const PANEL_WIDTH = 1120;
const PANEL_HEIGHT = 636;
const CHAR_FONT_SIZE = '22px';
const BUG_SYMBOLS = Object.freeze(['#', '%', '@', '&', '?', '!']);
const BUG_SPAWN_DELAY_MS = 3600;
const BUG_TRAVEL_MIN_MS = 6500;
const BUG_TRAVEL_MAX_MS = 9200;

function clampIndex(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function displayChar(character) {
    return character === ' ' ? '·' : character;
}

function pickRandomEntry(list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    return list[Math.floor(Math.random() * list.length)] ?? list[0];
}

function getCorruptCharacter(expectedCharacter = '') {
    const pool = 'abcdefghijklmnopqrstuvwxyz0123456789_./-#$%';
    const expected = String(expectedCharacter || '').toLowerCase();
    const options = pool.split('').filter((character) => character !== expected);
    return pickRandomEntry(options) || pickRandomEntry(BUG_SYMBOLS) || '#';
}

export default class DebugConsolePuzzle extends MinigameBase {
    constructor(scene, config = {}) {
        super(scene, { depth: 190, ...config });
        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);
        this._handleHiddenInput = this._handleHiddenInput.bind(this);
        this._handleHiddenSelection = this._handleHiddenSelection.bind(this);
        this._handleHiddenKey = this._handleHiddenKey.bind(this);
        this._handleHiddenBlur = this._handleHiddenBlur.bind(this);
        this._handleGlobalKeyDown = this._handleGlobalKeyDown.bind(this);

        this.scene.input.on('pointermove', this._handlePointerMove);
        this.scene.input.on('pointerup', this._handlePointerUp);

        this._panel = null;
        this._blocker = null;
        this._charObjects = [];
        this._selectionRects = [];
        this._bugViews = [];
        this._bugSpawnEvent = null;
        this._selectionDrag = null;
        this._hiddenInput = null;
        this._syncVisualFrame = null;
        this._puzzle = null;
        this._machineName = 'UNKNOWN UNIT';
        this._specialCommand = null;
        this._specialCommandMode = false;
        this._specialCommandButtonBg = null;
        this._specialCommandButtonText = null;
        this._charWidth = 14;
        this._commandTextStartX = -471;
        this._commandTextY = -100;
        this._commandZoneWidth = 520;
        this._commandZoneHeight = 48;
        this._closeButtonBg = null;
        this._closeButtonText = null;
        this._statusText = null;
        this._modeText = null;
        this._instructionText = null;
        this._expectedOutputText = null;
        this._actualOutputText = null;
        this._bugCounterText = null;
        this._messageText = null;
        this._caret = null;
        this._caretTween = null;
        this._commandZone = null;
        this._selectionAnchor = 0;
        this._escKey = null;
        this._escHandler = null;
        this._lastBugMoveSoundAt = 0;
        this._lastWrongLetterSoundAt = 0;
        this._lastSquashSoundAt = 0;
    }

    _defaultEvidence() {
        return {
            symptoms: ['Software diagnostic pending.'],
            flags: [],
            completed: false,
            phase: 'test',
            reviewed: false,
            prompt: '',
            repairPrompt: '',
            expectedOutput: '',
            actualOutput: '',
            inputValue: '',
            repairRequired: false,
            scrapRequired: false,
            scrapKind: null,
            scrapStatus: null,
            scrapReason: null,
            fixed: false,
            outputMatched: false,
            dayStage: 1,
            resultType: 'stable',
            bugsEnabled: false,
            bugsSquashed: 0,
            corruptionCount: 0,
            lastStatus: 'TEST READY',
        };
    }

    hide() {
        this._persistProgress();
        this._teardown();
        super.hide();
    }

    destroy() {
        this.scene.input.off('pointermove', this._handlePointerMove);
        this.scene.input.off('pointerup', this._handlePointerUp);
        this._teardown(true);
        super.destroy();
    }

    _build(caseData) {
        const debugPuzzle = caseData?.debugPuzzle;
        if (!debugPuzzle?.progress) {
            this.emitEvidence({
                completed: false,
                lastStatus: 'NO CODE MODULE',
                symptoms: ['No software diagnostic loaded.'],
            });
            return;
        }

        this._puzzle = debugPuzzle;
        this._machineName = String(caseData?.machineName || 'UNKNOWN UNIT').toUpperCase();
        this._specialCommand = caseData?.specialCommand || null;
        this.evidence = {
            ...this._defaultEvidence(),
            ...debugPuzzle.progress,
            flags: Array.isArray(debugPuzzle.progress.flags) ? [...debugPuzzle.progress.flags] : [],
            symptoms: Array.isArray(debugPuzzle.progress.symptoms) ? [...debugPuzzle.progress.symptoms] : [],
        };
        if (this.evidence.scrapRequired && !this.evidence.reviewed) {
            this.emitEvidence({ reviewed: true });
        }

        const depth = this.config.depth;

        this._blocker = this.scene.add.rectangle(640, 360, 1280, 720, 0x02070a, 0.82)
            .setDepth(depth - 1)
            .setInteractive();
        this._blocker.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._focusHiddenInput();
        });

        this._panel = this.scene.add.container(640, 360).setDepth(depth);

        // --- Frames ---
        const outer = this.scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x050c07, 0.98)
            .setStrokeStyle(2, 0x3a6b28, 0.95);
        const inner = this.scene.add.rectangle(0, 0, PANEL_WIDTH - 34, PANEL_HEIGHT - 34, 0x070f09, 0.96)
            .setStrokeStyle(1, 0x1e3d18, 0.72);
        const headerRule = this.scene.add.rectangle(0, -252, PANEL_WIDTH - 90, 2, 0x3a6b28, 0.82);
        // Command frame — amber-accented focal point
        const commandFrame = this.scene.add.rectangle(-231, -112, 572, 118, 0x060e07, 0.97)
            .setStrokeStyle(2, 0xb87200, 0.88);
        const commandTopAccent = this.scene.add.rectangle(-231, -171, 572, 2, 0xFFB000, 0.55);
        const actualFrame = this.scene.add.rectangle(286, -126, 352, 146, 0x060d08, 0.96)
            .setStrokeStyle(1, 0x235018, 0.82);
        const expectedFrame = this.scene.add.rectangle(286, 20, 352, 126, 0x060d08, 0.96)
            .setStrokeStyle(1, 0x1e6018, 0.85);
        const detailFrame = this.scene.add.rectangle(0, 188, PANEL_WIDTH - 86, 176, 0x060d08, 0.96)
            .setStrokeStyle(1, 0x1e3d18, 0.72);

        // --- Corner bracket decorations (outer panel) ---
        const cornerGfx = this.scene.add.graphics();
        cornerGfx.lineStyle(3, 0xFFB000, 0.82);
        const hw = PANEL_WIDTH / 2, hh = PANEL_HEIGHT / 2, arm = 26;
        cornerGfx.lineBetween(-hw, -hh + arm, -hw, -hh); cornerGfx.lineBetween(-hw, -hh, -hw + arm, -hh);
        cornerGfx.lineBetween(hw - arm, -hh, hw, -hh);   cornerGfx.lineBetween(hw, -hh, hw, -hh + arm);
        cornerGfx.lineBetween(-hw, hh - arm, -hw, hh);   cornerGfx.lineBetween(-hw, hh, -hw + arm, hh);
        cornerGfx.lineBetween(hw - arm, hh, hw, hh);     cornerGfx.lineBetween(hw, hh - arm, hw, hh);

        // Corner brackets on command frame
        const cmdBracketGfx = this.scene.add.graphics();
        cmdBracketGfx.lineStyle(2, 0xFFB000, 0.65);
        const cfx = -231, cfy = -112, cfw2 = 286, cfh2 = 59, ca = 12;
        cmdBracketGfx.lineBetween(cfx - cfw2, cfy - cfh2 + ca, cfx - cfw2, cfy - cfh2);
        cmdBracketGfx.lineBetween(cfx - cfw2, cfy - cfh2, cfx - cfw2 + ca, cfy - cfh2);
        cmdBracketGfx.lineBetween(cfx + cfw2 - ca, cfy - cfh2, cfx + cfw2, cfy - cfh2);
        cmdBracketGfx.lineBetween(cfx + cfw2, cfy - cfh2, cfx + cfw2, cfy - cfh2 + ca);
        cmdBracketGfx.lineBetween(cfx - cfw2, cfy + cfh2 - ca, cfx - cfw2, cfy + cfh2);
        cmdBracketGfx.lineBetween(cfx - cfw2, cfy + cfh2, cfx - cfw2 + ca, cfy + cfh2);
        cmdBracketGfx.lineBetween(cfx + cfw2 - ca, cfy + cfh2, cfx + cfw2, cfy + cfh2);
        cmdBracketGfx.lineBetween(cfx + cfw2, cfy + cfh2 - ca, cfx + cfw2, cfy + cfh2);

        // --- Scanline overlay ---
        const scanlines = this.scene.add.graphics();
        scanlines.lineStyle(1, 0x000000, 0.1);
        for (let sy = -hh; sy < hh; sy += 3) {
            scanlines.lineBetween(-hw, sy, hw, sy);
        }

        // --- Text ---
        const title = this.scene.add.text(-520, -284, `${this._machineName} // SOFTWARE DIAGNOSTIC`, {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#d8f0cc',
            letterSpacing: 3,
            wordWrap: { width: 900 },
        }).setOrigin(0, 0.5);
        const subtitle = this.scene.add.text(-520, -234, [
            debugPuzzle.description || 'Run the diagnostic command. If the output drifts, patch the machine and stabilize the test.',
            this._specialCommand?.hint || '',
        ].filter(Boolean).join('\n'), {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#5a8a50',
            wordWrap: { width: 840 },
            lineSpacing: 4,
        }).setOrigin(0, 0);

        const commandLabel = this.scene.add.text(-509, -155, 'COMMAND LINE', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#FFB000',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._modeText = this.scene.add.text(-119, -155, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#FFB000',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._statusText = this.scene.add.text(-509, -40, '', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#FFB000',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);

        this._specialCommandButtonBg = this.scene.add.rectangle(-146, -40, 176, 30, 0x1a2b18, 0.96)
            .setStrokeStyle(1, 0x4a7a38, 0.82)
            .setInteractive({ useHandCursor: true });
        this._specialCommandButtonText = this.scene.add.text(-146, -40, 'STEAL DATA', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#7acc5a',
            letterSpacing: 1,
        }).setOrigin(0.5);
        this._specialCommandButtonBg.on('pointerover', () => {
            this._specialCommandButtonBg?.setFillStyle(0x253d22, 0.98);
        });
        this._specialCommandButtonBg.on('pointerout', () => {
            this._specialCommandButtonBg?.setFillStyle(0x1a2b18, 0.96);
        });
        this._specialCommandButtonBg.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._toggleSpecialCommandMode();
        });

        this._commandZone = this.scene.add.rectangle(-231, -96, this._commandZoneWidth, this._commandZoneHeight, 0x030a05, 0.99)
            .setStrokeStyle(2, 0xFFB000, 0.48)
            .setInteractive({ useHandCursor: true });
        this._commandZone.on('pointerdown', (pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._focusHiddenInput();
            if (this.evidence.completed) return;
            const index = this._getCaretIndexFromPointer(pointer);
            this._selectionAnchor = index;
            this._selectionDrag = { pointerId: pointer.id };
            this._setSelectionRange(index, index);
        });

        // Amber block cursor with hard blink
        this._caret = this.scene.add.rectangle(0, this._commandTextY, 2, 30, 0xFFB000, 1).setOrigin(0, 0.5);
        this._caretTween = this.scene.tweens.add({
            targets: this._caret,
            alpha: 0,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Stepped',
        });

        const actualLabel = this.scene.add.text(115, -188, 'ACTUAL OUTPUT', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#4a7a58',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._actualOutputText = this.scene.add.text(115, -164, '', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#ffd6b0',
            wordWrap: { width: 320 },
            lineSpacing: 7,
        }).setOrigin(0, 0);

        const expectedLabel = this.scene.add.text(115, -28, 'EXPECTED OUTPUT', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#32CD32',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._expectedOutputText = this.scene.add.text(115, -8, '', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#32CD32',
            wordWrap: { width: 320 },
            lineSpacing: 7,
        }).setOrigin(0, 0);

        const detailLabel = this.scene.add.text(-488, 124, 'PATCH NOTES', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#4a7a38',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._instructionText = this.scene.add.text(-488, 150, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#5a8050',
            wordWrap: { width: 596 },
            lineSpacing: 5,
        }).setOrigin(0, 0);
        this._bugCounterText = this.scene.add.text(148, 126, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#FFB000',
            letterSpacing: 2,
        }).setOrigin(0, 0.5);
        this._messageText = this.scene.add.text(148, 152, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#4a7a58',
            wordWrap: { width: 332 },
            lineSpacing: 5,
        }).setOrigin(0, 0);

        // --- Mechanical close button ---
        const closeBaseY = 284;
        this._closeButtonBg = this.scene.add.rectangle(0, closeBaseY, 286, 44, 0x0c1e0c, 0.97)
            .setStrokeStyle(2, 0x3a6b28, 0.9)
            .setInteractive({ useHandCursor: true });
        this._closeButtonText = this.scene.add.text(0, closeBaseY, 'RETURN TO BOOTH [ESC]', {
            fontFamily: 'Courier New',
            fontSize: '15px',
            color: '#7acc5a',
            letterSpacing: 2,
        }).setOrigin(0.5);
        this._closeButtonBg.on('pointerover', () => {
            this._closeButtonBg?.setFillStyle(0x163a16, 0.99).setStrokeStyle(2, 0x7acc5a, 0.95);
            this._closeButtonText?.setColor('#b8ff94');
        });
        this._closeButtonBg.on('pointerout', () => {
            this._closeButtonBg?.setFillStyle(0x0c1e0c, 0.97).setStrokeStyle(2, 0x3a6b28, 0.9);
            this._closeButtonText?.setColor('#7acc5a');
            this.scene.tweens.add({
                targets: [this._closeButtonBg, this._closeButtonText],
                y: closeBaseY,
                duration: 80,
                ease: 'Cubic.Out',
            });
        });
        this._closeButtonBg.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this.scene.tweens.add({
                targets: [this._closeButtonBg, this._closeButtonText],
                y: closeBaseY + 3,
                duration: 45,
                ease: 'Cubic.Out',
                onComplete: () => this.close(),
            });
        });

        this._panel.add([
            outer,
            inner,
            headerRule,
            commandFrame,
            commandTopAccent,
            actualFrame,
            expectedFrame,
            detailFrame,
            cornerGfx,
            cmdBracketGfx,
            title,
            subtitle,
            commandLabel,
            this._modeText,
            this._statusText,
            this._specialCommandButtonBg,
            this._specialCommandButtonText,
            this._commandZone,
            this._caret,
            actualLabel,
            this._actualOutputText,
            expectedLabel,
            this._expectedOutputText,
            detailLabel,
            this._instructionText,
            this._bugCounterText,
            this._messageText,
            this._closeButtonBg,
            this._closeButtonText,
            scanlines,
        ]);

        this.container.add([this._blocker, this._panel]);

        const sample = this.scene.add.text(0, 0, 'W', {
            fontFamily: 'Courier New',
            fontSize: CHAR_FONT_SIZE,
            color: '#ffffff',
        }).setVisible(false);
        this._panel.add(sample);
        this._charWidth = Math.max(13, Math.ceil(sample.width));
        sample.destroy();

        this._escKey = this.scene.input.keyboard?.addKey('ESC');
        this._escHandler = () => { if (this.active) this.close(); };
        this._escKey?.on('down', this._escHandler);

        this._attachHiddenInput(this.evidence.inputValue || '');
        this._syncOutputPanels();
        this._syncCommandVisuals();
        if (this.evidence.resultType === 'spark-hazard') {
            this._spawnHazardBug();
        } else {
            this._startBugSpawner();
        }
        window.addEventListener('keydown', this._handleGlobalKeyDown, true);
        if (this.evidence.phase !== 'scrap') {
            this.scene.time.delayedCall(20, () => this._focusHiddenInput());
        }
    }

    _persistProgress() {
        if (!this._puzzle) return;

        this._puzzle.progress = {
            ...this.evidence,
            flags: Array.isArray(this.evidence.flags) ? [...this.evidence.flags] : [],
            symptoms: Array.isArray(this.evidence.symptoms) ? [...this.evidence.symptoms] : [],
        };
    }

    _teardown(destroying = false) {
        this._stopBugSpawner();
        this._destroyAllBugs();
        window.removeEventListener('keydown', this._handleGlobalKeyDown, true);
        this._detachHiddenInput(destroying);
        this._selectionDrag = null;
        this._selectionRects.forEach((rect) => rect.destroy());
        this._selectionRects = [];
        this._charObjects.forEach((charObject) => charObject.destroy());
        this._charObjects = [];
        this.scene.tweens.killTweensOf(this._caret);
        this._caretTween?.stop();
        this._caretTween = null;
        if (this._escKey && this._escHandler) {
            this._escKey.off('down', this._escHandler);
        }
        this._escKey = null;
        this._escHandler = null;
        this._puzzle = null;
        this._specialCommand = null;
        this._panel = null;
        this._blocker = null;
        this._closeButtonBg = null;
        this._closeButtonText = null;
        this._statusText = null;
        this._modeText = null;
        this._specialCommandButtonBg = null;
        this._specialCommandButtonText = null;
        this._instructionText = null;
        this._expectedOutputText = null;
        this._actualOutputText = null;
        this._bugCounterText = null;
        this._messageText = null;
        this._caret = null;
        this._commandZone = null;
        this._specialCommandMode = false;
    }

    _attachHiddenInput(initialValue) {
        if (typeof document === 'undefined') return;

        this._hiddenInput = document.createElement('input');
        this._hiddenInput.type = 'text';
        this._hiddenInput.id = 'debug-console-hidden-input';
        this._hiddenInput.name = 'debug-console-hidden-input';
        this._hiddenInput.value = String(initialValue || '');
        this._hiddenInput.autocapitalize = 'none';
        this._hiddenInput.autocomplete = 'off';
        this._hiddenInput.autocorrect = 'off';
        this._hiddenInput.spellcheck = false;
        this._hiddenInput.style.position = 'fixed';
        this._hiddenInput.style.left = '8px';
        this._hiddenInput.style.top = '8px';
        this._hiddenInput.style.width = '2px';
        this._hiddenInput.style.height = '2px';
        this._hiddenInput.style.opacity = '0.01';
        this._hiddenInput.style.pointerEvents = 'none';
        this._hiddenInput.style.zIndex = '9999';
        document.body.appendChild(this._hiddenInput);

        this._hiddenInput.addEventListener('input', this._handleHiddenInput);
        this._hiddenInput.addEventListener('select', this._handleHiddenSelection);
        this._hiddenInput.addEventListener('keyup', this._handleHiddenSelection);
        this._hiddenInput.addEventListener('keydown', this._handleHiddenKey);
        this._hiddenInput.addEventListener('blur', this._handleHiddenBlur);
        this._setSelectionRange(this._hiddenInput.value.length, this._hiddenInput.value.length);
    }

    _detachHiddenInput(destroying = false) {
        if (!this._hiddenInput) return;

        this._hiddenInput.removeEventListener('input', this._handleHiddenInput);
        this._hiddenInput.removeEventListener('select', this._handleHiddenSelection);
        this._hiddenInput.removeEventListener('keyup', this._handleHiddenSelection);
        this._hiddenInput.removeEventListener('keydown', this._handleHiddenKey);
        this._hiddenInput.removeEventListener('blur', this._handleHiddenBlur);
        this._hiddenInput.blur();
        this._hiddenInput.remove();
        this._hiddenInput = null;

        if (destroying && this._syncVisualFrame) {
            cancelAnimationFrame(this._syncVisualFrame);
            this._syncVisualFrame = null;
        }
    }

    _handleHiddenInput() {
        if (!this.active || !this._hiddenInput) return;
        if (this.evidence.phase === 'scrap') return;

        const previousValue = String(this.evidence.inputValue || '');
        const nextValue = this._hiddenInput.value;
        const previousMismatchCount = this._countMismatches(previousValue);
        const nextMismatchCount = this._countMismatches(nextValue);

        this.emitEvidence({ inputValue: nextValue });

        if (this._trySpecialCommand(nextValue)) {
            return;
        }

        if (nextMismatchCount > previousMismatchCount) {
            this._playWrongLetterSound();
        }

        this._queueVisualSync();

        if (!this.evidence.completed && this._hiddenInput.value === this._getActiveCommand()) {
            this._submitCurrentCommand();
        }
    }

    _handleHiddenSelection() {
        if (!this.active) return;
        this._queueVisualSync();
    }

    _handleHiddenKey() {
        if (!this.active) return;
        this._queueVisualSync();
    }

    _handleHiddenBlur() {
        if (!this.active || this.evidence.completed || this.evidence.phase === 'scrap') return;
        window.requestAnimationFrame(() => this._focusHiddenInput());
    }

    _handleGlobalKeyDown(event) {
        if (!this.active || this.evidence.completed || this.evidence.phase === 'scrap' || !this._hiddenInput) return;
        if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

        const key = event.key;
        const selectionStart = this._hiddenInput.selectionStart ?? this._hiddenInput.value.length;
        const selectionEnd = this._hiddenInput.selectionEnd ?? selectionStart;
        let nextValue = this._hiddenInput.value;
        let nextCursor = selectionStart;
        let handled = false;

        if (key === 'Backspace') {
            if (selectionStart === selectionEnd && selectionStart > 0) {
                nextValue = nextValue.slice(0, selectionStart - 1) + nextValue.slice(selectionEnd);
                nextCursor = selectionStart - 1;
            } else if (selectionStart !== selectionEnd) {
                nextValue = nextValue.slice(0, selectionStart) + nextValue.slice(selectionEnd);
                nextCursor = selectionStart;
            }
            handled = true;
        } else if (key === 'Delete') {
            if (selectionStart === selectionEnd && selectionStart < nextValue.length) {
                nextValue = nextValue.slice(0, selectionStart) + nextValue.slice(selectionEnd + 1);
            } else if (selectionStart !== selectionEnd) {
                nextValue = nextValue.slice(0, selectionStart) + nextValue.slice(selectionEnd);
            }
            handled = true;
        } else if (key === 'ArrowLeft') {
            this._setSelectionRange(Math.max(0, selectionStart - 1), Math.max(0, selectionStart - 1));
            handled = true;
        } else if (key === 'ArrowRight') {
            this._setSelectionRange(Math.min(nextValue.length, selectionStart + 1), Math.min(nextValue.length, selectionStart + 1));
            handled = true;
        } else if (key === 'Home') {
            this._setSelectionRange(0, 0);
            handled = true;
        } else if (key === 'End') {
            this._setSelectionRange(nextValue.length, nextValue.length);
            handled = true;
        } else if (key.length === 1) {
            nextValue = nextValue.slice(0, selectionStart) + key + nextValue.slice(selectionEnd);
            nextCursor = selectionStart + 1;
            handled = true;
        }

        if (!handled) return;

        event.preventDefault();
        event.stopPropagation();
        this._hiddenInput.value = nextValue;
        this._setSelectionRange(nextCursor, nextCursor);
        this._handleHiddenInput();
    }

    _focusHiddenInput() {
        if (!this._hiddenInput || this.evidence.completed || this.evidence.phase === 'scrap') return;
        this._hiddenInput.focus({ preventScroll: true });
    }

    _setSelectionRange(start, end) {
        if (!this._hiddenInput) return;

        const maxLength = Math.max(this._hiddenInput.value.length, this._getActiveCommand().length);
        const safeStart = clampIndex(start, 0, maxLength);
        const safeEnd = clampIndex(end, 0, maxLength);
        this._hiddenInput.setSelectionRange(safeStart, safeEnd);
        this.emitEvidence({ inputValue: this._hiddenInput.value });
        this._queueVisualSync();
    }

    _queueVisualSync() {
        if (this._syncVisualFrame || typeof window === 'undefined') return;

        this._syncVisualFrame = window.requestAnimationFrame(() => {
            this._syncVisualFrame = null;
            this._syncCommandVisuals();
        });
    }

    _countMismatches(value = '', command = this._getActiveCommand()) {
        const source = String(value || '');
        const target = String(command || '');
        let mismatchCount = 0;

        for (let index = 0; index < source.length; index += 1) {
            if (index >= target.length || source[index] !== target[index]) {
                mismatchCount += 1;
            }
        }

        return mismatchCount;
    }

    _hasStartedTyping() {
        const inputValue = this._hiddenInput?.value ?? this.evidence.inputValue ?? '';
        return String(inputValue || '').length > 0;
    }

    _getNowMs() {
        return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    }

    _playSynthSweep({ startFrequency = 320, endFrequency = 180, durationMs = 80, gain = 0.016, type = 'square' } = {}) {
        const audioContext = this.scene.sound?.context;
        if (!audioContext?.createOscillator) return;

        const now = audioContext.currentTime;
        const durationSeconds = Math.max(0.03, durationMs / 1000);
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(40, startFrequency), now);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, endFrequency), now + durationSeconds);

        gainNode.gain.setValueAtTime(0.0001, now);
        gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + durationSeconds + 0.02);
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }

    _playWrongLetterSound() {
        const nowMs = this._getNowMs();
        if ((nowMs - this._lastWrongLetterSoundAt) < 70) return;
        this._lastWrongLetterSoundAt = nowMs;
        this._playSynthSweep({ startFrequency: 290, endFrequency: 170, durationMs: 78, gain: 0.014, type: 'sawtooth' });
    }

    _playBugSkitterSound() {
        const nowMs = this._getNowMs();
        if ((nowMs - this._lastBugMoveSoundAt) < 180) return;
        this._lastBugMoveSoundAt = nowMs;
        const offset = Phaser.Math.Between(-30, 30);
        this._playSynthSweep({ startFrequency: 360 + offset, endFrequency: 250 + Math.floor(offset / 2), durationMs: 52, gain: 0.008, type: 'square' });
    }

    _playBugSquashSound() {
        const nowMs = this._getNowMs();
        if ((nowMs - this._lastSquashSoundAt) < 100) return;
        this._lastSquashSoundAt = nowMs;
        this._playSynthSweep({ startFrequency: 190, endFrequency: 62, durationMs: 126, gain: 0.028, type: 'triangle' });
    }

    _getPreferredBugTargetIndex() {
        const command = this._getActiveCommand();
        const inputValue = String(this._hiddenInput?.value || '');
        const correctIndices = [];
        const typedIndices = [];

        for (let index = 0; index < Math.min(inputValue.length, command.length); index += 1) {
            if (inputValue[index] === command[index]) {
                correctIndices.push(index);
            } else {
                typedIndices.push(index);
            }
        }

        const candidatePool = correctIndices.length > 0 ? correctIndices : typedIndices;
        if (candidatePool.length > 0) {
            return candidatePool[Phaser.Math.Between(0, candidatePool.length - 1)];
        }

        const caretIndex = this._hiddenInput?.selectionStart ?? inputValue.length;
        return clampIndex(caretIndex, 0, Math.max(0, command.length - 1));
    }

    _canUseSpecialCommand() {
        return Boolean(
            this._specialCommand?.command
            && !this.evidence.completed
            && this.evidence.phase !== 'repair'
            && this.evidence.phase !== 'scrap'
        );
    }

    _toggleSpecialCommandMode(forceValue = null) {
        if (!this._specialCommand?.command) return;

        const nextMode = typeof forceValue === 'boolean' ? forceValue : !this._specialCommandMode;
        this._specialCommandMode = this._canUseSpecialCommand() ? nextMode : false;

        if (this._hiddenInput) {
            this._hiddenInput.value = '';
            this._setSelectionRange(0, 0);
        }
        this.emitEvidence({ inputValue: '' });
        this._syncOutputPanels();
        this._syncCommandVisuals();
        this._focusHiddenInput();
    }

    _getActiveCommand() {
        if (this._specialCommandMode && this._canUseSpecialCommand()) {
            return String(this._specialCommand?.command || '');
        }
        if (this.evidence.phase === 'repair') return String(this.evidence.repairPrompt || '');
        return String(this.evidence.prompt || '');
    }

    _ensureCharObjects(total) {
        while (this._charObjects.length < total) {
            const text = this.scene.add.text(0, 0, '', {
                fontFamily: 'Courier New',
                fontSize: CHAR_FONT_SIZE,
                color: '#ffffff',
            }).setOrigin(0, 0.5);
            this._charObjects.push(text);
            this._panel?.add(text);
        }

        this._charObjects.forEach((charObject, index) => charObject.setVisible(index < total));
    }

    _ensureSelectionRects(total) {
        while (this._selectionRects.length < total) {
            const rect = this.scene.add.rectangle(0, this._commandTextY, this._charWidth - 2, 32, 0x8bc1d1, 0.22)
                .setOrigin(0, 0.5)
                .setVisible(false);
            this._selectionRects.push(rect);
            this._panel?.add(rect);
            this._panel?.bringToTop(this._caret);
        }
    }

    _syncCommandVisuals() {
        if (!this._panel) return;

        const command = this._getActiveCommand();
        const inputValue = this._hiddenInput?.value ?? String(this.evidence.inputValue || '');
        const totalSlots = Math.max(command.length, inputValue.length, 1);
        const selectionStart = this._hiddenInput?.selectionStart ?? inputValue.length;
        const selectionEnd = this._hiddenInput?.selectionEnd ?? inputValue.length;

        this._ensureCharObjects(totalSlots);
        this._ensureSelectionRects(totalSlots);

        for (let index = 0; index < totalSlots; index += 1) {
            const expectedCharacter = command[index] ?? '';
            const typedCharacter = inputValue[index];
            const extraCharacter = index >= command.length;
            const x = this._commandTextStartX + (index * this._charWidth);
            const charObject = this._charObjects[index];

            let text = displayChar(expectedCharacter || ' ');
            let color = '#6e7b84';
            let alpha = 0.5;

            if (typedCharacter !== undefined) {
                text = displayChar(typedCharacter);
                alpha = 1;
                if (extraCharacter) {
                    color = '#8f2f2f';
                } else if (typedCharacter === expectedCharacter) {
                    color = '#d8f7dd';
                } else {
                    color = '#ff7979';
                }
            } else if (expectedCharacter === ' ') {
                alpha = 0.2;
            }

            charObject
                .setPosition(x, this._commandTextY)
                .setText(text)
                .setColor(color)
                .setAlpha(alpha);
        }

        const selectedCount = Math.max(0, selectionEnd - selectionStart);
        this._selectionRects.forEach((rect, index) => {
            const inSelection = index >= selectionStart && index < selectionEnd;
            rect
                .setPosition(this._commandTextStartX + (index * this._charWidth), this._commandTextY)
                .setVisible(inSelection && selectedCount > 0);
        });

        this._caret.setVisible(selectedCount === 0 && !this.evidence.completed);
        this._caret.setPosition(this._commandTextStartX + (selectionEnd * this._charWidth), this._commandTextY);
        this._panel.bringToTop(this._caret);

        this._modeText?.setText(
            this._specialCommandMode && this._canUseSpecialCommand()
                ? 'STEAL MODE'
                : this.evidence.phase === 'repair'
                ? 'REPAIR MODE'
                : (this.evidence.phase === 'scrap'
                    ? 'SCRAP SIGNAL'
                    : (this.evidence.completed ? 'TEST COMPLETE' : 'TEST MODE'))
        );
        this._syncOutputPanels();
    }

    _syncOutputPanels() {
        if (!this._statusText) return;

        if (!this._canUseSpecialCommand()) {
            this._specialCommandMode = false;
        }

        const hasTypedInput = this._hasStartedTyping();
        const showActualOutput = this.evidence.completed || this.evidence.phase === 'repair' || this.evidence.phase === 'scrap' || hasTypedInput;
        const outputMismatch = Boolean(
            showActualOutput
            && this.evidence.actualOutput
            && this.evidence.actualOutput !== this.evidence.expectedOutput
            && !this.evidence.completed
            && this.evidence.phase !== 'scrap'
        );

        this._expectedOutputText?.setText(this.evidence.expectedOutput || 'NO EXPECTED OUTPUT');
        this._actualOutputText?.setText(showActualOutput ? (this.evidence.actualOutput || '') : '');
        this._expectedOutputText?.setColor('#32CD32');
        this._actualOutputText?.setColor(
            this.evidence.completed
                ? '#7aff8a'
                : (this.evidence.phase === 'scrap'
                    ? '#ff7a5a'
                    : (outputMismatch ? '#ff5f5f' : '#ffd6b0'))
        );

        let statusColor = '#FFB000';
        let detailText = 'Type the highlighted command exactly. Correct letters stay cool, wrong letters go red, and overflow letters go dark red. Bugs try to ruin letters you already locked in.';
        let message = 'Tap the console to focus. Start typing to surface the live output.';

        if (this.evidence.completed) {
            statusColor = '#32CD32';
            detailText = this.evidence.fixed
                ? ['Patch command applied.', 'AUTO RETEST PASS.', '', 'Repair prompt:', this.evidence.repairPrompt].join('\n')
                : ['Primary test passed.', 'No patch required.', '', 'Prompt:', this.evidence.prompt].join('\n');
            message = this.evidence.fixed
                ? 'System stabilized. Return to the booth when you are ready.'
                : 'Diagnostic clean. Return to the booth when you are ready.';
        } else if (this.evidence.phase === 'scrap' || this.evidence.scrapRequired) {
            statusColor = this.evidence.scrapKind === 'hazard'
                ? '#ff8f84'
                : (this.evidence.scrapKind === 'compliance' ? '#ffd98e' : '#ffb39b');
            detailText = [
                this.evidence.scrapStatus || 'SCRAP REQUIRED',
                this.evidence.scrapReason || 'Subsystem fault is outside floor repair policy.',
                '',
                'Prompt:',
                this.evidence.prompt || 'NO COMMAND AVAILABLE',
            ].join('\n');
            message = this.evidence.actualOutput
                ? ['This subsystem is not repairable on the floor.', `Observed output: ${this.evidence.actualOutput}`, 'Return to the booth and file SCRAP.'].join('\n')
                : 'This subsystem is not repairable on the floor. Return to the booth and file SCRAP.';
        } else if (this.evidence.phase === 'repair') {
            statusColor = '#FFB000';
            detailText = ['Mismatch detected.', 'Type the repair command exactly.', '', 'Repair prompt:', this.evidence.repairPrompt].join('\n');
            message = ['Actual output drifted away from the expected result.', `Unexpected output: ${this.evidence.actualOutput}`].join('\n');
        } else {
            statusColor = '#FFB000';
            detailText = this._specialCommandMode && this._canUseSpecialCommand()
                ? ['Special command armed.', 'Type the theft command exactly.', '', 'Command:', this._specialCommand.command].join('\n')
                : ['Prompt:', this.evidence.prompt, '', 'Expected output:', this.evidence.expectedOutput].join('\n');
            message = this._specialCommandMode && this._canUseSpecialCommand()
                ? 'Type steal data exactly to yank the file instead of running the normal test.'
                : (hasTypedInput
                    ? 'Keep typing. The command runs the moment the full line matches.'
                    : 'The live output stays blank until you begin typing.');
            if (!this._specialCommandMode && this._canUseSpecialCommand()) {
                message += '\nPress STEAL DATA if you want to swap the command line.';
            }
        }

        this._statusText.setText(this.evidence.lastStatus || 'TEST READY').setColor(statusColor);
        this._instructionText?.setText(detailText);
        this._messageText?.setText(message);
        this._bugCounterText?.setText(`BUGS SQUASHED ${this.evidence.bugsSquashed || 0}  //  CORRUPTIONS ${this.evidence.corruptionCount || 0}`);
        this._closeButtonText?.setText((this.evidence.completed || this.evidence.phase === 'scrap') ? 'RETURN TO BOOTH [ESC]' : 'CLOSE PANEL [ESC]');
        this._specialCommandButtonBg?.setVisible(Boolean(this._specialCommand?.command));
        this._specialCommandButtonText?.setVisible(Boolean(this._specialCommand?.command));
        if (this._specialCommandButtonBg && this._specialCommandButtonText) {
            const buttonEnabled = this._canUseSpecialCommand();
            if (buttonEnabled) {
                this._specialCommandButtonBg.setInteractive({ useHandCursor: true });
            } else if (this._specialCommandButtonBg.input) {
                this._specialCommandButtonBg.disableInteractive();
            }
            this._specialCommandButtonBg
                .setVisible(buttonEnabled)
                .setFillStyle(this._specialCommandMode ? 0x3f2b50 : 0x24323e, this._specialCommandMode ? 0.98 : 0.96)
                .setStrokeStyle(1, this._specialCommandMode ? 0xd49cff : 0x7ca2b3, buttonEnabled ? 0.9 : 0);
            this._specialCommandButtonText
                .setVisible(buttonEnabled)
                .setText(this._specialCommandMode ? 'RUN TEST' : 'STEAL DATA')
                .setColor(this._specialCommandMode ? '#f1d5ff' : '#d6f6ff');
        }
    }

    _trySpecialCommand(inputValue) {
        const command = String(this._specialCommand?.command || '');
        if (!command || inputValue !== command) return false;
        if (this.evidence.completed || this.evidence.phase === 'scrap') return false;

        const result = this._specialCommand.onTrigger?.({
            evidence: {
                ...this.evidence,
                inputValue,
            },
            debugPuzzle: this._puzzle,
        });
        if (!result) return false;

        const nextEvidence = result.evidence || {
            ...this.evidence,
            inputValue: '',
        };
        this.emitEvidence(nextEvidence);

        if (this._hiddenInput) {
            this._hiddenInput.value = String(nextEvidence.inputValue || '');
            const caretIndex = this._hiddenInput.value.length;
            this._setSelectionRange(caretIndex, caretIndex);
        }

        if (nextEvidence.completed || nextEvidence.phase === 'scrap') {
            this._stopBugSpawner();
            this._destroyAllBugs();
        }

        this._syncCommandVisuals();

        if (result.closeAfter) {
            this.close();
        } else if (nextEvidence.phase !== 'scrap') {
            this._focusHiddenInput();
        }

        return true;
    }

    _submitCurrentCommand() {
        if (!this._hiddenInput || this.evidence.completed || this.evidence.phase === 'scrap') return;

        const activeCommand = this._getActiveCommand();
        if (this._hiddenInput.value !== activeCommand) return;

        if (this.evidence.phase === 'repair') {
            this._completeRepair();
            return;
        }

        this._runTestCommand();
    }

    _runTestCommand() {
        const matched = this.evidence.actualOutput === this.evidence.expectedOutput;

        if (matched) {
            this.emitEvidence({
                completed: true,
                phase: 'complete',
                fixed: false,
                repairRequired: false,
                outputMatched: true,
                inputValue: '',
                lastStatus: 'TEST PASS // OUTPUT CLEAN',
                flags: [],
                symptoms: ['Diagnostic output matches the expected result.'],
            });
            this._hiddenInput.value = '';
            this._playPuzzleFixed();
            this._stopBugSpawner();
            this._autoSquashAllBugs();
        } else if (this.evidence.resultType === 'protocol-invalid') {
            this.emitEvidence({
                completed: false,
                phase: 'scrap',
                reviewed: true,
                repairRequired: false,
                scrapRequired: true,
                outputMatched: false,
                inputValue: '',
                lastStatus: 'PROTOCOL INVALID // SCRAP UNIT',
                flags: ['protocol-invalid'],
                symptoms: [`Protocol-invalid output: ${this.evidence.actualOutput}`],
                scrapKind: this.evidence.scrapKind || 'compliance',
                scrapStatus: this.evidence.scrapStatus || 'PROTOCOL INVALID',
                scrapReason: this.evidence.scrapReason || 'Output format is compromised. Floor repair is forbidden.',
            });
            this._hiddenInput.value = '';
            this._stopBugSpawner();
            this._destroyAllBugs();
        } else {
            this.emitEvidence({
                completed: false,
                phase: 'repair',
                repairRequired: true,
                outputMatched: false,
                inputValue: '',
                lastStatus: 'PATCH REQUIRED // OUTPUT DRIFT',
                flags: ['patch-required'],
                symptoms: [`Unexpected output: ${this.evidence.actualOutput}`],
            });
            this._hiddenInput.value = '';
        }

        if (this.evidence.phase !== 'scrap') {
            this._focusHiddenInput();
        }
        this._syncCommandVisuals();
    }

    _completeRepair() {
        this.emitEvidence({
            completed: true,
            phase: 'complete',
            fixed: true,
            repairRequired: false,
            scrapRequired: false,
            outputMatched: true,
            actualOutput: this.evidence.expectedOutput,
            inputValue: '',
            lastStatus: 'PATCH APPLIED // AUTO RETEST PASS',
            flags: [],
            symptoms: ['Patch applied. Diagnostic output stabilized.'],
        });
        if (this._hiddenInput) {
            this._hiddenInput.value = '';
        }
        this._playPuzzleFixed();
        this._stopBugSpawner();
        this._autoSquashAllBugs();
        this._syncCommandVisuals();
    }

    _playPuzzleFixed() {
        if (!this.scene.cache.audio.has(SOUND_ASSETS.puzzleFixed.key)) return;
        this.scene.sound.play(SOUND_ASSETS.puzzleFixed.key, { volume: SOUND_VOLUMES.puzzleFixed });
    }

    _spawnHazardBug() {
        if (!this._panel || this._bugViews.some((bugView) => bugView.hazard)) return;

        const targetIndex = Math.max(0, Math.floor(Math.max(1, this._getActiveCommand().length - 1) / 2));
        const targetX = this._commandTextStartX + (targetIndex * this._charWidth) + (this._charWidth / 2);
        const targetY = this._commandTextY - 8;
        const sparks = this.scene.add.graphics();
        sparks.lineStyle(2, 0xff5f5f, 0.92);
        sparks.lineBetween(-22, -18, -34, -30);
        sparks.lineBetween(-2, -28, 0, -42);
        sparks.lineBetween(16, -12, 28, -24);
        sparks.lineBetween(-20, 10, -32, 18);
        sparks.lineBetween(18, 12, 30, 24);
        const body = this.scene.add.circle(0, 0, 11, 0x48d86f, 1).setStrokeStyle(1, 0x12391d, 0.95);
        const head = this.scene.add.circle(10, -8, 6, 0x8eff95, 1).setStrokeStyle(1, 0x12391d, 0.95);
        const eye = this.scene.add.circle(12, -10, 1.8, 0x7b0000, 1);
        const legs = this.scene.add.text(-10, 13, '╲╱╲╱', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#a8ffb3',
        }).setOrigin(0, 0.5);
        const bug = this.scene.add.container(targetX - 136, targetY - 64, [sparks, body, head, eye, legs]).setSize(36, 36);
        this._panel.add(bug);

        let bugView = null;
        const arrivalTween = this.scene.tweens.add({
            targets: bug,
            x: targetX,
            y: targetY,
            duration: 760,
            ease: 'Sine.Out',
        });
        const jitterTween = this.scene.tweens.add({
            targets: bug,
            x: '+=6',
            y: '+=4',
            angle: { from: -7, to: 7 },
            duration: 110,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const sparkTween = this.scene.tweens.add({
            targets: sparks,
            alpha: { from: 0.35, to: 1 },
            duration: 90,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const soundEvent = this.scene.time.addEvent({
            delay: 680,
            loop: true,
            callback: () => {
                if (!bugView || !this._bugViews.includes(bugView)) return;
                this._playBugSkitterSound();
            },
        });

        bugView = { bug, hazard: true, arrivalTween, jitterTween, sparkTween, soundEvent };
        this._bugViews.push(bugView);
        this._playBugSkitterSound();
    }

    _startBugSpawner() {
        if (!this.evidence.bugsEnabled || this.evidence.phase === 'scrap') return;
        this._stopBugSpawner();
        this._bugSpawnEvent = this.scene.time.addEvent({
            delay: BUG_SPAWN_DELAY_MS,
            loop: true,
            callback: () => {
                if (!this.active || this.evidence.completed) return;
                this._spawnBug();
            },
        });
    }

    _stopBugSpawner() {
        this._bugSpawnEvent?.remove(false);
        this._bugSpawnEvent = null;
    }

    _spawnBug() {
        if (!this._panel) return;

        const targetIndex = this._getPreferredBugTargetIndex();
        const targetX = this._commandTextStartX + (targetIndex * this._charWidth) + (this._charWidth / 2);
        const targetY = this._commandTextY;
        const edge = Phaser.Math.Between(0, 3);
        const startX = edge === 0 ? -520 : edge === 1 ? 520 : Phaser.Math.Between(-520, 520);
        const startY = edge === 2 ? -250 : edge === 3 ? 250 : Phaser.Math.Between(-250, 250);
        const body = this.scene.add.circle(0, 0, 10, 0xd88b2f, 1).setStrokeStyle(1, 0x3d1700, 0.95);
        const head = this.scene.add.circle(10, -8, 6, 0xf2b14f, 1).setStrokeStyle(1, 0x3d1700, 0.95);
        const eye = this.scene.add.circle(12, -10, 1.5, 0x2b0000, 1);
        const legs = this.scene.add.text(-10, 13, '╲╱╲╱', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#7f3e15',
        }).setOrigin(0, 0.5);
        const splat = this.scene.add.ellipse(0, 8, 24, 8, 0x8b3e17, 0.84).setVisible(false);
        const bug = this.scene.add.container(startX, startY, [splat, body, head, eye, legs]).setSize(28, 28);
        const hitZone = this.scene.add.rectangle(0, 0, 32, 32, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        bug.add(hitZone);
        this._panel.add(bug);

        let bugView = null;
        const crawlTween = this.scene.tweens.add({
            targets: bug,
            angle: { from: -4, to: 4 },
            duration: 240,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const legTween = this.scene.tweens.add({
            targets: legs,
            y: 15,
            duration: 180,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const bobTween = this.scene.tweens.add({
            targets: [body, head, eye],
            y: '+=1.5',
            duration: 200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const tween = this.scene.tweens.add({
            targets: bug,
            x: targetX,
            y: targetY,
            duration: Phaser.Math.Between(BUG_TRAVEL_MIN_MS, BUG_TRAVEL_MAX_MS),
            ease: 'Linear',
            onComplete: () => this._handleBugImpact(bugView),
        });
        const soundEvent = this.scene.time.addEvent({
            delay: 980,
            loop: true,
            callback: () => {
                if (!bugView || !this._bugViews.includes(bugView)) return;
                this._playBugSkitterSound();
            },
        });

        bugView = { bug, tween, hitZone, targetIndex, body, head, eye, legs, splat, crawlTween, legTween, bobTween, soundEvent };
        this._bugViews.push(bugView);
        this._playBugSkitterSound();
        hitZone.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._squashBug(bugView);
        });
    }

    _squashBug(bugView) {
        if (!bugView || !this._bugViews.includes(bugView)) return;

        bugView.tween?.stop();
        bugView.soundEvent?.remove(false);
        bugView.crawlTween?.stop();
        bugView.legTween?.stop();
        bugView.bobTween?.stop();
        this.emitEvidence({ bugsSquashed: (this.evidence.bugsSquashed || 0) + 1 });
        this._playBugSquashSound();
        bugView.splat?.setVisible(true).setScale(0.7, 0.4).setAlpha(0.72);
        this.scene.tweens.add({
            targets: bugView.splat,
            scaleX: 1.22,
            scaleY: 1,
            alpha: 0.92,
            duration: 90,
            ease: 'Cubic.Out',
        });
        this.scene.tweens.add({
            targets: [bugView.body, bugView.head],
            y: 7,
            scaleX: 1.65,
            scaleY: 0.24,
            alpha: 0.88,
            duration: 120,
            ease: 'Cubic.Out',
        });
        this.scene.tweens.add({
            targets: [bugView.eye, bugView.legs],
            alpha: 0,
            duration: 90,
            ease: 'Quad.Out',
        });
        this.scene.tweens.add({
            targets: bugView.bug,
            alpha: 0,
            delay: 140,
            duration: 120,
            ease: 'Quad.Out',
            onComplete: () => this._destroyBug(bugView),
        });
        this._syncOutputPanels();
    }

    _handleBugImpact(bugView) {
        if (!bugView || !this._bugViews.includes(bugView) || this.evidence.completed || this.evidence.phase === 'scrap') return;

        bugView.soundEvent?.remove(false);
        bugView.crawlTween?.stop();
        bugView.legTween?.stop();
        bugView.bobTween?.stop();
        this._corruptInputAt(bugView.targetIndex);
        this.scene.tweens.add({
            targets: bugView.bug,
            scaleX: 0.18,
            scaleY: 0.18,
            alpha: 0,
            duration: 140,
            ease: 'Cubic.In',
            onComplete: () => this._destroyBug(bugView),
        });
    }

    _destroyBug(bugView) {
        const index = this._bugViews.indexOf(bugView);
        if (index >= 0) this._bugViews.splice(index, 1);
        bugView?.tween?.stop();
        bugView?.arrivalTween?.stop();
        bugView?.soundEvent?.remove(false);
        bugView?.crawlTween?.stop();
        bugView?.legTween?.stop();
        bugView?.bobTween?.stop();
        bugView?.jitterTween?.stop();
        bugView?.sparkTween?.stop();
        bugView?.bug?.destroy();
    }

    _destroyAllBugs() {
        while (this._bugViews.length > 0) {
            this._destroyBug(this._bugViews[0]);
        }
    }

    _autoSquashAllBugs() {
        if (!this._bugViews.length) return;

        const bugViews = [...this._bugViews];
        bugViews.forEach((bugView, index) => {
            this.scene.time.delayedCall(index * 55, () => {
                if (!bugView || !this._bugViews.includes(bugView)) return;
                if (bugView.hazard) {
                    this._destroyBug(bugView);
                    return;
                }
                this._squashBug(bugView);
            });
        });
    }

    _corruptInputAt(index) {
        if (!this._hiddenInput || this.evidence.completed || this.evidence.phase === 'scrap') return;

        const currentValue = this._hiddenInput.value;
        const command = this._getActiveCommand();
        const characterIndex = clampIndex(index, 0, Math.max(currentValue.length, command.length));
        const corruptCharacter = getCorruptCharacter(command[characterIndex] || currentValue[characterIndex] || '');

        let nextValue = currentValue;
        if (characterIndex < currentValue.length) {
            nextValue = `${currentValue.slice(0, characterIndex)}${corruptCharacter}${currentValue.slice(characterIndex + 1)}`;
        } else {
            nextValue = `${currentValue}${corruptCharacter}`;
        }

        this._hiddenInput.value = nextValue;
        this._hiddenInput.setSelectionRange(nextValue.length, nextValue.length);
        this.emitEvidence({
            inputValue: nextValue,
            corruptionCount: (this.evidence.corruptionCount || 0) + 1,
        });

        this._statusText?.setText('BUG IMPACT // CORRUPTION WRITTEN').setColor('#ff7e7e');
        this._syncCommandVisuals();
        this._focusHiddenInput();
    }

    _getCaretIndexFromPointer(pointer) {
        const localX = pointer.x - this._panel.x - this._commandTextStartX;
        const maxIndex = Math.max(this._getActiveCommand().length, this._hiddenInput?.value.length || 0);
        return clampIndex(Math.round(localX / this._charWidth), 0, maxIndex);
    }

    _handlePointerMove(pointer) {
        if (!this.active || !this._selectionDrag || !this._hiddenInput) return;
        if (pointer.id !== this._selectionDrag.pointerId) return;

        const nextIndex = this._getCaretIndexFromPointer(pointer);
        const start = Math.min(this._selectionAnchor, nextIndex);
        const end = Math.max(this._selectionAnchor, nextIndex);
        this._setSelectionRange(start, end);
    }

    _handlePointerUp(pointer) {
        if (!this.active || !this._selectionDrag) return;
        if (pointer.id !== this._selectionDrag.pointerId) return;
        this._selectionDrag = null;
    }
}
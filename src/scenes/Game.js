import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import RulebookOverlay from '../systems/RulebookOverlay.js';
import Animations from '../fx/Animations.js';
import { applyCyberpunkLook, glitchBurst } from '../fx/applyCyberpunkLook.js';
import StateMachine from '../core/StateMachine.js';
import ChassisBay from '../ui/ChassisBay.js';
import StampPress from '../ui/StampPress.js';
import CircuitRouting from '../systems/minigames/CircuitRouting.js';

const SHIFT_MS       = { 1: 180000, 2: 135000, 3: 90000 };
const PAYCHECK_DELTA = 0.00000003;

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        const { period, day } = GameState;

        // ── Data ──────────────────────────────────────────────────────────────
        const allCases   = this.cache.json.get('cases');
        const allRules   = this.cache.json.get('rules');
        const schedule   = this.cache.json.get('schedule');
        const schedEntry = schedule.find(s => s.period === period && s.day === day);
        const baseIds    = schedEntry ? schedEntry.caseIds : [];

        this._baseQueue     = baseIds.map(id => allCases.find(c => c.id === id)).filter(Boolean);
        this._queue         = [...this._baseQueue];
        this._queueIndex    = 0;
        this._currentCase   = null;
        this._actionLocked  = false;
        this._shiftMistakes = 0;
        this._paycheckDelta = 0;
        this._logLines      = [];

        // ── Per-case state machine ────────────────────────────────────────────
        // intake → diagnose → verdict → transition
        this._caseSM = new StateMachine('intake');

        // ── Cyberpunk look ────────────────────────────────────────────────────
        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        // ── Build UI ──────────────────────────────────────────────────────────
        this._buildHUD();
        this._buildConveyorScreen();
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
        this._startMusic();
        this.cameras.main.fadeIn(400, 0, 0, 0);
        this.time.delayedCall(500, () => {
            this._shiftRunning = true;
            this._loadNextCase();
        });
    }

    // ── Update loop ───────────────────────────────────────────────────────────

    update(_time, delta) {
        if (!this._shiftRunning) return;

        this._elapsed = Math.min(this._elapsed + delta, this._shiftDuration);
        const ratio = 1 - (this._elapsed / this._shiftDuration);

        this._drawTimerBar(ratio);
        this._checkMusicPhase(ratio);

        if (this._elapsed >= this._shiftDuration) {
            this._shiftRunning = false;
            this._endShift(false);
        }
    }

    // ── HUD (always visible) ──────────────────────────────────────────────────

    _buildHUD() {
        this._hudContainer = this.add.container(0, 0).setDepth(200);

        const bar = this.add.rectangle(640, 25, 1280, 50, 0x050505, 0.9);
        this._hudContainer.add(bar);

        this._hudPeriodText = this.add.text(12, 14,
            `PERIOD ${GameState.period}  |  DAY ${GameState.day}`, {
            fontFamily: 'Courier New', fontSize: '11px', color: '#cccccc',
        });
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

        this._timerBarGfx = this.add.graphics();
        this._hudContainer.add(this._timerBarGfx);
        this._drawTimerBar(1);
    }

    _drawTimerBar(ratio) {
        if (!this._timerBarGfx) return;
        const w     = Math.max(0, 1280 * ratio);
        const color = ratio > 0.6 ? 0x00cc44 : ratio > 0.25 ? 0xffaa00 : 0xff3300;
        this._timerBarGfx.clear();
        this._timerBarGfx.fillStyle(color, 0.9);
        this._timerBarGfx.fillRect(1280 - w, 0, w, 4);
    }

    // ── Conveyor screen ───────────────────────────────────────────────────────

    _buildConveyorScreen() {
        this._conveyorContainer = this.add.container(0, 0).setDepth(10);

        const bgKey = this.textures.exists('bg_mainview') ? 'bg_mainview' : `bg_p${GameState.period}`;
        const bg = this.add.image(640, 360, bgKey).setDisplaySize(1280, 720);
        this._conveyorContainer.add(bg);

        this._monitorText = this.add.text(130, 375,
            'AWAITING UNIT\n\nSTATUS: READY', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#301934',
            align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        this._conveyorContainer.add(this._monitorText);

        this._unitContainer  = this.add.container(1400, 420).setDepth(15);
        const unitSpr        = this.add.image(0, 0, 'unit_placeholder').setScale(1.0);
        this._unitNameText   = this.add.text(0, 115, '', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#ccddee',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitIdText = this.add.text(0, 133, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#778899',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitContainer.add([unitSpr, this._unitNameText, this._unitIdText]);

        unitSpr.setInteractive({ useHandCursor: true });
        unitSpr.on('pointerover', () => unitSpr.setTint(0xaabbdd));
        unitSpr.on('pointerout',  () => unitSpr.clearTint());
        unitSpr.on('pointerdown', () => {
            if (this._screen !== 'conveyor' || this._actionLocked) return;
            if (!this._currentCase) return;
            this._setScreen('inspection');
            this._caseSM.transition('diagnose');
        });
    }

    // ── Inspection screen ─────────────────────────────────────────────────────

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
        this._inspectionContainer.add(logBg);

        const logHeader = this.add.text(LOG_X + 8, LOG_Y + 4, 'INSPECTION LOG', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#44aaaa', letterSpacing: 2,
        });
        this._inspectionContainer.add(logHeader);

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

        this.input.on('wheel', (ptr, _objs, _dx, dy) => {
            if (this._screen !== 'inspection') return;
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
        const rbTxt = this.add.text(1180, 570, '[B] RULEBOOK', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#00dddd',
        }).setOrigin(0.5);
        rbBg.on('pointerover', () => rbBg.setFillStyle(0x00aaaa, 0.22));
        rbBg.on('pointerout',  () => rbBg.setFillStyle(0x001a1a, 0.8));
        rbBg.on('pointerdown', () => {
            if (this._screen !== 'inspection') return;
            Animations.buttonPunch(this, rbBg);
            this._rulebook.toggle();
        });
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

        // Feedback text
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
        this._unitContainer.setVisible(name === 'conveyor');
        this._inspectionContainer.setVisible(name === 'inspection');
    }

    // ── Panel / minigame handling ─────────────────────────────────────────────

    _onPanelOpened({ panel, label, findings }) {
        if (!findings.length) return;
        this._appendLog(`[${panel}] ${label}:`);
        findings.forEach(f => this._appendLog(`  ${f}`));
        if (this.cache.audio.has('sfx_reveal')) this.sound.play('sfx_reveal', { volume: 0.7 });
    }

    _launchDiagnostic(caseData) {
        if (!caseData.circuit) return;
        this._minigame.show(caseData);
    }

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

    // ── Ruling logic ──────────────────────────────────────────────────────────

    _submitRuling(action) {
        if (this._actionLocked) return;
        this._actionLocked = true;
        this._caseSM.transition('verdict');

        const correct = action === this._currentCase.correctAction;

        if (correct) {
            GameState.paycheckTotal += PAYCHECK_DELTA;
            this._paycheckDelta += PAYCHECK_DELTA;
            GameState.casesProcessedThisShift++;
            this._hudCasesText.setText(`CASES: ${GameState.casesProcessedThisShift}`);
            this._hudPayText.setText(this._fmtPay());
            this.cameras.main.flash(180, 0, 40, 0, false);
            const sfxKey = `sfx_${action}`;
            if (this.cache.audio.has(sfxKey)) this.sound.play(sfxKey, { volume: 0.8 });
            this._showFeedback('CORRECT — PROCEEDING', '#00cc66');
        } else {
            GameState.paycheckTotal -= PAYCHECK_DELTA;
            this._paycheckDelta -= PAYCHECK_DELTA;
            GameState.totalMistakes++;
            this._shiftMistakes++;
            this._hudPayText.setText(this._fmtPay());
            this._hudViolText.setText(`Violations: ${this._shiftMistakes}`);
            this.cameras.main.flash(260, 50, 0, 0, false);
            this.cameras.main.shake(300, 0.01);
            if (this.cache.audio.has('sfx_error')) this.sound.play('sfx_error', { volume: 0.8 });
            glitchBurst(this, this._cmFilter, 420);
            this._showFeedback(this._currentCase.incorrectFeedback, '#ff4444');
        }

        this.time.delayedCall(1600, () => this._advanceCase());
    }

    _showFeedback(msg, color) {
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText, alpha: 0, delay: 1200, duration: 400,
        });
    }

    // ── Case management ───────────────────────────────────────────────────────

    _loadNextCase() {
        if (!this._shiftRunning) return;

        this._currentCase = this._queue[this._queueIndex];
        if (!this._currentCase) return;

        this._caseSM.transition('intake');

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

        this.tweens.add({
            targets: this._unitContainer, x: 760, duration: 800, ease: 'Cubic.Out',
        });
    }

    _advanceCase() {
        const justProcessed = this._currentCase;

        this._logLines = [];
        this._logHistory = [];
        this._logScrollIdx = 0;
        this._logSlots.forEach(s => s.setText('').setVisible(false));
        this._actionLocked = false;
        this._diagnosticDone = false;

        this._setScreen('conveyor');
        this.tweens.add({
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

        this.time.delayedCall(700, () => this._loadNextCase());
    }

    // ── Shift end ─────────────────────────────────────────────────────────────

    _endShift(fromFinalCase) {
        if (this._currentMusic) {
            this.tweens.add({
                targets: this._currentMusic, volume: 0, duration: 600,
                onComplete: () => this._currentMusic?.stop(),
            });
        }

        const notifications = this.cache.json.get('notifications');
        const { period, day } = GameState;
        const notif = notifications.find(n => n.period === period && n.day === day);

        this.time.delayedCall(700, () => {
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => {
                if (fromFinalCase && GameState.isLastDay()) {
                    this.scene.start('End');
                } else {
                    this.scene.start('Summary', {
                        mistakes:         this._shiftMistakes,
                        paycheckDelta:    this._paycheckDelta,
                        casesProcessed:   GameState.casesProcessedThisShift,
                        notificationText: notif ? notif.text : '',
                    });
                }
            });
        });
    }

    // ── Music system ──────────────────────────────────────────────────────────

    _startMusic() {
        this._musicPhase   = 1;
        this._currentMusic = null;
        if (this.cache.audio.has('music_clocking_in')) {
            this._currentMusic = this.sound.add('music_clocking_in', { loop: true, volume: 0 });
            this._currentMusic.play();
            this.tweens.add({ targets: this._currentMusic, volume: 0.7, duration: 1000 });
        }
    }

    _checkMusicPhase(ratio) {
        if (ratio <= 0.33 && this._musicPhase === 2) {
            this._musicPhase = 3;
            this._crossfadeTo('music_cutting_it_close');
        } else if (ratio <= 0.66 && this._musicPhase === 1) {
            this._musicPhase = 2;
            this._crossfadeTo('music_workday');
        }
    }

    _crossfadeTo(key) {
        const out = this._currentMusic;
        if (out) {
            this.tweens.add({
                targets: out, volume: 0, duration: 2000,
                onComplete: () => out.stop(),
            });
        }
        if (this.cache.audio.has(key)) {
            const inc = this.sound.add(key, { loop: true, volume: 0 });
            inc.play();
            this.tweens.add({ targets: inc, volume: 0.7, duration: 2000 });
            this._currentMusic = inc;
        } else {
            this._currentMusic = null;
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _fmtPay() {
        return `$${Math.max(0, GameState.paycheckTotal).toFixed(8)}`;
    }
}

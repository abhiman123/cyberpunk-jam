import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import RulebookOverlay from '../systems/RulebookOverlay.js';
import Animations from '../fx/Animations.js';
import { applyCyberpunkLook, glitchBurst } from '../fx/applyCyberpunkLook.js';

const SHIFT_MS      = { 1: 180000, 2: 135000, 3: 90000 };
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

        this._baseQueue   = baseIds.map(id => allCases.find(c => c.id === id)).filter(Boolean);
        this._queue       = [...this._baseQueue];
        this._queueIndex  = 0;
        this._currentCase = null;
        this._actionLocked  = false;
        this._shiftMistakes = 0;
        this._paycheckDelta = 0;
        this._selectedTool  = null;
        this._inspectedZones = new Set();
        this._logLines      = [];

        // ── Cyberpunk look ────────────────────────────────────────────────────
        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        // ── Build UI ──────────────────────────────────────────────────────────
        this._buildHUD();
        this._buildConveyorScreen();
        this._buildInspectionScreen();

        // ── Shift timer ───────────────────────────────────────────────────────
        this._shiftDuration = SHIFT_MS[period] || 180000;
        this._elapsed       = 0;
        this._shiftRunning  = false;
        this._musicPhase    = 1;
        this._currentMusic  = null;

        // ── Rulebook ──────────────────────────────────────────────────────────
        const newRuleIds = allRules.filter(r => r.period === period).map(r => r.id);
        this._rulebook = new RulebookOverlay(this, GameState.activeRules, allRules, newRuleIds);
        this.events.on('shutdown', () => this._rulebook.destroy());

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

        if (this._screen === 'conveyor') this._scrollBelt(delta);

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
            fontFamily: 'monospace', fontSize: '11px', color: '#cccccc',
        });
        this._hudContainer.add(this._hudPeriodText);

        this._hudCasesText = this.add.text(640, 25, 'CASES: 0', {
            fontFamily: 'monospace', fontSize: '11px', color: '#888888',
        }).setOrigin(0.5);
        this._hudContainer.add(this._hudCasesText);

        this._hudPayText = this.add.text(1268, 14, this._fmtPay(), {
            fontFamily: 'monospace', fontSize: '11px', color: '#00cc88',
        }).setOrigin(1, 0);
        this._hudContainer.add(this._hudPayText);

        this._hudViolText = this.add.text(1268, 30, 'Violations: 0', {
            fontFamily: 'monospace', fontSize: '10px', color: '#666666',
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

        // Monitor text overlaid on the pixel art screen (left panel area)
        this._monitorText = this.add.text(130, 375,
            'AWAITING UNIT\n\nSTATUS: READY', {
            fontFamily: 'monospace', fontSize: '10px', color: '#301934',
            align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        this._conveyorContainer.add(this._monitorText);

        // Unit container — rides on the belt, Y tuned to pixel art belt position
        this._unitContainer  = this.add.container(1400, 420).setDepth(15);
        const unitSpr        = this.add.image(0, 0, 'unit_placeholder').setScale(1.0);
        this._unitNameText   = this.add.text(0, 115, '', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ccddee',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this._unitIdText = this.add.text(0, 133, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#778899',
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
        });
    }

    _scrollBelt(_delta) {
        // Belt animation handled by pixel art background — no-op
    }

    // ── Inspection screen ─────────────────────────────────────────────────────

    _buildInspectionScreen() {
        this._inspectionContainer = this.add.container(0, 0).setDepth(10);

        // Full dark background
        const bg = this.add.rectangle(640, 385, 1280, 670, 0x080808, 1.0);
        this._inspectionContainer.add(bg);

        if (this.textures.exists('bg_inspectview')) {
            const inspBg = this.add.image(640, 385, 'bg_inspectview').setDisplaySize(1280, 670).setAlpha(0.35);
            this._inspectionContainer.add(inspBg);
        }

        // ===== LEFT HALF — unit + zones + log =====
        const leftBg = this.add.rectangle(255, 385, 510, 670, 0x050505, 0.95)
            .setStrokeStyle(1, 0x2a2a3a, 0.7);
        this._inspectionContainer.add(leftBg);

        // Unit name and description
        this._inspUnitName = this.add.text(255, 72, '', {
            fontFamily: 'monospace', fontSize: '15px', color: '#cce0ff',
        }).setOrigin(0.5);
        this._inspectionContainer.add(this._inspUnitName);

        this._inspUnitDesc = this.add.text(255, 95, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#778899',
            wordWrap: { width: 440 }, align: 'center',
        }).setOrigin(0.5, 0);
        this._inspectionContainer.add(this._inspUnitDesc);

        // Unit sprite centered
        this._inspUnitSprite = this.add.image(255, 285, 'unit_placeholder').setScale(1.6);
        this._inspectionContainer.add(this._inspUnitSprite);

        // Zone buttons overlaid on sprite
        // unit_placeholder is 120×200, scale 1.6 → 192×320, centered at (255, 285)
        // y range: 285 ± 160 → y: 125..445
        const zoneLayout = {
            A: { x: 255, y: 145, w: 130, h: 52, label: '[A] HEAD'   },
            B: { x: 255, y: 265, w: 155, h: 80, label: '[B] TORSO'  },
            C: { x: 175, y: 335, w: 75,  h: 80, label: '[C] LEFT'   },
            D: { x: 335, y: 335, w: 75,  h: 80, label: '[D] RIGHT'  },
        };

        this._zoneBtns = {};
        Object.entries(zoneLayout).forEach(([id, z]) => {
            const rect = this.add.rectangle(z.x, z.y, z.w, z.h, 0x001122, 0.0)
                .setStrokeStyle(1, 0x336688, 0.6)
                .setInteractive({ useHandCursor: true });
            const lbl = this.add.text(z.x, z.y, z.label, {
                fontFamily: 'monospace', fontSize: '9px', color: '#446688',
            }).setOrigin(0.5);

            rect.on('pointerover', () => {
                if (!this._zoneBtns[id].highlighted) rect.setStrokeStyle(1, 0x66aacc, 1);
            });
            rect.on('pointerout', () => {
                if (!this._zoneBtns[id].highlighted) rect.setStrokeStyle(1, 0x336688, 0.6);
            });
            rect.on('pointerdown', () => this._onZoneClick(id));

            this._inspectionContainer.add(rect);
            this._inspectionContainer.add(lbl);
            this._zoneBtns[id] = { rect, lbl, highlighted: false };
        });

        // Inspection log panel
        const logBg = this.add.rectangle(255, 590, 480, 185, 0x040408, 0.95)
            .setStrokeStyle(1, 0x1a1a2a, 0.8);
        this._inspectionContainer.add(logBg);

        const logHeader = this.add.text(255, 504, 'INSPECTION LOG  (scroll to review)', {
            fontFamily: 'monospace', fontSize: '10px', color: '#005544', letterSpacing: 2,
        }).setOrigin(0.5);
        this._inspectionContainer.add(logHeader);

        // Scrollable log container clipped to the panel
        const LOG_X = 15, LOG_TOP = 503, LOG_W = 480, LOG_H = 178;
        const maskShape = this.make.graphics({ x: 0, y: 0, add: false });
        maskShape.fillRect(LOG_X, LOG_TOP, LOG_W, LOG_H);
        const logMask = maskShape.createGeometryMask();

        this._logContainerBaseY = LOG_TOP + 4;
        this._logContainer = this.add.container(LOG_X + 6, this._logContainerBaseY);
        this._logContainer.setMask(logMask);
        this._inspectionContainer.add(this._logContainer);

        this._logLineHeight = 16;
        this._logScrollY    = 0;
        this._logPanelH     = LOG_H;

        this.input.on('wheel', (_ptr, _objs, _dx, dy) => {
            if (this._screen !== 'inspection') return;
            const maxScroll = Math.max(0, this._logLines.length * this._logLineHeight - LOG_H + 8);
            this._logScrollY = Phaser.Math.Clamp(this._logScrollY + dy * 0.4, 0, maxScroll);
            this._updateLogScroll();
        });

        // ===== RIGHT HALF — ruling + tools =====
        const rightBg = this.add.rectangle(910, 385, 740, 670, 0x060606, 0.95)
            .setStrokeStyle(1, 0x2a2a2a, 0.6);
        this._inspectionContainer.add(rightBg);

        // ─ Ruling panel (top-right, gray) ─
        const ruleBg = this.add.rectangle(910, 210, 700, 330, 0x0a0a0a)
            .setStrokeStyle(1, 0x444444, 0.5);
        this._inspectionContainer.add(ruleBg);

        const rulingHeader = this.add.text(910, 67, 'MAKE A RULING', {
            fontFamily: 'monospace', fontSize: '11px', color: '#666666', letterSpacing: 4,
        }).setOrigin(0.5);
        this._inspectionContainer.add(rulingHeader);

        const rulingDefs = [
            { y: 120, label: 'SCRAP',   dotColor: 0xff3322, textColor: '#ff5544', action: 'scrap'   },
            { y: 210, label: 'REPAIR',  dotColor: 0xffcc00, textColor: '#ffdd44', action: 'repair'  },
            { y: 300, label: 'APPROVE', dotColor: 0x00cc44, textColor: '#44ff88', action: 'approve' },
        ];
        rulingDefs.forEach(def => {
            const btnBg = this.add.rectangle(910, def.y, 660, 60, 0x111111)
                .setStrokeStyle(1, 0x333333)
                .setInteractive({ useHandCursor: true });
            const dot = this.add.circle(596, def.y, 7, def.dotColor, 0.9);
            const lbl = this.add.text(910, def.y, def.label, {
                fontFamily: 'monospace', fontSize: '17px', color: def.textColor,
            }).setOrigin(0.5);

            btnBg.on('pointerover', () => btnBg.setStrokeStyle(1, 0x666666));
            btnBg.on('pointerout',  () => btnBg.setStrokeStyle(1, 0x333333));
            btnBg.on('pointerdown', () => {
                if (this._screen !== 'inspection') return;
                if (this._actionLocked || this._rulebook.isVisible()) return;
                Animations.buttonPunch(this, btnBg);
                this._submitRuling(def.action);
            });

            this._inspectionContainer.add(btnBg);
            this._inspectionContainer.add(dot);
            this._inspectionContainer.add(lbl);
        });

        // ─ Tool bar (bottom-right, gold panel) ─
        const toolBg = this.add.rectangle(910, 540, 700, 210, 0x0d0b00)
            .setStrokeStyle(1, 0x554400, 0.7);
        this._inspectionContainer.add(toolBg);

        const toolHeader = this.add.text(910, 446, 'SELECT TOOL', {
            fontFamily: 'monospace', fontSize: '10px', color: '#665500', letterSpacing: 3,
        }).setOrigin(0.5);
        this._inspectionContainer.add(toolHeader);

        const toolDefs = [
            { x: 730, key: 'hammer',  label: 'HAMMER',  icon: 'tool_hammer'  },
            { x: 1090, key: 'scanner', label: 'SCANNER', icon: 'tool_scanner' },
        ];
        this._toolBtns = {};
        toolDefs.forEach(t => {
            const bg = this.add.rectangle(t.x, 530, 210, 130, 0x110f00)
                .setStrokeStyle(1, 0x554400)
                .setInteractive({ useHandCursor: true });
            const icon = this.add.image(t.x, 510, t.icon).setScale(1.2);
            const lbl  = this.add.text(t.x, 562, t.label, {
                fontFamily: 'monospace', fontSize: '12px', color: '#aa8833',
            }).setOrigin(0.5);

            bg.on('pointerover', () => { if (this._selectedTool !== t.key) bg.setStrokeStyle(1, 0x998822); });
            bg.on('pointerout',  () => { if (this._selectedTool !== t.key) bg.setStrokeStyle(1, 0x554400); });
            bg.on('pointerdown', () => this._onToolSelect(t.key));

            this._inspectionContainer.add(bg);
            this._inspectionContainer.add(icon);
            this._inspectionContainer.add(lbl);
            this._toolBtns[t.key] = { bg, lbl };
        });

        // [B] RULEBOOK button
        const rbBg = this.add.rectangle(910, 626, 300, 36, 0x001a1a)
            .setStrokeStyle(1, 0x003a3a)
            .setInteractive({ useHandCursor: true });
        const rbTxt = this.add.text(910, 626, '[B]  RULEBOOK', {
            fontFamily: 'monospace', fontSize: '12px', color: '#00aaaa',
        }).setOrigin(0.5);
        rbBg.on('pointerover', () => rbBg.setFillStyle(0x002a2a));
        rbBg.on('pointerout',  () => rbBg.setFillStyle(0x001a1a));
        rbBg.on('pointerdown', () => {
            if (this._screen !== 'inspection') return;
            Animations.buttonPunch(this, rbBg);
            this._rulebook.toggle();
        });
        this._inspectionContainer.add(rbBg);
        this._inspectionContainer.add(rbTxt);

        // Feedback text
        this._feedbackText = this.add.text(640, 690, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#ff4444',
            stroke: '#000000', strokeThickness: 1, align: 'center',
            wordWrap: { width: 900 },
        }).setOrigin(0.5).setAlpha(0);
        this._inspectionContainer.add(this._feedbackText);
    }

    // ── Screen toggle ──────────────────────────────────────────────────────────

    _setScreen(name) {
        this._screen = name;
        this._conveyorContainer.setVisible(name === 'conveyor');
        this._unitContainer.setVisible(name === 'conveyor');
        this._inspectionContainer.setVisible(name === 'inspection');
    }

    // ── Zone + tool interaction ───────────────────────────────────────────────

    _onToolSelect(tool) {
        this._selectedTool = tool;
        Object.entries(this._toolBtns).forEach(([k, b]) => {
            if (k === tool) {
                b.bg.setStrokeStyle(3, 0xffcc44);
                b.lbl.setColor('#ffcc44');
            } else {
                b.bg.setStrokeStyle(1, 0x554400);
                b.lbl.setColor('#aa8833');
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
        this._inspectedZones.add(key); // still track for zone highlight

        const result = this._currentCase.zones[zoneId][this._selectedTool];
        this._appendLog(`[${zoneId}/${this._selectedTool.toUpperCase()}] ${result}`);
        this._highlightZone(zoneId);

        if (this.cache.audio.has('sfx_reveal')) this.sound.play('sfx_reveal', { volume: 0.7 });
    }

    _updateLogScroll() {
        this._logContainer.y = this._logContainerBaseY - this._logScrollY;
    }

    _appendLog(text) {
        const idx = this._logLines.length;
        this._logLines.push(text);
        const lineObj = this.add.text(0, idx * this._logLineHeight, text, {
            fontFamily: 'monospace', fontSize: '10px', color: '#00cc88',
            wordWrap: { width: 460 }, lineSpacing: 3,
        });
        this._logContainer.add(lineObj);
        Animations.glitchText(this, lineObj, { duration: 120, finalAlpha: 1 });

        // Auto-scroll to bottom so newest entry is visible
        const totalH = (this._logLines.length) * this._logLineHeight;
        if (totalH > this._logPanelH) {
            this._logScrollY = totalH - this._logPanelH + 8;
            this._updateLogScroll();
        }
    }

    _highlightZone(zoneId) {
        const z = this._zoneBtns[zoneId];
        if (!z || z.highlighted) return;
        z.highlighted = true;
        z.rect.setFillStyle(0x003322, 0.35).setStrokeStyle(2, 0x00cc88, 1);
        z.lbl.setColor('#00cc88');
    }

    // ── Ruling logic ──────────────────────────────────────────────────────────

    _submitRuling(action) {
        if (this._actionLocked) return;
        this._actionLocked = true;

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

        this.time.delayedCall(1400, () => this._advanceCase());
    }

    _showFeedback(msg, color) {
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText, alpha: 0, delay: 1000, duration: 400,
        });
    }

    // ── Case management ───────────────────────────────────────────────────────

    _loadNextCase() {
        if (!this._shiftRunning) return;

        this._currentCase = this._queue[this._queueIndex];
        if (!this._currentCase) return;

        if (this._monitorText) {
            this._monitorText.setText(
                `UNIT INCOMING\n\n${this._currentCase.id}\nSTATUS: ACTIVE`
            );
        }

        // Populate inspection view
        this._inspUnitName.setText(this._currentCase.name);
        this._inspUnitDesc.setText(this._currentCase.description);

        // Slide unit onto belt from right
        this._unitContainer.x = 1450;
        this._unitNameText.setText(this._currentCase.name);
        this._unitIdText.setText(this._currentCase.id);

        this.tweens.add({
            targets: this._unitContainer, x: 760, duration: 800, ease: 'Cubic.Out',
        });
    }

    _advanceCase() {
        const justProcessed = this._currentCase;

        // Reset inspection state
        this._inspectedZones = new Set();
        this._logLines = [];
        this._logContainer.removeAll(true);
        this._logScrollY = 0;
        this._updateLogScroll();
        this._actionLocked = false;
        this._selectedTool = null;

        Object.entries(this._toolBtns).forEach(([, b]) => {
            b.bg.setStrokeStyle(1, 0x554400);
            b.lbl.setColor('#aa8833');
        });
        Object.entries(this._zoneBtns).forEach(([, z]) => {
            z.highlighted = false;
            z.rect.setFillStyle(0x001122, 0).setStrokeStyle(1, 0x336688, 0.6);
            z.lbl.setColor('#446688');
        });

        // Return to conveyor, slide unit off left
        this._setScreen('conveyor');
        this.tweens.add({
            targets: this._unitContainer, x: -250, duration: 500, ease: 'Cubic.In',
        });

        // Final case check
        if (justProcessed?.isFinalCase && GameState.isLastDay()) {
            this.time.delayedCall(600, () => {
                this._shiftRunning = false;
                this._endShift(true);
            });
            return;
        }

        // Advance queue, reshuffle if exhausted
        this._queueIndex++;
        if (this._queueIndex >= this._queue.length) {
            this._queue = [...this._baseQueue].sort(() => Math.random() - 0.5);
            this._queueIndex = 0;
        }

        this.time.delayedCall(700, () => this._loadNextCase());
    }

    // ── Shift end ──────────────────────────────────────────────────────────────

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

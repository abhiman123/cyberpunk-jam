import * as Phaser from 'phaser';
import { GameState }      from '../GameState.js';
import CaseDisplay        from '../systems/CaseDisplay.js';
import TimerBar           from '../systems/TimerBar.js';
import RulebookOverlay    from '../systems/RulebookOverlay.js';
import Animations         from '../fx/Animations.js';
import { applyCyberpunkLook, glitchBurst } from '../fx/applyCyberpunkLook.js';

// ── Layout constants ────────────────────────────────────────────────────────
//
//  [ CONVEYOR STRIP 28px ] | [ CASE PANEL 472px ] | [ DETAILS 350px ] | [ TOOLS 430px ]
//
const PANEL = {
    conveyorW: 28,
    case:    { x: 28,  w: 472 },
    details: { x: 500, w: 350 },
    tools:   { x: 850, w: 430 },
    headerH: 50,
    footerY: 680,
};

const TIMER_DURATION  = { 1: 60, 2: 45, 3: 30 };
const PAYCHECK_DEDUCT = 0.00000003;

const PENDING_UNIT_REST_X = 640;
const PENDING_UNIT_REST_Y = 540;

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        const { period, day, activeRules } = GameState;

        // ── Data ──────────────────────────────────────────────────────────────
        const allCases   = this.cache.json.get('cases');
        const allRules   = this.cache.json.get('rules');
        const schedule   = this.cache.json.get('schedule');
        const schedEntry = schedule.find(s => s.period === period && s.day === day);
        const caseIds    = schedEntry ? schedEntry.caseIds : [];

        this._casesQueue    = caseIds
            .map(id => allCases.find(c => c.id === id))
            .filter(Boolean)
            .filter(c => !GameState.casesCompleted.includes(c.id));
        this._caseIndex     = 0;
        this._dayMistakes   = 0;
        this._paycheckDelta = 0;
        this._actionLocked  = false;
        this._currentCase   = null;
        this._cmFilter      = null;
        this._conveyorTiles = [];
        this._mainChildren    = [];
        this._inspectChildren = [];
        this._viewMode        = 'main';
        this._viewTransitioning = false;

        const fx = applyCyberpunkLook(this);
        this._cmFilter = fx.cmFilter;

        // ── Backgrounds ───────────────────────────────────────────────────────
        this._mainBg = this.add.image(640, 360, 'bg_main')
            .setDisplaySize(1280, 720).setDepth(0);
        this._inspectBg = this.add.image(640, 360, 'bg_inspect')
            .setDisplaySize(1280, 720).setDepth(0).setAlpha(0);

        // ── Header bar (persistent on both views) ─────────────────────────────
        this._buildHeader(period, day);

        // ── Main view (conveyor + pending unit + hint) ────────────────────────
        this._buildMainView();

        // ── Inspect view (panels + timer + buttons) ───────────────────────────
        this._buildInspectPanels();
        this._buildTimer(period);
        this._buildDetailsPanel();
        this._buildToolsPanel(period, activeRules, allRules);

        // ── Case display (content injected per case) ──────────────────────────
        this._caseDisplay = new CaseDisplay(this, PANEL.case.x, PANEL.headerH, PANEL.case.w);

        // ── Feedback text ─────────────────────────────────────────────────────
        this._feedbackText = this.add.text(
            PANEL.case.x + PANEL.case.w / 2,
            PANEL.footerY - 10,
            '',
            {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: '#ff4444',
                wordWrap: { width: PANEL.case.w - 20 },
                align: 'center',
                stroke: '#000000',
                strokeThickness: 1,
            }
        ).setOrigin(0.5).setDepth(10).setAlpha(0);
        this._trackInspect(this._feedbackText);

        // Start with inspect UI hidden
        this._setInspectVisible(false);

        // ── Scene entrance ────────────────────────────────────────────────────
        Animations.scanlineWipe(this, { color: 0x00ffcc, alpha: 0.10, duration: 380 });
        this.cameras.main.fadeIn(300, 0, 0, 0);

        this._loadNextCase();
    }

    // ── Update ────────────────────────────────────────────────────────────────

    update(_time, delta) {
        if (this._timer && !this._actionLocked && this._viewMode === 'inspect') {
            this._timer.update(delta);
        }
        this._scrollConveyor(delta);
    }

    // ── Layout builders ───────────────────────────────────────────────────────

    _buildHeader(period, day) {
        this.add.rectangle(640, 25, 1280, 50, 0x050505, 0.85).setDepth(2);

        this._dayText = this.add.text(16, 15,
            `PERIOD ${period}  |  DAY ${day}  |  UNIT PROCESSING DIVISION`, {
            fontFamily: 'monospace', fontSize: '11px', color: '#cccccc',
        }).setDepth(3);

        this._paycheckText = this.add.text(1264, 15, this._formatPaycheck(), {
            fontFamily: 'monospace', fontSize: '11px', color: '#00cc88',
        }).setOrigin(1, 0).setDepth(3);

        Animations.fadeIn(this, [this._dayText, this._paycheckText],
            { duration: 500 });
    }

    _buildMainView() {
        // Conveyor strip (decorative, only visible on main view)
        const stripX = 0;
        const stripW = PANEL.conveyorW;
        const tileH  = 40;
        const count  = Math.ceil(680 / tileH) + 2;

        for (let i = 0; i < count; i++) {
            const tile = this.add.image(
                stripX + stripW / 2,
                PANEL.headerH + i * tileH,
                'conveyor_tile'
            ).setDisplaySize(stripW, tileH).setDepth(3).setAlpha(0.75);
            this._conveyorTiles.push(tile);
            this._trackMain(tile);
        }
        this._conveyorOffset = 0;

        // "INCOMING UNIT" hint
        this._mainHint = this.add.text(640, 120, '> INCOMING UNIT // CLICK TO INSPECT', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffcc66',
            stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(20).setAlpha(0);
        this._trackMain(this._mainHint);

        // Pending unit sprite (clickable crate)
        this._pendingUnit = this.add.rectangle(
            -80, PENDING_UNIT_REST_Y, 88, 88, 0x5a3a1a
        ).setStrokeStyle(3, 0x1a0f06).setDepth(19).setAlpha(0);
        this._pendingUnitLabel = this.add.text(-80, PENDING_UNIT_REST_Y, 'UNIT', {
            fontFamily: 'monospace', fontSize: '14px', color: '#ffe0aa',
            stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5).setDepth(20).setAlpha(0);
        this._trackMain(this._pendingUnit);
        this._trackMain(this._pendingUnitLabel);

        this._pendingUnit.setInteractive({ useHandCursor: true });
        this._pendingUnit.on('pointerover', () => {
            if (this._pendingUnit.alpha > 0.5) {
                this._pendingUnit.setFillStyle(0x7a5530);
                this._pendingUnit.setStrokeStyle(3, 0xffcc66);
            }
        });
        this._pendingUnit.on('pointerout', () => {
            this._pendingUnit.setFillStyle(0x5a3a1a);
            this._pendingUnit.setStrokeStyle(3, 0x1a0f06);
        });
        this._pendingUnit.on('pointerdown', () => {
            if (this._viewMode !== 'main' || this._viewTransitioning) return;
            if (this._pendingUnit.alpha < 0.9) return;
            this._enterInspectView();
        });
    }

    _scrollConveyor(delta) {
        if (!this._conveyorTiles.length) return;
        const speed = 55;
        const tileH = 40;
        this._conveyorOffset += (speed * delta / 1000);
        if (this._conveyorOffset >= tileH) this._conveyorOffset -= tileH;
        this._conveyorTiles.forEach((tile, i) => {
            tile.y = PANEL.headerH + (i * tileH) + this._conveyorOffset;
        });
    }

    _buildInspectPanels() {
        const borderGfx = this.add.graphics().setDepth(81);
        borderGfx.lineStyle(1, 0x555555, 1);
        borderGfx.strokeRect(PANEL.case.x,    PANEL.headerH, PANEL.case.w,    630);
        borderGfx.strokeRect(PANEL.details.x, PANEL.headerH, PANEL.details.w, 630);
        borderGfx.strokeRect(PANEL.tools.x,   PANEL.headerH, PANEL.tools.w,   630);
        this._trackInspect(borderGfx);

        const caseBg = this.add.rectangle(
            PANEL.case.x + PANEL.case.w / 2, 365,
            PANEL.case.w, 630, 0x060606, 0.78
        ).setDepth(80);
        this._trackInspect(caseBg);

        const detailsBg = this.add.rectangle(
            PANEL.details.x + PANEL.details.w / 2, 365,
            PANEL.details.w, 630, 0x060606, 0.92
        ).setDepth(80);
        this._trackInspect(detailsBg);

        const toolsBg = this.add.rectangle(
            PANEL.tools.x + PANEL.tools.w / 2, 365,
            PANEL.tools.w, 630, 0x050505, 0.92
        ).setDepth(80);
        this._trackInspect(toolsBg);
    }

    _buildTimer(period) {
        const duration = TIMER_DURATION[period] || 60;
        this._timer = new TimerBar(this, 0, 44, 1280, 6, duration);
        this._trackInspect(this._timer._track);
        this._trackInspect(this._timer._gfx);
        this.events.on('timerExpired', () => this._submitAction(null));
    }

    _buildDetailsPanel() {
        const dx = PANEL.details.x;
        const dw = PANEL.details.w;
        const cx = dx + dw / 2;

        const header = this.add.text(cx, PANEL.headerH + 16, 'INSPECTION LOG', {
            fontFamily: 'monospace', fontSize: '11px', color: '#00cc88',
        }).setOrigin(0.5).setDepth(101);
        this._trackInspect(header);

        const divGfx = this.add.graphics().setDepth(82);
        divGfx.lineStyle(1, 0x2a2a2a);
        divGfx.lineBetween(dx + 10, PANEL.headerH + 32, dx + dw - 10, PANEL.headerH + 32);
        this._trackInspect(divGfx);

        this._caseCountText = this.add.text(cx - 40, PANEL.headerH + 46, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(101);
        this._trackInspect(this._caseCountText);

        this._zoneCountText = this.add.text(cx + 40, PANEL.headerH + 46, '', {
            fontFamily: 'monospace', fontSize: '11px', color: '#336655',
        }).setOrigin(0.5).setDepth(101);
        this._trackInspect(this._zoneCountText);

        this._logText = this.add.text(dx + 14, PANEL.headerH + 68, '', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#00cc88',
            lineSpacing: 5,
            wordWrap: { width: dw - 28 },
        }).setDepth(101);
        this._trackInspect(this._logText);

        this.events.off('zoneRevealed');
        this.events.on('zoneRevealed', (zoneId) => this._appendLog(zoneId));
    }

    _buildToolsPanel(period, activeRules, allRules) {
        const tx = PANEL.tools.x;
        const tw = PANEL.tools.w;
        const cx = tx + tw / 2;
        const bw = tw - 40;

        const header = this.add.text(cx, PANEL.headerH + 16, 'MAKE A RULING', {
            fontFamily: 'monospace', fontSize: '11px', color: '#00cc88',
        }).setOrigin(0.5).setDepth(101);
        this._trackInspect(header);

        const divGfx = this.add.graphics().setDepth(82);
        divGfx.lineStyle(1, 0x2a2a2a);
        divGfx.lineBetween(tx + 10, PANEL.headerH + 32, tx + tw - 10, PANEL.headerH + 32);
        this._trackInspect(divGfx);

        const buttons = [
            { y: 200, label: 'APPROVE',      color: '#00cc66', bg: 0x0a2010, action: 'approve' },
            { y: 310, label: 'ORDER REPAIR', color: '#ffcc00', bg: 0x202000, action: 'repair'  },
            { y: 420, label: 'SCRAP',        color: '#ff3322', bg: 0x200808, action: 'scrap'   },
        ];

        this._actionButtons = [];
        buttons.forEach((def) => {
            const { btn, txt } = this._makeActionButton(cx, def.y, def.label, def.color, def.bg, bw, () => {
                this._submitAction(def.action);
            });
            this._trackInspect(btn);
            this._trackInspect(txt);
            this._actionButtons.push({ btn, txt, ...def });
        });

        // Rulebook button
        const rbBg = this.add.rectangle(cx, 535, bw, 42, 0x001a1a)
            .setStrokeStyle(1, 0x003a3a)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);
        const rbTxt = this.add.text(cx, 535, '[B]  RULEBOOK', {
            fontFamily: 'monospace', fontSize: '13px', color: '#00aaaa',
        }).setOrigin(0.5).setDepth(101);
        rbBg.on('pointerover',  () => rbBg.setFillStyle(0x002a2a));
        rbBg.on('pointerout',   () => rbBg.setFillStyle(0x001a1a));
        rbBg.on('pointerdown',  () => {
            if (this._viewMode !== 'inspect') return;
            Animations.buttonPunch(this, rbBg);
            this._rulebook.toggle();
        });
        this._trackInspect(rbBg);
        this._trackInspect(rbTxt);

        this._mistakesText = this.add.text(cx, 600, 'Violations: 0', {
            fontFamily: 'monospace', fontSize: '11px', color: '#aaaaaa',
        }).setOrigin(0.5).setDepth(101);
        this._trackInspect(this._mistakesText);

        const newRuleIds = allRules.filter(r => r.period === period).map(r => r.id);
        this._rulebook = new RulebookOverlay(this, activeRules, allRules, newRuleIds);
    }

    // ── View transitions ──────────────────────────────────────────────────────

    _trackMain(obj)    { this._mainChildren.push(obj); }
    _trackInspect(obj) { this._inspectChildren.push(obj); }

    _setInspectVisible(visible) {
        this._inspectChildren.forEach(o => {
            if (!o) return;
            if (typeof o.setVisible === 'function') o.setVisible(visible);
            if (typeof o.setAlpha   === 'function') o.setAlpha(visible ? 1 : 0);
        });
    }

    _setMainVisible(visible) {
        this._mainChildren.forEach(o => {
            if (!o) return;
            if (typeof o.setVisible === 'function') o.setVisible(visible);
            if (typeof o.setAlpha   === 'function') o.setAlpha(visible ? 1 : 0);
        });
    }

    _enterInspectView() {
        if (this._viewTransitioning) return;
        this._viewTransitioning = true;
        this._viewMode = 'inspect';

        // Prepare inspect UI for fade-in
        this._inspectChildren.forEach(o => {
            if (!o) return;
            if (typeof o.setVisible === 'function') o.setVisible(true);
            if (typeof o.setAlpha   === 'function') o.setAlpha(0);
        });

        this.tweens.add({
            targets: [this._mainBg],
            alpha: 0,
            duration: 260,
        });
        this.tweens.add({
            targets: [this._inspectBg],
            alpha: 1,
            duration: 260,
        });
        this.tweens.add({
            targets: this._mainChildren,
            alpha: 0,
            duration: 240,
            onComplete: () => {
                this._mainChildren.forEach(o => o && o.setVisible && o.setVisible(false));
            },
        });
        this.tweens.add({
            targets: this._inspectChildren,
            alpha: 1,
            duration: 280,
            delay: 80,
            onComplete: () => {
                this._viewTransitioning = false;
                // Load case content now, then start timer on arrival
                this._caseDisplay.load(this._currentCase, () => {
                    this._timer.start();
                });
            },
        });
    }

    _exitInspectView(onComplete) {
        if (this._viewTransitioning) { if (onComplete) onComplete(); return; }
        this._viewTransitioning = true;

        // Prepare main UI for fade-in
        this._mainChildren.forEach(o => {
            if (!o) return;
            if (typeof o.setVisible === 'function') o.setVisible(true);
            if (typeof o.setAlpha   === 'function') o.setAlpha(0);
        });
        // Pending unit starts offscreen for next arrival
        this._pendingUnit.x = -80;
        this._pendingUnitLabel.x = -80;

        this.tweens.add({
            targets: [this._inspectBg],
            alpha: 0,
            duration: 240,
        });
        this.tweens.add({
            targets: [this._mainBg],
            alpha: 1,
            duration: 240,
        });
        this.tweens.add({
            targets: this._inspectChildren,
            alpha: 0,
            duration: 220,
            onComplete: () => {
                this._inspectChildren.forEach(o => o && o.setVisible && o.setVisible(false));
            },
        });
        this.tweens.add({
            targets: this._mainChildren.filter(o => o !== this._pendingUnit && o !== this._pendingUnitLabel),
            alpha: 1,
            duration: 240,
            delay: 60,
            onComplete: () => {
                this._viewMode = 'main';
                this._viewTransitioning = false;
                if (onComplete) onComplete();
            },
        });
    }

    // ── Case flow ─────────────────────────────────────────────────────────────

    _loadNextCase() {
        if (this._caseIndex >= this._casesQueue.length) {
            this._endShift();
            return;
        }

        this._actionLocked = false;
        this._currentCase  = this._casesQueue[this._caseIndex];
        this._zonesScanned = 0;

        this._logText.setText('');
        this._caseCountText.setText(`Case ${this._caseIndex + 1} / ${this._casesQueue.length}`);
        this._zoneCountText.setText(`0/${this._currentCase.inspectionZones.length} zones`);
        this._feedbackText.setAlpha(0);

        // Slide pending unit in on the conveyor (main view)
        this._pendingUnit.x = -80;
        this._pendingUnitLabel.x = -80;
        this._pendingUnit.setAlpha(1);
        this._pendingUnitLabel.setAlpha(1);

        this.tweens.add({
            targets: [this._pendingUnit, this._pendingUnitLabel],
            x: PENDING_UNIT_REST_X,
            duration: 900,
            ease: 'Cubic.Out',
        });
    }

    _submitAction(action) {
        if (this._actionLocked) return;
        if (this._viewMode !== 'inspect') return;
        this._actionLocked = true;
        this._timer.stop();

        const correct = action === this._currentCase.correctAction;

        if (correct) {
            this._showFeedback('CORRECT — PROCEEDING', '#00cc66');
            this.cameras.main.flash(180, 0, 40, 0, false);
            const matchBtn = this._actionButtons.find(b => b.action === action);
            if (matchBtn) Animations.borderPulse(this, matchBtn.btn, 0x00cc66);

        } else {
            this._dayMistakes++;
            GameState.totalMistakes++;
            this._paycheckDelta     -= PAYCHECK_DEDUCT;
            GameState.paycheckTotal -= PAYCHECK_DEDUCT;

            const msg = action === null
                ? `TIME EXPIRED — ${this._currentCase.incorrectFeedback}`
                : this._currentCase.incorrectFeedback;

            this._showFeedback(msg, '#ff4444');
            this.cameras.main.flash(260, 50, 0, 0, false);
            this._paycheckText.setText(this._formatPaycheck());
            this._mistakesText.setText(`Violations: ${this._dayMistakes}`);

            glitchBurst(this, this._cmFilter, 420);
            Animations.shake(this, [this._feedbackText], { intensity: 5, duration: 280 });

            const matchBtn = this._actionButtons.find(b => b.action === action);
            if (matchBtn) Animations.borderPulse(this, matchBtn.btn, 0xff3322);
        }

        GameState.casesCompleted.push(this._currentCase.id);

        this.time.delayedCall(1600, () => {
            this._caseDisplay.dismiss(() => {
                this._exitInspectView(() => {
                    // Depart animation for pending unit (off to the right)
                    this.tweens.add({
                        targets: [this._pendingUnit, this._pendingUnitLabel],
                        x: 1400,
                        duration: 500,
                        ease: 'Cubic.In',
                        onComplete: () => {
                            this._caseIndex++;
                            this._loadNextCase();
                        },
                    });
                });
            });
        });
    }

    _showFeedback(msg, color) {
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText,
            alpha: 0,
            delay: 1300,
            duration: 260,
        });
    }

    _appendLog(zoneId) {
        const zone = this._currentCase?.inspectionZones.find(z => z.id === zoneId);
        if (!zone) return;
        const line = `> ${zone.label.substring(0, 36)}`;
        const cur  = this._logText.text;
        this._logText.setText(cur ? cur + '\n' + line : line);
        Animations.glitchText(this, this._logText, { duration: 120, finalAlpha: 1 });

        this._zonesScanned = (this._zonesScanned || 0) + 1;
        const total = this._currentCase.inspectionZones.length;
        const allDone = this._zonesScanned >= total;
        this._zoneCountText
            .setText(`${this._zonesScanned}/${total} zones`)
            .setColor(allDone ? '#00cc88' : '#336655');
    }

    _endShift() {
        this._timer.stop();
        const notifications = this.cache.json.get('notifications');
        const { period, day } = GameState;
        const notif = notifications.find(n => n.period === period && n.day === day);

        this.cameras.main.fade(360, 0, 0, 0);
        this.time.delayedCall(360, () => {
            const lastCase = this._casesQueue[this._casesQueue.length - 1];
            if (lastCase?.isFinalCase && GameState.isLastDay()) {
                this.scene.start('End');
            } else {
                this.scene.start('Summary', {
                    mistakes:         this._dayMistakes,
                    paycheckDelta:    this._paycheckDelta,
                    notificationText: notif ? notif.text : '',
                });
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _formatPaycheck() {
        return `Credits: $${Math.max(0, GameState.paycheckTotal).toFixed(8)}`;
    }

    _makeActionButton(x, y, label, textColor, bgColor, w, callback) {
        const btn = this.add.rectangle(x, y, w, 56, bgColor)
            .setStrokeStyle(1, 0x282828)
            .setInteractive({ useHandCursor: true })
            .setDepth(100);

        const txt = this.add.text(x, y, label, {
            fontFamily: 'monospace', fontSize: '17px', color: textColor,
        }).setOrigin(0.5).setDepth(101);

        btn.on('pointerover',  () => btn.setStrokeStyle(2, 0x666666));
        btn.on('pointerout',   () => btn.setStrokeStyle(1, 0x282828));
        btn.on('pointerdown',  () => {
            if (this._viewMode !== 'inspect') return;
            if (this._actionLocked || this._rulebook.isVisible()) return;
            Animations.buttonPunch(this, btn);
            callback();
        });

        return { btn, txt };
    }
}

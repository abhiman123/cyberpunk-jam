import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import CaseDisplay     from '../systems/CaseDisplay.js';
import TimerBar        from '../systems/TimerBar.js';
import RulebookOverlay from '../systems/RulebookOverlay.js';

const TIMER_DURATION   = { 1: 60, 2: 45, 3: 30 };
const PAYCHECK_DEDUCT  = 0.00000003;
const PERIOD_BG_KEY    = { 1: 'bg_p1', 2: 'bg_p2', 3: 'bg_p3' };

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        const { period, day, activeRules } = GameState;

        // ── Data ─────────────────────────────────────────────────────────────
        const allCases   = this.cache.json.get('cases');
        const allRules   = this.cache.json.get('rules');
        const schedule   = this.cache.json.get('schedule');
        const schedEntry = schedule.find(s => s.period === period && s.day === day);
        const caseIds    = schedEntry ? schedEntry.caseIds : [];

        this._casesQueue    = caseIds.map(id => allCases.find(c => c.id === id)).filter(Boolean);
        this._caseIndex     = 0;
        this._dayMistakes   = 0;
        this._paycheckDelta = 0;
        this._actionLocked  = false;
        this._currentCase   = null;

        // ── Background ───────────────────────────────────────────────────────
        this.add.image(640, 360, PERIOD_BG_KEY[period] || 'bg_p1').setDepth(0);

        // ── Left panel border ─────────────────────────────────────────────────
        const borderGfx = this.add.graphics().setDepth(2);
        borderGfx.lineStyle(1, 0x222222, 1);
        borderGfx.strokeRect(0, 50, 768, 670);

        // Right panel background
        this.add.rectangle(1024, 385, 512, 670, 0x060606, 0.92).setDepth(1);
        borderGfx.strokeRect(768, 50, 512, 670);

        // ── HUD top bar ──────────────────────────────────────────────────────
        this.add.rectangle(640, 25, 1280, 50, 0x050505).setDepth(2);

        this._dayText = this.add.text(1260, 8, `PERIOD ${period}  |  DAY ${day}`, {
            fontFamily: 'monospace', fontSize: '13px', color: '#666666',
        }).setOrigin(1, 0).setDepth(3);

        this._paycheckText = this.add.text(1260, 28, this._formatPaycheck(), {
            fontFamily: 'monospace', fontSize: '12px', color: '#444444',
        }).setOrigin(1, 0).setDepth(3);

        // ── Timer bar ────────────────────────────────────────────────────────
        const duration = TIMER_DURATION[period] || 60;
        this._timer = new TimerBar(this, 0, 44, 1280, 6, duration);
        this.events.on('timerExpired', () => this._submitAction(null));

        // ── Action buttons (right panel) ─────────────────────────────────────
        this.add.text(894, 160, 'MAKE A RULING:', {
            fontFamily: 'monospace', fontSize: '13px', color: '#444444',
        }).setOrigin(0.5).setDepth(3);

        this._makeActionButton(894, 240, 'APPROVE',      '#00cc66', 0x0a2010, () => this._submitAction('approve'));
        this._makeActionButton(894, 360, 'ORDER REPAIR', '#ffcc00', 0x202000, () => this._submitAction('repair'));
        this._makeActionButton(894, 480, 'SCRAP',        '#ff3322', 0x200808, () => this._submitAction('scrap'));

        // ── Rulebook toggle button ────────────────────────────────────────────
        const rbBtnBg = this.add.rectangle(84, 700, 160, 34, 0x001a1a)
            .setStrokeStyle(1, 0x006666).setInteractive({ useHandCursor: true }).setDepth(3);
        this.add.text(84, 700, '[B] RULEBOOK', {
            fontFamily: 'monospace', fontSize: '13px', color: '#009999',
        }).setOrigin(0.5).setDepth(4);
        rbBtnBg.on('pointerover',  () => rbBtnBg.setFillColor(0x003333));
        rbBtnBg.on('pointerout',   () => rbBtnBg.setFillColor(0x001a1a));
        rbBtnBg.on('pointerdown',  () => this._rulebook.toggle());

        // ── Rulebook overlay ──────────────────────────────────────────────────
        const newRuleIds = allRules.filter(r => r.period === period).map(r => r.id);
        this._rulebook = new RulebookOverlay(this, activeRules, allRules, newRuleIds);

        // ── Case display ──────────────────────────────────────────────────────
        this._caseDisplay = new CaseDisplay(this, 0, 50);

        // ── Feedback text ─────────────────────────────────────────────────────
        this._feedbackText = this.add.text(384, 645, '', {
            fontFamily: 'monospace', fontSize: '13px', color: '#ff4444',
            wordWrap: { width: 720 }, align: 'center',
        }).setOrigin(0.5).setDepth(5).setAlpha(0);

        // ── Case counter ──────────────────────────────────────────────────────
        this._caseCountText = this.add.text(894, 600, '', {
            fontFamily: 'monospace', fontSize: '12px', color: '#333333',
        }).setOrigin(0.5).setDepth(3);

        // ── Start ─────────────────────────────────────────────────────────────
        this._loadNextCase();
        this.cameras.main.fadeIn(300, 0, 0, 0);
    }

    update(_time, delta) {
        if (!this._actionLocked && this._timer) {
            this._timer.update(delta);
        }
    }

    // ── Private ───────────────────────────────────────────────────────────────

    _loadNextCase() {
        if (this._caseIndex >= this._casesQueue.length) {
            this._endShift();
            return;
        }

        this._actionLocked = false;
        this._currentCase  = this._casesQueue[this._caseIndex];
        this._caseDisplay.load(this._currentCase);
        this._timer.start();
        this._feedbackText.setAlpha(0);
        this._caseCountText.setText(
            `Case ${this._caseIndex + 1} / ${this._casesQueue.length}`
        );
    }

    _submitAction(action) {
        if (this._actionLocked) return;
        this._actionLocked = true;
        this._timer.stop();

        const correct = action === this._currentCase.correctAction;

        if (correct) {
            this._showFeedback('CORRECT — PROCEEDING', '#00cc66');
            this.cameras.main.flash(200, 0, 50, 0, false);
        } else {
            this._dayMistakes++;
            GameState.totalMistakes++;
            this._paycheckDelta -= PAYCHECK_DEDUCT;
            GameState.paycheckTotal -= PAYCHECK_DEDUCT;

            const msg = action === null
                ? `TIME EXPIRED — ${this._currentCase.incorrectFeedback}`
                : this._currentCase.incorrectFeedback;
            this._showFeedback(msg, '#ff4444');
            this.cameras.main.flash(300, 60, 0, 0, false);
            this._paycheckText.setText(this._formatPaycheck());
        }

        GameState.casesCompleted.push(this._currentCase.id);

        this.time.delayedCall(1800, () => {
            this._caseIndex++;
            this._loadNextCase();
        });
    }

    _showFeedback(msg, color) {
        this._feedbackText.setText(msg).setColor(color).setAlpha(1);
        this.tweens.add({
            targets: this._feedbackText,
            alpha: 0,
            delay: 1400,
            duration: 300,
        });
    }

    _endShift() {
        this._timer.stop();

        const notifications = this.cache.json.get('notifications');
        const { period, day } = GameState;
        const notif = notifications.find(n => n.period === period && n.day === day);

        this.cameras.main.fade(400, 0, 0, 0);
        this.time.delayedCall(400, () => {
            const lastCase = this._casesQueue[this._casesQueue.length - 1];
            if (lastCase?.isFinalCase && GameState.isLastDay()) {
                this.scene.start('End');
            } else {
                this.scene.start('Summary', {
                    mistakes: this._dayMistakes,
                    paycheckDelta: this._paycheckDelta,
                    notificationText: notif ? notif.text : '',
                });
            }
        });
    }

    _formatPaycheck() {
        const val = Math.max(0, GameState.paycheckTotal);
        return `Credits: $${val.toFixed(8)}`;
    }

    _makeActionButton(x, y, label, textColor, bgColor, callback) {
        const btn = this.add.rectangle(x, y, 260, 56, bgColor)
            .setStrokeStyle(1, 0x333333)
            .setInteractive({ useHandCursor: true })
            .setDepth(3);

        const txt = this.add.text(x, y, label, {
            fontFamily: 'monospace', fontSize: '18px', color: textColor,
        }).setOrigin(0.5).setDepth(4);

        btn.on('pointerover',  () => btn.setStrokeStyle(2, 0x888888));
        btn.on('pointerout',   () => btn.setStrokeStyle(1, 0x333333));
        btn.on('pointerdown',  () => {
            if (!this._actionLocked && !this._rulebook.isVisible()) callback();
        });

        return { btn, txt };
    }
}

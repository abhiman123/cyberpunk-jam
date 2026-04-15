import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

export default class SummaryScene extends Phaser.Scene {
    constructor() { super('Summary'); }

    init(data) {
        this._mistakes        = data.mistakes        || 0;
        this._paycheckDelta   = data.paycheckDelta   || 0;
        this._notificationText = data.notificationText || '';
    }

    create() {
        const cx = 640;

        this.add.rectangle(640, 360, 1280, 720, 0x060606);

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.07);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);

        // Header
        this.add.text(cx, 80, 'SHIFT COMPLETE', {
            fontFamily: 'monospace', fontSize: '32px', color: '#888888',
        }).setOrigin(0.5);

        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x222222);
        div.lineBetween(300, 120, 980, 120);

        // Stats
        const qcColor = this._mistakes > 0 ? '#ff4444' : '#00cc66';
        const mistakeLabel = this._mistakes === 0 ? 'No violations.' : `${this._mistakes} violation(s) recorded.`;

        this.add.text(cx, 175, 'QC REPORT', {
            fontFamily: 'monospace', fontSize: '14px', color: '#444444',
        }).setOrigin(0.5);

        this.add.text(cx, 210, mistakeLabel, {
            fontFamily: 'monospace', fontSize: '18px', color: qcColor,
        }).setOrigin(0.5);

        // Paycheck
        const paycheckLabel = `Credits deducted: -$${Math.abs(this._paycheckDelta).toFixed(8)}`;
        this.add.text(cx, 260, paycheckLabel, {
            fontFamily: 'monospace', fontSize: '14px', color: '#555555',
        }).setOrigin(0.5);

        this.add.text(cx, 290, `Running total: $${Math.max(0, GameState.paycheckTotal).toFixed(8)}`, {
            fontFamily: 'monospace', fontSize: '13px', color: '#404040',
        }).setOrigin(0.5);

        // Divider
        div.lineBetween(300, 330, 980, 330);

        // Notification blip
        if (this._notificationText) {
            this.add.text(cx, 360, '// INCOMING TRANSMISSION', {
                fontFamily: 'monospace', fontSize: '11px', color: '#333333',
            }).setOrigin(0.5);

            this.add.text(cx, 400, this._notificationText, {
                fontFamily: 'monospace',
                fontSize: '15px',
                color: '#557755',
                wordWrap: { width: 700 },
                align: 'center',
                lineSpacing: 6,
            }).setOrigin(0.5);
        }

        // Next shift button
        const btnBg = this.add.rectangle(cx, 580, 220, 50, 0x111111)
            .setStrokeStyle(1, 0x444444)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(cx, 580, 'NEXT SHIFT  \u2192', {
            fontFamily: 'monospace', fontSize: '16px', color: '#cccccc',
        }).setOrigin(0.5);

        let transitioning = false;
        btnBg.on('pointerover', () => { btnBg.setFillStyle(0x1e1e1e); btnText.setColor('#ffffff'); });
        btnBg.on('pointerout',  () => { btnBg.setFillStyle(0x111111); btnText.setColor('#cccccc'); });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            transitioning = true;
            this.cameras.main.fade(350, 0, 0, 0);
            this.time.delayedCall(350, () => {
                const prevPeriod = GameState.period;
                GameState.advanceDay();
                if (GameState.period !== prevPeriod) {
                    this.scene.start('Transition', { period: GameState.period });
                } else {
                    this.scene.start('Briefing');
                }
            });
        });

        // Period/day counter at bottom
        this.add.text(cx, 660, `Period ${GameState.period}  |  Day ${GameState.day} of 2`, {
            fontFamily: 'monospace', fontSize: '12px', color: '#333333',
        }).setOrigin(0.5);

        this.cameras.main.fadeIn(400, 0, 0, 0);
    }
}

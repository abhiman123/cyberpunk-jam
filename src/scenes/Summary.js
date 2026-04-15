import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

export default class SummaryScene extends Phaser.Scene {
    constructor() { super('Summary'); }

    init(data) {
        this._mistakes         = data.mistakes        || 0;
        this._paycheckDelta    = data.paycheckDelta   || 0;
        this._notificationText = data.notificationText || '';
    }

    create() {
        const W  = 1280;
        const H  = 720;
        const cx = W / 2;

        this.add.rectangle(cx, H / 2, W, H, 0x060606);

        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.06);
        for (let y = 0; y < H; y += 3) scan.fillRect(0, y, W, 1);

        const accentColor = this._mistakes > 0 ? 0xcc3333 : 0x1a7a3a;
        this.add.rectangle(cx, 0, W, 2, accentColor).setOrigin(0.5, 0);

        this.add.text(cx, 72, 'END OF SHIFT', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#dddddd',
            letterSpacing: 6,
        }).setOrigin(0.5);

        this.add.text(cx, 102, `PERIOD ${GameState.period}  ·  DAY ${GameState.day} OF 2`, {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#aaaaaa',
            letterSpacing: 4,
        }).setOrigin(0.5);

        this._rule(140, 0x333333);

        const hasViolations = this._mistakes > 0;
        const statusColor   = hasViolations ? '#ff4444' : '#00cc66';
        const statusText    = hasViolations
            ? `${this._mistakes} VIOLATION${this._mistakes > 1 ? 'S' : ''} RECORDED`
            : 'NO VIOLATIONS';

        this.add.text(cx, 188, 'QC ASSESSMENT', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#bbbbbb',
            letterSpacing: 5,
        }).setOrigin(0.5);

        this.add.text(cx, 224, statusText, {
            fontFamily: 'monospace',
            fontSize: '26px',
            color: statusColor,
        }).setOrigin(0.5);

        this._rule(268, 0x333333);

        this.add.text(cx, 300, 'COMPENSATION LOG', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#bbbbbb',
            letterSpacing: 5,
        }).setOrigin(0.5);

        const deltaStr = `-$${Math.abs(this._paycheckDelta).toFixed(8)}`;
        const totalStr = `$${Math.max(0, GameState.paycheckTotal).toFixed(8)}`;

        this.add.text(cx - 80, 338, 'DEDUCTED', {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
        }).setOrigin(1, 0.5);
        this.add.text(cx - 64, 338, deltaStr, {
            fontFamily: 'monospace', fontSize: '13px',
            color: hasViolations ? '#ff5555' : '#aaaaaa',
        }).setOrigin(0, 0.5);

        this.add.text(cx - 80, 362, 'RUNNING', {
            fontFamily: 'monospace', fontSize: '10px', color: '#aaaaaa',
        }).setOrigin(1, 0.5);
        this.add.text(cx - 64, 362, totalStr, {
            fontFamily: 'monospace', fontSize: '13px', color: '#44cc88',
        }).setOrigin(0, 0.5);

        if (this._notificationText) {
            this._rule(410, 0x333333);

            const tagText = this.add.text(cx, 440, '// INCOMING TRANSMISSION', {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#55cc55',
                letterSpacing: 3,
            }).setOrigin(0.5);

            const msgText = this.add.text(cx, 490, this._notificationText, {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#aaddaa',
                wordWrap: { width: 660 },
                align: 'center',
                lineSpacing: 8,
            }).setOrigin(0.5);


            this._flicker(tagText);
            this._flicker(msgText, 80);
        }


        this._rule(600, 0x333333);

        const btnY  = 648;
        const btnBg = this.add.rectangle(cx, btnY, 200, 38, 0x0c0c0c)
            .setStrokeStyle(1, 0x555555)
            .setInteractive({ useHandCursor: true });

        const btnLabel = this.add.text(cx, btnY, 'NEXT SHIFT', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#cccccc',
            letterSpacing: 4,
        }).setOrigin(0.5);

        let transitioning = false;

        btnBg.on('pointerover', () => {
            btnBg.setStrokeStyle(1, accentColor);
            btnLabel.setColor(this._mistakes > 0 ? '#ff4444' : '#00cc66');
        });
        btnBg.on('pointerout', () => {
            btnBg.setStrokeStyle(1, 0x555555);
            btnLabel.setColor('#999999');
        });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            transitioning = true;
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => {
                const prevPeriod = GameState.period;
                GameState.advanceDay();
                if (GameState.period !== prevPeriod) {
                    this.scene.start('Transition', { period: GameState.period });
                } else {
                    this.scene.start('Briefing');
                }
            });
        });

        this.cameras.main.fadeIn(500, 0, 0, 0);
    }


    _rule(y, color = 0x333333) {
        const g = this.add.graphics();
        g.lineStyle(1, color, 1);
        g.lineBetween(280, y, 1000, y);
    }

    _flicker(obj, baseDelay = 0) {
        const tick = () => {
            const delay  = baseDelay + Phaser.Math.Between(1800, 4200);
            const alpha  = Phaser.Math.FloatBetween(0.55, 1.0);
            const dur    = Phaser.Math.Between(40, 120);
            this.time.delayedCall(delay, () => {
                if (!obj.active) return;
                this.tweens.add({
                    targets: obj,
                    alpha,
                    duration: dur,
                    yoyo: true,
                    ease: 'Stepped',
                    onComplete: tick,
                });
            });
        };
        tick();
    }
}

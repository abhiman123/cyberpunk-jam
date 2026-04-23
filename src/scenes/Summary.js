import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../constants/gameConstants.js';
import { getMusicVolume } from '../state/gameSettings.js';

export default class SummaryScene extends Phaser.Scene {
    constructor() { super('Summary'); }

    init(data) {
        this._mistakes         = data.mistakes         || 0;
        this._paycheckDelta    = data.paycheckDelta    || 0;
        this._casesProcessed   = data.casesProcessed   || 0;
        this._summaryAdjustments = Array.isArray(data.summaryAdjustments) ? data.summaryAdjustments : [];
        this._notificationText = data.notificationText || '';
    }

    create() {
        const W  = 1280;
        const H  = 720;
        const cx = W / 2;

        applyCyberpunkLook(this);

        this.add.rectangle(cx, H / 2, W, H, 0x060606);

        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.06);
        for (let y = 0; y < H; y += 3) scan.fillRect(0, y, W, 1);

        const accentColor = this._mistakes > 0 ? 0xcc3333 : 0x1a7a3a;
        this.add.rectangle(cx, 0, W, 2, accentColor).setOrigin(0.5, 0);

        this.add.text(cx, 72, 'END OF DAY', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#eeeeee', letterSpacing: 6,
        }).setOrigin(0.5);

        this.add.text(cx, 104, `DAY ${GameState.day} COMPLETE`, {
            fontFamily: 'Courier New', fontSize: '13px', color: '#cccccc', letterSpacing: 4,
        }).setOrigin(0.5);

        this._rule(140, 0x333333);

        const hasViolations = this._mistakes > 0;
        const statusColor   = hasViolations ? '#ff4444' : '#00cc66';
        const statusText    = hasViolations
            ? `${this._mistakes} VIOLATION${this._mistakes > 1 ? 'S' : ''} RECORDED`
            : 'NO VIOLATIONS';

        this.add.text(cx, 180, 'QC ASSESSMENT', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#dddddd', letterSpacing: 5,
        }).setOrigin(0.5);

        this.add.text(cx, 216, statusText, {
            fontFamily: 'Courier New', fontSize: '28px', color: statusColor,
        }).setOrigin(0.5);

        // Cases processed
        this.add.text(cx, 262, `CASES PROCESSED: ${this._casesProcessed}`, {
            fontFamily: 'Courier New', fontSize: '13px', color: '#aaaaaa', letterSpacing: 2,
        }).setOrigin(0.5);

        // Cumulative violations across all days
        const totalMistakes = GameState.totalMistakes;
        const cumulativeColor = totalMistakes > 0 ? '#ff7777' : '#55cc88';
        this.add.text(cx, 286, `TOTAL VIOLATIONS (ALL DAYS): ${totalMistakes}`, {
            fontFamily: 'Courier New', fontSize: '12px', color: cumulativeColor, letterSpacing: 2,
        }).setOrigin(0.5);

        this._rule(310, 0x333333);

        this.add.text(cx, 328, 'COMPENSATION LOG', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#dddddd', letterSpacing: 5,
        }).setOrigin(0.5);

        const deltaSign = this._paycheckDelta >= 0 ? '+' : '-';
        const deltaStr  = `${deltaSign}$${Math.abs(this._paycheckDelta).toFixed(2)}`;
        const totalStr  = `$${Math.max(0, GameState.paycheckTotal).toFixed(2)}`;
        const compensationRows = [
            {
                label: 'FROM WORK',
                value: deltaStr,
                color: hasViolations ? '#ff5555' : '#aaaaaa',
            },
            ...this._summaryAdjustments.map((entry) => ({
                label: String(entry.label || 'ADJUSTMENT').toUpperCase(),
                value: `${Number(entry.amount || 0) >= 0 ? '+' : '-'}$${Math.abs(Number(entry.amount || 0)).toFixed(2)}`,
                color: Number(entry.amount || 0) >= 0 ? '#d8c46a' : '#ff7777',
            })),
            {
                label: 'RUNNING',
                value: totalStr,
                color: '#44cc88',
            },
        ];

        const compensationStartY = 366;
        const compensationLineGap = 26;

        compensationRows.forEach((row, index) => {
            const y = compensationStartY + (index * compensationLineGap);
            this.add.text(cx - 80, y, row.label, {
                fontFamily: 'Courier New', fontSize: '13px', color: '#cccccc',
            }).setOrigin(1, 0.5);
            this.add.text(cx - 64, y, row.value, {
                fontFamily: 'Courier New', fontSize: '15px', color: row.color,
            }).setOrigin(0, 0.5);
        });

        if (this._notificationText) {
            const notificationRuleY = 420 + Math.max(0, compensationRows.length - 2) * compensationLineGap;
            this._rule(notificationRuleY, 0x333333);

            const tagText = this.add.text(cx, notificationRuleY + 30, '// INCOMING TRANSMISSION', {
                fontFamily: 'Courier New', fontSize: '13px', color: '#55cc55', letterSpacing: 3,
            }).setOrigin(0.5);

            const msgText = this.add.text(cx, notificationRuleY + 76, this._notificationText, {
                fontFamily: 'Courier New', fontSize: '16px', color: '#cceecc',
                wordWrap: { width: 660 }, align: 'center', lineSpacing: 8,
            }).setOrigin(0.5);

            this._flicker(tagText);
            this._flicker(msgText, 80);
        }

        this._rule(600, 0x333333);

        // Music
        this._music = null;
        const musicVolume = getMusicVolume();
        if (musicVolume > 0 && this.cache.audio.has(SOUND_ASSETS.paydayMusic.key)) {
            this._music = this.sound.add(SOUND_ASSETS.paydayMusic.key, { loop: true, volume: 0 });
            this._music.play();
            this.tweens.add({ targets: this._music, volume: SOUND_VOLUMES.music * musicVolume, duration: 800 });
        }

        // NEXT SHIFT button
        const isLastDay = GameState.isLastDay();
        const btnY    = 648;
        const btnBg   = this.add.rectangle(cx, btnY, 200, 38, 0x0c0c0c)
            .setStrokeStyle(1, 0x555555)
            .setInteractive({ useHandCursor: true });
        const btnLabel = this.add.text(cx, btnY, isLastDay ? 'END RUN' : 'NEXT DAY', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#cccccc', letterSpacing: 4,
        }).setOrigin(0.5);

        let transitioning = false;

        btnBg.on('pointerover', () => {
            btnBg.setStrokeStyle(1, accentColor);
            btnLabel.setColor(hasViolations ? '#ff4444' : '#00cc66');
        });
        btnBg.on('pointerout', () => {
            btnBg.setStrokeStyle(1, 0x555555);
            btnLabel.setColor('#cccccc');
        });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            transitioning = true;

            const doTransition = () => {
                if (GameState.isLastDay()) {
                    this.scene.start('End');
                    return;
                }

                GameState.advanceDay();
                this.scene.start('Transition', { day: GameState.day });
            };

            if (this._music) {
                this.tweens.add({
                    targets: this._music, volume: 0, duration: 400,
                    onComplete: () => { this._music.stop(); doTransition(); },
                });
            } else {
                this.cameras.main.fade(400, 0, 0, 0);
                this.time.delayedCall(400, () => doTransition());
            }
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
            const delay = baseDelay + Phaser.Math.Between(1800, 4200);
            const alpha = Phaser.Math.FloatBetween(0.55, 1.0);
            const dur   = Phaser.Math.Between(40, 120);
            this.time.delayedCall(delay, () => {
                if (!obj.active) return;
                this.tweens.add({
                    targets: obj, alpha, duration: dur,
                    yoyo: true, ease: 'Stepped', onComplete: tick,
                });
            });
        };
        tick();
    }
}

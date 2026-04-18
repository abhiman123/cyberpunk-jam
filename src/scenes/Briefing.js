import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import Animations from '../fx/Animations.js';

const PERIOD_BG     = { 1: 0x1a1510, 2: 0x101418, 3: 0x080d14 };
const PERIOD_ACCENT = { 1: 0x886644, 2: 0x446688, 3: 0x2244aa };

export default class BriefingScene extends Phaser.Scene {
    constructor() { super('Briefing'); }

    create() {
        const { period, day } = GameState;
        const allBriefings = this.cache.json.get('briefings');
        const allRules     = this.cache.json.get('rules');

        const briefing = allBriefings.find(b => b.period === period && b.day === day)
            || { managerType: 'human', text: 'No directives. Complete your shift.' };

        const newRules = allRules.filter(r => r.period === period && !GameState.rulebookSeenRules.has(r.id));

        const accent = PERIOD_ACCENT[period] || 0x333333;
        const W = 1280, H = 720, cx = W / 2;

        this.add.rectangle(cx, H / 2, W, H, PERIOD_BG[period] || 0x101010);

        this.add.rectangle(cx, 0, W, 2, accent).setOrigin(0.5, 0);

        this.add.text(cx, 42, `PERIOD ${period}  ·  DAY ${day} OF 2`, {
            fontFamily: 'Courier New', fontSize: '10px', color: '#aaaaaa', letterSpacing: 5,
        }).setOrigin(0.5);

        this.add.text(cx, 68, 'MANAGER BRIEFING', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#dddddd', letterSpacing: 6,
        }).setOrigin(0.5);

        this._rule(96, accent, 0.12);

        const spriteKey = briefing.managerType === 'robot' ? 'manager_robot' : 'manager_human';
        this.add.image(160, 340, spriteKey).setScale(2.5);

        const managerLabel = briefing.managerType === 'robot' ? 'UNIT_MGR_492' : 'MANAGER';
        this.add.text(160, 460, managerLabel, {
            fontFamily: 'Courier New', fontSize: '10px', color: '#bbbbbb', letterSpacing: 3,
        }).setOrigin(0.5);

        const boxX = 320, boxY = 130, boxW = 860, boxH = 260;
        this.add.rectangle(boxX + boxW / 2, boxY + boxH / 2, boxW, boxH, 0x0c0c0c)
            .setStrokeStyle(1, accent, 0.25);

        this._typewriterText = this.add.text(boxX + 28, boxY + 28, '', {
            fontFamily: 'Courier New', fontSize: '15px', color: '#aaaaaa',
            wordWrap: { width: boxW - 56 }, lineSpacing: 8,
        });

        if (newRules.length > 0) {
            this._rule(420, accent, 0.1);
            this.add.text(320, 440, 'NEW DIRECTIVES', {
                fontFamily: 'Courier New', fontSize: '10px', color: '#dddddd', letterSpacing: 5,
            });
            let ry = 466;
            newRules.forEach(r => {
                const t = this.add.text(320, ry, `[${r.id}]  ${r.text}`, {
                    fontFamily: 'Courier New', fontSize: '13px', color: '#ccaa33',
                    wordWrap: { width: 860 },
                });
                ry += t.height + 10;
                GameState.rulebookSeenRules.add(r.id);
            });
        }

        // Music
        this._music = null;
        if (this.cache.audio.has('music_manager')) {
            this._music = this.sound.add('music_manager', { loop: true, volume: 0 });
            this._music.play();
            this.tweens.add({ targets: this._music, volume: 0.7, duration: 800 });
        }

        // ACKNOWLEDGED button
        let textDone    = false;
        let transitioning = false;

        const btnBg = this.add.rectangle(cx, 648, 200, 38, 0x0c0c0c)
            .setStrokeStyle(1, 0x444444)
            .setAlpha(0.4)
            .setInteractive({ useHandCursor: true });

        const btnLabel = this.add.text(cx, 648, 'ACKNOWLEDGED', {
            fontFamily: 'monospace', fontSize: '12px', color: '#666666', letterSpacing: 4,
        }).setOrigin(0.5);

        const markTextDone = () => {
            if (textDone) return;
            textDone = true;
            btnBg.setAlpha(1).setStrokeStyle(1, 0x888888);
            btnLabel.setColor('#dddddd');
        };

        const doTransition = () => {
            transitioning = true;
            if (this._music) {
                this.tweens.add({
                    targets: this._music, volume: 0, duration: 400,
                    onComplete: () => { this._music.stop(); this.scene.start('Game'); },
                });
            } else {
                this.cameras.main.fade(300, 0, 0, 0);
                this.time.delayedCall(300, () => this.scene.start('Game'));
            }
        };

        btnBg.on('pointerover', () => { if (textDone) { btnBg.setStrokeStyle(1, accent); btnLabel.setColor('#ffffff'); } });
        btnBg.on('pointerout',  () => { if (textDone) { btnBg.setStrokeStyle(1, 0x888888); btnLabel.setColor('#dddddd'); } });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            if (!textDone) {
                typeEvent.remove();
                this._typewriterText.setText(fullText);
                markTextDone();
                return;
            }
            doTransition();
        });

        const fullText = briefing.text;
        const typeEvent = Animations.typewriter(this, this._typewriterText, fullText, 38, markTextDone);

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.3);
        for (let y = 0; y < H; y += 4) scan.fillRect(0, y, W, 2);

        this.cameras.main.fadeIn(400, 0, 0, 0);
    }

    _rule(y, color = 0x333333, alpha = 1) {
        const g = this.add.graphics();
        g.lineStyle(1, color, alpha);
        g.lineBetween(280, y, 1000, y);
    }
}

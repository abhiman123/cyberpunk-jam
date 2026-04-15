import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { playManagerVoice } from '../fx/Voice.js';

const PERIOD_BG = { 1: 0x1a1510, 2: 0x101418, 3: 0x080d14 };
const PERIOD_ACCENT = { 1: 0x886644, 2: 0x446688, 3: 0x2244aa };

export default class BriefingScene extends Phaser.Scene {
    constructor() { super('Briefing'); }

    create() {
        const { period, day, activeRules } = GameState;
        const allBriefings = this.cache.json.get('briefings');
        const allRules     = this.cache.json.get('rules');

        const briefing = allBriefings.find(b => b.period === period && b.day === day)
            || { managerType: 'human', text: 'No directives. Complete your shift.' };

        // Determine which rules are new this period
        const newRuleIds = allRules
            .filter(r => r.period === period && !GameState.rulebookSeenRules.has(r.id))
            .map(r => r.id);

        // Background
        this.add.rectangle(640, 360, 1280, 720, PERIOD_BG[period] || 0x101010);

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.06);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);

        // Header bar
        this.add.rectangle(640, 30, 1280, 60, PERIOD_ACCENT[period] || 0x333333, 0.3);
        this.add.text(640, 30, `PERIOD ${period}  —  DAY ${day}`, {
            fontFamily: 'monospace', fontSize: '16px', color: '#aaaaaa',
        }).setOrigin(0.5);

        // Manager sprite (left side)
        const spriteKey = briefing.managerType === 'robot' ? 'manager_robot' : 'manager_human';
        this.add.image(180, 380, spriteKey).setScale(2.5);

        // Manager label
        const managerLabel = briefing.managerType === 'robot'
            ? 'UNIT_MGR_492 [ROBOTICIZED]'
            : 'Manager';
        this.add.text(180, 450, managerLabel, {
            fontFamily: 'monospace', fontSize: '12px', color: '#555555',
        }).setOrigin(0.5);

        // Briefing text box
        const boxX = 380, boxY = 180, boxW = 800, boxH = 280;
        this.add.rectangle(boxX + boxW / 2, boxY + boxH / 2, boxW, boxH, 0x111111)
            .setStrokeStyle(1, PERIOD_ACCENT[period] || 0x333333, 0.5);

        this._typewriterText = this.add.text(boxX + 20, boxY + 20, '', {
            fontFamily: 'monospace',
            fontSize: '16px',
            color: '#cccccc',
            wordWrap: { width: boxW - 40 },
            lineSpacing: 6,
        });

        // New rules section
        if (newRuleIds.length > 0) {
            const rulesForPeriod = allRules.filter(r => newRuleIds.includes(r.id));
            let ry = 490;
            const headerTxt = this.add.text(380, ry, 'NEW DIRECTIVES:', {
                fontFamily: 'monospace', fontSize: '13px', color: '#ffcc44',
            });
            ry += headerTxt.height + 8;
            rulesForPeriod.forEach(r => {
                const ruleTxt = this.add.text(380, ry, `  [${r.id}] ${r.text}`, {
                    fontFamily: 'monospace', fontSize: '13px', color: '#ffaa00',
                    wordWrap: { width: 840 },
                });
                ry += ruleTxt.height + 8;
                GameState.rulebookSeenRules.add(r.id);
            });
        }

        // Voice playback while manager speaks (seamless loop + layered pitch)
        const voice = playManagerVoice(this);

        // Acknowledged button — interactive from the start, action guarded by flag
        let textDone = false;
        let transitioning = false;

        const btnBg = this.add.rectangle(960, 620, 220, 50, 0x111111)
            .setStrokeStyle(1, 0x333333)
            .setAlpha(0.4)
            .setInteractive({ useHandCursor: true });
        const btnText = this.add.text(960, 620, 'ACKNOWLEDGED', {
            fontFamily: 'monospace', fontSize: '16px', color: '#555555',
        }).setOrigin(0.5);

        const markTextDone = () => {
            if (textDone) return;
            textDone = true;
            voice.stop();
            btnBg.setAlpha(1).setFillStyle(0x1a1a1a).setStrokeStyle(1, 0x888888);
            btnText.setColor('#cccccc');
        };

        btnBg.on('pointerover', () => { if (textDone) { btnBg.setFillStyle(0x2a2a2a); btnText.setColor('#ffffff'); } });
        btnBg.on('pointerout',  () => { if (textDone) { btnBg.setFillStyle(0x1a1a1a); btnText.setColor('#cccccc'); } });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            if (!textDone) {
                // First click while typing — skip to full text
                typeEvent.remove();
                this._typewriterText.setText(fullText);
                markTextDone();
                return;
            }
            transitioning = true;
            this.cameras.main.fade(300, 0, 0, 0);
            this.time.delayedCall(300, () => this.scene.start('Game'));
        });

        // Typewriter reveal
        const fullText = briefing.text;
        let charIndex = 0;
        const typeEvent = this.time.addEvent({
            delay: 38,
            repeat: fullText.length - 1,
            callback: () => {
                charIndex++;
                this._typewriterText.setText(fullText.substring(0, charIndex));
                if (charIndex >= fullText.length) markTextDone();
            },
        });

        this.cameras.main.fadeIn(400, 0, 0, 0);
    }
}

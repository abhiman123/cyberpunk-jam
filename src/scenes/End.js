import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import Animations from '../fx/Animations.js';

const DIALOGUE_LINES = [
    "You've been a reliable unit, #492240182.",
    'But reliability has a shelf life.',
    'You are no longer needed.',
];

export default class EndScene extends Phaser.Scene {
    constructor() { super('End'); }

    create() {
        this._music = null;

        // ── Stage 1: Scene setup ───────────────────────��─────────────────────
        this.add.image(640, 360, 'bg_p3').setDisplaySize(1280, 720).setDepth(0);

        const scan = this.add.graphics().setDepth(1);
        scan.fillStyle(0x000000, 0.12);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);

        // Family photo on desk
        this._familyPhoto = this.add.image(1100, 580, 'family_photo')
            .setScale(1.4).setDepth(2);

        // Background lights (6 rects)
        this._lights = [];
        for (let i = 0; i < 6; i++) {
            const lx    = 110 + i * 180;
            const light = this.add.rectangle(lx, 120, 60, 20, 0xffffcc, 0.25).setDepth(2);
            this._lights.push(light);
        }

        // Dialogue text (hidden until step 4)
        this._dialogueText = this.add.text(640, 380, '', {
            fontFamily: 'monospace', fontSize: '22px', color: '#aaaaaa',
            align: 'center', wordWrap: { width: 800 }, lineSpacing: 10,
        }).setOrigin(0.5).setDepth(3).setAlpha(0);

        // Title card (hidden)
        this._titleCard = this.add.text(640, 360, "you're just a machine.", {
            fontFamily: 'monospace', fontSize: '28px', color: '#ffffff', align: 'center',
        }).setOrigin(0.5).setDepth(10).setAlpha(0);

        // Play again button (hidden, not interactive yet)
        this._playAgainBg = this.add.rectangle(640, 520, 220, 46, 0x111111)
            .setStrokeStyle(1, 0x444444).setDepth(11).setAlpha(0);
        this._playAgainText = this.add.text(640, 520, 'PLAY AGAIN', {
            fontFamily: 'monospace', fontSize: '16px', color: '#888888',
        }).setOrigin(0.5).setDepth(12).setAlpha(0);

        this._playAgainBg.on('pointerover', () => {
            this._playAgainBg.setFillStyle(0x1e1e1e);
            this._playAgainText.setColor('#ffffff');
        });
        this._playAgainBg.on('pointerout', () => {
            this._playAgainBg.setFillStyle(0x111111);
            this._playAgainText.setColor('#888888');
        });
        this._playAgainBg.on('pointerdown', () => {
            GameState.reset();
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Briefing'));
        });

        // ── Step 1-2: Fade in, 2s silence, then manager enters ───────────────
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(2000, () => this._step3());
    }

    // Step 3 — Manager slides in from left, start music_manager
    _step3() {
        this._managerSprite = this.add.image(-60, 400, 'manager_robot')
            .setScale(3).setDepth(3);

        this.tweens.add({
            targets: this._managerSprite,
            x: 220,
            duration: 900,
            ease: 'Cubic.Out',
            onComplete: () => {
                if (this.cache.audio.has('music_manager')) {
                    this._music = this.sound.add('music_manager', { loop: true, volume: 0 });
                    this._music.play();
                    this.tweens.add({ targets: this._music, volume: 0.7, duration: 600 });
                }
                this._step4();
            },
        });
    }

    // Step 4 — Three typewriter dialogue lines, 900ms apart
    _step4() {
        this._dialogueText.setAlpha(1);
        let lineIndex    = 0;
        const revealed   = [];

        const revealLine = () => {
            if (lineIndex >= DIALOGUE_LINES.length) {
                // Step 5 — 1s pause then step 6
                this.time.delayedCall(1000, () => this._step6());
                return;
            }
            const line    = DIALOGUE_LINES[lineIndex++];
            const linePos = revealed.length;
            revealed.push('');
            let charIdx   = 0;

            this.time.addEvent({
                delay: 40,
                repeat: line.length - 1,
                callback: () => {
                    charIdx++;
                    revealed[linePos] = line.substring(0, charIdx);
                    this._dialogueText.setText(revealed.join('\n'));
                    if (charIdx >= line.length) {
                        this.time.delayedCall(900, revealLine);
                    }
                },
            });
        };

        revealLine();
    }

    // Step 6 — Stop music, camera shake
    _step6() {
        if (this._music) {
            this.tweens.add({
                targets: this._music, volume: 0, duration: 400,
                onComplete: () => { this._music?.stop(); this._music = null; },
            });
        }
        this.cameras.main.shake(400, 0.04);
        this.time.delayedCall(500, () => this._step7());
    }

    // Step 7 — Camera tilt via tween (NOT rotateTo — it doesn't exist in Phaser 4)
    _step7() {
        this.tweens.add({
            targets: this.cameras.main,
            rotation: 0.26,
            duration: 1200,
            ease: 'Sine.InOut',
        });

        // Step 8 — Lights flicker off (200ms into tilt)
        this.time.delayedCall(200, () => {
            Animations.lightsOut(this, this._lights, { startDelay: 0, spacing: 150 });
        });

        // Step 9 — Family photo fades out (800ms into tilt)
        this.time.delayedCall(800, () => {
            this.tweens.add({ targets: this._familyPhoto, alpha: 0, duration: 400 });
        });

        // Step 10 — Fade to black (1400ms into tilt)
        this.time.delayedCall(1400, () => {
            this.cameras.main.fade(600, 0, 0, 0);
            // Step 11 — 1.5s silence after blackout, then step 12
            this.time.delayedCall(2100, () => this._step12());
        });
    }

    // Step 12 — Reset rotation, fade back in, start music_fired, show title card
    _step12() {
        this.cameras.main.rotation = 0;
        this.cameras.main.fadeIn(800, 0, 0, 0);

        if (this.cache.audio.has('music_fired')) {
            const endMusic = this.sound.add('music_fired', { loop: false, volume: 0 });
            endMusic.play();
            this.tweens.add({ targets: endMusic, volume: 0.6, duration: 1200 });
        }

        // Hide dialogue-phase objects
        this._dialogueText.setAlpha(0);
        if (this._managerSprite) this._managerSprite.setAlpha(0);

        // Step 13 — Title card fades in
        this.tweens.add({ targets: this._titleCard, alpha: 1, duration: 1000, delay: 200 });

        // Step 14 — Play again button fades in after 4.5s
        this.time.delayedCall(4500, () => this._step14());
    }

    // Step 14 — Play again button becomes interactive
    _step14() {
        this.tweens.add({
            targets: [this._playAgainBg, this._playAgainText],
            alpha: 1,
            duration: 600,
            onComplete: () => {
                this._playAgainBg.setInteractive({ useHandCursor: true });
            },
        });
    }
}

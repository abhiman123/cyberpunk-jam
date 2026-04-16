import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { playManagerVoice } from '../fx/Voice.js';

export default class EndScene extends Phaser.Scene {
    constructor() { super('End'); }

    create() {
        // ── Stage 1: Empty briefing room ────────────────────────────────────
        this.add.image(640, 360, 'bg_p3');

        // Scanlines
        const scan = this.add.graphics().setDepth(1);
        scan.fillStyle(0x000000, 0.12);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);

        // Family photo on desk (stays until lights out)
        this._familyPhoto = this.add.image(1100, 580, 'family_photo')
            .setScale(1.4).setDepth(2);

        // Light sprites (6 across background — just colored rects for now)
        this._lights = [];
        for (let i = 0; i < 6; i++) {
            const lx = 110 + i * 180;
            const light = this.add.rectangle(lx, 120, 60, 20, 0xffffcc, 0.25)
                .setDepth(2);
            this._lights.push(light);
        }

        // Dialogue text container
        this._dialogueText = this.add.text(640, 380, '', {
            fontFamily: 'monospace',
            fontSize: '22px',
            color: '#aaaaaa',
            align: 'center',
            wordWrap: { width: 800 },
            lineSpacing: 10,
        }).setOrigin(0.5).setDepth(3);

        // Title card text (hidden until needed)
        this._titleCard = this.add.text(640, 360, "you're just a machine.", {
            fontFamily: 'monospace',
            fontSize: '28px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5).setDepth(10).setAlpha(0);

        // Play again button (hidden)
        this._playAgainBg = this.add.rectangle(640, 520, 200, 46, 0x111111)
            .setStrokeStyle(1, 0x444444).setDepth(11).setAlpha(0);
        this._playAgainText = this.add.text(640, 520, 'PLAY AGAIN', {
            fontFamily: 'monospace', fontSize: '16px', color: '#888888',
        }).setOrigin(0.5).setDepth(12).setAlpha(0);

        // Not interactive yet — enabled when visible (in _showTitleCard)
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
            this.time.delayedCall(400, () => this.scene.start('Workshop'));
        });

        // ── Begin sequence after 2s ──────────────────────────────────────────
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(2000, () => this._enterRobotManager());
    }

    // ── Beat 2: Robot-manager enters ─────────────────────────────────────────
    _enterRobotManager() {
        this._managerSprite = this.add.image(-60, 400, 'manager_robot')
            .setScale(3).setDepth(3);

        this.tweens.add({
            targets: this._managerSprite,
            x: 220,
            duration: 900,
            ease: 'Cubic.Out',
            onComplete: () => this._startDialogue(),
        });
    }

    // ── Beat 3: Typewriter dialogue ──────────────────────────────────────────
    _startDialogue() {
        const lines = [
            'You\'ve been a reliable unit, #492240182.',
            'But reliability has a shelf life.',
            'You are no longer needed.',
        ];
        let lineIndex = 0;

        this._voice = playManagerVoice(this);

        const revealLine = () => {
            if (lineIndex >= lines.length) {
                // All lines done — stop voice, wait then trigger shake
                if (this._voice) { this._voice.stop(); this._voice = null; }
                this.time.delayedCall(1000, () => this._shakeSequence());
                return;
            }
            const line = lines[lineIndex];
            lineIndex++;
            let charIdx = 0;
            const displayed = lines.slice(0, lineIndex - 1).join('\n');

            this.time.addEvent({
                delay: 40,
                repeat: line.length - 1,
                callback: () => {
                    charIdx++;
                    const current = displayed
                        ? displayed + '\n' + line.substring(0, charIdx)
                        : line.substring(0, charIdx);
                    this._dialogueText.setText(current);
                    if (charIdx >= line.length) {
                        this.time.delayedCall(800, revealLine);
                    }
                },
            });
        };

        revealLine();
    }

    // ── Beat 4–7: Shake, tilt, lights out, black ────────────────────────────
    _shakeSequence() {
        // Shake
        this.cameras.main.shake(400, 0.04);

        // Tilt after shake
        this.time.delayedCall(500, () => {
            this.cameras.main.rotateTo(0.26, false, 1200);

            // Flicker lights out left-to-right
            this._lights.forEach((light, i) => {
                this.time.delayedCall(400 + i * 150, () => {
                    this.tweens.add({
                        targets: light,
                        alpha: 0,
                        duration: 200,
                    });
                });
            });

            // Fade family photo just before full blackout
            this.time.delayedCall(800, () => {
                this.tweens.add({
                    targets: this._familyPhoto,
                    alpha: 0,
                    duration: 400,
                });
            });

            // Fade to black
            this.time.delayedCall(1400, () => {
                this.cameras.main.fade(600, 0, 0, 0);
                this.time.delayedCall(2100, () => this._showTitleCard());
            });
        });
    }

    // ── Beat 8–10: Title card + play again ──────────────────────────────────
    _showTitleCard() {
        // Hide everything from the dialogue stage so it doesn't bleed through
        this._dialogueText.setAlpha(0);
        if (this._managerSprite) this._managerSprite.setAlpha(0);
        this._lights.forEach(l => l.setAlpha(0));

        // Reset camera rotation for title card
        this.cameras.main.setRotation(0);
        this.cameras.main.fadeIn(800, 0, 0, 0);

        this.tweens.add({
            targets: this._titleCard,
            alpha: 1,
            duration: 1000,
            delay: 200,
        });

        // Play again button fades in after 4.5s, then becomes interactive
        this.time.delayedCall(4500, () => {
            this.tweens.add({
                targets: [this._playAgainBg, this._playAgainText],
                alpha: 1,
                duration: 600,
                onComplete: () => {
                    this._playAgainBg.setInteractive({ useHandCursor: true });
                },
            });
        });
    }
}

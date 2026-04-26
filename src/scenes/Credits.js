import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS } from '../constants/gameConstants.js';
import { getMusicVolume } from '../state/gameSettings.js';

const SCREEN_W = 1280;
const SCREEN_H = 720;

const CREDITS = Object.freeze([
    { role: 'PROGRAMMING', names: [
        'Abhimanyu Bhalla',
        'Safiullah Baig',
        'Andrew Bui',
        'Orion Allen Borntrager',
        'Ethan Nishimura',
        'Minh Tran',
    ] },
    { role: 'ART', names: [
        'Pranaav Makharia',
        'Pranet Ramanan',
        'Jacqueline King',
    ] },
    { role: 'STORYBOARDING', names: [
        'Jacqueline King',
        'Jake Verell',
        'Geetika Joshi',
    ] },
    { role: 'SOUND', names: [
        'Shane Ollek',
        'Julien Vincent',
    ] },
]);

export default class CreditsScene extends Phaser.Scene {
    constructor() {
        super('Credits');
    }

    create() {
        this._music = null;

        applyCyberpunkLook(this);
        this.cameras.main.setBackgroundColor('#050709');
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Subtle scanline overlay to match End scene's aesthetic.
        const scan = this.add.graphics().setDepth(100);
        scan.fillStyle(0x000000, 0.24);
        for (let y = 0; y < SCREEN_H; y += 4) {
            scan.fillRect(0, y, SCREEN_W, 2);
        }

        this._scrollContainer = this.add.container(SCREEN_W / 2, SCREEN_H);
        const contentHeight = this._buildCreditsContent(this._scrollContainer);

        // Distance: header starts off the bottom and the last line passes the top.
        // ~75 px/sec gives a comfortable read pace.
        const travel = SCREEN_H + contentHeight + 80;
        const duration = Math.max(18000, Math.round((travel / 75) * 1000));

        this._scrollTween = this.tweens.add({
            targets: this._scrollContainer,
            y: SCREEN_H - travel,
            duration,
            ease: 'Linear',
            onComplete: () => this._revealPlayAgain(),
        });

        this._buildPlayAgain();
        this._installSkipHandler();
        this._playMusic();

        this.events.on('shutdown', () => {
            this._music?.stop();
            this._music = null;
        });
    }

    _buildCreditsContent(container) {
        let cursor = 0;

        const header = this.add.text(0, cursor, 'CREDITS', {
            fontFamily: 'Courier New',
            fontSize: '54px',
            color: '#cdefff',
            align: 'center',
            letterSpacing: 8,
        }).setOrigin(0.5, 0);
        container.add(header);
        cursor += header.height + 80;

        CREDITS.forEach((section) => {
            const role = this.add.text(0, cursor, section.role, {
                fontFamily: 'Courier New',
                fontSize: '24px',
                color: '#8dd6ec',
                align: 'center',
                letterSpacing: 6,
            }).setOrigin(0.5, 0);
            container.add(role);
            cursor += role.height + 18;

            section.names.forEach((name) => {
                const line = this.add.text(0, cursor, name, {
                    fontFamily: 'Courier New',
                    fontSize: '22px',
                    color: '#ffffff',
                    align: 'center',
                }).setOrigin(0.5, 0);
                container.add(line);
                cursor += line.height + 6;
            });

            cursor += 44;
        });

        return cursor;
    }

    _buildPlayAgain() {
        this._playAgainBg = this.add.rectangle(SCREEN_W / 2, SCREEN_H - 80, 220, 46, 0x0a0a0a)
            .setStrokeStyle(1, 0x334455)
            .setDepth(50)
            .setAlpha(0)
            .setInteractive({ useHandCursor: true });
        this._playAgainText = this.add.text(SCREEN_W / 2, SCREEN_H - 80, 'PLAY AGAIN', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#778899',
        }).setOrigin(0.5).setDepth(51).setAlpha(0);

        this._playAgainBg.on('pointerover', () => {
            this._playAgainBg.setStrokeStyle(1, 0x6688aa);
            this._playAgainText.setColor('#aabbcc');
        });
        this._playAgainBg.on('pointerout', () => {
            this._playAgainBg.setStrokeStyle(1, 0x334455);
            this._playAgainText.setColor('#778899');
        });
        this._playAgainBg.on('pointerdown', () => {
            GameState.reset();
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Title'));
        });
    }

    _revealPlayAgain() {
        this.tweens.add({
            targets: [this._playAgainBg, this._playAgainText],
            alpha: 1,
            duration: 600,
        });
    }

    _installSkipHandler() {
        // Keyboard still skips straight to the end (long-standing behaviour).
        const skip = () => {
            if (!this._scrollTween || this._scrollTween.progress >= 1) return;
            this._scrollTween.complete();
        };
        this.input.keyboard?.on('keydown-SPACE', skip);
        this.input.keyboard?.on('keydown-ESC', skip);
        this.input.keyboard?.on('keydown-ENTER', skip);

        // Click on the credits area no longer cancels the scroll — each click
        // ramps the tween's timeScale up so the user can fast-forward through
        // names without losing them entirely.
        this._scrollSpeedMultiplier = 1;
        const speedUp = () => {
            if (!this._scrollTween || this._scrollTween.progress >= 1) return;
            this._scrollSpeedMultiplier = Math.min(8, this._scrollSpeedMultiplier * 1.7);
            this._scrollTween.timeScale = this._scrollSpeedMultiplier;
        };
        const bg = this.add.zone(SCREEN_W / 2, SCREEN_H / 2, SCREEN_W, SCREEN_H)
            .setOrigin(0.5)
            .setDepth(0)
            .setInteractive();
        bg.on('pointerdown', speedUp);
    }

    _playMusic() {
        const musicVolume = getMusicVolume();
        if (musicVolume <= 0 || !this.cache.audio.has(SOUND_ASSETS.firedMusic.key)) {
            return;
        }
        this._music = this.sound.add(SOUND_ASSETS.firedMusic.key, { loop: true, volume: 0 });
        this._music.play();
        this.tweens.add({
            targets: this._music,
            volume: 0.6 * musicVolume,
            duration: 1000,
        });
    }
}

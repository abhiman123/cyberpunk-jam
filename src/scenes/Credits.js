import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS } from '../constants/gameConstants.js';
import { getMusicVolume } from '../state/gameSettings.js';

const SCREEN_W = 1280;
const SCREEN_H = 720;

const CREDITS = Object.freeze([
    { role: 'PROGRAMMING', names: [
        'Safiullah Baig',
        'Andrew Bui',
        'Orion Allen Borntrager',
        'Ethan Nishimura',
        'Minh Tran',
        'Abhimanyu Bhalla',
    ] },
    { role: 'ART', names: [
        'Pranaav Makharia',
        'Pranet Ramanan',
        'Jacob Jansta',
        'Ishita Pradhan',
        'Jacqueline King',
        'Minh Tran',
        'Jake Verell',
    ] },
    { role: 'STORYBOARDING', names: [
        'Christian Gonzalez',
        'Jacqueline King',
        'Geetika Joshi',
        'Caleb Livingston',
        'Zachary Boseman',
    ] },
    { role: 'MUSIC CREDITS', names: [
        'Clocking In Music - Julien Vincent',
        'Cutting It Close Music - Julien Vincent',
        'Corporate Music - Julien Vincent',
        'Managing Music - Shane Ollek',
        'Credits Music - Shane Ollek',
    ] },
    { role: 'SOUND', names: [
        'Manager Voice - Zachary Boseman',
    ] },
]);

export default class CreditsScene extends Phaser.Scene {
    constructor() {
        super('Credits');
    }

    create() {
        this._music = null;
        this._sidePortraitTweens = [];

        applyCyberpunkLook(this);
        this.cameras.main.setBackgroundColor('#050709');
        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Subtle scanline overlay to match End scene's aesthetic.
        const scan = this.add.graphics().setDepth(100);
        scan.fillStyle(0x000000, 0.24);
        for (let y = 0; y < SCREEN_H; y += 4) {
            scan.fillRect(0, y, SCREEN_W, 2);
        }

        this._buildSidePortraits();

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
            this._sidePortraitTweens?.forEach((tween) => tween?.stop());
            this._sidePortraitTweens = [];
        });
    }

    _buildSidePortraits() {
        // Two fading portraits flanking the credits scroll — the same two
        // headshots the settings overlay uses (rich guy on the left, crybaby
        // on the right). They softly pulse alpha so the page doesn't feel
        // empty during long credit reads.
        const leftKey = 'settings_portrait_left';
        const rightKey = 'settings_portrait_right';
        const portraitTargets = [];

        if (this.textures.exists(leftKey)) {
            const left = this.add.image(140, SCREEN_H / 2, leftKey)
                .setOrigin(0.5)
                .setDepth(20)
                .setAlpha(0.22);
            this._fitPortraitToBox(left, 240, 360);
            portraitTargets.push({ image: left, delayMs: 0 });
        }
        if (this.textures.exists(rightKey)) {
            const right = this.add.image(SCREEN_W - 140, SCREEN_H / 2, rightKey)
                .setOrigin(0.5)
                .setDepth(20)
                .setAlpha(0.22);
            this._fitPortraitToBox(right, 240, 360);
            portraitTargets.push({ image: right, delayMs: 600 });
        }

        portraitTargets.forEach(({ image, delayMs }) => {
            const tween = this.tweens.add({
                targets: image,
                alpha: { from: 0.22, to: 0.92 },
                duration: 1800,
                ease: 'Sine.InOut',
                yoyo: true,
                repeat: -1,
                delay: delayMs,
            });
            this._sidePortraitTweens.push(tween);
        });
    }

    _fitPortraitToBox(image, maxW, maxH) {
        const sourceW = image.width || 1;
        const sourceH = image.height || 1;
        const scale = Math.min(maxW / sourceW, maxH / sourceH, 1);
        image.setScale(scale);
    }

    _buildCreditsContent(container) {
        let cursor = 0;

        const fromTheMind = this.add.text(0, cursor, 'From the mind of:', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#8dd6ec',
            align: 'center',
            letterSpacing: 3,
        }).setOrigin(0.5, 0);
        container.add(fromTheMind);
        cursor += fromTheMind.height + 12;

        const orion = this.add.text(0, cursor, 'Orion Allen Borntrager', {
            fontFamily: 'Courier New',
            fontSize: '32px',
            color: '#ffffff',
            align: 'center',
            letterSpacing: 4,
        }).setOrigin(0.5, 0);
        container.add(orion);
        cursor += orion.height + 100;

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
                const isSmallName = name === 'Abhimanyu Bhalla';
                const line = this.add.text(0, cursor, name, {
                    fontFamily: 'Courier New',
                    fontSize: isSmallName ? '12px' : '22px',
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

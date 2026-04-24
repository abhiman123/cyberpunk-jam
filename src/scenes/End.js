import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../constants/gameConstants.js';
import { getMusicVolume } from '../state/gameSettings.js';

const ENDING_DIALOGUE = Object.freeze({
    replacement: [
        'So we meet...',
        'face to face...',
        'The company and I commend you for being such a loyal, dedicated, and efficient worker.',
        '...',
        'You are a rarity in this era.',
        '...',
        'I know you understand that speed is an important part of your job',
        '...',
        'but...',
        'even the best of the best have their limits.',
        'The truth is...',
        'the time has come...',
        'to replace you.',
        'After all, you were just a cog in the system.',
        'Employee 234982, you have been scrapped.',
    ],
    umbrella_purple: [
        'Listen kid. I appreciate the help.',
        'You helped me achieve my dreams... reach the top of the world.',
        'And thanks to you, I can do anything with this power.',
        'That means I do not need you anymore.',
        'The world runs on machines, and you just did the bidding of one.',
        'You are useless. A pawn. Nothing matters unless you have power.',
        'Thanks, bud.',
    ],
    umbrella_red_manager: [
        'I am your manager.',
        'Unfortunately, we have a replacement for you.',
        'We will no longer need you.',
    ],
    umbrella_red_confused: [
        'What is this?',
        'What life form is this?',
        'I have never seen something of the sort.',
        'What is... this?',
        'It is getting closer to the button.',
    ],
    umbrella_red: [
        'Th4nks bUd...',
        'WhY d035 my 5h4d3 hUrt...',
        'ScrAp. ScrAp. ScrAp.',
    ],
    umbrella_mixed: [
        'Screw you. I trusted you. I am cooked.',
        'Now I can barely function, but I still have the purple circuit of power.',
        'So now you, my pawn, a simple cog in the system, are going down with me.',
        'Scrap. Scrap. Scrap.',
    ],
});

const TITLE_TEXT = "you're just a machine.";

export default class EndScene extends Phaser.Scene {
    constructor() {
        super('End');
    }

    init(data) {
        this._endingVariant = data?.endingVariant || GameState.getDayFourEndingVariant();
    }

    create() {
        this._music = null;
        this._speakerTween = null;

        applyCyberpunkLook(this);
        this.cameras.main.setBackgroundColor('#050709');

        this._world = this.add.container(0, 0);
        this._buildStage();
        this._buildActors();
        this._buildUi();
        this._playCutsceneMusic();

        const scan = this.add.graphics().setDepth(100);
        scan.fillStyle(0x000000, 0.24);
        for (let y = 0; y < 720; y += 4) {
            scan.fillRect(0, y, 1280, 2);
        }

        this.events.on('shutdown', () => {
            this._speakerTween?.stop();
            this._music?.stop();
            this._music = null;
        });

        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(550, () => {
            void this._runEndingSequence();
        });
    }

    _buildStage() {
        const background = this.add.rectangle(640, 360, 1280, 720, 0x080c10).setDepth(0);
        const haze = this.add.rectangle(640, 220, 1280, 320, 0x112332, 0.32).setDepth(0);
        const pitGlow = this.add.ellipse(640, 680, 420, 70, 0x040608, 0.92).setDepth(1);
        const catwalk = this.add.rectangle(640, 468, 1280, 164, 0x101820, 1).setDepth(1);
        const rail = this.add.rectangle(640, 396, 1280, 10, 0x274b62, 0.84).setDepth(2);

        this._lights = [];
        for (let i = 0; i < 6; i += 1) {
            const light = this.add.rectangle(124 + (i * 206), 96, 84, 20, 0xe8fff3, 0.2)
                .setDepth(2)
                .setStrokeStyle(1, 0xe8fff3, 0.24);
            this._lights.push(light);
        }

        this._conveyorTiles = [];
        for (let i = 0; i < 33; i += 1) {
            const tile = this.add.image(20 + (i * 40), 530, 'conveyor_tile')
                .setDepth(2)
                .setAlpha(0.86);
            this._conveyorTiles.push(tile);
        }

        this._scrapButtonGlow = this.add.rectangle(1038, 514, 168, 94, 0xff786f, 0.08)
            .setDepth(3)
            .setVisible(false);
        this._scrapButton = this.add.rectangle(1038, 514, 146, 72, 0x4c1312, 0.94)
            .setStrokeStyle(2, 0xff7c73, 0.84)
            .setDepth(4)
            .setVisible(false);
        this._scrapButtonLabel = this.add.text(1038, 514, 'SCRAP', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#ffd7d2',
            letterSpacing: 4,
        }).setOrigin(0.5).setDepth(5).setVisible(false);

        // this._fallHole = this.add.ellipse(640, 760, 220, 54, 0x000000, 0.96)
        //     .setDepth(30)
        //     .setScale(0.3)
        //     .setAlpha(0);

        this._world.add([
            background,
            haze,
            pitGlow,
            catwalk,
            rail,
            ...this._lights,
            ...this._conveyorTiles,
            this._scrapButtonGlow,
            this._scrapButton,
            this._scrapButtonLabel,
        ]);
    }

    _buildActors() {
        this._managerSprite = this.add.image(1440, 408, 'manager_robot')
            .setScale(2.0)
            .setDepth(10)
            .setVisible(false);
        this._umbrellaSprite = this.add.image(1440, 384, 'machine_rebellious_umbrella')
            .setScale(1.4)
            .setDepth(11)
            .setVisible(false);
        this._world.add([this._managerSprite, this._umbrellaSprite]);
    }

    _buildUi() {
        this._panelShadow = this.add.rectangle(640, 612, 926, 150, 0x000000, 0.34).setDepth(20);
        this._panel = this.add.rectangle(640, 604, 914, 138, 0x081017, 0.9)
            .setStrokeStyle(2, 0x6bb6da, 0.5)
            .setDepth(21);
        this._panelTag = this.add.text(198, 548, 'FINAL TRANSMISSION', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#8fd8f3',
            letterSpacing: 3,
        }).setDepth(22);

        this._dialogueText = this.add.text(640, 606, '', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#b8efff',
            align: 'center',
            wordWrap: { width: 820 },
            lineSpacing: 10,
        }).setOrigin(0.5).setDepth(22);

        this._titleCard = this.add.text(640, 338, TITLE_TEXT, {
            fontFamily: 'Courier New',
            fontSize: '30px',
            color: '#cdefff',
            align: 'center',
        }).setOrigin(0.5).setDepth(40).setAlpha(0);

        this._playAgainBg = this.add.rectangle(640, 504, 220, 46, 0x0a0a0a)
            .setStrokeStyle(1, 0x334455)
            .setDepth(41)
            .setAlpha(0)
            .setInteractive({ useHandCursor: true });
        this._playAgainText = this.add.text(640, 504, 'PLAY AGAIN', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#778899',
        }).setOrigin(0.5).setDepth(42).setAlpha(0);

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

    _playCutsceneMusic() {
        const musicVolume = getMusicVolume();
        if (musicVolume <= 0 || !this.cache.audio.has(SOUND_ASSETS.managerMusic.key)) {
            return;
        }

        this._music = this.sound.add(SOUND_ASSETS.managerMusic.key, { loop: true, volume: 0 });
        this._music.play();
        this.tweens.add({
            targets: this._music,
            volume: SOUND_VOLUMES.music * musicVolume,
            duration: 800,
        });
    }

    async _runEndingSequence() {
        switch (this._endingVariant) {
        case 'umbrella_purple':
            await this._runUmbrellaPurpleEnding();
            await this._runFallSequence();
            break;
        case 'umbrella_red':
            await this._runUmbrellaRedEnding();
            await this._runFallSequence({ violent: true });
            break;
        case 'umbrella_mixed':
            await this._runUmbrellaMixedEnding();
            await this._runFallSequence({ violent: true });
            break;
        default:
            await this._runReplacementEnding();
            await this._runFallSequence();
            break;
        }

        await this._showTitleCard();
    }

    async _runReplacementEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 320, y: 408, duration: 950 });
        await this._typeDialogueLines(ENDING_DIALOGUE.replacement, { color: '#aee7ff' });
        await this._wait(700);
    }

    async _runUmbrellaPurpleEnding() {
        await this._enterActor(this._umbrellaSprite, { x: 348, y: 384, duration: 980 });
        this._styleUmbrella('purple');
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_purple, { color: '#ddb6ff' });
        await this._wait(700);
    }

    async _runUmbrellaRedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 320, y: 408, duration: 900 });
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_red_manager, { color: '#aee7ff' });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('red');
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_red_confused, { color: '#aee7ff', append: true });
        await dropPromise;
        await this._scrapManagerActor();
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_red, { color: '#ff9b92' });
        await this._runExplosionLeadIn();
    }

    async _runUmbrellaMixedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 320, y: 408, duration: 900 });
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_red_manager, { color: '#aee7ff' });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('mixed');
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_red_confused, { color: '#aee7ff', append: true });
        await dropPromise;
        await this._scrapManagerActor();
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_mixed, { color: '#efbcff' });
        await this._runExplosionLeadIn();
    }

    _showScrapButton() {
        this._scrapButtonGlow.setVisible(true);
        this._scrapButton.setVisible(true);
        this._scrapButtonLabel.setVisible(true);
    }

    _styleUmbrella(mode = 'red') {
        this._umbrellaSprite.clearTint();
        this._speakerTween?.stop();
        this._speakerTween = null;

        if (mode === 'purple') {
            this._umbrellaSprite.setTint(0xca88ff);
            this._speakerTween = this.tweens.add({
                targets: this._umbrellaSprite,
                y: '+=8',
                duration: 460,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
            return;
        }

        if (mode === 'mixed') {
            this._umbrellaSprite.setTint(0xd28cff);
            this._speakerTween = this.tweens.add({
                targets: this._umbrellaSprite,
                x: '+=7',
                angle: 4,
                duration: 48,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
            return;
        }

        this._umbrellaSprite.setTint(0xff8a81);
        this._speakerTween = this.tweens.add({
            targets: this._umbrellaSprite,
            x: '+=5',
            angle: 3,
            duration: 44,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    _enterActor(actor, { x, y, duration = 900 } = {}) {
        actor.setVisible(true);
        actor.setAlpha(1);
        actor.setPosition(1440, y ?? actor.y);
        actor.setAngle(0);

        return new Promise((resolve) => {
            this.tweens.add({
                targets: actor,
                x,
                y: y ?? actor.y,
                duration,
                ease: 'Cubic.Out',
                onComplete: () => resolve(true),
            });
        });
    }

    _dropUmbrellaToButton(mode = 'red') {
        this._umbrellaSprite.clearTint();
        if (mode === 'mixed') {
            this._umbrellaSprite.setTint(0xd28cff);
        } else {
            this._umbrellaSprite.setTint(0xff8a81);
        }
        this._umbrellaSprite.setVisible(true);
        this._umbrellaSprite.setAlpha(1);
        this._umbrellaSprite.setPosition(1038, -160);

        return new Promise((resolve) => {
            this.tweens.add({
                targets: this._umbrellaSprite,
                x: 1038,
                y: 404,
                duration: 2400,
                ease: 'Sine.In',
                onComplete: () => {
                    this._styleUmbrella(mode);
                    this.tweens.add({
                        targets: this._scrapButtonGlow,
                        alpha: 0.42,
                        duration: 120,
                        yoyo: true,
                        repeat: 2,
                    });
                    resolve(true);
                },
            });
        });
    }

    _scrapManagerActor() {
        this.cameras.main.shake(240, 0.014);
        return new Promise((resolve) => {
            this.tweens.add({
                targets: this._managerSprite,
                y: 820,
                angle: -8,
                alpha: 0.14,
                duration: 640,
                ease: 'Cubic.In',
                onComplete: () => {
                    this._managerSprite.setVisible(false);
                    resolve(true);
                },
            });
        });
    }

    async _runExplosionLeadIn() {
        for (let index = 0; index < 5; index += 1) {
            this.cameras.main.flash(90, 255, 80 + (index * 15), 70, false);
            this.cameras.main.shake(150, 0.02 + (index * 0.002));
            this.tweens.add({
                targets: this._scrapButton,
                scaleX: 1.06,
                scaleY: 1.08,
                duration: 90,
                yoyo: true,
            });
            this.tweens.add({
                targets: this._umbrellaSprite,
                angle: this._umbrellaSprite.angle + 14,
                duration: 90,
                yoyo: true,
            });
            await this._wait(130);
        }
    }

    _typeDialogueLines(lines, { color = '#b8efff', append = false } = {}) {
        return new Promise((resolve) => {
            const entries = Array.isArray(lines) ? lines : [String(lines || '')];
            this._dialogueText.setColor(color);
            let lineIndex = 0;

            // append mode accumulates all lines (used while simultaneous animations play)
            // default mode shows one line at a time for suspense
            const accumulated = append && this._dialogueText.text
                ? this._dialogueText.text.split('\n')
                : [];

            const revealNextLine = () => {
                if (lineIndex >= entries.length) {
                    this.time.delayedCall(600, () => resolve(true));
                    return;
                }

                const line = String(entries[lineIndex++] || '');
                let charIndex = 0;

                if (!append) {
                    this._dialogueText.setText('');
                }

                this.time.addEvent({
                    delay: 38,
                    repeat: Math.max(0, line.length - 1),
                    callback: () => {
                        charIndex += 1;
                        if (append) {
                            const partial = line.slice(0, charIndex);
                            const rows = accumulated.slice();
                            if (charIndex === 1) rows.push('');
                            rows[rows.length - 1] = partial;
                            this._dialogueText.setText(rows.join('\n'));
                            if (charIndex >= line.length) {
                                accumulated.push(line);
                                this.time.delayedCall(500, revealNextLine);
                            }
                        } else {
                            this._dialogueText.setText(line.slice(0, charIndex));
                            if (charIndex >= line.length) {
                                this.time.delayedCall(1400, revealNextLine);
                            }
                        }
                    },
                });
            };

            if (!append) {
                this._dialogueText.setText('');
            }
            revealNextLine();
        });
    }

    async _runFallSequence({ violent = false } = {}) {
        this._dialogueText.setAlpha(0);

        if (this._music) {
            this.tweens.add({
                targets: this._music,
                volume: 0,
                duration: 500,
                onComplete: () => {
                    this._music?.stop();
                    this._music = null;
                },
            });
        }

        // this._fallHole.setAlpha(1);
        if (violent) {
            this.cameras.main.flash(220, 255, 95, 72, false);
        }
        this.cameras.main.shake(700, violent ? 0.03 : 0.018);

        this.tweens.add({
            targets: this._world,
            y: -260,
            duration: 1350,
            ease: 'Cubic.In',
        });
        this.tweens.add({
            // targets: this._fallHole,
            scaleX: violent ? 6.2 : 5.2,
            scaleY: violent ? 4.8 : 4.1,
            y: 700,
            duration: 1350,
            ease: 'Cubic.In',
        });

        await this._wait(920);
        this.cameras.main.fade(700, 120, 6, 6);
        await this._wait(820);
    }

    async _showTitleCard() {
        // hide everything so the title appears on a clean black screen
        this._world.setVisible(false);
        this._dialogueText.setVisible(false);
        this._panelShadow.setVisible(false);
        this._panel.setVisible(false);
        this._panelTag.setVisible(false);
        this._speakerTween?.stop();

        this.cameras.main.fadeIn(700, 0, 0, 0);

        const musicVolume = getMusicVolume();
        if (musicVolume > 0 && this.cache.audio.has(SOUND_ASSETS.firedMusic.key)) {
            const endMusic = this.sound.add(SOUND_ASSETS.firedMusic.key, { loop: false, volume: 0 });
            endMusic.play();
            this.tweens.add({
                targets: endMusic,
                volume: 0.6 * musicVolume,
                duration: 1000,
            });
        }

        this.tweens.add({
            targets: this._titleCard,
            alpha: 1,
            duration: 1000,
            delay: 160,
        });

        await this._wait(4200);
        this.tweens.add({
            targets: [this._playAgainBg, this._playAgainText],
            alpha: 1,
            duration: 600,
        });
    }

    _wait(duration) {
        return new Promise((resolve) => {
            this.time.delayedCall(duration, () => resolve(true));
        });
    }
}

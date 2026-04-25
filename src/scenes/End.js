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
const DOGSI_ENDING_PATH = 'dogsi.mp3';

function colorToCss(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}

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
        this._dogsiAudio = null;

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
            this._stopDogsiAudio();
        });

        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.time.delayedCall(550, () => {
            void this._runEndingSequence();
        });
    }

    _buildStage() {
        const backgroundLayers = [];
        const fallbackKey = this.textures.exists('bg_p4')
            ? 'bg_p4'
            : (this.textures.exists('bg_p3') ? 'bg_p3' : null);

        if (fallbackKey) {
            backgroundLayers.push(this.add.image(640, 360, fallbackKey).setDisplaySize(1280, 720).setDepth(0));
        } else {
            backgroundLayers.push(this.add.rectangle(640, 360, 1280, 720, 0x080c10).setDepth(0));
        }

        ['mainview_second', 'mainview_lightradiance', 'mainview_lightlayer'].forEach((key) => {
            if (!this.textures.exists(key)) return;
            backgroundLayers.push(this.add.image(640, 360, key).setDisplaySize(1280, 720).setDepth(1));
        });

        if (this.textures.exists('mainview_bottom')) {
            backgroundLayers.push(this.add.image(640, 360, 'mainview_bottom').setDisplaySize(1280, 720).setDepth(2));
        }

        ['mainview_fam1', 'mainview_fam2'].forEach((key, index) => {
            if (!this.textures.exists(key)) return;
            backgroundLayers.push(this.add.image(index === 0 ? 202 : 278, index === 0 ? 659 : 669, key).setDepth(3));
        });

        const haze = this.add.rectangle(640, 210, 1280, 320, 0x102130, 0.34).setDepth(4);
        const stageShadow = this.add.rectangle(640, 580, 1280, 180, 0x05080b, 0.52).setDepth(4);
        this._pitGlow = this.add.ellipse(640, 690, 460, 84, 0x030507, 0.96).setDepth(5);
        const catwalk = this.add.rectangle(640, 486, 1280, 122, 0x111920, 0.72).setDepth(6);
        const rail = this.add.rectangle(640, 414, 1280, 10, 0x34596d, 0.84).setDepth(7);

        this._lights = [];
        for (let i = 0; i < 6; i += 1) {
            const light = this.add.rectangle(124 + (i * 206), 96, 84, 20, 0xe8fff3, 0.2)
                .setDepth(8)
                .setStrokeStyle(1, 0xe8fff3, 0.24);
            this._lights.push(light);
        }

        this._conveyorTiles = [];
        for (let i = 0; i < 33; i += 1) {
            const tile = this.add.image(20 + (i * 40), 530, 'conveyor_tile')
                .setDepth(8)
                .setAlpha(0.86);
            this._conveyorTiles.push(tile);
        }

        this._scrapButtonGlow = this.add.rectangle(1038, 546, 172, 98, 0xff786f, 0.08)
            .setDepth(11)
            .setVisible(false);
        this._scrapButton = this.add.rectangle(1038, 546, 146, 72, 0x4c1312, 0.96)
            .setStrokeStyle(2, 0xff7c73, 0.84)
            .setDepth(12)
            .setVisible(false);
        this._scrapButtonLabel = this.add.text(1038, 546, 'SCRAP', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#ffd7d2',
            letterSpacing: 4,
        }).setOrigin(0.5).setDepth(13).setVisible(false);

        this._blackCover = this.add.rectangle(640, 360, 1280, 720, 0x000000, 1)
            .setDepth(35)
            .setAlpha(0);

        this._world.add([
            ...backgroundLayers,
            haze,
            stageShadow,
            this._pitGlow,
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
            .setScale(1.82)
            .setDepth(18)
            .setVisible(false);
        this._replacementSprite = this.add.image(1440, 418, this.textures.exists('machine_debrief_machine') ? 'machine_debrief_machine' : 'unit_placeholder')
            .setScale(1.38)
            .setDepth(18)
            .setVisible(false);
        this._umbrellaSprite = this.add.image(1440, 384, 'machine_rebellious_umbrella')
            .setScale(1.4)
            .setDepth(19)
            .setVisible(false);
        this._world.add([this._managerSprite, this._replacementSprite, this._umbrellaSprite]);
    }

    _buildUi() {
        this._panelShadow = this.add.rectangle(640, 612, 1, 1, 0x000000, 0).setDepth(20).setVisible(false);
        this._panel = this.add.rectangle(640, 604, 1, 1, 0x081017, 0).setDepth(21).setVisible(false);
        this._panelTag = this.add.text(198, 548, '', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#8fd8f3',
            letterSpacing: 3,
        }).setDepth(22).setVisible(false);
        this._dialogueText = this.add.text(640, 606, '', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#b8efff',
        }).setOrigin(0.5).setDepth(22).setVisible(false);

        this._speechBubble = this.add.container(0, 0).setDepth(30).setVisible(false);
        this._speechBubbleShadow = this.add.graphics();
        this._speechBubbleBody = this.add.graphics();
        this._speechBubbleTail = this.add.graphics();
        this._speechBubbleTag = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#d7f8ff',
            letterSpacing: 2,
        }).setOrigin(0, 1);
        this._speechBubbleText = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '19px',
            color: '#1d232b',
            align: 'left',
            wordWrap: { width: 320 },
            lineSpacing: 8,
        }).setOrigin(0, 1);
        this._speechBubble.add([
            this._speechBubbleShadow,
            this._speechBubbleBody,
            this._speechBubbleTail,
            this._speechBubbleTag,
            this._speechBubbleText,
        ]);

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

    _playDogsiAudio() {
        this._stopDogsiAudio();
        if (typeof Audio === 'undefined') return;

        const musicVolume = getMusicVolume();
        if (musicVolume <= 0) return;

        const audio = new Audio(DOGSI_ENDING_PATH);
        audio.loop = false;
        audio.preload = 'auto';
        audio.volume = Math.min(0.9, Math.max(0.18, musicVolume * 0.72));
        audio.addEventListener('error', () => {
            if (this._dogsiAudio === audio) this._dogsiAudio = null;
        }, { once: true });
        this._dogsiAudio = audio;
        audio.play().catch(() => {
            if (this._dogsiAudio === audio) this._dogsiAudio = null;
        });
    }

    _stopDogsiAudio() {
        const audio = this._dogsiAudio;
        if (!audio) return;

        audio.pause();
        try {
            audio.currentTime = 0;
        } catch (error) {
            // Optional ending media may be partially loaded during shutdown.
        }
        audio.removeAttribute('src');
        audio.load();
        this._dogsiAudio = null;
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
        this._replacementSprite.setTint(0x9df3ff);
        await this._enterActor(this._replacementSprite, { x: 668, y: 446, duration: 2200, ease: 'Linear' });
        this._speakerTween = this.tweens.add({
            targets: this._replacementSprite,
            y: '+=7',
            duration: 520,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        await this._bubbleDialogue(this._replacementSprite, ENDING_DIALOGUE.replacement, {
            speaker: 'REPLACEMENT UNIT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            textColor: '#13252b',
        });
        await this._wait(460);
    }

    async _runUmbrellaPurpleEnding() {
        await this._enterActor(this._umbrellaSprite, { x: 404, y: 410, duration: 980 });
        this._styleUmbrella('purple');
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_purple, {
            speaker: 'UMBRELLA',
            accent: 0xd49cff,
            fill: 0xf9ecff,
            textColor: '#25182b',
        });
        await this._wait(520);
    }

    async _runUmbrellaRedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 418, duration: 900 });
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_manager, {
            speaker: 'MANAGER BOT',
            accent: 0x8fd8f3,
            fill: 0xf4fbff,
            textColor: '#18242b',
        });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('red');
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_confused, {
            speaker: 'MANAGER BOT',
            accent: 0x8fd8f3,
            fill: 0xf4fbff,
            textColor: '#18242b',
            holdMs: 460,
        });
        await dropPromise;
        await this._scrapManagerActor();
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_red, {
            speaker: 'UMBRELLA',
            accent: 0xff8a81,
            fill: 0xffece8,
            textColor: '#321818',
            holdMs: 400,
        });
        await this._runExplosionLeadIn();
    }

    async _runUmbrellaMixedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 418, duration: 900 });
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_manager, {
            speaker: 'MANAGER BOT',
            accent: 0x8fd8f3,
            fill: 0xf4fbff,
            textColor: '#18242b',
        });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('mixed');
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_confused, {
            speaker: 'MANAGER BOT',
            accent: 0x8fd8f3,
            fill: 0xf4fbff,
            textColor: '#18242b',
            holdMs: 460,
        });
        await dropPromise;
        await this._scrapManagerActor();
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_mixed, {
            speaker: 'UMBRELLA',
            accent: 0xd49cff,
            fill: 0xf9ecff,
            textColor: '#25182b',
            holdMs: 420,
        });
        await this._runExplosionLeadIn();
    }

    async _bubbleDialogue(actor, lines, options = {}) {
        const entries = Array.isArray(lines) ? lines : [String(lines || '')];
        this._speechBubble.setVisible(true).setAlpha(1);

        for (const entry of entries) {
            const line = String(entry || '');
            this._layoutSpeechBubble(actor, line, options);
            await this._typeSpeechBubbleLine(line, options);
            await this._wait(options.holdMs ?? 720);
        }

        this.tweens.add({
            targets: this._speechBubble,
            alpha: 0,
            duration: 140,
            ease: 'Quad.Out',
            onComplete: () => this._speechBubble.setVisible(false),
        });
        await this._wait(160);
    }

    _layoutSpeechBubble(actor, line, {
        speaker = 'UNIT',
        accent = 0x8fd8f3,
        fill = 0xf4fbff,
        textColor = '#18242b',
    } = {}) {
        const bubbleFill = 0xf4ecdf;
        const bubbleStroke = 0x5d5040;
        const bubbleTextColor = '#2a2d34';
        const actorX = actor?.x ?? 640;
        const actorY = actor?.y ?? 420;
        const bubbleW = 392;
        const lineRows = Math.max(1, Math.ceil(String(line || '').length / 31));
        const bubbleH = Phaser.Math.Clamp(74 + (lineRows * 18), 94, 154);
        const bubbleX = Phaser.Math.Clamp(actorX + 34, 84, 1280 - bubbleW - 64);
        const bubbleY = Phaser.Math.Clamp(actorY - bubbleH - 142, 74, 456);
        const tailX = Phaser.Math.Clamp(actorX + 10, bubbleX + 36, bubbleX + bubbleW - 36);
        const tailY = actorY - 82;

        this._speechBubbleShadow.clear();
        this._speechBubbleShadow.fillStyle(0x000000, 0.34);
        this._speechBubbleShadow.fillRoundedRect(bubbleX + 8, bubbleY + 10, bubbleW, bubbleH, 18);

        this._speechBubbleBody.clear();
        this._speechBubbleBody.fillStyle(bubbleFill, 0.98);
        this._speechBubbleBody.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 18);
        this._speechBubbleBody.lineStyle(3, bubbleStroke, 0.96);
        this._speechBubbleBody.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 18);
        this._speechBubbleBody.fillStyle(accent, 0.18);
        this._speechBubbleBody.fillRoundedRect(bubbleX + 12, bubbleY + 10, bubbleW - 24, 22, 10);

        this._speechBubbleTail.clear();
        this._speechBubbleTail.fillStyle(bubbleFill, 0.98);
        this._speechBubbleTail.fillTriangle(tailX - 18, bubbleY + bubbleH - 4, tailX + 12, bubbleY + bubbleH - 4, actorX, tailY);
        this._speechBubbleTail.lineStyle(2, bubbleStroke, 0.82);
        this._speechBubbleTail.lineBetween(tailX - 18, bubbleY + bubbleH - 4, actorX, tailY);
        this._speechBubbleTail.lineBetween(tailX + 12, bubbleY + bubbleH - 4, actorX, tailY);

        this._speechBubbleTag
            .setText(speaker)
            .setColor(colorToCss(accent))
            .setPosition(bubbleX + 20, bubbleY + 26);
        this._speechBubbleText
            .setText('')
            .setColor(bubbleTextColor)
            .setWordWrapWidth(bubbleW - 42)
            .setPosition(bubbleX + 22, bubbleY + bubbleH - 20);
    }

    _typeSpeechBubbleLine(line, options = {}) {
        return new Promise((resolve) => {
            const text = String(line || '');
            if (!text) {
                this._speechBubbleText.setText('');
                resolve(true);
                return;
            }

            let index = 0;
            this._speechBubbleText.setText('');
            if (/^Employee\s+\d+/i.test(text)) {
                this._playDogsiAudio();
            }
            this.time.addEvent({
                delay: options.typeDelayMs ?? 24,
                repeat: text.length - 1,
                callback: () => {
                    index += 1;
                    this._speechBubbleText.setText(text.slice(0, index));
                    if (index >= text.length) {
                        resolve(true);
                    }
                },
            });
        });
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
                y: '-=16',
                angle: 5,
                duration: 86,
                yoyo: true,
                repeat: -1,
                ease: 'Quad.Out',
            });
            return;
        }

        this._umbrellaSprite.setTint(0xff8a81);
        this._speakerTween = this.tweens.add({
            targets: this._umbrellaSprite,
            y: '-=14',
            angle: 4,
            duration: 82,
            yoyo: true,
            repeat: -1,
            ease: 'Quad.Out',
        });
    }

    _enterActor(actor, { x, y, duration = 900, ease = 'Cubic.Out' } = {}) {
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
                ease,
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
        this._speakerTween?.stop();
        this._speakerTween = null;
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
                y: this._umbrellaSprite.y - 18,
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
        this._speechBubble.setVisible(false);
        this._speakerTween?.stop();
        this._speakerTween = null;

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
            y: -560,
            duration: 1450,
            ease: 'Cubic.In',
        });
        this.tweens.add({
            targets: this._pitGlow,
            scaleX: violent ? 3.6 : 2.8,
            scaleY: violent ? 2.4 : 2,
            alpha: 1,
            duration: 720,
            ease: 'Cubic.Out',
        });
        this.tweens.add({
            targets: this._blackCover,
            alpha: 1,
            delay: 520,
            duration: 820,
            ease: 'Quad.In',
        });

        await this._wait(1520);
    }

    async _showTitleCard() {
        // hide everything so the title appears on a clean black screen
        this._world.setVisible(false);
        this._dialogueText.setVisible(false);
        this._panelShadow.setVisible(false);
        this._panel.setVisible(false);
        this._panelTag.setVisible(false);
        this._speakerTween?.stop();
        this._blackCover.setAlpha(1);

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

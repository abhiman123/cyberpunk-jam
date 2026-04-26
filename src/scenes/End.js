import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../constants/gameConstants.js';
import { getMusicVolume } from '../state/gameSettings.js';
import { buildGradingReport } from '../systems/GradingReport.js';

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

        // Subtle camera push-in for cinematic feel during dialogue
        this.tweens.add({
            targets: this.cameras.main,
            zoom: 1.06,
            duration: 14000,
            ease: 'Sine.InOut',
        });

        this.time.delayedCall(550, () => {
            void this._runEndingSequence();
        });
    }

    _buildStage() {
        const background = this.add.rectangle(640, 360, 1280, 720, 0x05080d).setDepth(0);

        // Sky gradient (three layered bands)
        const skyHigh = this.add.rectangle(640, 110, 1280, 220, 0x0e1a2c, 1).setDepth(0);
        const skyMid = this.add.rectangle(640, 250, 1280, 100, 0x152944, 0.9).setDepth(0);
        const haze = this.add.rectangle(640, 320, 1280, 60, 0x1d3a5c, 0.55).setDepth(0);

        // Distant factory silhouette (back wall)
        const backWall = this.add.rectangle(640, 360, 1280, 60, 0x070d16, 0.96).setDepth(0);
        const skyline = this.add.graphics().setDepth(0);
        skyline.fillStyle(0x080d18, 1);
        const skylineSegments = [
            { x: 60, w: 80, h: 32 },
            { x: 150, w: 60, h: 22 },
            { x: 220, w: 110, h: 46 },
            { x: 350, w: 70, h: 28 },
            { x: 440, w: 90, h: 38 },
            { x: 545, w: 60, h: 24 },
            { x: 615, w: 100, h: 50 },
            { x: 730, w: 70, h: 30 },
            { x: 815, w: 110, h: 44 },
            { x: 935, w: 70, h: 26 },
            { x: 1015, w: 90, h: 36 },
            { x: 1115, w: 70, h: 30 },
            { x: 1200, w: 60, h: 22 },
        ];
        skylineSegments.forEach((s) => skyline.fillRect(s.x, 360 - s.h, s.w, s.h));
        // Tiny window glints in the silhouette
        skyline.fillStyle(0x4a6f93, 0.6);
        for (let i = 0; i < 30; i += 1) {
            const wx = 90 + ((i * 42) % 1180);
            const wy = 332 + ((i * 17) % 22);
            skyline.fillRect(wx, wy, 3, 3);
        }

        // Vent fans on the back wall
        const vents = this.add.graphics().setDepth(0);
        [200, 540, 920].forEach((vx) => {
            vents.lineStyle(2, 0x3a5471, 0.8);
            vents.strokeCircle(vx, 348, 20);
            vents.lineStyle(2, 0x2a3e54, 0.85);
            for (let blade = 0; blade < 4; blade += 1) {
                const angle = (blade / 4) * Math.PI;
                vents.lineBetween(
                    vx - Math.cos(angle) * 17,
                    348 - Math.sin(angle) * 17,
                    vx + Math.cos(angle) * 17,
                    348 + Math.sin(angle) * 17,
                );
            }
        });
        this._vents = vents;

        // Cable bundles dangling from the ceiling — the thicker dark cables
        // are the lamp power cords and must align with the lamp positions below.
        const lightXs = [180, 420, 660, 900, 1140];
        const cables = this.add.graphics().setDepth(2);
        cables.lineStyle(3, 0x0a1018, 1);
        lightXs.forEach((cx) => {
            cables.lineBetween(cx, 0, cx, 60);
        });
        // Decorative thinner cables (not powering lamps) interleaved between.
        cables.lineStyle(2, 0x1c2632, 0.9);
        [120, 290, 510, 820, 1080].forEach((cx) => {
            cables.lineBetween(cx, 0, cx, 70);
        });

        // Catwalk (main floor) with edge highlights
        const catwalk = this.add.rectangle(640, 468, 1280, 164, 0x0d141c, 1).setDepth(1);
        const catwalkEdgeTop = this.add.rectangle(640, 388, 1280, 4, 0x3a6d8f, 0.9).setDepth(2);
        const catwalkEdgeBottom = this.add.rectangle(640, 550, 1280, 2, 0x1d3548, 0.85).setDepth(2);

        // Rail with bracket posts
        const rail = this.add.rectangle(640, 392, 1280, 6, 0x4a7a9a, 0.85).setDepth(2);
        const railShadow = this.add.rectangle(640, 396, 1280, 2, 0x0a1018, 0.7).setDepth(2);

        const railPosts = this.add.graphics().setDepth(2);
        railPosts.fillStyle(0x232c3a, 0.95);
        for (let px = 40; px <= 1240; px += 80) {
            railPosts.fillRect(px - 2, 392, 4, 12);
        }
        this._railPosts = railPosts;

        // Catwalk grid plates (subtle diagonal stripe pattern)
        const plates = this.add.graphics().setDepth(2);
        plates.lineStyle(1, 0x192230, 0.5);
        for (let px = 0; px < 1280; px += 64) {
            plates.lineBetween(px, 410, px, 548);
        }
        plates.lineStyle(1, 0x141b25, 0.7);
        for (let py = 410; py < 548; py += 22) {
            plates.lineBetween(0, py, 1280, py);
        }
        this._plates = plates;

        // Low-level red emergency strip (pulses subtly)
        this._emergencyStrip = this.add.rectangle(640, 556, 1280, 3, 0xb52a2a, 0.6).setDepth(2);
        this.tweens.add({
            targets: this._emergencyStrip,
            alpha: 0.85,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });

        // Pit glow at the bottom (industrial chasm)
        const pitGlow = this.add.ellipse(640, 706, 540, 70, 0xff5a3a, 0.18).setDepth(1);
        this.tweens.add({
            targets: pitGlow,
            alpha: 0.30,
            scaleX: 1.06,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const pitDark = this.add.rectangle(640, 660, 1280, 60, 0x010204, 0.96).setDepth(1);

        // Conveyor tile strip running below the catwalk
        this._conveyorTiles = [];
        const tileY = 600;
        for (let i = 0; i < 33; i += 1) {
            const tile = this.add.image(20 + (i * 40), tileY, 'conveyor_tile')
                .setDepth(2)
                .setAlpha(0.74);
            this._conveyorTiles.push(tile);
        }
        const conveyorEdge = this.add.rectangle(640, 580, 1280, 2, 0x2a3a4a, 0.85).setDepth(2);

        // Industrial overhead lights (housing + bulb + light cone)
        this._lights = [];
        this._lightCones = [];
        lightXs.forEach((lx) => {
            // Mounting strap
            const strap = this.add.rectangle(lx, 30, 4, 30, 0x1b2330, 1).setDepth(2);
            // Housing (industrial trapezoid look)
            const housing = this.add.graphics().setDepth(3);
            housing.fillStyle(0x2a3340, 1);
            housing.fillTriangle(lx - 36, 64, lx + 36, 64, lx + 24, 96);
            housing.fillTriangle(lx - 36, 64, lx - 24, 96, lx + 24, 96);
            housing.lineStyle(1, 0x0d1218, 1);
            housing.strokeTriangle(lx - 36, 64, lx + 36, 64, lx + 24, 96);
            housing.strokeTriangle(lx - 36, 64, lx - 24, 96, lx + 24, 96);
            // Bulb glow
            const bulb = this.add.ellipse(lx, 96, 38, 8, 0xffe9b2, 0.95).setDepth(4);
            const bulbCore = this.add.ellipse(lx, 96, 22, 4, 0xffffff, 1).setDepth(4);
            // Light cone falling onto the catwalk
            const cone = this.add.graphics().setDepth(2);
            cone.fillGradientStyle(0xffe9b2, 0xffe9b2, 0xffe9b2, 0xffe9b2, 0.18, 0.18, 0, 0);
            cone.fillTriangle(lx, 100, lx - 110, 388, lx + 110, 388);
            this._lights.push(strap, housing, bulb, bulbCore);
            this._lightCones.push(cone);
        });

        // Scrap button (used for red/mixed endings)
        this._scrapButtonGlow = this.add.rectangle(1038, 510, 168, 94, 0xff786f, 0.08)
            .setDepth(3)
            .setVisible(false);
        this._scrapButton = this.add.rectangle(1038, 510, 146, 72, 0x4c1312, 0.94)
            .setStrokeStyle(2, 0xff7c73, 0.84)
            .setDepth(4)
            .setVisible(false);
        this._scrapButtonLabel = this.add.text(1038, 510, 'SCRAP', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#ffd7d2',
            letterSpacing: 4,
        }).setOrigin(0.5).setDepth(5).setVisible(false);

        this._world.add([
            background,
            skyHigh,
            skyMid,
            haze,
            backWall,
            skyline,
            vents,
            cables,
            catwalk,
            catwalkEdgeTop,
            catwalkEdgeBottom,
            rail,
            railShadow,
            railPosts,
            plates,
            this._emergencyStrip,
            pitGlow,
            pitDark,
            ...this._conveyorTiles,
            conveyorEdge,
            ...this._lightCones,
            ...this._lights,
            this._scrapButtonGlow,
            this._scrapButton,
            this._scrapButtonLabel,
        ]);
    }

    _buildActors() {
        // Source asset (Robomanager.png) is 320x195, 5x upscaled to 1600x975.
        // 0.29 brings the rendered sprite to ~280px tall — fits on the catwalk.
        this._managerSprite = this.add.image(1440, 360, 'manager_robot')
            .setScale(0.29)
            .setDepth(10)
            .setVisible(false);
        // Umbrella placeholder is 120x180; original 1.4 was reasonable for that base.
        this._umbrellaSprite = this.add.image(1440, 360, 'machine_rebellious_umbrella')
            .setScale(1.1)
            .setDepth(11)
            .setVisible(false);

        // Player inspector silhouette — small foreground figure facing the antagonist.
        // Drawn inline so we don't depend on a baked sprite.
        // Player x=860 so it doesn't overlap the SCRAP button (which appears
        // at x=1038 in the umbrella_red / umbrella_mixed endings).
        //
        // The player is intentionally NOT added to _world so that during the
        // fall sequence, _world can rise past the player (catwalk goes up
        // while the player descends through the hole).
        // Container origin = visual center of the figure (~y=372 in scene
        // coords) so scale/rotate animations during the fall pivot around
        // the player's body, not their head.
        // Depth 30 so the player renders above the dialogue panel during the
        // fall (panel chrome is depths 20-23). The panel fades out at the
        // start of the fall sequence, but this guarantees no occlusion.
        this._playerFigure = this.add.container(860, 372).setDepth(30);
        const playerSilhouette = this.add.graphics();
        this._drawPlayerFigure(playerSilhouette);
        this._playerFigure.add(playerSilhouette);

        // Floor shadow under the player figure
        this._playerShadow = this.add.ellipse(860, 472, 84, 14, 0x000000, 0.5).setDepth(8);

        this._world.add([this._managerSprite, this._umbrellaSprite]);
    }

    _drawPlayerFigure(g) {
        // Inspector silhouette, back-of-head perspective, facing left toward the antagonist.
        // Body span in container-local coords: y ∈ [-102, 102] (centered on the
        // figure mid-section so scale/rotation pivot around the body).
        // Coat (torso)
        g.fillStyle(0x070b12, 1);
        g.fillRect(-22, -54, 44, 154);
        g.fillStyle(0x0d1620, 1);
        g.fillRect(-26, -12, 52, 64);
        // Shoulders
        g.fillStyle(0x111c28, 1);
        g.fillRect(-32, -52, 64, 22);
        // Neck
        g.fillStyle(0x0a1018, 1);
        g.fillRect(-8, -64, 16, 14);
        // Head (back of head, slightly turned)
        g.fillStyle(0x101820, 1);
        g.fillRect(-18, -98, 36, 38);
        // Hair tuft
        g.fillStyle(0x070a10, 1);
        g.fillRect(-16, -102, 32, 8);
        // Headset earpiece (faint cyan glow)
        g.fillStyle(0x4ad7ff, 0.85);
        g.fillRect(-22, -86, 4, 8);
        g.fillStyle(0x4ad7ff, 0.35);
        g.fillRect(-23, -87, 6, 10);
        // Subtle cyan rim light on the right edge of the silhouette
        g.fillStyle(0x2c5a78, 0.55);
        g.fillRect(20, -54, 2, 154);
        g.fillStyle(0x2c5a78, 0.55);
        g.fillRect(16, -98, 2, 38);
        // Pants/legs
        g.fillStyle(0x05080d, 1);
        g.fillRect(-18, 50, 14, 50);
        g.fillRect(4, 50, 14, 50);
        // Boots
        g.fillStyle(0x000000, 1);
        g.fillRect(-22, 94, 20, 8);
        g.fillRect(2, 94, 20, 8);
    }

    _buildUi() {
        // Drop shadow
        this._panelShadow = this.add.rectangle(640, 624, 980, 168, 0x000000, 0.45).setDepth(20);

        // Main panel
        this._panel = this.add.rectangle(640, 614, 968, 156, 0x06101a, 0.92)
            .setStrokeStyle(2, 0x6bb6da, 0.55)
            .setDepth(21);

        // Top accent bar (cyberpunk-style header strip)
        this._panelHeaderStrip = this.add.rectangle(640, 552, 968, 14, 0x0d2236, 0.95)
            .setStrokeStyle(1, 0x6bb6da, 0.5)
            .setDepth(22);
        // Header strip diagonal stripes
        const stripeOverlay = this.add.graphics().setDepth(22);
        stripeOverlay.fillStyle(0x6bb6da, 0.18);
        for (let sx = 158; sx < 1122; sx += 12) {
            stripeOverlay.fillTriangle(sx, 547, sx + 6, 547, sx, 559);
        }
        this._panelStripes = stripeOverlay;

        // Corner brackets (cyberpunk HUD signature)
        const brackets = this.add.graphics().setDepth(23);
        brackets.lineStyle(2, 0x8ddff5, 0.95);
        const drawCornerBracket = (cx, cy, dx, dy) => {
            brackets.lineBetween(cx, cy, cx + dx, cy);
            brackets.lineBetween(cx, cy, cx, cy + dy);
        };
        // 4 corners of the main panel
        drawCornerBracket(160, 540, 18, 0); drawCornerBracket(160, 540, 0, 18);
        drawCornerBracket(1120, 540, -18, 0); drawCornerBracket(1120, 540, 0, 18);
        drawCornerBracket(160, 690, 18, 0); drawCornerBracket(160, 690, 0, -18);
        drawCornerBracket(1120, 690, -18, 0); drawCornerBracket(1120, 690, 0, -18);
        this._panelBrackets = brackets;

        // Tag with red "alert" dot
        this._panelAlertDot = this.add.circle(174, 552, 4, 0xff5d5d, 1).setDepth(23);
        this.tweens.add({
            targets: this._panelAlertDot,
            alpha: 0.35,
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        this._panelTag = this.add.text(186, 545, 'FINAL TRANSMISSION', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#9fe2f5',
            letterSpacing: 4,
        }).setDepth(23);

        // Right-side meta tag
        this._panelMeta = this.add.text(1100, 545, 'CH//04', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#5a98b6',
            letterSpacing: 3,
        }).setOrigin(1, 0).setDepth(23);

        this._dialogueText = this.add.text(640, 614, '', {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#b8efff',
            align: 'center',
            wordWrap: { width: 880 },
            lineSpacing: 10,
        }).setOrigin(0.5).setDepth(23);

        this._titleCard = this.add.text(640, 338, TITLE_TEXT, {
            fontFamily: 'Courier New',
            fontSize: '30px',
            color: '#cdefff',
            align: 'center',
        }).setOrigin(0.5).setDepth(40).setAlpha(0);
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

        await this._showGradingScreen();
        await this._showTitleCard();
    }

    async _runReplacementEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 360, duration: 950 });
        this._startManagerIdle();
        await this._typeDialogueLines(ENDING_DIALOGUE.replacement, { color: '#aee7ff' });
        await this._wait(700);
    }

    async _runUmbrellaPurpleEnding() {
        await this._enterActor(this._umbrellaSprite, { x: 360, y: 360, duration: 980 });
        this._styleUmbrella('purple');
        await this._typeDialogueLines(ENDING_DIALOGUE.umbrella_purple, { color: '#ddb6ff' });
        await this._wait(700);
    }

    async _runUmbrellaRedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 360, duration: 900 });
        this._startManagerIdle();
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
        await this._enterActor(this._managerSprite, { x: 360, y: 360, duration: 900 });
        this._startManagerIdle();
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

    _startManagerIdle() {
        this._speakerTween?.stop();
        this._speakerTween = this.tweens.add({
            targets: this._managerSprite,
            y: '+=4',
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
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
                y: 470,
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

        // Fade out the dialogue panel chrome so the falling player isn't
        // occluded by it on the way down.
        this.tweens.add({
            targets: [
                this._panelShadow,
                this._panel,
                this._panelHeaderStrip,
                this._panelStripes,
                this._panelBrackets,
                this._panelAlertDot,
                this._panelTag,
                this._panelMeta,
            ],
            alpha: 0,
            duration: 300,
            ease: 'Sine.Out',
        });

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

        if (violent) {
            this.cameras.main.flash(220, 255, 95, 72, false);
        }
        this.cameras.main.shake(700, violent ? 0.03 : 0.018);

        // World rises above the player (parallax: gives the sense the player
        // is falling into the pit while the catwalk recedes upward).
        this.tweens.add({
            targets: this._world,
            y: -260,
            duration: 1350,
            ease: 'Cubic.In',
        });

        // Player physically falls into the pit — down, shrinking with
        // perspective, with a slight tumble for impact. Container origin is
        // at the figure's center so scale/rotation pivot around the body.
        this.tweens.add({
            targets: this._playerFigure,
            y: 820,
            scale: 0.35,
            angle: violent ? -52 : -22,
            duration: 1100,
            ease: 'Cubic.In',
            onComplete: () => {
                this._playerFigure.setVisible(false);
            },
        });
        this.tweens.add({
            targets: this._playerShadow,
            scaleX: 0.25,
            scaleY: 0.25,
            alpha: 0,
            duration: 600,
            ease: 'Cubic.In',
            onComplete: () => {
                this._playerShadow.setVisible(false);
            },
        });

        await this._wait(920);
        this.cameras.main.fade(700, 120, 6, 6);
        await this._wait(820);
    }

    async _showGradingScreen() {
        // Pulled together after the fall: a structured QC report so the
        // player sees how their run was scored. Letter grade S–F based on
        // a weighted blend of verdict accuracy, repair execution,
        // throughput and compensation. Each axis is rendered with its
        // own bar + the line of detail text the report layer produced.

        // Hide the catwalk world / dialogue chrome so the grading panel
        // sits on a clean black backdrop.
        this._world.setVisible(false);
        this._playerFigure.setVisible(false);
        this._playerShadow.setVisible(false);
        this._dialogueText.setVisible(false);
        this._panelShadow.setVisible(false);
        this._panel.setVisible(false);
        this._panelHeaderStrip.setVisible(false);
        this._panelStripes.setVisible(false);
        this._panelBrackets.setVisible(false);
        this._panelAlertDot.setVisible(false);
        this._panelTag.setVisible(false);
        this._panelMeta.setVisible(false);
        this._speakerTween?.stop();

        this.cameras.main.setZoom(1);
        this.cameras.main.fadeIn(450, 0, 0, 0);

        const report = buildGradingReport(GameState);
        const W  = 1280;
        const H  = 720;
        const cx = W / 2;

        const layer = this.add.container(0, 0).setDepth(60);

        const bg = this.add.rectangle(cx, H / 2, W, H, 0x040608, 1);
        layer.add(bg);

        // Soft scanline wash on top of the panel
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.18);
        for (let y = 0; y < H; y += 4) scan.fillRect(0, y, W, 1);
        layer.add(scan);

        const header = this.add.text(cx, 64, 'SHIFT EVALUATION', {
            fontFamily: 'Courier New', fontSize: '16px', color: '#cce6f0', letterSpacing: 6,
        }).setOrigin(0.5);
        const subhead = this.add.text(cx, 92, '// FOUR-DAY PERFORMANCE REVIEW', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#5a7a8c', letterSpacing: 4,
        }).setOrigin(0.5);
        const ruleTop = this.add.rectangle(cx, 116, 980, 1, 0x1a3548, 1);
        layer.add([header, subhead, ruleTop]);

        // Big letter grade panel on the left, axis breakdown on the right.
        const gradeBoxX = 280;
        const gradeBoxY = 280;
        const gradeBox = this.add.rectangle(gradeBoxX, gradeBoxY, 320, 320, 0x070b10, 1)
            .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(report.grade.color).color, 0.85);
        const gradeLabel = this.add.text(gradeBoxX, gradeBoxY - 110, 'FINAL GRADE', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#7a99ad', letterSpacing: 5,
        }).setOrigin(0.5);
        const gradeLetter = this.add.text(gradeBoxX, gradeBoxY - 5, report.grade.letter, {
            fontFamily: 'Courier New', fontSize: '180px', color: report.grade.color,
        }).setOrigin(0.5);
        const gradeScore = this.add.text(gradeBoxX, gradeBoxY + 92, `${report.finalScore} / 100`, {
            fontFamily: 'Courier New', fontSize: '20px', color: '#cce6f0', letterSpacing: 4,
        }).setOrigin(0.5);
        const gradeTone = this.add.text(gradeBoxX, gradeBoxY + 124, report.grade.tone, {
            fontFamily: 'Courier New', fontSize: '12px', color: '#7a99ad',
            wordWrap: { width: 296 }, align: 'center', lineSpacing: 4,
        }).setOrigin(0.5);
        layer.add([gradeBox, gradeLabel, gradeLetter, gradeScore, gradeTone]);

        // Axis breakdown column
        const breakdownX = 500;
        const breakdownTop = 156;
        const rowGap = 92;
        const breakdownLabel = this.add.text(breakdownX, breakdownTop - 28, 'BREAKDOWN', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#7a99ad', letterSpacing: 5,
        }).setOrigin(0, 0.5);
        layer.add(breakdownLabel);

        report.axes.forEach((axis, idx) => {
            const baseY = breakdownTop + idx * rowGap;
            const axisColor = axis.score >= 85 ? '#7be3a3'
                : axis.score >= 65 ? '#9ad6ff'
                    : axis.score >= 60 ? '#e6cc6a'
                        : '#ff7a7a';

            const axisLabel = this.add.text(breakdownX, baseY, axis.label, {
                fontFamily: 'Courier New', fontSize: '14px', color: '#cce6f0', letterSpacing: 3,
            }).setOrigin(0, 0.5);

            const axisWeight = this.add.text(breakdownX, baseY + 18, `WEIGHT ${axis.weight}%`, {
                fontFamily: 'Courier New', fontSize: '10px', color: '#4f6878', letterSpacing: 2,
            }).setOrigin(0, 0.5);

            const axisScore = this.add.text(breakdownX + 460, baseY, `${Math.round(axis.score)}`, {
                fontFamily: 'Courier New', fontSize: '20px', color: axisColor,
            }).setOrigin(1, 0.5);

            // Score bar — track + fill, fill width tweens in on reveal
            const barTrackY = baseY + 38;
            const barTrack = this.add.rectangle(breakdownX, barTrackY, 460, 8, 0x0d1620, 1)
                .setStrokeStyle(1, 0x1d2f3e, 0.8)
                .setOrigin(0, 0.5);
            const fillWidth = Math.max(1, (axis.score / 100) * 460);
            const barFill = this.add.rectangle(breakdownX, barTrackY, 1, 8,
                Phaser.Display.Color.HexStringToColor(axisColor).color, 1).setOrigin(0, 0.5);

            const detail = this.add.text(breakdownX, baseY + 58, axis.detail, {
                fontFamily: 'Courier New', fontSize: '11px', color: '#6c8a9e',
                wordWrap: { width: 580 }, lineSpacing: 3,
            }).setOrigin(0, 0);

            layer.add([axisLabel, axisWeight, axisScore, barTrack, barFill, detail]);

            this.tweens.add({
                targets: barFill,
                width: fillWidth,
                duration: 700,
                delay: 220 + idx * 140,
                ease: 'Cubic.Out',
            });
        });

        // Continue button
        const btnY  = 656;
        const btnBg = this.add.rectangle(cx, btnY, 220, 40, 0x0a0e14, 1)
            .setStrokeStyle(1, 0x3a5d76, 0.9)
            .setInteractive({ useHandCursor: true });
        const btnLabel = this.add.text(cx, btnY, 'CONTINUE', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#9ac0d4', letterSpacing: 5,
        }).setOrigin(0.5);
        layer.add([btnBg, btnLabel]);

        btnBg.on('pointerover', () => {
            btnBg.setStrokeStyle(1, 0x6ea4c4, 1);
            btnLabel.setColor('#cce6f0');
        });
        btnBg.on('pointerout', () => {
            btnBg.setStrokeStyle(1, 0x3a5d76, 0.9);
            btnLabel.setColor('#9ac0d4');
        });

        await new Promise((resolve) => {
            btnBg.once('pointerdown', () => {
                this.cameras.main.fade(420, 0, 0, 0);
                this.time.delayedCall(420, () => {
                    layer.destroy();
                    resolve(true);
                });
            });
        });
    }

    async _showTitleCard() {
        // hide everything so the title appears on a clean black screen
        this._world.setVisible(false);
        this._playerFigure.setVisible(false);
        this._playerShadow.setVisible(false);
        this._dialogueText.setVisible(false);
        this._panelShadow.setVisible(false);
        this._panel.setVisible(false);
        this._panelHeaderStrip.setVisible(false);
        this._panelStripes.setVisible(false);
        this._panelBrackets.setVisible(false);
        this._panelAlertDot.setVisible(false);
        this._panelTag.setVisible(false);
        this._panelMeta.setVisible(false);
        this._speakerTween?.stop();

        this.cameras.main.fadeIn(700, 0, 0, 0);

        this.tweens.add({
            targets: this._titleCard,
            alpha: 1,
            duration: 1000,
            delay: 160,
        });

        await this._wait(4200);
        this.cameras.main.fade(700, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Credits'));
    }

    _wait(duration) {
        return new Promise((resolve) => {
            this.time.delayedCall(duration, () => resolve(true));
        });
    }
}

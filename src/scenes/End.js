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
const DOGSI_ENDING_PATH = '/dogsi.mp3';
const PAYCHECK_DELTA = 18;
const CREDIT_ROLL_TEXT = [
    'From the mind of: Big O',
    '',
    '',
    'Credits',
    '',
    '',
    'Programming',
    '',
    'Claude',
    '',
    'Orion Allen Borntrager',
    '',
    'Safiullah Baig',
    '',
    'Andrew Bui',
    '',
    'Abhimanyu Bhalla',
    '',
    'Ethan Nishimura',
    '',
    'Minh Tran',
    '',
    '',
    'Art:',
    '',
    'Ishita Pradhan',
    '',
    'Pranaav Makharia',
    '',
    'Jacqueline King',
    '',
    'Pranet Ramanan',
    '',
    'Jacob Jansta',
    '',
    'Minh Tran',
    '',
    '',
    'Storyboarding',
    '',
    'Zachary Boseman',
    '',
    'Jacqueline King',
    '',
    'Geetika Joshi',
    '',
    'Christian Gonzalez',
    '',
    'Caleb Livingston',
    '',
    '',
    'Music & Sound',
    '',
    'Shane Ollek',
    '',
    'Julien Vincent',
    '',
    '',
    'thanks to wavedash and gamedev.js',
    '',
    'for hosting the gamejam',
    '',
    '',
    'Special thanks to: Claude.',
    '',
    "You were there when we weren't.",
].join('\n');
const SCORE_GRADES = Object.freeze([
    { grade: 'Z', min: 0 },
    { grade: 'F', min: 15 },
    { grade: 'C-', min: 28 },
    { grade: 'C+', min: 40 },
    { grade: 'B-', min: 52 },
    { grade: 'B+', min: 64 },
    { grade: 'A-', min: 74 },
    { grade: 'A+', min: 82 },
    { grade: 'A++', min: 89 },
    { grade: 'S', min: 94 },
    { grade: 'S+++', min: 98 },
]);

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
        this._creditsTween = null;
        this._creditsResolve = null;
        this._creditsFinished = false;
        this._scoreContainer = null;
        this._factoryIntro = null;
        this._eerieBlueOverlay = null;

        applyCyberpunkLook(this);
        this.cameras.main.setBackgroundColor('#050709');

        this._world = this.add.container(0, 0);
        this._buildStage();
        this._buildActors();
        this._buildUi();
        this._eerieBlueOverlay = this.add.rectangle(640, 360, 1280, 720, 0x4877bd, 1)
            .setDepth(34)
            .setVisible(false)
            .setAlpha(0);
        this._buildFactoryIntroArt();
        this._world.setVisible(false).setAlpha(0);
        this._playCutsceneMusic();

        const scan = this.add.graphics().setDepth(100);
        scan.fillStyle(0x000000, 0.24);
        for (let y = 0; y < 720; y += 4) {
            scan.fillRect(0, y, 1280, 2);
        }

        this.events.on('shutdown', () => {
            this._speakerTween?.stop();
            this._creditsTween?.stop();
            this._music?.stop();
            this._music = null;
            this._stopDogsiAudio();
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
            void this._runStageIntroThenEnding();
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

        // Low-level safety strip (pulses subtly)
        this._emergencyStrip = this.add.rectangle(640, 556, 1280, 3, 0x2a80b5, 0.6).setDepth(2);
        this.tweens.add({
            targets: this._emergencyStrip,
            alpha: 0.85,
            duration: 1400,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });

        // Pit glow at the bottom (industrial chasm)
        const pitGlow = this.add.ellipse(640, 706, 540, 70, 0x4ab8ff, 0.16).setDepth(1);
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

    _buildFactoryIntroArt() {
        const intro = this.add.container(0, 0).setDepth(64).setAlpha(1);
        const background = this.add.rectangle(640, 360, 1280, 720, 0x03070b, 1);
        const layers = [background];
        const addLayer = (key, alpha = 1) => {
            if (!this.textures.exists(key)) return null;

            const image = this.add.image(640, 360, key)
                .setOrigin(0.5)
                .setAlpha(alpha);
            const scale = Math.max(
                1280 / Math.max(1, image.width || 1280),
                720 / Math.max(1, image.height || 720),
            );
            image.setScale(scale);
            layers.push(image);
            return image;
        };

        addLayer('mainview_bottom', 1);
        addLayer('mainview_second', 1);
        addLayer('mainview_lightradiance', 0.68);
        addLayer('mainview_lightlayer', 0.82);

        layers.push(this.add.rectangle(640, 360, 1280, 720, 0x02080e, 0.18));
        intro.add(layers);
        this._factoryIntro = intro;
    }

    _playStageLightsCue() {
        if (!this.cache.audio.has(SOUND_ASSETS.inspectionReveal.key)) return;

        this.sound.play(SOUND_ASSETS.inspectionReveal.key, {
            volume: SOUND_VOLUMES.reveal * 0.9,
        });
    }

    _getReplacementEntranceLightTargets() {
        return [
            ...(this._lightCones || []),
            ...(this._lights || []),
            this._emergencyStrip,
        ].filter(Boolean);
    }

    _getReplacementEntranceGuiTargets() {
        return [
            this._panelShadow,
            this._panel,
            this._panelHeaderStrip,
            this._panelStripes,
            this._panelBrackets,
            this._panelAlertDot,
            this._panelTag,
            this._panelMeta,
        ].filter(Boolean);
    }

    async _setReplacementEerieState(active = true, { duration = 2000 } = {}) {
        const lightTargets = this._getReplacementEntranceLightTargets();
        const guiTargets = this._getReplacementEntranceGuiTargets();
        const tweens = [];

        if (lightTargets.length > 0) {
            tweens.push(this._tweenAsync({
                targets: lightTargets,
                alpha: active ? 0.06 : 1,
                duration,
                ease: 'Sine.InOut',
            }));
        }

        if (guiTargets.length > 0) {
            tweens.push(this._tweenAsync({
                targets: guiTargets,
                alpha: active ? 0 : 1,
                duration,
                ease: 'Sine.InOut',
            }));
        }

        if (this._eerieBlueOverlay) {
            this._eerieBlueOverlay.setVisible(true);
            tweens.push(this._tweenAsync({
                targets: this._eerieBlueOverlay,
                alpha: active ? 0.34 : 0,
                duration,
                ease: 'Sine.InOut',
                onComplete: () => {
                    if (!active) {
                        this._eerieBlueOverlay?.setVisible(false);
                    }
                },
            }));
        }

        await Promise.all(tweens);
    }

    async _runStageIntroThenEnding() {
        await this._wait(2600);
        this._playStageLightsCue();
        this.cameras.main.flash(220, 208, 244, 255, false);

        this._world.setVisible(true).setAlpha(0);
        const revealTweens = [
            this._tweenAsync({
                targets: this._world,
                alpha: 1,
                duration: 1200,
                ease: 'Sine.Out',
            }),
        ];

        if (this._factoryIntro) {
            revealTweens.push(this._tweenAsync({
                targets: this._factoryIntro,
                alpha: 0,
                duration: 1200,
                ease: 'Sine.Out',
            }));
        }

        await Promise.all(revealTweens);
        this._factoryIntro?.setVisible(false);
        await this._runEndingSequence();
    }

    _buildActors() {
        // Source asset is 128x128 with a 5x nearest upscale already baked in (640x640).
        // 0.44 brings the rendered sprite to ~280px tall — fits on the catwalk.
        this._managerSprite = this.add.image(1440, 360, 'manager_robot')
            .setScale(0.44)
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
        this._panelTag = this.add.text(186, 545, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#9fe2f5',
            letterSpacing: 4,
        }).setDepth(23);

        // Right-side meta tag
        this._panelMeta = this.add.text(1100, 545, '', {
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

        this._speechBubble = this.add.container(0, 0).setDepth(35).setVisible(false);
        this._speechBubbleShadow = this.add.graphics();
        this._speechBubbleBody = this.add.graphics();
        this._speechBubbleTail = this.add.graphics();
        this._speechBubbleTag = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#16313a',
            letterSpacing: 3,
        }).setOrigin(0, 0);
        this._speechBubbleText = this.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '20px',
            color: '#13252b',
            wordWrap: { width: 496 },
            lineSpacing: 7,
        }).setOrigin(0, 0);
        this._speechBubble.add([
            this._speechBubbleShadow,
            this._speechBubbleTail,
            this._speechBubbleBody,
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
        this._playAgainBg.disableInteractive().setVisible(false);
        this._playAgainText.setVisible(false);

        this._creditsContainer = this.add.container(640, 760).setDepth(48).setVisible(false).setAlpha(0);
        this._creditsText = this.add.text(0, 0, CREDIT_ROLL_TEXT, {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#d9f6ff',
            align: 'center',
            lineSpacing: 18,
        }).setOrigin(0.5, 0);
        this._creditsContainer.add(this._creditsText);

        this._skipCreditsBg = this.add.rectangle(1096, 674, 228, 42, 0x08111c, 0.94)
            .setStrokeStyle(1, 0x5a98b6, 0.82)
            .setDepth(58)
            .setAlpha(0)
            .setVisible(false)
            .setInteractive({ useHandCursor: true });
        this._skipCreditsText = this.add.text(1096, 674, 'SKIP CREDITS', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#9fe2f5',
            letterSpacing: 2,
        }).setOrigin(0.5).setDepth(59).setAlpha(0).setVisible(false);
        this._skipCreditsBg.on('pointerover', () => {
            this._skipCreditsBg?.setStrokeStyle(1, 0x9fe2f5, 0.95);
            this._skipCreditsText?.setColor('#d8f7ff');
        });
        this._skipCreditsBg.on('pointerout', () => {
            this._skipCreditsBg?.setStrokeStyle(1, 0x5a98b6, 0.82);
            this._skipCreditsText?.setColor('#9fe2f5');
        });
        this._skipCreditsBg.on('pointerdown', () => this._finishCreditsNow());
        this._skipCreditsBg.disableInteractive();

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
        if (this._dogsiAudio || typeof Audio === 'undefined') return;

        const musicVolume = getMusicVolume();
        if (musicVolume <= 0) return;

        const audio = new Audio(DOGSI_ENDING_PATH);
        audio.preload = 'auto';
        audio.volume = Phaser.Math.Clamp(0.72 * Math.max(0.45, musicVolume), 0, 0.72);

        audio.addEventListener('ended', () => {
            if (this._dogsiAudio === audio) this._dogsiAudio = null;
        }, { once: true });
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
            // Ignore reset failures from partially loaded media.
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
        this._managerSprite.setTint(0x8ccfff);
        await Promise.all([
            this._setReplacementEerieState(true, { duration: 2200 }),
            this._enterActor(this._managerSprite, {
                x: 360,
                y: 360,
                startX: 1700,
                duration: 5600,
                ease: 'Sine.InOut',
                alphaFrom: 0.08,
                scaleFromFactor: 0.82,
            }),
        ]);
        this._startManagerIdle();
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.replacement, {
            speaker: 'MANAGER BOT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            stroke: 0x67c8ef,
            textColor: '#13252b',
        });
        await this._wait(700);
    }

    async _runUmbrellaPurpleEnding() {
        await this._enterActor(this._umbrellaSprite, { x: 360, y: 360, duration: 1700 });
        this._styleUmbrella('purple');
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_purple, {
            speaker: 'UMBRELLA',
            accent: 0xdba8ff,
            fill: 0x21102e,
            stroke: 0xb86cff,
            textColor: '#f4dcff',
        });
        await this._wait(700);
    }

    async _runUmbrellaRedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 360, duration: 1800 });
        this._startManagerIdle();
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_manager, {
            speaker: 'MANAGER BOT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            stroke: 0x67c8ef,
            textColor: '#13252b',
        });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('red');
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_confused, {
            speaker: 'MANAGER BOT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            stroke: 0x67c8ef,
            textColor: '#13252b',
            holdMs: 800,
        });
        await dropPromise;
        await this._scrapManagerActor();
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_red, {
            speaker: 'UMBRELLA',
            accent: 0xff8f86,
            fill: 0x2a0707,
            stroke: 0xff6f66,
            textColor: '#ffd8d3',
        });
        await this._runExplosionLeadIn();
    }

    async _runUmbrellaMixedEnding() {
        this._managerSprite.setTint(0x8ccfff);
        await this._enterActor(this._managerSprite, { x: 360, y: 360, duration: 1800 });
        this._startManagerIdle();
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_manager, {
            speaker: 'MANAGER BOT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            stroke: 0x67c8ef,
            textColor: '#13252b',
        });
        this._showScrapButton();
        const dropPromise = this._dropUmbrellaToButton('mixed');
        await this._bubbleDialogue(this._managerSprite, ENDING_DIALOGUE.umbrella_red_confused, {
            speaker: 'MANAGER BOT',
            accent: 0x8df5ff,
            fill: 0xf2feff,
            stroke: 0x67c8ef,
            textColor: '#13252b',
            holdMs: 800,
        });
        await dropPromise;
        await this._scrapManagerActor();
        await this._bubbleDialogue(this._umbrellaSprite, ENDING_DIALOGUE.umbrella_mixed, {
            speaker: 'UMBRELLA',
            accent: 0xefbcff,
            fill: 0x24112e,
            stroke: 0xd28cff,
            textColor: '#f8ddff',
        });
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

    _enterActor(actor, { x, y, duration = 900, startX = 1440, ease = 'Cubic.Out', alphaFrom = 1, scaleFromFactor = 1 } = {}) {
        const targetScaleX = actor.scaleX || 1;
        const targetScaleY = actor.scaleY || 1;
        actor.setVisible(true);
        actor.setAlpha(alphaFrom);
        actor.setPosition(startX, y ?? actor.y);
        actor.setAngle(0);
        actor.setScale(targetScaleX * scaleFromFactor, targetScaleY * scaleFromFactor);

        return new Promise((resolve) => {
            this.tweens.add({
                targets: actor,
                x,
                y: y ?? actor.y,
                alpha: 1,
                scaleX: targetScaleX,
                scaleY: targetScaleY,
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
            this.cameras.main.flash(90, 190, 230, 255, false);
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

    async _bubbleDialogue(actor, lines, options = {}) {
        if (!this._speechBubble) {
            return this._typeDialogueLines(lines, { color: options.textColor || '#b8efff' });
        }

        const entries = Array.isArray(lines) ? lines : [String(lines || '')];
        this._dialogueText.setText('');
        this._speechBubble.setVisible(true).setAlpha(1);

        for (const entry of entries) {
            const line = String(entry || '');
            this._layoutSpeechBubble(actor, line, options);
            await this._typeSpeechBubbleLine(line);
            await this._wait(options.holdMs ?? 1050);
        }

        await new Promise((resolve) => {
            this.tweens.add({
                targets: this._speechBubble,
                alpha: 0,
                duration: 180,
                ease: 'Sine.Out',
                onComplete: () => {
                    this._speechBubble.setVisible(false).setAlpha(1);
                    resolve(true);
                },
            });
        });

        return true;
    }

    _layoutSpeechBubble(actor, line, options = {}) {
        const actorX = actor?.x ?? 640;
        const actorY = actor?.y ?? 360;
        const actorHeight = actor?.displayHeight || 160;
        const bubbleW = Phaser.Math.Clamp(options.width || 560, 420, 620);
        const charsPerLine = Math.max(28, Math.floor((bubbleW - 56) / 13));
        const rowCount = Math.max(1, Math.ceil(String(line || '').length / charsPerLine));
        const bubbleH = Phaser.Math.Clamp(72 + (rowCount * 27), 116, 202);
        const side = options.side || (actorX < 640 ? 'right' : 'left');
        const desiredX = side === 'right'
            ? actorX + Math.max(74, actorHeight * 0.25)
            : actorX - bubbleW - Math.max(74, actorHeight * 0.25);
        const bubbleX = Phaser.Math.Clamp(desiredX, 40, 1280 - bubbleW - 40);
        const bubbleY = Phaser.Math.Clamp(actorY - bubbleH - Math.max(88, actorHeight * 0.32), 52, 420);
        const tailY = actorY - Math.max(24, actorHeight * 0.24);
        const tailX = Phaser.Math.Clamp(actorX, bubbleX + 44, bubbleX + bubbleW - 44);
        const accent = options.accent ?? 0x8df5ff;
        const bubbleFill = options.fill ?? 0xf2feff;
        const bubbleStroke = options.stroke ?? accent;
        const textColor = options.textColor || '#13252b';

        this._speechBubbleShadow.clear();
        this._speechBubbleShadow.fillStyle(0x000000, 0.34);
        this._speechBubbleShadow.fillRoundedRect(bubbleX + 8, bubbleY + 10, bubbleW, bubbleH, 18);

        this._speechBubbleTail.clear();
        this._speechBubbleTail.fillStyle(bubbleFill, 0.98);
        this._speechBubbleTail.fillTriangle(tailX - 18, bubbleY + bubbleH - 4, tailX + 14, bubbleY + bubbleH - 4, actorX, tailY);
        this._speechBubbleTail.lineStyle(2, bubbleStroke, 0.82);
        this._speechBubbleTail.lineBetween(tailX - 18, bubbleY + bubbleH - 4, actorX, tailY);
        this._speechBubbleTail.lineBetween(tailX + 14, bubbleY + bubbleH - 4, actorX, tailY);

        this._speechBubbleBody.clear();
        this._speechBubbleBody.fillStyle(bubbleFill, 0.98);
        this._speechBubbleBody.fillRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 18);
        this._speechBubbleBody.lineStyle(3, bubbleStroke, 0.96);
        this._speechBubbleBody.strokeRoundedRect(bubbleX, bubbleY, bubbleW, bubbleH, 18);
        this._speechBubbleBody.fillStyle(accent, 0.18);
        this._speechBubbleBody.fillRoundedRect(bubbleX + 12, bubbleY + 10, bubbleW - 24, 22, 10);

        this._speechBubbleTag
            .setText(options.speaker || 'TRANSMISSION')
            .setColor(options.tagColor || textColor)
            .setPosition(bubbleX + 24, bubbleY + 14);
        this._speechBubbleText
            .setText('')
            .setColor(textColor)
            .setWordWrapWidth(bubbleW - 56)
            .setPosition(bubbleX + 24, bubbleY + 48);
    }

    _typeSpeechBubbleLine(line) {
        return new Promise((resolve) => {
            const text = String(line || '');
            this._speechBubbleText.setText('');

            if (/^Employee\s+\d+/i.test(text)) {
                this._playDogsiAudio();
            }

            if (!text.length) {
                this.time.delayedCall(220, () => resolve(true));
                return;
            }

            let index = 0;
            this.time.addEvent({
                delay: 34,
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

    async _runFallSequence({ violent = false } = {}) {
        this._dialogueText.setAlpha(0);
        this._speechBubble?.setVisible(false);

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
            this.cameras.main.flash(220, 190, 230, 255, false);
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
        this.cameras.main.fade(700, 0, 0, 0);
        await this._wait(820);
    }

    async _showTitleCard() {
        // hide everything so the title appears on a clean black screen
        this._world.setVisible(false);
        this._playerFigure.setVisible(false);
        this._playerShadow.setVisible(false);
        this._dialogueText.setVisible(false);
        this._speechBubble?.setVisible(false);
        this._panelShadow.setVisible(false);
        this._panel.setVisible(false);
        this._panelHeaderStrip.setVisible(false);
        this._panelStripes.setVisible(false);
        this._panelBrackets.setVisible(false);
        this._panelAlertDot.setVisible(false);
        this._panelTag.setVisible(false);
        this._panelMeta.setVisible(false);
        this._speakerTween?.stop();
        this._setPlayAgainVisible(false);

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

        await this._wait(1900);
        await this._tweenAsync({
            targets: this._titleCard,
            y: 96,
            scale: 0.82,
            duration: 1300,
            ease: 'Cubic.InOut',
        });
        await this._runCreditsSequence();
        await this._showScoreScreen();
    }

    _setPlayAgainVisible(visible) {
        const isVisible = Boolean(visible);
        this._playAgainBg
            ?.setVisible(isVisible)
            .setAlpha(isVisible ? 1 : 0)
            .setPosition(640, 660)
            .setDepth(58);
        this._playAgainText
            ?.setVisible(isVisible)
            .setAlpha(isVisible ? 1 : 0)
            .setPosition(640, 660)
            .setDepth(59);

        if (isVisible) {
            this._playAgainBg?.setInteractive({ useHandCursor: true });
        } else {
            this._playAgainBg?.disableInteractive();
        }
    }

    _setSkipCreditsVisible(visible) {
        const isVisible = Boolean(visible);
        this._skipCreditsBg
            ?.setVisible(isVisible)
            .setAlpha(isVisible ? 1 : 0);
        this._skipCreditsText
            ?.setVisible(isVisible)
            .setAlpha(isVisible ? 1 : 0);

        if (isVisible) {
            this._skipCreditsBg?.setInteractive({ useHandCursor: true });
        } else {
            this._skipCreditsBg?.disableInteractive();
        }
    }

    _runCreditsSequence() {
        this._creditsFinished = false;
        this._creditsContainer
            ?.setVisible(true)
            .setAlpha(1)
            .setY(760);
        this._setSkipCreditsVisible(true);

        const creditHeight = this._creditsText?.height || 900;
        const endY = -creditHeight - 120;
        const duration = Math.max(24000, creditHeight * 28);

        return new Promise((resolve) => {
            this._creditsResolve = resolve;
            this._creditsTween = this.tweens.add({
                targets: this._creditsContainer,
                y: endY,
                duration,
                ease: 'Linear',
                onComplete: () => this._finishCreditsNow(),
            });
        });
    }

    _finishCreditsNow() {
        if (this._creditsFinished) return;
        this._creditsFinished = true;

        const tween = this._creditsTween;
        this._creditsTween = null;
        tween?.stop();

        this._creditsContainer?.setVisible(false).setAlpha(0);
        this._setSkipCreditsVisible(false);

        const resolve = this._creditsResolve;
        this._creditsResolve = null;
        resolve?.(true);
    }

    async _showScoreScreen() {
        const summary = this._buildEndScoreSummary();
        this._titleCard.setVisible(false);
        this._scoreContainer?.destroy(true);

        this._scoreContainer = this.add.container(0, 0).setDepth(52).setAlpha(0);
        const bg = this.add.rectangle(640, 360, 1280, 720, 0x010306, 0.98);
        const topLine = this.add.rectangle(640, 54, 1040, 2, 0x5a98b6, 0.7);
        const title = this.add.text(640, 84, 'PERFORMANCE REVIEW', {
            fontFamily: 'Courier New',
            fontSize: '24px',
            color: '#cdefff',
            letterSpacing: 5,
        }).setOrigin(0.5);
        const gradeLabel = this.add.text(640, 142, 'FINAL GRADE', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#7fbad1',
            letterSpacing: 4,
        }).setOrigin(0.5);
        const grade = this.add.text(640, 210, summary.grade, {
            fontFamily: 'Courier New',
            fontSize: summary.grade.length > 2 ? '76px' : '92px',
            color: summary.grade === 'M' ? '#ffd685' : '#e6fbff',
            letterSpacing: 4,
        }).setOrigin(0.5);
        const scoreLine = this.add.text(640, 274, `${summary.score}/100 // ${summary.verdict}`, {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#9fe2f5',
            align: 'center',
        }).setOrigin(0.5);
        const statsTitle = this.add.text(210, 332, 'HOW YOUR SCORE WAS GRADED', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: '#8ddff5',
            letterSpacing: 3,
        }).setOrigin(0, 0.5);
        const statsText = this.add.text(210, 362, summary.lines.join('\n'), {
            fontFamily: 'Courier New',
            fontSize: '15px',
            color: '#d9f6ff',
            lineSpacing: 8,
            wordWrap: { width: 860 },
        }).setOrigin(0, 0);
        const bottomLine = this.add.rectangle(640, 626, 860, 1, 0x334455, 0.9);

        this._scoreContainer.add([bg, topLine, title, gradeLabel, grade, scoreLine, statsTitle, statsText, bottomLine]);
        this._setPlayAgainVisible(true);

        await this._tweenAsync({
            targets: this._scoreContainer,
            alpha: 1,
            duration: 700,
            ease: 'Sine.Out',
        });
    }

    _buildEndScoreSummary() {
        const outcomes = Array.isArray(GameState.trackedMachineOutcomes)
            ? GameState.trackedMachineOutcomes
            : [];
        const mistakes = Math.max(0, Number(GameState.totalMistakes || 0));
        const netMoney = Number(GameState.paycheckTotal || 0);
        const totalCases = outcomes.length;
        const readyCount = outcomes.filter((outcome) => outcome.ready).length;
        const readyRate = totalCases > 0 ? readyCount / totalCases : 1;
        const puzzleTotals = this._collectPuzzleTotals(outcomes);
        const timingStats = {
            grid: GameState.getPuzzleTimingStats?.('grid') || { count: 0, averageMs: 0 },
            flow: GameState.getPuzzleTimingStats?.('flow') || { count: 0, averageMs: 0 },
            gear: GameState.getPuzzleTimingStats?.('gear') || { count: 0, averageMs: 0 },
            code: GameState.getPuzzleTimingStats?.('code') || { count: 0, averageMs: 0 },
        };
        const completionRate = puzzleTotals.required > 0 ? puzzleTotals.completed / puzzleTotals.required : 1;
        const resolvedRate = puzzleTotals.required > 0 ? puzzleTotals.resolved / puzzleTotals.required : 1;
        const totalMoneyLost = Math.max(0, mistakes * PAYCHECK_DELTA);
        const totalMoneyMade = Math.max(0, netMoney) + totalMoneyLost;
        const clownBonus = this._getClownBonusAmount();
        const rawScore = Phaser.Math.Clamp(
            38
                + (completionRate * 28)
                + (resolvedRate * 12)
                + (readyRate * 18)
                + Phaser.Math.Clamp(netMoney / PAYCHECK_DELTA, -10, 10)
                + (clownBonus > 0 ? 3 : 0)
                - (mistakes * 12),
            0,
            100,
        );
        const perfect = totalCases > 0
            && mistakes === 0
            && completionRate >= 1
            && resolvedRate >= 1
            && readyRate >= 1
            && netMoney >= (totalCases * PAYCHECK_DELTA);
        const grade = perfect ? 'M' : this._gradeFromScore(rawScore);
        const score = perfect ? 100 : Math.round(rawScore);
        const netPercent = Phaser.Math.Clamp(Math.round(18 + (netMoney / Math.max(PAYCHECK_DELTA, totalCases * PAYCHECK_DELTA)) * 42), 2, 96);
        const verdict = perfect
            ? 'LITERALLY PERFECT GAMEPLAY'
            : (score >= 94 ? 'ELITE FLOOR PERFORMANCE' : (score >= 74 ? 'ABOVE QUOTA' : (score >= 40 ? 'KEPT EMPLOYED' : 'CORPORATE EVIDENCE BAG')));

        return {
            grade,
            score,
            verdict,
            lines: [
                `- mistakes: ${mistakes}`,
                this._formatPuzzleTimeLine('average debug puzzle time', timingStats.code, 96),
                this._formatPuzzleTimeLine('average circuit puzzle time', timingStats.grid, 84),
                this._formatPuzzleTimeLine('average gear puzzle time', timingStats.gear, 112),
                this._formatPuzzleTimeLine('average wiring puzzle time', timingStats.flow, 90),
                `- total money made: $${totalMoneyMade.toFixed(2)}`,
                `- total money lost: $${totalMoneyLost.toFixed(2)}`,
                `- net money: $${netMoney.toFixed(2)} (${netPercent}% ahead of everyone else)`,
                `- clown bonus: ${clownBonus > 0 ? `+$${clownBonus.toFixed(2)} APPLIED` : '$0.00'}`,
            ],
        };
    }

    _collectPuzzleTotals(outcomes) {
        const byKey = {
            grid: { required: 0, completed: 0, resolved: 0 },
            flow: { required: 0, completed: 0, resolved: 0 },
            gear: { required: 0, completed: 0, resolved: 0 },
            code: { required: 0, completed: 0, resolved: 0 },
        };

        outcomes.forEach((outcome) => {
            Object.entries(outcome.puzzleResults || {}).forEach(([key, result]) => {
                if (!byKey[key]) return;
                if (!result?.required) return;
                byKey[key].required += 1;
                if (result.completed) byKey[key].completed += 1;
                if (result.resolved) byKey[key].resolved += 1;
            });
        });

        return {
            byKey,
            required: Object.values(byKey).reduce((sum, entry) => sum + entry.required, 0),
            completed: Object.values(byKey).reduce((sum, entry) => sum + entry.completed, 0),
            resolved: Object.values(byKey).reduce((sum, entry) => sum + entry.resolved, 0),
        };
    }

    _formatPuzzleTimeLine(label, timingStats, benchmarkSeconds) {
        const count = Math.max(0, Number(timingStats?.count || 0));
        if (count <= 0) {
            return `- ${label}: N/A (no normal completed runs recorded)`;
        }

        const averageSeconds = Math.max(0, Number(timingStats.averageMs || 0) / 1000);
        const benchmark = Math.max(1, Number(benchmarkSeconds || 1));
        const deltaPercent = Phaser.Math.Clamp(Math.round(Math.abs((benchmark - averageSeconds) / benchmark) * 100), 1, 98);
        const comparison = averageSeconds <= benchmark
            ? `${deltaPercent}% faster than everyone else`
            : `${deltaPercent}% slower than everyone else`;
        return `- ${label}: ${this._formatDuration(averageSeconds)} (${comparison}, ${count} run${count === 1 ? '' : 's'})`;
    }

    _formatDuration(totalSeconds) {
        const seconds = Math.max(0, Math.round(totalSeconds));
        const minutes = Math.floor(seconds / 60);
        const remainder = String(seconds % 60).padStart(2, '0');
        return `${minutes}:${remainder}`;
    }

    _getClownBonusAmount() {
        if (this._endingVariant === 'umbrella_red' || this._endingVariant === 'umbrella_mixed') {
            return 20;
        }

        const deal = GameState.jesterDeal;
        if (deal?.rewardGranted) {
            return Number(deal.benefactorBonus || 20);
        }

        return 0;
    }

    _gradeFromScore(score) {
        let grade = SCORE_GRADES[0].grade;
        SCORE_GRADES.forEach((entry) => {
            if (score >= entry.min) grade = entry.grade;
        });
        return grade;
    }

    _tweenAsync(config) {
        return new Promise((resolve) => {
            this.tweens.add({
                ...config,
                onComplete: (...args) => {
                    config.onComplete?.(...args);
                    resolve(true);
                },
            });
        });
    }

    _wait(duration) {
        return new Promise((resolve) => {
            this.time.delayedCall(duration, () => resolve(true));
        });
    }
}

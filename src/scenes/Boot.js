import * as Phaser from 'phaser';
import { SOUND_MANIFEST } from '../constants/gameConstants.js';
import { MACHINE_SPRITE_MANIFEST } from '../data/machineCatalog.js';

export default class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        // Loading bar
        const barBg = this.add.rectangle(640, 360, 400, 20, 0x222222);
        const bar   = this.add.rectangle(440, 360, 0, 16, 0x00ccff);
        this.load.on('progress', (ratio) => {
            bar.width = 396 * ratio;
            bar.x = 440 + (396 * ratio) / 2;
        });

        // Suppress missing audio errors (all audio is optional)
        this.load.on('loaderror', (file) => {
            console.warn('[Boot] optional asset missing:', file.key);
        });

        // Required JSON data
        this.load.json('cases',         'src/data/cases.json');
        this.load.json('rules',         'src/data/rules.json');
        this.load.json('notifications', 'src/data/notifications.json');
        this.load.json('schedule',      'src/data/schedule.json');
        this.load.json('briefings',     'src/data/briefings.json');

        SOUND_MANIFEST.forEach((asset) => {
            this.load.audio(asset.key, asset.path);
        });

        MACHINE_SPRITE_MANIFEST.forEach((sprite) => {
            this.load.image(sprite.key, sprite.path);
        });

        // Source pixel art used to build a crisp, integer-upscaled machine texture.
        this.load.image('machine_future_lounge_chair_source', 'Untitled_Artwork.png');
        this.load.image('family_photo_source', 'Untitled_Artwork2.png');
        this.load.image('manager_human_source', 'Untitled_Artwork4.png');
        this.load.image('manager_robot_source', 'Untitled_Artwork3.png');

        // Pixel art backgrounds
        this.load.image('bg_mainview',    'mainview.jpeg');
        this.load.image('bg_inspectview', 'inspectview.jpeg');
    }

    create() {
        this._createFutureLoungeChairFromSource();
        this._createFamilyPhotoFromSource();
        this._createManagerHumanFromSource();
        this._createManagerRobotFromSource();
        this._generatePlaceholders();
        this.scene.start('Title');
    }

    _createFutureLoungeChairFromSource() {
        this._createNearestUpscaledTexture('machine_future_lounge_chair_source', 'machine_future_lounge_chair', 5);
    }

    _createFamilyPhotoFromSource() {
        this._createNearestUpscaledTexture('family_photo_source', 'family_photo', 5);
    }

    _createManagerHumanFromSource() {
        this._createNearestUpscaledTexture('manager_human_source', 'manager_human', 5);
    }

    _createManagerRobotFromSource() {
        this._createNearestUpscaledTexture('manager_robot_source', 'manager_robot', 5);
    }

    _createNearestUpscaledTexture(sourceKey, targetKey, integerScale = 5) {
        if (!this.textures.exists(sourceKey)) return;

        const sourceTexture = this.textures.get(sourceKey);
        const sourceImage = sourceTexture?.getSourceImage();
        const sourceWidth = sourceImage?.width || 0;
        const sourceHeight = sourceImage?.height || 0;

        if (sourceWidth <= 0 || sourceHeight <= 0) return;

        const targetWidth = sourceWidth * integerScale;
        const targetHeight = sourceHeight * integerScale;

        if (this.textures.exists(targetKey)) {
            this.textures.remove(targetKey);
        }

        const canvasTexture = this.textures.createCanvas(targetKey, targetWidth, targetHeight);
        const context = canvasTexture.getContext();

        context.imageSmoothingEnabled = false;
        context.mozImageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.msImageSmoothingEnabled = false;
        context.clearRect(0, 0, targetWidth, targetHeight);
        context.drawImage(sourceImage, 0, 0, targetWidth, targetHeight);
        canvasTexture.refresh();

        sourceTexture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        this.textures.get(targetKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }

    _generatePlaceholders() {
        // Period backgrounds — progressively colder
        this._makeRect('bg_p1', 1280, 720, 0x2a1f14);
        this._makeRect('bg_p2', 1280, 720, 0x1a1e24);
        this._makeRect('bg_p3', 1280, 720, 0x0d1520);

        // Unit sprite placeholder
        this._makeUnitPlaceholder();

        // Tool icons
        this._makeToolHammer();
        this._makeToolScanner();

        // Manager sprites
        this._makeManagerHuman();
        this._makeManagerRobot();

        // Desk props
        if (!this.textures.exists('family_photo')) {
            this._makeRect('family_photo', 60, 40, 0x8a7060);
        }

        // Conveyor tile
        this._makeConveyorTile();

        // Machine placeholders for data-only machine entries
        this._makeMachinePlaceholders();
    }

    _makeRect(key, w, h, color) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(color, 1);
        g.fillRect(0, 0, w, h);
        g.lineStyle(1, 0x333333, 0.4);
        g.strokeRect(0, 0, w, h);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    _makeUnitPlaceholder() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x223344); g.fillRect(0, 0, 120, 200);
        // head
        g.fillStyle(0x445566); g.fillRect(35, 10, 50, 40);
        // eyes
        g.fillStyle(0x00ccff, 0.9); g.fillRect(44, 22, 10, 8); g.fillRect(66, 22, 10, 8);
        // torso
        g.fillStyle(0x334455); g.fillRect(20, 60, 80, 80);
        // arms
        g.fillStyle(0x2a3a4a); g.fillRect(5, 65, 15, 60); g.fillRect(100, 65, 15, 60);
        // legs
        g.fillStyle(0x2a3a4a); g.fillRect(30, 145, 25, 45); g.fillRect(65, 145, 25, 45);
        g.generateTexture('unit_placeholder', 120, 200);
        g.destroy();
    }

    _makeToolHammer() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x333333); g.fillRect(0, 0, 48, 48);
        // handle
        g.fillStyle(0x885533); g.fillRect(22, 20, 6, 22);
        // head
        g.fillStyle(0x888888); g.fillRect(12, 8, 26, 14);
        g.lineStyle(1, 0x555555); g.strokeRect(12, 8, 26, 14);
        g.generateTexture('tool_hammer', 48, 48);
        g.destroy();
    }

    _makeToolScanner() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x333333); g.fillRect(0, 0, 48, 48);
        // device body
        g.fillStyle(0x334466); g.fillRect(8, 8, 32, 32);
        // grid lines
        g.lineStyle(1, 0x00ccff, 0.6);
        g.beginPath(); g.moveTo(8, 19); g.lineTo(40, 19); g.strokePath();
        g.beginPath(); g.moveTo(8, 29); g.lineTo(40, 29); g.strokePath();
        g.beginPath(); g.moveTo(19, 8); g.lineTo(19, 40); g.strokePath();
        g.beginPath(); g.moveTo(29, 8); g.lineTo(29, 40); g.strokePath();
        g.lineStyle(1, 0x00ccff, 1.0); g.strokeRect(8, 8, 32, 32);
        g.generateTexture('tool_scanner', 48, 48);
        g.destroy();
    }

    _makeManagerHuman() {
        if (this.textures.exists('manager_human')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xb07040); g.fillRect(10, 30, 40, 70);
        g.fillStyle(0xd09060); g.fillRect(15,  5, 30, 28);
        g.fillStyle(0x222222);
        g.fillRect(20, 14, 6, 6);
        g.fillRect(34, 14, 6, 6);
        g.generateTexture('manager_human', 60, 100);
        g.destroy();
    }

    _makeManagerRobot() {
        if (this.textures.exists('manager_robot')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x4060a0); g.fillRect(10, 30, 40, 70);
        g.fillStyle(0x5070b0); g.fillRect(12,  5, 36, 28);
        g.fillStyle(0x222244); g.fillRect(16, 10, 28, 18);
        g.fillStyle(0x00ccff, 0.9); g.fillRect(18, 14, 24, 6);
        g.generateTexture('manager_robot', 60, 100);
        g.destroy();
    }

    _makeConveyorTile() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x1a1a22); g.fillRect(0, 0, 40, 40);
        g.lineStyle(2, 0x333344);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(40, 40); g.strokePath();
        g.lineStyle(1, 0x2a2a33); g.strokeRect(0, 0, 40, 40);
        g.generateTexture('conveyor_tile', 40, 40);
        g.destroy();
    }

    _makeMachinePlaceholders() {
        this._makeBreakroomBrewerPlaceholder();
        this._makeMechanicBroomPlaceholder();
        this._makeCryBabyPlaceholder();
        this._makeRichMfPlaceholder();
        this._makeJesterInTheBoxPlaceholder();
        this._makeRebelliousUmbrellaPlaceholder();
        this._makeDebriefMachinePlaceholder();
        this._makeFutureLoungeChairPlaceholder();
    }

    _makeBreakroomBrewerPlaceholder() {
        if (this.textures.exists('machine_breakroom_brewer')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x2a3b41); g.fillRoundedRect(18, 26, 84, 124, 14);
        g.fillStyle(0x5f8d93); g.fillRoundedRect(30, 38, 60, 28, 8);
        g.fillStyle(0xb8f6ff, 0.85); g.fillRoundedRect(38, 44, 44, 14, 6);
        g.fillStyle(0x1e2428); g.fillRoundedRect(34, 74, 52, 56, 10);
        g.fillStyle(0x4c2b19); g.fillRoundedRect(52, 88, 18, 28, 6);
        g.fillStyle(0xd3d0c2); g.fillRoundedRect(76, 90, 14, 20, 6);
        g.lineStyle(2, 0xf1e7b8, 0.9); g.strokeRoundedRect(76, 90, 14, 20, 6);
        g.fillStyle(0x8be9ff, 0.95); g.fillRect(42, 142, 36, 6);
        g.lineStyle(2, 0x8fd2c8, 0.9); g.strokeRoundedRect(18, 26, 84, 124, 14);
        g.generateTexture('machine_breakroom_brewer', 120, 180);
        g.destroy();
    }

    _makeMechanicBroomPlaceholder() {
        if (this.textures.exists('machine_mechanic_broom')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x172228); g.fillRect(0, 0, 120, 180);
        g.lineStyle(8, 0x7e8f98, 0.95);
        g.beginPath(); g.moveTo(36, 20); g.lineTo(72, 126); g.strokePath();
        g.fillStyle(0x37d7ff, 0.85); g.fillCircle(36, 20, 10);
        g.fillStyle(0x24353c); g.fillRoundedRect(46, 120, 42, 20, 8);
        g.fillStyle(0xa5f2ff, 0.75); g.fillRoundedRect(50, 124, 34, 8, 4);
        g.fillStyle(0x4ae66f);
        for (let index = 0; index < 6; index++) {
            g.fillRect(52 + (index * 6), 140, 3, 22);
        }
        g.fillStyle(0x6bf7ff, 0.7); g.fillRoundedRect(40, 156, 54, 8, 4);
        g.generateTexture('machine_mechanic_broom', 120, 180);
        g.destroy();
    }

    _makeCryBabyPlaceholder() {
        if (this.textures.exists('machine_cry_baby')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x121b25); g.fillRect(0, 0, 120, 180);
        g.fillStyle(0x1f2c37); g.fillEllipse(60, 148, 58, 16);
        g.fillStyle(0x78d9ff); g.fillRoundedRect(30, 36, 60, 56, 16);
        g.fillStyle(0x17202a); g.fillRoundedRect(36, 42, 48, 42, 12);
        g.fillStyle(0x7ef6ff); g.fillCircle(48, 58, 7);
        g.fillStyle(0x7ef6ff); g.fillCircle(72, 58, 7);
        g.lineStyle(2, 0x7ef6ff, 0.95);
        g.beginPath(); g.moveTo(48, 76); g.lineTo(60, 84); g.lineTo(72, 76); g.strokePath();
        g.fillStyle(0x5cc8ff, 0.92); g.fillEllipse(44, 72, 8, 18);
        g.fillStyle(0x5cc8ff, 0.92); g.fillEllipse(76, 72, 8, 22);
        g.fillStyle(0x78d9ff); g.fillRoundedRect(40, 90, 40, 40, 14);
        g.lineStyle(4, 0x425364, 0.94);
        g.beginPath(); g.moveTo(48, 130); g.lineTo(40, 152); g.strokePath();
        g.beginPath(); g.moveTo(72, 130); g.lineTo(80, 152); g.strokePath();
        g.beginPath(); g.moveTo(40, 104); g.lineTo(22, 118); g.strokePath();
        g.beginPath(); g.moveTo(80, 104); g.lineTo(94, 92); g.strokePath();
        g.fillStyle(0x78d9ff); g.fillCircle(20, 120, 10);
        g.fillStyle(0x78d9ff); g.fillCircle(96, 90, 9);
        g.fillStyle(0xffb24a); g.fillRoundedRect(48, 114, 24, 10, 4);
        g.lineStyle(3, 0x78d9ff, 0.95);
        g.beginPath(); g.moveTo(36, 30); g.lineTo(30, 18); g.strokePath();
        g.beginPath(); g.moveTo(84, 30); g.lineTo(90, 18); g.strokePath();
        g.fillStyle(0x7ef6ff); g.fillCircle(30, 18, 4);
        g.fillStyle(0x7ef6ff); g.fillCircle(90, 18, 4);
        g.generateTexture('machine_cry_baby', 120, 180);
        g.destroy();
    }

    _makeRichMfPlaceholder() {
        if (this.textures.exists('machine_rich_mf')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x161922); g.fillRect(0, 0, 120, 180);
        g.fillStyle(0x2b3140); g.fillEllipse(60, 152, 56, 18);
        g.fillStyle(0xd9c38a); g.fillCircle(60, 42, 22);
        g.fillStyle(0x1a1d24); g.fillRoundedRect(42, 28, 36, 10, 5);
        g.fillStyle(0x2f9cf0, 0.9); g.fillRect(46, 42, 8, 5); g.fillRect(66, 42, 8, 5);
        g.lineStyle(3, 0x111111, 0.95); g.lineBetween(52, 62, 68, 62);
        g.fillStyle(0x59657f); g.fillRoundedRect(34, 68, 52, 56, 12);
        g.fillStyle(0x7d8ca8); g.fillRoundedRect(22, 80, 18, 48, 8);
        g.fillStyle(0x7d8ca8); g.fillRoundedRect(80, 76, 18, 52, 8);
        g.fillStyle(0x95f4ff, 0.82); g.fillRoundedRect(42, 78, 36, 18, 6);
        g.lineStyle(4, 0x8996af, 0.95);
        g.beginPath(); g.moveTo(48, 124); g.lineTo(42, 154); g.strokePath();
        g.beginPath(); g.moveTo(72, 124); g.lineTo(80, 154); g.strokePath();
        g.fillStyle(0xe7c85e); g.fillRoundedRect(48, 100, 24, 12, 5);
        g.generateTexture('machine_rich_mf', 120, 180);
        g.destroy();
    }

    _makeJesterInTheBoxPlaceholder() {
        if (this.textures.exists('machine_jester_in_the_box')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x130f18); g.fillRect(0, 0, 120, 180);
        g.fillStyle(0x2e203c); g.fillEllipse(60, 150, 58, 18);
        g.fillStyle(0x6a2f2f); g.fillRoundedRect(30, 78, 60, 58, 10);
        g.lineStyle(3, 0xf6d06f, 0.9); g.strokeRoundedRect(30, 78, 60, 58, 10);
        g.fillStyle(0x2a202e); g.fillRoundedRect(26, 68, 68, 16, 8);
        g.lineStyle(4, 0xc5c7cf, 0.92);
        g.beginPath(); g.moveTo(60, 72); g.lineTo(60, 42); g.strokePath();
        g.fillStyle(0xf0e3c1); g.fillCircle(60, 30, 16);
        g.fillStyle(0x16c7ff, 0.9); g.fillCircle(54, 28, 4); g.fillCircle(66, 28, 4);
        g.fillStyle(0xc33a4a); g.fillCircle(60, 34, 4);
        g.lineStyle(3, 0x111111, 0.92);
        g.beginPath(); g.moveTo(52, 40); g.lineTo(60, 46); g.lineTo(68, 40); g.strokePath();
        g.fillStyle(0xe9c15a); g.fillRect(86, 98, 12, 6);
        g.lineStyle(4, 0xe9c15a, 0.92);
        g.beginPath(); g.moveTo(96, 101); g.lineTo(104, 92); g.strokePath();
        g.beginPath(); g.moveTo(96, 101); g.lineTo(104, 110); g.strokePath();
        g.generateTexture('machine_jester_in_the_box', 120, 180);
        g.destroy();
    }

    _makeRebelliousUmbrellaPlaceholder() {
        if (this.textures.exists('machine_rebellious_umbrella')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x111923); g.fillRect(0, 0, 120, 180);
        g.fillStyle(0x20272f); g.fillEllipse(60, 140, 54, 18);
        g.fillStyle(0x2a323d); g.fillEllipse(60, 52, 82, 42);
        g.lineStyle(3, 0x7ce0ff, 0.95);
        g.strokeEllipse(60, 52, 82, 42);
        g.fillStyle(0x2f3943); g.fillEllipse(60, 60, 92, 24);
        g.fillStyle(0x0d1116); g.fillRoundedRect(34, 48, 52, 10, 4);
        g.fillStyle(0x9cf7ff, 0.85); g.fillRoundedRect(36, 50, 22, 8, 4);
        g.fillStyle(0x9cf7ff, 0.85); g.fillRoundedRect(62, 50, 22, 8, 4);
        g.lineStyle(2, 0x0d1116, 1); g.lineBetween(58, 54, 62, 54);
        g.lineStyle(6, 0x7b8a99, 0.96);
        g.beginPath(); g.moveTo(58, 70); g.lineTo(66, 138); g.strokePath();
        g.lineStyle(4, 0x5f6d79, 0.9);
        g.beginPath(); g.moveTo(64, 112); g.lineTo(74, 130); g.strokePath();
        g.lineStyle(4, 0x7b8a99, 0.92);
        g.beginPath(); g.moveTo(66, 138); g.lineTo(56, 154); g.strokePath();
        g.beginPath(); g.moveTo(56, 154); g.lineTo(66, 160); g.strokePath();
        g.lineStyle(3, 0xa3ffde, 0.88);
        g.beginPath(); g.moveTo(26, 52); g.lineTo(40, 28); g.strokePath();
        g.beginPath(); g.moveTo(60, 38); g.lineTo(60, 20); g.strokePath();
        g.beginPath(); g.moveTo(94, 52); g.lineTo(80, 28); g.strokePath();
        g.fillStyle(0x0d1116, 0.48); g.fillTriangle(38, 72, 82, 72, 60, 104);
        g.generateTexture('machine_rebellious_umbrella', 120, 180);
        g.destroy();
    }

    _makeDebriefMachinePlaceholder() {
        if (this.textures.exists('machine_debrief_machine')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x111722); g.fillRect(0, 0, 120, 180);
        g.fillStyle(0x233445); g.fillEllipse(60, 150, 56, 18);
        g.fillStyle(0x30485a); g.fillRoundedRect(24, 34, 72, 96, 14);
        g.lineStyle(3, 0x9de7ff, 0.95); g.strokeRoundedRect(24, 34, 72, 96, 14);
        g.fillStyle(0x0d1219); g.fillRoundedRect(34, 46, 52, 34, 10);
        g.fillStyle(0x86f3ff, 0.88); g.fillRoundedRect(40, 54, 40, 10, 5);
        g.lineStyle(2, 0x86f3ff, 0.9);
        g.beginPath(); g.moveTo(42, 72); g.lineTo(78, 72); g.strokePath();
        g.beginPath(); g.moveTo(42, 78); g.lineTo(70, 78); g.strokePath();
        g.fillStyle(0x587086); g.fillRoundedRect(38, 92, 44, 24, 8);
        g.fillStyle(0xe7c868); g.fillRoundedRect(44, 98, 32, 8, 4);
        g.lineStyle(4, 0x71879a, 0.95);
        g.beginPath(); g.moveTo(44, 130); g.lineTo(38, 154); g.strokePath();
        g.beginPath(); g.moveTo(76, 130); g.lineTo(82, 154); g.strokePath();
        g.generateTexture('machine_debrief_machine', 120, 180);
        g.destroy();
    }

    _makeFutureLoungeChairPlaceholder() {
        if (this.textures.exists('machine_future_lounge_chair')) return;

        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x1d2230); g.fillRoundedRect(24, 38, 52, 56, 12);
        g.fillStyle(0x334568); g.fillRoundedRect(34, 86, 46, 24, 10);
        g.fillStyle(0x24304d); g.fillRoundedRect(70, 74, 20, 54, 10);
        g.lineStyle(3, 0x67f0ff, 0.95); g.strokeRoundedRect(24, 38, 52, 56, 12);
        g.lineStyle(3, 0xa4ffde, 0.9); g.strokeRoundedRect(34, 86, 46, 24, 10);
        g.lineStyle(3, 0x67f0ff, 0.85); g.strokeRoundedRect(70, 74, 20, 54, 10);
        g.lineStyle(4, 0x7f8c99, 0.95);
        g.beginPath(); g.moveTo(44, 110); g.lineTo(36, 154); g.strokePath();
        g.beginPath(); g.moveTo(70, 110); g.lineTo(82, 154); g.strokePath();
        g.fillStyle(0x9ef7ff, 0.8); g.fillRoundedRect(36, 52, 28, 10, 6);
        g.generateTexture('machine_future_lounge_chair', 120, 180);
        g.destroy();
    }
}

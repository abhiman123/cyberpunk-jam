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

        SOUND_MANIFEST.forEach((asset) => {
            this.load.audio(asset.key, asset.path);
        });

        MACHINE_SPRITE_MANIFEST.forEach((sprite) => {
            this.load.image(sprite.key, sprite.path);
        });

        // Pixel art backgrounds
        this.load.image('bg_mainview',    'mainview.jpeg');
        this.load.image('bg_inspectview', 'inspectview.jpeg');
    }

    create() {
        this._generatePlaceholders();
        this.scene.start('Title');
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
        this._makeRect('family_photo', 60, 40, 0x8a7060);

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

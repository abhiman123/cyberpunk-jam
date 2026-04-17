import * as Phaser from 'phaser';

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
        this.load.json('briefings',     'src/data/briefings.json');
        this.load.json('schedule',      'src/data/schedule.json');

        // Optional audio — ruling SFX
        this.load.audio('sfx_approve', 'assets/audio/sfx_approve.mp3');
        this.load.audio('sfx_scrap',   'assets/audio/sfx_scrap.mp3');
        this.load.audio('sfx_repair',  'assets/audio/sfx_repair.mp3');
        this.load.audio('sfx_error',   'assets/audio/sfx_error.mp3');
        this.load.audio('sfx_reveal',  'assets/audio/sfx_reveal.wav');

        // Optional audio — music
        this.load.audio('music_manager',          'assets/audio/music_manager.mp3');
        this.load.audio('music_clocking_in',      'assets/audio/music_clocking_in.mp3');
        this.load.audio('music_workday',          'assets/audio/music_workday.mp3');
        this.load.audio('music_cutting_it_close', 'assets/audio/music_cutting_it_close.mp3');
        this.load.audio('music_payday',           'assets/audio/music_payday.mp3');
        this.load.audio('music_fired',            'assets/audio/music_fired.mp3');

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
}

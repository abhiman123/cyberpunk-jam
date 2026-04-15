import * as Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        this.load.json('cases',         'src/data/cases.json');
        this.load.json('rules',         'src/data/rules.json');
        this.load.json('notifications', 'src/data/notifications.json');
        this.load.json('briefings',     'src/data/briefings.json');
        this.load.json('schedule',      'src/data/schedule.json');
    }

    create() {
        this._generatePlaceholders();
        this.scene.start('Menu');
    }

    _generatePlaceholders() {
        // Backgrounds per period
        this._makeRect('bg_p1', 1280, 720, 0x2a1f14);   // warm brown-gray
        this._makeRect('bg_p2', 1280, 720, 0x1a1e24);   // cool gray-blue
        this._makeRect('bg_p3', 1280, 720, 0x0d1520);   // cold blue-black

        // Panels
        this._makeRect('panel_left',  768, 670, 0x111111);
        this._makeRect('panel_right', 512, 670, 0x0d0d0d);
        this._makeRect('case_display', 400, 280, 0x1a1a1a);

        // Manager sprites
        this._makeManagerHuman();
        this._makeManagerRobot();

        // Misc
        this._makeRect('family_photo', 60, 40, 0x8a7060);

        // Action buttons
        this._makeRect('btn_approve', 260, 60, 0x1a3a1a);
        this._makeRect('btn_repair',  260, 60, 0x3a3a10);
        this._makeRect('btn_scrap',   260, 60, 0x3a1010);

        // Conveyor tile (keep for visual)
        this._makeConveyorTile();
    }

    _makeRect(key, w, h, color) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(color, 1);
        g.fillRect(0, 0, w, h);
        g.lineStyle(1, 0x333333, 0.6);
        g.strokeRect(0, 0, w, h);
        g.generateTexture(key, w, h);
        g.destroy();
    }

    _makeManagerHuman() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        // Body
        g.fillStyle(0xb07040, 1);
        g.fillRect(10, 30, 40, 70);
        // Head
        g.fillStyle(0xd09060, 1);
        g.fillRect(15, 5, 30, 28);
        // Eyes
        g.fillStyle(0x222222, 1);
        g.fillRect(20, 14, 6, 6);
        g.fillRect(34, 14, 6, 6);
        g.generateTexture('manager_human', 60, 100);
        g.destroy();
    }

    _makeManagerRobot() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        // Body
        g.fillStyle(0x4060a0, 1);
        g.fillRect(10, 30, 40, 70);
        // Head
        g.fillStyle(0x5070b0, 1);
        g.fillRect(12, 5, 36, 28);
        // Face plate
        g.fillStyle(0x222244, 1);
        g.fillRect(16, 10, 28, 18);
        // Eye visor glow
        g.fillStyle(0x00ccff, 0.9);
        g.fillRect(18, 14, 24, 6);
        g.generateTexture('manager_robot', 60, 100);
        g.destroy();
    }

    _makeConveyorTile() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0x222233);
        g.fillRect(0, 0, 40, 60);
        g.lineStyle(2, 0x444466);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(40, 60);
        g.strokePath();
        g.lineStyle(1, 0x333344);
        g.strokeRect(0, 0, 40, 60);
        g.generateTexture('conveyor_tile', 40, 60);
        g.destroy();
    }
}

import * as Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        this.load.json('cases',         'src/data/cases.json');
        this.load.json('rules',         'src/data/rules.json');
        this.load.json('notifications', 'src/data/notifications.json');
        this.load.json('briefings',     'src/data/briefings.json');
        this.load.json('schedule',      'src/data/schedule.json');
        this.load.audio('manager_voice', 'Voice2.wav');
    }

    create() {
        this._generatePlaceholders();

        if (this.scene.get('Workshop')) {
            this.scene.start('Workshop');
        } else {
            this.scene.start('Game');
        }
    }

    _generatePlaceholders() {
        this._makeRect('bg_p1', 1280, 720, 0x2a1f14);
        this._makeRect('bg_p2', 1280, 720, 0x1a1e24);
        this._makeRect('bg_p3', 1280, 720, 0x0d1520);
        this._makeRect('panel_left',   768, 670, 0x111111);
        this._makeRect('panel_right',  512, 670, 0x0d0d0d);
        this._makeRect('case_display', 400, 280, 0x1a1a1a);
        this._makeRect('family_photo',  60,  40, 0x8a7060);
        this._makeManagerHuman();
        this._makeManagerRobot();
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

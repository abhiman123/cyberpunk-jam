import * as Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        // When you have real assets, load them here instead:
        // this.load.image('robot', 'assets/sprites/robot.png');
        // this.load.image('machine_motor', 'assets/sprites/machine_motor.png');
        // this.load.audio('clank', 'assets/audio/clank.mp3');
    }

    create() {
        this._generatePlaceholders();
        this.scene.start('Game');
    }

    _generatePlaceholders() {
        this._makeTexture('machine_motor',  0x336688, 120, 80,  'MOTOR');
        this._makeTexture('machine_gear',   0x885533, 120, 80,  'GEARS');
        this._makeTexture('machine_pump',   0x338855, 120, 80,  'PUMP');
        this._makeTexture('machine_sensor', 0x664488, 120, 80,  'SENSOR');
        this._makeTexture('robot',          0xff2200, 80,  200, 'BOT');
        this._makeTexture('tool_wire',      0x00ffcc, 60,  60,  'WIR');
        this._makeTexture('tool_hammer',    0xffaa00, 60,  60,  'HAM');
        this._makeTexture('tool_wrench',    0xff6600, 60,  60,  'WRN');
        this._makeTexture('tool_solder',    0xaaaaff, 60,  60,  'SLD');
        this._makeConveyorTexture();
    }

    _makeTexture(key, color, w, h, label) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });

        g.fillStyle(color, 0.85);
        g.fillRect(0, 0, w, h);

        g.lineStyle(2, 0xffffff, 0.4);
        g.strokeRect(0, 0, w, h);

        g.generateTexture(key, w, h);
        g.destroy();
    }

    _makeConveyorTexture() {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        const tileW = 40;
        const h = 100;

        g.fillStyle(0x222233);
        g.fillRect(0, 0, tileW, h);

        g.lineStyle(2, 0x444466);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(tileW, h);
        g.strokePath();

        g.lineStyle(1, 0x333344);
        g.strokeRect(0, 0, tileW, h);

        g.generateTexture('conveyor_tile', tileW, h);
        g.destroy();
    }
}

export default class GameScene extends Phaser.Scene {
    constructor() { super('Game'); }

    create() {
        this.add.text(640, 360, 'Game loop running', {
            fontFamily: 'monospace',
            fontSize: '32px',
            color: '#00ffcc',
        }).setOrigin(0.5);
    }

    update(time, delta) {}
}
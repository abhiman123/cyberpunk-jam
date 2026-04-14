export default class GameOverScene extends Phaser.Scene {
    constructor() { super('GameOver'); }

    create() {
        this.add.text(640, 360, 'SYSTEM FAILURE', {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#ff0000',
        }).setOrigin(0.5);
    }
}
export default class BootScene extends Phaser.Scene {
    constructor() { super('Boot'); }

    preload() {
        // all asset loading goes here later
    }

    create() {
        this.scene.start('Game');
    }
}
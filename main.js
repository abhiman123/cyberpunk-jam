import * as Phaser from 'phaser';
import BootScene from './src/scenes/Boot.js';
import GameScene from './src/scenes/Game.js';
import GameOverScene from './src/scenes/GameOver.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    scene: [BootScene, GameScene, GameOverScene],
};

new Phaser.Game(config);

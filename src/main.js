import Phaser from 'phaser';
import GameScene from './scenes/Game.js';
import GameOverScene from './scenes/GameOver.js';
import BootScene from './scenes/Boot.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a0f',
    scene: [BootScene, GameScene, GameOverScene],
};

new Phaser.Game(config);
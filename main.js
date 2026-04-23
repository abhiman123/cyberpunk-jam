import * as Phaser from 'phaser';
import BootScene from './src/scenes/Boot.js';
import TitleScene from './src/scenes/Title.js';
import GameScene from './src/scenes/Game.js';
import SummaryScene from './src/scenes/Summary.js';
import TransitionScene from './src/scenes/Transition.js';
import EndScene from './src/scenes/End.js';

// Make all text objects render at device pixel ratio for crisp text on HiDPI screens
const _origTextInit = Phaser.GameObjects.Text.prototype.initRTL ?? (() => {});
const _origTextStyle = Phaser.GameObjects.Text.prototype.setStyle;
Phaser.GameObjects.Text.prototype.setStyle = function (style) {
    if (style && !style.resolution) {
        style.resolution = Math.max(2, window.devicePixelRatio || 1);
    }
    return _origTextStyle.call(this, style);
};

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    antialias: true,
    resolution: window.devicePixelRatio,
    backgroundColor: '#0a0a0a',
    scene: [BootScene, TitleScene, GameScene, SummaryScene, TransitionScene, EndScene],
};

new Phaser.Game(config);

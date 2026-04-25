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

// We deliberately do NOT enable Phaser's `pixelArt: true` mode. It forces every
// texture to NEAREST sampling globally, which gives crisp pixel art at the cost
// of jagged, aliased text. Pixel-art textures already opt into NEAREST filtering
// individually in Boot.js (`setFilter(Phaser.Textures.FilterMode.NEAREST)`), so
// flipping antialias on here lets text smooth correctly while sprites stay
// crisp. `roundPixels: true` keeps sprite positions snapped to integer pixels
// so the pixel art doesn't wobble between sub-pixel positions.
const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    antialias: true,
    pixelArt: false,
    roundPixels: true,
    resolution: window.devicePixelRatio,
    backgroundColor: '#0a0a0a',
    scene: [BootScene, TitleScene, GameScene, SummaryScene, TransitionScene, EndScene],
};

new Phaser.Game(config);

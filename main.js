import * as Phaser from 'phaser';
import BootScene from './src/scenes/Boot.js';
import TitleScene from './src/scenes/Title.js';
import GameScene from './src/scenes/Game.js';
import SummaryScene from './src/scenes/Summary.js';
import TransitionScene from './src/scenes/Transition.js';
import EndScene from './src/scenes/End.js';

// ── Sharp text on a pixel-art game ───────────────────────────────────────────
// We keep `pixelArt: true` so sprite textures stay crisp under integer
// scaling. The downside of `pixelArt` is that it forces every texture to
// NEAREST sampling globally, which is correct for sprites but makes text
// (which is rendered to its own canvas-backed texture) look jagged. To get
// the best of both worlds:
//
//   1. Force every Text style to render at >=2x resolution (so the text
//      canvas is drawn with enough subpixel detail to not look chunky).
//   2. After Phaser updates a Text object's canvas, switch that one
//      texture to LINEAR filtering. This is an opt-out from the global
//      NEAREST filter that applies *only* to text textures, leaving every
//      sprite/atlas texture untouched.

const _origTextStyle = Phaser.GameObjects.Text.prototype.setStyle;
Phaser.GameObjects.Text.prototype.setStyle = function (style) {
    if (style && !style.resolution) {
        style.resolution = Math.max(2, window.devicePixelRatio || 1);
    }
    return _origTextStyle.call(this, style);
};

const _origUpdateText = Phaser.GameObjects.Text.prototype.updateText;
if (typeof _origUpdateText === 'function') {
    Phaser.GameObjects.Text.prototype.updateText = function (...args) {
        const result = _origUpdateText.apply(this, args);
        const texture = this.texture;
        if (texture && typeof texture.setFilter === 'function') {
            texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
        }
        return result;
    };
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    antialias: false,
    pixelArt: true,
    resolution: window.devicePixelRatio,
    backgroundColor: '#0a0a0a',
    scene: [BootScene, TitleScene, GameScene, SummaryScene, TransitionScene, EndScene],
};

new Phaser.Game(config);

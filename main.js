import * as Phaser from 'phaser';
import BootScene from './src/scenes/Boot.js';
import WorkshopScene from './src/scenes/Workshop.js';
import StationScene from './src/scenes/Station.js';
import BriefingScene from './src/scenes/Briefing.js';
import GameScene from './src/scenes/Game.js';
import SummaryScene from './src/scenes/Summary.js';
import TransitionScene from './src/scenes/Transition.js';
import EndScene from './src/scenes/End.js';

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 720,
    backgroundColor: '#0a0a0a',
    scene: [BootScene, WorkshopScene, StationScene, BriefingScene, GameScene, SummaryScene, TransitionScene, EndScene],
};

new Phaser.Game(config);

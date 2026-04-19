import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';

const PERIOD_BG    = { 1: 0x1a1510, 2: 0x101418, 3: 0x080d14 };
const PERIOD_LABEL = { 1: 'PERIOD ONE', 2: 'PERIOD TWO', 3: 'PERIOD THREE' };
const PERIOD_SUB   = {
    1: 'Reporting for duty.',
    2: 'New directives have been issued.',
    3: 'Final processing phase.',
};

export default class TransitionScene extends Phaser.Scene {
    constructor() { super('Transition'); }

    init(data) {
        this._period = data.period || GameState.period;
    }

    create() {
        const cx = 640;
        const p  = this._period;

        applyCyberpunkLook(this);

        // Background
        this.cameras.main.setBackgroundColor('#0f140e');

        // Period label fades in
        const label = this.add.text(cx, 320, PERIOD_LABEL[p] || `PERIOD ${p}`, {
            fontFamily: 'Courier New', fontSize: '52px', color: '#33ff00',
        }).setOrigin(0.5).setAlpha(0);

        const sub = this.add.text(cx, 400, PERIOD_SUB[p] || '', {
            fontFamily: 'Courier New', fontSize: '18px', color: '#33ff00',
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({ targets: label, alpha: 1, duration: 600, delay: 200 });
        this.tweens.add({ targets: sub,   alpha: 1, duration: 600, delay: 500 });

        // Scanlines
        const scan = this.add.graphics().setDepth(100);
        scan.fillStyle(0x000000, 0.3);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);

        this.cameras.main.fadeIn(400, 0, 0, 0);

        // Auto-advance after 2.2s
        this.time.delayedCall(2200, () => {
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Game'));
        });
    }
}

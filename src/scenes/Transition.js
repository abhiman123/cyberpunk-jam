import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';

const DAY_LABEL = { 1: 'DAY ONE', 2: 'DAY TWO', 3: 'DAY THREE', 4: 'DAY FOUR' };
const DAY_SUB   = {
    1: 'Base repair directives active.',
    2: 'Compliance directives active.',
    3: 'Hazard directives active.',
    4: 'Replacement protocol active.',
};

export default class TransitionScene extends Phaser.Scene {
    constructor() { super('Transition'); }

    init(data) {
        this._day = data.day || GameState.day;
    }

    create() {
        const cx = 640;
        const day = this._day;

        applyCyberpunkLook(this);

        // Background
        this.cameras.main.setBackgroundColor('#0f140e');

        // Period label fades in
        const label = this.add.text(cx, 320, DAY_LABEL[day] || `DAY ${day}`, {
            fontFamily: 'Courier New', fontSize: '52px', color: '#33ff00',
        }).setOrigin(0.5).setAlpha(0);

        const sub = this.add.text(cx, 400, DAY_SUB[day] || '', {
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
            this.time.delayedCall(400, () => {
                if (day >= GameState.totalDays) {
                    this.scene.start('End', { endingVariant: GameState.getDayFourEndingVariant() });
                    return;
                }

                this.scene.start('Briefing');
            });
        });
    }
}

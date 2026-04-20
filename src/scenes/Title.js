import * as Phaser from 'phaser';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../constants/gameConstants.js';

export default class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        const W = 1280, H = 720, cx = W / 2, cy = H / 2;

        applyCyberpunkLook(this);

        // Background
        this.cameras.main.setBackgroundColor('#0f140e');

        // Main title
        this.add.text(cx, 270, "YOU'RE JUST\nA MACHINE", {
            fontFamily: 'Courier New', fontSize: '64px', color: '#33ff00', align: 'center'
        }).setOrigin(0.5);

        // Divider
        const g = this.add.graphics();
        g.lineStyle(3, 0x33ff00, 1);
        g.lineBetween(350, 345, 930, 345);

        // Description
        this.add.text(cx, 395,
            'Approve the compliant. Scrap the defective. Repair the redeemable.\nRinse and repeat.',
            {
                fontFamily: 'Courier New', fontSize: '14px', color: '#33ff00',
                align: 'center', lineSpacing: 8,
            }
        ).setOrigin(0.5);

        // Begin Shift button
        let ready = false;
        const btnBg = this.add.rectangle(cx, 500, 200, 44, 0x0a0a0a)
            .setStrokeStyle(1, 0x334455)
            .setAlpha(0)
            .setInteractive({ useHandCursor: true });
        const btnLabel = this.add.text(cx, 500, 'BEGIN SHIFT', {
            fontFamily: 'Courier New', fontSize: '15px', color: '#778899', letterSpacing: 3,
        }).setOrigin(0.5).setAlpha(0);

        btnBg.on('pointerover', () => {
            if (!ready) return;
            btnBg.setStrokeStyle(1, 0x6688aa);
            btnLabel.setColor('#aabbcc');
        });

        btnBg.on('pointerout', () => {
            btnBg.setStrokeStyle(1, 0x334455);
            btnLabel.setColor('#778899');
        });

        btnBg.on('pointerdown', () => {
            if (!ready) return;
            btnBg.setStrokeStyle(1, 0xff0000);
            btnLabel.setColor('#ff0000');
        });

        btnBg.on('pointerup', () => {
            if (!ready) return;
            if (this.cache.audio.has(SOUND_ASSETS.titlePlay.key)) {
                this.sound.play(SOUND_ASSETS.titlePlay.key, { volume: SOUND_VOLUMES.ui });
            }
            this.cameras.main.fadeOut(400, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Briefing'));
        });

        // Show the button after 1.5s
        this.time.delayedCall(1500, () => {
            ready = true;
            this.tweens.add({ targets: [btnBg, btnLabel], alpha: { from: 0, to: 1 }, duration: 400 });
        });

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.3);
        for (let y = 0; y < H; y += 4) scan.fillRect(0, y, W, 2);

        this.cameras.main.fadeIn(1500);
    }
}

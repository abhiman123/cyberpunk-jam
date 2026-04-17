import * as Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        const W = 1280, H = 720, cx = W / 2, cy = H / 2;

        // Background
        this.cameras.main.setBackgroundColor('#0f140e');

        // Top tagline
        // this.add.text(cx, 80, '// a bureaucratic horror game', {
        //     fontFamily: 'monospace', fontSize: '13px', color: '#33ff00', letterSpacing: 2,
        // }).setOrigin(0.5);

        // Main title
        this.add.text(cx, 280, "YOU'RE JUST\nA MACHINE", {
            fontFamily: 'Courier New', fontSize: '64px', color: '#33ff00', align: 'center'
        }).setOrigin(0.5);

        // Divider
        const g = this.add.graphics();
        g.lineStyle(1, 0x334455, 1);
        g.lineBetween(350, 355, 930, 355);

        // Description
        this.add.text(cx, 405,
            'You are Unit #492240182. You inspect robots on a conveyor belt.\nApprove the compliant. Scrap the defective. Repair the redeemable.\nDo not ask questions.',
            {
                fontFamily: 'Courier New', fontSize: '14px', color: '#33ff00',
                align: 'center', lineSpacing: 8,
            }
        ).setOrigin(0.5);

        // Begin Shift button
        let ready = false;
        const btnBg = this.add.rectangle(cx, 510, 200, 44, 0x0a0a0a)
            .setStrokeStyle(1, 0x334455)
            .setInteractive({ useHandCursor: true });
        const btnLabel = this.add.text(cx, 510, 'BEGIN SHIFT', {
            fontFamily: 'Courier New', fontSize: '15px', color: '#dddd', letterSpacing: 3,
        }).setOrigin(0.5);

        // Flicker the button in after 1.5s
        this.time.delayedCall(1500, () => {
            ready = true;
            this.tweens.add({ targets: [btnBg, btnLabel], alpha: { from: 0, to: 1 }, duration: 400 });
        });

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
            btnBg.setStrokeStyle(1, 0xff0000);
            btnLabel.setColor('#ff0000');
        });

        btnBg.on('pointerup', () => {
            if (!ready) return;
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Briefing'));
        });

        // Any key also starts
        this.input.keyboard.once('keydown', () => {
            if (!ready) return;
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Briefing'));
        });

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.3);
        for (let y = 0; y < H; y += 4) scan.fillRect(0, y, W, 2);

        this.cameras.main.fadeIn(1500);
    }
}

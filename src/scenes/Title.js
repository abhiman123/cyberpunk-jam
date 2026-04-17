import * as Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
    constructor() { super('Title'); }

    create() {
        const W = 1280, H = 720, cx = W / 2, cy = H / 2;

        // Pixel art background at low alpha
        if (this.textures.exists('bg_mainview')) {
            this.add.image(cx, cy, 'bg_mainview').setDisplaySize(W, H).setAlpha(0.22);
        } else {
            this.add.rectangle(cx, cy, W, H, 0x080808);
        }

        // Scanlines
        const scan = this.add.graphics();
        scan.fillStyle(0x000000, 0.18);
        for (let y = 0; y < H; y += 3) scan.fillRect(0, y, W, 1);

        // Top tagline
        this.add.text(cx, 80, '// a bureaucratic horror game', {
            fontFamily: 'monospace', fontSize: '13px', color: '#445566', letterSpacing: 2,
        }).setOrigin(0.5);

        // Main title
        this.add.text(cx, 240, "YOU'RE JUST", {
            fontFamily: 'monospace', fontSize: '64px', color: '#dddddd',
        }).setOrigin(0.5);
        this.add.text(cx, 320, 'A MACHINE.', {
            fontFamily: 'monospace', fontSize: '64px', color: '#ffffff',
        }).setOrigin(0.5);

        // Divider
        const g = this.add.graphics();
        g.lineStyle(1, 0x334455, 1);
        g.lineBetween(400, 370, 880, 370);

        // Description
        this.add.text(cx, 420,
            'You are Unit #492240182. You inspect robots on a conveyor belt.\nApprove the compliant. Scrap the defective. Repair the repairable.\nDo not ask questions.',
            {
                fontFamily: 'monospace', fontSize: '14px', color: '#778899',
                align: 'center', lineSpacing: 8,
            }
        ).setOrigin(0.5);

        // Begin Shift button
        let ready = false;
        const btnBg = this.add.rectangle(cx, 600, 240, 44, 0x0a0a0a)
            .setStrokeStyle(1, 0x334455)
            .setInteractive({ useHandCursor: true });
        const btnLabel = this.add.text(cx, 600, '[ BEGIN SHIFT ]', {
            fontFamily: 'monospace', fontSize: '15px', color: '#778899', letterSpacing: 3,
        }).setOrigin(0.5);

        // Flicker the button in after 0.8s
        this.time.delayedCall(800, () => {
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

        this.cameras.main.fadeIn(600, 0, 0, 0);
    }
}

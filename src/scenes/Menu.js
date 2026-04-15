import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

export default class MenuScene extends Phaser.Scene {
    constructor() { super('Menu'); }

    create() {
        const cx = 640;

        // Dark background
        this.add.rectangle(640, 360, 1280, 720, 0x080808);

        // Scanline overlay
        const scanlines = this.add.graphics();
        scanlines.fillStyle(0x000000, 0.08);
        for (let y = 0; y < 720; y += 4) {
            scanlines.fillRect(0, y, 1280, 2);
        }

        // Title
        this.add.text(cx, 200, "YOU'RE JUST A MACHINE", {
            fontFamily: 'monospace',
            fontSize: '48px',
            color: '#ffffff',
            align: 'center',
        }).setOrigin(0.5);

        // Employee ID subtitle
        this.add.text(cx, 265, 'Employee #492240182 — Unit Processing Division', {
            fontFamily: 'monospace',
            fontSize: '18px',
            color: '#888888',
            align: 'center',
        }).setOrigin(0.5);

        // Divider
        const div = this.add.graphics();
        div.lineStyle(1, 0x333333, 1);
        div.lineBetween(340, 295, 940, 295);

        // Lore blurb
        this.add.text(cx, 340, [
            'Every shift, robots and cybernetic parts arrive on a conveyor belt.',
            'You approve them, order repairs, or scrap them — following the rulebook.',
            'Follow the rules. The rules are the rules.',
        ], {
            fontFamily: 'monospace',
            fontSize: '15px',
            color: '#666666',
            align: 'center',
            lineSpacing: 8,
        }).setOrigin(0.5);

        // Begin button
        const btnBg = this.add.rectangle(cx, 470, 260, 56, 0x1a1a1a)
            .setStrokeStyle(1, 0x444444)
            .setInteractive({ useHandCursor: true });

        const btnText = this.add.text(cx, 470, 'BEGIN SHIFT', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#cccccc',
        }).setOrigin(0.5);

        let transitioning = false;
        btnBg.on('pointerover', () => {
            btnBg.setFillColor(0x2a2a2a);
            btnBg.setStrokeStyle(1, 0x888888);
            btnText.setColor('#ffffff');
        });
        btnBg.on('pointerout', () => {
            btnBg.setFillColor(0x1a1a1a);
            btnBg.setStrokeStyle(1, 0x444444);
            btnText.setColor('#cccccc');
        });
        btnBg.on('pointerdown', () => {
            if (transitioning) return;
            transitioning = true;
            GameState.reset();
            this.cameras.main.fade(400, 0, 0, 0);
            this.time.delayedCall(400, () => this.scene.start('Briefing'));
        });

        // Version tag
        this.add.text(1260, 710, 'v0.1', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#333333',
        }).setOrigin(1, 1);

        this.cameras.main.fadeIn(500, 0, 0, 0);
    }
}

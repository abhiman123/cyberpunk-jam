import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { redrawConveyorStrip } from '../systems/FloorSketchLayout.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';

/**
 * FNAF-style hub: conveyor feed delivers a unit.
 * Click the unit to open the workbench (Station).
 */
export default class WorkshopScene extends Phaser.Scene {
    constructor() {
        super('Workshop');
    }

    create() {
        GameState.reset();
        this._fx = applyCyberpunkLook(this);

        const W = 1280;
        const H = 720;

        this.add.rectangle(W / 2, H / 2, W, H, 0x050403);

        this._vignette(W, H);
        this._lightGrain(W, H);

        this._buildMonitorSidebar(24, 96, 248, 520);
        this._buildTopBar(W);

        const beltX = 300;
        const beltY = 268;
        const beltW = 920;
        const beltH = 102;

        this.add.rectangle(beltX + beltW / 2, beltY - 36, beltW + 80, 4, 0x1a1612);
        this._buildPendantGlow(708, 58);

        this.add.rectangle(beltX + beltW / 2, beltY + beltH / 2, beltW, beltH, 0x0e1014)
            .setStrokeStyle(1, 0x222830);

        this._conveyorStrip = this.add.graphics().setDepth(2);
        this._conveyorBounds = { x: beltX, y: beltY, w: beltW, h: beltH };
        this._conveyorPhase = 0;
        this._beltRunning = false;

        this._notification = this.add.text(320, 44, '', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#5a5448',
            letterSpacing: 1,
        });

        this._hint = this.add.text(W / 2, H - 42, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#3a3530',
        }).setOrigin(0.5);

        const targetX = beltX + beltW * 0.46;
        const targetY = beltY + beltH * 0.5;

        this._robot = this.add.container(beltX - 80, targetY);
        const body = this.add.rectangle(0, 6, 40, 24, 0x3a4a68).setStrokeStyle(1, 0x5a6a88);
        const head = this.add.rectangle(0, -10, 26, 20, 0x4a5a78).setStrokeStyle(1, 0x6a7a98);
        const visor = this.add.rectangle(0, -10, 20, 7, 0x00ddff, 0.75);
        this._robot.add([body, head, visor]);
        this._robot.setDepth(6);
        this._robot.setAlpha(0);

        this._hitZone = this.add.rectangle(targetX, targetY, 88, 72, 0x00ffcc, 0).setDepth(7);

        this._hitZone.on('pointerover', () => {
            if (!this._robotReady) return;
            this.tweens.add({ targets: this._robot, scale: 1.06, duration: 90, yoyo: true });
        });
        this._hitZone.on('pointerdown', () => {
            if (!this._robotReady) return;
            this._robotReady = false;
            this.tweens.killTweensOf(this._robot);
            this.cameras.main.fade(380, 0, 0, 0);
            this.time.delayedCall(380, () => this.scene.start('Station'));
        });

        this._notification.setText('>> FEED STABLE  ·  CAM_CONVEYOR_03');
        this._startConveyorSequence(beltX, beltW, targetX);

        this.cameras.main.fadeIn(600, 0, 0, 0);
    }

    _startConveyorSequence(beltX, beltW, targetX) {
        this.time.delayedCall(900, () => {
            this._notification.setText('>> PRIMARY LINE ENGAGED');
            this._beltRunning = true;
        });

        this.time.delayedCall(1700, () => {
            this._notification.setText('>> INBOUND UNIT  ·  ACK TO INSPECT');
            this._robot.setAlpha(1);
            this.tweens.add({
                targets: this._robot,
                x: targetX,
                duration: 4200,
                ease: 'Cubic.Out',
                onComplete: () => this._armPickup(),
            });
        });
    }

    _armPickup() {
        this._robotReady = true;
        this._hitZone.setInteractive({ useHandCursor: true });
        this._hint.setText('[ CLICK UNIT TO OPEN STATION VIEW ]').setColor('#6a6258');

        this.tweens.add({
            targets: this._robot,
            y: '+=2',
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    _buildTopBar(W) {
        this.add.rectangle(W / 2, 22, W, 44, 0x080807).setStrokeStyle(1, 0x1a1816);
        this.add.text(24, 14, 'UNIT MONITOR', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#4a4540',
            letterSpacing: 4,
        });
        this.add.text(W - 24, 14, 'LIVE', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#2a4a38',
            letterSpacing: 3,
        }).setOrigin(1, 0);
    }

    _buildMonitorSidebar(x, y, w, h) {
        this.add.rectangle(x + w / 2, y + h / 2, w, h, 0x070605, 0.92)
            .setStrokeStyle(1, 0x1c1a18);

        const lines = [
            'SIGNAL .... OK',
            'AUDIO ..... MUTE',
            'REC ....... OFF',
            'NIGHT ..... 1',
            '',
            'Stay on feed.',
            'Do not leave',
            'the station.',
        ];
        let ly = y + 20;
        lines.forEach((line, i) => {
            const col = i < 5 ? '#3a3834' : '#2a2824';
            this.add.text(x + 16, ly, line, {
                fontFamily: 'monospace',
                fontSize: i === 0 ? 10 : 11,
                color: col,
                lineSpacing: 4,
            });
            ly += i === 4 ? 18 : 22;
        });

        this.tweens.add({
            targets: this.add.text(x + 16, y + h - 36, '_', {
                fontFamily: 'monospace',
                fontSize: '14px',
                color: '#1e3a28',
            }),
            alpha: 0.2,
            duration: 500,
            yoyo: true,
            repeat: -1,
        });
    }

    _buildPendantGlow(x, y) {
        const cord = this.add.graphics();
        cord.lineStyle(2, 0x222220);
        cord.lineBetween(x, 44, x, y + 14);
        this.add.ellipse(x, y + 22, 44, 18, 0x2a2824, 0.9).setStrokeStyle(1, 0x3a3834);
        const bulb = this.add.ellipse(x, y + 20, 22, 11, 0xfff2c8, 0.28);
        this.tweens.add({
            targets: bulb,
            alpha: 0.5,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
    }

    _vignette(W, H) {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.12);
        g.fillRect(0, 0, W, 40);
        g.fillRect(0, H - 48, W, 48);
        g.fillRect(0, 0, 56, H);
        g.fillRect(W - 56, 0, 56, H);
    }

    _lightGrain(W, H) {
        const g = this.add.graphics();
        for (let i = 0; i < 320; i++) {
            const gx = Phaser.Math.Between(0, W);
            const gy = Phaser.Math.Between(0, H);
            g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.02, 0.06));
            g.fillRect(gx, gy, 1, 1);
        }
    }

    update(_t, dt) {
        if (!this._beltRunning) return;
        this._conveyorPhase += dt * 0.09;
        this._conveyorStrip.clear();
        redrawConveyorStrip(this._conveyorStrip, this._conveyorBounds, this._conveyorPhase);
    }
}

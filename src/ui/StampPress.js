const STAMPS = [
    { action: 'approve', label: 'APPROVE', color: 0x00cc44, glow: 0x44ff88 },
    { action: 'repair',  label: 'REPAIR',  color: 0xffaa00, glow: 0xffdd44 },
    { action: 'scrap',   label: 'SCRAP',   color: 0xff3322, glow: 0xff6655 },
];

export default class StampPress {
    constructor(scene, cx, cy) {
        this.scene = scene;
        this.cx = cx;
        this.cy = cy;
        this.container = scene.add.container(cx, cy).setDepth(12);
        this.onStamp = null;
        this._enabled = true;
        this._stamps = [];
        this._locked = false;
        this._gated = false;

        this._build();
    }

    _build() {
        const desk = this.scene.add.rectangle(0, 0, 520, 440, 0x0b0806, 0.92)
            .setStrokeStyle(2, 0x332211, 0.9);
        this.container.add(desk);

        const header = this.scene.add.text(0, -200, 'STAMP PRESS — FILE RULING', {
            fontFamily: 'monospace', fontSize: '11px', color: '#aa8855', letterSpacing: 2,
        }).setOrigin(0.5);
        this.container.add(header);
        this._header = header;

        this._gateMsg = this.scene.add.text(0, -180, '', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ff9933',
        }).setOrigin(0.5);
        this.container.add(this._gateMsg);

        // Docket paper behind the press
        const paper = this.scene.add.rectangle(0, -60, 360, 200, 0xd9c89a, 0.92)
            .setStrokeStyle(1, 0x7a6540, 1);
        const paperLines = this.scene.add.graphics();
        paperLines.lineStyle(1, 0x7a6540, 0.3);
        for (let i = 0; i < 6; i++) paperLines.lineBetween(-160, -120 + i * 22, 160, -120 + i * 22);
        this.container.add([paper, paperLines]);
        this._paper = paper;
        this._stampMark = this.scene.add.text(0, -60, '', {
            fontFamily: 'monospace', fontSize: '42px', color: '#000000',
        }).setOrigin(0.5).setAlpha(0);
        this.container.add(this._stampMark);

        // Three physical stamps on the lower half
        STAMPS.forEach((s, i) => {
            const x = -160 + i * 160;
            const y = 130;
            const body = this.scene.add.rectangle(x, y, 130, 100, 0x1a1a1a, 1)
                .setStrokeStyle(2, s.color, 1);
            const handle = this.scene.add.rectangle(x, y - 34, 34, 34, s.color, 1)
                .setStrokeStyle(1, 0x000000, 1);
            const lbl = this.scene.add.text(x, y, s.label, {
                fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5);

            body.setInteractive({ useHandCursor: true });
            handle.setInteractive({ useHandCursor: true });

            const hitTargets = [body, handle];
            hitTargets.forEach(t => {
                t.on('pointerover', () => {
                    if (!this._enabled || this._locked) return;
                    body.setStrokeStyle(3, s.glow, 1);
                });
                t.on('pointerout', () => {
                    body.setStrokeStyle(2, s.color, 1);
                });
                t.on('pointerdown', () => this._press(s));
            });

            this.container.add([body, handle, lbl]);
            this._stamps.push({ body, handle, lbl, def: s });
        });
    }

    _press(stampDef) {
        if (!this._enabled || this._locked) return;
        if (this._gated) {
            this.scene.tweens.add({ targets: this._gateMsg, alpha: { from: 1, to: 0.3 }, duration: 160, yoyo: true });
            return;
        }
        this._locked = true;

        const stamp = this._stamps.find(s => s.def.action === stampDef.action);
        // Slam animation on the handle
        this.scene.tweens.add({
            targets: [stamp.handle, stamp.body, stamp.lbl],
            y: '+=24',
            duration: 90,
            ease: 'Cubic.In',
            yoyo: true,
        });

        // Stamp mark appears on docket
        this._stampMark.setText(stampDef.label).setColor(this._hex(stampDef.color)).setAlpha(0).setScale(1.4);
        this.scene.tweens.add({
            targets: this._stampMark,
            alpha: { from: 0, to: 0.85 },
            scale: { from: 1.4, to: 1 },
            duration: 160,
            ease: 'Back.Out',
        });

        this.scene.time.delayedCall(140, () => {
            if (this.onStamp) this.onStamp(stampDef.action);
        });
    }

    reset() {
        this._locked = false;
        this._stampMark.setAlpha(0);
        this.setGated(false);
    }

    setEnabled(v) {
        this._enabled = v;
    }

    setGated(g, message = '') {
        this._gated = g;
        this._gateMsg.setText(g ? message : '').setAlpha(1);
        const tint = g ? 0.4 : 1;
        this._stamps.forEach(s => {
            s.body.setAlpha(tint);
            s.handle.setAlpha(tint);
            s.lbl.setAlpha(tint);
        });
    }

    setVisible(v) { this.container.setVisible(v); }

    _hex(n) {
        return '#' + n.toString(16).padStart(6, '0');
    }

    destroy() {
        this.container.destroy();
    }
}

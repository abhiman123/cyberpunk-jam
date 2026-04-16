import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';
import { applyCyberpunkLook } from '../fx/applyCyberpunkLook.js';

/**
 * Workbench layout (sketch as wireframe only). Labels mark future sprite slots.
 * Parts are draggable; lever rotates from a pivot.
 */
export default class StationScene extends Phaser.Scene {
    constructor() {
        super('Station');
    }

    create() {
        this._fx = applyCyberpunkLook(this);
        this._currentCase = this._pickIncomingCase();
        this._inspected = new Set();
        this._resolved = false;

        const W = 1280;
        const H = 720;
        const cx = W / 2;

        this.add.rectangle(cx, H / 2, W, H, 0x06080d);
        this._buildPhotoStyleBackdrop(W, H);

        this._worldBounds = { x: 44, y: 52, w: W - 88, h: H - 128 };
        this._panel = { x: 268, y: 118, w: 744, h: 448 };

        this._frame(this._worldBounds);
        this._verticalLabel(56, H / 2, 'CONVEYOR');
        this._rightSidebar(W - 200, 110, 170, H - 240);

        this._toolSlots = [
            this._placeholder(this, cx - 200, 86, 108, 40, 'hammer'),
            this._placeholder(this, cx, 86, 108, 40, 'hoses'),
            this._placeholder(this, cx + 200, 86, 108, 40, 'wrench'),
        ];
        this._placeholder(this, 138, 248, 100, 180, 'other tools');

        this._panelChrome(this._panel);

        const { x: px, y: py, w: pw, h: ph } = this._panel;
        const ix = px + 28;
        const iy = py + 32;
        const iw = pw - 56;
        const ih = ph - 64;

        this._parts = [
            this._placeholder(this, ix + iw - 90, iy + 70, 72, 72, 'gear'),
            this._placeholder(this, ix + iw * 0.48, iy + 88, 100, 36, 'wire'),
            this._placeholder(this, ix + 130, iy + ih * 0.48, 168, 32, 'light'),
            this._placeholder(this, ix + iw - 120, iy + ih - 70, 88, 48, 'flux cap'),
            this._placeholder(this, ix + 72, iy + ih - 72, 88, 56, 'spark'),
        ];

        this._leverDragging = false;
        this._leverPivot = { x: ix + iw - 36, y: iy + ih * 0.42 };
        this._leverArm = null;
        this._buildLever(this._leverPivot.x, this._leverPivot.y);

        this._onLeverPointerUp = () => { this._leverDragging = false; };
        this._onLeverPointerMove = (pointer) => {
            if (!this._leverDragging || !pointer.isDown || !this._leverArm) return;
            const { x: px, y: py } = this._leverPivot;
            const ang = Math.atan2(pointer.worldY - py, pointer.worldX - px);
            const MIN = -1.05;
            const MAX = 0.4;
            this._leverArm.rotation = Phaser.Math.Clamp(ang, MIN, MAX);
        };
        this.input.on('pointerup', this._onLeverPointerUp, this);
        this.input.on('pointermove', this._onLeverPointerMove, this);
        this.events.once('shutdown', () => {
            this.input.off('pointerup', this._onLeverPointerUp, this);
            this.input.off('pointermove', this._onLeverPointerMove, this);
        });

        this._buildInspectionUi(cx, H);
        this._showManagerIntro(W, H);

        this.add.text(W - 12, H - 10, 'v0.1', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#333333',
        }).setOrigin(1, 1);

        this.cameras.main.fadeIn(450, 0, 0, 0);
    }

    _pickIncomingCase() {
        const allCases = this.cache.json.get('cases') || [];
        const schedule = this.cache.json.get('schedule') || [];
        const entry = schedule.find(s => s.period === GameState.period && s.day === GameState.day);
        const ids = entry ? entry.caseIds : [];
        for (const id of ids) {
            if (!GameState.casesCompleted.includes(id)) {
                const match = allCases.find(c => c.id === id);
                if (match) return match;
            }
        }
        return allCases[0] || null;
    }

    _buildPhotoStyleBackdrop(W, H) {
        const g = this.add.graphics().setDepth(-1);
        g.fillStyle(0x0d1320, 0.95);
        g.fillRect(0, 0, W, 240);
        g.fillStyle(0x0c1018, 0.96);
        g.fillRect(0, 240, W, 170);
        g.fillStyle(0x12161f, 0.98);
        g.fillRect(0, 410, W, H - 410);

        g.lineStyle(2, 0x1ec7ff, 0.45);
        g.lineBetween(0, 230, W, 230);
        g.lineBetween(0, 395, W, 395);

        const neon = this.add.graphics().setDepth(1);
        neon.fillStyle(0x5b5dff, 0.26);
        neon.fillRect(80, 92, 240, 12);
        neon.fillStyle(0x00c8ff, 0.22);
        neon.fillRect(935, 296, 260, 10);
        neon.fillStyle(0xff4f93, 0.20);
        neon.fillRect(140, 438, 210, 10);
    }

    _frame(b) {
        const g = this.add.graphics();
        g.lineStyle(2, 0x3a5060, 0.85);
        g.strokeRect(b.x, b.y, b.w, b.h);
        g.lineStyle(1, 0x1a2530, 0.5);
        g.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
    }

    _verticalLabel(x, cy, text) {
        this.add.text(x, cy, text.split('').join('\n'), {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#4a5868',
            letterSpacing: 2,
            lineSpacing: 4,
            align: 'center',
        }).setOrigin(0.5);
    }

    _rightSidebar(x, y, w, h) {
        const g = this.add.graphics();
        g.lineStyle(2, 0x3a4860);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 26, y);
        g.lineTo(x + 26, y + h);
        g.lineTo(x, y + h);
        g.strokePath();

        this.add.text(x + 40, y + h * 0.32, '[ extra tool rail ]\n(sprite strip)', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#4a5868',
            lineSpacing: 8,
        });
    }

    _panelChrome(p) {
        const { x, y, w, h } = p;
        const g = this.add.graphics();
        g.fillStyle(0x0c0e12, 1);
        g.fillRect(x, y, w, h);
        g.lineStyle(2, 0x4a6080, 0.7);
        g.strokeRect(x, y, w, h);

        const screwR = 5;
        [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]].forEach(([sx, sy]) => {
            g.lineStyle(1, 0x2a3038);
            g.strokeCircle(sx, sy, screwR);
            g.lineStyle(1, 0x3a4550);
            g.lineBetween(sx - 3, sy, sx + 3, sy);
            g.lineBetween(sx, sy - 3, sx, sy + 3);
        });
    }

    _buildInspectionUi(cx, H) {
        const caseTitle = this._currentCase ? `INCOMING UNIT ${this._currentCase.id}` : 'INCOMING UNIT';
        this.add.text(650, 86, caseTitle, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#7bb7ff',
            letterSpacing: 2,
        }).setOrigin(0.5);

        this._inspectLog = this.add.text(1020, 482, 'INSPECTION LOG\n- awaiting scan', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#7d9bb8',
            lineSpacing: 6,
            wordWrap: { width: 230 },
        });

        const actions = [
            { key: 'approve', y: H - 146, label: 'APPROVE', color: '#59d79a' },
            { key: 'repair',  y: H - 98,  label: 'ORDER REPAIR', color: '#ffd569' },
            { key: 'scrap',   y: H - 50,  label: 'SCRAP', color: '#ff6c74' },
        ];
        this._actionButtons = [];
        actions.forEach((a) => {
            const bg = this.add.rectangle(1040, a.y, 220, 38, 0x0d1218)
                .setStrokeStyle(1, 0x34516b)
                .setInteractive({ useHandCursor: true });
            const tx = this.add.text(1040, a.y, a.label, {
                fontFamily: 'monospace',
                fontSize: '12px',
                color: a.color,
                letterSpacing: 1,
            }).setOrigin(0.5);
            bg.on('pointerdown', () => this._submitInspectionAction(a.key));
            this._actionButtons.push({ bg, tx, key: a.key });
        });

        if (!this._currentCase?.inspectionZones?.length) return;
        const zones = this._currentCase.inspectionZones.slice(0, 6);
        let y = 180;
        zones.forEach((z, i) => {
            const item = this._placeholder(this, 1035, y, 230, 34, `inspect ${i + 1}`);
            const txt = this.add.text(1035, y, z.label.substring(0, 26), {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#9dc4e8',
            }).setOrigin(0.5).setDepth(item.depth + 1);
            item.on('pointerdown', () => {
                this._inspected.add(z.id);
                item.getData('bg').setStrokeStyle(1, 0x59d79a);
                txt.setColor('#b8ffd0');
                this._updateInspectLog();
            });
            y += 44;
        });
    }

    _updateInspectLog() {
        if (!this._currentCase) return;
        const inspectedZones = this._currentCase.inspectionZones.filter(z => this._inspected.has(z.id));
        const lines = inspectedZones.slice(-4).map(z => `- ${z.label.substring(0, 28)}`);
        this._inspectLog.setText(`INSPECTION LOG\n${lines.length ? lines.join('\n') : '- awaiting scan'}`);
    }

    _submitInspectionAction(action) {
        if (this._resolved || !this._currentCase) return;
        if (this._inspected.size === 0) {
            this._inspectLog.setText('INSPECTION LOG\n- inspect at least one element');
            return;
        }
        this._resolved = true;
        const correct = action === this._currentCase.correctAction;
        if (!correct) {
            GameState.totalMistakes++;
            GameState.paycheckTotal -= 0.00000003;
        }
        GameState.casesCompleted.push(this._currentCase.id);
        const msg = correct ? 'RULING ACCEPTED' : `VIOLATION: ${this._currentCase.correctAction.toUpperCase()} REQUIRED`;
        const col = correct ? '#72ffb7' : '#ff7c8b';
        this._inspectLog.setColor(col).setText(`INSPECTION LOG\n- ${msg}\n- forwarding next queue`);
        this.time.delayedCall(750, () => {
            this.cameras.main.fade(260, 0, 0, 0);
            this.time.delayedCall(280, () => this.scene.start('Game'));
        });
    }

    _showManagerIntro(W, H) {
        const layer = this.add.container(0, 0).setDepth(200);
        const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x02040a, 0.72);
        const card = this.add.rectangle(W / 2, H / 2 - 20, 620, 280, 0x0a121e).setStrokeStyle(2, 0x2e78ba);
        const mgr = this.add.image(W / 2 - 200, H / 2 - 12, 'manager_human').setScale(2.8);
        const txt = this.add.text(W / 2 + 30, H / 2 - 38, [
            'Robot arrived. Inspect each critical element.',
            'Then issue your ruling: approve / repair / scrap.',
            'Your first decision starts the shift.',
        ], {
            fontFamily: 'monospace',
            fontSize: '14px',
            color: '#91b8de',
            lineSpacing: 9,
        }).setOrigin(0.5);
        const btn = this.add.rectangle(W / 2, H / 2 + 86, 220, 42, 0x0d1a28).setStrokeStyle(1, 0x3d95ea)
            .setInteractive({ useHandCursor: true });
        const btxt = this.add.text(W / 2, H / 2 + 86, 'BEGIN INSPECTION', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#8fd4ff',
            letterSpacing: 1,
        }).setOrigin(0.5);
        layer.add([shade, card, mgr, txt, btn, btxt]);
        btn.once('pointerdown', () => {
            btn.disableInteractive();
            this.tweens.add({
                targets: layer,
                alpha: 0,
                duration: 260,
                onComplete: () => layer.destroy(true),
            });
        });
    }

    /**
     * @returns {Phaser.GameObjects.Container}
     */
    _placeholder(scene, cx, cy, bw, bh, key) {
        const c = scene.add.container(cx, cy);
        const bg = scene.add.rectangle(0, 0, bw, bh, 0x0e1218, 0.65).setStrokeStyle(1, 0x3a5570);
        const t = scene.add.text(0, 0, `[ ${key} ]`, {
            fontFamily: 'monospace',
            fontSize: Math.min(11, Math.floor(bh * 0.28)),
            color: '#5a7890',
        }).setOrigin(0.5);
        c.add([bg, t]);
        c.setSize(bw, bh);
        c.setInteractive(
            new Phaser.Geom.Rectangle(-bw / 2, -bh / 2, bw, bh),
            Phaser.Geom.Rectangle.Contains
        );
        scene.input.setDraggable(c);
        c.setData('ph', { bw, bh });
        c.setData('bg', bg);

        c.on('drag', (_pointer, dragX, dragY) => {
            c.setPosition(dragX, dragY);
            scene._clampContainer(c);
        });

        return c;
    }

    _clampContainer(c) {
        const { bw, bh } = c.getData('ph');
        const b = this._worldBounds;
        c.x = Phaser.Math.Clamp(c.x, b.x + bw / 2, b.x + b.w - bw / 2);
        c.y = Phaser.Math.Clamp(c.y, b.y + bh / 2, b.y + b.h - bh / 2);
    }

    _buildLever(px, py) {
        const pivot = this.add.container(px, py).setDepth(20);
        const hub = this.add.circle(0, 0, 11, 0x2a3038).setStrokeStyle(2, 0x5a7088);
        const arm = this.add.rectangle(48, 0, 86, 12, 0x5a6068).setOrigin(0, 0.5).setStrokeStyle(1, 0x7a90a0);
        const knob = this.add.rectangle(118, 0, 14, 22, 0x4a5868).setStrokeStyle(1, 0x6a8098);
        const armGroup = this.add.container(0, 0, [arm, knob]);
        pivot.add([hub, armGroup]);
        armGroup.rotation = -0.45;
        this._leverArm = armGroup;

        this.add.text(px, py - 72, '[ lever ]', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#3a4860',
        }).setOrigin(0.5).setDepth(19);

        const hit = this.add.circle(px, py, 72, 0x000000, 0).setDepth(21).setInteractive({ draggable: false });
        hit.on('pointerdown', () => { this._leverDragging = true; });
    }
}

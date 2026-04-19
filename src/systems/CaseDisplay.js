import Animations from '../fx/Animations.js';

/**
 * CaseDisplay — renders a case in the left panel.
 * Entrance: slides in from the right (conveyor direction).
 * Exit:     slides out to the left (conveyor depart).
 */
export default class CaseDisplay {
    constructor(scene, panelX, panelY, panelW = 472) {
        this.scene    = scene;
        this.panelX   = panelX;
        this.panelY   = panelY;
        this.panelW   = panelW;
        this._objects  = [];
        this._revealed = new Set();
        this._caseData = null;
    }

    load(caseData, onReady = null) {
        this._destroyObjects();
        this._revealed.clear();
        this._caseData = caseData;

        const cx      = this.panelX + this.panelW / 2;
        const padY    = this.panelY + 18;

        // ── Unit name ────────────────────────────────────────────────────────
        const nameText = this.scene.add.text(cx, padY + 8, caseData.name, {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#cccccc',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setDepth(5);
        this._track(nameText);

        // ── Description ──────────────────────────────────────────────────────
        const descText = this.scene.add.text(cx, padY + 36, caseData.description, {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#686868',
            wordWrap: { width: this.panelW - 40 },
            align: 'center',
        }).setOrigin(0.5).setDepth(5);
        this._track(descText);

        // ── Divider ──────────────────────────────────────────────────────────
        const divGfx = this.scene.add.graphics().setDepth(5);
        divGfx.lineStyle(1, 0x2e2e2e);
        divGfx.lineBetween(
            this.panelX + 18, padY + 54,
            this.panelX + this.panelW - 18, padY + 54
        );
        this._track(divGfx);

        // ── Inspection zones ─────────────────────────────────────────────────
        const zoneBaseX = this.panelX + 28;
        const zoneBaseY = padY + 66;

        caseData.inspectionZones.forEach((zone, idx) => {
            const zx = zoneBaseX + zone.x;
            const zy = zoneBaseY + zone.y;

            const rect = this.scene.add.rectangle(
                zx + zone.w / 2, zy + zone.h / 2,
                zone.w, zone.h,
                0x181818
            ).setStrokeStyle(1, 0x3a3a3a)
             .setInteractive({ useHandCursor: true })
             .setDepth(10).setAlpha(0);
            this._track(rect);

            const hint = this.scene.add.text(
                zx + zone.w / 2, zy + zone.h / 2,
                '[ inspect ]',
                { fontFamily: 'Courier New', fontSize: '10px', color: '#505050' }
            ).setOrigin(0.5).setDepth(11).setAlpha(0);
            this._track(hint);

            const revealText = this.scene.add.text(
                zx + 10, zy + zone.h / 2, // Slight padding from the left edge
                zone.label,
                {
                    fontFamily: 'Courier New', fontSize: '11px', color: '#00ffcc',
                    wordWrap: { width: zone.w - 14 },
                }
            ).setOrigin(0, 0.5).setAlpha(0).setDepth(11);
            this._track(revealText);

            // Staggered fade in for each zone after conveyor arrives
            this.scene.time.delayedCall(280 + idx * 55, () => {
                this.scene.tweens.add({ targets: [rect, hint], alpha: 1, duration: 140 });
            });

            rect.on('pointerover', () => {
                if (!this._revealed.has(zone.id)) rect.setFillStyle(0x222222);
            });
            rect.on('pointerout', () => {
                if (!this._revealed.has(zone.id)) rect.setFillStyle(0x181818);
            });
            rect.on('pointerdown', () => {
                if (this._revealed.has(zone.id)) return;
                this._revealed.add(zone.id);
                rect.setFillStyle(0x0a1a18).setStrokeStyle(1, 0x009977);
                hint.setAlpha(0);
                this.scene.tweens.add({ targets: revealText, alpha: 1, duration: 160 });
                Animations.glitchText(this.scene, revealText, { duration: 180, finalAlpha: 1 });
                this.scene.events.emit('zoneRevealed', zone.id);
                Animations.notify(
                    this.scene,
                    '✓ Logged',
                    zx + zone.w / 2, zy - 8,
                    { color: '#00ffcc', duration: 800 }
                );
            });
        });

        // ── Moral flavour ─────────────────────────────────────────────────────
        if (caseData.moralFlavor) {
            const fy = zoneBaseY + (caseData.inspectionZones.length * 38) + 20;
            const flavor = this.scene.add.text(cx, fy,
                `// ${caseData.moralFlavor}`,
                {
                    fontFamily: 'Courier New', fontSize: '10px', color: '#484848',
                    wordWrap: { width: this.panelW - 56 }, align: 'center',
                    fontStyle: 'italic',
                }
            ).setOrigin(0.5).setDepth(5);
            this._track(flavor);
        }

        // ── Conveyor entrance ─────────────────────────────────────────────────
        const renderables = this._objects.filter(o => typeof o.setAlpha === 'function');
        Animations.conveyorArrive(this.scene, renderables, cx, onReady);
    }

    dismiss(onDone = null) {
        const moveable = this._objects.filter(o => o.x !== undefined);
        Animations.conveyorDepart(this.scene, moveable, () => {
            this._objects = [];
            if (onDone) onDone();
        });
    }

    revealedCount() { return this._revealed.size; }
    totalZones()    { return this._caseData ? this._caseData.inspectionZones.length : 0; }

    _track(obj)      { this._objects.push(obj); }
    _destroyObjects() { this._objects.forEach(o => o.destroy()); this._objects = []; }
    destroy()        { this._destroyObjects(); }
}

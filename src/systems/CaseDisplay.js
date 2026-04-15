/**
 * CaseDisplay — renders a case in the left panel.
 * Shows the unit sprite, name/description, and clickable inspection zones.
 * Each zone starts as an unmarked rect; clicking reveals the label.
 */
export default class CaseDisplay {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} panelX  left edge of the case area
     * @param {number} panelY  top edge of the case area
     */
    constructor(scene, panelX, panelY) {
        this.scene    = scene;
        this.panelX   = panelX;
        this.panelY   = panelY;
        this._objects = [];     // all GameObjects created for this case
        this._revealed = new Set();
    }

    /** Load and render a case data object. Destroys any previous case. */
    load(caseData) {
        this._destroyObjects();
        this._revealed.clear();
        this._caseData = caseData;

        const cx = this.panelX + 384; // center of left panel
        const cy = this.panelY + 335; // vertical center

        // Case display background
        const bg = this.scene.add.image(cx, cy - 20, 'case_display');
        this._track(bg);

        // Unit name
        const nameText = this.scene.add.text(cx, cy - 160, caseData.name, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#dddddd',
        }).setOrigin(0.5);
        this._track(nameText);

        // Description
        const descText = this.scene.add.text(cx, cy - 130, caseData.description, {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#888888',
            wordWrap: { width: 360 },
            align: 'center',
        }).setOrigin(0.5);
        this._track(descText);

        // Moral flavor (faint, if present)
        if (caseData.moralFlavor) {
            const flavorText = this.scene.add.text(cx, cy + 150, `// ${caseData.moralFlavor}`, {
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#4a4a4a',
                wordWrap: { width: 360 },
                align: 'center',
                fontStyle: 'italic',
            }).setOrigin(0.5);
            this._track(flavorText);
        }

        // Inspection zones
        const zoneOriginX = cx - 190; // left-align zones within display
        const zoneOriginY = cy - 90;

        caseData.inspectionZones.forEach(zone => {
            const zx = zoneOriginX + zone.x;
            const zy = zoneOriginY + zone.y;

            // Zone background rect
            const rect = this.scene.add.rectangle(
                zx + zone.w / 2, zy + zone.h / 2,
                zone.w, zone.h,
                0x222222
            ).setStrokeStyle(1, 0x444444).setInteractive({ useHandCursor: true });
            this._track(rect);

            // "Click to inspect" hint label
            const hintText = this.scene.add.text(
                zx + zone.w / 2, zy + zone.h / 2,
                `[ inspect ]`,
                { fontFamily: 'monospace', fontSize: '11px', color: '#444444' }
            ).setOrigin(0.5);
            this._track(hintText);

            // Revealed label text (hidden initially)
            const revealText = this.scene.add.text(
                zx + 6, zy + zone.h / 2,
                zone.label,
                { fontFamily: 'monospace', fontSize: '12px', color: '#00ffcc' }
            ).setOrigin(0, 0.5).setAlpha(0);
            this._track(revealText);

            // Click handler
            rect.on('pointerover', () => {
                if (!this._revealed.has(zone.id)) rect.setFillColor(0x2a2a2a);
            });
            rect.on('pointerout', () => {
                if (!this._revealed.has(zone.id)) rect.setFillColor(0x222222);
            });
            rect.on('pointerdown', () => {
                if (this._revealed.has(zone.id)) return;
                this._revealed.add(zone.id);
                rect.setFillColor(0x0a1a18).setStrokeStyle(1, 0x00aa88);
                hintText.setAlpha(0);
                this.scene.tweens.add({
                    targets: revealText, alpha: 1, duration: 200,
                });
                this.scene.events.emit('zoneRevealed', zone.id);
            });
        });

        // Slide-in animation (from right)
        const container = this.scene.add.container(cx + 900, 0);
        this.scene.tweens.add({
            targets: container, x: 0, duration: 350, ease: 'Cubic.Out',
        });
        // Note: we don't actually use the container — objects are placed absolutely.
        // The animation is cosmetic via a separate overlay slide.
        container.destroy();

        this._slideIn(cx);
    }

    /** Slide in the case display from the right */
    _slideIn(cx) {
        // Flash border on bg image briefly
        const flash = this.scene.add.rectangle(cx, this.panelY + 315, 420, 300, 0x00ffcc, 0.08)
            .setStrokeStyle(1, 0x00ffcc, 0.5);
        this._track(flash);
        this.scene.tweens.add({
            targets: flash, alpha: 0, duration: 500,
            onComplete: () => flash.setVisible(false),
        });
    }

    /** How many zones have been revealed */
    revealedCount() {
        return this._revealed.size;
    }

    totalZones() {
        return this._caseData ? this._caseData.inspectionZones.length : 0;
    }

    _track(obj) {
        this._objects.push(obj);
    }

    _destroyObjects() {
        this._objects.forEach(o => o.destroy());
        this._objects = [];
    }

    destroy() {
        this._destroyObjects();
    }
}

/**
 * RulebookOverlay — hologram-style translucent overlay showing active rules.
 * Toggle with B key or the RULEBOOK button.
 * When open, dims the left panel to create memory pressure.
 */
export default class RulebookOverlay {
    /**
     * @param {Phaser.Scene} scene
     * @param {number[]} activeRuleIds   array of active rule IDs
     * @param {object[]} allRules        full rules array from JSON
     * @param {number[]} newRuleIds      IDs of rules that are new this period (highlighted)
     */
    constructor(scene, activeRuleIds, allRules, newRuleIds = []) {
        this.scene        = scene;
        this.activeRuleIds = activeRuleIds;
        this.allRules     = allRules;
        this.newRuleIds   = newRuleIds;
        this._visible     = false;
        this._objects     = [];
        this._dimOverlay  = null;

        this._build();

        // ESC / B key to toggle
        this._escKey = scene.input.keyboard.addKey('ESC');
        this._bKey   = scene.input.keyboard.addKey('B');
        this._escKey.on('down', () => { if (this._visible) this.hide(); });
        this._bKey.on('down',   () => this.toggle());

        this.hide(); // start hidden
    }

    toggle() {
        this._visible ? this.hide() : this.show();
    }

    show() {
        this._visible = true;
        this._objects.forEach(o => o.setVisible(true));
        if (this._dimOverlay) this._dimOverlay.setVisible(true);
        // Fade in
        this.scene.tweens.add({
            targets: this._objects,
            alpha: { from: 0, to: 1 },
            duration: 120,
        });
    }

    hide() {
        this._visible = false;
        // Fade out then hide
        this.scene.tweens.add({
            targets: this._objects,
            alpha: 0,
            duration: 120,
            onComplete: () => {
                this._objects.forEach(o => o.setVisible(false));
                if (this._dimOverlay) this._dimOverlay.setVisible(false);
            },
        });
    }

    isVisible() { return this._visible; }

    _build() {
        const depth = 101;

        // Dim overlay for left panel
        this._dimOverlay = this.scene.add.rectangle(384, 360, 768, 720, 0x000000, 0.5)
            .setDepth(depth - 1).setVisible(false);

        // Full-screen semi-transparent cyan background
        const bg = this.scene.add.rectangle(640, 360, 1280, 720, 0x002233, 0.92)
            .setDepth(depth).setVisible(false);
        this._objects.push(bg);

        // Scanline effect
        const scan = this.scene.add.graphics().setDepth(depth + 1).setVisible(false);
        scan.fillStyle(0x000000, 0.12);
        for (let y = 0; y < 720; y += 4) scan.fillRect(0, y, 1280, 2);
        this._objects.push(scan);

        // Cyan border frame
        const frame = this.scene.add.graphics().setDepth(depth + 1).setVisible(false);
        frame.lineStyle(1, 0x00cccc, 0.6);
        frame.strokeRect(40, 40, 1200, 640);
        this._objects.push(frame);

        // Header
        const header = this.scene.add.text(640, 70, 'DIRECTIVE MANUAL — ACTIVE RULES', {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#00ffff',
            align: 'center',
        }).setOrigin(0.5).setDepth(depth + 2).setVisible(false);
        this._objects.push(header);

        // Divider
        const divGfx = this.scene.add.graphics().setDepth(depth + 2).setVisible(false);
        divGfx.lineStyle(1, 0x00aaaa, 0.5);
        divGfx.lineBetween(60, 100, 1220, 100);
        this._objects.push(divGfx);

        // Rules list
        const activeRules = this.allRules.filter(r => this.activeRuleIds.includes(r.id));
        let ry = 130;
        activeRules.forEach(rule => {
            const isNew = this.newRuleIds.includes(rule.id);
            const prefix = `[${rule.id}]  `;
            const color  = isNew ? '#ffcc44' : '#00cccc';
            const newTag = isNew ? '  [NEW]' : '';

            const ruleText = this.scene.add.text(80, ry, `${prefix}${rule.text}${newTag}`, {
                fontFamily: 'monospace',
                fontSize: '16px',
                color,
                wordWrap: { width: 1120 },
                lineSpacing: 4,
            }).setDepth(depth + 2).setVisible(false);
            this._objects.push(ruleText);
            ry += 60;
        });

        // Close hint
        const closeHint = this.scene.add.text(640, 660, 'Press [B] or [ESC] to close', {
            fontFamily: 'monospace',
            fontSize: '13px',
            color: '#44aaaa',
        }).setOrigin(0.5).setDepth(depth + 2).setVisible(false);
        this._objects.push(closeHint);
    }

    destroy() {
        this._objects.forEach(o => o.destroy());
        if (this._dimOverlay) this._dimOverlay.destroy();
        if (this._escKey) this._escKey.destroy();
        if (this._bKey)   this._bKey.destroy();
    }
}

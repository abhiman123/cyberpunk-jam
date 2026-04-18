const PANELS = [
    { id: 'A', label: 'HEAD',  x: 0,   y: -150, w: 130, h: 60 },
    { id: 'B', label: 'TORSO', x: 0,   y: -30,  w: 160, h: 100 },
    { id: 'C', label: 'LEFT',  x: -90, y: 70,   w: 70,  h: 90 },
    { id: 'D', label: 'RIGHT', x: 90,  y: 70,   w: 70,  h: 90 },
];

export default class ChassisBay {
    constructor(scene, cx, cy) {
        this.scene = scene;
        this.cx = cx;
        this.cy = cy;
        this.container = scene.add.container(cx, cy).setDepth(12);
        this._panelObjs = {};
        this._opened = new Set();
        this._caseData = null;
        this.onPanelOpened = null;
        this.onDiagnosticLaunch = null;

        this._build();
    }

    _build() {
        const chassisBg = this.scene.add.rectangle(0, 0, 360, 440, 0x0a1416, 0.9)
            .setStrokeStyle(2, 0x224455, 0.9);
        this.container.add(chassisBg);

        // Header
        const header = this.scene.add.text(0, -200, 'CHASSIS BAY — AWAITING UNIT', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#66aacc', letterSpacing: 2,
        }).setOrigin(0.5);
        this.container.add(header);
        this._header = header;

        // Robot silhouette
        this._unitSprite = this.scene.add.image(0, 10, 'unit_placeholder').setScale(1.5).setAlpha(0.85);
        this.container.add(this._unitSprite);

        // Panels overlaid
        PANELS.forEach(p => {
            const rect = this.scene.add.rectangle(p.x, p.y, p.w, p.h, 0x001122, 0.0)
                .setStrokeStyle(1, 0x336688, 0.6)
                .setInteractive({ useHandCursor: true });
            const lbl = this.scene.add.text(p.x, p.y, `[${p.id}] ${p.label}`, {
                fontFamily: 'Courier New', fontSize: '9px', color: '#446688',
            }).setOrigin(0.5);

            rect.on('pointerover', () => {
                if (!this._opened.has(p.id)) rect.setStrokeStyle(1, 0x66aacc, 1);
            });
            rect.on('pointerout', () => {
                if (!this._opened.has(p.id)) rect.setStrokeStyle(1, 0x336688, 0.6);
            });
            rect.on('pointerdown', () => this._onPanelClick(p.id));

            this.container.add([rect, lbl]);
            this._panelObjs[p.id] = { rect, lbl, panel: p };
        });

        // Diagnostic port (torso) — only visible when case has circuit
        this._diagBtn = this.scene.add.container(0, 130).setVisible(false);
        const dBg = this.scene.add.rectangle(0, 0, 220, 36, 0x003344, 0.85)
            .setStrokeStyle(1, 0x00cccc, 0.9)
            .setInteractive({ useHandCursor: true });
        const dTxt = this.scene.add.text(0, 0, 'OPEN DIAGNOSTIC PORT', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#00eeee', letterSpacing: 1,
        }).setOrigin(0.5);
        dBg.on('pointerover', () => dBg.setFillStyle(0x00aaaa, 0.45));
        dBg.on('pointerout',  () => dBg.setFillStyle(0x003344, 0.85));
        dBg.on('pointerdown', () => {
            if (this._caseData?.circuit && this.onDiagnosticLaunch) {
                this.onDiagnosticLaunch(this._caseData);
            }
        });
        this._diagBtn.add([dBg, dTxt]);
        this.container.add(this._diagBtn);
    }

    _onPanelClick(panelId) {
        if (!this._caseData) return;
        if (this._opened.has(panelId)) return;
        this._opened.add(panelId);

        const obj = this._panelObjs[panelId];
        obj.rect.setFillStyle(0x003322, 0.35).setStrokeStyle(2, 0x00cc88, 1);
        obj.lbl.setColor('#00cc88');

        const zone = this._caseData.zones?.[panelId] || {};
        const findings = [];
        if (zone.hammer)  findings.push(zone.hammer);
        if (zone.scanner) findings.push(zone.scanner);

        // Open animation: quick flash
        this.scene.tweens.add({
            targets: obj.rect, alpha: { from: 0.8, to: 0.35 },
            duration: 220, yoyo: true,
        });

        if (this.onPanelOpened) {
            this.onPanelOpened({ panel: panelId, label: obj.panel.label, findings });
        }
    }

    loadCase(caseData) {
        this._caseData = caseData;
        this._header.setText(`CHASSIS BAY — ${caseData.id} / ${caseData.name}`);
        this._diagBtn.setVisible(!!caseData.circuit);
        // Reset panel visuals
        this._opened.clear();
        Object.values(this._panelObjs).forEach(({ rect, lbl, panel }) => {
            rect.setFillStyle(0x001122, 0).setStrokeStyle(1, 0x336688, 0.6);
            lbl.setColor('#446688').setText(`[${panel.id}] ${panel.label}`);
        });
    }

    markDiagnosticComplete(evidence) {
        if (!this._diagBtn.visible) return;
        const bg = this._diagBtn.list[0];
        const txt = this._diagBtn.list[1];
        if (evidence?.completed) {
            bg.setFillStyle(0x004422, 0.85).setStrokeStyle(1, 0x00cc44, 0.9);
            txt.setText('DIAGNOSTIC — CLEAN').setColor('#00ff88');
        } else if (evidence?.forbiddenUsed) {
            bg.setFillStyle(0x441111, 0.85).setStrokeStyle(1, 0xff4444, 0.9);
            txt.setText('DIAGNOSTIC — MODIFIED').setColor('#ff6644');
        } else {
            bg.setFillStyle(0x332211, 0.85).setStrokeStyle(1, 0xccaa33, 0.9);
            txt.setText('DIAGNOSTIC — INCOMPLETE').setColor('#ffcc44');
        }
    }

    setVisible(v) { this.container.setVisible(v); }

    destroy() {
        this.container.destroy();
    }
}

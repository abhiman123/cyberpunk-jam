import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

// ─── Layout ──────────────────────────────────────────────────────────────────
const DEPTH        = 430;
const CX           = 640;   // panel center X
const CY           = 360;   // panel center Y
const PANEL_W      = 900;
const PANEL_H      = 520;

// Subsystem tag colors
const TAG_COLORS = {
    GRID:  '#00ffa3', // Brighter neon green
    FLOW:  '#00bfff', // Brighter neon blue
    GEAR:  '#ffcc00', // Gold/Amber
    CODE:  '#ff4de1', // Neon pink
    NOTE:  '#94a3b8', // Muted slate
};

// ─────────────────────────────────────────────────────────────────────────────

export default class RulebookOverlay {
    constructor(scene, activeRuleIds, allRules, newRuleIds = [], callbacks = {}) {
        this.scene          = scene;
        this.activeRuleIds  = Array.isArray(activeRuleIds) ? [...activeRuleIds] : [];
        this.allRules       = Array.isArray(allRules) ? allRules : [];
        this.newRuleIds     = new Set(Array.isArray(newRuleIds) ? newRuleIds : []);
        this._callbacks     = callbacks;
        this._visible       = false;
        this._contentNodes  = [];

        this._handleEscape = this._handleEscape.bind(this);
        this._handleToggle = this._handleToggle.bind(this);

        this._build();

        this._escKey = scene.input.keyboard?.addKey('ESC', false);
        this._bKey   = scene.input.keyboard?.addKey('B',   false);
        this._escKey?.on('down', this._handleEscape);
        this._bKey?.on('down',   this._handleToggle);

        this.hide(true);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    toggle() {
        if (this._visible) { this.hide(); return; }
        if (this._callbacks.canToggle && !this._callbacks.canToggle()) return;
        this.show();
    }

    show() {
        if (this._visible) return;
        this._visible = true;
        this._refresh();
        this._root.setVisible(true);

        this.scene.tweens.killTweensOf([this._backdrop, this._panel]);
        this._backdrop.setAlpha(0);
        this._panel.setAlpha(0).setScale(0.97);
        this.scene.tweens.add({ targets: this._backdrop, alpha: 0.88, duration: 160, ease: 'Quad.Out' });
        this.scene.tweens.add({ targets: this._panel,   alpha: 1, scaleX: 1, scaleY: 1, duration: 200, ease: 'Cubic.Out' });
        this._callbacks.onOpen?.();
    }

    hide(immediate = false) {
        if (!this._root) return;
        if (!this._visible && !this._root.visible) return;
        if (!this._visible && !immediate) return;

        this._visible = false;
        if (immediate) { this._root.setVisible(false); this._callbacks.onClose?.(); return; }

        this.scene.tweens.killTweensOf([this._backdrop, this._panel]);
        this.scene.tweens.add({ targets: this._backdrop, alpha: 0, duration: 140, ease: 'Quad.In' });
        this.scene.tweens.add({
            targets: this._panel, alpha: 0, scaleX: 0.97, scaleY: 0.97,
            duration: 140, ease: 'Quad.In',
            onComplete: () => { this._root.setVisible(false); this._callbacks.onClose?.(); },
        });
    }

    isVisible() { return this._visible; }

    setRuleState(activeRuleIds, newRuleIds = null) {
        this.activeRuleIds = Array.isArray(activeRuleIds) ? [...activeRuleIds] : [];
        if (newRuleIds !== null) this.newRuleIds = new Set(Array.isArray(newRuleIds) ? newRuleIds : []);
        if (this._visible) this._refresh();
    }

    // ── Build chrome (called once) ────────────────────────────────────────────

    _build() {
        this._root = this.scene.add.container(0, 0).setDepth(DEPTH).setVisible(false);

        // ── Backdrop ──────────────────────────────────────────────────────────
        this._backdrop = this.scene.add.rectangle(CX, CY, 1280, 720, 0x000000, 0.88)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => this.hide());

        // ── Panel shell ───────────────────────────────────────────────────────
        this._panel = this.scene.add.container(CX, CY);

        const shadow = this.scene.add.rectangle(6, 8, PANEL_W + 16, PANEL_H + 16, 0x000000, 0.36);
        const shell  = this.scene.add.rectangle(0, 0, PANEL_W,       PANEL_H,      0x0e1419, 1)
            .setStrokeStyle(2, 0x3a4a55, 0.96);
        const inner  = this.scene.add.rectangle(0, 0, PANEL_W - 12,  PANEL_H - 12, 0x111820, 1)
            .setStrokeStyle(1, 0x2a3840, 0.72);

        // ── Header bar ────────────────────────────────────────────────────────
        const headerH  = 50;
        const headerY  = -(PANEL_H / 2) + (headerH / 2);
        const headerBg = this.scene.add.rectangle(0, headerY, PANEL_W, headerH, 0x0f172a, 1)
            .setStrokeStyle(1, 0x1e293b, 1);
        const accentLine = this.scene.add.rectangle(0, headerY + headerH / 2, PANEL_W, 1, 0x0ea5e9, 0.4);

        this._headerTitle = this.scene.add.text(-(PANEL_W / 2) + 24, headerY, 'FACTORY DIRECTIVES', {
        fontFamily: 'Courier New', fontSize: '18px', fontStyle: 'bold', color: '#f8fafc', letterSpacing: 4,
        }).setOrigin(0, 0.5);

        this._headerDay = this.scene.add.text(50, headerY, '', {
            fontFamily: 'Courier New', fontSize: '15px', fontStyle: 'bold', color: '#94a3b8', letterSpacing: 2,
        }).setOrigin(0.5);

        // Close button
        const closeBg = this.scene.add.rectangle((PANEL_W / 2) - 40, headerY, 64, 30, 0x1c2a34, 1)
            .setStrokeStyle(1, 0x4a6070, 0.82).setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text((PANEL_W / 2) - 40, headerY, 'ESC', {
            fontFamily: 'Courier New, monospace', fontSize: '12px', color: '#64748b', fontWeight: 'bold',
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => { closeBg.setFillStyle(0x243644, 1); closeLabel.setColor('#c8e8f4'); });
        closeBg.on('pointerout',  () => { closeBg.setFillStyle(0x1c2a34, 1); closeLabel.setColor('#8ab4c4'); });
        closeBg.on('pointerdown', () => this.hide());

        // ── Content container (rebuilt on every show/refresh) ─────────────────
        this._contentContainer = this.scene.add.container(-(PANEL_W / 2) + 28, headerY + headerH / 2 + 15);

        this._panel.add([
            shadow, shell, inner,
            headerBg, accentLine,
            this._headerTitle, this._headerDay,
            closeBg, closeLabel,
            this._contentContainer,
        ]);

        this._root.add([this._backdrop, this._panel]);
    }

    // ── Content (rebuilt on every show/refresh) ───────────────────────────────

    _refresh() {
        // Destroy previous content
        this._contentNodes.forEach((n) => n.destroy());
        this._contentNodes = [];
        this._contentContainer.removeAll(false);

        // Update header day chip
        this._headerDay.setText(`DAY ${GameState.day}  ·  ACTIVE DIRECTIVES`);

        const activeRules = this.allRules.filter((r) => this.activeRuleIds.includes(r.id));
        const contentW    = PANEL_W - 56;  
        const bodyW       = contentW - 24;
        let y = 0;

        if (activeRules.length === 0) {
            y = this._addNote('No directives loaded for this shift.', y, contentW);
        }

        activeRules.forEach((rule, ruleIndex) => {
            const isNew = this.newRuleIds.has(rule.id);

            // ── Rule header row ───────────────────────────────────────────────
            if (ruleIndex > 0) {
                const sep = this.scene.add.rectangle(contentW / 2, y + 6, contentW, 1, 0x253038, 0.8).setOrigin(0.5, 0);
                this._push(sep);
                y += 20;
            }

            // Day badge + rule headline
            const badgeColor = rule.id === 101 ? '#7c4fc7' : isNew ? '#f59e0b' : '#334155';
            const badgeStroke = rule.id === 101 ? 0x9b6de8 : isNew ? 0xfbbf24 : 0x475569;
            const badgeBg = this.scene.add.rectangle(24, y + 10, 46, 20, Phaser.Display.Color.HexStringToColor(badgeColor).color, 0.9)
                .setOrigin(0.5, 0).setStrokeStyle(1, badgeStroke, 0.8);
            const badgeText = this.scene.add.text(24, y + 10, rule.id === 101 ? 'NET' : `D${rule.period}`, {
                fontFamily: 'Courier New, monospace', fontSize: '11px', fontWeight: 'bold',
                color: rule.id === 101 ? '#e2c8ff' : isNew ? '#fffbeb' : '#cbd5e1',
            }).setOrigin(0.5, 0).setResolution(2);

            const headline = this.scene.add.text(58, y + 8, rule.text, {
                fontFamily: 'Courier New, monospace', fontSize: '15px', fontWeight: 'bold',
                color: isNew ? '#fcd34d' : '#f8fafc',
                wordWrap: { width: bodyW - 60 }, lineSpacing: 2,
            }).setOrigin(0, 0).setResolution(2);

            this._push(badgeBg, badgeText, headline);
            y += headline.height + 20;

            // ── Subsystem details ─────────────────────────────────────────────
            if (Array.isArray(rule.details) && rule.details.length > 0) {
                rule.details.forEach((detail) => {
                    const tagMatch = detail.match(/^\[([A-Z]+)\]\s*/);
                    const tag      = tagMatch ? tagMatch[1] : null;
                    const bodyStr  = tag ? detail.slice(tagMatch[0].length) : detail;
                    const tagColor = tag ? (TAG_COLORS[tag] || '#94a3b8') : TAG_COLORS.NOTE;

                    let lineX = 10;

                    if (tag) {
                        const pillBg = this.scene.add.rectangle(lineX + 24, y + 5, 50, 17, 0x0f172a, 1)
                            .setOrigin(0.5, 0).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tagColor).color, 0.6);
                        const pillText = this.scene.add.text(lineX + 24, y + 5, tag, {
                            fontFamily: 'Courier New, monospace', fontSize: '11px', color: tagColor, fontWeight: 'bold',
                        }).setOrigin(0.5, 0).setResolution(2);
                        this._push(pillBg, pillText);
                        lineX += 56;
                    }

                    const bodyText = this.scene.add.text(lineX, y + 4, bodyStr, {
                        fontFamily: 'Courier New, monospace', fontSize: '13px', color: '#cbd5e1',
                        wordWrap: { width: bodyW - lineX }, lineSpacing: 3,
                    }).setOrigin(0, 0).setResolution(2);
                    this._push(bodyText);

                    y += Math.max(bodyText.height, 16) + 6;
                });

                y += 4;
            }
        });
        this._contentContainer.add(this._contentNodes);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _push(...nodes) {
        nodes.forEach((n) => this._contentNodes.push(n));
    }

    _addNote(text, y, contentW) {
        const t = this.scene.add.text(0, y, text, {
            fontFamily: 'Courier New', fontSize: '15px', color: '#506070',
            wordWrap: { width: contentW }, lineSpacing: 4,
        });
        this._push(t);
        return y + t.height + 12;
    }

    // ── Input handlers ────────────────────────────────────────────────────────

    _handleEscape() { if (this._visible) this.hide(); }

    _handleToggle() {
        if (!this._visible && this._callbacks.canToggle && !this._callbacks.canToggle()) return;
        this.toggle();
    }

    // ── Teardown ──────────────────────────────────────────────────────────────

    destroy() {
        this._escKey?.off('down', this._handleEscape);
        this._bKey?.off('down',   this._handleToggle);
        this._escKey?.destroy();
        this._bKey?.destroy();
        this._root?.destroy(true);
    }
}

import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

// ─── Layout ──────────────────────────────────────────────────────────────────
const DEPTH     = 430;
const CX        = 640;
const CY        = 360;
const PANEL_W   = 900;
const PANEL_H   = 520;
const HEADER_H  = 50;
const TAB_BAR_H = 38;

// Tag colors for details
const TAG_COLORS = {
    GRID: '#62e8a4',
    FLOW: '#62b4ff',
    GEAR: '#ffcc55',
    CODE: '#ff8fdb',
    NOTE: '#aaaaaa',
};

// ─────────────────────────────────────────────────────────────────────────────

export default class RulebookOverlay {
    constructor(scene, activeRuleIds, allRules, newRuleIds = [], callbacks = {}) {
        this.scene         = scene;
        this.activeRuleIds = Array.isArray(activeRuleIds) ? [...activeRuleIds] : [];
        this.allRules      = Array.isArray(allRules) ? allRules : [];
        this.newRuleIds    = new Set(Array.isArray(newRuleIds) ? newRuleIds : []);
        this._callbacks    = callbacks;
        this._visible      = false;
        this._contentNodes = [];
        this._selectedDay  = 1;

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

        // Backdrop
        this._backdrop = this.scene.add.rectangle(CX, CY, 1280, 720, 0x000000, 0.88)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => this.hide());

        // Panel shell
        this._panel = this.scene.add.container(CX, CY);

        const shadow = this.scene.add.rectangle(6, 8, PANEL_W + 16, PANEL_H + 16, 0x000000, 0.36);
        const shell  = this.scene.add.rectangle(0, 0, PANEL_W,      PANEL_H,      0x0e1419, 1)
            .setStrokeStyle(2, 0x3a4a55, 0.96);
        const inner  = this.scene.add.rectangle(0, 0, PANEL_W - 12, PANEL_H - 12, 0x111820, 1)
            .setStrokeStyle(1, 0x2a3840, 0.72);

        // ── Header bar ────────────────────────────────────────────────────────
        const headerY  = -(PANEL_H / 2) + HEADER_H / 2;
        const headerBg = this.scene.add.rectangle(0, headerY, PANEL_W, HEADER_H, 0x131d25, 1)
            .setStrokeStyle(1, 0x304050, 0.8);

        this._headerTitle = this.scene.add.text(-(PANEL_W / 2) + 24, headerY, 'RULEBOOK', {
            fontFamily: 'Courier New', fontSize: '17px', color: '#c8e8f4', letterSpacing: 4,
        }).setOrigin(0, 0.5);

        this._headerDay = this.scene.add.text(0, headerY, '', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#4e8fa0', letterSpacing: 2,
        }).setOrigin(0.5);

        // Close button
        const closeBg = this.scene.add.rectangle((PANEL_W / 2) - 40, headerY, 64, 30, 0x1c2a34, 1)
            .setStrokeStyle(1, 0x4a6070, 0.82).setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text((PANEL_W / 2) - 40, headerY, 'ESC', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#8ab4c4', letterSpacing: 2,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => { closeBg.setFillStyle(0x243644, 1); closeLabel.setColor('#c8e8f4'); });
        closeBg.on('pointerout',  () => { closeBg.setFillStyle(0x1c2a34, 1); closeLabel.setColor('#8ab4c4'); });
        closeBg.on('pointerdown', () => this.hide());

        // ── Tab bar ───────────────────────────────────────────────────────────
        const tabBarY  = -(PANEL_H / 2) + HEADER_H + TAB_BAR_H / 2;
        const tabBarBg = this.scene.add.rectangle(0, tabBarY, PANEL_W, TAB_BAR_H, 0x0d1318, 1);
        const tabBarSep = this.scene.add.rectangle(0, tabBarY + TAB_BAR_H / 2, PANEL_W, 1, 0x253038, 1);

        // Directive count (right side of tab bar)
        this._directiveCount = this.scene.add.text((PANEL_W / 2) - 20, tabBarY, '', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#4e6a7a', letterSpacing: 2,
        }).setOrigin(1, 0.5);

        // Day buttons container (left side of tab bar)
        this._dayButtonsContainer = this.scene.add.container(0, 0);
        this._dayButtons = [];

        // ── Content container ─────────────────────────────────────────────────
        const contentStartY = -(PANEL_H / 2) + HEADER_H + TAB_BAR_H + 18;
        this._contentContainer = this.scene.add.container(-(PANEL_W / 2) + 28, contentStartY);

        this._panel.add([
            shadow, shell, inner,
            headerBg,
            this._headerTitle, this._headerDay,
            closeBg, closeLabel,
            tabBarBg, tabBarSep,
            this._directiveCount,
            this._dayButtonsContainer,
            this._contentContainer,
        ]);

        this._root.add([this._backdrop, this._panel]);
    }

    // ── Build day tabs ────────────────────────────────────────────────────────

    _buildDayButtons() {
        this._dayButtons.forEach((btn) => btn.destroy(true));
        this._dayButtons = [];
        this._dayButtonsContainer.removeAll(true);

        const maxDay  = GameState.day;
        const tabBarY = -(PANEL_H / 2) + HEADER_H + TAB_BAR_H / 2;
        const tabW    = 40;
        const tabH    = 26;
        const gap     = 6;
        const startX  = -(PANEL_W / 2) + 20;

        this._dayButtonsContainer.setPosition(0, 0);

        for (let day = 1; day <= maxDay; day++) {
            const isSelected = day === this._selectedDay;
            const x = startX + (day - 1) * (tabW + gap) + tabW / 2;

            const bgColor   = isSelected ? 0x1e3040 : 0x0d1318;
            const stroke    = isSelected ? 0x3ea8c0 : 0x2a3840;
            const textColor = isSelected ? '#c8e8f4' : '#4e7080';

            const tabBg = this.scene.add.rectangle(x, tabBarY, tabW, tabH, bgColor, 1)
                .setOrigin(0.5).setStrokeStyle(1, stroke, 1)
                .setInteractive({ useHandCursor: true });

            const tabText = this.scene.add.text(x, tabBarY, `D${day}`, {
                fontFamily: 'Courier New', fontSize: '12px',
                color: textColor, letterSpacing: 1,
            }).setOrigin(0.5);

            tabBg.on('pointerover', () => {
                if (day !== this._selectedDay) {
                    tabBg.setFillStyle(0x162430, 1);
                    tabText.setColor('#8ab4c4');
                }
            });
            tabBg.on('pointerout', () => {
                if (day !== this._selectedDay) {
                    tabBg.setFillStyle(0x0d1318, 1);
                    tabText.setColor('#4e7080');
                }
            });
            tabBg.on('pointerdown', () => {
                this._selectedDay = day;
                this._buildDayButtons();
                this._refresh();
            });

            this._dayButtons.push(tabBg, tabText);
            this._dayButtonsContainer.add([tabBg, tabText]);
        }
    }

    // ── Content (rebuilt on every show/refresh) ───────────────────────────────

    _refresh() {
        this._contentNodes.forEach((n) => n.destroy());
        this._contentNodes = [];
        this._contentContainer.removeAll(false);

        this._buildDayButtons();
        this._headerDay.setText(`DAY ${this._selectedDay}  ·  ACTIVE DIRECTIVES`);

        const activeRules = this.allRules.filter((r) =>
            this.activeRuleIds.includes(r.id) && r.period === this._selectedDay
        );

        // Directive count in tab bar
        const count = activeRules.length;
        this._directiveCount.setText(`${count} DIRECTIVE${count !== 1 ? 'S' : ''}`);

        const contentW = PANEL_W - 56;
        let y = 0;

        if (activeRules.length === 0) {
            y = this._addNote('No directives loaded for this shift.', y, contentW);
        }

        activeRules.forEach((rule, idx) => {
            if (idx > 0) {
                const sep = this.scene.add.rectangle(contentW / 2, y + 8, contentW, 1, 0x1e2c38, 1).setOrigin(0.5, 0);
                this._push(sep);
                y += 22;
            }

            const isNew     = this.newRuleIds.has(rule.id);
            const isUmbrella = rule.id === 101;

            // ── Badge row ─────────────────────────────────────────────────────
            const BADGE_W = 36;
            const BADGE_H = 22;
            const NEW_W   = 44;
            const GAP     = 6;

            // Day / type badge
            const dBadgeColor  = isUmbrella ? 0x3d1f6e : isNew ? 0x3a2e08 : 0x0e2030;
            const dBadgeStroke = isUmbrella ? 0x9b6de8 : isNew ? 0xe6c060 : 0x3d7a8a;
            const dBadgeFg     = isUmbrella ? '#e2c8ff' : isNew ? '#f5d86a' : '#8fd4e8';
            const dBadgeLabel  = isUmbrella ? 'NET' : `D${rule.period}`;

            const dBg = this.scene.add.rectangle(BADGE_W / 2, y + BADGE_H / 2, BADGE_W, BADGE_H, dBadgeColor, 1)
                .setOrigin(0.5).setStrokeStyle(1, dBadgeStroke, 0.9);
            const dTx = this.scene.add.text(BADGE_W / 2, y + BADGE_H / 2, dBadgeLabel, {
                fontFamily: 'Courier New', fontSize: '11px', color: dBadgeFg, letterSpacing: 1,
            }).setOrigin(0.5);
            this._push(dBg, dTx);

            let textX = BADGE_W + GAP;

            // NEW badge
            if (isNew) {
                const nBg = this.scene.add.rectangle(textX + NEW_W / 2, y + BADGE_H / 2, NEW_W, BADGE_H, 0x3a2e08, 1)
                    .setOrigin(0.5).setStrokeStyle(1, 0xe6c060, 0.85);
                const nTx = this.scene.add.text(textX + NEW_W / 2, y + BADGE_H / 2, 'NEW', {
                    fontFamily: 'Courier New', fontSize: '11px', color: '#f5d86a', letterSpacing: 2,
                }).setOrigin(0.5);
                this._push(nBg, nTx);
                textX += NEW_W + GAP;
            }

            // ── Main rule text ────────────────────────────────────────────────
            const textColor = isUmbrella ? '#d4b8ff' : isNew ? '#f0d98a' : '#c8dce8';
            const ruleText  = this.scene.add.text(textX, y, rule.text, {
                fontFamily: 'Courier New', fontSize: '15px', color: textColor,
                wordWrap: { width: contentW - textX }, lineSpacing: 5,
            }).setOrigin(0, 0);
            this._push(ruleText);

            y += Math.max(BADGE_H, ruleText.height) + 14;

            // ── Details ───────────────────────────────────────────────────────
            if (Array.isArray(rule.details) && rule.details.length > 0) {
                rule.details.forEach((detail) => {
                    const tagMatch = detail.match(/^\[([A-Z]+)\]\s*/);
                    const tag      = tagMatch ? tagMatch[1] : null;
                    const body     = tag ? detail.slice(tagMatch[0].length) : detail;
                    const tagColor = tag ? (TAG_COLORS[tag] || '#aaaaaa') : TAG_COLORS.NOTE;

                    let lineX = 8;

                    if (tag) {
                        const pBg = this.scene.add.rectangle(lineX + 26, y + 4, 54, 19, 0x0e1a20, 1)
                            .setOrigin(0.5, 0).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tagColor).color, 0.7);
                        const pTx = this.scene.add.text(lineX + 26, y + 4, tag, {
                            fontFamily: 'Courier New', fontSize: '11px', color: tagColor, letterSpacing: 1,
                        }).setOrigin(0.5, 0);
                        this._push(pBg, pTx);
                        lineX += 62;
                    }

                    const bodyTx = this.scene.add.text(lineX, y + 3, body, {
                        fontFamily: 'Courier New', fontSize: '13px', color: '#6a8fa2',
                        wordWrap: { width: contentW - lineX }, lineSpacing: 4,
                    }).setOrigin(0, 0);
                    this._push(bodyTx);
                    y += Math.max(bodyTx.height, 18) + 10;
                });

                y += 4;
            }
        });

        this._contentContainer.add(this._contentNodes);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    _push(...nodes) { nodes.forEach((n) => this._contentNodes.push(n)); }

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

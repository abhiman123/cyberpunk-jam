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
    GRID:  '#62e8a4',
    FLOW:  '#62b4ff',
    GEAR:  '#ffcc55',
    CODE:  '#ff8fdb',
    NOTE:  '#aaaaaa',
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
        this._selectedDay   = 1;  // Track the currently selected day

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
        const headerBg = this.scene.add.rectangle(0, headerY, PANEL_W, headerH, 0x131d25, 1)
            .setStrokeStyle(1, 0x304050, 0.8);
        const accentLine = this.scene.add.rectangle(0, headerY + headerH / 2, PANEL_W, 1, 0x3ea8c0, 0.55);

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

        // ── Day buttons container (positioned relative to content) ────────────
        this._dayButtonsContainer = this.scene.add.container(0, 0);
        this._dayButtons = [];

        // ── Content container (rebuilt on every show/refresh) ─────────────────
        this._contentContainer = this.scene.add.container(-(PANEL_W / 2) + 28, headerY + headerH / 2 + 45);

        this._panel.add([
            shadow, shell, inner,
            headerBg, accentLine,
            this._headerTitle, this._headerDay,
            closeBg, closeLabel,
            this._contentContainer,
            this._dayButtonsContainer,
        ]);

        this._root.add([this._backdrop, this._panel]);
    }

    // ── Build day buttons ─────────────────────────────────────────────────────

    _buildDayButtons() {
        // Clear previous buttons
        this._dayButtons.forEach((btn) => btn.destroy(true));
        this._dayButtons = [];
        this._dayButtonsContainer.removeAll(true);

        const maxDay = GameState.day;  // Only show buttons up to current day
        const buttonW = 40;
        const buttonH = 32;
        const gap = 8;
        let x = 0;

        for (let day = 1; day <= maxDay; day++) {
            const isSelected = day === this._selectedDay;
            
            // Color based on day number for consistency with text coloring
            let btnColor, btnStroke, textColor;
            if (isSelected) {
                btnColor = 0x3ea8c0;
                btnStroke = 0x62e8a4;
                textColor = '#f0f8fc';
            } else {
                // Match the color progression used in the rule badges
                btnColor = 0x1c2a34;
                btnStroke = 0x4a6070;
                textColor = '#8ab4c4';
            }

            const btnBg = this.scene.add.rectangle(x + buttonW / 2, 0, buttonW, buttonH, 
                btnColor, 1)
                .setOrigin(0.5, 0).setStrokeStyle(1, btnStroke, 0.82)
                .setInteractive({ useHandCursor: true });

            const btnText = this.scene.add.text(x + buttonW / 2, buttonH / 2, `D${day}`, {
                fontFamily: 'Courier New', fontSize: '12px',
                color: textColor,
                letterSpacing: 1,
            }).setOrigin(0.5);

            // Hover effects
            btnBg.on('pointerover', () => {
                if (day !== this._selectedDay) {
                    btnBg.setFillStyle(0x243644, 1);
                    btnText.setColor('#c8e8f4');
                }
            });

            btnBg.on('pointerout', () => {
                if (day !== this._selectedDay) {
                    btnBg.setFillStyle(0x1c2a34, 1);
                    btnText.setColor('#8ab4c4');
                }
            });

            btnBg.on('pointerdown', () => {
                this._selectedDay = day;
                this._buildDayButtons();
                this._refresh();
            });

            this._dayButtons.push(btnBg);
            this._dayButtons.push(btnText);
            this._dayButtonsContainer.add([btnBg, btnText]);

            x += buttonW + gap;
        }
    }

    // ── Content (rebuilt on every show/refresh) ───────────────────────────────

    _refresh() {
        // Destroy previous content
        this._contentNodes.forEach((n) => n.destroy());
        this._contentNodes = [];
        this._contentContainer.removeAll(false);

        // Build day buttons
        this._buildDayButtons();

        // Position day buttons right above the content (moved 8 pixels lower: +5 original +3 new)
        this._dayButtonsContainer.setPosition(-(PANEL_W / 2) + 28, -(PANEL_H / 2) + 50 + 45 - 50 + 8);

        // Update header day chip
        this._headerDay.setText(`DAY ${this._selectedDay}  ·  ACTIVE DIRECTIVES`);

        // Filter rules: only show rules that match the selected day AND are in activeRuleIds
        const activeRules = this.allRules.filter((r) => 
            this.activeRuleIds.includes(r.id) && r.period === this._selectedDay
        );
        const contentW    = PANEL_W - 48;  // available width inside container
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
            const badgeColor = rule.id === 101 ? '#7c4fc7' : isNew ? '#d4a841' : '#2a5a6a';
            const badgeStroke = rule.id === 101 ? 0x9b6de8 : isNew ? 0xe6c060 : 0x3d7a8a;
            const badgeBg = this.scene.add.rectangle(24, y + 10, 46, 22, Phaser.Display.Color.HexStringToColor(badgeColor).color, 0.9)
                .setOrigin(0.5, 0).setStrokeStyle(1, badgeStroke, 0.8);
            const badgeText = this.scene.add.text(24, y + 10, rule.id === 101 ? 'NET' : `D${rule.period}`, {
                fontFamily: 'Courier New', fontSize: '11px',
                color: rule.id === 101 ? '#e2c8ff' : isNew ? '#fff8d4' : '#8fd4e8',
                letterSpacing: 1,
            }).setOrigin(0.5, 0);

            const headline = this.scene.add.text(58, y + 10, rule.text, {
                fontFamily: 'Courier New', fontSize: '16px',
                color: isNew ? '#f0d98a' : '#c8dce8',
                wordWrap: { width: bodyW - 58 }, lineSpacing: 5,
            }).setOrigin(0, 0);

            this._push(badgeBg, badgeText, headline);
            y += headline.height + 28;

            // ── Subsystem details ─────────────────────────────────────────────
            if (Array.isArray(rule.details) && rule.details.length > 0) {
                rule.details.forEach((detail) => {
                    const tagMatch = detail.match(/^\[([A-Z]+)\]\s*/);
                    const tag      = tagMatch ? tagMatch[1] : null;
                    const bodyStr  = tag ? detail.slice(tagMatch[0].length) : detail;
                    const tagColor = tag ? (TAG_COLORS[tag] || '#aaaaaa') : TAG_COLORS.NOTE;

                    let lineX = 8;

                    if (tag) {
                        const pillBg = this.scene.add.rectangle(lineX + 24, y + 5, 54, 19, 0x0e1a20, 1)
                            .setOrigin(0.5, 0).setStrokeStyle(1, Phaser.Display.Color.HexStringToColor(tagColor).color, 0.7);
                        const pillText = this.scene.add.text(lineX + 24, y + 5, tag, {
                            fontFamily: 'Courier New', fontSize: '12px', color: tagColor, letterSpacing: 1,
                        }).setOrigin(0.5, 0);
                        this._push(pillBg, pillText);
                        lineX += 60;
                    }

                    const bodyText = this.scene.add.text(lineX, y + 4, bodyStr, {
                        fontFamily: 'Courier New', fontSize: '14px', color: '#9ab4c2',
                        wordWrap: { width: bodyW - lineX }, lineSpacing: 4,
                    }).setOrigin(0, 0);
                    this._push(bodyText);

                    y += Math.max(bodyText.height, 18) + 12;
                });

                y += 6;
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

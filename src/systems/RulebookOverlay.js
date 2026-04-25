import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

// ─── Layout constants ────────────────────────────────────────────────────────
const DEPTH        = 430;
const CX           = 640;
const CY           = 360;
const PANEL_W      = 1080;
const PANEL_H      = 640;
const HEADER_H     = 78;
const TAB_BAR_H    = 56;
const PANEL_PAD    = 22;
const CARD_GAP     = 18;

// Per-tab accent colors (lightly tinted strokes on the tab and the side card).
const TAB_DEFINITIONS = [
    { key: 'overview', label: 'OVERVIEW', color: 0x3ee3df, hex: '#3ee3df' },
    { key: 'grid',     label: 'GRID',     color: 0x6ce8a4, hex: '#6ce8a4' },
    { key: 'flow',     label: 'FLOW',     color: 0x6abdff, hex: '#6abdff' },
    { key: 'gear',     label: 'GEAR',     color: 0xf6a25a, hex: '#f6a25a' },
    { key: 'code',     label: 'CODE',     color: 0xe788d0, hex: '#e788d0' },
];

// ─── Static per-tab content ──────────────────────────────────────────────────
// Mirrors the mockup: each tab has a "field rules" header, a one-line subtitle,
// a HOW-TO-SOLVE paragraph, and three numbered SCRAP rules. The right-hand
// example panel is rendered separately by `_renderDiagram`.

const TAB_CONTENT = {
    overview: {
        cardHeader: 'OVERVIEW FIELD RULES',
        subline:    'REPAIR TEST // SCRAP ONLY WHEN THE RULE MATCHES',
        howToSolve: 'Open a repair panel, fix the visible fault, then accept only when the test clears.',
        scrapBlurb: 'Repair, test, then choose accept or scrap.',
        scrapRules: [
            'Impossible puzzle = scrap.',
            'Accept after all required repairs are clean.',
            'Scrap if the final test still fails.',
        ],
        diagramTitle: 'BASE LOOP EXAMPLE',
        diagramKind:  'baseLoop',
    },
    grid: {
        cardHeader: 'GRID FIELD RULES',
        subline:    'CHARGE CELLS // PIPS MUST EQUAL THE CELL TARGET',
        howToSolve: 'Place dominos so every charge cell is covered by a half whose pip count matches the cell target. Equality links must agree; not-equal links must differ.',
        scrapBlurb: 'Tile the open cells, satisfy every constraint, then judge.',
        scrapRules: [
            'No legal tiling possible = scrap.',
            'Charge target violated under best play = scrap.',
            'Equality / inequality link broken = scrap.',
        ],
        diagramTitle: 'GRID EXAMPLE',
        diagramKind:  'grid',
    },
    flow: {
        cardHeader: 'FLOW FIELD RULES',
        subline:    'SOURCES → OUTPUTS // CURRENT MUST CARRY ITS COLOUR',
        howToSolve: 'Rotate wire tiles to deliver power from each source to its matching output. Colour filters tint the current after the tile; wrong colour at the output fails the test.',
        scrapBlurb: 'Route every source to its output; respect colour filters.',
        scrapRules: [
            'Output starved of current = scrap.',
            'Colour mismatch at any output = scrap.',
            'Discharge wire reaches a live output = scrap.',
        ],
        diagramTitle: 'FLOW EXAMPLE',
        diagramKind:  'flow',
    },
    gear: {
        cardHeader: 'GEAR FIELD RULES',
        subline:    'AXLES MUST SPIN // TEETH MUST MESH',
        howToSolve: 'Drop loose gears into the empty slots so the input axle drives every output axle. Watch tooth size — gears only mesh with neighbours of compatible scale.',
        scrapBlurb: 'Build a clean drive train from input to every output.',
        scrapRules: [
            'Output axle does not spin = scrap.',
            'Cracked gear sits inside the chain = scrap.',
            'Output spins the wrong direction = scrap.',
        ],
        diagramTitle: 'GEAR EXAMPLE',
        diagramKind:  'gear',
    },
    code: {
        cardHeader: 'CODE FIELD RULES',
        subline:    'PATCH BUGS // OUTPUT MUST MATCH EXPECTED',
        howToSolve: 'Patch out crawling bugs in the source, then run the test. The console must print the expected output before you accept the unit.',
        scrapBlurb: 'Patch every bug, run the test, then judge by the output.',
        scrapRules: [
            'Output drifts after patching = scrap.',
            'Hazard line is unrepairable on the floor = scrap.',
            'Bugs respawn after every patch = scrap.',
        ],
        diagramTitle: 'CODE EXAMPLE',
        diagramKind:  'code',
    },
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
        this._selectedTab  = 'overview';
        this._dynamicNodes = [];
        this._tabButtons   = new Map();

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
        this.scene.tweens.add({ targets: this._backdrop, alpha: 0.92, duration: 160, ease: 'Quad.Out' });
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
        this._backdrop = this.scene.add.rectangle(CX, CY, 1280, 720, 0x000000, 0.92)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => this.hide());

        // Panel shell
        this._panel = this.scene.add.container(CX, CY);

        const shadow = this.scene.add.rectangle(8, 10, PANEL_W + 18, PANEL_H + 18, 0x000000, 0.42);
        const shell  = this.scene.add.rectangle(0, 0, PANEL_W,      PANEL_H,      0x081019, 1)
            .setStrokeStyle(2, 0x18454d, 0.95);
        const inner  = this.scene.add.rectangle(0, 0, PANEL_W - 12, PANEL_H - 12, 0x0a141d, 1)
            .setStrokeStyle(1, 0x123540, 0.85);

        // ── Header ────────────────────────────────────────────────────────────
        const headerY  = -(PANEL_H / 2) + HEADER_H / 2;
        const headerBg = this.scene.add.rectangle(0, headerY, PANEL_W - 12, HEADER_H, 0x09151c, 1);
        const headerSep = this.scene.add.rectangle(
            0, -(PANEL_H / 2) + HEADER_H,
            PANEL_W - 12, 1, 0x1a3d48, 1,
        );

        this._headerTitle = this.scene.add.text(
            -(PANEL_W / 2) + 36, headerY - 12, 'SHIFT RULEBOOK', {
                fontFamily: 'Courier New', fontSize: '24px', color: '#c8f3f6', letterSpacing: 8,
            }
        ).setOrigin(0, 0.5);

        this._headerSub = this.scene.add.text(
            -(PANEL_W / 2) + 38, headerY + 14,
            'HOW TO SOLVE  //  SCRAP RULES  //  LIVE EXAMPLE', {
                fontFamily: 'Courier New', fontSize: '11px', color: '#4a9aa6', letterSpacing: 4,
            }
        ).setOrigin(0, 0.5);

        // Close (X) button — top-right corner with chamfered look.
        const closeX = (PANEL_W / 2) - 36;
        const closeY = headerY;
        const closeBg = this.scene.add.rectangle(closeX, closeY, 38, 38, 0x0d2030, 1)
            .setStrokeStyle(1, 0x3ec0d0, 0.85)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(closeX, closeY, 'X', {
            fontFamily: 'Courier New', fontSize: '17px', color: '#c8f3f6', letterSpacing: 1,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => { closeBg.setFillStyle(0x153244, 1); closeBg.setStrokeStyle(1, 0x6cd0e0, 1); });
        closeBg.on('pointerout',  () => { closeBg.setFillStyle(0x0d2030, 1); closeBg.setStrokeStyle(1, 0x3ec0d0, 0.85); });
        closeBg.on('pointerdown', () => this.hide());

        // ── Tab bar ──────────────────────────────────────────────────────────
        const tabBarTop = -(PANEL_H / 2) + HEADER_H + 12;
        const tabBarY   = tabBarTop + TAB_BAR_H / 2;
        const tabsContainer = this.scene.add.container(0, 0);
        const tabW    = 178;
        const tabH    = 44;
        const tabGap  = 6;
        const tabRowW = TAB_DEFINITIONS.length * tabW + (TAB_DEFINITIONS.length - 1) * tabGap;
        const tabStart = -tabRowW / 2;

        TAB_DEFINITIONS.forEach((tab, idx) => {
            const x = tabStart + idx * (tabW + tabGap) + tabW / 2;

            const tabBg = this.scene.add.rectangle(x, tabBarY, tabW, tabH, 0x0a1a24, 1)
                .setStrokeStyle(1, tab.color, 0.55)
                .setInteractive({ useHandCursor: true });
            const tabLabel = this.scene.add.text(x, tabBarY, tab.label, {
                fontFamily: 'Courier New', fontSize: '15px', color: tab.hex, letterSpacing: 6,
            }).setOrigin(0.5);

            tabBg.on('pointerover', () => {
                if (this._selectedTab === tab.key) return;
                tabBg.setFillStyle(0x10293a, 1);
            });
            tabBg.on('pointerout', () => {
                if (this._selectedTab === tab.key) return;
                tabBg.setFillStyle(0x0a1a24, 1);
            });
            tabBg.on('pointerdown', () => {
                if (this._selectedTab === tab.key) return;
                this._selectedTab = tab.key;
                this._refresh();
            });

            tabsContainer.add([tabBg, tabLabel]);
            this._tabButtons.set(tab.key, { bg: tabBg, label: tabLabel, color: tab.color });
        });

        // ── Content container (cards rebuilt per refresh) ─────────────────────
        this._contentContainer = this.scene.add.container(0, 0);

        this._panel.add([
            shadow, shell, inner,
            headerBg, headerSep,
            this._headerTitle, this._headerSub,
            closeBg, closeLabel,
            tabsContainer,
            this._contentContainer,
        ]);

        this._root.add([this._backdrop, this._panel]);
    }

    // ── Refresh content (per tab change / show) ──────────────────────────────

    _refresh() {
        this._dynamicNodes.forEach((n) => n.destroy());
        this._dynamicNodes = [];
        this._contentContainer.removeAll(false);

        // Tab visual states.
        this._tabButtons.forEach((entry, key) => {
            const isSelected = key === this._selectedTab;
            entry.bg.setFillStyle(isSelected ? 0x0e2c3c : 0x0a1a24, 1);
            entry.bg.setStrokeStyle(isSelected ? 2 : 1, entry.color, isSelected ? 0.95 : 0.5);
            entry.label.setAlpha(isSelected ? 1 : 0.78);
        });

        const content = TAB_CONTENT[this._selectedTab] || TAB_CONTENT.overview;

        // Content area boundaries.
        const contentTop    = -(PANEL_H / 2) + HEADER_H + 12 + TAB_BAR_H + 18;
        const contentBottom = (PANEL_H / 2) - PANEL_PAD;
        const contentLeft   = -(PANEL_W / 2) + PANEL_PAD;
        const contentRight  = (PANEL_W / 2) - PANEL_PAD;
        const contentH      = contentBottom - contentTop;
        const contentW      = contentRight - contentLeft;

        // Shared field-rules header strip across the top of the content area.
        const cardHeaderH = 36;
        const cardHeaderBg = this.scene.add.rectangle(
            contentLeft, contentTop, 280, cardHeaderH, 0x0e2c3c, 1,
        ).setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.55);
        const cardHeaderLabel = this.scene.add.text(
            contentLeft + 18, contentTop + cardHeaderH / 2, content.cardHeader, {
                fontFamily: 'Courier New', fontSize: '13px', color: '#c8f3f6', letterSpacing: 5,
            }
        ).setOrigin(0, 0.5);
        this._dynamic(cardHeaderBg, cardHeaderLabel);

        // Subline (one-line note immediately under the header strip).
        const sublineY = contentTop + cardHeaderH + 8;
        const sublineBg = this.scene.add.rectangle(
            contentLeft, sublineY, contentW, 28, 0x0a1820, 1,
        ).setOrigin(0, 0).setStrokeStyle(1, 0x153a44, 0.65);
        const sublineLabel = this.scene.add.text(
            contentLeft + 16, sublineY + 14, content.subline, {
                fontFamily: 'Courier New', fontSize: '11px', color: '#5fa5b0', letterSpacing: 3,
            }
        ).setOrigin(0, 0.5);
        this._dynamic(sublineBg, sublineLabel);

        // Two-column area below the subline.
        const cardsTop  = sublineY + 28 + 12;
        const cardsH    = contentBottom - cardsTop;
        const leftCardW  = Math.floor(contentW * 0.42);
        const rightCardW = contentW - leftCardW - CARD_GAP;
        const leftCardX  = contentLeft;
        const rightCardX = contentLeft + leftCardW + CARD_GAP;

        this._renderRulesCard(content, leftCardX, cardsTop, leftCardW, cardsH);
        this._renderDiagramCard(content, rightCardX, cardsTop, rightCardW, cardsH);

        this._contentContainer.add(this._dynamicNodes);
    }

    // ── Left card: HOW TO SOLVE + SCRAP RULES (+ active directives on overview)

    _renderRulesCard(content, x, y, w, h) {
        const accent = this._currentAccentColor();
        const cardBg = this.scene.add.rectangle(x, y, w, h, 0x0a1820, 1)
            .setOrigin(0, 0).setStrokeStyle(1, accent, 0.55);
        this._dynamic(cardBg);

        const innerX = x + 22;
        const innerW = w - 44;
        let cursor = y + 22;

        // HOW TO SOLVE section
        const howHeader = this.scene.add.text(innerX, cursor, 'HOW TO SOLVE', {
            fontFamily: 'Courier New', fontSize: '13px', color: this._currentAccentHex(), letterSpacing: 4,
        }).setOrigin(0, 0);
        this._dynamic(howHeader);
        cursor += howHeader.height + 10;

        const howBody = this.scene.add.text(innerX, cursor, content.howToSolve, {
            fontFamily: 'Courier New', fontSize: '14px', color: '#c8e3ec',
            wordWrap: { width: innerW }, lineSpacing: 6,
        }).setOrigin(0, 0);
        this._dynamic(howBody);
        cursor += howBody.height + 18;

        // Divider
        const divider = this.scene.add.rectangle(innerX, cursor, innerW, 1, 0x153a44, 1).setOrigin(0, 0);
        this._dynamic(divider);
        cursor += 18;

        // SCRAP RULES section
        const scrapHeader = this.scene.add.text(innerX, cursor, 'SCRAP RULES', {
            fontFamily: 'Courier New', fontSize: '13px', color: this._currentAccentHex(), letterSpacing: 4,
        }).setOrigin(0, 0);
        this._dynamic(scrapHeader);
        cursor += scrapHeader.height + 8;

        const scrapBlurb = this.scene.add.text(innerX, cursor, content.scrapBlurb, {
            fontFamily: 'Courier New', fontSize: '12px', color: '#7ea7b3',
            wordWrap: { width: innerW }, lineSpacing: 4,
        }).setOrigin(0, 0);
        this._dynamic(scrapBlurb);
        cursor += scrapBlurb.height + 14;

        // Numbered scrap rule rows.
        content.scrapRules.forEach((rule, idx) => {
            const rowY = cursor;
            const numBoxSize = 26;
            const numBg = this.scene.add.rectangle(innerX, rowY, numBoxSize, numBoxSize, 0x0a1820, 1)
                .setOrigin(0, 0).setStrokeStyle(1, accent, 0.7);
            const numLabel = this.scene.add.text(
                innerX + numBoxSize / 2, rowY + numBoxSize / 2, String(idx + 1), {
                    fontFamily: 'Courier New', fontSize: '13px', color: this._currentAccentHex(), letterSpacing: 1,
                }
            ).setOrigin(0.5);

            const ruleText = this.scene.add.text(innerX + numBoxSize + 14, rowY + 1, rule, {
                fontFamily: 'Courier New', fontSize: '13px', color: '#c8e3ec',
                wordWrap: { width: innerW - numBoxSize - 14 }, lineSpacing: 4,
            }).setOrigin(0, 0);

            this._dynamic(numBg, numLabel, ruleText);
            cursor += Math.max(numBoxSize, ruleText.height) + 14;
        });

        // OVERVIEW tab: append the player's active directives below the static
        // scrap rules. The other tabs stay focused on mechanics.
        if (this._selectedTab === 'overview') {
            cursor += 6;
            const dirHeader = this.scene.add.text(innerX, cursor, 'ACTIVE DIRECTIVES', {
                fontFamily: 'Courier New', fontSize: '13px', color: this._currentAccentHex(), letterSpacing: 4,
            }).setOrigin(0, 0);
            this._dynamic(dirHeader);
            cursor += dirHeader.height + 8;

            const day = GameState.day || 1;
            const directives = this.allRules.filter((r) => (
                this.activeRuleIds.includes(r.id) && r.period === day
            ));

            if (directives.length === 0) {
                const none = this.scene.add.text(innerX, cursor, 'No live directives for this shift.', {
                    fontFamily: 'Courier New', fontSize: '12px', color: '#506a72',
                }).setOrigin(0, 0);
                this._dynamic(none);
                cursor += none.height + 6;
            } else {
                const cardBottomLimit = y + h - 18;
                directives.forEach((rule) => {
                    if (cursor + 16 > cardBottomLimit) return;
                    const isNew = this.newRuleIds.has(rule.id);
                    const bullet = this.scene.add.text(innerX, cursor, '•', {
                        fontFamily: 'Courier New', fontSize: '13px',
                        color: isNew ? '#f5d86a' : this._currentAccentHex(),
                    }).setOrigin(0, 0);
                    const text = this.scene.add.text(innerX + 14, cursor, rule.text, {
                        fontFamily: 'Courier New', fontSize: '12px',
                        color: isNew ? '#f0d98a' : '#c8e3ec',
                        wordWrap: { width: innerW - 14 }, lineSpacing: 3,
                    }).setOrigin(0, 0);
                    this._dynamic(bullet, text);
                    cursor += text.height + 8;
                });
            }
        }
    }

    // ── Right card: header strip + per-tab diagram ────────────────────────────

    _renderDiagramCard(content, x, y, w, h) {
        const accent = this._currentAccentColor();
        const cardBg = this.scene.add.rectangle(x, y, w, h, 0x0a1820, 1)
            .setOrigin(0, 0).setStrokeStyle(1, accent, 0.55);
        this._dynamic(cardBg);

        // Title strip (e.g. "BASE LOOP EXAMPLE") with a non-interactive
        // "DRAG" tag on the right. We deliberately do NOT make anything
        // draggable — the tag is purely decorative chrome that mimics the
        // mockup. (User explicitly called out that diagram pieces should
        // not be draggable in the latest pass.)
        const titleY = y + 22;
        const title = this.scene.add.text(x + 22, titleY, content.diagramTitle, {
            fontFamily: 'Courier New', fontSize: '14px', color: this._currentAccentHex(), letterSpacing: 4,
        }).setOrigin(0, 0);
        const dragTagW = 78;
        const dragTagH = 26;
        const dragTagX = x + w - 22 - dragTagW;
        const dragTagBg = this.scene.add.rectangle(
            dragTagX, titleY - 4, dragTagW, dragTagH, 0x0e1f29, 1,
        ).setOrigin(0, 0).setStrokeStyle(1, accent, 0.55);
        const dragTagLabel = this.scene.add.text(
            dragTagX + dragTagW / 2, titleY - 4 + dragTagH / 2, 'EXAMPLE', {
                fontFamily: 'Courier New', fontSize: '11px', color: this._currentAccentHex(), letterSpacing: 3,
            }
        ).setOrigin(0.5);
        this._dynamic(title, dragTagBg, dragTagLabel);

        const diagramTop = titleY + 36;
        const diagramH   = (y + h) - diagramTop - 22;
        const diagramX   = x + 22;
        const diagramW   = w - 44;

        switch (content.diagramKind) {
            case 'baseLoop':
                this._drawBaseLoopDiagram(diagramX, diagramTop, diagramW, diagramH);
                break;
            case 'grid':
                this._drawGridDiagram(diagramX, diagramTop, diagramW, diagramH);
                break;
            case 'flow':
                this._drawFlowDiagram(diagramX, diagramTop, diagramW, diagramH);
                break;
            case 'gear':
                this._drawGearDiagram(diagramX, diagramTop, diagramW, diagramH);
                break;
            case 'code':
                this._drawCodeDiagram(diagramX, diagramTop, diagramW, diagramH);
                break;
            default:
                break;
        }
    }

    // ── Diagram primitives ───────────────────────────────────────────────────

    _drawBaseLoopDiagram(x, y, w, h) {
        // Tag strip at the top: REPAIR  -> TEST ->  DECIDE
        const tagY = y + 14;
        const repair = this.scene.add.text(x + w * 0.16, tagY, 'REPAIR', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#c8f3f6', letterSpacing: 4,
        }).setOrigin(0.5);
        const arrow1Bg = this.scene.add.rectangle(x + w * 0.42, tagY, 96, 26, 0x0e2c3c, 1)
            .setOrigin(0.5).setStrokeStyle(1, 0x3ec0d0, 0.7);
        const arrow1Tx = this.scene.add.text(x + w * 0.42, tagY, '-> TEST ->', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#c8f3f6', letterSpacing: 2,
        }).setOrigin(0.5);
        const decide = this.scene.add.text(x + w * 0.74, tagY, 'DECIDE', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#c8f3f6', letterSpacing: 4,
        }).setOrigin(0.5);
        this._dynamic(repair, arrow1Bg, arrow1Tx, decide);

        // Four flow boxes in a 2x2 layout.
        const boxesTop = y + 56;
        const boxesH   = h - 80;
        const boxW     = (w - 44) / 2;
        const boxH     = (boxesH - 24) / 2;

        const boxes = [
            { col: 0, row: 0, label: 'OPEN',   sub: 'PANEL',         color: 0x6ce8a4, hex: '#6ce8a4' },
            { col: 1, row: 0, label: 'FIX',    sub: 'FAULT',         color: 0x6abdff, hex: '#6abdff' },
            { col: 0, row: 1, label: 'CHECK',  sub: 'RULE',          color: 0xf6a25a, hex: '#f6a25a' },
            { col: 1, row: 1, label: 'DECIDE', sub: 'ACCEPT/SCRAP',  color: 0xe788d0, hex: '#e788d0' },
        ];

        // Connector lines first (drawn underneath the boxes).
        const gfx = this.scene.add.graphics();
        gfx.lineStyle(2, 0x3ec0d0, 0.7);
        // top row horizontal
        const topRowY = boxesTop + boxH / 2;
        const botRowY = boxesTop + boxH + 24 + boxH / 2;
        const col0X   = x + 22 + boxW / 2;
        const col1X   = x + 22 + boxW + 22 + boxW / 2;
        gfx.beginPath();
        gfx.moveTo(col0X + boxW / 2, topRowY);
        gfx.lineTo(col1X - boxW / 2, topRowY);
        gfx.strokePath();
        // right vertical
        gfx.beginPath();
        gfx.moveTo(col1X, topRowY + boxH / 2);
        gfx.lineTo(col1X, botRowY - boxH / 2);
        gfx.strokePath();
        // bottom row horizontal (right → left)
        gfx.beginPath();
        gfx.moveTo(col1X - boxW / 2, botRowY);
        gfx.lineTo(col0X + boxW / 2, botRowY);
        gfx.strokePath();
        // left vertical (bottom-left → top-left)
        gfx.beginPath();
        gfx.moveTo(col0X, botRowY - boxH / 2);
        gfx.lineTo(col0X, topRowY + boxH / 2);
        gfx.strokePath();
        this._dynamic(gfx);

        // Centre "BASE LOOP" pill on the right vertical connector (matches mockup).
        const pillW = 110;
        const pillH = 22;
        const pillX = (col0X + col1X) / 2;
        const pillY = (topRowY + botRowY) / 2;
        const pillBg = this.scene.add.rectangle(pillX, pillY, pillW, pillH, 0x081019, 1)
            .setStrokeStyle(1, 0x3ec0d0, 0.85);
        const pillLabel = this.scene.add.text(pillX, pillY, 'BASE LOOP', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#c8f3f6', letterSpacing: 3,
        }).setOrigin(0.5);
        this._dynamic(pillBg, pillLabel);

        // Boxes
        boxes.forEach((b) => {
            const bx = b.col === 0 ? col0X : col1X;
            const by = b.row === 0 ? topRowY : botRowY;
            const fill = 0x0a1820;
            const boxBg = this.scene.add.rectangle(bx, by, boxW, boxH, fill, 1)
                .setStrokeStyle(2, b.color, 0.95);
            const lab = this.scene.add.text(bx, by - 8, b.label, {
                fontFamily: 'Courier New', fontSize: '20px', color: b.hex, letterSpacing: 4,
            }).setOrigin(0.5);
            const sub = this.scene.add.text(bx, by + 16, b.sub, {
                fontFamily: 'Courier New', fontSize: '11px', color: '#7ea7b3', letterSpacing: 3,
            }).setOrigin(0.5);
            this._dynamic(boxBg, lab, sub);
        });
    }

    _drawGridDiagram(x, y, w, h) {
        // 4×4 grid silhouette with a couple of charge cells + a horizontal domino.
        const cellSize = Math.min(48, Math.floor((h - 40) / 4));
        const cols = 4;
        const rows = 4;
        const gridW = cols * cellSize;
        const gridH = rows * cellSize;
        const gridX = x + (w - gridW) / 2;
        const gridY = y + 20;

        const gfx = this.scene.add.graphics();
        gfx.lineStyle(1, 0x6ce8a4, 0.55);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                gfx.strokeRect(gridX + c * cellSize, gridY + r * cellSize, cellSize, cellSize);
            }
        }
        this._dynamic(gfx);

        // Charge cell (target = 3) at (1,1)
        const chargeR = 1, chargeC = 1;
        const chargePill = this.scene.add.rectangle(
            gridX + chargeC * cellSize + cellSize / 2,
            gridY + chargeR * cellSize + cellSize - 6,
            cellSize - 14, 14, 0x6ce8a4, 0.95,
        );
        const chargeLabel = this.scene.add.text(
            gridX + chargeC * cellSize + cellSize / 2,
            gridY + chargeR * cellSize + cellSize - 6,
            '3', {
                fontFamily: 'Courier New', fontSize: '11px', color: '#062a18', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(chargePill, chargeLabel);

        // Horizontal domino covering (1,1) and (1,2)
        const dominoX = gridX + chargeC * cellSize + 4;
        const dominoY = gridY + chargeR * cellSize + 4;
        const dominoBg = this.scene.add.rectangle(
            dominoX, dominoY, cellSize * 2 - 8, cellSize - 8, 0x113224, 0.85,
        ).setOrigin(0, 0).setStrokeStyle(2, 0x6ce8a4, 0.95);
        const dominoSplit = this.scene.add.rectangle(
            dominoX + cellSize - 4, dominoY + 4,
            1, cellSize - 16, 0x6ce8a4, 0.7,
        ).setOrigin(0, 0);
        const pipL = this.scene.add.text(
            dominoX + (cellSize - 4) / 2, dominoY + cellSize / 2 - 4, '3', {
                fontFamily: 'Courier New', fontSize: '13px', color: '#c8f6dc', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        const pipR = this.scene.add.text(
            dominoX + cellSize - 4 + (cellSize - 4) / 2, dominoY + cellSize / 2 - 4, '1', {
                fontFamily: 'Courier New', fontSize: '13px', color: '#c8f6dc', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(dominoBg, dominoSplit, pipL, pipR);

        // Caption
        const caption = this.scene.add.text(x + w / 2, gridY + gridH + 22,
            'Pip "3" half lands on the "3" cell — match.', {
                fontFamily: 'Courier New', fontSize: '12px', color: '#7eb09a', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(caption);
    }

    _drawFlowDiagram(x, y, w, h) {
        // Source dot → 3 wire tiles → output port. One filter tile in the middle.
        const tileSize = 56;
        const tileCount = 4;
        const totalW = tileCount * tileSize + (tileCount - 1) * 8;
        const startX = x + (w - totalW) / 2;
        const tileY  = y + h / 2 - tileSize / 2;

        // Source
        const src = this.scene.add.circle(startX - 18, tileY + tileSize / 2, 10, 0x6abdff, 1)
            .setStrokeStyle(1, 0x9bd3ff, 0.9);
        this._dynamic(src);

        for (let i = 0; i < tileCount; i++) {
            const tx = startX + i * (tileSize + 8);
            const tileBg = this.scene.add.rectangle(tx, tileY, tileSize, tileSize, 0x0e2034, 1)
                .setOrigin(0, 0).setStrokeStyle(1, 0x6abdff, 0.7);
            this._dynamic(tileBg);

            // Pipe drawn through the tile.
            const pgfx = this.scene.add.graphics();
            pgfx.lineStyle(4, 0x6abdff, 0.95);
            if (i === 2) {
                // filter tile: short orange overlay
                const fbg = this.scene.add.rectangle(tx + tileSize / 2, tileY + tileSize / 2, 26, 26, 0xf6a25a, 0.35)
                    .setStrokeStyle(1, 0xf6a25a, 0.9);
                this._dynamic(fbg);
            }
            pgfx.beginPath();
            pgfx.moveTo(tx, tileY + tileSize / 2);
            pgfx.lineTo(tx + tileSize, tileY + tileSize / 2);
            pgfx.strokePath();
            this._dynamic(pgfx);
        }

        // Output port
        const outX = startX + totalW + 18;
        const out = this.scene.add.rectangle(outX - 8, tileY + tileSize / 2 - 10, 16, 20, 0x0e2034, 1)
            .setOrigin(0, 0).setStrokeStyle(2, 0xf6a25a, 0.95);
        const outLabel = this.scene.add.text(outX + 18, tileY + tileSize / 2, 'OUT', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#f6a25a', letterSpacing: 3,
        }).setOrigin(0, 0.5);
        this._dynamic(out, outLabel);

        // Caption
        const caption = this.scene.add.text(x + w / 2, y + h - 22,
            'Filter recolours current → output expects orange.', {
                fontFamily: 'Courier New', fontSize: '12px', color: '#6abdff', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(caption);
    }

    _drawGearDiagram(x, y, w, h) {
        // Three gears in a row + IN axle on left, OUT axle on right.
        const cy = y + h / 2;
        const radii = [22, 28, 22];
        const gap = 12;
        const totalW = radii.reduce((s, r) => s + r * 2, 0) + gap * (radii.length - 1);
        let cursor = x + (w - totalW) / 2;

        // Input axle
        const inAxle = this.scene.add.circle(cursor - 22, cy, 6, 0xf6a25a, 1)
            .setStrokeStyle(1, 0xffd9a6, 0.9);
        const inLabel = this.scene.add.text(cursor - 22, cy + 26, 'IN', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#f6a25a', letterSpacing: 2,
        }).setOrigin(0.5);
        this._dynamic(inAxle, inLabel);

        radii.forEach((r, idx) => {
            const gx = cursor + r;
            const teeth = 10 + idx * 2;
            const gfx = this.scene.add.graphics();
            // Teeth ring
            gfx.lineStyle(1, 0xf6a25a, 0.95);
            gfx.strokeCircle(gx, cy, r);
            gfx.strokeCircle(gx, cy, r - 4);
            // Spokes
            const angleStep = (Math.PI * 2) / teeth;
            for (let i = 0; i < teeth; i++) {
                const a1 = i * angleStep;
                const x1 = gx + Math.cos(a1) * (r - 4);
                const y1 = cy + Math.sin(a1) * (r - 4);
                const x2 = gx + Math.cos(a1) * r;
                const y2 = cy + Math.sin(a1) * r;
                gfx.beginPath();
                gfx.moveTo(x1, y1);
                gfx.lineTo(x2, y2);
                gfx.strokePath();
            }
            // Hub
            gfx.fillStyle(0xf6a25a, 1);
            gfx.fillCircle(gx, cy, 4);
            this._dynamic(gfx);

            cursor += r * 2 + gap;
        });

        cursor -= gap;
        // Output axle
        const outAxle = this.scene.add.circle(cursor + 18, cy, 6, 0x6ce8a4, 1)
            .setStrokeStyle(1, 0xc4f3d2, 0.9);
        const outLabel = this.scene.add.text(cursor + 18, cy + 26, 'OUT', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#6ce8a4', letterSpacing: 2,
        }).setOrigin(0.5);
        this._dynamic(outAxle, outLabel);

        // Caption
        const caption = this.scene.add.text(x + w / 2, y + h - 22,
            'IN drives middle gear; teeth mesh to OUT axle.', {
                fontFamily: 'Courier New', fontSize: '12px', color: '#f6a25a', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(caption);
    }

    _drawCodeDiagram(x, y, w, h) {
        // Mock terminal panel showing > python check, expected vs actual.
        const termX = x + 14;
        const termY = y + 14;
        const termW = w - 28;
        const termH = h - 56;
        const term = this.scene.add.rectangle(termX, termY, termW, termH, 0x0a0e16, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0xe788d0, 0.7);
        const headerStrip = this.scene.add.rectangle(termX, termY, termW, 22, 0x150e1a, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0xe788d0, 0.4);
        const headerLabel = this.scene.add.text(termX + 10, termY + 11, 'CONSOLE > PATCH+TEST', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#e788d0', letterSpacing: 3,
        }).setOrigin(0, 0.5);
        this._dynamic(term, headerStrip, headerLabel);

        const lines = [
            { color: '#7e93b3', text: '$ run diagnostic.py' },
            { color: '#9bd3ff', text: 'expected: 0xC0FFEE' },
            { color: '#f6a25a', text: 'actual:   0xC0FFEE   [MATCH]' },
            { color: '#6ce8a4', text: '> accept' },
        ];
        let cy = termY + 36;
        lines.forEach((line) => {
            const t = this.scene.add.text(termX + 14, cy, line.text, {
                fontFamily: 'Courier New', fontSize: '12px', color: line.color, letterSpacing: 1,
            }).setOrigin(0, 0);
            this._dynamic(t);
            cy += t.height + 4;
        });

        const caption = this.scene.add.text(x + w / 2, y + h - 22,
            'Match the expected output before accepting.', {
                fontFamily: 'Courier New', fontSize: '12px', color: '#e788d0', letterSpacing: 1,
            }
        ).setOrigin(0.5);
        this._dynamic(caption);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _dynamic(...nodes) { nodes.forEach((n) => this._dynamicNodes.push(n)); }

    _currentAccentColor() {
        const tab = TAB_DEFINITIONS.find((t) => t.key === this._selectedTab) || TAB_DEFINITIONS[0];
        return tab.color;
    }

    _currentAccentHex() {
        const tab = TAB_DEFINITIONS.find((t) => t.key === this._selectedTab) || TAB_DEFINITIONS[0];
        return tab.hex;
    }

    // ── Input handlers ────────────────────────────────────────────────────────

    _handleEscape() { if (this._visible) this.hide(); }

    _handleToggle() {
        if (!this.scene.scene.isActive('Game')) return;
        this.toggle();
    }

    destroy() {
        this._escKey?.off('down', this._handleEscape);
        this._bKey?.off('down',   this._handleToggle);
        this._root?.destroy(true);
    }
}

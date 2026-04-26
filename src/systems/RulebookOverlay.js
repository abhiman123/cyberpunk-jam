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

// `howToSolve` and `scrapRules` items can be plain strings (always shown)
// or objects with a `minDay` field — those entries are only revealed once
// `GameState.day` reaches that day. This is how, e.g., the Flow colour
// rule appears starting on Day 2.

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
        howToSolve: [
            { text: 'Place dominos so every charge cell is covered by a half whose pip count matches the cell target.' },
            { text: 'Equality cells must hold matching pip counts; <N / >N cells must beat their threshold.', minDay: 2 },
            { text: 'Charge cells now also pair across rows — both halves of each pair carry constraints.', minDay: 3 },
        ],
        scrapBlurb: 'Tile the open cells, satisfy every constraint, then judge.',
        scrapRules: [
            { text: 'No legal tiling possible = scrap.' },
            { text: 'Charge target violated under best play = scrap.' },
            { text: 'Equality / threshold cell broken = scrap.', minDay: 2 },
        ],
        diagramTitle: 'GRID EXAMPLE',
        diagramKind:  'grid',
    },
    flow: {
        cardHeader: 'FLOW FIELD RULES',
        subline:    'SOURCES → OUTPUTS // ROUTE POWER TO EVERY LEAD',
        howToSolve: [
            { text: 'Rotate wire tiles to deliver power from the source to every output.' },
            { text: 'Colour filters tint the current after the tile — the output expects that colour.', minDay: 2 },
            { text: 'Multiple sources feed the grid; cross-routing is allowed but discharge wires kill outputs.', minDay: 3 },
        ],
        scrapBlurb: 'Route every source to its output, respect colour and discharge.',
        scrapRules: [
            { text: 'Output starved of current = scrap.' },
            { text: 'Colour mismatch at any output = scrap.', minDay: 2 },
            { text: 'Discharge wire reaches a live output = scrap.', minDay: 3 },
        ],
        diagramTitle: 'FLOW EXAMPLE',
        diagramKind:  'flow',
    },
    gear: {
        cardHeader: 'GEAR FIELD RULES',
        subline:    'AXLES MUST SPIN // TEETH MUST MESH',
        howToSolve: [
            { text: 'Drop loose gears into the empty slots so the input axle drives every output axle.' },
            { text: 'Watch tooth size — gears only mesh with neighbours of compatible scale.', minDay: 2 },
            { text: 'Reverse gears flip rotation — keep an even number between drive and load.', minDay: 3 },
        ],
        scrapBlurb: 'Build a clean drive train from input to every output.',
        scrapRules: [
            { text: 'Output axle does not spin = scrap.' },
            { text: 'Cracked gear sits inside the chain = scrap.' },
            { text: 'Output spins the wrong direction = scrap.', minDay: 3 },
        ],
        diagramTitle: 'GEAR EXAMPLE',
        diagramKind:  'gear',
    },
    code: {
        cardHeader: 'CODE FIELD RULES',
        subline:    'PATCH BUGS // OUTPUT MUST MATCH EXPECTED',
        howToSolve: [
            { text: 'Patch out crawling bugs in the source, then run the test.' },
            { text: 'The console must print the expected output before you accept the unit.' },
            { text: 'Bugs respawn faster on later shifts; corruptions can spawn from missed patches.', minDay: 2 },
        ],
        scrapBlurb: 'Patch every bug, run the test, then judge by the output.',
        scrapRules: [
            { text: 'Output drifts after patching = scrap.' },
            { text: 'Hazard line is unrepairable on the floor = scrap.', minDay: 2 },
            { text: 'Bugs respawn after every patch = scrap.', minDay: 3 },
        ],
        diagramTitle: 'CODE EXAMPLE',
        diagramKind:  'code',
    },
};

// Filter helper — accepts either a string or { text, minDay } object and
// resolves to an array of strings the player should see today.
function resolveDayContent(items, day) {
    if (!items) return [];
    const arr = Array.isArray(items) ? items : [items];
    return arr
        .filter((it) => typeof it === 'string' || (it.minDay ?? 1) <= day)
        .map((it) => (typeof it === 'string' ? it : it.text));
}

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

        const day = GameState.day || 1;
        const howLines = resolveDayContent(content.howToSolve, day);
        const howText  = howLines.length ? howLines.join('\n\n') : '';
        const howBody = this.scene.add.text(innerX, cursor, howText, {
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
        const scrapLines = resolveDayContent(content.scrapRules, day);
        scrapLines.forEach((rule, idx) => {
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
        // Brown "PHONOGRAPH GRID" backdrop matching the actual Pips puzzle:
        // brown card, scattered open cells, comparator pills (>N / <N) on top
        // cells, an equality-bar covering two cells, and a tray of NYT-style
        // green dominos beneath.
        const brownBg = this.scene.add.rectangle(x, y, w, h, 0x2c1a14, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x6a3f2c, 0.85);
        this._dynamic(brownBg);

        // Inner card (the actual board area).
        const boardW = w - 24;
        const boardH = Math.floor(h * 0.55);
        const boardX = x + 12;
        const boardY = y + 14;
        const board = this.scene.add.rectangle(boardX, boardY, boardW, boardH, 0x3a241c, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x8a553c, 0.85);
        this._dynamic(board);

        // Cell layout — a 4-wide × 3-tall grid with some empty spots for "shape".
        const cell = 36;
        const gridCols = 4;
        const gridRows = 3;
        const gridW = gridCols * cell;
        const gridH = gridRows * cell;
        const gridX = boardX + (boardW - gridW) / 2;
        const gridY = boardY + (boardH - gridH) / 2;

        // Open cell grid: 1 = open, 0 = hidden. Mimics the screenshot layout.
        const layout = [
            [1, 0, 1, 0],
            [0, 0, 1, 1],
            [1, 0, 0, 0],
        ];

        for (let r = 0; r < gridRows; r++) {
            for (let c = 0; c < gridCols; c++) {
                if (!layout[r][c]) continue;
                const cellRect = this.scene.add.rectangle(
                    gridX + c * cell + 2, gridY + r * cell + 2,
                    cell - 4, cell - 4, 0x1c100c, 0.95,
                ).setOrigin(0, 0).setStrokeStyle(1, 0x6a3f2c, 0.85);
                this._dynamic(cellRect);
            }
        }

        // Comparator pill helper (rounded rect with > or < label).
        const drawComparator = (col, row, label, isLess) => {
            const cx = gridX + col * cell + cell / 2;
            const cy = gridY + row * cell + cell / 2;
            // Draw a darker fill on the cell background to indicate comparator
            const fill = isLess ? 0x183444 : 0x2a1c4a;
            const stroke = isLess ? 0x4ad0e8 : 0xb27aff;
            const cellOverlay = this.scene.add.rectangle(
                gridX + col * cell + 2, gridY + row * cell + 2,
                cell - 4, cell - 4, fill, 0.85,
            ).setOrigin(0, 0).setStrokeStyle(1, stroke, 0.85);
            // Rounded pill at the bottom of the cell with the comparator text.
            const pillBg = this.scene.add.rectangle(
                cx, cy + cell / 2 - 7, cell - 12, 14, fill, 0.95,
            ).setStrokeStyle(1, stroke, 0.95);
            const pillLabel = this.scene.add.text(cx, cy + cell / 2 - 7, label, {
                fontFamily: 'Courier New', fontSize: '11px',
                color: isLess ? '#c8f0fa' : '#e9d5ff', letterSpacing: 1,
            }).setOrigin(0.5);
            this._dynamic(cellOverlay, pillBg, pillLabel);
        };

        drawComparator(0, 0, '>2', false);
        drawComparator(2, 0, '>1', false);
        drawComparator(0, 2, '<1', true);

        // Equality bar covering (1,2) and (1,3) — yellow gold rod with `=`
        // glyph, matching the actual puzzle's equality link visual.
        const eqRow = 1;
        const eqColLeft = 2;
        const eqWidth = cell * 2 - 8;
        const eqHeight = cell - 16;
        const eqX = gridX + eqColLeft * cell + 4;
        const eqY = gridY + eqRow * cell + 8;

        // Two host cells already drawn; add gold/yellow tint over them.
        const eqLeftCell = this.scene.add.rectangle(
            gridX + eqColLeft * cell + 2, gridY + eqRow * cell + 2,
            cell - 4, cell - 4, 0x1d3441, 0.95,
        ).setOrigin(0, 0).setStrokeStyle(1, 0x4ad0e8, 0.85);
        const eqRightCell = this.scene.add.rectangle(
            gridX + (eqColLeft + 1) * cell + 2, gridY + eqRow * cell + 2,
            cell - 4, cell - 4, 0x1d3441, 0.95,
        ).setOrigin(0, 0).setStrokeStyle(1, 0x4ad0e8, 0.85);
        const rod = this.scene.add.rectangle(eqX, eqY + eqHeight / 2 - 3, eqWidth, 6, 0xf2c84b, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x8a6a25, 0.95);
        const eqGlyphBg = this.scene.add.circle(eqX + eqWidth / 2, eqY + eqHeight / 2, 9, 0x3a2410, 1)
            .setStrokeStyle(1, 0xf2c84b, 1);
        const eqGlyph = this.scene.add.text(eqX + eqWidth / 2, eqY + eqHeight / 2, '=', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#f2c84b', letterSpacing: 1,
        }).setOrigin(0.5);
        this._dynamic(eqLeftCell, eqRightCell, rod, eqGlyphBg, eqGlyph);

        // Domino tray below the board.
        const trayY = boardY + boardH + 10;
        const trayH = h - (trayY - y) - 12;
        const tray = this.scene.add.rectangle(x + 12, trayY, w - 24, trayH, 0x2c1a14, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0xc26d3c, 0.85);
        this._dynamic(tray);

        const dominoes = [
            [6, 4],
            [4, 4],
            [3, 0],
            [5, 5],
            [3, 3],
            [2, 0],
        ];

        const dominoW = 36;
        const dominoH = trayH - 16;
        const totalW = dominoes.length * dominoW + (dominoes.length - 1) * 6;
        const dominoStartX = x + (w - totalW) / 2;
        const dominoY = trayY + 8;

        dominoes.forEach((pair, idx) => {
            const dx = dominoStartX + idx * (dominoW + 6);
            const bg = this.scene.add.rectangle(dx, dominoY, dominoW, dominoH, 0x59c977, 1)
                .setOrigin(0, 0).setStrokeStyle(1, 0xffffff, 0.95);
            this._dynamic(bg);
            const split = this.scene.add.rectangle(
                dx + 3, dominoY + dominoH / 2 - 1,
                dominoW - 6, 1, 0x0c2418, 0.85,
            ).setOrigin(0, 0);
            this._dynamic(split);

            // Pip dots for each half.
            const drawPips = (count, halfTop) => {
                const halfX = dx + dominoW / 2;
                const halfY = halfTop + (dominoH / 2) / 2;
                const dot = (px, py) => {
                    const c = this.scene.add.circle(px, py, 2.5, 0xf2c84b, 1)
                        .setStrokeStyle(1, 0x8a6a25, 0.95);
                    this._dynamic(c);
                };
                const positions = {
                    1: [[0, 0]],
                    2: [[-5, -3], [5, 3]],
                    3: [[-5, -3], [0, 0], [5, 3]],
                    4: [[-5, -3], [5, -3], [-5, 3], [5, 3]],
                    5: [[-5, -3], [5, -3], [0, 0], [-5, 3], [5, 3]],
                    6: [[-5, -4], [5, -4], [-5, 0], [5, 0], [-5, 4], [5, 4]],
                };
                const pos = positions[count] || [];
                pos.forEach(([dx2, dy2]) => dot(halfX + dx2, halfY + dy2));
            };
            drawPips(pair[0], dominoY);
            drawPips(pair[1], dominoY + dominoH / 2);
        });
    }

    _drawFlowDiagram(x, y, w, h) {
        // Mimic the actual Circuit Diagnostic UI: dark green background, a
        // voltage HUD strip on top, an inventory column on the left, an
        // octagonal tile grid in the centre, and repair-target LEDs on the
        // right.
        const greenBg = this.scene.add.rectangle(x, y, w, h, 0x06161e, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x1a3d48, 0.9);
        this._dynamic(greenBg);

        // ── Voltage HUD strip (top) ──────────────────────────────────────
        const hudY = y + 10;
        const hudH = 26;
        const hudPanel = (px, pw, label, value, valueHex) => {
            const bg = this.scene.add.rectangle(px, hudY, pw, hudH, 0x0a1820, 1)
                .setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.7);
            const lab = this.scene.add.text(px + pw / 2, hudY + 6, label, {
                fontFamily: 'Courier New', fontSize: '8px', color: '#7eb09a', letterSpacing: 2,
            }).setOrigin(0.5, 0);
            const val = this.scene.add.text(px + pw / 2, hudY + 16, value, {
                fontFamily: 'Courier New', fontSize: '11px', color: valueHex, letterSpacing: 1,
            }).setOrigin(0.5, 0);
            this._dynamic(bg, lab, val);
        };
        const hudLeftX = x + 12;
        const hudW = 72;
        hudPanel(hudLeftX, hudW, 'ACTUAL POWER', '1 / 3', '#6ce8a4');

        // Segmented bar between the panels
        const segX = hudLeftX + hudW + 6;
        const segW = w - hudW * 2 - 36;
        const segBg = this.scene.add.rectangle(segX, hudY + 4, segW, hudH - 8, 0x0e2034, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.6);
        this._dynamic(segBg);
        const segCount = 8;
        const segGap = 2;
        const segCell = (segW - 6 - segGap * (segCount - 1)) / segCount;
        for (let i = 0; i < segCount; i++) {
            const filled = i < 3;
            const sx = segX + 3 + i * (segCell + segGap);
            const seg = this.scene.add.rectangle(sx, hudY + 7, segCell, hudH - 14,
                filled ? 0x6ce8a4 : 0x123540, 1).setOrigin(0, 0);
            this._dynamic(seg);
        }

        hudPanel(segX + segW + 6, hudW, 'TARGET POWER', '3', '#f2c84b');

        // ── Main play area ──────────────────────────────────────────────
        const playTop = hudY + hudH + 12;
        const playH = h - (playTop - y) - 14;

        // Inventory column (left)
        const invW = 60;
        const inv = this.scene.add.rectangle(x + 10, playTop, invW, playH, 0x0a1820, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.65);
        const invLabel = this.scene.add.text(x + 10 + invW / 2, playTop + 8, 'INVENTORY', {
            fontFamily: 'Courier New', fontSize: '8px', color: '#3ec0d0', letterSpacing: 1,
        }).setOrigin(0.5, 0);
        this._dynamic(inv, invLabel);

        const invShapes = ['STRAIGHT', 'CURVE', 'TEE', 'CROSS'];
        const slotH = (playH - 24) / invShapes.length;
        invShapes.forEach((shape, idx) => {
            const sy = playTop + 22 + idx * slotH;
            const slot = this.scene.add.rectangle(
                x + 10 + 8, sy + 4, invW - 16, slotH - 8, 0x0e2034, 1,
            ).setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.55);
            // Pipe glyph
            const cx = x + 10 + invW / 2;
            const cy = sy + 4 + (slotH - 8) / 2 - 4;
            const gfx = this.scene.add.graphics();
            gfx.lineStyle(3, 0x6abdff, 0.95);
            if (shape === 'STRAIGHT') {
                gfx.beginPath(); gfx.moveTo(cx, cy - 12); gfx.lineTo(cx, cy + 12); gfx.strokePath();
            } else if (shape === 'CURVE') {
                gfx.beginPath(); gfx.moveTo(cx, cy + 12); gfx.lineTo(cx, cy); gfx.lineTo(cx + 12, cy); gfx.strokePath();
            } else if (shape === 'TEE') {
                gfx.beginPath(); gfx.moveTo(cx - 12, cy); gfx.lineTo(cx + 12, cy); gfx.strokePath();
                gfx.beginPath(); gfx.moveTo(cx, cy); gfx.lineTo(cx, cy + 12); gfx.strokePath();
            } else if (shape === 'CROSS') {
                gfx.beginPath(); gfx.moveTo(cx - 12, cy); gfx.lineTo(cx + 12, cy); gfx.strokePath();
                gfx.beginPath(); gfx.moveTo(cx, cy - 12); gfx.lineTo(cx, cy + 12); gfx.strokePath();
            }
            const lab = this.scene.add.text(cx, sy + slotH - 12, shape, {
                fontFamily: 'Courier New', fontSize: '8px', color: '#7eb09a', letterSpacing: 1,
            }).setOrigin(0.5);
            this._dynamic(slot, gfx, lab);
        });

        // Repair targets column (right)
        const targetsW = 60;
        const targetsX = x + w - targetsW - 10;
        const targets = this.scene.add.rectangle(targetsX, playTop, targetsW, playH, 0x0a1820, 1)
            .setOrigin(0, 0).setStrokeStyle(1, 0x3ec0d0, 0.65);
        const targetsLabel = this.scene.add.text(targetsX + targetsW / 2, playTop + 8, 'REPAIRS', {
            fontFamily: 'Courier New', fontSize: '8px', color: '#3ec0d0', letterSpacing: 1,
        }).setOrigin(0.5, 0);
        this._dynamic(targets, targetsLabel);

        const repairList = [
            { label: 'CPU', state: 'OK', color: '#6ce8a4' },
            { label: 'SENSOR', state: 'BROKEN', color: '#ff6b6b' },
            { label: 'RELAY', state: 'BROKEN', color: '#ff6b6b' },
        ];
        const rowH = (playH - 24) / repairList.length;
        repairList.forEach((r, idx) => {
            const ry = playTop + 22 + idx * rowH;
            const led = this.scene.add.circle(targetsX + 12, ry + rowH / 2 - 4, 4,
                r.state === 'OK' ? 0x6ce8a4 : 0x422020, 1).setStrokeStyle(1, 0x3ec0d0, 0.85);
            const lab = this.scene.add.text(targetsX + 22, ry + rowH / 2 - 9, r.label, {
                fontFamily: 'Courier New', fontSize: '9px', color: '#c8e3ec', letterSpacing: 1,
            }).setOrigin(0, 0);
            const st = this.scene.add.text(targetsX + 22, ry + rowH / 2 + 1, r.state, {
                fontFamily: 'Courier New', fontSize: '8px', color: r.color, letterSpacing: 1,
            }).setOrigin(0, 0);
            this._dynamic(led, lab, st);
        });

        // Octagonal tile grid in the centre.
        const gridX = x + 10 + invW + 14;
        const gridW = (targetsX - 10) - gridX;
        const cols = 4;
        const rows = 4;
        const tile = Math.min(Math.floor(gridW / cols), Math.floor((playH - 28) / rows));
        const realGridW = tile * cols;
        const realGridH = tile * rows;
        const gridStartX = gridX + (gridW - realGridW) / 2;
        const gridStartY = playTop + (playH - realGridH) / 2;

        const drawOctTile = (cx, cy, size) => {
            const gfx = this.scene.add.graphics();
            const r = (size - 4) / 2;
            const off = r * 0.4;
            const points = [
                [cx - r + off, cy - r], [cx + r - off, cy - r],
                [cx + r, cy - r + off], [cx + r, cy + r - off],
                [cx + r - off, cy + r], [cx - r + off, cy + r],
                [cx - r, cy + r - off], [cx - r, cy - r + off],
            ];
            gfx.fillStyle(0x0e2034, 0.95);
            gfx.lineStyle(1, 0x3ec0d0, 0.7);
            gfx.beginPath();
            gfx.moveTo(points[0][0], points[0][1]);
            for (let i = 1; i < points.length; i++) gfx.lineTo(points[i][0], points[i][1]);
            gfx.closePath();
            gfx.fillPath();
            gfx.strokePath();
            return gfx;
        };

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cx = gridStartX + c * tile + tile / 2;
                const cy = gridStartY + r * tile + tile / 2;
                this._dynamic(drawOctTile(cx, cy, tile));
            }
        }

        // Pipes drawn over the centre row connecting source → output.
        const pipeRow = 1;
        const pipeY = gridStartY + pipeRow * tile + tile / 2;
        const pgfx = this.scene.add.graphics();
        pgfx.lineStyle(4, 0x6ce8a4, 1);
        pgfx.beginPath();
        pgfx.moveTo(gridStartX, pipeY);
        pgfx.lineTo(gridStartX + tile * 2, pipeY);
        pgfx.strokePath();
        // Filter tile (Day 2+ visualisation)
        const filterX = gridStartX + tile * 2 + tile / 2;
        const filter = this.scene.add.rectangle(filterX - 10, pipeY - 10, 20, 20, 0xf6a25a, 0.5)
            .setOrigin(0, 0).setStrokeStyle(1, 0xf6a25a, 0.95);
        const pgfx2 = this.scene.add.graphics();
        pgfx2.lineStyle(4, 0xf6a25a, 1);
        pgfx2.beginPath();
        pgfx2.moveTo(gridStartX + tile * 2, pipeY);
        pgfx2.lineTo(gridStartX + realGridW, pipeY);
        pgfx2.strokePath();
        this._dynamic(pgfx, pgfx2, filter);

        // Power source on the left edge of pipe row.
        const pwr = this.scene.add.circle(gridStartX - 10, pipeY, 7, 0xf2c84b, 1)
            .setStrokeStyle(1, 0xfff0a8, 0.95);
        this._dynamic(pwr);
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

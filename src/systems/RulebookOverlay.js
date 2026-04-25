import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

const DEPTH = 50000;
const PANEL_W = 760;
const PANEL_H = 560;
const HEADER_H = 74;
const TAB_BAR_H = 44;
const VIEWPORT_MARGIN = 24;
const CONTENT_INSET = 18;
const SECTION_ORDER = ['overview', 'grid', 'flow', 'gear', 'code'];

const SECTION_INFO = Object.freeze({
    overview: { label: 'OVERVIEW', accent: 0x7ae7ff, text: '#d9fbff' },
    grid: { label: 'GRID', accent: 0x71ef93, text: '#d8ffe4' },
    flow: { label: 'FLOW', accent: 0x6fd8ff, text: '#dcf6ff' },
    gear: { label: 'GEAR', accent: 0xffc66f, text: '#fff2d9' },
    code: { label: 'CODE', accent: 0xff88c2, text: '#ffe1f1' },
});

const RULEBOOK_COPY = Object.freeze({
    1: {
        overview: {
            eyebrow: 'SHIFT RULE',
            rule: 'Repair clears. Scrap impossible.',
            caption: 'One call. One picture. No extra noise.',
        },
        grid: {
            eyebrow: 'GRID',
            rule: 'Boxed charge = scrap.',
            caption: 'If the live tile cannot ever breathe, scrap it.',
        },
        flow: {
            eyebrow: 'FLOW',
            rule: 'Broken lead = scrap.',
            caption: 'No first connection means no repair path.',
        },
        gear: {
            eyebrow: 'GEAR',
            rule: 'Cracked axle = scrap.',
            caption: 'A cracked input or output cannot be saved.',
        },
        code: {
            eyebrow: 'CODE',
            rule: 'Failed test = scrap.',
            caption: 'If the console stays wrong, the machine goes.',
        },
    },
    2: {
        overview: {
            eyebrow: 'SHIFT RULE',
            rule: 'Repair first. Check compliance.',
            caption: 'Same flow. More traps.',
        },
        grid: {
            eyebrow: 'GRID',
            rule: 'Broken mark = scrap.',
            caption: 'A damaged target is scrap even on a solvable board.',
        },
        flow: {
            eyebrow: 'FLOW',
            rule: 'Wrong color = scrap.',
            caption: 'If the sink glows wrong, it leaves the line.',
        },
        gear: {
            eyebrow: 'GEAR',
            rule: 'Virus gear = scrap. Rust is okay.',
            caption: 'Rusted gears are live parts now, not auto-scrap.',
        },
        code: {
            eyebrow: 'CODE',
            rule: 'Policy denied = scrap.',
            caption: 'The test may run clean and still fail policy.',
        },
        },
    3: {
        overview: {
            eyebrow: 'SHIFT RULE',
            rule: 'Hazard signal = scrap.',
            caption: 'Hazard checks override everything else.',
        },
        grid: {
            eyebrow: 'GRID',
            rule: 'Red corruption = scrap.',
            caption: 'Corruption beats every normal repair rule.',
        },
        flow: {
            eyebrow: 'FLOW',
            rule: 'Red current = scrap.',
            caption: 'Live hazard lines do not stay in rotation.',
        },
        gear: {
            eyebrow: 'GEAR',
            rule: 'Sparks or lockup = scrap.',
            caption: 'Covers can stop one slot. Rust or lockup is unsafe.',
        },
        code: {
            eyebrow: 'CODE',
            rule: 'Contaminated = scrap.',
            caption: 'The screen can look right and still be poisoned.',
        },
    },
    4: {
        overview: {
            eyebrow: 'SHIFT RULE',
            rule: 'Hazard signal = scrap.',
            caption: 'Final shift uses the hazard checks.',
        },
        grid: {
            eyebrow: 'GRID',
            rule: 'Red corruption = scrap.',
            caption: 'Corruption beats every normal repair rule.',
        },
        flow: {
            eyebrow: 'FLOW',
            rule: 'Red current = scrap.',
            caption: 'Live hazard lines do not stay in rotation.',
        },
        gear: {
            eyebrow: 'GEAR',
            rule: 'Sparks or lockup = scrap.',
            caption: 'Covers can stop one slot. Rust or lockup is unsafe.',
        },
        code: {
            eyebrow: 'CODE',
            rule: 'Contaminated = scrap.',
            caption: 'The screen can look right and still be poisoned.',
        },
    },
});

const RULEBOOK_GUIDES = Object.freeze({
    1: {
        overview: {
            solve: 'Open a repair panel, fix the visible fault, then accept only when the test clears.',
            scrap: 'Impossible fault.',
            rules: ['Impossible puzzle = scrap.', 'Accept after all required repairs are clean.', 'Scrap if the final test still fails.'],
            photo: 'BASE LOOP',
        },
        grid: {
            solve: 'Place legal tiles so every charge is satisfied.',
            scrap: 'Charge is boxed in.',
            rules: ['If a charge is boxed in by squares, scrap it.', 'If no legal placement can satisfy the board, scrap it.'],
            photo: 'BOXED CHARGE',
        },
        flow: {
            solve: 'Drag pipe pieces to connect IN to OUT.',
            scrap: 'Lead is snapped.',
            rules: ['Scrap if a snapped lead leaves no route.', 'Accept only when the route is continuous.'],
            photo: 'BROKEN LEAD',
        },
        gear: {
            solve: 'Build a clean gear train from motor to output.',
            scrap: 'Axle is cracked.',
            rules: ['Impossible puzzle = scrap.', 'Scrap cracked axles or boards that cannot mesh.', 'Accept only when the train spins.'],
            photo: 'CRACKED AXLE',
        },
        code: {
            solve: 'Run the command and patch until actual output matches expected.',
            scrap: 'Test still fails.',
            rules: ['Impossible puzzle = scrap.', 'Scrap if the test still fails after the available patch.', 'Accept only exact output matches.'],
            photo: 'FAILED TEST',
        },
    },
    2: {
        overview: {
            solve: 'Run the repair test first, then check compliance before accepting.',
            scrap: 'Bad compliance.',
            rules: ['Impossible puzzle = scrap.', 'Scrap if compliance reveals a broken mark, wrong output, virus gear, or denied policy.', 'Do not judge before the test reveals it.'],
            photo: 'POLICY FAIL',
        },
        grid: {
            solve: 'Solve readable marks first; cracked markers fail compliance.',
            scrap: 'Marker is broken.',
            rules: ['Impossible puzzle = scrap.', 'Scrap a broken marker after it is revealed.', 'Accept only if every charge resolves clean.'],
            photo: 'BROKEN MARK',
        },
        flow: {
            solve: 'Complete the route, then check the output color.',
            scrap: 'Wrong output color.',
            rules: ['Impossible puzzle = scrap.', 'Scrap if the finished output color is wrong.', 'Do not scrap before the flow reaches OUT.'],
            photo: 'WRONG COLOR',
        },
        gear: {
            solve: 'Use clean gears and complete the train.',
            scrap: 'Virus gear.',
            rules: ['Impossible puzzle = scrap.', 'Scrap when a virus gear is required or appears in the train.', 'Clean optional pieces are safe.'],
            photo: 'VIRUS GEAR',
        },
        code: {
            solve: 'Run the repair, then read the compliance result.',
            scrap: 'Policy denied.',
            rules: ['Impossible puzzle = scrap.', 'Scrap when policy denies the output.', 'Accept when repair and policy both pass.'],
            photo: 'POLICY DENIED',
        },
    },
    3: {
        overview: {
            solve: 'Solve enough to expose hidden hazards, then only keep safe repairs.',
            scrap: 'Any hazard.',
            rules: ['Impossible puzzle = scrap.', 'Day 3 hazards are revealed by testing.', 'Scrap red current, rust, sparks, lockups, or contaminated output.'],
            photo: 'HAZARD SIGNAL',
        },
        grid: {
            solve: 'Route power into a charge and watch its color.',
            scrap: 'Red corruption.',
            rules: ['Impossible puzzle = scrap.', 'If a powered charge turns red, scrap it.', 'Unpowered red ports do not count until energized.'],
            photo: 'RED CORRUPTION',
        },
        flow: {
            solve: 'Complete the route and watch for red current.',
            scrap: 'Red current.',
            rules: ['Impossible puzzle = scrap.', 'Scrap when the live route carries red current.', 'Unsafe current is revealed after connection.'],
            photo: 'RED CURRENT',
        },
        gear: {
            solve: 'Use gear covers to isolate danger, then test the train.',
            scrap: 'Rust, sparks, lockup.',
            rules: ['Impossible puzzle = scrap.', 'Scrap rusted gears, sparks, or lockups.', 'A cover is safe only when it prevents the fault.'],
            photo: 'SPARK HAZARD',
        },
        code: {
            solve: 'Run the output and watch for contaminated bugs.',
            scrap: 'Contaminated.',
            rules: ['Impossible puzzle = scrap.', 'Scrap if the revealed bug contaminates the output.', 'A normal crawling bug is only bad when the rule says scrap.'],
            photo: 'CONTAMINATED',
        },
    },
});

function clampDisplayDay(day) {
    return Phaser.Math.Clamp(day || 1, 1, 4);
}

function getPreviewDay(day) {
    return Math.min(clampDisplayDay(day), 3);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function colorToCss(color) {
    return `#${color.toString(16).padStart(6, '0')}`;
}

function getRulebookGuide(section, previewDay) {
    return RULEBOOK_GUIDES[previewDay]?.[section]
        || RULEBOOK_GUIDES[3]?.[section]
        || RULEBOOK_GUIDES[1].overview;
}

export class RulebookOverlay {
    constructor(scene, allRules, activeRuleIds, callbacks = {}) {
        this.scene = scene;
        this.allRules = Array.isArray(allRules) ? allRules : [];
        this.activeRuleIds = Array.isArray(activeRuleIds) ? activeRuleIds : [];
        this.callbacks = callbacks;

        this._visible = false;
        this._selectedSection = 'overview';
        this._selectedDay = clampDisplayDay(GameState.day);
        this._contentNodes = [];
        this._sectionButtons = [];
        this._scrollOffset = 0;
        this._scrollMax = 0;
        this._previewDragState = null;
        this._scrollDragState = null;

        this._build();
        this._bindSceneInput();
        this._refresh();
    }

    setRuleState(allRules, activeRuleIds, _newRuleIds = null) {
        this.allRules = Array.isArray(allRules) ? allRules : [];
        this.activeRuleIds = Array.isArray(activeRuleIds) ? activeRuleIds : [];
        if (this._visible) {
            this._refresh();
        }
    }

    isVisible() {
        return this._visible;
    }

    toggle() {
        if (this._visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    show() {
        if (this._visible) return;
        if (this.callbacks?.canToggle && this.callbacks.canToggle() === false) return;

        this._visible = true;
        this._selectedDay = clampDisplayDay(GameState.day);
        this._scrollOffset = 0;
        this._previewDragState = null;
        this._scrollDragState = null;
        this._refresh();

        this._root.setVisible(true);
        this._root.setAlpha(0);
        this.scene.tweens.killTweensOf(this._root);
        this.scene.tweens.add({
            targets: this._root,
            alpha: 1,
            duration: 150,
            ease: 'Quad.Out',
        });

        this.callbacks?.onOpen?.();
    }

    hide(immediate = false) {
        if (!this._visible && !immediate) return;
        this._visible = false;
        this._previewDragState = null;
        this._scrollDragState = null;
        this.scene.tweens.killTweensOf(this._root);

        if (immediate) {
            this._root.setAlpha(0);
            this._root.setVisible(false);
            this.callbacks?.onClose?.();
            return;
        }

        this.scene.tweens.add({
            targets: this._root,
            alpha: 0,
            duration: 120,
            ease: 'Quad.In',
            onComplete: () => {
                if (!this._visible) {
                    this._root.setVisible(false);
                }
            },
        });

        this.callbacks?.onClose?.();
    }

    destroy() {
        this._unbindSceneInput();
        this._contentMaskFilter?.destroy?.();
        this._contentMaskSource?.destroy();
        this._clearContent();
        this._root?.destroy(true);
        this._previewDragState = null;
        this._scrollDragState = null;
    }

    _build() {
        const camera = this.scene.cameras.main;
        const centerX = camera.centerX;
        const centerY = camera.centerY;

        this._panelX = centerX - (PANEL_W / 2);
        this._panelY = centerY - (PANEL_H / 2);
        this._viewportX = this._panelX + VIEWPORT_MARGIN;
        this._viewportY = this._panelY + HEADER_H + TAB_BAR_H + 10;
        this._viewportW = PANEL_W - (VIEWPORT_MARGIN * 2) - 18;
        this._viewportH = PANEL_H - HEADER_H - TAB_BAR_H - 34;
        this._viewportBounds = new Phaser.Geom.Rectangle(this._viewportX, this._viewportY, this._viewportW, this._viewportH);

        this._root = this.scene.add.container(0, 0)
            .setDepth(DEPTH)
            .setVisible(false)
            .setAlpha(0);

        this._backdrop = this.scene.add.rectangle(centerX, centerY, camera.width + 120, camera.height + 120, 0x041017, 0.8)
            .setInteractive();
        this._backdrop.on('pointerdown', () => this.hide());
        const panelBlocker = this.scene.add.rectangle(centerX, centerY, PANEL_W - 8, PANEL_H - 8, 0x000000, 0)
            .setInteractive();

        const shellShadow = this.scene.add.rectangle(centerX + 10, centerY + 16, PANEL_W + 22, PANEL_H + 26, 0x01060a, 0.42);
        const shell = this.scene.add.rectangle(centerX, centerY, PANEL_W, PANEL_H, 0x091218, 0.98)
            .setStrokeStyle(2, 0x2f5d68, 0.9);
        const inner = this.scene.add.rectangle(centerX, centerY + 2, PANEL_W - 18, PANEL_H - 18, 0x0f1e25, 0.98)
            .setStrokeStyle(1, 0x193744, 0.92);

        const headerBar = this.scene.add.rectangle(centerX, this._panelY + (HEADER_H / 2), PANEL_W - 18, HEADER_H - 12, 0x10252e, 1)
            .setStrokeStyle(1, 0x2a6270, 0.74);
        const tabBar = this.scene.add.rectangle(centerX, this._panelY + HEADER_H + (TAB_BAR_H / 2), PANEL_W - 18, TAB_BAR_H - 8, 0x0d171d, 1)
            .setStrokeStyle(1, 0x223c47, 0.74);
        const viewportFrame = this.scene.add.rectangle(
            this._viewportX + (this._viewportW / 2),
            this._viewportY + (this._viewportH / 2),
            this._viewportW,
            this._viewportH,
            0x091217,
            0.98,
        ).setStrokeStyle(1, 0x294854, 0.78);

        this._headerTitle = this.scene.add.text(this._panelX + 26, this._panelY + 20, 'SHIFT RULEBOOK', {
            fontFamily: 'Courier New',
            fontSize: '22px',
            color: '#effcff',
            letterSpacing: 3,
        }).setOrigin(0, 0);
        this._headerSubtitle = this.scene.add.text(this._panelX + 28, this._panelY + 48, 'OVERVIEW + SYSTEM TABS', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#8bcbd9',
            letterSpacing: 2,
        }).setOrigin(0, 0);

        const closeBg = this.scene.add.rectangle(this._panelX + PANEL_W - 34, this._panelY + 34, 34, 34, 0x1b2b34, 1)
            .setStrokeStyle(1, 0x8bdcff, 0.86)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(this._panelX + PANEL_W - 34, this._panelY + 34, 'X', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#f0fcff',
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x294654, 1));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0x1b2b34, 1));
        closeBg.on('pointerdown', () => this.hide());

        this._sectionButtonsContainer = this.scene.add.container(0, 0);
        this._contentContainer = this.scene.add.container(this._viewportX + CONTENT_INSET, this._viewportY + CONTENT_INSET);

        this._scrollX = this._viewportX + this._viewportW - 10;
        this._scrollTrack = this.scene.add.rectangle(this._scrollX, this._viewportY + 12, 8, this._viewportH - 24, 0x0e1a21, 1)
            .setOrigin(0.5, 0)
            .setStrokeStyle(1, 0x28424d, 0.68)
            .setInteractive({ useHandCursor: true });
        this._scrollThumb = this.scene.add.rectangle(this._scrollX, this._viewportY + 12, 8, 86, 0x89eaff, 0.92)
            .setOrigin(0.5, 0)
            .setStrokeStyle(1, 0xd9fbff, 0.66)
            .setInteractive({ useHandCursor: true })
            .setVisible(false);
        this._scrollTrack.on('pointerdown', (pointer) => this._beginScrollDrag(pointer, true));
        this._scrollThumb.on('pointerdown', (pointer) => this._beginScrollDrag(pointer, false));

        this._root.add([
            this._backdrop,
            panelBlocker,
            shellShadow,
            shell,
            inner,
            headerBar,
            tabBar,
            viewportFrame,
            this._headerTitle,
            this._headerSubtitle,
            closeBg,
            closeLabel,
            this._sectionButtonsContainer,
            this._contentContainer,
            this._scrollTrack,
            this._scrollThumb,
        ]);

        this._contentMaskSource = this.scene.make.graphics({
            x: this._viewportX,
            y: this._viewportY,
            add: false,
        });
        this._contentMaskSource.fillStyle(0xffffff, 1);
        this._contentMaskSource.fillRoundedRect(0, 0, this._viewportW, this._viewportH, 18);
        this._contentContainer.enableFilters();
        this._contentMaskFilter = this._contentContainer.filters.external.addMask(
            this._contentMaskSource,
            false,
            this.scene.cameras.main,
            'world',
        );
        this._contentMaskFilter.autoUpdate = false;
        this._contentMaskFilter.needsUpdate = true;

        this._buildSectionButtons();
    }

    _bindSceneInput() {
        this._wheelHandler = this._handleWheel.bind(this);
        this._pointerMoveHandler = this._handlePointerMove.bind(this);
        this._pointerUpHandler = this._handlePointerUp.bind(this);

        this.scene.input.on('wheel', this._wheelHandler);
        this.scene.input.on('pointermove', this._pointerMoveHandler);
        this.scene.input.on('pointerup', this._pointerUpHandler);
        this.scene.input.on('pointerupoutside', this._pointerUpHandler);
    }

    _unbindSceneInput() {
        if (this._wheelHandler) {
            this.scene.input.off('wheel', this._wheelHandler);
        }
        if (this._pointerMoveHandler) {
            this.scene.input.off('pointermove', this._pointerMoveHandler);
        }
        if (this._pointerUpHandler) {
            this.scene.input.off('pointerup', this._pointerUpHandler);
            this.scene.input.off('pointerupoutside', this._pointerUpHandler);
        }
    }

    _buildSectionButtons() {
        this._sectionButtonsContainer.removeAll(true);
        this._sectionButtons = [];

        const tabW = 118;
        const tabH = 30;
        const gap = 10;
        const totalWidth = (SECTION_ORDER.length * tabW) + ((SECTION_ORDER.length - 1) * gap);
        const startX = this._panelX + ((PANEL_W - totalWidth) / 2);
        const y = this._panelY + HEADER_H + (TAB_BAR_H / 2);

        SECTION_ORDER.forEach((section, index) => {
            const info = SECTION_INFO[section];
            const x = startX + (index * (tabW + gap)) + (tabW / 2);
            const bg = this.scene.add.rectangle(x, y, tabW, tabH, 0x101a20, 1)
                .setStrokeStyle(1, info.accent, 0.3)
                .setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(x, y, info.label, {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#88b7c4',
                letterSpacing: 2,
            }).setOrigin(0.5);

            bg.on('pointerover', () => {
                if (section === this._selectedSection) return;
                bg.setFillStyle(0x18252d, 1);
                label.setColor('#d9f8ff');
            });
            bg.on('pointerout', () => {
                if (section === this._selectedSection) return;
                bg.setFillStyle(0x101a20, 1);
                label.setColor('#88b7c4');
            });
            bg.on('pointerdown', () => {
                this._selectedSection = section;
                this._scrollOffset = 0;
                this._previewDragState = null;
                this._refresh();
            });

            this._sectionButtons.push({ section, bg, label, info });
            this._sectionButtonsContainer.add([bg, label]);
        });
    }

    _refreshSectionButtons() {
        this._sectionButtons.forEach(({ section, bg, label, info }) => {
            const selected = section === this._selectedSection;
            bg.setFillStyle(selected ? 0x132b35 : 0x101a20, 1);
            bg.setStrokeStyle(1, info.accent, selected ? 0.95 : 0.3);
            label.setColor(selected ? info.text : '#88b7c4');
        });
    }

    _clearContent() {
        this._contentNodes.forEach((node) => node.destroy(true));
        this._contentNodes = [];
        this._contentContainer.removeAll(false);
    }

    _addContentNode(node) {
        this._contentNodes.push(node);
        this._contentContainer.add(node);
        return node;
    }

    _refresh() {
        this._selectedDay = clampDisplayDay(GameState.day);
        if (!SECTION_ORDER.includes(this._selectedSection)) {
            this._selectedSection = 'overview';
        }

        this._refreshSectionButtons();
        this._clearContent();

        const sectionInfo = SECTION_INFO[this._selectedSection];
        const copy = RULEBOOK_COPY[this._selectedDay]?.[this._selectedSection] || RULEBOOK_COPY[1].overview;
        this._headerSubtitle.setText('HOW TO SOLVE // SCRAP RULES // LIVE EXAMPLE');

        const contentHeight = this._renderContent(copy, sectionInfo, getPreviewDay(this._selectedDay));
        this._scrollMax = Math.max(0, contentHeight - (this._viewportH - (CONTENT_INSET * 2)));
        this._setScrollOffset(this._scrollOffset, true);
    }

    _renderContent(copy, sectionInfo, previewDay) {
        const guide = getRulebookGuide(this._selectedSection, previewDay);
        const contentWidth = this._viewportW - 52;
        const leftWidth = 304;
        const columnGap = 22;
        const rightWidth = contentWidth - leftWidth - columnGap;
        let y = 0;

        const topBadge = this._addContentNode(this.scene.add.rectangle(122, 14, 244, 28, 0x102934, 1)
            .setStrokeStyle(1, sectionInfo.accent, 0.78));
        const topBadgeLabel = this._addContentNode(this.scene.add.text(122, 14, `${sectionInfo.label} FIELD RULES`, {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: sectionInfo.text,
            letterSpacing: 2,
        }).setOrigin(0.5));

        const topStrip = this._addContentNode(this.scene.add.rectangle((contentWidth / 2), 48, contentWidth, 34, 0x0d151a, 1)
            .setStrokeStyle(1, 0x264550, 0.72));
        const stripText = previewDay >= 3
            ? 'TEST TO REVEAL HIDDEN HAZARDS // THEN DECIDE'
            : (previewDay === 2 ? 'REPAIR TEST FIRST // COMPLIANCE CHECK SECOND' : 'REPAIR TEST // SCRAP ONLY WHEN THE RULE MATCHES');
        const topStripText = this._addContentNode(this.scene.add.text(18, 38, stripText, {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#b5dce5',
            letterSpacing: 1,
            wordWrap: { width: contentWidth - 36 },
        }).setOrigin(0, 0));

        y += 68;
        const columnTop = y;
        const previewHeight = 344;
        const ruleCardHeight = previewHeight;
        const ruleCard = this._addContentNode(this.scene.add.rectangle(leftWidth / 2, columnTop + (ruleCardHeight / 2), leftWidth, ruleCardHeight, 0x0e171d, 1)
            .setStrokeStyle(2, sectionInfo.accent, 0.72));
        const ruleLabel = this._addContentNode(this.scene.add.text(18, columnTop + 16, 'HOW TO SOLVE', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: colorToCss(sectionInfo.accent),
            letterSpacing: 2,
        }).setOrigin(0, 0));
        const solveText = this._addContentNode(this.scene.add.text(18, columnTop + 38, guide.solve, {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#effcff',
            wordWrap: { width: leftWidth - 36 },
            lineSpacing: 3,
        }).setOrigin(0, 0));

        const divider = this._addContentNode(this.scene.add.rectangle(leftWidth / 2, columnTop + 98, leftWidth - 32, 1, sectionInfo.accent, 0.38));
        const captionLabel = this._addContentNode(this.scene.add.text(18, columnTop + 114, 'SCRAP RULES', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#86c7d8',
            letterSpacing: 2,
        }).setOrigin(0, 0));

        const defaultRule = this._selectedSection === 'overview'
            ? 'Repair, test, then choose accept or scrap.'
            : 'If a puzzle is impossible, scrap it.';
        const genericRule = this._addContentNode(this.scene.add.text(18, columnTop + 138, defaultRule, {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#7c98a2',
            wordWrap: { width: leftWidth - 36 },
            lineSpacing: 2,
        }).setOrigin(0, 0));

        const rules = Array.isArray(guide.rules) && guide.rules.length > 0
            ? guide.rules
            : [guide.scrap || copy.caption].filter(Boolean);
        rules.slice(0, 3).forEach((rule, index) => {
            const ruleY = columnTop + 182 + (index * 48);
            const badge = this._addContentNode(this.scene.add.rectangle(35, ruleY + 8, 34, 20, 0x132832, 1)
                .setStrokeStyle(1, sectionInfo.accent, 0.62));
            const badgeText = this._addContentNode(this.scene.add.text(35, ruleY + 8, `${index + 1}`, {
                fontFamily: 'Courier New',
                fontSize: '10px',
                color: sectionInfo.text,
                letterSpacing: 1,
            }).setOrigin(0.5));
            const ruleText = this._addContentNode(this.scene.add.text(58, ruleY - 2, rule, {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#d0ecf3',
                wordWrap: { width: leftWidth - 80 },
                lineSpacing: 2,
            }).setOrigin(0, 0));
            return { badge, badgeText, ruleText };
        });

        this._createPreviewCard(leftWidth + columnGap, columnTop, rightWidth, previewHeight, sectionInfo, previewDay);

        y = columnTop + previewHeight + 18;

        const hint = this._addContentNode(this.scene.add.text(8, y, 'SCROLL // DRAG PHOTO // CLICK OUTSIDE TO CLOSE', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#6e93a0',
            letterSpacing: 1,
        }).setOrigin(0, 0));

        return y + hint.height + 6;
    }

    _createPreviewCard(x, y, width, height, sectionInfo, previewDay) {
        const frame = this._addContentNode(this.scene.add.rectangle(x + (width / 2), y + (height / 2), width, height, 0x091117, 1)
            .setStrokeStyle(2, sectionInfo.accent, 0.7));
        const inset = this._addContentNode(this.scene.add.rectangle(x + (width / 2), y + (height / 2), width - 20, height - 20, 0x101b21, 1)
            .setStrokeStyle(1, 0x223741, 0.86));
        const label = this._addContentNode(this.scene.add.text(x + 20, y + 14, this._selectedSection === 'overview' ? 'BASE LOOP EXAMPLE' : 'SCRAP EXAMPLE', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: sectionInfo.text,
            letterSpacing: 2,
        }).setOrigin(0, 0));
        const actionChip = this._addContentNode(this.scene.add.rectangle(x + width - 74, y + 18, 104, 20, 0x173038, 1)
            .setStrokeStyle(1, sectionInfo.accent, 0.52));
        const actionChipText = this._addContentNode(this.scene.add.text(x + width - 74, y + 18, previewDay >= 3 ? 'REVEAL' : 'DRAG', {
            fontFamily: 'Courier New',
            fontSize: '9px',
            color: '#e9fbff',
            letterSpacing: 1,
        }).setOrigin(0.5));

        const artArea = {
            x: x + 18,
            y: y + 34,
            width: width - 36,
            height: height - 52,
        };
        const previewStack = this._createDraggablePreviewStack(artArea, sectionInfo, previewDay);
        this._addContentNode(previewStack.container);

        return { frame, inset, label, actionChip, actionChipText, previewStack };
    }

    _createDraggablePreviewStack(area, sectionInfo, previewDay) {
        const centerX = area.x + (area.width / 2);
        const centerY = area.y + (area.height / 2) + 6;
        const previewSize = {
            width: Math.min(288, area.width - 92),
            height: Math.min(156, area.height - 108),
        };

        const container = this.scene.add.container(centerX, centerY);
        const outlineLayers = [];
        const offsets = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1],
        ];

        offsets.forEach(([dx, dy]) => {
            const ghost = this._buildPreviewArtLayer(sectionInfo, previewDay, previewSize, true);
            ghost.setPosition(dx, dy);
            ghost.setAlpha(0);
            outlineLayers.push(ghost);
            container.add(ghost);
        });

        const mainArt = this._buildPreviewArtLayer(sectionInfo, previewDay, previewSize, false);
        container.add(mainArt);

        const hitZone = this.scene.add.zone(0, 0, previewSize.width + 24, previewSize.height + 24)
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });
        container.add(hitZone);

        const bounds = {
            minX: area.x + 20 + (previewSize.width / 2),
            maxX: area.x + area.width - 20 - (previewSize.width / 2),
            minY: area.y + 14 + (previewSize.height / 2),
            maxY: area.y + area.height - 16 - (previewSize.height / 2),
        };

        const setOutlineVisible = (visible) => {
            outlineLayers.forEach((ghost) => ghost.setAlpha(visible ? 0.58 : 0));
        };

        hitZone.on('pointerover', () => {
            setOutlineVisible(true);
            container.setScale(1.02);
        });
        hitZone.on('pointerout', () => {
            if (this._previewDragState?.container === container) return;
            setOutlineVisible(false);
            container.setScale(1);
        });
        hitZone.on('pointerdown', (pointer) => {
            this._previewDragState = {
                container,
                bounds,
                setOutlineVisible,
                startX: pointer.x,
                startY: pointer.y,
                originX: container.x,
                originY: container.y,
            };
            pointer.event?.stopPropagation?.();
            setOutlineVisible(true);
            container.setScale(1.03);
        });

        return { container, bounds };
    }

    _buildPreviewArtLayer(sectionInfo, previewDay, size, monochrome = false) {
        const container = this.scene.add.container(0, 0);
        const accent = monochrome ? 0xffffff : sectionInfo.accent;
        const accentText = monochrome ? '#ffffff' : sectionInfo.text;
        const panel = monochrome ? 0xffffff : 0x121d24;
        const deepPanel = monochrome ? 0xffffff : 0x0c151b;
        const warm = monochrome ? 0xffffff : 0xffd98a;
        const hot = monochrome ? 0xffffff : 0xff8ca3;
        const rust = monochrome ? 0xffffff : 0xcc7b42;

        const shell = this.scene.add.graphics();
        shell.fillStyle(panel, monochrome ? 0.18 : 1);
        shell.fillRoundedRect(-(size.width / 2), -(size.height / 2), size.width, size.height, 24);
        shell.lineStyle(monochrome ? 2 : 3, accent, monochrome ? 0.78 : 0.9);
        shell.strokeRoundedRect(-(size.width / 2), -(size.height / 2), size.width, size.height, 24);
        container.add(shell);

        switch (this._selectedSection) {
        case 'grid':
            this._drawGridPreview(container, size, { accent, accentText, deepPanel, warm, hot, monochrome, previewDay });
            break;
        case 'flow':
            this._drawFlowPreview(container, size, { accent, accentText, deepPanel, warm, hot, monochrome, previewDay });
            break;
        case 'gear':
            this._drawGearPreview(container, size, { accent, accentText, deepPanel, warm, hot, rust, monochrome, previewDay });
            break;
        case 'code':
            this._drawCodePreview(container, size, { accent, accentText, deepPanel, warm, hot, monochrome, previewDay });
            break;
        default:
            this._drawOverviewPreview(container, size, { accent, accentText, deepPanel, warm, hot, monochrome });
            break;
        }

        if (!monochrome && previewDay >= 3 && this._selectedSection !== 'overview') {
            this._addRevealedFaultAnimation(container, size, sectionInfo);
        }

        const photoLabel = getRulebookGuide(this._selectedSection, previewDay).photo;
        const labelBg = this.scene.add.rectangle(0, (size.height / 2) - 22, Math.min(size.width - 72, 164), 24, monochrome ? 0xffffff : 0x111a20, monochrome ? 0.16 : 0.9)
            .setStrokeStyle(1, accent, monochrome ? 0.68 : 0.78);
        const labelText = this.scene.add.text(0, (size.height / 2) - 22, photoLabel, {
            fontFamily: 'Courier New',
            fontSize: '9px',
            color: accentText,
            align: 'center',
            letterSpacing: 1,
            wordWrap: { width: Math.min(size.width - 84, 152) },
        }).setOrigin(0.5);
        container.add([labelBg, labelText]);

        return container;
    }

    _addRevealedFaultAnimation(container, size, sectionInfo) {
        const targets = {
            grid: { x: 0, y: -18, w: 84, h: 52 },
            flow: { x: 74, y: -20, w: 84, h: 52 },
            gear: { x: 74, y: 2, w: 104, h: 50 },
            code: { x: 70, y: -20, w: 94, h: 52 },
        };
        const target = targets[this._selectedSection] || targets.grid;
        const hot = 0xff6f82;

        const scan = this.scene.add.rectangle(0, -(size.height / 2) + 36, size.width - 72, 3, sectionInfo.accent, 0.62);
        const ring = this.scene.add.ellipse(target.x, target.y, target.w, target.h, hot, 0.08)
            .setStrokeStyle(3, hot, 0.92);
        const chip = this.scene.add.rectangle(target.x, target.y - 38, 118, 22, 0x2b0710, 0.9)
            .setStrokeStyle(1, hot, 0.94);
        const chipText = this.scene.add.text(target.x, target.y - 38, 'REVEALED FAULT', {
            fontFamily: 'Courier New',
            fontSize: '8px',
            color: '#ffdce3',
            letterSpacing: 1,
        }).setOrigin(0.5);

        container.add([scan, ring, chip, chipText]);

        const scanTween = this.scene.tweens.add({
            targets: scan,
            y: (size.height / 2) - 54,
            alpha: { from: 0.18, to: 0.78 },
            duration: 980,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });
        const pulseTween = this.scene.tweens.add({
            targets: [ring, chip, chipText],
            alpha: { from: 0.48, to: 1 },
            scaleX: { from: 0.96, to: 1.04 },
            scaleY: { from: 0.96, to: 1.04 },
            duration: 540,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.InOut',
        });

        container.once('destroy', () => {
            scanTween.stop();
            pulseTween.stop();
        });
    }

    _drawOverviewPreview(container, size, palette) {
        const graphics = this.scene.add.graphics();
        graphics.fillStyle(palette.deepPanel, palette.monochrome ? 0.2 : 1);
        graphics.fillRoundedRect(-(size.width / 2) + 18, -(size.height / 2) + 20, size.width - 36, size.height - 40, 18);
        graphics.lineStyle(2, palette.accent, palette.monochrome ? 0.72 : 0.38);
        graphics.strokeRoundedRect(-(size.width / 2) + 18, -(size.height / 2) + 20, size.width - 36, size.height - 40, 18);

        const cards = [
            { x: -94, y: -34, label: 'OPEN', sub: 'PANEL', color: 0x71ef93 },
            { x: 88, y: -34, label: 'FIX', sub: 'FAULT', color: 0x6fd8ff },
            { x: -94, y: 48, label: 'CHECK', sub: 'RULE', color: 0xffc66f },
            { x: 88, y: 48, label: 'DECIDE', sub: 'ACCEPT/SCRAP', color: 0xff88c2 },
        ];
        cards.forEach((card) => {
            graphics.fillStyle(palette.monochrome ? 0xffffff : 0x13232b, palette.monochrome ? 0.16 : 1);
            graphics.fillRoundedRect(card.x - 62, card.y - 26, 124, 52, 14);
            graphics.lineStyle(2, palette.monochrome ? 0xffffff : card.color, palette.monochrome ? 0.72 : 0.84);
            graphics.strokeRoundedRect(card.x - 62, card.y - 26, 124, 52, 14);
        });

        const strip = this.scene.add.rectangle(0, -112, size.width - 94, 20, palette.monochrome ? 0xffffff : 0x17313b, palette.monochrome ? 0.16 : 1)
            .setStrokeStyle(1, palette.accent, palette.monochrome ? 0.72 : 0.5);
        const stripText = this.scene.add.text(0, -112, 'REPAIR -> TEST -> DECIDE', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: palette.accentText,
            letterSpacing: 2,
        }).setOrigin(0.5);
        container.add([graphics, strip, stripText]);

        cards.forEach((card) => {
            const label = this.scene.add.text(card.x, card.y - 8, card.label, {
                fontFamily: 'Courier New',
                fontSize: '13px',
                color: palette.monochrome ? '#ffffff' : colorToCss(card.color),
                letterSpacing: 1,
            }).setOrigin(0.5);
            const sub = this.scene.add.text(card.x, card.y + 10, card.sub, {
                fontFamily: 'Courier New',
                fontSize: '8px',
                color: palette.accentText,
                letterSpacing: 1,
            }).setOrigin(0.5);
            container.add([label, sub]);
        });
    }

    _drawGridPreview(container, size, palette) {
        const previewDay = palette.previewDay ?? 1;
        const graphics = this.scene.add.graphics();
        const boardX = -(size.width / 2) + 24;
        const boardY = -(size.height / 2) + 20;
        const cell = 21;
        const cols = 5;
        const rows = 5;

        graphics.fillStyle(palette.deepPanel, palette.monochrome ? 0.22 : 1);
        graphics.fillRoundedRect(boardX - 12, boardY - 12, (cell * cols) + 24, (cell * rows) + 24, 14);
        graphics.lineStyle(2, palette.accent, palette.monochrome ? 0.78 : 0.4);
        graphics.strokeRoundedRect(boardX - 12, boardY - 12, (cell * cols) + 24, (cell * rows) + 24, 14);

        for (let row = 0; row < rows; row += 1) {
            for (let col = 0; col < cols; col += 1) {
                const x = boardX + (col * cell);
                const y = boardY + (row * cell);
                const edgeCell = row === 0 || row === rows - 1 || col === 0 || col === cols - 1;
                graphics.fillStyle(edgeCell ? (palette.monochrome ? 0xffffff : 0x304852) : (palette.monochrome ? 0xffffff : 0x17282f), palette.monochrome ? (edgeCell ? 0.2 : 0.1) : 1);
                graphics.fillRect(x, y, cell - 3, cell - 3);
                graphics.lineStyle(1, palette.monochrome ? 0xffffff : 0x41616d, palette.monochrome ? 0.72 : 0.9);
                graphics.strokeRect(x, y, cell - 3, cell - 3);
            }
        }

        if (previewDay === 1) {
            [[2, 1], [1, 2], [3, 2], [2, 3]].forEach(([col, row]) => {
                const blockX = boardX + (col * cell);
                const blockY = boardY + (row * cell);
                graphics.fillStyle(palette.monochrome ? 0xffffff : 0x05090c, palette.monochrome ? 0.34 : 0.98);
                graphics.fillRect(blockX, blockY, cell - 3, cell - 3);
                graphics.lineStyle(2, palette.hot, palette.monochrome ? 0.72 : 0.84);
                graphics.strokeRect(blockX + 2, blockY + 2, cell - 7, cell - 7);
            });
        } else if (previewDay >= 3) {
            [[1, 1], [2, 2], [3, 2], [2, 3]].forEach(([col, row]) => {
                const x = boardX + (col * cell) + ((cell - 3) / 2);
                const y = boardY + (row * cell) + ((cell - 3) / 2);
                graphics.fillStyle(palette.hot, palette.monochrome ? 0.2 : 0.28);
                graphics.fillCircle(x, y, 15);
                graphics.lineStyle(2, palette.hot, palette.monochrome ? 0.74 : 0.82);
                graphics.strokeCircle(x, y, 17);
            });
        }

        const chargeX = boardX + (2 * cell) + ((cell - 3) / 2);
        const chargeY = boardY + (2 * cell) + ((cell - 3) / 2);
        const charge = this.scene.add.rectangle(chargeX, chargeY, 17, 17, palette.monochrome ? 0xffffff : (previewDay >= 3 ? palette.hot : 0xffcf66), palette.monochrome ? 0.24 : 1)
            .setStrokeStyle(2, palette.monochrome ? 0xffffff : 0xfff1bf, 0.92);
        const chargeText = this.scene.add.text(chargeX, chargeY, previewDay === 2 ? '#' : (previewDay >= 3 ? '!' : '3'), {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: palette.monochrome ? '#ffffff' : '#4b360e',
        }).setOrigin(0.5);

        const mark = this.scene.add.graphics();
        mark.lineStyle(3, palette.monochrome ? 0xffffff : 0xff7a72, 0.92);
        if (previewDay === 1) {
            mark.strokeRect(chargeX - 13, chargeY - 13, 26, 26);
            mark.lineBetween(chargeX - 26, chargeY, chargeX - 14, chargeY);
            mark.lineBetween(chargeX + 14, chargeY, chargeX + 26, chargeY);
        } else if (previewDay === 2) {
            mark.lineBetween(chargeX - 10, chargeY - 10, chargeX + 10, chargeY + 10);
            mark.lineBetween(chargeX + 10, chargeY - 10, chargeX - 10, chargeY + 10);
        } else {
            mark.strokeRect(chargeX - 13, chargeY - 13, 26, 26);
            mark.lineBetween(chargeX - 12, chargeY - 12, chargeX + 12, chargeY + 12);
            mark.lineBetween(chargeX + 12, chargeY - 12, chargeX - 12, chargeY + 12);
        }

        const calloutLeft = 30;
        const calloutTop = -56;
        const calloutW = 106;
        const calloutH = 96;
        const calloutCenterX = calloutLeft + (calloutW / 2);
        const calloutCenterY = calloutTop + (calloutH / 2);
        graphics.fillStyle(palette.monochrome ? 0xffffff : 0x101c22, palette.monochrome ? 0.16 : 1);
        graphics.fillRoundedRect(calloutLeft, calloutTop, calloutW, calloutH, 14);
        graphics.lineStyle(2, palette.hot, palette.monochrome ? 0.76 : 0.88);
        graphics.strokeRoundedRect(calloutLeft, calloutTop, calloutW, calloutH, 14);

        let calloutTextValue = '3';
        if (previewDay === 1) {
            const miniCell = 22;
            const miniLeft = calloutCenterX - (miniCell * 1.5);
            const miniTop = calloutCenterY - (miniCell * 1.5);
            for (let row = 0; row < 3; row += 1) {
                for (let col = 0; col < 3; col += 1) {
                    const x = miniLeft + (col * miniCell);
                    const y = miniTop + (row * miniCell);
                    const isBlock = (row === 1 && col !== 1) || (col === 1 && row !== 1);
                    graphics.fillStyle(isBlock ? (palette.monochrome ? 0xffffff : 0x05090c) : (palette.monochrome ? 0xffffff : 0x21343c), palette.monochrome ? (isBlock ? 0.34 : 0.12) : 1);
                    graphics.fillRect(x, y, miniCell - 3, miniCell - 3);
                }
            }
        } else if (previewDay === 2) {
            calloutTextValue = '#';
            graphics.fillStyle(palette.monochrome ? 0xffffff : 0xffcf66, palette.monochrome ? 0.2 : 1);
            graphics.fillRoundedRect(calloutCenterX - 24, calloutCenterY - 24, 48, 48, 8);
            graphics.lineStyle(3, palette.hot, palette.monochrome ? 0.84 : 0.96);
            graphics.lineBetween(calloutCenterX - 24, calloutCenterY - 12, calloutCenterX + 10, calloutCenterY + 22);
            graphics.lineBetween(calloutCenterX - 2, calloutCenterY - 24, calloutCenterX + 24, calloutCenterY + 2);
            graphics.fillStyle(palette.deepPanel, palette.monochrome ? 0.22 : 1);
            graphics.fillTriangle(calloutCenterX + 24, calloutCenterY - 24, calloutCenterX + 24, calloutCenterY - 4, calloutCenterX + 4, calloutCenterY - 24);
        } else {
            calloutTextValue = '!';
            graphics.fillStyle(palette.hot, palette.monochrome ? 0.24 : 0.3);
            graphics.fillCircle(calloutCenterX, calloutCenterY, 34);
            graphics.fillCircle(calloutCenterX - 24, calloutCenterY - 14, 18);
            graphics.fillCircle(calloutCenterX + 24, calloutCenterY + 10, 16);
            graphics.lineStyle(3, palette.hot, palette.monochrome ? 0.84 : 0.96);
            graphics.strokeCircle(calloutCenterX, calloutCenterY, 38);
        }

        const calloutText = this.scene.add.text(calloutCenterX, calloutCenterY, calloutTextValue, {
            fontFamily: 'Courier New',
            fontSize: previewDay === 1 ? '20px' : '30px',
            color: previewDay === 2 ? (palette.monochrome ? '#ffffff' : '#4b360e') : palette.accentText,
            align: 'center',
        }).setOrigin(0.5);

        container.add([graphics, charge, chargeText, mark, calloutText]);
    }

    _drawFlowPreview(container, size, palette) {
        const previewDay = palette.previewDay ?? 1;
        const graphics = this.scene.add.graphics();
        const left = -(size.width / 2) + 26;
        const top = -(size.height / 2) + 24;
        const panelW = size.width - 52;
        const panelH = size.height - 56;
        const pathColor = previewDay >= 3 ? palette.hot : palette.accent;
        const sourceX = left + 42;
        const sinkX = left + panelW - 42;
        const routeY = top + 54;
        const lowerY = top + 92;
        const elbowX = left + Math.floor(panelW / 2);
        const sinkLeadX = sinkX - 26;
        const overlayNodes = [];

        graphics.fillStyle(palette.deepPanel, palette.monochrome ? 0.2 : 1);
        graphics.fillRoundedRect(left, top, panelW, panelH, 18);
        graphics.lineStyle(2, palette.accent, palette.monochrome ? 0.72 : 0.36);
        graphics.strokeRoundedRect(left, top, panelW, panelH, 18);

        const source = this.scene.add.circle(sourceX, routeY, 18, palette.monochrome ? 0xffffff : 0x1b4a56, palette.monochrome ? 0.18 : 1)
            .setStrokeStyle(3, palette.accent, 0.92);
        const sink = this.scene.add.circle(sinkX, routeY, 18, palette.monochrome ? 0xffffff : (previewDay === 2 ? 0xe7a851 : (previewDay >= 3 ? 0xff7d95 : 0x244f5e)), palette.monochrome ? 0.18 : 1)
            .setStrokeStyle(3, previewDay === 2 ? palette.warm : pathColor, 0.92);

        graphics.lineStyle(8, pathColor, palette.monochrome ? 0.78 : 0.94);
        if (previewDay === 1) {
            const breakX = sourceX + 48;
            const deadWire = palette.monochrome ? 0xffffff : 0x566a72;
            graphics.lineBetween(sourceX + 24, routeY, breakX - 14, routeY);
            graphics.lineStyle(8, deadWire, palette.monochrome ? 0.22 : 0.24);
            graphics.lineBetween(breakX + 16, routeY, elbowX, routeY);
            graphics.lineBetween(elbowX, routeY, elbowX, lowerY);
            graphics.lineBetween(elbowX, lowerY, sinkLeadX, lowerY);
            graphics.lineBetween(sinkLeadX, lowerY, sinkLeadX, routeY);
            graphics.lineBetween(sinkLeadX, routeY, sinkX - 24, routeY);
            graphics.lineStyle(4, palette.hot, palette.monochrome ? 0.78 : 0.9);
            graphics.lineBetween(breakX - 10, routeY - 10, breakX + 12, routeY + 12);
            graphics.lineBetween(breakX + 12, routeY - 10, breakX - 10, routeY + 12);
        } else {
            graphics.lineBetween(sourceX + 24, routeY, elbowX, routeY);
            graphics.lineBetween(elbowX, routeY, elbowX, lowerY);
            graphics.lineBetween(elbowX, lowerY, sinkLeadX, lowerY);
            graphics.lineBetween(sinkLeadX, lowerY, sinkLeadX, routeY);
            graphics.lineStyle(8, previewDay === 2 ? palette.warm : pathColor, palette.monochrome ? 0.78 : 0.94);
            graphics.lineBetween(sinkLeadX, routeY, sinkX - 24, routeY);
        }

        if (previewDay === 2) {
            const filter = this.scene.add.rectangle(elbowX, lowerY, 34, 34, palette.monochrome ? 0xffffff : 0x1d313b, palette.monochrome ? 0.18 : 1)
                .setStrokeStyle(2, palette.warm, 0.92);
            const filterText = this.scene.add.text(elbowX, lowerY, 'F', {
                fontFamily: 'Courier New',
                fontSize: '18px',
                color: palette.monochrome ? '#ffffff' : '#ffdca6',
            }).setOrigin(0.5);
            const mismatch = this.scene.add.graphics();
            mismatch.lineStyle(3, palette.hot, palette.monochrome ? 0.84 : 0.96);
            mismatch.strokeCircle(sink.x, sink.y, 27);
            mismatch.lineBetween(sink.x - 34, sink.y - 28, sink.x - 22, sink.y - 40);
            mismatch.lineBetween(sink.x - 28, sink.y - 34, sink.x - 16, sink.y - 22);
            overlayNodes.push(filter, filterText, mismatch);
        }

        if (previewDay >= 3) {
            const sparks = this.scene.add.graphics();
            sparks.lineStyle(3, palette.hot, palette.monochrome ? 0.84 : 0.96);
            sparks.lineBetween(elbowX + 18, lowerY - 18, elbowX + 30, lowerY - 38);
            sparks.lineBetween(elbowX + 28, lowerY - 12, elbowX + 46, lowerY - 30);
            sparks.lineBetween(elbowX + 36, lowerY - 6, elbowX + 58, lowerY - 18);
            overlayNodes.push(sparks);
        }

        const sourceText = this.scene.add.text(source.x, source.y, 'IN', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: palette.accentText,
        }).setOrigin(0.5);
        const sinkText = this.scene.add.text(sink.x, sink.y, 'OUT', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: previewDay === 2 ? '#3d2707' : palette.accentText,
        }).setOrigin(0.5);

        container.add([graphics, source, sink, ...overlayNodes, sourceText, sinkText]);
    }

    _drawGearPreview(container, size, palette) {
        const previewDay = palette.previewDay ?? 1;
        const graphics = this.scene.add.graphics();
        const left = -(size.width / 2) + 28;
        const top = -(size.height / 2) + 28;
        graphics.fillStyle(palette.deepPanel, palette.monochrome ? 0.2 : 1);
        graphics.fillRoundedRect(left, top, size.width - 56, size.height - 56, 18);
        graphics.lineStyle(2, palette.accent, palette.monochrome ? 0.72 : 0.38);
        graphics.strokeRoundedRect(left, top, size.width - 56, size.height - 56, 18);
        graphics.lineStyle(5, palette.monochrome ? 0xffffff : 0x5d7480, palette.monochrome ? 0.7 : 0.5);
        graphics.lineBetween(left + 44, top + 92, left + size.width - 100, top + 92);

        const cleanGearColor = palette.monochrome ? 0xffffff : 0xd7c38c;
        const centerGearColor = previewDay === 2 ? palette.hot : (previewDay >= 3 ? palette.rust : cleanGearColor);
        this._drawGearGlyph(graphics, left + 72, top + 92, 24, cleanGearColor, palette.monochrome ? 0.84 : 1);
        this._drawGearGlyph(graphics, left + 146, top + 92, 24, centerGearColor, palette.monochrome ? 0.84 : 1);
        this._drawGearGlyph(graphics, left + 220, top + 92, 24, palette.monochrome ? 0xffffff : 0xffdf98, palette.monochrome ? 0.84 : 1);
        container.add(graphics);

        if (previewDay === 2) {
            const virusRing = this.scene.add.rectangle(left + 146, top + 92, 54, 54, palette.monochrome ? 0xffffff : 0x2a0e13, palette.monochrome ? 0.08 : 0.16)
                .setStrokeStyle(3, palette.hot, 0.94);
            const virusTag = this.scene.add.text(left + 146, top + 92, 'V', {
                fontFamily: 'Courier New',
                fontSize: '18px',
                fontStyle: 'bold',
                color: palette.monochrome ? '#ffffff' : '#2a0509',
                stroke: palette.monochrome ? '#000000' : '#ffd7aa',
                strokeThickness: 2,
            }).setOrigin(0.5);
            container.add([virusRing, virusTag]);
        }

        const arrows = this.scene.add.graphics();
        arrows.lineStyle(3, palette.accent, palette.monochrome ? 0.84 : 0.96);
        arrows.strokeCircle(left + 72, top + 92, 33);
        arrows.strokeCircle(left + 146, top + 92, 33);
        arrows.strokeCircle(left + 220, top + 92, 33);
        arrows.lineBetween(left + 98, top + 72, left + 90, top + 62);
        arrows.lineBetween(left + 120, top + 120, left + 128, top + 130);
        arrows.lineBetween(left + 172, top + 120, left + 164, top + 130);
        arrows.lineBetween(left + 194, top + 72, left + 202, top + 62);
        arrows.lineBetween(left + 246, top + 72, left + 238, top + 62);

        if (previewDay === 1) {
            const crack = this.scene.add.graphics();
            crack.lineStyle(4, palette.hot, palette.monochrome ? 0.84 : 0.96);
            crack.lineBetween(left + 52, top + 76, left + 70, top + 94);
            crack.lineBetween(left + 70, top + 94, left + 62, top + 114);
            crack.lineStyle(3, palette.hot, palette.monochrome ? 0.78 : 0.86);
            crack.lineBetween(left + 44, top + 92, left + 62, top + 92);
            crack.lineBetween(left + 82, top + 92, left + 102, top + 92);
            container.add(crack);
        }

        if (previewDay >= 3) {
            const cover = this.scene.add.rectangle(left + 294, top + 92, 54, 38, palette.monochrome ? 0xffffff : 0xb8c5ce, palette.monochrome ? 0.18 : 1)
                .setStrokeStyle(2, palette.hot, 0.92);
            const coverFold = this.scene.add.rectangle(left + 294, top + 80, 42, 6, palette.monochrome ? 0xffffff : 0x7f8d97, palette.monochrome ? 0.22 : 0.72);
            const sparks = this.scene.add.graphics();
            sparks.lineStyle(3, palette.hot, palette.monochrome ? 0.84 : 0.96);
            sparks.lineBetween(left + 214, top + 56, left + 228, top + 40);
            sparks.lineBetween(left + 226, top + 62, left + 244, top + 48);
            sparks.lineBetween(left + 250, top + 92, left + 276, top + 92);
            sparks.lineBetween(left + 263, top + 78, left + 263, top + 106);
            container.add([cover, coverFold, sparks]);
        }

        container.add(arrows);
    }

    _drawCodePreview(container, size, palette) {
        const previewDay = palette.previewDay ?? 1;
        const terminal = this.scene.add.graphics();
        const left = -(size.width / 2) + 28;
        const top = -(size.height / 2) + 24;
        const width = size.width - 56;
        const height = size.height - 48;

        terminal.fillStyle(palette.deepPanel, palette.monochrome ? 0.2 : 1);
        terminal.fillRoundedRect(left, top, width, height, 18);
        terminal.lineStyle(2, palette.accent, palette.monochrome ? 0.72 : 0.42);
        terminal.strokeRoundedRect(left, top, width, height, 18);
        terminal.fillStyle(palette.monochrome ? 0xffffff : 0x172a31, palette.monochrome ? 0.14 : 1);
        terminal.fillRoundedRect(left + 14, top + 14, width - 28, 26, 10);
        container.add(terminal);

        const title = this.scene.add.text(left + 28, top + 22, 'CHECK', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: palette.accentText,
        }).setOrigin(0, 0);
        const prompt = this.scene.add.text(left + 28, top + 60, '> run_test()', {
            fontFamily: 'Courier New',
            fontSize: '14px',
            color: palette.monochrome ? '#ffffff' : '#8bffac',
        }).setOrigin(0, 0);
        const lineA = this.scene.add.text(left + 28, top + 92, previewDay === 1 ? 'expected: OK' : (previewDay === 2 ? 'policy: DENY' : 'clean: false'), {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: previewDay >= 3 ? (palette.monochrome ? '#ffffff' : '#ff9ab2') : palette.accentText,
        }).setOrigin(0, 0);
        const lineB = this.scene.add.text(left + 28, top + 116, previewDay === 1 ? 'actual: FAIL' : (previewDay === 2 ? 'format: BAD' : 'contam: true'), {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: palette.accentText,
        }).setOrigin(0, 0);

        const resultBox = this.scene.add.rectangle(left + width - 88, top + 110, 116, 74, palette.monochrome ? 0xffffff : 0x131b22, palette.monochrome ? 0.16 : 1)
            .setStrokeStyle(2, previewDay >= 3 ? palette.hot : palette.accent, 0.92);
        const resultText = this.scene.add.text(resultBox.x, resultBox.y, previewDay === 1 ? 'FAIL' : (previewDay === 2 ? 'DENY' : 'TOXIC'), {
            fontFamily: 'Courier New',
            fontSize: previewDay >= 2 ? '20px' : '24px',
            color: previewDay >= 3 ? (palette.monochrome ? '#ffffff' : '#ffadc0') : palette.accentText,
            letterSpacing: 2,
        }).setOrigin(0.5);

        if (previewDay >= 3) {
            const bug = this.scene.add.graphics();
            const bugGreen = palette.monochrome ? 0xffffff : 0x48d86f;
            const bugLight = palette.monochrome ? 0xffffff : 0x8eff95;
            bug.fillStyle(bugGreen, palette.monochrome ? 0.16 : 1);
            bug.fillCircle(left + width - 172, top + 102, 12);
            bug.fillStyle(bugGreen, palette.monochrome ? 0.08 : 0.18);
            bug.fillCircle(left + width - 160, top + 116, 28);
            bug.fillStyle(bugLight, palette.monochrome ? 0.18 : 1);
            bug.fillCircle(left + width - 150, top + 96, 7);
            bug.lineStyle(3, bugGreen, palette.monochrome ? 0.88 : 0.96);
            bug.lineBetween(left + width - 184, top + 92, left + width - 194, top + 84);
            bug.lineBetween(left + width - 160, top + 92, left + width - 150, top + 84);
            bug.lineBetween(left + width - 186, top + 110, left + width - 196, top + 118);
            bug.lineBetween(left + width - 158, top + 110, left + width - 148, top + 118);
            bug.lineBetween(left + width - 182, top + 100, left + width - 194, top + 100);
            bug.lineBetween(left + width - 162, top + 100, left + width - 150, top + 100);
            bug.lineStyle(2, palette.hot, palette.monochrome ? 0.84 : 0.96);
            bug.lineBetween(left + width - 184, top + 82, left + width - 196, top + 68);
            bug.lineBetween(left + width - 166, top + 76, left + width - 164, top + 58);
            bug.lineBetween(left + width - 144, top + 92, left + width - 128, top + 78);
            container.add(bug);
        }

        const scan = this.scene.add.graphics();
        scan.lineStyle(1, palette.monochrome ? 0xffffff : 0x5fb6c7, palette.monochrome ? 0.42 : 0.18);
        for (let row = 0; row < 7; row += 1) {
            const y = top + 48 + (row * 18);
            scan.lineBetween(left + 18, y, left + width - 18, y);
        }

        container.add([scan, title, prompt, lineA, lineB, resultBox, resultText]);
    }

    _drawCircuitPipPattern(graphics, value, centerX, centerY, color, alpha = 1) {
        if (!value || value <= 0) return;

        const layouts = {
            1: [{ x: 0, y: 0 }],
            2: [{ x: -14, y: -14 }, { x: 14, y: 14 }],
            3: [{ x: -14, y: -14 }, { x: 0, y: 0 }, { x: 14, y: 14 }],
            4: [{ x: -14, y: -14 }, { x: 14, y: -14 }, { x: -14, y: 14 }, { x: 14, y: 14 }],
            5: [{ x: -14, y: -14 }, { x: 14, y: -14 }, { x: 0, y: 0 }, { x: -14, y: 14 }, { x: 14, y: 14 }],
            6: [{ x: -14, y: -14 }, { x: 14, y: -14 }, { x: -14, y: 0 }, { x: 14, y: 0 }, { x: -14, y: 14 }, { x: 14, y: 14 }],
        };
        const positions = layouts[value] || layouts[6];
        graphics.fillStyle(color, alpha);
        positions.forEach((pip) => {
            graphics.fillCircle(centerX + pip.x, centerY + pip.y, 5);
        });
    }

    _drawGearGlyph(graphics, x, y, radius, fillColor, alpha = 1) {
        for (let tooth = 0; tooth < 8; tooth += 1) {
            const angle = (Math.PI * 2 * tooth) / 8;
            const outerX = x + (Math.cos(angle) * (radius + 6));
            const outerY = y + (Math.sin(angle) * (radius + 6));
            graphics.fillStyle(fillColor, alpha);
            graphics.fillCircle(outerX, outerY, 4);
        }
        graphics.fillStyle(fillColor, alpha);
        graphics.fillCircle(x, y, radius);
        graphics.fillStyle(0x172026, alpha * 0.86);
        graphics.fillCircle(x, y, Math.max(6, radius * 0.35));
    }

    _setScrollOffset(nextOffset, force = false) {
        const clampedOffset = clamp(nextOffset, 0, this._scrollMax);
        if (!force && Math.abs(clampedOffset - this._scrollOffset) < 0.5) {
            return;
        }

        this._scrollOffset = clampedOffset;
        this._contentContainer.y = (this._viewportY + CONTENT_INSET) - clampedOffset;
        this._refreshScrollVisuals();
    }

    _refreshScrollVisuals() {
        if (this._scrollMax <= 0) {
            this._scrollThumb.setVisible(false);
            return;
        }

        this._scrollThumb.setVisible(true);
        const trackHeight = this._viewportH - 24;
        const ratio = this._viewportH / (this._viewportH + this._scrollMax);
        const thumbHeight = clamp(trackHeight * ratio, 46, trackHeight);
        const travel = trackHeight - thumbHeight;
        const progress = this._scrollMax <= 0 ? 0 : this._scrollOffset / this._scrollMax;

        this._scrollThumb.setSize(8, thumbHeight);
        this._scrollThumb.setDisplaySize(8, thumbHeight);
        this._scrollThumb.y = this._viewportY + 12 + (travel * progress);
    }

    _getScrollTrackMetrics() {
        const trackTop = this._viewportY + 12;
        const trackHeight = this._viewportH - 24;
        const thumbHeight = this._scrollThumb?.displayHeight || this._scrollThumb?.height || 46;
        return {
            trackTop,
            trackHeight,
            thumbHeight,
            travel: Math.max(1, trackHeight - thumbHeight),
        };
    }

    _beginScrollDrag(pointer, jumpToPointer = false) {
        if (!this._visible || this._scrollMax <= 0) return;
        pointer.event?.stopPropagation?.();

        const { thumbHeight } = this._getScrollTrackMetrics();
        const thumbTop = jumpToPointer
            ? pointer.y - (thumbHeight / 2)
            : this._scrollThumb.y;

        this._scrollDragState = {
            pointerId: pointer.id,
            grabOffsetY: pointer.y - thumbTop,
        };

        this._setScrollFromThumbTop(thumbTop);
    }

    _setScrollFromThumbTop(thumbTop) {
        const { trackTop, travel } = this._getScrollTrackMetrics();
        const progress = clamp((thumbTop - trackTop) / travel, 0, 1);
        this._setScrollOffset(progress * this._scrollMax);
    }

    _handleWheel(pointer, currentlyOver, deltaX, deltaY, deltaZ, event) {
        if (!this._visible) return;
        if (!Phaser.Geom.Rectangle.Contains(this._viewportBounds, pointer.x, pointer.y)) return;
        if (this._scrollMax <= 0) return;

        this._setScrollOffset(this._scrollOffset + (deltaY * 0.55));
        event?.stopPropagation?.();
    }

    _handlePointerMove(pointer) {
        if (this._visible && this._scrollDragState) {
            if (pointer.id !== this._scrollDragState.pointerId) return;
            this._setScrollFromThumbTop(pointer.y - this._scrollDragState.grabOffsetY);
            return;
        }

        if (!this._visible || !this._previewDragState) return;

        const drag = this._previewDragState;
        const nextX = drag.originX + (pointer.x - drag.startX);
        const nextY = drag.originY + (pointer.y - drag.startY);

        drag.container.x = clamp(nextX, drag.bounds.minX, drag.bounds.maxX);
        drag.container.y = clamp(nextY, drag.bounds.minY, drag.bounds.maxY);
    }

    _handlePointerUp() {
        if (this._scrollDragState) {
            this._scrollDragState = null;
            return;
        }

        if (!this._previewDragState) return;

        const drag = this._previewDragState;
        drag.setOutlineVisible(false);
        drag.container.setScale(1);
        this._previewDragState = null;
    }
}

export default RulebookOverlay;

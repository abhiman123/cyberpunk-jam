import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

const TABLET_DEPTH = 430;

// ── Layout constants (all relative to tablet center at 640,360) ─────────────
const TABLET_CENTER_X = 640;
const TABLET_CENTER_Y = 360;

// Outer chrome
const SHELL_W = 920;
const SHELL_H = 612;
const BEZEL_W = 880;
const BEZEL_H = 572;
const SCREEN_W = 830;
const SCREEN_H = 520;
const SCREEN_OFFSET_X = 8;

// Top bar
const TOP_BAR_Y = -236;
const TOP_BAR_H = 52;
const ACCENT_Y = -212;

// Side rail
const RAIL_CENTER_X = -324;
const RAIL_W = 166;

// Content viewport — the scrollable area right of the sidebar
const VIEWPORT_X = -214;
const VIEWPORT_Y = -188;
const VIEWPORT_W = 600;
const VIEWPORT_H = 382;

// Scroll track (inside tablet coordinates, right edge of viewport)
const SCROLL_TRACK_X = 410;
const SCROLL_TRACK_TOP = VIEWPORT_Y;
const SCROLL_TRACK_H = VIEWPORT_H;

export default class RulebookOverlay {
    constructor(scene, activeRuleIds, allRules, newRuleIds = [], callbacks = {}) {
        this.scene = scene;
        this.activeRuleIds = Array.isArray(activeRuleIds) ? [...activeRuleIds] : [];
        this.allRules = Array.isArray(allRules) ? allRules : [];
        this.newRuleIds = new Set(Array.isArray(newRuleIds) ? newRuleIds : []);
        this._callbacks = callbacks;
        this._visible = false;
        this._currentSection = 'rules';
        this._scrollOffset = 0;
        this._scrollMax = 0;
        this._contentHeight = 0;
        this._contentNodes = [];
        this._sectionButtons = new Map();
        this._contentHover = false;

        this._handleWheel = this._handleWheel.bind(this);
        this._handleEscape = this._handleEscape.bind(this);
        this._handleToggle = this._handleToggle.bind(this);

        this._build();

        this._escKey = scene.input.keyboard.addKey('ESC');
        this._bKey = scene.input.keyboard.addKey('B');
        this._escKey.on('down', this._handleEscape);
        this._bKey.on('down', this._handleToggle);
        this.scene.input.on('wheel', this._handleWheel);

        this.hide(true);
    }

    // ── Public API ───────────────────────────────────────────────────────────

    toggle() {
        this._visible ? this.hide() : this.show();
    }

    show() {
        if (this._visible) return;

        this._visible = true;
        this.refresh();
        this._root.setVisible(true);
        this._root.setAlpha(1);
        this._updateContentMaskShape();

        this._tablet.setScale(0.96);
        this.scene.tweens.killTweensOf([this._backdrop, this._tablet]);
        this._backdrop.setAlpha(0);
        this.scene.tweens.add({
            targets: this._backdrop,
            alpha: 0.9,
            duration: 180,
            ease: 'Quad.Out',
        });
        this.scene.tweens.add({
            targets: this._tablet,
            scaleX: 1,
            scaleY: 1,
            duration: 220,
            ease: 'Cubic.Out',
            onUpdate: () => this._updateContentMaskShape(),
        });
        this._callbacks.onOpen?.();
    }

    hide(immediate = false) {
        if (!this._root) return;
        if (!this._visible && !this._root.visible) return;
        if (!this._visible && !immediate) return;

        this._visible = false;
        if (immediate) {
            this._root.setVisible(false);
            this._root.setAlpha(0);
            this._callbacks.onClose?.();
            return;
        }

        this.scene.tweens.killTweensOf([this._backdrop, this._tablet]);
        this.scene.tweens.add({
            targets: this._backdrop,
            alpha: 0,
            duration: 150,
            ease: 'Quad.In',
        });
        this.scene.tweens.add({
            targets: this._tablet,
            scaleX: 0.96,
            scaleY: 0.96,
            duration: 150,
            ease: 'Quad.In',
            onUpdate: () => this._updateContentMaskShape(),
            onComplete: () => {
                this._root.setVisible(false);
                this._callbacks.onClose?.();
            },
        });
    }

    isVisible() {
        return this._visible;
    }

    refresh() {
        this._setSection(this._currentSection, true);
    }

    // ── Build ────────────────────────────────────────────────────────────────

    _build() {
        // Root container holds everything and controls depth / visibility
        this._root = this.scene.add.container(0, 0)
            .setDepth(TABLET_DEPTH)
            .setVisible(false)
            .setAlpha(0);

        // Dark backdrop
        this._backdrop = this.scene.add.rectangle(
            TABLET_CENTER_X, TABLET_CENTER_Y, 1280, 720, 0x000000, 0.9,
        ).setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => {});

        // Tablet container — everything inside is relative to center (640, 360)
        this._tablet = this.scene.add.container(TABLET_CENTER_X, TABLET_CENTER_Y);

        // ── Chrome ───────────────────────────────────────────────────────────
        const shellShadow = this.scene.add.rectangle(8, 10, SHELL_W + 12, SHELL_H + 12, 0x000000, 0.34);
        const shell = this.scene.add.rectangle(0, 0, SHELL_W, SHELL_H, 0x161b21, 1)
            .setStrokeStyle(3, 0x55616c, 0.95);
        const bezel = this.scene.add.rectangle(0, 0, BEZEL_W, BEZEL_H, 0x0f1419, 1)
            .setStrokeStyle(1, 0x72808c, 0.72);
        const screen = this.scene.add.rectangle(SCREEN_OFFSET_X, 0, SCREEN_W, SCREEN_H, 0x0f181d, 1)
            .setStrokeStyle(1, 0x62707c, 0.42);

        // Top bar strip
        const topBar = this.scene.add.rectangle(SCREEN_OFFSET_X, TOP_BAR_Y, SCREEN_W, TOP_BAR_H, 0x1b2732, 1)
            .setStrokeStyle(1, 0x70808c, 0.6);
        const accentStrip = this.scene.add.rectangle(SCREEN_OFFSET_X, ACCENT_Y, SCREEN_W, 3, 0x89d3c8, 0.5);

        // Side rail
        const sideRail = this.scene.add.rectangle(RAIL_CENTER_X, -1, RAIL_W, SCREEN_H + 2, 0x172228, 1)
            .setStrokeStyle(1, 0x52606b, 0.58);

        // ── Top-bar texts ────────────────────────────────────────────────────
        const title = this.scene.add.text(-374, -248, 'INSPECTOR TABLET', {
            fontFamily: 'Courier New', fontSize: '18px', color: '#dfeaf1', letterSpacing: 2,
        });
        this._tabletStatus = this.scene.add.text(310, -248, 'RULES ONLINE', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#8cd5b8', letterSpacing: 2,
        }).setOrigin(1, 0);

        // Subtitle — constrained to avoid bleeding into sidebar or close button
        const subtitle = this.scene.add.text(-220, -224, 'Tap the desk tablet or press B. Scroll the pane to read older entries.', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#7f8f9d',
            wordWrap: { width: 520 },
        });

        // Close button
        const closeBg = this.scene.add.rectangle(382, TOP_BAR_Y, 92, 28, 0x25313c, 1)
            .setStrokeStyle(1, 0x74808b, 0.84)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(382, TOP_BAR_Y, 'CLOSE', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#ebf7ff', letterSpacing: 2,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x32404b, 1));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0x25313c, 1));
        closeBg.on('pointerdown', () => this.hide());

        // ── Sidebar ──────────────────────────────────────────────────────────
        const railTitle = this.scene.add.text(-366, -196, 'SHIFT SNAPSHOT', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#dcecf3', letterSpacing: 2,
        });
        const railRule = this.scene.add.rectangle(RAIL_CENTER_X, -180, 126, 1, 0x586570, 1);

        const sectionDefs = [
            { key: 'rules', label: 'DIRECTIVES', y: -160 },
            { key: 'booth', label: 'BOOTH INFO', y: -114 },
            { key: 'docs', label: 'DOCS', y: -68 },
        ];

        sectionDefs.forEach((section) => {
            const bg = this.scene.add.rectangle(RAIL_CENTER_X, section.y, 130, 36, 0x212b31, 1)
                .setStrokeStyle(1, 0x6a7780, 0.48)
                .setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(RAIL_CENTER_X, section.y, section.label, {
                fontFamily: 'Courier New', fontSize: '14px', color: '#c6d6df', letterSpacing: 1,
            }).setOrigin(0.5);
            bg.on('pointerdown', () => this._setSection(section.key));
            bg.on('pointerover', () => {
                if (this._currentSection !== section.key) bg.setFillStyle(0x29343b, 1);
            });
            bg.on('pointerout', () => {
                if (this._currentSection !== section.key) bg.setFillStyle(0x212b31, 1);
            });
            this._sectionButtons.set(section.key, { bg, label });
        });

        // Summary panel in sidebar
        const summaryPanel = this.scene.add.rectangle(RAIL_CENTER_X, 80, 132, 200, 0x101a20, 0.94)
            .setStrokeStyle(1, 0x5c6973, 0.7);
        this._sidebarShiftText = this.scene.add.text(-362, 0, '', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#f0f7fb', letterSpacing: 1,
        });
        this._sidebarDateText = this.scene.add.text(-362, 30, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#93adb9', wordWrap: { width: 110 }, lineSpacing: 2,
        });
        this._sidebarRuleCountText = this.scene.add.text(-362, 72, '', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#dbe8ee',
        });
        this._sidebarSectionText = this.scene.add.text(-362, 104, '', {
            fontFamily: 'Courier New', fontSize: '11px', color: '#f4f0d2', letterSpacing: 1,
        });
        this._sidebarHintText = this.scene.add.text(-362, 134, '', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#8eb1bd', wordWrap: { width: 110 }, lineSpacing: 4,
        });

        // ── Scrollable content area ──────────────────────────────────────────

        // Invisible interactive rectangle for detecting hover (scroll target)
        this._contentClip = this.scene.add.rectangle(
            VIEWPORT_X + (VIEWPORT_W / 2),
            VIEWPORT_Y + (VIEWPORT_H / 2),
            VIEWPORT_W,
            VIEWPORT_H,
            0xffffff, 0.001,
        ).setInteractive({ useHandCursor: true });
        this._contentClip.on('pointerover', () => { this._contentHover = true; });
        this._contentClip.on('pointerout', () => { this._contentHover = false; });

        // Container that holds all dynamically built section content
        this._contentContainer = this.scene.add.container(VIEWPORT_X, VIEWPORT_Y);

        // Phaser 4 WebGL-safe clipping for the viewport.
        this._contentMaskShape = this.scene.add.rectangle(0, 0, VIEWPORT_W, VIEWPORT_H, 0xffffff, 1)
            .setOrigin(0, 0);
        this.scene.children.remove(this._contentMaskShape);

        this._contentContainer.enableFilters();
        this._contentMaskFilter = this._contentContainer.filters.external.addMask(
            this._contentMaskShape,
            false,
            this.scene.cameras.main,
            'world',
        );
        this._updateContentMaskShape();

        // ── Scroll track & thumb ─────────────────────────────────────────────
        this._scrollTrack = this.scene.add.rectangle(
            SCROLL_TRACK_X, SCROLL_TRACK_TOP, 8, SCROLL_TRACK_H, 0x2b353d, 1,
        ).setOrigin(0.5, 0).setStrokeStyle(1, 0x59646d, 0.45);
        this._scrollThumb = this.scene.add.rectangle(
            SCROLL_TRACK_X, SCROLL_TRACK_TOP, 8, 72, 0xa2d4ff, 0.9,
        ).setOrigin(0.5, 0).setStrokeStyle(1, 0xe5fbff, 0.46);

        // ── Assemble tablet ──────────────────────────────────────────────────
        this._tablet.add([
            shellShadow,
            shell,
            bezel,
            screen,
            topBar,
            accentStrip,
            sideRail,
            title,
            this._tabletStatus,
            subtitle,
            railTitle,
            railRule,
            closeBg,
            closeLabel,
            ...Array.from(this._sectionButtons.values()).flatMap((b) => [b.bg, b.label]),
            summaryPanel,
            this._sidebarShiftText,
            this._sidebarDateText,
            this._sidebarRuleCountText,
            this._sidebarSectionText,
            this._sidebarHintText,
            this._scrollTrack,
            this._scrollThumb,
            this._contentClip,
            this._contentContainer,
        ]);

        this._root.add([this._backdrop, this._tablet]);
        this._setSection(this._currentSection, true);
    }

    // ── Input handlers ───────────────────────────────────────────────────────

    _handleEscape() {
        if (this._visible) this.hide();
    }

    _handleToggle() {
        this.toggle();
    }

    _handleWheel(_pointer, _gameObjects, _deltaX, deltaY) {
        if (!this._visible || !this._contentHover || this._scrollMax <= 0) return;

        this._scrollOffset = Phaser.Math.Clamp(
            this._scrollOffset + (deltaY * 0.45), 0, this._scrollMax,
        );
        this._syncScroll();
    }

    // ── Section switching ────────────────────────────────────────────────────

    _setSection(sectionKey, force = false) {
        if (!force && this._currentSection === sectionKey) return;
        this._currentSection = sectionKey;
        this._scrollOffset = 0;

        // Destroy old content
        this._contentNodes.forEach((node) => node.destroy());
        this._contentNodes = [];

        // Build new content
        if (sectionKey === 'rules') {
            this._buildRulesSection();
        } else if (sectionKey === 'booth') {
            this._buildBoothSection();
        } else {
            this._buildDocsSection();
        }

        // Update sidebar button styles
        this._sectionButtons.forEach((button, key) => {
            const active = key === sectionKey;
            button.bg.setFillStyle(active ? 0x5d6d62 : 0x212b31, 1);
            button.bg.setStrokeStyle(1, active ? 0xe9f2d1 : 0x6a7780, active ? 0.9 : 0.48);
            button.label.setColor(active ? '#f6ffdf' : '#c6d6df');
        });

        // Update status text
        this._tabletStatus.setText(
            sectionKey === 'rules'
                ? 'RULES ONLINE'
                : sectionKey === 'booth'
                    ? 'BOOTH STATUS'
                    : 'REFERENCE FILES',
        );
        this._refreshSidebarSummary();
        this._syncScroll();
    }

    // ── Sidebar data ─────────────────────────────────────────────────────────

    _refreshSidebarSummary() {
        if (!this._sidebarShiftText) return;

        const sectionTitle = this._currentSection === 'rules'
            ? 'DIRECTIVES'
            : this._currentSection === 'booth'
                ? 'BOOTH INFO'
                : 'REFERENCE';
        const sectionHint = this._currentSection === 'rules'
            ? 'Active shift laws and any newly added directives.'
            : this._currentSection === 'booth'
                ? 'Live booth context for this run.'
                : 'Quick legends for every puzzle layer.';

        this._sidebarShiftText.setText(`DAY ${GameState.day}  //  P${GameState.period}`);
        this._sidebarDateText.setText(GameState.formatCurrentShiftDate());
        this._sidebarRuleCountText.setText(`ACTIVE RULES  ${this.activeRuleIds.length}`);
        this._sidebarSectionText.setText(`OPEN: ${sectionTitle}`);
        this._sidebarHintText.setText(sectionHint);
    }

    // ── Section builders ─────────────────────────────────────────────────────
    // All content is built relative to (0,0) inside _contentContainer.
    // The container is at local (VIEWPORT_X, VIEWPORT_Y) inside _tablet
    // and is scrolled by adjusting its Y position; the mask handles clipping.

    _buildRulesSection() {
        let y = 0;
        y = this._addSectionHeader('ACTIVE DIRECTIVES', 'Scroll for the full shift list.', y);

        const activeRules = this.allRules.filter((rule) => this.activeRuleIds.includes(rule.id));
        activeRules.forEach((rule) => {
            const isNew = this.newRuleIds.has(rule.id);
            const tag = this.scene.add.text(16, y + 12, `RULE ${rule.id.toString().padStart(2, '0')}`, {
                fontFamily: 'Courier New', fontSize: '13px',
                color: isNew ? '#f5e7a7' : '#a8c8df', letterSpacing: 1,
            });
            const body = this.scene.add.text(16, y + 34, rule.text, {
                fontFamily: 'Courier New', fontSize: '15px', color: '#dde6ee',
                wordWrap: { width: 536 }, lineSpacing: 5,
            });
            const cardHeight = Math.max(86, body.height + 52);
            const card = this.scene.add.rectangle(286, y + (cardHeight / 2), 572, cardHeight, 0x182228, 1)
                .setOrigin(0.5, 0.5)
                .setStrokeStyle(1, isNew ? 0xe6d89a : 0x4d5862, 0.72);
            const divider = this.scene.add.rectangle(286, y + 30, 540, 1, 0x33424b, 0.84)
                .setOrigin(0.5, 0.5);
            this._contentNodes.push(card, divider, tag, body);
            this._contentContainer.add([card, divider, tag, body]);
            y += cardHeight + 14;
        });

        if (activeRules.length === 0) {
            y = this._addSectionParagraph('No directives loaded for this shift.', y + 8, '#c8d4dc');
        }

        this._contentHeight = y + 18;
    }

    _buildBoothSection() {
        let y = 0;
        y = this._addSectionHeader('BOOTH STATUS', 'Live notes pulled from the current shift.', y);

        const stats = [
            { label: 'PERIOD', value: String(GameState.period) },
            { label: 'DAY', value: String(GameState.day) },
            { label: 'DATE', value: GameState.formatCurrentShiftDate() },
            { label: 'ACTIVE RULES', value: String(this.activeRuleIds.length) },
        ];

        stats.forEach((stat, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const cardX = column === 0 ? 138 : 434;
            const rowY = y + (row * 92);

            // Card background — origin (0.5, 0) so it centers horizontally
            const plate = this.scene.add.rectangle(cardX, rowY + 8, 270, 72, 0x182228, 1)
                .setOrigin(0.5, 0)
                .setStrokeStyle(1, 0x46515a, 0.66);
            // Label inside the plate
            const label = this.scene.add.text(cardX - 118, rowY + 14, stat.label, {
                fontFamily: 'Courier New', fontSize: '12px', color: '#8ca0af', letterSpacing: 2,
            });
            // Value inside the plate
            const value = this.scene.add.text(cardX - 118, rowY + 38, stat.value, {
                fontFamily: 'Courier New', fontSize: '20px', color: '#eef6fb', letterSpacing: 1,
                wordWrap: { width: 228 },
            });
            this._contentNodes.push(plate, label, value);
            this._contentContainer.add([plate, label, value]);
        });
        y += 204;

        y = this._addSectionParagraph(
            'Workflow reminder: clear the main grid, finish every attached auxiliary puzzle, then file ACCEPT or SCRAP from the floor controls.',
            y, '#d9e5ec',
        );
        y = this._addSectionParagraph(
            'Desk tablet shortcut still works on B, but the physical tablet on the desk is the main diegetic entry point.',
            y + 6, '#98b2bf',
        );
        y = this._addSectionParagraph(
            'If the unit carries both FLOW and GEAR diagnostics, both need to be resolved before you earn clean pay or scrap bonus credit.',
            y + 6, '#98b2bf',
        );

        this._contentHeight = y + 20;
    }

    _buildDocsSection() {
        let y = 0;
        y = this._addSectionHeader('REFERENCE NOTES', 'Quick reference for the current booth.', y);
        y = this._addDocCard('ACCEPT / REPAIR / SCRAP', 'Approve the compliant. Scrap the defective. Repair the redeemable.', y, '#f4f0d2');
        y = this._addDocCard('GRID', 'Walls stay blocked, numbered cells want a matching pip count, and = pairs must end on equal pip values.', y, '#c8dbe5');
        y = this._addDocCard('GROUP TARGETS', 'Outlined cell clusters add together as one total. Negative totals mean the cluster must stay below that number.', y, '#c8dbe5');
        y = this._addDocCard('FLOW', 'Power has to reach every listed subsystem. Amber hazard nodes block the route, so the path has to go around them.', y, '#c8dbe5');
        y = this._addDocCard('GEAR', 'Movable gears slide like puzzle parts. They do not rotate manually. The board clears once the output gear is powered and spinning.', y, '#c8dbe5');
        y = this._addDocCard('COMMS', 'A broken VOICE target corrupts the machine link until that subsystem is restored.', y, '#a6c6d4');

        this._contentHeight = y + 20;
    }

    // ── Content builder helpers ──────────────────────────────────────────────

    _addSectionHeader(title, subtitle, y) {
        const titleText = this.scene.add.text(0, y, title, {
            fontFamily: 'Courier New', fontSize: '24px', color: '#f2f7fb', letterSpacing: 2,
        });
        const subtitleText = this.scene.add.text(0, y + 34, subtitle, {
            fontFamily: 'Courier New', fontSize: '12px', color: '#89a0ad',
        });
        const rule = this.scene.add.rectangle(286, y + 62, 572, 2, 0x42505a, 1).setOrigin(0.5, 0);
        this._contentNodes.push(titleText, subtitleText, rule);
        this._contentContainer.add([titleText, subtitleText, rule]);
        return y + 80;
    }

    _addSectionParagraph(text, y, color = '#dfe7ee') {
        const paragraph = this.scene.add.text(0, y, text, {
            fontFamily: 'Courier New', fontSize: '15px', color,
            wordWrap: { width: 556 }, lineSpacing: 5,
        });
        this._contentNodes.push(paragraph);
        this._contentContainer.add(paragraph);
        return y + paragraph.height + 18;
    }

    _addDocCard(title, body, y, accentColor = '#dfe7ee') {
        const titleText = this.scene.add.text(16, y + 12, title, {
            fontFamily: 'Courier New', fontSize: '13px', color: accentColor, letterSpacing: 1,
        });
        const bodyText = this.scene.add.text(16, y + 34, body, {
            fontFamily: 'Courier New', fontSize: '15px', color: '#dfe7ee',
            wordWrap: { width: 536 }, lineSpacing: 5,
        });
        const cardHeight = Math.max(74, bodyText.height + 50);
        const card = this.scene.add.rectangle(286, y + (cardHeight / 2), 572, cardHeight, 0x182228, 1)
            .setOrigin(0.5, 0.5)
            .setStrokeStyle(1, 0x4d5862, 0.72);
        const divider = this.scene.add.rectangle(286, y + 30, 540, 1, 0x33424b, 0.84)
            .setOrigin(0.5, 0.5);

        this._contentNodes.push(card, divider, titleText, bodyText);
        this._contentContainer.add([card, divider, titleText, bodyText]);
        return y + cardHeight + 14;
    }

    // ── Scroll sync ──────────────────────────────────────────────────────────

    _updateContentMaskShape() {
        if (!this._contentMaskShape || !this._tablet) return;

        const scaleX = this._tablet.scaleX || 1;
        const scaleY = this._tablet.scaleY || 1;
        const left = this._tablet.x + (VIEWPORT_X * scaleX);
        const top = this._tablet.y + (VIEWPORT_Y * scaleY);

        this._contentMaskShape
            .setPosition(left, top)
            .setScale(scaleX, scaleY);
    }

    _syncScroll() {
        this._scrollMax = Math.max(0, this._contentHeight - VIEWPORT_H);
        this._scrollOffset = Phaser.Math.Clamp(this._scrollOffset, 0, this._scrollMax);

        // Move the content container; the viewport mask filter handles clipping
        this._contentContainer.setPosition(VIEWPORT_X, VIEWPORT_Y - this._scrollOffset);
        this._updateContentMaskShape();

        // Hide scrollbar when no overflow
        if (this._scrollMax <= 0) {
            this._scrollTrack.setVisible(false);
            this._scrollThumb.setVisible(false);
            return;
        }

        this._scrollTrack.setVisible(true);
        this._scrollThumb.setVisible(true);
        const thumbHeight = Math.max(54, (VIEWPORT_H / this._contentHeight) * SCROLL_TRACK_H);
        const trackRange = SCROLL_TRACK_H - thumbHeight;
        const progress = this._scrollMax <= 0 ? 0 : this._scrollOffset / this._scrollMax;
        this._scrollThumb.height = thumbHeight;
        this._scrollThumb.y = SCROLL_TRACK_TOP + (trackRange * progress);
    }

    // ── Teardown ─────────────────────────────────────────────────────────────

    destroy() {
        this.scene.input.off('wheel', this._handleWheel);
        this._escKey?.off('down', this._handleEscape);
        this._bKey?.off('down', this._handleToggle);
        this._escKey?.destroy();
        this._bKey?.destroy();
        this._contentContainer?.filters?.external?.clear();
        this._contentMaskShape?.destroy();
        this._root?.destroy(true);
    }
}

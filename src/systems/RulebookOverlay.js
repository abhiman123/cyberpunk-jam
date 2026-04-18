import * as Phaser from 'phaser';
import { GameState } from '../GameState.js';

const TABLET_DEPTH = 430;

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

    toggle() {
        this._visible ? this.hide() : this.show();
    }

    show() {
        if (this._visible) return;

        this._visible = true;
        this.refresh();
        this._root.setVisible(true);
        this._root.setAlpha(1);
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

    _build() {
        this._root = this.scene.add.container(0, 0).setDepth(TABLET_DEPTH).setVisible(false).setAlpha(0);

        this._backdrop = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.9)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => {});

        this._tablet = this.scene.add.container(640, 360);

        const shellShadow = this.scene.add.rectangle(8, 10, 932, 624, 0x000000, 0.34);
        const shell = this.scene.add.rectangle(0, 0, 920, 612, 0x181d23, 1)
            .setStrokeStyle(3, 0x49515a, 0.95);
        const bezel = this.scene.add.rectangle(0, 0, 880, 572, 0x11151a, 1)
            .setStrokeStyle(1, 0x69737f, 0.72);
        const screen = this.scene.add.rectangle(8, 0, 830, 520, 0x10191e, 1)
            .setStrokeStyle(1, 0x5c666f, 0.42);
        const topBar = this.scene.add.rectangle(8, -236, 830, 52, 0x1c2630, 1)
            .setStrokeStyle(1, 0x5b6773, 0.6);
        const sideRail = this.scene.add.rectangle(-308, 0, 166, 520, 0x182228, 1)
            .setStrokeStyle(1, 0x4f5963, 0.58);

        const title = this.scene.add.text(-374, -248, 'INSPECTOR TABLET', {
            fontFamily: 'Courier New', fontSize: '18px', color: '#dfeaf1', letterSpacing: 2,
        });
        this._tabletStatus = this.scene.add.text(402, -248, 'RULES ONLINE', {
            fontFamily: 'monospace', fontSize: '11px', color: '#8cd5b8', letterSpacing: 2,
        }).setOrigin(1, 0);

        const subtitle = this.scene.add.text(-374, -214, 'Tap the desk tablet or press B. Scroll the pane to read older entries.', {
            fontFamily: 'monospace', fontSize: '11px', color: '#7f8f9d',
        });

        const closeBg = this.scene.add.rectangle(382, -236, 92, 28, 0x25313c, 1)
            .setStrokeStyle(1, 0x74808b, 0.84)
            .setInteractive({ useHandCursor: true });
        const closeLabel = this.scene.add.text(382, -236, 'CLOSE', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#ebf7ff', letterSpacing: 2,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x32404b, 1));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0x25313c, 1));
        closeBg.on('pointerdown', () => this.hide());

        const sectionDefs = [
            { key: 'rules', label: 'DIRECTIVES', y: -166 },
            { key: 'booth', label: 'BOOTH INFO', y: -118 },
            { key: 'docs', label: 'DOCS', y: -70 },
        ];

        sectionDefs.forEach((section) => {
            const bg = this.scene.add.rectangle(-308, section.y, 130, 36, 0x212b31, 1)
                .setStrokeStyle(1, 0x6a7780, 0.48)
                .setInteractive({ useHandCursor: true });
            const label = this.scene.add.text(-308, section.y, section.label, {
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

        this._contentViewport = { x: -214, y: -188, width: 600, height: 424 };
        this._contentClip = this.scene.add.rectangle(
            this._contentViewport.x + (this._contentViewport.width / 2),
            this._contentViewport.y + (this._contentViewport.height / 2),
            this._contentViewport.width,
            this._contentViewport.height,
            0xffffff,
            0.001,
        ).setInteractive({ useHandCursor: true });
        this._contentClip.on('pointerover', () => { this._contentHover = true; });
        this._contentClip.on('pointerout', () => { this._contentHover = false; });

        this._contentContainer = this.scene.add.container(this._contentViewport.x, this._contentViewport.y);
        const contentMaskGraphics = this.scene.make.graphics({ x: 640, y: 360, add: false });
        contentMaskGraphics.fillStyle(0xffffff, 1);
        contentMaskGraphics.fillRoundedRect(
            this._contentViewport.x,
            this._contentViewport.y,
            this._contentViewport.width,
            this._contentViewport.height,
            18,
        );
        this._contentMaskSource = contentMaskGraphics;
        this._contentContainer.setMask(contentMaskGraphics.createGeometryMask());

        this._scrollTrack = this.scene.add.rectangle(410, 24, 8, 412, 0x2b353d, 1)
            .setStrokeStyle(1, 0x59646d, 0.45);
        this._scrollThumb = this.scene.add.rectangle(410, -182, 8, 72, 0xa2d4ff, 0.9)
            .setStrokeStyle(1, 0xe5fbff, 0.46);

        this._tablet.add([
            shellShadow,
            shell,
            bezel,
            screen,
            topBar,
            sideRail,
            title,
            this._tabletStatus,
            subtitle,
            closeBg,
            closeLabel,
            ...Array.from(this._sectionButtons.values()).flatMap((button) => [button.bg, button.label]),
            this._scrollTrack,
            this._scrollThumb,
            this._contentClip,
            this._contentContainer,
        ]);

        this._root.add([this._backdrop, this._tablet]);
        this._setSection(this._currentSection, true);
    }

    _handleEscape() {
        if (this._visible) this.hide();
    }

    _handleToggle() {
        this.toggle();
    }

    _handleWheel(_pointer, _gameObjects, _deltaX, deltaY) {
        if (!this._visible || !this._contentHover || this._scrollMax <= 0) return;

        this._scrollOffset = Phaser.Math.Clamp(this._scrollOffset + (deltaY * 0.45), 0, this._scrollMax);
        this._syncScroll();
    }

    _setSection(sectionKey, force = false) {
        if (!force && this._currentSection === sectionKey) return;
        this._currentSection = sectionKey;
        this._scrollOffset = 0;

        this._contentNodes.forEach((node) => node.destroy());
        this._contentNodes = [];

        if (sectionKey === 'rules') {
            this._buildRulesSection();
        } else if (sectionKey === 'booth') {
            this._buildBoothSection();
        } else {
            this._buildDocsSection();
        }

        this._sectionButtons.forEach((button, key) => {
            const active = key === sectionKey;
            button.bg.setFillStyle(active ? 0x5d6d62 : 0x212b31, 1);
            button.bg.setStrokeStyle(1, active ? 0xe9f2d1 : 0x6a7780, active ? 0.9 : 0.48);
            button.label.setColor(active ? '#f6ffdf' : '#c6d6df');
        });

        this._tabletStatus.setText(
            sectionKey === 'rules'
                ? 'RULES ONLINE'
                : sectionKey === 'booth'
                    ? 'BOOTH STATUS'
                    : 'REFERENCE FILES'
        );
        this._syncScroll();
    }

    _buildRulesSection() {
        let y = 0;
        y = this._addSectionHeader('ACTIVE DIRECTIVES', 'Scroll for the full shift list.', y);

        const activeRules = this.allRules.filter((rule) => this.activeRuleIds.includes(rule.id));
        activeRules.forEach((rule) => {
            const card = this.scene.add.rectangle(286, y + 34, 572, 76, 0x182228, 1)
                .setOrigin(0.5, 0)
                .setStrokeStyle(1, this.newRuleIds.has(rule.id) ? 0xe6d89a : 0x4d5862, 0.72);
            const tag = this.scene.add.text(16, y + 12, `RULE ${rule.id.toString().padStart(2, '0')}`, {
                fontFamily: 'Courier New', fontSize: '13px', color: this.newRuleIds.has(rule.id) ? '#f5e7a7' : '#a8c8df', letterSpacing: 1,
            });
            const body = this.scene.add.text(16, y + 34, rule.text, {
                fontFamily: 'monospace', fontSize: '16px', color: '#dde6ee', wordWrap: { width: 540 }, lineSpacing: 6,
            });
            this._contentNodes.push(card, tag, body);
            this._contentContainer.add([card, tag, body]);
            y += Math.max(92, body.height + 46);
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
            const rowY = y + (index * 54);
            const plate = this.scene.add.rectangle(286, rowY, 572, 42, 0x182228, 1)
                .setOrigin(0.5, 0)
                .setStrokeStyle(1, 0x46515a, 0.66);
            const label = this.scene.add.text(18, rowY + 11, stat.label, {
                fontFamily: 'Courier New', fontSize: '12px', color: '#8ca0af', letterSpacing: 2,
            });
            const value = this.scene.add.text(552, rowY + 10, stat.value, {
                fontFamily: 'Courier New', fontSize: '18px', color: '#eef6fb', letterSpacing: 1,
            }).setOrigin(1, 0);
            this._contentNodes.push(plate, label, value);
            this._contentContainer.add([plate, label, value]);
        });
        y += 236;

        y = this._addSectionParagraph('Workflow reminder: open the grid, clear any attached flow diagnostic, then file ACCEPT or SCRAP on the floor controls.', y, '#d9e5ec');
        y = this._addSectionParagraph('Desk tablet shortcut stays available on B, but the physical tablet on the desk is the main diegetic entry point.', y + 6, '#98b2bf');

        this._contentHeight = y + 20;
    }

    _buildDocsSection() {
        let y = 0;
        y = this._addSectionHeader('REFERENCE NOTES', 'Quick reference for the current booth.', y);
        y = this._addSectionParagraph('Approve the compliant. Scrap the defective. Repair the redeemable.', y, '#f4f0d2');
        y = this._addSectionParagraph('Grid legend: walls stay blocked, numbered cells want a matching pip count, and = pairs must end on equal pip values.', y + 8, '#c8dbe5');
        y = this._addSectionParagraph('Flow legend: power has to reach every listed subsystem. Amber modification nodes can be bypassed, but routing through them still flags the machine.', y + 8, '#c8dbe5');
        y = this._addSectionParagraph('Comms note: a broken VOICE target corrupts the machine link until that subsystem is restored.', y + 8, '#a6c6d4');

        this._contentHeight = y + 20;
    }

    _addSectionHeader(title, subtitle, y) {
        const titleText = this.scene.add.text(0, y, title, {
            fontFamily: 'Courier New', fontSize: '24px', color: '#f2f7fb', letterSpacing: 2,
        });
        const subtitleText = this.scene.add.text(0, y + 34, subtitle, {
            fontFamily: 'monospace', fontSize: '12px', color: '#89a0ad',
        });
        const rule = this.scene.add.rectangle(286, y + 62, 572, 2, 0x42505a, 1).setOrigin(0.5, 0);
        this._contentNodes.push(titleText, subtitleText, rule);
        this._contentContainer.add([titleText, subtitleText, rule]);
        return y + 80;
    }

    _addSectionParagraph(text, y, color = '#dfe7ee') {
        const paragraph = this.scene.add.text(0, y, text, {
            fontFamily: 'monospace', fontSize: '16px', color, wordWrap: { width: 560 }, lineSpacing: 6,
        });
        this._contentNodes.push(paragraph);
        this._contentContainer.add(paragraph);
        return y + paragraph.height + 18;
    }

    _syncScroll() {
        this._scrollMax = Math.max(0, this._contentHeight - this._contentViewport.height);
        this._scrollOffset = Phaser.Math.Clamp(this._scrollOffset, 0, this._scrollMax);
        this._contentContainer.setPosition(this._contentViewport.x, this._contentViewport.y - this._scrollOffset);

        if (this._scrollMax <= 0) {
            this._scrollThumb.setVisible(false);
            return;
        }

        this._scrollThumb.setVisible(true);
        const thumbHeight = Math.max(54, (this._contentViewport.height / this._contentHeight) * 412);
        const trackTop = -182;
        const trackRange = 412 - thumbHeight;
        const progress = this._scrollMax <= 0 ? 0 : this._scrollOffset / this._scrollMax;
        this._scrollThumb.height = thumbHeight;
        this._scrollThumb.y = trackTop + (thumbHeight / 2) + (trackRange * progress);
    }

    destroy() {
        this.scene.input.off('wheel', this._handleWheel);
        this._escKey?.off('down', this._handleEscape);
        this._bKey?.off('down', this._handleToggle);
        this._escKey?.destroy();
        this._bKey?.destroy();
        this._contentMaskSource?.destroy();
        this._root?.destroy(true);
    }
}

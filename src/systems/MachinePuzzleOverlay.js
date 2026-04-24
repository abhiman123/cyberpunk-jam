import * as Phaser from 'phaser';
import { FACTORY_DEBUG, MACHINE_PUZZLE, SOUND_ASSETS, SOUND_VOLUMES } from '../constants/gameConstants.js';

const CELL_WALL = 1;
const EMPTY_PLACED_OFFSET = 10;

function isPlacedCode(value) {
    return value >= EMPTY_PLACED_OFFSET;
}

function normalizeRotationIndex(value) {
    const safeValue = Number.isInteger(value) ? value : 0;
    return ((safeValue % 4) + 4) % 4;
}

function getOrientationForRotationIndex(rotationIndex) {
    return normalizeRotationIndex(rotationIndex) % 2 === 0 ? 'vertical' : 'horizontal';
}

export default class MachinePuzzleOverlay {
    constructor(scene, callbacks = {}) {
        this.scene = scene;
        this._callbacks = callbacks;
        this._machineVariant = null;
        this._puzzleState = null;
        this._cellViews = [];
        this._cellViewMap = new Map();
        this._dominoViews = [];
        this._dominoViewMap = new Map();
        this._activePreviewKeys = [];
        this._dragState = null;
        this._floatingDominoView = null;
        this._tableBounds = null;
        this._currentPulseTween = null;
        this._currentPulseState = null;
        this._powerEffectsSuspended = false;
        this._specialAction = null;
        this._specialActionButtonBg = null;
        this._specialActionButtonText = null;

        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);

        this._build();

        this.scene.input.on('pointermove', this._handlePointerMove);
        this.scene.input.on('pointerup', this._handlePointerUp);
    }

    _build() {
        const panelWidth = MACHINE_PUZZLE.overlayPanelWidth;
        const panelHeight = MACHINE_PUZZLE.overlayPanelHeight;

        this._root = this.scene.add.container(0, 0).setDepth(340).setVisible(false).setAlpha(0);
        this._backdrop = this.scene.add.rectangle(640, 360, 1280, 720, 0x050302, 0.82)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => this._handleBackgroundClick());

        this._panel = this.scene.add.container(640, 360);

        const frame = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x1d1511, 0.98)
            .setStrokeStyle(2, 0xa88a63, 0.95);
        const inner = this.scene.add.rectangle(0, 0, panelWidth - 22, panelHeight - 22, 0x2a1d18, 0.96)
            .setStrokeStyle(1, 0x5f4b3b, 0.85);
        const panelClickCatcher = this.scene.add.rectangle(0, 0, panelWidth - 28, panelHeight - 28, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: false });
        const headerRule = this.scene.add.rectangle(0, -(panelHeight / 2) + 62, panelWidth - 60, 2, 0x7b634a, 0.85);

        panelClickCatcher.on('pointerdown', () => this._handleBackgroundClick());

        this._titleText = this.scene.add.text(0, -(panelHeight / 2) + 34, 'MACHINE GRID', {
            fontFamily: 'Courier New',
            fontSize: '28px',
            color: '#e4d8c4',
            letterSpacing: 3,
        }).setOrigin(0.5);

        this._subtitleText = this.scene.add.text(0, -(panelHeight / 2) + 84, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#d6c1a7',
            align: 'center',
            wordWrap: { width: panelWidth - 120 },
            lineSpacing: 4,
        }).setOrigin(0.5, 0);

        this._gridBoardGfx = this.scene.add.graphics();
        this._groupOutlineGfx = this.scene.add.graphics();
        this._equalLinkGfx = this.scene.add.graphics();
        this._comparatorGfx = this.scene.add.graphics();
        this._tableGfx = this.scene.add.graphics();
        this._currentPulseGfx = this.scene.add.graphics();
        this._gridLayer = this.scene.add.container(0, 0);
        this._groupLabelLayer = this.scene.add.container(0, 0);
        this._comparatorLabelLayer = this.scene.add.container(0, 0);
        this._dominoLayer = this.scene.add.container(0, 0);

        this._messageText = this.scene.add.text(0, (panelHeight / 2) - 126, '', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#ffdca8',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 2,
        }).setOrigin(0.5).setAlpha(0);

        const backButtonBg = this.scene.add.rectangle((panelWidth / 2) - 94, (panelHeight / 2) - 34, 156, 42, 0x3a241d, 1)
            .setStrokeStyle(2, 0xb58a5a, 0.95)
            .setInteractive({ useHandCursor: true });
        const backButtonText = this.scene.add.text((panelWidth / 2) - 94, (panelHeight / 2) - 34, 'GO BACK', {
            fontFamily: 'Courier New',
            fontSize: '17px',
            color: '#f0dfc4',
            letterSpacing: 2,
        }).setOrigin(0.5);

        this._specialActionButtonBg = this.scene.add.rectangle(-(panelWidth / 2) + 112, (panelHeight / 2) - 34, 184, 42, 0x27321f, 1)
            .setStrokeStyle(2, 0xa9d26f, 0.92)
            .setInteractive({ useHandCursor: true })
            .setVisible(false);
        this._specialActionButtonText = this.scene.add.text(-(panelWidth / 2) + 112, (panelHeight / 2) - 34, 'SPECIAL', {
            fontFamily: 'Courier New',
            fontSize: '15px',
            color: '#e7ffd5',
            letterSpacing: 1,
        }).setOrigin(0.5).setVisible(false);

        backButtonBg.on('pointerover', () => backButtonBg.setFillStyle(0x4f2f22, 1));
        backButtonBg.on('pointerout', () => backButtonBg.setFillStyle(0x3a241d, 1));
        backButtonBg.on('pointerdown', () => this.close());
        this._specialActionButtonBg.on('pointerover', () => {
            if (!this._specialAction) return;
            this._specialActionButtonBg.setFillStyle(0x324326, 1);
        });
        this._specialActionButtonBg.on('pointerout', () => {
            if (!this._specialAction) return;
            this._specialActionButtonBg.setFillStyle(0x27321f, 1);
        });
        this._specialActionButtonBg.on('pointerdown', () => this._triggerSpecialAction());

        this._panel.add([
            frame,
            inner,
            panelClickCatcher,
            headerRule,
            this._titleText,
            this._subtitleText,
            this._gridBoardGfx,
            this._groupOutlineGfx,
            this._tableGfx,
            this._currentPulseGfx,
            this._gridLayer,
            this._groupLabelLayer,
            this._comparatorGfx,
            this._comparatorLabelLayer,
            this._dominoLayer,
            this._equalLinkGfx,
            this._messageText,
            this._specialActionButtonBg,
            this._specialActionButtonText,
            backButtonBg,
            backButtonText,
        ]);

        this._root.add([this._backdrop, this._panel]);
    }

    open(machineVariant) {
        if (!machineVariant?.puzzleState?.grid) return;

        this._machineVariant = machineVariant;
        this._puzzleState = machineVariant.puzzleState;

        this._clearDynamic();
        this._layoutPuzzle();

        const subtitle = [
            machineVariant.openingDialogue,
            machineVariant.questionDialogue?.prompt ? `Q: ${machineVariant.questionDialogue.prompt}` : '',
        ].filter(Boolean).join('  //  ');

        this._titleText.setText(`${machineVariant.name.toUpperCase()} GRID`);
        this._subtitleText.setText(subtitle || 'Align the charge cells and clear the unit.');
        this._refreshSpecialAction();

        this._root.setVisible(true);
        this._panel.setScale(0.97);
        this.scene.tweens.killTweensOf([this._root, this._panel]);
        this.scene.tweens.add({ targets: this._root, alpha: 1, duration: 180, ease: 'Quad.Out' });
        this.scene.tweens.add({ targets: this._panel, scaleX: 1, scaleY: 1, duration: 200, ease: 'Back.Out' });
    }

    close(immediate = false) {
        this._cancelInteraction();
        this._clearPreview();

        if (!this._root.visible) return;

        this.scene.tweens.killTweensOf([this._root, this._panel]);
        if (immediate) {
            this._root.setAlpha(0).setVisible(false);
            return;
        }

        this.scene.tweens.add({
            targets: this._root,
            alpha: 0,
            duration: 160,
            ease: 'Quad.In',
            onComplete: () => {
                this._root.setVisible(false);
                this._callbacks.onClose?.(this._machineVariant, this._puzzleState);
            },
        });
        this.scene.tweens.add({ targets: this._panel, scaleX: 0.97, scaleY: 0.97, duration: 160, ease: 'Quad.In' });
    }

    isVisible() {
        return this._root.visible;
    }

    destroy() {
        this.scene.input.off('pointermove', this._handlePointerMove);
        this.scene.input.off('pointerup', this._handlePointerUp);
        this._cancelInteraction();
        this._clearDynamic();
        this._root.destroy(true);
    }

    _clearDynamic() {
        this._clearPreview();
        this._gridBoardGfx.clear();
        this._groupOutlineGfx.clear();
        this._equalLinkGfx.clear();
        this._comparatorGfx.clear();
        this._comparatorLabelLayer?.removeAll(true);
        this._tableGfx.clear();
        this.scene.tweens.killTweensOf(this._currentPulseGfx);
        if (this._currentPulseTween) {
            this._currentPulseTween.stop();
            this._currentPulseTween = null;
        }
        this._currentPulseState = null;
        this._powerEffectsSuspended = false;
        this._currentPulseGfx.setAlpha(1).clear();
        this._messageText?.setAlpha(0);
        this._tableBounds = null;

        this._cellViews.forEach((cell) => {
            cell.previewTween?.stop();
            cell.matchTween?.stop();
            cell.baseRect.destroy();
            cell.matchRect.destroy();
            cell.previewRect.destroy();
            cell.valueText.destroy();
        });
        this._cellViews = [];
        this._cellViewMap.clear();
        this._groupLabelLayer.removeAll(true);

        this._dominoViews.forEach((domino) => domino.container.destroy(true));
        this._dominoViews = [];
        this._dominoViewMap.clear();

        this._gridLayer.removeAll(false);
        this._dominoLayer.removeAll(false);
    }

    _layoutPuzzle() {
        this._buildGridBoard();
        this._buildDominoRack();
        this._refreshAllCells();
        this._refreshAllDominoViews();
    }

    _buildGridBoard() {
        const rows = this._puzzleState.grid.length;
        const cols = Math.max(...this._puzzleState.grid.map((row) => row.length));
        const cellSize = MACHINE_PUZZLE.overlayCellSize;
        const gridWidth = cols * cellSize;
        const gridHeight = rows * cellSize;

        this._gridLeft = -(gridWidth / 2);
        this._gridTop = MACHINE_PUZZLE.overlayGridTopY;
        this._gridWidth = gridWidth;
        this._gridHeight = gridHeight;

        this._gridBoardGfx.fillStyle(0x35261d, 0.96);
        this._gridBoardGfx.fillRoundedRect(
            this._gridLeft - MACHINE_PUZZLE.overlayBoardPadding,
            this._gridTop - MACHINE_PUZZLE.overlayBoardPadding,
            gridWidth + (MACHINE_PUZZLE.overlayBoardPadding * 2),
            gridHeight + (MACHINE_PUZZLE.overlayBoardPadding * 2),
            20,
        );
        this._gridBoardGfx.lineStyle(2, 0x8e6f52, 0.9);
        this._gridBoardGfx.strokeRoundedRect(
            this._gridLeft - MACHINE_PUZZLE.overlayBoardPadding,
            this._gridTop - MACHINE_PUZZLE.overlayBoardPadding,
            gridWidth + (MACHINE_PUZZLE.overlayBoardPadding * 2),
            gridHeight + (MACHINE_PUZZLE.overlayBoardPadding * 2),
            20,
        );

        this._puzzleState.grid.forEach((row, rowIndex) => {
            row.forEach((_value, colIndex) => {
                const x = this._gridLeft + (colIndex * cellSize) + (cellSize / 2);
                const y = this._gridTop + (rowIndex * cellSize) + (cellSize / 2);

                const baseRect = this.scene.add.rectangle(x, y, cellSize - 6, cellSize - 6, 0x000000, 1)
                    .setStrokeStyle(1, 0x66523e, 0.75);
                const matchRect = this.scene.add.rectangle(x, y, cellSize - 12, cellSize - 12, 0xfff1a3, 0)
                    .setStrokeStyle(2, 0xfff7c7, 0);
                const previewRect = this.scene.add.rectangle(x, y, cellSize - 8, cellSize - 8, 0x7fff9d, 0)
                    .setStrokeStyle(1, 0xc8ffdb, 0);
                const valueText = this.scene.add.text(x, y, '', {
                    fontFamily: 'Courier New',
                    fontSize: `${MACHINE_PUZZLE.debugCellFontSize}px`,
                    color: MACHINE_PUZZLE.debugCellTextColor,
                    stroke: '#000000',
                    strokeThickness: 3,
                }).setOrigin(0.5);

                this._gridLayer.add(baseRect);
                this._gridLayer.add(matchRect);
                this._gridLayer.add(previewRect);
                this._gridLayer.add(valueText);

                const cellView = {
                    key: `${rowIndex}:${colIndex}`,
                    row: rowIndex,
                    col: colIndex,
                    baseRect,
                    matchRect,
                    previewRect,
                    valueText,
                    matchTween: null,
                    previewTween: null,
                };

                this._cellViews.push(cellView);
                this._cellViewMap.set(cellView.key, cellView);
            });
        });
    }

    _buildDominoRack() {
        const dominos = this._puzzleState.dominoes || [];
        const count = dominos.length;
        const specialRackBias = dominos.reduce((total, domino) => (
            total + ((domino.variant === 'clown' || domino.variant === 'purple' || domino.variant === 'corrupted') ? 72 : 0)
        ), 0);
        const rackShrinkBias = this._puzzleState.inspectionFault?.status === 'CIRCUIT STOLEN' ? 120 : 0;
        const tableMinWidth = this._puzzleState.inspectionFault?.status === 'CIRCUIT STOLEN'
            ? 400
            : MACHINE_PUZZLE.overlayTableMinWidth;
        const tableWidth = Math.max(tableMinWidth, Math.min(900, (count * 100) + 90 + specialRackBias - rackShrinkBias));
        const tableHeight = 182;
        const tableTop = this._gridTop + this._gridHeight + MACHINE_PUZZLE.overlayTableGap;
        const tableLeft = -(tableWidth / 2);
        const tableCenterY = tableTop + (tableHeight / 2);

        this._tableBounds = {
            left: tableLeft,
            right: tableLeft + tableWidth,
            top: tableTop,
            bottom: tableTop + tableHeight,
        };

        this._tableGfx.fillStyle(0x5b3827, 0.98);
        this._tableGfx.fillRoundedRect(tableLeft, tableTop, tableWidth, tableHeight, 22);
        this._tableGfx.fillStyle(0x734936, 0.9);
        this._tableGfx.fillRoundedRect(tableLeft + 12, tableTop + 12, tableWidth - 24, tableHeight - 24, 18);
        this._tableGfx.fillStyle(0x2b1b14, 0.22);
        for (let lineIndex = 0; lineIndex < 6; lineIndex++) {
            this._tableGfx.fillRect(tableLeft + 20, tableTop + 24 + (lineIndex * 24), tableWidth - 40, 4);
        }
        this._tableGfx.lineStyle(2, 0x9b7058, 0.95);
        this._tableGfx.strokeRoundedRect(tableLeft, tableTop, tableWidth, tableHeight, 22);

        const slotSpacing = count > 1
            ? Math.min(124, (tableWidth - (MACHINE_PUZZLE.overlayTablePadding * 2)) / (count - 1))
            : 0;
        const slotStartX = count > 1 ? -(slotSpacing * (count - 1)) / 2 : 0;
        const slotY = tableCenterY;

        dominos.forEach((dominoState, index) => {
            const slotX = slotStartX + (slotSpacing * index);
            const slotRect = this.scene.add.rectangle(slotX, slotY, MACHINE_PUZZLE.dominoWidth + 18, MACHINE_PUZZLE.dominoHeight + 18, 0x2f2018, 0.5)
                .setStrokeStyle(1, 0x8d6a4f, 0.35);
            this._dominoLayer.add(slotRect);

            if (!dominoState.tablePosition) {
                this._puzzleState.updateDominoTablePosition(dominoState.id, { x: slotX, y: slotY });
            }

            const dominoView = this._createDominoView(dominoState, { x: slotX, y: slotY });
            this._dominoViews.push(dominoView);
            this._dominoViewMap.set(dominoView.id, dominoView);
        });
    }

    _createDominoView(dominoState, slot) {
        const startingPoint = dominoState.tablePosition || slot;
        const container = this.scene.add.container(startingPoint.x, startingPoint.y);
        container.setSize(MACHINE_PUZZLE.dominoWidth + 16, MACHINE_PUZZLE.dominoHeight + 16);

        const hoverGlow = this.scene.add.rectangle(0, 0, MACHINE_PUZZLE.dominoWidth + 24, MACHINE_PUZZLE.dominoHeight + 24, 0xd8ff95, 0)
            .setStrokeStyle(2, 0xf2ffd0, 0);
        const graphics = this.scene.add.graphics();
        const topLabel = this.scene.add.text(0, -(MACHINE_PUZZLE.dominoHeight / 4), '', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#f6d84a',
            stroke: '#24412c',
            strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);
        const centerLabel = this.scene.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#fff3ec',
            stroke: '#3b0909',
            strokeThickness: 3,
            letterSpacing: 1,
        }).setOrigin(0.5).setVisible(false);
        const bottomLabel = this.scene.add.text(0, MACHINE_PUZZLE.dominoHeight / 4, '', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#f6d84a',
            stroke: '#24412c',
            strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);
        const inputZone = this.scene.add.rectangle(
            0,
            0,
            MACHINE_PUZZLE.dominoWidth + (MACHINE_PUZZLE.dominoHitPaddingX * 2),
            MACHINE_PUZZLE.dominoHeight + (MACHINE_PUZZLE.dominoHitPaddingY * 2),
            0xffffff,
            0.001,
        ).setInteractive({ useHandCursor: true });

        container.add([hoverGlow, graphics, topLabel, centerLabel, bottomLabel, inputZone]);
        this._dominoLayer.add(container);

        const dominoView = {
            id: dominoState.id,
            dominoState,
            container,
            inputZone,
            hoverGlow,
            graphics,
            topLabel,
            centerLabel,
            bottomLabel,
            slot,
            previousState: null,
            currentCandidate: null,
            isHovered: false,
            isFloating: false,
        };

        inputZone.on('pointerdown', (pointer) => this._beginPointerIntent(dominoView, pointer));
        inputZone.on('pointerover', () => this._setDominoHover(dominoView, true));
        inputZone.on('pointerout', () => this._setDominoHover(dominoView, false));

        this._applyDominoStateToView(dominoView, false);
        return dominoView;
    }

    _drawDomino(dominoView) {
        const width = MACHINE_PUZZLE.dominoWidth;
        const height = MACHINE_PUZZLE.dominoHeight;
        const { firstGlow, secondGlow, globalGlow } = this._getDominoGlowState(dominoView);
        const emphasisActive = globalGlow || dominoView.isFloating || dominoView.isHovered;
        const isClownDomino = dominoView.dominoState.variant === 'clown';
        const isPurpleDomino = dominoView.dominoState.variant === 'purple';
        const isCorruptedDomino = dominoView.dominoState.variant === 'corrupted';
        const hoverFillColor = isClownDomino || isCorruptedDomino
            ? 0xff9f9a
            : (isPurpleDomino ? 0xd49cff : 0xd8ff95);
        const hoverStrokeColor = isClownDomino || isCorruptedDomino
            ? 0xffe0dc
            : (isPurpleDomino ? 0xf2dcff : 0xf2ffd0);
        const baseFillColor = isClownDomino
            ? 0xb42222
            : (isCorruptedDomino ? 0x8a1515 : (isPurpleDomino ? 0x7d37d6 : 0x2ca55e));
        const baseStrokeColor = emphasisActive
            ? ((isClownDomino || isCorruptedDomino) ? 0xffece8 : (isPurpleDomino ? 0xf4e7ff : 0xf5ffd3))
            : ((isClownDomino || isCorruptedDomino) ? 0xffc1b8 : (isPurpleDomino ? 0xe0c8ff : 0xd7ffde));
        const glossColor = isClownDomino || isCorruptedDomino
            ? 0xffd1c9
            : (isPurpleDomino ? 0xf6ebff : 0xffffff);
        const dividerColor = isClownDomino || isCorruptedDomino
            ? 0x6f1111
            : (isPurpleDomino ? 0x54258f : 0x1d5f33);
        const pipGlowColor = isClownDomino || isCorruptedDomino
            ? 0xffd7d2
            : (isPurpleDomino ? 0xe8c8ff : 0xfff2a3);
        const pipColor = isClownDomino || isCorruptedDomino
            ? 0xfff0eb
            : (isPurpleDomino ? 0xf2dcff : 0xf4d850);

        dominoView.graphics.clear();
        dominoView.hoverGlow.setFillStyle(hoverFillColor, globalGlow ? 0.18 : dominoView.isFloating ? 0.16 : dominoView.isHovered ? 0.12 : 0);
        dominoView.hoverGlow.setStrokeStyle(2, hoverStrokeColor, globalGlow ? 0.75 : dominoView.isFloating ? 0.62 : dominoView.isHovered ? 0.42 : 0);

        dominoView.graphics.fillStyle(0x102214, 0.2);
        dominoView.graphics.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 14);
        dominoView.graphics.fillStyle(baseFillColor, 1);
        dominoView.graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
        dominoView.graphics.lineStyle(2, baseStrokeColor, emphasisActive ? 1 : 0.9);
        dominoView.graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
        dominoView.graphics.fillStyle(glossColor, isClownDomino ? 0.12 : 0.08);
        dominoView.graphics.fillRoundedRect(-(width / 2) + 6, -(height / 2) + 6, width - 12, 18, 10);
        dominoView.graphics.fillStyle(dividerColor, 1);
        dominoView.graphics.fillRect(-(width / 2) + 8, -1, width - 16, 2);

        this._drawPips(dominoView.graphics, dominoView.dominoState.firstOptionAmount, true, firstGlow || globalGlow, pipGlowColor, pipColor);
        this._drawPips(dominoView.graphics, dominoView.dominoState.secondOptionAmount, false, secondGlow || globalGlow, pipGlowColor, pipColor);

        if (isClownDomino) {
            dominoView.graphics.fillStyle(0xfff6f4, 0.9);
            dominoView.graphics.fillCircle(0, 0, 16);
            dominoView.graphics.fillStyle(0x59c3ff, 0.95);
            dominoView.graphics.fillCircle(-6, -4, 3);
            dominoView.graphics.fillCircle(6, -4, 3);
            dominoView.graphics.fillStyle(0xff5252, 0.98);
            dominoView.graphics.fillCircle(0, 1, 4);
            dominoView.graphics.lineStyle(2, 0x7c0c0c, 0.95);
            dominoView.graphics.beginPath();
            dominoView.graphics.moveTo(-7, 8);
            dominoView.graphics.lineTo(0, 12);
            dominoView.graphics.lineTo(7, 8);
            dominoView.graphics.strokePath();
            dominoView.centerLabel.setVisible(true).setText('HA');
        } else if (isCorruptedDomino) {
            dominoView.graphics.lineStyle(3, 0xffd2cd, 0.9);
            dominoView.graphics.beginPath();
            dominoView.graphics.moveTo(-18, -16);
            dominoView.graphics.lineTo(-6, -4);
            dominoView.graphics.lineTo(-14, 6);
            dominoView.graphics.lineTo(-2, 18);
            dominoView.graphics.strokePath();
            dominoView.graphics.beginPath();
            dominoView.graphics.moveTo(16, -18);
            dominoView.graphics.lineTo(4, -2);
            dominoView.graphics.lineTo(14, 8);
            dominoView.graphics.lineTo(2, 18);
            dominoView.graphics.strokePath();
            dominoView.centerLabel.setVisible(true).setText('ERR');
        } else if (isPurpleDomino) {
            dominoView.centerLabel.setVisible(true).setText('PWR');
        } else {
            dominoView.centerLabel.setVisible(false).setText('');
        }

        if (dominoView.dominoState.firstOptionAmount > 9) {
            dominoView.topLabel.setVisible(true).setText(String(dominoView.dominoState.firstOptionAmount));
        } else {
            dominoView.topLabel.setVisible(false);
        }

        if (dominoView.dominoState.secondOptionAmount > 9) {
            dominoView.bottomLabel.setVisible(true).setText(String(dominoView.dominoState.secondOptionAmount));
        } else {
            dominoView.bottomLabel.setVisible(false);
        }
    }

    _drawPips(graphics, count, isTopHalf, shouldGlow, glowColor = 0xfff2a3, pipColor = 0xf4d850) {
        if (!count || count <= 0) return;

        // Traditional NYT-style domino pip arrangements.
        // Coordinates are offsets within a single half-tile (approximately
        // 56×56 px) centered on the section center.
        const dx = 14;
        const dy = 14;
        const pipLayouts = {
            1: [{ x: 0, y: 0 }],
            2: [{ x: -dx, y: -dy }, { x: dx, y: dy }],
            3: [{ x: -dx, y: -dy }, { x: 0, y: 0 }, { x: dx, y: dy }],
            4: [
                { x: -dx, y: -dy }, { x: dx, y: -dy },
                { x: -dx, y: dy }, { x: dx, y: dy },
            ],
            5: [
                { x: -dx, y: -dy }, { x: dx, y: -dy },
                { x: 0, y: 0 },
                { x: -dx, y: dy }, { x: dx, y: dy },
            ],
            6: [
                { x: -dx, y: -dy }, { x: dx, y: -dy },
                { x: -dx, y: 0 }, { x: dx, y: 0 },
                { x: -dx, y: dy }, { x: dx, y: dy },
            ],
        };

        const positions = pipLayouts[Math.min(6, Math.max(1, Math.floor(count)))] || [];
        if (positions.length === 0) return;

        const sectionOffsetY = isTopHalf ? -(MACHINE_PUZZLE.dominoHeight / 4) : (MACHINE_PUZZLE.dominoHeight / 4);
        const pipRadius = 5.5;
        const outerRadius = pipRadius + 1.5;

        if (shouldGlow) {
            graphics.fillStyle(glowColor, 0.4);
            positions.forEach((pip) => {
                graphics.fillCircle(pip.x, sectionOffsetY + pip.y, pipRadius + 4);
            });
        }

        // Outer ring for a crisp NYT-style edge.
        graphics.fillStyle(0x000000, 0.35);
        positions.forEach((pip) => {
            graphics.fillCircle(pip.x, sectionOffsetY + pip.y + 1, outerRadius);
        });

        // Pip core.
        graphics.fillStyle(pipColor, 1);
        positions.forEach((pip) => {
            graphics.fillCircle(pip.x, sectionOffsetY + pip.y, pipRadius);
        });

        // Highlight for depth.
        graphics.fillStyle(0xffffff, 0.35);
        positions.forEach((pip) => {
            graphics.fillCircle(pip.x - 1.4, sectionOffsetY + pip.y - 1.4, pipRadius / 3);
        });
    }

    _getDominoGlowState(dominoView) {
        const evaluation = this._puzzleState.getEvaluation();
        const firstCell = dominoView.dominoState.placedCells.find((cell) => cell.half === 'first');
        const secondCell = dominoView.dominoState.placedCells.find((cell) => cell.half === 'second');

        return {
            firstGlow: !this._powerEffectsSuspended && Boolean(firstCell?.matchesCharge || firstCell?.matchesEquality || firstCell?.matchesGroup),
            secondGlow: !this._powerEffectsSuspended && Boolean(secondCell?.matchesCharge || secondCell?.matchesEquality || secondCell?.matchesGroup),
            globalGlow: !this._powerEffectsSuspended && (evaluation.solved || dominoView.dominoState.isFullyGlowing),
        };
    }

    _rotateDominoInPlace(dominoView, keepFloating = false) {
        if (!this.isVisible()) return;

        const nextRotationIndex = normalizeRotationIndex(this._getDominoRotationIndex(dominoView.dominoState) + 1);
        const targetAngle = this._getDominoTargetAngle(nextRotationIndex);
        this._setDominoRotation(dominoView, nextRotationIndex);
        this._drawDomino(dominoView);
        this._animateDominoAngle(dominoView, dominoView.container.angle + 90, targetAngle);
        this._playPuzzleSound(SOUND_ASSETS.fuseRotate, SOUND_ASSETS.inspectionReveal, SOUND_VOLUMES.puzzleRotate);

        if (keepFloating) {
            this._floatingDominoView = dominoView;
            dominoView.isFloating = true;
            this._updateFloatingCandidate(dominoView);
            return;
        }

        this._applyDominoVisualScale(dominoView);
    }

    _handleBackgroundClick() {
        if (!this.isVisible() || this._dragState) return;
        if (!this._floatingDominoView) return;

        this._restoreDomino(this._floatingDominoView);
    }

    _beginPointerIntent(dominoView, pointer) {
        if (!this.isVisible()) return;
        if (this._dragState && this._dragState.pointerId !== pointer.id) return;

        this._snapDominoRotationToClosestAngle(dominoView);

        if (this._floatingDominoView && this._floatingDominoView !== dominoView) {
            this._restoreDomino(this._floatingDominoView);
        }

        const localX = pointer.worldX - this._panel.x;
        const localY = pointer.worldY - this._panel.y;
        const startedFromTable = this._isDominoOnTable(dominoView);
        const wasFloatingAtPointerDown = this._floatingDominoView === dominoView;

        if (!startedFromTable && !wasFloatingAtPointerDown) {
            this._liftDominoFromGrid(dominoView);
        }

        this._setDominoHover(dominoView, true);

        this._dragState = {
            dominoView,
            pointerId: pointer.id,
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            offsetX: localX - dominoView.container.x,
            offsetY: localY - dominoView.container.y,
            dragging: false,
            startedFromTable,
            wasFloatingAtPointerDown,
        };
    }

    _handlePointerMove(pointer) {
        if (!this.isVisible() || !this._dragState || this._dragState.pointerId !== pointer.id) return;

        const dragDistance = Phaser.Math.Distance.Between(
            pointer.worldX,
            pointer.worldY,
            this._dragState.startWorldX,
            this._dragState.startWorldY,
        );

        if (!this._dragState.dragging && dragDistance >= MACHINE_PUZZLE.dragStartDistancePx) {
            this._dragState.dragging = true;
            this._beginDominoDrag(this._dragState.dominoView);
        }

        if (!this._dragState.dragging) return;

        const localX = pointer.worldX - this._panel.x;
        const localY = pointer.worldY - this._panel.y;
        const targetX = localX - this._dragState.offsetX;
        const targetY = localY - this._dragState.offsetY;
        this._dragDomino(this._dragState.dominoView, targetX, targetY);
    }

    _handlePointerUp(pointer) {
        if (!this.isVisible()) {
            this._dragState = null;
            return;
        }
        if (!this._dragState || this._dragState.pointerId !== pointer.id) return;

        const { dominoView, dragging, startedFromTable, wasFloatingAtPointerDown } = this._dragState;
        this._dragState = null;

        if (dragging) {
            this._endDominoDrag(dominoView);
            return;
        }

        if (startedFromTable) {
            this._rotateDominoInPlace(dominoView, false);
            return;
        }

        if (wasFloatingAtPointerDown) {
            this._rotateDominoInPlace(dominoView, true);
            return;
        }

        this._updateFloatingCandidate(dominoView);
    }

    _liftDominoFromGrid(dominoView) {
        dominoView.previousState = {
            x: dominoView.container.x,
            y: dominoView.container.y,
            rotationIndex: this._getDominoRotationIndex(dominoView.dominoState),
            orientation: dominoView.dominoState.orientation,
            anchor: dominoView.dominoState.anchor ? { ...dominoView.dominoState.anchor } : null,
            placedCells: dominoView.dominoState.placedCells.map((cell) => ({ ...cell })),
            tablePosition: dominoView.dominoState.tablePosition ? { ...dominoView.dominoState.tablePosition } : null,
        };

        if (dominoView.dominoState.placedCells.length > 0) {
            this._setPowerEffectsSuspended(true);
            this._clearDominoPlacement(dominoView);
        }

        dominoView.isFloating = true;
        this._floatingDominoView = dominoView;
        this.scene.tweens.killTweensOf(dominoView.container);
        this._dominoLayer.bringToTop(dominoView.container);
        this._applyDominoVisualScale(dominoView);
        this._updateFloatingCandidate(dominoView);
    }

    _beginDominoDrag(dominoView) {
        this._snapDominoRotationToClosestAngle(dominoView);

        if (!dominoView.previousState) {
            dominoView.previousState = {
                x: dominoView.container.x,
                y: dominoView.container.y,
                rotationIndex: this._getDominoRotationIndex(dominoView.dominoState),
                orientation: dominoView.dominoState.orientation,
                anchor: dominoView.dominoState.anchor ? { ...dominoView.dominoState.anchor } : null,
                placedCells: dominoView.dominoState.placedCells.map((cell) => ({ ...cell })),
                tablePosition: dominoView.dominoState.tablePosition ? { ...dominoView.dominoState.tablePosition } : null,
            };
        }

        if (dominoView.dominoState.placedCells.length > 0) {
            this._setPowerEffectsSuspended(true);
            this._clearDominoPlacement(dominoView);
        }

        dominoView.isFloating = true;
        this._floatingDominoView = dominoView;
        this.scene.tweens.killTweensOf(dominoView.container);
        this._dominoLayer.bringToTop(dominoView.container);
        this._applyDominoVisualScale(dominoView);
    }

    _updateFloatingCandidate(dominoView) {
        if (!dominoView?.isFloating) return;
        this._dragDomino(dominoView, dominoView.container.x, dominoView.container.y);
    }

    _dragDomino(dominoView, targetX, targetY) {
        dominoView.container.x = targetX;
        dominoView.container.y = targetY;
        dominoView.isFloating = true;
        this._floatingDominoView = dominoView;

        const candidate = this._candidateFromLocalPoint(dominoView, targetX, targetY);
        const validation = this._validateCandidate(candidate);

        const previewCells = validation.valid
            ? candidate.cells
            : candidate.cells.filter((cell) => this._isWithinBounds(cell.row, cell.col));

        this._applyPreview(previewCells, validation.valid);
        dominoView.currentCandidate = { ...candidate, valid: validation.valid, reason: validation.reason };
        this._applyDominoVisualScale(dominoView);
    }

    _endDominoDrag(dominoView) {
        this._commitFloatingDomino(dominoView);
    }

    _commitFloatingDomino(dominoView) {
        if (!dominoView) return;

        const candidate = dominoView.currentCandidate;
        const droppedOnTable = this._isPointOverTable(dominoView.container.x, dominoView.container.y);
        this._clearPreview();

        if (candidate?.valid) {
            this._setPowerEffectsSuspended(false);
            this._placeDomino(dominoView, candidate, true);
            this._showMessage('Domino locked into the grid.');
        } else if (droppedOnTable) {
            this._setPowerEffectsSuspended(false);
            this._returnDominoToTable(dominoView);
            this._showMessage('Domino returned to the rack.');
        } else {
            this._setPowerEffectsSuspended(false);
            this._restoreDomino(dominoView);
            const errorMessage = candidate?.reason === 'occupied'
                ? 'That placement overlaps another live cell.'
                : 'Placement out of bounds. Domino returned.';
            this._showMessage(errorMessage);
        }

        dominoView.currentCandidate = null;
    }

    _restoreDomino(dominoView) {
        const previousState = dominoView.previousState;
        if (!previousState) {
            this._clearFloatingState(dominoView);
            return;
        }

        this._setDominoRotation(dominoView, previousState.rotationIndex);
        this._animateDominoAngle(dominoView, this._getDominoTargetAngle(previousState.rotationIndex));

        if (previousState.anchor && previousState.placedCells.length > 0) {
            const restoreCandidate = this._createCandidateFromAnchor(previousState.rotationIndex, previousState.anchor.row, previousState.anchor.col);
            this._placeDomino(dominoView, restoreCandidate, false);
            return;
        }

        this._puzzleState.updateDominoTablePosition(dominoView.id, {
            x: previousState.x,
            y: previousState.y,
        });
        dominoView.dominoState.anchor = null;
        dominoView.dominoState.placedCells = [];
        dominoView.previousState = null;
        this._clearFloatingState(dominoView);
        this._refreshAllDominoViews();
        this.scene.tweens.add({
            targets: dominoView.container,
            x: previousState.x,
            y: previousState.y,
            duration: MACHINE_PUZZLE.dominoReturnMs,
            ease: 'Back.Out',
        });
    }

    _returnDominoToTable(dominoView) {
        this._puzzleState.updateDominoTablePosition(dominoView.id, { ...dominoView.slot });
        dominoView.dominoState.anchor = null;
        dominoView.dominoState.placedCells = [];
        dominoView.previousState = null;
        this._clearFloatingState(dominoView);
        this._refreshAllCells();
        this._refreshAllDominoViews();
        this.scene.tweens.add({
            targets: dominoView.container,
            x: dominoView.slot.x,
            y: dominoView.slot.y,
            duration: MACHINE_PUZZLE.dominoReturnMs,
            ease: 'Back.Out',
        });
    }

    _placeDomino(dominoView, candidate, animated) {
        const previousEvaluation = this._puzzleState.getEvaluation();
        const previousMatchedGroups = new Set(
            this._puzzleState.getChargeGroupSummaries()
                .filter((group) => group.matched)
                .map((group) => group.key)
        );
        const previousCellMatches = candidate.cells.map((cell) => ({
            row: cell.row,
            col: cell.col,
            charge: this._puzzleState.isChargeMatched(cell.row, cell.col),
            equality: this._puzzleState.isEqualMatched(cell.row, cell.col),
        }));

        candidate.rotationIndex = this._getDominoRotationIndex(dominoView.dominoState);
        candidate.orientation = dominoView.dominoState.orientation;
        this._puzzleState.placeDomino(dominoView.id, candidate);
        this._clearFloatingState(dominoView);
        dominoView.previousState = null;
        this._refreshAllCells();
        this._refreshAllDominoViews();

        this.scene.tweens.add({
            targets: dominoView.container,
            x: candidate.snapX,
            y: candidate.snapY,
            duration: animated ? MACHINE_PUZZLE.dominoSnapMs : 1,
            ease: animated ? 'Back.Out' : 'Linear',
        });

        const nextEvaluation = this._puzzleState.getEvaluation();
        const hasNewEquality = candidate.cells.some((cell) => {
            const before = previousCellMatches.find((entry) => entry.row === cell.row && entry.col === cell.col);
            return this._puzzleState.isEqualMatched(cell.row, cell.col) && !before?.equality;
        });
        const hasNewCharge = candidate.cells.some((cell) => {
            const before = previousCellMatches.find((entry) => entry.row === cell.row && entry.col === cell.col);
            return this._puzzleState.isChargeMatched(cell.row, cell.col) && !before?.charge;
        });
        const hasNewGroup = this._puzzleState.getChargeGroupSummaries().some((group) => group.matched && !previousMatchedGroups.has(group.key));
        const solvedNow = nextEvaluation.solved && !previousEvaluation.solved;

        this._flashPlacement(candidate.cells);
        this._playPlacementCurrent(candidate.cells, { boosted: hasNewCharge || hasNewEquality || hasNewGroup || solvedNow });
        this._notifyGridChanged();
        this._playPuzzleSound(SOUND_ASSETS.circuitLock, SOUND_ASSETS.inspectionReveal, SOUND_VOLUMES.puzzleLock);
        if (hasNewCharge || hasNewGroup || solvedNow) {
            this._playPuzzleSound(SOUND_ASSETS.circuitPower, SOUND_ASSETS.puzzleFixed, SOUND_VOLUMES.puzzlePower);
        } else if (hasNewEquality) {
            this._playPuzzleSound(SOUND_ASSETS.fuseConnect, SOUND_ASSETS.puzzleFixed, SOUND_VOLUMES.puzzleConnect);
        }
    }

    _clearDominoPlacement(dominoView) {
        if (dominoView.dominoState.placedCells.length === 0) return;

        this._puzzleState.clearDominoPlacement(dominoView.id);
        this._refreshAllCells();
        this._refreshAllDominoViews();
        this._notifyGridChanged();
    }

    _animateDominoAngle(dominoView, targetAngle = null, finalAngle = null) {
        this.scene.tweens.killTweensOf(dominoView.container);
        this.scene.tweens.add({
            targets: dominoView.container,
            angle: targetAngle ?? this._getDominoTargetAngle(this._getDominoRotationIndex(dominoView.dominoState)),
            duration: MACHINE_PUZZLE.dominoRotationMs,
            ease: 'Sine.Out',
            onComplete: () => {
                if (finalAngle !== null) {
                    dominoView.container.angle = finalAngle;
                }
            },
        });
    }

    _candidateFromLocalPoint(dominoView, localX, localY) {
        const rotationIndex = this._getDominoRotationIndex(dominoView.dominoState);
        const orientation = getOrientationForRotationIndex(rotationIndex);
        const cellSize = MACHINE_PUZZLE.overlayCellSize;

        if (orientation === 'vertical') {
            const col = Math.round((localX - this._gridLeft) / cellSize - 0.5);
            const row = Math.round((localY - this._gridTop) / cellSize - 1);
            return this._createCandidateFromAnchor(rotationIndex, row, col);
        }

        const col = Math.round((localX - this._gridLeft) / cellSize - 1);
        const row = Math.round((localY - this._gridTop) / cellSize - 0.5);
        return this._createCandidateFromAnchor(rotationIndex, row, col);
    }

    _createCandidateFromAnchor(rotationOrOrientation, row, col) {
        const rotationIndex = normalizeRotationIndex(
            Number.isInteger(rotationOrOrientation)
                ? rotationOrOrientation
                : (rotationOrOrientation === 'horizontal' ? 1 : 0)
        );
        const orientation = getOrientationForRotationIndex(rotationIndex);
        const cellSize = MACHINE_PUZZLE.overlayCellSize;

        if (rotationIndex === 0) {
            return {
                anchor: { row, col },
                cells: [
                    { row, col },
                    { row: row + 1, col },
                ],
                rotationIndex,
                orientation,
                snapX: this._gridLeft + ((col + 0.5) * cellSize),
                snapY: this._gridTop + ((row + 1) * cellSize),
            };
        }

        if (rotationIndex === 1) {
            return {
                anchor: { row, col },
                cells: [
                    { row, col: col + 1 },
                    { row, col },
                ],
                rotationIndex,
                orientation,
                snapX: this._gridLeft + ((col + 1) * cellSize),
                snapY: this._gridTop + ((row + 0.5) * cellSize),
            };
        }

        if (rotationIndex === 2) {
            return {
                anchor: { row, col },
                cells: [
                    { row: row + 1, col },
                    { row, col },
                ],
                rotationIndex,
                orientation,
                snapX: this._gridLeft + ((col + 0.5) * cellSize),
                snapY: this._gridTop + ((row + 1) * cellSize),
            };
        }

        return {
            anchor: { row, col },
            cells: [
                { row, col },
                { row, col: col + 1 },
            ],
            rotationIndex,
            orientation,
            snapX: this._gridLeft + ((col + 1) * cellSize),
            snapY: this._gridTop + ((row + 0.5) * cellSize),
        };
    }

    _validateCandidate(candidate) {
        for (const cell of candidate.cells) {
            if (!this._isWithinBounds(cell.row, cell.col)) {
                return { valid: false, reason: 'bounds' };
            }

            if (!this._puzzleState.canOccupyCell(cell.row, cell.col)) {
                return { valid: false, reason: 'occupied' };
            }
        }

        return { valid: true, reason: null };
    }

    _isWithinBounds(row, col) {
        return row >= 0
            && col >= 0
            && row < this._puzzleState.grid.length
            && col < this._puzzleState.grid[row].length;
    }

    _refreshAllCells() {
        this._chargeGroupSummaries = this._puzzleState.getChargeGroupSummaries();
        this._chargeGroupSummaryMap = new Map(this._chargeGroupSummaries.map((group) => [group.key, group]));
        this._cellViews.forEach((cellView) => this._refreshCell(cellView));
        this._refreshChargeGroupOutlines();
        this._refreshEqualLinkLines();
        this._refreshComparatorBadges();
    }

    _refreshAllDominoViews() {
        this._dominoViews.forEach((dominoView) => this._drawDomino(dominoView));
    }

    _refreshCell(cellView) {
        const baseValue = this._puzzleState.getBaseCellValue(cellView.row, cellView.col);
        const value = this._puzzleState.getCurrentCellValue(cellView.row, cellView.col);
        const chargeLevel = this._puzzleState.getChargeLevel(cellView.row, cellView.col);
        const isMatchedCharge = !this._powerEffectsSuspended && this._puzzleState.isChargeMatched(cellView.row, cellView.col);
        const hasEqualLink = this._puzzleState.isEqualLinkCell(cellView.row, cellView.col);
        const isMatchedEqualLink = !this._powerEffectsSuspended && this._puzzleState.isEqualMatched(cellView.row, cellView.col);
        const hasNotEqualLink = this._puzzleState.isNotEqualLinkCell?.(cellView.row, cellView.col);
        const isMatchedNotEqualLink = !this._powerEffectsSuspended && Boolean(this._puzzleState.isNotEqualMatched?.(cellView.row, cellView.col));
        const hasComparator = Boolean(this._puzzleState.isComparatorCell?.(cellView.row, cellView.col));
        const isMatchedComparator = !this._powerEffectsSuspended && Boolean(this._puzzleState.isComparatorMatched?.(cellView.row, cellView.col));
        const chargeGroup = this._puzzleState.getChargeGroupAt(cellView.row, cellView.col);
        const chargeGroupSummary = chargeGroup ? this._chargeGroupSummaryMap?.get(chargeGroup.key) : null;
        const isMatchedGroup = !this._powerEffectsSuspended && Boolean(chargeGroupSummary?.matched);
        const isPlaced = isPlacedCode(value);
        const inspectionFault = this._puzzleState.inspectionFault
            && Number.isInteger(this._puzzleState.inspectionFault.row)
            && Number.isInteger(this._puzzleState.inspectionFault.col)
            && this._puzzleState.inspectionFault.row === cellView.row
            && this._puzzleState.inspectionFault.col === cellView.col
            ? this._puzzleState.inspectionFault
            : null;
        const clownCorrupted = Boolean(this._puzzleState.clownCorruption);

        let fillColor = 0x2c241f;
        let strokeColor = 0x6a5643;

        if (inspectionFault) {
            fillColor = inspectionFault.kind === 'hazard' ? 0x5d241f : 0x4f341f;
            strokeColor = inspectionFault.kind === 'hazard' ? 0xff8e7f : 0xffd08a;
        } else if (baseValue === CELL_WALL) {
            // NYT-style: walls are the negative space around the board — hide
            // the cell rectangle entirely so the shape's outline reads clearly.
            cellView.baseRect.setFillStyle(0x000000, 0);
            cellView.baseRect.setStrokeStyle(0, 0x000000, 0);
            cellView.matchRect.setFillStyle(0x000000, 0);
            cellView.matchRect.setStrokeStyle(0, 0x000000, 0);
            cellView.previewRect.setFillStyle(0x000000, 0);
            cellView.previewRect.setStrokeStyle(0, 0x000000, 0);
            cellView.valueText.setText('');
            return;
        } else if (chargeLevel > 0) {
            fillColor = isMatchedCharge ? 0x7e8832 : 0x4d5a2f;
            strokeColor = isMatchedCharge ? 0xfff0b5 : 0xe0dc92;
        } else if (chargeGroupSummary) {
            fillColor = isMatchedGroup
                ? 0x55793a
                : isPlaced
                    ? 0x30595a
                    : 0x2b3742;
            strokeColor = isMatchedGroup ? 0xe8ffb3 : 0xbad6e2;
        } else if (hasEqualLink) {
            fillColor = isMatchedEqualLink
                ? 0x8a7e31
                : isPlaced
                    ? 0x285e67
                    : 0x2d3f49;
            strokeColor = isMatchedEqualLink ? 0xffefad : 0xe6d987;
        } else if (hasNotEqualLink) {
            fillColor = isMatchedNotEqualLink
                ? 0x794033
                : isPlaced
                    ? 0x683128
                    : 0x3c2725;
            strokeColor = isMatchedNotEqualLink ? 0xffc7b0 : 0xff9b86;
        } else if (hasComparator) {
            const cmp = this._puzzleState.getComparator(cellView.row, cellView.col);
            const isLessThan = cmp?.op === '<';
            if (isMatchedComparator) {
                fillColor = isLessThan ? 0x2f5a78 : 0x6a3f72;
            } else if (isPlaced) {
                fillColor = isLessThan ? 0x1d3d55 : 0x452451;
            } else {
                fillColor = isLessThan ? 0x1b2a38 : 0x2d1f36;
            }
            strokeColor = isMatchedComparator
                ? (isLessThan ? 0xbfe3ff : 0xf4c0ff)
                : (isLessThan ? 0x7ea9c6 : 0xb27ec7);
        } else if (isPlaced) {
            fillColor = 0x39af67;
            strokeColor = 0xe8f9b9;
        }

        if (clownCorrupted && baseValue !== CELL_WALL && !inspectionFault) {
            fillColor = isPlaced ? 0x9f2525 : 0x5d1919;
            strokeColor = 0xffa39c;
        }

        cellView.baseRect.setFillStyle(fillColor, 1);
        cellView.baseRect.setStrokeStyle(1, strokeColor, 0.9);

        if (cellView.matchTween) {
            cellView.matchTween.stop();
            cellView.matchTween = null;
        }

        if (isMatchedCharge || isMatchedEqualLink || isMatchedNotEqualLink || isMatchedGroup || isMatchedComparator) {
            cellView.matchRect.setFillStyle(0xfff1a3, 0.18).setStrokeStyle(2, 0xfff7c7, 0.75).setAlpha(0.45);
            cellView.matchTween = this.scene.tweens.add({
                targets: cellView.matchRect,
                alpha: 0.82,
                duration: 280,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
        } else {
            cellView.matchRect.setAlpha(0).setStrokeStyle(2, 0xfff7c7, 0);
        }

        const shouldShowDebug = FACTORY_DEBUG.enabled && FACTORY_DEBUG.showPuzzleGridValues;
        if (inspectionFault) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText(inspectionFault.type === 'corrupted-marker' ? String(inspectionFault.glyph || '?') : '!');
            cellView.valueText.setColor(inspectionFault.kind === 'hazard' ? '#ffd0c9' : '#ffe2aa');
        } else if (chargeLevel > 0) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText(String(chargeLevel));
            cellView.valueText.setColor(isMatchedCharge ? '#fff6b8' : '#ffe784');
        } else if (chargeGroupSummary) {
            cellView.valueText.setVisible(false);
            cellView.valueText.setText('');
        } else if (hasEqualLink) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText('=');
            cellView.valueText.setColor(isMatchedEqualLink ? '#fff6b8' : '#ffe784');
        } else if (hasNotEqualLink) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText('!=');
            cellView.valueText.setColor(isMatchedNotEqualLink ? '#ffd9c9' : '#ffab92');
        } else if (hasComparator) {
            // Per-cell <N / >N badges are drawn by _refreshComparatorBadges
            // as diamond overlays; keep the base valueText hidden.
            cellView.valueText.setVisible(false);
            cellView.valueText.setText('');
        } else if (shouldShowDebug) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText(String(value));
            cellView.valueText.setColor(MACHINE_PUZZLE.debugCellTextColor);
        } else {
            cellView.valueText.setVisible(false);
            cellView.valueText.setText('');
        }
    }

    _refreshChargeGroupOutlines() {
        this._groupOutlineGfx.clear();
        this._groupLabelLayer.removeAll(true);

        (this._chargeGroupSummaries || []).forEach((group) => {
            const groupKeys = new Set(group.cells.map((cell) => `${cell.row}:${cell.col}`));
            const glowColor = group.matched ? 0xf2ffd1 : 0xb8d5e1;
            const lineColor = group.matched ? 0xe4ffad : 0x9ec4d5;
            const cellSize = MACHINE_PUZZLE.overlayCellSize;
            const corruptedMarker = this._puzzleState.inspectionFault?.type === 'corrupted-marker'
                && this._puzzleState.inspectionFault?.markerType === 'group'
                && this._puzzleState.inspectionFault?.markerKey === group.key
                ? this._puzzleState.inspectionFault
                : null;
            const groupCenter = group.cells.reduce((center, cell) => {
                center.x += this._gridLeft + (cell.col * cellSize) + (cellSize / 2);
                center.y += this._gridTop + (cell.row * cellSize) + (cellSize / 2);
                return center;
            }, { x: 0, y: 0 });
            groupCenter.x /= Math.max(1, group.cells.length);
            groupCenter.y /= Math.max(1, group.cells.length);

            this._groupOutlineGfx.lineStyle(6, glowColor, group.matched ? 0.18 : 0.1);
            group.cells.forEach((cell) => {
                const left = this._gridLeft + (cell.col * cellSize);
                const top = this._gridTop + (cell.row * cellSize);
                const right = left + cellSize;
                const bottom = top + cellSize;

                if (!groupKeys.has(`${cell.row - 1}:${cell.col}`)) {
                    this._groupOutlineGfx.lineBetween(left, top, right, top);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col + 1}`)) {
                    this._groupOutlineGfx.lineBetween(right, top, right, bottom);
                }
                if (!groupKeys.has(`${cell.row + 1}:${cell.col}`)) {
                    this._groupOutlineGfx.lineBetween(left, bottom, right, bottom);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col - 1}`)) {
                    this._groupOutlineGfx.lineBetween(left, top, left, bottom);
                }
            });

            this._groupOutlineGfx.lineStyle(2, lineColor, 0.92);
            group.cells.forEach((cell) => {
                const left = this._gridLeft + (cell.col * cellSize);
                const top = this._gridTop + (cell.row * cellSize);
                const right = left + cellSize;
                const bottom = top + cellSize;

                if (!groupKeys.has(`${cell.row - 1}:${cell.col}`)) {
                    this._groupOutlineGfx.lineBetween(left, top, right, top);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col + 1}`)) {
                    this._groupOutlineGfx.lineBetween(right, top, right, bottom);
                }
                if (!groupKeys.has(`${cell.row + 1}:${cell.col}`)) {
                    this._groupOutlineGfx.lineBetween(left, bottom, right, bottom);
                }
                if (!groupKeys.has(`${cell.row}:${cell.col - 1}`)) {
                    this._groupOutlineGfx.lineBetween(left, top, left, bottom);
                }
            });

            const label = this.scene.add.text(groupCenter.x, groupCenter.y, corruptedMarker ? String(corruptedMarker.glyph || '#') : group.displayTarget, {
                fontFamily: 'Courier New',
                fontSize: '19px',
                color: corruptedMarker ? '#ffd7ab' : (group.matched ? '#f3ffd5' : '#d9eef7'),
                stroke: '#000000',
                strokeThickness: 3,
            }).setOrigin(0.5);
            this._groupLabelLayer.add(label);
        });
    }

    _refreshEqualLinkLines() {
        this._equalLinkGfx.clear();

        const drawGoldRod = (start, end, isMatched, options = {}) => {
            const haloColor = options.haloColor ?? (isMatched ? 0xfff7c8 : 0xffe39a);
            const coreColor = options.coreColor ?? (isMatched ? 0xfff0a8 : 0xf2c34a);
            const capColor = options.capColor ?? (isMatched ? 0xffffff : 0xffe9a8);
            const haloAlpha = isMatched ? 0.55 : 0.28;
            const coreAlpha = isMatched ? 1 : 0.92;
            const haloWidth = isMatched ? 14 : 11;
            const coreWidth = isMatched ? 8 : 6;

            // outer halo
            this._equalLinkGfx.lineStyle(haloWidth, haloColor, haloAlpha);
            this._equalLinkGfx.lineBetween(start.x, start.y, end.x, end.y);

            // solid gold core
            this._equalLinkGfx.lineStyle(coreWidth, coreColor, coreAlpha);
            this._equalLinkGfx.lineBetween(start.x, start.y, end.x, end.y);

            // rod end-caps
            const capRadius = Math.ceil(coreWidth / 2);
            this._equalLinkGfx.fillStyle(capColor, coreAlpha);
            this._equalLinkGfx.fillCircle(start.x, start.y, capRadius);
            this._equalLinkGfx.fillCircle(end.x, end.y, capRadius);
            this._equalLinkGfx.fillStyle(coreColor, coreAlpha);
            this._equalLinkGfx.fillCircle(start.x, start.y, Math.max(1, capRadius - 1));
            this._equalLinkGfx.fillCircle(end.x, end.y, Math.max(1, capRadius - 1));
        };

        this._puzzleState.getEqualLinkPairs().forEach((pair) => {
            const isMatched = !this._powerEffectsSuspended && pair.matched;
            const start = this._getCellCenter(pair.a.row, pair.a.col);
            const end = this._getCellCenter(pair.b.row, pair.b.col);
            drawGoldRod(start, end, isMatched);

            // center "=" badge so players read the constraint as a constraint
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            const badgeR = isMatched ? 9 : 8;
            const badgeColor = isMatched ? 0x332a12 : 0x2a2210;
            const badgeStroke = isMatched ? 0xfff7c8 : 0xffdf85;
            this._equalLinkGfx.fillStyle(badgeColor, 0.92);
            this._equalLinkGfx.fillCircle(midX, midY, badgeR);
            this._equalLinkGfx.lineStyle(2, badgeStroke, 1);
            this._equalLinkGfx.strokeCircle(midX, midY, badgeR);
            this._equalLinkGfx.lineStyle(2, badgeStroke, 1);
            this._equalLinkGfx.lineBetween(midX - 4, midY - 2, midX + 4, midY - 2);
            this._equalLinkGfx.lineBetween(midX - 4, midY + 2, midX + 4, midY + 2);
        });

        this._puzzleState.getNotEqualLinkPairs?.().forEach((pair) => {
            const isMatched = !this._powerEffectsSuspended && pair.matched;
            const start = this._getCellCenter(pair.a.row, pair.a.col);
            const end = this._getCellCenter(pair.b.row, pair.b.col);
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            drawGoldRod(start, end, isMatched, {
                haloColor: isMatched ? 0xffe0d1 : 0xffb19c,
                coreColor: isMatched ? 0xffc9b7 : 0xff8b76,
                capColor: isMatched ? 0xffffff : 0xffd0c0,
            });

            // X badge for inequality
            const badgeR = isMatched ? 9 : 8;
            const badgeColor = isMatched ? 0x301810 : 0x241108;
            const badgeStroke = isMatched ? 0xffe0d1 : 0xff8b76;
            this._equalLinkGfx.fillStyle(badgeColor, 0.92);
            this._equalLinkGfx.fillCircle(midX, midY, badgeR);
            this._equalLinkGfx.lineStyle(2, badgeStroke, 1);
            this._equalLinkGfx.strokeCircle(midX, midY, badgeR);
            this._equalLinkGfx.lineStyle(2, badgeStroke, 1);
            this._equalLinkGfx.lineBetween(midX - 4, midY - 4, midX + 4, midY + 4);
            this._equalLinkGfx.lineBetween(midX + 4, midY - 4, midX - 4, midY + 4);
        });

        this._panel?.bringToTop(this._equalLinkGfx);
    }

    _refreshComparatorBadges() {
        this._comparatorGfx.clear();
        this._comparatorLabelLayer?.removeAll(true);

        const comparators = this._puzzleState.getComparatorCells?.() || [];
        if (comparators.length === 0) return;

        const cellSize = MACHINE_PUZZLE.overlayCellSize;
        // Pill tag rendered as a small caption hanging off the bottom edge of
        // the cell. Half inside the cell, half outside, so placed dominoes
        // never fully obscure the constraint while also not colliding with
        // the next row's content.
        const pillWidth = Math.max(28, Math.floor(cellSize * 0.78));
        const pillHeight = Math.max(12, Math.floor(cellSize * 0.26));
        const pillRadius = Math.floor(pillHeight / 2);
        // Mark each cell that hosts a comparator so _refreshCell can skip
        // drawing the in-cell diamond there (we now show it as a pill below
        // the cell instead).
        comparators.forEach((entry) => {
            const center = this._getCellCenter(entry.row, entry.col);
            const isLessThan = entry.op === '<';
            const isMatched = !this._powerEffectsSuspended && entry.matched;

            const fillColor = isMatched
                ? (isLessThan ? 0x64a9d9 : 0xc789dd)
                : (isLessThan ? 0x214566 : 0x4a2a55);
            const strokeColor = isMatched
                ? (isLessThan ? 0xe9f5ff : 0xfbe7ff)
                : (isLessThan ? 0x9bc5e0 : 0xc89fd6);
            const glowColor = isLessThan ? 0x4a8fbe : 0x9d66b4;
            const glowAlpha = isMatched ? 0.42 : 0.22;

            const pillX = center.x - pillWidth / 2;
            // Bottom edge of the pill sits at the bottom edge of the cell, so
            // the pill hangs halfway inside the cell and halfway outside.
            const pillY = center.y + (cellSize / 2) - pillHeight / 2;

            // soft halo behind the pill
            this._comparatorGfx.fillStyle(glowColor, glowAlpha);
            this._comparatorGfx.fillRoundedRect(
                pillX - 2,
                pillY - 2,
                pillWidth + 4,
                pillHeight + 4,
                pillRadius + 2,
            );

            // pill core
            this._comparatorGfx.fillStyle(fillColor, 0.98);
            this._comparatorGfx.fillRoundedRect(pillX, pillY, pillWidth, pillHeight, pillRadius);

            // pill stroke
            this._comparatorGfx.lineStyle(1.5, strokeColor, isMatched ? 1 : 0.9);
            this._comparatorGfx.strokeRoundedRect(pillX, pillY, pillWidth, pillHeight, pillRadius);

            const label = this.scene.add.text(
                pillX + pillWidth / 2,
                pillY + pillHeight / 2,
                `${entry.op}${entry.threshold}`,
                {
                    fontFamily: 'Courier New',
                    fontSize: `${Math.max(10, Math.floor(pillHeight * 0.82))}px`,
                    fontStyle: 'bold',
                    color: isMatched ? '#ffffff' : (isLessThan ? '#e9f5ff' : '#fbe7ff'),
                    stroke: '#000000',
                    strokeThickness: 1.5,
                },
            ).setOrigin(0.5);
            this._comparatorLabelLayer.add(label);
        });

        this._panel?.bringToTop(this._comparatorGfx);
        this._panel?.bringToTop(this._comparatorLabelLayer);
    }

    _getCellCenter(row, col) {
        const cellSize = MACHINE_PUZZLE.overlayCellSize;
        return {
            x: this._gridLeft + (col * cellSize) + (cellSize / 2),
            y: this._gridTop + (row * cellSize) + (cellSize / 2),
        };
    }

    _applyPreview(cells, isValid) {
        this._clearPreview();

        cells.forEach((cell) => {
            const key = `${cell.row}:${cell.col}`;
            const cellView = this._cellViewMap.get(key);
            if (!cellView) return;

            cellView.previewRect.setFillStyle(isValid ? 0x7dff9d : 0xff8f73, isValid ? 0.2 : 0.18);
            cellView.previewRect.setStrokeStyle(1, isValid ? 0xe7ffef : 0xffc4bb, isValid ? 0.95 : 0.8);
            cellView.previewTween = this.scene.tweens.add({
                targets: cellView.previewRect,
                alpha: isValid ? 0.48 : 0.3,
                duration: MACHINE_PUZZLE.previewPulseMs,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.InOut',
            });
            this._activePreviewKeys.push(key);
        });
    }

    _clearPreview() {
        this._activePreviewKeys.forEach((key) => {
            const cellView = this._cellViewMap.get(key);
            if (!cellView) return;
            cellView.previewTween?.stop();
            cellView.previewTween = null;
            cellView.previewRect.setAlpha(0).setStrokeStyle(1, 0xffffff, 0);
        });

        this._activePreviewKeys = [];
    }

    _flashPlacement(cells) {
        cells.forEach((cell) => {
            const key = `${cell.row}:${cell.col}`;
            const cellView = this._cellViewMap.get(key);
            if (!cellView) return;

            cellView.previewRect.setFillStyle(0xc4ff7c, 0.62).setStrokeStyle(1, 0xf8ffd8, 0.95).setAlpha(0.65);
            this.scene.tweens.add({
                targets: cellView.previewRect,
                alpha: 0,
                duration: 220,
                ease: 'Quad.Out',
            });
        });
    }

    _playPlacementCurrent(cells, { boosted = false } = {}) {
        if (this._powerEffectsSuspended || !Array.isArray(cells) || cells.length === 0 || !this._currentPulseGfx) return;

        const points = cells.map((cell) => this._getCellCenter(cell.row, cell.col));
        if (points.length === 0) return;

        const start = points[0];
        const end = points[points.length - 1];

        this.scene.tweens.killTweensOf(this._currentPulseGfx);
        if (this._currentPulseTween) {
            this._currentPulseTween.stop();
        }

        this._currentPulseGfx.setAlpha(1).clear();
        this._currentPulseState = { progress: 0 };
        this._currentPulseTween = this.scene.tweens.add({
            targets: this._currentPulseState,
            progress: 1,
            duration: boosted ? 420 : 320,
            ease: 'Sine.Out',
            onUpdate: () => {
                const progress = this._currentPulseState?.progress ?? 0;
                const travelX = Phaser.Math.Linear(start.x, end.x, progress);
                const travelY = Phaser.Math.Linear(start.y, end.y, progress);
                const glowColor = boosted ? 0xfff2b8 : 0x8efbe0;
                const pulseColor = boosted ? 0xfffcdb : 0xd9ffe4;
                const lineWidth = boosted ? 5 : 4;

                this._currentPulseGfx.clear();
                this._currentPulseGfx.lineStyle(lineWidth + 5, glowColor, boosted ? 0.2 : 0.14);
                this._currentPulseGfx.lineBetween(start.x, start.y, end.x, end.y);
                this._currentPulseGfx.lineStyle(lineWidth, pulseColor, 0.92);
                this._currentPulseGfx.lineBetween(start.x, start.y, travelX, travelY);
                this._currentPulseGfx.fillStyle(pulseColor, 0.95);
                this._currentPulseGfx.fillCircle(travelX, travelY, boosted ? 8 : 6);

                points.forEach((point, index) => {
                    const intensity = index === 0 ? 0.36 : Math.max(0, progress - 0.22);
                    if (intensity <= 0) return;
                    this._currentPulseGfx.fillStyle(glowColor, intensity * 0.42);
                    this._currentPulseGfx.fillCircle(point.x, point.y, boosted ? 10 + (progress * 6) : 8 + (progress * 4));
                });
            },
            onComplete: () => {
                this._currentPulseTween = null;
                this.scene.tweens.add({
                    targets: this._currentPulseGfx,
                    alpha: 0,
                    duration: 120,
                    ease: 'Quad.Out',
                    onComplete: () => {
                        this._currentPulseGfx.clear();
                        this._currentPulseGfx.setAlpha(1);
                    },
                });
            },
        });
    }

    _applyDominoStateToView(dominoView, animated) {
        const dominoState = dominoView.dominoState;
        const rotationIndex = this._getDominoRotationIndex(dominoState);
        let targetX = dominoState.tablePosition?.x ?? dominoView.slot.x;
        let targetY = dominoState.tablePosition?.y ?? dominoView.slot.y;

        if (dominoState.anchor && dominoState.placedCells.length > 0) {
            const placedCandidate = this._createCandidateFromAnchor(rotationIndex, dominoState.anchor.row, dominoState.anchor.col);
            targetX = placedCandidate.snapX;
            targetY = placedCandidate.snapY;
        }

        dominoView.container.angle = this._getDominoTargetAngle(rotationIndex);
        this._applyDominoVisualScale(dominoView);

        if (animated) {
            this.scene.tweens.add({
                targets: dominoView.container,
                x: targetX,
                y: targetY,
                duration: MACHINE_PUZZLE.dominoSnapMs,
                ease: 'Back.Out',
            });
        } else {
            dominoView.container.setPosition(targetX, targetY);
        }
    }

    _setDominoHover(dominoView, isHovering) {
        dominoView.isHovered = isHovering;
        this._drawDomino(dominoView);
        this._applyDominoVisualScale(dominoView);
    }

    _applyDominoVisualScale(dominoView) {
        if (!dominoView?.container) return;

        const baseScale = dominoView.isFloating
            ? MACHINE_PUZZLE.dominoFloatingScale
            : (dominoView.isHovered ? MACHINE_PUZZLE.dominoHoverScale : MACHINE_PUZZLE.dominoRestScale);
        dominoView.container.setScale(baseScale);
    }

    _clearFloatingState(dominoView) {
        if (!dominoView) return;
        dominoView.isFloating = false;
        dominoView.currentCandidate = null;
        if (this._floatingDominoView === dominoView) {
            this._floatingDominoView = null;
        }
        this._applyDominoVisualScale(dominoView);
    }

    _getDominoRotationIndex(dominoState) {
        return normalizeRotationIndex(
            Number.isInteger(dominoState.rotationIndex)
                ? dominoState.rotationIndex
                : (dominoState.orientation === 'horizontal' ? 1 : 0)
        );
    }

    _setDominoRotation(dominoView, rotationIndex) {
        const normalizedRotationIndex = normalizeRotationIndex(rotationIndex);
        dominoView.dominoState.rotationIndex = normalizedRotationIndex;
        dominoView.dominoState.orientation = getOrientationForRotationIndex(normalizedRotationIndex);
    }

    _setPowerEffectsSuspended(suspended) {
        this._powerEffectsSuspended = Boolean(suspended);
        if (this._powerEffectsSuspended) {
            this.scene.tweens.killTweensOf(this._currentPulseGfx);
            if (this._currentPulseTween) {
                this._currentPulseTween.stop();
                this._currentPulseTween = null;
            }
            this._currentPulseState = null;
            this._currentPulseGfx?.clear();
        }

        this._refreshAllCells();
        this._refreshAllDominoViews();
    }

    _snapDominoRotationToClosestAngle(dominoView) {
        if (!dominoView?.container) return;

        this.scene.tweens.killTweensOf(dominoView.container);
        const snappedRotationIndex = normalizeRotationIndex(Math.round(dominoView.container.angle / 90));
        this._setDominoRotation(dominoView, snappedRotationIndex);
        dominoView.container.angle = this._getDominoTargetAngle(snappedRotationIndex);
        this._drawDomino(dominoView);
    }

    _getDominoTargetAngle(rotationIndex) {
        return normalizeRotationIndex(rotationIndex) * 90;
    }

    _isDominoOnTable(dominoView) {
        return !dominoView.dominoState.anchor && dominoView.dominoState.placedCells.length === 0;
    }

    _isPointOverTable(localX, localY) {
        if (!this._tableBounds) return false;

        return localX >= this._tableBounds.left
            && localX <= this._tableBounds.right
            && localY >= this._tableBounds.top
            && localY <= this._tableBounds.bottom;
    }

    _cancelInteraction() {
        this._clearPreview();

        if (this._dragState) {
            const dominoView = this._dragState.dominoView;
            this._dragState = null;
            this._restoreDomino(dominoView);
        }

        if (this._floatingDominoView) {
            const floatingDomino = this._floatingDominoView;
            this._floatingDominoView = null;
            this._restoreDomino(floatingDomino);
        }
    }

    _playPuzzleSound(primarySound, fallbackSound = null, volume = SOUND_VOLUMES.puzzleLock) {
        const chosenSound = primarySound && this.scene.cache.audio.has(primarySound.key)
            ? primarySound
            : (fallbackSound && this.scene.cache.audio.has(fallbackSound.key) ? fallbackSound : null);
        if (!chosenSound) return null;

        const sound = this.scene.sound.add(chosenSound.key, { volume });
        sound.once('complete', () => sound.destroy());
        sound.play();
        return sound;
    }

    _notifyGridChanged() {
        this._callbacks.onPuzzleChanged?.(this._machineVariant, this._puzzleState);
        this._refreshSpecialAction();
    }

    _refreshSpecialAction() {
        const action = this._callbacks.getSpecialAction?.(this._machineVariant, this._puzzleState) || null;
        this._specialAction = action;

        if (!this._specialActionButtonBg || !this._specialActionButtonText) return;

        if (!action) {
            this._specialActionButtonBg.setVisible(false);
            this._specialActionButtonText.setVisible(false);
            return;
        }

        this._specialActionButtonBg
            .setVisible(true)
            .setFillStyle(action.fillColor ?? 0x27321f, 1)
            .setStrokeStyle(2, action.strokeColor ?? 0xa9d26f, 0.92);
        this._specialActionButtonText
            .setVisible(true)
            .setText(action.label || 'SPECIAL')
            .setColor(action.labelColor || '#e7ffd5');
    }

    _triggerSpecialAction() {
        if (!this._specialAction?.onTrigger) return;

        const result = this._specialAction.onTrigger({
            machineVariant: this._machineVariant,
            puzzleState: this._puzzleState,
        });

        if (!result) return;

        if (result.message) {
            this._showMessage(result.message);
        }

        if (result.refreshAfter) {
            this._layoutPuzzle();
            this._refreshSpecialAction();
        }

        if (result.closeAfter) {
            this.close();
        }
    }

    _showMessage(message) {
        this.scene.tweens.killTweensOf(this._messageText);
        this._messageText.setText(message).setAlpha(1);
        this.scene.tweens.add({
            targets: this._messageText,
            alpha: 0,
            delay: MACHINE_PUZZLE.messageDurationMs,
            duration: 260,
            ease: 'Quad.Out',
        });
    }
}

import * as Phaser from 'phaser';
import { FACTORY_DEBUG, MACHINE_PUZZLE } from '../constants/gameConstants.js';

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
        this._tableBounds = null;

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
        this._backdrop.on('pointerdown', () => {});

        this._panel = this.scene.add.container(640, 360);

        const frame = this.scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x1d1511, 0.98)
            .setStrokeStyle(2, 0xa88a63, 0.95);
        const inner = this.scene.add.rectangle(0, 0, panelWidth - 22, panelHeight - 22, 0x2a1d18, 0.96)
            .setStrokeStyle(1, 0x5f4b3b, 0.85);
        const headerRule = this.scene.add.rectangle(0, -(panelHeight / 2) + 62, panelWidth - 60, 2, 0x7b634a, 0.85);

        this._titleText = this.scene.add.text(0, -(panelHeight / 2) + 34, 'MACHINE GRID', {
            fontFamily: 'Courier New',
            fontSize: '28px',
            color: '#e4d8c4',
            letterSpacing: 3,
        }).setOrigin(0.5);

        this._subtitleText = this.scene.add.text(0, -(panelHeight / 2) + 84, '', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#d6c1a7',
            align: 'center',
            wordWrap: { width: panelWidth - 120 },
            lineSpacing: 4,
        }).setOrigin(0.5, 0);

        this._gridBoardGfx = this.scene.add.graphics();
        this._equalLinkGfx = this.scene.add.graphics();
        this._tableGfx = this.scene.add.graphics();
        this._gridLayer = this.scene.add.container(0, 0);
        this._dominoLayer = this.scene.add.container(0, 0);

        this._messageText = this.scene.add.text(0, (panelHeight / 2) - 126, '', {
            fontFamily: 'monospace',
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

        backButtonBg.on('pointerover', () => backButtonBg.setFillStyle(0x4f2f22, 1));
        backButtonBg.on('pointerout', () => backButtonBg.setFillStyle(0x3a241d, 1));
        backButtonBg.on('pointerdown', () => this.close());

        this._panel.add([
            frame,
            inner,
            headerRule,
            this._titleText,
            this._subtitleText,
            this._gridBoardGfx,
            this._equalLinkGfx,
            this._tableGfx,
            this._gridLayer,
            this._dominoLayer,
            this._messageText,
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
            onComplete: () => this._root.setVisible(false),
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
        this._equalLinkGfx.clear();
        this._tableGfx.clear();
        this._messageText.setAlpha(0).setText('');
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
        const tableWidth = Math.max(MACHINE_PUZZLE.overlayTableMinWidth, Math.min(860, (count * 100) + 90));
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
        const slotY = tableCenterY + 8;

        dominos.forEach((dominoState, index) => {
            const slotX = slotStartX + (slotSpacing * index);
            const slotRect = this.scene.add.rectangle(slotX, slotY + 10, MACHINE_PUZZLE.dominoWidth + 18, MACHINE_PUZZLE.dominoHeight + 18, 0x2f2018, 0.5)
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
        container.setInteractive(
            new Phaser.Geom.Rectangle(
                -(MACHINE_PUZZLE.dominoWidth / 2) - MACHINE_PUZZLE.dominoHitPaddingX,
                -(MACHINE_PUZZLE.dominoHeight / 2) - MACHINE_PUZZLE.dominoHitPaddingY,
                MACHINE_PUZZLE.dominoWidth + (MACHINE_PUZZLE.dominoHitPaddingX * 2),
                MACHINE_PUZZLE.dominoHeight + (MACHINE_PUZZLE.dominoHitPaddingY * 2),
            ),
            Phaser.Geom.Rectangle.Contains,
        );

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
        const bottomLabel = this.scene.add.text(0, MACHINE_PUZZLE.dominoHeight / 4, '', {
            fontFamily: 'Courier New',
            fontSize: '16px',
            color: '#f6d84a',
            stroke: '#24412c',
            strokeThickness: 2,
        }).setOrigin(0.5).setVisible(false);

        container.add([hoverGlow, graphics, topLabel, bottomLabel]);
        this._dominoLayer.add(container);

        const dominoView = {
            id: dominoState.id,
            dominoState,
            container,
            hoverGlow,
            graphics,
            topLabel,
            bottomLabel,
            slot,
            previousState: null,
            currentCandidate: null,
            isHovered: false,
        };

        container.on('pointerdown', (pointer) => this._beginPointerIntent(dominoView, pointer));
        container.on('pointerover', () => this._setDominoHover(dominoView, true));
        container.on('pointerout', () => this._setDominoHover(dominoView, false));

        this._applyDominoStateToView(dominoView, false);
        return dominoView;
    }

    _drawDomino(dominoView) {
        const width = MACHINE_PUZZLE.dominoWidth;
        const height = MACHINE_PUZZLE.dominoHeight;
        const { firstGlow, secondGlow, globalGlow } = this._getDominoGlowState(dominoView);

        dominoView.graphics.clear();
        dominoView.hoverGlow.setFillStyle(0xd8ff95, globalGlow ? 0.18 : dominoView.isHovered ? 0.12 : 0);
        dominoView.hoverGlow.setStrokeStyle(2, 0xf2ffd0, globalGlow ? 0.75 : dominoView.isHovered ? 0.42 : 0);

        dominoView.graphics.fillStyle(0x102214, 0.2);
        dominoView.graphics.fillRoundedRect(-width / 2 + 4, -height / 2 + 6, width, height, 14);
        dominoView.graphics.fillStyle(0x2ca55e, 1);
        dominoView.graphics.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
        dominoView.graphics.lineStyle(2, globalGlow ? 0xf5ffd3 : 0xd7ffde, globalGlow ? 1 : 0.9);
        dominoView.graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
        dominoView.graphics.fillStyle(0xffffff, 0.08);
        dominoView.graphics.fillRoundedRect(-(width / 2) + 6, -(height / 2) + 6, width - 12, 18, 10);
        dominoView.graphics.fillStyle(0x1d5f33, 1);
        dominoView.graphics.fillRect(-(width / 2) + 8, -1, width - 16, 2);

        this._drawPips(dominoView.graphics, dominoView.dominoState.firstOptionAmount, true, firstGlow || globalGlow);
        this._drawPips(dominoView.graphics, dominoView.dominoState.secondOptionAmount, false, secondGlow || globalGlow);

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

    _drawPips(graphics, count, isTopHalf, shouldGlow) {
        if (!count || count <= 0) return;

        const localPositions = [
            { x: 0, y: 0 },
            { x: -15, y: -18 },
            { x: 15, y: 18 },
            { x: 15, y: -18 },
            { x: -15, y: 18 },
            { x: -15, y: 0 },
            { x: 15, y: 0 },
            { x: 0, y: -18 },
            { x: 0, y: 18 },
        ];

        const sectionOffsetY = isTopHalf ? -(MACHINE_PUZZLE.dominoHeight / 4) : (MACHINE_PUZZLE.dominoHeight / 4);
        const pipCount = Math.min(count, localPositions.length);

        if (shouldGlow) {
            graphics.fillStyle(0xfff2a3, 0.32);
            for (let index = 0; index < pipCount; index++) {
                const pip = localPositions[index];
                graphics.fillCircle(pip.x, sectionOffsetY + pip.y, 9);
            }
        }

        graphics.fillStyle(0xf4d850, 1);
        for (let index = 0; index < pipCount; index++) {
            const pip = localPositions[index];
            graphics.fillCircle(pip.x, sectionOffsetY + pip.y, 5);
        }
    }

    _getDominoGlowState(dominoView) {
        const evaluation = this._puzzleState.getEvaluation();
        const firstCell = dominoView.dominoState.placedCells.find((cell) => cell.half === 'first');
        const secondCell = dominoView.dominoState.placedCells.find((cell) => cell.half === 'second');

        return {
            firstGlow: Boolean(firstCell?.matchesCharge || firstCell?.matchesEquality),
            secondGlow: Boolean(secondCell?.matchesCharge || secondCell?.matchesEquality),
            globalGlow: evaluation.solved || dominoView.dominoState.isFullyGlowing,
        };
    }

    _handleDominoClick(dominoView) {
        if (!this.isVisible()) return;

        const previousRotationIndex = this._getDominoRotationIndex(dominoView.dominoState);
        const nextRotationIndex = normalizeRotationIndex(previousRotationIndex + 1);
        const previousAnchor = dominoView.dominoState.anchor ? { ...dominoView.dominoState.anchor } : null;

        if (!previousAnchor) {
            this._setDominoRotation(dominoView, nextRotationIndex);
            this._drawDomino(dominoView);
            this._animateDominoAngle(dominoView, dominoView.container.angle + 90);
            return;
        }

        this._puzzleState.clearDominoPlacement(dominoView.id);
        const rotatedCandidate = this._createCandidateFromAnchor(nextRotationIndex, previousAnchor.row, previousAnchor.col);
        if (this._validateCandidate(rotatedCandidate).valid) {
            this._setDominoRotation(dominoView, nextRotationIndex);
            this._drawDomino(dominoView);
            this._animateDominoAngle(dominoView, dominoView.container.angle + 90);
            this._placeDomino(dominoView, rotatedCandidate, true);
            return;
        }

        const restoreCandidate = this._createCandidateFromAnchor(previousRotationIndex, previousAnchor.row, previousAnchor.col);
        this._puzzleState.placeDomino(dominoView.id, restoreCandidate);
        this._refreshAllCells();
        this._refreshAllDominoViews();
        this._showMessage('That rotation does not fit the charge map.');
    }

    _beginPointerIntent(dominoView, pointer) {
        if (!this.isVisible()) return;
        if (this._dragState && this._dragState.pointerId !== pointer.id) return;

        const localX = pointer.worldX - this._panel.x;
        const localY = pointer.worldY - this._panel.y;
        const startedFromTable = this._isDominoOnTable(dominoView);

        this._dragState = {
            dominoView,
            pointerId: pointer.id,
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            offsetX: localX - dominoView.container.x,
            offsetY: localY - dominoView.container.y,
            dragging: false,
            startedFromTable,
        };

        if (!startedFromTable) return;

        const nextRotationIndex = normalizeRotationIndex(this._getDominoRotationIndex(dominoView.dominoState) + 1);
        this._setDominoRotation(dominoView, nextRotationIndex);
        this._drawDomino(dominoView);
        this._beginDominoDrag(dominoView);
        this._dragState.dragging = true;
        this._animateDominoAngle(dominoView, dominoView.container.angle + 90);
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
        if (!this._dragState || this._dragState.pointerId !== pointer.id) return;

        const { dominoView, dragging } = this._dragState;
        this._dragState = null;

        if (dragging) {
            this._endDominoDrag(dominoView);
            return;
        }

        this._handleDominoClick(dominoView);
    }

    _beginDominoDrag(dominoView) {
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
            this._clearDominoPlacement(dominoView);
        }

        this.scene.tweens.killTweensOf(dominoView.container);
        this._dominoLayer.bringToTop(dominoView.container);
        this.scene.tweens.add({ targets: dominoView.container, scaleX: 1.05, scaleY: 1.05, duration: 80, ease: 'Quad.Out' });
    }

    _dragDomino(dominoView, targetX, targetY) {
        dominoView.container.x = targetX;
        dominoView.container.y = targetY;

        const candidate = this._candidateFromLocalPoint(dominoView, targetX, targetY);
        const validation = this._validateCandidate(candidate);

        const previewCells = validation.valid
            ? candidate.cells
            : candidate.cells.filter((cell) => this._isWithinBounds(cell.row, cell.col));

        this._applyPreview(previewCells, validation.valid);
        dominoView.currentCandidate = { ...candidate, valid: validation.valid, reason: validation.reason };
    }

    _endDominoDrag(dominoView) {
        this.scene.tweens.add({ targets: dominoView.container, scaleX: 1, scaleY: 1, duration: 90, ease: 'Quad.Out' });

        const candidate = dominoView.currentCandidate;
        const droppedOnTable = this._isPointOverTable(dominoView.container.x, dominoView.container.y);
        this._clearPreview();

        if (candidate?.valid) {
            this._placeDomino(dominoView, candidate, true);
            this._showMessage('Domino locked into the grid.');
        } else if (droppedOnTable) {
            this._returnDominoToTable(dominoView);
            this._showMessage('Domino returned to the rack.');
        } else {
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
        if (!previousState) return;

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
        candidate.rotationIndex = this._getDominoRotationIndex(dominoView.dominoState);
        candidate.orientation = dominoView.dominoState.orientation;
        this._puzzleState.placeDomino(dominoView.id, candidate);
        this._refreshAllCells();
        this._refreshAllDominoViews();

        this.scene.tweens.add({
            targets: dominoView.container,
            x: candidate.snapX,
            y: candidate.snapY,
            duration: animated ? MACHINE_PUZZLE.dominoSnapMs : 1,
            ease: animated ? 'Back.Out' : 'Linear',
        });

        this._flashPlacement(candidate.cells);
        this._notifyGridChanged();
    }

    _clearDominoPlacement(dominoView) {
        if (dominoView.dominoState.placedCells.length === 0) return;

        this._puzzleState.clearDominoPlacement(dominoView.id);
        this._refreshAllCells();
        this._refreshAllDominoViews();
        this._notifyGridChanged();
    }

    _animateDominoAngle(dominoView, targetAngle = null) {
        this.scene.tweens.killTweensOf(dominoView.container);
        this.scene.tweens.add({
            targets: dominoView.container,
            angle: targetAngle ?? this._getDominoTargetAngle(this._getDominoRotationIndex(dominoView.dominoState)),
            duration: MACHINE_PUZZLE.dominoRotationMs,
            ease: 'Sine.Out',
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
        this._cellViews.forEach((cellView) => this._refreshCell(cellView));
        this._refreshEqualLinkLines();
    }

    _refreshAllDominoViews() {
        this._dominoViews.forEach((dominoView) => this._drawDomino(dominoView));
    }

    _refreshCell(cellView) {
        const baseValue = this._puzzleState.getBaseCellValue(cellView.row, cellView.col);
        const value = this._puzzleState.getCurrentCellValue(cellView.row, cellView.col);
        const chargeLevel = this._puzzleState.getChargeLevel(cellView.row, cellView.col);
        const isMatchedCharge = this._puzzleState.isChargeMatched(cellView.row, cellView.col);
        const hasEqualLink = this._puzzleState.isEqualLinkCell(cellView.row, cellView.col);
        const isMatchedEqualLink = this._puzzleState.isEqualMatched(cellView.row, cellView.col);
        const isPlaced = isPlacedCode(value);

        let fillColor = 0x2c241f;
        let strokeColor = 0x6a5643;

        if (baseValue === CELL_WALL) {
            fillColor = 0x74614b;
            strokeColor = 0xc6af8c;
        } else if (chargeLevel > 0) {
            fillColor = isMatchedCharge ? 0x7e8832 : 0x4d5a2f;
            strokeColor = isMatchedCharge ? 0xfff0b5 : 0xe0dc92;
        } else if (hasEqualLink) {
            fillColor = isMatchedEqualLink
                ? 0x8a7e31
                : isPlaced
                    ? 0x285e67
                    : 0x2d3f49;
            strokeColor = isMatchedEqualLink ? 0xffefad : 0xe6d987;
        } else if (isPlaced) {
            fillColor = 0x39af67;
            strokeColor = 0xe8f9b9;
        }

        cellView.baseRect.setFillStyle(fillColor, 1);
        cellView.baseRect.setStrokeStyle(1, strokeColor, 0.9);

        if (cellView.matchTween) {
            cellView.matchTween.stop();
            cellView.matchTween = null;
        }

        if (isMatchedCharge || isMatchedEqualLink) {
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
        if (chargeLevel > 0) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText(String(chargeLevel));
            cellView.valueText.setColor(isMatchedCharge ? '#fff6b8' : '#ffe784');
        } else if (hasEqualLink) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText('=');
            cellView.valueText.setColor(isMatchedEqualLink ? '#fff6b8' : '#ffe784');
        } else if (shouldShowDebug) {
            cellView.valueText.setVisible(true);
            cellView.valueText.setText(String(value));
            cellView.valueText.setColor(MACHINE_PUZZLE.debugCellTextColor);
        } else {
            cellView.valueText.setVisible(false);
            cellView.valueText.setText('');
        }
    }

    _refreshEqualLinkLines() {
        this._equalLinkGfx.clear();

        this._puzzleState.getEqualLinkPairs().forEach((pair) => {
            const start = this._getCellCenter(pair.a.row, pair.a.col);
            const end = this._getCellCenter(pair.b.row, pair.b.col);
            const lineColor = pair.matched ? 0xfff2b8 : 0xe4d06b;
            const glowColor = pair.matched ? 0xfff8cf : 0xf0db86;

            this._equalLinkGfx.lineStyle(pair.matched ? 4 : 2, glowColor, pair.matched ? 0.65 : 0.24);
            this._equalLinkGfx.beginPath();
            this._equalLinkGfx.moveTo(start.x, start.y);
            this._equalLinkGfx.lineTo(end.x, end.y);
            this._equalLinkGfx.strokePath();

            this._equalLinkGfx.lineStyle(pair.matched ? 2 : 1, lineColor, pair.matched ? 0.95 : 0.82);
            this._equalLinkGfx.beginPath();
            this._equalLinkGfx.moveTo(start.x, start.y);
            this._equalLinkGfx.lineTo(end.x, end.y);
            this._equalLinkGfx.strokePath();
        });
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
        dominoView.container.setScale(1);

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
        if (this._dragState?.dominoView === dominoView) return;
        dominoView.isHovered = isHovering;
        this._drawDomino(dominoView);
        dominoView.container.setScale(isHovering ? 1.03 : 1);
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
        if (!this._dragState) return;

        const dominoView = this._dragState.dominoView;
        this._dragState = null;
        this._clearPreview();
        this._restoreDomino(dominoView);
    }

    _notifyGridChanged() {
        this._callbacks.onPuzzleChanged?.(this._machineVariant, this._puzzleState);
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

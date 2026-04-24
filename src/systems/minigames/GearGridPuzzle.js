import * as Phaser from 'phaser';
import MinigameBase from './MinigameBase.js';
import { FACTORY_DEBUG, SOUND_ASSETS, SOUND_VOLUMES } from '../../constants/gameConstants.js';
import {
    GEAR_CODES,
    buildClampedGearCellSet,
    buildGearProgressSnapshot,
    cloneGearBoard,
    cloneGearPieces,
    evaluateGearPuzzleBoard,
    gearCellKey,
    getGearConnections,
    isGearType,
    isRustGearType,
} from '../../core/gearPuzzleLogic.js';

const CELL_SIZE_MAX = 86;
const CELL_SIZE_MIN = 58;

function inBounds(board, row, col) {
    return row >= 0 && col >= 0 && row < board.length && col < (board[row]?.length ?? 0);
}

function isOpenBoardCell(board, row, col) {
    return inBounds(board, row, col) && board[row][col] === GEAR_CODES.EMPTY;
}

function getCellCenter(left, top, cellSize, row, col) {
    return {
        x: left + (col * cellSize) + (cellSize / 2),
        y: top + (row * cellSize) + (cellSize / 2),
    };
}

function getPieceLabel(type) {
    if (type === GEAR_CODES.MOVABLE_WALL) return 'CLP';
    if (type === GEAR_CODES.RUSTED) return 'RST';
    if (type === GEAR_CODES.HORIZONTAL) return 'EW';
    if (type === GEAR_CODES.VERTICAL) return 'NS';
    if (type === GEAR_CODES.CURVE_NE) return 'NE';
    if (type === GEAR_CODES.CURVE_SE) return 'SE';
    if (type === GEAR_CODES.CURVE_SW) return 'SW';
    if (type === GEAR_CODES.CURVE_NW) return 'NW';
    if (type === GEAR_CODES.FULL) return 'ALL';
    return '';
}

function getGearDirectionPosition(dir, reach) {
    if (dir === 'N') return { x: 0, y: -reach };
    if (dir === 'E') return { x: reach, y: 0 };
    if (dir === 'S') return { x: 0, y: reach };
    return { x: -reach, y: 0 };
}

export default class GearGridPuzzle extends MinigameBase {
    constructor(scene, config = {}) {
        super(scene, { depth: 190, ...config });
        this._handlePointerMove = this._handlePointerMove.bind(this);
        this._handlePointerUp = this._handlePointerUp.bind(this);
        this.scene.input.on('pointermove', this._handlePointerMove);
        this.scene.input.on('pointerup', this._handlePointerUp);
        this._dragState = null;
        this._escKey = null;
        this._escHandler = null;
        this._pieceViews = [];
        this._pieceViewMap = new Map();
        this._cellViews = [];
        this._cellViewMap = new Map();
        this._staticViews = [];
        this._lastEvaluation = null;
        this._currentClampedCells = new Set();
        this._puzzle = null;
        this._board = [];
        this._inspectionFaultGfx = null;
        this._specialAction = null;
        this._specialActionButton = null;
        this._specialActionLabel = null;
    }

    _defaultEvidence() {
        return {
            symptoms: ['Drive train stalled.'],
            flags: [],
            completed: false,
            jammed: false,
            jamReason: null,
            poweredCells: [],
            poweredPieces: [],
            clampedCells: [],
            pieces: [],
            sinkPowered: false,
            reviewed: false,
            scrapRequired: false,
            scrapKind: null,
            scrapStatus: null,
            scrapReason: null,
            inspectionFault: null,
            allowRustedGears: false,
            useDeadlockClamp: false,
        };
    }

    hide() {
        this._persistProgress();
        this._teardownTransientState();
        super.hide();
    }

    destroy() {
        this.scene.input.off('pointermove', this._handlePointerMove);
        this.scene.input.off('pointerup', this._handlePointerUp);
        this._teardownTransientState();
        super.destroy();
    }

    _build(caseData) {
        const gearPuzzle = caseData?.gearPuzzle;
        if (!gearPuzzle?.board) {
            this.emitEvidence({ completed: false, symptoms: ['No gear board loaded.'] });
            return;
        }

        this._puzzle = gearPuzzle;
        this._specialAction = caseData?.specialAction || null;
        this.evidence = {
            ...this._defaultEvidence(),
            ...(gearPuzzle.progress || {}),
            flags: Array.isArray(gearPuzzle.progress?.flags) ? [...gearPuzzle.progress.flags] : [],
            symptoms: Array.isArray(gearPuzzle.progress?.symptoms) ? [...gearPuzzle.progress.symptoms] : [],
        };
        if (this.evidence.scrapRequired && !this.evidence.reviewed) {
            this.emitEvidence({ reviewed: true });
        }
        this._board = cloneGearBoard(gearPuzzle.board);
        const pieces = cloneGearPieces(gearPuzzle.progress?.pieces || gearPuzzle.pieces || []);

        const rows = this._board.length;
        const cols = Math.max(...this._board.map((row) => row.length));
        this._cellSize = Math.max(CELL_SIZE_MIN, Math.min(CELL_SIZE_MAX, Math.floor(Math.min(500 / cols, 420 / rows))));
        const gridWidth = cols * this._cellSize;
        const gridHeight = rows * this._cellSize;
        this._boardLeft = -154 - 250 + ((500 - gridWidth) / 2);
        this._boardTop = 28 - 210 + ((420 - gridHeight) / 2);

        const depth = this.config.depth;

        const blocker = this.scene.add.rectangle(640, 360, 1280, 720, 0x040709, 0.76)
            .setDepth(depth - 1)
            .setInteractive();
        blocker.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
        });
        const panel = this.scene.add.container(640, 360).setDepth(depth);
        const frame = this.scene.add.rectangle(0, 0, 1100, 630, 0x0b1419, 0.96)
            .setStrokeStyle(2, 0x8cb9c7, 0.78);
        const inner = this.scene.add.rectangle(0, 0, 1066, 596, 0x112029, 0.92)
            .setStrokeStyle(1, 0x365160, 0.82);
        const boardFrame = this.scene.add.rectangle(-154, 28, 560, 476, 0x081317, 0.94)
            .setStrokeStyle(2, 0x5e899a, 0.7);
        const sidePanel = this.scene.add.rectangle(314, 20, 276, 520, 0x081117, 0.88)
            .setStrokeStyle(1, 0x395968, 0.72);
        const headerRule = this.scene.add.rectangle(0, -244, 1006, 2, 0x315161, 0.7);
        this._inspectionFaultGfx = this.scene.add.graphics();

        this._titleText = this.scene.add.text(-474, -274, gearPuzzle.previewTitle || 'GEAR TRAIN', {
            fontFamily: 'Courier New',
            fontSize: '28px',
            color: '#e6f2f4',
            letterSpacing: 3,
        }).setOrigin(0, 0.5);
        this._subtitleText = this.scene.add.text(-474, -244, gearPuzzle.description || 'Slide the loose gears until the output axle spins.', {
            fontFamily: 'Courier New',
            fontSize: '12px',
            color: '#9fc3cf',
            wordWrap: { width: 620 },
            lineSpacing: 4,
        }).setOrigin(0, 0);
        this._statusText = this.scene.add.text(198, -188, 'OUTPUT OFFLINE', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#ffd39c',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this._statusHintText = this.scene.add.text(198, -158, 'Drag parts onto empty cells.', {
            fontFamily: 'Courier New',
            fontSize: '10px',
            color: '#8bb1bf',
            wordWrap: { width: 220 },
            lineSpacing: 3,
        }).setOrigin(0, 0);
        this._summaryText = this.scene.add.text(198, -92, '', {
            fontFamily: 'Courier New',
            fontSize: '11px',
            color: '#d6edf2',
            lineSpacing: 6,
            wordWrap: { width: 220 },
        }).setOrigin(0, 0);

        const closeBg = this.scene.add.rectangle(318, 245, 210, 42, 0x243846, 0.94)
            .setStrokeStyle(2, 0xa8c8d2, 0.82)
            .setInteractive({ useHandCursor: true });
        const closeText = this.scene.add.text(318, 245, 'CLOSE', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#e6f3f6',
            letterSpacing: 1,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x325061, 0.98));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0x243846, 0.94));
        closeBg.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._finalizeAndClose();
        });

        if (this._specialAction) {
            this._specialActionButton = this.scene.add.rectangle(318, 204, 194, 38, 0x2a4124, 0.95)
                .setStrokeStyle(2, 0x9de087, 0.9)
                .setInteractive({ useHandCursor: true });
            this._specialActionLabel = this.scene.add.text(318, 204, this._specialAction.label || 'SPECIAL', {
                fontFamily: 'Courier New',
                fontSize: '13px',
                color: '#e3ffd9',
                letterSpacing: 1,
            }).setOrigin(0.5);
            this._specialActionButton.on('pointerover', () => this._specialActionButton?.setFillStyle(0x35532d, 0.98));
            this._specialActionButton.on('pointerout', () => this._specialActionButton?.setFillStyle(0x2a4124, 0.95));
            this._specialActionButton.on('pointerdown', (_pointer, _localX, _localY, event) => {
                event?.stopPropagation?.();
                this._triggerSpecialAction();
            });
        }

        panel.add([
            frame,
            inner,
            boardFrame,
            sidePanel,
            headerRule,
            this._inspectionFaultGfx,
            this._titleText,
            this._subtitleText,
            this._statusText,
            this._statusHintText,
            this._summaryText,
            this._specialActionButton,
            this._specialActionLabel,
            closeBg,
            closeText,
        ].filter(Boolean));

        this.container.add([blocker, panel]);
        this._panel = panel;

        const legendDivider = this.scene.add.rectangle(314, 36, 234, 1, 0x395968, 0.6);
        const legendTitle = this.scene.add.text(198, 56, 'MOVABLE PARTS', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#cde6ee',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this._legendContainer = this.scene.add.container(0, 0);
        panel.add([legendDivider, legendTitle, this._legendContainer]);

        this._buildBoard();
        this._buildPieces(pieces);
        this._buildLegend();
        this._drawInspectionFault();

        this._escKey = this.scene.input.keyboard?.addKey('ESC');
        this._escHandler = () => { if (this.active) this._finalizeAndClose(); };
        this._escKey?.on('down', this._escHandler);

        this._syncState({ persist: true });
    }

    _teardownTransientState() {
        if (this._escKey && this._escHandler) {
            this._escKey.off('down', this._escHandler);
        }
        this._escKey = null;
        this._escHandler = null;

        if (this._dragState?.pieceView) {
            this._clearDropPreview();
            this._snapPieceToCell(this._dragState.pieceView, this._dragState.startRow, this._dragState.startCol, false);
        }
        this._dragState = null;

        this._pieceViews.forEach((pieceView) => {
            this.scene.tweens.killTweensOf(pieceView.container);
            pieceView.visual.spinTweens?.forEach((tween) => tween?.stop());
            this.scene.tweens.killTweensOf(pieceView.visual.primaryRotator);
            this.scene.tweens.killTweensOf(pieceView.visual.secondaryRotator);
        });
        this._staticViews.forEach((view) => {
            view.visual.spinTweens?.forEach((tween) => tween?.stop());
            this.scene.tweens.killTweensOf(view.visual.primaryRotator);
            this.scene.tweens.killTweensOf(view.visual.secondaryRotator);
        });

        this._pieceViews = [];
        this._pieceViewMap.clear();
        this._cellViews = [];
        this._cellViewMap.clear();
        this._staticViews = [];
        this._lastEvaluation = null;
        this._currentClampedCells = new Set();
        this._panel = null;
        this._inspectionFaultGfx = null;
        this._legendContainer = null;
        this._specialAction = null;
        this._specialActionButton = null;
        this._specialActionLabel = null;
        this._puzzle = null;
        this._board = [];
    }

    _buildBoard() {
        this._board.forEach((row, rowIndex) => {
            row.forEach((code, colIndex) => {
                const position = getCellCenter(this._boardLeft, this._boardTop, this._cellSize, rowIndex, colIndex);
                const slot = this.scene.add.container(position.x, position.y);
                const slotFill = code === GEAR_CODES.WALL ? 0x211c19 : 0x0f1d24;
                const slotStroke = code === GEAR_CODES.WALL ? 0x8c7968 : 0x42616d;
                const slotRect = this.scene.add.rectangle(0, 0, this._cellSize, this._cellSize, slotFill, 0.94)
                    .setStrokeStyle(1, slotStroke, 0.72);
                const previewRect = this.scene.add.rectangle(0, 0, this._cellSize - 4, this._cellSize - 4, 0x84ffc2, 0)
                    .setStrokeStyle(2, 0xd8fff0, 0);

                slot.add([slotRect, previewRect]);
                this._panel.add(slot);

                const cellView = {
                    key: gearCellKey(rowIndex, colIndex),
                    row: rowIndex,
                    col: colIndex,
                    slot,
                    slotRect,
                    previewRect,
                };
                this._cellViews.push(cellView);
                this._cellViewMap.set(cellView.key, cellView);

                if (code !== GEAR_CODES.EMPTY) {
                    const visual = this._createGearVisual(code, false);
                    visual.container.setScale(0.98);
                    slot.add(visual.container);
                    this._staticViews.push({ row: rowIndex, col: colIndex, type: code, visual });
                }
            });
        });
    }

    _buildPieces(pieces) {
        pieces.forEach((piece) => {
            const position = getCellCenter(this._boardLeft, this._boardTop, this._cellSize, piece.row, piece.col);
            const container = this.scene.add.container(position.x, position.y);
            const visual = this._createGearVisual(piece.type, true);
            const inputZone = piece.movable === false
                ? null
                : this.scene.add.rectangle(0, 0, this._cellSize, this._cellSize, 0xffffff, 0.001)
                    .setInteractive({ useHandCursor: true });
            container.add(inputZone ? [visual.container, inputZone] : [visual.container]);
            this._panel.add(container);

            const pieceView = {
                id: piece.id,
                piece,
                container,
                visual,
                inputZone,
            };

            inputZone?.on('pointerdown', (pointer, _localX, _localY, event) => {
                event?.stopPropagation?.();
                this._beginPieceIntent(pieceView, pointer);
            });
            inputZone?.on('pointerover', () => this._setPieceHover(pieceView, true));
            inputZone?.on('pointerout', () => this._setPieceHover(pieceView, false));

            this._pieceViews.push(pieceView);
            this._pieceViewMap.set(piece.id, pieceView);
            this._drawGearVisual(pieceView.visual, piece.type, {
                movable: piece.movable !== false,
                hovered: false,
                active: false,
                pieceRole: piece.role || null,
                faultType: this._getFaultTypeForPiece(piece),
            });
        });

        const movableCount = this._pieceViews.filter((pieceView) => pieceView.piece.movable !== false).length;
        const fixedCount = this._pieceViews.length - movableCount;
        const hasRustedGear = pieces.some((piece) => piece.type === GEAR_CODES.RUSTED);
        const rustNote = hasRustedGear
            ? (this._puzzle?.allowRustedGears
                ? ' Rusted gears are valid on this day. They still look ugly, but they are legal.'
                : ' Rusted gears lock the train on contact.')
            : '';
        const clampNote = this._puzzle?.useDeadlockClamp
            ? ' Deadlock Clamp parts grey out any slot they occupy, turning it into dead space.'
            : '';
        this._statusHintText?.setText(
            fixedCount > 0
            ? `Drag the ${movableCount} loose part${movableCount === 1 ? '' : 's'} with cyan corner marks onto empty cells. ${fixedCount} train part${fixedCount === 1 ? ' stays' : 's stay'} fixed.${rustNote}${clampNote}`
            : `Drag the cyan-marked parts onto empty cells. Walls block power and cannot connect.${rustNote}${clampNote}`
        );
    }

    _buildLegend() {
        if (!this._legendContainer) return;
        this._legendContainer.removeAll(true);

        const movablePieces = this._pieceViews.filter((pieceView) => pieceView.piece.movable !== false);
        if (movablePieces.length === 0) {
            const emptyText = this.scene.add.text(218, 104, 'NO LOOSE PARTS', {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#c9dbe3',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            this._legendContainer.add(emptyText);
            return;
        }

        movablePieces.forEach((pieceView, index) => {
            const y = 92 + (index * 56);
            const sample = this._createGearVisual(pieceView.piece.type, true);
            sample.container.setScale(0.48);
            sample.container.setPosition(218, y);
            this._drawGearVisual(sample, pieceView.piece.type, {
                movable: true,
                hovered: false,
                active: false,
                pieceRole: pieceView.piece.role || null,
            });
            const title = this.scene.add.text(246, y - 10, `PART ${index + 1}`, {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#dbeff4',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            const label = this.scene.add.text(246, y + 9, pieceView.piece.role === 'deadlock-clamp' ? 'CLAMP' : (getPieceLabel(pieceView.piece.type) || 'GEAR'), {
                fontFamily: 'Courier New',
                fontSize: '10px',
                color: '#8db2bf',
            }).setOrigin(0, 0.5);
            const hint = this.scene.add.text(246, y + 23, pieceView.piece.role === 'deadlock-clamp' ? 'DEAD SPACE TOOL' : 'DRAGGABLE', {
                fontFamily: 'Courier New',
                fontSize: '9px',
                color: '#a6eef3',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            this._legendContainer.add([sample.container, title, label, hint]);
        });
    }

    _drawInspectionFault() {
        if (!this._inspectionFaultGfx) return;

        this._inspectionFaultGfx.clear();
    }

    _getFaultTypeForStaticView(row, col) {
        const fault = this._puzzle?.inspectionFault;
        if (!fault || fault.pieceId) return null;
        return fault.row === row && fault.col === col ? fault.type : null;
    }

    _getFaultTypeForPiece(piece, row = piece?.row, col = piece?.col) {
        const fault = this._puzzle?.inspectionFault;
        if (!fault || !piece) return null;
        if (fault.pieceId) {
            return fault.pieceId === (piece.id || null) ? fault.type : null;
        }
        if (fault.source !== 'piece') return null;
        return fault.row === row && fault.col === col ? fault.type : null;
    }

    _isClampedCell(cellKey) {
        return this._currentClampedCells?.has(cellKey);
    }

    _createGearVisual(type, movable) {
        const container = this.scene.add.container(0, 0);
        const shell = this.scene.add.rectangle(0, 0, this._cellSize - 6, this._cellSize - 6, 0x142029, 0.96)
            .setStrokeStyle(2, 0x4a6976, 0.88);
        const glow = this.scene.add.circle(0, 0, Math.max(10, Math.floor(this._cellSize * 0.24)), 0x91ffd2, 0);
        const connectorGfx = this.scene.add.graphics();
        const moveHintGfx = this.scene.add.graphics();
        const faultGfx = this.scene.add.graphics();
        const nodeRotators = Array.from({ length: 4 }, () => {
            const rotator = this.scene.add.container(0, 0);
            const gearGfx = this.scene.add.graphics();
            rotator.add(gearGfx);
            return { rotator, gearGfx };
        });
        const primaryRotator = this.scene.add.container(0, 0);
        const secondaryRotator = this.scene.add.container(0, 0);
        const primaryGearGfx = this.scene.add.graphics();
        const secondaryGearGfx = this.scene.add.graphics();
        const badgeText = this.scene.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: `${Math.max(8, Math.floor(this._cellSize * 0.16))}px`,
            color: '#effafd',
            stroke: '#000000',
            strokeThickness: 2,
            letterSpacing: 1,
        }).setOrigin(0.5).setVisible(false);
        const faultText = this.scene.add.text(0, 0, '', {
            fontFamily: 'Courier New',
            fontSize: `${Math.max(8, Math.floor(this._cellSize * 0.16))}px`,
            color: '#ffe3df',
            stroke: '#4a0909',
            strokeThickness: 3,
            letterSpacing: 1,
        }).setOrigin(0.5).setVisible(false);

        primaryRotator.add(primaryGearGfx);
        secondaryRotator.add(secondaryGearGfx);
        container.add([glow, shell, connectorGfx, moveHintGfx, ...nodeRotators.map((nodeView) => nodeView.rotator), primaryRotator, secondaryRotator, badgeText, faultGfx, faultText]);

        return {
            type,
            movable,
            container,
            shell,
            glow,
            connectorGfx,
            moveHintGfx,
            nodeRotators,
            primaryRotator,
            secondaryRotator,
            primaryGearGfx,
            secondaryGearGfx,
            badgeText,
            faultGfx,
            faultText,
            spinTweens: [],
            spinMode: 'single',
            spinSignature: 'idle',
            hovered: false,
        };
    }

    _drawGearGlyph(gearGfx, radius, teethColor, gearColor, active) {
        gearGfx.clear();

        for (let index = 0; index < 8; index += 1) {
            const angle = Phaser.Math.DegToRad(index * 45);
            gearGfx.fillStyle(teethColor, active ? 0.88 : 0.62);
            gearGfx.fillCircle(Math.cos(angle) * (radius + 5), Math.sin(angle) * (radius + 5), 3);
        }

        gearGfx.fillStyle(gearColor, 0.95);
        gearGfx.fillCircle(0, 0, radius);
        gearGfx.lineStyle(2, active ? 0x0d2119 : 0x15222a, 0.72);
        gearGfx.strokeCircle(0, 0, radius);
        gearGfx.lineStyle(2, active ? 0x16402d : 0x2a4653, 0.9);
        gearGfx.lineBetween(-radius + 4, 0, radius - 4, 0);
        gearGfx.lineBetween(0, -radius + 4, 0, radius - 4);
        gearGfx.fillStyle(active ? 0x173626 : 0x1e3039, 0.95);
        gearGfx.fillCircle(0, 0, 6);
    }

    _drawMiniGearGlyph(gearGfx, radius, teethColor, gearColor, active) {
        gearGfx.clear();

        for (let index = 0; index < 6; index += 1) {
            const angle = Phaser.Math.DegToRad(index * 60);
            gearGfx.fillStyle(teethColor, active ? 0.92 : 0.78);
            gearGfx.fillCircle(Math.cos(angle) * (radius + 2), Math.sin(angle) * (radius + 2), Math.max(1.5, radius * 0.34));
        }

        gearGfx.fillStyle(gearColor, 0.98);
        gearGfx.fillCircle(0, 0, radius);
        gearGfx.lineStyle(1.5, active ? 0x18160f : 0x1d1b15, 0.78);
        gearGfx.strokeCircle(0, 0, radius);
        gearGfx.fillStyle(active ? 0x2f2b19 : 0x28241b, 0.92);
        gearGfx.fillCircle(0, 0, Math.max(2, radius * 0.35));
    }

    _drawMovableIndicator(moveHintGfx, hovered = false, active = false) {
        if (!moveHintGfx) return;

        const inset = Math.max(8, Math.floor(this._cellSize * 0.14));
        const arm = Math.max(8, Math.floor(this._cellSize * 0.14));
        const half = (this._cellSize / 2) - 6;
        const color = active ? 0xeafff4 : (hovered ? 0xcffff8 : 0x94eff5);
        const alpha = active ? 0.98 : (hovered ? 0.92 : 0.76);
        const top = -half + inset;
        const bottom = half - inset;
        const left = -half + inset;
        const right = half - inset;

        moveHintGfx.clear();
        moveHintGfx.lineStyle(2, color, alpha);
        moveHintGfx.lineBetween(left, top + arm, left, top);
        moveHintGfx.lineBetween(left, top, left + arm, top);
        moveHintGfx.lineBetween(right - arm, top, right, top);
        moveHintGfx.lineBetween(right, top, right, top + arm);
        moveHintGfx.lineBetween(left, bottom - arm, left, bottom);
        moveHintGfx.lineBetween(left, bottom, left + arm, bottom);
        moveHintGfx.lineBetween(right - arm, bottom, right, bottom);
        moveHintGfx.lineBetween(right, bottom - arm, right, bottom);

        const dotSpacing = Math.max(6, Math.floor(this._cellSize * 0.08));
        const dotY = -half + Math.max(6, Math.floor(this._cellSize * 0.12));
        moveHintGfx.fillStyle(color, alpha * 0.9);
        [-dotSpacing, 0, dotSpacing].forEach((dotX) => {
            moveHintGfx.fillCircle(dotX, dotY, 1.7);
        });
    }

    _getPairedGearCenters(connectedDirs) {
        const pairReach = Math.max(16, Math.floor(this._cellSize * 0.27));
        return connectedDirs.map((dir) => ({ dir, ...getGearDirectionPosition(dir, pairReach) }));
    }

    _drawGearVisual(visual, type, {
        movable = false,
        hovered = false,
        active = false,
        jammed = false,
        outputLive = false,
        direction = 1,
        pieceRole = null,
        faultType = null,
        clamped = false,
    } = {}) {
        const isClamp = pieceRole === 'deadlock-clamp';
        const isWall = !isClamp && (type === GEAR_CODES.MOVABLE_WALL || type === GEAR_CODES.WALL);
        const isRust = isRustGearType(type);
        const visuallyClamped = clamped && !isClamp;
        const shellColor = isClamp
            ? 0x4d545b
            : visuallyClamped
                ? 0x43484d
            : isWall
            ? (movable ? 0x596168 : 0x393f45)
            : jammed
                ? 0x3f1817
                : isRust
                    ? 0x3f2a1d
                    : active
                ? 0x3f3728
                : movable
                    ? 0x252e34
                    : 0x1b2329;
        const strokeColor = isClamp
            ? 0xd8e0e7
            : visuallyClamped
                ? 0xc5ccd4
            : isWall
            ? (movable ? 0xd4dde3 : 0xaab2b8)
            : jammed
                ? 0xffb4aa
                : isRust
                    ? 0xe0a26f
                    : active
                ? 0xffefc7
                : movable
                    ? 0xd6d2b9
                    : 0x94a1aa;
        const linkColor = visuallyClamped
            ? 0x9aa3ab
            : jammed
            ? 0xff6f64
            : outputLive
            ? 0xffd48a
            : isRust
                ? 0xb17144
                : active
                ? 0xe9e1b0
                : 0x8a907a;
        const gearColor = isClamp
            ? 0x7a8289
            : visuallyClamped
                ? 0x838a90
            : isWall
            ? (movable ? 0x7f8a91 : 0x596168)
            : jammed
                ? 0xd5544b
                : isRust
                    ? 0xa55d2e
                    : outputLive
                ? 0xffd697
                : active
                    ? 0xf3dfad
                    : movable
                        ? 0xcfba85
                        : 0xa99267;
        const teethColor = isClamp
            ? 0xe7edf2
            : visuallyClamped
                ? 0xd9dfe4
            : isWall
            ? (movable ? 0xe8eef2 : 0xc8d0d6)
            : jammed
                ? 0xffd5cf
                : isRust
                    ? 0xd58b58
                    : outputLive
                ? 0xfff0cf
                : active
                    ? 0xfff0c5
                    : 0x7f6840;
        const radius = Math.max(10, Math.floor(this._cellSize * 0.19));
        const nodeRadius = Math.max(7, Math.floor(this._cellSize * 0.12));
        const nodeReach = Math.max(19, Math.floor(this._cellSize * 0.39));
        const connectedDirs = getGearConnections(type);
        const isPairedPiece = connectedDirs.length === 2
            && type !== GEAR_CODES.FULL
            && type !== GEAR_CODES.SOURCE
            && type !== GEAR_CODES.SINK;

        visual.shell.setFillStyle(shellColor, hovered ? 1 : 0.96);
        visual.shell.setStrokeStyle(2, strokeColor, hovered ? 1 : 0.88);
        visual.glow.setFillStyle(jammed ? 0xff6b60 : (outputLive ? 0xffc978 : 0xf3d98c), (active || jammed) ? 0.24 : 0);
        visual.glow.setRadius(Math.max(12, Math.floor(this._cellSize * 0.25)) + ((active || jammed) ? 8 : 0));
        visual.connectorGfx.clear();
        visual.moveHintGfx?.clear();
        visual.primaryGearGfx.clear();
        visual.secondaryGearGfx.clear();
        visual.faultGfx?.clear();
        visual.nodeRotators?.forEach((nodeView) => {
            nodeView.gearGfx.clear();
            nodeView.rotator.setVisible(false).setPosition(0, 0);
        });
        visual.badgeText.setVisible(false);
        visual.faultText?.setVisible(false).setText('');
        visual.primaryRotator.setVisible(false).setPosition(0, 0);
        visual.secondaryRotator.setVisible(false).setPosition(0, 0);
        visual.spinMode = isPairedPiece ? 'paired' : 'single';

        if (isClamp) {
            const jawWidth = Math.max(14, Math.floor(this._cellSize * 0.22));
            const jawHeight = Math.max(22, Math.floor(this._cellSize * 0.44));
            visual.connectorGfx.fillStyle(0xc2c9d0, 0.94);
            visual.connectorGfx.fillRoundedRect(-(jawWidth + 10), -(jawHeight / 2), jawWidth, jawHeight, 6);
            visual.connectorGfx.fillRoundedRect(10, -(jawHeight / 2), jawWidth, jawHeight, 6);
            visual.connectorGfx.fillStyle(0x7b848b, 0.98);
            visual.connectorGfx.fillCircle(0, 0, 8);
            visual.connectorGfx.fillRoundedRect(-8, -4, 16, 8, 4);
            visual.badgeText.setText('CLAMP').setColor('#eff6fb').setVisible(true);
            if (movable) {
                this._drawMovableIndicator(visual.moveHintGfx, hovered, true);
            }
            this._drawGearFaultOverlay(visual, faultType, { clamped, isClamp: true });
            this._syncSpin(visual, false, direction);
            return;
        }

        if (isWall) {
            const stripeWidth = Math.max(6, Math.floor((this._cellSize - 20) / 5));
            for (let index = -2; index <= 2; index += 1) {
                const x = index * stripeWidth;
                visual.connectorGfx.fillStyle(index % 2 === 0 ? 0x8b949b : 0x616970, 0.92);
                visual.connectorGfx.fillRoundedRect(x - 8, -((this._cellSize - 28) / 2), stripeWidth, this._cellSize - 28, 4);
            }
            if (!movable && FACTORY_DEBUG.enabled) {
                visual.badgeText.setText('LOCK').setColor('#f2f4f6').setVisible(true);
            }
            if (movable) {
                this._drawMovableIndicator(visual.moveHintGfx, hovered, active);
            }
            this._drawGearFaultOverlay(visual, faultType, { clamped: visuallyClamped, isClamp: false });
            this._syncSpin(visual, false, direction);
            return;
        }

        const nodePositions = connectedDirs.map((dir) => ({ dir, ...getGearDirectionPosition(dir, nodeReach) }));
        const connectionPairs = connectedDirs.length === 2
            ? [[nodePositions[0], nodePositions[1]]]
            : connectedDirs.length === 4
                ? [
                    [nodePositions.find((node) => node.dir === 'N'), nodePositions.find((node) => node.dir === 'S')],
                    [nodePositions.find((node) => node.dir === 'E'), nodePositions.find((node) => node.dir === 'W')],
                ].filter((pair) => pair[0] && pair[1])
                : [];

        if (isPairedPiece) {
            const pairRadius = Math.max(12, Math.floor(this._cellSize * 0.18));
            const pairCenters = this._getPairedGearCenters(connectedDirs);
            visual.connectorGfx.lineStyle(Math.max(3, Math.floor(this._cellSize * 0.075)), linkColor, 0.42);
            visual.connectorGfx.lineBetween(pairCenters[0].x, pairCenters[0].y, pairCenters[1].x, pairCenters[1].y);
            visual.primaryRotator.setVisible(true).setPosition(pairCenters[0].x, pairCenters[0].y);
            visual.secondaryRotator.setVisible(true).setPosition(pairCenters[1].x, pairCenters[1].y);
            this._drawGearGlyph(visual.primaryGearGfx, pairRadius, teethColor, gearColor, active);
            this._drawGearGlyph(visual.secondaryGearGfx, pairRadius, teethColor, gearColor, active);
        } else {
            connectionPairs.forEach(([from, to]) => {
                visual.connectorGfx.lineStyle(Math.max(3, Math.floor(this._cellSize * 0.075)), linkColor, 0.5);
                visual.connectorGfx.lineBetween(from.x, from.y, to.x, to.y);
            });
            nodePositions.forEach((node, index) => {
                const nodeView = visual.nodeRotators?.[index];
                if (!nodeView) return;
                nodeView.rotator.setVisible(true).setPosition(node.x, node.y);
                this._drawMiniGearGlyph(nodeView.gearGfx, nodeRadius, teethColor, gearColor, active || outputLive || jammed);
            });
            visual.primaryRotator.setVisible(true).setPosition(0, 0);
            this._drawGearGlyph(visual.primaryGearGfx, radius, teethColor, gearColor, active || jammed);
        }

        if (type === GEAR_CODES.SOURCE) {
            visual.badgeText.setText('IN').setColor(jammed ? '#ffd7d3' : (active ? '#d8fff0' : '#d0e4ec')).setVisible(true);
        } else if (type === GEAR_CODES.SINK) {
            visual.badgeText.setText('OUT').setColor(jammed ? '#ffd7d3' : (outputLive ? '#fff4d0' : '#d0e4ec')).setVisible(true);
        } else if (isRust) {
            visual.badgeText.setText('RUST').setColor(jammed ? '#ffe6e3' : '#ffd4b0').setVisible(true);
            visual.connectorGfx.lineStyle(2, jammed ? 0xffd8d2 : 0xe0a06e, 0.78);
            visual.connectorGfx.lineBetween(-18, -12, 18, 12);
            visual.connectorGfx.lineBetween(-12, 18, 14, -18);
        }

        if (movable) {
            this._drawMovableIndicator(visual.moveHintGfx, hovered, jammed || active || outputLive);
        }

        this._drawGearFaultOverlay(visual, faultType, { clamped: visuallyClamped, isClamp: false });

        this._syncSpin(
            visual,
            !jammed && active && isGearType(type) && !isRust,
            direction,
            type === GEAR_CODES.SINK ? outputLive : false,
        );
    }

    _syncSpin(visual, shouldSpin, direction = 1, highlighted = false) {
        if (!visual?.primaryRotator) return;

        const safeDirection = direction < 0 ? -1 : 1;
        const nextSignature = shouldSpin
            ? `${visual.spinMode}:${safeDirection}:${highlighted ? 'live' : 'active'}`
            : 'idle';
        if (visual.spinSignature === nextSignature) return;

        visual.spinSignature = nextSignature;
        visual.spinTweens?.forEach((tween) => tween?.stop());
        visual.spinTweens = [];
        [visual.primaryRotator, visual.secondaryRotator, ...(visual.nodeRotators || []).map((nodeView) => nodeView.rotator)].forEach((rotator) => {
            if (!rotator) return;
            this.scene.tweens.killTweensOf(rotator);
            rotator.angle = 0;
        });

        if (!shouldSpin) return;

        const duration = highlighted ? 900 : 1100;
        const spinTargets = visual.spinMode === 'paired'
            ? [
                { rotator: visual.primaryRotator, direction: safeDirection },
                { rotator: visual.secondaryRotator, direction: -safeDirection },
            ]
            : [
                { rotator: visual.primaryRotator, direction: safeDirection },
                ...(visual.nodeRotators || []).map((nodeView, index) => ({
                    rotator: nodeView.rotator,
                    direction: safeDirection,
                })),
            ];

        spinTargets.forEach(({ rotator, direction }) => {
            if (!rotator?.visible) return;
            visual.spinTweens.push(this.scene.tweens.add({
                targets: rotator,
                angle: rotator.angle + (direction * 360),
                duration,
                repeat: -1,
                ease: 'Linear',
            }));
        });
    }

    _drawGearFaultOverlay(visual, faultType = null, { clamped = false, isClamp = false } = {}) {
        if (!visual?.faultGfx || !visual?.faultText) return;

        visual.faultGfx.clear();
        visual.faultText.setVisible(false).setText('').setAngle(0).setPosition(0, 0);

        if (clamped && !isClamp) {
            const size = this._cellSize - 16;
            visual.faultGfx.fillStyle(0xcfd5db, 0.12);
            visual.faultGfx.fillRoundedRect(-(size / 2), -(size / 2), size, size, 10);
            visual.faultGfx.lineStyle(2, 0xb9c0c7, 0.72);
            visual.faultGfx.lineBetween(-(size / 2) + 6, -(size / 2) + 6, (size / 2) - 6, (size / 2) - 6);
            visual.faultGfx.lineBetween((size / 2) - 6, -(size / 2) + 6, -(size / 2) + 6, (size / 2) - 6);
        }

        if (!faultType) return;

        if (faultType === 'cracked-drive' || faultType === 'cracked-gear') {
            visual.faultGfx.fillStyle(0x070707, 0.34);
            visual.faultGfx.fillTriangle(-12, -22, 6, -2, 22, 20);
            visual.faultGfx.lineStyle(3, 0xffc39c, 0.95);
            visual.faultGfx.beginPath();
            visual.faultGfx.moveTo(-18, -20);
            visual.faultGfx.lineTo(-4, -6);
            visual.faultGfx.lineTo(-10, 6);
            visual.faultGfx.lineTo(4, 18);
            visual.faultGfx.lineTo(12, 4);
            visual.faultGfx.lineTo(20, 18);
            visual.faultGfx.strokePath();
            visual.faultText.setText('CRACK').setVisible(true).setPosition(0, 24);
            return;
        }

        if (faultType === 'virus-gear') {
            visual.faultGfx.lineStyle(2, 0xff736c, 0.96);
            visual.faultGfx.strokeRoundedRect(-24, -10, 48, 20, 6);
            visual.faultGfx.lineBetween(-20, -14, 20, 14);
            visual.faultGfx.lineBetween(-16, 14, 16, -14);
            visual.faultText.setText('VIRUS').setVisible(true).setAngle(-16).setPosition(0, 0);
            return;
        }

        if (faultType === 'spark-instability') {
            visual.faultGfx.lineStyle(2, 0xff6960, 0.96);
            visual.faultGfx.lineBetween(-20, -16, -30, -28);
            visual.faultGfx.lineBetween(-4, -24, 4, -38);
            visual.faultGfx.lineBetween(14, -10, 26, -24);
            visual.faultGfx.lineBetween(-18, 10, -28, 22);
            visual.faultGfx.lineBetween(18, 10, 30, 24);
            visual.faultGfx.strokeCircle(0, 0, 16);
            visual.faultText.setText('SPARK').setVisible(true).setPosition(0, 24);
        }
    }

    _setPieceHover(pieceView, hovered) {
        if (this._dragState?.pieceView === pieceView) return;
        pieceView.visual.hovered = hovered;
        const cellKey = gearCellKey(pieceView.piece.row, pieceView.piece.col);
        const clamped = this._isClampedCell(cellKey);
        const isClamp = pieceView.piece.role === 'deadlock-clamp';
        const active = !clamped || isClamp ? Boolean(this._lastEvaluation?.powered.has(cellKey)) : false;
        const jammed = !clamped || isClamp ? Boolean(this._lastEvaluation?.jammedCells?.has(cellKey)) : false;
        const direction = !clamped || isClamp ? (this._lastEvaluation?.directions?.get(cellKey) ?? 1) : 1;
        this._drawGearVisual(pieceView.visual, pieceView.piece.type, {
            movable: pieceView.piece.movable !== false,
            hovered,
            active,
            jammed,
            direction,
            pieceRole: pieceView.piece.role || null,
            faultType: this._getFaultTypeForPiece(pieceView.piece),
            clamped,
        });
        pieceView.container.setScale(hovered ? 1.03 : 1);
    }

    _beginPieceIntent(pieceView, pointer) {
        if (!this.active) return;
        if (pieceView.piece.movable === false) return;
        if (this._dragState && this._dragState.pointerId !== pointer.id) return;

        this._dragState = {
            pieceView,
            pointerId: pointer.id,
            startWorldX: pointer.worldX,
            startWorldY: pointer.worldY,
            offsetX: pointer.worldX - this._panel.x - pieceView.container.x,
            offsetY: pointer.worldY - this._panel.y - pieceView.container.y,
            startRow: pieceView.piece.row,
            startCol: pieceView.piece.col,
            dragging: false,
        };
        this._panel.bringToTop(pieceView.container);
    }

    _handlePointerMove(pointer) {
        if (!this.active) {
            this._dragState = null;
            return;
        }
        if (!this._dragState || this._dragState.pointerId !== pointer.id) return;

        const dragDistance = Phaser.Math.Distance.Between(
            pointer.worldX,
            pointer.worldY,
            this._dragState.startWorldX,
            this._dragState.startWorldY,
        );

        if (!this._dragState.dragging && dragDistance >= 6) {
            this._dragState.dragging = true;
            this._dragState.pieceView.container.setScale(1.08);
        }

        if (!this._dragState.dragging) return;

        const pieceView = this._dragState.pieceView;
        pieceView.container.setPosition(
            pointer.worldX - this._panel.x - this._dragState.offsetX,
            pointer.worldY - this._panel.y - this._dragState.offsetY,
        );

        const candidate = this._getBoardCellFromWorld(pointer.worldX, pointer.worldY);
        const valid = candidate ? this._canPlacePieceAt(pieceView, candidate.row, candidate.col) : false;
        this._showDropPreview(candidate, valid);
        this._syncState({
            persist: false,
            previewPiece: valid ? { id: pieceView.id, row: candidate.row, col: candidate.col } : null,
        });
    }

    _handlePointerUp(pointer) {
        if (!this.active) {
            this._dragState = null;
            return;
        }
        if (!this._dragState || this._dragState.pointerId !== pointer.id) return;

        const { pieceView, dragging, startRow, startCol } = this._dragState;
        const candidate = dragging ? this._getBoardCellFromWorld(pointer.worldX, pointer.worldY) : null;
        const valid = candidate ? this._canPlacePieceAt(pieceView, candidate.row, candidate.col) : false;

        this._dragState = null;
        this._clearDropPreview();

        if (dragging && valid) {
            pieceView.piece.row = candidate.row;
            pieceView.piece.col = candidate.col;
            this._snapPieceToCell(pieceView, candidate.row, candidate.col, true);
            this._playGearSound(SOUND_ASSETS.circuitLock, SOUND_ASSETS.inspectionReveal, SOUND_VOLUMES.puzzleLock);
            this._syncState({ persist: true });
            return;
        }

        this._snapPieceToCell(pieceView, startRow, startCol, true);
        this._syncState({ persist: true });
    }

    _getBoardCellFromWorld(worldX, worldY) {
        const localX = worldX - this._panel.x;
        const localY = worldY - this._panel.y;
        const col = Math.round((localX - this._boardLeft) / this._cellSize - 0.5);
        const row = Math.round((localY - this._boardTop) / this._cellSize - 0.5);
        if (!inBounds(this._board, row, col)) return null;
        return { row, col };
    }

    _canPlacePieceAt(pieceView, row, col) {
        if (pieceView?.piece?.role === 'deadlock-clamp') {
            const cellCode = this._board?.[row]?.[col];
            if (cellCode === GEAR_CODES.WALL || cellCode === GEAR_CODES.SOURCE || cellCode === GEAR_CODES.SINK) {
                return false;
            }

            return !this._pieceViews.some((otherPiece) => (
                otherPiece !== pieceView
                && otherPiece.piece.role === 'deadlock-clamp'
                && otherPiece.piece.row === row
                && otherPiece.piece.col === col
            ));
        }

        if (!isOpenBoardCell(this._board, row, col)) return false;

        return !this._pieceViews.some((otherPiece) => (
            otherPiece !== pieceView
            && otherPiece.piece.row === row
            && otherPiece.piece.col === col
        ));
    }

    _showDropPreview(candidate, valid) {
        this._clearDropPreview();
        if (!candidate) return;

        const cellView = this._cellViewMap.get(gearCellKey(candidate.row, candidate.col));
        if (!cellView) return;

        cellView.previewRect
            .setFillStyle(valid ? 0x87ffc3 : 0xff9a86, valid ? 0.2 : 0.18)
            .setStrokeStyle(2, valid ? 0xdefff0 : 0xffd0c7, 0.92)
            .setAlpha(valid ? 0.5 : 0.38);
        this._previewCellKey = cellView.key;
    }

    _clearDropPreview() {
        if (!this._previewCellKey) return;
        const cellView = this._cellViewMap.get(this._previewCellKey);
        if (cellView) {
            cellView.previewRect.setAlpha(0).setStrokeStyle(2, 0xffffff, 0);
        }
        this._previewCellKey = null;
    }

    _snapPieceToCell(pieceView, row, col, animated) {
        const target = getCellCenter(this._boardLeft, this._boardTop, this._cellSize, row, col);
        pieceView.container.setScale(1);
        this.scene.tweens.killTweensOf(pieceView.container);

        if (animated) {
            this.scene.tweens.add({
                targets: pieceView.container,
                x: target.x,
                y: target.y,
                duration: 180,
                ease: 'Cubic.Out',
            });
        } else {
            pieceView.container.setPosition(target.x, target.y);
        }
    }

    _syncState({ persist = true, previewPiece = null } = {}) {
        if (!this._puzzle) return;

        const pieces = this._pieceViews.map((pieceView) => ({
            ...pieceView.piece,
            row: previewPiece?.id === pieceView.id ? previewPiece.row : pieceView.piece.row,
            col: previewPiece?.id === pieceView.id ? previewPiece.col : pieceView.piece.col,
        }));
        const disabledCells = this._puzzle?.inspectionFault?.blocksDrive
            ? [gearCellKey(this._puzzle.inspectionFault.row, this._puzzle.inspectionFault.col)]
            : [];

        const previousEvaluation = this._lastEvaluation;
        const evaluation = evaluateGearPuzzleBoard(this._board, pieces, {
            allowRustedGears: Boolean(this._puzzle?.allowRustedGears),
            disabledCells,
        });
        this._lastEvaluation = evaluation;
        this._currentClampedCells = evaluation.clampedCells || buildClampedGearCellSet(pieces);

        this._staticViews.forEach((view) => {
            const cellKey = gearCellKey(view.row, view.col);
            const clamped = this._isClampedCell(cellKey);
            const active = clamped ? false : evaluation.powered.has(cellKey);
            const jammed = clamped ? false : evaluation.jammedCells.has(cellKey);
            const direction = clamped ? 1 : (evaluation.directions.get(cellKey) ?? 1);
            this._drawGearVisual(view.visual, view.type, {
                movable: false,
                hovered: false,
                active,
                jammed,
                outputLive: !clamped && view.type === GEAR_CODES.SINK && evaluation.sinkPowered,
                direction,
                faultType: this._getFaultTypeForStaticView(view.row, view.col),
                clamped,
            });
        });

        this._pieceViews.forEach((pieceView) => {
            const currentRow = previewPiece?.id === pieceView.id ? previewPiece.row : pieceView.piece.row;
            const currentCol = previewPiece?.id === pieceView.id ? previewPiece.col : pieceView.piece.col;
            const cellKey = gearCellKey(currentRow, currentCol);
            const clamped = this._isClampedCell(cellKey);
            const isClamp = pieceView.piece.role === 'deadlock-clamp';
            const active = !clamped || isClamp ? evaluation.powered.has(cellKey) : false;
            const jammed = !clamped || isClamp ? evaluation.jammedCells.has(cellKey) : false;
            const direction = !clamped || isClamp ? (evaluation.directions.get(cellKey) ?? 1) : 1;
            this._drawGearVisual(pieceView.visual, pieceView.piece.type, {
                movable: pieceView.piece.movable !== false,
                hovered: pieceView.visual.hovered,
                active,
                jammed,
                direction,
                pieceRole: pieceView.piece.role || null,
                faultType: this._getFaultTypeForPiece(pieceView.piece, currentRow, currentCol),
                clamped,
            });
        });
        this._drawInspectionFault();

        const activeGearCount = Array.from(evaluation.powered).reduce((count, key) => {
            const type = evaluation.occupancy.get(key)?.type;
            return count + (type && isGearType(type) ? 1 : 0);
        }, 0);
        const movableCount = pieces.filter((piece) => piece.movable !== false).length;
        const fixedCount = pieces.length - movableCount;
        const pieceSummary = pieces.map((piece) => `${piece.movable === false ? 'FIX' : 'MOVE'} ${getPieceLabel(piece.type) || 'GEAR'} @ ${piece.row + 1},${piece.col + 1}`);

        if (this._puzzle?.inspectionFault) {
            const statusColor = this._puzzle.inspectionFault.kind === 'hazard'
                ? '#ff9c93'
                : (this._puzzle.inspectionFault.kind === 'compliance' ? '#ffd39c' : '#ffc38d');
            this._statusText
                ?.setText(this._puzzle.inspectionFault.status || 'SCRAP REQUIRED')
                .setColor(statusColor);
            this._summaryText?.setText([
                this._puzzle.inspectionFault.reason || 'Drivetrain fault requires immediate scrap.',
                '',
                `Active gears: ${activeGearCount}`,
                `Loose parts: ${movableCount}`,
                fixedCount > 0 ? `Fixed parts: ${fixedCount}` : 'Fixed parts: 0',
            ].join('\n'));
        } else {
            this._statusText
                ?.setText(evaluation.completed ? 'OUTPUT LIVE' : (evaluation.jammed ? 'TRAIN JAMMED' : 'OUTPUT OFFLINE'))
                .setColor(evaluation.completed ? '#caffb2' : (evaluation.jammed ? '#ff9c93' : '#ffd39c'));
            this._summaryText?.setText([
                `Active gears: ${activeGearCount}`,
                `Loose parts: ${movableCount}`,
                fixedCount > 0 ? `Fixed parts: ${fixedCount}` : 'Fixed parts: 0',
                evaluation.completed
                    ? 'Final shaft is turning.'
                    : (evaluation.jammed ? evaluation.jamReason || 'The train is binding up.' : 'No valid path reaches the output.'),
            ].join('\n'));
        }

        if (!persist) return;

        if (!previousEvaluation?.jammed && evaluation.jammed) {
            this._playGearSound(SOUND_ASSETS.errorBuzz, SOUND_ASSETS.circuitLock, SOUND_VOLUMES.puzzleLock);
        }

        const snapshot = buildGearProgressSnapshot({
            ...this._puzzle,
            board: this._board,
            pieces,
            progress: {
                ...(this._puzzle.progress || {}),
                reviewed: this.evidence.reviewed,
            },
        }, pieces);
        this._puzzle.progress = snapshot;
        this.emitEvidence(snapshot);
    }

    _triggerSpecialAction() {
        if (!this._specialAction?.onTrigger) return;

        this._persistProgress();
        const result = this._specialAction.onTrigger({
            evidence: { ...this.evidence },
            gearPuzzle: this._puzzle,
        });
        if (!result) return;

        if (result.evidence) {
            this.emitEvidence(result.evidence);
        }

        if (result.closeAfter) {
            this.close();
        }
    }

    _persistProgress() {
        if (!this._puzzle || this._pieceViews.length === 0) return;
        this._syncState({ persist: true });
    }

    _finalizeAndClose() {
        this._persistProgress();
        this.close();
    }

    _playGearSound(primarySound, fallbackSound = null, volume = SOUND_VOLUMES.puzzleLock) {
        const chosenSound = primarySound && this.scene.cache.audio.has(primarySound.key)
            ? primarySound
            : (fallbackSound && this.scene.cache.audio.has(fallbackSound.key) ? fallbackSound : null);
        if (!chosenSound) return null;

        const sound = this.scene.sound.add(chosenSound.key, { volume });
        sound.once('complete', () => sound.destroy());
        sound.play();
        return sound;
    }
}
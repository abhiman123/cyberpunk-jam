import * as Phaser from 'phaser';
import MinigameBase from './MinigameBase.js';
import { FACTORY_DEBUG, SOUND_ASSETS, SOUND_VOLUMES } from '../../constants/gameConstants.js';
import {
    GEAR_CODES,
    buildGearProgressSnapshot,
    cloneGearBoard,
    cloneGearPieces,
    evaluateGearPuzzleBoard,
    gearCellKey,
    getGearConnections,
    isGearType,
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
    if (type === GEAR_CODES.MOVABLE_WALL) return 'BLK';
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
        this._puzzle = null;
        this._board = [];
    }

    _defaultEvidence() {
        return {
            symptoms: ['Drive train stalled.'],
            flags: [],
            completed: false,
            poweredCells: [],
            poweredPieces: [],
            pieces: [],
            sinkPowered: false,
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
        this._board = cloneGearBoard(gearPuzzle.board);
        const pieces = cloneGearPieces(gearPuzzle.progress?.pieces || gearPuzzle.pieces || []);

        const rows = this._board.length;
        const cols = Math.max(...this._board.map((row) => row.length));
        this._cellSize = Math.max(CELL_SIZE_MIN, Math.min(CELL_SIZE_MAX, Math.floor(Math.min(500 / cols, 420 / rows))));
        const gridWidth = cols * this._cellSize;
        const gridHeight = rows * this._cellSize;
        this._boardLeft = -154 - 250 + ((500 - gridWidth) / 2);
        this._boardTop = 8 - 210 + ((420 - gridHeight) / 2);

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
        const boardFrame = this.scene.add.rectangle(-154, 8, 560, 476, 0x081317, 0.94)
            .setStrokeStyle(2, 0x5e899a, 0.7);
        const sidePanel = this.scene.add.rectangle(314, 0, 276, 520, 0x081117, 0.88)
            .setStrokeStyle(1, 0x395968, 0.72);
        const headerRule = this.scene.add.rectangle(0, -244, 1006, 2, 0x315161, 0.7);

        this._titleText = this.scene.add.text(-474, -274, gearPuzzle.previewTitle || 'GEAR TRAIN', {
            fontFamily: 'Courier New',
            fontSize: '28px',
            color: '#e6f2f4',
            letterSpacing: 3,
        }).setOrigin(0, 0.5);
        this._subtitleText = this.scene.add.text(-474, -244, gearPuzzle.description || 'Slide the loose gears until the output axle spins.', {
            fontFamily: 'monospace',
            fontSize: '12px',
            color: '#9fc3cf',
            wordWrap: { width: 620 },
            lineSpacing: 4,
        }).setOrigin(0, 0);
        this._statusText = this.scene.add.text(198, -208, 'OUTPUT OFFLINE', {
            fontFamily: 'Courier New',
            fontSize: '18px',
            color: '#ffd39c',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this._statusHintText = this.scene.add.text(198, -178, 'Drag parts onto empty cells. Walls block power and cannot connect.', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#8bb1bf',
            wordWrap: { width: 220 },
            lineSpacing: 4,
        }).setOrigin(0, 0);
        this._summaryText = this.scene.add.text(198, -72, '', {
            fontFamily: 'monospace',
            fontSize: '11px',
            color: '#d6edf2',
            lineSpacing: 6,
            wordWrap: { width: 220 },
        }).setOrigin(0, 0);

        const closeBg = this.scene.add.rectangle(318, 236, 210, 42, 0x243846, 0.94)
            .setStrokeStyle(2, 0xa8c8d2, 0.82)
            .setInteractive({ useHandCursor: true });
        const closeText = this.scene.add.text(318, 236, 'CLOSE GEAR PANEL [ESC]', {
            fontFamily: 'Courier New',
            fontSize: '15px',
            color: '#e6f3f6',
            letterSpacing: 1,
        }).setOrigin(0.5);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x325061, 0.98));
        closeBg.on('pointerout', () => closeBg.setFillStyle(0x243846, 0.94));
        closeBg.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            this._finalizeAndClose();
        });

        panel.add([
            frame,
            inner,
            boardFrame,
            sidePanel,
            headerRule,
            this._titleText,
            this._subtitleText,
            this._statusText,
            this._statusHintText,
            this._summaryText,
            closeBg,
            closeText,
        ]);

        this.container.add([blocker, panel]);
        this._panel = panel;

        const legendTitle = this.scene.add.text(198, 36, 'MOVABLE PARTS', {
            fontFamily: 'Courier New',
            fontSize: '13px',
            color: '#cde6ee',
            letterSpacing: 1,
        }).setOrigin(0, 0.5);
        this._legendContainer = this.scene.add.container(0, 0);
        panel.add([legendTitle, this._legendContainer]);

        this._buildBoard();
        this._buildPieces(pieces);
        this._buildLegend();

        this._escKey = this.scene.input.keyboard.addKey('ESC');
        this._escHandler = () => { if (this.active) this._finalizeAndClose(); };
        this._escKey.on('down', this._escHandler);

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
        this._panel = null;
        this._legendContainer = null;
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
            });
        });

        const movableCount = this._pieceViews.filter((pieceView) => pieceView.piece.movable !== false).length;
        const fixedCount = this._pieceViews.length - movableCount;
        this._statusHintText?.setText(
            fixedCount > 0
                ? `Drag the ${movableCount} loose part${movableCount === 1 ? '' : 's'} with cyan corner marks onto empty cells. ${fixedCount} train part${fixedCount === 1 ? ' stays' : 's stay'} fixed.`
                : 'Drag the cyan-marked parts onto empty cells. Walls block power and cannot connect.'
        );
    }

    _buildLegend() {
        if (!this._legendContainer) return;
        this._legendContainer.removeAll(true);

        const movablePieces = this._pieceViews.filter((pieceView) => pieceView.piece.movable !== false);
        if (movablePieces.length === 0) {
            const emptyText = this.scene.add.text(218, 84, 'NO LOOSE PARTS', {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#c9dbe3',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            this._legendContainer.add(emptyText);
            return;
        }

        movablePieces.forEach((pieceView, index) => {
            const y = 72 + (index * 56);
            const sample = this._createGearVisual(pieceView.piece.type, true);
            sample.container.setScale(0.48);
            sample.container.setPosition(218, y);
            this._drawGearVisual(sample, pieceView.piece.type, { movable: true, hovered: false, active: false });
            const title = this.scene.add.text(246, y - 10, `PART ${index + 1}`, {
                fontFamily: 'Courier New',
                fontSize: '11px',
                color: '#dbeff4',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            const label = this.scene.add.text(246, y + 9, getPieceLabel(pieceView.piece.type) || 'GEAR', {
                fontFamily: 'monospace',
                fontSize: '10px',
                color: '#8db2bf',
            }).setOrigin(0, 0.5);
            const hint = this.scene.add.text(246, y + 23, 'DRAGGABLE', {
                fontFamily: 'monospace',
                fontSize: '9px',
                color: '#a6eef3',
                letterSpacing: 1,
            }).setOrigin(0, 0.5);
            this._legendContainer.add([sample.container, title, label, hint]);
        });
    }

    _createGearVisual(type, movable) {
        const container = this.scene.add.container(0, 0);
        const shell = this.scene.add.rectangle(0, 0, this._cellSize - 6, this._cellSize - 6, 0x142029, 0.96)
            .setStrokeStyle(2, 0x4a6976, 0.88);
        const glow = this.scene.add.circle(0, 0, Math.max(10, Math.floor(this._cellSize * 0.24)), 0x91ffd2, 0);
        const connectorGfx = this.scene.add.graphics();
        const moveHintGfx = this.scene.add.graphics();
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

        primaryRotator.add(primaryGearGfx);
        secondaryRotator.add(secondaryGearGfx);
        container.add([glow, shell, connectorGfx, moveHintGfx, ...nodeRotators.map((nodeView) => nodeView.rotator), primaryRotator, secondaryRotator, badgeText]);

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

    _drawGearVisual(visual, type, { movable = false, hovered = false, active = false, outputLive = false } = {}) {
        const isWall = type === GEAR_CODES.MOVABLE_WALL || type === GEAR_CODES.WALL;
        const shellColor = isWall
            ? (movable ? 0x596168 : 0x393f45)
            : active
                ? 0x3f3728
                : movable
                    ? 0x252e34
                    : 0x1b2329;
        const strokeColor = isWall
            ? (movable ? 0xd4dde3 : 0xaab2b8)
            : active
                ? 0xffefc7
                : movable
                    ? 0xd6d2b9
                    : 0x94a1aa;
        const linkColor = outputLive
            ? 0xffd48a
            : active
                ? 0xe9e1b0
                : 0x8a907a;
        const gearColor = isWall
            ? (movable ? 0x7f8a91 : 0x596168)
            : outputLive
                ? 0xffd697
                : active
                    ? 0xf3dfad
                    : movable
                        ? 0xcfba85
                        : 0xa99267;
        const teethColor = isWall
            ? (movable ? 0xe8eef2 : 0xc8d0d6)
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
        visual.glow.setFillStyle(outputLive ? 0xffc978 : 0xf3d98c, active ? 0.24 : 0);
        visual.glow.setRadius(Math.max(12, Math.floor(this._cellSize * 0.25)) + (active ? 8 : 0));
        visual.connectorGfx.clear();
        visual.moveHintGfx?.clear();
        visual.primaryGearGfx.clear();
        visual.secondaryGearGfx.clear();
        visual.nodeRotators?.forEach((nodeView) => {
            nodeView.gearGfx.clear();
            nodeView.rotator.setVisible(false).setPosition(0, 0);
        });
        visual.badgeText.setVisible(false);
        visual.primaryRotator.setVisible(false).setPosition(0, 0);
        visual.secondaryRotator.setVisible(false).setPosition(0, 0);
        visual.spinMode = isPairedPiece ? 'paired' : 'single';

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
            this._syncSpin(visual, false);
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
                this._drawMiniGearGlyph(nodeView.gearGfx, nodeRadius, teethColor, gearColor, active || outputLive);
            });
            visual.primaryRotator.setVisible(true).setPosition(0, 0);
            this._drawGearGlyph(visual.primaryGearGfx, radius, teethColor, gearColor, active);
        }

        if (type === GEAR_CODES.SOURCE) {
            visual.badgeText.setText('IN').setColor(active ? '#d8fff0' : '#d0e4ec').setVisible(true);
        } else if (type === GEAR_CODES.SINK) {
            visual.badgeText.setText('OUT').setColor(outputLive ? '#fff4d0' : '#d0e4ec').setVisible(true);
        }

        if (movable) {
            this._drawMovableIndicator(visual.moveHintGfx, hovered, active || outputLive);
        }

        this._syncSpin(visual, active && isGearType(type), type === GEAR_CODES.SINK ? outputLive : false);
    }

    _syncSpin(visual, shouldSpin, highlighted = false) {
        if (!visual?.primaryRotator) return;

        const nextSignature = shouldSpin
            ? `${visual.spinMode}:${highlighted ? 'live' : 'active'}`
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
        const primaryDirection = highlighted ? 1 : ((visual.type === GEAR_CODES.HORIZONTAL || visual.type === GEAR_CODES.CURVE_NE || visual.type === GEAR_CODES.CURVE_SW) ? 1 : -1);
        const spinTargets = visual.spinMode === 'paired'
            ? [
                { rotator: visual.primaryRotator, direction: 1 },
                { rotator: visual.secondaryRotator, direction: -1 },
            ]
            : [
                { rotator: visual.primaryRotator, direction: primaryDirection },
                ...(visual.nodeRotators || []).map((nodeView, index) => ({
                    rotator: nodeView.rotator,
                    direction: index % 2 === 0 ? -primaryDirection : primaryDirection,
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

    _setPieceHover(pieceView, hovered) {
        if (this._dragState?.pieceView === pieceView) return;
        pieceView.visual.hovered = hovered;
        const active = Boolean(this._lastEvaluation?.powered.has(gearCellKey(pieceView.piece.row, pieceView.piece.col)));
        this._drawGearVisual(pieceView.visual, pieceView.piece.type, {
            movable: pieceView.piece.movable !== false,
            hovered,
            active,
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

        const evaluation = evaluateGearPuzzleBoard(this._board, pieces);
        this._lastEvaluation = evaluation;

        this._staticViews.forEach((view) => {
            const active = evaluation.powered.has(gearCellKey(view.row, view.col));
            this._drawGearVisual(view.visual, view.type, {
                movable: false,
                hovered: false,
                active,
                outputLive: view.type === GEAR_CODES.SINK && evaluation.sinkPowered,
            });
        });

        this._pieceViews.forEach((pieceView) => {
            const currentRow = previewPiece?.id === pieceView.id ? previewPiece.row : pieceView.piece.row;
            const currentCol = previewPiece?.id === pieceView.id ? previewPiece.col : pieceView.piece.col;
            const active = evaluation.powered.has(gearCellKey(currentRow, currentCol));
            this._drawGearVisual(pieceView.visual, pieceView.piece.type, {
                movable: pieceView.piece.movable !== false,
                hovered: pieceView.visual.hovered,
                active,
            });
        });

        const activeGearCount = Array.from(evaluation.powered).reduce((count, key) => {
            const type = evaluation.occupancy.get(key)?.type;
            return count + (type && isGearType(type) ? 1 : 0);
        }, 0);
        const movableCount = pieces.filter((piece) => piece.movable !== false).length;
        const fixedCount = pieces.length - movableCount;
        const pieceSummary = pieces.map((piece) => `${piece.movable === false ? 'FIX' : 'MOVE'} ${getPieceLabel(piece.type) || 'GEAR'} @ ${piece.row + 1},${piece.col + 1}`);

        this._statusText
            ?.setText(evaluation.completed ? 'OUTPUT LIVE' : 'OUTPUT OFFLINE')
            .setColor(evaluation.completed ? '#caffb2' : '#ffd39c');
        this._summaryText?.setText([
            `Active gears: ${activeGearCount}`,
            `Loose parts: ${movableCount}`,
            fixedCount > 0 ? `Fixed parts: ${fixedCount}` : 'Fixed parts: 0',
            evaluation.completed ? 'Final shaft is turning.' : 'No valid path reaches the output.',
            '',
            ...pieceSummary,
        ].join('\n'));

        if (!persist) return;

        const snapshot = buildGearProgressSnapshot({ board: this._board, pieces }, pieces);
        this._puzzle.progress = snapshot;
        this.emitEvidence(snapshot);
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
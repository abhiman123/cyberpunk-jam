import MinigameBase from './MinigameBase.js';
import { SOUND_ASSETS, SOUND_VOLUMES } from '../../constants/gameConstants.js';

// Base connections [N, E, S, W]
const TILE_BASE = {
    empty:    [0, 0, 0, 0],
    straight: [1, 0, 1, 0],
    curve:    [1, 1, 0, 0],
    tee:      [1, 1, 1, 0],
    cross:    [1, 1, 1, 1],
};

const DIRS = [
    { dx:  0, dy: -1, idx: 0, opp: 2 }, // N
    { dx:  1, dy:  0, idx: 1, opp: 3 }, // E
    { dx:  0, dy:  1, idx: 2, opp: 0 }, // S
    { dx: -1, dy:  0, idx: 3, opp: 1 }, // W
];

const FLOW_POWER_PALETTES = Object.freeze({
    neutral: { tint: 0x00ffcc, label: '#00ffcc', idle: '#66aaaa', dot: 0xffcc44 },
    green: { tint: 0x73ffae, label: '#73ffae', idle: '#77b494', dot: 0x73ffae },
    orange: { tint: 0xffbe6d, label: '#ffbe6d', idle: '#c79a66', dot: 0xffbe6d },
    mixed: { tint: 0xff7167, label: '#ffb0a8', idle: '#cc847c', dot: 0xff7167 },
});

function getFlowPowerPalette(powerClass = 'neutral') {
    return FLOW_POWER_PALETTES[powerClass] || FLOW_POWER_PALETTES.neutral;
}

function recordFlowFeed(targetMap, key, source) {
    if (!targetMap[key]) {
        targetMap[key] = [];
    }

    if (targetMap[key].some((entry) => entry.key === source.key)) {
        return;
    }

    targetMap[key].push({
        key: source.key,
        powerClass: source.powerClass || 'neutral',
        label: source.label || source.key,
        row: source.row,
    });
}

function cloneCircuitTiles(tiles) {
    if (!Array.isArray(tiles)) return [];
    return tiles.map((row) => row.map((cell) => ({ ...cell })));
}

function humanizeTargetLabel(label) {
    return String(label || '')
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function rotatedConnections(type, rotation) {
    const base = TILE_BASE[type] || TILE_BASE.empty;
    const out = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) out[(i + rotation) % 4] = base[i];
    return out;
}

// ── Procedural generator ────────────────────────────────────────────────────
// Builds a guaranteed-solvable board by carving L-shaped paths from the source
// to each output, unioning connections at intersections, then scrambling
// rotations of non-symmetric tiles.

function carvePath(tiles, sr, outRow, cols, branchCol) {
    const add = (x, y, d) => tiles[y][x]._dirs.add(d);
    add(0, sr, 'W');
    for (let x = 0; x < branchCol; x++) { add(x, sr, 'E'); add(x + 1, sr, 'W'); }
    if (outRow !== sr) {
        const step = outRow < sr ? -1 : 1;
        const vert = outRow < sr ? 'N' : 'S';
        const rev  = outRow < sr ? 'S' : 'N';
        add(branchCol, sr, vert);
        let y = sr;
        while (y + step !== outRow) { add(branchCol, y + step, rev); add(branchCol, y + step, vert); y += step; }
        add(branchCol, outRow, rev);
    }
    for (let x = branchCol; x < cols - 1; x++) { add(x, outRow, 'E'); add(x + 1, outRow, 'W'); }
    add(cols - 1, outRow, 'E');
}

function finalizeTile(cell) {
    const dirs = cell._dirs;
    const bits = [dirs.has('N') ? 1 : 0, dirs.has('E') ? 1 : 0, dirs.has('S') ? 1 : 0, dirs.has('W') ? 1 : 0];
    const count = bits.reduce((a, b) => a + b, 0);
    if (count === 0) { cell.type = 'empty'; cell.rotation = 0; return; }
    if (count === 4) { cell.type = 'cross'; cell.rotation = 0; return; }
    if (count === 3) {
        cell.type = 'tee';
        if (!bits[3]) cell.rotation = 0;
        else if (!bits[0]) cell.rotation = 1;
        else if (!bits[1]) cell.rotation = 2;
        else cell.rotation = 3;
        return;
    }
    if (count === 2) {
        if ((bits[0] && bits[2]) || (bits[1] && bits[3])) {
            cell.type = 'straight';
            cell.rotation = bits[0] ? 0 : 1;
        } else {
            cell.type = 'curve';
            if (bits[0] && bits[1]) cell.rotation = 0;
            else if (bits[1] && bits[2]) cell.rotation = 1;
            else if (bits[2] && bits[3]) cell.rotation = 2;
            else cell.rotation = 3;
        }
        return;
    }
    // count === 1: dead-end stub — use a straight that covers the direction
    cell.type = 'straight';
    cell.rotation = (bits[0] || bits[2]) ? 0 : 1;
}

function generateCircuit(spec, rows, cols) {
    const tiles = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => ({ type: 'empty', rotation: 0, _dirs: new Set() }))
    );
    const sr = spec.sourceRow;
    const outputRows = Object.keys(spec.outputs).map(Number);

    outputRows.forEach((outRow, i) => {
        const branchCol = outRow === sr ? (cols - 1) : Math.min(1 + i, cols - 2);
        carvePath(tiles, sr, outRow, cols, branchCol);
    });

    const pathCells = [];
    tiles.forEach((row, y) => row.forEach((cell, x) => {
        if (cell._dirs.size > 0 && !(x === 0 && y === sr) && !(x === cols - 1 && outputRows.includes(y))) {
            pathCells.push([x, y]);
        }
    }));

    tiles.forEach(row => row.forEach(cell => { finalizeTile(cell); delete cell._dirs; }));

    // Scramble rotations (skip empty and rotation-symmetric tiles)
    tiles.forEach(row => row.forEach(cell => {
        if (cell.type === 'empty' || cell.type === 'cross') return;
        // Scramble but ensure starting rotation is not already solved (add 1-3)
        cell.rotation = (cell.rotation + 1 + Math.floor(Math.random() * 3)) % 4;
    }));

    // Place forbidden cells on path
    const forbidden = [];
    const count = spec.forbiddenCount || 0;
    const pool = [...pathCells];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        forbidden.push(pool.splice(idx, 1)[0]);
    }

    return { tiles, forbidden };
}

export default class CircuitRouting extends MinigameBase {
    constructor(scene, config = {}) {
        super(scene, { depth: 180, ...config });
        this.cellSize = 64;
        this.rows = 5;
        this.cols = 5;
        this.boardX = 640 - (this.cols * this.cellSize) / 2;
        this.boardY = 360 - (this.rows * this.cellSize) / 2;
        this._energyPhase = 0;
        this._energyTickEvent = null;
        this._lastCircuitRenderState = null;
        this._sourceFlowGfx = null;
        this._sourceViews = {};
        this._sources = [];
        this._outputSpecs = [];
        this._inspectionFaultGfx = null;
        this._inspectionFault = null;
        this._closeButton = null;
        this._closeButtonLabel = null;
        this._specialAction = null;
        this._specialActionButton = null;
        this._specialActionLabel = null;
        this._escKeyDown = null;
    }

    _defaultEvidence() {
        return {
            connected: [],
            missing: [],
            repairedTargets: [],
            brokenTargets: [],
            repairStates: [],
            forbiddenUsed: false,
            completed: false,
            reviewed: false,
            scrapRequired: false,
            scrapKind: null,
            scrapStatus: null,
            scrapReason: null,
            outputFeeds: {},
            flags: [],
            symptoms: [],
        };
    }

    _build(caseData) {
        const depth = this.config.depth;
        const circuit = caseData.circuit;
        if (!circuit) {
            this.emitEvidence({ completed: false, note: 'no circuit data' });
            return;
        }

        this._circuit = circuit;
        this._specialAction = caseData?.specialAction || null;
        this.evidence = {
            ...this._defaultEvidence(),
            ...(circuit.progress || {}),
            flags: Array.isArray(circuit.progress?.flags) ? [...circuit.progress.flags] : [],
            symptoms: Array.isArray(circuit.progress?.symptoms) ? [...circuit.progress.symptoms] : [],
        };
        this._sources = Array.isArray(circuit.sources) && circuit.sources.length > 0
            ? circuit.sources.map((source) => ({ ...source }))
            : [{ key: 'main', row: circuit.sourceRow ?? 2, powerClass: 'neutral', label: 'PWR' }];
        this._outputSpecs = Array.isArray(circuit.outputSpecs) && circuit.outputSpecs.length > 0
            ? circuit.outputSpecs.map((outputSpec) => ({ ...outputSpec }))
            : Object.entries(circuit.outputs || {}).map(([row, label]) => ({
                key: label,
                label,
                row: Number(row),
                displayName: humanizeTargetLabel(label),
                brokenLabel: `${humanizeTargetLabel(label)} offline.`,
                fixedLabel: `${humanizeTargetLabel(label)} restored.`,
                powerClass: 'neutral',
                exactFeeds: 1,
                sourceKey: 'main',
            }));
        this._outputs = Object.fromEntries(this._outputSpecs.map((outputSpec) => [outputSpec.row, outputSpec.label]));
        this._sourceRow = this._sources[0]?.row ?? circuit.sourceRow ?? 2;
        this._inspectionFault = circuit.progress?.inspectionFault || circuit.inspectionFault || null;
        this._repairTargets = this._resolveRepairTargets(circuit);
        this._repairTargetViews = [];
        if (this.evidence.scrapRequired && !this.evidence.reviewed) {
            this.emitEvidence({ reviewed: true });
        }

        let tiles, forbiddenList;
        if (Array.isArray(circuit.progress?.tiles) && circuit.progress.tiles.length > 0) {
            tiles = cloneCircuitTiles(circuit.progress.tiles);
            forbiddenList = circuit.forbidden || [];
        } else if (circuit.tiles) {
            tiles = cloneCircuitTiles(circuit.tiles);
            forbiddenList = circuit.forbidden || [];
        } else {
            // Check if we already generated tiles for this case
            if (circuit._generatedTiles) {
                tiles = cloneCircuitTiles(circuit._generatedTiles);
            } else {
                // Generate new circuit tiles and cache them
                const gen = generateCircuit(circuit, this.rows, this.cols);
                tiles = gen.tiles;
                // Store only the tiles for future use (forbidden cells will be random each time)
                circuit._generatedTiles = cloneCircuitTiles(tiles);
            }

            // Always generate fresh forbidden cells for randomization
            const pathCells = [];
            tiles.forEach((row, y) => row.forEach((cell, x) => {
                if (cell.type !== 'empty' && !(x === 0 && y === this._sourceRow) && !(x === this.cols - 1 && Object.keys(this._outputs).map(Number).includes(y))) {
                    pathCells.push([x, y]);
                }
            }));

            forbiddenList = [];
            const count = circuit.forbiddenCount || 0;
            const pool = [...pathCells];
            for (let i = 0; i < count && pool.length > 0; i++) {
                const idx = Math.floor(Math.random() * pool.length);
                forbiddenList.push(pool.splice(idx, 1)[0]);
            }
        }
        this._tiles = tiles;
        this._forbidden = new Set(forbiddenList.map(([x, y]) => `${x},${y}`));
        this._tileGfx = [];

        // Full-screen input blocker so clicks don't leak to UI below
        const blocker = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6)
            .setDepth(depth - 1)
            .setInteractive();
        blocker.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
        });
        blocker.on('pointerup', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
        });
        this.container.add(blocker);

        // Backdrop — diegetic hologram panel
        const bg = this.scene.add.rectangle(640, 360, 1100, 620, 0x001417, 0.94)
            .setDepth(depth);
        this.container.add(bg);

        const scan = this.scene.add.graphics().setDepth(depth + 1);
        scan.fillStyle(0x00ffff, 0.04);
        for (let y = 0; y < 620; y += 3) scan.fillRect(90, 50 + y, 1100, 1);
        this.container.add(scan);

        const frame = this.scene.add.graphics().setDepth(depth + 1);
        frame.lineStyle(1, 0x00cccc, 0.7);
        frame.strokeRect(95, 55, 1090, 610);
        this.container.add(frame);

        const title = this.scene.add.text(640, 85, 'CIRCUIT DIAGNOSTIC — ROUTE POWER TO OUTPUTS', {
            fontFamily: 'Courier New', fontSize: '16px', color: '#00ffff', letterSpacing: 2,
        }).setOrigin(0.5).setDepth(depth + 2);
        this.container.add(title);

        const stage = Number(circuit.dayStage || this.evidence.dayStage || 1);
        const subtitle = this.scene.add.text(640, 108, stage <= 1
            ? 'Click tiles to rotate. Route power to every output. Severed lines mean immediate scrap.'
            : (stage === 2
                ? 'Click tiles to rotate. Match GRN and ORG feeds to the labeled outputs. Each port needs exactly one legal feed.'
                : 'Click tiles to rotate. Match the labeled feeds and avoid overload. Red ports indicate unsafe discharge.'), {
            fontFamily: 'Courier New', fontSize: '10px', color: '#66aaaa',
            align: 'center', wordWrap: { width: 1000 },
        }).setOrigin(0.5).setDepth(depth + 2);
        this.container.add(subtitle);

        // Source indicators
        // Source indicator
        const srcY = this.boardY + this._sourceRow * this.cellSize + this.cellSize / 2;
        const srcX = this.boardX - 40;
        const srcDot = this.scene.add.circle(srcX, srcY, 10, 0xffcc00, 1).setDepth(depth + 2);
        const srcPulse = this.scene.add.circle(srcX, srcY, 18, 0xffcc00, 0.3).setDepth(depth + 1);
        const srcLbl = this.scene.add.text(srcX - 10, srcY, 'PWR', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#ffcc44',
        }).setOrigin(1, 0.5).setDepth(depth + 2);
        this._sourceDot = srcDot;
        this._sourcePulse = srcPulse;
        this._sourceFlowGfx = this.scene.add.graphics().setDepth(depth + 1);
        this._sourceViews = {};
        this.container.add(this._sourceFlowGfx);
        this._sources.forEach((source) => {
            const palette = getFlowPowerPalette(source.powerClass);
            const srcY = this.boardY + source.row * this.cellSize + this.cellSize / 2;
            const srcX = this.boardX - 40;
            const srcDot = this.scene.add.circle(srcX, srcY, 10, palette.dot, 1).setDepth(depth + 2);
            const srcPulse = this.scene.add.circle(srcX, srcY, 18, palette.dot, 0.22).setDepth(depth + 1);
            const srcLbl = this.scene.add.text(srcX - 10, srcY, source.label || source.key, {
                fontFamily: 'monospace', fontSize: '10px', color: palette.label,
            }).setOrigin(1, 0.5).setDepth(depth + 2);
            this._sourceViews[source.key] = { source, dot: srcDot, pulse: srcPulse, label: srcLbl };
            this.container.add([srcDot, srcPulse, srcLbl]);
        });

        // Output indicators
        this._outputDots = {};
        this._outputSpecs.forEach((outputSpec) => {
            const y = outputSpec.row;
            const ox = this.boardX + this.cols * this.cellSize + 40;
            const oy = this.boardY + y * this.cellSize + this.cellSize / 2;
            const requiredPalette = getFlowPowerPalette(outputSpec.powerClass);
            const glow = this.scene.add.circle(ox, oy, 19, 0xaaffee, 0).setDepth(depth + 1);
            const ring = this.scene.add.circle(ox, oy, 15, 0x00ffcc, 0)
                .setDepth(depth + 1)
                .setStrokeStyle(2, 0xaefdf3, 0);
            const dot = this.scene.add.circle(ox, oy, 10, 0x225533, 1).setDepth(depth + 2);
            const lbl = this.scene.add.text(ox + 16, oy - 7, outputSpec.label, {
                fontFamily: 'Courier New', fontSize: '11px', color: requiredPalette.idle,
            }).setOrigin(0, 0.5).setDepth(depth + 2);
            const req = this.scene.add.text(ox + 16, oy + 8, `${String(outputSpec.powerClass || 'neutral').toUpperCase()} x${outputSpec.exactFeeds ?? 1}`, {
                fontFamily: 'monospace', fontSize: '8px', color: requiredPalette.label,
            }).setOrigin(0, 0.5).setDepth(depth + 2);
            this.container.add([glow, ring, dot, lbl, req]);
            this._outputDots[outputSpec.key] = { outputSpec, glow, ring, dot, lbl, req };
        });

        this._inspectionFaultGfx = this.scene.add.graphics().setDepth(depth + 4);
        this.container.add(this._inspectionFaultGfx);

        this._buildRepairTargetPanel(depth + 2);

        // Tiles
        for (let y = 0; y < this.rows; y++) {
            this._tileGfx[y] = [];
            for (let x = 0; x < this.cols; x++) {
                const gfx = this._buildTile(x, y, depth + 2);
                this._tileGfx[y][x] = gfx;
            }
        }
        this._drawInspectionFault();

        // Close button — added to the container LAST so it sits on top of all tiles
        // in Phaser's render list and wins input hit-testing reliably.
        const closeBg = this.scene.add.rectangle(640, 640, 260, 44, 0x003344, 0.85)
            .setStrokeStyle(1, 0x00cccc, 0.9)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth + 20);
        const closeTxt = this.scene.add.text(640, 640, 'CLOSE DIAGNOSTIC [ESC]', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#00eeee',
        }).setOrigin(0.5).setDepth(depth + 21);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x00aaaa, 0.45));
        closeBg.on('pointerout',  () => closeBg.setFillStyle(0x003344, 0.85));
        closeBg.on('pointerdown', () => this._finalizeAndClose());

        const overlayNodes = [];
        if (this._specialAction) {
            this._specialActionButton = this.scene.add.rectangle(640, 592, 220, 40, 0x233923, 0.9)
                .setStrokeStyle(1, 0x8dff9f, 0.92)
                .setInteractive({ useHandCursor: true })
                .setDepth(depth + 20);
            this._specialActionLabel = this.scene.add.text(640, 592, this._specialAction.label || 'SPECIAL', {
                fontFamily: 'Courier New', fontSize: '13px', color: '#d7ffe0',
            }).setOrigin(0.5).setDepth(depth + 21);
            this._specialActionButton.on('pointerover', () => this._specialActionButton?.setFillStyle(0x2d4b2d, 0.96));
            this._specialActionButton.on('pointerout', () => this._specialActionButton?.setFillStyle(0x233923, 0.9));
            this._specialActionButton.on('pointerdown', () => this._triggerSpecialAction());
            overlayNodes.push(this._specialActionButton, this._specialActionLabel);
        }

        this.container.add([...overlayNodes, closeBg, closeTxt]);

        this._escKey = this.scene.input.keyboard?.addKey('ESC');
        this._escHandler = () => { if (this.active) this._finalizeAndClose(); };
        if (this._escKey) this._escKey.on('down', this._escHandler);
        // Fallback: raw DOM listener so ESC always works even if the Phaser key
        // object is blocked by focus loss or key-capture edge cases.
        this._escKeyDown = (e) => { if (e.key === 'Escape' && this.active) this._finalizeAndClose(); };
        window.addEventListener('keydown', this._escKeyDown);

        this._updateAll();
        this._startCircuitAnimationLoop();
    }

    _resolveRepairTargets(circuit) {
        if (Array.isArray(circuit?.repairTargets) && circuit.repairTargets.length > 0) {
            return circuit.repairTargets.map((target) => ({ ...target }));
        }

        if (Array.isArray(circuit?.outputSpecs) && circuit.outputSpecs.length > 0) {
            return circuit.outputSpecs.map((target) => ({ ...target }));
        }

        return Object.entries(circuit?.outputs || {}).map(([row, label]) => ({
            key: label,
            label,
            row: Number(row),
            displayName: humanizeTargetLabel(label),
            brokenLabel: `${humanizeTargetLabel(label)} offline.`,
            fixedLabel: `${humanizeTargetLabel(label)} restored.`,
            affectsDialogue: false,
        }));
    }

    _buildRepairTargetPanel(depth) {
        const panelHeight = Math.max(132, 84 + (this._repairTargets.length * 42));
        const panel = this.scene.add.container(1032, 236).setDepth(depth);
        const bg = this.scene.add.rectangle(0, 0, 216, panelHeight, 0x04161a, 0.9)
            .setStrokeStyle(1, 0x1bbfcb, 0.7);
        const title = this.scene.add.text(-90, -(panelHeight / 2) + 16, 'REPAIR TARGETS', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#8ffcff', letterSpacing: 1,
        }).setOrigin(0, 0.5);
        const hint = this.scene.add.text(-90, (panelHeight / 2) - 14, this._outputSpecs.some((target) => target.powerClass && target.powerClass !== 'neutral')
            ? 'Match each output label to its feed color and keep the count exact.'
            : 'Route power to restore each subsystem.', {
            fontFamily: 'Courier New', fontSize: '9px', color: '#6da4ad', wordWrap: { width: 178 },
        }).setOrigin(0, 0.5);

        panel.add([bg, title, hint]);

        this._repairTargetViews = this._repairTargets.map((target, index) => {
            const y = -(panelHeight / 2) + 48 + (index * 42);
            const requirementPalette = getFlowPowerPalette(target.powerClass || 'neutral');
            const dot = this.scene.add.circle(-88, y, 7, 0x2f4a57, 1)
                .setStrokeStyle(1, 0x7aa8b7, 0.8);
            const nameText = this.scene.add.text(-72, y - 8, target.displayName || target.label, {
                fontFamily: 'Courier New', fontSize: '11px', color: '#b8dbe1',
            }).setOrigin(0, 0.5);
            const statusText = this.scene.add.text(-72, y + 9, target.powerClass && target.powerClass !== 'neutral'
                ? `${String(target.powerClass).toUpperCase()} x${target.exactFeeds ?? 1}`
                : 'BROKEN', {
                fontFamily: 'Courier New', fontSize: '9px', color: target.powerClass && target.powerClass !== 'neutral' ? requirementPalette.label : '#ffb695',
            }).setOrigin(0, 0.5);

            panel.add([dot, nameText, statusText]);
            return { target, dot, nameText, statusText };
        });

        this.container.add(panel);
    }

    _drawInspectionFault() {
        if (!this._inspectionFaultGfx) return;

        this._inspectionFaultGfx.clear();
        if (!this._inspectionFault) return;

        const x = this.boardX + this._inspectionFault.x * this.cellSize + this.cellSize / 2;
        const y = this.boardY + this._inspectionFault.y * this.cellSize + this.cellSize / 2;

        this._inspectionFaultGfx.lineStyle(3, 0xff8b7a, 0.94);
        this._inspectionFaultGfx.beginPath();
        this._inspectionFaultGfx.moveTo(x - 22, y - 12);
        this._inspectionFaultGfx.lineTo(x - 8, y - 2);
        this._inspectionFaultGfx.lineTo(x - 2, y + 10);
        this._inspectionFaultGfx.lineTo(x + 8, y + 2);
        this._inspectionFaultGfx.lineTo(x + 22, y + 14);
        this._inspectionFaultGfx.strokePath();
        this._inspectionFaultGfx.lineBetween(x - 18, y + 18, x + 18, y - 18);
    }

    _buildTile(x, y, depth) {
        const cx = this.boardX + x * this.cellSize + this.cellSize / 2;
        const cy = this.boardY + y * this.cellSize + this.cellSize / 2;
        const isForbidden = this._forbidden.has(`${x},${y}`);
        const tile = this._tiles[y][x];
        const locked = tile.locked === true || isForbidden;

        // bg is a direct child of this.container (not nested inside tileContainer)
        // so Phaser's input hit-testing reliably reaches it.
        const bg = this.scene.add.rectangle(cx, cy, this.cellSize - 4, this.cellSize - 4,
            isForbidden ? 0x2a1e00 : 0x001f22, 0.9)
            .setStrokeStyle(1, isForbidden ? 0xddaa33 : 0x225566, 0.8)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth);
        this.container.add(bg);

        // tileContainer only holds the rotating pipe/energy graphics.
        // A square bg looks identical at every 90° step so it never needs to rotate.
        const tileContainer = this.scene.add.container(cx, cy).setDepth(depth);
        const energy = this.scene.add.graphics();
        const pipe = this.scene.add.graphics();
        tileContainer.add([energy, pipe]);
        tileContainer.angle = tile.rotation * 90;
        this.container.add(tileContainer);

        const mark = isForbidden
            ? this.scene.add.text(cx + this.cellSize / 2 - 10, cy - this.cellSize / 2 + 8, '?', {
                fontFamily: 'Courier New', fontSize: '12px', color: '#ffcc44',
              }).setOrigin(1, 0).setDepth(depth + 1)
            : null;
        if (mark) this.container.add(mark);

        const tileView = {
            container: tileContainer,
            bg,
            energy,
            pipe,
            mark,
            isForbidden,
            rotationTween: null,
        };

        bg.on('pointerdown', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            if (locked || tile.type === 'empty') return;

            tile.rotation = (tile.rotation + 1) % 4;
            this._animateTileRotation(tileView, tile.rotation);
            this._playWireTurnSound();
            this._updateAll();
        });
        bg.on('pointerup', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
        });
        bg.on('pointerover', () => {
            if (!locked && tile.type !== 'empty') bg.setStrokeStyle(1, 0x66ccff, 1);
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(1, isForbidden ? 0xddaa33 : 0x225566, 0.8);
        });

        return tileView;
    }

    _animateTileRotation(tileView, targetRotation) {
        if (!tileView?.container) return;

        tileView.rotationTween?.stop();
        this.scene.tweens.killTweensOf(tileView.container);
        tileView.rotationTween = null;

        // Always rotate forward one quarter-turn per click for clear turn feedback.
        const tweenTargetAngle = tileView.container.angle + 90;
        const finalAngle = targetRotation * 90;
        // Snap to the previous clean step so the tween always covers exactly 90°,
        // preventing a jump when a rapid click interrupts a mid-animation tween.
        tileView.container.angle = ((targetRotation - 1 + 4) % 4) * 90;

        tileView.rotationTween = this.scene.tweens.add({
            targets: tileView.container,
            angle: tileView.container.angle + 90,
            duration: 170,
            ease: 'Sine.Out',
            onComplete: () => {
                tileView.rotationTween = null;
                tileView.container.angle = finalAngle;
            },
            onStop: () => {
                tileView.rotationTween = null;
                tileView.container.angle = finalAngle;
            },
        });
    }

    _playWireTurnSound() {
        const preferred = this.scene.cache.audio.has(SOUND_ASSETS.fuseRotate.key)
            ? SOUND_ASSETS.fuseRotate
            : (this.scene.cache.audio.has(SOUND_ASSETS.inspectionReveal.key) ? SOUND_ASSETS.inspectionReveal : null);
        if (!preferred) return;

        try {
            const sound = this.scene.sound.add(preferred.key, {
                volume: preferred === SOUND_ASSETS.fuseRotate ? SOUND_VOLUMES.puzzleRotate : SOUND_VOLUMES.reveal,
            });
            sound.once('complete', () => sound.destroy());
            sound.play();
        } catch (error) {
            // Audio errors should never interrupt tile interaction.
        }
    }

    _buildProgressSnapshot(result = this._lastResult) {
        const outputFeeds = result?.outputFeeds || {};
        const stage = Number(this._circuit?.dayStage || this.evidence.dayStage || 1);
        const forbiddenUsed = (result?.forbiddenHit ?? []).length > 0;
        const repairStates = this._repairTargets.map((target) => {
            const feeds = Array.isArray(outputFeeds[target.key])
                ? outputFeeds[target.key].map((feed) => ({ ...feed }))
                : [];
            const feedClasses = Array.from(new Set(feeds.map((feed) => feed.powerClass || 'neutral')));
            const exactFeeds = Math.max(1, Number(target.exactFeeds || 1));
            const expectedClass = target.powerClass || 'neutral';
            const classMismatch = feeds.length > 0
                && expectedClass !== 'neutral'
                && feedClasses.some((powerClass) => powerClass !== expectedClass);
            const overload = feeds.length > exactFeeds;
            const underpower = feeds.length > 0 && feeds.length < exactFeeds;
            const repaired = feeds.length === exactFeeds
                && (!classMismatch);
            let issueCode = null;
            let issueMessage = null;

            if (classMismatch) {
                issueCode = stage >= 3 ? 'unsafe-class' : 'class-mismatch';
                issueMessage = `${target.displayName || target.label} received the wrong power class.`;
            } else if (overload) {
                issueCode = 'overload';
                issueMessage = `${target.displayName || target.label} is taking too many live feeds.`;
            } else if (underpower) {
                issueCode = 'underpower';
                issueMessage = `${target.displayName || target.label} is underpowered for the requested load.`;
            }

            return {
                ...target,
                repaired,
                feeds,
                feedCount: feeds.length,
                feedClasses,
                issueCode,
                issueMessage,
            };
        });
        const connected = repairStates.filter((target) => target.feedCount > 0).map((target) => target.key);
        const repairedTargets = repairStates.filter((target) => target.repaired).map((target) => target.key);
        const brokenTargets = repairStates.filter((target) => !target.repaired).map((target) => target.key);
        const signalIssues = repairStates.filter((target) => target.feedCount > 0 && target.issueCode);
        const scrapRequired = Boolean(this._inspectionFault) || signalIssues.length > 0;
        const scrapKind = this._inspectionFault?.kind || (signalIssues.length > 0 ? (stage >= 3 ? 'hazard' : 'compliance') : null);
        const scrapStatus = this._inspectionFault?.status || (signalIssues.length > 0
            ? (stage >= 3 ? 'UNSAFE LOAD' : 'FEED MISMATCH')
            : null);
        const scrapReason = this._inspectionFault?.reason || signalIssues[0]?.issueMessage || null;
        const flags = repairStates
            .filter((target) => target.issueCode)
            .map((target) => target.issueCode.toUpperCase());

        if (this._inspectionFault?.type) {
            flags.unshift(this._inspectionFault.type.toUpperCase());
        }

        if (forbiddenUsed) {
            flags.push('UNAUTHORIZED MODIFICATION DETECTED');
        }

        return {
            tiles: cloneCircuitTiles(this._tiles),
            connected,
            missing: [...brokenTargets],
            repairedTargets,
            brokenTargets,
            repairStates,
            forbiddenUsed,
            completed: brokenTargets.length === 0 && !forbiddenUsed && !scrapRequired,
            reviewed: Boolean(this.evidence.reviewed),
            scrapRequired,
            scrapKind,
            scrapStatus,
            scrapReason,
            outputFeeds: Object.fromEntries(Object.entries(outputFeeds).map(([key, feeds]) => [key, feeds.map((feed) => ({ ...feed }))])),
            symptoms: scrapRequired
                ? [scrapReason].filter(Boolean)
                : repairStates.filter((target) => !target.repaired).map((target) => target.brokenLabel),
            flags,
        };
    }

    _syncCircuitProgress(result = this._lastResult) {
        if (!this._circuit) return null;

        const snapshot = this._buildProgressSnapshot(result);
        this._circuit.progress = snapshot;
        return snapshot;
    }

    _refreshRepairTargets(repairStates, forbiddenUsed) {
        const stateMap = new Map((repairStates || []).map((state) => [state.key, state]));

        this._repairTargetViews.forEach(({ target, dot, nameText, statusText }) => {
            const state = stateMap.get(target.key) || target;
            const repaired = Boolean(state.repaired);
            const invalidSignal = Boolean(state.feedCount > 0 && state.issueCode);
            dot.setFillStyle(repaired ? 0x62ffb0 : (invalidSignal ? 0xff7d77 : 0x2f4a57), 1);
            dot.setStrokeStyle(1, repaired ? 0xe8fff1 : (invalidSignal ? 0xffd4cf : 0x7aa8b7), 0.88);
            nameText.setColor(repaired ? '#ddffed' : (invalidSignal ? '#ffd7d1' : '#b8dbe1'));
            statusText
                .setText(
                    repaired
                        ? 'REPAIRED'
                        : (invalidSignal
                            ? String(state.issueCode || 'MISMATCH').replace(/-/g, ' ').toUpperCase()
                            : (forbiddenUsed ? 'BROKEN // MOD' : 'BROKEN'))
                )
                .setColor(repaired ? '#7dffb6' : (invalidSignal ? '#ffb4ae' : (forbiddenUsed ? '#ffd0c4' : '#ffb695')));
        });
    }

    _drawTile(x, y, reached) {
        const gfx = this._tileGfx[y][x];
        const tile = this._tiles[y][x];
        const conns = TILE_BASE[tile.type] || TILE_BASE.empty;
        const { pipe, container, isForbidden } = gfx;

        pipe.clear();
        if (!gfx.rotationTween) {
            container.angle = tile.rotation * 90;
        }
        if (isForbidden) {
            pipe.fillStyle(0xffb347, 0.18);
            pipe.fillRoundedRect(-(this.cellSize / 2) + 8, -(this.cellSize / 2) + 8, this.cellSize - 16, this.cellSize - 16, 12);
            pipe.lineStyle(4, 0xffcc77, 0.9);
            pipe.lineBetween(-(this.cellSize / 2) + 12, -(this.cellSize / 2) + 12, (this.cellSize / 2) - 12, (this.cellSize / 2) - 12);
            pipe.lineBetween((this.cellSize / 2) - 12, -(this.cellSize / 2) + 12, -(this.cellSize / 2) + 12, (this.cellSize / 2) - 12);
            return;
        }
        if (tile.type === 'empty') return;

        const color = isForbidden && reached ? 0xffaa00
                    : reached ? 0x00ffcc
                    : 0x336677;
        const width = reached ? 8 : 5;
        pipe.lineStyle(width, color, 1);

        const half = this.cellSize / 2 - 2;
        if (conns[0]) pipe.lineBetween(0, 0, 0, -half);
        if (conns[1]) pipe.lineBetween(0, 0, half, 0);
        if (conns[2]) pipe.lineBetween(0, 0, 0, half);
        if (conns[3]) pipe.lineBetween(0, 0, -half, 0);

        pipe.fillStyle(color, 1);
        pipe.fillCircle(0, 0, width * 0.7);
    }

    _drawTileEnergy(x, y, reached, energyActive) {
        const gfx = this._tileGfx[y][x];
        const tile = this._tiles[y][x];
        const conns = TILE_BASE[tile.type] || TILE_BASE.empty;
        const energy = gfx.energy;

        energy.clear();
        if (!energyActive || !reached || tile.type === 'empty') return;

        const half = this.cellSize / 2 - 6;
        const dashLength = 10;
        const directionVectors = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
        ];
        const phase = (this._energyPhase + (((x * 0.07) + (y * 0.11)) % 1)) % 1;
        const dashHead = 3 + (phase * (half + dashLength - 2));
        const dashTail = Math.max(0, dashHead - dashLength);

        energy.lineStyle(4, 0xb6fff7, 0.12);
        energy.fillStyle(0xe7fffb, 0.12);
        directionVectors.forEach((vector, index) => {
            if (!conns[index]) return;

            const tail = Math.min(half, dashTail);
            const head = Math.min(half, dashHead);
            energy.lineBetween(vector.x * tail, vector.y * tail, vector.x * head, vector.y * head);
            energy.fillCircle(vector.x * head, vector.y * head, 2.8);
        });

        energy.fillStyle(0xd9fff2, 0.16);
        energy.fillCircle(0, 0, 4.2);
    }

    _computeReached() {
        const reached = new Set();
        const reachedOutputs = [];
        const forbiddenHit = [];
        const flowSegments = [];
        const outputFeeds = {};
        const sourceActivity = {};

        this._sources.forEach((source) => {
            const startX = 0;
            const startY = source.row;
            const startTile = this._tiles[startY]?.[startX];
            if (!startTile) return;

            const startConns = rotatedConnections(startTile.type, startTile.rotation);
            if (!startConns[3]) {
                sourceActivity[source.key] = false;
                return;
            }

            sourceActivity[source.key] = true;
            const queue = [[startX, startY]];
            const visited = new Set([`${startX},${startY}`]);
            reached.add(`${startX},${startY}`);
            flowSegments.push({ from: { x: -1, y: startY }, to: { x: startX, y: startY }, sourceKey: source.key });

            while (queue.length) {
                const [x, y] = queue.shift();
                const tile = this._tiles[y][x];
                const conns = rotatedConnections(tile.type, tile.rotation);

                for (const d of DIRS) {
                    if (!conns[d.idx]) continue;
                    const nx = x + d.dx;
                    const ny = y + d.dy;

                    if (nx === this.cols) {
                        const outputSpec = this._outputSpecs.find((candidate) => candidate.row === y);
                        if (outputSpec && d.idx === 1) {
                            recordFlowFeed(outputFeeds, outputSpec.key, source);
                            if (!reachedOutputs.includes(outputSpec.key)) {
                                reachedOutputs.push(outputSpec.key);
                            }
                            flowSegments.push({ from: { x, y }, to: { x: this.cols, y }, sourceKey: source.key });
                        }
                        continue;
                    }

                    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
                    if (this._forbidden.has(`${nx},${ny}`)) continue;
                    const neighbor = this._tiles[ny][nx];
                    const nconns = rotatedConnections(neighbor.type, neighbor.rotation);
                    if (!nconns[d.opp]) continue;
                    const key = `${nx},${ny}`;
                    if (visited.has(key)) continue;
                    visited.add(key);
                    reached.add(key);
                    flowSegments.push({ from: { x, y }, to: { x: nx, y: ny }, sourceKey: source.key });
                    queue.push([nx, ny]);
                }
            }
        });

        return { reached, reachedOutputs, forbiddenHit, flowSegments, outputFeeds, sourceActivity };
    }

    _getFlowLinkPosition(node) {
        const y = this.boardY + node.y * this.cellSize + this.cellSize / 2;
        const endpointRadius = 10;

        if (node.x === -1) {
            return { x: this.boardX - 40 + endpointRadius, y };
        }

        if (node.x === this.cols) {
            return { x: this.boardX + this.cols * this.cellSize + 40 - endpointRadius, y };
        }

        return {
            x: this.boardX + node.x * this.cellSize + this.cellSize / 2,
            y,
        };
    }

    _drawSourceFlowBlock(flowSegments) {
        if (!this._sourceFlowGfx) return;

        this._sourceFlowGfx.clear();
        if (!Array.isArray(flowSegments) || flowSegments.length === 0) return;

        const segments = flowSegments.map((segment) => {
            const from = this._getFlowLinkPosition(segment.from);
            const to = this._getFlowLinkPosition(segment.to);
            return {
                from,
                to,
                length: Math.hypot(to.x - from.x, to.y - from.y),
            };
        }).filter((segment) => segment.length > 0);

        if (segments.length === 0) return;

        const totalLength = segments.reduce((sum, segment) => sum + segment.length, 0);
        let remaining = (this._energyPhase * 0.85 % 1) * totalLength;
        let activeSegment = segments[segments.length - 1];

        for (const segment of segments) {
            if (remaining <= segment.length) {
                activeSegment = segment;
                break;
            }
            remaining -= segment.length;
        }

        const progress = activeSegment.length <= 0 ? 0 : remaining / activeSegment.length;
        const x = activeSegment.from.x + ((activeSegment.to.x - activeSegment.from.x) * progress);
        const y = activeSegment.from.y + ((activeSegment.to.y - activeSegment.from.y) * progress);

        this._sourceFlowGfx.fillStyle(0xc7fff9, 0.1);
        this._sourceFlowGfx.fillCircle(x, y, 9);
        this._sourceFlowGfx.fillStyle(0xf6fff8, 0.52);
        this._sourceFlowGfx.fillCircle(x, y, 4.2);
    }

    _refreshAnimatedCircuitEffects() {
        const renderState = this._lastCircuitRenderState;
        const reached = renderState?.reached || new Set();
        const energyActive = reached.size > 0;
        const reachedOutputs = renderState?.outputFeeds || {};

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this._drawTileEnergy(x, y, reached.has(`${x},${y}`), energyActive);
            }
        }

        Object.values(this._outputDots).forEach((view) => {
            const feeds = reachedOutputs[view.outputSpec.key] || [];
            const mixedFeed = new Set(feeds.map((feed) => feed.powerClass || 'neutral')).size > 1;
            const palette = feeds.length > 0
                ? getFlowPowerPalette(mixedFeed ? 'mixed' : (feeds[0]?.powerClass || 'neutral'))
                : getFlowPowerPalette(view.outputSpec.powerClass || 'neutral');
            const pulse = 0.18 + (Math.sin((this._energyPhase * Math.PI * 2) + (Number(view.outputSpec.row) * 0.65)) * 0.08);
            const active = feeds.length > 0;

            view.glow?.setFillStyle(palette.tint, 1).setAlpha(active ? pulse : 0);
            view.ring?.setStrokeStyle(2, palette.tint, active ? 0.42 + pulse : 0);
            view.dot?.setFillStyle(active ? palette.tint : 0x225533, 1).setScale(active ? 1.02 + (pulse * 0.08) : 1);
            view.lbl?.setColor(active ? palette.label : palette.idle);
            view.req?.setColor(palette.label);
        });

        Object.values(this._sourceViews).forEach((view) => {
            const palette = getFlowPowerPalette(view.source.powerClass);
            const active = Boolean(renderState?.sourceActivity?.[view.source.key]);
            view.pulse?.setAlpha(active ? 0.12 + (Math.sin(this._energyPhase * Math.PI * 2) * 0.03) + 0.05 : 0.1);
            view.dot?.setFillStyle(palette.dot, 1);
        });

        if (energyActive) {
            this._drawSourceFlowBlock(renderState.flowSegments);
        } else {
            this._sourceFlowGfx?.clear();
        }
    }

    _startCircuitAnimationLoop() {
        this._stopCircuitAnimationLoop();
        this._energyTickEvent = this.scene.time.addEvent({
            delay: 75,
            loop: true,
            callback: () => {
                if (!this.active) return;
                this._energyPhase = (this._energyPhase + 0.045) % 1;
                this._refreshAnimatedCircuitEffects();
            },
        });
    }

    _stopCircuitAnimationLoop() {
        this._energyTickEvent?.remove(false);
        this._energyTickEvent = null;
    }

    _updateAll() {
        const { reached, reachedOutputs, forbiddenHit, flowSegments, outputFeeds, sourceActivity } = this._computeReached();
        const snapshot = this._buildProgressSnapshot({ reached, reachedOutputs, forbiddenHit, flowSegments, outputFeeds, sourceActivity });

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this._drawTile(x, y, reached.has(`${x},${y}`));
            }
        }

        this._refreshRepairTargets(snapshot.repairStates, forbiddenHit.length > 0);

        this._lastResult = {
            reached,
            reachedOutputs,
            forbiddenHit,
            flowSegments,
            outputFeeds,
            sourceActivity,
            completed: snapshot.completed,
        };
        this._lastCircuitRenderState = {
            reached,
            flowSegments,
            completed: snapshot.completed,
            outputFeeds,
            sourceActivity,
        };

        this._refreshAnimatedCircuitEffects();

        this._syncCircuitProgress(this._lastResult);
    }

    _triggerSpecialAction() {
        if (!this._specialAction?.onTrigger) return;

        const snapshot = this._syncCircuitProgress(this._lastResult) || this._buildProgressSnapshot(this._lastResult);
        const result = this._specialAction.onTrigger({
            evidence: snapshot,
            circuit: this._circuit,
        });
        if (!result) return;

        if (result.evidence) {
            this.emitEvidence(result.evidence);
        }

        if (result.closeAfter) {
            this.close();
        }
    }

    _finalizeAndClose() {
        const snapshot = this._syncCircuitProgress(this._lastResult) || this._buildProgressSnapshot(this._lastResult);
        this.emitEvidence(snapshot);
        this.close();
    }

    hide() {
        this._stopCircuitAnimationLoop();
        this._tileGfx?.forEach((row) => {
            row?.forEach((tileView) => {
                tileView?.rotationTween?.stop();
                if (tileView?.container) {
                    this.scene.tweens.killTweensOf(tileView.container);
                }
                if (tileView) {
                    tileView.rotationTween = null;
                }
            });
        });
        this._lastCircuitRenderState = null;
        this._sourceFlowGfx = null;
        this._sourceViews = {};
        this._inspectionFaultGfx = null;
        this._inspectionFault = null;
        this._specialAction = null;
        this._specialActionButton = null;
        this._specialActionLabel = null;
        if (this._escKey && this._escHandler) {
            this._escKey.off('down', this._escHandler);
        }
        this._escKey = null;
        this._escHandler = null;
        if (this._escKeyDown) {
            window.removeEventListener('keydown', this._escKeyDown);
            this._escKeyDown = null;
        }
        this._closeButton?.destroy();
        this._closeButton = null;
        this._closeButtonLabel?.destroy();
        this._closeButtonLabel = null;
        super.hide();
    }

    destroy() {
        if (this._escKeyDown) {
            window.removeEventListener('keydown', this._escKeyDown);
            this._escKeyDown = null;
        }
        this._closeButton?.destroy();
        this._closeButton = null;
        this._closeButtonLabel?.destroy();
        this._closeButtonLabel = null;
        super.destroy();
    }
}

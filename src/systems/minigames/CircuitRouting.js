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
    red: { tint: 0xff4f4f, label: '#ff8d8d', idle: '#b76464', dot: 0xff4f4f },
});

function getFlowPowerPalette(powerClass = 'neutral') {
    return FLOW_POWER_PALETTES[powerClass] || FLOW_POWER_PALETTES.neutral;
}

function getFlowCellKey(x, y) {
    return `${x},${y}`;
}

function getFlowSegmentKey(from, to) {
    const start = `${from.x},${from.y}`;
    const end = `${to.x},${to.y}`;
    return start < end ? `${start}|${end}` : `${end}|${start}`;
}

function deriveFlowDisplayPowerClass(powerClasses = []) {
    const uniqueClasses = Array.from(new Set((powerClasses || []).filter(Boolean)));
    if (uniqueClasses.length === 0) return null;
    if (uniqueClasses.includes('red')) return 'red';
    if (uniqueClasses.length > 1) return 'mixed';
    return uniqueClasses[0];
}

function recordFlowFeed(targetMap, key, source) {
    if (!targetMap[key]) {
        targetMap[key] = [];
    }

    if (targetMap[key].some((entry) => (
        entry.key === source.key
        && (entry.powerClass || 'neutral') === (source.powerClass || 'neutral')
    ))) {
        return;
    }

    targetMap[key].push({
        key: source.key,
        powerClass: source.powerClass || 'neutral',
        label: source.label || source.key,
        row: source.row,
    });
}

function recordFlowSegment(targetMap, from, to, powerClass = 'neutral') {
    const segmentKey = getFlowSegmentKey(from, to);
    const existing = targetMap.get(segmentKey);

    if (!existing) {
        targetMap.set(segmentKey, {
            from: { ...from },
            to: { ...to },
            powerClasses: new Set([powerClass || 'neutral']),
        });
        return;
    }

    existing.powerClasses.add(powerClass || 'neutral');
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
    const sr = spec.sourceRow ?? spec.sources?.[0]?.row ?? Math.floor(rows / 2) ?? 2;
    const outputRows = spec.outputSpecs 
        ? spec.outputSpecs.map(s => Number(s.row)) 
        : Object.keys(spec.outputs || {}).map(Number);

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
        this._wireFilters = [];
        this._wireFilterMap = new Map();
        this._inspectionFaultGfx = null;
        this._inspectionFault = null;
        this._closeButton = null;
        this._closeButtonLabel = null;
        this._specialAction = null;
        this._specialActionButton = null;
        this._specialActionLabel = null;
        this._escKeyDown = null;

        // Spider-Man-style inventory state. Counts of each piece type that
        // have been picked up off the board and are awaiting re-placement.
        this._inventory = { straight: 0, curve: 0, tee: 0, cross: 0 };
        this._selectedInventoryType = null;
        this._inventoryViews = {};
        this._inventoryPanelGfx = null;
        this._voltageHudText = null;
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
        // Disable the browser context menu so right-click on tiles can be
        // used as the "pick up piece back to inventory" gesture.
        try { this.scene.input.mouse?.disableContextMenu(); } catch {}
        this.rows = Math.max(3, Number(circuit.rows || circuit.tiles?.length || 5));
        this.cols = Math.max(3, Number(circuit.cols || circuit.tiles?.[0]?.length || 5));
        this.cellSize = Math.max(46, Math.min(64, Math.floor(Math.min(420 / this.cols, 350 / this.rows))));
        this.boardX = 534 - ((this.cols * this.cellSize) / 2);
        this.boardY = 360 - ((this.rows * this.cellSize) / 2);
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
        this._wireFilters = Array.isArray(circuit.wireFilters)
            ? circuit.wireFilters.map((filter) => ({ ...filter }))
            : [];
        this._wireFilterMap = new Map(this._wireFilters.map((filter) => [getFlowCellKey(filter.x, filter.y), filter]));
        this._outputs = Object.fromEntries(this._outputSpecs.map((outputSpec) => [outputSpec.row, outputSpec.label]));
        this._sourceRow = this._sources[0]?.row ?? circuit.sourceRow ?? 2;
        this._inspectionFault = circuit.progress?.inspectionFault || circuit.inspectionFault || null;
        this._repairTargets = this._resolveRepairTargets(circuit);
        this._repairTargetViews = [];
        if (this.evidence.scrapRequired && !this.evidence.reviewed) {
            this.emitEvidence({ reviewed: true });
        }

        // Reset per-instance interaction state on every build so reopening the
        // diagnostic doesn't carry over selected-piece highlights or accumulate
        // inventory counts from a previous session.
        this._inventory = { straight: 0, curve: 0, tee: 0, cross: 0 };
        this._selectedInventoryType = null;

        // Track whether we hydrated from saved progress. When true, we skip the
        // initial inventory seed (which pops 2-3 board pieces back into the
        // tray) — that step is only meant to run on first open, otherwise it
        // would unwind the player's work each time they reopen the puzzle.
        let restoredFromProgress = false;
        let restoredInventory = null;

        let tiles, forbiddenList;
        if (Array.isArray(circuit.progress?.tiles) && circuit.progress.tiles.length > 0) {
            tiles = cloneCircuitTiles(circuit.progress.tiles);
            forbiddenList = circuit.forbidden || [];
            restoredFromProgress = true;
            if (circuit.progress.inventory && typeof circuit.progress.inventory === 'object') {
                restoredInventory = circuit.progress.inventory;
            }
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
        // Forbidden cells were the amber-tinted "obstacle" tiles. They no
        // longer ship as a player-facing mechanic — the puzzle was always
        // solvable around them, so they read as decorative dead weight.
        // Force the set empty regardless of what the data layer or saved
        // progress provides; that keeps every legacy field a no-op without
        // having to scrub case definitions.
        forbiddenList = [];
        this._forbidden = new Set();
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
            ? 'Click tiles to rotate. Day 1 is plain wiring only. If the first lead is missing, the unit is scrap.'
            : (stage === 2
                ? 'Click tiles to rotate. Green and orange wire filters recolor the current after that tile. Red discharge wires are immediate scrap.'
                : 'Click tiles to rotate. Day 3 uses a larger grid with multiple power ports. Any red module is crackling and must be scrapped.'), {
            fontFamily: 'Courier New', fontSize: '10px', color: '#66aaaa',
            align: 'center', wordWrap: { width: 1000 },
        }).setOrigin(0.5).setDepth(depth + 2);
        this.container.add(subtitle);

        this._sourceFlowGfx = this.scene.add.graphics().setDepth(depth + 1);
        this._sourceViews = {};
        this.container.add(this._sourceFlowGfx);
        this._sources.forEach((source) => {
            const palette = getFlowPowerPalette(source.powerClass);
            const srcY = this.boardY + source.row * this.cellSize + this.cellSize / 2;
            const srcX = this.boardX - 28;
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
            const ox = this.boardX + this.cols * this.cellSize + 26;
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
            const req = this.scene.add.text(ox + 16, oy + 8, outputSpec.powerClass === 'red'
                ? 'RED // SCRAP'
                : String(outputSpec.powerClass || 'neutral').toUpperCase(), {
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

        // Spider-Man-style HUD additions: voltage meter at top, inventory
        // panel on the left. Both are wired up to state that _updateAll()
        // refreshes after every tile rotation / pickup / placement.
        this._buildVoltageHud(depth + 2);
        this._buildInventoryPanel(depth + 2);

        // Seed the inventory only on a fresh open. If we hydrated tiles from
        // saved progress, replay the saved inventory counts instead — running
        // _seedInitialInventory again would pop additional pieces off the
        // board and unwind whatever the player had already placed.
        if (restoredFromProgress) {
            if (restoredInventory) {
                Object.entries(restoredInventory).forEach(([type, count]) => {
                    if (!Object.prototype.hasOwnProperty.call(this._inventory, type)) return;
                    this._inventory[type] = Math.max(0, Math.floor(Number(count) || 0));
                });
            }
            this._refreshInventoryPanel();
        } else {
            this._seedInitialInventory(circuit);
        }

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
        const hint = this.scene.add.text(-90, (panelHeight / 2) - 14, this._outputSpecs.some((target) => target.powerClass === 'red')
            ? 'Red module ports are crackling hazards. They cannot be repaired safely.'
            : (this._outputSpecs.some((target) => target.powerClass && target.powerClass !== 'neutral')
                ? 'Match each output to the color feed it is asking for.'
                : 'Route power to restore each subsystem.'), {
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
            const statusText = this.scene.add.text(-72, y + 9, target.powerClass === 'red'
                ? 'RED // SCRAP'
                : (target.powerClass && target.powerClass !== 'neutral'
                    ? String(target.powerClass).toUpperCase()
                    : 'BROKEN'), {
                fontFamily: 'Courier New', fontSize: '9px', color: target.powerClass && target.powerClass !== 'neutral' ? requirementPalette.label : '#ffb695',
            }).setOrigin(0, 0.5);

            panel.add([dot, nameText, statusText]);
            return { target, dot, nameText, statusText };
        });

        this.container.add(panel);
    }

    _getWireFilter(x, y) {
        return this._wireFilterMap.get(getFlowCellKey(x, y)) || null;
    }

    _getEffectivePowerClass(x, y, incomingPowerClass = 'neutral') {
        return this._getWireFilter(x, y)?.powerClass || incomingPowerClass || 'neutral';
    }

    _drawInspectionFault() {
        if (!this._inspectionFaultGfx) return;

        this._inspectionFaultGfx.clear();
        if (!this._inspectionFault) return;

        // If the fault is anchored on a forbidden cell, the orange forbidden
        // tint already conveys "do not touch" — drawing an extra X/circle on
        // top stacks two scrap markers in the same square and reads as a bug.
        const faultGridX = this._inspectionFault.x;
        const faultGridY = this._inspectionFault.y;
        if (Number.isFinite(faultGridX) && Number.isFinite(faultGridY)
            && this._forbidden?.has(`${faultGridX},${faultGridY}`)) {
            return;
        }

        const outputView = this._inspectionFault.targetKey ? this._outputDots?.[this._inspectionFault.targetKey] : null;
        const x = outputView
            ? outputView.dot.x
            : this.boardX + this._inspectionFault.x * this.cellSize + this.cellSize / 2;
        const y = outputView
            ? outputView.dot.y
            : this.boardY + this._inspectionFault.y * this.cellSize + this.cellSize / 2;

        if (this._inspectionFault.type === 'missing-wire') {
            this._inspectionFaultGfx.lineStyle(3, 0xffc392, 0.96);
            this._inspectionFaultGfx.strokeCircle(x, y, 18);
            this._inspectionFaultGfx.lineBetween(x - 18, y - 8, x - 4, y - 2);
            this._inspectionFaultGfx.lineBetween(x + 4, y + 2, x + 18, y + 8);
            this._inspectionFaultGfx.lineBetween(x - 4, y - 2, x + 2, y - 10);
            this._inspectionFaultGfx.lineBetween(x + 2, y - 10, x + 4, y + 2);
            return;
        }

        if (this._inspectionFault.type === 'red-wire') {
            this._inspectionFaultGfx.lineStyle(3, 0xff5f57, 0.98);
            this._inspectionFaultGfx.strokeCircle(x, y, 19);
            this._inspectionFaultGfx.lineBetween(x - 16, y - 16, x + 16, y + 16);
            this._inspectionFaultGfx.lineBetween(x + 16, y - 16, x - 16, y + 16);
            return;
        }

        if (this._inspectionFault.type === 'crackling-module') {
            this._inspectionFaultGfx.lineStyle(2, 0xff5f57, 0.98);
            this._inspectionFaultGfx.strokeCircle(x, y, 21);
            this._inspectionFaultGfx.lineBetween(x - 24, y - 6, x - 10, y - 18);
            this._inspectionFaultGfx.lineBetween(x - 6, y - 22, x + 2, y - 34);
            this._inspectionFaultGfx.lineBetween(x + 10, y - 10, x + 26, y - 24);
            this._inspectionFaultGfx.lineBetween(x - 22, y + 10, x - 8, y + 24);
            this._inspectionFaultGfx.lineBetween(x + 10, y + 8, x + 24, y + 24);
            return;
        }

        if (this._inspectionFault.type === 'emotion-flood') {
            // Teardrop: circle body with a pointed top, rendered in soft blue
            this._inspectionFaultGfx.lineStyle(2, 0x5ec4e8, 0.92);
            this._inspectionFaultGfx.strokeCircle(x, y + 4, 12);
            // pointed tip of teardrop above the circle
            this._inspectionFaultGfx.lineBetween(x - 6, y - 6, x, y - 16);
            this._inspectionFaultGfx.lineBetween(x, y - 16, x + 6, y - 6);
            // ripple arcs radiating outward (3 concentric partial arcs)
            this._inspectionFaultGfx.lineStyle(1, 0x7eddf2, 0.6);
            this._inspectionFaultGfx.strokeCircle(x, y + 4, 18);
            this._inspectionFaultGfx.lineStyle(1, 0x7eddf2, 0.32);
            this._inspectionFaultGfx.strokeCircle(x, y + 4, 24);
            return;
        }

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

        // Invisible square rectangle acts purely as the input hit target so
        // Phaser's hit-testing remains reliable. The visible cell frame is an
        // octagonal Graphics drawn on top (Spider-Man Microcable style).
        const bg = this.scene.add.rectangle(cx, cy, this.cellSize - 4, this.cellSize - 4,
            0x000000, 0)
            .setStrokeStyle(0, 0x000000, 0)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth);
        this.container.add(bg);

        const octGfx = this.scene.add.graphics().setDepth(depth);
        this._drawOctagonFrame(octGfx, cx, cy, this.cellSize - 4, {
            fill: isForbidden ? 0x2a1e00 : 0x001f22,
            fillAlpha: 0.92,
            stroke: isForbidden ? 0xddaa33 : 0x225566,
            strokeAlpha: 0.85,
            strokeWidth: 1.2,
        });
        this.container.add(octGfx);

        // tileContainer only holds the rotating pipe/energy graphics.
        // A square bg looks identical at every 90° step so it never needs to rotate.
        const tileContainer = this.scene.add.container(cx, cy).setDepth(depth);
        const energy = this.scene.add.graphics();
        const pipe = this.scene.add.graphics();
        const modifierGfx = this.scene.add.graphics();
        const modifierText = this.scene.add.text(0, -(this.cellSize / 2) + 12, '', {
            fontFamily: 'monospace', fontSize: '8px', color: '#d9f0f4',
        }).setOrigin(0.5).setVisible(false);
        // Energy (the travelling power dot/dash) is added AFTER pipe so the
        // dot renders ON TOP of the pipe graphic, not hidden underneath.
        tileContainer.add([pipe, energy, modifierGfx, modifierText]);
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
            octGfx,
            cx,
            cy,
            energy,
            pipe,
            modifierGfx,
            modifierText,
            mark,
            isForbidden,
            rotationTween: null,
        };

        const repaintOct = (hovered) => {
            this._drawOctagonFrame(octGfx, cx, cy, this.cellSize - 4, {
                fill: isForbidden ? 0x2a1e00 : (hovered ? 0x0a2f35 : 0x001f22),
                fillAlpha: 0.92,
                stroke: isForbidden
                    ? 0xddaa33
                    : (hovered ? 0x66ccff : 0x225566),
                strokeAlpha: hovered ? 1 : 0.85,
                strokeWidth: hovered ? 1.6 : 1.2,
            });
        };
        tileView.repaintOct = repaintOct;

        bg.on('pointerdown', (pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
            if (this._handleInventoryClick?.(x, y, pointer)) return;
            // Re-resolve the tile each click — pickup/placement swaps the
            // object reference at this grid slot, so the closure-captured
            // `tile` from build time would be stale.
            const liveTile = this._tiles[y]?.[x];
            const isForbiddenNow = this._forbidden.has(`${x},${y}`);
            const isLockedNow = isForbiddenNow || liveTile?.locked === true;
            if (!liveTile || isLockedNow || liveTile.type === 'empty') return;

            liveTile.rotation = (liveTile.rotation + 1) % 4;
            this._animateTileRotation(tileView, liveTile.rotation);
            this._playWireTurnSound();
            this._updateAll();
        });
        bg.on('pointerup', (_pointer, _localX, _localY, event) => {
            event?.stopPropagation?.();
        });
        bg.on('pointerover', () => {
            const liveTile = this._tiles[y]?.[x];
            const isForbiddenNow = this._forbidden.has(`${x},${y}`);
            if (!isForbiddenNow && liveTile && liveTile.type !== 'empty' && !liveTile.locked) {
                repaintOct(true);
            }
        });
        bg.on('pointerout', () => {
            repaintOct(false);
        });

        return tileView;
    }

    _drawOctagonFrame(gfx, cx, cy, size, opts = {}) {
        const {
            fill = 0x001f22,
            fillAlpha = 0.92,
            stroke = 0x225566,
            strokeAlpha = 0.85,
            strokeWidth = 1.2,
            chamferRatio = 0.28,
        } = opts;
        gfx.clear();
        const half = size / 2;
        const cham = Math.max(4, Math.floor(size * chamferRatio));
        const points = [
            [cx - half + cham, cy - half],
            [cx + half - cham, cy - half],
            [cx + half,       cy - half + cham],
            [cx + half,       cy + half - cham],
            [cx + half - cham, cy + half],
            [cx - half + cham, cy + half],
            [cx - half,       cy + half - cham],
            [cx - half,       cy - half + cham],
        ];
        gfx.fillStyle(fill, fillAlpha);
        gfx.beginPath();
        gfx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) gfx.lineTo(points[i][0], points[i][1]);
        gfx.closePath();
        gfx.fillPath();

        gfx.lineStyle(strokeWidth, stroke, strokeAlpha);
        gfx.beginPath();
        gfx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) gfx.lineTo(points[i][0], points[i][1]);
        gfx.closePath();
        gfx.strokePath();

        // Corner accent ticks (a tiny inner notch at each chamfer) — gives the
        // Microcable HUD look with bright corner anchors.
        gfx.lineStyle(strokeWidth, stroke, Math.min(1, strokeAlpha + 0.15));
        const tick = Math.max(2, cham * 0.32);
        [points[0], points[1], points[4], points[5]].forEach(([px, py]) => {
            const towardY = py < cy ? 1 : -1;
            gfx.lineBetween(px, py, px, py + (tick * towardY));
        });
    }

    // ── Spider-Man Microcable additions ────────────────────────────────

    _buildVoltageHud(depth) {
        const hudX = 640;
        const hudY = this.boardY - 40;
        // Left "ACTUAL" panel
        const leftBg = this.scene.add.rectangle(hudX - 170, hudY, 160, 34, 0x02222a, 0.9)
            .setStrokeStyle(1, 0x00cccc, 0.8)
            .setDepth(depth);
        const leftLabel = this.scene.add.text(hudX - 170, hudY - 6, 'ACTUAL POWER', {
            fontFamily: 'Courier New', fontSize: '8px', color: '#66aaaa', letterSpacing: 2,
        }).setOrigin(0.5).setDepth(depth + 1);
        this._voltageActualText = this.scene.add.text(hudX - 170, hudY + 8, '0 / 0', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#00ffcc', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(depth + 1);

        // Center meter bar
        const meterBg = this.scene.add.rectangle(hudX, hudY, 160, 18, 0x001018, 0.95)
            .setStrokeStyle(1, 0x2a6680, 0.8)
            .setDepth(depth);
        this._voltageMeterBar = this.scene.add.graphics().setDepth(depth + 1);

        // Right "TARGET" panel
        const rightBg = this.scene.add.rectangle(hudX + 170, hudY, 160, 34, 0x02222a, 0.9)
            .setStrokeStyle(1, 0x00cccc, 0.8)
            .setDepth(depth);
        const rightLabel = this.scene.add.text(hudX + 170, hudY - 6, 'TARGET POWER', {
            fontFamily: 'Courier New', fontSize: '8px', color: '#66aaaa', letterSpacing: 2,
        }).setOrigin(0.5).setDepth(depth + 1);
        this._voltageTargetText = this.scene.add.text(hudX + 170, hudY + 8, '0', {
            fontFamily: 'Courier New', fontSize: '14px', color: '#ffcc44', fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(depth + 1);

        this.container.add([
            leftBg, leftLabel, this._voltageActualText,
            meterBg, this._voltageMeterBar,
            rightBg, rightLabel, this._voltageTargetText,
        ]);
        this._voltageMeterCenter = { x: hudX, y: hudY };
    }

    _buildInventoryPanel(depth) {
        const panelX = Math.max(120, this.boardX - 130);
        const panelY = this.boardY;
        const panelH = Math.max(220, this.rows * this.cellSize);
        const panelW = 108;

        const panelBg = this.scene.add.rectangle(panelX, panelY + panelH / 2, panelW, panelH, 0x001a20, 0.9)
            .setStrokeStyle(1, 0x00cccc, 0.75)
            .setDepth(depth);
        const title = this.scene.add.text(panelX, panelY + 14, 'INVENTORY', {
            fontFamily: 'Courier New', fontSize: '10px', color: '#00eeee', letterSpacing: 2,
        }).setOrigin(0.5).setDepth(depth + 1);
        const hint = this.scene.add.text(panelX, panelY + panelH - 14,
            'L-click: place   R-click: pickup', {
                fontFamily: 'Courier New', fontSize: '7px', color: '#66aaaa', align: 'center',
                wordWrap: { width: panelW - 12 },
            }).setOrigin(0.5).setDepth(depth + 1);
        this.container.add([panelBg, title, hint]);

        const pieces = ['straight', 'curve', 'tee', 'cross'];
        const slotSize = 50;
        const slotGap = 8;
        const slotsStartY = panelY + 38;
        pieces.forEach((type, idx) => {
            const sx = panelX;
            const sy = slotsStartY + idx * (slotSize + slotGap) + slotSize / 2;
            const slotGfx = this.scene.add.graphics().setDepth(depth + 1);
            const pipeGfx = this.scene.add.graphics().setDepth(depth + 2);
            const countText = this.scene.add.text(sx + slotSize / 2 - 4, sy + slotSize / 2 - 4,
                '0', {
                    fontFamily: 'Courier New', fontSize: '13px', color: '#e6faff',
                    stroke: '#000000', strokeThickness: 2, fontStyle: 'bold',
                }).setOrigin(1, 1).setDepth(depth + 3);
            const labelText = this.scene.add.text(sx, sy + slotSize / 2 + 4,
                type.toUpperCase(), {
                    fontFamily: 'Courier New', fontSize: '7px', color: '#9dd6d6',
                }).setOrigin(0.5, 0).setDepth(depth + 2);
            const hitArea = this.scene.add.rectangle(sx, sy, slotSize, slotSize, 0x000000, 0)
                .setInteractive({ useHandCursor: true })
                .setDepth(depth + 4);
            hitArea.on('pointerdown', (_p, _lx, _ly, event) => {
                event?.stopPropagation?.();
                this._toggleInventorySelection(type);
            });
            this.container.add([slotGfx, pipeGfx, labelText, countText, hitArea]);
            this._inventoryViews[type] = { type, sx, sy, slotSize, slotGfx, pipeGfx, countText, hitArea };
        });

        this._refreshInventoryPanel();
    }

    _refreshInventoryPanel() {
        Object.values(this._inventoryViews).forEach((view) => {
            const count = this._inventory[view.type] || 0;
            const selected = this._selectedInventoryType === view.type;
            const hasAny = count > 0;
            const fill = selected ? 0x00404a : (hasAny ? 0x02272e : 0x10191c);
            const stroke = selected ? 0x66ffff : (hasAny ? 0x5fcae0 : 0x2a4048);
            const strokeAlpha = selected ? 1 : (hasAny ? 0.9 : 0.6);
            this._drawOctagonFrame(view.slotGfx, view.sx, view.sy, view.slotSize - 4, {
                fill,
                fillAlpha: 0.94,
                stroke,
                strokeAlpha,
                strokeWidth: selected ? 2 : 1.2,
                chamferRatio: 0.26,
            });
            view.pipeGfx.clear();
            this._drawInventoryPieceIcon(view.pipeGfx, view.sx, view.sy, view.type,
                hasAny ? 0x00ffcc : 0x335055);
            view.countText.setText(String(count));
            view.countText.setColor(hasAny ? '#e6faff' : '#557075');
        });
    }

    _drawInventoryPieceIcon(gfx, cx, cy, type, color) {
        const r = 14; // icon radius
        gfx.lineStyle(3, color, 1);
        const conns = TILE_BASE[type] || [0, 0, 0, 0];
        // simple tile icon: render the base orientation connections as lines
        // from center to each open edge. Cross/tee look different enough.
        if (conns[0]) gfx.lineBetween(cx, cy, cx, cy - r);
        if (conns[1]) gfx.lineBetween(cx, cy, cx + r, cy);
        if (conns[2]) gfx.lineBetween(cx, cy, cx, cy + r);
        if (conns[3]) gfx.lineBetween(cx, cy, cx - r, cy);
        gfx.fillStyle(color, 1);
        gfx.fillCircle(cx, cy, 3.2);
    }

    _toggleInventorySelection(type) {
        const count = this._inventory[type] || 0;
        if (count <= 0) {
            this._selectedInventoryType = null;
            this._refreshInventoryPanel();
            return;
        }
        this._selectedInventoryType = (this._selectedInventoryType === type) ? null : type;
        this._refreshInventoryPanel();
    }

    _handleInventoryClick(x, y, pointer) {
        const tile = this._tiles?.[y]?.[x];
        if (!tile) return false;
        const isForbidden = this._forbidden.has(`${x},${y}`);
        const rightClick = pointer?.rightButtonDown?.() === true
            || pointer?.buttons === 2
            || pointer?.button === 2;

        // Right-click: pick up a placed piece → inventory
        if (rightClick) {
            if (isForbidden) return true; // swallow, no-op
            if (tile.type === 'empty' || tile.locked) return true;
            if (!Object.prototype.hasOwnProperty.call(this._inventory, tile.type)) return true;
            this._inventory[tile.type] = (this._inventory[tile.type] || 0) + 1;
            this._tiles[y][x] = { type: 'empty', rotation: 0 };
            this._refreshInventoryPanel();
            this._updateAll();
            this._playWireTurnSound?.();
            return true;
        }

        // Left-click with an active selection on an empty cell → place
        const sel = this._selectedInventoryType;
        if (sel && tile.type === 'empty' && !isForbidden) {
            const count = this._inventory[sel] || 0;
            if (count <= 0) return false;
            this._inventory[sel] = count - 1;
            this._tiles[y][x] = { type: sel, rotation: 0 };
            if ((this._inventory[sel] || 0) <= 0) this._selectedInventoryType = null;
            // Full rebuild of this tile's visual state (its pipe graphics was
            // tied to the old empty tile). Cheapest path: re-render via
            // _updateAll which repaints all pipes from _tiles.
            this._refreshInventoryPanel();
            this._updateAll();
            this._playWireTurnSound?.();
            return true;
        }

        return false;
    }

    _seedInitialInventory(circuit) {
        // If the circuit defines an explicit inventory, honour it verbatim and
        // remove the matching pieces from the board at authored positions.
        if (circuit?.inventory && typeof circuit.inventory === 'object') {
            Object.entries(circuit.inventory).forEach(([type, count]) => {
                const n = Math.max(0, Math.floor(Number(count) || 0));
                if (!Object.prototype.hasOwnProperty.call(this._inventory, type)) return;
                this._inventory[type] = (this._inventory[type] || 0) + n;
            });
            this._refreshInventoryPanel();
            return;
        }

        // Otherwise, auto-pop a couple of interior non-critical tiles off the
        // board and place them in the inventory so the user has something to
        // place from the start. Pick cells that are in the interior (not in
        // source column 0 and not in output column cols-1).
        const interior = [];
        const outRows = new Set(this._outputSpecs.map((s) => s.row));
        for (let y = 0; y < this.rows; y++) {
            for (let x = 1; x < this.cols - 1; x++) {
                if (this._forbidden.has(`${x},${y}`)) continue;
                const t = this._tiles[y][x];
                if (!t || t.type === 'empty') continue;
                if (!Object.prototype.hasOwnProperty.call(this._inventory, t.type)) continue;
                // Skip tees/crosses (they're usually junctions; removing them
                // breaks the puzzle more than desired for a default seed).
                if (t.type === 'tee' || t.type === 'cross') continue;
                interior.push({ x, y, type: t.type });
            }
        }
        if (interior.length === 0) return;
        // Seed 2-3 pieces for 5-cell-wide boards, more for larger grids.
        const budget = Math.min(interior.length, Math.max(2, Math.floor(interior.length * 0.25)));
        // Deterministic pick based on grid size + output rows so the same
        // puzzle always pops the same tiles.
        const seedHash = (this.rows * 31 + this.cols * 17 + [...outRows].reduce((a, b) => a + b, 0)) % 9973;
        for (let i = 0; i < budget; i++) {
            const idx = (seedHash + i * 37) % interior.length;
            const pick = interior.splice(idx, 1)[0];
            if (!pick) break;
            this._inventory[pick.type] = (this._inventory[pick.type] || 0) + 1;
            this._tiles[pick.y][pick.x] = { type: 'empty', rotation: 0 };
        }
        this._refreshInventoryPanel();
    }

    _refreshVoltageHud() {
        if (!this._voltageActualText) return;
        const targetCount = this._outputSpecs.length;
        // Read from the live snapshot built each _updateAll, falling back to
        // the persisted evidence on first paint before any flow recompute.
        const powered = this._latestSnapshot?.repairedTargets?.length
            ?? this.evidence?.repairedTargets?.length
            ?? 0;
        this._voltageActualText.setText(`${powered} / ${targetCount}`);
        this._voltageTargetText.setText(String(targetCount));

        // Fill the meter bar based on powered / target.
        const cx = this._voltageMeterCenter?.x ?? 640;
        const cy = this._voltageMeterCenter?.y ?? (this.boardY - 40);
        const width = 150;
        const height = 10;
        const left = cx - width / 2;
        const top = cy - height / 2;
        const ratio = targetCount > 0 ? Math.max(0, Math.min(1, powered / targetCount)) : 0;
        this._voltageMeterBar.clear();
        // segmented fill
        const segCount = Math.max(4, targetCount * 2);
        const segWidth = (width - (segCount - 1) * 2) / segCount;
        const lit = Math.round(ratio * segCount);
        for (let i = 0; i < segCount; i++) {
            const x = left + i * (segWidth + 2);
            const on = i < lit;
            this._voltageMeterBar.fillStyle(on ? 0x00ffcc : 0x0f2a2e, on ? 0.95 : 0.9);
            this._voltageMeterBar.fillRect(x, top, segWidth, height);
        }
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
        const forbiddenUsed = (result?.forbiddenHit ?? []).length > 0;
        const repairStates = this._repairTargets.map((target) => {
            const feeds = Array.isArray(outputFeeds[target.key])
                ? outputFeeds[target.key].map((feed) => ({ ...feed }))
                : [];
            const feedClasses = feeds.map((feed) => feed.powerClass || 'neutral');
            const expectedClass = target.powerClass || 'neutral';
            const actualPowerClass = deriveFlowDisplayPowerClass(feedClasses);
            const hazardousTarget = expectedClass === 'red';
            const hazardousFeed = actualPowerClass === 'red';
            const classMismatch = feeds.length > 0
                && !hazardousTarget
                && !hazardousFeed
                && actualPowerClass !== expectedClass;
            const repaired = feeds.length > 0
                && !hazardousTarget
                && !hazardousFeed
                && actualPowerClass === expectedClass;
            let issueCode = null;
            let issueMessage = null;

            if (hazardousTarget) {
                issueCode = 'crackling-module';
                issueMessage = `${target.displayName || target.label} is a red crackling module and cannot be repaired.`;
            } else if (hazardousFeed) {
                issueCode = 'red-feed';
                issueMessage = `${target.displayName || target.label} is being flooded by unsafe red power.`;
            } else if (classMismatch) {
                issueCode = 'class-mismatch';
                issueMessage = `${target.displayName || target.label} received the wrong power class.`;
            }

            return {
                ...target,
                repaired,
                feeds,
                feedCount: feeds.length,
                feedClasses: Array.from(new Set(feedClasses)),
                actualPowerClass,
                issueCode,
                issueMessage,
            };
        });
        const connected = repairStates.filter((target) => target.feedCount > 0).map((target) => target.key);
        const repairedTargets = repairStates.filter((target) => target.repaired).map((target) => target.key);
        const brokenTargets = repairStates.filter((target) => !target.repaired).map((target) => target.key);
        const signalIssues = repairStates.filter((target) => target.issueCode);
        const redHazard = repairStates.find((target) => target.issueCode === 'red-feed' || target.issueCode === 'crackling-module') || null;
        const scrapRequired = Boolean(this._inspectionFault) || Boolean(redHazard);
        const scrapKind = this._inspectionFault?.kind || (redHazard ? 'hazard' : null);
        const scrapStatus = this._inspectionFault?.status || (redHazard ? 'CRACKLING ENERGY' : null);
        const scrapReason = this._inspectionFault?.reason || redHazard?.issueMessage || null;
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
            inventory: { ...this._inventory },
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
                : repairStates.filter((target) => !target.repaired).map((target) => target.issueMessage || target.brokenLabel),
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
            const actualPalette = getFlowPowerPalette(state.actualPowerClass || target.powerClass || 'neutral');
            const idleStatusColor = target.powerClass && target.powerClass !== 'neutral'
                ? actualPalette.label
                : '#ffb695';
            dot.setFillStyle(repaired ? actualPalette.tint : (invalidSignal ? actualPalette.tint : 0x2f4a57), 1);
            dot.setStrokeStyle(1, repaired ? 0xe8fff1 : (invalidSignal ? 0xffd4cf : 0x7aa8b7), 0.88);
            nameText.setColor(repaired ? '#ddffed' : (invalidSignal ? '#ffd7d1' : '#b8dbe1'));
            statusText
                .setText(
                    repaired
                        ? 'REPAIRED'
                        : (invalidSignal
                            ? (state.issueCode === 'crackling-module' || state.issueCode === 'red-feed'
                                ? 'HAZARD // SCRAP'
                                : String(state.issueCode || 'MISMATCH').replace(/-/g, ' ').toUpperCase())
                            : (forbiddenUsed
                                ? 'BROKEN // MOD'
                                : (target.powerClass === 'red'
                                    ? 'HAZARD // SCRAP'
                                    : (target.powerClass && target.powerClass !== 'neutral'
                                        ? String(target.powerClass).toUpperCase()
                                        : 'BROKEN'))))
                )
                .setColor(repaired ? '#7dffb6' : (invalidSignal ? '#ffb4ae' : (forbiddenUsed ? '#ffd0c4' : idleStatusColor)));
        });
    }

    _drawTile(x, y, powerClass = null) {
        const gfx = this._tileGfx[y][x];
        const tile = this._tiles[y][x];
        const conns = TILE_BASE[tile.type] || TILE_BASE.empty;
        const { pipe, container, isForbidden, modifierGfx, modifierText } = gfx;
        const reached = Boolean(powerClass);
        const palette = getFlowPowerPalette(powerClass || 'neutral');
        const wireFilter = this._getWireFilter(x, y);

        pipe.clear();
        modifierGfx?.clear();
        modifierText?.setVisible(false).setText('');
        if (!gfx.rotationTween) {
            container.angle = tile.rotation * 90;
        }

        if (wireFilter && modifierGfx && modifierText) {
            const filterPalette = getFlowPowerPalette(wireFilter.powerClass);
            modifierGfx.fillStyle(filterPalette.tint, 0.18);
            modifierGfx.lineStyle(1, filterPalette.tint, 0.92);
            modifierGfx.fillRoundedRect(-16, -(this.cellSize / 2) + 4, 32, 12, 5);
            modifierGfx.strokeRoundedRect(-16, -(this.cellSize / 2) + 4, 32, 12, 5);
            modifierText
                .setText(wireFilter.label || String(wireFilter.powerClass || '').slice(0, 3).toUpperCase())
                .setColor(filterPalette.label)
                .setVisible(true);
        }

        if (isForbidden) {
            // Forbidden cells previously rendered a large X across the whole
            // tile, which read as "this cell matters" — but the X is purely
            // decorative and the puzzle can usually be solved by routing
            // around it. The amber octagon frame + corner "?" mark already
            // signal "blocked" without the heavy X overlay.
            pipe.fillStyle(0xffb347, 0.10);
            pipe.fillRoundedRect(
                -(this.cellSize / 2) + 8,
                -(this.cellSize / 2) + 8,
                this.cellSize - 16,
                this.cellSize - 16,
                12,
            );
            // Diagonal hatching strokes — subtle "no-go" texture instead of
            // the loud X. Two short parallel slashes in the corners.
            pipe.lineStyle(2, 0xffcc77, 0.55);
            const inset = (this.cellSize / 2) - 14;
            pipe.lineBetween(-inset, -inset + 6, -inset + 6, -inset);
            pipe.lineBetween(inset - 6, inset, inset, inset - 6);
            return;
        }
        if (tile.type === 'empty') return;

        const color = isForbidden && reached ? 0xffaa00
                    : reached ? palette.tint
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

    _drawTileEnergy(x, y, powerClass = null) {
        const gfx = this._tileGfx[y][x];
        const tile = this._tiles[y][x];
        const conns = TILE_BASE[tile.type] || TILE_BASE.empty;
        const energy = gfx.energy;
        const reached = Boolean(powerClass);
        const palette = getFlowPowerPalette(powerClass || 'neutral');

        energy.clear();
        if (!reached || tile.type === 'empty') return;

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

        // Bright dashed "power" trail + moving dot, rendered ABOVE the pipe so
        // the player can clearly read the flow direction.
        energy.lineStyle(3, palette.tint, 0.55);
        energy.fillStyle(palette.tint, 0.95);
        directionVectors.forEach((vector, index) => {
            if (!conns[index]) return;

            const tail = Math.min(half, dashTail);
            const head = Math.min(half, dashHead);
            energy.lineBetween(vector.x * tail, vector.y * tail, vector.x * head, vector.y * head);
            // Outer halo behind the travelling dot for extra pop on the pipe.
            energy.fillStyle(palette.tint, 0.35);
            energy.fillCircle(vector.x * head, vector.y * head, 5);
            energy.fillStyle(palette.tint, 0.95);
            energy.fillCircle(vector.x * head, vector.y * head, 3);
        });

        energy.fillStyle(palette.tint, 0.5);
        energy.fillCircle(0, 0, 5.5);
        energy.fillStyle(0xffffff, 0.85);
        energy.fillCircle(0, 0, 2.2);
    }

    _computeReached() {
        const reached = new Set();
        const reachedOutputs = [];
        const forbiddenHit = [];
        const flowSegments = new Map();
        const outputFeeds = {};
        const sourceActivity = {};
        const tileFeeds = new Map();
        const visitedStates = new Set();

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
            const queue = [{ x: startX, y: startY, powerClass: this._getEffectivePowerClass(startX, startY, source.powerClass || 'neutral') }];
            recordFlowSegment(flowSegments, { x: -1, y: startY }, { x: startX, y: startY }, queue[0].powerClass);

            while (queue.length) {
                const { x, y, powerClass } = queue.shift();
                const stateKey = `${x},${y}:${source.key}:${powerClass}`;
                if (visitedStates.has(stateKey)) continue;
                visitedStates.add(stateKey);

                const cellKey = getFlowCellKey(x, y);
                reached.add(cellKey);
                const existingTileFeeds = tileFeeds.get(cellKey) || new Set();
                existingTileFeeds.add(powerClass || 'neutral');
                tileFeeds.set(cellKey, existingTileFeeds);

                const tile = this._tiles[y][x];
                const conns = rotatedConnections(tile.type, tile.rotation);

                for (const d of DIRS) {
                    if (!conns[d.idx]) continue;
                    const nx = x + d.dx;
                    const ny = y + d.dy;

                    if (nx === this.cols) {
                        const outputSpec = this._outputSpecs.find((candidate) => candidate.row === y);
                        if (outputSpec && d.idx === 1) {
                            recordFlowFeed(outputFeeds, outputSpec.key, {
                                ...source,
                                powerClass,
                            });
                            if (!reachedOutputs.includes(outputSpec.key)) {
                                reachedOutputs.push(outputSpec.key);
                            }
                            recordFlowSegment(flowSegments, { x, y }, { x: this.cols, y }, powerClass);
                        }
                        continue;
                    }

                    if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
                    if (this._forbidden.has(`${nx},${ny}`)) continue;
                    const neighbor = this._tiles[ny][nx];
                    const nconns = rotatedConnections(neighbor.type, neighbor.rotation);
                    if (!nconns[d.opp]) continue;
                    const nextPowerClass = this._getEffectivePowerClass(nx, ny, powerClass);
                    recordFlowSegment(flowSegments, { x, y }, { x: nx, y: ny }, nextPowerClass);
                    queue.push({ x: nx, y: ny, powerClass: nextPowerClass });
                }
            }
        });

        const tilePowerClasses = new Map(Array.from(tileFeeds.entries()).map(([cellKey, classes]) => [
            cellKey,
            deriveFlowDisplayPowerClass(Array.from(classes)),
        ]));
        const normalizedSegments = Array.from(flowSegments.values()).map((segment) => ({
            from: segment.from,
            to: segment.to,
            powerClass: deriveFlowDisplayPowerClass(Array.from(segment.powerClasses)),
        }));

        return {
            reached,
            reachedOutputs,
            forbiddenHit,
            flowSegments: normalizedSegments,
            outputFeeds,
            sourceActivity,
            tilePowerClasses,
        };
    }

    _getFlowLinkPosition(node) {
        const y = this.boardY + node.y * this.cellSize + this.cellSize / 2;
        const endpointRadius = 10;

        if (node.x === -1) {
            return { x: this.boardX - 28 + endpointRadius, y };
        }

        if (node.x === this.cols) {
            return { x: this.boardX + this.cols * this.cellSize + 26 - endpointRadius, y };
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
                powerClass: segment.powerClass || 'neutral',
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
        const palette = getFlowPowerPalette(activeSegment.powerClass || 'neutral');

        this._sourceFlowGfx.fillStyle(palette.tint, 0.12);
        this._sourceFlowGfx.fillCircle(x, y, 9);
        this._sourceFlowGfx.fillStyle(palette.tint, 0.52);
        this._sourceFlowGfx.fillCircle(x, y, 4.2);
    }

    _refreshAnimatedCircuitEffects() {
        const renderState = this._lastCircuitRenderState;
        const tilePowerClasses = renderState?.tilePowerClasses || new Map();
        const reachedOutputs = renderState?.outputFeeds || {};

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this._drawTileEnergy(x, y, tilePowerClasses.get(getFlowCellKey(x, y)) || null);
            }
        }

        Object.values(this._outputDots).forEach((view) => {
            const feeds = reachedOutputs[view.outputSpec.key] || [];
            const actualPowerClass = deriveFlowDisplayPowerClass(feeds.map((feed) => feed.powerClass || 'neutral'));
            const requiredClass = view.outputSpec.powerClass || 'neutral';
            const displayClass = actualPowerClass || requiredClass;
            const palette = getFlowPowerPalette(displayClass || 'neutral');
            const pulse = 0.18 + (Math.sin((this._energyPhase * Math.PI * 2) + (Number(view.outputSpec.row) * 0.65)) * 0.08);
            const active = feeds.length > 0;
            const hazardous = requiredClass === 'red' || actualPowerClass === 'red';

            view.glow?.setFillStyle(palette.tint, 1).setAlpha(active ? pulse : (hazardous ? 0.18 : 0));
            view.ring?.setStrokeStyle(2, palette.tint, active ? 0.42 + pulse : (hazardous ? 0.52 : 0));
            view.dot?.setFillStyle((active || hazardous) ? palette.tint : 0x225533, 1).setScale(active ? 1.02 + (pulse * 0.08) : 1);
            view.lbl?.setColor(active ? palette.label : palette.idle);
            view.req?.setColor(palette.label);
        });

        Object.values(this._sourceViews).forEach((view) => {
            const palette = getFlowPowerPalette(view.source.powerClass);
            const active = Boolean(renderState?.sourceActivity?.[view.source.key]);
            view.pulse?.setAlpha(active ? 0.12 + (Math.sin(this._energyPhase * Math.PI * 2) * 0.03) + 0.05 : 0.1);
            view.dot?.setFillStyle(palette.dot, 1);
        });

        if ((renderState?.flowSegments || []).length > 0) {
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
        const { reached, reachedOutputs, forbiddenHit, flowSegments, outputFeeds, sourceActivity, tilePowerClasses } = this._computeReached();
        const snapshot = this._buildProgressSnapshot({ reached, reachedOutputs, forbiddenHit, flowSegments, outputFeeds, sourceActivity, tilePowerClasses });

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this._drawTile(x, y, tilePowerClasses.get(getFlowCellKey(x, y)) || null);
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
            tilePowerClasses,
            completed: snapshot.completed,
        };
        this._lastCircuitRenderState = {
            flowSegments,
            completed: snapshot.completed,
            outputFeeds,
            sourceActivity,
            tilePowerClasses,
        };

        this._refreshAnimatedCircuitEffects();

        // Build the live snapshot once and feed it both to circuit.progress
        // (used by Game.js) and to the voltage HUD. Previously the HUD read
        // from `this.evidence`, which is only mutated on close, so the meter
        // stayed stuck at its initial value during play.
        this._latestSnapshot = this._syncCircuitProgress(this._lastResult);
        this._refreshVoltageHud?.();
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
        this._wireFilters = [];
        this._wireFilterMap = new Map();
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

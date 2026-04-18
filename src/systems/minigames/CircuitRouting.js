import MinigameBase from './MinigameBase.js';

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
    }

    _build(caseData) {
        const depth = this.config.depth;
        const circuit = caseData.circuit;
        if (!circuit) {
            this.emitEvidence({ completed: false, note: 'no circuit data' });
            return;
        }

        this._circuit = circuit;
        this._outputs = circuit.outputs || {};
        this._sourceRow = circuit.sourceRow ?? 2;

        let tiles, forbiddenList;
        if (circuit.tiles) {
            tiles = circuit.tiles.map(row => row.map(c => ({ ...c })));
            forbiddenList = circuit.forbidden || [];
        } else {
            // Check if we already generated tiles for this case
            if (circuit._generatedTiles) {
                tiles = circuit._generatedTiles.map(row => row.map(c => ({ ...c })));
            } else {
                // Generate new circuit tiles and cache them
                const gen = generateCircuit(circuit, this.rows, this.cols);
                tiles = gen.tiles;
                // Store only the tiles for future use (forbidden cells will be random each time)
                circuit._generatedTiles = tiles.map(row => row.map(c => ({ ...c })));
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
            fontFamily: 'monospace', fontSize: '16px', color: '#00ffff', letterSpacing: 2,
        }).setOrigin(0.5).setDepth(depth + 2);
        this.container.add(title);

        const subtitle = this.scene.add.text(640, 108, 'Click tiles to rotate. Route PWR to every output. Amber [?] nodes flag modifications when power passes through.', {
            fontFamily: 'monospace', fontSize: '10px', color: '#66aaaa',
            align: 'center', wordWrap: { width: 1000 },
        }).setOrigin(0.5).setDepth(depth + 2);
        this.container.add(subtitle);

        // Source indicator
        const srcY = this.boardY + this._sourceRow * this.cellSize + this.cellSize / 2;
        const srcX = this.boardX - 40;
        const srcDot = this.scene.add.circle(srcX, srcY, 10, 0xffcc00, 1).setDepth(depth + 2);
        const srcPulse = this.scene.add.circle(srcX, srcY, 18, 0xffcc00, 0.3).setDepth(depth + 1);
        this.scene.tweens.add({
            targets: srcPulse, alpha: { from: 0.3, to: 0.05 }, scale: { from: 1, to: 1.8 },
            duration: 900, repeat: -1,
        });
        const srcLbl = this.scene.add.text(srcX - 10, srcY, 'PWR', {
            fontFamily: 'monospace', fontSize: '10px', color: '#ffcc44',
        }).setOrigin(1, 0.5).setDepth(depth + 2);
        this.container.add([srcDot, srcPulse, srcLbl]);

        // Output indicators
        this._outputDots = {};
        for (let y = 0; y < this.rows; y++) {
            const label = this._outputs[y];
            if (!label) continue;
            const ox = this.boardX + this.cols * this.cellSize + 40;
            const oy = this.boardY + y * this.cellSize + this.cellSize / 2;
            const dot = this.scene.add.circle(ox, oy, 10, 0x225533, 1).setDepth(depth + 2);
            const lbl = this.scene.add.text(ox + 16, oy, label, {
                fontFamily: 'monospace', fontSize: '11px', color: '#556666',
            }).setOrigin(0, 0.5).setDepth(depth + 2);
            this.container.add([dot, lbl]);
            this._outputDots[y] = { dot, lbl };
        }

        // Tiles
        for (let y = 0; y < this.rows; y++) {
            this._tileGfx[y] = [];
            for (let x = 0; x < this.cols; x++) {
                const gfx = this._buildTile(x, y, depth + 2);
                this._tileGfx[y][x] = gfx;
            }
        }

        // Close button
        const closeBg = this.scene.add.rectangle(640, 640, 260, 44, 0x003344, 0.85)
            .setStrokeStyle(1, 0x00cccc, 0.9)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth + 2);
        const closeTxt = this.scene.add.text(640, 640, 'CLOSE DIAGNOSTIC [ESC]', {
            fontFamily: 'monospace', fontSize: '13px', color: '#00eeee',
        }).setOrigin(0.5).setDepth(depth + 3);
        closeBg.on('pointerover', () => closeBg.setFillStyle(0x00aaaa, 0.45));
        closeBg.on('pointerout',  () => closeBg.setFillStyle(0x003344, 0.85));
        closeBg.on('pointerdown', () => this._finalizeAndClose());
        this.container.add([closeBg, closeTxt]);

        this._escKey = this.scene.input.keyboard.addKey('ESC');
        this._escHandler = () => { if (this.active) this._finalizeAndClose(); };
        this._escKey.on('down', this._escHandler);

        this._updateAll();
    }

    _buildTile(x, y, depth) {
        const cx = this.boardX + x * this.cellSize + this.cellSize / 2;
        const cy = this.boardY + y * this.cellSize + this.cellSize / 2;
        const isForbidden = this._forbidden.has(`${x},${y}`);

        const bg = this.scene.add.rectangle(cx, cy, this.cellSize - 4, this.cellSize - 4,
            isForbidden ? 0x2a1e00 : 0x001f22, 0.9)
            .setStrokeStyle(1, isForbidden ? 0xddaa33 : 0x225566, 0.8)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth);

        const pipe = this.scene.add.graphics().setDepth(depth + 1);
        const mark = isForbidden
            ? this.scene.add.text(cx + this.cellSize / 2 - 10, cy - this.cellSize / 2 + 8, '?', {
                fontFamily: 'monospace', fontSize: '12px', color: '#ffcc44',
              }).setOrigin(1, 0).setDepth(depth + 2)
            : null;

        const tile = this._tiles[y][x];
        const locked = tile.locked === true;

        bg.on('pointerdown', () => {
            if (locked || tile.type === 'empty') return;
            tile.rotation = (tile.rotation + 1) % 4;
            this._updateAll();
        });
        bg.on('pointerover', () => {
            if (!locked && tile.type !== 'empty') bg.setStrokeStyle(1, 0x66ccff, 1);
        });
        bg.on('pointerout', () => {
            bg.setStrokeStyle(1, isForbidden ? 0xddaa33 : 0x225566, 0.8);
        });

        this.container.add([bg, pipe]);
        if (mark) this.container.add(mark);
        return { bg, pipe, cx, cy, isForbidden };
    }

    _drawTile(x, y, reached) {
        const gfx = this._tileGfx[y][x];
        const tile = this._tiles[y][x];
        const conns = rotatedConnections(tile.type, tile.rotation);
        const { pipe, cx, cy, isForbidden } = gfx;

        pipe.clear();
        if (tile.type === 'empty') return;

        const color = isForbidden && reached ? 0xffaa00
                    : reached ? 0x00ffcc
                    : 0x336677;
        const width = reached ? 8 : 5;
        pipe.lineStyle(width, color, 1);

        const half = this.cellSize / 2 - 2;
        if (conns[0]) pipe.lineBetween(cx, cy, cx, cy - half);
        if (conns[1]) pipe.lineBetween(cx, cy, cx + half, cy);
        if (conns[2]) pipe.lineBetween(cx, cy, cx, cy + half);
        if (conns[3]) pipe.lineBetween(cx, cy, cx - half, cy);

        pipe.fillStyle(color, 1);
        pipe.fillCircle(cx, cy, width * 0.7);
    }

    _computeReached() {
        const reached = new Set();
        const reachedOutputs = [];
        const forbiddenHit = [];

        const startX = 0, startY = this._sourceRow;
        const startTile = this._tiles[startY][startX];
        const startConns = rotatedConnections(startTile.type, startTile.rotation);
        if (!startConns[3]) return { reached, reachedOutputs, forbiddenHit };

        const queue = [[startX, startY]];
        reached.add(`${startX},${startY}`);

        while (queue.length) {
            const [x, y] = queue.shift();
            const tile = this._tiles[y][x];
            const conns = rotatedConnections(tile.type, tile.rotation);

            if (this._forbidden.has(`${x},${y}`)) forbiddenHit.push([x, y]);

            for (const d of DIRS) {
                if (!conns[d.idx]) continue;
                const nx = x + d.dx, ny = y + d.dy;
                if (nx === this.cols && this._outputs[y]) {
                    if (d.idx === 1) reachedOutputs.push(this._outputs[y]);
                    continue;
                }
                if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
                const neighbor = this._tiles[ny][nx];
                const nconns = rotatedConnections(neighbor.type, neighbor.rotation);
                if (!nconns[d.opp]) continue;
                const k = `${nx},${ny}`;
                if (reached.has(k)) continue;
                reached.add(k);
                queue.push([nx, ny]);
            }
        }
        return { reached, reachedOutputs, forbiddenHit };
    }

    _updateAll() {
        const { reached, reachedOutputs, forbiddenHit } = this._computeReached();
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                this._drawTile(x, y, reached.has(`${x},${y}`));
            }
        }
        Object.entries(this._outputDots).forEach(([y, { dot, lbl }]) => {
            const label = this._outputs[y];
            if (reachedOutputs.includes(label)) {
                dot.setFillStyle(0x00ffcc, 1);
                lbl.setColor('#00ffcc');
            } else {
                dot.setFillStyle(0x225533, 1);
                lbl.setColor('#556666');
            }
        });
        this._lastResult = { reachedOutputs, forbiddenHit };
    }

    _finalizeAndClose() {
        const required = Object.values(this._outputs);
        const reached = this._lastResult?.reachedOutputs ?? [];
        const missing = required.filter(o => !reached.includes(o));
        const forbiddenUsed = (this._lastResult?.forbiddenHit ?? []).length > 0;

        const symptoms = [];
        if (missing.includes('VOICE'))  symptoms.push('Voice module unresponsive.');
        if (missing.includes('EYES'))   symptoms.push('Optical sensors offline.');
        if (missing.includes('LIMBS'))  symptoms.push('Actuator bus disconnected.');
        if (missing.includes('MEMORY'))symptoms.push('Memory channel severed.');
        if (missing.includes('CPU'))    symptoms.push('Core logic unreachable.');

        const flags = [];
        if (forbiddenUsed) flags.push('UNAUTHORIZED MODIFICATION DETECTED');

        this.emitEvidence({
            completed: missing.length === 0 && !forbiddenUsed,
            connected: reached,
            missing,
            forbiddenUsed,
            symptoms,
            flags,
        });
        this.close();
    }

    hide() {
        if (this._escKey && this._escHandler) {
            this._escKey.off('down', this._escHandler);
        }
        this._escKey = null;
        this._escHandler = null;
        super.hide();
    }
}

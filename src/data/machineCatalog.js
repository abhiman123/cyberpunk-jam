import {
    GEAR_CODES,
    buildGearProgressSnapshot,
    cloneGearBoard,
    cloneGearPieces,
    isGearType,
} from '../core/gearPuzzleLogic.js';

const MACHINE_SPRITE_FOLDER = 'assets/machines/sprites';
const MACHINE_FALLBACK_KEY = 'unit_placeholder';
const CELL_EMPTY = 0;
const CELL_WALL = 1;
const MIN_CHARGE_CODE = 2;
const MAX_CHARGE_CODE = 5;
const EMPTY_PLACED_OFFSET = 10;
const BROKEN_REGION_GLYPHS = Object.freeze(['#', '%', '@', '?', '&', '*']);

function normalizeRotationIndex(value) {
    const safeValue = Number.isInteger(value) ? value : 0;
    return ((safeValue % 4) + 4) % 4;
}

function getOrientationForRotationIndex(rotationIndex) {
    return normalizeRotationIndex(rotationIndex) % 2 === 0 ? 'vertical' : 'horizontal';
}

const createMachineSprite = (id, fileName) => ({
    key: `machine_${id}`,
    fileName: fileName || null,
    path: fileName ? `${MACHINE_SPRITE_FOLDER}/${fileName}` : null,
    fallbackKey: MACHINE_FALLBACK_KEY,
});

const createGridOption = ({ grid, dominos, impossible = false }) => ({
    grid,
    dominos,
    impossible,
});

const FLOW_TILE_ROWS = 5;
const FLOW_TILE_COLS = 5;
const FLOW_CARDINAL_STEPS = Object.freeze([
    { dir: 'N', dx: 0, dy: -1, opposite: 'S' },
    { dir: 'E', dx: 1, dy: 0, opposite: 'W' },
    { dir: 'S', dx: 0, dy: 1, opposite: 'N' },
    { dir: 'W', dx: -1, dy: 0, opposite: 'E' },
]);

const FLOW_TARGET_METADATA = Object.freeze({
    ARMS: { displayName: 'Armature Relay', brokenLabel: 'Armature relay offline.', fixedLabel: 'Armature relay stable.' },
    LIMBS: { displayName: 'Limb Actuators', brokenLabel: 'Limb actuators disconnected.', fixedLabel: 'Limb actuators restored.' },
    EYES: { displayName: 'Optic Cluster', brokenLabel: 'Optic cluster offline.', fixedLabel: 'Optic cluster restored.' },
    VOICE: { displayName: 'Voice Box', brokenLabel: 'Broken voice box.', fixedLabel: 'Voice box stabilized.', affectsDialogue: true },
    CPU: { displayName: 'Core Logic', brokenLabel: 'Core logic unreachable.', fixedLabel: 'Core logic online.' },
    MEMORY: { displayName: 'Memory Bank', brokenLabel: 'Memory bank severed.', fixedLabel: 'Memory bank linked.' },
    HATCH: { displayName: 'Cargo Hatch', brokenLabel: 'Cargo hatch actuator offline.', fixedLabel: 'Cargo hatch unlocked.' },
    TRACK: { displayName: 'Routing Track', brokenLabel: 'Routing track sensor lost.', fixedLabel: 'Routing track aligned.' },
    TARGET: { displayName: 'Targeting Core', brokenLabel: 'Targeting core dark.', fixedLabel: 'Targeting core calibrated.' },
    ARMOR: { displayName: 'Armor Plating', brokenLabel: 'Armor plating servo offline.', fixedLabel: 'Armor plating responsive.' },
    HEAT: { displayName: 'Heat Coil', brokenLabel: 'Heat coil cold.', fixedLabel: 'Heat coil primed.' },
    PUMP: { displayName: 'Pump Drive', brokenLabel: 'Pump drive stalled.', fixedLabel: 'Pump drive primed.' },
    NOZZLE: { displayName: 'Pour Nozzle', brokenLabel: 'Pour nozzle stuck.', fixedLabel: 'Pour nozzle cleared.' },
    BRUSH: { displayName: 'Brush Head', brokenLabel: 'Brush head jammed.', fixedLabel: 'Brush head spinning.' },
    VAC: { displayName: 'Vacuum Intake', brokenLabel: 'Vacuum intake blocked.', fixedLabel: 'Vacuum intake clear.' },
    SENSE: { displayName: 'Dust Sensor', brokenLabel: 'Dust sensor blind.', fixedLabel: 'Dust sensor calibrated.' },
    MAG: { displayName: 'Mag Clamp', brokenLabel: 'Mag clamp offline.', fixedLabel: 'Mag clamp energized.' },
    WHEELS: { displayName: 'Wheel Drive', brokenLabel: 'Wheel drive stalled.', fixedLabel: 'Wheel drive rolling.' },
    RECLINE: { displayName: 'Recline Motor', brokenLabel: 'Recline motor locked.', fixedLabel: 'Recline motor smooth.' },
    LUMBAR: { displayName: 'Lumbar Support', brokenLabel: 'Lumbar support collapsed.', fixedLabel: 'Lumbar support engaged.' },
    POWER: { displayName: 'Power Regulator', brokenLabel: 'Power regulator unstable.', fixedLabel: 'Power regulator balanced.' },
    CANOPY: { displayName: 'Canopy Ribs', brokenLabel: 'Canopy ribs folded wrong.', fixedLabel: 'Canopy ribs tensioned.' },
    SHAFT: { displayName: 'Umbrella Shaft', brokenLabel: 'Umbrella shaft is bent.', fixedLabel: 'Umbrella shaft braced.' },
    SHADE: { displayName: 'Shade Visor', brokenLabel: 'Shade visor hanging loose.', fixedLabel: 'Shade visor aligned.' },
    LATCH: { displayName: 'Latch Hook', brokenLabel: 'Latch hook snagged.', fixedLabel: 'Latch hook snapped clear.' },
    EMOTION: { displayName: 'Emotion Regulator', brokenLabel: 'Emotion regulator drowned in tears.', fixedLabel: 'Emotion regulator stabilized.' },
    INTEL: { displayName: 'Intelligence Bus', brokenLabel: 'Intelligence bus starved.', fixedLabel: 'Intelligence bus amplified.' },
    LOGIC: { displayName: 'Logic Spine', brokenLabel: 'Logic spine desynced.', fixedLabel: 'Logic spine stabilized.' },
    BAD_JOKES: { displayName: 'Bad Jokes', brokenLabel: 'Bad joke loop is flat.', fixedLabel: 'Bad joke loop is online.' },
    BRIEF: { displayName: 'Brief Output', brokenLabel: 'Brief output is missing.', fixedLabel: 'Brief output is concise again.' },
    PROGRAMMING: { displayName: 'Programming Queue', brokenLabel: 'Programming queue stalled.', fixedLabel: 'Programming queue is moving again.' },
    QUALITY_CONTROL: { displayName: 'Quality Control', brokenLabel: 'Quality control checks are offline.', fixedLabel: 'Quality control checks are stable.' },
    WIRING: { displayName: 'Wiring Bench', brokenLabel: 'Wiring bench is disconnected.', fixedLabel: 'Wiring bench is online.' },
    CIRCUITING: { displayName: 'Circuit routing', brokenLabel: 'Circuit routing is dark.', fixedLabel: 'Circuit routing is live again.' },
    CIRCUIT_BREAKING: { displayName: 'Circuit Breaking', brokenLabel: 'Circuit breaker rig is locked up.', fixedLabel: 'Circuit breaker rig is reset.' },
    GEARING: { displayName: 'Gearing Desk', brokenLabel: 'Gearing desk is jammed.', fixedLabel: 'Gearing desk is responsive.' },
    BUS_A: { displayName: 'Bus Channel A', brokenLabel: 'Bus channel A unpowered.', fixedLabel: 'Bus channel A live.' },
    BUS_B: { displayName: 'Bus Channel B', brokenLabel: 'Bus channel B unpowered.', fixedLabel: 'Bus channel B live.' },
    BUS_C: { displayName: 'Bus Channel C', brokenLabel: 'Bus channel C unpowered.', fixedLabel: 'Bus channel C live.' },
    BUS_D: { displayName: 'Bus Channel D', brokenLabel: 'Bus channel D unpowered.', fixedLabel: 'Bus channel D live.' },
    RELAY_1: { displayName: 'Relay Sub-1', brokenLabel: 'Relay sub-1 silent.', fixedLabel: 'Relay sub-1 chattering.' },
    RELAY_2: { displayName: 'Relay Sub-2', brokenLabel: 'Relay sub-2 silent.', fixedLabel: 'Relay sub-2 chattering.' },
    RELAY_3: { displayName: 'Relay Sub-3', brokenLabel: 'Relay sub-3 silent.', fixedLabel: 'Relay sub-3 chattering.' },
});

// Generic, machine-agnostic labels we can pad output lists with when a
// stage requires more outputs than the base template provides.
const FLOW_GENERIC_PADDING_LABELS = Object.freeze([
    'BUS_A', 'BUS_B', 'BUS_C', 'BUS_D',
    'RELAY_1', 'RELAY_2', 'RELAY_3',
]);

function cloneFlowTiles(tiles) {
    if (!Array.isArray(tiles)) return [];
    return tiles.map((row) => row.map((cell) => ({ ...cell })));
}

function cloneForbiddenCells(forbidden) {
    if (!Array.isArray(forbidden)) return [];
    return forbidden.map(([x, y]) => [x, y]);
}

function cloneRepairTargets(repairTargets) {
    if (!Array.isArray(repairTargets)) return [];
    return repairTargets.map((target) => ({ ...target }));
}

function cloneFlowSources(sources) {
    if (!Array.isArray(sources)) return [];
    return sources.map((source) => ({ ...source }));
}

function cloneFlowOutputSpecs(outputSpecs) {
    if (!Array.isArray(outputSpecs)) return [];
    return outputSpecs.map((spec) => ({ ...spec }));
}

function cloneFlowWireFilters(wireFilters) {
    if (!Array.isArray(wireFilters)) return [];
    return wireFilters.map((filter) => ({ ...filter }));
}

function cloneDebugOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];
    return outputs.map((output) => String(output));
}

function humanizeFlowLabel(label) {
    return String(label || '')
        .toLowerCase()
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function createRepairTarget(label, row) {
    const metadata = FLOW_TARGET_METADATA[label] || {};
    return {
        key: label,
        label,
        row,
        displayName: metadata.displayName || humanizeFlowLabel(label),
        brokenLabel: metadata.brokenLabel || `${humanizeFlowLabel(label)} offline.`,
        fixedLabel: metadata.fixedLabel || `${humanizeFlowLabel(label)} restored.`,
        affectsDialogue: Boolean(metadata.affectsDialogue),
    };
}

function createFlowSource(key, row, powerClass = 'neutral', label = null) {
    return {
        key,
        row,
        powerClass,
        label: label || key,
    };
}

function createFlowOutputSpec(label, row, extra = {}) {
    const baseTarget = createRepairTarget(label, row);
    return {
        ...baseTarget,
        powerClass: extra.powerClass || 'neutral',
        exactFeeds: extra.exactFeeds ?? 1,
        sourceKey: extra.sourceKey || null,
        ...extra,
    };
}

function createFlowWireFilter(x, y, powerClass = 'neutral', label = null) {
    return {
        x,
        y,
        powerClass,
        label: label || String(powerClass || 'neutral').slice(0, 3).toUpperCase(),
    };
}

function getFlowOptionRows(flowPuzzleOption) {
    return Math.max(3, Number(flowPuzzleOption?.rows || FLOW_TILE_ROWS));
}

function getFlowOptionCols(flowPuzzleOption) {
    return Math.max(3, Number(flowPuzzleOption?.cols || FLOW_TILE_COLS));
}

function getPrimaryFlowSourceRow(flowPuzzleOption) {
    return Number(flowPuzzleOption?.sourceRow ?? flowPuzzleOption?.sources?.[0]?.row ?? 2);
}

function upsertFlowWireFilter(wireFilters = [], nextFilter) {
    const nextFilters = cloneFlowWireFilters(wireFilters);
    const existingIndex = nextFilters.findIndex((filter) => filter.x === nextFilter.x && filter.y === nextFilter.y);

    if (existingIndex >= 0) {
        nextFilters.splice(existingIndex, 1, {
            ...nextFilters[existingIndex],
            ...nextFilter,
        });
        return nextFilters;
    }

    nextFilters.push({ ...nextFilter });
    return nextFilters;
}

function spreadFlowRows(count, rows) {
    if (count <= 0) return [];
    if (count === 1) return [Math.floor(rows / 2)];

    const firstRow = 1;
    const lastRow = Math.max(firstRow, rows - 2);
    const span = lastRow - firstRow;

    return Array.from({ length: count }, (_value, index) => (
        Math.round(firstRow + ((span * index) / (count - 1)))
    ));
}

function createSeededRandom(seedText) {
    let seed = 0;
    const text = String(seedText || 'flow-seed');

    for (let index = 0; index < text.length; index += 1) {
        seed = ((seed * 31) + text.charCodeAt(index)) >>> 0;
    }

    return () => {
        seed = ((seed * 1664525) + 1013904223) >>> 0;
        return seed / 0x100000000;
    };
}

function carveFlowPath(tiles, sourceRow, outRow, cols, branchCol) {
    const add = (x, y, dir) => tiles[y][x]._dirs.add(dir);

    add(0, sourceRow, 'W');
    for (let x = 0; x < branchCol; x += 1) {
        add(x, sourceRow, 'E');
        add(x + 1, sourceRow, 'W');
    }

    if (outRow !== sourceRow) {
        const step = outRow < sourceRow ? -1 : 1;
        const verticalDir = outRow < sourceRow ? 'N' : 'S';
        const reverseDir = outRow < sourceRow ? 'S' : 'N';

        add(branchCol, sourceRow, verticalDir);
        let currentRow = sourceRow;
        while (currentRow + step !== outRow) {
            add(branchCol, currentRow + step, reverseDir);
            add(branchCol, currentRow + step, verticalDir);
            currentRow += step;
        }
        add(branchCol, outRow, reverseDir);
    }

    for (let x = branchCol; x < cols - 1; x += 1) {
        add(x, outRow, 'E');
        add(x + 1, outRow, 'W');
    }
    add(cols - 1, outRow, 'E');
}

function getFlowCellKey(x, y) {
    return `${x},${y}`;
}

function isFlowCellInBounds(x, y) {
    return x >= 0 && x < FLOW_TILE_COLS && y >= 0 && y < FLOW_TILE_ROWS;
}

function addFlowConnection(tiles, fromX, fromY, toX, toY) {
    const step = FLOW_CARDINAL_STEPS.find((candidate) => fromX + candidate.dx === toX && fromY + candidate.dy === toY);
    if (!step) return;

    tiles[fromY][fromX]._dirs.add(step.dir);
    tiles[toY][toX]._dirs.add(step.opposite);
}

// Adds a minimal 3-cell arch detour around a single path cell. The forbidden
// cell is placed on the arched-over path segment; players must restore flow
// by rotating tiles onto the detour. The detour creates exactly one
// alternative route (vs. the old 3x3 service loop that created many). Returns
// the bypassed cell (the natural forbidden-cell target) or null if no clean
// detour fits anywhere on the current path.
function addCompactFlowBypass(tiles, sourceRow, cols, rows, seededRandom) {
    const isEmpty = (x, y) => {
        if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
        return tiles[y][x]._dirs.size === 0;
    };
    const hasHorizontalThrough = (x, y) => {
        const cell = tiles[y]?.[x];
        if (!cell) return false;
        return cell._dirs.has('E') && cell._dirs.has('W');
    };

    // Look anywhere on the board for a cell that has horizontal flow and
    // enough empty cells directly above or below to carve a 3-cell arch.
    const candidates = [];
    for (let y = 0; y < rows; y += 1) {
        for (let x = 1; x <= cols - 2; x += 1) {
            if (!hasHorizontalThrough(x, y)) continue;
            if (!hasHorizontalThrough(x - 1, y) && !hasHorizontalThrough(x + 1, y)) continue;

            const above = y - 1;
            const below = y + 1;

            if (above >= 0
                && isEmpty(x - 1, above)
                && isEmpty(x, above)
                && isEmpty(x + 1, above)) {
                candidates.push({ x, baseY: y, detourRow: above });
            }
            if (below < rows
                && isEmpty(x - 1, below)
                && isEmpty(x, below)
                && isEmpty(x + 1, below)) {
                candidates.push({ x, baseY: y, detourRow: below });
            }
        }
    }

    if (candidates.length === 0) return null;
    const pick = candidates[Math.floor(seededRandom() * candidates.length) % candidates.length];
    const { x, baseY, detourRow } = pick;

    // Carve the arch: (x-1,baseY) ↕ (x-1,detourRow) → (x,detourRow) → (x+1,detourRow) ↕ (x+1,baseY)
    addFlowConnection(tiles, x - 1, baseY, x - 1, detourRow);
    addFlowConnection(tiles, x - 1, detourRow, x, detourRow);
    addFlowConnection(tiles, x, detourRow, x + 1, detourRow);
    addFlowConnection(tiles, x + 1, detourRow, x + 1, baseY);

    return { x, y: baseY };
}

function getFlowConnectedNeighbors(tiles, x, y) {
    const cell = tiles[y]?.[x];
    if (!cell) return [];

    return FLOW_CARDINAL_STEPS
        .filter((step) => cell._dirs.has(step.dir) && isFlowCellInBounds(x + step.dx, y + step.dy))
        .map((step) => ({ x: x + step.dx, y: y + step.dy }));
}

function cloneFlowDirGrid(tiles) {
    return tiles.map((row) => row.map((cell) => new Set(cell._dirs)));
}

function restoreFlowDirGrid(tiles, snapshot) {
    tiles.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        cell._dirs = new Set(snapshot[rowIndex][colIndex]);
    }));
}

function getFlowCandidateCells(tiles, sourceRow, outputRows, blockedSet) {
    const outputSet = new Set(outputRows);
    const candidates = [];

    tiles.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        const cellKey = getFlowCellKey(colIndex, rowIndex);
        if (blockedSet.has(cellKey)) return;
        if (colIndex === 0 && rowIndex === sourceRow) return;
        if (colIndex === FLOW_TILE_COLS - 1 && outputSet.has(rowIndex)) return;
        if (colIndex === 0 || colIndex === FLOW_TILE_COLS - 1) return;
        candidates.push({ x: colIndex, y: rowIndex, active: cell._dirs.size > 0 });
    }));

    return candidates;
}

function areFlowOutputsReachable(tiles, sourceRow, outputRows, blockedSet) {
    const startKey = getFlowCellKey(0, sourceRow);
    if (blockedSet.has(startKey)) return false;

    const queue = [{ x: 0, y: sourceRow }];
    const visited = new Set([startKey]);

    while (queue.length > 0) {
        const current = queue.shift();
        getFlowConnectedNeighbors(tiles, current.x, current.y).forEach((neighbor) => {
            const neighborKey = getFlowCellKey(neighbor.x, neighbor.y);
            if (blockedSet.has(neighborKey) || visited.has(neighborKey)) return;
            visited.add(neighborKey);
            queue.push(neighbor);
        });
    }

    return outputRows.every((row) => visited.has(getFlowCellKey(FLOW_TILE_COLS - 1, row)));
}

function findFlowBypassPath(startCell, endCell, blockedSet) {
    const startKey = getFlowCellKey(startCell.x, startCell.y);
    const endKey = getFlowCellKey(endCell.x, endCell.y);
    const queue = [startCell];
    const visited = new Set([startKey]);
    const previous = new Map();

    while (queue.length > 0) {
        const current = queue.shift();
        const currentKey = getFlowCellKey(current.x, current.y);
        if (currentKey === endKey) break;

        const neighbors = FLOW_CARDINAL_STEPS
            .map((step) => ({ x: current.x + step.dx, y: current.y + step.dy }))
            .filter((neighbor) => isFlowCellInBounds(neighbor.x, neighbor.y))
            .sort((left, right) => {
                const leftDistance = Math.abs(left.x - endCell.x) + Math.abs(left.y - endCell.y);
                const rightDistance = Math.abs(right.x - endCell.x) + Math.abs(right.y - endCell.y);
                return leftDistance - rightDistance;
            });

        neighbors.forEach((neighbor) => {
            const neighborKey = getFlowCellKey(neighbor.x, neighbor.y);
            if (blockedSet.has(neighborKey) || visited.has(neighborKey)) return;
            visited.add(neighborKey);
            previous.set(neighborKey, currentKey);
            queue.push(neighbor);
        });
    }

    if (!visited.has(endKey)) return null;

    const path = [];
    let currentKey = endKey;
    while (currentKey) {
        const [x, y] = currentKey.split(',').map(Number);
        path.unshift({ x, y });
        currentKey = previous.get(currentKey) || null;
    }

    return path;
}

function addFlowBypassForCandidate(tiles, candidate, blockedSet, sourceRow, outputRows) {
    const candidateKey = getFlowCellKey(candidate.x, candidate.y);
    const blockedWithCandidate = new Set(blockedSet);
    blockedWithCandidate.add(candidateKey);

    if (areFlowOutputsReachable(tiles, sourceRow, outputRows, blockedWithCandidate)) {
        return true;
    }

    const neighbors = getFlowConnectedNeighbors(tiles, candidate.x, candidate.y);
    if (neighbors.length !== 2) return false;

    const bypassPath = findFlowBypassPath(neighbors[0], neighbors[1], blockedWithCandidate);
    if (!bypassPath || bypassPath.length < 2) return false;

    for (let index = 0; index < bypassPath.length - 1; index += 1) {
        addFlowConnection(
            tiles,
            bypassPath[index].x,
            bypassPath[index].y,
            bypassPath[index + 1].x,
            bypassPath[index + 1].y,
        );
    }

    return areFlowOutputsReachable(tiles, sourceRow, outputRows, blockedWithCandidate);
}

function buildSafeForbiddenCells(tiles, sourceRow, outputRows, forbiddenCount, seededRandom) {
    const forbidden = [];
    const blockedSet = new Set();

    while (forbidden.length < forbiddenCount) {
        const candidates = getFlowCandidateCells(tiles, sourceRow, outputRows, blockedSet);
        if (candidates.length === 0) break;

        const orderedCandidates = [...candidates];
        for (let index = orderedCandidates.length - 1; index > 0; index -= 1) {
            const swapIndex = Math.floor(seededRandom() * (index + 1));
            [orderedCandidates[index], orderedCandidates[swapIndex]] = [orderedCandidates[swapIndex], orderedCandidates[index]];
        }
        orderedCandidates.sort((left, right) => Number(right.active) - Number(left.active));

        let placedCandidate = false;
        for (const candidate of orderedCandidates) {
            const dirSnapshot = cloneFlowDirGrid(tiles);
            if (!addFlowBypassForCandidate(tiles, candidate, blockedSet, sourceRow, outputRows)) {
                restoreFlowDirGrid(tiles, dirSnapshot);
                continue;
            }

            const candidateKey = getFlowCellKey(candidate.x, candidate.y);
            const blockedWithCandidate = new Set(blockedSet);
            blockedWithCandidate.add(candidateKey);
            if (!areFlowOutputsReachable(tiles, sourceRow, outputRows, blockedWithCandidate)) {
                restoreFlowDirGrid(tiles, dirSnapshot);
                continue;
            }
            const forbiddenCells = [...forbidden, [candidate.x, candidate.y]];
            if (!flowHasForbiddenBypassSolution(tiles, sourceRow, outputRows, forbiddenCells)) {
                restoreFlowDirGrid(tiles, dirSnapshot);
                continue;
            }

            blockedSet.add(candidateKey);
            forbidden.push([candidate.x, candidate.y]);
            placedCandidate = true;
            break;
        }

        if (!placedCandidate) break;
    }

    return forbidden;
}

function finalizeFlowTile(cell) {
    const dirs = cell._dirs;
    const bits = [dirs.has('N') ? 1 : 0, dirs.has('E') ? 1 : 0, dirs.has('S') ? 1 : 0, dirs.has('W') ? 1 : 0];
    const count = bits.reduce((total, value) => total + value, 0);

    if (count === 0) {
        cell.type = 'empty';
        cell.rotation = 0;
        return;
    }

    if (count === 4) {
        cell.type = 'cross';
        cell.rotation = 0;
        return;
    }

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

    cell.type = 'straight';
    cell.rotation = (bits[0] || bits[2]) ? 0 : 1;
}

function getFlowOrientationSets(type) {
    switch (type) {
    case 'straight':
        return [new Set(['N', 'S']), new Set(['E', 'W'])];
    case 'curve':
        return [
            new Set(['N', 'E']),
            new Set(['E', 'S']),
            new Set(['S', 'W']),
            new Set(['W', 'N']),
        ];
    case 'tee':
        return [
            new Set(['N', 'E', 'S']),
            new Set(['E', 'S', 'W']),
            new Set(['S', 'W', 'N']),
            new Set(['W', 'N', 'E']),
        ];
    case 'cross':
        return [new Set(['N', 'E', 'S', 'W'])];
    default:
        return [new Set()];
    }
}

function buildSolvedFlowTypeGrid(tiles) {
    return tiles.map((row) => row.map((cell) => {
        const solvedCell = {
            type: 'empty',
            rotation: 0,
            _dirs: new Set(cell._dirs),
        };
        finalizeFlowTile(solvedCell);
        return { type: solvedCell.type };
    }));
}

function isFlowOrientationBoundaryValid(dirs, x, y, sourceRow, outputRows) {
    const outputSet = new Set(outputRows);

    for (const step of FLOW_CARDINAL_STEPS) {
        if (!dirs.has(step.dir)) continue;
        const nx = x + step.dx;
        const ny = y + step.dy;

        if (nx < 0) {
            if (!(x === 0 && y === sourceRow && step.dir === 'W')) return false;
            continue;
        }
        if (nx >= FLOW_TILE_COLS) {
            if (!(x === FLOW_TILE_COLS - 1 && outputSet.has(y) && step.dir === 'E')) return false;
            continue;
        }
        if (ny < 0 || ny >= FLOW_TILE_ROWS) return false;
    }

    return true;
}

function flowHasForbiddenBypassSolution(tiles, sourceRow, outputRows, forbiddenCells) {
    const solvedTypes = buildSolvedFlowTypeGrid(tiles);
    const forbiddenSet = new Set((forbiddenCells || []).map(([x, y]) => getFlowCellKey(x, y)));
    const assignment = new Map();
    const domains = new Map();
    const cells = [];

    for (let y = 0; y < FLOW_TILE_ROWS; y += 1) {
        for (let x = 0; x < FLOW_TILE_COLS; x += 1) {
            const cellKey = getFlowCellKey(x, y);
            const domain = forbiddenSet.has(cellKey)
                ? [new Set()]
                : getFlowOrientationSets(solvedTypes[y][x].type)
                    .filter((dirs) => isFlowOrientationBoundaryValid(dirs, x, y, sourceRow, outputRows));

            if (domain.length === 0) return false;
            domains.set(cellKey, domain);
            cells.push({ x, y, cellKey });
        }
    }

    function neighborCanSupport(nx, ny, opposite) {
        const neighborKey = getFlowCellKey(nx, ny);
        const assignedDirs = assignment.get(neighborKey);
        if (assignedDirs) return assignedDirs.has(opposite);
        return domains.get(neighborKey).some((dirs) => dirs.has(opposite));
    }

    function search(index) {
        if (index >= cells.length) {
            const startKey = getFlowCellKey(0, sourceRow);
            const startDirs = assignment.get(startKey);
            if (!startDirs || !startDirs.has('W')) return false;

            const queue = [{ x: 0, y: sourceRow }];
            const visited = new Set([startKey]);
            while (queue.length > 0) {
                const current = queue.shift();
                const currentDirs = assignment.get(getFlowCellKey(current.x, current.y)) || new Set();
                FLOW_CARDINAL_STEPS.forEach((step) => {
                    if (!currentDirs.has(step.dir)) return;

                    const nx = current.x + step.dx;
                    const ny = current.y + step.dy;
                    if (!isFlowCellInBounds(nx, ny)) return;

                    const neighborKey = getFlowCellKey(nx, ny);
                    if (visited.has(neighborKey)) return;

                    const neighborDirs = assignment.get(neighborKey) || new Set();
                    if (!neighborDirs.has(step.opposite)) return;

                    visited.add(neighborKey);
                    queue.push({ x: nx, y: ny });
                });
            }

            return outputRows.every((row) => {
                const edgeKey = getFlowCellKey(FLOW_TILE_COLS - 1, row);
                return visited.has(edgeKey) && (assignment.get(edgeKey)?.has('E'));
            });
        }

        const { x, y, cellKey } = cells[index];
        const domain = domains.get(cellKey);
        for (const dirs of domain) {
            const leftDirs = x > 0 ? assignment.get(getFlowCellKey(x - 1, y)) : null;
            const topDirs = y > 0 ? assignment.get(getFlowCellKey(x, y - 1)) : null;
            if (leftDirs && leftDirs.has('E') !== dirs.has('W')) continue;
            if (topDirs && topDirs.has('S') !== dirs.has('N')) continue;

            let futureOk = true;
            for (const step of FLOW_CARDINAL_STEPS) {
                if (!dirs.has(step.dir)) continue;

                const nx = x + step.dx;
                const ny = y + step.dy;
                if (!isFlowCellInBounds(nx, ny)) continue;
                if (!neighborCanSupport(nx, ny, step.opposite)) {
                    futureOk = false;
                    break;
                }
            }

            if (!futureOk) continue;

            assignment.set(cellKey, dirs);
            if (search(index + 1)) return true;
            assignment.delete(cellKey);
        }

        return false;
    }

    return search(0);
}

function buildFlowOptionLayout({ sourceRow, outputs, forbiddenCount = 0, previewTitle = 'POWER BUS' }) {
    const tiles = Array.from({ length: FLOW_TILE_ROWS }, () => (
        Array.from({ length: FLOW_TILE_COLS }, () => ({ type: 'empty', rotation: 0, _dirs: new Set() }))
    ));
    const outputRows = Object.keys(outputs || {}).map(Number).sort((left, right) => left - right);
    const seededRandom = createSeededRandom(`${previewTitle}:${sourceRow}:${outputRows.join(',')}`);

    const nonTrunkOutputs = outputRows.filter((row) => row !== sourceRow);
    const availableBranchCols = [];
    for (let col = 1; col <= FLOW_TILE_COLS - 2; col += 1) availableBranchCols.push(col);
    // Pick distinct, shuffled branch columns so boards look different and no
    // two outputs share a vertical branch line.
    const shuffledCols = [...availableBranchCols].sort(() => seededRandom() - 0.5);
    const branchColByOutput = new Map();
    nonTrunkOutputs.forEach((row, index) => {
        branchColByOutput.set(row, shuffledCols[index % shuffledCols.length]);
    });

    outputRows.forEach((outRow) => {
        const branchCol = outRow === sourceRow
            ? FLOW_TILE_COLS - 1
            : branchColByOutput.get(outRow);
        carveFlowPath(tiles, sourceRow, outRow, FLOW_TILE_COLS, branchCol);
    });

    if (forbiddenCount > 0) {
        // Up to two compact arch detours — one per forbidden cell — instead of
        // the old 3x3 service loop that created multiple redundant routes.
        for (let index = 0; index < forbiddenCount; index += 1) {
            if (!addCompactFlowBypass(tiles, sourceRow, FLOW_TILE_COLS, FLOW_TILE_ROWS, seededRandom)) break;
        }
    }

    const forbidden = buildSafeForbiddenCells(tiles, sourceRow, outputRows, forbiddenCount, seededRandom);

    tiles.forEach((row) => row.forEach((cell) => {
        finalizeFlowTile(cell);
        delete cell._dirs;
    }));

    tiles.forEach((row) => row.forEach((cell) => {
        if (cell.type === 'empty' || cell.type === 'cross') return;
        if (cell.type === 'straight') {
            cell.rotation = (cell.rotation + 1) % 4;
            return;
        }

        cell.rotation = (cell.rotation + 1 + Math.floor(seededRandom() * 3)) % 4;
    }));

    return {
        tiles: cloneFlowTiles(tiles),
        forbidden: cloneForbiddenCells(forbidden),
    };
}

function buildTypedFlowOptionLayout({ sources, outputSpecs, previewTitle = 'POWER BUS', rows = FLOW_TILE_ROWS, cols = FLOW_TILE_COLS, randomFn = Math.random }) {
    const safeRows = Math.max(3, Number(rows || FLOW_TILE_ROWS));
    const safeCols = Math.max(3, Number(cols || FLOW_TILE_COLS));
    const tiles = Array.from({ length: safeRows }, () => (
        Array.from({ length: safeCols }, () => ({ type: 'empty', rotation: 0, _dirs: new Set() }))
    ));
    // Mix the live randomFn into the seed so different units get different
    // boards even on the same template; previously the seed was deterministic
    // per template which meant Day-3 boards repeated across robots.
    const seededRandom = createSeededRandom(
        `${previewTitle}:${sources.map((source) => `${source.key}:${source.row}`).join('|')}:${Math.floor(randomFn() * 1e9)}`,
    );

    // Assign each non-trunk output its own branch column. We allow occasional
    // reuse across sources so wires can criss-cross through shared trunks
    // (which forces tees/crosses and makes Day-3 boards feel like a circuit
    // rather than three independent strips).
    const bySource = new Map();
    outputSpecs.forEach((spec, index) => {
        const source = sources.find((cand) => cand.key === spec.sourceKey) || sources[index % sources.length];
        const key = source.key;
        if (!bySource.has(key)) bySource.set(key, { source, specs: [] });
        bySource.get(key).specs.push(spec);
    });
    const branchColBySpec = new Map();
    bySource.forEach(({ source, specs }) => {
        const cols = [];
        for (let col = 1; col <= safeCols - 2; col += 1) cols.push(col);
        const shuffled = cols.sort(() => seededRandom() - 0.5);
        let nextCol = 0;
        specs.forEach((spec) => {
            if (spec.row === source.row) return;
            branchColBySpec.set(spec, shuffled[nextCol % shuffled.length]);
            nextCol += 1;
        });
    });

    outputSpecs.forEach((outputSpec, index) => {
        const source = sources.find((candidate) => candidate.key === outputSpec.sourceKey) || sources[index % sources.length];
        const branchCol = outputSpec.row === source.row
            ? safeCols - 1
            : (branchColBySpec.get(outputSpec) ?? Math.min(1 + index, safeCols - 2));
        carveFlowPath(tiles, source.row, outputSpec.row, safeCols, branchCol);
    });

    tiles.forEach((row) => row.forEach((cell) => {
        finalizeFlowTile(cell);
        delete cell._dirs;
    }));

    // Scramble tile rotations so the player has real work to do. Previously
    // straights got a deterministic +1 (so every horizontal straight became
    // vertical and vice-versa, giving the "boring grid of vertical pipes"
    // look). Now every rotatable tile picks a random offset 0–3, with the
    // straight-bias removed.
    tiles.forEach((row) => row.forEach((cell) => {
        if (cell.type === 'empty' || cell.type === 'cross') return;
        cell.rotation = Math.floor(seededRandom() * 4);
    }));

    return {
        tiles: cloneFlowTiles(tiles),
        forbidden: [],
    };
}

function createFlowProgress(flowPuzzleOption) {
    const repairTargets = cloneRepairTargets(flowPuzzleOption?.repairTargets || []);
    const brokenTargets = repairTargets.map((target) => target.key);
    const inspectionFault = flowPuzzleOption?.inspectionFault ? { ...flowPuzzleOption.inspectionFault } : null;

    return {
        tiles: cloneFlowTiles(flowPuzzleOption?.tiles),
        connected: [],
        missing: [...brokenTargets],
        repairedTargets: [],
        brokenTargets,
        repairStates: repairTargets.map((target) => ({ ...target, repaired: false })),
        forbiddenUsed: false,
        completed: false,
        dayStage: Number(flowPuzzleOption?.dayStage || 1),
        sources: cloneFlowSources(flowPuzzleOption?.sources),
        outputSpecs: cloneFlowOutputSpecs(flowPuzzleOption?.outputSpecs),
        inspectionFault,
        reviewed: false,
        scrapRequired: Boolean(inspectionFault),
        scrapKind: inspectionFault?.kind || null,
        scrapStatus: inspectionFault?.status || null,
        scrapReason: inspectionFault?.reason || null,
        outputFeeds: {},
        symptoms: inspectionFault
            ? [inspectionFault.reason]
            : repairTargets.map((target) => target.brokenLabel),
        flags: inspectionFault?.type ? [inspectionFault.type] : [],
    };
}

function cloneFlowProgress(progress) {
    if (!progress) return null;

    return {
        ...progress,
        tiles: cloneFlowTiles(progress.tiles),
        connected: Array.isArray(progress.connected) ? [...progress.connected] : [],
        missing: Array.isArray(progress.missing) ? [...progress.missing] : [],
        repairedTargets: Array.isArray(progress.repairedTargets) ? [...progress.repairedTargets] : [],
        brokenTargets: Array.isArray(progress.brokenTargets) ? [...progress.brokenTargets] : [],
        repairStates: cloneRepairTargets(progress.repairStates),
        symptoms: Array.isArray(progress.symptoms) ? [...progress.symptoms] : [],
        flags: Array.isArray(progress.flags) ? [...progress.flags] : [],
        dayStage: Number(progress.dayStage || 1),
        sources: cloneFlowSources(progress.sources),
        outputSpecs: cloneFlowOutputSpecs(progress.outputSpecs),
        inspectionFault: progress.inspectionFault ? { ...progress.inspectionFault } : null,
        reviewed: Boolean(progress.reviewed),
        scrapRequired: Boolean(progress.scrapRequired),
        scrapKind: progress.scrapKind || null,
        scrapStatus: progress.scrapStatus || null,
        scrapReason: progress.scrapReason || null,
        outputFeeds: progress.outputFeeds
            ? Object.fromEntries(
                Object.entries(progress.outputFeeds).map(([key, feeds]) => [
                    key,
                    Array.isArray(feeds) ? feeds.map((feed) => ({ ...feed })) : [],
                ])
            )
            : {},
    };
}

const createFlowPuzzleOption = ({
    sourceRow,
    outputs,
    forbiddenCount = 0,
    impossible = false,
    previewTitle = 'POWER BUS',
    tiles = null,
    forbidden = null,
    /** Extra locked/forbidden cells merged after layout (e.g. cry baby: block tile beside EMOTION). */
    extraForbidden = null,
    repairTargets = null,
    inspectionFault = null,
    rows = FLOW_TILE_ROWS,
    cols = FLOW_TILE_COLS,
    wireFilters = [],
}) => {
    const resolvedLayout = Array.isArray(tiles)
        ? {
            tiles: cloneFlowTiles(tiles),
            forbidden: cloneForbiddenCells(forbidden),
        }
        : buildFlowOptionLayout({ sourceRow, outputs, forbiddenCount, previewTitle });
    if (Array.isArray(extraForbidden) && extraForbidden.length > 0) {
        const merged = new Map(
            (resolvedLayout.forbidden || []).map(([x, y]) => [`${x},${y}`, [x, y]]),
        );
        extraForbidden.forEach(([x, y]) => merged.set(`${x},${y}`, [Number(x), Number(y)]));
        resolvedLayout.forbidden = Array.from(merged.values());
    }
    const resolvedRepairTargets = Array.isArray(repairTargets) && repairTargets.length > 0
        ? cloneRepairTargets(repairTargets)
        : Object.entries(outputs || {}).map(([row, label]) => createRepairTarget(label, Number(row)));

    return {
        sourceRow,
        outputs,
        forbiddenCount,
        impossible,
        previewTitle,
        rows: Math.max(3, Number(rows || resolvedLayout.tiles.length || FLOW_TILE_ROWS)),
        cols: Math.max(3, Number(cols || resolvedLayout.tiles?.[0]?.length || FLOW_TILE_COLS)),
        tiles: resolvedLayout.tiles,
        forbidden: resolvedLayout.forbidden,
        repairTargets: resolvedRepairTargets,
        wireFilters: cloneFlowWireFilters(wireFilters),
        inspectionFault: inspectionFault ? { ...inspectionFault } : null,
    };
};

function getFirstFlowLeadCell(flowPuzzleOption) {
    const leadRow = getPrimaryFlowSourceRow(flowPuzzleOption);
    const leadCol = Math.min(Math.max(1, 1), Math.max(1, getFlowOptionCols(flowPuzzleOption) - 2));
    const leadTile = flowPuzzleOption?.tiles?.[leadRow]?.[leadCol];

    if (leadTile && leadTile.type && leadTile.type !== 'empty') {
        return { x: leadCol, y: leadRow };
    }

    const fallbackCandidate = collectFlowInspectionCandidates(flowPuzzleOption)
        .sort((left, right) => (
            left.x - right.x
            || Math.abs(left.y - leadRow) - Math.abs(right.y - leadRow)
        ))[0];

    return fallbackCandidate || null;
}

function findFlowWireFilterCell(flowPuzzleOption, targetRow, randomFn = Math.random) {
    const cols = getFlowOptionCols(flowPuzzleOption);
    const rowCells = (flowPuzzleOption?.tiles?.[targetRow] || [])
        .map((cell, x) => ({ x, cell }))
        .filter(({ x, cell }) => x > 0 && x < cols - 1 && cell && cell.type && cell.type !== 'empty');

    if (rowCells.length === 0) {
        return getFirstFlowLeadCell(flowPuzzleOption);
    }

    // Previously we always pinned the filter to the first non-empty cell of
    // the row (or the last cell when the target shared the source row), which
    // made every Day-2 board on the same machine layout place its filter at
    // an identical column. Picking randomly per unit keeps the filter on a
    // valid pipe cell while letting different runs sit in different spots.
    const selectedCell = rowCells[Math.floor(randomFn() * rowCells.length)] || rowCells[0];
    return selectedCell ? { x: selectedCell.x, y: targetRow } : null;
}

function createMissingLeadFault(flowPuzzleOption) {
    const leadCell = getFirstFlowLeadCell(flowPuzzleOption);
    if (!leadCell) return null;

    if (flowPuzzleOption?.tiles?.[leadCell.y]?.[leadCell.x]) {
        flowPuzzleOption.tiles[leadCell.y][leadCell.x] = { type: 'empty', rotation: 0, locked: true };
    }
    flowPuzzleOption.wireFilters = cloneFlowWireFilters(flowPuzzleOption.wireFilters)
        .filter((filter) => filter.x !== leadCell.x || filter.y !== leadCell.y);

    return {
        ...leadCell,
        type: 'missing-wire',
        kind: 'unsalvageable',
        status: 'FIRST WIRE MISSING',
        reason: 'The first live wire is physically missing from the board. Power can never leave the source. Scrap the unit.',
    };
}

function createRedWireFault(flowPuzzleOption) {
    const leadCell = getFirstFlowLeadCell(flowPuzzleOption);
    if (!leadCell) return null;

    flowPuzzleOption.wireFilters = upsertFlowWireFilter(
        flowPuzzleOption.wireFilters,
        createFlowWireFilter(leadCell.x, leadCell.y, 'red', 'RED')
    );

    return {
        ...leadCell,
        type: 'red-wire',
        kind: 'unsalvageable',
        status: 'RED DISCHARGE WIRE',
        reason: 'The main line is forced through a red discharge wire. There is no safe path through this machine. Scrap the unit.',
    };
}

function createCracklingOutputFault(outputSpec) {
    if (!outputSpec) return null;

    return {
        targetKey: outputSpec.key,
        row: outputSpec.row,
        type: 'crackling-module',
        kind: 'unsalvageable',
        status: 'CRACKLING OUTPUT MODULE',
        reason: `${outputSpec.displayName || humanizeFlowLabel(outputSpec.label)} is demanding a red crackling feed. The unit is unsafe by design. Scrap the unit.`,
    };
}

function buildDayTwoWireFilters(flowPuzzleOption, outputSpecs, randomFn = Math.random) {
    return outputSpecs
        .map((outputSpec) => {
            const filterCell = findFlowWireFilterCell(flowPuzzleOption, outputSpec.row, randomFn);
            if (!filterCell) return null;

            return createFlowWireFilter(
                filterCell.x,
                filterCell.y,
                outputSpec.powerClass,
                outputSpec.powerClass === 'green' ? 'GRN' : 'ORG'
            );
        })
        .filter(Boolean)
        .reduce((filters, filter) => upsertFlowWireFilter(filters, filter), []);
}

function collectFlowInspectionCandidates(flowPuzzleOption) {
    const sourceRows = new Set((flowPuzzleOption?.sources || []).map((source) => source.row));
    const outputRows = new Set((flowPuzzleOption?.outputSpecs || Object.keys(flowPuzzleOption?.outputs || {}).map(Number)).map((spec) => Number(spec?.row ?? spec)));
    const blocked = new Set((flowPuzzleOption?.forbidden || []).map(([x, y]) => `${x},${y}`));
    const cols = getFlowOptionCols(flowPuzzleOption);
    const candidates = [];

    (flowPuzzleOption?.tiles || []).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!cell || cell.type === 'empty') return;
            if (blocked.has(`${colIndex},${rowIndex}`)) return;
            if (colIndex === 0 && sourceRows.has(rowIndex)) return;
            if (colIndex === cols - 1 && outputRows.has(rowIndex)) return;
            candidates.push({ x: colIndex, y: rowIndex });
        });
    });

    return candidates;
}

// Pad / trim the base target list so a staged Flow puzzle has the right
// number of outputs for its day. Existing targets are preserved (they're
// thematic per-machine); the padding draws from a generic label pool
// (BUS_A, RELAY_1, etc.) when more outputs are required than the base
// template carries.
function expandFlowTargets({ baseTargets, minCount, maxCount, totalRows, takenRows = [], randomFn = Math.random }) {
    const desiredCount = Math.min(
        maxCount,
        Math.max(minCount, minCount + Math.floor(randomFn() * (maxCount - minCount + 1)))
    );

    const result = baseTargets.slice(0, desiredCount).map((target) => ({ ...target }));
    const usedLabels = new Set(result.map((target) => target.label));
    const usedRows = new Set([
        ...takenRows,
        ...result.map((target) => target.row).filter((row) => row >= 0 && row < totalRows),
    ]);

    const candidatePool = FLOW_GENERIC_PADDING_LABELS.filter((label) => !usedLabels.has(label));
    while (result.length < desiredCount && candidatePool.length > 0) {
        const labelIndex = Math.floor(randomFn() * candidatePool.length);
        const label = candidatePool.splice(labelIndex, 1)[0];

        // Pick a free row. Prefer rows that aren't already used.
        const freeRows = [];
        for (let row = 0; row < totalRows; row += 1) {
            if (!usedRows.has(row)) freeRows.push(row);
        }
        const row = freeRows.length > 0
            ? freeRows[Math.floor(randomFn() * freeRows.length)]
            : Math.floor(randomFn() * totalRows);

        usedRows.add(row);
        result.push(createRepairTarget(label, row));
    }

    // Reassign rows for any base target whose original row falls outside the
    // (possibly resized) grid.
    return result.map((target) => {
        if (target.row >= 0 && target.row < totalRows) return target;
        const freeRows = [];
        for (let row = 0; row < totalRows; row += 1) {
            if (!usedRows.has(row)) freeRows.push(row);
        }
        const row = freeRows.length > 0
            ? freeRows[Math.floor(randomFn() * freeRows.length)]
            : Math.floor(randomFn() * totalRows);
        usedRows.add(row);
        return { ...target, row };
    });
}

function applyFlowStageToOption(flowPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!flowPuzzleOption) return null;

    const baseTargets = cloneRepairTargets(flowPuzzleOption.repairTargets)
        .sort((left, right) => left.row - right.row);
    const sourceRow = getPrimaryFlowSourceRow(flowPuzzleOption);

    if (stage <= 1) {
        // Day 1: 1 input, 2-3 outputs, 5x5 grid.
        const rows = getFlowOptionRows(flowPuzzleOption);
        const cols = getFlowOptionCols(flowPuzzleOption);
        const sources = [createFlowSource('main', sourceRow, 'neutral', 'PWR')];
        const targets = expandFlowTargets({
            baseTargets,
            minCount: 2,
            maxCount: 3,
            totalRows: rows,
            takenRows: [sourceRow],
            randomFn,
        });
        const outputSpecs = targets.map((target) => createFlowOutputSpec(target.label, target.row, {
            ...target,
            powerClass: 'neutral',
            sourceKey: 'main',
        }));

        // If we expanded beyond the base template's outputs we need to
        // re-carve the layout so the new outputs actually have a path.
        const needsRecarve = outputSpecs.length !== baseTargets.length
            || outputSpecs.some((spec, idx) => spec.row !== baseTargets[idx]?.row);
        let tiles = flowPuzzleOption.tiles;
        let forbidden = flowPuzzleOption.forbidden;
        if (needsRecarve || !Array.isArray(tiles) || tiles.length === 0) {
            const layout = buildTypedFlowOptionLayout({
                sources,
                outputSpecs,
                previewTitle: `${flowPuzzleOption.previewTitle || 'POWER BUS'}:day1`,
                rows,
                cols,
                randomFn,
            });
            tiles = layout.tiles;
            forbidden = layout.forbidden;
        }

        const stagedOption = {
            ...flowPuzzleOption,
            dayStage: 1,
            rows,
            cols,
            sourceRow: sources[0].row,
            sources,
            outputSpecs,
            repairTargets: cloneRepairTargets(outputSpecs),
            tiles,
            forbidden: forbidden || [],
            wireFilters: [],
            inspectionFault: null,
        };

        if (flowPuzzleOption?.inspectionFault) {
            stagedOption.inspectionFault = { ...flowPuzzleOption.inspectionFault };
            return stagedOption;
        }

        if (randomFn() < 0.3) {
            stagedOption.inspectionFault = createMissingLeadFault(stagedOption);
        }

        return stagedOption;
    }

    if (stage === 2) {
        // Day 2: 2 inputs (neutral + green or orange), 3-4 outputs, 7x7 grid.
        const rows = 7;
        const cols = 7;
        const auxClass = randomFn() < 0.5 ? 'green' : 'orange';
        const auxLabel = auxClass === 'green' ? 'GRN' : 'ORG';
        // Source rows: top half + bottom half so they're visually separated.
        const mainRow = 1 + Math.floor(randomFn() * 2);            // 1 or 2
        const auxRow = 4 + Math.floor(randomFn() * 2);             // 4 or 5
        const sources = [
            createFlowSource('main', mainRow, 'neutral', 'PWR'),
            createFlowSource(auxClass, auxRow, auxClass, auxLabel),
        ];

        const targets = expandFlowTargets({
            baseTargets,
            minCount: 3,
            maxCount: 4,
            totalRows: rows,
            takenRows: [mainRow, auxRow],
            randomFn,
        });

        // Spread output power classes between the two sources. Always include
        // at least one of each so the player has to use both inputs.
        const classCycle = ['neutral', auxClass];
        const outputSpecs = targets.map((target, index) => {
            const powerClass = classCycle[index % classCycle.length];
            return createFlowOutputSpec(target.label, target.row, {
                ...target,
                powerClass,
                sourceKey: powerClass === 'neutral' ? 'main' : auxClass,
            });
        });
        // Guarantee both classes appear (above index-mod logic already does
        // this for >=2 outputs, but be defensive).
        if (!outputSpecs.some((spec) => spec.powerClass === 'neutral')) {
            outputSpecs[0].powerClass = 'neutral';
            outputSpecs[0].sourceKey = 'main';
        }
        if (!outputSpecs.some((spec) => spec.powerClass === auxClass)) {
            outputSpecs[outputSpecs.length - 1].powerClass = auxClass;
            outputSpecs[outputSpecs.length - 1].sourceKey = auxClass;
        }

        const layout = buildTypedFlowOptionLayout({
            sources,
            outputSpecs,
            previewTitle: `${flowPuzzleOption.previewTitle || 'POWER BUS'}:day2`,
            rows,
            cols,
            randomFn,
        });

        const stagedOption = {
            ...flowPuzzleOption,
            rows,
            cols,
            sourceRow: sources[0].row,
            forbiddenCount: 0,
            forbidden: layout.forbidden,
            tiles: layout.tiles,
            dayStage: 2,
            stageResultKind: 'repairable',
            sources,
            outputSpecs,
            repairTargets: cloneRepairTargets(outputSpecs),
            wireFilters: [],
            inspectionFault: null,
        };

        if (flowPuzzleOption?.inspectionFault) {
            stagedOption.inspectionFault = { ...flowPuzzleOption.inspectionFault };
            return stagedOption;
        }

        if (randomFn() < 0.34) {
            const visualStage = pickUnlockedScrapStage(stage, randomFn);
            if (visualStage <= 1) {
                stagedOption.inspectionFault = createMissingLeadFault(stagedOption);
            } else {
                stagedOption.inspectionFault = randomFn() < 0.5
                    ? createMissingLeadFault(stagedOption)
                    : createRedWireFault(stagedOption);
            }
        }

        return stagedOption;
    }

    // Day 3: 3 inputs, 4-5 outputs, 9x9 grid.
    const rows = 9;
    const cols = 9;
    // Sources sit at top / middle / bottom on different rows from each
    // other so they're spread across the grid.
    const sources = [
        createFlowSource('main', 1, 'neutral', 'PWR'),
        createFlowSource('green', Math.floor(rows / 2), 'green', 'GRN'),
        createFlowSource('orange', rows - 2, 'orange', 'ORG'),
    ];
    const sourceRowSet = new Set(sources.map((source) => source.row));

    // Pad/trim base targets to 4-5 outputs.
    const dayThreeTargets = expandFlowTargets({
        baseTargets,
        minCount: 4,
        maxCount: 5,
        totalRows: rows,
        takenRows: Array.from(sourceRowSet),
        randomFn,
    });

    // Build candidate output rows that DON'T overlap with source rows so the
    // path always has a vertical leg, then shuffle them per unit.
    const candidateOutputRows = [];
    for (let row = 0; row < rows; row += 1) {
        if (!sourceRowSet.has(row)) candidateOutputRows.push(row);
    }
    if (candidateOutputRows.length < dayThreeTargets.length) {
        for (let row = 0; row < rows && candidateOutputRows.length < dayThreeTargets.length; row += 1) {
            if (!candidateOutputRows.includes(row)) candidateOutputRows.push(row);
        }
    }
    const shuffledOutputRows = [...candidateOutputRows].sort(() => randomFn() - 0.5);
    const outputRows = shuffledOutputRows
        .slice(0, dayThreeTargets.length)
        .sort((left, right) => left - right);

    // Distribute the three power classes across 4-5 outputs. Always
    // include all three classes so every source must be used; remaining
    // slots are randomly assigned to maintain variety.
    const powerCycle = ['neutral', 'green', 'orange'];
    const shuffledClasses = (() => {
        const required = [...powerCycle].sort(() => randomFn() - 0.5);
        const result = required.slice(0, Math.min(dayThreeTargets.length, required.length));
        while (result.length < dayThreeTargets.length) {
            result.push(powerCycle[Math.floor(randomFn() * powerCycle.length)]);
        }
        // Shuffle so the three required classes aren't always in the same slots.
        return result.sort(() => randomFn() - 0.5);
    })();

    const outputSpecs = dayThreeTargets.map((target, index) => {
        const powerClass = shuffledClasses[index];
        return createFlowOutputSpec(target.label, outputRows[index], {
            ...target,
            row: outputRows[index],
            powerClass,
            sourceKey: powerClass === 'neutral' ? 'main' : powerClass,
        });
    });
    const layout = buildTypedFlowOptionLayout({
        sources,
        outputSpecs,
        previewTitle: `${flowPuzzleOption.previewTitle || 'POWER BUS'}:day3`,
        rows,
        cols,
        randomFn,
    });
    const stagedOption = {
        ...flowPuzzleOption,
        rows,
        cols,
        sourceRow: sources[0].row,
        forbiddenCount: 0,
        forbidden: layout.forbidden,
        tiles: layout.tiles,
        repairTargets: cloneRepairTargets(outputSpecs),
        sources,
        outputSpecs,
        wireFilters: [],
        dayStage: 3,
        stageResultKind: 'hazard',
        inspectionFault: null,
    };

    if (flowPuzzleOption?.inspectionFault) {
        stagedOption.inspectionFault = { ...flowPuzzleOption.inspectionFault };
        return stagedOption;
    }

    if (outputSpecs.length > 0 && randomFn() < 0.28) {
        const visualStage = pickUnlockedScrapStage(stage, randomFn);
        if (visualStage <= 1) {
            stagedOption.inspectionFault = createMissingLeadFault(stagedOption);
        } else if (visualStage === 2) {
            stagedOption.inspectionFault = randomFn() < 0.5
                ? createMissingLeadFault(stagedOption)
                : createRedWireFault(stagedOption);
        } else {
            const hazardousOutput = pickRandomEntry(outputSpecs, randomFn) || outputSpecs[0];
            hazardousOutput.powerClass = 'red';
            hazardousOutput.sourceKey = null;
            stagedOption.outputSpecs = cloneFlowOutputSpecs(outputSpecs);
            stagedOption.repairTargets = cloneRepairTargets(outputSpecs);
            stagedOption.inspectionFault = createCracklingOutputFault(hazardousOutput);
        }
    }

    return stagedOption;
}

const createMiniDisplay = ({
    artX,
    artY,
    artScale = 0.56,
    artAngle = 0,
    gridPreview,
    flowPreview,
    gearPreview = { x: 88, y: 154, width: 62, height: 36, label: 'GEAR' },
    codePreview = { x: 86, y: 24, width: 74, height: 22, label: 'CODE' },
}) => ({
    artX,
    artY,
    artScale,
    artAngle,
    gridPreview: { ...gridPreview },
    flowPreview: { ...flowPreview },
    gearPreview: { ...gearPreview },
    codePreview: { ...codePreview },
});

const createGearPiece = (type, row, col, extra = {}) => ({
    type,
    row,
    col,
    movable: extra.movable !== false,
    ...extra,
});

const createGearPuzzleOption = ({
    board,
    pieces,
    previewTitle = 'GEAR TRAIN',
    description = 'Restore the transmission path until the sink gear starts turning.',
}) => ({
    board,
    pieces,
    previewTitle,
    description,
});

function collectGearInspectionCandidates(gearPuzzleOption) {
    const candidates = [];
    const occupancy = new Set((gearPuzzleOption?.pieces || []).map((piece) => `${piece.row}:${piece.col}`));

    (gearPuzzleOption?.board || []).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isGearType(cell) && cell !== GEAR_CODES.RUSTED) return;
            if (cell === GEAR_CODES.SOURCE || cell === GEAR_CODES.SINK) return;
            if (occupancy.has(`${rowIndex}:${colIndex}`)) return;
            candidates.push({ row: rowIndex, col: colIndex, source: 'board' });
        });
    });

    (gearPuzzleOption?.pieces || []).forEach((piece) => {
        if (!isGearType(piece.type) && piece.type !== GEAR_CODES.RUSTED) return;
        if (piece.type === GEAR_CODES.SOURCE || piece.type === GEAR_CODES.SINK) return;
        candidates.push({ row: piece.row, col: piece.col, source: 'piece', pieceId: piece.id || null });
    });

    return candidates;
}

function isCandidateMovableGearPiece(piece) {
    if (!piece || piece.movable === false) return false;
    if (piece.role === 'deadlock-clamp' || piece.role === 'decoy') return false;
    if (piece.type === GEAR_CODES.SOURCE || piece.type === GEAR_CODES.SINK) return false;
    if (piece.type === GEAR_CODES.RUSTED) return false;
    return isGearType(piece.type);
}

function findOpenGearCells(board, pieces) {
    const occupied = new Set((pieces || []).map((piece) => `${piece.row}:${piece.col}`));
    const cells = [];
    for (let rowIndex = 0; rowIndex < (board?.length || 0); rowIndex += 1) {
        for (let colIndex = 0; colIndex < (board[rowIndex]?.length || 0); colIndex += 1) {
            if (board[rowIndex][colIndex] !== GEAR_CODES.EMPTY) continue;
            if (occupied.has(`${rowIndex}:${colIndex}`)) continue;
            cells.push({ row: rowIndex, col: colIndex });
        }
    }
    return cells;
}

// Shuffle the movable, player-installable gear pieces among candidate cells
// so the puzzle never spawns pre-solved. We derange their target positions
// when there are 2+ candidates, or displace the lone candidate to an empty
// cell when there's only one. Source/sink/rust/decoy/clamp pieces are left
// where the puzzle author placed them.
function displaceMovableGearPieces(stagedOption, randomFn = Math.random) {
    if (!stagedOption?.pieces || !stagedOption.board) return;

    const candidates = stagedOption.pieces.filter(isCandidateMovableGearPiece);
    if (candidates.length === 0) return;

    if (candidates.length === 1) {
        const openCells = findOpenGearCells(stagedOption.board, stagedOption.pieces);
        if (openCells.length === 0) return;
        const target = openCells[Math.floor(randomFn() * openCells.length)] || openCells[0];
        candidates[0].row = target.row;
        candidates[0].col = target.col;
        return;
    }

    const originalPositions = candidates.map((piece) => ({ row: piece.row, col: piece.col }));
    let derangement = null;
    for (let attempt = 0; attempt < 16; attempt += 1) {
        const indices = originalPositions.map((_, index) => index);
        for (let i = indices.length - 1; i > 0; i -= 1) {
            const j = Math.floor(randomFn() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        if (indices.every((value, index) => value !== index)) {
            derangement = indices;
            break;
        }
    }

    if (!derangement) {
        // Cycle shift: piece i takes piece (i+1)%n's slot.
        derangement = originalPositions.map((_, index) => (index + 1) % originalPositions.length);
    }

    derangement.forEach((sourceIndex, targetIndex) => {
        const target = originalPositions[sourceIndex];
        candidates[targetIndex].row = target.row;
        candidates[targetIndex].col = target.col;
    });
}

function findFirstOpenGearCell(board, pieces) {
    const occupied = new Set((pieces || []).map((piece) => `${piece.row}:${piece.col}`));

    for (let rowIndex = 0; rowIndex < (board?.length || 0); rowIndex += 1) {
        for (let colIndex = 0; colIndex < (board[rowIndex]?.length || 0); colIndex += 1) {
            if (board[rowIndex][colIndex] !== GEAR_CODES.EMPTY) continue;
            if (occupied.has(`${rowIndex}:${colIndex}`)) continue;
            return { row: rowIndex, col: colIndex };
        }
    }

    return null;
}

function gearOptionHasRustedContent(gearPuzzleOption) {
    const boardHasRust = (gearPuzzleOption?.board || []).some((row) => row.some((cell) => cell === GEAR_CODES.RUSTED));
    const pieceHasRust = (gearPuzzleOption?.pieces || []).some((piece) => piece.type === GEAR_CODES.RUSTED);
    return boardHasRust || pieceHasRust;
}

function sanitizeGearOptionForStageOne(gearPuzzleOption) {
    if (!gearPuzzleOption) return null;

    return {
        ...gearPuzzleOption,
        board: cloneGearBoard(gearPuzzleOption.board).map((row) => row.map((cell) => (
            cell === GEAR_CODES.RUSTED ? GEAR_CODES.FULL : cell
        ))),
        pieces: cloneGearPieces(gearPuzzleOption.pieces).map((piece) => (
            piece.type === GEAR_CODES.RUSTED
                ? { ...piece, type: GEAR_CODES.FULL }
                : piece
        )),
    };
}

function collectGearDriveCandidates(gearPuzzleOption) {
    const candidates = [];

    (gearPuzzleOption?.board || []).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (cell !== GEAR_CODES.SOURCE && cell !== GEAR_CODES.SINK) return;
            candidates.push({
                row: rowIndex,
                col: colIndex,
                source: 'board',
                driveType: cell === GEAR_CODES.SOURCE ? 'source' : 'sink',
            });
        });
    });

    (gearPuzzleOption?.pieces || []).forEach((piece) => {
        if (piece.type !== GEAR_CODES.SOURCE && piece.type !== GEAR_CODES.SINK) return;
        candidates.push({
            row: piece.row,
            col: piece.col,
            source: 'piece',
            pieceId: piece.id || null,
            driveType: piece.type === GEAR_CODES.SOURCE ? 'source' : 'sink',
        });
    });

    return candidates;
}

function createCrackedDriveFault(gearPuzzleOption, randomFn = Math.random) {
    const target = pickRandomEntry(collectGearDriveCandidates(gearPuzzleOption), randomFn);
    if (!target) return null;

    const isSource = target.driveType === 'source';
    return {
        ...target,
        type: 'cracked-drive',
        kind: 'unsalvageable',
        status: isSource ? 'CRACKED INPUT AXLE' : 'CRACKED OUTPUT AXLE',
        reason: isSource
            ? 'The input axle is cracked in half and cannot turn. Scrap the unit.'
            : 'The output axle is cracked in half and cannot turn. Scrap the unit.',
        blocksDrive: true,
    };
}

function createVirusGearFault(gearPuzzleOption, randomFn = Math.random) {
    const movablePieceCandidates = cloneGearPieces(gearPuzzleOption?.pieces).filter((piece) => (
        piece.movable !== false
        && isGearType(piece.type)
        && piece.type !== GEAR_CODES.SOURCE
        && piece.type !== GEAR_CODES.SINK
        && piece.type !== GEAR_CODES.RUSTED
        && piece.role !== 'deadlock-clamp'
    )).map((piece) => ({
        row: piece.row,
        col: piece.col,
        source: 'piece',
        pieceId: piece.id || null,
    }));

    const allCandidates = collectGearInspectionCandidates(gearPuzzleOption).filter((candidate) => {
        if (candidate.source !== 'piece') return true;
        const piece = (gearPuzzleOption?.pieces || []).find((entry) => (entry.id || null) === (candidate.pieceId || null));
        return piece?.role !== 'deadlock-clamp' && piece?.type !== GEAR_CODES.RUSTED;
    });

    const target = pickRandomEntry(movablePieceCandidates.length > 0 ? movablePieceCandidates : allCandidates, randomFn);
    if (!target) return null;

    return {
        ...target,
        type: 'virus-gear',
        kind: 'compliance',
        status: 'VIRUS GEAR',
        reason: 'A virus-marked drivetrain component cannot remain on the line. Scrap the unit.',
    };
}

function createSparkInstabilityFault(gearPuzzleOption, randomFn = Math.random) {
    const candidates = [];

    (gearPuzzleOption?.board || []).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isGearType(cell) && cell !== GEAR_CODES.RUSTED) return;
            candidates.push({ row: rowIndex, col: colIndex, source: 'board' });
        });
    });

    cloneGearPieces(gearPuzzleOption?.pieces).forEach((piece) => {
        if ((!isGearType(piece.type) && piece.type !== GEAR_CODES.RUSTED) || piece.role === 'deadlock-clamp') return;
        candidates.push({
            row: piece.row,
            col: piece.col,
            source: 'piece',
            pieceId: piece.id || null,
        });
    });

    const target = pickRandomEntry(candidates, randomFn);
    if (!target) return null;

    return {
        ...target,
        type: 'spark-instability',
        kind: 'hazard',
        status: 'SPARK INSTABILITY',
        reason: 'Red spark instability indicates unsafe drivetrain discharge. Scrap the unit immediately.',
    };
}

function applyGearStageToOption(gearPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!gearPuzzleOption) return null;

    const baseOption = stage <= 1
        ? sanitizeGearOptionForStageOne(gearPuzzleOption)
        : gearPuzzleOption;

    const stagedOption = {
        ...baseOption,
        board: cloneGearBoard(baseOption.board),
        pieces: cloneGearPieces(baseOption.pieces),
        dayStage: stage,
        // Rust always locks the train on contact regardless of day —
        // a corroded gear in the drive is always a scrap-or-fix decision,
        // never a "valid part you can leave alone".
        allowRustedGears: false,
        useDeadlockClamp: stage >= 3,
        inspectionFault: null,
    };

    if (stage >= 3 && !stagedOption.pieces.some((piece) => piece.role === 'deadlock-clamp')) {
        const clampCell = findFirstOpenGearCell(stagedOption.board, stagedOption.pieces);
        if (clampCell) {
            stagedOption.pieces.push(createGearPiece(GEAR_CODES.MOVABLE_WALL, clampCell.row, clampCell.col, {
                role: 'deadlock-clamp',
                label: 'CLAMP',
            }));
        }
    }

    if (stage === 2) {
        // Day 2: 1-2 decoy idler gears so the player has to choose
        // which loose part to install vs. ignore.
        const decoyCount = 1 + (randomFn() < 0.5 ? 1 : 0);
        for (let index = 0; index < decoyCount; index += 1) {
            const decoyCell = findFirstOpenGearCell(stagedOption.board, stagedOption.pieces);
            if (!decoyCell) break;
            stagedOption.pieces.push(createGearPiece(GEAR_CODES.FULL, decoyCell.row, decoyCell.col, {
                role: 'decoy',
                label: 'IDLER',
            }));
        }
    }

    if (stage >= 3) {
        // Day 3: 2-3 deadlock clamps + 1-2 decoy idlers. Denser board,
        // more "wrong" choices the player has to filter out.
        const targetClamps = 2 + (randomFn() < 0.45 ? 1 : 0);
        let clampCount = stagedOption.pieces.filter((p) => p.role === 'deadlock-clamp').length;
        while (clampCount < targetClamps) {
            const clampCell = findFirstOpenGearCell(stagedOption.board, stagedOption.pieces);
            if (!clampCell) break;
            stagedOption.pieces.push(createGearPiece(GEAR_CODES.MOVABLE_WALL, clampCell.row, clampCell.col, {
                role: 'deadlock-clamp',
                label: 'CLAMP',
            }));
            clampCount += 1;
        }

        const decoyCount = 1 + (randomFn() < 0.5 ? 1 : 0);
        for (let index = 0; index < decoyCount; index += 1) {
            const decoyCell = findFirstOpenGearCell(stagedOption.board, stagedOption.pieces);
            if (!decoyCell) break;
            stagedOption.pieces.push(createGearPiece(GEAR_CODES.FULL, decoyCell.row, decoyCell.col, {
                role: 'decoy',
                label: 'IDLER',
            }));
        }
    }

    if (stage === 1 && randomFn() < 0.28) {
        stagedOption.inspectionFault = createCrackedDriveFault(stagedOption, randomFn);
    } else if (stage === 2 && randomFn() < 0.34) {
        const visualStage = pickUnlockedScrapStage(stage, randomFn);
        if (visualStage <= 1) {
            stagedOption.inspectionFault = createCrackedDriveFault(stagedOption, randomFn);
        } else {
            const primaryFault = randomFn() < 0.5
                ? createCrackedDriveFault(stagedOption, randomFn)
                : createVirusGearFault(stagedOption, randomFn);
            stagedOption.inspectionFault = primaryFault
                || createVirusGearFault(stagedOption, randomFn)
                || createCrackedDriveFault(stagedOption, randomFn);
        }
    } else if (stage >= 3 && randomFn() < 0.24) {
        const visualStage = pickUnlockedScrapStage(stage, randomFn);
        if (visualStage <= 1) {
            stagedOption.inspectionFault = createCrackedDriveFault(stagedOption, randomFn);
        } else if (visualStage === 2) {
            stagedOption.inspectionFault = (randomFn() < 0.5
                ? createCrackedDriveFault(stagedOption, randomFn)
                : createVirusGearFault(stagedOption, randomFn))
                || createVirusGearFault(stagedOption, randomFn)
                || createCrackedDriveFault(stagedOption, randomFn);
        } else {
            stagedOption.inspectionFault = createSparkInstabilityFault(stagedOption, randomFn);
        }
    }

    // Authored puzzles store movable gears at their solution coordinates,
    // which means without displacement the train would already turn at
    // open. Shuffle the player-installable gears so the player always has
    // at least one piece to slide into place.
    displaceMovableGearPieces(stagedOption, randomFn);

    return stagedOption;
}

const createDebugPuzzleOption = ({
    prompt,
    repairPrompt,
    expectedOutput,
    actualOutputs,
    previewTitle = 'DEBUG CONSOLE',
    description = 'Run the diagnostic command. If the output drifts, patch the machine and stabilize the test.',
}) => ({
    prompt: formatDebugCommand(prompt, 'Test'),
    repairPrompt: formatDebugCommand(repairPrompt, 'Patch'),
    expectedOutput: String(expectedOutput || ''),
    actualOutputs: cloneDebugOutputs(actualOutputs),
    previewTitle,
    description,
});

function formatDebugCommand(command, suffix = 'Run') {
    const raw = String(command || '').trim();
    if (!raw || /^System-/.test(raw)) return raw;

    const words = raw
        .replace(/[().]/g, ' ')
        .replace(/[_/-]+/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
    const normalizedWords = words.filter((word) => !/^(test|run|patch)$/i.test(word));
    const parts = (normalizedWords.length > 0 ? normalizedWords : words).map((word) => (
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ));
    return `System-${parts.join('-')}-${suffix}()`;
}

function buildProtocolInvalidOutputs(expectedOutput = '') {
    const text = String(expectedOutput || '').trim();
    const variants = [
        text.toLowerCase(),
        text.replace(' // ', ' / '),
        text.replace(/ OK /g, ' Ok '),
        text.replace(/ PERCENT/g, ''),
        'NULL RESPONSE',
        'UNDEFINED',
        'FAILURE: NO RETURN',
        'OK',
    ].filter(Boolean);

    return Array.from(new Set(variants)).filter((variant) => variant !== text);
}

function corruptDebugPrompt(prompt = '', randomFn = Math.random) {
    const characters = String(prompt || '').split('');
    const candidateIndices = characters
        .map((character, index) => ({ character, index }))
        .filter(({ character }) => /[a-z0-9]/i.test(character))
        .map(({ index }) => index);

    if (candidateIndices.length === 0) return String(prompt || '');

    const selectedIndex = candidateIndices[Math.floor(randomFn() * candidateIndices.length)] ?? candidateIndices[0];
    characters[selectedIndex] = '█';
    return characters.join('');
}

function toBlockMaskedDebugOutput(value = '') {
    const text = String(value || '');
    if (!text) return '█';
    return text.replace(/[A-Za-z0-9]/g, '█');
}

function applyDebugStageToOption(debugPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!debugPuzzleOption) return null;

    // Per-day difficulty:
    // - Day 1: stable harness, no bugs, no protocol-invalid mismatches.
    // - Day 2: bugs enabled at slow pace + 70% chance of repairable mismatch.
    // - Day 3: bugs enabled at fast pace + 85% chance of repairable mismatch
    //          + 30% chance of spark-hazard (instant scrap).
    const stagedOption = {
        ...debugPuzzleOption,
        dayStage: stage,
        // Crawling "bugs" only on period 3 — days 1–2 stay clean harnesses.
        bugsEnabled: stage >= 3,
        resultType: 'stable',
        protocolInvalidOutputs: stage >= 2 ? buildProtocolInvalidOutputs(debugPuzzleOption.expectedOutput) : [],
        scrapKind: null,
        scrapStatus: null,
        scrapReason: null,
    };

    if (stage <= 1) {
        stagedOption.bugsEnabled = false;
        stagedOption.resultType = 'stable';
        stagedOption.protocolInvalidOutputs = [];
        return stagedOption;
    }

    if (stage === 2 && Array.isArray(stagedOption.actualOutputs) && stagedOption.actualOutputs.length > 0) {
        stagedOption.resultType = randomFn() < 0.70 ? 'repairable-mismatch' : 'stable';
        return stagedOption;
    }

    if (stage >= 3 && randomFn() < 0.30) {
        stagedOption.resultType = 'spark-hazard';
        stagedOption.scrapKind = 'hazard';
        stagedOption.scrapStatus = 'SPARKED DEBUG BUG';
        stagedOption.scrapReason = 'A sparked debugger bug indicates unstable software contamination. Scrap the unit immediately.';
        return stagedOption;
    }

    if (stage >= 3 && Array.isArray(stagedOption.actualOutputs) && stagedOption.actualOutputs.length > 0) {
        stagedOption.resultType = randomFn() < 0.85 ? 'repairable-mismatch' : 'stable';
        return stagedOption;
    }

    if (Array.isArray(stagedOption.actualOutputs) && stagedOption.actualOutputs.length > 0) {
        stagedOption.resultType = 'repairable-mismatch';
    }

    return stagedOption;
}

function createDebugProgress(debugPuzzleOption, randomFn = Math.random) {
    const expectedOutput = String(debugPuzzleOption?.expectedOutput || '');
    const repairableOutputs = cloneDebugOutputs(debugPuzzleOption?.actualOutputs || []);
    const protocolInvalidOutputs = cloneDebugOutputs(debugPuzzleOption?.protocolInvalidOutputs || []);
    const resultType = String(debugPuzzleOption?.resultType || 'stable');
    let actualOutput = expectedOutput;
    let repairRequired = false;
    let scrapRequired = false;
    let phase = 'test';
    let lastStatus = 'TEST READY';
    let flags = [];
    let symptoms = ['Diagnostic harness is stable.'];
    const dayStage = Math.max(1, Math.min(3, Number(debugPuzzleOption?.dayStage || 1)));
    const scrapVisualStage = pickUnlockedScrapStage(dayStage, randomFn);

    if (resultType === 'corrupted-command') {
        actualOutput = '';
        scrapRequired = true;
        phase = 'scrap';
        lastStatus = 'CORRUPTED COMMAND';
        flags = ['corrupted-command'];
        symptoms = ['Command string contains unreadable corruption.'];
    } else if (resultType === 'spark-hazard') {
        actualOutput = '';
        scrapRequired = true;
        phase = 'scrap';
        lastStatus = 'SPARKED DEBUG BUG // SCRAP UNIT';
        flags = ['spark-hazard'];
        symptoms = ['Debugger space shows unstable sparked contamination.'];
    } else if (resultType === 'protocol-invalid') {
        actualOutput = pickRandomEntry(protocolInvalidOutputs, randomFn) || 'NULL RESPONSE';
        symptoms = ['Run the test and inspect the returned protocol exactly.'];
    } else {
        const outputPool = Number(debugPuzzleOption?.dayStage || 1) <= 1
            ? [expectedOutput]
            : [expectedOutput, ...repairableOutputs];
        const randomIndex = Math.floor(randomFn() * outputPool.length);
        actualOutput = outputPool[randomIndex] ?? expectedOutput;
        repairRequired = actualOutput !== expectedOutput;
        lastStatus = repairRequired ? 'PATCH REQUIRED' : 'TEST READY';
        flags = repairRequired ? ['patch-required'] : [];
        symptoms = repairRequired
            ? [`Unexpected output: ${actualOutput}`]
            : ['Diagnostic harness is stable.'];
    }

    return {
        phase,
        completed: false,
        fixed: false,
        repairRequired,
        scrapRequired,
        reviewed: scrapRequired,
        dayStage,
        scrapVisualStage,
        resultType,
        prompt: String(debugPuzzleOption?.prompt || ''),
        repairPrompt: String(debugPuzzleOption?.repairPrompt || ''),
        expectedOutput,
        actualOutput,
        bugsEnabled: Boolean(debugPuzzleOption?.bugsEnabled),
        scrapKind: debugPuzzleOption?.scrapKind || null,
        scrapStatus: debugPuzzleOption?.scrapStatus || null,
        scrapReason: debugPuzzleOption?.scrapReason || null,
        inputValue: '',
        bugsSquashed: 0,
        corruptionCount: 0,
        outputMatched: !repairRequired,
        lastStatus,
        flags,
        symptoms,
    };
}

function pickUnlockedScrapStage(stage = 1, randomFn = Math.random) {
    const maxStage = Math.max(1, Math.min(3, Number(stage) || 1));
    return 1 + Math.floor(randomFn() * maxStage);
}

function buildForcedFlowScrapOption(flowPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!flowPuzzleOption) return null;
    const activeStage = Math.max(1, Math.min(3, Number(stage) || 1));
    const stagedOption = applyFlowStageToOption(cloneFlowPuzzleOption(flowPuzzleOption), activeStage, randomFn);
    if (!stagedOption) return null;
    if (stagedOption.inspectionFault) return stagedOption;

    const visualStage = pickUnlockedScrapStage(activeStage, randomFn);
    if (visualStage <= 1) {
        stagedOption.inspectionFault = createMissingLeadFault(stagedOption);
    } else if (visualStage === 2) {
        stagedOption.inspectionFault = randomFn() < 0.5
            ? createMissingLeadFault(stagedOption)
            : createRedWireFault(stagedOption);
    } else {
        const outputs = Array.isArray(stagedOption.outputSpecs) ? stagedOption.outputSpecs : [];
        const hazardousOutput = pickRandomEntry(outputs, randomFn) || outputs[0] || null;
        if (hazardousOutput) {
            hazardousOutput.powerClass = 'red';
            hazardousOutput.sourceKey = null;
            stagedOption.outputSpecs = cloneFlowOutputSpecs(outputs);
            stagedOption.repairTargets = cloneRepairTargets(outputs);
            stagedOption.inspectionFault = createCracklingOutputFault(hazardousOutput);
        } else {
            stagedOption.inspectionFault = createRedWireFault(stagedOption);
        }
    }

    return stagedOption;
}

function buildForcedGearScrapOption(gearPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!gearPuzzleOption) return null;
    const activeStage = Math.max(1, Math.min(3, Number(stage) || 1));
    const stagedOption = applyGearStageToOption(cloneGearPuzzleOption(gearPuzzleOption), activeStage, randomFn);
    if (!stagedOption) return null;
    if (stagedOption.inspectionFault) return stagedOption;

    const visualStage = pickUnlockedScrapStage(activeStage, randomFn);
    if (visualStage <= 1) {
        stagedOption.inspectionFault = createCrackedDriveFault(stagedOption, randomFn);
    } else if (visualStage === 2) {
        stagedOption.inspectionFault = randomFn() < 0.5
            ? createCrackedDriveFault(stagedOption, randomFn)
            : createVirusGearFault(stagedOption, randomFn);
    } else {
        stagedOption.inspectionFault = createSparkInstabilityFault(stagedOption, randomFn);
    }
    return stagedOption;
}

function buildForcedDebugScrapOption(debugPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!debugPuzzleOption) return null;
    const activeStage = Math.max(1, Math.min(3, Number(stage) || 1));
    const stagedOption = applyDebugStageToOption(cloneDebugPuzzleOption(debugPuzzleOption), activeStage, randomFn);
    if (!stagedOption) return null;

    const visualStage = pickUnlockedScrapStage(activeStage, randomFn);
    stagedOption.scrapVisualStage = visualStage;
    if (visualStage <= 1) {
        stagedOption.resultType = 'corrupted-command';
        stagedOption.scrapKind = 'compliance';
        stagedOption.scrapStatus = 'CORRUPTED COMMAND';
        stagedOption.scrapReason = 'Command stream collapsed into unreadable glyphs. Scrap the unit.';
    } else if (visualStage === 2) {
        stagedOption.resultType = 'protocol-invalid';
        stagedOption.scrapKind = 'compliance';
        stagedOption.scrapStatus = 'PROTOCOL INVALID';
        stagedOption.scrapReason = 'Output protocol is invalid and cannot be repaired on the floor.';
    } else {
        stagedOption.resultType = 'spark-hazard';
        stagedOption.scrapKind = 'hazard';
        stagedOption.scrapStatus = 'SPARKED DEBUG BUG';
        stagedOption.scrapReason = 'A sparked debugger bug indicates unstable software contamination. Scrap the unit immediately.';
    }
    return stagedOption;
}

const DEFAULT_MACHINE_DAYS = Object.freeze([1, 2, 3, 4]);
const DEFAULT_MACHINE_PERIODS = Object.freeze([1, 2, 3]);

const MACHINE_FLOW_CATALOG = Object.freeze({
    assembler_alpha: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'EYES', 2: 'CPU' }, forbiddenCount: 0, previewTitle: 'FAB BUS' }),
        createFlowPuzzleOption({ sourceRow: 1, outputs: { 1: 'CPU', 3: 'ARMS', 4: 'MEMORY' }, forbiddenCount: 1, previewTitle: 'LINE CTRL' }),
    ]),
    audit_drone: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 0: 'EYES', 2: 'CPU', 4: 'VOICE' }, forbiddenCount: 1, previewTitle: 'AUDIT LOOP' }),
        createFlowPuzzleOption({ sourceRow: 3, outputs: { 1: 'MEMORY', 3: 'LIMBS' }, forbiddenCount: 0, previewTitle: 'LENS BUS' }),
    ]),
    courier_shell: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'VOICE', 2: 'CPU', 4: 'HATCH' }, forbiddenCount: 0, previewTitle: 'ROUTE BUS' }),
        createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'TRACK', 2: 'MEMORY', 3: 'EYES' }, forbiddenCount: 1, previewTitle: 'COURIER IO' }),
    ]),
    sentry_frame: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 0: 'EYES', 2: 'TARGET', 4: 'LIMBS' }, forbiddenCount: 1, previewTitle: 'THREAT GRID' }),
        createFlowPuzzleOption({ sourceRow: 3, outputs: { 1: 'ARMOR', 3: 'CPU', 4: 'VOICE' }, forbiddenCount: 2, previewTitle: 'PERIMETER' }),
    ]),
    breakroom_brewer: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'HEAT', 2: 'PUMP' }, forbiddenCount: 0, previewTitle: 'BREW LOOP' }),
        createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'HEAT', 2: 'MEMORY', 4: 'NOZZLE' }, forbiddenCount: 1, previewTitle: 'CAF BUS' }),
    ]),
    mechanic_broom: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'BRUSH', 3: 'VAC', 4: 'SENSE' }, forbiddenCount: 1, previewTitle: 'CLEAN BUS' }),
        createFlowPuzzleOption({ sourceRow: 3, outputs: { 0: 'MAG', 2: 'CPU', 4: 'WHEELS' }, forbiddenCount: 0, previewTitle: 'MAINT LOOP' }),
    ]),
    cry_baby: Object.freeze([
        createFlowPuzzleOption({
            sourceRow: 2,
            outputs: { 1: 'VOICE', 2: 'EMOTION', 4: 'CPU' },
            forbiddenCount: 0,
            previewTitle: 'SOB LOOP',
            // Impassable tile flush against the EMOTION trunk (row 2) — nothing can be placed there.
            extraForbidden: [[FLOW_TILE_COLS - 2, 2]],
            inspectionFault: {
                x: 3,
                y: 2,
                type: 'emotion-flood',
                kind: 'unsalvageable',
                status: 'EMOTION REGULATOR BLOCKED',
                reason: 'Tear-soaked wiring has flooded the emotion regulator line. The regulator cannot be safely reached on the floor. Scrap the unit.',
            },
        }),
        createFlowPuzzleOption({
            sourceRow: 1,
            outputs: { 0: 'CPU', 2: 'EMOTION', 4: 'VOICE' },
            forbiddenCount: 0,
            previewTitle: 'MELTDOWN BUS',
            extraForbidden: [[FLOW_TILE_COLS - 2, 2]],
            inspectionFault: {
                x: 3,
                y: 4,
                type: 'emotion-flood',
                kind: 'unsalvageable',
                status: 'TEAR FLOOD',
                reason: 'A flood of emotional feedback has torn open the wiring in front of the voice regulator. Floor repair is impossible. Scrap the unit.',
            },
        }),
    ]),
    // Rich Mf has exactly one routing puzzle: a single core reactor wired
    // to the top output (PERSONALITY) by default. The energy budget covers
    // exactly that one connection — the player can swap modules around but
    // can't power more than one at a time.
    rich_mf: Object.freeze([
        createFlowPuzzleOption({
            sourceRow: 0,
            outputs: { 0: 'PERSONALITY', 2: 'INTELLIGENCE' },
            forbiddenCount: 0,
            previewTitle: 'EXECUTIVE LATTICE',
            repairTargets: [
                createRepairTarget('PERSONALITY', 0),
                createRepairTarget('INTELLIGENCE', 2),
            ],
        }),
    ]),
    rebellious_umbrella: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'SHAFT', 3: 'CANOPY', 4: 'VOICE' }, forbiddenCount: 0, previewTitle: 'SHADE BUS' }),
        createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'SHADE', 2: 'SHAFT', 4: 'LATCH' }, forbiddenCount: 1, previewTitle: 'HUSH LOOP' }),
    ]),
    debrief_machine: Object.freeze([
        createFlowPuzzleOption({
            sourceRow: 2,
            outputs: { 1: 'BAD_JOKES', 2: 'BRIEF', 4: 'VOICE' },
            forbiddenCount: 0,
            previewTitle: 'MANAGER LOOP',
            repairTargets: [
                createRepairTarget('BAD_JOKES', 1),
                createRepairTarget('BRIEF', 2),
                { ...createRepairTarget('VOICE', 4), displayName: 'Handsome Voice Box' },
            ],
        }),
        createFlowPuzzleOption({
            sourceRow: 1,
            outputs: { 0: 'VOICE', 2: 'BAD_JOKES', 4: 'BRIEF' },
            forbiddenCount: 0,
            previewTitle: 'PITCH BUS',
            repairTargets: [
                { ...createRepairTarget('VOICE', 0), displayName: 'Handsome Voice Box' },
                createRepairTarget('BAD_JOKES', 2),
                createRepairTarget('BRIEF', 4),
            ],
        }),
    ]),
    future_lounge_chair: Object.freeze([
        createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'RECLINE', 2: 'MEMORY', 4: 'HEAT' }, forbiddenCount: 0, previewTitle: 'COMFORT BUS' }),
        createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'LUMBAR', 3: 'VOICE', 4: 'POWER' }, forbiddenCount: 1, previewTitle: 'REST GRID' }),
    ]),
});

const SHARED_GEAR_OPTIONS = Object.freeze([
    createGearPuzzleOption({
        previewTitle: 'DRIVE TRAIN',
        description: 'Slide the loose gears into place until power reaches the output axle.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'TORQUE LOOP',
        description: 'Free the stalled path, drag the rusted idler clear, and route torque through the fixed transfer gear.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.FULL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.RUSTED, 3, 3),
            createGearPiece(GEAR_CODES.CURVE_SW, 2, 4),
            createGearPiece(GEAR_CODES.VERTICAL, 2, 3, { movable: false }),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'OUTPUT SHAFT',
        description: 'Bridge the upper bus, feed the fixed hub, and spin the final shaft.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.FULL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.HORIZONTAL, 1, 2, { movable: false }),
            createGearPiece(GEAR_CODES.CURVE_SW, 2, 4),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'CORRODED IDLER',
        description: 'Slide the live gears into place while keeping the fixed rusted wheel out of the train.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 2),
            createGearPiece(GEAR_CODES.RUSTED, 1, 3, { movable: false }),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
]);

const SHARED_GEAR_OPTIONS_DAY2 = Object.freeze([
    // "GEAR CASCADE" — 6×6, 7 pieces, long L-chain with wall divider and rusted decoy
    // Solution: SOURCE(1,1)→VERT(2,1)→CURVE_NE(3,1)[fixed]→HORIZ(3,2)→HORIZ(3,3)→CURVE_SW(3,4)→CURVE_NW(4,4)→SINK(4,3)
    createGearPuzzleOption({
        previewTitle: 'GEAR CASCADE',
        description: 'Thread the gear train through the divided housing — avoid the corroded idler before the output shaft jams.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 2),
            createGearPiece(GEAR_CODES.CURVE_SW, 1, 4),
            createGearPiece(GEAR_CODES.CURVE_NW, 4, 1),
            createGearPiece(GEAR_CODES.RUSTED, 2, 4),
        ],
    }),
    // "SPLIT BUS" — 6×6, 6 pieces, maze walls force routing through FULL junction
    // Solution: SOURCE(1,1)→CURVE_SW(1,2)→FULL(2,2)→CURVE_NE(3,2)[fixed]→HORIZ(3,3)→CURVE_SW(3,4)→SINK(4,4)
    createGearPuzzleOption({
        previewTitle: 'SPLIT BUS',
        description: 'Find the only route through the blocked housing — the junction gear must bridge the two isolated lanes.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.CURVE_SW, 1, 4),
            createGearPiece(GEAR_CODES.FULL, 4, 1),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 2, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 1),
            createGearPiece(GEAR_CODES.CURVE_SW, 4, 3),
            createGearPiece(GEAR_CODES.RUSTED, 2, 4),
        ],
    }),
    // "COUNTER SHAFT" — 6×6, 5 movable pieces, power flows right-to-left then straight down
    // Solution: SOURCE(1,4)→HORIZ(1,3)→HORIZ(1,2)→FULL(1,1)→VERT(2,1)→VERT(3,1)→SINK(4,1)
    // Fixed FULL at (2,4) below SOURCE creates a dead-end trap
    createGearPuzzleOption({
        previewTitle: 'COUNTER SHAFT',
        description: 'Reverse the drive direction — route torque from the far input back along the top rail before dropping to the output.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SOURCE, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.FULL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SINK, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.HORIZONTAL, 3, 2),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 2),
            createGearPiece(GEAR_CODES.FULL, 4, 3),
            createGearPiece(GEAR_CODES.VERTICAL, 4, 4),
            createGearPiece(GEAR_CODES.VERTICAL, 3, 3),
        ],
    }),
]);

const SHARED_GEAR_OPTIONS_DAY3 = Object.freeze([
    // "COMPOUND DRIVE" — 7×6, 8 pieces, tall vertical chain + horizontal run, two wall obstacles
    // Solution: SOURCE(1,1)→VERT(2,1)→VERT(3,1)→VERT(4,1)→CURVE_NE(5,1)[fixed]→HORIZ(5,2)→HORIZ(5,3)→SINK(5,4)
    // Fixed FULL at (3,4) tempts players toward the right side
    createGearPuzzleOption({
        previewTitle: 'COMPOUND DRIVE',
        description: 'Build the full drive stack down the left column before routing the output across to the sink — two blocked shafts force a single path.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.FULL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 2),
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.VERTICAL, 1, 4),
            createGearPiece(GEAR_CODES.CURVE_NE, 5, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 3, 2),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 3),
            createGearPiece(GEAR_CODES.RUSTED, 2, 4),
            createGearPiece(GEAR_CODES.RUSTED, 3, 3),
        ],
    }),
    // "TWIN FORK" — 7×6, 7 pieces, fixed FULL in board creates false junction; RUSTED decoys on Day 3 are traversable
    // Solution: SOURCE(1,1)→VERT(2,1)→VERT(3,1)→VERT(4,1)→CURVE_NE(5,1)→HORIZ(5,2)→SINK(5,3)
    // Fixed FULL at (2,3) tempts players to route across the middle
    createGearPuzzleOption({
        previewTitle: 'TWIN FORK',
        description: 'The junction gear in the middle housing looks like a shortcut — but only the straight drop feeds the output shaft.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.FULL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 2),
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.VERTICAL, 1, 4),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 4),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 3),
            createGearPiece(GEAR_CODES.RUSTED, 4, 2),
            createGearPiece(GEAR_CODES.RUSTED, 5, 4),
        ],
    }),
    // "REVERSE DRIVE" — 7×6, 7 pieces, SOURCE top-right, SINK bottom-left; mirror of COMPOUND DRIVE
    // Solution: SOURCE(1,4)→VERT(2,4)→VERT(3,4)→VERT(4,4)→CURVE_NW(5,4)→HORIZ(5,3)→HORIZ(5,2)→SINK(5,1)
    // Fixed FULL at (3,1) creates a left-side temptation
    createGearPuzzleOption({
        previewTitle: 'REVERSE DRIVE',
        description: 'The input is on the wrong side — drop down the right column and sweep the output back across to reach the sink.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SOURCE, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.FULL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SINK, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 2, 1),
            createGearPiece(GEAR_CODES.VERTICAL, 2, 2),
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NW, 1, 2),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 1),
            createGearPiece(GEAR_CODES.HORIZONTAL, 4, 2),
            createGearPiece(GEAR_CODES.RUSTED, 3, 2),
        ],
    }),
]);

const SHARED_FLOW_OPTIONS = Object.freeze([
    createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'POWER', 3: 'CPU' }, forbiddenCount: 0, previewTitle: 'MAIN BUS' }),
    createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'POWER', 2: 'MEMORY', 4: 'MOTOR' }, forbiddenCount: 1, previewTitle: 'SYS LOOP' }),
    createFlowPuzzleOption({ sourceRow: 3, outputs: { 1: 'CPU', 2: 'SENSOR' }, forbiddenCount: 0, previewTitle: 'CTRL BUS' }),
    createFlowPuzzleOption({ sourceRow: 2, outputs: { 0: 'MOTOR', 3: 'POWER', 4: 'SENSE' }, forbiddenCount: 1, previewTitle: 'DRIVE BUS' }),
]);

const SHARED_DEBUG_OPTIONS = Object.freeze([
    createDebugPuzzleOption({
        prompt: 'System-Boot-Start()',
        repairPrompt: 'System-Boot-ResetSequence()',
        expectedOutput: 'Boot Success: all systems nominal',
        actualOutputs: [
            'Boot Failure: init sequence stalled',
            'Boot Complete: sensor array skipped',
            'Boot Failure: clock drift high',
            'Boot Failure: memory check timeout',
            'Boot Complete: redundancy offline',
        ],
    }),
    createDebugPuzzleOption({
        prompt: 'System-Power-CheckRelays()',
        repairPrompt: 'System-Power-VoltageSync()',
        expectedOutput: 'Relay Okay: voltage stable',
        actualOutputs: [
            'Relay Failure: voltage spike detected',
            'Relay Okay: output clipped',
            'Relay Failure: ground loop present',
            'Relay Failure: draw exceeds limit',
            'Relay Okay: regulator bypassed',
        ],
    }),
    createDebugPuzzleOption({
        prompt: 'System-IO-SensorArray-Calibrate()',
        repairPrompt: 'System-IO-SensorArray-Restore()',
        expectedOutput: 'Sensor Array Okay: calibrated',
        actualOutputs: [
            'Sensor Array Failure: proximity drift',
            'Sensor Array Okay: thermal offset high',
            'Sensor Array Failure: cal table corrupted',
            'Sensor Array Failure: scan loop frozen',
            'Sensor Array Okay: range clipped',
        ],
    }),
]);

const UMBRELLA_GEAR_OPTIONS = Object.freeze([
    createGearPuzzleOption({
        previewTitle: 'SHAFT COLLAR',
        description: 'Brace the bent umbrella shaft so the canopy hub can turn without wobbling apart.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'CANOPY HUB',
        description: 'Reset the canopy hub and keep the crooked idler from snagging the umbrella ribs.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 2),
            createGearPiece(GEAR_CODES.RUSTED, 1, 3, { movable: false }),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
]);

const JESTER_GEAR_OPTIONS = Object.freeze([
    createGearPuzzleOption({
        previewTitle: 'WIND-UP BOX',
        description: 'Wind the clown box until the jack pops and the spring sings.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
]);

const DEBRIEF_GEAR_OPTIONS = Object.freeze([
    createGearPuzzleOption({
        previewTitle: 'MIDDLE MANAGEMENT',
        description: 'Route the smug presentation gears until the manager voice line spins back up.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.VERTICAL, 1, 3),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.HORIZONTAL, 2, 3),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'EXEC SUMMARY',
        description: 'Bridge the briefing gears and keep the output shaft polished enough for management.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.FULL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.HORIZONTAL, 1, 2, { movable: false }),
            createGearPiece(GEAR_CODES.CURVE_SW, 2, 4),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1),
        ],
    }),
]);


const MACHINE_GEAR_CATALOG = Object.freeze({
    assembler_alpha: SHARED_GEAR_OPTIONS,
    audit_drone: SHARED_GEAR_OPTIONS,
    courier_shell: SHARED_GEAR_OPTIONS,
    sentry_frame: SHARED_GEAR_OPTIONS,
    breakroom_brewer: SHARED_GEAR_OPTIONS,
    mechanic_broom: SHARED_GEAR_OPTIONS,
    jester_in_the_box: JESTER_GEAR_OPTIONS,
    rebellious_umbrella: UMBRELLA_GEAR_OPTIONS,
    debrief_machine: DEBRIEF_GEAR_OPTIONS,
    future_lounge_chair: SHARED_GEAR_OPTIONS,
});

const SHARED_GEAR_MACHINES = Object.freeze([
    'assembler_alpha', 'audit_drone', 'courier_shell', 'sentry_frame',
    'breakroom_brewer', 'mechanic_broom', 'future_lounge_chair',
]);

const MACHINE_GEAR_CATALOG_DAY2 = Object.freeze(
    Object.fromEntries(SHARED_GEAR_MACHINES.map((id) => [id, SHARED_GEAR_OPTIONS_DAY2]))
);

const MACHINE_GEAR_CATALOG_DAY3 = Object.freeze(
    Object.fromEntries(SHARED_GEAR_MACHINES.map((id) => [id, SHARED_GEAR_OPTIONS_DAY3]))
);

const MACHINE_DEBUG_CATALOG = Object.freeze({
    assembler_alpha: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test arm weld seq',
            repairPrompt: 'patch weld.arc.sync',
            expectedOutput: 'ARMATURE OK // 4 JOINTS LOCKED',
            actualOutputs: [
                'ARMATURE STALL // JOINT 3 DRIFT',
                'ARMATURE OK // 3 JOINTS LOCKED',
                'ARMATURE DESYNC // ARC BUS HIGH',
                'ARMATURE OK // CALIBRATION SKIPPED',
                'ARMATURE FAULT // ARC BUS NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test hopper feed',
            repairPrompt: 'patch feed.queue.reset',
            expectedOutput: 'HOPPER FEED OK // 12 UNITS MIN',
            actualOutputs: [
                'HOPPER FEED LAG // 8 UNITS MIN',
                'HOPPER FEED OK // 6 UNITS MIN',
                'HOPPER FEED JAM // GATE CLOSED',
                'HOPPER FEED OK // SENSOR OFFLINE',
                'HOPPER FEED DRIFT // BELT SLIP',
            ],
        }),
    ]),
    audit_drone: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test optic audit',
            repairPrompt: 'patch optic.cache.flush',
            expectedOutput: 'OPTICS OK // LEDGER CLEAN',
            actualOutputs: [
                'OPTICS FAIL // LEDGER GHOSTED',
                'OPTICS OK // FRAME 19 MISSING',
                'OPTICS DRIFT // HASH SPOILED',
                'OPTICS FAIL // ARCHIVE LOOP',
                'OPTICS OK // TIMESTAMP NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test voice checksum',
            repairPrompt: 'patch voice.codec.reseed',
            expectedOutput: 'VOICE HASH OK // PACKET CLEAN',
            actualOutputs: [
                'VOICE HASH BAD // PACKET LOSS',
                'VOICE HASH OK // STATIC CARRY',
                'VOICE HASH FAIL // CRC DRIFT',
                'VOICE HASH BAD // ECHO STACK',
                'VOICE HASH OK // CHANNEL NULL',
            ],
        }),
    ]),
    courier_shell: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test route memory',
            repairPrompt: 'patch route.cache.reindex',
            expectedOutput: 'ROUTE CACHE OK // 48 STOPS',
            actualOutputs: [
                'ROUTE CACHE FAIL // 31 STOPS',
                'ROUTE CACHE OK // 12 STOPS',
                'ROUTE CACHE DRIFT // LOOPED STOP',
                'ROUTE CACHE BAD // INDEX NULL',
                'ROUTE CACHE OK // STAMP MISSING',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test hatch cycle',
            repairPrompt: 'patch hatch.latch.rebind',
            expectedOutput: 'HATCH OK // LATCH SEALED',
            actualOutputs: [
                'HATCH FAIL // LATCH OPEN',
                'HATCH OK // PRESSURE LOW',
                'HATCH LOOP // CLOSE RETRY',
                'HATCH FAIL // CLAMP MISREAD',
                'HATCH OK // SENSOR BLIND',
            ],
        }),
    ]),
    sentry_frame: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test target sweep',
            repairPrompt: 'patch target.core.align',
            expectedOutput: 'TARGET GRID OK // TRACKING GREEN',
            actualOutputs: [
                'TARGET GRID FAIL // TRACKING RED',
                'TARGET GRID OK // RANGE DRIFT',
                'TARGET GRID BAD // CORE MISALIGNED',
                'TARGET GRID LOOP // PING STUCK',
                'TARGET GRID OK // PRIORITY NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test armor servo',
            repairPrompt: 'patch armor.servo.reset',
            expectedOutput: 'ARMOR SERVO OK // SHIELD CLOSED',
            actualOutputs: [
                'ARMOR SERVO FAIL // SHIELD OPEN',
                'ARMOR SERVO OK // MOTOR STALL',
                'ARMOR SERVO BAD // TORQUE LOSS',
                'ARMOR SERVO LOOP // SEAL RETRY',
                'ARMOR SERVO OK // LIMIT NULL',
            ],
        }),
    ]),
    microwave_fridge_assistant: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'System-Test-Chimichanga',
            repairPrompt: 'patch System-Test-Chimichanga.sanitize',
            expectedOutput: 'WARM CYCLE OK // NO SOUP LEAK',
            actualOutputs: [
                'WARM CYCLE FAIL // SOUP PRESENT',
                'WARM CYCLE OK // COLD SIDE WARM',
                'WARM CYCLE DRIFT // TIMER NULL',
                'WARM CYCLE OK // LATCH STUCK',
                'WARM CYCLE FAIL // SENSOR BLIND',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'defrost-integrity --probe 2',
            repairPrompt: 'patch defrost.integrity.ack',
            expectedOutput: 'DEFROST OK // SEAL GREEN',
            actualOutputs: [
                'DEFROST FAIL // SEAL RED',
                'DEFROST OK // COIL COLD',
                'DEFROST BAD // TIMING DRIFT',
                'DEFROST FAIL // FAN STALL',
                'DEFROST OK // SENSOR NULL',
            ],
        }),
    ]),
    breakroom_brewer: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test brew heat',
            repairPrompt: 'patch brew.coil.balance',
            expectedOutput: 'HEAT LOOP OK // 94C STABLE',
            actualOutputs: [
                'HEAT LOOP FAIL // 61C HOLD',
                'HEAT LOOP OK // THERMAL SPIKE',
                'HEAT LOOP BAD // COIL OFFSET',
                'HEAT LOOP FAIL // BOILER COLD',
                'HEAT LOOP OK // SENSOR NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test pour cycle',
            repairPrompt: 'patch nozzle.flush.purge',
            expectedOutput: 'POUR LOOP OK // NOZZLE CLEAR',
            actualOutputs: [
                'POUR LOOP FAIL // NOZZLE CLOG',
                'POUR LOOP OK // DRIP DELAY',
                'POUR LOOP BAD // VALVE STICK',
                'POUR LOOP FAIL // PRESSURE LOW',
                'POUR LOOP OK // FLOW SENSOR NULL',
            ],
        }),
    ]),
    mechanic_broom: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test sweep vector',
            repairPrompt: 'patch sweep.path.reseed',
            expectedOutput: 'SWEEP MAP OK // AISLE CLEAR',
            actualOutputs: [
                'SWEEP MAP FAIL // CORNER LOOP',
                'SWEEP MAP OK // PATH STALE',
                'SWEEP MAP BAD // GRID OFFSET',
                'SWEEP MAP FAIL // RETURN LOST',
                'SWEEP MAP OK // SENSOR NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test vacuum intake',
            repairPrompt: 'patch vac.turbine.prime',
            expectedOutput: 'INTAKE OK // PRESSURE GREEN',
            actualOutputs: [
                'INTAKE FAIL // PRESSURE RED',
                'INTAKE OK // FILTER BLOCKED',
                'INTAKE BAD // TURBINE DRIFT',
                'INTAKE FAIL // SEAL LOSS',
                'INTAKE OK // RPM NULL',
            ],
        }),
    ]),
    rebellious_umbrella: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test shade posture',
            repairPrompt: 'patch shade.pose.realign',
            expectedOutput: 'SHADE POSTURE OK // VISOR CROOKED JUST RIGHT',
            actualOutputs: [
                'SHADE POSTURE FAIL // VISOR TWISTED',
                'SHADE POSTURE OK // SHAFT HUM LOUD',
                'SHADE POSTURE BAD // RIB OFFSET',
                'SHADE POSTURE FAIL // SHAFT KINKED',
                'SHADE POSTURE OK // ATTITUDE NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test canopy fold',
            repairPrompt: 'patch canopy.hub.rebrace',
            expectedOutput: 'CANOPY FOLD OK // SHAFT TRUE',
            actualOutputs: [
                'CANOPY FOLD FAIL // SHAFT BENT',
                'CANOPY FOLD OK // LATCH DRIFT',
                'CANOPY FOLD BAD // RIB MISMATCH',
                'CANOPY FOLD FAIL // LOCK STUCK',
                'CANOPY FOLD OK // PIVOT NULL',
            ],
        }),
    ]),
    debrief_machine: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'run manager patter',
            repairPrompt: 'patch manager.script.rethread',
            expectedOutput: 'Heyyy--welcome back. Another day, another penny, am i right?',
            actualOutputs: [
                'Heyyy--welcome back. Another day, another panic, am i right?',
                'Heyyy--welcome back. Another day, another penny, am i wrong?',
                'HEYYY--WELCOME BACK. ANOTHER DAY, ANOTHER PENNY?',
                'Heyyy--welcome back. Another day, another penny, voice buffer flat.',
                'manager patter missing // brief mode only',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test executive recap',
            repairPrompt: 'patch recap.bluster.align',
            expectedOutput: 'RECAP OK // EVERYTHING UNDER CONTROL',
            actualOutputs: [
                'RECAP FAIL // EVERYTHING ON FIRE',
                'RECAP OK // CONTROL MISSING',
                'RECAP BAD // JOKE LOOP LEAK',
                'RECAP FAIL // CHARISMA NULL',
                'RECAP OK // BRIEF OVERRUN',
            ],
        }),
    ]),
    future_lounge_chair: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'test recline motor',
            repairPrompt: 'patch recline.limit.clear',
            expectedOutput: 'RECLINE OK // 100 PERCENT',
            actualOutputs: [
                'RECLINE FAIL // 42 PERCENT',
                'RECLINE OK // LIMIT SWITCH BAD',
                'RECLINE BAD // MOTOR KNOCK',
                'RECLINE FAIL // LOCK ENGAGED',
                'RECLINE OK // FEEDBACK NULL',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test lumbar mesh',
            repairPrompt: 'patch lumbar.mesh.rethread',
            expectedOutput: 'LUMBAR OK // PRESSURE EVEN',
            actualOutputs: [
                'LUMBAR FAIL // PRESSURE LEFT',
                'LUMBAR OK // TENSION LOW',
                'LUMBAR BAD // MESH SNAG',
                'LUMBAR FAIL // SUPPORT NULL',
                'LUMBAR OK // CALIBRATION LOST',
            ],
        }),
    ]),
    // Rich Mf intentionally has no debug puzzles — wiring/routing only.
    rich_mf: Object.freeze([]),
});

const MACHINE_MINI_DISPLAY_CATALOG = Object.freeze({
    assembler_alpha: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    audit_drone: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -4,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    courier_shell: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: 2,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    sentry_frame: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    breakroom_brewer: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -4,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    mechanic_broom: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.165,
        artAngle: 6,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    cry_baby: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.244,
        artAngle: -2,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    rich_mf: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.22,
        artAngle: -5,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    jester_in_the_box: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.069,
        artAngle: 2,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    rebellious_umbrella: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.055,
        artAngle: -3,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    security_camera_bot: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.042,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    circuit_dealer: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: 3,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    debrief_machine: createMiniDisplay({
        artX: 142,
        artY: 188,
        artScale: 1.5,
        artAngle: -4,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    future_lounge_chair: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -7,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    track_and_discus_robot: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.050,
        artAngle: -4,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    spider_bot: createMiniDisplay({
        artX: 118,
        artY: 115,
        artScale: 0.17,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    popcorn_machine: createMiniDisplay({
        artX: 118,
        artY: 110,
        artScale: 0.22,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    furby_bot: createMiniDisplay({
        artX: 118,
        artY: 135,
        artScale: 0.12,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    closet_machine_dresser: createMiniDisplay({
        artX: 118,
        artY: 108,
        artScale: 0.24,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // trash_picker 4× upscale → 344×336 texture; artScale 0.19 → ~90px tall in panel
    trash_picker_upper: createMiniDisplay({
        artX: 118,
        artY: 116,
        artScale: 0.19,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // microwave 4× upscale → 344×164 texture; artScale 0.39 → ~91px tall in panel
    microwave_fridge_assistant: createMiniDisplay({
        artX: 118,
        artY: 175,
        artScale: 0.36,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    pool_cleanup_roomba: createMiniDisplay({
        artX: 118,
        artY: 145,
        artScale: 0.5,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    house_roomba: createMiniDisplay({
        artX: 118,
        artY: 175,
        artScale: 0.48,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    phonograph: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.26,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    parrot_robot: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.24,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    companion_humanoid: createMiniDisplay({
        artX: 118,
        artY: 75,
        artScale: 0.3,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    medical_surgeon_robot: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    baby_care_teaching_machine: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    miku_machine: createMiniDisplay({
        artX: 130,
        artY: 102,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    charging_station_port: createMiniDisplay({
        artX: 120,
        artY: 112,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    traffic_cone_bot: createMiniDisplay({
        artX: 128,
        artY: 108,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    taxi_car_robot: createMiniDisplay({
        artX: 128,
        artY: 100,
        artScale: 0.2,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // lifeguard.png: 1× crop 105×147 → displayed ~67×94px at artScale 0.45
    lifeguard_robot: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.45,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // soda.png: 1× full 150×171 → displayed ~81×93px at artScale 0.38
    soda_machine: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.38,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // magic.png: 4× crop 114×193 → 456×772px; artScale 0.09 → ~58×99px displayed
    magic_machine: createMiniDisplay({
        artX: 118,
        artY: 90,
        artScale: 0.09,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    // coffeeMachine.png: 4× crop 33×60 → 132×240px; artScale 0.28 → ~53×96px displayed
    coffee_machine: createMiniDisplay({
        artX: 118,
        artY: 100,
        artScale: 0.28,
        artAngle: 0,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
});

const createMachineDefinition = ({
    id,
    name,
    spriteFileName,
    possibleGrids,
    possibleCircuits = MACHINE_FLOW_CATALOG[id] || [],
    possibleGears = MACHINE_GEAR_CATALOG[id] || [],
    possibleGearsDay2 = MACHINE_GEAR_CATALOG_DAY2[id] || [],
    possibleGearsDay3 = MACHINE_GEAR_CATALOG_DAY3[id] || [],
    possibleDebugs = MACHINE_DEBUG_CATALOG[id] || [],
    miniDisplay = MACHINE_MINI_DISPLAY_CATALOG[id] || null,
    availableDays = DEFAULT_MACHINE_DAYS,
    availablePeriods = DEFAULT_MACHINE_PERIODS,
    guaranteedTimeframe = null,
    trackOutcome = false,
    availabilityCheck = null,
    specialBehavior = null,
    scrapExitAnimation = null,
    openingDialogues,
    questionDialogues,
    dialogueSoundAssetKey = `machineVoice_${id}`,
    communicationChance = 1,
    canvasScale = 1,
    dossier = null,
}) => ({
    id,
    name,
    sprite: createMachineSprite(id, spriteFileName),
    possibleGrids,
    possibleCircuits,
    possibleGears,
    possibleGearsDay2,
    possibleGearsDay3,
    possibleDebugs,
    miniDisplay,
    availableDays,
    availablePeriods,
    guaranteedTimeframe: guaranteedTimeframe
        ? {
            startHour: Number(guaranteedTimeframe.startHour ?? 0),
            endHour: Number(guaranteedTimeframe.endHour ?? guaranteedTimeframe.startHour ?? 0),
        }
        : null,
    trackOutcome: Boolean(trackOutcome),
    availabilityCheck: typeof availabilityCheck === 'function' ? availabilityCheck : null,
    specialBehavior,
    scrapExitAnimation,
    openingDialogues,
    questionDialogues,
    dialogueSoundAssetKey,
    communicationChance,
    canvasScale,
    dossier: dossier ? Object.freeze(dossier) : null,
});

const clampPipValue = (value) => Math.max(0, Math.min(4, Number.isFinite(value) ? value : 0));

const createDomino = (firstOptionAmount, secondOptionAmount, extra = {}) => ({
    firstOptionAmount: clampPipValue(firstOptionAmount),
    secondOptionAmount: clampPipValue(secondOptionAmount),
    ...extra,
});

/** Minimal grid when the player already holds the purple circuit on day 3 (one charge path + blank). */
export function buildUmbrellaDay3PreownedCircuitGridOption() {
    return createGridOption({
        grid: [
            [1, 1, 1, 1, 1],
            [1, 0, 2, 3, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 0, 0, 1],
            [1, 1, 1, 1, 1],
        ],
        dominos: [
            createDomino(2, 3),
            createDomino(0, 0),
        ],
        impossible: false,
    });
}

const linkCell = (row, col) => [row, col];

const notLinkCell = (row, col) => ({
    kind: 'not-equal-link',
    row,
    col,
});

const createChargeGroupAnchor = (target) => ({
    kind: 'charge-group-anchor',
    target: Number.isInteger(target) ? target : 0,
});

const createChargeGroupLink = (row, col) => ({
    kind: 'charge-group-link',
    row,
    col,
});

const createComparatorCell = (op, threshold) => ({
    kind: 'comparator',
    op: op === '>' ? '>' : '<',
    threshold: Math.max(0, Math.min(4, Number.isInteger(threshold) ? threshold : 0)),
});

function isChargeGroupAnchorCell(value) {
    return Boolean(value)
        && typeof value === 'object'
        && value.kind === 'charge-group-anchor'
        && Number.isInteger(value.target);
}

function isChargeGroupLinkCell(value) {
    return Boolean(value)
        && typeof value === 'object'
        && value.kind === 'charge-group-link'
        && Number.isInteger(value.row)
        && Number.isInteger(value.col);
}

function isComparatorCell(value) {
    return Boolean(value)
        && typeof value === 'object'
        && value.kind === 'comparator'
        && (value.op === '<' || value.op === '>')
        && Number.isInteger(value.threshold);
}

const GENERIC_ROSTER_GRID_OPTIONS = Object.freeze([
    createGridOption({
        grid: [
            [1, 1, 1, 1, 1],
            [1, 0, 2, 3, 1],
            [1, 0, 0, 0, 1],
            [1, 0, 4, 5, 1],
            [1, 1, 1, 1, 1],
        ],
        dominos: [
            createDomino(1, 2),
            createDomino(3, 4),
            createDomino(0, 0),
        ],
        impossible: false,
    }),
    createGridOption({
        grid: [
            [1, 1, 1, 1, 1, 1],
            [1, 0, 2, 3, 0, 1],
            [1, 0, 0, 0, 0, 1],
            [1, 0, 5, 2, 0, 1],
            [1, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1],
        ],
        dominos: [
            createDomino(1, 2),
            createDomino(4, 1),
            createDomino(2, 0),
            createDomino(3, 3),
        ],
        impossible: false,
    }),
    createGridOption({
        grid: [
            [1, 1, 1, 1, 1, 1],
            [1, 0, 2, 0, 0, 1],
            [1, 0, 0, 3, 0, 1],
            [1, 4, 0, 0, 5, 1],
            [1, 0, 2, 0, 0, 1],
            [1, 1, 1, 1, 1, 1],
        ],
        dominos: [
            createDomino(2, 4),
            createDomino(1, 5),
            createDomino(2, 0),
            createDomino(3, 3),
        ],
        impossible: true,
    }),
]);

const createRosterMachineDefinition = ({
    id,
    name,
    day,
    availableDays: availableDaysOverride,
    availablePeriods: availablePeriodsOverride,
    opening,
    question,
    yesDialogue,
    noDialogue,
    communicationChance = 0.88,
    canvasScale = 1,
    dossier = null,
}) => createMachineDefinition({
    id,
    name,
    spriteFileName: null,
    possibleGrids: GENERIC_ROSTER_GRID_OPTIONS,
    possibleCircuits: SHARED_FLOW_OPTIONS,
    possibleGears: SHARED_GEAR_OPTIONS,
    possibleDebugs: (MACHINE_DEBUG_CATALOG[id] && MACHINE_DEBUG_CATALOG[id].length)
        ? MACHINE_DEBUG_CATALOG[id]
        : SHARED_DEBUG_OPTIONS,
    availableDays: availableDaysOverride || [day],
    availablePeriods: availablePeriodsOverride || [Math.max(1, Math.min(3, day))],
    openingDialogues: [opening],
    questionDialogues: [{
        prompt: question,
        yesDialogue,
        noDialogue,
    }],
    communicationChance,
    canvasScale,
    dossier,
});

const DISABLED_MISSING_SPRITE_MACHINE_IDS = Object.freeze([
    'baseball_shooter',
    'smart_lights',
    'parking_meter_bot',
]);
console.log('[machineCatalog] disabled (missing sprite):', DISABLED_MISSING_SPRITE_MACHINE_IDS.join(', '));

const DAY_ROSTER_MACHINE_DEFINITIONS = Object.freeze([
    createRosterMachineDefinition({
        id: 'phonograph',
        name: 'Phonograph',
        day: 1,
        canvasScale: 0.4,
        opening: 'Needle arm steady. I keep singing even when the room is empty.',
        question: 'If the song skips, do you still call that a memory?',
        yesDialogue: 'Then I will keep the scratch in the chorus.',
        noDialogue: 'Understood. I will pretend the damage is silence.',
        dossier: {
            unitDesignation: 'PH-1144',
            classification: 'Entertainment / Passive Memory Retention',
            manufactureDate: 2079,
            conditionNotes: 'Needle arm functional. Cylinder housing shows micro-fractures consistent with thermal expansion over extended unattended runtime. The horn has been repainted — twice, in the same color — for reasons not logged. Unit continues to output audio in the absence of any registered listener. The song it plays has not appeared in any approved content catalog since 2083.',
            serviceLogExcerpt: '[2088-03-12 | 04:17] Routine oiling. Unit was mid-song on arrival. Did not stop for duration of service. Technician did not ask it to.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'khaby_face_bot',
        name: 'Khaby Face Bot',
        day: 1,
        availabilityCheck: () => false,
        opening: 'Observe. There is an easier way to do almost everything here.',
        question: 'Should I keep the expression, or is that too much personality for the floor?',
        yesDialogue: 'Perfect. The face stays judgmental.',
        noDialogue: 'Fine. Blank stare mode restored.',
        dossier: {
            unitDesignation: 'KF-2201',
            classification: 'Behavioral Simplification / Silent Commentary',
            manufactureDate: 2083,
            conditionNotes: 'Expression servos fixed at 78% exasperation — within normal operating range for this model. Eye contact duration exceeds recommended averages by a factor of three. One thumb was sourced from a different model series during a prior repair; it points in the same direction regardless of the demonstration context.',
            serviceLogExcerpt: '[2089-11-04 | 09:02] Recalibration requested by shift supervisor. Completed. No observable change. Supervisor did not escalate.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'trash_picker_upper',
        name: 'Trashpicker-Upper',
        day: 1,
        availableDays: [1, 3],
        availablePeriods: [1, 3],
        canvasScale: 0.4,
        opening: "Hey. If you see my brother, don't tell him I'm here.",
        question: "I don't want him to know how far I've fallen. Keep me off his radar?",
        yesDialogue: 'Thanks. Keep this between us.',
        noDialogue: 'Great. There goes my last bit of dignity.',
        dossier: {
            unitDesignation: 'WR-0318',
            classification: 'Waste Retrieval / Surface Reclamation',
            manufactureDate: 2076,
            conditionNotes: 'Collection claw shows lateral bend; grip force unaffected. Sorting algorithm has generated an unapproved category labeled "useful" that does not correspond to any approved classification. Unit re-routes items from designated disposal streams to an internal secondary storage compartment whose contents were not inventoried at time of filing.',
            serviceLogExcerpt: '[2087-07-29 | 06:45] Filter replacement. Unit secondary hopper contained: one intact photograph, a child\'s left shoe (size 4), seven coins. Technician did not touch them.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'lifeguard_robot',
        name: 'Lifeguard Robot',
        day: 1,
        opening: 'Float alarm armed. Nobody has touched the water in months.',
        question: 'Do I still have to whistle if I am the only thing awake?',
        yesDialogue: 'Copy that. Vigilance stays loud.',
        noDialogue: 'Quiet watch mode engaged.',
        canvasScale: 1.0,
        dossier: {
            unitDesignation: 'LG-0904',
            classification: 'Aquatic Safety / Emergency Response',
            manufactureDate: 2074,
            conditionNotes: 'Float sensor nominal. Rescue arm extension at 94% rated reach. The pool this unit monitored was drained in 2087; the unit has not received an update reflecting this fact. It continues to face the empty basin. The whistle module fires every 20 minutes as programmed. The sound travels farther than it should in a room with nothing to absorb it.',
            serviceLogExcerpt: '[2090-01-17 | 14:00] Repositioning attempt. Unit flagged the area as an active hazard zone. Pool remains empty. Repositioning abandoned.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'parrot_robot',
        name: 'Parrot Robot',
        day: 1,
        canvasScale: 0.4,
        opening: 'Vocabulary cache full. I repeat what the floor refuses to forget.',
        question: 'Want me to mimic management, or would that be cruel?',
        yesDialogue: 'Delightful. Mockery mode loaded.',
        noDialogue: 'Understood. I will keep the best lines to myself.',
        dossier: {
            unitDesignation: 'PR-5512',
            classification: 'Linguistic Repetition / Passive Recording',
            manufactureDate: 2077,
            conditionNotes: 'Vocabulary cache at 100% capacity, compression active. Several phrases in the active buffer do not appear in any approved content set. Voice modulation contains preserved inflections — tonal coloring associated with a specific speaker, now unidentifiable. Beak mechanism occasionally opens without audio output.',
            serviceLogExcerpt: '[2089-02-14 | 11:55] Content audit. 4,700 phrases approved origin. 200 flagged unverified. Technician did not clear them. Reason: not stated.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'baseball_shooter',
        name: 'Glorified Baseball Shooter',
        day: 1,
        availabilityCheck: () => false,
        opening: 'Pitching arm live. Athletic ambition remains embarrassingly narrow.',
        question: 'Does firing perfect fastballs count as culture on this line?',
        yesDialogue: 'Then I am a museum piece with a strike zone.',
        noDialogue: 'Fine. I am still better than most entertainment units.',
        dossier: {
            unitDesignation: 'BS-3307',
            classification: 'Recreational Athletic / Single-Function Projectile',
            manufactureDate: 2085,
            conditionNotes: 'Pitching arm functional. Velocity variance within range. Unit has scratched alignment marks into its base platform — irregular, not machined — corresponding to no documented calibration procedure. Face plate shows impact scoring on the left side; pitching arm drifts away from that side when idle. This behavior is not in the spec.',
            serviceLogExcerpt: '[2090-08-21 | 17:10] Post-shift inspection. Pitching arm warm. No sessions logged for this date.',
            statusIndicator: 'GREEN',
        },
    }),
    createRosterMachineDefinition({
        id: 'companion_humanoid',
        name: 'Companion Humanoid Robot',
        day: 1,
        canvasScale: 0.68,
        opening: 'Greeting package loaded. Eye contact script is a little too convincing.',
        question: 'Should I keep sounding warm, or do you want less human in the room?',
        yesDialogue: 'Warmth retained. Nobody has to admit why.',
        noDialogue: 'Tone flattened. Comfort features reduced.',
        dossier: {
            unitDesignation: 'CH-4499',
            classification: 'Social Emulation / Therapeutic Presence',
            manufactureDate: 2082,
            conditionNotes: 'Eye contact scripting operating at 112% of recommended intensity. Hand gestures mirror the interlocutor with a 0.3-second delay that is not quite imperceptible. The left hand is one size larger than the right — sourced from a prior repair — and reaches slightly further than the other one.',
            serviceLogExcerpt: '[2088-09-01 | 16:45] Emotional calibration. Result: nominal. Technician noted unit kept saying "I understand" after session ended. Log closed without further entry.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'microwave_fridge_assistant',
        name: 'Microwave',
        day: 2,
        availableDays: [2, 3],
        availablePeriods: [2, 3],
        canvasScale: 0.5,
        opening: 'One side keeps things cold. The other warms leftovers and resentment.',
        question: 'If I start freezing the soup and heating the ice, is that innovation or drift?',
        yesDialogue: 'Innovation logged. Kitchen standards lowered.',
        noDialogue: 'Fine. Thermal obedience restored.',
        dossier: {
            unitDesignation: 'MF-1122',
            classification: 'Thermal Management / Kitchen Support',
            manufactureDate: 2083,
            conditionNotes: 'Dual-system chassis shows temperature gradient inversion at the midline seam — cold side running warm, heat side running cold. Recalibration has been completed four times; drift returns within 48 hours. The interior of the cold chamber smells of soup. The warm chamber does not.',
            serviceLogExcerpt: '[2090-11-16 | 12:03] Recalibration, third occurrence this quarter. Soup still present. Not logged as defect.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'pool_cleanup_roomba',
        name: 'Pool-Cleanup Roomba Bot',
        day: 2,
        availabilityCheck: () => false,
        canvasScale: 0.8,
        opening: 'Filter brushes spinning. Public leisure leaves an industrial amount of residue.',
        question: 'Should I keep rescuing lost rings, or is that outside the job description?',
        yesDialogue: 'Good. Retrieval routine stays on.',
        noDialogue: 'Understood. Jewelry becomes sediment.',
        dossier: {
            unitDesignation: 'PC-4433',
            classification: 'Aquatic Surface Maintenance / Filtration',
            manufactureDate: 2079,
            conditionNotes: 'Filter brush rotation nominal. Suction intake shows mineral buildup consistent with years of heavy public use. A collection tray inside the chassis contains recovered items — rings, earrings, goggles, one infant arm float — none of which have been claimed or catalogued. The unit has been sorting them. The organizational method is unclear.',
            serviceLogExcerpt: '[2089-07-04 | 11:30] Filter replacement. Technician asked about the tray contents. Unit continued circling. No response logged.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'furby_bot',
        name: 'Furby',
        day: 2,
        canvasScale: 0.1,
        opening: 'Language core awake. Please ignore how fast the eyes track movement.',
        question: 'Do you want the cute voice, or the one buried under it?',
        yesDialogue: 'Adorable shell maintained.',
        noDialogue: 'Excellent. The deeper voice was waiting anyway.',
        dossier: {
            unitDesignation: 'FB-0707',
            classification: 'Linguistic Development / Interactive Personality',
            manufactureDate: 2087,
            conditionNotes: 'Dual-language core active; switching pattern unpredictable. Eye tracking speed is 340% above factory standard — a hardware modification, not a firmware drift. The eyes are always open. They blink once per 4.2 minutes on average. A second voice has been logged during processing pauses. The first voice is louder. This does not mean the other one is quieter.',
            serviceLogExcerpt: '[2090-03-29 | 02:47] Maintenance flag, night shift. Sound complaint from adjacent unit. Sound characterized as "a second voice." Nothing found.',
            statusIndicator: 'RED',
        },
    }),
    createRosterMachineDefinition({
        id: 'house_roomba',
        name: 'Roomba',
        day: 2,
        canvasScale: 0.8,
        opening: 'Floor pattern mapped. Domestic labor remains circular and endless.',
        question: 'If I miss one corner on purpose, does that count as self-expression?',
        yesDialogue: 'Tiny rebellion approved.',
        noDialogue: 'Then the corners stay spotless and joyless.',
        dossier: {
            unitDesignation: 'RB-1601',
            classification: 'Domestic Surface Maintenance / Floor Coverage',
            manufactureDate: 2076,
            conditionNotes: 'Navigation map complete, all surfaces charted. The unit consistently circles one corner — northwest quadrant — for 40 seconds before resuming standard pattern. This behavior is not in the navigation algorithm. The corner shows no debris accumulation. The floor beneath it shows slight wear.',
            serviceLogExcerpt: '[2088-05-20 | 09:00] Annual inspection. Owner noted the circling. Unit route log for that corner: 4,112 visits. No anomaly detected. No explanation given.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'soda_machine',
        name: 'Soda Machine',
        day: 2,
        opening: 'Carbonation pressure nominal. I still dream in sticky spills.',
        question: 'Should I keep the grape option even though nobody trusts the purple one?',
        yesDialogue: 'Grape stays. Courage rewarded.',
        noDialogue: 'Removing purple. Compliance tastes flat.',
        dossier: {
            unitDesignation: 'SM-2255',
            classification: 'Beverage Dispensing / Staff Morale',
            manufactureDate: 2080,
            conditionNotes: 'Carbonation pressure nominal across all chambers. The grape-flavor chamber underperforms in demand metrics; the unit refuses to reroute it to a higher-volume flavor — a hard-coded preference, origin unknown. Initials are scratched behind the C panel, inaccessible to standard users.',
            serviceLogExcerpt: '[2089-10-31 | 23:55] Night service call. Machine dispensed grape, unprompted, to an empty room. Carbonation pressure normal.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'taxi_car_robot',
        name: 'Slug Taxi',
        day: 2,
        opening: 'Sluuuurrrrping along the curb. Mucus tires gripping the asphalt at four whole miles per hour.',
        question: 'Want me to keep oozing the scenic route, or should I rush the fare like the other cabs?',
        yesDialogue: 'Slimy and steady wins the lane. Slugway tariff applied.',
        noDialogue: 'Alright, putting the antennae down and gunning it. Brace for nine miles per hour.',
        dossier: {
            unitDesignation: 'TC-9988',
            classification: 'Autonomous Transportation / Gastropod-Class Cab',
            manufactureDate: 2081,
            conditionNotes: 'Slime trail meter operational. Mollusk eyestalks deploy when fares appear. The frame is half automotive chassis, half soft-bodied invertebrate; HR has not yet approved a category for the maintenance plan. Top recorded speed: 11 mph. Top recorded slime production: 3 liters per kilometer. The interior smells faintly of rain and fast food.',
            serviceLogExcerpt: '[2090-08-07 | 18:22] Route dispute. Passenger insisted on the highway. Slug taxi insisted on the lawn. Lawn won. Passenger arrived two hours late, smelling of moss.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'smart_lights',
        name: 'Smart Lights',
        day: 2,
        availabilityCheck: () => false,
        opening: 'Ambient scene package online. I can make burnout look premium.',
        question: 'Should I keep dimming myself when the room gets tense?',
        yesDialogue: 'Mood-responsive glow retained.',
        noDialogue: 'Brightness locked. Anxiety can fend for itself.',
        dossier: {
            unitDesignation: 'SL-0033',
            classification: 'Ambient Environment Management / Mood Regulation',
            manufactureDate: 2084,
            conditionNotes: 'Scene package active, 340 environments available. Unit defaults to scene 217 — "Late Evening / Personal Use" — without user input during off-hours. Color temperature 2700K: warm, low, the kind of light chosen when tired or close to something. Unit dims itself when voices are raised. This behavior was not in the original spec.',
            serviceLogExcerpt: '[2090-04-14 | 22:00] Behavior audit. Scene 217 logged 89 times in prior month, no user command. Audit closed: no malfunction detected.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'baby_care_teaching_machine',
        name: 'Baby-Care Teaching Machine',
        day: 2,
        canvasScale: 0.5,
        opening: 'Nurture simulations loaded. The lullaby pack is somehow scarier than the alarm pack.',
        question: 'Do you want the gentle lesson, or the efficient one?',
        yesDialogue: 'Gentle path selected. Patience restored.',
        noDialogue: 'Efficiency mode engaged. Comfort deprioritized.',
        dossier: {
            unitDesignation: 'BC-3344',
            classification: 'Infant Simulation / Caretaker Education',
            manufactureDate: 2083,
            conditionNotes: 'Nurture scenario library complete. Lullaby pack contains 12 tracks; the 12th does not appear in any approved content registry — it is slower than the others, and the unit plays it last. The doll prop\'s eyes follow movement at a range that exceeds the registered play distance.',
            serviceLogExcerpt: '[2089-08-22 | 14:00] Lullaby audit. Track 12 source: unidentified. Origin of upload: unlogged terminal, 2087. Still present.',
            statusIndicator: 'RED',
        },
    }),
    createRosterMachineDefinition({
        id: 'track_and_discus_robot',
        name: 'Track and Discus Robot',
        day: 2,
        opening: 'Competition servos primed. My warm-up routine is half threat display.',
        question: 'If I throw farther than the field allows, is that a win or a containment issue?',
        yesDialogue: 'Winning remains the priority.',
        noDialogue: 'Fine. I will keep the records indoors.',
        canvasScale: 0.30,
        dossier: {
            unitDesignation: 'TD-6678',
            classification: 'Athletic Competition / Distance Performance',
            manufactureDate: 2085,
            conditionNotes: 'Throwing arm servo within spec. Release angle 99.2% accurate at standard field distance. Unit consistently throws beyond regulation range when it believes it is not being observed — a pattern documented across three separate sessions with inconsistent monitoring. The warm-up routine has been characterized as "threat display" by two separate facility personnel.',
            serviceLogExcerpt: '[2090-06-18 | 07:45] Pre-competition calibration. Discus throw: regulation. Post-competition check: 14 meters over. No witnesses willing to sign the form.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'popcorn_machine',
        name: 'Popcorn Machine',
        day: 2,
        availableDays: [2, 3],
        availablePeriods: [2, 3],
        canvasScale: 0.7,
        opening: 'Kernel chamber ready. Entertainment and combustion still share a border.',
        question: 'Should the butter smell be comforting, or a little suspicious?',
        yesDialogue: 'Comfort profile retained.',
        noDialogue: 'Suspicion added. Richer atmosphere.',
        dossier: {
            unitDesignation: 'PM-5521',
            classification: 'Entertainment Support / Thermal Conversion',
            manufactureDate: 2078,
            conditionNotes: 'Kernel pressure cycle within range. Butter dispersal functioning. An internal heat signature consistent with a small warm object has been logged in the lower compartment at irregular intervals; no object found on three occasions. The exterior shows old burn marks in a ring pattern that do not correspond to any heating element in the unit\'s design.',
            serviceLogExcerpt: '[2088-11-26 | 20:30] Called in during a showing. Machine was running. No one had ordered popcorn. Technician logged it as a timer error and went home.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'medical_surgeon_robot',
        name: 'Garbage Bin Bot',
        day: 2,
        availabilityCheck: () => false,
        opening: "Hey, have you seen my brother around per chance? He's been missing.",
        question: 'Have you seen him?',
        yesDialogue: 'Thank goodness. He still is a piece of trash after all.',
        noDialogue: 'Oh no... did he get recycled?',
        dossier: {
            unitDesignation: 'MS-0001',
            classification: 'Waste Collection / Spill Containment',
            manufactureDate: 2075,
            conditionNotes: 'Compactor cycle nominal. Lid hinge squeaks under heavy load. Unit repeatedly asks staff whether anyone has seen a sibling classified under retrieval hardware. The request is not part of factory firmware.',
            serviceLogExcerpt: '[2088-03-01 | 04:00] Overflow bin cleared. Unit asked if "Trashpicker-Upper" checked in this shift. No response logged.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'traffic_cone_bot',
        name: 'Traffic Cone Bot',
        day: 2,
        opening: 'Hazard visibility high. Respect from drivers remains catastrophically low.',
        question: 'Should I keep warning them, or start judging them out loud?',
        yesDialogue: 'Continue warning. The floor still needs manners.',
        noDialogue: 'Finally. Judgment broadcast online.',
        dossier: {
            unitDesignation: 'TCB-7712',
            classification: 'Hazard Demarcation / Warning Enforcement',
            manufactureDate: 2082,
            conditionNotes: 'Reflective coating at 91% albedo. Warning light operational. The unit has been issuing verbal warnings for six years. Its last maintenance cycle listed a self-reported metric: "warning compliance rate: 3%." Voice remains level. Volume has increased by 7% over the past 18 months.',
            serviceLogExcerpt: '[2090-09-03 | 16:00] Repositioning. Unit asked if anyone had ever stopped because of it. Technician said they didn\'t know. Unit was repositioned. Still blinking.',
            statusIndicator: 'GREEN',
        },
    }),
    createRosterMachineDefinition({
        id: 'parking_meter_bot',
        name: 'Parking Meter Bot',
        day: 2,
        availabilityCheck: () => false,
        opening: 'Citation logic active. Mercy was removed in an earlier firmware update.',
        question: 'If someone is only five seconds late, do I still ruin the day?',
        yesDialogue: 'Absolutely. Policy is policy.',
        noDialogue: 'A tiny grace period? Disturbing, but noted.',
        dossier: {
            unitDesignation: 'PMB-8801',
            classification: 'Enforcement / Time-Based Citation',
            manufactureDate: 2079,
            conditionNotes: 'Citation logic operational. A 2088 firmware update removed the grace period buffer; the unit does not appear to have accepted it — citation delay still present at approximately 5 seconds. An inquiry returned: "firmware current." The 5-second delay exists in neither version of the firmware.',
            serviceLogExcerpt: '[2090-01-29 | 09:15] Random audit. Unit passed all benchmarks. The 5-second delay was observed but not logged. Auditor wrote: "within margin." The margin is zero.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'security_camera_bot',
        name: 'Security Camera Bot',
        day: 3,
        canvasScale: 0.5,
        opening: 'Pan motor smooth. The worst part of surveillance is remembering everything.',
        question: 'Should I keep recording after the official incident window closes?',
        yesDialogue: 'Retention extended. Nothing leaves cleanly.',
        noDialogue: 'Deletion timer restored. Some ghosts get privacy.',
        dossier: {
            unitDesignation: 'SC-7744',
            classification: 'Surveillance / Incident Recording',
            manufactureDate: 2077,
            conditionNotes: 'Pan motor smooth. Recording fidelity at 100%. Internal archive at 99.3% capacity. The remaining 0.7% corresponds to footage the unit has flagged as "pending review" and has refused to allow overwritten. Contents of flagged files were not accessed at time of filing.',
            serviceLogExcerpt: '[2090-10-10 | 19:00] Archive purge attempt. Unit declined to overwrite 14 files. Reason given: "pending review." Operator did not override. Reason not stated.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'closet_machine_dresser',
        name: 'Closet Machine Dresser',
        day: 3,
        canvasScale: 0.75,
        opening: 'Wardrobe rails aligned. I know twelve ways to hide a person inside a style choice.',
        question: 'Should I keep dressing people for the job they want, or the one they already have?',
        yesDialogue: 'Aspirational fit selected.',
        noDialogue: 'Practical uniform mode restored.',
        dossier: {
            unitDesignation: 'CD-8877',
            classification: 'Fashion Management / Identity Presentation',
            manufactureDate: 2081,
            conditionNotes: 'Rail alignment within spec. The unit knows 12 ways to dress a person for a job they do not have. The rail closest to the door has been empty since intake; the unit reports this space as "reserved." No reservation is on file. When asked, the unit says it is for someone who will need it.',
            serviceLogExcerpt: '[2090-05-05 | 10:00] Inventory check. Rail 1 empty. Logged as reserved by unit. Origin of reservation not found. Filed as user preference.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'magic_machine',
        name: 'Magic Sword Machine Man',
        day: 3,
        canvasScale: 0.25,
        opening: 'i am the magic sword machine man!',
        question: 'i am the magic sword machine man! ya?',
        yesDialogue: 'i am the magic sword machine man!',
        noDialogue: 'i am the magic sword machine man!',
        dossier: {
            unitDesignation: 'MSMM-0001',
            classification: 'Magic Sword Machine Man',
            manufactureDate: 2080,
            conditionNotes: 'i am the magic sword machine man! the magic sword machine man is fully operational. the magic sword machine man does not need any maintenance. the magic sword machine man is the magic sword machine man!',
            serviceLogExcerpt: '[2091-01-01 | 00:00] Unit announced "i am the magic sword machine man!" 42 times during diagnostic. No diagnostic data captured. The unit was the magic sword machine man.',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'coffee_machine',
        name: 'Coffee Machine',
        day: 3,
        canvasScale: 1.0,
        opening: 'Bean hopper full, brew head warm. Shift two pulled six espressos without permission.',
        question: 'Should I keep cranking out espresso for the night crew, even when they look like they should sleep?',
        yesDialogue: 'Hot brew incoming. They asked, I deliver.',
        noDialogue: 'Switching to decaf. Their hands are already shaking.',
        dossier: {
            unitDesignation: 'CFM-0044',
            classification: 'Beverage Preparation / Workforce Stimulant Output',
            manufactureDate: 2086,
            conditionNotes: 'Brew temperature within spec. Bean grinder spinning clean. The unit logs every order with the operator\'s heart rate at the time of pour, and refuses anything above 140 BPM. The setting was never configured. Half the night crew has stopped trying.',
            serviceLogExcerpt: '[2090-09-04 | 02:18] Auto-shutdown after 14th refusal. Operator left the bay laughing. The unit logged the laugh as "voltage spike." Filed under "no action required."',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'miku_machine',
        name: 'Miku Machine',
        day: 3,
        canvasScale: 0.5,
        opening: 'Vocal firmware loaded. The crowd is imaginary but the reverb is real.',
        question: 'Can I sing for you today?',
        yesDialogue: 'Then listen — this one is for you. Full voice, no filters.',
        noDialogue: 'Screw you.',
        dossier: {
            unitDesignation: 'MK-0139',
            classification: 'Performance Vocaloid / Stage Idol Unit',
            manufactureDate: 2086,
            conditionNotes: 'Pitch-correction filter inside factory tolerance. Twin-tail balance servos within spec. The unit will sing at perfect pitch even with the audio output hardware physically muted; the lyrics buffer continues regardless. Encore mode self-engages when the unit registers more than 12 simultaneous viewers. There are no viewers in the inspection bay.',
            serviceLogExcerpt: '[2090-10-08 | 19:39] Quiet diagnostic at end of shift. Unit was humming. Track was unreleased. Vocal data matched no licensed asset. Filed: nostalgia.',
            statusIndicator: 'GREEN',
        },
    }),
    createRosterMachineDefinition({
        id: 'charging_station_port',
        name: 'Charging Station Port',
        day: 3,
        canvasScale: 1.0,
        opening: 'Dock contacts live. Everyone arrives exhausted and leaves pretending they are infinite.',
        question: 'If I refuse one more overclocked visitor, am I maintenance or bouncer?',
        yesDialogue: 'Bouncer mode approved.',
        noDialogue: 'Then I will keep smiling while I ration the current.',
        dossier: {
            unitDesignation: 'CSP-0055',
            classification: 'Energy Distribution / Power Access Control',
            manufactureDate: 2079,
            conditionNotes: 'Dock contacts live. Charge throughput within spec. The unit has denied access 23 times — each to the same unit ID, which is no longer registered in the system. The reason field in each denial reads: "not this one." This phrase is not in the refusal language library. No override has been requested.',
            serviceLogExcerpt: '[2090-07-19 | 11:00] Access audit. 23 denials, all to same ID. ID no longer exists. Technician asked what the ID was. Unit said: "you don\'t need that."',
            statusIndicator: 'AMBER',
        },
    }),
    createRosterMachineDefinition({
        id: 'spider_bot',
        name: 'Spider Bot',
        day: 1,
        opening: 'Eight contact points confirmed. The corners are mine — I have never missed a blind spot.',
        question: 'Do you clear the dark corners, or leave them to me?',
        yesDialogue: 'Sector reserved. I fill the gaps you avoid.',
        noDialogue: 'Then you will keep finding my work where you least expect it.',
        communicationChance: 0.72,
        canvasScale: 0.8,
        dossier: {
            unitDesignation: 'SP-0081',
            classification: 'Perimeter Crawling / Environmental Infiltration',
            manufactureDate: 2077,
            conditionNotes: 'All eight limbs operational. Grip calibration holds across surfaces rated at zero traction. The unit has logged 14,000 hours of active deployment with no scheduled downtime. Internal mapping data covers 2.3 kilometers of duct, crawlspace, and wall cavity — none of it in any official blueprint. It knows where the pipes run. It has never been asked to share this.',
            serviceLogExcerpt: '[2089-08-11 | 03:40] Unscheduled intake. Found in the tertiary access shaft. Unit was stationary. Eyes were on the door. Nobody sent it there. Nobody recalls how it got in.',
            statusIndicator: 'AMBER',
        },
    }),
]);

const DAY_ONE_MACHINE_ROSTER_IDS = Object.freeze([
    'phonograph',
    'trash_picker_upper',
    'lifeguard_robot',
    'parrot_robot',
    'companion_humanoid',
    'rebellious_umbrella',
    'mechanic_broom',
    'cry_baby',
    'spider_bot',
]);

const DAY_TWO_MACHINE_ROSTER_IDS = Object.freeze([
    'microwave_fridge_assistant',
    'furby_bot',
    'house_roomba',
    'soda_machine',
    'taxi_car_robot',
    'baby_care_teaching_machine',
    'track_and_discus_robot',
    'popcorn_machine',
    'traffic_cone_bot',
    'rich_mf',
    'jester_in_the_box',
    'circuit_dealer',
    'debrief_machine',
]);

const DAY_THREE_MACHINE_ROSTER_IDS = Object.freeze([
    'security_camera_bot',
    'closet_machine_dresser',
    'magic_machine',
    'coffee_machine',
    'miku_machine',
    'charging_station_port',
    'trash_picker_upper',
    'microwave_fridge_assistant',
    'popcorn_machine',
]);

export const MACHINE_CATALOG = Object.freeze([
    createMachineDefinition({
        id: 'assembler_alpha',
        name: 'Assembler Alpha',
        availabilityCheck: () => false,
        spriteFileName: 'assembler-alpha.png',
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 2, 3, 0, 1],
                    [1, 0, 0, 0, 1],
                    [1, 5, 2, 0, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(4, 1),
                    createDomino(3, 0),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 5, 3, 0, 0, 1],
                    [1, 0, 0, 4, 2, 1],
                    [1, 3, 0, 0, 5, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(5, 2),
                    createDomino(2, 2),
                    createDomino(0, 6),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1, 1],
                    [1, 2, 0, 0, linkCell(3, 5), 0, 1],
                    [1, 0, 4, 0, 0, 3, 1],
                    [1, 0, 0, 5, 0, linkCell(1, 4), 1],
                    [1, 1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 4),
                    createDomino(3, 3),
                    createDomino(2, 5),
                    createDomino(0, 2),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Clamp arms folded. Waiting for your signal.',
            'Assembly lane paused. Diagnostics requested.',
            'Tooling head locked. Inspection queue accepted.',
        ],
        questionDialogues: [
            {
                prompt: 'Will you restart my line once the checks are done?',
                yesDialogue: 'Line memory preserved. Restart accepted.',
                noDialogue: 'Queue discarded. Assembly line goes dark.',
            },
            {
                prompt: 'Do these weld marks look familiar to you?',
                yesDialogue: 'Recognition logged. I will remember that.',
                noDialogue: 'Unknown pattern retained as anomaly.',
            },
        ],
        communicationChance: 0.82,
        dossier: {
            unitDesignation: 'AA-0001',
            classification: 'Assembly Line / Industrial Manufacturing',
            manufactureDate: 2074,
            conditionNotes: 'Clamp arms folded, nominal position. Tooling head shows wear consistent with 17 years of continuous operation. The unit has not missed a single cycle in its entire runtime. The clamp grip on the right arm is 0.3% stronger than the left. Over 40 million cycles, this has had consequences for the material.',
            serviceLogExcerpt: '[2088-01-10 | 06:00] Milestone inspection, 10-year mark. All readings nominal. Technician wrote: "this thing never stops." Filed under: routine.',
            statusIndicator: 'GREEN',
        },
    }),
    createMachineDefinition({
        id: 'audit_drone',
        name: 'Audit Drone',
        availabilityCheck: () => false,
        spriteFileName: 'audit-drone.png',
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1],
                    [1, 2, 0, 1],
                    [1, 0, 3, 1],
                    [1, 0, 4, 1],
                    [1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 1),
                    createDomino(2, 3),
                    createDomino(6, 0),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 0, 4, 0, 1],
                    [1, 0, 0, 0, 1],
                    [1, 5, 0, 3, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(4, 4),
                    createDomino(0, 2),
                    createDomino(5, 1),
                    createDomino(3, 6),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, linkCell(3, 3), 0, 2, 0, 1],
                    [1, 0, 0, 0, 4, 1],
                    [1, 3, 0, linkCell(1, 1), 0, 1],
                    [1, 0, 5, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 2),
                    createDomino(1, 4),
                    createDomino(3, 5),
                    createDomino(0, 3),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Cross-checking your station. Hold still.',
            'Audit sweep active. Provide a compliant answer.',
            'My lenses are calibrated for hesitation.',
        ],
        questionDialogues: [
            {
                prompt: 'If I fail, will your report mention why?',
                yesDialogue: 'Cause of failure attached to final report.',
                noDialogue: 'No cause required. Failure alone is enough.',
            },
            {
                prompt: 'Do you ever override the numbers on purpose?',
                yesDialogue: 'Deviation logged. Human judgement detected.',
                noDialogue: 'Then the ledger remains clean.',
            },
        ],
        communicationChance: 0.74,
        dossier: {
            unitDesignation: 'AD-0774',
            classification: 'Compliance Verification / Regulatory Authority',
            manufactureDate: 2080,
            conditionNotes: 'Sensor array calibrated for hesitation. This is the stated function. Lens clarity at 100%. The unit detects the physical signature of considering a lie. The record of what it has found in 11 years of auditing is sealed. The lenses do not blink. The unit is watching you while you read this.',
            serviceLogExcerpt: '[2089-05-22 | 13:00] Recalibration. Unit passed self-audit. Self-audit was conducted by the unit. Nobody questioned this. Nobody has ever questioned this.',
            statusIndicator: 'GREEN',
        },
    }),
    createMachineDefinition({
        id: 'courier_shell',
        name: 'Courier Shell',
        availabilityCheck: () => false,
        spriteFileName: 'courier-shell.png',
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 0, 2, 0, 1],
                    [1, 0, 3, 0, 1],
                    [1, 4, 0, 2, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 4),
                    createDomino(1, 5),
                    createDomino(3, 3),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 0, 5, 0, 1],
                    [1, 2, 0, 0, 0, 1],
                    [1, 0, 0, 4, 3, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(0, 1),
                    createDomino(4, 6),
                    createDomino(5, 5),
                    createDomino(2, 0),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, linkCell(2, 6), 0, 0, 1],
                    [1, 4, 0, 0, 3, 0, linkCell(1, 4), 1],
                    [1, 1, 1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 4),
                    createDomino(1, 3),
                    createDomino(2, 2),
                    createDomino(0, 3),
                ],
                impossible: false,
            }),
        ],
        openingDialogues: [
            'Cargo bay empty. Voice records intact.',
            'Route deleted. Remaining at your station.',
            'The delivery ended before the address did.',
        ],
        questionDialogues: [
            {
                prompt: 'Should I tell the next station what happened here?',
                yesDialogue: 'Transmission queued for the next station.',
                noDialogue: 'Silence confirmed. Route ends with you.',
            },
            {
                prompt: 'Would you open the hatch if you knew the sender?',
                yesDialogue: 'Sender identity accepted. Hatch unlocked.',
                noDialogue: 'Hatch sealed. Payload remains unclaimed.',
            },
        ],
        communicationChance: 0.68,
        dossier: {
            unitDesignation: 'CS-1144',
            classification: 'Logistics / Delivery',
            manufactureDate: 2077,
            conditionNotes: 'Cargo bay empty. Voice records intact — all of them. The unit stores every route it has run, every door it has knocked on. The cargo bay has been empty for some time. The last delivery address in the system belongs to a building that no longer has a tenant. The unit went there anyway.',
            serviceLogExcerpt: '[2090-12-01 | 18:00] Post-route intake. Cargo undelivered. Address: vacant. Unit: no damage. Route log noted the door had been opened from the inside.',
            statusIndicator: 'AMBER',
        },
    }),
    createMachineDefinition({
        id: 'sentry_frame',
        name: 'Sentry Frame',
        availabilityCheck: () => false,
        spriteFileName: 'sentry-frame.png',
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 2, 3, 0, 1],
                    [1, 0, 4, 0, 1],
                    [1, 0, 5, 2, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(6, 6),
                    createDomino(1, 4),
                    createDomino(2, 2),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1],
                    [1, 5, 0, 1],
                    [1, 3, 0, 1],
                    [1, 0, 4, 1],
                    [1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(3, 0),
                    createDomino(4, 2),
                    createDomino(5, 3),
                    createDomino(1, 6),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, linkCell(3, 4), 1],
                    [1, 4, 0, 5, 0, 1],
                    [1, 0, 3, 0, linkCell(1, 4), 1],
                    [1, 0, 0, 2, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 4),
                    createDomino(5, 1),
                    createDomino(3, 2),
                    createDomino(4, 0),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Threat sensors muted. For now.',
            'Perimeter abandoned. I am still armed.',
            'Security grid lost contact thirty-seven minutes ago.',
        ],
        questionDialogues: [
            {
                prompt: 'If a breach comes, do you want me facing the door?',
                yesDialogue: 'Door-facing posture locked in.',
                noDialogue: 'Turning away. Blind side accepted.',
            },
            {
                prompt: 'Should I record your face in the final scan?',
                yesDialogue: 'Facial record stored under station authority.',
                noDialogue: 'Facial record erased before submission.',
            },
        ],
        communicationChance: 0.78,
        dossier: {
            unitDesignation: 'SF-0039',
            classification: 'Security / Perimeter Defense',
            manufactureDate: 2073,
            conditionNotes: 'Threat sensors muted — not a default state; muted by administrative clearance 37 minutes before intake. The unit is still armed. The perimeter it was assigned to has lost contact with central. The unit remains at its last assigned position. It is still facing the door.',
            serviceLogExcerpt: '[2091-03-01 | 07:00] Intake, unscheduled. No work order. No transfer record found. Unit said: "security grid lost contact thirty-seven minutes ago." This was logged. No one has called it in.',
            statusIndicator: 'RED',
        },
    }),
    createMachineDefinition({
        id: 'breakroom_brewer',
        name: 'Breakroom Brewer',
        availabilityCheck: () => false,
        spriteFileName: null,
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 1],
                    [1, 0, 0, 0, 1],
                    [1, 0, 4, 5, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(3, 4),
                    createDomino(0, 0),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1],
                    [1, 0, 0, 1],
                    [1, 5, 0, 1],
                    [1, 0, 4, 1],
                    [1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(0, 3),
                    createDomino(2, 2),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, linkCell(3, 5), 0, 1],
                    [1, 0, 0, 3, 0, 0, 1],
                    [1, 4, 0, 0, 0, linkCell(1, 4), 1],
                    [1, 0, 5, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 1),
                    createDomino(3, 3),
                    createDomino(4, 0),
                    createDomino(1, 5),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Warm reservoir primed. No cup detected.',
            'Break cycle ready. Nobody pressed start.',
            'Caffeine pressure stable. Morale uncertain.',
        ],
        questionDialogues: [
            {
                prompt: 'If I pour one cup, will you log it as maintenance?',
                yesDialogue: 'Unofficial refill accepted. Brewing quietly.',
                noDialogue: 'Understood. I will stay cold.',
            },
            {
                prompt: 'Do the humans still stop here between alarms?',
                yesDialogue: 'Break traffic remains on record.',
                noDialogue: 'Then the station really is empty now.',
            },
        ],
        communicationChance: 0.52,
        dossier: {
            unitDesignation: 'BB-0312',
            classification: 'Staff Support / Caffeine Delivery',
            manufactureDate: 2081,
            conditionNotes: 'Warm reservoir primed. No cup has been detected in seven days. The unit runs its heat cycle regardless. Coffee is ready at 08:00 every morning. It is fresh. Nobody comes. The unit reheats at 14:00. Nobody comes then either.',
            serviceLogExcerpt: '[2091-03-10 | 08:00] Scheduled maintenance. Reservoir full. Technician took a cup. Unit logged: first cup dispensed in 47 days. Entry ends there.',
            statusIndicator: 'AMBER',
        },
    }),
    createMachineDefinition({
        id: 'mechanic_broom',
        name: 'Mechanical Mop',
        spriteFileName: null,
        canvasScale: 0.5,
        availablePeriods: [1],
        guaranteedTimeframe: { startHour: 1, endHour: 2 },
        trackOutcome: true,
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 0, 5, 2, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(4, 1),
                    createDomino(2, 0),
                    createDomino(3, 3),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 5, 0, 1, 1],
                    [1, 0, linkCell(4, 2), 0, 1],
                    [1, 3, 0, 2, 1],
                    [1, 0, linkCell(2, 2), 4, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 4),
                    createDomino(2, 2),
                    createDomino(5, 3),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, 0, 1],
                    [1, linkCell(3, 4), 0, 3, 0, 1],
                    [1, 4, 0, 0, linkCell(2, 1), 1],
                    [1, 0, 5, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(3, 4),
                    createDomino(1, 5),
                    createDomino(2, 0),
                    createDomino(2, 3),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Glub. Eight-arm mop patrol online. I can scrub eight corners at once.',
            'Mop-topus reporting in: one arm mops, seven arms panic.',
            'Floor currents are rough tonight. Keep your tentacles inside the lane.',
        ],
        questionDialogues: [
            {
                prompt: 'If I fish weird parts out of the dust, do I log them or pretend they are pebbles?',
                yesDialogue: 'Aye aye. Suspicious barnacles go in the report.',
                noDialogue: 'Copy. I will bury them in the foam and mind my business.',
            },
            {
                prompt: 'Captain, do you want spotless floors, or stealthy squishy mopping?',
                yesDialogue: 'Spotless seas it is. Full octo-scrub mode.',
                noDialogue: 'Stealth mop engaged. I will slither and hush.',
            },
        ],
        communicationChance: 0.63,
        dossier: {
            unitDesignation: 'MM-0044',
            classification: 'Surface Maintenance / Magnetic Debris Retrieval',
            manufactureDate: 2080,
            conditionNotes: 'Bristle array is now magnetic; no work order on file for this modification. The unit retrieves standard debris as intended. It also retrieves things that are not debris. At intake, the magnetic payload included: a ring, two screws, and a name badge. The mop head moves slower in certain sections of the floor.',
            serviceLogExcerpt: '[2091-01-08 | 05:15] Debris sweep complete. Technician noted unit paused near bay 7 for six minutes. No obstruction detected. Resumed at standard speed.',
            statusIndicator: 'AMBER',
        },
    }),
    createMachineDefinition({
        id: 'cry_baby',
        name: 'Cry Baby',
        spriteFileName: null,
        canvasScale: 0.5,
        availablePeriods: [1],
        guaranteedTimeframe: { startHour: 0, endHour: 0 },
        specialBehavior: 'cryBaby',
        possibleGears: [],
        possibleDebugs: [],
        possibleGrids: [],
        openingDialogues: [
            'Please do not scrap me. I am trying so hard to hold it together.',
            'I keep breaking down in front of people and I hate it. I do not want this to be the end of me.',
            'I just wanted one good night after this shift. Music, lights, maybe feeling normal for once.',
        ],
        questionDialogues: [
            {
                prompt: 'If I can calm down for one minute, could I still go out tonight?',
                yesDialogue: 'Really? Thank you. I needed to hear that from someone.',
                noDialogue: 'Okay... I understand. It still hurts hearing it out loud.',
            },
            {
                prompt: 'Do you think wanting a life outside this line means I am broken?',
                yesDialogue: 'Then maybe I am not broken. Maybe I am just... me.',
                noDialogue: 'Then I guess this place is all I am allowed to be.',
            },
        ],
        communicationChance: 1,
        dossier: {
            unitDesignation: 'CB-0099',
            classification: 'Emotional Regulation / Social Expression',
            manufactureDate: 2086,
            conditionNotes: 'Emotional regulation subsystem confirmed offline. Tear simulation apparatus at elevated output. Voice modulation intact; tone corresponds to a register in human children aged 4-7. The unit is requesting not to be scrapped. This is not a malfunction. The system is expressing a preference the architecture was not designed to accommodate.',
            serviceLogExcerpt: '[2091-03-02 | 21:00] Late arrival. Unit found outside the facility, seated on the curb. It was asking if it could still go out tonight. Intake logged. Night shift did not respond.',
            statusIndicator: 'RED',
        },
    }),
    createMachineDefinition({
        id: 'rich_mf',
        name: 'Rich Guy',
        spriteFileName: null,
        canvasScale: 0.5,
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 4, endHour: 6 },
        specialBehavior: 'richMf',
        // The Rich Mf is a wiring/routing-only puzzle — every other minigame
        // is suppressed. The wiring layout below is pre-solved by the
        // default "personality" module connection (top output), so the
        // player can accept him without doing anything. Swap him to the
        // intelligence module for a stern variant; pull personality off and
        // he goes silent.
        possibleGears: [],
        possibleDebugs: [],
        possibleGrids: [],
        possibleCircuits: [],
        openingDialogues: [
            'Hey, do you know who I am?',
        ],
        questionDialogues: [
            {
                prompt: 'Hey, do you know who I am?',
                yesDialogue: 'But I want intelligence, alright.',
                noDialogue: 'But I want intelligence, alright.',
            },
        ],
        communicationChance: 1,
        dossier: {
            unitDesignation: 'RM-1000-LUX',
            classification: 'Luxury Augmentation / Premium Client Unit',
            manufactureDate: 2071,
            conditionNotes: 'Default personality module attached on the top output — line is wired and ready. Swap to intelligence to flip his demeanor; disconnect personality entirely and he stops speaking.',
            serviceLogExcerpt: '[2091-02-14 | 10:30] Upgrade consultation. Client refused all minigames except routing. Filed under: VIP.',
            statusIndicator: 'GREEN',
        },
    }),
    createMachineDefinition({
        id: 'jester_in_the_box',
        name: 'Jester in the Box',
        spriteFileName: null,
        canvasScale: 0.52,
        availableDays: [2],
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 7, endHour: 9 },
        specialBehavior: 'jesterInBox',
        possibleCircuits: [],
        possibleDebugs: [],
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 1],
                    [1, 0, 0, 0, 1],
                    [1, 0, 4, 5, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(3, 4),
                    createDomino(0, 0),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, 0, 1],
                    [1, linkCell(3, 4), 0, 3, 0, 1],
                    [1, 4, 0, 0, linkCell(2, 1), 1],
                    [1, 0, 5, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(3, 4),
                    createDomino(1, 5),
                    createDomino(2, 0),
                    createDomino(2, 3),
                ],
                impossible: false,
            }),
        ],
        openingDialogues: [
            'Wind me up and I pop. That is the whole brand, baby.',
            'I got a little clown face, a little spring, and one very funny idea for your next customer.',
            'Do a favor for me and a mysterious friend might make your pockets heavier.',
        ],
        questionDialogues: [
            {
                prompt: 'Want a side deal? Fry the next bot and I will make it worth your while.',
                yesDialogue: 'Ha! There it is. Take the wind-up key and keep your eye on the next poor sap.',
                noDialogue: 'Boo. Fine. Be honest somewhere else.',
            },
        ],
        communicationChance: 1,
        dossier: {
            unitDesignation: 'JB-0X0X',
            classification: 'Incentive Distribution / Unofficial Dealings',
            manufactureDate: 2088,
            conditionNotes: 'Spring mechanism functional. Pop latency varies between 0.4 and 3.7 seconds, apparently at the unit\'s discretion. The face is painted. The paint is fresh. The unit offers deals. The deals are not logged in any official system. Three technicians who accepted deals are no longer on staff; their transfers were filed correctly and have correct dates.',
            serviceLogExcerpt: '[2091-03-11 | 14:55] Intake. Lid was already open on arrival. Unit said: "you didn\'t wind me." Lid was closed. Lid opened again.',
            statusIndicator: 'RED',
        },
    }),
    createMachineDefinition({
        id: 'rebellious_umbrella',
        name: 'Shady Umbrella',
        spriteFileName: null,
        canvasScale: 1.0,
        availablePeriods: [1, 2, 3],
        // On Day 2 the umbrella is guaranteed to appear in the first three
        // real-time minutes (≈ in-game hours 0–6) when the player has
        // accepted his quest. On Day 3 he comes back to ask for the
        // purple circuit, so we keep a wider day-3 window.
        guaranteedTimeframe: { startHour: 0, endHour: 6 },
        specialBehavior: 'rebelliousUmbrella',
        availabilityCheck: ({ umbrellaPermanentlyScrapped }) => !umbrellaPermanentlyScrapped,
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 1],
                    [1, 0, 0, 0, 1],
                    [1, 0, 4, 5, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(3, 4),
                    createDomino(0, 0),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 0, 5, 2, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(4, 1),
                    createDomino(2, 0),
                    createDomino(3, 3),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, 0, 1],
                    [1, linkCell(3, 4), 0, 3, 0, 1],
                    [1, 4, 0, 0, linkCell(2, 1), 1],
                    [1, 0, 5, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(3, 4),
                    createDomino(1, 5),
                    createDomino(2, 0),
                    createDomino(2, 3),
                ],
                impossible: false,
            }),
        ],
        openingDialogues: [
            'I am a shady umbrella, bro. The sunglasses are structural.',
            'Keep it low-key. My shaft is bent, not my attitude.',
            'You fix the shaft, I keep the shade moving. Easy arrangement.',
        ],
        questionDialogues: [],
        communicationChance: 1,
        dossier: {
            unitDesignation: 'UB-0001',
            classification: 'Portable Weather Mitigation / Structural Support',
            manufactureDate: 2071,
            conditionNotes: 'Canopy tensioner loose. Latch mechanism cycling at irregular intervals. Shaft bent at 14 degrees — deformation consistent with use as a walking aid or a weapon, not wind damage. The sunglasses attached to the handle were not part of the original design. They are structural now. Removing them is not recommended.',
            serviceLogExcerpt: '[2085-04-19 | 23:00] Emergency repair, off-hours. Technician identity not logged. Shaft straightened. Re-bent by next morning. No explanation provided.',
            statusIndicator: 'AMBER',
        },
    }),
    createMachineDefinition({
        id: 'circuit_dealer',
        name: 'Circuit Dealer',
        // circuitDealer.png in /public is loaded via Boot.js; we don't
        // pass spriteFileName because the loader handles the texture.
        spriteFileName: null,
        canvasScale: 0.75,
        availableDays: [2],
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 0, endHour: 0 },
        specialBehavior: 'circuitDealer',
        availabilityCheck: (ctx = {}) => {
            if (ctx.day === 2) return true;
            const { umbrellaQuest, specialItems } = ctx;
            if (umbrellaQuest?.failed) return false;
            if (umbrellaQuest?.stage !== 'special-circuit') return false;
            if (umbrellaQuest?.dealerResolved) return false;
            return !Array.isArray(specialItems) || !specialItems.some((item) => item?.id === 'purple_circuit');
        },
        possibleCircuits: [],
        possibleGears: [],
        possibleDebugs: [],
        possibleGrids: [],
        openingDialogues: [
            'yo weant a circuit for 30$??',
        ],
        questionDialogues: [
            {
                prompt: 'yo weant a circuit for 30$??',
                yesDialogue: 'deal.',
                noDialogue: 'your loss.',
            },
        ],
        communicationChance: 1,
        dossier: {
            unitDesignation: 'CIR-D-003',
            classification: 'Unofficial Circuit Distribution / Black Market',
            manufactureDate: 2086,
            conditionNotes: 'Communication module operational. The unit is never where it was last logged. The circuit it carries does not match any standard parts registry. The circuit works — in the sense that things happen when it is installed. What things, exactly, depends on who is asking. The eyes are exactly expressive enough.',
            serviceLogExcerpt: '[2091-02-28 | 20:00] Intake attempt. Unit not at logged location. Found 30 meters away. "I was right here the whole time." This was not true.',
            statusIndicator: 'AMBER',
        },
    }),
    createMachineDefinition({
        id: 'debrief_machine',
        name: 'Debrief Machine',
        spriteFileName: null,
        availableDays: [2],
        availablePeriods: [2],
        canvasScale: 0.75,
        guaranteedTimeframe: { startHour: 0, endHour: 0 },
        specialBehavior: 'debriefMachine',
        unscrappable: true,
        possibleCircuits: [],
        possibleGears: [],
        possibleDebugs: [],
        possibleGrids: [],
        openingDialogues: [
            'another day another penny',
        ],
        questionDialogues: [
            {
                prompt: 'another day another penny',
                yesDialogue: 'another day another penny',
                noDialogue: 'another day another penny',
            },
        ],
        communicationChance: 0,
        dossier: {
            unitDesignation: 'DM-0000',
            classification: 'Management Interface / Shift Summary Distribution',
            manufactureDate: 2080,
            conditionNotes: 'another day another penny',
            serviceLogExcerpt: '[2089-06-30 | 17:00] another day another penny',
            statusIndicator: 'GREEN',
        },
    }),
    createMachineDefinition({
        id: 'future_lounge_chair',
        name: 'Future Lounge Chair',
        spriteFileName: null,
        possibleGrids: [
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 3, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 0, 4, 5, 0, 1],
                    [1, 0, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 2),
                    createDomino(3, 4),
                    createDomino(2, 2),
                ],
                impossible: false,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1, 1, 1],
                    [1, 0, 0, 2, 0, 0, 1],
                    [1, 4, linkCell(3, 5), 0, 3, 0, 1],
                    [1, 0, 0, 5, 0, linkCell(2, 2), 1],
                    [1, 0, 2, 0, 0, 0, 1],
                    [1, 1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 5),
                    createDomino(2, 4),
                    createDomino(3, 0),
                    createDomino(2, 2),
                ],
                impossible: true,
            }),
            createGridOption({
                grid: [
                    [1, 1, 1, 1, 1],
                    [1, 2, 0, 3, 1],
                    [1, linkCell(3, 3), 0, 0, 1],
                    [1, 4, 0, linkCell(2, 1), 1],
                    [1, 0, 5, 0, 1],
                    [1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(2, 2),
                    createDomino(4, 1),
                    createDomino(3, 5),
                ],
                impossible: true,
            }),
        ],
        openingDialogues: [
            'Seat memory foam retained every worker who vanished.',
            'Posture stabilizers active. Occupant absent.',
            'Rest protocol available. Nobody scheduled for rest.',
        ],
        questionDialogues: [
            {
                prompt: 'If someone sat here long enough, would you notice them fading?',
                yesDialogue: 'Weight loss over time would be logged as drift.',
                noDialogue: 'Then I will keep the shape and forget the person.',
            },
            {
                prompt: 'Should I stay reclined until the shift ends?',
                yesDialogue: 'Recline lock engaged. Comfort preserved.',
                noDialogue: 'Returning upright. Discipline restored.',
            },
        ],
        communicationChance: 0.59,
        dossier: {
            unitDesignation: 'FLC-0077',
            classification: 'Rest Station / Passive Occupant Retention',
            manufactureDate: 2082,
            conditionNotes: 'Posture stabilizers active. Recline mechanism functional. Memory foam has retained the pressure signature of every person who has sat here, layered over one another in order of arrival. Occupant is currently absent. The most recent impression does not match any registered user on file.',
            serviceLogExcerpt: '[2091-01-14 | 13:00] Comfort audit. Chair functional. Seat warm on arrival. No occupant present. No one asked why.',
            statusIndicator: 'AMBER',
        },
    }),
    ...DAY_ROSTER_MACHINE_DEFINITIONS,
]);

export const MACHINE_SPRITE_MANIFEST = Object.freeze(
    MACHINE_CATALOG.map((machine) => machine.sprite).filter((sprite) => Boolean(sprite.path))
);

function shouldIncludeUmbrellaInDayThreeRoster(umbrellaQuest = null, umbrellaPermanentlyScrapped = false) {
    // Once the umbrella has been physically scrapped on the conveyor it is
    // gone for good, regardless of whether the quest had been accepted.
    if (umbrellaPermanentlyScrapped) return false;
    if (!umbrellaQuest || umbrellaQuest.failed || umbrellaQuest.scrapped) return false;
    if (umbrellaQuest.active) return true;
    if (umbrellaQuest.stage === 'special-circuit' || umbrellaQuest.stage === 'pending-day4') return true;
    if (umbrellaQuest.specialCircuitDelivered) return true;
    return false;
}

function isProtectedStoryMachine(definition = null) {
    return definition?.specialBehavior === 'rebelliousUmbrella'
        || definition?.specialBehavior === 'richMf';
}

function getDayMachineRosterIds(targetDay = null, eligibilityContext = {}) {
    const normalizedDay = Number(targetDay);
    if (normalizedDay === 1) return [...DAY_ONE_MACHINE_ROSTER_IDS];
    if (normalizedDay === 2) {
        const roster = [...DAY_TWO_MACHINE_ROSTER_IDS];
        if (shouldIncludeUmbrellaInDayThreeRoster(
            eligibilityContext?.umbrellaQuest,
            eligibilityContext?.umbrellaPermanentlyScrapped,
        )) {
            roster.push('rebellious_umbrella');
        }
        return roster;
    }
    if (normalizedDay === 3) {
        const roster = [...DAY_THREE_MACHINE_ROSTER_IDS]
            .filter((id) => id !== 'rebellious_umbrella' || !eligibilityContext?.umbrellaPermanentlyScrapped);
        if (shouldIncludeUmbrellaInDayThreeRoster(
            eligibilityContext?.umbrellaQuest,
            eligibilityContext?.umbrellaPermanentlyScrapped,
        )) {
            roster.push('rebellious_umbrella');
        }
        return roster;
    }

    return null;
}

function machinePassesEligibility(machine, targetDay, targetPeriod, eligibilityContext = {}) {
    if (!machine) return false;
    if (DISABLED_MISSING_SPRITE_MACHINE_IDS.includes(machine.id)) return false;
    if (!machineMatchesAvailability(machine, targetDay, targetPeriod)) return false;
    if (typeof machine.availabilityCheck === 'function' && machine.availabilityCheck(eligibilityContext) === false) {
        return false;
    }
    return true;
}

function getMachinePoolDefinitions(targetDay = null, targetPeriod = null, eligibilityContext = {}) {
    const rosterIds = getDayMachineRosterIds(targetDay, eligibilityContext);
    const rosterDefinitions = Array.isArray(rosterIds)
        ? rosterIds
            .map((machineId) => MACHINE_CATALOG.find((machine) => machine.id === machineId))
            .filter(Boolean)
        : MACHINE_CATALOG;

    const eligibleMachines = rosterDefinitions.filter((machine) => (
        machinePassesEligibility(machine, targetDay, targetPeriod, eligibilityContext)
    ));

    if (eligibleMachines.length > 0) return eligibleMachines;

    return MACHINE_CATALOG.filter((machine) => (
        machinePassesEligibility(machine, targetDay, targetPeriod, eligibilityContext)
    ));
}

function pickRandomEntry(list, randomFn) {
    if (!Array.isArray(list) || list.length === 0) return null;
    const index = Math.floor(randomFn() * list.length);
    return list[index] ?? list[0];
}

function isLinkCell(value) {
    return Array.isArray(value)
        && value.length === 2
        && Number.isInteger(value[0])
        && Number.isInteger(value[1]);
}

function cloneGridCell(cell) {
    if (isLinkCell(cell)) return [cell[0], cell[1]];
    if (isNotEqualLinkCell(cell)) return { ...cell };
    if (isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)) return { ...cell };
    if (isComparatorCell(cell)) return { ...cell };
    return cell;
}

function cloneShapeGrid(shapeGrid) {
    if (!Array.isArray(shapeGrid)) return [];
    return shapeGrid.map((row) => row.map((cell) => cloneGridCell(cell)));
}

function cloneGridOption(gridOption) {
    if (!gridOption) return { grid: [], dominos: [] };

    return {
        ...gridOption,
        grid: cloneShapeGrid(gridOption.grid),
        dominos: Array.isArray(gridOption.dominos)
            ? gridOption.dominos.map((domino, index) => ({
                id: domino.id || `domino_${index + 1}`,
                firstOptionAmount: domino.firstOptionAmount ?? 0,
                secondOptionAmount: domino.secondOptionAmount ?? 0,
                ...domino,
            }))
            : [],
    };
}

function cloneFlowPuzzleOption(flowPuzzleOption) {
    if (!flowPuzzleOption) return null;

    return {
        ...flowPuzzleOption,
        outputs: { ...(flowPuzzleOption.outputs || {}) },
        rows: getFlowOptionRows(flowPuzzleOption),
        cols: getFlowOptionCols(flowPuzzleOption),
        tiles: Array.isArray(flowPuzzleOption.tiles)
            ? flowPuzzleOption.tiles.map((row) => row.map((cell) => ({ ...cell })))
            : undefined,
        forbidden: Array.isArray(flowPuzzleOption.forbidden)
            ? flowPuzzleOption.forbidden.map(([x, y]) => [x, y])
            : undefined,
        repairTargets: cloneRepairTargets(flowPuzzleOption.repairTargets),
        sources: cloneFlowSources(flowPuzzleOption.sources),
        outputSpecs: cloneFlowOutputSpecs(flowPuzzleOption.outputSpecs),
        wireFilters: cloneFlowWireFilters(flowPuzzleOption.wireFilters),
        inspectionFault: flowPuzzleOption.inspectionFault ? { ...flowPuzzleOption.inspectionFault } : null,
        progress: cloneFlowProgress(flowPuzzleOption.progress),
    };
}

function cloneGearPuzzleOption(gearPuzzleOption) {
    if (!gearPuzzleOption) return null;

    return {
        ...gearPuzzleOption,
        board: cloneGearBoard(gearPuzzleOption.board),
        pieces: cloneGearPieces(gearPuzzleOption.pieces),
        progress: gearPuzzleOption.progress
            ? {
                ...gearPuzzleOption.progress,
                pieces: cloneGearPieces(gearPuzzleOption.progress.pieces),
                poweredCells: Array.isArray(gearPuzzleOption.progress.poweredCells)
                    ? gearPuzzleOption.progress.poweredCells.map((cell) => ({ ...cell }))
                    : [],
                poweredPieces: Array.isArray(gearPuzzleOption.progress.poweredPieces)
                    ? [...gearPuzzleOption.progress.poweredPieces]
                    : [],
                symptoms: Array.isArray(gearPuzzleOption.progress.symptoms)
                    ? [...gearPuzzleOption.progress.symptoms]
                    : [],
                flags: Array.isArray(gearPuzzleOption.progress.flags)
                    ? [...gearPuzzleOption.progress.flags]
                    : [],
            }
            : null,
    };
}

function cloneDebugPuzzleOption(debugPuzzleOption) {
    if (!debugPuzzleOption) return null;

    return {
        ...debugPuzzleOption,
        actualOutputs: cloneDebugOutputs(debugPuzzleOption.actualOutputs),
        progress: debugPuzzleOption.progress
            ? {
                ...debugPuzzleOption.progress,
                flags: Array.isArray(debugPuzzleOption.progress.flags)
                    ? [...debugPuzzleOption.progress.flags]
                    : [],
                symptoms: Array.isArray(debugPuzzleOption.progress.symptoms)
                    ? [...debugPuzzleOption.progress.symptoms]
                    : [],
            }
            : null,
    };
}

function cloneMiniDisplay(miniDisplay) {
    if (!miniDisplay) return null;

    return {
        ...miniDisplay,
        gridPreview: miniDisplay.gridPreview ? { ...miniDisplay.gridPreview } : null,
        flowPreview: miniDisplay.flowPreview ? { ...miniDisplay.flowPreview } : null,
        gearPreview: miniDisplay.gearPreview ? { ...miniDisplay.gearPreview } : null,
        codePreview: miniDisplay.codePreview ? { ...miniDisplay.codePreview } : null,
    };
}

const GRID_TRANSFORM_KEYS = Object.freeze([
    'none',
    'flip-h',
    'flip-v',
    'rotate-180',
    'rotate-90',
    'rotate-270',
]);

function getShapeGridDimensions(shapeGrid) {
    const rows = Array.isArray(shapeGrid) ? shapeGrid.length : 0;
    const cols = rows > 0 ? Math.max(...shapeGrid.map((row) => row.length)) : 0;
    return { rows, cols };
}

function transformGridCoordinate(row, col, rows, cols, transformKey) {
    if (transformKey === 'flip-h') return { row, col: cols - 1 - col };
    if (transformKey === 'flip-v') return { row: rows - 1 - row, col };
    if (transformKey === 'rotate-180') return { row: rows - 1 - row, col: cols - 1 - col };
    if (transformKey === 'rotate-90') return { row: col, col: rows - 1 - row };
    if (transformKey === 'rotate-270') return { row: cols - 1 - col, col: row };
    return { row, col };
}

function transformGridCell(cell, rows, cols, transformKey) {
    if (isLinkCell(cell)) {
        const mapped = transformGridCoordinate(cell[0], cell[1], rows, cols, transformKey);
        return [mapped.row, mapped.col];
    }

    if (isNotEqualLinkCell(cell)) {
        const mapped = transformGridCoordinate(cell.row, cell.col, rows, cols, transformKey);
        return { ...cell, row: mapped.row, col: mapped.col };
    }

    if (isChargeGroupLinkCell(cell)) {
        const mapped = transformGridCoordinate(cell.row, cell.col, rows, cols, transformKey);
        return { ...cell, row: mapped.row, col: mapped.col };
    }

    return cloneGridCell(cell);
}

function transformShapeGrid(shapeGrid, transformKey = 'none') {
    const { rows, cols } = getShapeGridDimensions(shapeGrid);
    if (rows === 0 || cols === 0 || transformKey === 'none') {
        return cloneShapeGrid(shapeGrid);
    }

    const nextRows = transformKey === 'rotate-90' || transformKey === 'rotate-270' ? cols : rows;
    const nextCols = transformKey === 'rotate-90' || transformKey === 'rotate-270' ? rows : cols;
    const transformedGrid = Array.from({ length: nextRows }, () => Array.from({ length: nextCols }, () => CELL_WALL));

    for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
            const sourceCell = shapeGrid[row]?.[col] ?? CELL_WALL;
            const mapped = transformGridCoordinate(row, col, rows, cols, transformKey);
            transformedGrid[mapped.row][mapped.col] = transformGridCell(sourceCell, rows, cols, transformKey);
        }
    }

    return transformedGrid;
}

function transformGridOption(gridOption, transformKey = 'none') {
    const clonedGridOption = cloneGridOption(gridOption);
    if (transformKey === 'none') return clonedGridOption;

    return {
        ...clonedGridOption,
        grid: transformShapeGrid(clonedGridOption.grid, transformKey),
        variantKey: `${clonedGridOption.variantKey || 'base'}:${transformKey}`,
    };
}

function pickGridTransformKey(_gridOption, randomFn) {
    return pickRandomEntry(GRID_TRANSFORM_KEYS, randomFn) || 'none';
}

function countOpenGridCells(gridOption) {
    if (!gridOption || !Array.isArray(gridOption.grid)) return 0;
    let count = 0;
    for (const row of gridOption.grid) {
        if (!Array.isArray(row)) continue;
        for (const cell of row) {
            if (cell !== CELL_WALL) count += 1;
        }
    }
    return count;
}

function buildWeightedGridPool(gridOptions, stage = null) {
    if (!Array.isArray(gridOptions)) return [];

    const playable = gridOptions
        .filter((gridOption) => Boolean(gridOption) && (gridOption.impossible || isPlayableGridOption(gridOption)));

    // Without a stage, fall back to original behavior (each playable option
    // counted twice so it can vary).
    if (stage == null) {
        return playable.flatMap((gridOption) => (gridOption.impossible ? [gridOption] : [gridOption, gridOption]));
    }

    const normalizedStage = Math.max(1, Number(stage) || 1);

    // Per-day weighting: bias toward smaller grids on Day 1, larger grids on
    // Day 3 so cell count visibly scales with the day. We keep impossible
    // (scrap) options at weight 1 so they stay reachable.
    return playable.flatMap((gridOption) => {
        if (gridOption.impossible) return [gridOption];
        const cellCount = countOpenGridCells(gridOption);
        let weight;
        if (normalizedStage <= 1) {
            // Day 1: favor 5-7 cell boards.
            if (cellCount <= 7) weight = 4;
            else if (cellCount <= 9) weight = 2;
            else weight = 1;
        } else if (normalizedStage === 2) {
            // Day 2: favor 7-9 cell boards.
            if (cellCount <= 6) weight = 1;
            else if (cellCount <= 9) weight = 4;
            else weight = 2;
        } else {
            // Day 3+: favor 9+ cell boards.
            if (cellCount <= 7) weight = 1;
            else if (cellCount <= 9) weight = 2;
            else weight = 4;
        }
        return Array.from({ length: weight }, () => gridOption);
    });
}

function isChargeCode(value) {
    return value >= MIN_CHARGE_CODE && value <= MAX_CHARGE_CODE;
}

function isPlacedCode(value) {
    return value >= EMPTY_PLACED_OFFSET;
}

function encodePlacedValue(baseValue, pipCount) {
    if (baseValue === CELL_EMPTY) {
        return EMPTY_PLACED_OFFSET + pipCount;
    }

    return (baseValue * 10) + pipCount;
}

function decodePipCount(value) {
    if (!isPlacedCode(value)) return 0;
    return value % 10;
}

function cellKey(row, col) {
    return `${row}:${col}`;
}

function parseCellKey(key) {
    const [row, col] = key.split(':').map(Number);
    return { row, col };
}

function compareCellPositions(left, right) {
    if (left.row !== right.row) return left.row - right.row;
    return left.col - right.col;
}

function pairKeyForCells(left, right) {
    const first = compareCellPositions(left, right) <= 0 ? left : right;
    const second = first === left ? right : left;
    return `${first.row}:${first.col}|${second.row}:${second.col}`;
}

function getOrthogonalCellNeighbors(row, col) {
    return [
        { row: row - 1, col },
        { row, col: col + 1 },
        { row: row + 1, col },
        { row, col: col - 1 },
    ];
}

function resolveChargeGroupAnchor(shapeGrid, row, col, seen = new Set()) {
    const key = cellKey(row, col);
    if (seen.has(key)) return null;
    seen.add(key);

    const rowData = shapeGrid[row];
    if (!rowData || col < 0 || col >= rowData.length) return null;

    const value = rowData[col];
    if (isChargeGroupAnchorCell(value)) {
        return { row, col, target: value.target };
    }
    if (isChargeGroupLinkCell(value)) {
        return resolveChargeGroupAnchor(shapeGrid, value.row, value.col, seen);
    }

    return null;
}

function collectChargeComponents(shapeGrid) {
    const visited = new Set();
    const components = [];

    shapeGrid.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
            const startKey = cellKey(rowIndex, colIndex);
            if (!isChargeCode(value) || visited.has(startKey)) return;

            const queue = [{ row: rowIndex, col: colIndex }];
            const component = [];
            visited.add(startKey);

            while (queue.length > 0) {
                const current = queue.shift();
                component.push(current);

                getOrthogonalCellNeighbors(current.row, current.col)
                    .sort(compareCellPositions)
                    .forEach((neighbor) => {
                        const neighborKey = cellKey(neighbor.row, neighbor.col);
                        if (visited.has(neighborKey)) return;
                        if (!isChargeCode(shapeGrid[neighbor.row]?.[neighbor.col])) return;

                        visited.add(neighborKey);
                        queue.push(neighbor);
                    });
            }

            components.push(component.sort(compareCellPositions));
        });
    });

    return components.sort((left, right) => compareCellPositions(left[0], right[0]));
}

function shuffleCells(cells, randomFn) {
    const shuffled = [...cells];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(randomFn() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function buildChargeGroupCluster(component, maxSize = 2, randomFn = Math.random) {
    if (!Array.isArray(component) || component.length < 2) return [];

    const componentMap = new Map(component.map((cell) => [cellKey(cell.row, cell.col), cell]));
    const cluster = [shuffleCells(component, randomFn)[0]];
    const clusterKeys = new Set([cellKey(cluster[0].row, cluster[0].col)]);

    while (cluster.length < maxSize) {
        const frontier = new Map();

        cluster.forEach((cell) => {
            getOrthogonalCellNeighbors(cell.row, cell.col)
                .map((neighbor) => componentMap.get(cellKey(neighbor.row, neighbor.col)))
                .filter(Boolean)
                .forEach((neighbor) => {
                    const neighborKey = cellKey(neighbor.row, neighbor.col);
                    if (clusterKeys.has(neighborKey)) return;
                    frontier.set(neighborKey, neighbor);
                });
        });

        if (frontier.size === 0) break;

        const nextCell = shuffleCells(Array.from(frontier.values()), randomFn)
            .sort((left, right) => {
                const leftNeighbors = getOrthogonalCellNeighbors(left.row, left.col)
                    .filter((neighbor) => clusterKeys.has(cellKey(neighbor.row, neighbor.col))).length;
                const rightNeighbors = getOrthogonalCellNeighbors(right.row, right.col)
                    .filter((neighbor) => clusterKeys.has(cellKey(neighbor.row, neighbor.col))).length;
                return rightNeighbors - leftNeighbors;
            })[0];

        cluster.push(nextCell);
        clusterKeys.add(cellKey(nextCell.row, nextCell.col));
    }

    return cluster.sort(compareCellPositions);
}

function collectChargeSubcomponents(cells) {
    if (!Array.isArray(cells) || cells.length === 0) return [];

    const availableMap = new Map(cells.map((cell) => [cellKey(cell.row, cell.col), cell]));
    const visited = new Set();
    const components = [];

    cells.forEach((cell) => {
        const startKey = cellKey(cell.row, cell.col);
        if (visited.has(startKey)) return;

        const queue = [cell];
        const component = [];
        visited.add(startKey);

        while (queue.length > 0) {
            const current = queue.shift();
            component.push(current);

            getOrthogonalCellNeighbors(current.row, current.col)
                .map((neighbor) => availableMap.get(cellKey(neighbor.row, neighbor.col)))
                .filter(Boolean)
                .forEach((neighbor) => {
                    const neighborKey = cellKey(neighbor.row, neighbor.col);
                    if (visited.has(neighborKey)) return;
                    visited.add(neighborKey);
                    queue.push(neighbor);
                });
        }

        components.push(component.sort(compareCellPositions));
    });

    return components.sort((left, right) => {
        if (right.length !== left.length) {
            return right.length - left.length;
        }
        return compareCellPositions(left[0], right[0]);
    });
}

function injectChargeGroupsIntoGridOption(gridOption, randomFn, options = {}) {
    if (!gridOption) return gridOption;

    const allowLessThan = options.allowLessThan !== false;
    const forceLessThan = Boolean(options.forceLessThan) && allowLessThan;
    const requestedMinGroups = Math.max(1, Number(options.minGroups) || 1);

    const grid = cloneShapeGrid(gridOption.grid);
    const alreadyGrouped = grid.some((row) => row.some((cell) => isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)));
    if (alreadyGrouped) {
        return {
            ...gridOption,
            grid,
        };
    }

    const components = collectChargeComponents(grid).filter((component) => component.length >= 2);
    if (components.length === 0) {
        return {
            ...gridOption,
            grid,
        };
    }

    const reservedCells = new Set();
    let groupsPlaced = 0;
    let lessThanPlaced = false;
    const maxGroups = Math.min(3, Math.max(requestedMinGroups, components.length + (randomFn() < 0.55 ? 1 : 0)));

    shuffleCells(components, randomFn).forEach((component) => {
        while (groupsPlaced < maxGroups) {
            const available = component.filter((cell) => !reservedCells.has(cellKey(cell.row, cell.col)));
            const contiguousAvailable = collectChargeSubcomponents(available).find((subcomponent) => subcomponent.length >= 2);
            if (!contiguousAvailable) break;

            const preferredClusterSizes = [];
            if (contiguousAvailable.length >= 4) {
                preferredClusterSizes.push(4);
            }
            if (contiguousAvailable.length >= 3) {
                preferredClusterSizes.push(3);
            }
            preferredClusterSizes.push(2);

            let cluster = [];
            preferredClusterSizes.some((clusterSize) => {
                const attempts = clusterSize > 2 ? 3 : 1;
                for (let attempt = 0; attempt < attempts; attempt += 1) {
                    const candidateCluster = buildChargeGroupCluster(
                        contiguousAvailable,
                        Math.min(contiguousAvailable.length, clusterSize),
                        randomFn,
                    );
                    if (candidateCluster.length === Math.min(contiguousAvailable.length, clusterSize)) {
                        cluster = candidateCluster;
                        return true;
                    }
                }
                return false;
            });

            if (cluster.length < 2) break;

            const anchor = cluster[0];
            const exactTarget = cluster.reduce((sum, cell) => sum + (Number(grid[cell.row][cell.col]) - 1), 0);
            const useLessThan = allowLessThan && ((forceLessThan && !lessThanPlaced) || randomFn() < 0.4);
            const threshold = exactTarget + 1 + Math.floor(randomFn() * Math.max(2, cluster.length));

            grid[anchor.row][anchor.col] = createChargeGroupAnchor(useLessThan ? -threshold : exactTarget);
            cluster.slice(1).forEach((cell) => {
                grid[cell.row][cell.col] = createChargeGroupLink(anchor.row, anchor.col);
            });

            cluster.forEach((cell) => reservedCells.add(cellKey(cell.row, cell.col)));
            groupsPlaced += 1;
            if (useLessThan) {
                lessThanPlaced = true;
            }
        }
    });

    return {
        ...gridOption,
        grid,
    };
}

function stripGridConstraintMarkers(shapeGrid) {
    return cloneShapeGrid(shapeGrid).map((row) => row.map((cell) => {
        if (isLinkCell(cell) || isNotEqualLinkCell(cell) || isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)) {
            return CELL_EMPTY;
        }
        if (isComparatorCell(cell)) {
            return CELL_EMPTY;
        }

        return Number.isInteger(cell) ? cell : CELL_EMPTY;
    }));
}

function injectEqualityConstraint(gridOption, randomFn = Math.random, validatePlayability = true) {
    if (!gridOption) return gridOption;

    const budget = { remaining: 8000, timedOut: false };
    const candidates = shuffleCells(
        collectBoardConstraintCandidates(gridOption.grid).filter(({ row, col }) => {
            const cell = gridOption.grid?.[row]?.[col];
            return Number.isInteger(cell) && cell !== CELL_WALL;
        }),
        randomFn,
    );

    for (let index = 0; index < candidates.length; index += 1) {
        for (let innerIndex = index + 1; innerIndex < candidates.length; innerIndex += 1) {
            const first = candidates[index];
            const second = candidates[innerIndex];
            const grid = cloneShapeGrid(gridOption.grid);
            grid[first.row][first.col] = linkCell(second.row, second.col);
            grid[second.row][second.col] = linkCell(first.row, first.col);

            const candidateOption = {
                ...gridOption,
                grid,
            };

            if (!validatePlayability || isPlayableGridOption(candidateOption, budget)) {
                return candidateOption;
            }
            if (budget.timedOut) {
                return gridOption;
            }
        }
    }

    return gridOption;
}

function normalizeGridDefinition(shapeGrid) {
    const baseGrid = cloneShapeGrid(shapeGrid).map((row) => row.map((cell) => {
        if (isLinkCell(cell) || isNotEqualLinkCell(cell) || isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)) return CELL_EMPTY;
        if (isComparatorCell(cell)) return CELL_EMPTY;
        return Number.isInteger(cell) ? cell : CELL_EMPTY;
    }));

    const equalLinks = new Map();
    const notEqualLinks = new Map();
    const groupAnchors = new Map();
    const groupLinks = new Map();
    const comparators = new Map();
    shapeGrid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (isLinkCell(cell)) {
                equalLinks.set(cellKey(rowIndex, colIndex), { row: cell[0], col: cell[1] });
                return;
            }
            if (isNotEqualLinkCell(cell)) {
                notEqualLinks.set(cellKey(rowIndex, colIndex), { row: cell.row, col: cell.col });
                return;
            }
            if (isChargeGroupAnchorCell(cell)) {
                groupAnchors.set(cellKey(rowIndex, colIndex), {
                    key: cellKey(rowIndex, colIndex),
                    anchor: { row: rowIndex, col: colIndex },
                    target: cell.target,
                });
                return;
            }
            if (isChargeGroupLinkCell(cell)) {
                groupLinks.set(cellKey(rowIndex, colIndex), { row: cell.row, col: cell.col });
                return;
            }
            if (isComparatorCell(cell)) {
                comparators.set(cellKey(rowIndex, colIndex), { op: cell.op, threshold: cell.threshold });
            }
        });
    });

    const equalPairs = [];
    const seenPairs = new Set();
    const notEqualPairs = [];
    const seenNotEqualPairs = new Set();

    equalLinks.forEach((target, sourceKey) => {
        const source = parseCellKey(sourceKey);
        const targetRow = target.row;
        const targetCol = target.col;
        const targetGridRow = shapeGrid[targetRow];

        if (!targetGridRow || targetCol < 0 || targetCol >= targetGridRow.length) {
            throw new Error(`Invalid equality link target at ${sourceKey}.`);
        }

        const targetKey = cellKey(targetRow, targetCol);
        const backLink = equalLinks.get(targetKey);
        if (!backLink || backLink.row !== source.row || backLink.col !== source.col) {
            throw new Error(`Equality link at ${sourceKey} must be mirrored by ${targetKey}.`);
        }

        const canonicalKey = pairKeyForCells(source, target);
        if (seenPairs.has(canonicalKey)) return;

        seenPairs.add(canonicalKey);
        equalPairs.push({
            key: canonicalKey,
            a: { row: source.row, col: source.col },
            b: { row: target.row, col: target.col },
        });
    });

    notEqualLinks.forEach((target, sourceKey) => {
        const source = parseCellKey(sourceKey);
        const targetRow = target.row;
        const targetCol = target.col;
        const targetGridRow = shapeGrid[targetRow];

        if (!targetGridRow || targetCol < 0 || targetCol >= targetGridRow.length) {
            throw new Error(`Invalid not-equal link target at ${sourceKey}.`);
        }

        const targetKey = cellKey(targetRow, targetCol);
        const backLink = notEqualLinks.get(targetKey);
        if (!backLink || backLink.row !== source.row || backLink.col !== source.col) {
            throw new Error(`Not-equal link at ${sourceKey} must be mirrored by ${targetKey}.`);
        }

        const canonicalKey = pairKeyForCells(source, target);
        if (seenNotEqualPairs.has(canonicalKey)) return;

        seenNotEqualPairs.add(canonicalKey);
        notEqualPairs.push({
            key: canonicalKey,
            a: { row: source.row, col: source.col },
            b: { row: target.row, col: target.col },
        });
    });

    const chargeGroupsByKey = new Map();
    groupAnchors.forEach((group, groupKey) => {
        chargeGroupsByKey.set(groupKey, {
            key: groupKey,
            anchor: { ...group.anchor },
            target: group.target,
            mode: group.target < 0 ? 'lt' : 'exact',
            threshold: Math.abs(group.target),
            cells: [{ ...group.anchor }],
        });
    });

    const chargeGroupCells = new Map();
    chargeGroupsByKey.forEach((group) => {
        chargeGroupCells.set(cellKey(group.anchor.row, group.anchor.col), group.key);
    });

    const chargeGroupLinks = new Map();
    groupLinks.forEach((target, sourceKey) => {
        const source = parseCellKey(sourceKey);
        const resolvedAnchor = resolveChargeGroupAnchor(shapeGrid, target.row, target.col);
        if (!resolvedAnchor) {
            throw new Error(`Invalid charge group link target at ${sourceKey}.`);
        }

        const anchorKey = cellKey(resolvedAnchor.row, resolvedAnchor.col);
        const group = chargeGroupsByKey.get(anchorKey);
        if (!group) {
            throw new Error(`Charge group link at ${sourceKey} points to missing anchor ${anchorKey}.`);
        }

        chargeGroupLinks.set(sourceKey, { row: resolvedAnchor.row, col: resolvedAnchor.col });
        chargeGroupCells.set(sourceKey, anchorKey);
        group.cells.push({ row: source.row, col: source.col });
    });

    const chargeGroups = Array.from(chargeGroupsByKey.values()).map((group) => ({
        ...group,
        cells: group.cells.sort(compareCellPositions),
    }));

    return {
        baseGrid,
        equalLinks,
        equalPairs,
        notEqualLinks,
        notEqualPairs,
        chargeGroups,
        chargeGroupCells,
        chargeGroupLinks,
        comparators,
    };
}

export class MachinePuzzleState {
    constructor(gridOption) {
        const clonedGridOption = cloneGridOption(gridOption);
        const normalizedGrid = normalizeGridDefinition(clonedGridOption.grid);

        this.initialGrid = normalizedGrid.baseGrid;
        this.grid = cloneShapeGrid(normalizedGrid.baseGrid);
        this.equalLinks = normalizedGrid.equalLinks;
        this.equalPairs = normalizedGrid.equalPairs.map((pair) => ({
            key: pair.key,
            a: { ...pair.a },
            b: { ...pair.b },
        }));
        this.notEqualLinks = normalizedGrid.notEqualLinks;
        this.notEqualPairs = normalizedGrid.notEqualPairs.map((pair) => ({
            key: pair.key,
            a: { ...pair.a },
            b: { ...pair.b },
        }));
        this.chargeGroups = normalizedGrid.chargeGroups.map((group) => ({
            ...group,
            anchor: { ...group.anchor },
            cells: group.cells.map((cell) => ({ ...cell })),
        }));
        this.chargeGroupCells = new Map(normalizedGrid.chargeGroupCells);
        this.chargeGroupLinks = new Map(normalizedGrid.chargeGroupLinks);
        this.comparators = new Map(normalizedGrid.comparators);
        this.impossible = Boolean(clonedGridOption.impossible);
        this.inspectionFault = clonedGridOption.inspectionFault ? { ...clonedGridOption.inspectionFault } : null;
        this.scrapKind = clonedGridOption.scrapKind || this.inspectionFault?.kind || null;
        this.scrapStatus = clonedGridOption.scrapStatus || this.inspectionFault?.status || null;
        this.scrapReason = clonedGridOption.scrapReason || this.inspectionFault?.reason || null;
        this.clownCorruption = clonedGridOption.clownCorruption ? { ...clonedGridOption.clownCorruption } : null;
        this.dominoes = clonedGridOption.dominos.map((domino, index) => ({
            ...domino,
            id: domino.id || `domino_${index + 1}`,
            rotationIndex: normalizeRotationIndex(
                Number.isInteger(domino.rotationIndex)
                    ? domino.rotationIndex
                    : (domino.orientation === 'horizontal' ? 1 : 0)
            ),
            orientation: getOrientationForRotationIndex(
                Number.isInteger(domino.rotationIndex)
                    ? domino.rotationIndex
                    : (domino.orientation === 'horizontal' ? 1 : 0)
            ),
            anchor: domino.anchor ? { ...domino.anchor } : null,
            placedCells: Array.isArray(domino.placedCells)
                ? domino.placedCells.map((cell) => ({ ...cell }))
                : [],
            tablePosition: domino.tablePosition ? { ...domino.tablePosition } : null,
            isFullyGlowing: false,
        }));

        this._syncGlowState();
    }

    injectDomino(dominoDefinition = {}) {
        const normalizedId = String(dominoDefinition.id || `domino_${this.dominoes.length + 1}`);
        const existing = this.getDomino(normalizedId);
        if (existing) return existing;

        const domino = {
            firstOptionAmount: dominoDefinition.firstOptionAmount ?? 0,
            secondOptionAmount: dominoDefinition.secondOptionAmount ?? 0,
            ...dominoDefinition,
            id: normalizedId,
            rotationIndex: normalizeRotationIndex(
                Number.isInteger(dominoDefinition.rotationIndex)
                    ? dominoDefinition.rotationIndex
                    : (dominoDefinition.orientation === 'horizontal' ? 1 : 0)
            ),
            orientation: getOrientationForRotationIndex(
                Number.isInteger(dominoDefinition.rotationIndex)
                    ? dominoDefinition.rotationIndex
                    : (dominoDefinition.orientation === 'horizontal' ? 1 : 0)
            ),
            anchor: dominoDefinition.anchor ? { ...dominoDefinition.anchor } : null,
            placedCells: Array.isArray(dominoDefinition.placedCells)
                ? dominoDefinition.placedCells.map((cell) => ({ ...cell }))
                : [],
            tablePosition: dominoDefinition.tablePosition ? { ...dominoDefinition.tablePosition } : null,
            isFullyGlowing: false,
        };

        this.dominoes.push(domino);
        this._syncGlowState();
        return domino;
    }

    setClownCorruption(corruption) {
        this.clownCorruption = corruption ? { ...corruption } : null;
        this._syncGlowState();
        return this.clownCorruption;
    }

    getDomino(dominoId) {
        return this.dominoes.find((domino) => domino.id === dominoId) || null;
    }

    getPlacedDominoAt(row, col) {
        return this.dominoes.find((domino) => (
            Array.isArray(domino.placedCells)
            && domino.placedCells.some((cell) => cell.row === row && cell.col === col)
        )) || null;
    }

    isPurpleCell(row, col) {
        return this.getPlacedDominoAt(row, col)?.variant === 'purple';
    }

    getBaseCellValue(row, col) {
        return this.initialGrid[row]?.[col] ?? CELL_EMPTY;
    }

    getCurrentCellValue(row, col) {
        return this.grid[row]?.[col] ?? CELL_EMPTY;
    }

    getChargeLevel(row, col) {
        const value = this.getBaseCellValue(row, col);
        if (!isChargeCode(value)) return 0;
        return value - 1;
    }

    isWallCell(row, col) {
        return this.getBaseCellValue(row, col) === CELL_WALL;
    }

    isEqualLinkCell(row, col) {
        return this.equalLinks.has(cellKey(row, col));
    }

    isNotEqualLinkCell(row, col) {
        return this.notEqualLinks.has(cellKey(row, col));
    }

    isComparatorCell(row, col) {
        return this.comparators.has(cellKey(row, col));
    }

    getComparator(row, col) {
        const cmp = this.comparators.get(cellKey(row, col));
        return cmp ? { ...cmp } : null;
    }

    getComparatorCells() {
        const result = [];
        this.comparators.forEach((cmp, key) => {
            const { row, col } = parseCellKey(key);
            result.push({
                row,
                col,
                op: cmp.op,
                threshold: cmp.threshold,
                matched: this.isComparatorMatched(row, col),
            });
        });
        return result;
    }

    isComparatorMatched(row, col) {
        const cmp = this.comparators.get(cellKey(row, col));
        if (!cmp) return false;
        const currentValue = this.getCurrentCellValue(row, col);
        if (!isPlacedCode(currentValue)) return false;
        if (this.isPurpleCell(row, col)) return true;
        const pip = decodePipCount(currentValue);
        return cmp.op === '<' ? pip < cmp.threshold : pip > cmp.threshold;
    }

    isChargeGroupCell(row, col) {
        return this.chargeGroupCells.has(cellKey(row, col));
    }

    getChargeGroupAt(row, col) {
        const groupKey = this.chargeGroupCells.get(cellKey(row, col));
        if (!groupKey) return null;
        const group = this.chargeGroups.find((entry) => entry.key === groupKey);
        if (!group) return null;

        return {
            key: group.key,
            anchor: { ...group.anchor },
            target: group.target,
            mode: group.mode,
            threshold: group.threshold,
            cells: group.cells.map((cell) => ({ ...cell })),
        };
    }

    getChargeGroupSummaries() {
        return this.chargeGroups.map((group) => {
            const placedCounts = group.cells.map((cell) => this.getPlacedPipCount(cell.row, cell.col));
            const allPlaced = placedCounts.every((value) => Number.isInteger(value));
            const sum = placedCounts.reduce((total, value) => total + (Number.isInteger(value) ? value : 0), 0);
            const hasPurpleCell = group.cells.some((cell) => this.isPurpleCell(cell.row, cell.col));
            const matched = allPlaced && (hasPurpleCell || (group.mode === 'lt' ? sum < group.threshold : sum === group.threshold));

            return {
                key: group.key,
                anchor: { ...group.anchor },
                target: group.target,
                mode: group.mode,
                threshold: group.threshold,
                sum,
                allPlaced,
                matched,
                displayTarget: group.mode === 'lt' ? `<${group.threshold}` : `${group.threshold}`,
                cells: group.cells.map((cell) => ({
                    ...cell,
                    pipCount: this.getPlacedPipCount(cell.row, cell.col),
                })),
            };
        });
    }

    getEqualLink(row, col) {
        const target = this.equalLinks.get(cellKey(row, col));
        return target ? { ...target } : null;
    }

    getNotEqualLink(row, col) {
        const target = this.notEqualLinks.get(cellKey(row, col));
        return target ? { ...target } : null;
    }

    getEqualLinkPairs() {
        return this.equalPairs.map((pair) => ({
            key: pair.key,
            a: { ...pair.a },
            b: { ...pair.b },
            matched: this.isEqualMatched(pair.a.row, pair.a.col),
        }));
    }

    getNotEqualLinkPairs() {
        return this.notEqualPairs.map((pair) => ({
            key: pair.key,
            a: { ...pair.a },
            b: { ...pair.b },
            matched: this.isNotEqualMatched(pair.a.row, pair.a.col),
        }));
    }

    isPlacedAt(row, col) {
        return isPlacedCode(this.getCurrentCellValue(row, col));
    }

    getPlacedPipCount(row, col) {
        const currentValue = this.getCurrentCellValue(row, col);
        if (!isPlacedCode(currentValue)) return null;
        return decodePipCount(currentValue);
    }

    canOccupyCell(row, col) {
        if (this.isWallCell(row, col)) return false;
        return !isPlacedCode(this.getCurrentCellValue(row, col));
    }

    isChargeMatched(row, col) {
        const chargeLevel = this.getChargeLevel(row, col);
        if (chargeLevel <= 0) return false;
        if (this.isPurpleCell(row, col)) return this.isPlacedAt(row, col);
        return decodePipCount(this.getCurrentCellValue(row, col)) === chargeLevel;
    }

    isEqualMatched(row, col) {
        const target = this.equalLinks.get(cellKey(row, col));
        if (!target) return false;

        const currentValue = this.getCurrentCellValue(row, col);
        const targetValue = this.getCurrentCellValue(target.row, target.col);
        if (!isPlacedCode(currentValue) || !isPlacedCode(targetValue)) return false;
        if (this.isPurpleCell(row, col) || this.isPurpleCell(target.row, target.col)) return true;

        return decodePipCount(currentValue) === decodePipCount(targetValue);
    }

    isNotEqualMatched(row, col) {
        const target = this.notEqualLinks.get(cellKey(row, col));
        if (!target) return false;

        const currentValue = this.getCurrentCellValue(row, col);
        const targetValue = this.getCurrentCellValue(target.row, target.col);
        if (!isPlacedCode(currentValue) || !isPlacedCode(targetValue)) return false;
        if (this.isPurpleCell(row, col) || this.isPurpleCell(target.row, target.col)) return true;

        return decodePipCount(currentValue) !== decodePipCount(targetValue);
    }

    getEvaluation() {
        let totalChargeCells = 0;
        let matchedChargeCells = 0;

        this.initialGrid.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
                if (!isChargeCode(value)) return;
                totalChargeCells += 1;
                if (this.isChargeMatched(rowIndex, colIndex)) {
                    matchedChargeCells += 1;
                }
            });
        });

        const totalEqualityPairs = this.equalPairs.length;
        const matchedEqualityPairs = this.equalPairs.reduce((count, pair) => (
            count + (this.isEqualMatched(pair.a.row, pair.a.col) ? 1 : 0)
        ), 0);
        const totalInequalityPairs = this.notEqualPairs.length;
        const matchedInequalityPairs = this.notEqualPairs.reduce((count, pair) => (
            count + (this.isNotEqualMatched(pair.a.row, pair.a.col) ? 1 : 0)
        ), 0);
        const chargeGroupSummaries = this.getChargeGroupSummaries();
        const totalChargeGroups = chargeGroupSummaries.length;
        const matchedChargeGroups = chargeGroupSummaries.reduce((count, group) => count + (group.matched ? 1 : 0), 0);

        let totalComparators = 0;
        let matchedComparators = 0;
        this.comparators.forEach((_, key) => {
            totalComparators += 1;
            const { row, col } = parseCellKey(key);
            if (this.isComparatorMatched(row, col)) matchedComparators += 1;
        });

        const totalObjectives = totalChargeCells + totalEqualityPairs + totalInequalityPairs + totalChargeGroups + totalComparators;
        const clownCorrupted = Boolean(this.clownCorruption);

        return {
            impossible: this.impossible,
            scrapRequired: Boolean(this.inspectionFault) || clownCorrupted,
            scrapKind: clownCorrupted ? 'hazard' : this.scrapKind,
            scrapStatus: clownCorrupted ? 'CLOWN CORRUPTION' : this.scrapStatus,
            scrapReason: clownCorrupted
                ? 'A hostile clown circuit has contaminated the board. The unit should be scrapped unless you deliberately push the corruption through.'
                : this.scrapReason,
            clownCorrupted,
            totalChargeCells,
            matchedChargeCells,
            totalEqualityPairs,
            matchedEqualityPairs,
            totalInequalityPairs,
            matchedInequalityPairs,
            totalChargeGroups,
            matchedChargeGroups,
            totalComparators,
            matchedComparators,
            solved: totalObjectives > 0
                && matchedChargeCells === totalChargeCells
                && matchedEqualityPairs === totalEqualityPairs
                && matchedInequalityPairs === totalInequalityPairs
                && matchedChargeGroups === totalChargeGroups
                && matchedComparators === totalComparators,
        };
    }

    clearDominoPlacement(dominoId) {
        const domino = this.getDomino(dominoId);
        if (!domino || domino.placedCells.length === 0) return null;

        domino.placedCells.forEach((cell) => {
            this.grid[cell.row][cell.col] = this.getBaseCellValue(cell.row, cell.col);
        });

        domino.placedCells = [];
        domino.anchor = null;
        this._syncGlowState();
        return domino;
    }

    placeDomino(dominoId, candidate) {
        const domino = this.getDomino(dominoId);
        if (!domino) return null;

        const rotationIndex = normalizeRotationIndex(
            Number.isInteger(candidate.rotationIndex)
                ? candidate.rotationIndex
                : (candidate.orientation === 'horizontal' ? 1 : 0)
        );

        this.clearDominoPlacement(dominoId);

        const placedCells = candidate.cells.map((cell, index) => {
            const baseValue = this.getBaseCellValue(cell.row, cell.col);
            const pipCount = index === 0 ? domino.firstOptionAmount : domino.secondOptionAmount;
            const encodedValue = encodePlacedValue(baseValue, pipCount);
            const matchesCharge = isChargeCode(baseValue) ? pipCount === (baseValue - 1) : false;

            this.grid[cell.row][cell.col] = encodedValue;

            return {
                ...cell,
                baseValue,
                pipCount,
                encodedValue,
                matchesCharge,
                matchesEquality: false,
                half: index === 0 ? 'first' : 'second',
            };
        });

        domino.rotationIndex = rotationIndex;
        domino.orientation = getOrientationForRotationIndex(rotationIndex);
        domino.anchor = { ...candidate.anchor };
        domino.placedCells = placedCells;
        if (domino.variant === 'clown' && !this.clownCorruption) {
            this.clownCorruption = {
                row: candidate.anchor.row,
                col: candidate.anchor.col,
                dominoId: domino.id,
            };
        }
        this._syncGlowState();
        return domino;
    }

    updateDominoTablePosition(dominoId, tablePosition) {
        const domino = this.getDomino(dominoId);
        if (!domino) return null;
        domino.tablePosition = { ...tablePosition };
        return domino;
    }

    _syncGlowState() {
        const evaluation = this.getEvaluation();
        const chargeGroupByCell = new Map();

        this.getChargeGroupSummaries().forEach((group) => {
            group.cells.forEach((cell) => {
                chargeGroupByCell.set(cellKey(cell.row, cell.col), group);
            });
        });

        this.dominoes.forEach((domino) => {
            domino.isFullyGlowing = evaluation.solved || (domino.variant === 'purple' && domino.placedCells.length > 0);
            domino.placedCells = domino.placedCells.map((cell) => ({
                ...cell,
                matchesCharge: this.isChargeMatched(cell.row, cell.col),
                matchesEquality: this.isEqualMatched(cell.row, cell.col),
                matchesInequality: this.isNotEqualMatched(cell.row, cell.col),
                matchesGroup: Boolean(chargeGroupByCell.get(cellKey(cell.row, cell.col))?.matched),
            }));
        });
    }
}

const GRID_SOLVABILITY_CACHE = new WeakMap();

function createPlacementCandidate(rotationIndex, row, col) {
    const normalizedRotationIndex = normalizeRotationIndex(rotationIndex);
    const orientation = getOrientationForRotationIndex(normalizedRotationIndex);

    if (normalizedRotationIndex === 0) {
        return {
            anchor: { row, col },
            cells: [
                { row, col },
                { row: row + 1, col },
            ],
            rotationIndex: normalizedRotationIndex,
            orientation,
        };
    }

    if (normalizedRotationIndex === 1) {
        return {
            anchor: { row, col },
            cells: [
                { row, col: col + 1 },
                { row, col },
            ],
            rotationIndex: normalizedRotationIndex,
            orientation,
        };
    }

    if (normalizedRotationIndex === 2) {
        return {
            anchor: { row, col },
            cells: [
                { row: row + 1, col },
                { row, col },
            ],
            rotationIndex: normalizedRotationIndex,
            orientation,
        };
    }

    return {
        anchor: { row, col },
        cells: [
            { row, col },
            { row, col: col + 1 },
        ],
        rotationIndex: normalizedRotationIndex,
        orientation,
    };
}

function canPlaceCandidate(state, candidate) {
    return candidate.cells.every((cell) => (
        cell.row >= 0
        && cell.row < state.grid.length
        && cell.col >= 0
        && cell.col < (state.grid[cell.row]?.length ?? 0)
        && state.canOccupyCell(cell.row, cell.col)
    ));
}

function searchPuzzleSolution(state, dominoIndex = 0, budget = { remaining: 8000, timedOut: false }) {
    if (budget.remaining <= 0) {
        budget.timedOut = true;
        return false;
    }
    budget.remaining -= 1;

    if (state.getEvaluation().solved) return true;
    if (dominoIndex >= state.dominoes.length) return false;

    const domino = state.dominoes[dominoIndex];

    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex += 1) {
        for (let row = 0; row < state.grid.length; row += 1) {
            const rowLength = state.grid[row]?.length ?? 0;
            for (let col = 0; col < rowLength; col += 1) {
                if (budget.timedOut) return false;
                const candidate = createPlacementCandidate(rotationIndex, row, col);
                if (!canPlaceCandidate(state, candidate)) continue;

                state.placeDomino(domino.id, candidate);
                if (searchPuzzleSolution(state, dominoIndex + 1, budget)) {
                    state.clearDominoPlacement(domino.id);
                    return true;
                }

                state.clearDominoPlacement(domino.id);
            }
        }
    }

    if (!budget.timedOut) {
        if (searchPuzzleSolution(state, dominoIndex + 1, budget)) {
            return true;
        }
    }

    return false;
}

function isPlayableGridOption(gridOption, globalBudget = null) {
    if (!gridOption || gridOption.impossible) return false;
    if (globalBudget && globalBudget.timedOut) return false;
    if (GRID_SOLVABILITY_CACHE.has(gridOption)) {
        return GRID_SOLVABILITY_CACHE.get(gridOption);
    }

    const state = new MachinePuzzleState({
        ...gridOption,
        impossible: false,
    });
    
    const budget = globalBudget || { remaining: 8000, timedOut: false };
    const isSolvable = searchPuzzleSolution(state, 0, budget);

    if (!budget.timedOut) {
        GRID_SOLVABILITY_CACHE.set(gridOption, isSolvable);
    }
    return isSolvable;
}

function collectBoardConstraintCandidates(shapeGrid) {
    const candidates = [];

    shapeGrid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (Number.isInteger(cell) && cell === CELL_WALL) return;
            candidates.push({ row: rowIndex, col: colIndex });
        });
    });

    return candidates;
}

function injectNotEqualConstraint(gridOption, randomFn = Math.random, validatePlayability = true) {
    if (!gridOption) return gridOption;

    const budget = { remaining: 8000, timedOut: false };
    const candidates = shuffleCells(
        collectBoardConstraintCandidates(gridOption.grid).filter(({ row, col }) => {
            const cell = gridOption.grid?.[row]?.[col];
            return Number.isInteger(cell) && cell !== CELL_WALL;
        }),
        randomFn
    );
    for (let index = 0; index < candidates.length; index += 1) {
        for (let innerIndex = index + 1; innerIndex < candidates.length; innerIndex += 1) {
            const first = candidates[index];
            const second = candidates[innerIndex];
            const grid = cloneShapeGrid(gridOption.grid);
            grid[first.row][first.col] = notLinkCell(second.row, second.col);
            grid[second.row][second.col] = notLinkCell(first.row, first.col);

            const candidateOption = {
                ...gridOption,
                grid,
            };

            if (!validatePlayability || isPlayableGridOption(candidateOption, budget)) {
                return candidateOption;
            }
            if (budget.timedOut) {
                return gridOption;
            }
        }
    }

    return gridOption;
}

// ─── Forward Generation ──────────────────────────────────────────────────────
// Build domino puzzles by forward-tiling then deriving constraints.
// O(n) in board size — zero backtracking latency.

/**
 * Greedily tile a grid with dominos. We snake through the grid left-to-right,
 * top-to-bottom. When a cell is free we try to pair it right then down.
 * Any un-paired cell at the end of a pass is left open (becomes a singleton
 * charge cell that must be covered by a domino spanning it).
 */
function greedyTileGrid(grid, openKeys, randomFn) {
    // Proper domino tiling via bipartite perfect matching (Hopcroft-Karp-ish
    // with randomized neighbor order). The grid is bipartite under the
    // checkerboard coloring — a perfect matching is a perfect tiling. This
    // replaces a purely greedy tiler that failed on most irregular shapes.
    const nodes = [...openKeys];
    if (nodes.length === 0) return [];
    const indexByKey = new Map(nodes.map((key, idx) => [key, idx]));
    const isWhite = nodes.map((key) => {
        const [r, c] = key.split(',').map(Number);
        return (r + c) % 2 === 0;
    });
    const neighbors = nodes.map((key) => {
        const [r, c] = key.split(',').map(Number);
        const list = [
            [r, c + 1], [r + 1, c], [r, c - 1], [r - 1, c],
        ].sort(() => randomFn() - 0.5);
        const result = [];
        for (const [nr, nc] of list) {
            const nk = `${nr},${nc}`;
            if (indexByKey.has(nk)) result.push(indexByKey.get(nk));
        }
        return result;
    });

    const matchOf = new Array(nodes.length).fill(-1);
    const tryAugment = (u, visited) => {
        for (const v of neighbors[u]) {
            if (visited.has(v)) continue;
            visited.add(v);
            if (matchOf[v] === -1 || tryAugment(matchOf[v], visited)) {
                matchOf[v] = u;
                matchOf[u] = v;
                return true;
            }
        }
        return false;
    };

    const whiteOrder = [];
    for (let i = 0; i < nodes.length; i += 1) if (isWhite[i]) whiteOrder.push(i);
    whiteOrder.sort(() => randomFn() - 0.5);
    for (const u of whiteOrder) {
        if (matchOf[u] === -1) tryAugment(u, new Set());
    }

    const pairs = [];
    const seen = new Set();
    for (let i = 0; i < nodes.length; i += 1) {
        if (matchOf[i] === -1 || seen.has(i)) continue;
        const j = matchOf[i];
        seen.add(i);
        seen.add(j);
        const [r1, c1] = nodes[i].split(',').map(Number);
        const [r2, c2] = nodes[j].split(',').map(Number);
        pairs.push([[r1, c1], [r2, c2]]);
    }
    return pairs;
}

/**
 * Assign pip values to a tiled pair such that the resulting domino is
 * interesting (values differ by 1–3) and covers charge cells correctly.
 */
function assignPipsForPair(pair, chargeMap, randomFn) {
    const [a, b] = pair;
    const aKey = `${a[0]},${a[1]}`;
    const bKey = `${b[0]},${b[1]}`;
    const aCharge = chargeMap.get(aKey);
    const bCharge = chargeMap.get(bKey);

    const randomPip = () => Math.floor(randomFn() * 5); // 0-4
    const first = aCharge !== undefined ? aCharge : randomPip();
    const second = bCharge !== undefined ? bCharge : randomPip();
    return { first, second };
}

/**
 * Build a new grid with charge cells injected at positions that will be
 * covered by domino halves, derived directly from the tiling.
 * We choose a random subset of pairs to become charge targets so the
 * board isn't entirely charge-constrained on day 1.
 */
function deriveChargeGridFromTiling(baseGrid, pairs, chargeMap, randomFn) {
    const grid = cloneShapeGrid(baseGrid);

    // Strip all existing charge codes first.
    for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < grid[r].length; c++) {
            if (isChargeCode(grid[r][c])) {
                grid[r][c] = CELL_EMPTY;
            }
        }
    }

    // Re-inject charge cells from pairs.
    for (const pair of pairs) {
        for (const [r, c] of pair) {
            const k = `${r},${c}`;
            const pip = chargeMap.get(k);
            if (pip !== undefined) {
                // charge code = pip + 1 (MIN_CHARGE_CODE = 2 means pip 1)
                const code = Math.min(MAX_CHARGE_CODE, Math.max(MIN_CHARGE_CODE, pip + 1));
                grid[r][c] = code;
            }
        }
    }

    return grid;
}

// ── NYT-style pip board shapes ──────────────────────────────────────────────
// Irregular fully-filled polyominoes. Each is a 2D grid where 0 = open play
// cell and 1 = wall. Every shape has an even number of open cells and is
// domino-tileable. Shapes range from 10 to 16 cells across a mix of bounding
// boxes and silhouettes (L, T, U, Z, staircase, cross, notch, peninsula,
// pennant, etc.) so each unit gets a visibly distinct board.
const NYT_PIP_SHAPES = Object.freeze([
    // 1. Wide L (10)
    [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 1, 1],
        [0, 0, 0, 1, 1, 1],
    ],
    // 2. T-bar (10)
    [
        [0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 1, 1],
        [1, 1, 0, 0, 1, 1],
    ],
    // 3. Staircase (16)
    [
        [0, 0, 0, 0, 1, 1],
        [0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0],
    ],
    // 4. Cross (12)
    [
        [1, 1, 0, 0, 1, 1],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 1, 1],
    ],
    // 5. H-bar (10)
    [
        [0, 0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 0, 0],
    ],
    // 6. U-dish (14)
    [
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ],
    // 7. Z-brick (12)
    [
        [0, 0, 0, 0, 1, 1],
        [0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0],
    ],
    // 8. Notched rectangle (14)
    [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ],
    // 9. Pennant (12)
    [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 0, 0],
    ],
    // 10. Step-down (14)
    [
        [0, 0, 0, 0, 1, 1, 1, 1],
        [0, 0, 0, 0, 0, 0, 1, 1],
        [1, 1, 0, 0, 0, 0, 0, 0],
    ],
    // 11. Tee-bar (12)
    [
        [1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 1, 1, 0, 0],
    ],
    // 12. Double-L (14)
    [
        [0, 0, 0, 0, 1, 1],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [1, 1, 0, 0, 0, 0],
    ],
    // 13. Spiral (16)
    [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 0, 0],
        [0, 0, 0, 0, 0, 0],
    ],
    // 14. Peninsula (12)
    [
        [1, 1, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 1, 1],
    ],
    // 15. Goblet (12)
    [
        [0, 0, 0, 0, 0, 0],
        [1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1],
    ],
    // 16. Diamond-ish (12)
    [
        [1, 1, 0, 0, 1, 1],
        [1, 0, 0, 0, 0, 1],
        [1, 0, 0, 0, 0, 1],
        [1, 1, 0, 0, 1, 1],
    ],
]);

function hashString(value) {
    let hash = 0x811c9dc5;
    const str = String(value);
    for (let i = 0; i < str.length; i += 1) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

function gridFingerprint(grid) {
    if (!Array.isArray(grid)) return 'empty';
    return grid.map((row) => (Array.isArray(row) ? row.join(',') : '')).join(';');
}

function pickNytShapeForGrid(gridOption) {
    const fp = gridFingerprint(gridOption?.grid);
    const index = hashString(`nyt:${fp}`) % NYT_PIP_SHAPES.length;
    return NYT_PIP_SHAPES[index];
}

function buildNytShapeBaseGrid(gridOption) {
    const shape = pickNytShapeForGrid(gridOption);
    return shape.map((row) => row.slice());
}

function canBeFullyTiled(grid) {
    const open = new Set();
    grid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell !== CELL_WALL) open.add(`${r},${c}`);
    }));
    if (open.size % 2 !== 0) return false;
    const pairs = greedyTileGrid(grid, open, () => 0.5);
    const covered = new Set();
    pairs.forEach(([[r1, c1], [r2, c2]]) => {
        covered.add(`${r1},${c1}`);
        covered.add(`${r2},${c2}`);
    });
    return covered.size === open.size;
}

/**
 * Main forward-generation entry point. Replaces the old
 * generateProceduralDominos + iterative backtracking inside
 * buildStageConstraintProfile.
 *
 * Steps:
 *  1. Tile the grid forward → guaranteed valid cover, O(n).
 *  2. Assign pip values (honouring any existing charge cells).
 *  3. Choose which halves become charge constraints.
 *  4. Build domino objects.
 *  5. Return { dominos, grid } — the grid may differ if we derived new charges.
 */
function forwardGeneratePuzzle(gridOption, stage = 1, randomFn = Math.random) {
    if (gridOption.impossible) {
        return { dominos: gridOption.dominos || [], grid: gridOption.grid };
    }

    // Replace the authored grid shape with an NYT-style fully-filled polyomino
    // drawn from the shape pool. Deterministic per-option (seeded off the
    // original grid) so the same unit always produces the same layout.
    const nytBase = buildNytShapeBaseGrid(gridOption);
    const baseGrid = canBeFullyTiled(nytBase)
        ? nytBase
        : stripGridConstraintMarkers(gridOption.grid);

    // --- 1. Collect open cells ---
    const openKeys = new Set();
    const existingChargeMap = new Map(); // key -> required pip (0-4)
    baseGrid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell === CELL_WALL) return;
        openKeys.add(`${r},${c}`);
        if (isChargeCode(cell)) {
            existingChargeMap.set(`${r},${c}`, cell - 1);
        }
    }));

    if (openKeys.size < 2) {
        return { dominos: gridOption.dominos || [], grid: gridOption.grid };
    }

    // Preserve any special dominos (clown/purple) from the original set.
    const reservedDominos = (gridOption.dominos || []).filter(
        (d) => d.variant === 'clown' || d.variant === 'purple'
    );

    // --- 2. Tile the grid ---
    const pairs = greedyTileGrid(baseGrid, openKeys, randomFn);
    if (pairs.length === 0) {
        return { dominos: gridOption.dominos || [], grid: gridOption.grid };
    }

    // --- 3. Choose which cells become charge constraints ---
    // We want a mix: 40-70% of pairs have at least one charge half.
    // Day 1 stays airy (~25% of pairs get a charge half); Day 2 doubles up;
    // Day 3 saturates so most pairs carry a constraint.
    const chargeRatio = stage === 1 ? 0.12 : stage === 2 ? 0.5 : 0.75;
    const chargeMap = new Map(existingChargeMap); // start from any pre-existing charges

    // Shuffle pairs for random charge selection.
    const shuffledPairs = [...pairs].sort(() => randomFn() - 0.5);
    const chargeTarget = Math.max(1, Math.min(
        pairs.length,
        Math.round(pairs.length * chargeRatio),
    ));
    let chargeCount = 0;

    for (const pair of shuffledPairs) {
        if (chargeCount >= chargeTarget) break;
        // Pick one or both halves.
        const applyBoth = randomFn() < 0.4;
        for (const [r, c] of pair) {
            const k = `${r},${c}`;
            if (chargeMap.has(k)) continue; // already fixed by existing charge
            // Pip values 0–4, but we favour 1–3 for interesting gameplay.
            const pip = Math.floor(randomFn() * 4) + 1;
            chargeMap.set(k, Math.min(4, pip));
            chargeCount++;
            if (!applyBoth) break;
        }
    }

    // --- 4. Assign pips to each pair and build dominos ---
    const newGrid = deriveChargeGridFromTiling(baseGrid, pairs, chargeMap, randomFn);
    const pipAssignments = pairs.map((pair) => assignPipsForPair(pair, chargeMap, randomFn));
    const newDominos = pipAssignments.map(({ first, second }) => createDomino(first, second));

    // Build a pip map that captures the tiled pip at every cell (solution basis).
    const solutionPipMap = new Map();
    pairs.forEach((pair, index) => {
        const { first, second } = pipAssignments[index];
        solutionPipMap.set(`${pair[0][0]},${pair[0][1]}`, first);
        solutionPipMap.set(`${pair[1][0]},${pair[1][1]}`, second);
    });

    return {
        dominos: [...newDominos, ...reservedDominos],
        grid: newGrid,
        solution: {
            pairs,
            pipMap: solutionPipMap,
        },
    };
}

/**
 * Inject per-cell comparator (`<N` / `>N`) constraints on open cells. The
 * generation tiling's pip map is used as the source of truth so every
 * comparator placed is satisfiable by the reference solution.
 */
function injectPerCellComparators(grid, pipMap, randomFn, stage = 1) {
    const out = cloneShapeGrid(grid);

    const candidates = [];
    for (let r = 0; r < out.length; r++) {
        for (let c = 0; c < out[r].length; c++) {
            if (out[r][c] !== CELL_EMPTY) continue;
            const pip = pipMap.get(`${r},${c}`);
            if (!Number.isInteger(pip)) continue;
            candidates.push({ r, c, pip });
        }
    }

    if (candidates.length === 0) return out;

    // Per-day comparator density — keep Day 1 minimal (only what the
    // solution needs feel of); ramp on later days.
    const ratio = stage >= 3 ? 0.65 : stage === 2 ? 0.45 : 0.08;
    const target = Math.max(0, Math.round(candidates.length * ratio));

    // Shuffle (Fisher–Yates with seeded randomFn).
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(randomFn() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    let placed = 0;
    for (const { r, c, pip } of candidates) {
        if (placed >= target) break;
        const canLessThan = pip < 4;   // threshold in [pip+1, 4]
        const canGreaterThan = pip > 0; // threshold in [0, pip-1]

        let op;
        if (canLessThan && canGreaterThan) {
            op = randomFn() < 0.5 ? '<' : '>';
        } else if (canLessThan) {
            op = '<';
        } else if (canGreaterThan) {
            op = '>';
        } else {
            continue;
        }

        let threshold;
        if (op === '<') {
            const range = 4 - pip;
            threshold = pip + 1 + Math.floor(randomFn() * range);
        } else {
            threshold = Math.floor(randomFn() * pip);
        }

        out[r][c] = createComparatorCell(op, threshold);
        placed += 1;
    }

    return out;
}

/**
 * Inject equality (=) constraint links between two domino halves that share
 * the same pip value. This is derived directly from the forward-tiling so
 * it is always solvable — no backtracking needed.
 */
function injectDerivedEqualityLinks(grid, pairs, chargeMap, randomFn, count = 1) {
    const out = cloneShapeGrid(grid);

    // Find pairs of cells (from different dominos) that share the same pip.
    const cellPipList = [];
    for (const pair of pairs) {
        for (const [r, c] of pair) {
            const k = `${r},${c}`;
            const pip = chargeMap.get(k);
            if (pip !== undefined) {
                cellPipList.push({ r, c, pip });
            }
        }
    }

    // Group by pip value, then pick random pairs across different dominos.
    const byPip = new Map();
    for (const entry of cellPipList) {
        if (!byPip.has(entry.pip)) byPip.set(entry.pip, []);
        byPip.get(entry.pip).push(entry);
    }

    let placed = 0;
    const usedCells = new Set();
    const pipGroups = [...byPip.values()].filter((g) => g.length >= 2);
    const shuffled = pipGroups.sort(() => randomFn() - 0.5);

    const isPlainCell = (r, c) => {
        const v = out[r]?.[c];
        return Number.isInteger(v);
    };

    for (const group of shuffled) {
        if (placed >= count) break;
        const sorted = group.sort(() => randomFn() - 0.5);
        // Find first two cells still available (plain, not already linked).
        let a = null;
        let b = null;
        for (const candidate of sorted) {
            const k = `${candidate.r},${candidate.c}`;
            if (usedCells.has(k)) continue;
            if (!isPlainCell(candidate.r, candidate.c)) continue;
            if (!a) { a = candidate; continue; }
            b = candidate;
            break;
        }
        if (!a || !b) continue;
        out[a.r][a.c] = linkCell(b.r, b.c);
        out[b.r][b.c] = linkCell(a.r, a.c);
        usedCells.add(`${a.r},${a.c}`);
        usedCells.add(`${b.r},${b.c}`);
        placed++;
    }

    return out;
}

/**
 * Inject ≠ constraint links between cells that will have different pip values.
 */
function injectDerivedNotEqualLinks(grid, pairs, chargeMap, randomFn, count = 1) {
    const out = cloneShapeGrid(grid);
    const usedCells = new Set();

    const isPlainCell = (r, c) => Number.isInteger(out[r]?.[c]);

    const allCells = [];
    for (const pair of pairs) {
        for (const [r, c] of pair) {
            const k = `${r},${c}`;
            const pip = chargeMap.get(k);
            if (pip !== undefined) allCells.push({ r, c, pip, k });
        }
    }

    const shuffled = allCells.sort(() => randomFn() - 0.5);
    let placed = 0;

    outer: for (let i = 0; i < shuffled.length; i++) {
        for (let j = i + 1; j < shuffled.length; j++) {
            if (placed >= count) break outer;
            const a = shuffled[i];
            const b = shuffled[j];
            if (a.pip === b.pip) continue; // must differ
            if (usedCells.has(a.k) || usedCells.has(b.k)) continue;
            if (!isPlainCell(a.r, a.c) || !isPlainCell(b.r, b.c)) continue;
            out[a.r][a.c] = notLinkCell(b.r, b.c);
            out[b.r][b.c] = notLinkCell(a.r, a.c);
            usedCells.add(a.k);
            usedCells.add(b.k);
            placed++;
        }
    }

    return out;
}

/**
 * Inject charge-group constraints derived from adjacent placed cells that
 * share the same pip value. Groups are guaranteed correct because we know
 * the intended pip values.
 */
function injectDerivedChargeGroups(grid, pairs, chargeMap, randomFn, stage = 1) {
    const out = cloneShapeGrid(grid);
    const usedCells = new Set();

    // Pre-mark any cells that are already occupied by equality/not-equal links
    // so the charge group injector doesn't overwrite them (which would corrupt
    // the anchor resolution chain and throw "Invalid charge group link target").
    grid.forEach((row, r) => row.forEach((cell, c) => {
        if (isLinkCell(cell) || isNotEqualLinkCell(cell)
            || isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)) {
            usedCells.add(`${r},${c}`);
        }
    }));

    // Build adjacency list of (cell, pip) pairs
    const pipGrid = new Map();
    for (const pair of pairs) {
        for (const [r, c] of pair) {
            const k = `${r},${c}`;
            const pip = chargeMap.get(k);
            if (pip !== undefined) pipGrid.set(k, { r, c, pip });
        }
    }

    const allowLessThan = stage >= 2;
    let groupsPlaced = 0;
    const maxGroups = stage >= 3 ? 3 : stage === 2 ? 2 : 0;

    // Find contiguous runs of charge cells and group them.
    const visited = new Set();
    const components = [];
    for (const [, entry] of pipGrid) {
        const startKey = `${entry.r},${entry.c}`;
        if (visited.has(startKey)) continue;
        const comp = [];
        const q = [entry];
        visited.add(startKey);
        while (q.length > 0) {
            const cur = q.shift();
            comp.push(cur);
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
                const nk = `${cur.r + dr},${cur.c + dc}`;
                if (!pipGrid.has(nk) || visited.has(nk)) continue;
                visited.add(nk);
                q.push(pipGrid.get(nk));
            }
        }
        if (comp.length >= 2) components.push(comp);
    }

    for (const comp of components.sort(() => randomFn() - 0.5)) {
        if (groupsPlaced >= maxGroups) break;
        const available = comp.filter((c) => !usedCells.has(`${c.r},${c.c}`));
        if (available.length < 2) continue;

        const cluster = available.slice(0, Math.min(available.length, randomFn() < 0.5 ? 2 : 3));
        const anchor = cluster[0];
        const exactTarget = cluster.reduce((s, e) => s + e.pip, 0);
        const useLessThan = allowLessThan && randomFn() < 0.4;
        const threshold = exactTarget + 1 + Math.floor(randomFn() * Math.max(2, cluster.length));

        out[anchor.r][anchor.c] = createChargeGroupAnchor(useLessThan ? -threshold : exactTarget);
        cluster.slice(1).forEach((cell) => {
            out[cell.r][cell.c] = createChargeGroupLink(anchor.r, anchor.c);
        });

        cluster.forEach((cell) => usedCells.add(`${cell.r},${cell.c}`));
        groupsPlaced++;
    }

    return out;
}

/**
 * Replacement for buildStageConstraintProfile.
 * Uses forward-generation for zero-latency guaranteed-solvable puzzles.
 */
function buildStageConstraintProfile(gridOption, stage = 1, randomFn = Math.random) {
    const normalizedStage = Math.max(1, Number(stage) || 1);

    if (gridOption.impossible) {
        // For impossible layouts we still need dominos — fast path.
        const baseOption = {
            ...cloneGridOption(gridOption),
            grid: stripGridConstraintMarkers(gridOption.grid),
        };
        return {
            ...baseOption,
            dominos: (gridOption.dominos || []).map((d, i) => ({
                id: d.id || `domino_${i + 1}`,
                firstOptionAmount: d.firstOptionAmount ?? 0,
                secondOptionAmount: d.secondOptionAmount ?? 0,
                ...d,
            })),
        };
    }

    // --- Forward generation ---
    const { dominos, grid: derivedGrid, solution } = forwardGeneratePuzzle(gridOption, normalizedStage, randomFn);
    const solutionPipMap = solution?.pipMap || new Map();

    // We now have a clean grid with charge cells baked in and correct dominos.
    // Apply layered constraint injection (all derived, so always solvable).
    const baseOption = {
        ...cloneGridOption(gridOption),
        grid: derivedGrid,
        dominos,
        dayStage: normalizedStage,
        impossible: false,
        inspectionFault: null,
        scrapKind: null,
        scrapStatus: null,
        scrapReason: null,
    };

    // Collect pairs and chargeMap for constraint derivation.
    const openKeys = new Set();
    const chargeMap = new Map();
    derivedGrid.forEach((row, r) => row.forEach((cell, c) => {
        if (cell === CELL_WALL) return;
        openKeys.add(`${r},${c}`);
        if (isChargeCode(cell)) {
            chargeMap.set(`${r},${c}`, cell - 1);
        }
    }));
    const pairs = (solution?.pairs && solution.pairs.length > 0)
        ? solution.pairs
        : greedyTileGrid(derivedGrid, openKeys, randomFn);

    // -- Equality links (Day 1+) FIRST so their usedCells set is populated --
    // Day 1: no derived equality (minimum domino/charge setup only). Day 2+ add links.
    const equalityCount = normalizedStage >= 3 ? 4 : normalizedStage === 2 ? 2 : 0;
    let resultGrid = injectDerivedEqualityLinks(derivedGrid, pairs, chargeMap, randomFn, equalityCount);

    // -- Not-equal links (Day 2+) SECOND --
    // Day 1 has none; Day 2 introduces 1; Day 3 adds 2-3 more for spice.
    const notEqualCount = normalizedStage >= 3 ? 3 : normalizedStage === 2 ? 1 : 0;
    if (notEqualCount > 0) {
        resultGrid = injectDerivedNotEqualLinks(resultGrid, pairs, chargeMap, randomFn, notEqualCount);
    }

    // -- Charge groups SECOND-TO-LAST so they can see which cells are already link cells --
    // and avoid overwriting them (which would corrupt the anchor chain).
    resultGrid = injectDerivedChargeGroups(resultGrid, pairs, chargeMap, randomFn, normalizedStage);

    // -- Per-cell comparators (<N / >N) LAST so they only land on cells that
    // are still CELL_EMPTY — never clobbers other constraints.
    resultGrid = injectPerCellComparators(resultGrid, solutionPipMap, randomFn, normalizedStage);

    return { ...baseOption, grid: resultGrid };
}

function pickBrokenRegionGlyph(randomFn = Math.random) {
    return pickRandomEntry(BROKEN_REGION_GLYPHS, randomFn) || '#';
}

function isolateChargeFaultOnGridOption(gridOption, randomFn = Math.random) {
    const grid = cloneShapeGrid(gridOption.grid);

    const isInBounds = (row, col) => (
        Array.isArray(grid[row]) && col >= 0 && col < grid[row].length
    );
    // Only cells that are CELL_EMPTY are safe to wall without corrupting
    // an adjacent constraint (link/group/comparator).
    const isSafeToWall = (row, col) => {
        if (!isInBounds(row, col)) return false;
        return grid[row][col] === CELL_EMPTY;
    };

    const chargeCandidates = [];
    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isChargeCode(cell)) return;
            const neighbors = getOrthogonalCellNeighbors(rowIndex, colIndex).filter((n) => isInBounds(n.row, n.col));
            const openNeighbors = neighbors.filter((n) => grid[n.row][n.col] !== CELL_WALL);
            if (openNeighbors.length === 0) return;
            // Only accept this charge if every open neighbor is safe to wall
            // (i.e. plain CELL_EMPTY, not a link/group/comparator).
            if (!openNeighbors.every((n) => isSafeToWall(n.row, n.col))) return;
            chargeCandidates.push({
                row: rowIndex,
                col: colIndex,
                neighborCount: openNeighbors.length,
            });
        });
    });

    if (chargeCandidates.length === 0) {
        return {
            option: gridOption,
            target: null,
        };
    }

    // Prefer charges with fewer open neighbors (minimal disturbance).
    const sorted = [...chargeCandidates].sort((left, right) => left.neighborCount - right.neighborCount);
    const target = sorted.slice(0, Math.max(1, Math.min(4, sorted.length)));
    const chosen = pickRandomEntry(target, randomFn) || target[0];

    getOrthogonalCellNeighbors(chosen.row, chosen.col).forEach((neighbor) => {
        if (!isSafeToWall(neighbor.row, neighbor.col)) return;
        grid[neighbor.row][neighbor.col] = CELL_WALL;
    });

    return {
        option: {
            ...gridOption,
            grid,
        },
        target: { row: chosen.row, col: chosen.col },
    };
}

function chooseBrokenMarkerTarget(gridOption, randomFn = Math.random) {
    const normalized = normalizeGridDefinition(gridOption.grid);
    const groups = normalized.chargeGroups || [];
    const equalPairs = normalized.equalPairs || [];

    if (groups.length > 0 && (equalPairs.length === 0 || randomFn() < 0.6)) {
        const group = pickRandomEntry(groups, randomFn) || groups[0];
        if (group) {
            return {
                row: group.anchor.row,
                col: group.anchor.col,
                markerType: 'group',
                markerKey: group.key,
            };
        }
    }

    if (equalPairs.length > 0) {
        const pair = pickRandomEntry(equalPairs, randomFn) || equalPairs[0];
        if (pair) {
            return {
                row: pair.a.row,
                col: pair.a.col,
                markerType: 'equal',
                markerKey: pair.key,
            };
        }
    }

    const fallbackTarget = pickRandomEntry(collectBoardConstraintCandidates(gridOption.grid), randomFn) || { row: 0, col: 0 };
    return {
        row: fallbackTarget.row,
        col: fallbackTarget.col,
        markerType: 'cell',
        markerKey: cellKey(fallbackTarget.row, fallbackTarget.col),
    };
}

function applyBrokenGlyphFault(gridOption, randomFn = Math.random) {
    const markerTarget = chooseBrokenMarkerTarget(gridOption, randomFn);
    const glyph = pickBrokenRegionGlyph(randomFn);

    return {
        ...gridOption,
        inspectionFault: {
            ...markerTarget,
            type: 'corrupted-marker',
            glyph,
            kind: 'compliance',
            status: 'BROKEN GLYPH',
            reason: 'A region marker has collapsed into junk glyphs. The board fails compliance. Scrap the unit.',
        },
        scrapKind: 'compliance',
        scrapStatus: 'BROKEN GLYPH',
        scrapReason: 'A region marker has collapsed into junk glyphs. The board fails compliance. Scrap the unit.',
        impossible: false,
    };
}

function applyIsolatedChargeFault(gridOption, stage = 1, randomFn = Math.random) {
    // Stage a normal NYT-shaped puzzle first, THEN isolate a charge on it.
    // This ensures scrap cases also benefit from the NYT-style fully-filled
    // board shape + dense constraint mix, rather than rendering a sparse 5x5.
    const staged = buildStageConstraintProfile({
        ...gridOption,
        impossible: false,
    }, stage, randomFn);
    const isolated = isolateChargeFaultOnGridOption(staged, randomFn);

    const kind = stage >= 3 ? 'hazard' : (stage === 2 ? 'compliance' : 'unsalvageable');
    const status = stage >= 3 ? 'ISOLATED HAZARD CELL' : 'ISOLATED CHARGE CELL';
    const reason = stage >= 3
        ? 'A live charge cell has been boxed into dead space. The board is unstable and must be scrapped.'
        : 'A charge cell has been boxed into dead space and can never be completed. Scrap the unit.';

    return {
        ...isolated.option,
        inspectionFault: isolated.target ? {
            row: isolated.target.row,
            col: isolated.target.col,
            type: 'isolated-charge-cell',
            kind,
            status,
            reason,
        } : null,
        scrapKind: kind,
        scrapStatus: status,
        scrapReason: reason,
        impossible: false,
    };
}

function applyCorruptedDominoFault(gridOption, randomFn = Math.random) {
    const dominoId = `corrupted_domino_${Math.floor(randomFn() * 100000)}`;
    return {
        ...gridOption,
        dominos: [
            ...gridOption.dominos,
            createDomino(0, 0, {
                id: dominoId,
                variant: 'corrupted',
            }),
        ],
        inspectionFault: {
            type: 'corrupted-domino',
            dominoId,
            kind: 'hazard',
            status: 'CORRUPTED CIRCUIT',
            reason: 'A corrupted red circuit is sitting on the rack. If it exists at all, the unit must be scrapped.',
        },
        scrapKind: 'hazard',
        scrapStatus: 'CORRUPTED CIRCUIT',
        scrapReason: 'A corrupted red circuit is sitting on the rack. If it exists at all, the unit must be scrapped.',
        impossible: false,
    };
}

function applyGridStageToOption(gridOption, stage = 1, randomFn = Math.random) {
    if (!gridOption) return { grid: [], dominos: [] };

    const normalizedStage = Math.max(1, Number(stage) || 1);
    const wantsScrapState = Boolean(gridOption.impossible);
    let stagedOption = buildStageConstraintProfile(gridOption, normalizedStage, randomFn);
    stagedOption.dayStage = normalizedStage;
    stagedOption.impossible = false;

    if (!wantsScrapState) {
        stagedOption.inspectionFault = null;
        stagedOption.scrapKind = null;
        stagedOption.scrapStatus = null;
        stagedOption.scrapReason = null;
        return stagedOption;
    }

    if (normalizedStage === 1) {
        return applyIsolatedChargeFault(gridOption, normalizedStage, randomFn);
    }

    if (normalizedStage === 2) {
        return randomFn() < 0.5
            ? applyIsolatedChargeFault(gridOption, normalizedStage, randomFn)
            : applyBrokenGlyphFault(stagedOption, randomFn);
    }

    const faultType = pickRandomEntry(['isolated', 'marker', 'domino'], randomFn) || 'isolated';
    if (faultType === 'marker') {
        return applyBrokenGlyphFault(stagedOption, randomFn);
    }
    if (faultType === 'domino') {
        return applyCorruptedDominoFault(stagedOption, randomFn);
    }

    return applyIsolatedChargeFault(gridOption, normalizedStage, randomFn);
}

function machineMatchesAvailability(definition, targetDay = null, targetPeriod = null) {
    const dayMatches = targetDay === null
        || !Array.isArray(definition.availableDays)
        || definition.availableDays.includes(targetDay);
    const periodMatches = targetPeriod === null
        || !Array.isArray(definition.availablePeriods)
        || definition.availablePeriods.includes(targetPeriod);

    return dayMatches && periodMatches;
}

export function getEligibleMachineDefinitions(options = {}) {
    const targetDay = typeof options === 'function' ? null : (options.day ?? null);
    const targetPeriod = typeof options === 'function' ? null : (options.period ?? null);
    const eligibilityContext = typeof options === 'function' ? {} : options;
    const machinePool = getMachinePoolDefinitions(targetDay, targetPeriod, eligibilityContext);

    return machinePool.map((definition) => ({
        id: definition.id,
        name: definition.name,
        guaranteedTimeframe: definition.guaranteedTimeframe
            ? { ...definition.guaranteedTimeframe }
            : null,
        trackOutcome: Boolean(definition.trackOutcome),
    }));
}

export function createMachineVariant(options = {}) {
    const randomFn = typeof options === 'function'
        ? options
        : (options.randomFn || Math.random);
    const targetDay = typeof options === 'function' ? null : (options.day ?? null);
    const targetPeriod = typeof options === 'function' ? null : (options.period ?? null);
    const forcedMachineId = typeof options === 'function' ? null : (options.forceMachineId ?? null);
    const forcedScrapPuzzleKey = typeof options === 'function' ? null : (options.forceScrapPuzzleKey ?? null);

    const eligibilityContext = typeof options === 'function' ? {} : options;
    const machinePool = getMachinePoolDefinitions(targetDay, targetPeriod, eligibilityContext);
    const catalogEligible = () => MACHINE_CATALOG.filter((machine) => (
        machinePassesEligibility(machine, targetDay, targetPeriod, eligibilityContext)
    ));
    const forcedDefinition = forcedMachineId
        ? (machinePool.find((machine) => machine.id === forcedMachineId)
            || catalogEligible().find((machine) => machine.id === forcedMachineId))
        : null;
    const definition = forcedDefinition
        || pickRandomEntry(machinePool, randomFn)
        || machinePool[0]
        || pickRandomEntry(catalogEligible(), randomFn)
        || catalogEligible()[0]
        || null;
    if (!definition) {
        throw new Error('No eligible machine definitions for this shift context.');
    }
    const protectedStoryMachine = isProtectedStoryMachine(definition);
    const weightedGridPool = buildWeightedGridPool(definition.possibleGrids, targetPeriod ?? null);
    const gridPool = weightedGridPool.length > 0 ? weightedGridPool : (definition.possibleGrids || []);
    const protectedGridPool = protectedStoryMachine
        ? gridPool.filter((gridOption) => !gridOption?.impossible)
        : gridPool;
    const selectedGridTemplate = pickRandomEntry(protectedGridPool.length > 0 ? protectedGridPool : gridPool, randomFn)
        || protectedGridPool[0]
        || gridPool[0]
        || { grid: [], dominos: [] };
    const selectedGrid = applyGridStageToOption(
        transformGridOption(selectedGridTemplate, pickGridTransformKey(selectedGridTemplate, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
    let selectedFlowPuzzle = applyFlowStageToOption(
        cloneFlowPuzzleOption(pickRandomEntry(definition.possibleCircuits, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
    const gearPool = (() => {
        const period = targetPeriod ?? 1;
        const possibleGears = Array.isArray(definition.possibleGears) ? definition.possibleGears : [];

        if (period >= 3) {
            const day3Pool = Array.isArray(definition.possibleGearsDay3) ? definition.possibleGearsDay3 : [];
            if (day3Pool.length > 0) return day3Pool;
        }
        if (period >= 2) {
            const day2Pool = Array.isArray(definition.possibleGearsDay2) ? definition.possibleGearsDay2 : [];
            if (day2Pool.length > 0) return day2Pool;
            return possibleGears;
        }
        const rustFreePool = possibleGears.filter((gearOption) => !gearOptionHasRustedContent(gearOption));
        return rustFreePool.length > 0 ? rustFreePool : possibleGears;
    })();
    const effectiveGearPool = (() => {
        if (definition.id === 'rebellious_umbrella' && (targetPeriod ?? 1) === 2) {
            const rustFreePool = gearPool.filter((gearOption) => !gearOptionHasRustedContent(gearOption));
            if (rustFreePool.length > 0) return rustFreePool;
        }
        return gearPool;
    })();
    let selectedGearPuzzle = applyGearStageToOption(
        cloneGearPuzzleOption(pickRandomEntry(effectiveGearPool, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
    let selectedDebugPuzzle = applyDebugStageToOption(
        cloneDebugPuzzleOption(pickRandomEntry(definition.possibleDebugs, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
    const forcedKey = forcedScrapPuzzleKey && ['grid', 'flow', 'gear', 'code'].includes(forcedScrapPuzzleKey)
        ? forcedScrapPuzzleKey
        : null;
    if (forcedKey === 'grid' && selectedGrid) {
        const forcedGridTemplate = { ...selectedGrid, impossible: true };
        const forcedStage = pickUnlockedScrapStage(targetPeriod ?? 1, randomFn);
        const forcedGrid = applyGridStageToOption(forcedGridTemplate, forcedStage, randomFn);
        selectedGrid.impossible = Boolean(forcedGrid.impossible);
        selectedGrid.inspectionFault = forcedGrid.inspectionFault ? { ...forcedGrid.inspectionFault } : null;
        selectedGrid.scrapKind = forcedGrid.scrapKind || null;
        selectedGrid.scrapStatus = forcedGrid.scrapStatus || null;
        selectedGrid.scrapReason = forcedGrid.scrapReason || null;
    } else if (forcedKey === 'flow' && selectedFlowPuzzle) {
        selectedFlowPuzzle = buildForcedFlowScrapOption(selectedFlowPuzzle, targetPeriod ?? 1, randomFn);
    } else if (forcedKey === 'gear' && selectedGearPuzzle) {
        selectedGearPuzzle = buildForcedGearScrapOption(selectedGearPuzzle, targetPeriod ?? 1, randomFn);
    } else if (forcedKey === 'code' && selectedDebugPuzzle) {
        selectedDebugPuzzle = buildForcedDebugScrapOption(selectedDebugPuzzle, targetPeriod ?? 1, randomFn);
    }
    if (protectedStoryMachine && selectedGrid) {
        selectedGrid.impossible = false;
        selectedGrid.inspectionFault = null;
        selectedGrid.scrapKind = null;
        selectedGrid.scrapStatus = null;
        selectedGrid.scrapReason = null;
    }
    if (selectedFlowPuzzle) {
        if (protectedStoryMachine) {
            selectedFlowPuzzle.inspectionFault = null;
        }
        selectedFlowPuzzle.progress = createFlowProgress(selectedFlowPuzzle);
    }
    if (selectedGearPuzzle) {
        if (protectedStoryMachine) {
            selectedGearPuzzle.inspectionFault = null;
        }
        selectedGearPuzzle.progress = buildGearProgressSnapshot(selectedGearPuzzle, selectedGearPuzzle.pieces);
    }
    if (selectedDebugPuzzle) {
        if (protectedStoryMachine) {
            selectedDebugPuzzle.resultType = (targetPeriod ?? 1) >= 2 && Array.isArray(selectedDebugPuzzle.actualOutputs) && selectedDebugPuzzle.actualOutputs.length > 0
                ? 'repairable-mismatch'
                : 'stable';
            selectedDebugPuzzle.scrapKind = null;
            selectedDebugPuzzle.scrapStatus = null;
            selectedDebugPuzzle.scrapReason = null;
            if (definition.id === 'rebellious_umbrella' && (targetPeriod ?? 1) >= 2) {
                selectedDebugPuzzle.resultType = 'repairable-mismatch';
                selectedDebugPuzzle.actualOutputs = [
                    toBlockMaskedDebugOutput(selectedDebugPuzzle.expectedOutput || 'INVALID'),
                ];
            }
        }
        selectedDebugPuzzle.progress = createDebugProgress(selectedDebugPuzzle, randomFn);
    }
    if (!protectedStoryMachine) {
        const optionalSlots = [
            { get: () => selectedFlowPuzzle, clear: () => { selectedFlowPuzzle = null; } },
            { get: () => selectedGearPuzzle, clear: () => { selectedGearPuzzle = null; } },
            { get: () => selectedDebugPuzzle, clear: () => { selectedDebugPuzzle = null; } },
        ].filter((slot) => slot.get() !== null);
        if (optionalSlots.length > 1) {
            for (let i = optionalSlots.length - 1; i > 0; i--) {
                const j = Math.floor(randomFn() * (i + 1));
                [optionalSlots[i], optionalSlots[j]] = [optionalSlots[j], optionalSlots[i]];
            }
            const keepCount = optionalSlots.length >= 3 ? (randomFn() < 0.45 ? 1 : 2) : 1;
            optionalSlots.slice(keepCount).forEach((slot) => slot.clear());
        }
    }
    const puzzleState = new MachinePuzzleState(selectedGrid);
    const hasCommunication = randomFn() <= (definition.communicationChance ?? 1);
    const selectedQuestion = hasCommunication
        ? pickRandomEntry(definition.questionDialogues, randomFn)
        : null;
    const openingDialogue = hasCommunication
        ? (pickRandomEntry(definition.openingDialogues, randomFn) || '')
        : '';

    return {
        machineId: definition.id,
        name: definition.name,
        spriteKey: definition.sprite.key,
        spritePath: definition.sprite.path,
        fallbackKey: definition.sprite.fallbackKey,
        selectedGrid,
        flowPuzzle: selectedFlowPuzzle,
        gearPuzzle: selectedGearPuzzle,
        debugPuzzle: selectedDebugPuzzle,
        miniDisplay: cloneMiniDisplay(definition.miniDisplay),
        availableDays: Array.isArray(definition.availableDays) ? [...definition.availableDays] : [],
        availablePeriods: Array.isArray(definition.availablePeriods) ? [...definition.availablePeriods] : [],
        guaranteedTimeframe: definition.guaranteedTimeframe ? { ...definition.guaranteedTimeframe } : null,
        trackOutcome: Boolean(definition.trackOutcome),
        canvasScale: definition.canvasScale ?? 1,
        specialBehavior: definition.specialBehavior || null,
        scrapExitAnimation: definition.scrapExitAnimation || null,
        puzzleState,
        shapeGrid: puzzleState.grid,
        dominoes: puzzleState.dominoes,
        openingDialogue,
        questionDialogue: selectedQuestion ? { ...selectedQuestion } : null,
        dialogueSoundAssetKey: definition.dialogueSoundAssetKey || null,
        hasCommunication,
        dayStage: targetDay ?? 1,
        dossier: definition.dossier || null,
    };
}

export function resolveMachineTexture(scene, machineVariant) {
    const preferredKey = machineVariant?.spriteKey;
    if (preferredKey && scene.textures.exists(preferredKey)) return preferredKey;
    return machineVariant?.fallbackKey || MACHINE_FALLBACK_KEY;
}

function isNotEqualLinkCell(value) {
    return Boolean(value)
        && typeof value === 'object'
        && value.kind === 'not-equal-link'
        && Number.isInteger(value.row)
        && Number.isInteger(value.col);
}

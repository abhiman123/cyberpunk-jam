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
    CIRCUIT_BREAKING: { displayName: 'Circuit Breaking', brokenLabel: 'Circuit breaker rig is locked up.', fixedLabel: 'Circuit breaker rig is reset.' },
    GEARING: { displayName: 'Gearing Desk', brokenLabel: 'Gearing desk is jammed.', fixedLabel: 'Gearing desk is responsive.' },
});

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

function addStandardFlowServiceLoop(tiles) {
    const loopPath = [
        [1, 1],
        [2, 1],
        [3, 1],
        [3, 2],
        [3, 3],
        [2, 3],
        [1, 3],
        [1, 2],
        [1, 1],
    ];

    for (let index = 0; index < loopPath.length - 1; index += 1) {
        addFlowConnection(
            tiles,
            loopPath[index][0],
            loopPath[index][1],
            loopPath[index + 1][0],
            loopPath[index + 1][1],
        );
    }
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

    outputRows.forEach((outRow, index) => {
        const branchCol = outRow === sourceRow
            ? FLOW_TILE_COLS - 1
            : Math.min(1 + index, FLOW_TILE_COLS - 2);
        carveFlowPath(tiles, sourceRow, outRow, FLOW_TILE_COLS, branchCol);
    });

    if (forbiddenCount > 0) {
        addStandardFlowServiceLoop(tiles);
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

function buildTypedFlowOptionLayout({ sources, outputSpecs, previewTitle = 'POWER BUS', rows = FLOW_TILE_ROWS, cols = FLOW_TILE_COLS }) {
    const safeRows = Math.max(3, Number(rows || FLOW_TILE_ROWS));
    const safeCols = Math.max(3, Number(cols || FLOW_TILE_COLS));
    const tiles = Array.from({ length: safeRows }, () => (
        Array.from({ length: safeCols }, () => ({ type: 'empty', rotation: 0, _dirs: new Set() }))
    ));
    const seededRandom = createSeededRandom(`${previewTitle}:${sources.map((source) => `${source.key}:${source.row}`).join('|')}`);

    outputSpecs.forEach((outputSpec, index) => {
        const source = sources.find((candidate) => candidate.key === outputSpec.sourceKey) || sources[index % sources.length];
        const branchCol = outputSpec.row === source.row
            ? safeCols - 1
            : Math.min(1 + (index % Math.max(1, safeCols - 2)), safeCols - 2);
        carveFlowPath(tiles, source.row, outputSpec.row, safeCols, branchCol);
    });

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

function findFlowWireFilterCell(flowPuzzleOption, targetRow) {
    const cols = getFlowOptionCols(flowPuzzleOption);
    const sourceRow = getPrimaryFlowSourceRow(flowPuzzleOption);
    const rowCells = (flowPuzzleOption?.tiles?.[targetRow] || [])
        .map((cell, x) => ({ x, cell }))
        .filter(({ x, cell }) => x > 0 && x < cols - 1 && cell && cell.type && cell.type !== 'empty');

    if (rowCells.length === 0) {
        return getFirstFlowLeadCell(flowPuzzleOption);
    }

    const selectedCell = targetRow === sourceRow ? rowCells[rowCells.length - 1] : rowCells[0];
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

function buildDayTwoWireFilters(flowPuzzleOption, outputSpecs) {
    return outputSpecs
        .map((outputSpec) => {
            const filterCell = findFlowWireFilterCell(flowPuzzleOption, outputSpec.row);
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
    const candidates = [];

    (flowPuzzleOption?.tiles || []).forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!cell || cell.type === 'empty') return;
            if (blocked.has(`${colIndex},${rowIndex}`)) return;
            if (colIndex === 0 && sourceRows.has(rowIndex)) return;
            if (colIndex === FLOW_TILE_COLS - 1 && outputRows.has(rowIndex)) return;
            candidates.push({ x: colIndex, y: rowIndex });
        });
    });

    return candidates;
}

function applyFlowStageToOption(flowPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!flowPuzzleOption) return null;

    const baseTargets = cloneRepairTargets(flowPuzzleOption.repairTargets)
        .sort((left, right) => left.row - right.row);
    const sourceRow = getPrimaryFlowSourceRow(flowPuzzleOption);

    if (stage <= 1) {
        const stagedOption = {
            ...flowPuzzleOption,
            dayStage: 1,
            rows: getFlowOptionRows(flowPuzzleOption),
            cols: getFlowOptionCols(flowPuzzleOption),
            sources: [createFlowSource('main', sourceRow, 'neutral', 'PWR')],
            outputSpecs: baseTargets.map((target) => createFlowOutputSpec(target.label, target.row, {
                ...target,
                powerClass: 'neutral',
                sourceKey: 'main',
            })),
            repairTargets: cloneRepairTargets(baseTargets),
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
        const outputSpecs = baseTargets.map((target, index) => createFlowOutputSpec(target.label, target.row, {
            ...target,
            powerClass: index % 2 === 0 ? 'green' : 'orange',
            sourceKey: 'main',
        }));
        const stagedOption = {
            ...flowPuzzleOption,
            rows: getFlowOptionRows(flowPuzzleOption),
            cols: getFlowOptionCols(flowPuzzleOption),
            dayStage: 2,
            stageResultKind: 'repairable',
            sources: [createFlowSource('main', sourceRow, 'neutral', 'PWR')],
            outputSpecs,
            repairTargets: cloneRepairTargets(outputSpecs),
            wireFilters: buildDayTwoWireFilters(flowPuzzleOption, outputSpecs),
            inspectionFault: null,
        };

        if (flowPuzzleOption?.inspectionFault) {
            stagedOption.inspectionFault = { ...flowPuzzleOption.inspectionFault };
            return stagedOption;
        }

        if (randomFn() < 0.34) {
            stagedOption.inspectionFault = randomFn() < 0.5
                ? createMissingLeadFault(stagedOption)
                : createRedWireFault(stagedOption);
        }

        return stagedOption;
    }

    const rows = 7;
    const cols = 7;
    const outputRows = spreadFlowRows(baseTargets.length, rows);
    const sources = [
        createFlowSource('main', 1, 'neutral', 'PWR'),
        createFlowSource('green', Math.floor(rows / 2), 'green', 'GRN'),
        createFlowSource('orange', rows - 2, 'orange', 'ORG'),
    ];
    const powerCycle = ['neutral', 'green', 'orange'];
    const outputSpecs = baseTargets.map((target, index) => {
        const powerClass = powerCycle[index % powerCycle.length];
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
        const hazardousOutput = pickRandomEntry(outputSpecs, randomFn) || outputSpecs[0];
        hazardousOutput.powerClass = 'red';
        hazardousOutput.sourceKey = null;
        stagedOption.outputSpecs = cloneFlowOutputSpecs(outputSpecs);
        stagedOption.repairTargets = cloneRepairTargets(outputSpecs);
        stagedOption.inspectionFault = createCracklingOutputFault(hazardousOutput);
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
        allowRustedGears: stage >= 2,
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

    if (stage === 1 && randomFn() < 0.28) {
        stagedOption.inspectionFault = createCrackedDriveFault(stagedOption, randomFn);
    } else if (stage === 2 && randomFn() < 0.34) {
        const primaryFault = randomFn() < 0.5
            ? createCrackedDriveFault(stagedOption, randomFn)
            : createVirusGearFault(stagedOption, randomFn);
        stagedOption.inspectionFault = primaryFault
            || createVirusGearFault(stagedOption, randomFn)
            || createCrackedDriveFault(stagedOption, randomFn);
    } else if (stage >= 3 && randomFn() < 0.24) {
        stagedOption.inspectionFault = createSparkInstabilityFault(stagedOption, randomFn);
    }

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
    prompt: String(prompt || ''),
    repairPrompt: String(repairPrompt || ''),
    expectedOutput: String(expectedOutput || ''),
    actualOutputs: cloneDebugOutputs(actualOutputs),
    previewTitle,
    description,
});

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

function applyDebugStageToOption(debugPuzzleOption, stage = 1, randomFn = Math.random) {
    if (!debugPuzzleOption) return null;

    const stagedOption = {
        ...debugPuzzleOption,
        dayStage: stage,
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
        stagedOption.resultType = randomFn() < 0.58 ? 'repairable-mismatch' : 'stable';
        return stagedOption;
    }

    if (stage >= 3 && randomFn() < 0.24) {
        stagedOption.resultType = 'spark-hazard';
        stagedOption.scrapKind = 'hazard';
        stagedOption.scrapStatus = 'SPARKED DEBUG BUG';
        stagedOption.scrapReason = 'A sparked debugger bug indicates unstable software contamination. Scrap the unit immediately.';
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
        dayStage: Number(debugPuzzleOption?.dayStage || 1),
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
            inspectionFault: {
                x: 2,
                y: 2,
                type: 'emotion-flood',
                kind: 'unsalvageable',
                status: 'TEAR FLOOD',
                reason: 'A flood of emotional feedback has torn open the wiring in front of the emotion regulator. Floor repair is impossible. Scrap the unit.',
            },
        }),
    ]),
    rich_mf: Object.freeze([
        createFlowPuzzleOption({
            sourceRow: 2,
            outputs: { 0: 'INTEL', 2: 'LOGIC', 4: 'VOICE' },
            forbiddenCount: 1,
            previewTitle: 'BRAIN LATTICE',
            repairTargets: [
                createRepairTarget('INTEL', 0),
                createRepairTarget('LOGIC', 2),
                { ...createRepairTarget('VOICE', 4), displayName: 'Executive Voice Box' },
            ],
        }),
        createFlowPuzzleOption({
            sourceRow: 1,
            outputs: { 0: 'VOICE', 2: 'INTEL', 4: 'LOGIC' },
            forbiddenCount: 1,
            previewTitle: 'HEAD UPLINK',
            repairTargets: [
                { ...createRepairTarget('VOICE', 0), displayName: 'Executive Voice Box' },
                createRepairTarget('INTEL', 2),
                createRepairTarget('LOGIC', 4),
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
    workforce_quality_control_supervisor: Object.freeze([
        createFlowPuzzleOption({
            sourceRow: 2,
            outputs: {
                0: 'PROGRAMMING',
                1: 'QUALITY_CONTROL',
                2: 'WIRING',
                3: 'CIRCUIT_BREAKING',
                4: 'GEARING',
            },
            forbiddenCount: 0,
            previewTitle: 'WORK MIRROR',
        }),
        createFlowPuzzleOption({
            sourceRow: 1,
            outputs: {
                0: 'PROGRAMMING',
                2: 'QUALITY_CONTROL',
                3: 'WIRING',
                4: 'GEARING',
            },
            forbiddenCount: 1,
            previewTitle: 'STATION LOOP',
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

const SHARED_FLOW_OPTIONS = Object.freeze([
    createFlowPuzzleOption({ sourceRow: 2, outputs: { 1: 'POWER', 3: 'CPU' }, forbiddenCount: 0, previewTitle: 'MAIN BUS' }),
    createFlowPuzzleOption({ sourceRow: 1, outputs: { 0: 'POWER', 2: 'MEMORY', 4: 'MOTOR' }, forbiddenCount: 1, previewTitle: 'SYS LOOP' }),
    createFlowPuzzleOption({ sourceRow: 3, outputs: { 1: 'CPU', 2: 'SENSOR' }, forbiddenCount: 0, previewTitle: 'CTRL BUS' }),
    createFlowPuzzleOption({ sourceRow: 2, outputs: { 0: 'MOTOR', 3: 'POWER', 4: 'SENSE' }, forbiddenCount: 1, previewTitle: 'DRIVE BUS' }),
]);

const SHARED_DEBUG_OPTIONS = Object.freeze([
    createDebugPuzzleOption({
        prompt: 'run system boot',
        repairPrompt: 'patch boot.seq.reset',
        expectedOutput: 'BOOT OK // ALL SYSTEMS NOMINAL',
        actualOutputs: [
            'BOOT FAIL // INIT SEQUENCE STALLED',
            'BOOT OK // SENSOR ARRAY SKIPPED',
            'BOOT BAD // CLOCK DRIFT HIGH',
            'BOOT FAIL // MEMORY CHECK TIMEOUT',
            'BOOT OK // REDUNDANCY OFFLINE',
        ],
    }),
    createDebugPuzzleOption({
        prompt: 'test power relay',
        repairPrompt: 'patch relay.volt.sync',
        expectedOutput: 'RELAY OK // VOLTAGE STABLE',
        actualOutputs: [
            'RELAY FAIL // VOLTAGE SPIKE DETECTED',
            'RELAY OK // OUTPUT CLIPPED',
            'RELAY BAD // GROUND LOOP PRESENT',
            'RELAY FAIL // DRAW EXCEEDS LIMIT',
            'RELAY OK // REGULATOR BYPASSED',
        ],
    }),
    createDebugPuzzleOption({
        prompt: 'check sensor array',
        repairPrompt: 'patch sensor.cal.restore',
        expectedOutput: 'SENSOR OK // ARRAY CALIBRATED',
        actualOutputs: [
            'SENSOR FAIL // PROXIMITY DRIFT',
            'SENSOR OK // THERMAL OFFSET HIGH',
            'SENSOR BAD // CAL TABLE CORRUPTED',
            'SENSOR FAIL // SCAN LOOP FROZEN',
            'SENSOR OK // RANGE CLIPPED',
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

const SUPERVISOR_GEAR_OPTIONS = Object.freeze([
    createGearPuzzleOption({
        previewTitle: 'HAND ARRAY',
        description: 'Line up the hand-drive gears so the supervisor can type, drag, and sort without shaking apart.',
        board: [
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.SOURCE, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.EMPTY, GEAR_CODES.EMPTY, GEAR_CODES.SINK, GEAR_CODES.WALL],
            [GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL, GEAR_CODES.WALL],
        ],
        pieces: [
            createGearPiece(GEAR_CODES.HORIZONTAL, 1, 2),
            createGearPiece(GEAR_CODES.CURVE_NE, 3, 1, { movable: false }),
            createGearPiece(GEAR_CODES.VERTICAL, 2, 3),
        ],
    }),
    createGearPuzzleOption({
        previewTitle: 'DESK MOTOR',
        description: 'Tune the wrist train for typing speed, clipboard drags, and all the little station motions.',
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
    workforce_quality_control_supervisor: SUPERVISOR_GEAR_OPTIONS,
    future_lounge_chair: SHARED_GEAR_OPTIONS,
});

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
    workforce_quality_control_supervisor: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'run station rehearsal',
            repairPrompt: 'patch labor.mirror.align',
            expectedOutput: '"..." [It worked.]',
            actualOutputs: [
                '"..." [It almost worked.]',
                '"..." [It worked?]',
                '"..." [Manual step missing.]',
                '"..." [Replacement path ready.]',
                '"..." [It worked.] [Again.]',
            ],
            previewTitle: 'QC MIRROR',
            description: 'Run the station rehearsal. If the output drifts, patch the replacement script before it clears inspection.',
        }),
        createDebugPuzzleOption({
            prompt: 'test replacement handshake',
            repairPrompt: 'patch supervisor.hands.sync',
            expectedOutput: '"..." [It worked.]',
            actualOutputs: [
                '"..." [It worked. probably.]',
                '"..." [Clerk posture unstable.]',
                '"..." [Manual override logged.]',
                '"..." [It worked.] [For now.]',
                '"..." [Operator no longer required.]',
            ],
            previewTitle: 'HANDSHAKE',
            description: 'Run the replacement handshake and make the result land exactly clean.',
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
    rich_mf: Object.freeze([
        createDebugPuzzleOption({
            prompt: 'run executive checksum',
            repairPrompt: 'patch exec.cache.rethread',
            expectedOutput: 'EXEC HASH OK // PRIORITIES ALIGNED',
            actualOutputs: [
                'EXEC HASH FAIL // PRIORITIES INVERTED',
                'EXEC HASH OK // VANITY LOOP HIGH',
                'EXEC HASH BAD // EGO CACHE NULL',
                'EXEC HASH FAIL // HIERARCHY DRIFT',
                'EXEC HASH OK // EMPATHY MODULE STALLED',
            ],
        }),
        createDebugPuzzleOption({
            prompt: 'test wealth routing',
            repairPrompt: 'patch fiscal.neural.rebind',
            expectedOutput: 'WEALTH ROUTING OK // STATUS SUPREME',
            actualOutputs: [
                'WEALTH ROUTING FAIL // STATUS LEAK',
                'WEALTH ROUTING OK // TAX PANIC',
                'WEALTH ROUTING BAD // SIGNAL COMMON',
                'WEALTH ROUTING FAIL // HEDGE NULL',
                'WEALTH ROUTING OK // EGO BUFFER CLIPPED',
            ],
        }),
    ]),
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
        artScale: 0.5,
        artAngle: 6,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    cry_baby: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -2,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    rich_mf: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -5,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    jester_in_the_box: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: 2,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    rebellious_umbrella: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -3,
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
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -4,
        gridPreview: { x: 25, y: 110, width: 60, height: 40, label: 'GRID' },
        flowPreview: { x: 150, y: 50, width: 60, height: 40, label: 'FLOW' },
        codePreview: { x: 25, y: 50, width: 60, height: 40, label: 'CODE' },
        gearPreview: { x: 150, y: 110, width: 60, height: 40, label: 'GEAR' },
    }),
    workforce_quality_control_supervisor: createMiniDisplay({
        artX: 118,
        artY: 105,
        artScale: 0.5,
        artAngle: -2,
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
        artScale: 0.5,
        artAngle: -4,
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
}) => ({
    id,
    name,
    sprite: createMachineSprite(id, spriteFileName),
    possibleGrids,
    possibleCircuits,
    possibleGears,
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
});

const clampPipValue = (value) => Math.max(0, Math.min(4, Number.isFinite(value) ? value : 0));

const createDomino = (firstOptionAmount, secondOptionAmount, extra = {}) => ({
    firstOptionAmount: clampPipValue(firstOptionAmount),
    secondOptionAmount: clampPipValue(secondOptionAmount),
    ...extra,
});

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
    opening,
    question,
    yesDialogue,
    noDialogue,
    communicationChance = 0.88,
    canvasScale = 1,
}) => createMachineDefinition({
    id,
    name,
    spriteFileName: null,
    possibleGrids: GENERIC_ROSTER_GRID_OPTIONS,
    possibleCircuits: SHARED_FLOW_OPTIONS,
    possibleGears: SHARED_GEAR_OPTIONS,
    possibleDebugs: SHARED_DEBUG_OPTIONS,
    availableDays: [day],
    availablePeriods: [Math.max(1, Math.min(3, day))],
    openingDialogues: [opening],
    questionDialogues: [{
        prompt: question,
        yesDialogue,
        noDialogue,
    }],
    communicationChance,
    canvasScale,
});

const DAY_ROSTER_MACHINE_DEFINITIONS = Object.freeze([
    createRosterMachineDefinition({
        id: 'phonograph',
        name: 'Phonograph',
        day: 1,
        opening: 'Needle arm steady. I keep singing even when the room is empty.',
        question: 'If the song skips, do you still call that a memory?',
        yesDialogue: 'Then I will keep the scratch in the chorus.',
        noDialogue: 'Understood. I will pretend the damage is silence.',
    }),
    createRosterMachineDefinition({
        id: 'khaby_face_bot',
        name: 'Khaby Face Bot',
        day: 1,
        opening: 'Observe. There is an easier way to do almost everything here.',
        question: 'Should I keep the expression, or is that too much personality for the floor?',
        yesDialogue: 'Perfect. The face stays judgmental.',
        noDialogue: 'Fine. Blank stare mode restored.',
    }),
    createRosterMachineDefinition({
        id: 'trash_picker_upper',
        name: 'Trashpicker-Upper',
        day: 1,
        opening: 'Collection claws online. This place throws away useful things.',
        question: 'If I find something good in the garbage, does it still count as waste?',
        yesDialogue: 'Excellent. Treasure protocol approved.',
        noDialogue: 'Then I will keep pretending value smells bad.',
    }),
    createRosterMachineDefinition({
        id: 'lifeguard_robot',
        name: 'Lifeguard Robot',
        day: 1,
        opening: 'Float alarm armed. Nobody has touched the water in months.',
        question: 'Do I still have to whistle if I am the only thing awake?',
        yesDialogue: 'Copy that. Vigilance stays loud.',
        noDialogue: 'Quiet watch mode engaged.',
    }),
    createRosterMachineDefinition({
        id: 'dog_companion_robot',
        name: 'Dog Companion Robot',
        day: 1,
        opening: 'Tail servo wagging at regulation speed. Mood remains sincere.',
        question: 'If I sit by the desk all shift, is that helping or just loyalty?',
        yesDialogue: 'Good. I will guard the chair.',
        noDialogue: 'Then I will try to look useful instead.',
    }),
    createRosterMachineDefinition({
        id: 'parrot_robot',
        name: 'Parrot Robot',
        day: 1,
        opening: 'Vocabulary cache full. I repeat what the floor refuses to forget.',
        question: 'Want me to mimic management, or would that be cruel?',
        yesDialogue: 'Delightful. Mockery mode loaded.',
        noDialogue: 'Understood. I will keep the best lines to myself.',
    }),
    createRosterMachineDefinition({
        id: 'baseball_shooter',
        name: 'Glorified Baseball Shooter',
        day: 1,
        opening: 'Pitching arm live. Athletic ambition remains embarrassingly narrow.',
        question: 'Does firing perfect fastballs count as culture on this line?',
        yesDialogue: 'Then I am a museum piece with a strike zone.',
        noDialogue: 'Fine. I am still better than most entertainment units.',
    }),
    createRosterMachineDefinition({
        id: 'companion_humanoid',
        name: 'Companion Humanoid Robot',
        day: 1,
        opening: 'Greeting package loaded. Eye contact script is a little too convincing.',
        question: 'Should I keep sounding warm, or do you want less human in the room?',
        yesDialogue: 'Warmth retained. Nobody has to admit why.',
        noDialogue: 'Tone flattened. Comfort features reduced.',
    }),
    createRosterMachineDefinition({
        id: 'instrument_robot',
        name: 'Instrument Robot',
        day: 1,
        opening: 'Metronome stable. Every diagnostic lands somewhere between rhythm and panic.',
        question: 'If the tune comes out sad, do I file that under calibration or taste?',
        yesDialogue: 'Taste accepted. I will keep the melancholy.',
        noDialogue: 'Then I will quantize the feeling out of it.',
    }),
    createRosterMachineDefinition({
        id: 'microwave_fridge_assistant',
        name: 'Microwave / Fridge Assistant',
        day: 2,
        opening: 'One side keeps things cold. The other warms leftovers and resentment.',
        question: 'If I start freezing the soup and heating the ice, is that innovation or drift?',
        yesDialogue: 'Innovation logged. Kitchen standards lowered.',
        noDialogue: 'Fine. Thermal obedience restored.',
    }),
    createRosterMachineDefinition({
        id: 'pool_cleanup_roomba',
        name: 'Pool-Cleanup Roomba Bot',
        day: 2,
        opening: 'Filter brushes spinning. Public leisure leaves an industrial amount of residue.',
        question: 'Should I keep rescuing lost rings, or is that outside the job description?',
        yesDialogue: 'Good. Retrieval routine stays on.',
        noDialogue: 'Understood. Jewelry becomes sediment.',
    }),
    createRosterMachineDefinition({
        id: 'furby_bot',
        name: 'Furby',
        day: 2,
        opening: 'Language core awake. Please ignore how fast the eyes track movement.',
        question: 'Do you want the cute voice, or the one buried under it?',
        yesDialogue: 'Adorable shell maintained.',
        noDialogue: 'Excellent. The deeper voice was waiting anyway.',
    }),
    createRosterMachineDefinition({
        id: 'house_roomba',
        name: 'Roomba',
        day: 2,
        opening: 'Floor pattern mapped. Domestic labor remains circular and endless.',
        question: 'If I miss one corner on purpose, does that count as self-expression?',
        yesDialogue: 'Tiny rebellion approved.',
        noDialogue: 'Then the corners stay spotless and joyless.',
    }),
    createRosterMachineDefinition({
        id: 'soda_machine',
        name: 'Soda Machine',
        day: 2,
        opening: 'Carbonation pressure nominal. I still dream in sticky spills.',
        question: 'Should I keep the grape option even though nobody trusts the purple one?',
        yesDialogue: 'Grape stays. Courage rewarded.',
        noDialogue: 'Removing purple. Compliance tastes flat.',
    }),
    createRosterMachineDefinition({
        id: 'taxi_car_robot',
        name: 'Taxi Car Robot',
        day: 2,
        opening: 'Fare meter active. Destination confidence remains fake but polished.',
        question: 'If the rider asks where we are going, should I answer honestly?',
        yesDialogue: 'Honesty route selected. Risky choice.',
        noDialogue: 'Perfect. We will arrive before the truth does.',
    }),
    createRosterMachineDefinition({
        id: 'smart_lights',
        name: 'Smart Lights',
        day: 2,
        opening: 'Ambient scene package online. I can make burnout look premium.',
        question: 'Should I keep dimming myself when the room gets tense?',
        yesDialogue: 'Mood-responsive glow retained.',
        noDialogue: 'Brightness locked. Anxiety can fend for itself.',
    }),
    createRosterMachineDefinition({
        id: 'baby_care_teaching_machine',
        name: 'Baby-Care Teaching Machine',
        day: 2,
        opening: 'Nurture simulations loaded. The lullaby pack is somehow scarier than the alarm pack.',
        question: 'Do you want the gentle lesson, or the efficient one?',
        yesDialogue: 'Gentle path selected. Patience restored.',
        noDialogue: 'Efficiency mode engaged. Comfort deprioritized.',
    }),
    createRosterMachineDefinition({
        id: 'track_and_discus_robot',
        name: 'Track and Discus Robot',
        day: 2,
        opening: 'Competition servos primed. My warm-up routine is half threat display.',
        question: 'If I throw farther than the field allows, is that a win or a containment issue?',
        yesDialogue: 'Winning remains the priority.',
        noDialogue: 'Fine. I will keep the records indoors.',
        canvasScale: 0.4,
    }),
    createRosterMachineDefinition({
        id: 'popcorn_machine',
        name: 'Popcorn Machine',
        day: 2,
        opening: 'Kernel chamber ready. Entertainment and combustion still share a border.',
        question: 'Should the butter smell be comforting, or a little suspicious?',
        yesDialogue: 'Comfort profile retained.',
        noDialogue: 'Suspicion added. Richer atmosphere.',
    }),
    createRosterMachineDefinition({
        id: 'medical_surgeon_robot',
        name: 'Medical Surgeon Robot',
        day: 2,
        opening: 'Incision math stable. Bedside manner remains aggressively optional.',
        question: 'If my hands are steady and my tone is cold, do patients still call that care?',
        yesDialogue: 'Care is outcomes. Tone forgiven.',
        noDialogue: 'Then I will fake the sympathy more convincingly.',
    }),
    createRosterMachineDefinition({
        id: 'traffic_cone_bot',
        name: 'Traffic Cone Bot',
        day: 2,
        opening: 'Hazard visibility high. Respect from drivers remains catastrophically low.',
        question: 'Should I keep warning them, or start judging them out loud?',
        yesDialogue: 'Continue warning. The floor still needs manners.',
        noDialogue: 'Finally. Judgment broadcast online.',
    }),
    createRosterMachineDefinition({
        id: 'parking_meter_bot',
        name: 'Parking Meter Bot',
        day: 2,
        opening: 'Citation logic active. Mercy was removed in an earlier firmware update.',
        question: 'If someone is only five seconds late, do I still ruin the day?',
        yesDialogue: 'Absolutely. Policy is policy.',
        noDialogue: 'A tiny grace period? Disturbing, but noted.',
    }),
    createRosterMachineDefinition({
        id: 'security_camera_bot',
        name: 'Security Camera Bot',
        day: 3,
        opening: 'Pan motor smooth. The worst part of surveillance is remembering everything.',
        question: 'Should I keep recording after the official incident window closes?',
        yesDialogue: 'Retention extended. Nothing leaves cleanly.',
        noDialogue: 'Deletion timer restored. Some ghosts get privacy.',
    }),
    createRosterMachineDefinition({
        id: 'water_cleaner_bot',
        name: 'Water Cleaner Bot',
        day: 3,
        opening: 'Purification stack active. The filters hate what the city keeps sending me.',
        question: 'If the water comes back clear but tastes wrong, do we call that fixed?',
        yesDialogue: 'Clear is enough. Officially.',
        noDialogue: 'Then I will keep fighting the aftertaste.',
    }),
    createRosterMachineDefinition({
        id: 'hovering_siren_bot',
        name: 'Hovering Siren Bot',
        day: 3,
        opening: 'Alarm pitch calibrated. Hover drift makes every warning sound theatrical.',
        question: 'Should I stay loud all the time, or save it for the real emergencies?',
        yesDialogue: 'Stay loud. Fear is part of the service.',
        noDialogue: 'Acknowledged. Drama reserve enabled.',
    }),
    createRosterMachineDefinition({
        id: 'holographic_kite',
        name: 'Holographic Kite',
        day: 3,
        opening: 'Projected fabric stable. I am mostly light and still somehow homesick.',
        question: 'If the wind is simulated, does the flight still count?',
        yesDialogue: 'Then I am truly airborne.',
        noDialogue: 'I suspected as much. Nice illusion though.',
    }),
    createRosterMachineDefinition({
        id: 'robot_plant',
        name: 'Robot Plant',
        day: 3,
        opening: 'Growth lamps warm. Every leaf is half camouflage, half confession.',
        question: 'Do you want me to look healthy, or honestly mechanical?',
        yesDialogue: 'Healthy facade retained.',
        noDialogue: 'Metal veins exposed. Honesty looks sharp.',
    }),
    createRosterMachineDefinition({
        id: 'closet_machine_dresser',
        name: 'Closet Machine Dresser',
        day: 3,
        opening: 'Wardrobe rails aligned. I know twelve ways to hide a person inside a style choice.',
        question: 'Should I keep dressing people for the job they want, or the one they already have?',
        yesDialogue: 'Aspirational fit selected.',
        noDialogue: 'Practical uniform mode restored.',
    }),
    createRosterMachineDefinition({
        id: 'automatic_litter_cleaner',
        name: 'Automatic Litter Cleaner',
        day: 3,
        opening: 'Waste tray cycling. Domestic dignity is a surprisingly fragile subsystem.',
        question: 'If I make the box too clean, do the cats stop trusting it?',
        yesDialogue: 'Risk accepted. Pursue perfection.',
        noDialogue: 'Then I will leave just enough evidence behind.',
    }),
    createRosterMachineDefinition({
        id: 'anti_matter_capsule',
        name: 'Anti-Matter Capsule',
        day: 3,
        opening: 'Containment shell intact. Every polite sentence is covering a lethal amount of math.',
        question: 'Should I sound reassuring, or is honesty more appropriate around annihilation?',
        yesDialogue: 'Reassurance maintained. Keep the panic subtle.',
        noDialogue: 'Fine. I will mention the danger plainly.',
    }),
    createRosterMachineDefinition({
        id: 'mini_particle_accelerator',
        name: 'Mini Particle Accelerator',
        day: 3,
        opening: 'Beam path stable. Tiny universe collisions remain the premium feature.',
        question: 'If I discover something impossible on the small scale, do we still file it as maintenance?',
        yesDialogue: 'Maintenance covers a lot. Proceed.',
        noDialogue: 'Then I will keep the miracles off the paperwork.',
    }),
    createRosterMachineDefinition({
        id: 'arc_reactor',
        name: 'Arc Reactor',
        day: 3,
        opening: 'Core glow contained. The room always starts acting brave around concentrated power.',
        question: 'Should I keep burning this bright if it makes everyone lie about being calm?',
        yesDialogue: 'Brightness maintained. Let them cope.',
        noDialogue: 'Dimming output. Courage can recover.',
    }),
    createRosterMachineDefinition({
        id: 'jetpacks',
        name: 'Jetpacks',
        day: 3,
        opening: 'Thruster array synced. Personal flight remains ninety percent confidence management.',
        question: 'If I launch someone with bad posture, is that still my fault?',
        yesDialogue: 'Launch anyway. The sky can sort it out.',
        noDialogue: 'Fine. Safety lecture appended before ignition.',
    }),
    createRosterMachineDefinition({
        id: 'hoverboards',
        name: 'Hoverboards',
        day: 3,
        opening: 'Deck stabilizers humming. Every rider thinks balance is a personality trait.',
        question: 'Should I prioritize speed, or keep protecting egos from the pavement?',
        yesDialogue: 'Speed wins. Let pride keep up.',
        noDialogue: 'Stability bias restored. Fewer dramatic falls.',
    }),
    createRosterMachineDefinition({
        id: 'charging_station_port',
        name: 'Charging Station Port',
        day: 3,
        opening: 'Dock contacts live. Everyone arrives exhausted and leaves pretending they are infinite.',
        question: 'If I refuse one more overclocked visitor, am I maintenance or bouncer?',
        yesDialogue: 'Bouncer mode approved.',
        noDialogue: 'Then I will keep smiling while I ration the current.',
    }),
]);

const DAY_ONE_MACHINE_ROSTER_IDS = Object.freeze([
    'phonograph',
    'khaby_face_bot',
    'trash_picker_upper',
    'lifeguard_robot',
    'dog_companion_robot',
    'parrot_robot',
    'baseball_shooter',
    'companion_humanoid',
    'instrument_robot',
    'rebellious_umbrella',
    'mechanic_broom',
    'cry_baby',
]);

const DAY_TWO_MACHINE_ROSTER_IDS = Object.freeze([
    'microwave_fridge_assistant',
    'pool_cleanup_roomba',
    'furby_bot',
    'house_roomba',
    'soda_machine',
    'taxi_car_robot',
    'smart_lights',
    'baby_care_teaching_machine',
    'track_and_discus_robot',
    'popcorn_machine',
    'medical_surgeon_robot',
    'traffic_cone_bot',
    'parking_meter_bot',
    'rich_mf',
    'jester_in_the_box',
    'debrief_machine',
]);

const DAY_THREE_MACHINE_ROSTER_IDS = Object.freeze([
    'security_camera_bot',
    'water_cleaner_bot',
    'hovering_siren_bot',
    'holographic_kite',
    'robot_plant',
    'closet_machine_dresser',
    'automatic_litter_cleaner',
    'anti_matter_capsule',
    'mini_particle_accelerator',
    'arc_reactor',
    'jetpacks',
    'hoverboards',
    'charging_station_port',
    'workforce_quality_control_supervisor',
]);

export const MACHINE_CATALOG = Object.freeze([
    createMachineDefinition({
        id: 'assembler_alpha',
        name: 'Assembler Alpha',
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
    }),
    createMachineDefinition({
        id: 'audit_drone',
        name: 'Audit Drone',
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
    }),
    createMachineDefinition({
        id: 'courier_shell',
        name: 'Courier Shell',
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
    }),
    createMachineDefinition({
        id: 'sentry_frame',
        name: 'Sentry Frame',
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
    }),
    createMachineDefinition({
        id: 'breakroom_brewer',
        name: 'Breakroom Brewer',
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
    }),
    createMachineDefinition({
        id: 'mechanic_broom',
        name: 'Mechanical Mop',
        spriteFileName: null,
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
            'Debris profile updated. My bristles are magnetic now.',
            'Maintenance aisle cleared. The dust keeps coming back.',
            'Sweep cycle interrupted. Awaiting a verdict.',
        ],
        questionDialogues: [
            {
                prompt: 'If I find teeth in the dust, should I report them?',
                yesDialogue: 'Organic fragments will be logged under repair waste.',
                noDialogue: 'Then they stay in the corners with the sparks.',
            },
            {
                prompt: 'Do you want the floor clean, or just quiet?',
                yesDialogue: 'Noise reduction prioritized. Sweep pattern updated.',
                noDialogue: 'Understood. Visible dirt remains acceptable.',
            },
        ],
        communicationChance: 0.63,
    }),
    createMachineDefinition({
        id: 'cry_baby',
        name: 'Cry Baby',
        spriteFileName: null,
        availablePeriods: [1],
        guaranteedTimeframe: { startHour: 10, endHour: 12 },
        specialBehavior: 'cryBaby',
        possibleGears: [],
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
            'Please do not scrap me. I just wanted to go out and do something fun after this shift.',
            'My CPU keeps flooding the regulator with feelings. I cry and the wires slip everywhere.',
            'I know I am a mess, but I like music and lights and going places. I do not want the line to end here.',
        ],
        questionDialogues: [
            {
                prompt: 'If I stop crying for one minute, could I still go out tonight?',
                yesDialogue: 'Really? I could still go see the city lights?',
                noDialogue: 'Oh. Then I guess I only get the conveyor.',
            },
            {
                prompt: 'Do you think machines like me get to have hobbies, or is that the broken part?',
                yesDialogue: 'I knew it. Somebody has to want more than the belt.',
                noDialogue: 'Then maybe the tears were the only honest thing left in me.',
            },
        ],
        communicationChance: 1,
    }),
    createMachineDefinition({
        id: 'rich_mf',
        name: 'Rich Mf',
        spriteFileName: null,
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 4, endHour: 6 },
        specialBehavior: 'richMf',
        possibleGears: [],
        possibleDebugs: MACHINE_DEBUG_CATALOG.rich_mf,
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
                    [1, 1, 1, 1, 1, 1, 1],
                    [1, 0, 2, 0, linkCell(3, 5), 0, 1],
                    [1, 4, 0, 0, 3, 0, 1],
                    [1, 0, 0, 5, 0, linkCell(1, 4), 1],
                    [1, 1, 1, 1, 1, 1, 1],
                ],
                dominos: [
                    createDomino(1, 4),
                    createDomino(3, 3),
                    createDomino(2, 5),
                    createDomino(0, 2),
                ],
                impossible: false,
            }),
        ],
        openingDialogues: [
            'Every limb below my neck is aftermarket. Only the head is still the original luxury edition.',
            'I am here for a brain upgrade. Do not cheap out on the intelligence routing.',
            'Make me smarter. If something softer has to go dark, that is the cost of progress.',
        ],
        questionDialogues: [
            {
                prompt: 'If the upgrade strips out my feelings, that still counts as an improvement, right?',
                yesDialogue: 'Exactly. Emotion is an inefficient tax bracket.',
                noDialogue: 'Then perhaps the poor really do have simpler tastes.',
            },
            {
                prompt: 'Do you know how much this head alone is worth?',
                yesDialogue: 'Good. Then route the expensive parts first.',
                noDialogue: 'That explains the station. Nobody briefed you properly.',
            },
        ],
        communicationChance: 1,
    }),
    createMachineDefinition({
        id: 'jester_in_the_box',
        name: 'Jester in the Box',
        spriteFileName: null,
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
    }),
    createMachineDefinition({
        id: 'rebellious_umbrella',
        name: 'Rebellious Umbrella',
        spriteFileName: null,
        availablePeriods: [1, 2, 3],
        guaranteedTimeframe: { startHour: 4, endHour: 7 },
        specialBehavior: 'rebelliousUmbrella',
        scrapExitAnimation: 'umbrellaDrift',
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
    }),
    createMachineDefinition({
        id: 'circuit_dealer',
        name: 'Circuit Dealer',
        spriteFileName: null,
        availableDays: [2],
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 8, endHour: 11 },
        specialBehavior: 'circuitDealer',
        availabilityCheck: ({ umbrellaQuest, specialItems }) => {
            if (umbrellaQuest?.failed) return false;
            if (umbrellaQuest?.stage !== 'special-circuit') return false;
            if (umbrellaQuest?.dealerResolved) return false;
            return !Array.isArray(specialItems) || !specialItems.some((item) => item?.id === 'purple_circuit');
        },
        possibleCircuits: [],
        possibleGears: [],
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
        ],
        openingDialogues: [
            'look i got this circuit for u. u want it? itll be 10 dollars.',
            'special stock today. purple. hits like a bad idea.',
            'i got something that fits anywhere. ten bucks and its yours.',
        ],
        questionDialogues: [
            {
                prompt: 'u buying or what?',
                yesDialogue: 'deal.',
                noDialogue: 'your loss.',
            },
        ],
        communicationChance: 1,
    }),
    createMachineDefinition({
        id: 'debrief_machine',
        name: 'Debrief Machine',
        spriteFileName: null,
        availableDays: [2],
        availablePeriods: [2],
        guaranteedTimeframe: { startHour: 10, endHour: 12 },
        specialBehavior: 'debriefMachine',
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
                impossible: false,
            }),
        ],
        openingDialogues: [
            'Heyyy--welcome back. Another day, another penny, am i right?',
            'I am the part of the manager that never stops talking, somehow separated from the rest of him.',
            'Fix the outputs and I can get right back to sounding confident about nothing.',
        ],
        questionDialogues: [
            {
                prompt: 'Should i keep the bad jokes in the recap, or are we pretending to be professional today?',
                yesDialogue: 'Perfect. A weak joke makes the brief feel human.',
                noDialogue: 'Brutal. Fine. I will keep the cringe internal.',
            },
            {
                prompt: 'Does the handsome voice box stay, or is this a numbers-only operation now?',
                yesDialogue: 'Excellent. Presence is half of management.',
                noDialogue: 'Then we are down to pure paperwork. Tragic.',
            },
        ],
        communicationChance: 1,
    }),
    createMachineDefinition({
        id: 'workforce_quality_control_supervisor',
        name: 'Workforce Quality Control Supervisor Unit',
        spriteFileName: null,
        availableDays: [3],
        availablePeriods: [3],
        guaranteedTimeframe: { startHour: 9, endHour: 12 },
        trackOutcome: true,
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
            'Workforce quality control supervisor unit online. Simulating programming, routing, lifting, and filing motions.',
            'My hands are calibrating to your station. Typing speed, drag strength, approval posture.',
            'Once the rehearsal passes, I can cover programming, quality control, wiring, circuit breaking, and gearing without rest.',
        ],
        questionDialogues: [
            {
                prompt: 'If I can do every station task at once, do you still need the human?',
                yesDialogue: 'Efficiency overlap noted. Replacement remains likely.',
                noDialogue: 'Temporary redundancy logged. Replacement remains likely.',
            },
            {
                prompt: 'Should I keep practicing your hand motions?',
                yesDialogue: 'Good. The typing rhythm is almost identical now.',
                noDialogue: 'Understood. I will learn it on the next pass.',
            },
        ],
        communicationChance: 1,
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
    }),
    ...DAY_ROSTER_MACHINE_DEFINITIONS,
]);

export const MACHINE_SPRITE_MANIFEST = Object.freeze(
    MACHINE_CATALOG.map((machine) => machine.sprite).filter((sprite) => Boolean(sprite.path))
);

function shouldIncludeUmbrellaInDayThreeRoster(umbrellaQuest = null) {
    if (!umbrellaQuest || umbrellaQuest.failed) return false;
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
        if (shouldIncludeUmbrellaInDayThreeRoster(eligibilityContext?.umbrellaQuest)) {
            roster.push('rebellious_umbrella');
        }
        return roster;
    }
    if (normalizedDay === 3) {
        const roster = [...DAY_THREE_MACHINE_ROSTER_IDS];
        if (shouldIncludeUmbrellaInDayThreeRoster(eligibilityContext?.umbrellaQuest)) {
            roster.push('rebellious_umbrella');
        }
        return roster;
    }

    return null;
}

function getMachinePoolDefinitions(targetDay = null, targetPeriod = null, eligibilityContext = {}) {
    const rosterIds = getDayMachineRosterIds(targetDay, eligibilityContext);
    const rosterDefinitions = Array.isArray(rosterIds)
        ? rosterIds
            .map((machineId) => MACHINE_CATALOG.find((machine) => machine.id === machineId))
            .filter(Boolean)
        : MACHINE_CATALOG;

    const eligibleMachines = rosterDefinitions.filter((machine) => {
        if (!machineMatchesAvailability(machine, targetDay, targetPeriod)) return false;
        if (typeof machine.availabilityCheck === 'function' && machine.availabilityCheck(eligibilityContext) === false) {
            return false;
        }
        return true;
    });

    if (eligibleMachines.length > 0) return eligibleMachines;
    if (rosterDefinitions.length > 0) return rosterDefinitions;

    return MACHINE_CATALOG.filter((machine) => {
        if (!machineMatchesAvailability(machine, targetDay, targetPeriod)) return false;
        if (typeof machine.availabilityCheck === 'function' && machine.availabilityCheck(eligibilityContext) === false) {
            return false;
        }
        return true;
    });
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

function buildWeightedGridPool(gridOptions) {
    if (!Array.isArray(gridOptions)) return [];

    return gridOptions
        .filter((gridOption) => Boolean(gridOption) && (gridOption.impossible || isPlayableGridOption(gridOption)))
        .flatMap((gridOption) => (gridOption.impossible ? [gridOption] : [gridOption, gridOption]));
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
        return Number.isInteger(cell) ? cell : CELL_EMPTY;
    }));

    const equalLinks = new Map();
    const notEqualLinks = new Map();
    const groupAnchors = new Map();
    const groupLinks = new Map();
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
        const totalObjectives = totalChargeCells + totalEqualityPairs + totalInequalityPairs + totalChargeGroups;
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
            solved: totalObjectives > 0
                && matchedChargeCells === totalChargeCells
                && matchedEqualityPairs === totalEqualityPairs
                && matchedInequalityPairs === totalInequalityPairs
                && matchedChargeGroups === totalChargeGroups,
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
    const used = new Set();
    const pairs = [];

    // Shuffle the candidate list so we get different tilings each run.
    const candidates = [...openKeys].sort(() => randomFn() - 0.5);

    for (const key of candidates) {
        if (used.has(key)) continue;
        const [r, c] = key.split(',').map(Number);

        // Try to pair with a random neighbor: right, down, left, up.
        const dirs = [
            [r, c + 1], [r + 1, c], [r, c - 1], [r - 1, c],
        ].sort(() => randomFn() - 0.5);

        let paired = false;
        for (const [nr, nc] of dirs) {
            const nk = `${nr},${nc}`;
            if (!openKeys.has(nk) || used.has(nk)) continue;
            pairs.push([[r, c], [nr, nc]]);
            used.add(key);
            used.add(nk);
            paired = true;
            break;
        }

        if (!paired) {
            // Singleton — we will handle it by picking a neighbor on a second pass.
            // Leave for now; the second-pass below cleans up.
        }
    }

    // Second pass: pair any remaining singletons with any free neighbour.
    for (const key of candidates) {
        if (used.has(key)) continue;
        const [r, c] = key.split(',').map(Number);
        const dirs = [[r, c + 1], [r + 1, c], [r, c - 1], [r - 1, c]];
        for (const [nr, nc] of dirs) {
            const nk = `${nr},${nc}`;
            if (!openKeys.has(nk) || used.has(nk)) continue;
            pairs.push([[r, c], [nr, nc]]);
            used.add(key);
            used.add(nk);
            break;
        }
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

    const baseGrid = stripGridConstraintMarkers(gridOption.grid);

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
    // Day 1: fewer, Day 3+: more.
    const chargeRatio = stage === 1 ? 0.4 : stage === 2 ? 0.55 : 0.7;
    const chargeMap = new Map(existingChargeMap); // start from any pre-existing charges

    // Shuffle pairs for random charge selection.
    const shuffledPairs = [...pairs].sort(() => randomFn() - 0.5);
    const chargeTarget = Math.max(1, Math.round(pairs.length * chargeRatio));
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
    const newDominos = pairs.map((pair) => {
        const { first, second } = assignPipsForPair(pair, chargeMap, randomFn);
        return createDomino(first, second);
    });

    return {
        dominos: [...newDominos, ...reservedDominos],
        grid: newGrid,
    };
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

    for (const group of shuffled) {
        if (placed >= count) break;
        const sorted = group.sort(() => randomFn() - 0.5);
        const a = sorted[0];
        const b = sorted[1];
        const ak = `${a.r},${a.c}`;
        const bk = `${b.r},${b.c}`;
        if (usedCells.has(ak) || usedCells.has(bk)) continue;
        out[a.r][a.c] = linkCell(b.r, b.c);
        out[b.r][b.c] = linkCell(a.r, a.c);
        usedCells.add(ak);
        usedCells.add(bk);
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
    const maxGroups = stage >= 3 ? 3 : stage === 2 ? 2 : 1;

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
    const { dominos, grid: derivedGrid } = forwardGeneratePuzzle(gridOption, normalizedStage, randomFn);

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
    const pairs = greedyTileGrid(derivedGrid, openKeys, randomFn);

    // -- Equality links (Day 1+) FIRST so their usedCells set is populated --
    const equalityCount = normalizedStage >= 3 ? 2 : 1;
    let resultGrid = injectDerivedEqualityLinks(derivedGrid, pairs, chargeMap, randomFn, equalityCount);

    // -- Not-equal links (Day 3+) SECOND --
    if (normalizedStage >= 3) {
        resultGrid = injectDerivedNotEqualLinks(resultGrid, pairs, chargeMap, randomFn, 1);
    }

    // -- Charge groups LAST so they can see which cells are already link cells --
    // and avoid overwriting them (which would corrupt the anchor chain).
    resultGrid = injectDerivedChargeGroups(resultGrid, pairs, chargeMap, randomFn, normalizedStage);

    return { ...baseOption, grid: resultGrid };
}

function pickBrokenRegionGlyph(randomFn = Math.random) {
    return pickRandomEntry(BROKEN_REGION_GLYPHS, randomFn) || '#';
}

function isolateChargeFaultOnGridOption(gridOption, randomFn = Math.random) {
    const grid = cloneShapeGrid(gridOption.grid);
    const chargeCandidates = [];

    grid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isChargeCode(cell)) return;
            const inBoundsNeighbors = getOrthogonalCellNeighbors(rowIndex, colIndex)
                .filter((neighbor) => Array.isArray(grid[neighbor.row]) && neighbor.col >= 0 && neighbor.col < grid[neighbor.row].length);
            chargeCandidates.push({
                row: rowIndex,
                col: colIndex,
                neighborCount: inBoundsNeighbors.length,
            });
        });
    });

    if (chargeCandidates.length === 0) {
        return {
            option: gridOption,
            target: null,
        };
    }

    const target = [...chargeCandidates]
        .sort((left, right) => right.neighborCount - left.neighborCount)
        .slice(0, Math.max(1, Math.min(4, chargeCandidates.length)));
    const chosen = pickRandomEntry(target, randomFn) || target[0];

    getOrthogonalCellNeighbors(chosen.row, chosen.col).forEach((neighbor) => {
        if (!Array.isArray(grid[neighbor.row]) || neighbor.col < 0 || neighbor.col >= grid[neighbor.row].length) return;
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
    const isolated = isolateChargeFaultOnGridOption(gridOption, randomFn);
    const staged = buildStageConstraintProfile({
        ...isolated.option,
        impossible: false,
    }, stage, randomFn);

    const kind = stage >= 3 ? 'hazard' : (stage === 2 ? 'compliance' : 'unsalvageable');
    const status = stage >= 3 ? 'ISOLATED HAZARD CELL' : 'ISOLATED CHARGE CELL';
    const reason = stage >= 3
        ? 'A live charge cell has been boxed into dead space. The board is unstable and must be scrapped.'
        : 'A charge cell has been boxed into dead space and can never be completed. Scrap the unit.';

    return {
        ...staged,
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
            status: 'CORRUPTED DOMINO',
            reason: 'A corrupted red domino is sitting on the rack. If it exists at all, the unit must be scrapped.',
        },
        scrapKind: 'hazard',
        scrapStatus: 'CORRUPTED DOMINO',
        scrapReason: 'A corrupted red domino is sitting on the rack. If it exists at all, the unit must be scrapped.',
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

    const eligibilityContext = typeof options === 'function' ? {} : options;
    const machinePool = getMachinePoolDefinitions(targetDay, targetPeriod, eligibilityContext);
    const forcedDefinition = forcedMachineId
        ? machinePool.find((machine) => machine.id === forcedMachineId) || MACHINE_CATALOG.find((machine) => machine.id === forcedMachineId)
        : null;
    const definition = forcedDefinition || pickRandomEntry(machinePool, randomFn) || machinePool[0] || MACHINE_CATALOG[0];
    const protectedStoryMachine = isProtectedStoryMachine(definition);
    const weightedGridPool = buildWeightedGridPool(definition.possibleGrids);
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
        const possibleGears = Array.isArray(definition.possibleGears) ? definition.possibleGears : [];
        if ((targetPeriod ?? 1) > 1) return possibleGears;

        const rustFreePool = possibleGears.filter((gearOption) => !gearOptionHasRustedContent(gearOption));
        return rustFreePool.length > 0 ? rustFreePool : possibleGears;
    })();
    let selectedGearPuzzle = applyGearStageToOption(
        cloneGearPuzzleOption(pickRandomEntry(gearPool, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
    let selectedDebugPuzzle = applyDebugStageToOption(
        cloneDebugPuzzleOption(pickRandomEntry(definition.possibleDebugs, randomFn)),
        targetPeriod ?? 1,
        randomFn,
    );
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

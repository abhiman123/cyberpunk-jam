import {
    GEAR_CODES,
    buildGearProgressSnapshot,
    cloneGearBoard,
    cloneGearPieces,
} from '../core/gearPuzzleLogic.js';

const MACHINE_SPRITE_FOLDER = 'assets/machines/sprites';
const MACHINE_FALLBACK_KEY = 'unit_placeholder';
const CELL_EMPTY = 0;
const CELL_WALL = 1;
const MIN_CHARGE_CODE = 2;
const MAX_CHARGE_CODE = 5;
const EMPTY_PLACED_OFFSET = 10;

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

function createFlowProgress(flowPuzzleOption) {
    const repairTargets = cloneRepairTargets(flowPuzzleOption?.repairTargets || []);
    const brokenTargets = repairTargets.map((target) => target.key);

    return {
        tiles: cloneFlowTiles(flowPuzzleOption?.tiles),
        connected: [],
        missing: [...brokenTargets],
        repairedTargets: [],
        brokenTargets,
        repairStates: repairTargets.map((target) => ({ ...target, repaired: false })),
        forbiddenUsed: false,
        completed: false,
        symptoms: repairTargets.map((target) => target.brokenLabel),
        flags: [],
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
        tiles: resolvedLayout.tiles,
        forbidden: resolvedLayout.forbidden,
        repairTargets: resolvedRepairTargets,
    };
};

const createMiniDisplay = ({
    artX,
    artY,
    artScale = 0.56,
    artAngle = 0,
    gridPreview,
    flowPreview,
    gearPreview = { x: 88, y: 154, width: 62, height: 36, label: 'GEAR' },
}) => ({
    artX,
    artY,
    artScale,
    artAngle,
    gridPreview: { ...gridPreview },
    flowPreview: { ...flowPreview },
    gearPreview: { ...gearPreview },
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

const DEFAULT_MACHINE_DAYS = Object.freeze([1]);
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

const MACHINE_GEAR_CATALOG = Object.freeze({
    assembler_alpha: SHARED_GEAR_OPTIONS,
    audit_drone: SHARED_GEAR_OPTIONS,
    courier_shell: SHARED_GEAR_OPTIONS,
    sentry_frame: SHARED_GEAR_OPTIONS,
    breakroom_brewer: SHARED_GEAR_OPTIONS,
    mechanic_broom: SHARED_GEAR_OPTIONS,
    future_lounge_chair: SHARED_GEAR_OPTIONS,
});

const MACHINE_MINI_DISPLAY_CATALOG = Object.freeze({
    assembler_alpha: createMiniDisplay({
        artX: 104,
        artY: 134,
        artScale: 0.94,
        gridPreview: { x: 42, y: 72, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' },
        gearPreview: { x: 102, y: 150, width: 56, height: 30, label: 'GEAR' },
    }),
    audit_drone: createMiniDisplay({
        artX: 112,
        artY: 130,
        artScale: 0.96,
        artAngle: -4,
        gridPreview: { x: 138, y: 68, width: 54, height: 40, label: 'GRID' },
        flowPreview: { x: 44, y: 112, width: 62, height: 36, label: 'FLOW' },
        gearPreview: { x: 92, y: 148, width: 64, height: 30, label: 'GEAR' },
    }),
    courier_shell: createMiniDisplay({
        artX: 102,
        artY: 136,
        artScale: 1.02,
        artAngle: 2,
        gridPreview: { x: 42, y: 70, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 134, y: 108, width: 60, height: 38, label: 'FLOW' },
        gearPreview: { x: 116, y: 56, width: 60, height: 34, label: 'GEAR' },
    }),
    sentry_frame: createMiniDisplay({
        artX: 108,
        artY: 132,
        artScale: 0.97,
        gridPreview: { x: 136, y: 64, width: 56, height: 42, label: 'GRID' },
        flowPreview: { x: 44, y: 114, width: 64, height: 36, label: 'FLOW' },
        gearPreview: { x: 48, y: 72, width: 60, height: 34, label: 'GEAR' },
    }),
    breakroom_brewer: createMiniDisplay({
        artX: 102,
        artY: 136,
        artScale: 0.98,
        artAngle: -4,
        gridPreview: { x: 42, y: 74, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 134, y: 108, width: 60, height: 38, label: 'FLOW' },
        gearPreview: { x: 48, y: 146, width: 60, height: 32, label: 'GEAR' },
    }),
    mechanic_broom: createMiniDisplay({
        artX: 104,
        artY: 134,
        artScale: 0.98,
        artAngle: 6,
        gridPreview: { x: 46, y: 70, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' },
        gearPreview: { x: 136, y: 64, width: 58, height: 34, label: 'GEAR' },
    }),
    future_lounge_chair: createMiniDisplay({
        artX: 110,
        artY: 140,
        artScale: 1.02,
        artAngle: -7,
        gridPreview: { x: 136, y: 68, width: 56, height: 40, label: 'GRID' },
        flowPreview: { x: 46, y: 114, width: 64, height: 36, label: 'FLOW' },
        gearPreview: { x: 104, y: 146, width: 60, height: 34, label: 'GEAR' },
    }),
});

const createMachineDefinition = ({
    id,
    name,
    spriteFileName,
    possibleGrids,
    possibleCircuits = MACHINE_FLOW_CATALOG[id] || [],
    possibleGears = MACHINE_GEAR_CATALOG[id] || [],
    miniDisplay = MACHINE_MINI_DISPLAY_CATALOG[id] || null,
    availableDays = DEFAULT_MACHINE_DAYS,
    availablePeriods = DEFAULT_MACHINE_PERIODS,
    openingDialogues,
    questionDialogues,
    communicationChance = 1,
}) => ({
    id,
    name,
    sprite: createMachineSprite(id, spriteFileName),
    possibleGrids,
    possibleCircuits,
    possibleGears,
    miniDisplay,
    availableDays,
    availablePeriods,
    openingDialogues,
    questionDialogues,
    communicationChance,
});

const clampPipValue = (value) => Math.max(0, Math.min(4, Number.isFinite(value) ? value : 0));

const createDomino = (firstOptionAmount, secondOptionAmount, extra = {}) => ({
    firstOptionAmount: clampPipValue(firstOptionAmount),
    secondOptionAmount: clampPipValue(secondOptionAmount),
    ...extra,
});

const linkCell = (row, col) => [row, col];

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
        name: 'Mechanic Broom',
        spriteFileName: null,
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
]);

export const MACHINE_SPRITE_MANIFEST = Object.freeze(
    MACHINE_CATALOG.map((machine) => machine.sprite).filter((sprite) => Boolean(sprite.path))
);

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
        tiles: Array.isArray(flowPuzzleOption.tiles)
            ? flowPuzzleOption.tiles.map((row) => row.map((cell) => ({ ...cell })))
            : undefined,
        forbidden: Array.isArray(flowPuzzleOption.forbidden)
            ? flowPuzzleOption.forbidden.map(([x, y]) => [x, y])
            : undefined,
        repairTargets: cloneRepairTargets(flowPuzzleOption.repairTargets),
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

function cloneMiniDisplay(miniDisplay) {
    if (!miniDisplay) return null;

    return {
        ...miniDisplay,
        gridPreview: miniDisplay.gridPreview ? { ...miniDisplay.gridPreview } : null,
        flowPreview: miniDisplay.flowPreview ? { ...miniDisplay.flowPreview } : null,
        gearPreview: miniDisplay.gearPreview ? { ...miniDisplay.gearPreview } : null,
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

function injectChargeGroupsIntoGridOption(gridOption, randomFn) {
    if (!gridOption || gridOption.impossible) return gridOption;

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
    const maxGroups = Math.min(3, Math.max(1, components.length + (randomFn() < 0.55 ? 1 : 0)));

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
            const useLessThan = randomFn() < 0.4;
            const threshold = exactTarget + 1 + Math.floor(randomFn() * Math.max(2, cluster.length));

            grid[anchor.row][anchor.col] = createChargeGroupAnchor(useLessThan ? -threshold : exactTarget);
            cluster.slice(1).forEach((cell) => {
                grid[cell.row][cell.col] = createChargeGroupLink(anchor.row, anchor.col);
            });

            cluster.forEach((cell) => reservedCells.add(cellKey(cell.row, cell.col)));
            groupsPlaced += 1;
        }
    });

    return {
        ...gridOption,
        grid,
    };
}

function normalizeGridDefinition(shapeGrid) {
    const baseGrid = cloneShapeGrid(shapeGrid).map((row) => row.map((cell) => {
        if (isLinkCell(cell) || isChargeGroupAnchorCell(cell) || isChargeGroupLinkCell(cell)) return CELL_EMPTY;
        return Number.isInteger(cell) ? cell : CELL_EMPTY;
    }));

    const equalLinks = new Map();
    const groupAnchors = new Map();
    const groupLinks = new Map();
    shapeGrid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (isLinkCell(cell)) {
                equalLinks.set(cellKey(rowIndex, colIndex), { row: cell[0], col: cell[1] });
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
        this.chargeGroups = normalizedGrid.chargeGroups.map((group) => ({
            ...group,
            anchor: { ...group.anchor },
            cells: group.cells.map((cell) => ({ ...cell })),
        }));
        this.chargeGroupCells = new Map(normalizedGrid.chargeGroupCells);
        this.chargeGroupLinks = new Map(normalizedGrid.chargeGroupLinks);
        this.impossible = Boolean(clonedGridOption.impossible);
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

    getDomino(dominoId) {
        return this.dominoes.find((domino) => domino.id === dominoId) || null;
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
            const matched = allPlaced && (group.mode === 'lt' ? sum < group.threshold : sum === group.threshold);

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

    getEqualLinkPairs() {
        return this.equalPairs.map((pair) => ({
            key: pair.key,
            a: { ...pair.a },
            b: { ...pair.b },
            matched: this.isEqualMatched(pair.a.row, pair.a.col),
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
        return decodePipCount(this.getCurrentCellValue(row, col)) === chargeLevel;
    }

    isEqualMatched(row, col) {
        const target = this.equalLinks.get(cellKey(row, col));
        if (!target) return false;

        const currentValue = this.getCurrentCellValue(row, col);
        const targetValue = this.getCurrentCellValue(target.row, target.col);
        if (!isPlacedCode(currentValue) || !isPlacedCode(targetValue)) return false;

        return decodePipCount(currentValue) === decodePipCount(targetValue);
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
        const chargeGroupSummaries = this.getChargeGroupSummaries();
        const totalChargeGroups = chargeGroupSummaries.length;
        const matchedChargeGroups = chargeGroupSummaries.reduce((count, group) => count + (group.matched ? 1 : 0), 0);
        const totalObjectives = totalChargeCells + totalEqualityPairs + totalChargeGroups;

        return {
            impossible: this.impossible,
            totalChargeCells,
            matchedChargeCells,
            totalEqualityPairs,
            matchedEqualityPairs,
            totalChargeGroups,
            matchedChargeGroups,
            solved: totalObjectives > 0
                && matchedChargeCells === totalChargeCells
                && matchedEqualityPairs === totalEqualityPairs
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
            domino.isFullyGlowing = evaluation.solved;
            domino.placedCells = domino.placedCells.map((cell) => ({
                ...cell,
                matchesCharge: this.isChargeMatched(cell.row, cell.col),
                matchesEquality: this.isEqualMatched(cell.row, cell.col),
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

function searchPuzzleSolution(state, dominoIndex = 0) {
    if (state.getEvaluation().solved) return true;
    if (dominoIndex >= state.dominoes.length) return false;

    if (searchPuzzleSolution(state, dominoIndex + 1)) {
        return true;
    }

    const domino = state.dominoes[dominoIndex];

    for (let rotationIndex = 0; rotationIndex < 4; rotationIndex += 1) {
        for (let row = 0; row < state.grid.length; row += 1) {
            const rowLength = state.grid[row]?.length ?? 0;
            for (let col = 0; col < rowLength; col += 1) {
                const candidate = createPlacementCandidate(rotationIndex, row, col);
                if (!canPlaceCandidate(state, candidate)) continue;

                state.placeDomino(domino.id, candidate);
                if (searchPuzzleSolution(state, dominoIndex + 1)) {
                    state.clearDominoPlacement(domino.id);
                    return true;
                }

                state.clearDominoPlacement(domino.id);
            }
        }
    }

    return false;
}

function isPlayableGridOption(gridOption) {
    if (!gridOption || gridOption.impossible) return false;
    if (GRID_SOLVABILITY_CACHE.has(gridOption)) {
        return GRID_SOLVABILITY_CACHE.get(gridOption);
    }

    const state = new MachinePuzzleState({
        ...gridOption,
        impossible: false,
    });
    const isSolvable = searchPuzzleSolution(state, 0);

    GRID_SOLVABILITY_CACHE.set(gridOption, isSolvable);
    return isSolvable;
}

export function createMachineVariant(options = {}) {
    const randomFn = typeof options === 'function'
        ? options
        : (options.randomFn || Math.random);
    const targetDay = typeof options === 'function' ? null : (options.day ?? null);
    const targetPeriod = typeof options === 'function' ? null : (options.period ?? null);

    const eligibleMachines = MACHINE_CATALOG.filter((machine) => {
        const dayMatches = targetDay === null || !Array.isArray(machine.availableDays) || machine.availableDays.includes(targetDay);
        const periodMatches = targetPeriod === null || !Array.isArray(machine.availablePeriods) || machine.availablePeriods.includes(targetPeriod);
        return dayMatches && periodMatches;
    });

    const machinePool = eligibleMachines.length > 0 ? eligibleMachines : MACHINE_CATALOG;
    const definition = pickRandomEntry(machinePool, randomFn) || machinePool[0] || MACHINE_CATALOG[0];
    const weightedGridPool = buildWeightedGridPool(definition.possibleGrids);
    const gridPool = weightedGridPool.length > 0 ? weightedGridPool : (definition.possibleGrids || []);
    const selectedGridTemplate = pickRandomEntry(gridPool, randomFn) || gridPool[0] || { grid: [], dominos: [] };
    const selectedGrid = injectChargeGroupsIntoGridOption(
        transformGridOption(selectedGridTemplate, pickGridTransformKey(selectedGridTemplate, randomFn)),
        randomFn,
    );
    const selectedFlowPuzzle = cloneFlowPuzzleOption(pickRandomEntry(definition.possibleCircuits, randomFn));
    const selectedGearPuzzle = cloneGearPuzzleOption(pickRandomEntry(definition.possibleGears, randomFn));
    if (selectedFlowPuzzle) {
        selectedFlowPuzzle.progress = createFlowProgress(selectedFlowPuzzle);
    }
    if (selectedGearPuzzle) {
        selectedGearPuzzle.progress = buildGearProgressSnapshot(selectedGearPuzzle, selectedGearPuzzle.pieces);
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
        miniDisplay: cloneMiniDisplay(definition.miniDisplay),
        availableDays: Array.isArray(definition.availableDays) ? [...definition.availableDays] : [],
        availablePeriods: Array.isArray(definition.availablePeriods) ? [...definition.availablePeriods] : [],
        puzzleState,
        shapeGrid: puzzleState.grid,
        dominoes: puzzleState.dominoes,
        openingDialogue,
        questionDialogue: selectedQuestion ? { ...selectedQuestion } : null,
        hasCommunication,
    };
}

export function resolveMachineTexture(scene, machineVariant) {
    const preferredKey = machineVariant?.spriteKey;
    if (preferredKey && scene.textures.exists(preferredKey)) return preferredKey;
    return machineVariant?.fallbackKey || MACHINE_FALLBACK_KEY;
}
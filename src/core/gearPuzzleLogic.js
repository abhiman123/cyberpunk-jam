export const GEAR_CODES = Object.freeze({
    EMPTY: 0,
    WALL: 1,
    FULL: 2,
    HORIZONTAL: 3,
    VERTICAL: 4,
    CURVE_NE: 5,
    CURVE_SE: 6,
    CURVE_SW: 7,
    CURVE_NW: 8,
    SOURCE: -1,
    SINK: -2,
    MOVABLE_WALL: -3,
});

const DIRS = Object.freeze([
    { key: 'N', dx: 0, dy: -1, opposite: 'S' },
    { key: 'E', dx: 1, dy: 0, opposite: 'W' },
    { key: 'S', dx: 0, dy: 1, opposite: 'N' },
    { key: 'W', dx: -1, dy: 0, opposite: 'E' },
]);

const CONNECTIONS_BY_TYPE = Object.freeze({
    [GEAR_CODES.SOURCE]: ['N', 'E', 'S', 'W'],
    [GEAR_CODES.SINK]: ['N', 'E', 'S', 'W'],
    [GEAR_CODES.FULL]: ['N', 'E', 'S', 'W'],
    [GEAR_CODES.HORIZONTAL]: ['E', 'W'],
    [GEAR_CODES.VERTICAL]: ['N', 'S'],
    [GEAR_CODES.CURVE_NE]: ['N', 'E'],
    [GEAR_CODES.CURVE_SE]: ['E', 'S'],
    [GEAR_CODES.CURVE_SW]: ['S', 'W'],
    [GEAR_CODES.CURVE_NW]: ['W', 'N'],
});

export function gearCellKey(row, col) {
    return `${row}:${col}`;
}

export function parseGearCellKey(key) {
    const [row, col] = String(key || '').split(':').map(Number);
    return { row, col };
}

export function cloneGearBoard(board) {
    if (!Array.isArray(board)) return [];
    return board.map((row) => row.map((cell) => cell));
}

export function cloneGearPieces(pieces) {
    if (!Array.isArray(pieces)) return [];
    return pieces.map((piece, index) => ({
        id: piece.id || `gear_piece_${index + 1}`,
        type: piece.type ?? GEAR_CODES.HORIZONTAL,
        row: piece.row ?? 0,
        col: piece.col ?? 0,
        movable: piece.movable !== false,
        ...piece,
    }));
}

export function getGearConnections(type) {
    return CONNECTIONS_BY_TYPE[type] || [];
}

export function isGearType(code) {
    return code >= GEAR_CODES.FULL || code === GEAR_CODES.SOURCE || code === GEAR_CODES.SINK;
}

export function isGearOccupantCode(code) {
    return code === GEAR_CODES.MOVABLE_WALL || isGearType(code);
}

export function buildGearOccupancy(board, pieces = []) {
    const occupancy = new Map();
    const sources = [];
    const sinks = [];

    board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isGearOccupantCode(cell)) return;

            const key = gearCellKey(rowIndex, colIndex);
            occupancy.set(key, {
                type: cell,
                row: rowIndex,
                col: colIndex,
                movable: false,
                pieceId: null,
            });

            if (cell === GEAR_CODES.SOURCE) {
                sources.push({ row: rowIndex, col: colIndex });
            } else if (cell === GEAR_CODES.SINK) {
                sinks.push({ row: rowIndex, col: colIndex });
            }
        });
    });

    cloneGearPieces(pieces).forEach((piece) => {
        const key = gearCellKey(piece.row, piece.col);
        occupancy.set(key, {
            type: piece.type,
            row: piece.row,
            col: piece.col,
            movable: piece.movable !== false,
            pieceId: piece.id,
        });
    });

    return { occupancy, sources, sinks };
}

export function evaluateGearPuzzleBoard(board, pieces = []) {
    const { occupancy, sources, sinks } = buildGearOccupancy(board, pieces);
    const powered = new Set();
    const queue = [];

    sources.forEach((source) => {
        const key = gearCellKey(source.row, source.col);
        powered.add(key);
        queue.push(source);
    });

    while (queue.length > 0) {
        const current = queue.shift();
        const currentEntry = occupancy.get(gearCellKey(current.row, current.col));
        if (!currentEntry) continue;

        const currentConnections = getGearConnections(currentEntry.type);
        DIRS.forEach((dir) => {
            if (!currentConnections.includes(dir.key)) return;

            const nextRow = current.row + dir.dy;
            const nextCol = current.col + dir.dx;
            if (nextRow < 0 || nextCol < 0 || nextRow >= board.length || nextCol >= (board[nextRow]?.length ?? 0)) return;

            const nextKey = gearCellKey(nextRow, nextCol);
            const nextEntry = occupancy.get(nextKey);
            if (!nextEntry || nextEntry.type === GEAR_CODES.MOVABLE_WALL || nextEntry.type === GEAR_CODES.WALL) return;

            const nextConnections = getGearConnections(nextEntry.type);
            if (!nextConnections.includes(dir.opposite)) return;
            if (powered.has(nextKey)) return;

            powered.add(nextKey);
            queue.push({ row: nextRow, col: nextCol });
        });
    }

    const sinkPowered = sinks.some((sink) => powered.has(gearCellKey(sink.row, sink.col)));
    const poweredPieces = cloneGearPieces(pieces).filter((piece) => powered.has(gearCellKey(piece.row, piece.col))).map((piece) => piece.id);

    return {
        occupancy,
        powered,
        poweredPieces,
        sinkPowered,
        completed: sinkPowered,
    };
}

export function buildGearProgressSnapshot(puzzle, pieces = puzzle?.pieces || []) {
    const normalizedPieces = cloneGearPieces(pieces);
    const result = evaluateGearPuzzleBoard(puzzle?.board || [], normalizedPieces);

    return {
        pieces: normalizedPieces,
        poweredCells: Array.from(result.powered).map((key) => parseGearCellKey(key)),
        poweredPieces: [...result.poweredPieces],
        completed: result.completed,
        sinkPowered: result.sinkPowered,
        flags: [],
        symptoms: result.completed ? [] : ['Drive train stalled.'],
    };
}
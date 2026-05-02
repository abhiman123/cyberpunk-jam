// Audit probe for machine puzzle solvability.
// Usage: node scratch/probe-puzzles.mjs
import {
    MACHINE_CATALOG,
    createMachineVariant,
    getEligibleMachineDefinitions,
    MachinePuzzleState,
} from '../src/data/machineCatalog.js';

function makeRng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 0x100000000;
    };
}

const PERIODS = [1, 2, 3];
const SEEDS_PER_COMBO = 5;
const failures = [];
const stats = { total: 0, unsolvableGrid: 0, nullPuzzles: 0 };

for (const machine of MACHINE_CATALOG) {
    for (const period of PERIODS) {
        const eligible = getEligibleMachineDefinitions({ day: period, period })
            .some((m) => m.id === machine.id);
        if (!eligible) continue;

        for (let seed = 1; seed <= SEEDS_PER_COMBO; seed += 1) {
            stats.total += 1;
            const rng = makeRng(seed * 1009 + period * 17);
            let variant;
            try {
                variant = createMachineVariant({
                    randomFn: rng,
                    day: period,
                    period,
                    forceMachineId: machine.id,
                });
            } catch (err) {
                failures.push(`THREW ${machine.id} day=${period} seed=${seed}: ${err.message}`);
                continue;
            }

            // Validate the grid is solvable when not deliberately impossible.
            const grid = variant.selectedGrid;
            if (grid && !grid.impossible && Array.isArray(grid.grid) && grid.grid.length > 0) {
                const state = new MachinePuzzleState({ ...grid, impossible: false });
                // Use full budget to avoid false negatives in audit.
                const budget = { remaining: 50000, timedOut: false };
                const solvable = solve(state, 0, budget);
                if (!solvable && !budget.timedOut) {
                    stats.unsolvableGrid += 1;
                    failures.push(`UNSOLVABLE GRID ${machine.id} period=${period} seed=${seed}`);
                }
            }
        }
    }
}

function solve(state, dominoIndex, budget) {
    if (budget.remaining <= 0) { budget.timedOut = true; return false; }
    budget.remaining -= 1;
    if (state.getEvaluation().solved) return true;
    if (dominoIndex >= state.dominoes.length) return false;
    const domino = state.dominoes[dominoIndex];
    for (let r = 0; r < 4; r += 1) {
        for (let row = 0; row < state.grid.length; row += 1) {
            const len = state.grid[row]?.length ?? 0;
            for (let col = 0; col < len; col += 1) {
                if (budget.timedOut) return false;
                const candidate = makeCandidate(r, row, col);
                if (!candidate.cells.every((c) => (
                    c.row >= 0 && c.row < state.grid.length
                    && c.col >= 0 && c.col < (state.grid[c.row]?.length ?? 0)
                    && state.canOccupyCell(c.row, c.col)
                ))) continue;
                state.placeDomino(domino.id, candidate);
                if (solve(state, dominoIndex + 1, budget)) {
                    state.clearDominoPlacement(domino.id);
                    return true;
                }
                state.clearDominoPlacement(domino.id);
            }
        }
    }
    if (!budget.timedOut && solve(state, dominoIndex + 1, budget)) return true;
    return false;
}

function makeCandidate(rotationIndex, row, col) {
    const ri = ((rotationIndex % 4) + 4) % 4;
    if (ri === 0) return { anchor: { row, col }, cells: [{ row, col }, { row: row + 1, col }], rotationIndex: ri };
    if (ri === 1) return { anchor: { row, col }, cells: [{ row, col: col + 1 }, { row, col }], rotationIndex: ri };
    if (ri === 2) return { anchor: { row, col }, cells: [{ row: row + 1, col }, { row, col }], rotationIndex: ri };
    return { anchor: { row, col }, cells: [{ row, col }, { row, col: col + 1 }], rotationIndex: ri };
}

console.log(`Probed ${stats.total} variants across ${MACHINE_CATALOG.length} machines × ${PERIODS.length} periods × ${SEEDS_PER_COMBO} seeds.`);
console.log(`Unsolvable grids: ${stats.unsolvableGrid}`);
console.log(`Failures: ${failures.length}`);
for (const f of failures.slice(0, 40)) console.log(`  ${f}`);
process.exit(failures.length === 0 ? 0 : 1);

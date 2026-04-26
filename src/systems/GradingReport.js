// Grading report — computes a letter grade and per-axis breakdown for
// the end-of-run screen. Pure functions (no scene / Phaser deps) so the
// logic can be unit-tested in isolation.

const TARGET_CASES = 12;
const TARGET_PAY   = 200;

const GRADE_BANDS = [
    { letter: 'S', min: 95, color: '#ffd97a', tone: 'Elite. The floor ran like clockwork.' },
    { letter: 'A', min: 85, color: '#7be3a3', tone: 'Strong. Few corners cut, most calls clean.' },
    { letter: 'B', min: 75, color: '#9ad6ff', tone: 'Solid. The shift held together.' },
    { letter: 'C', min: 65, color: '#e6cc6a', tone: 'Mediocre. The line moved, barely.' },
    { letter: 'D', min: 60, color: '#e09a3a', tone: 'Sloppy. Plenty of slipped calls.' },
    { letter: 'F', min:  0, color: '#ff5f5f', tone: 'Dismissed. The floor outpaced you.' },
];

function pct(n, d) {
    if (!d || d <= 0) return 0;
    return Math.max(0, Math.min(100, (n / d) * 100));
}

function letterFor(score) {
    return GRADE_BANDS.find((band) => score >= band.min) || GRADE_BANDS[GRADE_BANDS.length - 1];
}

// outcome.ready === true  → machine was repairable (correct = accept)
// outcome.scrapRequired   → machine was unfixable  (correct = scrap)
// (a machine is never both ready and scrapRequired by construction)
function outcomeWasCorrect(outcome) {
    if (!outcome) return false;
    if (outcome.scrapped && outcome.scrapRequired) return true;
    if (outcome.accepted && outcome.ready && !outcome.scrapRequired) return true;
    return false;
}

function countPuzzleParts(outcomes) {
    let required = 0;
    let completed = 0;
    outcomes.forEach((outcome) => {
        const results = outcome.puzzleResults || {};
        Object.values(results).forEach((part) => {
            if (!part?.required) return;
            required += 1;
            if (part.completed) completed += 1;
        });
    });
    return { required, completed };
}

export function buildGradingReport(state) {
    const outcomes = Array.isArray(state?.trackedMachineOutcomes)
        ? state.trackedMachineOutcomes
        : [];
    const totalMistakes = Number(state?.totalMistakes || 0);
    const paycheck      = Number(state?.paycheckTotal || 0);
    const totalCases    = outcomes.length;
    const correctCases  = outcomes.filter(outcomeWasCorrect).length;
    const parts         = countPuzzleParts(outcomes);

    // Verdict accuracy: explicit correct/total when we have outcomes,
    // otherwise fall back to the running mistake counter so the grade
    // still reflects penalties even on an unusual run with no tracked
    // outcomes (shouldn't happen, but defensive).
    const verdictScore = totalCases > 0
        ? pct(correctCases, totalCases)
        : Math.max(0, 100 - totalMistakes * 12);

    const puzzleScore = parts.required > 0
        ? pct(parts.completed, parts.required)
        : 100; // nothing required → full marks (don't penalise empty runs)

    const throughputScore   = pct(totalCases, TARGET_CASES);
    const compensationScore = pct(paycheck, TARGET_PAY);

    const axes = [
        {
            id: 'verdict',
            label: 'VERDICT ACCURACY',
            weight: 40,
            score: verdictScore,
            detail: totalCases > 0
                ? `${correctCases} of ${totalCases} cases judged correctly (${totalMistakes} violation${totalMistakes === 1 ? '' : 's'} on record).`
                : `${totalMistakes} violation${totalMistakes === 1 ? '' : 's'} on record.`,
        },
        {
            id: 'puzzle',
            label: 'REPAIR EXECUTION',
            weight: 30,
            score: puzzleScore,
            detail: parts.required > 0
                ? `${parts.completed} of ${parts.required} required diagnostics solved on the floor.`
                : 'No floor diagnostics required this run.',
        },
        {
            id: 'throughput',
            label: 'SHIFT THROUGHPUT',
            weight: 15,
            score: throughputScore,
            detail: `Processed ${totalCases} unit${totalCases === 1 ? '' : 's'} against a ${TARGET_CASES}-unit target.`,
        },
        {
            id: 'compensation',
            label: 'COMPENSATION',
            weight: 15,
            score: compensationScore,
            detail: `Earned $${paycheck.toFixed(2)} of the $${TARGET_PAY.toFixed(2)} target compensation.`,
        },
    ];

    const weightedSum = axes.reduce((sum, axis) => sum + axis.score * axis.weight, 0);
    const totalWeight = axes.reduce((sum, axis) => sum + axis.weight, 0);
    const finalScore  = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
    const grade       = letterFor(finalScore);

    return {
        finalScore,
        grade,
        axes,
        totals: {
            cases: totalCases,
            correctCases,
            violations: totalMistakes,
            paycheck,
        },
    };
}

export const GRADE_BANDS_FOR_DISPLAY = GRADE_BANDS;

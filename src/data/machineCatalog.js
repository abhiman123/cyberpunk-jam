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

const createFlowPuzzleOption = ({
    sourceRow,
    outputs,
    forbiddenCount = 0,
    impossible = false,
    previewTitle = 'POWER BUS',
}) => ({
    sourceRow,
    outputs,
    forbiddenCount,
    impossible,
    previewTitle,
});

const createMiniDisplay = ({
    artX,
    artY,
    artScale = 0.56,
    artAngle = 0,
    gridPreview,
    flowPreview,
}) => ({
    artX,
    artY,
    artScale,
    artAngle,
    gridPreview: { ...gridPreview },
    flowPreview: { ...flowPreview },
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

const MACHINE_MINI_DISPLAY_CATALOG = Object.freeze({
    assembler_alpha: createMiniDisplay({
        artX: 104,
        artY: 134,
        artScale: 0.94,
        gridPreview: { x: 42, y: 72, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' },
    }),
    audit_drone: createMiniDisplay({
        artX: 112,
        artY: 130,
        artScale: 0.96,
        artAngle: -4,
        gridPreview: { x: 138, y: 68, width: 54, height: 40, label: 'GRID' },
        flowPreview: { x: 44, y: 112, width: 62, height: 36, label: 'FLOW' },
    }),
    courier_shell: createMiniDisplay({
        artX: 102,
        artY: 136,
        artScale: 1.02,
        artAngle: 2,
        gridPreview: { x: 42, y: 70, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 134, y: 108, width: 60, height: 38, label: 'FLOW' },
    }),
    sentry_frame: createMiniDisplay({
        artX: 108,
        artY: 132,
        artScale: 0.97,
        gridPreview: { x: 136, y: 64, width: 56, height: 42, label: 'GRID' },
        flowPreview: { x: 44, y: 114, width: 64, height: 36, label: 'FLOW' },
    }),
    breakroom_brewer: createMiniDisplay({
        artX: 102,
        artY: 136,
        artScale: 0.98,
        artAngle: -4,
        gridPreview: { x: 42, y: 74, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 134, y: 108, width: 60, height: 38, label: 'FLOW' },
    }),
    mechanic_broom: createMiniDisplay({
        artX: 104,
        artY: 134,
        artScale: 0.98,
        artAngle: 6,
        gridPreview: { x: 46, y: 70, width: 58, height: 40, label: 'GRID' },
        flowPreview: { x: 136, y: 108, width: 60, height: 38, label: 'FLOW' },
    }),
    future_lounge_chair: createMiniDisplay({
        artX: 110,
        artY: 140,
        artScale: 1.02,
        artAngle: -7,
        gridPreview: { x: 136, y: 68, width: 56, height: 40, label: 'GRID' },
        flowPreview: { x: 46, y: 114, width: 64, height: 36, label: 'FLOW' },
    }),
});

const createMachineDefinition = ({
    id,
    name,
    spriteFileName,
    possibleGrids,
    possibleCircuits = MACHINE_FLOW_CATALOG[id] || [],
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
    };
}

function cloneMiniDisplay(miniDisplay) {
    if (!miniDisplay) return null;

    return {
        ...miniDisplay,
        gridPreview: miniDisplay.gridPreview ? { ...miniDisplay.gridPreview } : null,
        flowPreview: miniDisplay.flowPreview ? { ...miniDisplay.flowPreview } : null,
    };
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

function normalizeGridDefinition(shapeGrid) {
    const baseGrid = cloneShapeGrid(shapeGrid).map((row) => row.map((cell) => {
        if (isLinkCell(cell)) return CELL_EMPTY;
        return Number.isInteger(cell) ? cell : CELL_EMPTY;
    }));

    const equalLinks = new Map();
    shapeGrid.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            if (!isLinkCell(cell)) return;
            equalLinks.set(cellKey(rowIndex, colIndex), { row: cell[0], col: cell[1] });
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

    return { baseGrid, equalLinks, equalPairs };
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
        const totalObjectives = totalChargeCells + totalEqualityPairs;

        return {
            impossible: this.impossible,
            totalChargeCells,
            matchedChargeCells,
            totalEqualityPairs,
            matchedEqualityPairs,
            solved: totalObjectives > 0
                && matchedChargeCells === totalChargeCells
                && matchedEqualityPairs === totalEqualityPairs,
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

        this.dominoes.forEach((domino) => {
            domino.isFullyGlowing = evaluation.solved;
            domino.placedCells = domino.placedCells.map((cell) => ({
                ...cell,
                matchesCharge: this.isChargeMatched(cell.row, cell.col),
                matchesEquality: this.isEqualMatched(cell.row, cell.col),
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
    const playableGrids = Array.isArray(definition.possibleGrids)
        ? definition.possibleGrids.filter((gridOption) => isPlayableGridOption(gridOption))
        : [];
    const gridPool = playableGrids.length > 0 ? playableGrids : definition.possibleGrids;
    const selectedGrid = cloneGridOption(pickRandomEntry(gridPool, randomFn));
    const selectedFlowPuzzle = cloneFlowPuzzleOption(pickRandomEntry(definition.possibleCircuits, randomFn));
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
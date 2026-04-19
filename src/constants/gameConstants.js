const SOUND_FOLDER = 'assets/sounds';

const createSoundAsset = (subfolder, key, fileName) => ({
    key,
    fileName,
    path: `${SOUND_FOLDER}/${subfolder}/${fileName}`,
});

export const SOUND_ASSETS = Object.freeze({
    // Keep sound files in assets/sounds/<category>. If you swap a sound, change
    // the filename or category here instead of editing scene code.
    approveDecision: createSoundAsset('sfx', 'sfx_approve', 'sfx_approve.mp3'),
    scrapDecision: createSoundAsset('sfx', 'sfx_scrap', 'sfx_scrap.mp3'),
    repairDecision: createSoundAsset('sfx', 'sfx_repair', 'sfx_repair.mp3'),
    errorBuzz: createSoundAsset('sfx', 'sfx_error', 'sfx_error.mp3'),
    inspectionReveal: createSoundAsset('sfx', 'sfx_reveal', 'sfx_reveal.wav'),
    notificationAlert: createSoundAsset('sfx', 'sfx_notification_alert', 'sfx_notification_alert.wav'),
    puzzleFixed: createSoundAsset('sfx', 'sfx_puzzle_fixed', 'sfx_puzzle_fixed.wav'),
    fuseRotate: createSoundAsset('sfx', 'sfx_fuse_rotate', 'sfx_fuse_rotate_electric.wav'),
    fuseConnect: createSoundAsset('sfx', 'sfx_fuse_connect', 'sfx_fuse_connect_electric.wav'),
    circuitLock: createSoundAsset('sfx', 'sfx_circuit_lock', 'sfx_circuit_lock.wav'),
    circuitPower: createSoundAsset('sfx', 'sfx_circuit_power', 'sfx_circuit_power_charge.wav'),

    managerMusic: createSoundAsset('music', 'music_manager', 'music_manager.mp3'),
    clockingInMusic: createSoundAsset('music', 'music_clocking_in', 'music_clocking_in.mp3'),
    workdayMusic: createSoundAsset('music', 'music_workday', 'music_workday.mp3'),
    cuttingItCloseMusic: createSoundAsset('music', 'music_cutting_it_close', 'music_cutting_it_close.mp3'),
    paydayMusic: createSoundAsset('music', 'music_payday', 'music_payday.mp3'),
    firedMusic: createSoundAsset('music', 'music_fired', 'music_fired.mp3'),

    titlePlay: createSoundAsset('ui', 'ui_title_play', 'ui_title_play.wav'),
    phoneRing: createSoundAsset('voice', 'phone_ring', 'phone_ring.wav'),
    phoneVoiceIntro: createSoundAsset('voice', 'phone_voice_intro', 'phone_voice_intro.wav'),
    phoneIntroLine1: createSoundAsset('voice', 'phone_intro_line_1', 'phone_intro_line_1.wav'),
    phoneIntroLine2: createSoundAsset('voice', 'phone_intro_line_2', 'phone_intro_line_2.wav'),
    phoneIntroYesLine3: createSoundAsset('voice', 'phone_intro_yes_line_3', 'phone_intro_yes_line_3.wav'),
    phoneIntroYesLine4: createSoundAsset('voice', 'phone_intro_yes_line_4', 'phone_intro_yes_line_4.wav'),
    phoneIntroYesLine5: createSoundAsset('voice', 'phone_intro_yes_line_5', 'phone_intro_yes_line_5.wav'),
    phoneIntroYesLine6: createSoundAsset('voice', 'phone_intro_yes_line_6', 'phone_intro_yes_line_6.wav'),
    phoneIntroNoLine3: createSoundAsset('voice', 'phone_intro_no_line_3', 'phone_intro_no_line_3.wav'),
    phoneIntroNoLine4: createSoundAsset('voice', 'phone_intro_no_line_4', 'phone_intro_no_line_4.wav'),
});

export const SOUND_MANIFEST = Object.freeze(Object.values(SOUND_ASSETS));

export const SOUND_VOLUMES = Object.freeze({
    decision: 0.8,
    reveal: 0.7,
    notification: 0.75,
    puzzleFixed: 0.78,
    puzzleRotate: 0.62,
    puzzleConnect: 0.72,
    puzzleLock: 0.74,
    puzzlePower: 0.82,
    ui: 0.75,
    phoneRing: 0.8,
    voice: 0.9,
    music: 0.7,
});

export const SHIFT_DURATION_MS_BY_PERIOD = Object.freeze({
    1: 180000,
    2: 135000,
    3: 90000,
});

export const SHIFT_CLOCK = Object.freeze({
    startHour24: 12,
    startMinute: 0,
    displayStepMinutes: 5,

    // For the current test setup, 20 seconds of real time equals 2 hours in game.
    // Change this value to 60000 later if you want 1 real minute to equal 2 hours.
    realMsPerAdvanceChunk: 20000,
    inGameMinutesPerAdvanceChunk: 120,
});

export const FIRST_SHIFT_INTRO = Object.freeze({
    enabled: true,
    silenceBeforePhoneMs: 2200,
    caseArrivalDelayMs: 700,
    fallbackVoiceMs: 1400,
    lineGapMs: 140,
    incomingHeader: 'Notification:',
    incomingBody: 'Phone Call Coming',
    postVoiceBody: 'Call complete. Tap either button to continue.',
    questionStatus: 'DO YOU REMEMBER? // ✓ YES // X NO',
    continueStatus: 'CALL COMPLETE // ✓ OR X TO CONTINUE',
    script: Object.freeze({
        intro: Object.freeze([
            Object.freeze({
                id: 'line1',
                text: 'Heyyy, welcome back. Another day, another penny, am I right',
                voiceAsset: SOUND_ASSETS.phoneIntroLine1,
            }),
            Object.freeze({
                id: 'line2',
                text: '...you remember the job right?',
                voiceAsset: SOUND_ASSETS.phoneIntroLine2,
            }),
        ]),
        yes: Object.freeze([
            Object.freeze({
                id: 'line3',
                text: '"Alruight, see this" That\'s your rulebook. Company updates it whenever they feel like it.',
                voiceAsset: SOUND_ASSETS.phoneIntroYesLine3,
            }),
            Object.freeze({
                id: 'line4',
                text: 'Machines roll in on the belt, some are fine, some arent. You\'ve got three options. If it follows the rules? Easy money. Accept it. Otherwise, if its fixable, like busted circuits or bad wiring, patch it up. If its a lost cause, scrap it.',
                voiceAsset: SOUND_ASSETS.phoneIntroYesLine4,
            }),
            Object.freeze({
                id: 'line5',
                text: 'You get paid per correct call. Mess it up: quality control docks your pay. Oh, and if something feels impossible? It probably is. So dont overthink it.',
                voiceAsset: SOUND_ASSETS.phoneIntroYesLine5,
            }),
            Object.freeze({
                id: 'line6',
                text: 'Good luck and your shift ends at 12.',
                voiceAsset: SOUND_ASSETS.phoneIntroYesLine6,
            }),
        ]),
        no: Object.freeze([
            Object.freeze({
                id: 'line3',
                text: 'Alright sweet cuz I dont',
                voiceAsset: SOUND_ASSETS.phoneIntroNoLine3,
            }),
            Object.freeze({
                id: 'line4',
                text: 'Good luck and your shift ends at 12.',
                voiceAsset: SOUND_ASSETS.phoneIntroNoLine4,
            }),
        ]),
    }),
});

export const MACHINE_PRESENTATION = Object.freeze({
    conveyorEntryX: 1450,
    conveyorTargetX: 760,
    conveyorSpeedPxPerSecond: 420,
    blueprintOriginX: 962,
    blueprintOriginY: 206,
    blueprintCellSize: 16,
});

export const MACHINE_PUZZLE = Object.freeze({
    overlayPanelWidth: 1000,
    overlayPanelHeight: 680,
    overlayGridTopY: -205,
    overlayBoardPadding: 22,
    overlayCellSize: 54,
    overlayTableGap: 34,
    overlayTableMinWidth: 520,
    overlayTablePadding: 38,
    dominoWidth: 64,
    dominoHeight: 116,
    dominoHitPaddingX: 8,
    dominoHitPaddingY: 16,
    dragStartDistancePx: 6,
    dominoRotationMs: 170,
    dominoSnapMs: 140,
    dominoReturnMs: 170,
    dominoRestScale: 0.84,
    dominoHoverScale: 0.9,
    dominoFloatingScale: 1.08,
    previewPulseMs: 320,
    messageDurationMs: 1150,
    inspectButtonX: 1118,
    inspectButtonY: 652,
    debugCellFontSize: 21,
    debugCellTextColor: '#f5f0d8',
});

export const FACTORY_DEBUG = Object.freeze({
    enabled: false,
    showPuzzleGridValues: true,
    workbenchEnabled: false,
});

export function getShiftClockStepMs() {
    const stepCount = SHIFT_CLOCK.inGameMinutesPerAdvanceChunk / SHIFT_CLOCK.displayStepMinutes;
    return SHIFT_CLOCK.realMsPerAdvanceChunk / stepCount;
}
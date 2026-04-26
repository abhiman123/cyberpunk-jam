const SOUND_FOLDER = 'assets/sounds';

const createSoundAsset = (subfolder, key, fileName) => ({
    key,
    fileName,
    path: `${SOUND_FOLDER}/${subfolder}/${fileName}`,
});
const createRootSoundAsset = (key, fileName) => ({
    key,
    fileName,
    path: fileName,
});

const MACHINE_DIALOGUE_SOUND_IDS = Object.freeze([
    'assembler_alpha',
    'audit_drone',
    'courier_shell',
    'sentry_frame',
    'breakroom_brewer',
    'mechanic_broom',
    'cry_baby',
    'rich_mf',
    'jester_in_the_box',
    'rebellious_umbrella',
    'circuit_dealer',
    'debrief_machine',
    'future_lounge_chair',
    'phonograph',
    'khaby_face_bot',
    'trash_picker_upper',
    'lifeguard_robot',
    'parrot_robot',
    'baseball_shooter',
    'companion_humanoid',
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
    'security_camera_bot',
    'closet_machine_dresser',
    'magic_machine',
    'coffee_machine',
    'miku_machine',
    'charging_station_port',
]);

const createMachineDialogueSoundAssets = (machineIds) => Object.fromEntries(
    machineIds.map((machineId) => ([
        `machineVoice_${machineId}`,
        createSoundAsset('voice', `voice_machine_${machineId}`, 'phone_voice_intro.wav'),
    ]))
);

export const SOUND_ASSETS = Object.freeze({
    // Decision SFX — files not yet in assets/, kept as stubs so references don't crash
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
    conveyorBelt: createSoundAsset('sfx', 'sfx_conveyor', 'sfx_conveyor.mp3'),

    managerMusic: createSoundAsset('music', 'music_manager', 'music_manager.mp3'),
    clockingInMusic: createSoundAsset('music', 'music_clocking_in', 'music_clocking_in.mp3'),
    corporateMusic: createSoundAsset('music', 'music_corporate', 'music_corporate.mp3'),
    workdayMusic: createSoundAsset('music', 'music_workday', 'music_workday.mp3'),
    cuttingItCloseMusic: createSoundAsset('music', 'music_cutting_it_close', 'music_cutting_it_close.mp3'),
    paydayMusic: createSoundAsset('music', 'music_payday', 'music_payday.mp3'),
    firedMusic: createSoundAsset('music', 'music_fired', 'music_fired.mp3'),

    titlePlay: createSoundAsset('ui', 'ui_title_play', 'ui_title_play.wav'),
    phoneRing: createSoundAsset('voice', 'phone_ring', 'phone_ring.wav'),
    phoneRinging: createSoundAsset('voice', 'phoneringing', 'phoneringing.mp3'),
    // Shipped in project public/ root (Vite serves them at /filename).
    phoneVoiceIntro: createRootSoundAsset('phone_voice_intro', 'phone_voice_intro.wav'),
    phoneIntroLine1: createRootSoundAsset('phone_intro_line_1', 'phone_intro_line_1.wav'),
    phoneIntroLine2: createRootSoundAsset('phone_intro_line_2', 'phone_intro_line_2.wav'),
    phoneIntroYesLine3: createRootSoundAsset('phone_intro_yes_line_3', 'phone_intro_yes_line_3.wav'),
    phoneIntroYesLine4: createRootSoundAsset('phone_intro_yes_line_4', 'phone_intro_yes_line_4.wav'),
    phoneIntroYesLine5: createRootSoundAsset('phone_intro_yes_line_5', 'phone_intro_yes_line_5.wav'),
    phoneIntroYesLine6: createRootSoundAsset('phone_intro_yes_line_6', 'phone_intro_yes_line_6.wav'),
    phoneIntroNoLine3: createRootSoundAsset('phone_intro_no_line_3', 'phone_intro_no_line_3.wav'),
    phoneIntroNoLine4: createRootSoundAsset('phone_intro_no_line_4', 'phone_intro_no_line_4.wav'),
    phoneDay2Intro1: createRootSoundAsset('phone_day2_intro_1', 'day2_line_1.wav'),
    phoneDay2Intro2: createRootSoundAsset('phone_day2_intro_2', 'day2_line_2.wav'),
    phoneDay2YesLine1: createRootSoundAsset('phone_day2_yes_line_1', 'day2_no_line_3.wav'),
    phoneDay2NoLine1: createRootSoundAsset('phone_day2_no_line_1', 'day2_no_line_3.wav'),
    phoneDay2NoLine2: createRootSoundAsset('phone_day2_no_line_2', 'day2_no_line4.wav'),
    phoneDay2NoLine3: createRootSoundAsset('phone_day2_no_line_3', 'day2_no_line_5.wav'),
    managerCall: createRootSoundAsset('manager_call', 'ManagerCall.mp3'),
    endingThemeEdited: createRootSoundAsset('ending_theme_edited', 'EndingThemeEdited.mp3'),
    ...createMachineDialogueSoundAssets(MACHINE_DIALOGUE_SOUND_IDS),
});

/**
 * Only assets that actually exist on disk should be in this manifest.
 * Phaser's loader calls this list, so entries for non-existent files are
 * removed here to prevent audio decoder EncodingError crashes.
 * (The missing asset keys still exist in SOUND_ASSETS above so that all
 * in-game code references remain valid — they just silently skip playback
 * via cache.audio.has() checks.)
 */
const SOUND_ASSETS_ON_DISK = new Set([
    'conveyorBelt',
    'inspectionReveal',
    'corporateMusic',
    'workdayMusic',
    'cuttingItCloseMusic',
    'paydayMusic',
    'titlePlay',
    'phoneRing',
    'phoneRinging',
    'phoneVoiceIntro',
    'phoneIntroLine1',
    'phoneIntroLine2',
    'phoneIntroYesLine3',
    'phoneIntroYesLine4',
    'phoneIntroYesLine5',
    'phoneIntroYesLine6',
    'phoneIntroNoLine3',
    'phoneIntroNoLine4',
    'phoneDay2Intro1',
    'phoneDay2Intro2',
    'phoneDay2YesLine1',
    'phoneDay2NoLine1',
    'phoneDay2NoLine2',
    'phoneDay2NoLine3',
    'managerCall',
    'endingThemeEdited',
    ...MACHINE_DIALOGUE_SOUND_IDS.map((id) => `machineVoice_${id}`),
]);

export const SOUND_MANIFEST = Object.freeze(
    Object.entries(SOUND_ASSETS)
        .filter(([key]) => SOUND_ASSETS_ON_DISK.has(key))
        .map(([, asset]) => asset)
);

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
    phoneRinging: 0.6,
    voice: 0.9,
    music: 0.7,
    conveyor: 0.2,
});

export const SHIFT_DURATION_MS = 360000;

export const SHIFT_DURATION_MS_BY_PERIOD = Object.freeze({
    1: SHIFT_DURATION_MS,
    2: SHIFT_DURATION_MS,
    3: SHIFT_DURATION_MS,
    4: SHIFT_DURATION_MS,
});

export const SHIFT_CLOCK = Object.freeze({
    startHour24: 12,
    startMinute: 0,
    displayStepMinutes: 5,
    realMsPerAdvanceChunk: 60000,
    inGameMinutesPerAdvanceChunk: 120,
});

const createIntroSequenceLine = (id, text, voiceAsset = null) => Object.freeze({
    id,
    text,
    voiceAsset,
});

const createIntroSequence = ({
    incomingBody,
    questionStatus,
    continueStatus,
    postVoiceBody,
    intro,
    yes,
    no,
}) => Object.freeze({
    incomingBody,
    questionStatus,
    continueStatus,
    postVoiceBody,
    script: Object.freeze({
        intro: Object.freeze(intro),
        yes: Object.freeze(yes),
        no: Object.freeze(no),
    }),
});

export const FIRST_SHIFT_INTRO = Object.freeze({
    enabled: true,
    silenceBeforePhoneMs: 0,
    caseArrivalDelayMs: 0,
    // Minimum per-line hold when a voice file is missing so subtitles do not
    // hop faster than a plausible read.
    fallbackVoiceMs: 320,
    lineGapMs: 0,
    incomingHeader: 'Notification:',
    sequences: Object.freeze({
        '1-1': createIntroSequence({
            incomingBody: 'Phone Call Coming',
            questionStatus: 'KNOW DAY 1 RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 1 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Hey, welcome back. Another day, another penny, am I right?', SOUND_ASSETS.phoneIntroLine1),
                createIntroSequenceLine('line2', '...You remember the job, right?', SOUND_ASSETS.phoneIntroLine2),
            ],
            yes: [
                createIntroSequenceLine('line3', "Alright, sweet, cuz I don't.", SOUND_ASSETS.phoneIntroNoLine3),
            ],
            no: [
                createIntroSequenceLine('line4', "See that ipad on your table? That's your rulebook. Company updates it whenever they feel like it.", SOUND_ASSETS.phoneIntroYesLine3),
                createIntroSequenceLine('line5', "Machines roll in on the belt, some are fine, some arent. You've got three options, if it follows the rules? Easy money. Accept it. Otherwise, if its fixable, like busted circuits or bad wiring, patch it up. If doesnt meet rules, scrap it.", SOUND_ASSETS.phoneIntroYesLine4),
                createIntroSequenceLine('line6', 'You get paid per correct call. Mess it up: quality control docks your pay. Oh, and if something looks wrong? It probably is. so dont over think it..', SOUND_ASSETS.phoneIntroYesLine5),
                createIntroSequenceLine('line7', 'Good luck. Shift ends at 12.', SOUND_ASSETS.phoneIntroYesLine6),
            ],
        }),
        '2-1': createIntroSequence({
            incomingBody: 'Compliance Call Coming',
            questionStatus: 'KNOW DAY 2 RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 2 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Morning. Company pushed a fresh directive while you were asleep, you know the new rule, right?', SOUND_ASSETS.phoneDay2Intro1),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Perfect. Again, just remember to inspect carefully and shift ends at 12.', SOUND_ASSETS.phoneDay2Intro2),
            ],
            no: [
                createIntroSequenceLine('line3', "Alright listen. Day two is the same as day one but the problems in machines don't make it impossible to solve.", SOUND_ASSETS.phoneDay2NoLine1),
                createIntroSequenceLine('line4', "I'd recommend you check out the rulebook but watch out for contraband marks cause some things could look wrong.", SOUND_ASSETS.phoneDay2NoLine2),
                createIntroSequenceLine('line5', 'Remember, it can be fixable but it could still not meet quota and as always, shift ends at 12. Good luck.', SOUND_ASSETS.phoneDay2NoLine3),
            ],
        }),
        '3-1': createIntroSequence({
            incomingBody: 'Compliance Call Coming',
            questionStatus: 'KNOW DAY 3 RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 3 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Morning. Final shift block is live. The floor is running hotter diagnostics today.'),
                createIntroSequenceLine('line2', 'You know the new rule: if a subsystem shows hazardous instability, contamination, or unsafe discharge, you scrap it. No argument.'),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Good. You treat any red as a stop signal, not a suggestion.'),
                createIntroSequenceLine('line4', 'You are not here to hero-fix danger. You are here to log it, scrap it, and keep the line from lying about safety.'),
            ],
            no: [
                createIntroSequenceLine('line3', 'Then listen like your quota depends on it, because it does. Day three is hazard control, not performance art.'),
                createIntroSequenceLine('line4', 'Green code with red sparks? Scrap. Drivetrain venting red? Scrap. Power module browning out and flashing? Scrap. Board region that should not be glowing? Scrap.'),
                createIntroSequenceLine('line5', 'If the rulebook reads colder today, that is because the company wants fewer stories and more hard stops.'),
            ],
        }),
        '4-1': createIntroSequence({
            incomingBody: 'Overtime Call Coming',
            questionStatus: 'KNOW TODAY\'S RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 4 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Look at you. Still here.'),
                createIntroSequenceLine('line2', 'Same hazard rules as yesterday. If it looks unstable, contaminated, or dangerous, you scrap it.'),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Good. Then trust the warning signs before you trust the machine.'),
            ],
            no: [
                createIntroSequenceLine('line3', 'Quick version. If the machine starts looking wrong in a dangerous way, do not get sentimental.'),
                createIntroSequenceLine('line4', 'Unsafe software, unsafe load, unsafe motion, unsafe board. Scrap it and keep moving.'),
            ],
        }),
    }),
});

export function getOpeningPhoneCallSequence(day = 1) {
    const sequenceKeyByDay = {
        1: '1-1',
        2: '2-1',
        3: '3-1',
        4: '4-1',
    };

    return FIRST_SHIFT_INTRO.sequences[sequenceKeyByDay[day] || '1-1'] || FIRST_SHIFT_INTRO.sequences['1-1'];
}

export const MACHINE_PRESENTATION = Object.freeze({
    conveyorEntryX: 1380,
    conveyorTargetX: 640,
    conveyorExitX: -210,
    /** Approve: unit rides farther off-screen (clone used while next loads). */
    conveyorApproveExitX: -820,
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
    debugCellTextColor: '#f4f2e5',
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

const SOUND_FOLDER = 'assets/sounds';

const createSoundAsset = (subfolder, key, fileName) => ({
    key,
    fileName,
    path: `${SOUND_FOLDER}/${subfolder}/${fileName}`,
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
    'workforce_quality_control_supervisor',
    'future_lounge_chair',
    'phonograph',
    'khaby_face_bot',
    'trash_picker_upper',
    'lifeguard_robot',
    'dog_companion_robot',
    'parrot_robot',
    'baseball_shooter',
    'companion_humanoid',
    'instrument_robot',
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
    lightBulbHum: createSoundAsset('sfx', 'sfx_light_bulb_hum', 'sfx_light_bulb_hum.wav'),
    lightBulbFlicker: createSoundAsset('sfx', 'sfx_light_bulb_flicker', 'sfx_light_bulb_flicker.wav'),

    managerMusic: createSoundAsset('music', 'music_manager', 'music_manager.mp3'),
    clockingInMusic: createSoundAsset('music', 'music_clocking_in', 'music_clocking_in.mp3'),
    workdayMusic: createSoundAsset('music', 'music_workday', 'music_workday.mp3'),
    cuttingItCloseMusic: createSoundAsset('music', 'music_cutting_it_close', 'music_cutting_it_close.mp3'),
    paydayMusic: createSoundAsset('music', 'music_payday', 'music_payday.mp3'),
    firedMusic: createSoundAsset('music', 'music_fired', 'music_fired.mp3'),

    titlePlay: createSoundAsset('ui', 'ui_title_play', 'ui_title_play.wav'),
    phoneRing: createSoundAsset('voice', 'phone_ring', 'phone_ring.wav'),
    phoneRinging: createSoundAsset('voice', 'phoneringing', 'phoneringing.mp3'),
    phoneVoiceIntro: createSoundAsset('voice', 'phone_voice_intro', 'phone_voice_intro.wav'),
    phoneIntroLine1: createSoundAsset('voice', 'phone_intro_line_1', 'phone_intro_line_1.wav'),
    phoneIntroLine2: createSoundAsset('voice', 'phone_intro_line_2', 'phone_intro_line_2.wav'),
    phoneIntroYesLine3: createSoundAsset('voice', 'phone_intro_yes_line_3', 'phone_intro_yes_line_3.wav'),
    phoneIntroYesLine4: createSoundAsset('voice', 'phone_intro_yes_line_4', 'phone_intro_yes_line_4.wav'),
    phoneIntroYesLine5: createSoundAsset('voice', 'phone_intro_yes_line_5', 'phone_intro_yes_line_5.wav'),
    phoneIntroYesLine6: createSoundAsset('voice', 'phone_intro_yes_line_6', 'phone_intro_yes_line_6.wav'),
    phoneIntroNoLine3: createSoundAsset('voice', 'phone_intro_no_line_3', 'phone_intro_no_line_3.wav'),
    phoneIntroNoLine4: createSoundAsset('voice', 'phone_intro_no_line_4', 'phone_intro_no_line_4.wav'),
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
    'inspectionReveal',
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
    lightBulbHum: 0.2,
    lightBulbFlicker: 0.42,
    music: 0.7,
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
    fallbackVoiceMs: 0,
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
                createIntroSequenceLine('line2', '...You remember the job, right? First day is simple. If a subsystem is obviously unsalvageable, you scrap it.', SOUND_ASSETS.phoneIntroLine2),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Alright, sweetie, because I do not.', SOUND_ASSETS.phoneIntroNoLine3),
                createIntroSequenceLine('line4', 'Day one is just repair versus obvious scrap. Do not invent extra paperwork for yourself.', SOUND_ASSETS.phoneIntroNoLine4),
            ],
            no: [
                createIntroSequenceLine('line3', 'Alright, see this? The rulebook only cares about one thing today: can the subsystem even be saved.', SOUND_ASSETS.phoneIntroYesLine3),
                createIntroSequenceLine('line4', 'If the gear is cracked, the wire route is severed, or the board has an orphan cell, you scrap it. Programming jobs should run clean on day one if they are repairable at all.', SOUND_ASSETS.phoneIntroYesLine4),
                createIntroSequenceLine('line5', 'If it is broken but still repairable, you solve the puzzle and file the unit clean. Today is about learning the work, not chasing output drift.', SOUND_ASSETS.phoneIntroYesLine5),
                createIntroSequenceLine('line6', 'Good luck. Shift ends at noon.', SOUND_ASSETS.phoneIntroYesLine6),
            ],
        }),
        '2-1': createIntroSequence({
            incomingBody: 'Compliance Call Coming',
            questionStatus: 'KNOW DAY 2 RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 2 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Morning, honey. Company pushed a fresh directive while you were asleep.'),
                createIntroSequenceLine('line2', 'You know the new rule, right? Today the puzzle can work and still fail compliance.'),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Perfect. Today you are not just repair. You are inspection.'),
                createIntroSequenceLine('line4', 'If the subsystem breaks protocol, carries a rejection mark, drinks the wrong power, or shows a corrupted board marker, you scrap it anyway.'),
            ],
            no: [
                createIntroSequenceLine('line3', 'Then listen. Day two is compliance verification.'),
                createIntroSequenceLine('line4', 'Programming outputs must be exact. Gears cannot carry contraband marks. Required wire targets cannot take the wrong power class. Board markers have to be valid and readable.'),
                createIntroSequenceLine('line5', 'It can look almost right and still be scrap. That is the point.'),
            ],
        }),
        '3-1': createIntroSequence({
            incomingBody: 'Hazard Call Coming',
            questionStatus: 'KNOW DAY 3 RULE? // YES OR NO',
            continueStatus: 'CALL COMPLETE // PRESS EITHER BUTTON',
            postVoiceBody: 'Day 3 loaded. Tap either button to continue.',
            intro: [
                createIntroSequenceLine('line1', 'Hey, sweetheart. Final day now. The floor got meaner.'),
                createIntroSequenceLine('line2', 'You know the new rule, right? If the subsystem shows hazardous instability, contamination, or unsafe discharge, you scrap it.'),
            ],
            yes: [
                createIntroSequenceLine('line3', 'Good. If it sparks red, crawls wrong, or starts shaking like it wants a witness, do not be brave.'),
                createIntroSequenceLine('line4', 'You are here to classify danger, not survive it.'),
            ],
            no: [
                createIntroSequenceLine('line3', 'Then listen close. Day three is hazard control.'),
                createIntroSequenceLine('line4', 'Green debugger bug with red sparks? Scrap. Overtorqued drivetrain throwing red discharge? Scrap. Power module flashing red from bad load? Scrap. Board region glowing red? Scrap.'),
                createIntroSequenceLine('line5', 'Today the rulebook stops sounding human for a reason.'),
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
    conveyorTargetX: 700,
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

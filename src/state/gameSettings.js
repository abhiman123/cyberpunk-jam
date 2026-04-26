const STORAGE_KEY = 'cyberpunk-jam.settings';

const DEFAULT_GAME_SETTINGS = Object.freeze({
    musicVolume: 0.2,
});

let cachedSettings = null;

function clampMusicVolume(value) {
    if (!Number.isFinite(value)) return DEFAULT_GAME_SETTINGS.musicVolume;
    return Math.max(0, Math.min(1, value));
}

function getStorage() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
}

function readStoredSettings() {
    const storage = getStorage();
    if (!storage) return {};

    try {
        const rawValue = storage.getItem(STORAGE_KEY);
        if (!rawValue) return {};

        const parsedValue = JSON.parse(rawValue);
        return parsedValue && typeof parsedValue === 'object' ? parsedValue : {};
    } catch (_error) {
        return {};
    }
}

function writeStoredSettings(settings) {
    const storage = getStorage();
    if (!storage) return;

    try {
        storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_error) {
        // Ignore write failures so the game keeps running without storage.
    }
}

function normalizeSettings(settings = {}) {
    const resolvedMusicVolume = Number.isFinite(settings.musicVolume)
        ? clampMusicVolume(settings.musicVolume)
        : (settings.musicEnabled === false ? 0 : DEFAULT_GAME_SETTINGS.musicVolume);

    return {
        musicVolume: resolvedMusicVolume,
        musicEnabled: resolvedMusicVolume > 0,
    };
}

export function getGameSettings() {
    if (!cachedSettings) {
        cachedSettings = normalizeSettings({
            ...DEFAULT_GAME_SETTINGS,
            ...readStoredSettings(),
        });
    }

    return normalizeSettings(cachedSettings);
}

function updateGameSettings(patch) {
    const currentSettings = getGameSettings();
    let nextMusicVolume = currentSettings.musicVolume;

    if (Object.prototype.hasOwnProperty.call(patch, 'musicVolume')) {
        nextMusicVolume = clampMusicVolume(patch.musicVolume);
    } else if (Object.prototype.hasOwnProperty.call(patch, 'musicEnabled')) {
        nextMusicVolume = patch.musicEnabled
            ? (currentSettings.musicVolume > 0 ? currentSettings.musicVolume : DEFAULT_GAME_SETTINGS.musicVolume)
            : 0;
    }

    cachedSettings = normalizeSettings({
        ...currentSettings,
        ...patch,
        musicVolume: nextMusicVolume,
    });

    writeStoredSettings({
        musicVolume: cachedSettings.musicVolume,
    });
    return normalizeSettings(cachedSettings);
}

export function getMusicVolume() {
    return getGameSettings().musicVolume;
}

export function setMusicVolume(value) {
    return updateGameSettings({ musicVolume: value });
}


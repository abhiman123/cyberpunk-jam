const STORAGE_KEY = 'cyberpunk-jam.settings';

export const DEFAULT_GAME_SETTINGS = Object.freeze({
    musicEnabled: true,
});

let cachedSettings = null;

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

export function getGameSettings() {
    if (!cachedSettings) {
        cachedSettings = {
            ...DEFAULT_GAME_SETTINGS,
            ...readStoredSettings(),
        };
    }

    return { ...cachedSettings };
}

export function updateGameSettings(patch) {
    cachedSettings = {
        ...getGameSettings(),
        ...patch,
    };

    writeStoredSettings(cachedSettings);
    return { ...cachedSettings };
}

export function isMusicEnabled() {
    return Boolean(getGameSettings().musicEnabled);
}

export function toggleMusicEnabled() {
    return updateGameSettings({ musicEnabled: !isMusicEnabled() });
}
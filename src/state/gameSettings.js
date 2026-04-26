const STORAGE_KEY = 'cyberpunk-jam.settings';

export const DEFAULT_GAME_SETTINGS = Object.freeze({
    musicVolume: 0.2,
    sfxVolume: 0.6,
    screenZoom: 1,
});

let cachedSettings = null;
const zoomListeners = new Set();

function clampUnit(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(1, value));
}

function clampMusicVolume(value) {
    return clampUnit(value, DEFAULT_GAME_SETTINGS.musicVolume);
}

function clampSfxVolume(value) {
    return clampUnit(value, DEFAULT_GAME_SETTINGS.sfxVolume);
}

function clampScreenZoom(value) {
    if (!Number.isFinite(value)) return DEFAULT_GAME_SETTINGS.screenZoom;
    return Math.max(0.25, Math.min(1, value));
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
        if (!parsedValue || typeof parsedValue !== 'object') return {};
        if (parsedValue.screenZoom === 0.5) {
            parsedValue.screenZoom = 1;
            try {
                storage.setItem(STORAGE_KEY, JSON.stringify(parsedValue));
            } catch (_e) { /* ignore */ }
        }
        return parsedValue;
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

    const resolvedSfxVolume = Number.isFinite(settings.sfxVolume)
        ? clampSfxVolume(settings.sfxVolume)
        : DEFAULT_GAME_SETTINGS.sfxVolume;

    const resolvedScreenZoom = Number.isFinite(settings.screenZoom)
        ? clampScreenZoom(settings.screenZoom)
        : DEFAULT_GAME_SETTINGS.screenZoom;

    return {
        musicVolume: resolvedMusicVolume,
        musicEnabled: resolvedMusicVolume > 0,
        sfxVolume: resolvedSfxVolume,
        sfxEnabled: resolvedSfxVolume > 0,
        screenZoom: resolvedScreenZoom,
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

export function updateGameSettings(patch) {
    const currentSettings = getGameSettings();

    let nextMusicVolume = currentSettings.musicVolume;
    if (Object.prototype.hasOwnProperty.call(patch, 'musicVolume')) {
        nextMusicVolume = clampMusicVolume(patch.musicVolume);
    } else if (Object.prototype.hasOwnProperty.call(patch, 'musicEnabled')) {
        nextMusicVolume = patch.musicEnabled
            ? (currentSettings.musicVolume > 0 ? currentSettings.musicVolume : DEFAULT_GAME_SETTINGS.musicVolume)
            : 0;
    }

    let nextSfxVolume = currentSettings.sfxVolume;
    if (Object.prototype.hasOwnProperty.call(patch, 'sfxVolume')) {
        nextSfxVolume = clampSfxVolume(patch.sfxVolume);
    } else if (Object.prototype.hasOwnProperty.call(patch, 'sfxEnabled')) {
        nextSfxVolume = patch.sfxEnabled
            ? (currentSettings.sfxVolume > 0 ? currentSettings.sfxVolume : DEFAULT_GAME_SETTINGS.sfxVolume)
            : 0;
    }

    let nextScreenZoom = currentSettings.screenZoom;
    if (Object.prototype.hasOwnProperty.call(patch, 'screenZoom')) {
        nextScreenZoom = clampScreenZoom(patch.screenZoom);
    }

    const previousZoom = currentSettings.screenZoom;

    cachedSettings = normalizeSettings({
        ...currentSettings,
        ...patch,
        musicVolume: nextMusicVolume,
        sfxVolume: nextSfxVolume,
        screenZoom: nextScreenZoom,
    });

    writeStoredSettings({
        musicVolume: cachedSettings.musicVolume,
        sfxVolume: cachedSettings.sfxVolume,
        screenZoom: cachedSettings.screenZoom,
    });

    if (previousZoom !== cachedSettings.screenZoom) {
        zoomListeners.forEach((listener) => {
            try { listener(cachedSettings.screenZoom); } catch (_error) { /* noop */ }
        });
    }

    return normalizeSettings(cachedSettings);
}

export function getMusicVolume() {
    return getGameSettings().musicVolume;
}

export function setMusicVolume(value) {
    return updateGameSettings({ musicVolume: value });
}

export function getSfxVolume() {
    return getGameSettings().sfxVolume;
}

export function setSfxVolume(value) {
    return updateGameSettings({ sfxVolume: value });
}

export function getScreenZoom() {
    return getGameSettings().screenZoom;
}

export function setScreenZoom(value) {
    return updateGameSettings({ screenZoom: value });
}

export function onScreenZoomChange(listener) {
    if (typeof listener !== 'function') return () => {};
    zoomListeners.add(listener);
    return () => zoomListeners.delete(listener);
}

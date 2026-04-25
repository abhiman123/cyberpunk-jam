const STORAGE_KEY = 'cyberpunk-jam.uiPreferences';

const FONT_CHOICES = Object.freeze([
    'Courier New',
    'Consolas',
    'Lucida Console',
    'Segoe UI',
    'Verdana',
    'Trebuchet MS',
    'Tahoma',
    'Georgia',
    'Palatino Linotype',
    'Impact',
]);

const DEFAULT_PREFERENCES = Object.freeze({
    fontIndex: 0,
    language: 'en',
});

const TRANSLATIONS_ES = Object.freeze({
    'ACCEPT': 'ACEPTAR',
    'ACTION LOG': 'REGISTRO',
    'ACTUAL OUTPUT': 'SALIDA REAL',
    'AGAIN': 'OTRA VEZ',
    'ALL CLEAR': 'TODO BIEN',
    'ART': 'ARTE',
    'AWAITING NEXT UNIT.': 'ESPERANDO UNIDAD.',
    'AWAITING QUESTION INPUT': 'ESPERANDO RESPUESTA',
    'AWAITING UNIT CONNECTION.': 'ESPERANDO UNIDAD.',
    'BACK': 'ATRAS',
    'CALL COMPLETE': 'LLAMADA COMPLETA',
    'CHANNEL IDLE': 'CANAL INACTIVO',
    'CHECK': 'REVISAR',
    'CURRENT FONT': 'FUENTE ACTUAL',
    'CURRENT LANGUAGE': 'IDIOMA ACTUAL',
    'CLOSE PANEL': 'CERRAR PANEL',
    'CODE': 'CODIGO',
    'COMPLIANCE CHECK': 'REVISION DE CUMPLIMIENTO',
    'CREDITS': 'CREDITOS',
    'DEBUG': 'DEPURAR',
    'DAY': 'DIA',
    'ENGLISH': 'INGLES',
    'ERROR': 'ERROR',
    'EXPECTED OUTPUT': 'SALIDA ESPERADA',
    'FACTORY LINK': 'ENLACE DE FABRICA',
    'FEED': 'AVISOS',
    'FINAL GRADE': 'NOTA FINAL',
    'FINAL SCORE': 'PUNTAJE FINAL',
    'FLOW': 'FLUJO',
    'FROM THE MIND OF': 'DE LA MENTE DE',
    'GEAR': 'ENGRANE',
    'GEAR COVERS': 'CUBIERTAS',
    'GOOD LUCK, SHIFT ENDS AT 12.': 'SUERTE, EL TURNO TERMINA A LAS 12.',
    'GRID': 'RED',
    'HOW TO SOLVE': 'COMO RESOLVER',
    'INCOMING QUESTION': 'PREGUNTA ENTRANTE',
    'LANGUAGE': 'IDIOMA',
    'LEFT NOTE': 'NOTA IZQUIERDA',
    'LINE STANDBY': 'LINEA EN ESPERA',
    'MISTAKES': 'ERRORES',
    'MUSIC & SOUND': 'MUSICA Y SONIDO',
    'NET MONEY': 'DINERO NETO',
    'NO ALERTS': 'SIN ALERTAS',
    'NO TRANSMISSION. PROCESS THE UNIT COLD.': 'SIN TRANSMISION. PROCESA LA UNIDAD EN FRIO.',
    'NO UNIT LATCHED': 'SIN UNIDAD',
    'NOTIFICATION': 'NOTIFICACION',
    'NOTIFICATIONS': 'NOTIFICACIONES',
    'OPEN THE GRID AND DECIDE FROM THE FACTORY FLOOR': 'ABRE LA RED Y DECIDE DESDE EL PISO',
    'OVERVIEW': 'RESUMEN',
    'PATCH NOTES': 'NOTAS',
    'PHONE CALL COMING': 'LLAMADA ENTRANTE',
    'PHOTO': 'FOTO',
    'PLAY AGAIN': 'JUGAR DE NUEVO',
    'PRESS EITHER BUTTON': 'PULSA CUALQUIER BOTON',
    'PRESS': 'PULSA',
    'PRESS / OR X': 'PULSA / O X',
    'PROGRAMMING': 'PROGRAMACION',
    'QUALITY CONTROL': 'CONTROL DE CALIDAD',
    'REPAIR TEST': 'PRUEBA DE REPARACION',
    'RESPONSE LOGGED': 'RESPUESTA GUARDADA',
    'RIGHT EXAMPLE': 'EJEMPLO DERECHO',
    'RINSE AND REPEAT.': 'REPITE OTRA VEZ.',
    'RULEBOOK': 'REGLAS',
    'SCRAP': 'CHATARRA',
    'SCRAP EXAMPLE': 'EJEMPLO DE CHATARRA',
    'SCRAP RULES': 'REGLAS DE CHATARRA',
    'SCROLL': 'DESPLAZAR',
    'SETTINGS': 'AJUSTES',
    'SHIFT ENDS AT 12.': 'EL TURNO TERMINA A LAS 12.',
    'SHIFT READY': 'TURNO LISTO',
    'SKIP CREDITS': 'SALTAR CREDITOS',
    'SOLVE': 'RESOLVER',
    'SPANISH': 'ESPANOL',
    'SPECIAL THANKS': 'AGRADECIMIENTOS',
    'STORYBOARDING': 'GUION GRAFICO',
    'THANKS TO WAVEDASH AND GAMEDEV.JS FOR HOSTING THE GAMEJAM': 'GRACIAS A WAVEDASH Y GAMEDEV.JS POR ORGANIZAR LA GAMEJAM',
    'TOTAL MONEY LOST': 'DINERO PERDIDO',
    'TOTAL MONEY MADE': 'DINERO GANADO',
    'UNIT DOSSIER': 'EXPEDIENTE',
    'VOICE CONNECTED': 'VOZ CONECTADA',
    "YOU'RE JUST": 'SOLO ERES',
    'A MACHINE': 'UNA MAQUINA',
    'BEGIN SHIFT': 'EMPEZAR TURNO',
    'APPROVE THE COMPLIANT. SCRAP THE DEFECTIVE. REPAIR THE REDEEMABLE.': 'APRUEBA LO FUNCIONAL. CHATARRA LO DEFECTUOSO. REPARA LO SALVABLE.',
});

const PHRASE_REPLACEMENTS_ES = Object.freeze(
    Object.keys(TRANSLATIONS_ES)
        .sort((a, b) => b.length - a.length)
        .map((phrase) => [phrase, TRANSLATIONS_ES[phrase]])
);

let preferences = loadPreferences();
let originalSetText = null;
let translatingText = false;
let preferenceToastElement = null;
let preferenceToastHideTimer = null;

function loadPreferences() {
    if (typeof window === 'undefined') return { ...DEFAULT_PREFERENCES };

    try {
        const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
        const fontIndex = Number.isInteger(saved.fontIndex)
            ? ((saved.fontIndex % FONT_CHOICES.length) + FONT_CHOICES.length) % FONT_CHOICES.length
            : DEFAULT_PREFERENCES.fontIndex;
        const language = saved.language === 'es' ? 'es' : 'en';
        return { fontIndex, language };
    } catch (error) {
        return { ...DEFAULT_PREFERENCES };
    }
}

function savePreferences() {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
        // Private browsing and blocked storage should not stop the game.
    }
}

function normalizeText(value) {
    if (Array.isArray(value)) return value.join('\n');
    if (value === null || value === undefined) return '';
    return String(value);
}

function translateLineToSpanish(line) {
    const exact = TRANSLATIONS_ES[line.trim().toUpperCase()];
    if (exact) {
        return line.replace(line.trim(), exact);
    }

    let translated = line;
    PHRASE_REPLACEMENTS_ES.forEach(([english, spanish]) => {
        translated = translated.replace(new RegExp(escapeRegExp(english), 'gi'), spanish);
    });
    return translated;
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getUiLanguageLabel(language = preferences.language) {
    return language === 'es' ? 'ESPANOL' : 'ENGLISH';
}

function getUiPreferenceToastText() {
    const fontIndex = Math.max(0, Number(preferences.fontIndex || 0)) + 1;
    if (preferences.language === 'es') {
        return [
            `FUENTE ACTUAL // ${getUiFontFamily()} (${fontIndex}/${FONT_CHOICES.length})`,
            `IDIOMA ACTUAL // ${getUiLanguageLabel()}`,
            '1 = CAMBIAR FUENTE // 2 = CAMBIAR IDIOMA',
        ].join('\n');
    }

    return [
        `CURRENT FONT // ${getUiFontFamily()} (${fontIndex}/${FONT_CHOICES.length})`,
        `CURRENT LANGUAGE // ${getUiLanguageLabel()}`,
        '1 = NEXT FONT // 2 = TOGGLE LANGUAGE',
    ].join('\n');
}

function getUiPreferenceToastElement() {
    if (typeof document === 'undefined') return null;

    if (preferenceToastElement?.isConnected) {
        return preferenceToastElement;
    }

    const toast = document.createElement('div');
    toast.setAttribute('data-ui-preference-toast', 'true');
    Object.assign(toast.style, {
        position: 'fixed',
        top: '18px',
        right: '18px',
        zIndex: '9999',
        minWidth: '280px',
        maxWidth: '360px',
        padding: '10px 14px',
        border: '1px solid rgba(151, 226, 245, 0.55)',
        background: 'rgba(7, 17, 28, 0.92)',
        color: '#d9f6ff',
        boxShadow: '0 10px 26px rgba(0, 0, 0, 0.35)',
        whiteSpace: 'pre-line',
        lineHeight: '1.45',
        letterSpacing: '0.08em',
        fontSize: '13px',
        pointerEvents: 'none',
        opacity: '0',
        transform: 'translateY(-8px)',
        transition: 'opacity 180ms ease, transform 180ms ease',
    });

    document.body.appendChild(toast);
    preferenceToastElement = toast;
    return toast;
}

function showUiPreferenceToast() {
    const toast = getUiPreferenceToastElement();
    if (!toast) return;

    toast.textContent = getUiPreferenceToastText();
    toast.style.fontFamily = getUiFontFamily();
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    if (preferenceToastHideTimer) {
        window.clearTimeout(preferenceToastHideTimer);
    }
    preferenceToastHideTimer = window.setTimeout(() => {
        if (!preferenceToastElement) return;
        preferenceToastElement.style.opacity = '0';
        preferenceToastElement.style.transform = 'translateY(-8px)';
    }, 2600);
}

export function getUiFontFamily() {
    return FONT_CHOICES[preferences.fontIndex] || FONT_CHOICES[0];
}

export function getUiLanguage() {
    return preferences.language;
}

export function translateUiText(value) {
    const source = normalizeText(value);
    if (preferences.language !== 'es') return source;
    return source.split('\n').map(translateLineToSpanish).join('\n');
}

export function cycleUiFont() {
    preferences = {
        ...preferences,
        fontIndex: (preferences.fontIndex + 1) % FONT_CHOICES.length,
    };
    savePreferences();
    return getUiFontFamily();
}

export function toggleUiLanguage() {
    preferences = {
        ...preferences,
        language: preferences.language === 'es' ? 'en' : 'es',
    };
    savePreferences();
    return getUiLanguage();
}

export function patchPhaserTextPreferences(PhaserLib) {
    if (!PhaserLib?.GameObjects?.Text?.prototype || originalSetText) return;

    originalSetText = PhaserLib.GameObjects.Text.prototype.setText;
    PhaserLib.GameObjects.Text.prototype.setText = function (value) {
        const source = normalizeText(value);
        if (!translatingText) {
            this._uiPreferenceOriginalText = source;
        }

        return originalSetText.call(this, translateUiText(source));
    };
}

export function applyUiPreferencesToGame(game) {
    if (!game?.scene?.getScenes) return;

    const scenes = game.scene.getScenes(false);
    scenes.forEach((scene) => {
        scene?.children?.list?.forEach((child) => applyUiPreferencesToObject(child));
    });
}

export function installGlobalUiPreferenceShortcuts(game) {
    if (typeof window === 'undefined') return;

    const handleKeyDown = (event) => {
        if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;

        if (event.key === '1') {
            cycleUiFont();
            applyUiPreferencesToGame(game);
            showUiPreferenceToast();
            return;
        }

        if (event.key === '2') {
            toggleUiLanguage();
            applyUiPreferencesToGame(game);
            showUiPreferenceToast();
        }
    };

    window.addEventListener('keydown', handleKeyDown);
    game.events?.once?.('destroy', () => {
        window.removeEventListener('keydown', handleKeyDown);
    });

    window.setTimeout(() => {
        applyUiPreferencesToGame(game);
        showUiPreferenceToast();
    }, 0);
}

function applyUiPreferencesToObject(object) {
    if (!object) return;

    if (object.type === 'Text') {
        object.setStyle?.({ fontFamily: getUiFontFamily() });
        const source = object._uiPreferenceOriginalText ?? normalizeText(object.text);
        object._uiPreferenceOriginalText = source;
        if (originalSetText) {
            translatingText = true;
            originalSetText.call(object, translateUiText(source));
            translatingText = false;
        } else {
            object.setText?.(translateUiText(source));
        }
    }

    if (Array.isArray(object.list)) {
        object.list.forEach((child) => applyUiPreferencesToObject(child));
    }
}

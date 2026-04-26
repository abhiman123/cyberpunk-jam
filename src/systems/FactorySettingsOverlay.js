import {
    getGameSettings,
    setMusicVolume,
    setSfxVolume,
    setScreenZoom,
} from '../state/gameSettings.js';

const PANEL_WIDTH = 840;
const PANEL_HEIGHT = 540;
const PANEL_X = 220;
const PANEL_Y = 90;
const SLIDER_LEFT = 256;
const SLIDER_WIDTH = 376;
const SLIDER_THUMB_RADIUS = 14;
/** How much of the way toward the slider target each event applies to screen zoom (0–1). */
const ZOOM_IMPACT_DAMP = 0.1;

const SLIDER_DEFS = [
    {
        id: 'music',
        label: 'MUSIC',
        descriptionOn: 'Ambient tracks across the shift and report scenes.',
        descriptionOff: 'Ambient tracks silenced. Floor effects still stay live.',
        getValue: (settings) => settings.musicVolume ?? 0,
        setValue: (value) => setMusicVolume(value),
        min: 0,
        max: 1,
        callbackKey: 'onMusicChanged',
    },
    {
        id: 'sfx',
        label: 'SOUND EFFECTS',
        descriptionOn: 'Floor SFX, beeps, and minigame audio.',
        descriptionOff: 'Floor SFX muted. Music and voice still play.',
        getValue: (settings) => settings.sfxVolume ?? 0,
        setValue: (value) => setSfxVolume(value),
        min: 0,
        max: 1,
        callbackKey: 'onSfxChanged',
    },
    {
        id: 'zoom',
        label: 'SCREEN ZOOM',
        descriptionOn: 'Scales the rendered display window.',
        descriptionOff: 'Scales the rendered display window.',
        getValue: (settings) => settings.screenZoom ?? 1,
        setValue: (value) => setScreenZoom(value),
        min: 0.25,
        max: 1,
        callbackKey: 'onZoomChanged',
        formatValue: (value) => `${Math.round(value * 100)}%`,
    },
];

export default class FactorySettingsOverlay {
    constructor(scene, callbacks = {}) {
        this.scene = scene;
        this._callbacks = callbacks;
        this._sliderDragging = null; // id of slider being dragged, or null
        this._sliders = new Map();
        /** 0–1 track position for zoom while dragging (thumb follows pointer 1:1). */
        this._zoomTrackNorm = null;
        this._handleGlobalPointerMove = this._handleGlobalPointerMove.bind(this);
        this._handleGlobalPointerUp = this._handleGlobalPointerUp.bind(this);
        this.scene.input.on('pointermove', this._handleGlobalPointerMove);
        this.scene.input.on('pointerup', this._handleGlobalPointerUp);
        this.scene.input.on('gameout', this._handleGlobalPointerUp);

        this._build();
    }

    _build() {
        this._root = this.scene.add.container(0, 0).setDepth(420).setVisible(false).setAlpha(0);

        this._backdrop = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.72)
            .setInteractive({ useHandCursor: false });
        this._backdrop.on('pointerdown', () => {});

        this._panel = this.scene.add.container(PANEL_X, PANEL_Y).setScale(0.02, 1).setAlpha(0.95);

        const shell = this.scene.add.rectangle(0, 0, PANEL_WIDTH, PANEL_HEIGHT, 0x071019, 0.92)
            .setOrigin(0)
            .setStrokeStyle(2, 0x67f1ff, 0.92);
        const inner = this.scene.add.rectangle(16, 16, PANEL_WIDTH - 32, PANEL_HEIGHT - 32, 0x0d1f2b, 0.86)
            .setOrigin(0)
            .setStrokeStyle(1, 0x49bfd0, 0.5);
        const title = this.scene.add.text(34, 28, 'FACTORY SETTINGS', {
            fontFamily: 'Courier New', fontSize: '28px', color: '#b9f4ff', letterSpacing: 4,
        });
        const subtitle = this.scene.add.text(36, 72, 'SYSTEM PAUSED // ADJUST LIVE FLOOR PREFERENCES', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#6fc7dc', letterSpacing: 2,
        });

        const scan = this.scene.add.graphics();
        scan.fillStyle(0x9cecff, 0.06);
        for (let y = 24; y < PANEL_HEIGHT - 24; y += 12) {
            scan.fillRect(24, y, PANEL_WIDTH - 48, 4);
        }

        this._panel.add([shell, inner, scan, title, subtitle]);

        const sliderTopY = 124;
        const sliderRowHeight = 116;
        SLIDER_DEFS.forEach((def, index) => {
            const rowY = sliderTopY + index * sliderRowHeight;
            this._buildSliderRow(def, rowY);
        });

        const backButton = this.scene.add.rectangle(PANEL_WIDTH - 124, PANEL_HEIGHT - 58, 184, 48, 0x0f2635, 1)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x72e8f7, 0.92)
            .setInteractive({ useHandCursor: true });
        const backLabel = this.scene.add.text(PANEL_WIDTH - 124, PANEL_HEIGHT - 58, 'BACK TO SHIFT', {
            fontFamily: 'Courier New', fontSize: '17px', color: '#d7fdff', letterSpacing: 2,
        }).setOrigin(0.5);

        backButton.on('pointerover', () => backButton.setScale(1.04));
        backButton.on('pointerout', () => backButton.setScale(1));
        backButton.on('pointerdown', () => this.close());

        const footer = this.scene.add.text(36, PANEL_HEIGHT - 64, 'Close settings to resume the conveyor timer.', {
            fontFamily: 'Courier New', fontSize: '12px', color: '#75b5c1',
        });

        this._panel.add([backButton, backLabel, footer]);

        this._root.add([this._backdrop, this._panel]);
        this.refresh();
    }

    _buildSliderRow(def, rowY) {
        const sliderY = rowY + 50;
        const settingsBox = this.scene.add.rectangle(40, rowY - 14, PANEL_WIDTH - 80, 96, 0x071722, 0.82)
            .setOrigin(0)
            .setStrokeStyle(1, 0x50e4f2, 0.55);
        const label = this.scene.add.text(68, rowY + 12, def.label, {
            fontFamily: 'Courier New', fontSize: '22px', color: '#d6fbff', letterSpacing: 3,
        });
        const desc = this.scene.add.text(68, rowY + 44, def.descriptionOn, {
            fontFamily: 'Courier New', fontSize: '12px', color: '#7dc4d2',
        });

        const valueText = this.scene.add.text(720, rowY + 16, '100%', {
            fontFamily: 'Courier New', fontSize: '20px', color: '#eefcff', letterSpacing: 3,
        }).setOrigin(1, 0.5);

        const track = this.scene.add.rectangle(SLIDER_LEFT, sliderY, SLIDER_WIDTH, 12, 0x1f3540, 1)
            .setOrigin(0, 0.5)
            .setStrokeStyle(1, 0x70c8d8, 0.42);
        const fill = this.scene.add.rectangle(SLIDER_LEFT, sliderY, 0, 12, 0x63f1c5, 1)
            .setOrigin(0, 0.5);
        const glow = this.scene.add.rectangle(SLIDER_LEFT, sliderY, 0, 18, 0x8cfff5, 0.2)
            .setOrigin(0, 0.5);
        const thumbShadow = this.scene.add.circle(SLIDER_LEFT, sliderY + 3, SLIDER_THUMB_RADIUS, 0x000000, 0.26);
        const thumb = this.scene.add.circle(SLIDER_LEFT, sliderY, SLIDER_THUMB_RADIUS, 0xf4f0e3, 1)
            .setStrokeStyle(2, 0x14323e, 0.82);
        const thumbCore = this.scene.add.circle(SLIDER_LEFT, sliderY, 5, 0x173640, 1);

        const hitArea = this.scene.add.rectangle(
            SLIDER_LEFT - 12,
            sliderY,
            SLIDER_WIDTH + 24,
            48,
            0xffffff,
            0.001,
        ).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

        hitArea.on('pointerdown', (pointer) => {
            this._sliderDragging = def.id;
            this._setSliderHoverState(def.id, true);
            this._setValueFromPointer(def, pointer);
        });
        hitArea.on('pointerover', () => {
            if (this._sliderDragging) return;
            this._setSliderHoverState(def.id, true);
        });
        hitArea.on('pointerout', () => {
            if (this._sliderDragging === def.id) return;
            this._setSliderHoverState(def.id, false);
        });

        this._panel.add([
            settingsBox,
            label,
            desc,
            track,
            glow,
            fill,
            thumbShadow,
            thumb,
            thumbCore,
            valueText,
            hitArea,
        ]);

        this._sliders.set(def.id, {
            def,
            label,
            desc,
            valueText,
            track,
            fill,
            glow,
            thumb,
            thumbShadow,
            thumbCore,
            hitArea,
        });
    }

    refresh() {
        const settings = getGameSettings();
        this._sliders.forEach((slider) => {
            const { def } = slider;
            const rawValue = def.getValue(settings);
            const range = def.max - def.min;
            const fromSettings = range > 0 ? Math.max(0, Math.min(1, (rawValue - def.min) / range)) : 0;
            const zoomDragging = def.id === 'zoom' && this._sliderDragging === 'zoom' && this._zoomTrackNorm != null;
            // Zoom: thumb + fill follow the pointer (1:1 track); other sliders use the stored value.
            const normalized = zoomDragging ? this._zoomTrackNorm : fromSettings;
            const tintNorm = zoomDragging ? this._zoomTrackNorm : fromSettings;
            const fillWidth = SLIDER_WIDTH * normalized;
            const thumbX = SLIDER_LEFT + fillWidth;

            slider.fill.width = fillWidth;
            slider.glow.width = Math.max(fillWidth, normalized > 0 ? 16 : 0);
            slider.thumb.x = thumbX;
            slider.thumbShadow.x = thumbX;
            slider.thumbCore.x = thumbX;

            const formatted = def.formatValue
                ? def.formatValue(rawValue)
                : `${Math.round(rawValue * 100)}%`;
            slider.valueText.setText(formatted);

            const muted = (def.id === 'music' || def.id === 'sfx') && rawValue <= 0;
            const state = muted
                ? { color: 0x7f7878 }
                : tintNorm < 0.34
                    ? { color: 0x72daf0 }
                    : tintNorm < 0.67
                        ? { color: 0x6ce0d9 }
                        : { color: 0x63f1c5 };

            slider.fill.setFillStyle(state.color, muted ? 0.34 : 1);
            slider.glow.setFillStyle(state.color, muted ? 0.12 : 0.24);
            slider.desc.setText(muted ? def.descriptionOff : def.descriptionOn);
        });

        if (!this._sliderDragging) {
            this._sliders.forEach((_, id) => this._setSliderHoverState(id, false));
        }
    }

    open() {
        if (this._root.visible) return;

        this._zoomTrackNorm = null;
        this.refresh();
        this._callbacks.onOpen?.();

        this.scene.tweens.killTweensOf([this._root, this._panel]);

        this._root.setVisible(true).setAlpha(1);
        this._backdrop.setAlpha(0);
        this._panel.setScale(0.02, 1).setAlpha(0.95);

        this.scene.tweens.add({
            targets: this._backdrop,
            alpha: 0.72,
            duration: 190,
            ease: 'Quad.Out',
        });
        this.scene.tweens.add({
            targets: this._panel,
            scaleX: 1,
            duration: 240,
            ease: 'Cubic.Out',
        });

    }

    close(immediate = false) {
        if (!this._root.visible) return;

        this._sliderDragging = null;
        this._zoomTrackNorm = null;
        this._sliders.forEach((_, id) => this._setSliderHoverState(id, false));
        if (immediate) {
            this.scene.tweens.killTweensOf([this._backdrop, this._panel]);
            this._root.setVisible(false);
            this._backdrop.setAlpha(0);
            this._panel.setScale(0.02, 1);
            this._callbacks.onClose?.();
            return;
        }

        this.scene.tweens.killTweensOf([this._backdrop, this._panel]);


        this.scene.tweens.add({
            targets: this._backdrop,
            alpha: 0,
            duration: 180,
            ease: 'Quad.In',
        });
        this.scene.tweens.add({
            targets: this._panel,
            scaleX: 0.02,
            duration: 190,
            ease: 'Cubic.In',
            onComplete: () => {
                this._root.setVisible(false);
                this._callbacks.onClose?.();
            },
        });
    }

    isVisible() {
        return this._root.visible;
    }

    _handleGlobalPointerMove(pointer) {
        if (!this._sliderDragging || !this._root.visible) return;
        const slider = this._sliders.get(this._sliderDragging);
        if (!slider) return;
        this._setValueFromPointer(slider.def, pointer);
    }

    _handleGlobalPointerUp() {
        if (!this._sliderDragging) return;
        this._sliderDragging = null;
        this._zoomTrackNorm = null;
        this.refresh();
    }

    _setSliderHoverState(id, active) {
        const slider = this._sliders.get(id);
        if (!slider) return;
        slider.thumb.setScale(active ? 1.12 : 1);
        slider.thumbShadow.setScale(active ? 1.08 : 1);
        slider.track.setStrokeStyle(1, active ? 0xb8f3ff : 0x70c8d8, active ? 0.75 : 0.42);
    }

    _setValueFromPointer(def, pointer) {
        const localX = pointer.worldX - PANEL_X;
        const normalized = (localX - SLIDER_LEFT) / SLIDER_WIDTH;
        const clamped = Math.max(0, Math.min(1, normalized));
        if (def.id !== 'zoom') {
            this._zoomTrackNorm = null;
        }
        let value;
        if (def.id === 'zoom') {
            this._zoomTrackNorm = clamped;
            const range = def.max - def.min;
            const raw = def.min + clamped * range;
            const cur = getGameSettings().screenZoom;
            // Slider follows pointer 1:1; only the applied zoom nudges 10% toward the target each tick.
            value = cur + (raw - cur) * ZOOM_IMPACT_DAMP;
            value = Math.max(def.min, Math.min(def.max, value));
        } else {
            value = def.min + clamped * (def.max - def.min);
        }
        const settings = def.setValue(value);
        this.refresh();
        this._setSliderHoverState(def.id, true);
        if (def.callbackKey) {
            this._callbacks[def.callbackKey]?.(settings);
        }
    }

    destroy() {
        this.scene.input.off('pointermove', this._handleGlobalPointerMove);
        this.scene.input.off('pointerup', this._handleGlobalPointerUp);
        this.scene.input.off('gameout', this._handleGlobalPointerUp);
        this._root.destroy(true);
    }
}

import { getGameSettings, setMusicVolume } from '../state/gameSettings.js';

const PANEL_WIDTH = 840;
const PANEL_HEIGHT = 416;
const PANEL_X = 220;
const PANEL_Y = 146;
const MUSIC_SLIDER_X = 256;
const MUSIC_SLIDER_Y = 262;
const MUSIC_SLIDER_WIDTH = 376;

export default class FactorySettingsOverlay {
    constructor(scene, callbacks = {}) {
        this.scene = scene;
        this._callbacks = callbacks;
        this._sliderDragging = false;
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

        this._sweep = this.scene.add.rectangle(-48, PANEL_HEIGHT / 2, 52, PANEL_HEIGHT - 40, 0x8cf7ff, 0.16)
            .setOrigin(0, 0.5);

        const settingsBox = this.scene.add.rectangle(40, 126, PANEL_WIDTH - 80, 166, 0x071722, 0.82)
            .setOrigin(0)
            .setStrokeStyle(1, 0x50e4f2, 0.55);
        const musicLabel = this.scene.add.text(68, 166, 'MUSIC', {
            fontFamily: 'Courier New', fontSize: '24px', color: '#d6fbff', letterSpacing: 3,
        });
        this._musicDesc = this.scene.add.text(68, 206, 'Ambient tracks across the shift and report scenes.', {
            fontFamily: 'Courier New', fontSize: '13px', color: '#7dc4d2',
        });

        this._musicIconBars = [
            this.scene.add.rectangle(706, 274, 12, 24, 0x64e6e8, 1),
            this.scene.add.rectangle(730, 264, 12, 44, 0x64e6e8, 1),
            this.scene.add.rectangle(754, 252, 12, 68, 0x64e6e8, 1),
        ];

        this._musicSliderTrack = this.scene.add.rectangle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y, MUSIC_SLIDER_WIDTH, 12, 0x1f3540, 1)
            .setOrigin(0, 0.5)
            .setStrokeStyle(1, 0x70c8d8, 0.42);
        this._musicSliderFill = this.scene.add.rectangle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y, 0, 12, 0x63f1c5, 1)
            .setOrigin(0, 0.5);
        this._musicSliderGlow = this.scene.add.rectangle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y, 0, 18, 0x8cfff5, 0.2)
            .setOrigin(0, 0.5);
        this._musicSliderThumbShadow = this.scene.add.circle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y + 3, 14, 0x000000, 0.26);
        this._musicSliderThumb = this.scene.add.circle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y, 14, 0xf4f0e3, 1)
            .setStrokeStyle(2, 0x14323e, 0.82);
        this._musicSliderThumbCore = this.scene.add.circle(MUSIC_SLIDER_X, MUSIC_SLIDER_Y, 5, 0x173640, 1);
        this._musicValueText = this.scene.add.text(686, 226, '100%', {
            fontFamily: 'Courier New', fontSize: '22px', color: '#eefcff', letterSpacing: 3,
        }).setOrigin(1, 0.5);

        this._musicSliderHitArea = this.scene.add.rectangle(452, 260, 430, 60, 0xffffff, 0.001)
            .setInteractive({ useHandCursor: true });
        this._musicSliderHitArea.on('pointerdown', (pointer) => {
            this._sliderDragging = true;
            this._setSliderHoverState(true);
            this._setMusicVolumeFromPointer(pointer);
        });
        this._musicSliderHitArea.on('pointerover', () => {
            if (this._sliderDragging) return;
            this._setSliderHoverState(true);
        });
        this._musicSliderHitArea.on('pointerout', () => {
            if (this._sliderDragging) return;
            this._setSliderHoverState(false);
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

        this._panel.add([
            shell,
            inner,
            scan,
            this._sweep,
            title,
            subtitle,
            settingsBox,
            musicLabel,
            this._musicDesc,
            ...this._musicIconBars,
            this._musicSliderTrack,
            this._musicSliderGlow,
            this._musicSliderFill,
            this._musicSliderThumbShadow,
            this._musicSliderThumb,
            this._musicSliderThumbCore,
            this._musicValueText,
            this._musicSliderHitArea,
            backButton,
            backLabel,
            footer,
        ]);

        this._root.add([this._backdrop, this._panel]);
        this.refresh();
    }

    refresh() {
        const settings = getGameSettings();
        const musicVolume = Math.max(0, Math.min(1, settings.musicVolume ?? 1));
        const thumbX = MUSIC_SLIDER_X + (MUSIC_SLIDER_WIDTH * musicVolume);
        const state = musicVolume <= 0
            ? { bars: 0, color: 0x7f7878, text: '#9a8f8f' }
            : musicVolume < 0.34
                ? { bars: 1, color: 0x72daf0, text: '#cbf5ff' }
                : musicVolume < 0.67
                    ? { bars: 2, color: 0x6ce0d9, text: '#d7fff8' }
                    : { bars: 3, color: 0x63f1c5, text: '#effff9' };

        this._musicSliderFill.width = MUSIC_SLIDER_WIDTH * musicVolume;
        this._musicSliderGlow.width = Math.max(this._musicSliderFill.width, musicVolume > 0 ? 16 : 0);
        this._musicSliderThumb.x = thumbX;
        this._musicSliderThumbShadow.x = thumbX;
        this._musicSliderThumbCore.x = thumbX;
        this._musicValueText.setText(`${Math.round(musicVolume * 100)}%`);
        this._musicDesc.setText(
            musicVolume <= 0
                ? 'Ambient tracks silenced. Floor effects still stay live.'
                : 'Ambient tracks across the shift and report scenes.'
        );
        this._musicSliderFill.setFillStyle(state.color, musicVolume > 0 ? 1 : 0.34);
        this._musicSliderGlow.setFillStyle(state.color, musicVolume > 0 ? 0.24 : 0.12);

        this._musicIconBars.forEach((bar, index) => {
            const active = index < state.bars;
            bar.setFillStyle(active ? state.color : 0x34505d, active ? 1 : 0.24);
            bar.setStrokeStyle(active ? 1 : 0, 0xe9ffff, active ? 0.18 : 0);
        });

        if (!this._sliderDragging) {
            this._setSliderHoverState(false);
        }
    }

    open() {
        if (this._root.visible) return;

        this.refresh();
        this._callbacks.onOpen?.();

        this.scene.tweens.killTweensOf([this._root, this._panel, this._sweep]);

        this._root.setVisible(true).setAlpha(1);
        this._backdrop.setAlpha(0);
        this._panel.setScale(0.02, 1).setAlpha(0.95);
        this._sweep.x = -64;

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
        this.scene.tweens.add({
            targets: this._sweep,
            x: PANEL_WIDTH + 18,
            duration: 260,
            ease: 'Cubic.Out',
        });
    }

    close(immediate = false) {
        if (!this._root.visible) return;

        this._sliderDragging = false;
        this._setSliderHoverState(false);

        if (immediate) {
            this.scene.tweens.killTweensOf([this._backdrop, this._panel, this._sweep]);
            this._root.setVisible(false);
            this._backdrop.setAlpha(0);
            this._panel.setScale(0.02, 1);
            this._callbacks.onClose?.();
            return;
        }

        this.scene.tweens.killTweensOf([this._backdrop, this._panel, this._sweep]);
        this._sweep.x = PANEL_WIDTH + 18;

        this.scene.tweens.add({
            targets: this._sweep,
            x: -70,
            duration: 190,
            ease: 'Cubic.In',
        });
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
        this._setMusicVolumeFromPointer(pointer);
    }

    _handleGlobalPointerUp() {
        if (!this._sliderDragging) return;
        this._sliderDragging = false;
        this.refresh();
    }

    _setSliderHoverState(active) {
        this._musicSliderThumb.setScale(active ? 1.12 : 1);
        this._musicSliderThumbShadow.setScale(active ? 1.08 : 1);
        this._musicSliderTrack.setStrokeStyle(1, active ? 0xb8f3ff : 0x70c8d8, active ? 0.75 : 0.42);
    }

    _setMusicVolumeFromPointer(pointer) {
        const localX = pointer.worldX - PANEL_X;
        const normalized = (localX - MUSIC_SLIDER_X) / MUSIC_SLIDER_WIDTH;
        const musicVolume = Math.max(0, Math.min(1, normalized));
        const settings = setMusicVolume(musicVolume);
        this.refresh();
        this._setSliderHoverState(true);
        this._callbacks.onMusicChanged?.(settings);
    }

    destroy() {
        this.scene.input.off('pointermove', this._handleGlobalPointerMove);
        this.scene.input.off('pointerup', this._handleGlobalPointerUp);
        this.scene.input.off('gameout', this._handleGlobalPointerUp);
        this._root.destroy(true);
    }
}
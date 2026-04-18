import { getGameSettings, toggleMusicEnabled } from '../state/gameSettings.js';

const PANEL_WIDTH = 840;
const PANEL_HEIGHT = 416;
const PANEL_X = 220;
const PANEL_Y = 146;

export default class FactorySettingsOverlay {
    constructor(scene, callbacks = {}) {
        this.scene = scene;
        this._callbacks = callbacks;

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
            fontFamily: 'monospace', fontSize: '12px', color: '#6fc7dc', letterSpacing: 2,
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
        this._musicDesc = this.scene.add.text(68, 208, 'Ambient tracks across the shift and report scenes.', {
            fontFamily: 'monospace', fontSize: '13px', color: '#7dc4d2',
        });

        this._musicToggleBg = this.scene.add.rectangle(PANEL_WIDTH - 168, 209, 148, 58, 0x103142, 1)
            .setOrigin(0.5)
            .setStrokeStyle(2, 0x7defff, 0.92)
            .setInteractive({ useHandCursor: true });
        this._musicToggleText = this.scene.add.text(PANEL_WIDTH - 168, 209, 'ON', {
            fontFamily: 'Courier New', fontSize: '22px', color: '#e7fdff', letterSpacing: 6,
        }).setOrigin(0.5);

        this._musicToggleBg.on('pointerover', () => this._musicToggleBg.setScale(1.04));
        this._musicToggleBg.on('pointerout', () => this._musicToggleBg.setScale(1));
        this._musicToggleBg.on('pointerdown', () => {
            toggleMusicEnabled();
            this.refresh();
            this._callbacks.onMusicChanged?.(getGameSettings());
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
            fontFamily: 'monospace', fontSize: '12px', color: '#75b5c1',
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
            this._musicToggleBg,
            this._musicToggleText,
            backButton,
            backLabel,
            footer,
        ]);

        this._root.add([this._backdrop, this._panel]);
        this.refresh();
    }

    refresh() {
        const settings = getGameSettings();
        const musicEnabled = Boolean(settings.musicEnabled);

        this._musicToggleText.setText(musicEnabled ? 'ON' : 'OFF');
        this._musicToggleBg.setFillStyle(musicEnabled ? 0x0f5f56 : 0x412127, 1);
        this._musicToggleBg.setStrokeStyle(2, musicEnabled ? 0x9bf7d2 : 0xff9e9e, 0.92);
        this._musicToggleText.setColor(musicEnabled ? '#e8fff7' : '#ffe4e4');
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

    close() {
        if (!this._root.visible) return;

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

    destroy() {
        this._root.destroy(true);
    }
}
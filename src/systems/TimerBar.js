/**
 * TimerBar — a full-width draining bar at the top of the screen.
 * Emits 'timerExpired' on the scene when it runs out.
 * Color shifts: green → amber → red as it depletes.
 */
export default class TimerBar {
    /**
     * @param {Phaser.Scene} scene
     * @param {number} x
     * @param {number} y
     * @param {number} w       full width
     * @param {number} h       bar height
     * @param {number} duration seconds
     */
    constructor(scene, x, y, w, h, duration) {
        this.scene    = scene;
        this.x        = x;
        this.y        = y;
        this.w        = w;
        this.h        = h;
        this.duration = duration * 1000; // ms
        this.elapsed  = 0;
        this.running  = false;
        this._expired = false;
        this._pulseTween = null;

        // Background track
        this._track = scene.add.rectangle(x + w / 2, y + h / 2, w, h, 0x111111)
            .setStrokeStyle(1, 0x333333);

        // Bar fill (drawn as Graphics each frame)
        this._gfx = scene.add.graphics();

        // Depth above everything
        this._track.setDepth(10);
        this._gfx.setDepth(11);
    }

    start() {
        this.elapsed  = 0;
        this.running  = true;
        this._expired = false;
        if (this._pulseTween) { this._pulseTween.stop(); this._pulseTween = null; }
        this._gfx.setAlpha(1);
    }

    stop() {
        this.running = false;
        if (this._pulseTween) { this._pulseTween.stop(); this._pulseTween = null; }
    }

    /** Call from scene's update(). delta is ms since last frame. */
    update(delta) {
        if (!this.running || this._expired) return;

        this.elapsed += delta;
        const ratio = Math.max(0, 1 - this.elapsed / this.duration);

        this._draw(ratio);

        // Start pulsing below 30%
        if (ratio < 0.3 && !this._pulseTween) {
            this._pulseTween = this.scene.tweens.add({
                targets: this._gfx,
                alpha: 0.4,
                yoyo: true,
                repeat: -1,
                duration: 220,
            });
        }

        if (ratio <= 0) {
            this._expired = true;
            this.running  = false;
            this._draw(0);
            if (this._pulseTween) { this._pulseTween.stop(); this._pulseTween = null; }
            this._gfx.setAlpha(1);
            this.scene.events.emit('timerExpired');
        }
    }

    _draw(ratio) {
        const color = this._colorForRatio(ratio);
        this._gfx.clear();
        this._gfx.fillStyle(color, 1);
        this._gfx.fillRect(this.x, this.y, this.w * ratio, this.h);
    }

    _colorForRatio(ratio) {
        if (ratio > 0.5) return 0x00cc66;   // green
        if (ratio > 0.25) return 0xffaa00;  // amber
        return 0xff2200;                     // red
    }

    /** Returns 0.0–1.0 of time remaining. */
    getRatio() {
        return Math.max(0, 1 - this.elapsed / this.duration);
    }

    destroy() {
        this.stop();
        this._track.destroy();
        this._gfx.destroy();
    }
}

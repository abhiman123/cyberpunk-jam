import * as Phaser from 'phaser';
/**
 * Animations — shared animation helpers used across all scenes.
 *
 * All methods are static so they can be called without instantiation:
 *   Animations.slideInFromRight(scene, targets, { delay: 100 });
 */
export default class Animations {

    // ── Entrance ─────────────────────────────────────────────────────────────

    /**
     * Slide one or more objects in from the right.
     * Objects should already be positioned at their FINAL x before calling this.
     */
    static slideInFromRight(scene, targets, { delay = 0, duration = 340, distance = 420 } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        arr.forEach(t => { t.x += distance; t.setAlpha(0); });
        scene.tweens.add({
            targets: arr,
            x: `-=${distance}`,
            alpha: 1,
            duration,
            delay,
            ease: 'Cubic.Out',
        });
    }

    /**
     * Slide one or more objects in from the left.
     */
    static slideInFromLeft(scene, targets, { delay = 0, duration = 340, distance = 420 } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        arr.forEach(t => { t.x -= distance; t.setAlpha(0); });
        scene.tweens.add({
            targets: arr,
            x: `+=${distance}`,
            alpha: 1,
            duration,
            delay,
            ease: 'Cubic.Out',
        });
    }

    /**
     * Slide in from the bottom.
     */
    static slideInFromBottom(scene, targets, { delay = 0, duration = 300, distance = 80 } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        arr.forEach(t => { t.y += distance; t.setAlpha(0); });
        scene.tweens.add({
            targets: arr,
            y: `-=${distance}`,
            alpha: 1,
            duration,
            delay,
            ease: 'Cubic.Out',
        });
    }

    /**
     * Fade in.
     */
    static fadeIn(scene, targets, { delay = 0, duration = 300 } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        arr.forEach(t => t.setAlpha(0));
        scene.tweens.add({ targets: arr, alpha: 1, duration, delay });
    }

    // ── Exit ─────────────────────────────────────────────────────────────────

    /**
     * Slide out to the left then destroy.
     */
    static slideOutLeft(scene, targets, { delay = 0, duration = 280, distance = 500, destroy = false } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        scene.tweens.add({
            targets: arr,
            x: `-=${distance}`,
            alpha: 0,
            duration,
            delay,
            ease: 'Cubic.In',
            onComplete: () => { if (destroy) arr.forEach(t => t.destroy()); },
        });
    }

    // ── Button feedback ───────────────────────────────────────────────────────

    /**
     * Quick scale-punch feedback on a button press.
     */
    static buttonPunch(scene, target, { scale = 0.92, duration = 80 } = {}) {
        scene.tweens.add({
            targets: target,
            scaleX: scale,
            scaleY: scale,
            duration,
            yoyo: true,
            ease: 'Cubic.Out',
        });
    }

    /**
     * Horizontal shake — used for wrong-action feedback.
     */
    static shake(scene, targets, { intensity = 6, duration = 300 } = {}) {
        const arr = Array.isArray(targets) ? targets : [targets];
        const originX = arr.map(t => t.x);
        let elapsed = 0;
        const step = 16;
        const timer = scene.time.addEvent({
            delay: step,
            repeat: Math.floor(duration / step),
            callback: () => {
                elapsed += step;
                const progress = elapsed / duration;
                const amp = intensity * (1 - progress);
                arr.forEach((t, i) => {
                    t.x = originX[i] + (Math.random() - 0.5) * 2 * amp;
                });
                if (progress >= 1) {
                    arr.forEach((t, i) => { t.x = originX[i]; });
                    timer.remove();
                }
            },
        });
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /**
     * Typewriter reveal for a Phaser Text object.
     * @param {Phaser.Scene}      scene
     * @param {Phaser.GameObjects.Text} textObj
     * @param {string}            fullText
     * @param {number}            charDelay   ms per character
     * @param {Function}          onComplete  optional callback
     * @returns {Phaser.Time.TimerEvent}  — call .remove() to skip ahead
     */
    static typewriter(scene, textObj, fullText, charDelay = 38, onComplete = null) {
        let i = 0;
        textObj.setText('');
        const ev = scene.time.addEvent({
            delay: charDelay,
            repeat: fullText.length - 1,
            callback: () => {
                i++;
                textObj.setText(fullText.substring(0, i));
                if (i >= fullText.length && onComplete) onComplete();
            },
        });
        return ev;
    }

    /**
     * Glitch-flicker a text object — randomises alpha rapidly, then settles.
     */
    static glitchText(scene, textObj, { duration = 600, finalAlpha = 1 } = {}) {
            // Fix: Use performance.now() instead of scene.time.now
            const now = performance.now();
            const end = now + duration;
            
            const step = 40;
            const timer = scene.time.addEvent({
                delay: step,
                loop: true,
                callback: () => {
                    textObj.setAlpha(Math.random() > 0.4 ? 1 : 0.1);
                    
                    // Fix: Check against performance.now()
                    if (performance.now() >= end) {
                        timer.remove();
                        textObj.setAlpha(finalAlpha);
                    }
                },
            });
            return timer;
    }

    // ── Scanline wipe ─────────────────────────────────────────────────────────

    /**
     * Horizontal scanline wipe reveal — a rectangle sweeps down, revealing content.
     * Creates and auto-destroys the wipe rect.
     */
    static scanlineWipe(scene, { color = 0x00ffcc, alpha = 0.12, duration = 400, delay = 0 } = {}) {
        const wipe = scene.add.rectangle(640, -10, 1280, 20, color, alpha).setDepth(99);
        scene.tweens.add({
            targets: wipe,
            y: 730,
            duration,
            delay,
            ease: 'Linear',
            onComplete: () => wipe.destroy(),
        });
    }

    // ── Conveyor entrance ─────────────────────────────────────────────────────

    /**
     * Animate a case panel sliding in from the right (conveyor arrival).
     * @param {Phaser.Scene}  scene
     * @param {object[]}      objects   array of GameObjects that make up the case
     * @param {number}        finalX    the x position they should end up at
     * @param {Function}      onArrived callback when animation completes
     */
    static conveyorArrive(scene, objects, finalX, onArrived = null) {
        const offscreen = 900;
        objects.forEach(obj => {
            obj.x += offscreen;
            obj.setAlpha(0.6);
        });
        scene.tweens.add({
            targets: objects,
            x: `-=${offscreen}`,
            alpha: 1,
            duration: 420,
            ease: 'Cubic.Out',
            onComplete: () => {
                if (onArrived) onArrived();
            },
        });
        // Belt flash on arrival
        const flash = scene.add.rectangle(finalX, 360, 6, 720, 0x00ffcc, 0.25).setDepth(98);
        scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 300,
            onComplete: () => flash.destroy(),
        });
    }

    /**
     * Animate a case panel sliding off to the left (conveyor exit).
     * Objects are destroyed after animation.
     */
    static conveyorDepart(scene, objects, onDone = null) {
        scene.tweens.add({
            targets: objects,
            x: `-=700`,
            alpha: 0,
            duration: 320,
            ease: 'Cubic.In',
            onComplete: () => {
                objects.forEach(o => o.destroy());
                if (onDone) onDone();
            },
        });
    }

    // ── Lights out (End scene) ────────────────────────────────────────────────

    /**
     * Flicker an array of light rects off one by one, left-to-right.
     */
    static lightsOut(scene, lights, { startDelay = 0, spacing = 150 } = {}) {
        lights.forEach((light, i) => {
            scene.time.delayedCall(startDelay + i * spacing, () => {
                scene.tweens.add({
                    targets: light,
                    alpha: 0,
                    duration: 180,
                    yoyo: false,
                    onStart: () => {
                        // brief flicker before going out
                        let flickers = 3;
                        const flick = () => {
                            if (flickers-- <= 0) return;
                            light.setAlpha(light.alpha > 0.1 ? 0.05 : 0.8);
                            scene.time.delayedCall(50, flick);
                        };
                        flick();
                    },
                });
            });
        });
    }

    // ── Panel border pulse ────────────────────────────────────────────────────

    /**
     * Pulse the stroke of a rectangle briefly — used for correct/incorrect feedback.
     * @param {Phaser.Scene}                  scene
     * @param {Phaser.GameObjects.Rectangle}  rect
     * @param {number}                        color   hex color
     */
    static borderPulse(scene, rect, color = 0x00ffcc, { duration = 500 } = {}) {
        rect.setStrokeStyle(2, color);
        scene.time.delayedCall(duration, () => {
            rect.setStrokeStyle(1, 0x222222);
        });
    }

    // ── Notification pop ─────────────────────────────────────────────────────

    /**
     * Floating notification that fades up and out.
     */
    static notify(scene, text, x, y, { color = '#00ffcc', duration = 2200, depth = 40 } = {}) {
        const t = scene.add.text(x, y, text, {
            fontFamily: 'monospace',
            fontSize: '14px',
            color,
            backgroundColor: '#000000bb',
            padding: { x: 8, y: 4 },
            stroke: '#000000',
            strokeThickness: 3,
        }).setOrigin(0.5).setDepth(depth).setAlpha(0);

        scene.tweens.add({
            targets: t,
            alpha: 1,
            y: y - 10,
            duration: 250,
            onComplete: () => {
                scene.tweens.add({
                    targets: t,
                    alpha: 0,
                    y: y - 40,
                    duration: 400,
                    delay: duration - 650,
                    onComplete: () => t.destroy(),
                });
            },
        });

        return t;
    }
}

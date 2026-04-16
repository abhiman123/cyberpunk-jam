import * as Phaser from 'phaser';

/**
 * Phaser 4 camera look: two cheap external passes (color matrix + vignette).
 * Avoids custom full-screen fragment shaders; tune here for the whole game.
 */
export function stampCyberColorMatrix(cm) {
    cm.reset();
    cm.hue(-18, false);
    cm.saturate(0.30, true);
    cm.contrast(0.15, true);
    cm.brightness(1.08, true);
}

/**
 * @param {Phaser.Scene} scene
 * @returns {{ cmFilter: Phaser.Filters.ColorMatrix|null, vignette: Phaser.Filters.Vignette|null }}
 */
export function applyCyberpunkLook(scene) {
    const cam = scene.cameras.main;
    if (!cam.filters?.external) {
        return { cmFilter: null, vignette: null };
    }

    cam.filters.external.clear();

    const cmFilter = cam.filters.external.addColorMatrix();
    stampCyberColorMatrix(cmFilter.colorMatrix);

    const vignette = cam.filters.external.addVignette(
        0.5,
        0.5,
        0.80,
        0.09,
        0x0a1330,
        Phaser.BlendModes.MULTIPLY
    );

    return { cmFilter, vignette };
}

/**
 * Replaces legacy pipeline "aberration" burst for mistake feedback.
 * @param {Phaser.Scene} scene
 * @param {Phaser.Filters.ColorMatrix|null} cmFilter
 */
export function glitchBurst(scene, cmFilter, duration = 380) {
    if (!cmFilter?.colorMatrix) return;
    const cm = cmFilter.colorMatrix;

    scene.tweens.addCounter({
        from: 0,
        to: 1,
        duration,
        ease: 'Cubic.Out',
        onUpdate: (tw) => {
            const w = tw.getValue();
            const spike = Math.sin(w * Math.PI);
            cm.reset();
            stampCyberColorMatrix(cm);
            cm.hue(spike * 70, true);
            cm.contrast(spike * 0.45, true);
            cm.saturate(spike * 0.4, true);
        },
        onComplete: () => {
            stampCyberColorMatrix(cm);
        },
    });
}

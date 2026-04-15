/**
 * Plays 'manager_voice' with seamless loop points and a layered pitch
 * to smooth out the loop and add texture.
 *
 * Uses the Web Audio API directly so we can set loopStart/loopEnd on the
 * underlying AudioBufferSourceNode — Phaser 4 doesn't expose those on its
 * own sound objects.
 *
 * @param {Phaser.Scene} scene
 * @param {number} [volume=0.65]
 * @returns {{ stop: () => void }}
 */
export function playManagerVoice(scene, volume = 0.65) {
    const ctx    = scene.sound.context;
    const buffer = scene.cache.audio.get('manager_voice');

    if (!ctx || !buffer) return { stop: () => {} };

    // Trim silence: active audio lives between these timestamps (seconds)
    const LOOP_START = 0.006;
    const LOOP_END   = 0.1547;

    // Single gain node for both sources — halved to avoid clipping from summing
    const gain = ctx.createGain();
    gain.gain.value = volume * 0.5;
    gain.connect(ctx.destination);

    function makeSource(detuneCents) {
        const src = ctx.createBufferSource();
        src.buffer       = buffer;
        src.loop         = true;
        src.loopStart    = LOOP_START;
        src.loopEnd      = LOOP_END;
        src.detune.value = detuneCents;
        src.connect(gain);
        src.start(0, LOOP_START);
        return src;
    }

    // Layer 1: original pitch
    // Layer 2: ~1.2 semitones lower — subtle beating gives it a richer,
    //          more "continuous speech" texture rather than an obvious loop
    const s1 = makeSource(0);
    const s2 = makeSource(-120);

    return {
        stop() {
            try { s1.stop(); } catch (_) {}
            try { s2.stop(); } catch (_) {}
            gain.disconnect();
        },
    };
}

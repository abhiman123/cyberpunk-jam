/**
 * Plays 'manager_voice' with seamless crossfade looping and a layered pitch.
 *
 * The source file is very short (~208 ms), so we can't rely on native
 * AudioBufferSourceNode looping — the waveform discontinuity at the seam
 * produces an audible click/stutter.
 *
 * Instead we use two techniques:
 *
 *  1. Lookahead crossfade scheduler — continuously overlap buffer copies with
 *     short linear fade-in / fade-out envelopes so the seam is inaudible.
 *
 *  2. Synthetic convolution reverb — a brief exponential-decay noise impulse
 *     smears the tail of each copy into the next, masking the repetition and
 *     adding warmth.
 *
 * @param {Phaser.Scene} scene
 * @param {number} [volume=0.65]
 * @returns {{ stop: () => void }}
 */
export function playManagerVoice(scene, volume = 0.65) {
    const ctx    = scene.sound.context;
    const buffer = scene.cache.audio.get('manager_voice');

    if (!ctx || !buffer) return { stop: () => {} };

    const duration   = buffer.duration;                    // full clip length (s)
    const fadeTime   = Math.min(0.04, duration * 0.18);   // crossfade window — 40 ms max
    const loopPeriod = duration - fadeTime;                // gap between successive starts
    const lookAhead  = 0.25;                               // schedule this far ahead (s)
    const tickMs     = 80;                                 // scheduler poll interval (ms)

    // ── Master gain ──────────────────────────────────────────────────────────
    const masterGain = ctx.createGain();
    masterGain.gain.value = volume * 0.5; // ×0.5 because two summed layers

    // ── Synthetic reverb ─────────────────────────────────────────────────────
    // A 350 ms exponential-decay noise impulse smears the loop seam and adds
    // a subtle room feel without requiring an impulse-response file.
    const convolver = ctx.createConvolver();
    const irLen     = Math.floor(ctx.sampleRate * 0.35);
    const ir        = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < irLen; i++) {
            d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 3);
        }
    }
    convolver.buffer = ir;

    // Dry / wet mix
    const dryGain = ctx.createGain(); dryGain.gain.value = 0.65;
    const wetGain = ctx.createGain(); wetGain.gain.value = 0.35;

    masterGain.connect(dryGain);    dryGain.connect(ctx.destination);
    masterGain.connect(convolver);  convolver.connect(wetGain);  wetGain.connect(ctx.destination);

    // ── Lookahead scheduler ──────────────────────────────────────────────────
    let stopped = false;

    // Two layers interleaved half a period apart:
    //   - layer 0: original pitch, starts immediately
    //   - layer 1: 1.2 semitones lower (−120 cents), offset by loopPeriod/2
    // The offset means the layers alternate, filling the sonic space and
    // further disguising the fact that the same short clip repeats.
    const layers = [
        { detune:    0, nextStart: ctx.currentTime },
        { detune: -120, nextStart: ctx.currentTime + loopPeriod * 0.5 },
    ];

    function scheduleSource(detune, startAt) {
        const src = ctx.createBufferSource();
        src.buffer       = buffer;
        src.detune.value = detune;

        const env = ctx.createGain();
        // Fade in
        env.gain.setValueAtTime(0, startAt);
        env.gain.linearRampToValueAtTime(1, startAt + fadeTime);
        // Fade out
        env.gain.setValueAtTime(1, startAt + duration - fadeTime);
        env.gain.linearRampToValueAtTime(0, startAt + duration);

        src.connect(env);
        env.connect(masterGain);

        src.start(startAt);
        src.stop(startAt + duration + 0.01); // tiny buffer past the fade

        src.onended = () => { try { env.disconnect(); } catch (_) {} };
    }

    function tick() {
        if (stopped) return;
        const horizon = ctx.currentTime + lookAhead;
        for (const layer of layers) {
            while (layer.nextStart < horizon) {
                scheduleSource(layer.detune, Math.max(layer.nextStart, ctx.currentTime));
                layer.nextStart += loopPeriod;
            }
        }
    }

    tick(); // prime the pump — schedule the first copies immediately
    const intervalId = setInterval(tick, tickMs);

    return {
        stop() {
            stopped = true;
            clearInterval(intervalId);
            // Disconnect the output graph; in-flight sources will decay naturally
            try { masterGain.disconnect(); } catch (_) {}
            try { convolver.disconnect(); }  catch (_) {}
            try { dryGain.disconnect(); }    catch (_) {}
            try { wetGain.disconnect(); }    catch (_) {}
        },
    };
}

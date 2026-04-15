import * as Phaser from 'phaser';
/**
 * CyberpunkPipeline — Phaser 3 WebGL post-processing pipeline.
 *
 * Effects:
 *   • Scanlines          — horizontal dark bands, CRT style
 *   • Chromatic aberration — RGB channel offset (fringe on edges)
 *   • Vignette           — darkened corners
 *   • CRT flicker        — subtle random brightness pulse
 *   • Phosphor bleed     — faint cyan horizontal glow bleed
 *
 * Usage:
 *   // In Boot.js create():
 *   this.game.renderer.pipelines.addPostPipeline('Cyberpunk', CyberpunkPipeline);
 *
 *   // In any scene's create():
 *   this.cameras.main.setPostPipeline('Cyberpunk');
 *   // Optionally grab the instance to animate uniforms:
 *   const pipe = this.cameras.main.getPostPipeline('Cyberpunk');
 *   pipe.aberrationStrength = 0.004;
 */

const BasePipeline = Phaser.Renderer?.WebGL?.Pipelines?.PostFXPipeline || 
                     Phaser.Pipelines?.PostFXPipeline || 
                     class {};

export default class CyberpunkPipeline extends BasePipeline {
    constructor(game) {
        super({
            game,
            name: 'Cyberpunk',
            fragShader: `
                precision mediump float;

                uniform sampler2D uMainSampler;
                uniform vec2      uResolution;
                uniform float     uTime;
                uniform float     uAberration;   // chromatic aberration strength (0.0–0.01)
                uniform float     uScanlineAmt;  // scanline darkness  (0.0–1.0)
                uniform float     uVignetteAmt;  // vignette darkness  (0.0–1.0)
                uniform float     uFlicker;      // flicker amount     (0.0–1.0)
                uniform float     uBleed;        // phosphor bleed     (0.0–1.0)

                varying vec2 outTexCoord;

                // ── Helpers ──────────────────────────────────────────────────

                float rand(float seed) {
                    return fract(sin(seed * 127.1 + 311.7) * 43758.5453);
                }

                // Soft scanline — returns darkness factor for this pixel row
                float scanline(float y) {
                    float line = floor(y * uResolution.y);
                    return 1.0 - uScanlineAmt * pow(sin(line * 3.14159265), 2.0) * 0.5;
                }

                // Vignette — darkens toward corners
                float vignette(vec2 uv) {
                    vec2 d = abs(uv - 0.5) * 2.0;
                    float v = 1.0 - dot(d, d) * 0.4;
                    return mix(1.0, v, uVignetteAmt);
                }

                // Chromatic aberration — sample R/G/B at slightly offset UVs
                vec3 aberration(vec2 uv) {
                    vec2 dir = (uv - 0.5);
                    float r = texture2D(uMainSampler, uv + dir * uAberration          ).r;
                    float g = texture2D(uMainSampler, uv                               ).g;
                    float b = texture2D(uMainSampler, uv - dir * uAberration          ).b;
                    return vec3(r, g, b);
                }

                // Phosphor bleed — add faint cyan smear from bright pixels
                vec3 bleed(vec2 uv, vec3 col) {
                    if (uBleed < 0.001) return col;
                    float offset = 2.0 / uResolution.x;
                    vec3 left  = texture2D(uMainSampler, uv - vec2(offset, 0.0)).rgb;
                    vec3 right = texture2D(uMainSampler, uv + vec2(offset, 0.0)).rgb;
                    vec3 smear = (left + right) * 0.5;
                    // bias toward cyan channel
                    smear = vec3(smear.r * 0.5, smear.g, smear.b);
                    return mix(col, smear, uBleed * 0.18);
                }

                void main() {
                    vec2 uv = outTexCoord;

                    // Subtle CRT warp (barrel distortion, very mild)
                    vec2 warpUV = uv - 0.5;
                    float dist = dot(warpUV, warpUV);
                    warpUV *= 1.0 + dist * 0.018;
                    warpUV += 0.5;

                    // Out-of-bounds after warp → black border
                    if (warpUV.x < 0.0 || warpUV.x > 1.0 || warpUV.y < 0.0 || warpUV.y > 1.0) {
                        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
                        return;
                    }

                    // Chromatic aberration
                    vec3 col = aberration(warpUV);

                    // Phosphor bleed
                    col = bleed(warpUV, col);

                    // Scanlines
                    col *= scanline(warpUV.y);

                    // Vignette
                    col *= vignette(warpUV);

                    // CRT flicker — random per-frame brightness variation
                    float flicker = 1.0 - uFlicker * rand(floor(uTime * 24.0)) * 0.04;
                    col *= flicker;

                    // Very slight green-cyan tint to push it toward a cold terminal look
                    col.r *= 0.96;
                    col.b *= 1.02;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
        });

        // Configurable properties — tweak these per scene
        this.aberrationStrength = 0.003;
        this.scanlineAmount     = 0.55;
        this.vignetteAmount     = 0.65;
        this.flickerAmount      = 0.6;
        this.bleedAmount        = 0.5;

        this._time = 0;
    }

    onPreRender() {
        this._time += 0.016;
        this.set1f('uTime',        this._time);
        this.set1f('uAberration',  this.aberrationStrength);
        this.set1f('uScanlineAmt', this.scanlineAmount);
        this.set1f('uVignetteAmt', this.vignetteAmount);
        this.set1f('uFlicker',     this.flickerAmount);
        this.set1f('uBleed',       this.bleedAmount);
        this.set2f('uResolution',  this.renderer.width, this.renderer.height);
    }

    /**
     * Animate the aberration strength — useful for mistake flash effect.
     * @param {Phaser.Scene} scene  — needed for tween
     * @param {number} peak         — peak strength (e.g. 0.015)
     * @param {number} duration     — ms
     */
    aberrationBurst(scene, peak = 0.015, duration = 350) {
        const start = this.aberrationStrength;
        scene.tweens.addCounter({
            from: 0,
            to: 1,
            duration,
            ease: 'Cubic.Out',
            onUpdate: (tween) => {
                const t = tween.getValue();
                // spike up then decay
                this.aberrationStrength = start + peak * Math.sin(t * Math.PI);
            },
            onComplete: () => {
                this.aberrationStrength = start;
            },
        });
    }
}

/**
 * The `bubble` theme: the same fourteen cues, made of water. Playful and
 * opt-in: an app switches to it with `setTheme`, or uses it for one moment with
 * `play()`'s `theme` option or `data-cuelume-theme`.
 *
 * Every cue is its own gesture rather than one bloop at different pitches: a
 * knock for tap and type, a drip for select, a cork for toggle, a balloon for
 * open, a gulp for close, and so on. The only theme whose tones slide. Nothing
 * is centred above 5 kHz, contours match the other themes (success rises,
 * error falls, warning stays level, attention rises), and levels match the
 * default palette on the loudest 30 ms.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out, and each cue has a layer only strong
 * plays.
 */

import { COUNT_LANDS, countTicks, knock, type NoiseLayer, type SoundName, type SoundRecipe, type ToneLayer } from "./recipes.js";

/** A sine that slides from `from` to `to` Hz in `time` seconds. */
const slide = (from: number, to: number, time: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer => ({
  kind: "tone", waveform: "sine", frequency: from, glideTo: to, glideTime: time, attack: 0.002, decay, peak, ...more,
});

/** A bubble surfacing: a sine that rises by half in 40 ms. */
const bloop = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer =>
  slide(frequency, frequency * 1.5, 0.04, decay, peak, more);

/** A drop falling from a tap: a quick flick upward, done in 12 ms. */
const drip = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer =>
  slide(frequency, frequency * 1.5, 0.012, decay, peak, { attack: 0.001, ...more });

/** A struck note that settles a third down onto its pitch, like a kalimba tine. */
const pluck = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer =>
  slide(frequency * 1.3, frequency, 0.012, decay, peak, { attack: 0.001, ...more });

/** A bubble bursting: 3 ms of low-passed noise. */
const pop = (filterFrequency: number, peak: number, more: Partial<NoiseLayer> = {}): NoiseLayer => ({
  kind: "noise", filterType: "lowpass", filterFrequency, filterQ: 0.9, attack: 0.001, decay: 0.003, peak, ...more,
});

/** Input and surface cues: no two plays match. */
const LIVELY = { pitch: 0.06, level: 0.1 };
/** Outcome and progress cues vary in level only, so a rise stays a rise and a level note stays level. */
const STEADY = { pitch: 0, level: 0.08 };
const ROOM = { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 };

export const BUBBLE = {
  /** A keycap landing on water: a soft knock, then a small bubble. A little different every time. */
  tap: {
    masterGain: 0.38,
    layers: [
      knock(300, 0.02, 0.06),
      bloop(600, 0.035, 0.014, { offset: 0.012 }),
      knock(600, 0.012, 0.015, { from: "normal" }),
      knock(150, 0.035, 0.05, { from: "strong" }),
    ],
    vary: { pitch: 0.08, level: 0.1 },
  },
  /** A keycap popping up: a higher, shorter knock, pitched differently every stroke. */
  type: {
    masterGain: 0.3,
    layers: [
      knock(415, 0.014, 0.06),
      pop(2500, 0.03, { from: "normal" }),
      knock(208, 0.025, 0.05, { from: "strong" }),
    ],
    vary: { pitch: 0.1, level: 0.2 },
  },
  /** A drip: the only quick flick upward. A later option drips higher, an earlier one lower. */
  select: {
    masterGain: 0.3,
    layers: [
      drip(700, 0.025, 0.05),
      pop(3000, 0.025, { from: "normal" }),
      bloop(350, 0.05, 0.03, { from: "strong" }),
    ],
    vary: { pitch: 0.03, level: 0.1 },
  },
  /** A cork: a soft thup, then the air rushing up an octave. Switching off sinks it. */
  toggle: {
    masterGain: 0.18,
    layers: [
      { kind: "noise", filterType: "lowpass", filterFrequency: 900, filterQ: 0.9, attack: 0.001, decay: 0.008, peak: 0.12 },
      slide(330, 660, 0.06, 0.07, 0.045, { attack: 0.003 }),
      slide(990, 1485, 0.02, 0.02, 0.01, { from: "normal", offset: 0.03 }),
      slide(165, 330, 0.06, 0.08, 0.03, { from: "strong" }),
    ],
    vary: { pitch: 0.04, level: 0.1 },
  },
  /** A balloon filling: a slow swell that rises a ninth, and a tiny pop at the top. */
  open: {
    masterGain: 0.29,
    layers: [
      slide(220, 520, 0.14, 0.06, 0.04, { attack: 0.1 }),
      slide(330, 780, 0.14, 0.06, 0.012, { from: "normal", attack: 0.1 }),
      pop(2200, 0.05, { from: "normal", offset: 0.14 }),
      slide(110, 260, 0.14, 0.08, 0.03, { from: "strong", attack: 0.1 }),
    ],
    vary: LIVELY,
  },
  /** A gulp: a fast fall, swallowed by a low plop. */
  close: {
    masterGain: 0.31,
    layers: [
      slide(700, 220, 0.07, 0.08, 0.045, { attack: 0.004 }),
      knock(180, 0.03, 0.05, { offset: 0.07 }),
      pop(1200, 0.06, { from: "normal", offset: 0.07 }),
      knock(90, 0.045, 0.05, { from: "strong", offset: 0.07 }),
    ],
    vary: LIVELY,
  },
  /** Three plucked notes rising C–E–G, like a kalimba, in a small room. */
  success: {
    masterGain: 0.59,
    layers: [
      pluck(523.25, 0.12, 0.035),
      pluck(659.25, 0.14, 0.035, { offset: 0.07 }),
      pluck(783.99, 0.22, 0.035, { offset: 0.14 }),
      pluck(1046.5, 0.03, 0.008, { from: "normal" }),
      pluck(1318.51, 0.03, 0.008, { from: "normal", offset: 0.07 }),
      pluck(1567.98, 0.04, 0.008, { from: "normal", offset: 0.14 }),
      bloop(261.63, 0.25, 0.02, { from: "strong", offset: 0.14 }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** "Uh-oh": a note that lifts, then a lower one that sags. */
  error: {
    masterGain: 0.44,
    layers: [
      slide(349.23, 370, 0.05, 0.1, 0.045, { attack: 0.004 }),
      slide(293.66, 246.94, 0.16, 0.17, 0.045, { attack: 0.004, offset: 0.14 }),
      pop(900, 0.04, { from: "normal" }),
      pop(900, 0.04, { from: "normal", offset: 0.14 }),
      knock(147, 0.05, 0.05, { from: "strong", offset: 0.14 }),
    ],
    vary: STEADY,
  },
  /** A zip: one bubble shooting up through fizz. Going back, it dives. */
  navigate: {
    masterGain: 0.47,
    layers: [
      slide(300, 1500, 0.09, 0.08, 0.035, { attack: 0.01 }),
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1500, glideTo: 3000, glideTime: 0.09, filterQ: 1, attack: 0.02, decay: 0.07, peak: 0.05 },
      slide(150, 600, 0.1, 0.1, 0.025, { from: "strong", attack: 0.01 }),
    ],
    vary: LIVELY,
  },
  /** "Doink, doink": one wobbly note twice, settling onto the same pitch. */
  warning: {
    masterGain: 0.54,
    layers: [
      slide(492.8, 440, 0.05, 0.11, 0.045),
      slide(492.8, 440, 0.05, 0.13, 0.04, { offset: 0.13 }),
      pop(1800, 0.03, { from: "normal" }),
      pop(1800, 0.03, { from: "normal", offset: 0.13 }),
      { from: "strong", kind: "tone", waveform: "sine", frequency: 220, offset: 0.13, attack: 0.003, decay: 0.15, peak: 0.025 },
    ],
    vary: STEADY,
  },
  /** A simmer: scattered tiny bubbles over fizz that swells. Nothing lands. */
  loading: {
    masterGain: 0.53,
    layers: [
      { kind: "noise", filterType: "lowpass", filterFrequency: 1400, filterQ: 0.7, attack: 0.12, decay: 0.16, peak: 0.08 },
      drip(1100, 0.012, 0.01, { offset: 0.03 }),
      drip(1480, 0.012, 0.008, { from: "normal", offset: 0.075 }),
      drip(1250, 0.012, 0.01, { offset: 0.11 }),
      drip(1660, 0.012, 0.008, { from: "normal", offset: 0.16 }),
      drip(1320, 0.012, 0.01, { offset: 0.2 }),
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 400, filterQ: 0.7, attack: 0.1, decay: 0.2, peak: 0.1 },
    ],
    vary: STEADY,
  },
  /** A drop into water: a high plip, and the round bubble it leaves surfacing, in a small room. */
  ready: {
    masterGain: 0.49,
    layers: [
      slide(1400, 700, 0.012, 0.02, 0.03, { attack: 0.001 }),
      slide(392, 587.33, 0.06, 0.25, 0.04, { attack: 0.03 }),
      pop(2000, 0.03, { from: "normal" }),
      slide(196, 294, 0.08, 0.3, 0.02, { from: "strong", attack: 0.03 }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** "Hm?": a round note, then a higher one that bends up like a question. */
  attention: {
    masterGain: 0.65,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 659.25, attack: 0.003, decay: 0.1, peak: 0.035 },
      slide(880, 1174.66, 0.12, 0.16, 0.035, { attack: 0.003, offset: 0.16 }),
      pop(2200, 0.04, { from: "normal" }),
      pop(2600, 0.04, { from: "normal", offset: 0.16 }),
      bloop(329.63, 0.18, 0.02, { from: "strong", offset: 0.16 }),
    ],
    vary: STEADY,
  },
  /** Drips thinning out as the number slows, over fizz that rises with it, landing on a bloop. */
  count: {
    masterGain: 0.23,
    layers: [
      ...countTicks(drip(880, 0.012, 0.025)),
      { stretch: true, kind: "noise", filterType: "lowpass", filterFrequency: 900, glideTo: 1800, glideTime: 0.6, filterQ: 0.7, attack: 0.15, decay: 0.55, peak: 0.04 },
      pop(1600, 0.08, { offset: COUNT_LANDS }),
      bloop(587.33, 0.1, 0.04, { offset: COUNT_LANDS }),
      bloop(293.66, 0.12, 0.03, { from: "strong", offset: COUNT_LANDS }),
    ],
    vary: LIVELY,
  },
} satisfies Record<SoundName, SoundRecipe>;

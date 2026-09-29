/**
 * The `bubble` theme: the same fourteen cues, made of water. Playful and
 * opt-in: an app switches to it with `setTheme`, or uses it for one moment with
 * `play()`'s `theme` option or `data-cuelume-theme`.
 *
 * Built from bloops (a sine gliding up the way a bubble does as it surfaces),
 * pops (a short burst of low-passed noise), and fizz. The only theme whose
 * tones glide. Nothing is centred above 5 kHz, contours match the other themes
 * (success rises, error falls, warning stays level, attention rises), and
 * levels match the default palette on the loudest 30 ms.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out, and each cue has a layer only strong
 * plays.
 */

import { COUNT_LANDS, countTicks, type NoiseLayer, type SoundName, type SoundRecipe, type ToneLayer } from "./recipes.js";

/** How far a bloop rises; a sinking bloop falls by the same ratio. */
const RISE = 1.5;

/** A bubble surfacing: a sine that glides up by RISE in 40 ms. */
const bloop = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer => ({
  kind: "tone", waveform: "sine", frequency, glideTo: frequency * RISE, glideTime: 0.04, attack: 0.002, decay, peak, ...more,
});

/** A bubble going under: the same glide, downward and a little slower. */
const sink = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer =>
  bloop(frequency, decay, peak, { glideTo: frequency / RISE, glideTime: 0.06, ...more });

/** A bubble bursting: 3 ms of low-passed noise. */
const pop = (filterFrequency: number, peak: number, more: Partial<NoiseLayer> = {}): NoiseLayer => ({
  kind: "noise", filterType: "lowpass", filterFrequency, filterQ: 0.9, attack: 0.001, decay: 0.003, peak, ...more,
});

/** Input and surface cues: no two bubbles match. */
const LIVELY = { pitch: 0.06, level: 0.1 };
/** Outcome and progress cues vary in level only, so a rise stays a rise and a level note stays level. */
const STEADY = { pitch: 0, level: 0.08 };
const ROOM = { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 };

export const BUBBLE = {
  /** One small bloop. */
  tap: {
    masterGain: 0.40,
    layers: [
      bloop(880, 0.035, 0.04),
      pop(2400, 0.05, { from: "normal" }),
      bloop(440, 0.06, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** A tiny pop, pitched differently every stroke. */
  type: {
    masterGain: 0.88,
    layers: [
      pop(1800, 0.12),
      bloop(1320, 0.012, 0.012, { from: "normal", glideTime: 0.015 }),
      pop(500, 0.2, { from: "strong", decay: 0.012 }),
    ],
    vary: { pitch: 0.1, level: 0.2 },
  },
  /** A pop and a bloop; a later option rises, an earlier one falls. */
  select: {
    masterGain: 0.39,
    layers: [
      pop(2000, 0.06, { from: "normal" }),
      bloop(740, 0.03, 0.04),
      bloop(370, 0.05, 0.03, { from: "strong" }),
    ],
    vary: { pitch: 0.02, level: 0.1 },
  },
  /** A bloop up; switching off plays it sinking. */
  toggle: {
    masterGain: 0.24,
    layers: [
      bloop(622.25, 0.045, 0.04),
      pop(2200, 0.04, { from: "normal" }),
      bloop(311.13, 0.06, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Two bloops rising. */
  open: {
    masterGain: 0.5,
    layers: [
      bloop(523.25, 0.05, 0.035),
      bloop(783.99, 0.07, 0.035, { offset: 0.06 }),
      pop(2200, 0.04, { from: "normal", offset: 0.06 }),
      bloop(261.63, 0.08, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** One bloop sinking. */
  close: {
    masterGain: 0.36,
    layers: [
      sink(783.99, 0.07, 0.04),
      pop(1200, 0.06, { from: "normal", offset: 0.05 }),
      sink(261.63, 0.08, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Two bubbles rising a fifth, C5 to G5, in a small room. */
  success: {
    masterGain: 0.59,
    layers: [
      bloop(523.25, 0.1, 0.04),
      pop(2000, 0.04, { from: "normal" }),
      bloop(783.99, 0.14, 0.04, { offset: 0.09 }),
      pop(2400, 0.04, { from: "normal", offset: 0.09 }),
      bloop(261.63, 0.18, 0.025, { from: "strong", offset: 0.09 }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** A bubble sinking twice, the second lower. */
  error: {
    masterGain: 0.53,
    layers: [
      sink(392, 0.08, 0.045),
      pop(1400, 0.04, { from: "normal" }),
      sink(329.63, 0.11, 0.045, { offset: 0.12 }),
      pop(250, 0.2, { from: "strong", decay: 0.03 }),
    ],
    vary: STEADY,
  },
  /** Three quick bloops, each rising an octave; going back, each sinks. */
  navigate: {
    masterGain: 0.79,
    layers: [
      bloop(440, 0.04, 0.03, { glideTo: 880, glideTime: 0.05 }),
      bloop(440, 0.04, 0.03, { glideTo: 880, glideTime: 0.05, offset: 0.045 }),
      bloop(440, 0.05, 0.03, { glideTo: 880, glideTime: 0.05, offset: 0.09, from: "normal" }),
      bloop(220, 0.1, 0.025, { glideTo: 440, glideTime: 0.1, from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Two bloops at one pitch. */
  warning: {
    masterGain: 0.62,
    layers: [
      bloop(587.33, 0.07, 0.04),
      pop(2000, 0.04, { from: "normal" }),
      bloop(587.33, 0.1, 0.04, { offset: 0.1 }),
      bloop(293.66, 0.12, 0.025, { from: "strong", offset: 0.1 }),
    ],
    vary: STEADY,
  },
  /** Fizz that swells, with a few tiny bubbles in it. Nothing lands. */
  loading: {
    masterGain: 0.68,
    layers: [
      { kind: "noise", filterType: "lowpass", filterFrequency: 1400, filterQ: 0.7, attack: 0.12, decay: 0.16, peak: 0.08 },
      bloop(1318.51, 0.012, 0.008, { from: "normal", offset: 0.06, glideTime: 0.012 }),
      bloop(1567.98, 0.012, 0.008, { from: "normal", offset: 0.13, glideTime: 0.012 }),
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 400, filterQ: 0.7, attack: 0.1, decay: 0.2, peak: 0.1 },
    ],
    vary: STEADY,
  },
  /** One round bloop in a small room. */
  ready: {
    masterGain: 0.52,
    layers: [
      bloop(523.25, 0.2, 0.04, { glideTime: 0.05 }),
      pop(2000, 0.04, { from: "normal" }),
      bloop(261.63, 0.24, 0.025, { from: "strong" }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** Two bloops rising a fourth, spaced like a call. */
  attention: {
    masterGain: 0.67,
    layers: [
      bloop(659.25, 0.1, 0.035),
      pop(2200, 0.04, { from: "normal" }),
      bloop(880, 0.14, 0.035, { offset: 0.16 }),
      pop(2600, 0.04, { from: "normal", offset: 0.16 }),
      bloop(329.63, 0.16, 0.025, { from: "strong", offset: 0.16 }),
    ],
    vary: STEADY,
  },
  /** A stream of bubbles thinning out as the number slows, landing on a pop. */
  count: {
    masterGain: 0.23,
    layers: [
      ...countTicks(bloop(880, 0.02, 0.03)),
      pop(1600, 0.08, { offset: COUNT_LANDS }),
      bloop(587.33, 0.08, 0.04, { offset: COUNT_LANDS }),
      bloop(293.66, 0.12, 0.03, { from: "strong", offset: COUNT_LANDS }),
    ],
    vary: LIVELY,
  },
} satisfies Record<SoundName, SoundRecipe>;

/**
 * The `mech` theme: the same fourteen cues in a dry, precise, mechanical
 * material. Machined parts rather than glass, wood, and air. No room, no
 * ring beyond a struck part's own, and nothing harsh, industrial,
 * retro-computer, or sci-fi.
 *
 * Level-matched to the default palette on momentary loudness (the loudest
 * 30 ms), so switching themes changes the material, not the volume.
 *
 * Arranged for emphasis like the default palette: layers marked from
 * "normal" are ornament that subtle leaves out, and each cue has a layer only
 * strong plays.
 */

import { COUNT_LANDS, countTicks, type SoundName, type SoundRecipe } from "./recipes.js";

export const MECH = {
  /** A machined click, like a camera's shutter button — no ring. */
  tap: {
    masterGain: 1.05,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 2650, filterQ: 1.5, attack: 0.001, decay: 0.004, peak: 0.14 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 910, filterQ: 4, attack: 0.001, decay: 0.012, peak: 0.2 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 4600, filterQ: 2, attack: 0.001, decay: 0.002, peak: 0.05 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 215, filterQ: 2, attack: 0.001, decay: 0.025, peak: 0.3 },
    ],
    vary: { pitch: 0.02, level: 0.1 },
  },
  /** A tight low-profile switch: shorter and drier than a keycap, almost no body. */
  type: {
    masterGain: 0.58,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 4300, filterQ: 1.2, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 5, attack: 0.001, decay: 0.008, peak: 0.18 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 750, filterQ: 3, attack: 0.001, decay: 0.01, peak: 0.22 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 330, filterQ: 2.5, attack: 0.001, decay: 0.02, peak: 0.3 },
    ],
    vary: { pitch: 0.05, level: 0.15 },
  },
  /** A ratchet detent, like a precision dial clicking over one tooth. */
  select: {
    masterGain: 0.86,
    layers: [
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3650, filterQ: 3, attack: 0.001, decay: 0.003, peak: 0.2 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1500, filterQ: 8, attack: 0.001, decay: 0.009, peak: 0.35 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 1500, filterQ: 8, offset: 0.012, attack: 0.001, decay: 0.006, peak: 0.18 },
    ],
  },
  /** A toggle switch's throw: the lever starts, then snaps over centre. */
  toggle: {
    masterGain: 0.72,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 1650, filterQ: 2, attack: 0.001, decay: 0.004, peak: 0.14 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 2650, filterQ: 3, offset: 0.03, attack: 0.001, decay: 0.006, peak: 0.18 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 750, filterQ: 4, offset: 0.03, attack: 0.001, decay: 0.014, peak: 0.2 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 2, offset: 0.03, attack: 0.001, decay: 0.03, peak: 0.3 },
    ],
  },
  /** A latch releasing: the catch lets go and the bolt slides back to its stop. */
  open: {
    masterGain: 1.41,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 3, attack: 0.001, decay: 0.004, peak: 0.16 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1160, glideTo: 2150, glideTime: 0.05, filterQ: 2, offset: 0.006, attack: 0.02, decay: 0.03, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1330, filterQ: 5, offset: 0.06, attack: 0.001, decay: 0.008, peak: 0.14 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 290, filterQ: 2, offset: 0.06, attack: 0.001, decay: 0.03, peak: 0.25 },
    ],
  },
  /** A latch catching: the bolt slides home and the catch takes it. */
  close: {
    masterGain: 1.2,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 2150, glideTo: 1080, glideTime: 0.04, filterQ: 2, attack: 0.015, decay: 0.025, peak: 0.08 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1000, filterQ: 4, offset: 0.04, attack: 0.001, decay: 0.01, peak: 0.22 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 2, offset: 0.04, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 180, filterQ: 2, offset: 0.04, attack: 0.001, decay: 0.035, peak: 0.3 },
    ],
  },
  /** Two dry struck-metal taps rising a fifth: a short bar, not a bell. */
  success: {
    masterGain: 0.53,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 698.46, attack: 0.001, decay: 0.08, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1927.7, attack: 0.001, decay: 0.03, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 1046.5, offset: 0.07, attack: 0.001, decay: 0.112, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2888.3, offset: 0.07, attack: 0.001, decay: 0.03, peak: 0.012 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 4150, filterQ: 2, attack: 0.001, decay: 0.003, peak: 0.06 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 4150, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.003, peak: 0.06 },
    ],
  },
  /** A firm low double knock that falls, like a handle that is locked. */
  error: {
    masterGain: 2.8,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 430, filterQ: 4, attack: 0.001, decay: 0.02, peak: 0.3 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1830, filterQ: 3, attack: 0.001, decay: 0.006, peak: 0.1 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 365, filterQ: 4, offset: 0.09, attack: 0.001, decay: 0.025, peak: 0.3 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1580, filterQ: 3, offset: 0.09, attack: 0.001, decay: 0.006, peak: 0.1 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 150, filterQ: 2, attack: 0.001, decay: 0.04, peak: 0.3 },
    ],
  },
  /** A short carriage slide over fine ratchet teeth, ending at its stop. */
  navigate: {
    masterGain: 0.99,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 750, glideTo: 1800, glideTime: 0.13, filterQ: 1.8, attack: 0.05, decay: 0.096, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2500, filterQ: 4, offset: 0.04, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2800, filterQ: 4, offset: 0.08, attack: 0.001, decay: 0.003, peak: 0.09 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1250, filterQ: 4, offset: 0.14, attack: 0.001, decay: 0.008, peak: 0.14 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 1.5, attack: 0.04, decay: 0.112, peak: 0.12 },
    ],
  },
  /** Two dry metal taps at one pitch: level, neither the rise of success nor the fall of error. */
  warning: {
    masterGain: 0.54,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 783.99, attack: 0.001, decay: 0.08, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, attack: 0.001, decay: 0.025, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 783.99, offset: 0.09, attack: 0.001, decay: 0.1, peak: 0.045 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, offset: 0.09, attack: 0.001, decay: 0.025, peak: 0.011 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 300, filterQ: 2, offset: 0.09, attack: 0.001, decay: 0.03, peak: 0.25 },
    ],
  },
  /** A latch drawn back and held: a slow, low slide with no catch at the end. */
  loading: {
    masterGain: 1.04,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 500, glideTo: 900, glideTime: 0.2, filterQ: 1.5, attack: 0.12, decay: 0.1, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1300, filterQ: 4, attack: 0.1, decay: 0.06, peak: 0.03 },
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 250, filterQ: 0.7, attack: 0.1, decay: 0.12, peak: 0.1 },
    ],
  },
  /** One dry struck bar, lower than success: a result is there. */
  ready: {
    masterGain: 0.45,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 523.25, attack: 0.001, decay: 0.16, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1444.2, attack: 0.001, decay: 0.04, peak: 0.012 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 2, attack: 0.001, decay: 0.003, peak: 0.05 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 261.63, attack: 0.002, decay: 0.2, peak: 0.03 },
    ],
  },
  /** Two metal taps rising a fourth, spaced like a call. */
  attention: {
    masterGain: 0.48,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 880, attack: 0.001, decay: 0.1, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2428.8, attack: 0.001, decay: 0.03, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.16, attack: 0.001, decay: 0.14, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3242, offset: 0.16, attack: 0.001, decay: 0.03, peak: 0.012 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 300, filterQ: 2, offset: 0.16, attack: 0.001, decay: 0.03, peak: 0.25 },
    ],
  },
  /** An odometer drum turning: dry ticks that slow over a sliding bed, stopping on a detent. */
  count: {
    masterGain: 0.86,
    layers: [
      ...countTicks({ kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 3, attack: 0.001, decay: 0.003, peak: 0.14 }),
      { stretch: true, kind: "noise", filterType: "bandpass", filterFrequency: 500, glideTo: 900, glideTime: 0.6, filterQ: 2, attack: 0.1, decay: 0.6, peak: 0.03 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1900, filterQ: 5, offset: COUNT_LANDS, attack: 0.001, decay: 0.01, peak: 0.25 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 700, filterQ: 3, offset: COUNT_LANDS, attack: 0.001, decay: 0.015, peak: 0.2 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 220, filterQ: 2, offset: COUNT_LANDS, attack: 0.001, decay: 0.03, peak: 0.3 },
    ],
    vary: { pitch: 0.03, level: 0.1 },
  },
} satisfies Record<SoundName, SoundRecipe>;

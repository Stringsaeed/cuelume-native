/**
 * The sound palette — layer/recipe types plus the fourteen canonical cues.
 * Each cue names an interface job, not a synthesis style, and has its own
 * distinct shape rather than being a volume/EQ tweak on the same click.
 * Retired v0.2 names live on as aliases until 1.0.
 */

type BaseLayer = {
  /** Seconds after the trigger that this layer starts. */
  offset?: number;
  /** Fade-in time, in seconds. */
  attack: number;
  /** Fade-out time, in seconds, starting right after the attack. */
  decay: number;
  /** Peak volume reached at the end of the attack. */
  peak: number;
  /** If set, the layer's pitch (a tone's frequency, a noise layer's filter) glides to this value. */
  glideTo?: number;
  /** How long the glide takes, in seconds. Defaults to attack + decay. */
  glideTime?: number;
  /**
   * The lowest emphasis this layer plays at. Unset plays at every level;
   * "normal" drops out of subtle; "strong" plays only when strong.
   */
  from?: "normal" | "strong";
  /** For `count`: this layer lasts as long as the count, not only starts in step with it. */
  stretch?: true;
};

/** A single note — the building block for chimes, arpeggios, and pads. */
export type ToneLayer = BaseLayer & {
  kind: "tone";
  waveform: OscillatorType;
  frequency: number;
  /** Detune in cents, for a gentle chorus/beating effect between layers. */
  detune?: number;
};

/** Filtered noise — clicks, knocks, and air. */
export type NoiseLayer = BaseLayer & {
  kind: "noise";
  filterType: BiquadFilterType;
  filterFrequency: number;
  filterQ?: number;
};

export type SoundLayer = ToneLayer | NoiseLayer;

/** A soft, spacious echo tail applied to the whole sound — the "magic dust". */
export type Shimmer = {
  delay: number;
  feedback: number;
  wet: number;
  lowpass: number;
};

/** Per-play randomness, as fractions: each layer's pitch and level move by up to ± these. */
export type Variation = {
  pitch: number;
  level: number;
};

export type SoundRecipe = {
  masterGain: number;
  layers: SoundLayer[];
  shimmer?: Shimmer;
  vary?: Variation;
};

/**
 * When `count`'s ticks fall, in seconds, for its 800 ms original: the spacing
 * widens the way a number eases out. `duration` moves them in proportion.
 */
export const COUNT_TICKS = [0, 0.045, 0.092, 0.142, 0.196, 0.255, 0.32, 0.393, 0.476, 0.572];
/** When `count` lands, after its last tick. */
export const COUNT_LANDS = 0.69;

/** How far sharp a knock is struck, and how fast it drops to its pitch. */
const KNOCK_DROP = 1.6;
const KNOCK_DROP_TIME = 0.018;

/**
 * A knock's body: a sine struck sharp that drops to `frequency` in 18 ms, the
 * way a small hollow part answers a tap. Heard as a soft "tok", never as a
 * slide. Measured from the keycap sounds in DawoodUI's Artasaka preview.
 */
export const knock = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer => ({
  kind: "tone", waveform: "sine", frequency: frequency * KNOCK_DROP, glideTo: frequency, glideTime: KNOCK_DROP_TIME,
  attack: 0.001, decay, peak, ...more,
});

/** `tick` at every COUNT_TICKS offset; every other one is ornament that subtle leaves out. */
export function countTicks<L extends SoundLayer>(tick: L): L[] {
  return COUNT_TICKS.map((offset, i) => ({ ...tick, offset, ...(i % 2 ? { from: "normal" as const } : {}) }));
}

// Each cue is arranged for three emphases: layers marked from "normal" are
// ornament that subtle leaves out, and each cue has one layer of its own that
// only strong plays.
//
// Premium, not playful: clicks and knocks are filtered noise, tones are soft
// mallets (a sine plus a quiet partial four times its pitch, as on a marimba
// bar) or glass (sines at the glass-bar ratio 2.76), rooms are short enough
// to hear as space rather than echo, and no audible tone slides in pitch: a
// knock's 18 ms drop is heard as the body of a tap, not as a slide.
// Nothing is centred above 5 kHz, so the palette holds up through a working day.
export const RECIPES = {
  /**
   * A small glassy tap — buttons, links, nav. A nail's tick, a soft knock of
   * body, then the glass ringing briefly: the fundamental is two near-identical modes that beat
   * slowly, as real glass shimmers, and the upper mode sits at the glass-bar
   * ratio 2.76x, dying faster than the fundamental.
   */
  tap: {
    masterGain: 0.39,
    layers: [
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 4500, filterQ: 1.2, attack: 0.001, decay: 0.002, peak: 0.03 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, attack: 0.001, decay: 0.128, peak: 0.0135 },
      { kind: "tone", waveform: "sine", frequency: 1180, attack: 0.001, decay: 0.104, peak: 0.008 },
      { kind: "tone", waveform: "sine", frequency: 3242, attack: 0.001, decay: 0.048, peak: 0.0055 },
      knock(300, 0.02, 0.02, { from: "normal" }),
      { from: "strong", kind: "tone", waveform: "sine", frequency: 587.33, attack: 0.002, decay: 0.16, peak: 0.009 },
      knock(150, 0.035, 0.014, { from: "strong" }),
    ],
    vary: { pitch: 0.012, level: 0.12 },
  },
  /**
   * One keyboard keystroke — the switch's click, the keycap's clack, the thock
   * of bottoming out, and a faint return as the key springs back. Every stroke
   * lands at a slightly different pitch and weight, like different keys.
   */
  type: {
    masterGain: 0.37,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 3900, filterQ: 0.8, attack: 0.001, decay: 0.005, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1550, filterQ: 3.5, attack: 0.001, decay: 0.016, peak: 0.22 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 310, filterQ: 2.5, attack: 0.002, decay: 0.03, peak: 0.35 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2000, filterQ: 3, offset: 0.06, attack: 0.001, decay: 0.01, peak: 0.07 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 140, filterQ: 2, attack: 0.002, decay: 0.045, peak: 0.45 },
    ],
    vary: { pitch: 0.07, level: 0.2 },
  },
  /** A crisp detent over a small wooden knock — dropdowns, menus, lists. */
  select: {
    masterGain: 0.35,
    layers: [
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2800, filterQ: 2.2, attack: 0.001, decay: 0.008, peak: 0.288 },
      knock(415, 0.016, 0.03),
      knock(208, 0.025, 0.025, { from: "strong" }),
    ],
  },
  /** A two-part click-clack, like a switch flipping between states; the clack knocks. Switching off knocks upward. */
  toggle: {
    masterGain: 0.35,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 1830, filterQ: 1.6, attack: 0.001, decay: 0.016, peak: 0.12 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 3150, filterQ: 1.6, offset: 0.024, attack: 0.001, decay: 0.02, peak: 0.1 },
      knock(330, 0.02, 0.025, { offset: 0.024 }),
      knock(165, 0.03, 0.025, { from: "strong", offset: 0.024 }),
    ],
  },
  /** Air drawing upward, then a light latch as the panel settles — menus, drawers, dialogs. */
  open: {
    masterGain: 0.53,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 600, glideTo: 1500, glideTime: 0.1, filterQ: 1.4, attack: 0.07, decay: 0.04, peak: 0.168 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 3, offset: 0.095, attack: 0.001, decay: 0.012, peak: 0.12 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 515, filterQ: 2, offset: 0.095, attack: 0.001, decay: 0.02, peak: 0.096 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 2, offset: 0.095, attack: 0.001, decay: 0.04, peak: 0.2 },
    ],
  },
  /** The same air falling, into a soft thud as it shuts — closing and dismissing. */
  close: {
    masterGain: 0.48,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 1400, glideTo: 540, glideTime: 0.07, filterQ: 1.4, attack: 0.04, decay: 0.035, peak: 0.216 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 350, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.03, peak: 0.36 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1650, filterQ: 2.5, offset: 0.07, attack: 0.001, decay: 0.006, peak: 0.09 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 165, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.04, peak: 0.3 },
    ],
  },
  /** Two soft mallet notes rising a fifth, C5 to G5, in a small room — confirmed completion. */
  success: {
    masterGain: 0.54,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 523.25, attack: 0.003, decay: 0.21, peak: 0.034 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2093, attack: 0.001, decay: 0.04, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 783.99, offset: 0.075, attack: 0.003, decay: 0.27, peak: 0.036 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3136, offset: 0.075, attack: 0.001, decay: 0.04, peak: 0.007 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 392, offset: 0.075, attack: 0.01, decay: 0.36, peak: 0.022 },
    ],
    shimmer: { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 },
  },
  /** Two muted mallet notes falling a minor third, low and short — a calm, recoverable refusal. */
  error: {
    masterGain: 0.46,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 349.23, attack: 0.003, decay: 0.096, peak: 0.046 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1396.91, attack: 0.001, decay: 0.025, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 293.66, offset: 0.11, attack: 0.003, decay: 0.144, peak: 0.046 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.11, attack: 0.001, decay: 0.025, peak: 0.007 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 1.5, attack: 0.001, decay: 0.03, peak: 0.2 },
    ],
  },
  /** A soft whoosh whose air rises as it passes — routes, pages, galleries, carousels. */
  navigate: {
    masterGain: 0.41,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 400, glideTo: 1800, glideTime: 0.21, filterQ: 1.2, attack: 0.12, decay: 0.12, peak: 0.18 },
      { from: "normal", kind: "noise", filterType: "lowpass", filterFrequency: 540, filterQ: 0.7, attack: 0.09, decay: 0.096, peak: 0.045 },
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 230, filterQ: 0.7, attack: 0.1, decay: 0.144, peak: 0.1 },
    ],
  },
  /** One mallet note struck twice at one pitch. Success rises and error falls; warning stays level. */
  warning: {
    masterGain: 0.54,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 440, attack: 0.003, decay: 0.1, peak: 0.044 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1760, attack: 0.001, decay: 0.025, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 440, offset: 0.1, attack: 0.003, decay: 0.14, peak: 0.04 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1760, offset: 0.1, attack: 0.001, decay: 0.025, peak: 0.006 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 220, offset: 0.1, attack: 0.005, decay: 0.2, peak: 0.02 },
    ],
  },
  /** One muted note that swells in and is never struck, over a breath of air: work has begun, nothing has landed. */
  loading: {
    masterGain: 0.36,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 392, attack: 0.09, decay: 0.16, peak: 0.03 },
      { from: "normal", kind: "noise", filterType: "lowpass", filterFrequency: 900, filterQ: 0.7, attack: 0.08, decay: 0.1, peak: 0.05 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 196, attack: 0.1, decay: 0.2, peak: 0.02 },
    ],
  },
  /** One glass note, lower and longer than tap, in success's small room: a result is there. */
  ready: {
    masterGain: 0.55,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 783.99, attack: 0.004, decay: 0.34, peak: 0.022 },
      { kind: "tone", waveform: "sine", frequency: 788.5, attack: 0.004, decay: 0.28, peak: 0.012 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, attack: 0.002, decay: 0.09, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 392, attack: 0.006, decay: 0.4, peak: 0.014 },
    ],
    shimmer: { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 },
  },
  /** Two glass notes rising a fourth, spaced like a call: blocked until the user answers. */
  attention: {
    masterGain: 0.64,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 880, attack: 0.003, decay: 0.22, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 885.1, attack: 0.003, decay: 0.18, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2428.8, attack: 0.002, decay: 0.06, peak: 0.005 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.16, attack: 0.003, decay: 0.3, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 1181.5, offset: 0.16, attack: 0.003, decay: 0.24, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3242, offset: 0.16, attack: 0.002, decay: 0.07, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 587.33, offset: 0.16, attack: 0.006, decay: 0.36, peak: 0.012 },
    ],
  },
  /**
   * A number rolling to a new value: soft wooden ticks, like a fine dial, that
   * slow as the number eases out, over a breath of air that rises with the count
   * (and falls counting down), landing on a quiet glass note.
   */
  count: {
    masterGain: 0.27,
    layers: [
      ...countTicks({ kind: "noise", filterType: "bandpass", filterFrequency: 2300, filterQ: 4, attack: 0.001, decay: 0.006, peak: 0.14 }),
      { stretch: true, kind: "noise", filterType: "bandpass", filterFrequency: 700, glideTo: 1400, glideTime: 0.6, filterQ: 1.2, attack: 0.15, decay: 0.55, peak: 0.05 },
      { kind: "tone", waveform: "sine", frequency: 1046.5, offset: COUNT_LANDS, attack: 0.002, decay: 0.12, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 1051.2, offset: COUNT_LANDS, attack: 0.002, decay: 0.1, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2888.3, offset: COUNT_LANDS, attack: 0.001, decay: 0.04, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 261.63, offset: COUNT_LANDS, attack: 0.004, decay: 0.16, peak: 0.02 },
    ],
    vary: { pitch: 0.02, level: 0.12 },
  },
} satisfies Record<string, SoundRecipe>;

export type SoundName = keyof typeof RECIPES;

/** All canonical cue names, derived from the recipe palette. */
export const sounds = Object.keys(RECIPES) as readonly SoundName[];

/** The v0.2 palette, mapped to the cue that now does each job. Removed in 1.0. */
const ALIASES = {
  chime: "success",
  sparkle: "success",
  droplet: "close",
  bloom: "open",
  whisper: "select",
  tick: "select",
  press: "tap",
  release: "tap",
  page: "navigate",
  pulse: "tap",
  scan: "select",
  arrival: "navigate",
} as const satisfies Record<string, SoundName>;

export type LegacySoundName = keyof typeof ALIASES;

const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

/** Maps a canonical or deprecated name to its canonical cue; anything else is `null`. */
export function resolveSound(value: unknown): SoundName | null {
  if (typeof value !== "string") return null;
  if (own(RECIPES, value)) return value as SoundName;
  return own(ALIASES, value) ? ALIASES[value as LegacySoundName] : null;
}

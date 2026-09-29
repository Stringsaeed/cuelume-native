/**
 * The audio engine — synthesizes each sound live via the Web Audio API
 * on one shared, lazily created `AudioContext`. No audio files, no
 * dependencies. Every sound carries a gentle envelope (and often a soft
 * shimmer tail) instead of a hard transient, so nothing feels harsh.
 */

import {
  resolveSound,
  type LegacySoundName,
  type NoiseLayer,
  type Shimmer,
  type SoundLayer,
  type SoundName,
  type SoundRecipe,
  type ToneLayer,
  type Variation,
} from "../sounds/recipes.js";
import {
  arrangement,
  contextFrom,
  layerFactors,
  resolveEmphasis,
  shapeFor,
  type Context,
  type Emphasis,
  type InputMethod,
  type KeyRole,
  type Shape,
} from "../sounds/context.js";
import { THEMES, isThemeName, type ThemeName } from "../sounds/themes.js";

const SOURCE_STOP_PADDING = 0.05;
const CLEANUP_MARGIN = 0.05;
const INAUDIBLE_GAIN = 0.001;
const OUTPUT_GAIN = 4;

/** Holds `param` at `from`, then glides it toward the layer's `glideTo`, if any. */
function glide(param: AudioParam, from: number, layer: SoundLayer, startTime: number): void {
  param.setValueAtTime(from, startTime);
  if (layer.glideTo === undefined) return;
  param.exponentialRampToValueAtTime(layer.glideTo, startTime + (layer.glideTime ?? layer.attack + layer.decay));
}

function renderTone(
  context: AudioContext,
  destination: AudioNode,
  layer: ToneLayer,
  startTime: number,
): void {
  const oscillator = context.createOscillator();
  oscillator.type = layer.waveform;
  glide(oscillator.frequency, layer.frequency, layer, startTime);
  if (layer.detune) oscillator.detune.value = layer.detune;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + layer.attack + layer.decay);

  oscillator.connect(gain).connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + layer.attack + layer.decay + SOURCE_STOP_PADDING);
}

function renderNoise(
  context: AudioContext,
  destination: AudioNode,
  layer: NoiseLayer,
  startTime: number,
): void {
  const duration = layer.attack + layer.decay + SOURCE_STOP_PADDING;
  const length = Math.max(1, Math.floor(duration * context.sampleRate));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = 2 * Math.random() - 1;

  const source = context.createBufferSource();
  source.buffer = buffer;

  const filter = context.createBiquadFilter();
  filter.type = layer.filterType;
  glide(filter.frequency, layer.filterFrequency, layer, startTime);
  if (layer.filterQ !== undefined) filter.Q.value = layer.filterQ;

  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(layer.peak, startTime + layer.attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + layer.attack + layer.decay);

  source.connect(filter).connect(gain).connect(destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

/** Wires a soft echo/shimmer send off `source`, feeding back into `destination`. */
function attachShimmer(
  context: AudioContext,
  source: AudioNode,
  destination: AudioNode,
  shimmer: Shimmer,
): AudioNode[] {
  const delay = context.createDelay(1);
  delay.delayTime.value = shimmer.delay;

  const feedbackFilter = context.createBiquadFilter();
  feedbackFilter.type = "lowpass";
  feedbackFilter.frequency.value = shimmer.lowpass;

  const feedbackGain = context.createGain();
  feedbackGain.gain.value = shimmer.feedback;

  const wetGain = context.createGain();
  wetGain.gain.value = shimmer.wet;

  source.connect(delay);
  delay.connect(feedbackFilter);
  feedbackFilter.connect(feedbackGain);
  feedbackGain.connect(delay);
  feedbackFilter.connect(wetGain);
  wetGain.connect(destination);

  return [delay, feedbackFilter, feedbackGain, wetGain];
}

function sourceEnd(layers: SoundLayer[]): number {
  return Math.max(
    ...layers.map(
      (layer) => (layer.offset ?? 0) + layer.attack + layer.decay + SOURCE_STOP_PADDING,
    ),
  );
}

function shimmerTail(shimmer?: Shimmer): number {
  if (!shimmer || shimmer.feedback <= 0) return 0;
  if (shimmer.feedback >= 1) return shimmer.delay;

  return shimmer.delay * (1 + Math.ceil(Math.log(INAUDIBLE_GAIN) / Math.log(shimmer.feedback)));
}

let sharedOutput: GainNode | null = null;

function getOutput(context: AudioContext): GainNode {
  if (sharedOutput) return sharedOutput;

  const output = context.createGain();
  output.gain.value = OUTPUT_GAIN;

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.08;

  output.connect(limiter).connect(context.destination);
  sharedOutput = output;
  return output;
}

const nudge = (amount: number) => 1 + (Math.random() * 2 - 1) * amount;

/**
 * A copy of `layer` bent by the play's context shape, then moved at random
 * within the recipe's own bounds, so no two plays match. A reversed sweep
 * starts where it would have ended. `time` moves every layer's start, and a
 * `stretch` layer lasts as long as the count.
 */
function shaped(layer: SoundLayer, shape: Shape, vary?: Variation): SoundLayer {
  const factors = layerFactors(layer, shape);
  const pitch = factors.pitch * (vary ? nudge(vary.pitch) : 1);
  const peak = layer.peak * factors.gain * (vary ? nudge(vary.level) : 1);
  const stretch = layer.stretch ? shape.time : 1;
  const decay = layer.decay * factors.length * stretch;
  const start = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
  const [from, to] = shape.sweep < 0 && layer.glideTo !== undefined ? [layer.glideTo, start] : [start, layer.glideTo];
  const glideTo = to === undefined ? undefined : to * pitch;
  const timing = {
    offset: (layer.offset ?? 0) * shape.time,
    attack: layer.attack * stretch,
    glideTime: layer.glideTime === undefined ? undefined : layer.glideTime * stretch,
  };
  return layer.kind === "tone"
    ? { ...layer, ...timing, frequency: from * pitch, glideTo, peak, decay }
    : { ...layer, ...timing, filterFrequency: from * pitch, glideTo, peak, decay };
}

function renderRecipe(
  context: AudioContext,
  recipe: SoundRecipe,
  volume: number,
  emphasis: Emphasis,
  shape: Shape,
): void {
  const now = context.currentTime;
  const output = getOutput(context);
  const master = context.createGain();
  master.gain.value = recipe.masterGain * volume;
  master.connect(output);

  const shimmerNodes = recipe.shimmer
    ? attachShimmer(context, master, output, recipe.shimmer)
    : [];

  const layers = arrangement(recipe.layers, emphasis).map((layer) => shaped(layer, shape, recipe.vary));
  for (const layer of layers) {
    const startTime = now + (layer.offset ?? 0);
    if (layer.kind === "tone") renderTone(context, master, layer, startTime);
    else renderNoise(context, master, layer, startTime);
  }

  const cleanupAfterMs = (sourceEnd(layers) + shimmerTail(recipe.shimmer) + CLEANUP_MARGIN) * 1000;
  setTimeout(() => {
    master.disconnect();
    for (const node of shimmerNodes) node.disconnect();
  }, cleanupAfterMs);
}

let sharedContext: AudioContext | null = null;
let enabled = true;
let globalVolume = 1;
let activeTheme: ThemeName = "default";

function normalizeVolume(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/** Enables or disables future playback. Preference storage stays with the app. */
export function setEnabled(value: boolean): void {
  if (typeof value === "boolean") enabled = value;
}

/**
 * Switches the material of future playback. Sounds already playing finish as
 * they started; unknown names are ignored. Preference storage stays with the app.
 */
export function setTheme(theme: ThemeName): void {
  if (isThemeName(theme)) activeTheme = theme;
}

/** Sets the volume multiplier for future playback. Preference storage stays with the app. */
export function setVolume(value: number): void {
  globalVolume = normalizeVolume(value, globalVolume);
}

function getAudioContext(): AudioContext | null {
  if (sharedContext) return sharedContext;
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    sharedContext = new Ctor();
  } catch {
    return null;
  }
  return sharedContext;
}

export type PlayOptions = {
  /** Multiplier for this play only, clamped to 0–1. */
  volume?: number;
  /** How much the action matters. Invalid values play as "normal". */
  emphasis?: Emphasis;
  /** Which way the interaction moved. Shapes `select`; `back` plays `navigate`, `toggle` and `count` backwards. */
  direction?: "forward" | "back";
  /** Which key was typed. Shapes `type`. */
  key?: KeyRole;
  /** What did the activating. Shapes `tap`. */
  input?: InputMethod;
  /** How long a `count` runs, in milliseconds, clamped to 300–2000. Other cues ignore it. */
  duration?: number;
  /** The material for this play only; the active theme is unchanged. Unknown names play the active theme. */
  theme?: ThemeName;
};

/** When each cue last played, for cadence. Page memory only; never stored. */
const lastPlayedAt = new Map<SoundName, number>();

function sinceLastPlay(sound: SoundName): number {
  const now = performance.now();
  const since = now - (lastPlayedAt.get(sound) ?? -Infinity);
  lastPlayedAt.set(sound, now);
  return since;
}

/**
 * Plays a sound immediately. Safe to call from anywhere — lazily creates
 * the shared `AudioContext` on first use, resumes it if the browser
 * started it suspended (e.g. before any user gesture), and is a no-op
 * when Web Audio is unavailable (SSR, old browsers).
 */
export function play(sound?: SoundName, options?: PlayOptions): void;
/** @deprecated Renamed in v0.3 and removed in 1.0. See the migration table in the README. */
export function play(sound: LegacySoundName, options?: PlayOptions): void;
export function play(sound: SoundName | LegacySoundName = "tap", options?: PlayOptions): void {
  playInContext(sound, options, contextFrom(options));
}

/** `play`, plus what a binding knows about the interaction. Internal to cuelume. */
export function playInContext(sound: unknown, options: PlayOptions | undefined, interaction: Context): void {
  const name = resolveSound(sound);
  if (!enabled || !name) return;
  if (typeof navigator !== "undefined" && navigator.userActivation?.hasBeenActive === false) return;

  const playVolume = globalVolume * normalizeVolume(options?.volume, 1);
  if (playVolume === 0) return;

  const context = getAudioContext();
  if (!context) return;

  const requested = options?.theme;
  const recipe: SoundRecipe = THEMES[isThemeName(requested) ? requested : activeTheme][name];
  const emphasis = resolveEmphasis(options?.emphasis);
  const shape = shapeFor(name, interaction, emphasis, sinceLastPlay(name));
  if (context.state === "running") {
    renderRecipe(context, recipe, playVolume, emphasis, shape);
  } else {
    try {
      void context.resume().then(
        () => {
          if (enabled && context.state === "running") renderRecipe(context, recipe, playVolume, emphasis, shape);
        },
        () => {},
      );
    } catch {
      // Some browsers throw synchronously when audio is blocked.
    }
  }
}

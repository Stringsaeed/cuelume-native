/**
 * Renders any sound's real synthesis output offline (via `OfflineAudioContext`,
 * the same node graph `play()` uses) and reduces it to a small peaks array
 * suitable for drawing a waveform preview — the actual signal shape, not a
 * stand-in.
 */

import { OfflineAudioContext } from "react-native-audio-api";

import { ROOM_SECONDS, renderRecipe, sourceEnd } from "./engine.js";
import { arrangement, shapeFor } from "../sounds/context.js";
import { resolveSound, type SoundLayer, type SoundName, type SoundRecipe } from "../sounds/recipes.js";
import { THEMES, isThemeName, type ThemeName } from "../sounds/themes.js";

const SAMPLE_RATE = 44100;
const DEFAULT_RESOLUTION = 180;
const RENDER_VOLUME = 1;

export type SoundWaveform = {
  /** `resolution` samples, one continuous trace, normalized to its own peak so it always fills [-1, 1]. */
  peaks: Float32Array;
  /** Seconds — the audible signal length (no source-stop padding), matching what a "0.36 s" readout should show. */
  duration: number;
  sampleRate: number;
};

/** The audible signal length: the latest point any layer's envelope finishes, with no padding. */
function soundDuration(layers: SoundLayer[]): number {
  return Math.max(...layers.map((layer) => (layer.offset ?? 0) + layer.attack + layer.decay));
}

/**
 * Picks the largest-magnitude sample in each bucket (preserving its sign)
 * rather than averaging — averaging a bucket spanning several oscillation
 * cycles collapses toward zero, erasing the waveform's shape.
 */
function extractPeaks(raw: Float32Array, resolution: number): Float32Array {
  const peaks = new Float32Array(resolution);
  const bucketSize = raw.length / resolution;

  for (let i = 0; i < resolution; i++) {
    const start = Math.floor(i * bucketSize);
    const end = Math.max(start + 1, Math.floor((i + 1) * bucketSize));
    let extremum = 0;
    for (let j = start; j < end && j < raw.length; j++) {
      if (Math.abs(raw[j]) > Math.abs(extremum)) extremum = raw[j];
    }
    peaks[i] = extremum;
  }

  return peaks;
}

/** Scales so the loudest sample reaches ±1 — recipe peaks are intentionally quiet (as low as 0.05–0.14). */
function normalize(peaks: Float32Array): Float32Array {
  let max = 0;
  for (const value of peaks) max = Math.max(max, Math.abs(value));
  if (max === 0) return peaks;

  const normalized = new Float32Array(peaks.length);
  for (let i = 0; i < peaks.length; i++) normalized[i] = peaks[i] / max;
  return normalized;
}

/**
 * Renders `name`'s real synthesis output offline and returns a compact
 * waveform preview of it, as it plays with no interaction context and normal
 * emphasis. Independent of `setVolume()` and `setTheme()` — this is the
 * sound's intrinsic shape at nominal volume, not scaled by playback
 * preferences; pass `theme` to preview another material.
 *
 * Throws if `name` isn't a known sound; unlike `play()`, this isn't meant to
 * absorb bad input silently.
 */
export async function getSoundWaveform(
  name: SoundName,
  options?: { resolution?: number; theme?: ThemeName },
): Promise<SoundWaveform> {
  const sound = resolveSound(name);
  if (!sound) {
    throw new TypeError(`getSoundWaveform: "${String(name)}" is not a known sound name.`);
  }

  const resolution = options?.resolution ?? DEFAULT_RESOLUTION;
  const theme = isThemeName(options?.theme) ? options.theme : "default";
  const recipe: SoundRecipe = THEMES[theme][sound];
  const shape = shapeFor(sound, {}, "normal", Infinity);
  const layers = arrangement(recipe.layers, "normal");
  const duration = soundDuration(layers);
  const renderSeconds = sourceEnd(layers) + ROOM_SECONDS;
  const length = Math.max(1, Math.ceil(renderSeconds * SAMPLE_RATE));

  const context = new OfflineAudioContext(1, length, SAMPLE_RATE);
  renderRecipe(context, sound, recipe, RENDER_VOLUME, "normal", shape);
  const buffer = await context.startRendering();

  // Trace only the audible envelope. Excludes `sourceEnd`'s internal
  // SOURCE_STOP_PADDING bookkeeping margin and the room's faint tail (about
  // 22 dB under the sound), which are near-silent and would otherwise waste
  // most of a short sound's trace (e.g. `select`) on a flat tail.
  const raw = buffer.getChannelData(0);
  const visibleSamples = Math.max(1, Math.min(raw.length, Math.ceil(duration * SAMPLE_RATE)));
  const peaks = normalize(extractPeaks(raw.subarray(0, visibleSamples), resolution));

  return { peaks, duration, sampleRate: SAMPLE_RATE };
}

/**
 * Renders any sound's real synthesis output offline (via `OfflineAudioContext`,
 * the same node graph `play()` uses) and reduces it to a small peaks array
 * suitable for drawing a waveform preview — the actual signal shape, not a
 * stand-in.
 */

import { OfflineAudioContext } from "react-native-audio-api";

import { renderRecipe, shimmerTail, sourceEnd } from "./engine.js";
import { RECIPES, isSoundName, type SoundName, type SoundRecipe } from "../sounds/recipes.js";

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
function soundDuration(recipe: SoundRecipe): number {
  return Math.max(
    ...recipe.layers.map((layer) => (layer.offset ?? 0) + layer.attack + layer.decay),
  );
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
 * waveform preview of it. Independent of `setVolume()` — this is the sound's
 * intrinsic shape at nominal volume, not scaled by playback preferences.
 *
 * Throws if `name` isn't a known sound; unlike `play()`, this isn't meant to
 * absorb bad input silently.
 */
export async function getSoundWaveform(
  name: SoundName,
  options?: { resolution?: number },
): Promise<SoundWaveform> {
  if (!isSoundName(name)) {
    throw new TypeError(`getSoundWaveform: "${String(name)}" is not a known sound name.`);
  }

  const resolution = options?.resolution ?? DEFAULT_RESOLUTION;
  const recipe: SoundRecipe = RECIPES[name];
  const duration = soundDuration(recipe);
  const tail = shimmerTail(recipe.shimmer);
  const renderSeconds = sourceEnd(recipe) + tail;
  const length = Math.max(1, Math.ceil(renderSeconds * SAMPLE_RATE));

  const context = new OfflineAudioContext(1, length, SAMPLE_RATE);
  renderRecipe(context, recipe, RENDER_VOLUME);
  const buffer = await context.startRendering();

  // Trace only `duration + tail` — the audible envelope plus any shimmer
  // decay. Excludes `sourceEnd`'s internal SOURCE_STOP_PADDING bookkeeping
  // margin, which is silent and would otherwise waste most of a short,
  // non-shimmer sound's trace (e.g. `tick`) on a flat tail.
  const raw = buffer.getChannelData(0);
  const visibleSamples = Math.max(1, Math.min(raw.length, Math.ceil((duration + tail) * SAMPLE_RATE)));
  const peaks = normalize(extractPeaks(raw.subarray(0, visibleSamples), resolution));

  return { peaks, duration, sampleRate: SAMPLE_RATE };
}

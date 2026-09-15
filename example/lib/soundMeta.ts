/**
 * Per-sound display metadata for the preview app: a distinct accent color
 * (reused for the cue's list dot, waveform stroke, and player title) and its
 * one-line character, taken straight from the library's README.
 */

import type { SoundName } from "cuelume-native";

export const SOUND_COLORS: Record<SoundName, string> = {
  chime: "#4C8DFF",
  sparkle: "#F5A623",
  droplet: "#17A398",
  bloom: "#E0668B",
  whisper: "#9A958C",
  tick: "#D98E04",
  press: "#6B6863",
  release: "#3FA66B",
  toggle: "#8B5CF6",
  success: "#2FB380",
  error: "#E5484D",
  page: "#D97757",
  loading: "#5AB9EA",
  ready: "#22A6A0",
  pulse: "#F2994A",
  scan: "#2EC4B6",
  arrival: "#7C6FF0",
};

export const SOUND_CHARACTER: Record<SoundName, string> = {
  chime: "Soft two-note ascending bell",
  sparkle: "Quick four-note twinkle",
  droplet: "Single note gliding down",
  bloom: "Warm slow swell",
  whisper: "Soft hush with a falling tone",
  tick: "Crisp instant tick",
  press: "Dull muted knock",
  release: "Brighter springy tick",
  toggle: "Mechanical click-clack",
  success: "Warm three-note confirmation",
  error: "Soft knock and descending refusal",
  page: "Papery flick with a glass tick",
  loading: "Brief unresolved rising shimmer",
  ready: "Rising lock-on with a clear resolve",
  pulse: "Compact synthetic chirp",
  scan: "Fast three-step locator signal",
  arrival: "Rising harmonic portal",
};

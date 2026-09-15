import type { SoundName } from "cuelume-native";
import { Presets } from "react-native-pulsar";

/** One haptic preset per interaction sound, picked to match its audible character. */
export const SOUND_HAPTICS: Record<SoundName, () => void> = {
  chime: Presets.chime,
  sparkle: Presets.spark,
  droplet: Presets.dewdrop,
  bloom: Presets.bloom,
  whisper: Presets.breath,
  tick: Presets.System.selection,
  press: Presets.knock,
  release: Presets.snap,
  toggle: Presets.latch,
  success: Presets.System.notificationSuccess,
  error: Presets.System.notificationError,
  page: Presets.flick,
  loading: Presets.buildup,
  ready: Presets.ascent,
  pulse: Presets.pulse,
  scan: Presets.radar,
  arrival: Presets.herald,
};

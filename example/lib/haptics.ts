import type { SoundName } from "cuelume-native";
import { Presets } from "react-native-pulsar";

/** One haptic preset per interaction sound, picked to match its audible character. */
export const SOUND_HAPTICS: Record<SoundName, () => void> = {
  tap: Presets.knock,
  type: Presets.snap,
  select: Presets.System.selection,
  toggle: Presets.latch,
  open: Presets.bloom,
  close: Presets.dewdrop,
  success: Presets.System.notificationSuccess,
  error: Presets.System.notificationError,
  navigate: Presets.flick,
  warning: Presets.System.notificationWarning,
  loading: Presets.buildup,
  ready: Presets.ascent,
  attention: Presets.herald,
  count: Presets.radar,
};

/**
 * Per-sound display metadata for the preview app: a distinct accent color
 * (reused for the cue's list dot, waveform stroke, and player title) and its
 * one-line character, taken straight from the library's README.
 */

import type { SoundName } from "cuelume-native";

export const SOUND_COLORS: Record<SoundName, string> = {
  tap: "#4C8DFF",
  type: "#6B6863",
  select: "#D98E04",
  toggle: "#8B5CF6",
  open: "#E0668B",
  close: "#17A398",
  success: "#2FB380",
  error: "#E5484D",
  navigate: "#D97757",
  warning: "#F5A623",
  loading: "#5AB9EA",
  ready: "#22A6A0",
  attention: "#7C6FF0",
  count: "#2EC4B6",
};

export const SOUND_CHARACTER: Record<SoundName, string> = {
  tap: "Small glassy tap",
  type: "Keyboard keystroke, different every stroke",
  select: "Crisp woody detent",
  toggle: "One crisp snap with a knock of body",
  open: "Air drawing up over a light mallet note",
  close: "Air falling shut over a low, damped note",
  success: "One soft mallet chord, C–G–E spread wide",
  error: "One muted low chord, short",
  navigate: "Soft whoosh that rises, and falls going back",
  warning: "One mallet fifth, A and E",
  loading: "One soft, low note that swells and fades",
  ready: "One warm glass note in a small room",
  attention: "One high glass bell, ringing longest",
  count: "One breath that rises with the count",
};

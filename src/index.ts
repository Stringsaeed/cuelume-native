/**
 * Cuelume Native — curated interaction sounds synthesized via
 * `react-native-audio-api`, a native Web Audio API implementation. No audio
 * files, no bundled dependencies, one shared `AudioContext`.
 *
 * Imperative:
 *   import { play } from "cuelume-native";
 *   play("success");
 *   play("success", { emphasis: "strong" }); // weightier when it matters
 *
 * Hook:
 *   import { useCuelumeSound } from "cuelume-native";
 *   const sound = useCuelumeSound({ toggle: "success" });
 *   <Pressable {...sound}>Save</Pressable>
 */

export type { SoundName } from "./sounds/recipes.js";
export type { Emphasis } from "./sounds/context.js";
export type { PlayOptions } from "./audio/engine.js";
export type { ThemeName } from "./sounds/themes.js";
export { themes } from "./sounds/themes.js";
export { sounds } from "./sounds/recipes.js";
export { play, setEnabled, setTheme, setVolume } from "./audio/engine.js";
export { getSoundWaveform, type SoundWaveform } from "./audio/waveform.js";
export {
  useCuelumeSound,
  type CuelumeSoundHandlers,
  type CuelumeSoundOptions,
} from "./interactions/useCuelumeSound.js";

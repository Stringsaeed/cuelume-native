/**
 * Cuelume Native — curated interaction sounds synthesized via
 * `react-native-audio-api`, a native Web Audio API implementation. No audio
 * files, no bundled dependencies, one shared `AudioContext`.
 *
 * Imperative:
 *   import { play } from "cuelume-native";
 *   play("droplet");
 *
 * Hook:
 *   import { useCuelumeSound } from "cuelume-native";
 *   const sound = useCuelumeSound({ toggle: "success" });
 *   <Pressable {...sound}>Save</Pressable>
 */

export type { SoundName } from "./sounds/recipes.js";
export { sounds } from "./sounds/recipes.js";
export { play, setEnabled, setVolume } from "./audio/engine.js";
export {
  useCuelumeSound,
  type CuelumeSoundHandlers,
  type CuelumeSoundOptions,
} from "./interactions/useCuelumeSound.js";

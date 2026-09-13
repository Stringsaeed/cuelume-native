/**
 * `useCuelumeSound` — the React Native replacement for the web `bind()`
 * helper. There is no DOM to delegate `data-cuelume-*` attributes through on
 * native, so this hook returns the handlers you spread directly onto a
 * `Pressable` (or anything with the same press-event shape) instead:
 *
 *   const sound = useCuelumeSound({ toggle: "success" });
 *   <Pressable {...sound}>Save</Pressable>
 *
 * There is no native equivalent of `data-cuelume-hover` — touch devices
 * have no hover state, so only press/release/toggle are covered.
 */

import { useMemo } from "react";

import { play } from "../audio/engine.js";
import { isSoundName, type SoundName } from "../sounds/recipes.js";

export type CuelumeSoundOptions = {
  /** Sound played on press-in. Set to `false` to play nothing. Defaults to `"press"`. */
  press?: SoundName | false;
  /** Sound played on press-out. Set to `false` to play nothing. Defaults to `"release"`. */
  release?: SoundName | false;
  /** Sound played once a press completes. Set to `false` to play nothing. Defaults to `"toggle"`. */
  toggle?: SoundName | false;
};

export type CuelumeSoundHandlers = {
  onPressIn: () => void;
  onPressOut: () => void;
  onPress: () => void;
};

/** Resolves an option to a concrete sound name, `null` to skip playback, or `fallback`. */
export function resolveSound(
  requested: SoundName | false | undefined,
  fallback: SoundName,
): SoundName | null {
  if (requested === false) return null;
  if (requested === undefined) return fallback;
  return isSoundName(requested) ? requested : fallback;
}

/**
 * Wires `press`/`release`/`toggle` sounds onto a `Pressable`'s handlers.
 * Safe to call unconditionally — sounds default to the same names `bind()`
 * uses on the web (`press`, `release`, `toggle`).
 */
export function useCuelumeSound(options: CuelumeSoundOptions = {}): CuelumeSoundHandlers {
  const pressSound = resolveSound(options.press, "press");
  const releaseSound = resolveSound(options.release, "release");
  const toggleSound = resolveSound(options.toggle, "toggle");

  return useMemo(
    () => ({
      onPressIn: () => {
        if (pressSound) play(pressSound);
      },
      onPressOut: () => {
        if (releaseSound) play(releaseSound);
      },
      onPress: () => {
        if (toggleSound) play(toggleSound);
      },
    }),
    [pressSound, releaseSound, toggleSound],
  );
}

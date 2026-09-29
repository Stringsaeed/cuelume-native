/**
 * `useCuelumeSound` — the React Native replacement for the web `bind()`
 * helper (and its `data-cuelume-*` attributes, which have no DOM to delegate
 * through on native). It returns the handlers you spread directly onto a
 * `Pressable` (or anything with the same press-event shape) instead:
 *
 *   const sound = useCuelumeSound({ toggle: "success" });
 *   <Pressable {...sound}>Save</Pressable>
 *
 * There is no native equivalent of `data-cuelume-hover` — touch devices
 * have no hover state, so only press/release/toggle are covered.
 */

import { useMemo } from "react";

import { play, type PlayOptions } from "../audio/engine.js";
import { resolveSound, type SoundName } from "../sounds/recipes.js";

export type CuelumeSoundOptions = {
  /** Sound played on press-in. Set to `false` to play nothing. Defaults to `"tap"`. */
  press?: SoundName | false;
  /** Sound played on press-out. Set to `false` to play nothing. Defaults to `false`. */
  release?: SoundName | false;
  /** Sound played once a press completes. Set to `false` to play nothing. Defaults to `false`. */
  toggle?: SoundName | false;
  /** How much the action matters, for every sound this hook plays. Defaults to `"normal"`. */
  emphasis?: PlayOptions["emphasis"];
  /** The material for every sound this hook plays. Defaults to the active theme. */
  theme?: PlayOptions["theme"];
};

export type CuelumeSoundHandlers = {
  onPressIn: () => void;
  onPressOut: () => void;
  onPress: () => void;
};

/** Resolves an option to a concrete sound name, `null` to skip playback, or `fallback`. */
export function resolveCue(
  requested: SoundName | false | undefined,
  fallback: SoundName | false,
): SoundName | null {
  if (requested === false) return null;
  const name = resolveSound(requested === undefined ? fallback : requested);
  return name ?? (fallback === false ? null : resolveSound(fallback));
}

/**
 * Wires `press`/`release`/`toggle` sounds onto a `Pressable`'s handlers.
 * Safe to call unconditionally — a bare `useCuelumeSound()` taps on press-in
 * and stays silent on release and completion, so one touch is one sound.
 */
export function useCuelumeSound(options: CuelumeSoundOptions = {}): CuelumeSoundHandlers {
  const pressSound = resolveCue(options.press, "tap");
  const releaseSound = resolveCue(options.release, false);
  const toggleSound = resolveCue(options.toggle, false);
  const { emphasis, theme } = options;

  return useMemo(() => {
    const playOptions: PlayOptions = { emphasis, theme };
    return {
      onPressIn: () => {
        if (pressSound) play(pressSound, playOptions);
      },
      onPressOut: () => {
        if (releaseSound) play(releaseSound, playOptions);
      },
      onPress: () => {
        if (toggleSound) play(toggleSound, playOptions);
      },
    };
  }, [pressSound, releaseSound, toggleSound, emphasis, theme]);
}

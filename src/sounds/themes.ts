/**
 * Themes — finished materials for the same fourteen cues. A theme changes how a
 * cue sounds, never what it means, so every theme carries every cue.
 */

import { BUBBLE } from "./bubble.js";
import { MECH } from "./mech.js";
import { RECIPES, type SoundName, type SoundRecipe } from "./recipes.js";

export const THEMES = {
  default: RECIPES,
  mech: MECH,
  bubble: BUBBLE,
} satisfies Record<string, Record<SoundName, SoundRecipe>>;

export type ThemeName = keyof typeof THEMES;

/** The built-in theme names. */
export const themes = Object.keys(THEMES) as readonly ThemeName[];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(THEMES, value);
}

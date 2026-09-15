/** A warm "paper" theme, echoing cuelume.dev's light off-white look. */

export const theme = {
  background: "#fbfaf9",
  panel: "#f3f1ee",
  panelAlt: "#ffffff",
  border: "#e4e1dc",
  grid: "#e8e5df",
  text: "#28211c",
  textSecondary: "#8a8782",
  textMuted: "#b3afa8",
  accent: "#ff3e00",
  success: "#22c55e",
} as const;

/**
 * DynaPuff (display) for the brand name and the sound names themselves —
 * this app's product voice. Inter (body) for everything else: instructions,
 * captions, and UI chrome. Nanum Gothic Coding for numeric/tabular readouts
 * (duration, volume, %). All loaded via `expo-font`'s `useFonts` in App.tsx.
 */
export const fonts = {
  display: "DynaPuff_700Bold",
  displaySemiBold: "DynaPuff_600SemiBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  mono: "NanumGothicCoding_400Regular",
} as const;

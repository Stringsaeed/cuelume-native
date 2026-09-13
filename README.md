# Cuelume Native

Seventeen carefully designed interaction sounds for React Native & Expo. Synthesized live with [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api), with no audio files and zero bundled runtime dependencies.

Cuelume Native is a curated sound palette, not an audio engine. It gives buttons, toggles, and completed actions clear feedback without asking developers to design sounds themselves. Call `play()`, or wire a `Pressable` with `useCuelumeSound()`, done.

This is a native-only fork of [`cuelume`](https://github.com/Danilaa1/cuelume) by Daniel Belyi — same sound recipes and synthesis logic, ported from the browser's Web Audio API to `react-native-audio-api`. If you need the web version, use the original `cuelume` package instead.

## Install

```sh
npx expo install cuelume-native react-native-audio-api react-native-worklets
```

`react-native-audio-api` has native code, so **this does not work in Expo Go** — you need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:ios` / `npx expo run:android`, or an EAS dev build).

See [`example/`](./example) for a runnable Expo app exercising every sound and the hook.

## Requirements

- React Native 0.74+, React 18+.
- `react-native-audio-api` and `react-native-worklets` as peer dependencies (see Install above).
- Cuelume Native is ESM-only. Use it through native `import` or an ESM-compatible bundler (Metro handles this automatically).

## Quick start

Play a sound imperatively, from anywhere:

```ts
import { play } from "cuelume-native";

await Clipboard.setStringAsync(text);
play("success");
play("success", { volume: 0.4 }); // quieter for this play only
```

Wire a `Pressable` with press/release/toggle sounds — the native equivalent of the web package's `bind()`:

```tsx
import { Pressable, Text } from "react-native";
import { useCuelumeSound } from "cuelume-native";

function SaveButton() {
  const sound = useCuelumeSound({ toggle: "success" });
  return (
    <Pressable {...sound}>
      <Text>Save</Text>
    </Pressable>
  );
}
```

`useCuelumeSound` defaults to `press`/`release`/`toggle` for its three sounds — matching the web package's `data-cuelume-press`/`-release`/`-toggle` defaults. Pass `false` for any of them to skip that sound, or a specific `SoundName` to override it. There's no native equivalent of `data-cuelume-hover` — touch devices have no hover state.

Need sound preferences? Your app owns the settings; Cuelume Native only applies them:

```ts
import { setEnabled, setVolume } from "cuelume-native";

setVolume(0.7);    // global multiplier, clamped to 0–1
setEnabled(false); // future play attempts become no-ops
setEnabled(true);  // enable playback again
```

Cuelume Native starts enabled at full volume and does not read or write storage.

## Sounds

| Name      | Character                    | Suggested use                    |
| --------- | ---------------------------- | -------------------------------- |
| `chime`   | Soft two-note ascending bell | Confirmations                    |
| `sparkle` | Quick four-note twinkle      | Playful accents                  |
| `droplet` | Single note gliding down     | Dismiss, collapse                |
| `bloom`   | Warm slow swell              | Reveal, expand                   |
| `whisper` | Soft hush with a falling tone | Tooltips and quiet previews      |
| `tick`    | Crisp instant tick           | Nav and menu selection           |
| `press`   | Dull muted knock             | Press in                         |
| `release` | Brighter springy tick        | Press out                        |
| `toggle`  | Mechanical click-clack       | Switches, tabs                   |
| `success` | Warm three-note confirmation | After an action succeeds (e.g. copy to clipboard) |
| `error`   | Soft knock and descending refusal | Recoverable errors          |
| `page`    | Papery flick with a glass tick | Pages, galleries, carousels    |
| `loading` | Brief unresolved rising shimmer | User-initiated work starting  |
| `ready`   | Rising lock-on with a clear resolve | Content or system ready     |
| `pulse`   | Compact synthetic chirp         | Primary buttons and controls  |
| `scan`    | Fast three-step locator signal  | Menus and secondary buttons   |
| `arrival` | Rising harmonic portal          | Screen/route arrivals         |

## API

```ts
import { play, useCuelumeSound, setEnabled, setVolume, sounds, type SoundName } from "cuelume-native";
```

- **`play(name?: SoundName, options?: { volume?: number })`** — play a sound immediately. Defaults to `"chime"`; `options.volume` controls this play only.
- **`useCuelumeSound(options?: { press?, release?, toggle? })`** — returns `{ onPressIn, onPressOut, onPress }` to spread onto a `Pressable`. Each option is a `SoundName` (defaults: `press`/`release`/`toggle`) or `false` to disable that sound.
- **`setEnabled(enabled: boolean)`** — enable or disable future playback. Does not persist the preference or stop sounds already playing.
- **`setVolume(volume: number)`** — set the global volume for future playback, clamped to `0–1`. Non-finite values are ignored and preferences are not persisted.
- **`sounds`** — the list of all sound names.
- **`SoundName`** — union type of the seventeen sound names.

## Defaults that behave

- **Audible without harsh clipping.** One shared boosted output stage keeps sounds clear, softened by a limiter curve on overlapping cues. (`react-native-audio-api` has no `DynamicsCompressorNode` yet, so this is a static soft-clip curve rather than true time-based compression — plenty for these short, percussive cues.)
- **One lazy `AudioContext`.** Shared across all sounds, created on first use.
- **iOS audio session configured for you.** Sounds play under the `ambient` session category — they respect the silent switch and never interrupt music or other audio, like standard iOS UI sounds.
- **Safe fallback.** Invalid sound names, a disabled state, or an unavailable native audio module all make `play()` a silent no-op.

## License

MIT. Portions © 2026 Daniel Belyi (original [`cuelume`](https://github.com/Danilaa1/cuelume)); see [LICENSE](./LICENSE).

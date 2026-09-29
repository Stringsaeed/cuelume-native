# Cuelume Native

[![npm version](https://img.shields.io/npm/v/cuelume-native.svg)](https://www.npmjs.com/package/cuelume-native)
[![CI](https://github.com/Stringsaeed/cuelume-native/actions/workflows/ci.yml/badge.svg)](https://github.com/Stringsaeed/cuelume-native/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/npm/l/cuelume-native.svg)](./LICENSE)
![platforms](https://img.shields.io/badge/platform-iOS%20%7C%20Android-8A2BE2)

Fourteen interaction sounds for React Native & Expo, one for each interface job. Synthesized live with [`react-native-audio-api`](https://github.com/software-mansion/react-native-audio-api) — no audio files, no bundled runtime dependencies.

Cuelume Native is a curated sound palette, not an audio engine. It gives buttons, text fields, menus, dialogs, and finished actions clear feedback without asking you to design sounds yourself. Call `play()`, or wire a `Pressable` with `useCuelumeSound()` — done.

> This is a **native-only** fork of [`cuelume`](https://github.com/danielwh2/cuelume) by Daniel Belyi — same sound palette and synthesis logic, ported from the browser's Web Audio API to `react-native-audio-api`. Building for the web? Use the original [`cuelume`](https://www.npmjs.com/package/cuelume) package instead.

## Contents

- [Install](#install)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Cues](#cues)
- [Which cue?](#which-cue)
- [Counting](#counting)
- [Context-aware](#context-aware)
- [Themes](#themes)
- [Migrating from 0.2](#migrating-from-02)
- [API](#api)
- [Defaults that behave](#defaults-that-behave)
- [Example app](#example-app)
- [Contributing & releasing](#contributing--releasing)
- [License](#license)

## Install

```sh
npx expo install cuelume-native react-native-audio-api react-native-worklets
```

`react-native-audio-api` has native code, so **this does not work in Expo Go** — you need a [development build](https://docs.expo.dev/develop/development-builds/introduction/) (`npx expo run:ios` / `npx expo run:android`, or an EAS dev build).

## Requirements

- React Native 0.74+, React 18+.
- `react-native-audio-api` and `react-native-worklets` as peer dependencies (installed above).
- ESM-only — used through native `import` or an ESM-compatible bundler (Metro handles this automatically).

## Quick start

Play a sound imperatively, from anywhere:

```ts
import { play } from "cuelume-native";

await Clipboard.setStringAsync(text);
play("success");
play("success", { volume: 0.4 });         // quieter for this play only
play("success", { emphasis: "strong" });  // weightier when it matters
```

Outcome and progress cues follow what your app is actually doing, so play them from code:

```ts
play("loading");
try {
  const { warnings } = await deploy();
  play(warnings.length ? "warning" : "success");
} catch {
  play("error");
}
```

Wire a `Pressable` — the native equivalent of the web package's `bind()`:

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

A bare `useCuelumeSound()` plays `tap` on press-in and is silent on release and completion, so one touch is one sound. `press` (press-in), `release` (press-out), and `toggle` (press completed) each take a `SoundName` or `false`; `emphasis` and `theme` apply to every sound the hook plays. There's no native equivalent of `data-cuelume-hover` — touch devices have no hover state.

Need sound preferences? Your app owns the settings; Cuelume Native only applies them:

```ts
import { setEnabled, setVolume } from "cuelume-native";

setVolume(0.7);    // global multiplier, clamped to 0–1
setEnabled(false); // future play attempts become no-ops
setEnabled(true);  // enable playback again
```

Cuelume Native starts enabled at full volume and does not read or write storage.

## Cues

| Cue         | Job                                   | Character                                  |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `tap`       | Buttons, links, direct activation     | Small glassy tap                           |
| `type`      | Text entry                            | Keyboard keystroke, different every stroke |
| `select`    | Dropdowns, menus, lists               | Crisp woody detent                         |
| `toggle`    | Switching between states              | One crisp snap with a knock of body                       |
| `open`      | Menus, drawers, dialogs, disclosures  | Air drawing up over a light mallet note         |
| `close`     | Closing or dismissing                 | Air falling shut over a low, damped note               |
| `navigate`  | Routes, pages, carousels, galleries   | Soft whoosh that rises, and falls going back |
| `success`   | Confirmed completion                  | One soft mallet chord, C–G–E spread wide              |
| `warning`   | Done, but needs a look                | One mallet fifth, A and E              |
| `error`     | Recoverable failure or refusal        | One muted low chord, short            |
| `loading`   | Slow work started                     | One soft, low note that swells and fades   |
| `ready`     | A result is there, nothing confirmed  | One warm glass note in a small room             |
| `attention` | Blocked until the user answers        | One high glass bell, ringing longest        |
| `count`     | A number animating to a new value     | One breath that rises with the count       |

The material tells you the kind of event before you know which one: mallets for outcomes, glass for presence, air for motion, wood and keys for input.

## Which cue?

Pick by the job, not by the sound. Every row uses a cue that exists; emphasis and options do the rest.

| Moment | Cue |
| --- | --- |
| Primary button: save, send, submit | `tap` |
| Secondary or ghost button | `tap`, subtle |
| Destructive confirm: delete, remove | `close`, strong |
| Copy to clipboard | `success`, subtle |
| Like, star, bookmark | `toggle` |
| Undo / redo | `navigate`, subtle, `direction: "back"` / `"forward"` |
| Keystroke, delete, space, return | `type`, with `key` |
| Autocomplete accepted | `select` |
| Field fails validation | `error`, subtle |
| Menu, dropdown, or list option | `select` |
| Tab, segmented control, radio | `select`, with `direction` |
| Checkbox, switch | `toggle`, with `direction` |
| Slider or stepper step | `select`, subtle, `direction` |
| Menu or popover opens / closes | `open` / `close`, subtle |
| Dialog or drawer opens / closes | `open` / `close` |
| Accordion expands / collapses | `open` / `close`, subtle |
| Command palette | `open`, subtle, or nothing: it fires hundreds of times a day |
| Toast | the cue for what it reports, subtle |
| Route change | `navigate` |
| Back button | `navigate`, `direction: "back"` |
| Carousel, gallery, pagination | `navigate`, subtle, `direction` |
| Drag picked up / dropped / cancelled | `select` / `tap`, strong / `close`, subtle |
| Reorder a list item | `select`, `direction` |
| Saved, synced | `success`, subtle |
| Payment, publish, deploy confirmed | `success`, strong |
| Partial failure, deprecation, connection retrying | `warning` |
| Form rejected, permission denied | `error` |
| Upload, export, or build started | `loading` |
| Upload finished | `success` |
| Export ready to download | `ready` |
| Long job finished while the user was away | `ready`, strong |
| New message in an open conversation | `ready`, subtle |
| Reminder or timer due | `attention` |
| A number animates to a new value | `count`, `duration` matching the animation |
| A number counts down | `count`, `direction: "back"` |
| A live number that updates constantly: price feed, viewers | nothing |
| AI: prompt sent / generation started | `tap` / `loading`, subtle |
| AI: generation stopped | `close` |
| AI: reply finished streaming | `ready`, subtle |
| AI: tool call needs approval | `attention` |
| AI: agent task done (PR opened, file written) | `success` |
| AI: model, tool, or network failure | `error` |
| AI: suggestion accepted / rejected | `select` / `close`, subtle |
| AI: switch model or mode | `select` |
| One playful moment in a professional app, e.g. the AI model picker | the usual cue, `theme: "bubble"` |

Never play a cue per streamed token or per tool call inside an agent run. Those fire in bursts and wear any sound out; play one cue when the run ends. An animated number gets one `count` when it starts moving, never one per digit.

## Counting

Play `count` once when a number starts animating to a new value, and pass the animation's length so the roll lands with it:

```ts
play("count", { duration: 900 });                    // 0 → 1,284
play("count", { duration: 400, direction: "back" }); // 12 → 3
```

One breath rises with the number (and falls counting down), lasting as long as the roll. `duration` is in milliseconds, clamped to 300–2000; without it the roll takes 800 ms. Leave numbers that change more than about once a second, like a live price, silent.

## Context-aware

The same cue bends to how the interaction happened. Pass what you know to `play()`; anything you leave out plays the canonical cue.

| Cue        | Listens to                    | What changes |
| ---------- | ----------------------------- | ------------ |
| `type`     | `key`, typing speed           | Fast typing gets lighter. Space sounds bigger, Enter heaviest, Backspace and Delete lower. |
| `select`   | `direction`                   | A later option rises slightly and an earlier one falls. |
| `tap`      | `input`, rapid repeats        | Touch sounds softer and rounder than a mouse click, keyboard activation shorter, a pen crisper. Quick repeats get lighter. |
| `navigate` | `direction`                   | `back` plays the whoosh falling instead of rising. |
| `toggle`   | `direction`                   | `back` plays its glides backwards: `default` and `mech` knock upward, `bubble`'s cork sinks. |
| `count`    | `duration` and `direction`    | The roll stretches to the animation; `back` falls. |

Every change is small and bounded, so a cue always sounds like itself.

```ts
play("navigate", { direction: "back" });
play("select", { direction: "forward" });
play("type", { key: "delete" });
play("tap", { input: "touch", emphasis: "subtle" });
```

A field a cue doesn't listen to is ignored, and an unknown value plays the cue as normal.

The one thing Cuelume can't infer is how much an action matters. Set that with emphasis:

```ts
play("success", { emphasis: "strong" }); // publish, pay, send
play("success", { emphasis: "subtle" }); // autosave, a small confirmation
```

Each level is its own arrangement of the cue, so fourteen cues give you 42 distinct sounds to choose from. `subtle` strips the ornament: the glass tap loses its nail tick, typing becomes a quiet laptop keyboard, success turns into a felt mallet. `strong` adds a layer only it plays: a bigger glass, a deep mechanical bottom-out, an octave held under the second success note. Emphasis is not a volume knob: `volume` still scales loudness on its own, and the two combine. Invalid values play as `normal`.

Context comes from what you pass and the timing of recent plays. Nothing is stored, sent, or kept across launches, and Cuelume never guesses importance from anything else.

## Themes

Every cue comes in four finished materials. `default` is warm: glass, wood, air, and soft mallets. `mech` is dry and precise: a shutter click, a ratchet detent, a latch, struck metal. `bubble` is playful, and every cue is its own gesture: a knock, a drip, a cork, a gulp, a kalimba, a zip. `press` is one premium switch: every interaction is a crisp click over the knock of whatever it moves, and tap lets its body ring like a trackpad under a finger. Outcomes are not touched, so they do not click: success, error, warning, ready and attention are that warm note on its own, with a chord that says what happened, and `loading` is one soft, low note that swells and fades. Whatever the theme, every cue is one sound: it strikes once. All four have the same fourteen cues, context, and emphasis, and they're level-matched, so switching changes the material, not the volume.

```ts
import { play, setTheme } from "cuelume-native";

setTheme("mech");    // future plays use the mech material
setTheme("default");

play("select", { theme: "bubble" }); // one playful moment; the theme stays default
```

`setTheme` applies to sounds played after the call. The `theme` option applies to one play and leaves the active theme alone. Unknown names are ignored, and like volume, the choice isn't stored.

`default` and `mech` sit in a calm register for all-day use. Reach for `bubble` when a product, or one moment in it, should feel playful, and `press` when it should feel like touching hardware: clicky, deep and precise.

## API

```ts
import { play, useCuelumeSound, setEnabled, setVolume, setTheme, sounds, themes, getSoundWaveform, type SoundName, type Emphasis, type ThemeName, type PlayOptions } from "cuelume-native";
```

| Export | Signature | Description |
| --- | --- | --- |
| `play` | `(name?: SoundName, options?: PlayOptions) => void` | Play a cue immediately. Defaults to `"tap"`. Options apply to this play only: `volume` (`0–1`), `emphasis` (`"subtle" \| "normal" \| "strong"`), `direction` (`"forward" \| "back"`), `key` (`"printable" \| "space" \| "delete" \| "enter"`), `input` (`"mouse" \| "touch" \| "pen" \| "keyboard"`), `theme`, and `duration` (ms, clamped to `300–2000`, for `count`). |
| `useCuelumeSound` | `(options?: { press?, release?, toggle?, emphasis?, theme? }) => { onPressIn, onPressOut, onPress }` | Returns handlers to spread onto a `Pressable`. `press`/`release`/`toggle` are each a `SoundName` (defaults: `tap`/off/off) or `false`. |
| `setEnabled` | `(enabled: boolean) => void` | Enable or disable future playback. Doesn't persist the preference or stop sounds already playing. |
| `setVolume` | `(volume: number) => void` | Set the global volume for future playback, clamped to `0–1`. Non-finite values are ignored. |
| `setTheme` | `(theme: ThemeName) => void` | Switch the material of future playback. Unknown names are ignored; the choice isn't persisted. |
| `getSoundWaveform` | `(name: SoundName, options?: { resolution?: number; theme?: ThemeName }) => Promise<SoundWaveform>` | Renders `name`'s real synthesis output offline and returns a compact waveform preview of it — `{ peaks: Float32Array, duration: number, sampleRate: number }`. `peaks` is `resolution` samples (default 180), normalized to its own peak. Independent of `setVolume()` and `setTheme()`; pass `theme` to preview another material. Throws for an unknown sound name. Useful for building a custom sound picker or preview UI — see [`example/`](./example) for one built with `react-native-skia` + `react-native-reanimated`. |
| `sounds` | `readonly SoundName[]` | The fourteen cue names. |
| `themes` | `readonly ThemeName[]` | The built-in theme names, `["default", "mech", "bubble", "press"]`. |
| `SoundName` / `Emphasis` / `ThemeName` / `PlayOptions` | `type` | Union and option types. |

## Migrating from 0.2

The upstream 0.3 palette replaces the seventeen sounds with the fourteen cues above. Until 1.0, the old names still play the cue that now does their job, and TypeScript marks them deprecated.

| 0.2 name                                         | Plays      |
| ------------------------------------------------ | ---------- |
| `chime`, `sparkle`                               | `success`  |
| `press`, `release`, `pulse`                      | `tap`      |
| `tick`, `whisper`, `scan`                        | `select`   |
| `bloom`                                          | `open`     |
| `droplet`                                        | `close`    |
| `page`, `arrival`                                | `navigate` |
| `toggle`, `success`, `error`, `loading`, `ready` | unchanged  |

`play()` with no name now plays `tap` instead of `chime`. `useCuelumeSound()` no longer plays a sound on release or completion by default, since `press` and `release` are now the same cue.

## Defaults that behave

- **One cue per touch.** Playing a cue again releases its last play instead of stacking on it; other cues ring on.
- **Struck, not played back.** Tones are modelled on real bars: each overtone dies faster the higher it is, and a brief mallet contact starts the note. Every play of a frequent cue is one strike, a little harder or softer than the last, so no two sound identical. Outcome cues play the same every time, so their meaning never blurs.
- **One faint room.** Every cue rings very faintly into one shared, short stereo room (about 22 dB down), which places it in the space around the listener rather than inside their head. `success` and `ready` ring into it a little more.
- **Audible without harsh clipping.** One shared boosted output stage keeps sounds clear, softened by a limiter curve on overlapping cues. (`react-native-audio-api` has no `DynamicsCompressorNode` yet, so this is a static soft-clip curve rather than true time-based compression — plenty for these short, percussive cues.)
- **One lazy `AudioContext`.** Shared across all sounds, created on first use.
- **iOS audio session configured for you.** Sounds play under the `ambient` session category — they respect the silent switch and never interrupt music or other audio, like standard iOS UI sounds.
- **Safe fallback.** Invalid sound names, a disabled state, or an unavailable native audio module all make `play()` a silent no-op.

## Example app

[`example/`](./example) is a real Expo dev-client app exercising every sound plus the hook — see [`example/README.md`](./example/README.md) for how to run it.

## Contributing & releasing

Issues and PRs are welcome. Maintainers: see [`RELEASING.md`](./RELEASING.md) for the release process.

## License

MIT. Portions © 2026 Daniel Belyi (original [`cuelume`](https://github.com/danielwh2/cuelume)); see [LICENSE](./LICENSE).

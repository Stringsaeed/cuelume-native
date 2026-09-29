# Cuelume: Professional Palette

**Date:** 2026-09-23 · **Status:** built 2026-09-23, awaiting Daniel's listening sign-off; not released · **Ships in:** the
first publish after `0.2.2`

## Goal

Daniel wants Cuelume to be professional sound feedback that large products can
use for almost anything: a dashboard used all day, or a CLI the size of
Vercel's. Two things stand in the way:

- The palette is tuned for a demo. Glass partials reach 8 kHz and clicks sit at
  4.7–6.5 kHz: sparkly on first listen, tiring by the afternoon.
- Some common jobs have no cue. Warnings, slow work, finished results, and an
  agent blocked on the user are faked with the nearest sound or skipped.

The answer is not a sound library. Cuelume stays near 15 cues at most and
covers the rest by adapting them: emphasis, interaction context, and a
documented map from use case to cue.

## Decisions

1. Retune both themes into a calmer register, with the same materials.
2. Grow the palette from 9 to 13 cues: `warning`, `loading`, `ready`,
   `attention`. Two slots of headroom stay empty. (One has since gone to `count`: see 2026-09-23-bubble-and-count-design.md.)
3. `play()` accepts the context bindings already detect: `direction`, `key`,
   `input`.
4. Ship a use-case map in the README and `agents.md`.
5. Terminal playback (a Node runtime) is the next spec, not this one. It will
   reuse these recipes and options.
6. Everything built since `0.2.2` ships together with this work, in one
   publish, so nobody hears the old tuning.

## 1. Retune

Applies to `default` and `mech`.

- **Ceiling.** No layer's centre (a tone's frequency, a noise filter's
  frequency, or a glide's end) above 5 kHz. This removes tap's 8 kHz partial
  and 6.5 kHz tick and mech's 7 kHz tick. Per-play variation and context may
  still move a layer a few percent above it.
- **Tonal cues move down 4 semitones:**

  | Cue | Now | Retuned |
  | --- | --- | --- |
  | `success` | E5–B5 (659, 988 Hz) | C5–G5 (523, 784 Hz) |
  | `error` | A4–F♯4 (440, 370 Hz) | F4–D4 (349, 294 Hz) |
  | `tap` glass | 1480 Hz, partials 2.76× and 5.4× | 1175 Hz, 2.76× partial only |
  | mech `success` | 880–1319 Hz | 698–1047 Hz |

  Mallet 4× partials follow their fundamentals.
- **Noise clicks move down 15–20%.** Type's click 4.7 → 3.9 kHz, select's
  detent 3.4 → 2.8 kHz, and the rest in proportion.
- **Air sweeps narrow.** `navigate` 450→2400 Hz becomes 400→1800 Hz; `open`
  and `close` narrow the same way.
- **Tails about 20% shorter.** `success` keeps its small room; no other cue
  gains one.
- **Levels re-matched afterwards** on the loudest 30 ms, so the retune changes
  colour, not loudness. Lower pitches can sound quieter than the meter says,
  so Daniel's ears have the last word.

## 2. Four new cues

| Cue | Job | `default` | `mech` |
| --- | --- | --- | --- |
| `warning` | Done, but needs a look: partial failure, deprecation, a CLI warning | Mallet, one note struck twice. Success rises, error falls, warning stays level | Two dry metal taps at one pitch |
| `loading` | Slow work started: build, export, generation | One muted note that swells in and is never struck. Nothing lands | A latch drawn back and held: a soft slide with no catch |
| `ready` | A result is there, with nothing confirmed: a reply finished, a job produced output | One glass note, lower and longer than `tap`, in success's small room | One dry struck bar, lower than mech `success` |
| `attention` | Blocked on the user: an approval, a choice, input | Two glass notes rising a fourth, spaced like a call. It asks, so it rises | Two metal taps rising a fourth, same spacing |

`success` means an operation the user asked for is confirmed. `ready` means
something is now there for them. An upload that finished is `success`; an
export ready to download is `ready`.

**Material tells the family before the cue.** In `default`:

- Mallet is outcomes: `success`, `error`, `warning`.
- Glass is presence: `tap`, `ready`, `attention`.
- Air is motion: `open`, `close`, `navigate`, `loading`.
- Wood and keys are input: `type`, `select`, `toggle`.

**Emphasis** works as it does for the nine: subtle drops ornament layers, and
each cue has one layer only strong plays.

**Aliases.** `loading` and `ready` stop being aliases and become canonical
cues, so v0.2 apps that call them get a real cue back. The other twelve
aliases are unchanged.

**Level.** `attention` is level-matched like every other cue. A host that needs
it heard from another tab passes `strong`.

**Bindings.** Like `success` and `error`, the new cues report results, so
hosts call them from code. No new `data-cuelume-*` attributes. An existing
attribute can still name one, for example `data-cuelume-tap="loading"`.

**Blind-listening gate.** Each new cue must be told apart from its nearest
neighbour without visual context: `warning` from `error`, `ready` from
`success`, `attention` from `success`, `loading` from `open` at subtle. A cue
that fails is redesigned before release.

## 3. Context in `play()`

`PlayOptions` gains three optional fields, the context bindings already
detect:

```ts
type PlayOptions = {
  volume?: number;
  emphasis?: Emphasis;
  direction?: "forward" | "back";
  key?: "printable" | "space" | "delete" | "enter";
  input?: "mouse" | "touch" | "pen" | "keyboard";
};

play("navigate", { direction: "back" });
play("select", { direction: "forward" });
play("type", { key: "delete" });
play("tap", { input: "keyboard", emphasis: "subtle" });
```

- `direction` shapes `select` (±5% pitch, as bindings do now) and `navigate`,
  which is new: `back` plays the sweep falling instead of rising, by swapping
  the start and end of every gliding layer.
- `key` shapes `type`. `input` shapes `tap`. Both reuse the existing tables in
  `context.ts`.
- A field on a cue it doesn't shape is ignored. An unknown value falls back to
  the canonical sound. `play()` never throws, as with an unknown name.
- Cadence stays automatic: `play()` already lightens fast repeats.
- Bindings keep detecting context as they do now. A binding way to mark a link
  as "back" is left out until someone asks.

## 4. Use-case map

A "Which cue?" section in the README and in the site's `public/agents.md`, so
coding agents pick cues the way a person would. The `/docs` page mirrors it.
Draft:

| Moment | Cue |
| --- | --- |
| **Actions** | |
| Primary button: save, send, submit | `tap` |
| Secondary or ghost button | `tap`, subtle |
| Destructive confirm: delete, remove | `close`, strong |
| Copy to clipboard | `success`, subtle |
| Like, star, bookmark | `toggle` |
| Undo / redo | `navigate`, subtle, `direction: "back"` / `"forward"` |
| **Text** | |
| Keystroke, delete, space, return | `type` (bindings set `key`) |
| Autocomplete accepted | `select` |
| Field fails validation | `error`, subtle |
| **Choices** | |
| Menu, dropdown, or list option | `select` |
| Tab, segmented control, radio | `select` (bindings set `direction`) |
| Checkbox, switch | `toggle` |
| Slider or stepper step | `select`, subtle, `direction` |
| **Surfaces** | |
| Menu or popover opens / closes | `open` / `close`, subtle |
| Dialog or drawer opens / closes | `open` / `close` |
| Accordion expands / collapses | `open` / `close`, subtle |
| Command palette | `open`, subtle, or nothing: it fires hundreds of times a day |
| Toast | the cue for what it reports, subtle |
| **Movement** | |
| Route change | `navigate` |
| Back button | `navigate`, `direction: "back"` |
| Carousel, gallery, pagination | `navigate`, subtle, `direction` |
| Drag picked up / dropped / cancelled | `select` / `tap`, strong / `close`, subtle |
| Reorder a list item | `select`, `direction` |
| **Outcomes** | |
| Saved, synced | `success`, subtle |
| Payment, publish, deploy confirmed | `success`, strong |
| Partial failure, deprecation | `warning` |
| Connection lost, retrying | `warning` |
| Form rejected, permission denied | `error` |
| **Background work** | |
| Upload, export, or build started | `loading` |
| Upload finished | `success` |
| Export ready to download | `ready` |
| Long job finished while the user was away | `ready`, strong |
| New message in an open conversation | `ready`, subtle |
| Reminder or timer due | `attention` |
| **AI** | |
| Send a prompt | `tap` |
| Generation started | `loading`, subtle |
| Stop generation | `close` |
| Reply finished streaming | `ready`, subtle |
| Tool call needs approval | `attention` |
| Agent task done: PR opened, file written | `success` |
| Model, tool, or network failure | `error` |
| Suggestion accepted / rejected | `select` / `close`, subtle |
| Switch model or mode | `select` |
| Each streamed token or tool call | nothing |
| **Terminal** (Node runtime, next release) | |
| Long command started | `loading` |
| Build or deploy done / failed | `success` / `error`, strong |
| Warnings in the output | `warning` |
| Prompt waiting for input | `attention` |
| Each step of a multi-step run | nothing; one cue at the end |

**Growth rule.** Every row maps to a cue that exists. When three or more rows
strain one cue, that is the case for spending a headroom slot, and it goes
through the same blind-listening gate.

## Out of scope

- **Node runtime.** Rendering recipes to PCM and handing a WAV to the OS
  player (`afplay`, `paplay`/`aplay`, PowerShell). Own spec, after this ships.
- **Binding syntax for direction** on `navigate`.
- **Headroom cues.** None are named in advance.
- **Site update.** Follows the library as its own step: the studio's number
  keys stop at 9 of 13 cues, and the Save flow's Sync button fakes `warning`
  with a subtle `error` today.

## Verification

- **Tests** (`test/runtime.test.mjs`, mutation-checked against `dist` like the
  existing suite):
  - Both themes carry the same 13 cues.
  - No layer in either theme is centred above 5 kHz.
  - `direction`, `key`, and `input` passed to `play()` change the rendered
    layers; `back` reverses `navigate`'s glide; unknown values render the
    canonical sound.
  - `loading` and `ready` resolve to themselves; the twelve remaining aliases
    are unchanged.
- **Audition.** Offline renders, before and after, of 13 cues × 3 emphases ×
  2 themes, plus a level report. Daniel signs off by ear, including the
  blind-listening pairs above, on laptop speakers, a phone, and earbuds.
- **Bundle.** Measured min+gzip after the build. The estimate is 5.2–5.5 kB,
  up from 4.7 kB. Daniel accepted the growth: the site's `SizeChart` badge
  and `agents.md` change from "<5 kB"/"under 5 kB" to the measured figure.

## Release

One publish carries the v0.3 palette, v0.4 adaptive cues, v0.5 `mech`, the
retune, and the 13-cue palette. Planned as `0.3.0`. The site's `cuelume`
dependency goes from `file:../tactile` back to `^0.3.0` before it deploys.
`1.0` still waits for use in real applications, as the 2026-07-17 spec says.

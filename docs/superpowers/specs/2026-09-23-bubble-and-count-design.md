# Cuelume: Bubble Theme and Count

**Date:** 2026-09-23 · **Status:** built 2026-09-23, awaiting Daniel's listening sign-off; not released · **Ships in:** the
same first publish after `0.2.2` as the professional palette (planned `0.3.0`)

## Goal

Daniel wants playful sound as an option: a bubbly material an app can switch
on everywhere, or for one moment inside an otherwise professional product,
such as picking an AI model. He also wants animated numbers to sound, without
breaking the rule that Cuelume never sounds events that fire in bursts.

## Decisions

1. A third theme, `bubble`, carries every cue. The default stays professional;
   `bubble` is opt-in.
2. Opt in app-wide with `setTheme("bubble")`, or for one play with a `theme`
   option on `play()` and a `data-cuelume-theme` attribute.
3. A 14th cue, `count`, sounds a number animating to a new value: one call per
   count, never one per digit, stretched to the animation by a `duration`
   option. It spends one of the professional palette's two headroom slots.
4. `toggle` accepts `direction`, so switching off can sound different.
   Bindings detect it.
5. Character: droplets and pops. Not a toy box of boings, wobbles or slide
   whistles.

## 1. The `bubble` theme

Built from three sounds:

- **Bloop.** A sine that glides up about 1.5× in 30–60 ms: what a real bubble
  sounds like as it surfaces.
- **Pop.** A low-passed noise burst of 2–5 ms.
- **Fizz.** Soft low-passed noise, like carbonation. Only `loading` uses it.

| Cue | `bubble` |
| --- | --- |
| `tap` | One small bloop |
| `type` | A tiny pop; pitch varies more than in the other themes |
| `select` | A pop plus a bloop, pitched ±5% by direction |
| `toggle` | A bloop up; switching off sinks |
| `open` | Two bloops rising |
| `close` | One bloop sinking |
| `navigate` | Three quick bloops rising; `back` sinks |
| `success` | Two bubbles rising a fifth |
| `error` | A bubble sinking twice, falling |
| `warning` | Two bloops at one pitch |
| `loading` | Fizz that swells; nothing lands |
| `ready` | One round bloop with a little room |
| `attention` | Two bloops rising a fourth, spaced like a call |
| `count` | A stream of bubbles that thins out and lands on a pop |

**Rules kept from the other themes:**

- Tone layers are sines. No layer is centred above 5 kHz.
- Only `success` and `ready` have a room (shimmer).
- Contours hold: success rises, error falls, warning stays level, attention
  rises.
- Level-matched to the default palette on the loudest 30 ms.
- Emphasis works as elsewhere: subtle drops ornament layers, and each cue has
  one layer only strong plays.

**Rules that change:**

- Tone layers may glide in `bubble` only. "Tones are sines that never glide"
  becomes a rule for `default` and `mech`.
- Input and surface cues (`tap`, `toggle`, `open`, `close`, `navigate`,
  `count`) vary in pitch by ±6% per play, about twice the other themes, so no
  two bubbles match; `type` varies ±10%. `select` varies ±2%, so its ±5%
  direction stays audible. Outcome and progress cues vary in level only, so
  their contours hold: warning's two notes stay one pitch.
- "Cuelume sits in a calm register for all-day use" is scoped to `default` and
  `mech`. `bubble` is the opt-in exception.

## 2. `count`

**Job.** A number animates to a new value: a stat reveal, a price change, a
score. The host calls `count` once, when the number starts moving.

**Shape.** About 10 ticks whose spacing widens the way a number eases out,
ending on a landing layer. Under them, one quiet bed layer glides up.
`direction: "back"` plays every glide reversed, through the same `sweep` that
reverses `navigate`, so counting down falls.

| Theme | Ticks | Bed | Lands on |
| --- | --- | --- | --- |
| `default` | Soft wooden ticks, like a fine dial | Air | A quiet glass note |
| `mech` | Dry odometer-drum ticks | A slide | A detent |
| `bubble` | A stream of bubbles thinning out | None; each bloop glides | A pop |

**Duration.**

- Each theme's `count` is written at 800 ms.
- `duration` (milliseconds) scales every layer's start time and the bed's
  length. Ticks keep their own length, so a short count rolls and a long one
  ticks.
- Clamped to 300–2000 ms. The range is a judgement, not a measurement.
- Missing or invalid: 800 ms. Every other cue ignores `duration`.
- The tick count is fixed. Generating ticks from `duration` at a constant rate
  is left out; 10 ticks over 2 s sound sparse, and that is accepted.

**Emphasis.** Subtle drops every other tick. The bed stays at every emphasis,
because it carries direction. Strong adds a low thump under the landing.

**Bursts.** One call per count. A number that changes more than about once a
second (a live price, a viewer count) gets no sound. This is documentation,
not code: a new `count` while one plays simply starts another.

## 3. API

```ts
type PlayOptions = {
  volume?: number;
  emphasis?: Emphasis;
  direction?: "forward" | "back";
  key?: "printable" | "space" | "delete" | "enter";
  input?: "mouse" | "touch" | "pen" | "keyboard";
  /** This play only; the active theme is unchanged. */
  theme?: ThemeName;
  /** Milliseconds, for `count`. */
  duration?: number;
};

play("select", { theme: "bubble" });
play("count", { duration: 900 });
play("count", { duration: 400, direction: "back" });
play("toggle", { direction: "back" });
setTheme("bubble");
```

```html
<div data-cuelume-theme="bubble">
  <select data-cuelume-select>…</select>
</div>
```

- `theme`: an unknown value plays the active theme. It never throws.
- `data-cuelume-theme` works on the element or any ancestor, like
  `data-cuelume-emphasis`; the innermost wins.
- `toggle` with `direction: "back"` means switching off. It reverses glides, so
  it is audible only in `bubble`; the other themes' toggles do not glide.
- Bindings set `toggle`'s direction from the element's state when the click
  arrives (the listener runs in the capture phase):
  - A native checkbox or radio has already changed: `checked` is forward,
    unchecked is back.
  - Otherwise `aria-checked` or `aria-pressed` has not changed yet: `"true"`
    means switching off (back), `"false"` means switching on (forward).
    Neither attribute: no direction.
  - Known limit: a custom switch that updates its ARIA state before the click
    (on `pointerdown`, say) plays reversed.
- No `data-cuelume-count`. A count starts from code when the animation starts,
  like `success`.
- `themes` gains `bubble`; `sounds` gains `count` at the end. Code with a
  `Record<SoundName, …>` map needs one more entry, in the same release note as
  the four new cues.

## 4. Use-case map additions

In the README, `public/agents.md` and `/docs`:

| Moment | Cue |
| --- | --- |
| **Numbers** | |
| A number animates to a new value | `count`, `duration` matching the animation |
| A number counts down | `count`, `direction: "back"` |
| A live number that updates constantly: price feed, viewers | nothing |
| **Choices** (changed row) | |
| Checkbox, switch | `toggle` (bindings set `direction`) |
| **Playful moments** | |
| One playful moment in a professional app, e.g. the AI model picker | the usual cue, `theme: "bubble"` |

## Out of scope

- **Site update.** The studio's theme keycaps render from `themes`, so a third
  appears on its own; the rest of the site follows as its own step.
- `data-cuelume-count`.
- Generating ticks from `duration`.
- The Node runtime (next spec, as before).

## Verification

- **Tests** (`test/runtime.test.mjs`, mutation-checked against `dist`):
  - All three themes carry the same 14 cues.
  - No layer in any theme is centred above 5 kHz; tones are sines everywhere;
    tones glide only in `bubble`.
  - Outcome contours hold in every theme, `bubble` included.
  - `theme` on `play()` renders that theme without changing the active one;
    an unknown value plays the active one.
  - `data-cuelume-theme` on an ancestor applies; the innermost wins.
  - `duration` scales start times and leaves tick lengths alone; it clamps at
    300 and 2000 ms; invalid values play at 800 ms.
  - `count` with `direction: "back"` falls in every theme.
  - A native checkbox being unchecked and an ARIA switch being switched off
    both play `toggle` with `back`.
- **Audition.** Offline renders: the `bubble` palette, 14 cues × 3 emphases;
  `count` at 300, 800 and 2000 ms, up and back, in all three themes; a model
  picker demo, default against `bubble`. Level report from the existing
  script. Blind pairs: `count` against `navigate` at subtle, in every theme;
  in `bubble`, `success` against `ready`, and the professional palette's four
  pairs (`warning`/`error`, `ready`/`success`, `attention`/`success`,
  `loading`/`open` at subtle).
- **Bundle.** Measured min+gzip after the build. Estimate 6.2–6.5 kB, up from
  5.2 kB, from `mech` measuring 0.95 kB on its own. The site's `SizeChart`
  badge and `agents.md` take the measured figure.

## Release

Ships with the professional palette in one publish, planned as `0.3.0`;
nothing has been published since `0.2.2`. Daniel's listening sign-off covers
both in one session: the retune, the four new cues, `bubble` and `count`.

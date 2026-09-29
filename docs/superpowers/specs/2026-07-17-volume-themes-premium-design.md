# Cuelume: Compact Adaptive Cues, Event-Aware Bindings, `mech`, and 1.0

**Updated:** 2026-09-23 · **Status:** v0.3, v0.4 prototype, and v0.5 `mech` built; none released · **Target:** `v0.3` → `v0.4` → `v0.5` → `v1.0`

**Superseded in part** by [Professional Palette](2026-09-23-professional-palette-design.md):
the palette grows to 13 cues and is retuned, and everything built so far ships
in one publish instead of the staged rollout below.

## Decision

Cuelume will finalize a smaller semantic palette and its adaptive behavior
before work begins on the `mech` theme.

The release order is:

1. Replace the broad 17-sound palette with nine semantic interaction cues.
2. Add first-class declarative bindings for typing and selection.
3. Validate the new default sounds in real interfaces.
4. Turn each static cue into a bounded, context-aware cue family.
5. Design `mech` only after cue names, jobs, bindings, and adaptation rules are
   stable.
6. Graduate the proven API and two finished themes to `1.0`.

No `mech` recipes should be implemented against the current 17-sound palette
or against an unfinished adaptive model. Doing so would multiply sound-design
work for cues and variations that may still change.

## Product direction

Cuelume is a compact interaction-sound system for web interfaces. It is not a
large sound-effects collection and not a general-purpose audio engine.

The palette should prioritize cues that are:

- Common in product interfaces.
- Semantically clear to developers.
- Distinct from one another when heard without visual context.
- Pleasant under repeated use.
- Difficult to replace with a generic click or notification tone.

Apps choose:

- Which semantic cue plays.
- How loud playback is.
- Whether sound is enabled.
- Whether an action has subtle, normal, or strong emphasis.
- Which finished theme is active, once themes ship.

Cuelume decides how each cue responds to interaction cadence, input method,
selection direction, key role, and repetition. Recipes, oscillators,
frequencies, envelopes, layers, filters, variation logic, and custom theme
authoring remain implementation details.

## 1. Finalize the compact cue palette

The canonical palette will contain nine cues:

| Cue | Semantic job | Default-theme character |
| --- | --- | --- |
| `tap` | Buttons, links, and direct activation | Small glassy tap: a nail tick, then a brief shimmering ring |
| `type` | Text-entry feedback | Keyboard keystroke (click, clack, thock, faint return), different every stroke |
| `select` | Dropdown, menu, and list selection | Crisp woody detent |
| `toggle` | Switching between states | Clear two-part state change |
| `open` | Opening menus, drawers, dialogs, and disclosures | Air drawing up, then a light latch |
| `close` | Closing or dismissing UI | Air falling into a soft thud |
| `success` | Confirmed successful completion | Two soft mallet notes rising a fifth |
| `error` | Recoverable failure or refusal | Two muted mallet notes falling a minor third |
| `navigate` | Route, page, carousel, or gallery movement | Soft whoosh that rises as it passes; direction can later reverse it |

Names describe interface jobs rather than synthesis styles. A theme may change
the material of a cue, but not its meaning. For example, `open` may sound
like soft air and a light latch in `default` and like a dry, precise latch in
`mech`.

### Sound direction

Every cue must sound premium and belong in professional software. Nothing
playful, cartoonish, or sci-fi. In practice:

- Clicks, knocks, and air are filtered noise.
- Tones are soft mallets (a sine plus a quiet partial at four times its pitch,
  as on a marimba bar) or glass (sines at the glass-bar ratios 1 and 2.76,
  with the fundamental doubled a few cents apart so it shimmers). No layer is
  centred above 5 kHz. No
  triangle, square, or sawtooth waveforms.
- No audible tone slides in pitch. Glides stay on noise filters or sit below
  about 40 ms, where they read as weight rather than a boing.
- At most two notes per cue. Three-note arpeggios read as a game.
- Rooms are short enough to hear as space, not as echo repeats.
- Repeated cues vary within fixed bounds instead of repeating exactly.

### Sounds removed or combined

The current names migrate as follows during `v0.3`:

| Existing name | Canonical replacement |
| --- | --- |
| `chime` | `success` |
| `sparkle` | `success` |
| `droplet` | `close` |
| `bloom` | `open` |
| `whisper` | `select` |
| `tick` | `select` |
| `press` | `tap` |
| `release` | `tap` |
| `toggle` | `toggle` |
| `success` | `success` |
| `error` | `error` |
| `page` | `navigate` |
| `loading` | `tap` |
| `ready` | `success` |
| `pulse` | `tap` |
| `scan` | `select` |
| `arrival` | `navigate` |

The mapping is for migration compatibility, not a claim that every old cue has
an exact semantic equivalent. `loading` has no equivalent at all: work
starting is not a panel opening, so it falls back to the neutral `tap`
acknowledgement rather than borrowing `open`'s meaning.

### Palette release gate

Before the palette is considered final:

- All nine cues must be distinguishable in blind listening checks.
- `tap`, `type`, `select`, and `toggle` must remain pleasant during rapid use.
- `open` and `close` must feel related but clearly directional.
- `success` and `error` must communicate outcomes without becoming alerts or
  fanfares.
- `navigate` must work for both route changes and smaller gallery movement.
- Every cue must remain clear at global volume `0.3`.
- Listening checks must cover laptop speakers, a phone speaker, and earbuds.

## 2. Add event-aware declarative bindings

The imperative API remains intentionally small:

```ts
play(name?, options?);
bind(root?);
setEnabled(enabled);
setVolume(volume);
sounds;
```

`bind()` gains useful behavior through explicit data attributes rather than a
larger configuration object.

| Attribute | Fires on | Default cue |
| --- | --- | --- |
| `data-cuelume-tap` | `click` | `tap` |
| `data-cuelume-type` | eligible `keydown` | `type` |
| `data-cuelume-select` | native `change`, otherwise `click` | `select` |
| `data-cuelume-toggle` | `click` | `toggle` |
| `data-cuelume-open` | `click` | `open` |
| `data-cuelume-close` | `click` | `close` |
| `data-cuelume-navigate` | `click` | `navigate` |

Outcome cues should normally remain imperative because they must follow the
actual result of an operation:

```ts
try {
  await save();
  play("success");
} catch {
  play("error");
}
```

As today, an empty attribute uses its default cue and an explicit value may
select any canonical cue:

```html
<button data-cuelume-tap>Save</button>
<input data-cuelume-type>
<select data-cuelume-select>...</select>
<button data-cuelume-open>Open menu</button>
<button data-cuelume-tap="open">Show details</button>
```

### Typing behavior

Typing sound must be deliberately constrained:

- Only elements explicitly marked with `data-cuelume-type` participate.
- Password fields never produce typing sounds.
- Modifier-only keys, shortcut chords, composition events, and held-key repeats
  are ignored, except Backspace and Delete: holding either keeps sounding while
  it deletes, and modified deletes (word, line) count as edits.
- Backspace and Delete stay silent when there is nothing to delete, such as
  an empty field or a caret at the matching edge.
- Printable editing input may include Backspace, Delete, Enter, and Space when
  appropriate.
- Rapid input is rate-limited to avoid clipping and excessive node creation.
- Every keystroke varies at random within fixed bounds (about ±7% pitch and
  ±20% level), so fast typing never becomes a machine-gun effect.
- Variation is curated internally and is not exposed as API configuration.

### Selection behavior

- A marked native `<select>` plays on `change`, not when merely opened.
- A marked custom option or menu item plays on its activation `click`.
- Correctly implemented keyboard activation therefore receives the same sound.
- Delegation must continue to support dynamically added and replaced elements.
- One user action must never produce duplicate cues.

### Hover behavior

Hover is not part of the canonical binding system. Passive exploration is too
frequent and too easy to make noisy. Developers may still call `play()` from a
custom hover interaction when their product genuinely benefits from it.

## 3. Provide one migration release

`v0.3` is the palette and binding transition release.

For `v0.3` only:

- Existing sound names remain accepted by `play()` as deprecated aliases to
  the canonical replacements above.
- Existing `data-cuelume-hover`, `data-cuelume-press`, and
  `data-cuelume-release` bindings continue to work for migration, with two
  changes so aliasing does not produce wrong or doubled cues:
  - An empty `data-cuelume-hover` plays `select`, not `chime`. `chime` now
    means `success`, and hovering is not a success.
  - `data-cuelume-release` stays silent when the same element also carries
    `data-cuelume-press`. Both now resolve to `tap`, so the old
    press/release pair would otherwise play `tap` twice per click. The pair
    plays one `tap`, on press.
- `play()` with no name plays `tap`, replacing the old `chime` default.
- `sounds` documents and returns the nine canonical names, not deprecated
  aliases.
- Documentation leads with the new API and includes a concise migration table.
- No new feature should use a deprecated name or binding.

The deprecated aliases and bindings are removed when the contract is finalized
for `1.0`. This gives existing users a release window without carrying the old
palette into the stable API.

## 4. Keep sound preferences host-owned

The existing preference APIs remain sufficient:

```ts
import { setEnabled, setVolume } from "cuelume";

setEnabled(soundEnabled);
setVolume(0.7);
```

The host app owns controls, labels, and persistence. Cuelume starts enabled and
does not read storage, cookies, account settings, or operating-system
preferences.

Apps with recurring or non-essential sound should expose a discoverable Sound
toggle. Cuelume must not infer this preference from `prefers-reduced-motion`;
motion and sound preferences are not equivalent.

No new preference API is planned.

## 5. Build context-aware adaptive synthesis

Adaptive synthesis becomes the focus of `v0.4`, after the `v0.3` palette and
bindings have been validated.

The governing model is:

```text
semantic cue + theme + interaction context = rendered sound
```

A cue must remain recognizably itself while its duration, intensity, pitch,
envelope, and layer balance respond within curated limits. Adaptation should
make repeated interaction less fatiguing and communicate useful differences;
it must not create novelty for its own sake.

### Context model

Cuelume may infer context that is directly available from the current
interaction:

| Context | Source | Example use |
| --- | --- | --- |
| Input method | Pointer or keyboard event | Related mouse, touch, pen, and keyboard variants |
| Cadence | Recent same-cue timing | Shorter, quieter rapid typing and tapping |
| Repetition | Recent local playback | Reduce fatigue and prevent stacked transients |
| Key role | Current keyboard event | Lower Backspace, resolved Enter, varied printable keys |
| Selection direction | Previous and current selected index | Subtle upward or downward pitch movement |
| Open/closed direction | Explicit cue or control state | Preserve the relationship between `open` and `close` |

Business meaning cannot be inferred reliably. Importance therefore remains an
explicit, small public option:

```ts
type Emphasis = "subtle" | "normal" | "strong";

play("success", { emphasis: "subtle" });
play("success", { emphasis: "strong" });
```

Per-call volume remains available and composes with emphasis:

```ts
play("success", { volume: 0.5, emphasis: "strong" });
```

Declarative bindings may provide the same context:

```html
<button data-cuelume-tap data-cuelume-emphasis="subtle">
  Secondary action
</button>
```

Rules:

- `normal` is the default emphasis.
- Invalid runtime emphasis values fall back to `normal`.
- Emphasis selects a curated expression; it is not merely another volume
  control.
- Raw pitch, duration, filter, oscillator, envelope, and randomness controls
  are not public API.
- Automatic context remains best-effort. The semantic cue must still sound
  correct when context is unavailable.
- Adaptation never changes one semantic cue into another.

### Initial adaptive proof

Before converting the whole palette, prototype the three most repeated cues:

- `type`: respond to cadence and key role while avoiding repetitive playback.
- `select`: respond subtly to movement direction and repeated navigation.
- `tap`: respond to input method and rapid repetition without losing impact.

Proceed with all nine cue families only if listening tests show that these
adaptations improve clarity or comfort rather than merely sounding different.

**Prototype, 2026-09-23 (unreleased).** Built in `src/sounds/context.ts` as
one small table of curated factors per context. Daniel chose to start it
before v0.3 shipped. A shape scales pitch, level, length, bright layers
(centred at 3 kHz or above), and late layers, and every factor is clamped:

- `type`: cadence between 70 and 220 ms lightens, shortens, and drops the
  key-return click; Space, Enter, and Delete each have their own shape.
- `select`: ±5% pitch by direction, from marked siblings or `selectedIndex`.
- `tap`: touch, keyboard, and pen shapes; cadence as for `type`.
- Emphasis reaches all nine cues as an arrangement, not only a shape: each
  layer can be marked with the lowest emphasis it plays at. `subtle` drops
  the ornament layers, and every cue has one layer that only `strong` plays
  (a lower glass body for `tap`, a deep bottom-out for `type`, an octave
  under `success`, and so on). A light shape leans the same way. Daniel asked
  for each level to sound different in character, not just heavier or
  lighter, which gives developers 27 distinct sounds from nine cues.
- The first pick in a custom select group starts from the option ARIA marks
  as chosen, so direction works from the first click.

For less repetitive cues:

- `toggle` may distinguish its two state directions when state is available.
- `open` and `close` retain a shared material but opposite motion.
- `success` and `error` use explicit emphasis for action importance.
- `navigate` may express forward and backward direction when available.

### Privacy and product boundaries

Adaptive means responsive to the current interaction, not personalized through
surveillance.

- No AI or machine-learning model is required.
- No interaction history leaves the page.
- No cross-session or cross-site behavioral profile is built.
- No adaptive state is persisted by Cuelume.
- No network request is made for adaptation.
- Cuelume does not guess importance from class names, visual size, copy, or DOM
  structure.
- The host remains responsible for explicit business meaning such as emphasis.

### Adaptive release gate

- Every variant remains identifiable as its parent semantic cue.
- Rapid `type`, `select`, and `tap` interactions are less fatiguing than fixed
  repetition in comparative listening tests.
- Adaptation never creates unexpected loudness jumps.
- Selection and navigation direction are perceptible when useful but not
  melodic or distracting.
- Explicit emphasis is distinguishable at all three levels without becoming a
  raw loudness switch.
- Missing context and invalid runtime emphasis values fall back safely.
- Adaptation adds no storage, network access, dependency, or audio files.
- Performance remains stable during sustained typing on supported browsers.

## 6. Add `mech` only after the adaptive default palette is stable

`mech` becomes the second and final planned built-in theme in `v0.5`.

```ts
import { setTheme } from "cuelume";

setTheme("mech");
setTheme("default");
```

Proposed additions:

```ts
type ThemeName = "default" | "mech";

declare const themes: readonly ThemeName[];
declare function setTheme(theme: ThemeName): void;
```

Theme rules:

- Both themes implement exactly the same nine canonical cues.
- `default` is tactile, warm, and premium: woody clicks, air, and soft
  mallets.
- `mech` is dry, precise, and mechanical without becoming harsh, industrial,
  retro-computer, or generic sci-fi.
- Themes change sonic material, not cue semantics.
- Initial theme is `default`.
- Theme changes affect future playback only.
- Cuelume does not persist theme selection.
- Unknown runtime theme names are silent no-ops.
- `bind()` needs no theme-specific behavior.
- `play()` keeps per-call volume and emphasis as its only options.
- Every supported context produces a curated expression in both themes; themes
  must not disable adaptation.
- No third theme is planned without evidence of a materially different need.

### `mech` implementation gate

Work on `mech` starts only when:

- The nine canonical cue names are approved.
- The new binding behavior is implemented and tested.
- Every default-theme cue passes the palette release gate.
- The context model and `Emphasis` API pass the adaptive release gate.
- All nine default-theme cue families have stable adaptation boundaries.
- Real interface testing reveals no missing high-frequency semantic cue.

**Built 2026-09-23 (unreleased).** Daniel approved starting `mech` before the
palette and adaptive listening gates, and accepted the bundle growth (4.7 kB
min+gzip with both themes). `src/sounds/mech.ts` holds the nine recipes, each
tagged for emphasis like the default palette, level-matched to it on the
loudest 30 ms within about 1 dB. `setTheme` and `themes` ship as specified.

### `mech` release gate

- All nine cue families exist in both themes.
- Cue meaning remains recognizable when switching themes.
- Related pairs remain coherent: `open`/`close` and `success`/`error`.
- Repeated cues remain pleasant under fast typing and selection.
- Adaptive behavior remains useful and bounded in both sonic materials.
- Themes are level-matched and clear at global volume `0.3`.
- Both themes pass listening checks on laptop speakers, a phone speaker, and
  earbuds.

## 7. Graduate to `1.0`

After the compact palette, event-aware bindings, adaptive behavior, and `mech`
have been used in real applications, publish `1.0`.

The stable public surface is:

```ts
play(name?, options?);
bind(root?);
setEnabled(enabled);
setVolume(volume);
setTheme(theme);
sounds;
themes;
```

Alongside `SoundName`, `ThemeName`, and `Emphasis`, `1.0` guarantees:

- The nine canonical cue names remain available and keep their semantic jobs.
- `default` and `mech` remain valid built-in themes.
- Both themes cover every canonical cue and supported adaptive context.
- `subtle`, `normal`, and `strong` remain valid emphasis levels.
- Existing SSR, autoplay, invalid-name, volume, adaptation fallback, and
  delegated-binding behavior remains compatible.
- Removing or repurposing a cue, emphasis level, adaptive semantic, or theme,
  or breaking a function signature requires a major release.
- Recipes and exact synthesis values remain implementation details.

`1.0` means the compact API is dependable. It does not require more features.

## Proposed: AI interface cues

**Status:** proposed 2026-09-23, not scheduled.

Daniel is building an AI interface library that would offer Cuelume as
optional feedback. AI interfaces have moments a classic form or menu does
not, so the nine cues need checking against them before the palette freezes.

Most AI moments already have a cue:

| AI moment | Cue |
| --- | --- |
| Send a prompt | `tap` |
| Stop a generation | `close` |
| Dismiss or reject a suggestion | `close` |
| Switch model or mode | `select` |
| Open a chat panel or sidebar | `open` |
| Move between threads | `navigate` |
| An action the user asked for completes (file saved, PR opened) | `success` |
| Model, tool, or network failure | `error` |

Three jobs have no cue:

- **Work started.** An unresolved "working on it" after the user asks for
  something slow. This is the job `loading` did in v0.2; v0.3 maps it to
  `tap` for lack of anything better.
- **Result ready.** A reply finished streaming or a background job produced
  output. `success` is the wrong cue: a finished answer is not a confirmed
  operation, and a success chime after every reply wears it out. This is the
  job `ready` did in v0.2.
- **Needs you.** The agent is blocked on approval, a choice, or input. The
  only cue meant to be noticed when the user is looking elsewhere.

Rules for any additions:

- Names describe the interface job, so they also serve uploads, exports, and
  other slow non-AI work. Nothing named after AI.
- No cue per streamed token or chunk, and none per tool call inside an agent
  run. Both fire too often, for the same reason hover is out.
- At most three additions. Each new cue is another adaptive family in `v0.4`
  and another `mech` recipe in `v0.5`.
- Promoting `loading` and `ready` back to canonical cues is the obvious
  option. Both names are still live aliases, so apps that use them would get
  back a cue close to the one they chose. The palette gate still applies:
  each must be distinguishable from `tap` and `success` in blind listening.
- The AI library keeps Cuelume optional, for example as a `sound` option that
  the host fills with `play`, so the library itself stays dependency-free.

**Decided 2026-09-23:** `loading`, `ready`, and `attention` join the palette,
with `warning`, in the [Professional Palette](2026-09-23-professional-palette-design.md)
spec. Kept below for the reasoning.

**Decision point:** during the v0.3 validation step, with the AI library as
one of the real interfaces. Adding cues does not break anything, but it has to
happen before `v0.4` starts, while there is one sound per cue rather than a
family per cue in two themes.

## Documentation plan

For `v0.3`:

- Rewrite the README around the nine canonical cues.
- Lead with `tap`, `type`, and `select` examples.
- Document typing and native/custom selection behavior.
- Add the old-to-new migration table.
- Document a host-owned Sound toggle.
- Explain why sound does not follow `prefers-reduced-motion`.
- Do not document adaptive behavior or `mech` before they exist.
- Do not expose or teach recipe authoring.

For `v0.4`:

- Explain context-aware synthesis in plain language.
- Document inferred context and its privacy boundaries.
- Document `Emphasis` and `data-cuelume-emphasis`.
- Include typing, selection direction, repeated tap, and outcome-emphasis
  examples.
- Clearly distinguish emphasis from volume and theme.

For `v0.5`:

- Add one `setTheme("mech")` example.
- Document `themes` and `ThemeName`.
- Add a `Default / Mech` switcher to the website soundboard.
- Let the soundboard demonstrate cadence, direction, and emphasis in both
  themes.

## Verification

Automated tests for `v0.3` should confirm:

- `sounds` contains exactly the nine canonical cue names.
- Every canonical cue plays through the existing shared audio engine.
- Deprecated names resolve to the documented canonical cues.
- An empty legacy hover binding plays `select`.
- A legacy press/release pair plays one cue per click.
- New declarative bindings are delegated, dynamic, and idempotent.
- Typing filters modifiers, repeats, composition, and password fields.
- Held Backspace and Delete keep sounding until nothing is left to delete.
- Typing rate limiting prevents excessive playback.
- Native selection plays once on `change`.
- Custom selection plays once on activation.
- `setEnabled(false)` blocks imperative and delegated playback.
- Existing volume, SSR, autoplay, invalid-name, and blocked-audio behavior
  remains safe.

Automated tests for `v0.4` should additionally confirm:

- `normal` emphasis is the default.
- All three emphasis values reach every cue family safely.
- Invalid runtime emphasis falls back to `normal`.
- Per-call volume composes with emphasis without exceeding output protection.
- Typing context distinguishes eligible key roles and cadence bands.
- Selection direction derives from previous and current selection safely.
- Rapid repeated cues use bounded adaptation and do not create duplicate
  playback.
- Missing context falls back to the canonical expression.
- Adaptive state is ephemeral and scoped to the current page.

Automated tests for `v0.5` should additionally confirm:

- `themes` contains exactly `default` and `mech`.
- Both themes contain exactly the nine canonical cue families.
- Every supported context and emphasis level renders in both themes.
- `setTheme()` changes future playback.
- Unknown theme names do not change the active theme.

Sound character, loudness, cadence, adaptation quality, and device translation
require listening checks rather than tests of internal synthesis values.

## Rollout

1. **`v0.3` — Palette reset:** ship nine canonical cues, event-aware bindings,
   migration aliases, and updated documentation.
2. Validate the default palette in real buttons, text fields, native selects,
   custom menus, dialogs, async actions, and route transitions. Include the AI
   interface library and settle the proposed AI cues before `v0.4`.
3. **`v0.4` — Adaptive cues:** prototype `type`, `select`, and `tap`, validate
   the benefit, then ship bounded cue families for all nine cues with emphasis.
4. Validate cadence, direction, repetition, input method, and emphasis in real
   interfaces without storing or transmitting behavioral data.
5. **`v0.5` — Themes:** ship the complete adaptive `mech` palette and theme
   API.
6. Validate both themes in real applications and make only
   compatibility-safe refinements.
7. **`v1.0` — Stable contract:** remove migration-only names and bindings,
   freeze the nine-cue/adaptive/two-theme API, and publish the stable release.

Nothing should be implemented for `mech` until the palette, bindings, and
adaptive model have all passed their release gates.

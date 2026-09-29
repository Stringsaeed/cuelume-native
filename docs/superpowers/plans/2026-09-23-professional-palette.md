# Professional Palette Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retune both Cuelume themes into a calm register, grow the palette from 9 to 13 cues, let `play()` take interaction context, and document which cue fits which job.

**Architecture:** Recipes stay data (`src/sounds/recipes.ts` for `default`, `src/sounds/mech.ts` for `mech`). Context shaping stays in `src/sounds/context.ts`; the engine (`src/audio/engine.ts`) gains one path from `PlayOptions` into the same `Context` bindings already produce, plus a sweep reversal for `navigate`. Loudness and listening checks use the offline renderer in the session scratchpad, never a browser.

**Tech Stack:** TypeScript (tsc to `dist/`), Web Audio, `node:test` against `dist/`, a Node offline renderer (`render-lib.mjs`) for levels and audition WAVs. Site: Astro.

**Spec:** `docs/superpowers/specs/2026-09-23-professional-palette-design.md`

## Global Constraints

- Zero runtime dependencies. Add no dependencies or devDependencies. `npx esbuild` is used once, only to measure the bundle.
- No layer in any theme is centred above 5 kHz: a tone's `frequency`, a noise layer's `filterFrequency`, and any `glideTo` are all ≤ 5000.
- Tonal cues sit 4 semitones (factor 0.7937) below v0.3. Noise clicks sit 15–20% below v0.3. Decays of 50 ms or more are 20% shorter; shorter decays are transients and stay.
- Tones are sines only, at most two notes per cue (a glass fundamental doubled a few Hz apart counts as one note), and no audible tone glides.
- Every cue in both themes plays ≥ 1 layer at `subtle` and has at least one layer that only `strong` plays.
- Every cue at `normal` is level-matched within 1 dB (loudest 30 ms, median of 11 renders) of its target: the v0.3 `default` level of the same cue, or for new cues of their neighbour (`warning`→`error`, `loading`→`open`, `ready`→`success`, `attention`→`success`).
- `sounds` order: the existing nine keep their positions (`tap, type, select, toggle, open, close, success, error, navigate`); the new four follow as `warning, loading, ready, attention`.
- Public option names, verbatim: `direction?: "forward" | "back"`, `key?: "printable" | "space" | "delete" | "enter"`, `input?: "mouse" | "touch" | "pen" | "keyboard"`.
- `play()` never throws. Unknown option values are ignored and the cue plays canonically.
- Docs never describe terminal/Node playback as available; it is the next spec.
- Do not start dev servers, `astro dev`, or browser automation. Build with `npm run build` / `npm test` only.
- Do not commit. Daniel commits when he asks. Each task ends with a green `npm test` instead.
- User-facing prose follows the `no-ai-slop` skill.

Paths used below:

- `TACTILE` = `/Users/danielbelyi/Developer/Open-Source/tactile`
- `SITE` = `/Users/danielbelyi/Developer/Open-Source/cuelume-site`
- `SCRATCH` = `/private/tmp/claude-501/-Users-danielbelyi-Developer-Open-Source-tactile/ce4e4c34-bbb1-44d4-9fff-76f13f48bb5c/scratchpad` (already holds `render-lib.mjs`, the offline renderer)

## Review Focus

1. **Junk context values** (`{ direction: "up" }`, `{ direction: 1 }`, `{ key: "toString" }`, `null` options). Expected: the canonical sound, no throw. Test: Task 3 Step 1.
2. **`navigate` going back in `mech` and at every emphasis.** Expected: the sweep falls in both themes at subtle, normal and strong. Test: Task 3 Step 1.
3. **v0.2 apps that use `loading` or `ready`** (`play("ready")`, `data-cuelume-tap="loading"`). Expected: the new cue, not `tap` or `success`. Test: Task 2 Step 1.
4. **Code that indexes `sounds`** (`sounds[6] === "success"`). Expected: the existing nine keep their indices. Test: Task 2 Step 1 (exact-order assertion).
5. **Bindings still pass their own context after `play()` gains options** (ARIA direction on custom options, key roles on typing). Expected: unchanged behaviour. Test: the existing binding test (`"binding is delegated, dynamic, idempotent…"`, its `firstFilter` assertions on the Enter key, ARIA-seeded month/day options, and a native select) must stay green in Task 3 Step 5.

---

### Task 1: Retune both themes into the calm register

**Files:**
- Modify: `src/sounds/recipes.ts` (the `RECIPES` object, lines 74–196)
- Modify: `src/sounds/mech.ts` (the whole `MECH` object)
- Modify: `src/sounds/context.ts:22` (`BRIGHT_HZ`)
- Test: `test/runtime.test.mjs` (new test; one timing constant in the shimmer test)
- Create: `$SCRATCH/levels.mjs`, `$SCRATCH/audition-pro.mjs`, `$SCRATCH/baseline.json`, `$SCRATCH/dist-before/`

**Interfaces:**
- Consumes: nothing new.
- Produces: retuned `RECIPES` and `MECH` with the same keys and layer order; `$SCRATCH/levels.mjs` (`node levels.mjs save | check | <no arg>`); `$SCRATCH/baseline.json` (`{ default: { [cue]: dB }, mech: {...} }`); `$SCRATCH/audition-pro.mjs`; `$SCRATCH/dist-before/` (a copy of the v0.3 build).

- [ ] **Step 1: Capture the before state**

```bash
cd $TACTILE && npm run build
rm -rf $SCRATCH/dist-before && cp -R dist $SCRATCH/dist-before
```

Create `$SCRATCH/levels.mjs`:

```js
// Loudness per theme and cue: the loudest 30 ms window, median of 11 renders, at normal emphasis.
//   node levels.mjs save   → writes baseline.json from the current dist (run once, before retuning)
//   node levels.mjs        → each cue against its target, with the masterGain that would hit it
//   node levels.mjs check  → same, and exits 1 if any cue is more than 1 dB off
import { readFileSync, writeFileSync } from "node:fs";
import { render } from "./render-lib.mjs";

const T = "/Users/danielbelyi/Developer/Open-Source/tactile/dist/sounds/";
const stamp = Date.now();
const { THEMES } = await import(`${T}themes.js?${stamp}`);
const { arrangement } = await import(`${T}context.js?${stamp}`);

const SR = 48000;
const WIN = SR * 0.03;
function momentary(x) {
  let best = 0;
  for (let i = 0; i + WIN <= x.length; i += WIN / 4) {
    let e = 0;
    for (let j = i; j < i + WIN; j++) e += x[j] * x[j];
    best = Math.max(best, e / WIN);
  }
  return 10 * Math.log10(best);
}
function loudness(recipe) {
  const takes = Array.from({ length: 11 }, () =>
    momentary(render({ ...recipe, layers: arrangement(recipe.layers, "normal") }, 0.8)),
  ).sort((a, b) => a - b);
  return takes[5];
}

const measured = {};
for (const theme of Object.keys(THEMES)) {
  measured[theme] = {};
  for (const cue of Object.keys(THEMES[theme])) measured[theme][cue] = loudness(THEMES[theme][cue]);
}

const BASE = new URL("./baseline.json", import.meta.url);
if (process.argv[2] === "save") {
  writeFileSync(BASE, JSON.stringify(measured, null, 2));
  console.log("saved", BASE.pathname);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASE, "utf8"));
// new cues borrow the level of their nearest v0.3 neighbour; every theme matches default
const NEIGHBOUR = { warning: "error", loading: "open", ready: "success", attention: "success" };
let off = 0;
console.log("theme    cue          now  target   diff   masterGain -> suggested");
for (const theme of Object.keys(measured)) {
  for (const cue of Object.keys(measured[theme])) {
    const target = baseline.default[cue] ?? baseline.default[NEIGHBOUR[cue]];
    const now = measured[theme][cue];
    const gain = THEMES[theme][cue].masterGain;
    const suggested = gain * 10 ** ((target - now) / 20);
    if (Math.abs(now - target) > 1) off++;
    console.log(
      `${theme.padEnd(8)} ${cue.padEnd(10)} ${now.toFixed(1).padStart(6)} ${target.toFixed(1).padStart(7)} ${(now - target).toFixed(1).padStart(6)}   ${gain.toFixed(3)} -> ${suggested.toFixed(3)}`,
    );
  }
}
if (process.argv[2] === "check" && off) {
  console.error(`${off} cue(s) more than 1 dB from target`);
  process.exit(1);
}
```

Run:

```bash
cd $SCRATCH && node levels.mjs save && cat baseline.json | head -12
```

Expected: `saved …/baseline.json`, then JSON with a dB value (negative number) for each of the nine cues in `default` and `mech`.

- [ ] **Step 2: Write the failing ceiling test**

In `test/runtime.test.mjs`, add after the test `"two themes carry the same nine cues, each arranged for every emphasis"`:

```js
test("no layer in any theme is centred above 5 kHz", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  for (const [theme, cues] of Object.entries(THEMES)) {
    for (const [cue, recipe] of Object.entries(cues)) {
      for (const layer of recipe.layers) {
        const centre = Math.max(layer.kind === "tone" ? layer.frequency : layer.filterFrequency, layer.glideTo ?? 0);
        assert.ok(centre <= 5000, `${theme} ${cue}: ${centre} Hz`);
      }
    }
  }
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd $TACTILE && npm test 2>&1 | grep -A3 "5 kHz"`
Expected: FAIL, `default tap: 6500 Hz`.

- [ ] **Step 4: Retune `default`**

In `src/sounds/recipes.ts`, replace the `tap` doc comment and every cue's `layers` with the values below. `masterGain`, `vary`, and `shimmer` stay as they are for now; Step 7 sets the gains. Keep layer order, so tests that read `layers[0]` still find the same layer.

```ts
  /**
   * A small glassy tap — buttons, links, nav. A nail's tick, then the glass
   * ringing briefly: the fundamental is two near-identical modes that beat
   * slowly, as real glass shimmers, and the upper mode sits at the glass-bar
   * ratio 2.76x, dying faster than the fundamental.
   */
  tap: {
    masterGain: 0.4,
    layers: [
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 4500, filterQ: 1.2, attack: 0.001, decay: 0.002, peak: 0.03 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, attack: 0.001, decay: 0.128, peak: 0.0135 },
      { kind: "tone", waveform: "sine", frequency: 1180, attack: 0.001, decay: 0.104, peak: 0.008 },
      { kind: "tone", waveform: "sine", frequency: 3242, attack: 0.001, decay: 0.048, peak: 0.0055 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 587.33, attack: 0.002, decay: 0.16, peak: 0.009 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 750, filterQ: 1.5, attack: 0.001, decay: 0.015, peak: 0.05 },
    ],
    vary: { pitch: 0.012, level: 0.12 },
  },
```

`type` layers:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 3900, filterQ: 0.8, attack: 0.001, decay: 0.005, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1550, filterQ: 3.5, attack: 0.001, decay: 0.016, peak: 0.22 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 310, filterQ: 2.5, attack: 0.002, decay: 0.03, peak: 0.35 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2000, filterQ: 3, offset: 0.06, attack: 0.001, decay: 0.01, peak: 0.07 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 140, filterQ: 2, attack: 0.002, decay: 0.045, peak: 0.45 },
```

`select` layers:

```ts
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2800, filterQ: 2.2, attack: 0.001, decay: 0.008, peak: 0.288 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1250, filterQ: 6, attack: 0.001, decay: 0.022, peak: 0.384 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 580, filterQ: 3, attack: 0.001, decay: 0.02, peak: 0.3 },
```

`toggle` layers:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 1830, filterQ: 1.6, attack: 0.001, decay: 0.016, peak: 0.12 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 3150, filterQ: 1.6, offset: 0.024, attack: 0.001, decay: 0.02, peak: 0.1 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 430, filterQ: 2, offset: 0.024, attack: 0.001, decay: 0.025, peak: 0.2 },
```

`open` layers:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 600, glideTo: 1500, glideTime: 0.1, filterQ: 1.4, attack: 0.07, decay: 0.04, peak: 0.168 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 3, offset: 0.095, attack: 0.001, decay: 0.012, peak: 0.12 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 515, filterQ: 2, offset: 0.095, attack: 0.001, decay: 0.02, peak: 0.096 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 2, offset: 0.095, attack: 0.001, decay: 0.04, peak: 0.2 },
```

`close` layers:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 1400, glideTo: 540, glideTime: 0.07, filterQ: 1.4, attack: 0.04, decay: 0.035, peak: 0.216 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 350, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.03, peak: 0.36 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1650, filterQ: 2.5, offset: 0.07, attack: 0.001, decay: 0.006, peak: 0.09 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 165, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.04, peak: 0.3 },
```

`success` layers (update its doc comment to "rising a fifth, C5 to G5"):

```ts
      { kind: "tone", waveform: "sine", frequency: 523.25, attack: 0.003, decay: 0.21, peak: 0.034 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2093, attack: 0.001, decay: 0.04, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 783.99, offset: 0.075, attack: 0.003, decay: 0.27, peak: 0.036 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3136, offset: 0.075, attack: 0.001, decay: 0.04, peak: 0.007 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 392, offset: 0.075, attack: 0.01, decay: 0.36, peak: 0.022 },
```

`error` layers:

```ts
      { kind: "tone", waveform: "sine", frequency: 349.23, attack: 0.003, decay: 0.096, peak: 0.046 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1396.91, attack: 0.001, decay: 0.025, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 293.66, offset: 0.11, attack: 0.003, decay: 0.144, peak: 0.046 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.11, attack: 0.001, decay: 0.025, peak: 0.007 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 1.5, attack: 0.001, decay: 0.03, peak: 0.2 },
```

`navigate` layers:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 400, glideTo: 1800, glideTime: 0.21, filterQ: 1.2, attack: 0.12, decay: 0.12, peak: 0.18 },
      { from: "normal", kind: "noise", filterType: "lowpass", filterFrequency: 540, filterQ: 0.7, attack: 0.09, decay: 0.096, peak: 0.045 },
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 230, filterQ: 0.7, attack: 0.1, decay: 0.144, peak: 0.1 },
```

Also change the comment block above `RECIPES` from "or glass (sines at glass-bar ratios)" to "or glass (sines at the glass-bar ratio 2.76), nothing is centred above 5 kHz".

- [ ] **Step 5: Retune `mech`**

In `src/sounds/mech.ts`, replace each cue's `layers` (keep `masterGain`, `vary`, and doc comments):

`tap`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 2650, filterQ: 1.5, attack: 0.001, decay: 0.004, peak: 0.14 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 910, filterQ: 4, attack: 0.001, decay: 0.012, peak: 0.2 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 4600, filterQ: 2, attack: 0.001, decay: 0.002, peak: 0.05 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 215, filterQ: 2, attack: 0.001, decay: 0.025, peak: 0.3 },
```

`type`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 4300, filterQ: 1.2, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 5, attack: 0.001, decay: 0.008, peak: 0.18 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 750, filterQ: 3, attack: 0.001, decay: 0.01, peak: 0.22 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 330, filterQ: 2.5, attack: 0.001, decay: 0.02, peak: 0.3 },
```

`select`:

```ts
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3650, filterQ: 3, attack: 0.001, decay: 0.003, peak: 0.2 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1500, filterQ: 8, attack: 0.001, decay: 0.009, peak: 0.35 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 1500, filterQ: 8, offset: 0.012, attack: 0.001, decay: 0.006, peak: 0.18 },
```

`toggle`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 1650, filterQ: 2, attack: 0.001, decay: 0.004, peak: 0.14 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 2650, filterQ: 3, offset: 0.03, attack: 0.001, decay: 0.006, peak: 0.18 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 750, filterQ: 4, offset: 0.03, attack: 0.001, decay: 0.014, peak: 0.2 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 2, offset: 0.03, attack: 0.001, decay: 0.03, peak: 0.3 },
```

`open`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 2150, filterQ: 3, attack: 0.001, decay: 0.004, peak: 0.16 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1160, glideTo: 2150, glideTime: 0.05, filterQ: 2, offset: 0.006, attack: 0.02, decay: 0.03, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1330, filterQ: 5, offset: 0.06, attack: 0.001, decay: 0.008, peak: 0.14 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 290, filterQ: 2, offset: 0.06, attack: 0.001, decay: 0.03, peak: 0.25 },
```

`close`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 2150, glideTo: 1080, glideTime: 0.04, filterQ: 2, attack: 0.015, decay: 0.025, peak: 0.08 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1000, filterQ: 4, offset: 0.04, attack: 0.001, decay: 0.01, peak: 0.22 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 2, offset: 0.04, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 180, filterQ: 2, offset: 0.04, attack: 0.001, decay: 0.035, peak: 0.3 },
```

`success`:

```ts
      { kind: "tone", waveform: "sine", frequency: 698.46, attack: 0.001, decay: 0.08, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1927.7, attack: 0.001, decay: 0.03, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 1046.5, offset: 0.07, attack: 0.001, decay: 0.112, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2888.3, offset: 0.07, attack: 0.001, decay: 0.03, peak: 0.012 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 4150, filterQ: 2, attack: 0.001, decay: 0.003, peak: 0.06 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 4150, filterQ: 2, offset: 0.07, attack: 0.001, decay: 0.003, peak: 0.06 },
```

`error`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 430, filterQ: 4, attack: 0.001, decay: 0.02, peak: 0.3 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1830, filterQ: 3, attack: 0.001, decay: 0.006, peak: 0.1 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 365, filterQ: 4, offset: 0.09, attack: 0.001, decay: 0.025, peak: 0.3 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1580, filterQ: 3, offset: 0.09, attack: 0.001, decay: 0.006, peak: 0.1 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 150, filterQ: 2, attack: 0.001, decay: 0.04, peak: 0.3 },
```

`navigate`:

```ts
      { kind: "noise", filterType: "bandpass", filterFrequency: 750, glideTo: 1800, glideTime: 0.13, filterQ: 1.8, attack: 0.05, decay: 0.096, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2500, filterQ: 4, offset: 0.04, attack: 0.001, decay: 0.003, peak: 0.1 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 2800, filterQ: 4, offset: 0.08, attack: 0.001, decay: 0.003, peak: 0.09 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1250, filterQ: 4, offset: 0.14, attack: 0.001, decay: 0.008, peak: 0.14 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 250, filterQ: 1.5, attack: 0.04, decay: 0.112, peak: 0.12 },
```

- [ ] **Step 6: Keep the same layers "bright"**

Everything moved down about 17%, so the brightness threshold moves with it. With 2500 Hz, exactly the layers that were bright before (≥ 3000 Hz) are bright now. In `src/sounds/context.ts`:

```ts
const BRIGHT_HZ = 2500;
```

- [ ] **Step 7: Update the shimmer timing and run the tests**

Success's second note is shorter, so its cleanup comes sooner: 0.075 + 0.003 + 0.27 + 0.05 (stop padding) + 0.21 (shimmer tail) + 0.05 (margin) = 0.658 s. In the test `"finished shimmer graphs disconnect after their audible tail"`:

```js
  assert.equal(Math.round(timers[0].delay), 658);
```

Run: `cd $TACTILE && npm test`
Expected: all tests PASS, including `no layer in any theme is centred above 5 kHz`.

- [ ] **Step 8: Re-match levels**

```bash
cd $SCRATCH && node levels.mjs
```

For every row whose `diff` is beyond ±1.0, set that cue's `masterGain` in `recipes.ts` (theme `default`) or `mech.ts` (theme `mech`) to the `suggested` value, rounded to 2 decimals. Then:

```bash
cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check
```

Expected: exit 0, every `diff` within ±1.0. Repeat once if a noisy cue lands just outside. Then run `cd $TACTILE && npm test`. The binding test needs the master gains of `tap, type, select, open, success` to be distinct. If two now round to the same value, nudge one by 0.01.

- [ ] **Step 9: Write the audition script and render before/after**

Create `$SCRATCH/audition-pro.mjs`:

```js
// Audition set for the professional palette. Writes WAVs to ./audition/pro/.
// "Before" is ./dist-before (the v0.3 build copied in Task 1).
import { mkdirSync, writeFileSync } from "node:fs";
import { SR, render, wav } from "./render-lib.mjs";

const HERE = new URL("./", import.meta.url);
const load = async (dir) => ({
  THEMES: (await import(`${dir}themes.js?${Date.now()}`)).THEMES,
  arrangement: (await import(`${dir}context.js?${Date.now()}`)).arrangement,
});
const after = await load("/Users/danielbelyi/Developer/Open-Source/tactile/dist/sounds/");
const before = await load(new URL("./dist-before/sounds/", HERE).pathname);
const dir = new URL("./audition/pro/", HERE);
mkdirSync(dir, { recursive: true });

const at = (lib, recipe, emphasis = "normal") => ({ ...recipe, layers: lib.arrangement(recipe.layers, emphasis) });
// navigate going back: every gliding layer starts where it would have ended
const back = (recipe) => ({
  ...recipe,
  layers: recipe.layers.map((l) =>
    l.glideTo === undefined ? l
      : l.kind === "tone" ? { ...l, frequency: l.glideTo, glideTo: l.frequency }
      : { ...l, filterFrequency: l.glideTo, glideTo: l.filterFrequency }),
});
function take(events, secs) {
  const out = new Float64Array(Math.round(SR * secs));
  for (const [t, recipe] of events) {
    render(recipe, 0.9).forEach((x, i) => {
      const j = Math.round(t * SR) + i;
      if (j < out.length) out[j] += x;
    });
  }
  return out;
}

const OLD = ["tap", "type", "select", "toggle", "open", "close", "success", "error", "navigate"];
const NEW = ["warning", "loading", "ready", "attention"].filter((c) => c in after.THEMES.default);
const BLIND = [["warning", "error", "normal"], ["ready", "success", "normal"], ["attention", "success", "normal"], ["loading", "open", "subtle"]];
const key = [];

for (const theme of ["default", "mech"]) {
  const T = after.THEMES[theme];
  wav(`1-${theme}-before-then-after.wav`, take(OLD.flatMap((c, i) => [
    [0.2 + i * 1.6, at(before, before.THEMES[theme][c])],
    [0.9 + i * 1.6, at(after, T[c])],
  ]), OLD.length * 1.6 + 0.8), dir);
  wav(`2-${theme}-palette.wav`, take(Object.keys(T).map((c, i) => [0.2 + i * 0.8, at(after, T[c])]), Object.keys(T).length * 0.8 + 0.8), dir);
  let t = 0.2;
  const typing = [];
  for (let k = 0; k < 24; k++) { typing.push([t, T.type]); t += 0.07 + Math.random() * 0.05; }
  wav(`3-${theme}-typing.wav`, take(typing, t + 0.5), dir);
  wav(`4-${theme}-navigate-forward-then-back.wav`, take([[0.2, at(after, T.navigate)], [1, at(after, back(T.navigate))]], 1.8), dir);
  if (!NEW.length) continue;
  wav(`5-${theme}-new-cues-subtle-normal-strong.wav`, take(NEW.flatMap((c, i) =>
    ["subtle", "normal", "strong"].map((e, k) => [0.2 + i * 2.4 + k * 0.75, at(after, T[c], e)])), NEW.length * 2.4 + 0.8), dir);
  // blind pairs: each pair in random order; the answers go to a file, not the console
  const events = [];
  BLIND.forEach(([a, b, emphasis], i) => {
    const order = Math.random() < 0.5 ? [a, b] : [b, a];
    key.push(`${theme} pair ${i + 1}: first ${order[0]}, then ${order[1]} (${emphasis})`);
    order.forEach((c, k) => events.push([0.2 + i * 3 + k * 1.2, at(after, T[c], emphasis)]));
  });
  wav(`6-${theme}-blind-pairs.wav`, take(events, BLIND.length * 3 + 0.8), dir);
}
if (key.length) writeFileSync(new URL("blind-key.txt", dir), key.join("\n") + "\n");
console.log("wrote", dir.pathname);
```

Run: `cd $SCRATCH && node audition-pro.mjs && ls audition/pro`
Expected: `1-default-before-then-after.wav`, `1-mech-…`, `2-…-palette.wav`, `3-…-typing.wav`, `4-…-navigate-forward-then-back.wav` for both themes. Files 5 and 6 appear from Task 2 on. File 4's "back" half only matches the engine after Task 3; before that it previews the intent.

Send Daniel the paths to files 1–3 for both themes. Task 2 can start while he listens. If he rejects the register, stop and revise this task before Task 2's pitches, which are set relative to it.

---

### Task 2: Add `warning`, `loading`, `ready`, `attention` to both themes

**Files:**
- Modify: `src/sounds/recipes.ts` (append four cues to `RECIPES`; remove two aliases)
- Modify: `src/sounds/mech.ts` (append four cues)
- Test: `test/runtime.test.mjs`

**Interfaces:**
- Consumes: retuned `RECIPES`/`MECH`, `$SCRATCH/levels.mjs` (Task 1).
- Produces: `SoundName` = `"tap" | "type" | "select" | "toggle" | "open" | "close" | "success" | "error" | "navigate" | "warning" | "loading" | "ready" | "attention"`; `sounds` in that order; `resolveSound("loading") === "loading"`, `resolveSound("ready") === "ready"`.

- [ ] **Step 1: Write the failing tests**

In `test/runtime.test.mjs`:

Replace the `CANONICAL` constant:

```js
const CANONICAL = [
  "tap", "type", "select", "toggle", "open", "close", "success", "error", "navigate",
  "warning", "loading", "ready", "attention",
];
```

Rename the first test to `"palette is the thirteen canonical cues, the original nine first"` (its body already asserts exact order).

In the migration test, change two entries:

```js
    loading: "loading",
    ready: "ready",
```

In the context test, replace `assert.ok(simpler >= 8);` with:

```js
  assert.ok(simpler >= CANONICAL.length - 1); // toggle has no ornament to strip
```

Rename `"two themes carry the same nine cues, each arranged for every emphasis"` to `"two themes carry the same cues, each arranged for every emphasis"`.

Add a new test after the 5 kHz test:

```js
test("outcome cues keep their contour in every theme", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  // the lowest core layer (no emphasis tag) at each onset, in time order
  const onsets = (recipe) => {
    const byOffset = new Map();
    for (const layer of recipe.layers) {
      if (layer.from) continue;
      const hz = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
      const at = layer.offset ?? 0;
      byOffset.set(at, Math.min(hz, byOffset.get(at) ?? Infinity));
    }
    return [...byOffset].sort(([a], [b]) => a - b).map(([, hz]) => hz);
  };
  for (const [theme, cues] of Object.entries(THEMES)) {
    const [s1, s2] = onsets(cues.success);
    const [e1, e2] = onsets(cues.error);
    const [w1, w2] = onsets(cues.warning);
    const [a1, a2] = onsets(cues.attention);
    assert.ok(s2 > s1, `${theme} success rises`);
    assert.ok(e2 < e1, `${theme} error falls`);
    assert.equal(w2, w1, `${theme} warning stays level`);
    assert.ok(a2 > a1, `${theme} attention rises`);
    assert.equal(onsets(cues.ready).length, 1, `${theme} ready is one note`);
  }
});
```

In the binding test, extend the precondition and the `data-cuelume-tap` block. Replace:

```js
  assert.equal(new Set(["tap", "type", "select", "open", "success"].map(gainOf)).size, 5);
```

with:

```js
  const identified = ["tap", "type", "select", "open", "success", "loading", "ready"];
  assert.equal(new Set(identified.map(gainOf)).size, identified.length);
```

and after the line `assert.equal(played(1, () => root.emit("click", button)), gainOf("success"));` (the `chime` case) add:

```js
  // 0.2's loading and ready are cues again, not stand-ins
  button.setAttribute("data-cuelume-tap", "loading");
  assert.equal(played(1, () => root.emit("click", button)), gainOf("loading"));
  button.setAttribute("data-cuelume-tap", "ready");
  assert.equal(played(1, () => root.emit("click", button)), gainOf("ready"));
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd $TACTILE && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`
Expected: FAIL on the palette, migration, contour, and binding tests (`warning` is undefined; `loading` resolves to `tap`).

- [ ] **Step 3: Add the four `default` recipes**

In `src/sounds/recipes.ts`, append inside `RECIPES`, after `navigate`:

```ts
  /** One mallet note struck twice at one pitch. Success rises and error falls; warning stays level. */
  warning: {
    masterGain: 0.42,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 440, attack: 0.003, decay: 0.1, peak: 0.044 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1760, attack: 0.001, decay: 0.025, peak: 0.007 },
      { kind: "tone", waveform: "sine", frequency: 440, offset: 0.1, attack: 0.003, decay: 0.14, peak: 0.04 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1760, offset: 0.1, attack: 0.001, decay: 0.025, peak: 0.006 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 220, offset: 0.1, attack: 0.005, decay: 0.2, peak: 0.02 },
    ],
  },
  /** One muted note that swells in and is never struck, over a breath of air: work has begun, nothing has landed. */
  loading: {
    masterGain: 0.5,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 392, attack: 0.09, decay: 0.16, peak: 0.03 },
      { from: "normal", kind: "noise", filterType: "lowpass", filterFrequency: 900, filterQ: 0.7, attack: 0.08, decay: 0.1, peak: 0.05 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 196, attack: 0.1, decay: 0.2, peak: 0.02 },
    ],
  },
  /** One glass note, lower and longer than tap, in success's small room: a result is there. */
  ready: {
    masterGain: 0.45,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 783.99, attack: 0.004, decay: 0.34, peak: 0.022 },
      { kind: "tone", waveform: "sine", frequency: 788.5, attack: 0.004, decay: 0.28, peak: 0.012 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, attack: 0.002, decay: 0.09, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 392, attack: 0.006, decay: 0.4, peak: 0.014 },
    ],
    shimmer: { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 },
  },
  /** Two glass notes rising a fourth, spaced like a call: blocked until the user answers. */
  attention: {
    masterGain: 0.45,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 880, attack: 0.003, decay: 0.22, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 885.1, attack: 0.003, decay: 0.18, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2428.8, attack: 0.002, decay: 0.06, peak: 0.005 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.16, attack: 0.003, decay: 0.3, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 1181.5, offset: 0.16, attack: 0.003, decay: 0.24, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3242, offset: 0.16, attack: 0.002, decay: 0.07, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 587.33, offset: 0.16, attack: 0.006, decay: 0.36, peak: 0.012 },
    ],
  },
```

Update the file's header comment from "the nine canonical cues" to "the thirteen canonical cues".

- [ ] **Step 4: Promote `loading` and `ready` out of the aliases**

In `ALIASES`, delete these two lines:

```ts
  loading: "tap",
  ready: "success",
```

`LegacySoundName` is derived from `ALIASES`, so it drops them automatically. Canonical names resolve first in `resolveSound`, so nothing else changes.

- [ ] **Step 5: Add the four `mech` recipes**

In `src/sounds/mech.ts`, append inside `MECH`, after `navigate`:

```ts
  /** Two dry metal taps at one pitch: level, neither the rise of success nor the fall of error. */
  warning: {
    masterGain: 0.48,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 783.99, attack: 0.001, decay: 0.08, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, attack: 0.001, decay: 0.025, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 783.99, offset: 0.09, attack: 0.001, decay: 0.1, peak: 0.045 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2163.8, offset: 0.09, attack: 0.001, decay: 0.025, peak: 0.011 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 300, filterQ: 2, offset: 0.09, attack: 0.001, decay: 0.03, peak: 0.25 },
    ],
  },
  /** A latch drawn back and held: a slow, low slide with no catch at the end. */
  loading: {
    masterGain: 1,
    layers: [
      { kind: "noise", filterType: "bandpass", filterFrequency: 500, glideTo: 900, glideTime: 0.2, filterQ: 1.5, attack: 0.12, decay: 0.1, peak: 0.08 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 1300, filterQ: 4, attack: 0.1, decay: 0.06, peak: 0.03 },
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 250, filterQ: 0.7, attack: 0.1, decay: 0.12, peak: 0.1 },
    ],
  },
  /** One dry struck bar, lower than success: a result is there. */
  ready: {
    masterGain: 0.48,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 523.25, attack: 0.001, decay: 0.16, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 1444.2, attack: 0.001, decay: 0.04, peak: 0.012 },
      { from: "normal", kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 2, attack: 0.001, decay: 0.003, peak: 0.05 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 261.63, attack: 0.002, decay: 0.2, peak: 0.03 },
    ],
  },
  /** Two metal taps rising a fourth, spaced like a call. */
  attention: {
    masterGain: 0.48,
    layers: [
      { kind: "tone", waveform: "sine", frequency: 880, attack: 0.001, decay: 0.1, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2428.8, attack: 0.001, decay: 0.03, peak: 0.012 },
      { kind: "tone", waveform: "sine", frequency: 1174.66, offset: 0.16, attack: 0.001, decay: 0.14, peak: 0.05 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 3242, offset: 0.16, attack: 0.001, decay: 0.03, peak: 0.012 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 300, filterQ: 2, offset: 0.16, attack: 0.001, decay: 0.03, peak: 0.25 },
    ],
  },
```

Update the `mech.ts` header from "the same nine cues" to "the same thirteen cues". `satisfies Record<SoundName, SoundRecipe>` now fails the build until all four are present; that is the check.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd $TACTILE && npm test`
Expected: all PASS.

- [ ] **Step 7: Level-match the new cues**

```bash
cd $SCRATCH && node levels.mjs
```

Set `masterGain` for the eight new rows (4 cues × 2 themes) to their `suggested` values (2 decimals), then:

```bash
cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check && cd $TACTILE && npm test
```

Expected: `check` exits 0 and all tests PASS. If `loading` and `ready` master gains collide with `tap`/`success` or each other, nudge one by 0.01.

- [ ] **Step 8: Mutation check**

Confirm the new tests catch what they are for. Make each edit by hand in `dist/`, run `cd $TACTILE && node --test 2>&1 | grep -E "^not ok"`, confirm the named failure, then `npm run build` to restore `dist/` before the next one:

- `dist/sounds/recipes.js`, in `warning`: change the second `frequency: 440` (the one with `offset: 0.1`) to `415`. Expect `outcome cues keep their contour in every theme` to fail with `default warning stays level`.
- `dist/sounds/recipes.js`, in `ALIASES`: add `ready: "success",`, and rename the `ready:` key in `RECIPES` to `readyX:`. Expect the palette, migration, and binding tests to fail.
- `dist/sounds/mech.js`, in `attention`: change `frequency: 1174.66` to `frequency: 800`. Expect `mech attention rises` to fail.

Finish with `npm test`: all PASS.

- [ ] **Step 9: Render the new cues for Daniel**

```bash
cd $SCRATCH && node audition-pro.mjs && ls audition/pro
```

Expected: files 5 and 6 now exist for both themes, plus `blind-key.txt`. Do not open `blind-key.txt` in front of Daniel.

---

### Task 3: Context in `play()`, and `navigate` going back

**Files:**
- Modify: `src/sounds/context.ts` (`Shape`, `IDENTITY`, `shapeFor`, new `contextFrom`)
- Modify: `src/audio/engine.ts` (`PlayOptions`, `shaped`, `play`)
- Test: `test/runtime.test.mjs`

**Interfaces:**
- Consumes: `Context`, `KeyRole`, `InputMethod`, `shapeFor`, `layerFactors` from `context.ts` (existing).
- Produces:
  - `export function contextFrom(options: { direction?: unknown; key?: unknown; input?: unknown } | null | undefined): Context`
  - `Shape` gains `sweep: number` (1 normal, -1 reversed); `IDENTITY.sweep = 1`
  - `PlayOptions` gains `direction?: "forward" | "back"`, `key?: KeyRole`, `input?: InputMethod`

- [ ] **Step 1: Write the failing tests**

In the context test (`"context shapes cues within bounds…"`), change the identity:

```js
  const identity = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1 };
```

Change its import line to also take `contextFrom`:

```js
  const { shapeFor, layerFactors, resolveEmphasis, arrangement, contextFrom } = await import("../dist/sounds/context.js");
```

and append at the end of that test:

```js
  // play() options map onto the same context bindings produce; junk is dropped
  assert.deepEqual(contextFrom({ direction: "back", key: "delete", input: "pen" }), { direction: -1, key: "delete", input: "pen" });
  assert.deepEqual(contextFrom({ direction: "forward" }), { direction: 1 });
  for (const junk of [undefined, null, {}, { direction: "up", key: "toString", input: 3 }, { direction: 1 }, { direction: "BACK" }]) {
    assert.deepEqual(contextFrom(junk), {}, JSON.stringify(junk));
  }
  // navigate going back reverses its sweep; nothing else does
  assert.equal(shapeFor("navigate", { direction: -1 }, "normal", SLOW).sweep, -1);
  assert.equal(shapeFor("navigate", { direction: 1 }, "normal", SLOW).sweep, 1);
  assert.equal(shapeFor("select", { direction: -1 }, "normal", SLOW).sweep, 1);
```

In the render test (`"every cue renders, deprecated names play…"`), append before its closing `});`:

```js
  // play() takes the context bindings detect
  const { shapeFor } = await import("../dist/sounds/context.js");
  const SLOW = 10_000;
  const played = (cue, options) => {
    const before = filters.length;
    play(cue, options);
    return filters.slice(before);
  };
  const detent = RECIPES.select.layers[0].filterFrequency;
  const ratioOf = (options) => played("select", options)[0].frequency.value / detent;
  assert.ok(Math.abs(ratioOf({ direction: "forward" }) - 1.05) < 1e-9);
  assert.ok(Math.abs(ratioOf({ direction: "back" }) - 0.95) < 1e-9);
  // unknown values, and fields a cue doesn't listen to, leave it canonical
  for (const options of [{ direction: "up" }, { direction: 1 }, { direction: "BACK" }, { key: "enter" }, { input: "pen" }, null]) {
    assert.equal(ratioOf(options), 1, JSON.stringify(options));
  }
  const within = (cue, layer, context) => {
    const expected = shapeFor(cue, context, "normal", SLOW).pitch;
    const bound = RECIPES[cue].vary.pitch;
    for (let i = 0; i < 20; i++) {
      const ratio = played(cue, context)[0].frequency.value / RECIPES[cue].layers[layer].filterFrequency;
      assert.ok(Math.abs(ratio / expected - 1) <= bound + 1e-9, `${cue} ${JSON.stringify(context)}`);
    }
  };
  within("type", 0, { key: "enter" });
  within("tap", 0, { input: "keyboard" });

  // navigate: back plays the sweep falling, in both themes and at every emphasis
  const sweepOf = (options) => {
    const filter = played("navigate", options).find((f) => f.frequency.ramps.length > 0);
    return filter.frequency.ramps[0] - filter.frequency.value;
  };
  assert.ok(sweepOf() > 0 && sweepOf({ direction: "forward" }) > 0);
  for (const theme of ["default", "mech"]) {
    setTheme(theme);
    for (const emphasis of ["subtle", "normal", "strong"]) {
      assert.ok(sweepOf({ direction: "back", emphasis }) < 0, `${theme} ${emphasis}`);
    }
  }
  setTheme("default");
```

`tap` layer 0 is its nail tick (from `normal`), which plays at normal, so `played("tap")[0]` is that filter.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd $TACTILE && npm test 2>&1 | grep -E "^not ok|# (pass|fail)"`
Expected: FAIL. `contextFrom` is not a function, `sweep` is missing from the identity, and select's ratio stays 1.

- [ ] **Step 3: Implement `contextFrom` and `sweep` in `context.ts`**

Replace the `Shape` type and `IDENTITY`:

```ts
/** `sweep` is 1, or -1 to play a cue's glides backwards. */
export type Shape = { pitch: number; level: number; length: number; bright: number; tail: number; sweep: number };

const IDENTITY: Shape = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1 };
```

In `shapeFor`, after the `select` line:

```ts
  // navigate: going back plays the sweep falling instead of rising
  if (sound === "navigate" && context.direction === -1) parts.push({ sweep: -1 });
```

Replace the body of `resolveEmphasis` so it shares a helper, and add `contextFrom` below it:

```ts
const own = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);

export function resolveEmphasis(value: unknown): Emphasis {
  return typeof value === "string" && own(EMPHASIS, value) ? (value as Emphasis) : "normal";
}

const DIRECTIONS = { forward: 1, back: -1 } as const;

/**
 * The context a caller passed to `play()`, in the shape bindings produce.
 * Unknown values are left out, so the cue plays as it would with none.
 */
export function contextFrom(options: { direction?: unknown; key?: unknown; input?: unknown } | null | undefined): Context {
  const context: Context = {};
  if (!options) return context;
  const { direction, key, input } = options;
  if (typeof direction === "string" && own(DIRECTIONS, direction)) context.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
  if (typeof key === "string" && own(KEYS, key)) context.key = key as KeyRole;
  if (typeof input === "string" && own(INPUTS, input)) context.input = input as InputMethod;
  return context;
}
```

- [ ] **Step 4: Wire it through `engine.ts`**

Add `contextFrom`, `InputMethod`, and `KeyRole` to the import from `../sounds/context.js`.

Replace `PlayOptions`:

```ts
export type PlayOptions = {
  /** Multiplier for this play only, clamped to 0–1. */
  volume?: number;
  /** How much the action matters. Invalid values play as "normal". */
  emphasis?: Emphasis;
  /** Which way the interaction moved. Shapes `select`, and `back` plays `navigate`'s sweep falling. */
  direction?: "forward" | "back";
  /** Which key was typed. Shapes `type`. */
  key?: KeyRole;
  /** What did the activating. Shapes `tap`. */
  input?: InputMethod;
};
```

Replace `shaped`:

```ts
/**
 * A copy of `layer` bent by the play's context shape, then moved at random
 * within the recipe's own bounds, so no two plays match. A reversed sweep
 * starts where it would have ended.
 */
function shaped(layer: SoundLayer, shape: Shape, vary?: Variation): SoundLayer {
  const factors = layerFactors(layer, shape);
  const pitch = factors.pitch * (vary ? nudge(vary.pitch) : 1);
  const peak = layer.peak * factors.gain * (vary ? nudge(vary.level) : 1);
  const decay = layer.decay * factors.length;
  const start = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
  const [from, to] = shape.sweep < 0 && layer.glideTo !== undefined ? [layer.glideTo, start] : [start, layer.glideTo];
  const glideTo = to === undefined ? undefined : to * pitch;
  return layer.kind === "tone"
    ? { ...layer, frequency: from * pitch, glideTo, peak, decay }
    : { ...layer, filterFrequency: from * pitch, glideTo, peak, decay };
}
```

In the `play` implementation, replace `playInContext(sound, options, {});` with:

```ts
  playInContext(sound, options, contextFrom(options));
```

Bindings still call `playInContext` with their own context and `{ emphasis }` options, so their path is unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd $TACTILE && npm test`
Expected: all PASS, including the existing binding test (Review Focus 5).

- [ ] **Step 6: Mutation check**

Make each edit in `dist/`, run `node --test`, confirm a failure, then `npm run build` to restore:
- `dist/sounds/context.js`: change `{ sweep: -1 }` to `{ sweep: 1 }`. Expect the navigate assertions to fail.
- `dist/audio/engine.js`: change `contextFrom(options)` to `{}`. Expect the select ratio assertion to fail.
- `dist/sounds/context.js`: replace `own(DIRECTIONS, direction)` with `true`. Expect the `contextFrom` junk assertion to fail: `{ direction: "up" }` now yields `{ direction: undefined }`, which strict `deepEqual` rejects.

Finish with `npm test`, all PASS.

- [ ] **Step 7: Re-render the navigate audition**

`audition-pro.mjs` file 4 already reverses glides the same way. Re-run `cd $SCRATCH && node audition-pro.mjs` so every file reflects the final recipes.

---

### Task 4: Listening sign-off (gate)

**Files:**
- Read: `$SCRATCH/audition/pro/*`
- Modify (only on feedback): `src/sounds/recipes.ts`, `src/sounds/mech.ts`

**Interfaces:**
- Consumes: every recipe from Tasks 1–3.
- Produces: Daniel's approval, per theme, of the retune, the four new cues at all three emphases, and the blind pairs.

- [ ] **Step 1: Hand Daniel the files**

Send the absolute paths of `1-*`, `2-*`, `3-*`, `4-*`, `5-*`, `6-*` for both themes. Ask him to:
- For file 6, write down which of each pair he thinks is which before opening `blind-key.txt`.
- Listen on laptop speakers, a phone, and earbuds. Offline renders only approximate the device; flag that the limiter is not modelled.

- [ ] **Step 2: Apply feedback in a loop**

For each note, change the named recipe within the Global Constraints. Then run:

```bash
cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check && node audition-pro.mjs && cd $TACTILE && npm test
```

Expected: `check` exits 0 and tests PASS after each round. Re-send only the changed files.

A blind pair Daniel can't tell apart fails the spec's gate. Redesign the newer cue of the pair; the older one is already approved. Never make a pair distinguishable by loudness.

- [ ] **Step 3: Record what was decided**

When Daniel approves, record the final register and any recipe decisions that changed from this plan:

Re-state the existing rule (same kind, scope and title, so it updates in place). Change the body only where listening moved a value, drop "Unconfirmed", and add the approval date. For example, if nothing moved:

```bash
brain know --kind design --scope cuelume --title "Cuelume sits in a calm register for all-day use" \
  --body "Signed off by ear by Daniel on <approval date>: no layer centred above 5 kHz (drops glass's 5.4x partial), tonal cues 4 semitones lower than v0.3 (success C5-G5, error F4-D4, tap glass ~1175 Hz), noise clicks 15-20% lower, air sweeps narrower, decays of 50 ms or more 20% shorter, levels re-matched on the loudest 30 ms. Same materials, calmer; a test enforces the ceiling." \
  --evidence "tactile src/sounds/recipes.ts"
brain render
```

---

### Task 5: README and spec status

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-23-professional-palette-design.md` (status line)
- Modify: `docs/superpowers/specs/2026-07-17-volume-themes-premium-design.md` (Sound direction bullet on glass)

**Interfaces:**
- Consumes: final cue names, options, and behaviour from Tasks 1–4.
- Produces: user-facing docs that Task 6 mirrors.

- [ ] **Step 1: Edit the README**

Make these replacements in `README.md`:

1. Line 3: `Nine interaction sounds for the web, one for each interface job.` → `Thirteen interaction sounds for the web, one for each interface job.`

2. Replace the paragraph `Success and error should follow the real result of an operation, so play them from code:` and its code block with:

````md
Outcome and progress cues follow what your app is actually doing, so play them from code:

```ts
import { play } from "cuelume";

play("loading");
try {
  const { warnings } = await deploy();
  play(warnings.length ? "warning" : "success");
} catch {
  play("error");
}

play("success", { volume: 0.4 }); // quieter for this play only
```
````

3. Replace the `## Cues` table with:

```md
| Cue         | Job                                   | Character                                  |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `tap`       | Buttons, links, direct activation     | Small glassy tap                           |
| `type`      | Text entry                            | Keyboard keystroke, different every stroke |
| `select`    | Dropdowns, menus, lists               | Crisp woody detent                         |
| `toggle`    | Switching between states              | Two-part click-clack                       |
| `open`      | Menus, drawers, dialogs, disclosures  | Air drawing up, then a light latch         |
| `close`     | Closing or dismissing                 | Air falling into a soft thud               |
| `navigate`  | Routes, pages, carousels, galleries   | Soft whoosh that rises, and falls going back |
| `success`   | Confirmed completion                  | Two soft mallet notes, rising              |
| `warning`   | Done, but needs a look                | One mallet note, struck twice              |
| `error`     | Recoverable failure or refusal        | Two muted mallet notes, falling            |
| `loading`   | Slow work started                     | One muted note that swells in              |
| `ready`     | A result is there, nothing confirmed  | One glass note in a small room             |
| `attention` | Blocked until the user answers        | Two glass notes rising, like a call        |

The material tells you the kind of event before you know which one: mallets for outcomes, glass for presence, air for motion, wood and keys for input.
```

4. Add a new section directly after `## Cues`:

```md
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
| Keystroke, delete, space, return | `type` (bindings set `key`) |
| Autocomplete accepted | `select` |
| Field fails validation | `error`, subtle |
| Menu, dropdown, or list option | `select` |
| Tab, segmented control, radio | `select` (bindings set `direction`) |
| Checkbox, switch | `toggle` |
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
| AI: prompt sent / generation started | `tap` / `loading`, subtle |
| AI: generation stopped | `close` |
| AI: reply finished streaming | `ready`, subtle |
| AI: tool call needs approval | `attention` |
| AI: agent task done (PR opened, file written) | `success` |
| AI: model, tool, or network failure | `error` |

Never play a cue per streamed token, per tool call inside an agent run, or on hover. Those fire in bursts and wear any sound out; play one cue when the run ends.
```

5. In `## Context-aware`, add a row to the table:

```md
| `navigate` | `direction`, from `play()`         | `back` plays the whoosh falling instead of rising. |
```

and after the paragraph that starts `Every change is small and bounded`, add:

````md
When you play a cue from code, pass the same context yourself:

```ts
play("navigate", { direction: "back" });
play("select", { direction: "forward" });
play("type", { key: "delete" });
play("tap", { input: "keyboard", emphasis: "subtle" });
```

A field a cue doesn't listen to is ignored, and an unknown value plays the cue as normal.
````

6. In the same section, change `so nine cues give you 27 distinct sounds to choose from` to `so thirteen cues give you 39 distinct sounds to choose from`.

7. In `## Themes`, change `Both have the same nine cues, context, and emphasis` to `Both have the same thirteen cues, context, and emphasis`.

8. In `## API`, change the import line to include `type PlayOptions`, and replace the `play`, `sounds`, and `SoundName` bullets with:

```md
- **`play(name?: SoundName, options?: PlayOptions)`**: play a cue immediately. Defaults to `"tap"`. Options apply to this play only:
  - `volume?: number`, clamped to `0–1`.
  - `emphasis?: "subtle" | "normal" | "strong"`.
  - `direction?: "forward" | "back"`: shapes `select`; `back` plays `navigate` falling.
  - `key?: "printable" | "space" | "delete" | "enter"`: shapes `type`.
  - `input?: "mouse" | "touch" | "pen" | "keyboard"`: shapes `tap`.
- **`sounds`**: the thirteen cue names.
- **`SoundName`**: union type of the thirteen cue names.
```

9. In `## Migrating from 0.2`, change `0.3 replaces the seventeen-sound palette with the nine cues above.` to `0.3 replaces the seventeen-sound palette with the thirteen cues above.` Replace the table with:

```md
| 0.2 name                                         | Plays      |
| ------------------------------------------------ | ---------- |
| `chime`, `sparkle`                               | `success`  |
| `press`, `release`, `pulse`                      | `tap`      |
| `tick`, `whisper`, `scan`                        | `select`   |
| `bloom`                                          | `open`     |
| `droplet`                                        | `close`    |
| `page`, `arrival`                                | `navigate` |
| `toggle`, `success`, `error`, `loading`, `ready` | unchanged  |
```

Then delete the sentence `` `loading` has no equivalent cue, so it falls back to `tap`. `` and keep `` `play()` with no name now plays `tap` instead of `chime`. ``

- [ ] **Step 2: Check the README against the code**

```bash
cd $TACTILE && grep -n "nine\|Nine\|27 distinct\|loading.*tap" README.md
```

Expected: no matches. Every cue name in the README tables appears in `node -e 'import("./dist/index.js").then(m => console.log(m.sounds.join(" ")))'`.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-09-23-professional-palette-design.md`, change `**Status:** design approved, not built` to `**Status:** built and signed off by ear <date of Task 4 approval>; not released`.

In `docs/superpowers/specs/2026-07-17-volume-themes-premium-design.md`, in the `### Sound direction` list, replace the glass description `glass (sines at glass-bar ratios of 1, 2.76, and 5.4, with the fundamental doubled a few cents apart so it shimmers)` with `glass (sines at the glass-bar ratios 1 and 2.76, with the fundamental doubled a few cents apart so it shimmers). No layer is centred above 5 kHz`.

- [ ] **Step 4: Run the tests**

Run: `cd $TACTILE && npm test`
Expected: all PASS. Docs changes don't touch code; this confirms nothing else moved.

---

### Task 6: Bundle size and site docs

**Files:**
- Modify: `$SITE/src/components/atoms/scenes/SizeChart.astro:6-7` (badge default)
- Modify: `$SITE/public/agents.md` (full rewrite)
- Modify: `$SITE/src/pages/docs.astro` (data blocks, meta, intro, sections)

**Interfaces:**
- Consumes: the README from Task 5 (same map, same cue table).
- Produces: `SIZE`, the measured figure (e.g. `5.3 kB`), used verbatim in three places.

- [ ] **Step 1: Measure the bundle**

```bash
cd $TACTILE && npm run build && npx --yes esbuild dist/index.js --bundle --minify --format=esm | gzip -9 | wc -c
```

Expected: a byte count. `SIZE` = bytes / 1000, rounded to one decimal, plus ` kB`. The spec estimated 5.2–5.5 kB; report the real number to Daniel either way.

- [ ] **Step 2: Update the size badge**

In `SizeChart.astro`, replace `<5 kB` with the measured figure in both places it appears: the usage comment (line 6) and the `badge` default (line 7). For a 5,312-byte result both read `5.3 kB`.

- [ ] **Step 3: Rewrite `public/agents.md`**

Replace the whole file with the following, substituting the measured figure for `SIZE`. The cue table and map are copied from the README (Task 5); keep them identical.

````md
# cuelume

Cuelume is thirteen interaction sounds for the web, one for each interface
job, synthesized live with Web Audio. Add an attribute, call `bind()`, done.
Zero runtime dependencies, no audio files, SIZE min+gzip. MIT licensed.

This page is the complete guide for AI agents adding cuelume to a project.

- npm: https://www.npmjs.com/package/cuelume
- repo: https://github.com/danielwh2/cuelume

## Quickstart

```sh
npm install cuelume
# or: yarn add cuelume · pnpm add cuelume · bun add cuelume
```

```html
<button data-cuelume-tap>Save</button>
```

```ts
import { bind } from "cuelume";
bind();
```

Cuelume is **ESM-only** (native `import` or any ESM bundler; no CommonJS
`require()`). It targets modern browsers. Importing on the server is a safe
no-op, so it works in SSR frameworks; playback only happens in the browser.

## Two ways to use it

### 1. Declarative, for interface chrome

| Attribute               | Fires on                                           | Default cue |
| ----------------------- | -------------------------------------------------- | ----------- |
| `data-cuelume-tap`      | `click`                                            | `tap`       |
| `data-cuelume-type`     | `keydown` that edits text                          | `type`      |
| `data-cuelume-select`   | `change` on a native select or input, else `click` | `select`    |
| `data-cuelume-toggle`   | `click`                                            | `toggle`    |
| `data-cuelume-open`     | `click`                                            | `open`      |
| `data-cuelume-close`    | `click`                                            | `close`     |
| `data-cuelume-navigate` | `click`                                            | `navigate`  |

Leave the value empty for the default cue, or set it to any cue name. When
marked elements nest, the innermost one decides. `data-cuelume-emphasis`
(`subtle`, `normal`, or `strong`) on an element or any ancestor sets how much
the action matters. `bind()` is idempotent, delegated, and covers elements
added later.

### 2. Imperative, for outcomes and progress

```ts
import { play } from "cuelume";

play("loading");
try {
  const { warnings } = await deploy();
  play(warnings.length ? "warning" : "success", { emphasis: "strong" });
} catch {
  play("error");
}

play("navigate", { direction: "back" });
```

## Cues

| Cue         | Job                                   | Character                                  |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `tap`       | Buttons, links, direct activation     | Small glassy tap                           |
| `type`      | Text entry                            | Keyboard keystroke, different every stroke |
| `select`    | Dropdowns, menus, lists               | Crisp woody detent                         |
| `toggle`    | Switching between states              | Two-part click-clack                       |
| `open`      | Menus, drawers, dialogs, disclosures  | Air drawing up, then a light latch         |
| `close`     | Closing or dismissing                 | Air falling into a soft thud               |
| `navigate`  | Routes, pages, carousels, galleries   | Soft whoosh that rises, and falls going back |
| `success`   | Confirmed completion                  | Two soft mallet notes, rising              |
| `warning`   | Done, but needs a look                | One mallet note, struck twice              |
| `error`     | Recoverable failure or refusal        | Two muted mallet notes, falling            |
| `loading`   | Slow work started                     | One muted note that swells in              |
| `ready`     | A result is there, nothing confirmed  | One glass note in a small room             |
| `attention` | Blocked until the user answers        | Two glass notes rising, like a call        |

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
| Keystroke, delete, space, return | `type` (bindings set `key`) |
| Autocomplete accepted | `select` |
| Field fails validation | `error`, subtle |
| Menu, dropdown, or list option | `select` |
| Tab, segmented control, radio | `select` (bindings set `direction`) |
| Checkbox, switch | `toggle` |
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
| AI: prompt sent / generation started | `tap` / `loading`, subtle |
| AI: generation stopped | `close` |
| AI: reply finished streaming | `ready`, subtle |
| AI: tool call needs approval | `attention` |
| AI: agent task done (PR opened, file written) | `success` |
| AI: model, tool, or network failure | `error` |

Never play a cue per streamed token, per tool call inside an agent run, or on hover. Those fire in bursts and wear any sound out; play one cue when the run ends.

## API (complete)

```ts
import { play, bind, setEnabled, setVolume, setTheme, sounds, themes, type SoundName, type Emphasis, type ThemeName, type PlayOptions } from "cuelume";
```

- `play(name?: SoundName, options?: PlayOptions)`: play a cue now. Defaults
  to `"tap"`. Options, for this play only: `volume` (0–1), `emphasis`
  (`"subtle" | "normal" | "strong"`), `direction` (`"forward" | "back"`,
  shapes `select` and `navigate`), `key`
  (`"printable" | "space" | "delete" | "enter"`, shapes `type`), `input`
  (`"mouse" | "touch" | "pen" | "keyboard"`, shapes `tap`). Unknown values
  are ignored.
- `bind(root?: ParentNode)`: delegate all `data-cuelume-*` interactions under
  `root` (default: the whole document).
- `setEnabled(enabled: boolean)`: turn future playback on or off. Does not
  persist; your app owns the setting.
- `setVolume(volume: number)`: global volume for future playback, clamped to
  `0–1`. Does not persist.
- `setTheme(theme: ThemeName)`: `"default"` (glass, wood, air, soft mallets)
  or `"mech"` (dry machined parts). Same cues, same levels. Unknown names are
  ignored.
- `sounds`: the thirteen cue names. `themes`: `["default", "mech"]`.

## Migrating from 0.2

The 0.2 names still play the cue that does their job until 1.0, and
TypeScript marks them deprecated: `chime` and `sparkle` play `success`;
`press`, `release`, and `pulse` play `tap`; `tick`, `whisper`, and `scan`
play `select`; `bloom` plays `open`; `droplet` plays `close`; `page` and
`arrival` play `navigate`. `loading` and `ready` are cues again. Replace
`data-cuelume-press`/`data-cuelume-release` with `data-cuelume-tap`, and drop
`data-cuelume-hover`.

## Framework recipes

React: call `bind()` once in a top-level `useEffect(() => { bind(); }, [])`.
Astro / plain HTML: `import { bind } from "cuelume"; bind();` in a client script.
Delegated listeners keep working when frameworks replace DOM under the root.

## Guarantees you can rely on

- One cue per action, even with nested marked elements.
- Click bindings follow native activation, so Enter and Space play too.
- Typing plays only for keys that edit text, never in password fields, at
  most once every 40 ms.
- One lazy shared `AudioContext`, created on first use and resumed when the
  browser allows it.
- Invalid names or options, blocked autoplay, or missing Web Audio make
  `play()` a silent no-op, never a thrown error.
- Nothing is stored or sent: no preferences, no behaviour data.

## Guidance for good sound design

- Pick the cue by its job; the tables above are the contract.
- Use emphasis for weight: `subtle` for frequent actions, `strong` for rare
  ones that matter.
- Give people a Sound toggle and pass it to `setEnabled()`; add a volume
  control with `setVolume()` when loudness matters.
- Browsers block audio until the first interaction, so don't plan for sound
  on page load.
````

The cue table and the "Which cue?" table must stay identical to the README's (Task 5). If Task 4 listening changed a cue's character, change it in both places.

- [ ] **Step 4: Update `docs.astro` data**

Replace `NAV`, `SIG`, `SNIPPETS`, `SOUNDS`, and `ATTRIBUTES`, and add `MAP`. Colours for the first nine match the landing page chips; the new four use site tokens or the warning accent already in `Button.astro`:

```ts
const NAV = [
  {
    group: "Getting started",
    items: [
      { id: "install", label: "Install" },
      { id: "quick-start", label: "Quick start" },
      { id: "attributes", label: "Attributes" },
    ],
  },
  {
    group: "API",
    items: [
      { id: "bind", label: "bind()", mono: true },
      { id: "play", label: "play()", mono: true },
      { id: "set-theme", label: "setTheme()", mono: true },
      { id: "set-volume", label: "setVolume()", mono: true },
      { id: "set-enabled", label: "setEnabled()", mono: true },
      { id: "sounds-export", label: "sounds", mono: true },
      { id: "sound-name", label: "SoundName", mono: true },
    ],
  },
  {
    group: "Reference",
    items: [
      { id: "catalog", label: "Sound catalog" },
      { id: "which-cue", label: "Which cue?" },
      { id: "behavior", label: "Behavior" },
    ],
  },
];

const SIG = {
  bind: "bind(root?: ParentNode): void",
  play: "play(name?: SoundName, options?: PlayOptions): void",
  setTheme: 'setTheme(theme: "default" | "mech"): void',
  setVolume: "setVolume(volume: number): void",
  setEnabled: "setEnabled(enabled: boolean): void",
  sounds: "sounds: readonly SoundName[]",
  soundName:
    'type SoundName = "tap" | "type" | "select" | "toggle" | "open" | "close" | "success" | "error" | "navigate" | "warning" | "loading" | "ready" | "attention"',
};

const SNIPPETS = {
  markup: `<button data-cuelume-tap>Save</button>
<input data-cuelume-type placeholder="Search">
<button data-cuelume-open>Open menu</button>
<a href="/settings" data-cuelume-navigate>Settings</a>`,

  bindOnce: `import { bind } from "cuelume";

bind();`,

  bind: `import { bind } from "cuelume";

bind();                               // the whole document
bind(document.querySelector("#app")); // or one subtree`,

  play: `import { play } from "cuelume";

play("loading");
try {
  await exportReport();
  play("ready");                         // the file is there
} catch {
  play("error");
}

play("navigate", { direction: "back" }); // the whoosh falls
play("success", { emphasis: "strong" }); // a publish, not an autosave
play("success", { volume: 0.4 });        // quieter, just this once`,

  setTheme: `import { setTheme } from "cuelume";

setTheme("mech");    // dry, machined parts
setTheme("default"); // glass, wood, air, soft mallets`,

  setVolume: `import { setVolume } from "cuelume";

setVolume(0.7);
setVolume(Number(localStorage.getItem("ui-volume") ?? 1));`,

  setEnabled: `import { setEnabled } from "cuelume";

setEnabled(false); // further play attempts become no-ops
setEnabled(true);`,

  sounds: `import { sounds, play } from "cuelume";

sounds.forEach((name) => {
  // one button per cue
});`,

  soundName: `import { play, type SoundName } from "cuelume";

const forStatus: Record<"ok" | "warn" | "bad", SoundName> = {
  ok: "success",
  warn: "warning",
  bad: "error",
};

play(forStatus[status]);`,
};

// colors match the cue chips on the landing page, so a sound looks the same
// wherever it appears
const SOUNDS = [
  { name: "tap",       color: "#4f8cff", character: "Small glassy tap",                    use: "Buttons, links" },
  { name: "type",      color: "#d48f00", character: "Keystroke, different every stroke",   use: "Text entry" },
  { name: "select",    color: "#36a3a8", character: "Crisp woody detent",                  use: "Menus, lists, tabs" },
  { name: "toggle",    color: "#9f4fff", character: "Two-part click-clack",                use: "Switches, checkboxes" },
  { name: "open",      color: "#ff58ae", character: "Air drawing up, then a light latch",  use: "Menus, drawers, dialogs" },
  { name: "close",     color: "#64c6ff", character: "Air falling into a soft thud",        use: "Closing, dismissing" },
  { name: "success",   color: "#00c978", character: "Two soft mallet notes, rising",       use: "Confirmed completion" },
  { name: "error",     color: "#ff6b5f", character: "Two muted mallet notes, falling",     use: "Recoverable failure" },
  { name: "navigate",  color: "#d9a066", character: "Soft whoosh; falls going back",       use: "Routes, pages, galleries" },
  { name: "warning",   color: "#e0a100", character: "One mallet note, struck twice",       use: "Done, but needs a look" },
  { name: "loading",   color: "#7b5cfa", character: "One muted note that swells in",       use: "Slow work started" },
  { name: "ready",     color: "#23ad91", character: "One glass note in a small room",      use: "A result is there" },
  { name: "attention", color: "#ef7d56", character: "Two glass notes rising, like a call", use: "Blocked on the user" },
];

const ATTRIBUTES = [
  { attr: "data-cuelume-tap",      fires: "click",               sound: "tap" },
  { attr: "data-cuelume-type",     fires: "keydown (edits)",     sound: "type" },
  { attr: "data-cuelume-select",   fires: "change, else click",  sound: "select" },
  { attr: "data-cuelume-toggle",   fires: "click",               sound: "toggle" },
  { attr: "data-cuelume-open",     fires: "click",               sound: "open" },
  { attr: "data-cuelume-close",    fires: "click",               sound: "close" },
  { attr: "data-cuelume-navigate", fires: "click",               sound: "navigate" },
];

// the README's "Which cue?" table as [moment, cue, how]; keep the two in step
const MAP = [
  ["Primary button: save, send, submit", "tap", ""],
  ["Secondary or ghost button", "tap", "subtle"],
  ["Destructive confirm: delete, remove", "close", "strong"],
  ["Copy to clipboard", "success", "subtle"],
  ["Like, star, bookmark", "toggle", ""],
  ["Undo / redo", "navigate", 'subtle, direction "back" / "forward"'],
  ["Keystroke, delete, space, return", "type", "bindings set key"],
  ["Autocomplete accepted", "select", ""],
  ["Field fails validation", "error", "subtle"],
  ["Menu, dropdown, or list option", "select", ""],
  ["Tab, segmented control, radio", "select", "bindings set direction"],
  ["Checkbox, switch", "toggle", ""],
  ["Slider or stepper step", "select", "subtle, direction"],
  ["Menu or popover opens / closes", "open / close", "subtle"],
  ["Dialog or drawer opens / closes", "open / close", ""],
  ["Accordion expands / collapses", "open / close", "subtle"],
  ["Command palette", "open", "subtle, or nothing"],
  ["Toast", "the cue for what it reports", "subtle"],
  ["Route change", "navigate", ""],
  ["Back button", "navigate", 'direction "back"'],
  ["Carousel, gallery, pagination", "navigate", "subtle, direction"],
  ["Drag picked up / dropped / cancelled", "select / tap / close", "— / strong / subtle"],
  ["Reorder a list item", "select", "direction"],
  ["Saved, synced", "success", "subtle"],
  ["Payment, publish, deploy confirmed", "success", "strong"],
  ["Partial failure, deprecation, connection retrying", "warning", ""],
  ["Form rejected, permission denied", "error", ""],
  ["Upload, export, or build started", "loading", ""],
  ["Upload finished", "success", ""],
  ["Export ready to download", "ready", ""],
  ["Long job finished while the user was away", "ready", "strong"],
  ["New message in an open conversation", "ready", "subtle"],
  ["Reminder or timer due", "attention", ""],
  ["AI: prompt sent / generation started", "tap / loading", "— / subtle"],
  ["AI: generation stopped", "close", ""],
  ["AI: reply finished streaming", "ready", "subtle"],
  ["AI: tool call needs approval", "attention", ""],
  ["AI: agent task done", "success", ""],
  ["AI: model, tool, or network failure", "error", ""],
];
```

- [ ] **Step 5: Update `docs.astro` copy and sections**

- `<meta name="description">` and `og:description`: `API reference for Cuelume: bind, play, setTheme, setVolume, setEnabled, the data attributes, and all thirteen interaction cues.`
- `.doc-lede`: `Seven exports and seven attributes. Most projects only ever need <code class="tok">bind()</code>. The rest is here for sounds at an exact moment, a second material, or a listener who wants it quieter.`
- Attributes section: delete the `<p class="note">` about pairing press and release, and replace it with `<p class="note">Add <code class="tok">data-cuelume-emphasis="subtle"</code> or <code class="tok">"strong"</code> to an element or any ancestor to set how much the action matters.</p>`
- `play()` entry: change `Defaults to <code class="tok">chime</code>.` to `Defaults to <code class="tok">tap</code>.` Replace the `options.volume` paragraph with `<p>Options apply to this play only: <code class="tok">volume</code>, <code class="tok">emphasis</code>, and the context a binding would detect, <code class="tok">direction</code>, <code class="tok">key</code>, and <code class="tok">input</code>. Unknown values are ignored.</p>`. Replace the note's `Use <code class="tok">arrival</code> for client-side navigations` with `Play <code class="tok">navigate</code> on client-side navigations`.
- Add a `setTheme()` entry before `setVolume()`:

```astro
    <ApiEntry id="set-theme" name="setTheme()" signature={SIG.setTheme}>
      <p>
        Switches the material of future playback. Both themes carry the same
        thirteen cues at the same levels, so a switch changes how they sound,
        not what they mean. Unknown names are ignored and the choice is not
        persisted.
      </p>
      <CodeBlock code={SNIPPETS.setTheme} label="app.ts" copy />
    </ApiEntry>
```

- `SoundName` entry: `The union of all seventeen names.` → `The union of the thirteen cue names.`
- Catalog: `Seventeen cues, each with its own shape. Press one to hear it.` → `Thirteen cues, each with its own shape. Press one to hear it.`
- Add after the catalog section:

```astro
    <section class="doc-sect" id="which-cue">
      <h2>Which cue?</h2>
      <p>
        Pick by the job, not by the sound. Every row uses a cue that exists;
        emphasis and options do the rest. Never play one per streamed token,
        per tool call, or on hover: play one when the run ends.
      </p>
      <div class="table">
        <div class="tr th">
          <span>Moment</span>
          <span>Cue</span>
          <span>How</span>
        </div>
        {MAP.map(([moment, cue, how]) => (
          <div class="tr">
            <span>{moment}</span>
            <span class="mono-cell"><span class="cell-label">Cue</span>{cue}</span>
            <span class="mono-cell"><span class="cell-label">How</span>{how || "—"}</span>
          </div>
        ))}
      </div>
    </section>
```

- Behavior `<dl>`: replace the `Pointer-aware` and `Hover repeat guard` pairs with:

```astro
        <dt>One cue per action</dt>
        <dd>
          An event plays at most one cue, even with nested marked elements or
          several bound roots. Click bindings follow native activation, so
          Enter and Space play too.
        </dd>
        <dt>Typing that behaves</dt>
        <dd>
          Only keys that edit text play, never in a password field, at most
          once every 40ms. Holding Backspace keeps playing until there is
          nothing left to delete.
        </dd>
```

- [ ] **Step 6: Build the site and check**

```bash
cd $SITE && npm run build 2>&1 | tail -3
grep -c 'class="cue"' dist/docs/index.html
grep -o 'id="which-cue"' dist/docs/index.html
grep -n 'chime\|seventeen\|press\b' src/pages/docs.astro public/agents.md
grep -n '5 kB' src/components/atoms/scenes/SizeChart.astro public/agents.md
```

Expected: `Complete!`; `13`; `id="which-cue"`; no matches for the third grep; the fourth shows only the measured figure.

- [ ] **Step 7: Report**

Tell Daniel the measured size, that the landing page hero still says "Nine interaction sounds" and shows nine chips (the site update, out of scope here), and that `SITE/package.json` must go from `file:../tactile` back to `^0.3.0` before the site deploys.

---

## Out of scope (from the spec)

- Node/terminal playback: its own spec, after this ships.
- A binding way to mark a `navigate` link as "back".
- Headroom cues.
- The landing page update: hero copy ("Nine interaction sounds"), the studio's chips and number keys, the scope's `ENVELOPES` table, and the Save flow's faked warning.
- Version bump and `npm publish`: Daniel's call. The spec plans `0.3.0`.

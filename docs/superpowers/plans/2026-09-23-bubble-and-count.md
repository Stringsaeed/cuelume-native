# Bubble Theme and Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a playful, opt-in `bubble` theme (app-wide or per play), a 14th cue `count` that rolls for as long as a number animates, and a `direction` for `toggle`.

**Architecture:** Recipes stay data: `count` joins `src/sounds/recipes.ts` and `src/sounds/mech.ts`, and `bubble` is a new file, `src/sounds/bubble.ts`, registered in `src/sounds/themes.ts`. `duration` becomes context (`contextFrom` → `Shape.time`), and the engine's `shaped()` moves layer start times by it and stretches layers marked `stretch`. `direction: "back"` reuses the existing `sweep`, now for `navigate`, `toggle` and `count`. The engine takes a per-play `theme`, and bindings read `data-cuelume-theme` and a toggle's checked state. Levels and listening use the offline renderer in the scratchpad, never a browser.

**Tech Stack:** TypeScript (tsc to `dist/`), Web Audio, `node:test` against `dist/`, the Node offline renderer (`render-lib.mjs`). Site: Astro.

**Spec:** `docs/superpowers/specs/2026-09-23-bubble-and-count-design.md`

## Global Constraints

- Zero runtime dependencies. Add no dependencies or devDependencies. `npx esbuild` is used once, only to measure the bundle.
- No layer in any theme is centred above 5 kHz: a tone's `frequency`, a noise layer's `filterFrequency`, and any `glideTo` are all ≤ 5000.
- Tone layers are sines in every theme. Tone layers glide (`glideTo`) only in `bubble`.
- Only `success` and `ready` have a `shimmer`, in every theme.
- Every cue in every theme plays ≥ 1 layer at `subtle` and has ≥ 1 layer only `strong` plays.
- Every cue in every theme at `normal` is level-matched within 1 dB (`levels.mjs check`) of its target: the v0.3 `default` level of the same cue, or for `count`, of `select`.
- `sounds` order: the existing thirteen keep their positions; `count` is 14th. `themes` order: `default`, `mech`, `bubble`.
- Public names, verbatim: cue `"count"`, theme `"bubble"`, `PlayOptions.theme?: ThemeName`, `PlayOptions.duration?: number` (milliseconds), attribute `data-cuelume-theme`.
- `count` is written at 800 ms. `duration` clamps finite numbers to 300–2000; anything else is ignored and plays 800 ms.
- `bubble` pitch variation: `tap`, `toggle`, `open`, `close`, `navigate`, `count` ±6%; `type` ±10%; `select` ±2%; `success`, `error`, `warning`, `loading`, `ready`, `attention` 0 (level only).
- `play()` never throws. Unknown option values are ignored and the cue plays as it would without them.
- Docs never describe terminal/Node playback as available.
- Do not start dev servers, `astro dev`, or browser automation. Build with `npm run build` / `npm test` only.
- Work in place on `main`; the tree holds uncommitted v0.3–0.5 and professional-palette work. Do not commit: Daniel commits when he asks. Each task ends with a green `npm test`.
- User-facing prose follows the `no-ai-slop` skill.

Paths used below:

- `TACTILE` = `/Users/danielbelyi/Developer/Open-Source/tactile`
- `SITE` = `/Users/danielbelyi/Developer/Open-Source/cuelume-site`
- `SCRATCH` = `/private/tmp/claude-501/-Users-danielbelyi-Developer-Open-Source-tactile/ce4e4c34-bbb1-44d4-9fff-76f13f48bb5c/scratchpad` (holds `render-lib.mjs`, `levels.mjs`, `baseline.json`, and the professional palette's audition in `audition/pro/`)

## Review Focus

1. **Junk `theme` values** (`"glass"`, `"toString"`, `"__proto__"`, `"Bubble"`, `1`, `null`). Expected: the active theme plays, nothing throws, and a valid override lasts one play. Test: Task 3 Step 1.
2. **Junk `duration` values** (`-5`, `0`, `"900"`, `NaN`, `Infinity`, `null`). Expected: finite numbers clamp (`-5` and `0` play as 300); anything else plays the 800 ms original. Test: Task 1 Step 1.
3. **A `count` stretched to 2000 ms.** Expected: the audio graph stays connected until the roll has landed and rung out, not cut at 800 ms. Test: Task 1 Step 1 (cleanup delay).
4. **Toggles whose state can't be read** (no ARIA attribute, `aria-checked="mixed"`, `<input type="button">`). Expected: no direction, the ordinary sound. Test: Task 3 Step 1.
5. **Counting down quietly** (`count`, `subtle`, `direction: "back"`). Expected: it still falls, in every theme, because the bed stays at subtle. Test: Task 1 Step 1, and again for `bubble` in Task 2.

---

### Task 1: `count` in `default` and `mech`, `duration`, and reversible `toggle` and `count`

**Files:**
- Modify: `src/sounds/recipes.ts` (header, `BaseLayer`, new `COUNT_*` exports and `countTicks`, `count` recipe)
- Modify: `src/sounds/mech.ts` (header, import, `count` recipe)
- Modify: `src/sounds/themes.ts` (header comment)
- Modify: `src/sounds/context.ts` (`Context`, `Shape`, `IDENTITY`, count constants, `REVERSIBLE`, `contextFrom`, `shapeFor`)
- Modify: `src/audio/engine.ts` (`shaped`, `PlayOptions`)
- Modify: `$SCRATCH/levels.mjs` (render length, `count` target)
- Test: `test/runtime.test.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BaseLayer.stretch?: true`; `export const COUNT_TICKS: number[]`, `export const COUNT_LANDS: number`, `export function countTicks<L extends SoundLayer>(tick: L): L[]` from `recipes.ts`; `Context.duration?: number`; `Shape.time: number`; `PlayOptions.duration?: number`; `recordingContext()` in the test file, returning `{ Context, log: { sources, pitched, delays } }`.

- [ ] **Step 1: Write the failing tests**

In `test/runtime.test.mjs`:

1. Add `"count"` to `CANONICAL` and rename the first test:

```js
const CANONICAL = [
  "tap", "type", "select", "toggle", "open", "close", "success", "error", "navigate",
  "warning", "loading", "ready", "attention", "count",
];

test("palette is the fourteen canonical cues, the original nine first", async () => {
```

2. Directly after the `compressor` function, add the recording stub used by the new tests:

```js
// A Web Audio stand-in that records when each source starts and stops, and every pitch that glides.
function recordingContext() {
  const log = { sources: [], pitched: [], delays: [] };
  class Node {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }
  const source = (extra) => {
    const node = Object.assign(new Node(), extra, {
      start(at) {
        node.at = at;
      },
      stop(at) {
        node.end = at;
      },
    });
    log.sources.push(node);
    return node;
  };
  class Context {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new Node();
    createGain() {
      return Object.assign(new Node(), { gain: audioParam() });
    }
    createDynamicsCompressor() {
      return compressor(new Node());
    }
    createDelay() {
      return Object.assign(new Node(), { delayTime: audioParam() });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createOscillator() {
      const frequency = audioParam();
      log.pitched.push(frequency);
      return source({ frequency, detune: audioParam() });
    }
    createBufferSource() {
      return source({ buffer: null });
    }
    createBiquadFilter() {
      const frequency = audioParam();
      log.pitched.push(frequency);
      return Object.assign(new Node(), { frequency, Q: audioParam() });
    }
  }
  return { Context, log };
}
```

3. In `"context shapes cues within bounds…"`:

Replace the identity line with:

```js
  const identity = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1, time: 1 };
```

Replace the "cues that don't listen for a context ignore it" assertion with:

```js
  assert.deepEqual(shapeFor("success", { key: "enter", input: "touch", direction: 1, duration: 1600 }, "normal", 10), identity);
```

After the two `tap` input assertions (`shapeFor("tap", { input: "keyboard" }…`), add:

```js
  // count: duration scales time against its 800 ms original
  assert.equal(shapeFor("count", { duration: 1600 }, "normal", SLOW).time, 2);
  assert.equal(shapeFor("count", { duration: 400 }, "strong", SLOW).time, 0.5);
```

In the bounds loop, add `{ duration: 300 }, { duration: 2000 }` to `contexts`, and replace the inner layer loop's source array so every theme is covered:

```js
          for (const layer of Object.values(THEMES).flatMap((theme) => theme[cue].layers)) {
```

Replace the `contextFrom` block and the navigate sweep assertions at the end of the test with:

```js
  // play() options map onto the same context bindings produce; junk is dropped
  assert.deepEqual(contextFrom({ direction: "back", key: "delete", input: "pen" }), { direction: -1, key: "delete", input: "pen" });
  assert.deepEqual(contextFrom({ direction: "forward" }), { direction: 1 });
  // duration: finite numbers clamp to 300–2000 ms
  assert.deepEqual(contextFrom({ duration: 900 }), { duration: 900 });
  assert.deepEqual(contextFrom({ duration: 100 }), { duration: 300 });
  assert.deepEqual(contextFrom({ duration: 0 }), { duration: 300 });
  assert.deepEqual(contextFrom({ duration: 5000 }), { duration: 2000 });
  for (const junk of [undefined, null, {}, { direction: "up", key: "toString", input: 3 }, { direction: 1 }, { direction: "BACK" },
    { duration: "900" }, { duration: Number.NaN }, { duration: Infinity }]) {
    assert.deepEqual(contextFrom(junk), {}, JSON.stringify(junk));
  }
  // navigate, toggle and count going back play their glides reversed; nothing else does
  for (const cue of ["navigate", "toggle", "count"]) {
    assert.equal(shapeFor(cue, { direction: -1 }, "normal", SLOW).sweep, -1, cue);
    assert.equal(shapeFor(cue, { direction: 1 }, "normal", SLOW).sweep, 1, cue);
  }
  assert.equal(shapeFor("select", { direction: -1 }, "normal", SLOW).sweep, 1);
```

4. After the `"outcome cues keep their contour in every theme"` test, add:

```js
test("count follows its duration and falls going back, in every theme and emphasis", async (context) => {
  context.after(restoreGlobals);
  const { Context, log } = recordingContext();
  setGlobal("setTimeout", (callback, delay) => {
    log.delays.push(delay);
    return 0;
  });
  setGlobal("window", { AudioContext: Context });
  const { play, setTheme } = await import(`../dist/audio/engine.js?count=${Date.now()}`);
  const { THEMES } = await import("../dist/sounds/themes.js");
  const { arrangement } = await import("../dist/sounds/context.js");

  const played = (cue, options) => {
    const [sources, pitched] = [log.sources.length, log.pitched.length];
    play(cue, options);
    return { sources: log.sources.slice(sources), pitched: log.pitched.slice(pitched) };
  };
  const starts = (options, cue = "count") => played(cue, options).sources.map((source) => source.at);
  const glides = (cue, options) =>
    played(cue, options).pitched.filter((param) => param.ramps.length > 0).map((param) => param.ramps[0] - param.value);
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  for (const theme of Object.keys(THEMES)) {
    setTheme(theme);
    // duration moves every layer's start in proportion; only stretch layers change length
    const layers = arrangement(THEMES[theme].count.layers, "normal");
    const [short, long] = [300, 2000].map((duration) => played("count", { duration }).sources);
    assert.equal(short.length, layers.length, theme);
    layers.forEach((layer, i) => {
      const offset = layer.offset ?? 0;
      assert.ok(near(short[i].at, (offset * 300) / 800) && near(long[i].at, (offset * 2000) / 800), `${theme} layer ${i} starts in step`);
      const [a, b] = [short[i].end - short[i].at, long[i].end - long[i].at];
      assert.ok(layer.stretch ? b > a : near(a, b), `${theme} layer ${i} length`);
    });
    // clamped to 300–2000 ms; anything that isn't a finite number plays the 800 ms original
    assert.deepEqual(starts({ duration: 100 }), starts({ duration: 300 }), theme);
    assert.deepEqual(starts({ duration: -5 }), starts({ duration: 300 }), theme);
    assert.deepEqual(starts({ duration: 60_000 }), starts({ duration: 2000 }), theme);
    for (const junk of ["900", Number.NaN, Infinity, null, undefined]) {
      assert.deepEqual(starts({ duration: junk }), starts(), `${theme} ${junk}`);
    }
    // other cues ignore it
    assert.deepEqual(starts({ duration: 2000 }, "success"), starts({}, "success"), theme);
    // the graph stays up until a stretched roll has landed and rung out
    play("count", { duration: 2000 });
    const lands = Math.max(...layers.map((layer) => layer.offset ?? 0)) * 2.5 * 1000;
    assert.ok(log.delays.at(-1) > lands + 50, `${theme} cleanup`);

    // going back plays every glide reversed, so counting down falls, at every emphasis
    for (const emphasis of ["subtle", "normal", "strong"]) {
      const [up, down] = [glides("count", { emphasis }), glides("count", { emphasis, direction: "back" })];
      assert.ok(up.length > 0 && up.every((d) => d > 0), `${theme} ${emphasis} count rises`);
      assert.ok(down.length === up.length && down.every((d) => d < 0), `${theme} ${emphasis} count falls going back`);
    }
  }
  setTheme("default");
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd $TACTILE && npm test > $SCRATCH/t1.log 2>&1; tail -40 $SCRATCH/t1.log`
Expected: FAIL in `palette is the fourteen canonical cues` (no `count` in `sounds`), `deprecated names resolve…` (`resolveSound("count")` is `null`), `context shapes cues…` (no `time` in the shape), `count follows its duration…` (`THEMES.default.count` is undefined), and `every cue renders…` (`play("count")` renders nothing). The rest pass.

- [ ] **Step 3: Add `count` to both themes**

In `src/sounds/recipes.ts`:

Change the header's first line to `* The sound palette — layer/recipe types plus the fourteen canonical cues.`

In `BaseLayer`, after `from`, add:

```ts
  /** For `count`: this layer lasts as long as the count, not only starts in step with it. */
  stretch?: true;
```

Directly above the comment block that starts `// Each cue is arranged for three emphases`, add:

```ts
/**
 * When `count`'s ticks fall, in seconds, for its 800 ms original: the spacing
 * widens the way a number eases out. `duration` moves them in proportion.
 */
export const COUNT_TICKS = [0, 0.045, 0.092, 0.142, 0.196, 0.255, 0.32, 0.393, 0.476, 0.572];
/** When `count` lands, after its last tick. */
export const COUNT_LANDS = 0.69;

/** `tick` at every COUNT_TICKS offset; every other one is ornament that subtle leaves out. */
export function countTicks<L extends SoundLayer>(tick: L): L[] {
  return COUNT_TICKS.map((offset, i) => ({ ...tick, offset, ...(i % 2 ? { from: "normal" as const } : {}) }));
}
```

In `RECIPES`, after `attention`, add:

```ts
  /**
   * A number rolling to a new value: soft wooden ticks, like a fine dial, that
   * slow as the number eases out, over a breath of air that rises with the count
   * (and falls counting down), landing on a quiet glass note.
   */
  count: {
    masterGain: 0.4,
    layers: [
      ...countTicks({ kind: "noise", filterType: "bandpass", filterFrequency: 2300, filterQ: 4, attack: 0.001, decay: 0.006, peak: 0.14 }),
      { stretch: true, kind: "noise", filterType: "bandpass", filterFrequency: 700, glideTo: 1400, glideTime: 0.6, filterQ: 1.2, attack: 0.15, decay: 0.55, peak: 0.05 },
      { kind: "tone", waveform: "sine", frequency: 1046.5, offset: COUNT_LANDS, attack: 0.002, decay: 0.12, peak: 0.02 },
      { kind: "tone", waveform: "sine", frequency: 1051.2, offset: COUNT_LANDS, attack: 0.002, decay: 0.1, peak: 0.011 },
      { from: "normal", kind: "tone", waveform: "sine", frequency: 2888.3, offset: COUNT_LANDS, attack: 0.001, decay: 0.04, peak: 0.005 },
      { from: "strong", kind: "tone", waveform: "sine", frequency: 261.63, offset: COUNT_LANDS, attack: 0.004, decay: 0.16, peak: 0.02 },
    ],
    vary: { pitch: 0.02, level: 0.12 },
  },
```

In `src/sounds/mech.ts`, change the header's `the same thirteen cues` to `the same fourteen cues`, replace the import with:

```ts
import { COUNT_LANDS, countTicks, type SoundName, type SoundRecipe } from "./recipes.js";
```

and after `attention`, add:

```ts
  /** An odometer drum turning: dry ticks that slow over a sliding bed, stopping on a detent. */
  count: {
    masterGain: 0.8,
    layers: [
      ...countTicks({ kind: "noise", filterType: "bandpass", filterFrequency: 3300, filterQ: 3, attack: 0.001, decay: 0.003, peak: 0.14 }),
      { stretch: true, kind: "noise", filterType: "bandpass", filterFrequency: 500, glideTo: 900, glideTime: 0.6, filterQ: 2, attack: 0.1, decay: 0.6, peak: 0.03 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 1900, filterQ: 5, offset: COUNT_LANDS, attack: 0.001, decay: 0.01, peak: 0.25 },
      { kind: "noise", filterType: "bandpass", filterFrequency: 700, filterQ: 3, offset: COUNT_LANDS, attack: 0.001, decay: 0.015, peak: 0.2 },
      { from: "strong", kind: "noise", filterType: "bandpass", filterFrequency: 220, filterQ: 2, offset: COUNT_LANDS, attack: 0.001, decay: 0.03, peak: 0.3 },
    ],
    vary: { pitch: 0.03, level: 0.1 },
  },
```

In `src/sounds/themes.ts`, change `the same thirteen cues` to `the same fourteen cues`.

- [ ] **Step 4: Teach context and the engine `duration`, `stretch`, and reversible cues**

In `src/sounds/context.ts`:

```ts
export type Context = { input?: InputMethod; key?: KeyRole; direction?: 1 | -1; duration?: number };

/** `sweep` is 1, or -1 to play a cue's glides backwards. `time` moves when layers start. */
export type Shape = { pitch: number; level: number; length: number; bright: number; tail: number; sweep: number; time: number };

const IDENTITY: Shape = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1, time: 1 };
```

After the `CADENCE_CUES` line, add:

```ts
/** `count` is written at COUNT_MS; `duration` stretches it within these bounds. */
const COUNT_MS = 800;
const COUNT_MIN_MS = 300;
const COUNT_MAX_MS = 2000;

/** Going back plays these cues' glides backwards, so they fall. */
const REVERSIBLE: ReadonlySet<SoundName> = new Set(["navigate", "toggle", "count"]);
```

Move the line `const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));` up to sit directly above `const DIRECTIONS`. Then replace `contextFrom` with:

```ts
/**
 * The context a caller passed to `play()`, in the shape bindings produce.
 * Unknown values are left out, so the cue plays as it would with none.
 */
export function contextFrom(
  options: { direction?: unknown; key?: unknown; input?: unknown; duration?: unknown } | null | undefined,
): Context {
  const context: Context = {};
  if (!options) return context;
  const { direction, key, input, duration } = options;
  if (typeof direction === "string" && own(DIRECTIONS, direction)) context.direction = DIRECTIONS[direction as keyof typeof DIRECTIONS];
  if (typeof key === "string" && own(KEYS, key)) context.key = key as KeyRole;
  if (typeof input === "string" && own(INPUTS, input)) context.input = input as InputMethod;
  if (typeof duration === "number" && Number.isFinite(duration)) context.duration = clamp(duration, COUNT_MIN_MS, COUNT_MAX_MS);
  return context;
}
```

In `shapeFor`, replace the navigate lines with:

```ts
  if (sound === "count" && context.duration) parts.push({ time: context.duration / COUNT_MS });
  if (REVERSIBLE.has(sound) && context.direction === -1) parts.push({ sweep: -1 });
```

In `src/audio/engine.ts`, replace `shaped` with:

```ts
/**
 * A copy of `layer` bent by the play's context shape, then moved at random
 * within the recipe's own bounds, so no two plays match. A reversed sweep
 * starts where it would have ended. `time` moves every layer's start, and a
 * `stretch` layer lasts as long as the count.
 */
function shaped(layer: SoundLayer, shape: Shape, vary?: Variation): SoundLayer {
  const factors = layerFactors(layer, shape);
  const pitch = factors.pitch * (vary ? nudge(vary.pitch) : 1);
  const peak = layer.peak * factors.gain * (vary ? nudge(vary.level) : 1);
  const stretch = layer.stretch ? shape.time : 1;
  const decay = layer.decay * factors.length * stretch;
  const start = layer.kind === "tone" ? layer.frequency : layer.filterFrequency;
  const [from, to] = shape.sweep < 0 && layer.glideTo !== undefined ? [layer.glideTo, start] : [start, layer.glideTo];
  const glideTo = to === undefined ? undefined : to * pitch;
  const timing = {
    offset: (layer.offset ?? 0) * shape.time,
    attack: layer.attack * stretch,
    glideTime: layer.glideTime === undefined ? undefined : layer.glideTime * stretch,
  };
  return layer.kind === "tone"
    ? { ...layer, ...timing, frequency: from * pitch, glideTo, peak, decay }
    : { ...layer, ...timing, filterFrequency: from * pitch, glideTo, peak, decay };
}
```

In `PlayOptions`, change the `direction` comment and add `duration` after `input`:

```ts
  /** Which way the interaction moved. Shapes `select`; `back` plays `navigate`, `toggle` and `count` backwards. */
  direction?: "forward" | "back";
```

```ts
  /** How long a `count` runs, in milliseconds, clamped to 300–2000. Other cues ignore it. */
  duration?: number;
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd $TACTILE && npm test > $SCRATCH/t1.log 2>&1; tail -20 $SCRATCH/t1.log`
Expected: every test PASS (13 tests).

- [ ] **Step 6: Level-match `count`**

In `$SCRATCH/levels.mjs`, change the render length in `loudness` from `0.8` to `1.0` (count lands at 0.69 s and rings past 0.8), and the neighbour map to:

```js
const NEIGHBOUR = { warning: "error", loading: "open", ready: "success", attention: "success", count: "select" };
```

Run: `cd $SCRATCH && node levels.mjs`
Expected: a table in which every existing cue reads the same as before (the longer render adds only silence to cues that end before 0.8 s) and `count` in both themes shows a suggested `masterGain`. Set `RECIPES.count.masterGain` and `MECH.count.masterGain` to the suggested values, rounded to two decimals, then:

Run: `cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check`
Expected: exit 0.

- [ ] **Step 7: Full suite**

Run: `cd $TACTILE && npm test > $SCRATCH/t1.log 2>&1; tail -12 $SCRATCH/t1.log`
Expected: all PASS.

---

### Task 2: The `bubble` theme

**Files:**
- Create: `src/sounds/bubble.ts`
- Modify: `src/sounds/themes.ts`
- Test: `test/runtime.test.mjs`

**Interfaces:**
- Consumes: `COUNT_LANDS`, `countTicks`, `ToneLayer`, `NoiseLayer`, `SoundName`, `SoundRecipe` from `recipes.ts` (Task 1).
- Produces: `export const BUBBLE: Record<SoundName, SoundRecipe>`; `THEMES.bubble`; `ThemeName` now `"default" | "mech" | "bubble"`.

- [ ] **Step 1: Write the failing tests**

1. Replace the `"two themes carry the same cues…"` test's title, `themes` assertion, and material check:

```js
test("every theme carries the same cues, each arranged for every emphasis", async () => {
```

```js
  assert.deepEqual(themes, ["default", "mech", "bubble"]);
```

```js
  // each theme is its own material, not another renamed
  for (const cue of sounds) {
    const [base, mech, bubble] = ["default", "mech", "bubble"].map((theme) => THEMES[theme][cue].layers);
    assert.notDeepEqual(mech, base, cue);
    assert.notDeepEqual(bubble, base, cue);
    assert.notDeepEqual(bubble, mech, cue);
  }
```

2. Replace the register test with:

```js
test("every layer keeps the register: nothing above 5 kHz, sines only, and only bubble's tones glide", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  for (const [theme, cues] of Object.entries(THEMES)) {
    for (const [cue, recipe] of Object.entries(cues)) {
      // a room is for results that land
      if (recipe.shimmer) assert.ok(cue === "success" || cue === "ready", `${theme} ${cue} has a room`);
      for (const layer of recipe.layers) {
        const centre = Math.max(layer.kind === "tone" ? layer.frequency : layer.filterFrequency, layer.glideTo ?? 0);
        assert.ok(centre <= 5000, `${theme} ${cue}: ${centre} Hz`);
        if (layer.kind === "tone") {
          assert.equal(layer.waveform, "sine", `${theme} ${cue}: ${layer.waveform} tone`);
          if (theme !== "bubble") assert.equal(layer.glideTo, undefined, `${theme} ${cue}: a tone that glides`);
        }
      }
    }
  }
  // bubble is made of bloops: every cue has a tone that glides
  for (const [cue, recipe] of Object.entries(THEMES.bubble)) {
    assert.ok(recipe.layers.some((layer) => layer.kind === "tone" && layer.glideTo !== undefined), `bubble ${cue} has a bloop`);
  }
});
```

3. In `"outcome cues keep their contour in every theme"`, after the `ready is one note` assertion, add:

```js
    // randomness never blurs a contour: warning's notes stay one pitch, and select's ±5% direction outweighs its jitter
    assert.equal(cues.warning.vary?.pitch ?? 0, 0, `${theme} warning's notes stay one pitch`);
    assert.ok((cues.select.vary?.pitch ?? 0) < 0.05, `${theme} select's direction outweighs its randomness`);
```

4. At the end of `"count follows its duration and falls going back…"`, replace the final `setTheme("default");` with:

```js
  // bubble's toggle and navigate glide too, so going back sinks them
  setTheme("bubble");
  for (const cue of ["toggle", "navigate"]) {
    const [up, down] = [glides(cue, {}), glides(cue, { direction: "back" })];
    assert.ok(up.length > 0 && up.every((d) => d > 0), `bubble ${cue} rises`);
    assert.ok(down.length === up.length && down.every((d) => d < 0), `bubble ${cue} sinks going back`);
  }
  setTheme("default");
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd $TACTILE && npm test > $SCRATCH/t2.log 2>&1; tail -40 $SCRATCH/t2.log`
Expected: FAIL in `every theme carries the same cues…` (`themes` has two names), `every layer keeps the register…` (`Object.entries(undefined)`), and `count follows its duration…` (`setTheme("bubble")` is ignored, so default's toggle has no glides). The rest pass.

- [ ] **Step 3: Write `src/sounds/bubble.ts`**

```ts
/**
 * The `bubble` theme: the same fourteen cues, made of water. Playful and
 * opt-in: an app switches to it with `setTheme`, or uses it for one moment with
 * `play()`'s `theme` option or `data-cuelume-theme`.
 *
 * Built from bloops (a sine gliding up the way a bubble does as it surfaces),
 * pops (a short burst of low-passed noise), and fizz. The only theme whose
 * tones glide. Nothing is centred above 5 kHz, contours match the other themes
 * (success rises, error falls, warning stays level, attention rises), and
 * levels match the default palette on the loudest 30 ms.
 *
 * Arranged for emphasis like the other themes: layers marked from "normal"
 * are ornament that subtle leaves out, and each cue has a layer only strong
 * plays.
 */

import { COUNT_LANDS, countTicks, type NoiseLayer, type SoundName, type SoundRecipe, type ToneLayer } from "./recipes.js";

/** How far a bloop rises; a sinking bloop falls by the same ratio. */
const RISE = 1.5;

/** A bubble surfacing: a sine that glides up by RISE in 40 ms. */
const bloop = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer => ({
  kind: "tone", waveform: "sine", frequency, glideTo: frequency * RISE, glideTime: 0.04, attack: 0.002, decay, peak, ...more,
});

/** A bubble going under: the same glide, downward and a little slower. */
const sink = (frequency: number, decay: number, peak: number, more: Partial<ToneLayer> = {}): ToneLayer =>
  bloop(frequency, decay, peak, { glideTo: frequency / RISE, glideTime: 0.06, ...more });

/** A bubble bursting: 3 ms of low-passed noise. */
const pop = (filterFrequency: number, peak: number, more: Partial<NoiseLayer> = {}): NoiseLayer => ({
  kind: "noise", filterType: "lowpass", filterFrequency, filterQ: 0.9, attack: 0.001, decay: 0.003, peak, ...more,
});

/** Input and surface cues: no two bubbles match. */
const LIVELY = { pitch: 0.06, level: 0.1 };
/** Outcome and progress cues vary in level only, so a rise stays a rise and a level note stays level. */
const STEADY = { pitch: 0, level: 0.08 };
const ROOM = { delay: 0.035, feedback: 0.2, wet: 0.1, lowpass: 3200 };

export const BUBBLE = {
  /** One small bloop. */
  tap: {
    masterGain: 0.5,
    layers: [
      bloop(880, 0.035, 0.04),
      pop(2400, 0.05, { from: "normal" }),
      bloop(440, 0.06, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** A tiny pop, pitched differently every stroke. */
  type: {
    masterGain: 0.5,
    layers: [
      pop(1800, 0.12),
      bloop(1320, 0.012, 0.012, { from: "normal", glideTime: 0.015 }),
      pop(500, 0.2, { from: "strong", decay: 0.012 }),
    ],
    vary: { pitch: 0.1, level: 0.2 },
  },
  /** A pop and a bloop; a later option rises, an earlier one falls. */
  select: {
    masterGain: 0.5,
    layers: [
      pop(2000, 0.06, { from: "normal" }),
      bloop(740, 0.03, 0.04),
      bloop(370, 0.05, 0.03, { from: "strong" }),
    ],
    vary: { pitch: 0.02, level: 0.1 },
  },
  /** A bloop up; switching off plays it sinking. */
  toggle: {
    masterGain: 0.5,
    layers: [
      bloop(622.25, 0.045, 0.04),
      pop(2200, 0.04, { from: "normal" }),
      bloop(311.13, 0.06, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Two bloops rising. */
  open: {
    masterGain: 0.5,
    layers: [
      bloop(523.25, 0.05, 0.035),
      bloop(783.99, 0.07, 0.035, { offset: 0.06 }),
      pop(2200, 0.04, { from: "normal", offset: 0.06 }),
      bloop(261.63, 0.08, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** One bloop sinking. */
  close: {
    masterGain: 0.5,
    layers: [
      sink(783.99, 0.07, 0.04),
      pop(1200, 0.06, { from: "normal", offset: 0.05 }),
      sink(261.63, 0.08, 0.03, { from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Three quick bloops, each rising an octave; going back, each sinks. */
  navigate: {
    masterGain: 0.5,
    layers: [
      bloop(440, 0.04, 0.03, { glideTo: 880, glideTime: 0.05 }),
      bloop(440, 0.04, 0.03, { glideTo: 880, glideTime: 0.05, offset: 0.045 }),
      bloop(440, 0.05, 0.03, { glideTo: 880, glideTime: 0.05, offset: 0.09, from: "normal" }),
      bloop(220, 0.1, 0.025, { glideTo: 440, glideTime: 0.1, from: "strong" }),
    ],
    vary: LIVELY,
  },
  /** Two bubbles rising a fifth, C5 to G5, in a small room. */
  success: {
    masterGain: 0.5,
    layers: [
      bloop(523.25, 0.1, 0.04),
      pop(2000, 0.04, { from: "normal" }),
      bloop(783.99, 0.14, 0.04, { offset: 0.09 }),
      pop(2400, 0.04, { from: "normal", offset: 0.09 }),
      bloop(261.63, 0.18, 0.025, { from: "strong", offset: 0.09 }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** A bubble sinking twice, the second lower. */
  error: {
    masterGain: 0.5,
    layers: [
      sink(392, 0.08, 0.045),
      pop(1400, 0.04, { from: "normal" }),
      sink(329.63, 0.11, 0.045, { offset: 0.12 }),
      pop(250, 0.2, { from: "strong", decay: 0.03 }),
    ],
    vary: STEADY,
  },
  /** Two bloops at one pitch. */
  warning: {
    masterGain: 0.5,
    layers: [
      bloop(587.33, 0.07, 0.04),
      pop(2000, 0.04, { from: "normal" }),
      bloop(587.33, 0.1, 0.04, { offset: 0.1 }),
      bloop(293.66, 0.12, 0.025, { from: "strong", offset: 0.1 }),
    ],
    vary: STEADY,
  },
  /** Fizz that swells, with a few tiny bubbles in it. Nothing lands. */
  loading: {
    masterGain: 0.5,
    layers: [
      { kind: "noise", filterType: "lowpass", filterFrequency: 1400, filterQ: 0.7, attack: 0.12, decay: 0.16, peak: 0.08 },
      bloop(1318.51, 0.012, 0.008, { from: "normal", offset: 0.06, glideTime: 0.012 }),
      bloop(1567.98, 0.012, 0.008, { from: "normal", offset: 0.13, glideTime: 0.012 }),
      { from: "strong", kind: "noise", filterType: "lowpass", filterFrequency: 400, filterQ: 0.7, attack: 0.1, decay: 0.2, peak: 0.1 },
    ],
    vary: STEADY,
  },
  /** One round bloop in a small room. */
  ready: {
    masterGain: 0.5,
    layers: [
      bloop(523.25, 0.2, 0.04, { glideTime: 0.05 }),
      pop(2000, 0.04, { from: "normal" }),
      bloop(261.63, 0.24, 0.025, { from: "strong" }),
    ],
    shimmer: ROOM,
    vary: STEADY,
  },
  /** Two bloops rising a fourth, spaced like a call. */
  attention: {
    masterGain: 0.5,
    layers: [
      bloop(659.25, 0.1, 0.035),
      pop(2200, 0.04, { from: "normal" }),
      bloop(880, 0.14, 0.035, { offset: 0.16 }),
      pop(2600, 0.04, { from: "normal", offset: 0.16 }),
      bloop(329.63, 0.16, 0.025, { from: "strong", offset: 0.16 }),
    ],
    vary: STEADY,
  },
  /** A stream of bubbles thinning out as the number slows, landing on a pop. */
  count: {
    masterGain: 0.5,
    layers: [
      ...countTicks(bloop(880, 0.02, 0.03)),
      pop(1600, 0.08, { offset: COUNT_LANDS }),
      bloop(587.33, 0.08, 0.04, { offset: COUNT_LANDS }),
      bloop(293.66, 0.12, 0.03, { from: "strong", offset: COUNT_LANDS }),
    ],
    vary: LIVELY,
  },
} satisfies Record<SoundName, SoundRecipe>;
```

In `src/sounds/themes.ts`, add `import { BUBBLE } from "./bubble.js";` above the `MECH` import, and add `bubble: BUBBLE,` after `mech: MECH,`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd $TACTILE && npm test > $SCRATCH/t2.log 2>&1; tail -20 $SCRATCH/t2.log`
Expected: all PASS.

- [ ] **Step 5: Level-match `bubble`**

Run: `cd $SCRATCH && node levels.mjs`
Expected: 14 `bubble` rows, each with a suggested `masterGain`. Set every `BUBBLE[cue].masterGain` to its suggestion, rounded to two decimals. Rebuild and check:

Run: `cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check`
Expected: exit 0. If a cue swings past 1 dB between two runs, set it halfway between the two suggestions and ledger a ruling, as was done for mech `tap` and `select`.

Task 3's binding test tells themes apart by `tap`'s master gain, so `default`, `mech` and `bubble` must have three different `tap.masterGain` values. If two match after rounding, move `bubble`'s by 0.01 (under 0.2 dB) and ledger it.

- [ ] **Step 6: Full suite**

Run: `cd $TACTILE && npm test > $SCRATCH/t2.log 2>&1; tail -12 $SCRATCH/t2.log`
Expected: all PASS.

---

### Task 3: A theme per play, `data-cuelume-theme`, and a toggle's direction from bindings

**Files:**
- Modify: `src/audio/engine.ts` (`PlayOptions`, `playInContext`)
- Modify: `src/interactions/bind.ts` (header, imports, `switched`, click listener, `listen`)
- Test: `test/runtime.test.mjs`

**Interfaces:**
- Consumes: `THEMES.bubble` and `bubble.toggle`'s first layer being a rising bloop (Task 2); `recordingContext()` (Task 1).
- Produces: `PlayOptions.theme?: ThemeName`; bindings pass `{ emphasis, theme }` and, for `data-cuelume-toggle`, a `direction`.

- [ ] **Step 1: Write the failing tests**

1. After `"count follows its duration…"`, add:

```js
test("a per-play theme plays that theme once and leaves the active one", async (context) => {
  context.after(restoreGlobals);
  const { Context, log } = recordingContext();
  setGlobal("setTimeout", () => 0);
  setGlobal("window", { AudioContext: Context });
  const { play, setTheme } = await import(`../dist/audio/engine.js?theme=${Date.now()}`);
  const { THEMES } = await import("../dist/sounds/themes.js");

  // tap's first layer tells the themes apart: a noise tick in default and mech, a bloop in bubble
  const firstPitch = (options) => {
    const before = log.pitched.length;
    play("tap", options);
    return log.pitched[before].value;
  };
  const is = (theme, value) => {
    const { layers, vary } = THEMES[theme].tap;
    const base = layers[0].kind === "tone" ? layers[0].frequency : layers[0].filterFrequency;
    return Math.abs(value / base - 1) <= (vary?.pitch ?? 0) + 1e-9;
  };

  assert.ok(is("default", firstPitch()));
  assert.ok(is("bubble", firstPitch({ theme: "bubble" })));
  assert.ok(is("default", firstPitch()), "the override lasts one play");
  setTheme("mech");
  assert.ok(is("default", firstPitch({ theme: "default" })));
  for (const junk of ["glass", "toString", "__proto__", "Bubble", 1, null]) {
    assert.ok(is("mech", firstPitch({ theme: junk })), String(junk));
  }
  assert.ok(is("mech", firstPitch()));
  setTheme("default");
});
```

2. In `"binding is delegated, dynamic, idempotent…"`, collect oscillator pitches. Add `const oscillators = [];` next to `const filters = [];`, and replace `createOscillator` in that test's `WorkingContext` with:

```js
    createOscillator() {
      const frequency = audioParam();
      oscillators.push(frequency);
      return Object.assign(new AudioNodeStub(), {
        frequency,
        detune: audioParam(),
        start() {},
        stop() {},
      });
    }
```

At the end of the same test, after the emphasis assertions, add:

```js
  // data-cuelume-theme picks the material, on the element or any ancestor; the innermost wins
  const { THEMES } = await import("../dist/sounds/themes.js");
  assert.equal(new Set(["default", "mech", "bubble"].map((theme) => THEMES[theme].tap.masterGain)).size, 3);
  const modelMenu = new FakeElement(root, "DIV", { "data-cuelume-theme": "bubble" });
  const model = new FakeElement(modelMenu, "BUTTON", { "data-cuelume-tap": "" });
  now += 1_000;
  assert.equal(played(1, () => root.emit("click", model)), THEMES.bubble.tap.masterGain);
  model.setAttribute("data-cuelume-theme", "mech");
  now += 1_000;
  assert.equal(played(1, () => root.emit("click", model)), THEMES.mech.tap.masterGain);
  model.setAttribute("data-cuelume-theme", "glass"); // unknown: the active theme
  now += 1_000;
  assert.equal(played(1, () => root.emit("click", model)), gainOf("tap"));

  // toggle: switching off plays back, which sinks bubble's bloop
  const sinks = (element) => {
    const before = oscillators.length;
    now += 1_000;
    root.emit("click", element);
    const bloop = oscillators[before];
    return bloop.ramps[0] < bloop.value;
  };
  const bubbly = new FakeElement(root, "DIV", { "data-cuelume-theme": "bubble" });
  // a native checkbox has already changed when its click arrives
  const checkbox = Object.assign(new FakeElement(bubbly, "INPUT", { "data-cuelume-toggle": "" }), { type: "checkbox", checked: true });
  assert.equal(sinks(checkbox), false);
  checkbox.checked = false;
  assert.equal(sinks(checkbox), true);
  // ARIA state hasn't changed yet: "true" means this click switches it off
  const toggleSwitch = new FakeElement(bubbly, "BUTTON", { "data-cuelume-toggle": "", "aria-checked": "true" });
  assert.equal(sinks(toggleSwitch), true);
  toggleSwitch.setAttribute("aria-checked", "false");
  assert.equal(sinks(toggleSwitch), false);
  assert.equal(sinks(new FakeElement(bubbly, "BUTTON", { "data-cuelume-toggle": "", "aria-pressed": "true" })), true);
  // no state, a mixed state, or an input that isn't a checkbox: no direction
  for (const element of [
    new FakeElement(bubbly, "BUTTON", { "data-cuelume-toggle": "" }),
    new FakeElement(bubbly, "BUTTON", { "data-cuelume-toggle": "", "aria-checked": "mixed" }),
    Object.assign(new FakeElement(bubbly, "INPUT", { "data-cuelume-toggle": "" }), { type: "button", checked: false }),
  ]) {
    assert.equal(sinks(element), false);
  }
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd $TACTILE && npm test > $SCRATCH/t3.log 2>&1; tail -40 $SCRATCH/t3.log`
Expected: FAIL in `a per-play theme…` (`{ theme: "bubble" }` plays default) and `binding is delegated…` (the `data-cuelume-theme` click plays default's gain). The rest pass.

- [ ] **Step 3: The engine takes a theme per play**

In `src/audio/engine.ts`, add to `PlayOptions` after `input`:

```ts
  /** The material for this play only; the active theme is unchanged. Unknown names play the active theme. */
  theme?: ThemeName;
```

In `playInContext`, replace `const recipe: SoundRecipe = THEMES[activeTheme][name];` with:

```ts
  const requested = options?.theme;
  const recipe: SoundRecipe = THEMES[isThemeName(requested) ? requested : activeTheme][name];
```

- [ ] **Step 4: Bindings read the theme and a toggle's state**

In `src/interactions/bind.ts`, extend the header's last paragraph:

```ts
 * Each binding also passes along what the event says about the interaction:
 * the key pressed, which way a selection moved, whether a toggle is switching
 * on or off, and what did the clicking. `data-cuelume-emphasis`, on the
 * element or any ancestor, sets how much the action matters, and
 * `data-cuelume-theme` sets the material the same way. Nothing is stored
 * beyond the page's memory.
```

Add the import:

```ts
import type { ThemeName } from "../sounds/themes.js";
```

After `siblingDirection`, add:

```ts
/**
 * Which way a toggle is switching, from the state its click finds: 1 on, -1 off.
 * A native checkbox or radio has already changed when its click is dispatched.
 * ARIA state has not: the app flips it in its own handler, after this capture listener.
 */
function switched(element: HTMLElement): Context["direction"] {
  const { type, checked } = element as HTMLInputElement;
  if (type === "checkbox" || type === "radio") return checked ? 1 : -1;
  const state = element.getAttribute("aria-checked") ?? element.getAttribute("aria-pressed");
  if (state === "true") return -1;
  return state === "false" ? 1 : undefined;
}
```

In the `click` listener, replace the `direction` line with:

```ts
    const direction = selecting ? siblingDirection(element) : attr === "data-cuelume-toggle" ? switched(element) : undefined;
```

In `listen`, replace the `emphasis` and `playInContext` lines with:

```ts
      const emphasis = element.closest("[data-cuelume-emphasis]")?.getAttribute("data-cuelume-emphasis");
      const theme = element.closest("[data-cuelume-theme]")?.getAttribute("data-cuelume-theme");
      playInContext(
        resolveSound(element.getAttribute(attr)) ?? fallback,
        { emphasis: emphasis as Emphasis, theme: theme as ThemeName },
        context,
      );
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd $TACTILE && npm test > $SCRATCH/t3.log 2>&1; tail -20 $SCRATCH/t3.log`
Expected: all PASS (14 tests).

---

### Task 4: README and spec status

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-23-bubble-and-count-design.md` (status line)
- Modify: `docs/superpowers/specs/2026-09-23-professional-palette-design.md` (decision 2)

**Interfaces:**
- Consumes: final names and behaviour from Tasks 1–3.
- Produces: README text that Task 5 mirrors verbatim (cue row, map rows, burst sentence).

- [ ] **Step 1: Edit the README**

1. Line 3: `Thirteen interaction sounds for the web` → `Fourteen interaction sounds for the web`.

2. In `## Cues`, add after the `attention` row:

```md
| `count`     | A number animating to a new value     | Soft ticks that slow down, then land       |
```

3. In `## Which cue?`:
   - Change `| Checkbox, switch | `toggle` |` to `| Checkbox, switch | `toggle` (bindings set `direction`) |`.
   - After `| Reminder or timer due | `attention` |`, add:

```md
| A number animates to a new value | `count`, `duration` matching the animation |
| A number counts down | `count`, `direction: "back"` |
| A live number that updates constantly: price feed, viewers | nothing |
```

   - After `| AI: switch model or mode | `select` |`, add:

```md
| One playful moment in a professional app, e.g. the AI model picker | the usual cue, `theme: "bubble"` |
```

   - Replace the closing paragraph with:

```md
Never play a cue per streamed token, per tool call inside an agent run, or on hover. Those fire in bursts and wear any sound out; play one cue when the run ends. An animated number gets one `count` when it starts moving, never one per digit.
```

4. Add a section directly after `## Selection`:

````md
## Counting

Play `count` once when a number starts animating to a new value, and pass the animation's length so the roll lands with it:

```ts
play("count", { duration: 900 });                    // 0 → 1,284
play("count", { duration: 400, direction: "back" }); // 12 → 3
```

About ten ticks slow down as the number eases out, then land. `duration` is in milliseconds, clamped to 300–2000; without it the roll takes 800 ms. Leave numbers that change more than about once a second, like a live price, silent.
````

5. In `## Context-aware`, add two rows to the table after the `navigate` row:

```md
| `toggle`   | Which way it switched              | Switching off plays its glides backwards. Only `bubble`'s toggle glides, so only it changes. |
| `count`    | `duration` and `direction`, from `play()` | The roll stretches to the animation; `back` falls. |
```

   and change `so thirteen cues give you 39 distinct sounds to choose from` to `so fourteen cues give you 42 distinct sounds to choose from`.

6. Replace `## Themes` up to (not including) `## Sound settings` with:

````md
## Themes

Every cue comes in three finished materials. `default` is warm: glass, wood, air, and soft mallets. `mech` is dry and precise: a shutter click, a ratchet detent, a latch, struck metal. `bubble` is playful: bubbles that bloop up as they surface, pop, and fizz. All three have the same fourteen cues, context, and emphasis, and they're level-matched, so switching changes the material, not the volume.

```ts
import { play, setTheme } from "cuelume";

setTheme("mech");    // future plays use the mech material
setTheme("default");

play("select", { theme: "bubble" }); // one playful moment; the theme stays default
```

```html
<div data-cuelume-theme="bubble">
  <select data-cuelume-select>…</select>
</div>
```

`setTheme` applies to sounds played after the call. The `theme` option and `data-cuelume-theme` (on an element or any ancestor; the innermost wins) apply to one play and leave the active theme alone. Unknown names are ignored, and like volume, the choice isn't stored.

`default` and `mech` sit in a calm register for all-day use. Reach for `bubble` when a product, or one moment in it, should feel playful.

````

7. In `## API`, replace the `direction` bullet and add two after `input`:

```md
  - `direction?: "forward" | "back"`: shapes `select`; `back` plays `navigate`, `toggle`, and `count` backwards.
```

```md
  - `theme?: ThemeName`: the material for this play only.
  - `duration?: number`: how long a `count` runs, in milliseconds, clamped to `300–2000`.
```

   and change the list's remaining lines: `themes` → ``the built-in theme names, `["default", "mech", "bubble"]`.``; `sounds` → `the fourteen cue names.`; `SoundName` → `union type of the fourteen cue names.`; `ThemeName` → `` `"default" | "mech" | "bubble"`. ``

8. In `## Migrating from 0.2`, change `with the thirteen cues above` to `with the fourteen cues above`.

- [ ] **Step 2: Check the README against the code**

```bash
cd $TACTILE && grep -n "thirteen\|Thirteen\|39 distinct\|\"default\", \"mech\"\]" README.md
node -e 'import("./dist/index.js").then(m => console.log(m.sounds.join(" "), "|", m.themes.join(" ")))'
```

Expected: no grep matches. Every cue and theme named in the README appears in the node output.

- [ ] **Step 3: Update spec status**

In `docs/superpowers/specs/2026-09-23-bubble-and-count-design.md`, change `**Status:** approved design, not built` to `**Status:** built <today's date>, awaiting Daniel's listening sign-off; not released`.

In `docs/superpowers/specs/2026-09-23-professional-palette-design.md`, change decision 2's `Two slots of headroom stay empty.` to `Two slots of headroom stay empty. (One has since gone to `count`: see 2026-09-23-bubble-and-count-design.md.)`

- [ ] **Step 4: Run the tests**

Run: `cd $TACTILE && npm test > $SCRATCH/t4.log 2>&1; tail -12 $SCRATCH/t4.log`
Expected: all PASS.

---

### Task 5: Bundle size and site docs

**Files:**
- Modify: `$SITE/src/components/atoms/scenes/SizeChart.astro:6-7`
- Modify: `$SITE/public/agents.md`
- Modify: `$SITE/src/pages/docs.astro`

**Interfaces:**
- Consumes: the README from Task 4 (same cue row, map rows, burst sentence).
- Produces: `SIZE`, the measured figure (e.g. `6.3 kB`), used verbatim in three places.

- [ ] **Step 1: Measure the bundle**

```bash
cd $TACTILE && npm run build && npx --yes esbuild dist/index.js --bundle --minify --format=esm | gzip -9 | wc -c
```

Expected: a byte count. `SIZE` = bytes / 1000, rounded to one decimal, plus ` kB`. The spec estimated 6.2–6.5 kB; report the real number to Daniel either way.

- [ ] **Step 2: Update the size badge**

In `SizeChart.astro`, replace `5.2 kB` with `SIZE` in the usage comment (line 6) and the `badge` default (line 7). Leave the `5.2s` animation durations alone.

- [ ] **Step 3: Update `public/agents.md`**

1. Line 3: `Cuelume is thirteen interaction sounds` → `Cuelume is fourteen interaction sounds`. Line 5: `5.2 kB min+gzip` → `SIZE min+gzip`.
2. After the sentence ending `sets how much the action matters.` (line 49), add: `` `data-cuelume-theme` (`default`, `mech`, or `bubble`) sets the material the same way. ``
3. In the `### 2. Imperative` code block, after the `play("navigate", { direction: "back" });` line, add `play("count", { duration: 900 });`.
4. `## Cues`: add the `count` row from Task 4 Step 1.3, verbatim.
5. `## Which cue?`: make the same four row changes and the same closing paragraph as Task 4 Step 1.3, verbatim.
6. `## API (complete)`: replace the `play` bullet with:

```md
- `play(name?: SoundName, options?: PlayOptions)`: play a cue now. Defaults
  to `"tap"`. Options, for this play only: `volume` (0–1), `emphasis`
  (`"subtle" | "normal" | "strong"`), `direction` (`"forward" | "back"`,
  shapes `select`; `back` plays `navigate`, `toggle` and `count` backwards),
  `key` (`"printable" | "space" | "delete" | "enter"`, shapes `type`), `input`
  (`"mouse" | "touch" | "pen" | "keyboard"`, shapes `tap`), `theme` (a theme
  name, for this play only), `duration` (milliseconds, for `count`, clamped
  to 300–2000). Unknown values are ignored.
```

   Replace the `setTheme` bullet with:

```md
- `setTheme(theme: ThemeName)`: `"default"` (glass, wood, air, soft mallets),
  `"mech"` (dry machined parts), or `"bubble"` (bloops, pops, and fizz;
  playful). Same cues, same levels. Unknown names are ignored.
```

   and change `- `sounds`: the thirteen cue names. `themes`: `["default", "mech"]`.` to `- `sounds`: the fourteen cue names. `themes`: `["default", "mech", "bubble"]`.`
7. In `## Guidance for good sound design`, add a last bullet: `- Keep `bubble` for products, or single moments, that should feel playful; `default` and `mech` are for all-day use.`

- [ ] **Step 4: Update `src/pages/docs.astro`**

1. `SIG.setTheme` → `'setTheme(theme: "default" | "mech" | "bubble"): void'`. In `SIG.soundName`, change `| "attention"'` to `| "attention" | "count"'`.
2. `SNIPPETS.play`: after the `play("success", { volume: 0.4 });` line, add `play("count", { duration: 900 });        // a number rolling to its new value`.
3. `SNIPPETS.setTheme` becomes:

```js
  setTheme: `import { play, setTheme } from "cuelume";

setTheme("mech");    // dry, machined parts
setTheme("bubble");  // bloops, pops, and fizz
setTheme("default"); // glass, wood, air, soft mallets

play("select", { theme: "bubble" }); // one playful moment`,
```

4. `SOUNDS`: add after `attention`:

```js
  { name: "count",     color: "#6a8f3a", character: "Soft ticks that slow, then land",     use: "Numbers animating" },
```

5. `MAP`: change `["Checkbox, switch", "toggle", ""],` to `["Checkbox, switch", "toggle", "bindings set direction"],`. After `["Reminder or timer due", "attention", ""],` add:

```js
  ["A number animates to a new value", "count", "duration matching the animation"],
  ["A number counts down", "count", 'direction "back"'],
  ["A live number that updates constantly: price feed, viewers", "nothing", ""],
```

   After `["AI: switch model or mode", "select", ""],` add:

```js
  ["One playful moment in a professional app, e.g. the AI model picker", "the usual cue", 'theme "bubble"'],
```

6. Text:
   - Both meta descriptions: `all thirteen interaction cues` → `all fourteen interaction cues`.
   - The attributes note: after `how much the action matters.` add ` <code class="tok">data-cuelume-theme="bubble"</code> sets the material the same way.`
   - `play()` options paragraph becomes:

```html
      <p>
        Options apply to this play only: <code class="tok">volume</code>,
        <code class="tok">emphasis</code>, the context a binding would detect
        (<code class="tok">direction</code>, <code class="tok">key</code>,
        <code class="tok">input</code>), a <code class="tok">theme</code> for
        this play, and a <code class="tok">duration</code> for
        <code class="tok">count</code>. Unknown values are ignored.
      </p>
```

   - `setTheme()` paragraph becomes:

```html
      <p>
        Switches the material of future playback. All three themes carry the
        same fourteen cues at the same levels, so a switch changes how they
        sound, not what they mean. For one playful moment, pass
        <code class="tok">theme</code> to <code class="tok">play()</code> or set
        <code class="tok">data-cuelume-theme</code> instead. Unknown names are
        ignored and the choice is not persisted.
      </p>
```

   - `The union of the thirteen cue names` → `The union of the fourteen cue names`.
   - `Thirteen cues, each with its own shape.` → `Fourteen cues, each with its own shape.`
   - In the "Which cue?" intro, change `play one when the run ends.` to `play one when the run ends. An animated number gets one count, never one per digit.`

- [ ] **Step 5: Build the site and check**

```bash
cd $SITE && npm run build > $SCRATCH/site.log 2>&1; tail -5 $SCRATCH/site.log
grep -c 'class="cue"' dist/docs/index.html
grep -rn "thirteen\|Thirteen" src/pages/docs.astro public/agents.md
diff <(sed -n '/^## Which cue?/,/^## Typing/p' $TACTILE/README.md | sed '$d') <(sed -n '/^## Which cue?/,/^## API/p' public/agents.md | sed '$d')
```

Expected: build completes; `14` cue buttons; no `thirteen` matches; the two "Which cue?" sections are identical (empty diff; if the README section boundary differs, compare the tables by eye and say so).

- [ ] **Step 6: Run the tests**

Run: `cd $TACTILE && npm test > $SCRATCH/t5.log 2>&1; tail -12 $SCRATCH/t5.log`
Expected: all PASS.

---

### Task 6: Listening sign-off (gate)

Run this after the whole-branch final review: the review does not depend on the recipes' exact values, and Daniel's feedback may change them.

**Files:**
- Create: `$SCRATCH/audition-bubble.mjs`
- Read: `$SCRATCH/audition/bubble/*`, `$SCRATCH/audition/pro/*`
- Modify (only on feedback): `src/sounds/recipes.ts`, `src/sounds/mech.ts`, `src/sounds/bubble.ts`

**Interfaces:**
- Consumes: every recipe from Tasks 1–3.
- Produces: Daniel's approval of `bubble`, `count` in all three themes, and the blind pairs; and, in the same session, of the professional palette's pending audition (its plan's Task 4).

- [ ] **Step 1: Write the audition script**

Create `$SCRATCH/audition-bubble.mjs`:

```js
// Audition set for the bubble theme and count. Writes WAVs to ./audition/bubble/.
import { mkdirSync, writeFileSync } from "node:fs";
import { SR, render, wav } from "./render-lib.mjs";

const T = "/Users/danielbelyi/Developer/Open-Source/tactile/dist/sounds/";
const { THEMES } = await import(`${T}themes.js?${Date.now()}`);
const { arrangement } = await import(`${T}context.js?${Date.now()}`);
const dir = new URL("./audition/bubble/", import.meta.url);
mkdirSync(dir, { recursive: true });

const at = (recipe, emphasis = "normal") => ({ ...recipe, layers: arrangement(recipe.layers, emphasis) });
// the engine's shapes, applied offline: back reverses glides; duration moves starts and stretches the bed
const back = (recipe) => ({
  ...recipe,
  layers: recipe.layers.map((l) =>
    l.glideTo === undefined ? l
      : l.kind === "tone" ? { ...l, frequency: l.glideTo, glideTo: l.frequency }
      : { ...l, filterFrequency: l.glideTo, glideTo: l.filterFrequency }),
});
const timed = (recipe, ms) => {
  const time = ms / 800;
  return {
    ...recipe,
    layers: recipe.layers.map((l) => {
      const stretch = l.stretch ? time : 1;
      return { ...l, offset: (l.offset ?? 0) * time, attack: l.attack * stretch, decay: l.decay * stretch,
        ...(l.glideTime !== undefined && { glideTime: l.glideTime * stretch }) };
    }),
  };
};
const pitched = (recipe, factor) => ({
  ...recipe,
  layers: recipe.layers.map((l) => ({
    ...l,
    ...(l.kind === "tone" ? { frequency: l.frequency * factor } : { filterFrequency: l.filterFrequency * factor }),
    ...(l.glideTo !== undefined && { glideTo: l.glideTo * factor }),
  })),
});
// events are [seconds, recipe, render length]
function take(events, secs) {
  const out = new Float64Array(Math.round(SR * secs));
  for (const [t, recipe, length = 0.9] of events) {
    render(recipe, length).forEach((x, i) => {
      const j = Math.round(t * SR) + i;
      if (j < out.length) out[j] += x;
    });
  }
  return out;
}

const B = THEMES.bubble;
const cues = Object.keys(B);
wav("1-bubble-palette.wav", take(cues.map((c, i) => [0.2 + i * 0.8, at(B[c]), 1.2]), cues.length * 0.8 + 1), dir);
wav("2-bubble-subtle-normal-strong.wav", take(cues.flatMap((c, i) =>
  ["subtle", "normal", "strong"].map((e, k) => [0.2 + i * 2.4 + k * 0.75, at(B[c], e), 1.2])), cues.length * 2.4 + 1), dir);
let t = 0.2;
const typing = [];
for (let k = 0; k < 24; k++) { typing.push([t, at(B.type)]); t += 0.07 + Math.random() * 0.05; }
wav("3-bubble-typing.wav", take(typing, t + 0.5), dir);
// count at 300, 800 and 2000 ms, each up then back, per theme
for (const theme of Object.keys(THEMES)) {
  const events = [];
  let start = 0.2;
  for (const ms of [300, 800, 2000]) {
    for (const recipe of [THEMES[theme].count, back(THEMES[theme].count)]) {
      events.push([start, timed(at(recipe), ms), ms / 1000 + 0.4]);
      start += ms / 1000 + 0.9;
    }
  }
  wav(`4-${theme}-count-300-800-2000-up-then-back.wav`, take(events, start + 0.5), dir);
}
// a model picker: open, move down twice and back once, pick, close; default first, then bubble
const picker = (theme, from) => {
  const C = THEMES[theme];
  return [[0, at(C.open, "subtle")], [0.7, pitched(at(C.select), 1.05)], [1.2, pitched(at(C.select), 1.05)],
    [1.7, pitched(at(C.select), 0.95)], [2.3, at(C.select)], [2.7, at(C.close, "subtle")]].map(([s, r]) => [from + s, r]);
};
wav("5-model-picker-default-then-bubble.wav", take([...picker("default", 0.2), ...picker("bubble", 4.2)], 7.6), dir);
// blind pairs, each in random order; the answers go to a file, not the console
const PAIRS = [
  ...Object.keys(THEMES).map((theme) => [theme, "count", "navigate", "subtle"]),
  ["bubble", "success", "ready", "normal"],
  ["bubble", "warning", "error", "normal"],
  ["bubble", "attention", "success", "normal"],
  ["bubble", "loading", "open", "subtle"],
];
const key = [];
const events = [];
PAIRS.forEach(([theme, a, b, emphasis], i) => {
  const order = Math.random() < 0.5 ? [a, b] : [b, a];
  key.push(`pair ${i + 1} (${theme}, ${emphasis}): first ${order[0]}, then ${order[1]}`);
  order.forEach((c, k) => events.push([0.2 + i * 3 + k * 1.2, at(THEMES[theme][c], emphasis), 1.1]));
});
wav("6-blind-pairs.wav", take(events, PAIRS.length * 3 + 0.8), dir);
writeFileSync(new URL("blind-key.txt", dir), key.join("\n") + "\n");
console.log("wrote", dir.pathname);
```

Run: `cd $TACTILE && npm run build && cd $SCRATCH && node audition-bubble.mjs && ls audition/bubble`
Expected: `wrote …/audition/bubble/` and 10 files: `1-…`, `2-…`, `3-…`, three `4-*-count-…`, `5-…`, `6-blind-pairs.wav`, `blind-key.txt`.

- [ ] **Step 2: Hand Daniel both sets**

Send the absolute paths of every file in `$SCRATCH/audition/bubble/` and `$SCRATCH/audition/pro/`: one listening session covers the professional palette and this work. Ask him to:
- For each `6-*blind-pairs.wav`, write down which of each pair he thinks is which before opening that folder's `blind-key.txt`.
- Listen on laptop speakers, a phone, and earbuds. The offline renders skip the limiter, so devices can differ slightly.

- [ ] **Step 3: Apply feedback in a loop**

For each note, change the named recipe within the Global Constraints, then:

```bash
cd $TACTILE && npm run build && cd $SCRATCH && node levels.mjs check && node audition-bubble.mjs && node audition-pro.mjs && cd $TACTILE && npm test
```

Expected: `check` exits 0 and tests PASS after each round. Re-send only the changed files. A blind pair Daniel can't tell apart fails the gate: redesign the newer cue of the pair (`count` against `navigate`; in `bubble`, the cue listed first), never by making it louder. If a note changes a cue's character, update its description in the README cue table, `agents.md`, and `docs.astro` `SOUNDS`.

- [ ] **Step 4: Record what was decided**

When Daniel approves, re-state these rules (same kind, scope and title, so each updates in place), changing values only where listening moved them:

```bash
brain know --kind design --scope cuelume --title "Cuelume sits in a calm register for all-day use" \
  --body "Signed off by ear by Daniel on <approval date>, for default and mech: no layer centred above 5 kHz (drops glass's 5.4x partial), tonal cues 4 semitones lower than v0.3 (success C5-G5, error F4-D4, tap glass ~1175 Hz), noise clicks 15-20% lower, air sweeps narrower, decays of 50 ms or more 20% shorter, levels re-matched on the loudest 30 ms. Same materials, calmer; a test enforces the ceiling in every theme. bubble is the opt-in playful exception." \
  --evidence "tactile src/sounds/recipes.ts"
brain know --kind design --scope cuelume --title "Cuelume grows by jobs, capped near 15 cues, grouped by material" \
  --body "Cover any use case by adapting cues (emphasis, context passed to play(), a documented use-case map), not by a catalogue. Palette is 14: the nine, warning, loading, ready, attention, and count (2026-09-23); one slot of headroom left. Material tells the family before the cue: mallet = outcomes (success rises, error falls, warning level), glass = presence (tap, ready, attention), air = motion (open, close, navigate, loading), wood/keys = input (type, select, toggle). Each new cue must pass blind listening against its nearest neighbour. Signed off <approval date>." \
  --evidence "tactile src/sounds/recipes.ts"
brain know --kind design --scope cuelume --title "Cuelume never sounds events that fire in bursts" \
  --body "No cue per streamed token or chunk, per tool call inside an agent run, per step of a multi-step CLI run, per digit of an animated number, or on hover; sound the end instead (ready, success, error), and give an animated number one count stretched to its animation. Numbers that change more than about once a second get nothing. Bursts wear a cue out within minutes; hover was deprecated in v0.3 for the same reason. The use-case map lists these as 'nothing'." \
  --evidence "tactile README.md Which cue?"
brain know --kind design --scope cuelume --title "Playful sound is an opt-in theme, never the default" \
  --body "Signed off by Daniel <approval date>: bubble is droplets and pops (sine bloops gliding up 1.5x, 3 ms low-passed pops, fizz for loading), the only theme whose tones glide, level-matched to default. Opt in app-wide with setTheme('bubble'), or for one moment with play(cue, { theme }) or data-cuelume-theme on an element or ancestor, so a professional app can make e.g. its AI model picker bubbly. Outcome cues vary in level only so contours hold; select varies ±2% so direction reads." \
  --evidence "tactile src/sounds/bubble.ts"
brain render
```

Then set both spec status lines to `built and signed off by ear <approval date>; not released`, and in the professional palette's ledger (`.superpowers/sdd/2026-09-23-professional-palette/progress.md`) append `Task 4: complete (signed off by ear <approval date>, in the bubble-and-count listening session)`.

---

## Out of scope (from the spec)

- The site's landing page. Its theme keycaps render from `themes`, so a third appears on its own; everything else there follows as its own step. The site's `cuelume` dependency still has to go from `file:../tactile` back to `^0.3.0` before it deploys.
- `data-cuelume-count`.
- Generating ticks from `duration`.
- The Node runtime.

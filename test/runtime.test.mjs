import assert from "node:assert/strict";
import test from "node:test";

const originals = new Map();

function setGlobal(name, value) {
  if (!originals.has(name)) originals.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
}

function restoreGlobals() {
  for (const [name, descriptor] of originals) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
  originals.clear();
}

const audioParam = () => ({
  value: 0,
  ramps: [],
  rampTimes: [],
  setValueAtTime(value, time) {
    this.value = value;
    this.setAt = time;
  },
  exponentialRampToValueAtTime(value, time) {
    this.ramps.push(value);
    this.rampTimes.push(time);
  },
  linearRampToValueAtTime(value) {
    this.swell = value;
  },
});

// The real `react-native-audio-api`/`react-native` packages assume a Metro +
// native runtime and can't be loaded under plain Node — every test that
// touches `dist/` (even indirectly, e.g. via `index.js`) must mock both
// before importing, so the real packages are never reached.
function mockRuntime(t, AudioContextClass = class {}, { os = "ios", OfflineAudioContextClass = class {} } = {}) {
  const AudioManager = {
    calls: [],
    setAudioSessionOptions(options) {
      this.calls.push(options);
    },
  };
  t.mock.module("react-native-audio-api", {
    namedExports: {
      AudioContext: AudioContextClass,
      OfflineAudioContext: OfflineAudioContextClass,
      AudioManager,
    },
  });
  t.mock.module("react-native", { namedExports: { Platform: { OS: os } } });
  return AudioManager;
}

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
    createConvolver() {
      return Object.assign(new Node(), { buffer: null, normalize: true });
    }
    createWaveShaper() {
      return Object.assign(new Node(), { curve: null, oversample: "none" });
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

// How far one play can move a layer's pitch or filter from its recipe: the strike's pitch, and for
// noise the strike's force too (a harder strike is brighter), or for a tone a little mode jitter.
const MODE_JITTER = 0.005;
const spread = (layer, vary) =>
  vary ? (1 + vary.pitch) * (1 + (layer.kind === "noise" ? vary.level : MODE_JITTER)) - 1 : 0;

const CANONICAL = [
  "tap", "type", "select", "toggle", "open", "close", "success", "error", "navigate",
  "warning", "loading", "ready", "attention", "count",
];

test("palette is the fourteen canonical cues, the original nine first", async (t) => {
  mockRuntime(t);
  const { setVolume, sounds } = await import("../dist/index.js");
  assert.deepEqual(sounds, CANONICAL);
  assert.equal(typeof setVolume, "function");
});

test("deprecated names resolve to their documented canonical cue", async () => {
  const { resolveSound } = await import("../dist/sounds/recipes.js");
  const migration = {
    chime: "success",
    sparkle: "success",
    droplet: "close",
    bloom: "open",
    whisper: "select",
    tick: "select",
    press: "tap",
    release: "tap",
    toggle: "toggle",
    success: "success",
    error: "error",
    page: "navigate",
    loading: "loading",
    ready: "ready",
    pulse: "tap",
    scan: "select",
    arrival: "navigate",
  };
  for (const [name, cue] of Object.entries(migration)) assert.equal(resolveSound(name), cue, name);
  for (const cue of CANONICAL) assert.equal(resolveSound(cue), cue);
  for (const invalid of ["toString", "__proto__", "", null, 1]) assert.equal(resolveSound(invalid), null);
});

test("context shapes cues within bounds and leaves missing context canonical", async () => {
  const { shapeFor, layerFactors, resolveEmphasis, arrangement, contextFrom } = await import("../dist/sounds/context.js");
  const { RECIPES } = await import("../dist/sounds/recipes.js");
  const { THEMES } = await import("../dist/sounds/themes.js");
  const identity = { pitch: 1, level: 1, length: 1, bright: 1, tail: 1, sweep: 1, time: 1 };
  const SLOW = 10_000;

  for (const cue of CANONICAL) assert.deepEqual(shapeFor(cue, {}, "normal", SLOW), identity, cue);
  // cues that don't listen for a context ignore it
  assert.deepEqual(shapeFor("success", { key: "enter", input: "touch", direction: 1, duration: 1600 }, "normal", 10), identity);

  assert.equal(resolveEmphasis("strong"), "strong");
  for (const invalid of ["loud", "toString", undefined, 2]) assert.equal(resolveEmphasis(invalid), "normal");
  // each emphasis is its own arrangement: strong adds a layer, subtle strips ornament
  let simpler = 0;
  for (const cue of CANONICAL) {
    const [few, base, more] = ["subtle", "normal", "strong"].map((e) => arrangement(RECIPES[cue].layers, e));
    assert.equal(base.length, RECIPES[cue].layers.filter((l) => l.from !== "strong").length, cue);
    assert.ok(more.length > base.length && few.length <= base.length, cue);
    if (few.length < base.length) simpler++;
  }
  assert.ok(simpler >= CANONICAL.length - 1); // toggle has no ornament to strip

  const [subtle, normal, strong] = ["subtle", "normal", "strong"].map((e) => shapeFor("success", {}, e, SLOW));
  assert.ok(subtle.level < normal.level && normal.level < strong.level);
  assert.ok(subtle.length < normal.length && normal.length < strong.length);
  assert.ok(subtle.bright < normal.bright && normal.bright < strong.bright);

  // type: cadence lightens and drops the key return; key roles order by size
  const fast = shapeFor("type", {}, "normal", 50);
  assert.ok(fast.level < 1 && fast.length < 1 && fast.tail < 0.5);
  assert.ok(shapeFor("type", {}, "normal", 150).tail > fast.tail);
  const pitch = (key) => shapeFor("type", { key }, "normal", SLOW).pitch;
  assert.ok(pitch("enter") < pitch("space") && pitch("space") < pitch("delete") && pitch("delete") < pitch("printable"));

  // select: direction; tap: input method
  assert.ok(shapeFor("select", { direction: 1 }, "normal", SLOW).pitch > 1);
  assert.ok(shapeFor("select", { direction: -1 }, "normal", SLOW).pitch < 1);
  assert.ok(shapeFor("tap", { input: "touch" }, "normal", SLOW).bright < 1);
  assert.ok(shapeFor("tap", { input: "keyboard" }, "normal", SLOW).pitch < 1);
  // count: duration scales time against its 800 ms original
  assert.equal(shapeFor("count", { duration: 1600 }, "normal", SLOW).time, 2);
  assert.equal(shapeFor("count", { duration: 400 }, "strong", SLOW).time, 0.5);

  // every context, emphasis, and cadence stays bounded on every layer
  const contexts = [{}, { key: "enter" }, { key: "space" }, { key: "delete" }, { input: "touch" }, { input: "pen" },
    { input: "keyboard" }, { direction: 1 }, { direction: -1 }, { duration: 300 }, { duration: 2000 }];
  for (const cue of CANONICAL) {
    for (const context of contexts) {
      for (const emphasis of ["subtle", "normal", "strong"]) {
        for (const since of [0, 60, 120, SLOW]) {
          for (const layer of Object.values(THEMES).flatMap((theme) => theme[cue].layers)) {
            const f = layerFactors(layer, shapeFor(cue, context, emphasis, since));
            assert.ok(f.pitch >= 0.75 && f.pitch <= 1.25 && f.gain >= 0 && f.gain <= 1.5);
            assert.ok(f.length >= 0.6 && f.length <= 1.6);
          }
        }
      }
    }
  }

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
});

test("every theme carries the same cues, each arranged for every emphasis", async () => {
  const { themes, sounds } = await import("../dist/index.js");
  const { THEMES } = await import("../dist/sounds/themes.js");
  const { arrangement } = await import("../dist/sounds/context.js");
  assert.deepEqual(themes, ["default", "mech", "bubble", "press"]);
  for (const theme of themes) {
    assert.deepEqual(Object.keys(THEMES[theme]), [...sounds], theme);
    for (const cue of sounds) {
      const layers = THEMES[theme][cue].layers;
      const [few, base, more] = ["subtle", "normal", "strong"].map((e) => arrangement(layers, e));
      assert.ok(few.length >= 1 && few.length <= base.length && more.length > base.length, `${theme} ${cue}`);
    }
  }
  // each theme is its own material, not another renamed
  for (const cue of sounds) {
    const [base, mech, bubble] = ["default", "mech", "bubble"].map((theme) => THEMES[theme][cue].layers);
    assert.notDeepEqual(mech, base, cue);
    assert.notDeepEqual(bubble, base, cue);
    assert.notDeepEqual(bubble, mech, cue);
  }
});

test("every layer keeps the register: nothing above 5 kHz, sines only, and outside bubble no tone slides", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  for (const [theme, cues] of Object.entries(THEMES)) {
    for (const [cue, recipe] of Object.entries(cues)) {
      // a room is for results that land
      if (recipe.room) assert.ok(cue === "success" || cue === "ready", `${theme} ${cue} rings into the room`);
      for (const layer of recipe.layers) {
        const centre = Math.max(layer.kind === "tone" ? layer.frequency : layer.filterFrequency, layer.glideTo ?? 0);
        assert.ok(centre <= 5000, `${theme} ${cue}: ${centre} Hz`);
        if (layer.kind === "tone") {
          assert.equal(layer.waveform, "sine", `${theme} ${cue}: ${layer.waveform} tone`);
          // outside bubble a glide is a knock's body, the pitch drop of a struck surface, never a slide you hear
          if (theme !== "bubble" && layer.glideTo !== undefined) {
            assert.ok(layer.glideTo < layer.frequency && (layer.glideTime ?? layer.attack + layer.decay) <= 0.025, `${theme} ${cue}: a tone that slides`);
          }
        }
      }
    }
  }
  // bubble is made of bloops: every cue has a tone that glides
  for (const [cue, recipe] of Object.entries(THEMES.bubble)) {
    assert.ok(recipe.layers.some((layer) => layer.kind === "tone" && layer.glideTo !== undefined), `bubble ${cue} has a bloop`);
  }
});

test("a struck note's higher modes die sooner, and none rises past the register", async () => {
  const { struck, BAR, MALLET } = await import("../dist/sounds/recipes.js");
  for (const material of [BAR, MALLET]) {
    for (const frequency of [220, 880, 1318.51]) {
      const modes = struck(frequency, 0.4, 0.02, material);
      assert.equal(modes[0].frequency, frequency);
      assert.ok(modes.every((mode) => mode.frequency <= 5000), `${frequency} Hz stays under 5 kHz`);
      for (let i = 1; i < modes.length; i++) {
        assert.ok(modes[i].frequency > modes[i - 1].frequency && modes[i].decay < modes[i - 1].decay, `${frequency} Hz mode ${i} dies sooner`);
        assert.equal(modes[i].from, "normal", "upper modes are ornament");
      }
    }
  }
  // a strong-only note keeps every mode strong-only
  assert.ok(struck(220, 0.4, 0.02, BAR, { from: "strong" }).every((mode) => mode.from === "strong"));
});

test("every cue is one sound: all its layers strike together, in every theme", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  for (const [theme, cues] of Object.entries(THEMES)) {
    for (const [cue, recipe] of Object.entries(cues)) {
      for (const layer of recipe.layers) assert.equal(layer.offset ?? 0, 0, `${theme} ${cue} strikes twice`);
    }
  }
});

test("outcome cues keep their meaning in one strike, in every theme", async () => {
  const { THEMES } = await import("../dist/sounds/themes.js");
  // the tones every emphasis plays, at the pitch each settles on
  const core = (recipe) => recipe.layers.filter((layer) => !layer.from && layer.kind === "tone");
  const settled = (layer) => layer.glideTo ?? layer.frequency;
  const lowest = (recipe) => Math.min(...core(recipe).map((layer) => layer.frequency));
  // a chord: two pitches that are not the same note in another octave
  const chord = (recipe) => {
    const pitches = core(recipe).map(settled);
    return pitches.some((a) => pitches.some((b) => {
      const octaves = Math.abs(Math.log2(a / b));
      return Math.abs(octaves - Math.round(octaves)) > 0.05;
    }));
  };
  const glides = (recipe) => core(recipe).filter((layer) => layer.glideTo !== undefined).map((layer) => layer.glideTo / layer.frequency);

  for (const [theme, cues] of Object.entries(THEMES)) {
    const { success, error, warning, attention, ready } = cues;
    // register carries the meaning: error sits lowest, success above warning, attention at or above success
    assert.ok(lowest(error) < lowest(warning), `${theme} error below warning`);
    assert.ok(lowest(warning) < lowest(success), `${theme} warning below success`);
    assert.ok(lowest(attention) >= lowest(success), `${theme} attention at or above success`);
    assert.ok(lowest(ready) < lowest(success), `${theme} ready below success`);
    // randomness never blurs it: outcomes and select's direction keep their pitch
    for (const cue of ["success", "error", "warning", "attention"]) assert.equal(cues[cue].vary?.pitch ?? 0, 0, `${theme} ${cue} keeps its pitch`);
    assert.ok((cues.select.vary?.pitch ?? 0) < 0.05, `${theme} select's direction outweighs its randomness`);
    if (theme === "bubble") {
      // bubble says it with one glide: success and attention rise, error sinks, warning stays level
      assert.ok(glides(success).length && glides(success).every((r) => r > 1), "bubble success rises");
      assert.ok(glides(attention).length && glides(attention).every((r) => r > 1), "bubble attention rises");
      assert.ok(glides(error).length && glides(error).every((r) => r < 1), "bubble error sinks");
      assert.ok(glides(warning).every((r) => Math.abs(r - 1) < 0.15), "bubble warning stays level");
    } else {
      // the others strike a chord at once
      for (const cue of ["success", "error", "warning"]) assert.ok(chord(cues[cue]), `${theme} ${cue} is a chord`);
    }
  }
});

test("count follows its duration and falls going back, in every theme and emphasis", async (context) => {
  context.after(restoreGlobals);
  // no per-play variation, so two plays can be compared exactly
  context.mock.method(Math, "random", () => 0.5);
  const { Context, log } = recordingContext();
  setGlobal("setTimeout", (callback, delay) => {
    log.delays.push(delay);
    return 0;
  });
  mockRuntime(context, Context);
  const { play, setTheme } = await import(`../dist/audio/engine.js?count=${Date.now()}`);
  play("tap"); // builds the shared output and room, so what follows logs one pitched param per layer
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
    const [short, long] = [300, 2000].map((duration) => played("count", { duration }));
    assert.equal(short.sources.length, layers.length, theme);
    layers.forEach((layer, i) => {
      const offset = layer.offset ?? 0;
      const [s, l] = [short.sources[i], long.sources[i]];
      assert.ok(near(s.at, (offset * 300) / 800) && near(l.at, (offset * 2000) / 800), `${theme} layer ${i} starts in step`);
      // a stretch layer's sound and glide both last in proportion; everything else keeps its length
      const scale = layer.stretch ? 2000 / 300 : 1;
      assert.ok(near(l.end - l.at - 0.05, (s.end - s.at - 0.05) * scale), `${theme} layer ${i} length`);
      // one pitched param per layer, in layer order: a filter for noise, an oscillator for a tone
      const [sp, lp] = [short.pitched[i], long.pitched[i]];
      if (layer.glideTo !== undefined) {
        assert.ok(near(lp.rampTimes[0] - lp.setAt, (sp.rampTimes[0] - sp.setAt) * scale), `${theme} layer ${i} glide time`);
      }
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
  // bubble's toggle and navigate glide too, so going back sinks them
  setTheme("bubble");
  for (const cue of ["toggle", "navigate"]) {
    const [up, down] = [glides(cue, {}), glides(cue, { direction: "back" })];
    assert.ok(up.length > 0 && up.every((d) => d > 0), `bubble ${cue} rises`);
    assert.ok(down.length === up.length && down.every((d) => d < 0), `bubble ${cue} sinks going back`);
  }
  setTheme("default");
});

test("a per-play theme plays that theme once and leaves the active one", async (context) => {
  context.after(restoreGlobals);
  const { Context, log } = recordingContext();
  setGlobal("setTimeout", () => 0);
  mockRuntime(context, Context);
  const { play, setTheme } = await import(`../dist/audio/engine.js?theme=${Date.now()}`);
  play("tap"); // builds the shared output and room, so what follows logs only the cue's own params
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
    return Math.abs(value / base - 1) <= spread(layers[0], vary) + 1e-9;
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

test("a cue plays one voice at a time: a new play releases the last, other cues ring on", async (context) => {
  context.after(restoreGlobals);
  const { Context } = recordingContext();
  const gains = [];
  class Recording extends Context {
    currentTime = 5;
    createGain() {
      const gain = super.createGain();
      gains.push(gain);
      return gain;
    }
  }
  setGlobal("setTimeout", () => 0);
  mockRuntime(context, Recording);
  const { play } = await import(`../dist/audio/engine.js?voice=${Date.now()}`);
  const { THEMES } = await import("../dist/sounds/themes.js");

  // a play's master is the gain set straight to its recipe's level
  const master = (cue) => {
    const before = gains.length;
    play(cue);
    return gains.slice(before).find((gain) => gain.gain.value === THEMES.default[cue].masterGain);
  };
  const first = master("tap");
  const other = master("success");
  assert.equal(first.gain.ramps.length, 0, "another cue leaves tap ringing");
  const second = master("tap");
  // the last tap fades out quickly from where it is, and the new one plays in full
  assert.deepEqual(first.gain.ramps, [0.0001]);
  assert.equal(first.gain.setAt, 5);
  assert.ok(first.gain.rampTimes[0] > 5 && first.gain.rampTimes[0] <= 5.1);
  assert.equal(second.gain.ramps.length, 0);
  assert.equal(other.gain.ramps.length, 0);
});

test("one strike per play: every layer shares it, harder is louder and brighter, and only cues with vary move", async (context) => {
  context.after(restoreGlobals);
  const { Context, log } = recordingContext();
  const gains = [];
  class Recording extends Context {
    createGain() {
      const gain = super.createGain();
      gains.push(gain);
      return gain;
    }
  }
  setGlobal("setTimeout", () => 0);
  mockRuntime(context, Recording);
  const { play } = await import(`../dist/audio/engine.js?strike=${Date.now()}`);
  const { THEMES } = await import("../dist/sounds/themes.js");
  const { arrangement } = await import("../dist/sounds/context.js");
  play("tap"); // builds the shared output and room first

  // how each layer of one play landed against its recipe: level, pitch or filter, and ring length
  const struck = (theme, cue) => {
    const [g, p] = [gains.length, log.pitched.length];
    play(cue, { theme });
    const layerGains = gains.slice(g + 2); // after the play's master and its room send
    const pitched = log.pitched.slice(p);
    return arrangement(THEMES[theme][cue].layers, "normal").map((layer, i) => ({
      layer,
      level: layerGains[i].gain.swell / layer.peak,
      pitch: pitched[i].value / (layer.kind === "tone" ? layer.frequency : layer.filterFrequency),
      ring: (layerGains[i].gain.rampTimes[0] - layer.attack) / layer.decay,
    }));
  };
  const near = (a, b) => Math.abs(a - b) < 1e-9;

  // press open varies in level only: no pitch, so a noise layer's filter moves with its level alone
  const { level: bound } = THEMES.press.open.vary;
  const forces = [];
  for (let i = 0; i < 30; i++) {
    const layers = struck("press", "open");
    const force = layers[0].level;
    forces.push(force);
    assert.ok(Math.abs(force - 1) <= bound + 1e-9);
    for (const { layer, level, pitch, ring } of layers) {
      assert.ok(near(level, force), "every layer is struck as hard");
      if (layer.kind === "noise") assert.ok(near(pitch, force), "a harder strike is brighter");
      else assert.ok(Math.abs(pitch - 1) <= 0.005 + 1e-9, "a tone's mode moves a hair");
      assert.ok(Math.abs(ring - 1) <= 0.1 + 1e-9, "each layer rings a little longer or shorter");
    }
  }
  assert.ok(new Set(forces).size > 25, "no two strikes match");

  // default success has no vary: every play is the recipe exactly
  for (let i = 0; i < 3; i++) {
    for (const { level, pitch, ring } of struck("default", "success")) assert.ok(near(level, 1) && near(pitch, 1) && near(ring, 1));
  }
});

test("invalid names and AudioContext failures are silent", async (context) => {
  let constructions = 0;

  class ThrowingContext {
    constructor() {
      constructions++;
      throw new Error("blocked");
    }
  }

  mockRuntime(context, ThrowingContext);
  const { play, setEnabled } = await import(`../dist/audio/engine.js?failures=${Date.now()}`);

  assert.doesNotThrow(() => play("toString"));
  assert.equal(constructions, 0, "invalid sound names never reach the context");
  setEnabled(false);
  assert.doesNotThrow(() => play("tap"));
  assert.equal(constructions, 0, "disabled playback never reaches the context");
  setEnabled(true);
  assert.doesNotThrow(() => play("tap"));
  assert.equal(constructions, 1);
});

test("a suspended AudioContext whose resume() rejects renders nothing", async (context) => {
  let renders = 0;
  class RejectedContext {
    state = "suspended";
    resume() {
      return Promise.reject(new Error("blocked"));
    }
    createGain() {
      renders++;
    }
  }

  mockRuntime(context, RejectedContext);
  const { play } = await import(`../dist/audio/engine.js?rejected=${Date.now()}`);

  assert.doesNotThrow(() => play("tap"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renders, 0);
});

test("disabling playback mid-resume skips the render once it settles", async (context) => {
  let renders = 0;
  let finishResume = () => {};
  class DeferredContext {
    state = "suspended";
    destination = {};
    resume() {
      return new Promise((resolve) => {
        finishResume = () => {
          this.state = "running";
          resolve();
        };
      });
    }
    createGain() {
      renders++;
      throw new Error("rendered while disabled");
    }
  }

  mockRuntime(context, DeferredContext);
  const { play, setEnabled } = await import(`../dist/audio/engine.js?deferred=${Date.now()}`);

  play("tap");
  setEnabled(false);
  finishResume();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renders, 0);
});

// A running context that renders nothing observable, for tests about setup rather than sound.
function silentContext() {
  class Node {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }
  const source = (extra) => Object.assign(new Node(), extra, { start() {}, stop() {} });
  return class SilentContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new Node();
    createGain() {
      return Object.assign(new Node(), { gain: audioParam() });
    }
    createConvolver() {
      return Object.assign(new Node(), { buffer: null, normalize: true });
    }
    createWaveShaper() {
      return Object.assign(new Node(), { curve: null, oversample: "none" });
    }
    createOscillator() {
      return source({ frequency: audioParam(), detune: audioParam() });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createBufferSource() {
      return source({ buffer: null });
    }
    createBiquadFilter() {
      return Object.assign(new Node(), { frequency: audioParam(), Q: audioParam() });
    }
  };
}

test("iOS audio session is configured once, lazily, before first playback", async (context) => {
  context.mock.method(globalThis, "setTimeout", () => 0);
  const AudioManager = mockRuntime(context, silentContext());
  const { play } = await import(`../dist/audio/engine.js?ios=${Date.now()}`);

  assert.deepEqual(AudioManager.calls, [], "nothing is configured at import time");
  play("tap");
  play("success");
  assert.deepEqual(AudioManager.calls, [{ iosCategory: "ambient", iosOptions: ["mixWithOthers"] }]);
});

test("audio session is left alone on Android", async (context) => {
  context.mock.method(globalThis, "setTimeout", () => 0);
  const AudioManager = mockRuntime(context, silentContext(), { os: "android" });
  const { play } = await import(`../dist/audio/engine.js?android=${Date.now()}`);

  play("tap");
  assert.deepEqual(AudioManager.calls, []);
});

test("volume is clamped and one boosted output bus is reused", async (context) => {
  context.after(restoreGlobals);
  const gains = [];
  const limiters = [];

  class AudioNodeStub {
    constructor(name) {
      this.name = name;
      this.connections = [];
    }
    connect(destination) {
      this.connections.push(destination);
      return destination;
    }
    disconnect() {}
  }

  class VolumeContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new AudioNodeStub("destination");
    createGain() {
      const gain = Object.assign(new AudioNodeStub("gain"), { gain: audioParam() });
      gains.push(gain);
      return gain;
    }
    createConvolver() {
      return Object.assign(new AudioNodeStub("room"), { buffer: null, normalize: true });
    }
    createWaveShaper() {
      const node = Object.assign(new AudioNodeStub("limiter"), { curve: null, oversample: "none" });
      limiters.push(node);
      return node;
    }
    createOscillator() {
      return Object.assign(new AudioNodeStub("oscillator"), {
        frequency: audioParam(),
        detune: audioParam(),
        start() {},
        stop() {},
      });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createBufferSource() {
      return Object.assign(new AudioNodeStub("buffer-source"), {
        buffer: null,
        start() {},
        stop() {},
      });
    }
    createBiquadFilter() {
      return Object.assign(new AudioNodeStub("filter"), {
        frequency: audioParam(),
        Q: audioParam(),
      });
    }
  }

  setGlobal("setTimeout", () => 0);
  mockRuntime(context, VolumeContext);

  const { play, setVolume } = await import(`../dist/audio/engine.js?volume=${Date.now()}`);
  const { RECIPES } = await import("../dist/sounds/recipes.js");

  setVolume(2);
  play("tap", { volume: 0.5 });
  setVolume(0.5);
  play("tap", { volume: 0.5 });
  play("tap", { volume: 2 });
  play("tap", { volume: Number.NaN });
  setVolume(-1);
  setVolume(Number.NaN);
  setVolume(Number.POSITIVE_INFINITY);
  play("tap");

  const output = gains[0];
  const masters = gains.slice(1).filter((gain) => gain.connections.includes(output));

  assert.deepEqual(
    masters.map(({ gain }) => gain.value),
    [0.5, 0.25, 0.5, 0.5].map((volume) => RECIPES.tap.masterGain * volume),
  );
  assert.ok(output.gain.value > 1);
  assert.equal(limiters.length, 1);
  assert.deepEqual(output.connections, [limiters[0]]);
  assert.equal(limiters[0].connections.length, 1);
  assert.equal(limiters[0].connections[0].name, "destination");
});

test("every cue renders, deprecated names play, and every keystroke varies within bounds", async (context) => {
  context.after(restoreGlobals);
  let renders = 0;
  const filters = [];
  const delays = [];

  class AudioNodeStub {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }

  class WorkingContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new AudioNodeStub();
    createGain() {
      return Object.assign(new AudioNodeStub(), { gain: audioParam() });
    }
    createConvolver() {
      return Object.assign(new AudioNodeStub(), { buffer: null, normalize: true });
    }
    createWaveShaper() {
      return Object.assign(new AudioNodeStub(), { curve: null, oversample: "none" });
    }
    createOscillator() {
      return Object.assign(new AudioNodeStub(), {
        frequency: audioParam(),
        detune: audioParam(),
        start() {},
        stop() {},
      });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createBufferSource() {
      return Object.assign(new AudioNodeStub(), { buffer: null, start() {}, stop() {} });
    }
    createBiquadFilter() {
      const filter = Object.assign(new AudioNodeStub(), { frequency: audioParam(), Q: audioParam() });
      filters.push(filter);
      return filter;
    }
    createDelay() {
      return Object.assign(new AudioNodeStub(), { delayTime: audioParam() });
    }
  }

  setGlobal("setTimeout", (callback, delay) => {
    renders++;
    delays.push(delay);
    return 0;
  });
  mockRuntime(context, WorkingContext);
  const { play, setTheme } = await import(`../dist/audio/engine.js?palette=${Date.now()}`);

  for (const cue of CANONICAL) play(cue);
  assert.equal(renders, CANONICAL.length);
  for (const cue of CANONICAL) {
    for (const emphasis of ["subtle", "normal", "strong", "loud"]) play(cue, { emphasis });
  }
  assert.equal(renders, CANONICAL.length * 5);
  // emphasis is heard as length too, so a strong cue rings longer than a subtle one
  const ring = (emphasis) => {
    play("success", { emphasis });
    return delays.at(-1);
  };
  assert.ok(ring("subtle") < ring("normal") && ring("normal") < ring("strong"));
  assert.equal(ring("loud"), ring("normal"));
  renders = 0;
  play("chime");
  play();
  assert.equal(renders, 2);

  // setTheme changes the material of future plays; unknown names change nothing
  const firstFilterOf = (cue) => {
    const before = filters.length;
    play(cue);
    return filters[before].frequency.value;
  };
  const { THEMES } = await import("../dist/sounds/themes.js");
  const near = (value, base, bound) => Math.abs(value / base - 1) <= bound + 1e-9;
  const mechTap = THEMES.mech.tap;
  const defaultTap = THEMES.default.tap;
  assert.ok(near(firstFilterOf("tap"), defaultTap.layers[0].filterFrequency, spread(defaultTap.layers[0], defaultTap.vary)));
  setTheme("mech");
  assert.ok(near(firstFilterOf("tap"), mechTap.layers[0].filterFrequency, spread(mechTap.layers[0], mechTap.vary)));
  setTheme("glass");
  setTheme(undefined);
  assert.ok(near(firstFilterOf("tap"), mechTap.layers[0].filterFrequency, spread(mechTap.layers[0], mechTap.vary)));
  const before = renders;
  for (const cue of CANONICAL) {
    for (const emphasis of ["subtle", "normal", "strong"]) play(cue, { emphasis });
  }
  assert.equal(renders - before, CANONICAL.length * 3);
  setTheme("default");
  assert.ok(near(firstFilterOf("tap"), defaultTap.layers[0].filterFrequency, spread(defaultTap.layers[0], defaultTap.vary)));

  // type's first layer is the switch click; its filter shows each stroke's pitch.
  const { RECIPES } = await import("../dist/sounds/recipes.js");
  const base = RECIPES.type.layers[0].filterFrequency;
  const bound = spread(RECIPES.type.layers[0], RECIPES.type.vary);
  const clicks = [];
  for (let i = 0; i < 200; i++) {
    const before = filters.length;
    play("type");
    clicks.push(filters[before].frequency.value / base - 1);
  }
  for (let i = 1; i < clicks.length; i++) assert.notEqual(clicks[i], clicks[i - 1]);
  assert.ok(clicks.every((offset) => Math.abs(offset) <= bound));
  assert.ok(Math.max(...clicks) > bound / 2 && Math.min(...clicks) < -bound / 2);

  // Variation is opt-in: a cue without it plays the recipe exactly.
  for (let i = 0; i < 3; i++) {
    const before = filters.length;
    play("select");
    assert.equal(filters[before].frequency.value, RECIPES.select.layers[0].filterFrequency);
  }

  // navigate's whoosh sweeps its noise filter; tap's filters stay put.
  const sweeps = (cue) => {
    const before = filters.length;
    play(cue);
    return filters.slice(before).filter((filter) => filter.frequency.ramps.length > 0).length;
  };
  assert.ok(sweeps("navigate") > 0);
  assert.equal(sweeps("tap"), 0);

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
    const bound = spread(RECIPES[cue].layers[layer], RECIPES[cue].vary);
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
});

test("every play rings into one shared room, and a finished play lets go of it", async (context) => {
  context.after(restoreGlobals);
  const timers = [];
  const disconnected = [];
  const made = [];

  class AudioNodeStub {
    constructor(name) {
      this.name = name;
      this.connections = [];
      made.push(this);
    }
    connect(destination) {
      this.connections.push(destination);
      return destination;
    }
    disconnect() {
      disconnected.push(this.name);
    }
  }

  let gainCount = 0;
  class RoomContext {
    state = "running";
    currentTime = 0;
    sampleRate = 8000;
    destination = new AudioNodeStub("destination");
    createGain() {
      const names = ["output", "master", "send"];
      return Object.assign(new AudioNodeStub(names[gainCount++] ?? "layer-gain"), { gain: audioParam() });
    }
    createWaveShaper() {
      return Object.assign(new AudioNodeStub("limiter"), { curve: null, oversample: "none" });
    }
    createConvolver() {
      return Object.assign(new AudioNodeStub("room"), { buffer: null, normalize: true });
    }
    createBuffer(channels, length) {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, getChannelData: (channel) => data[channel] };
    }
    createBufferSource() {
      return Object.assign(new AudioNodeStub("noise"), { buffer: null, start() {}, stop() {} });
    }
    createBiquadFilter() {
      return Object.assign(new AudioNodeStub("filter"), { frequency: audioParam(), Q: audioParam() });
    }
    createOscillator() {
      return Object.assign(new AudioNodeStub("oscillator"), { frequency: audioParam(), detune: audioParam(), start() {}, stop() {} });
    }
  }

  setGlobal("setTimeout", (callback, delay) => {
    timers.push({ callback, delay });
    return 0;
  });
  mockRuntime(context, RoomContext);

  const { play } = await import(`../dist/audio/engine.js?room=${Date.now()}`);
  const { RECIPES, LANDED } = await import("../dist/sounds/recipes.js");
  play("success");

  const node = (name) => made.find((n) => n.name === name);
  const [output, master, send, room] = ["output", "master", "send", "room"].map(node);
  // dry to the output, and a faint send through the walls into the room, which returns to the output
  assert.ok(master.connections.includes(output) && master.connections.includes(send));
  const walls = send.connections[0];
  assert.deepEqual(walls.connections, [room]);
  assert.deepEqual(room.connections, [output]);
  assert.deepEqual(output.connections, [node("limiter")]);
  // success lands, so it rings into the room more than a tap does
  assert.equal(RECIPES.success.room, LANDED);
  assert.ok(send.gain.value > 0.05 * LANDED && send.gain.value < 0.1 * LANDED);
  // the room is stereo, silent before its first reflection, then dies away, each channel at unit energy
  assert.equal(room.normalize, false);
  const impulse = [0, 1].map((channel) => room.buffer.getChannelData(channel));
  for (const data of impulse) {
    assert.equal(data[0], 0);
    const energy = data.reduce((sum, x) => sum + x * x, 0);
    assert.ok(Math.abs(energy - 1) < 1e-4);
    const quarter = data.length / 4;
    const early = data.slice(0, quarter).reduce((sum, x) => sum + x * x, 0);
    const late = data.slice(-quarter).reduce((sum, x) => sum + x * x, 0);
    assert.ok(early > 100 * late);
  }
  assert.notDeepEqual(impulse[0], impulse[1]);

  // one cleanup, when the last layer has finished; the room itself stays up for the next play
  assert.equal(timers.length, 1);
  const longest = Math.max(...RECIPES.success.layers.filter((l) => l.from !== "strong").map((l) => l.attack + l.decay));
  assert.equal(Math.round(timers[0].delay), Math.round((longest + 0.1) * 1000));
  timers[0].callback();
  assert.deepEqual(disconnected, ["master", "send"]);

  // the room and the noise are built once, not per play
  const rooms = made.filter((n) => n.name === "room").length;
  play("tap");
  play("type");
  assert.equal(made.filter((n) => n.name === "room").length, rooms);
});

test("useCuelumeSound taps on press-in and stays silent otherwise, unless told what to play", async (context) => {
  mockRuntime(context);
  const { resolveCue } = await import("../dist/interactions/useCuelumeSound.js");

  assert.equal(resolveCue(undefined, "tap"), "tap");
  assert.equal(resolveCue(undefined, false), null);
  assert.equal(resolveCue("success", false), "success");
  assert.equal(resolveCue("chime", false), "success", "deprecated names resolve to their cue");
  assert.equal(resolveCue(false, "tap"), null);
  assert.equal(resolveCue("not-a-real-sound", "tap"), "tap");
  assert.equal(resolveCue("not-a-real-sound", false), null);
});

test("getSoundWaveform renders the real recipe offline, in every theme", async (context) => {
  const rendered = [];
  class Node {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }
  class OfflineContext {
    currentTime = 0;
    destination = new Node();
    constructor(channels, length, sampleRate) {
      this.length = length;
      this.sampleRate = sampleRate;
      rendered.push(this);
    }
    createGain() {
      return Object.assign(new Node(), { gain: audioParam() });
    }
    createConvolver() {
      return Object.assign(new Node(), { buffer: null, normalize: true });
    }
    createWaveShaper() {
      return Object.assign(new Node(), { curve: null, oversample: "none" });
    }
    createOscillator() {
      return Object.assign(new Node(), { frequency: audioParam(), detune: audioParam(), start() {}, stop() {} });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createBufferSource() {
      return Object.assign(new Node(), { buffer: null, start() {}, stop() {} });
    }
    createBiquadFilter() {
      return Object.assign(new Node(), { frequency: audioParam(), Q: audioParam() });
    }
    async startRendering() {
      // a decaying ramp: the loudest sample is not 1, so normalization is observable
      const data = Float32Array.from({ length: this.length }, (_, i) => 0.25 * (1 - i / this.length));
      return { getChannelData: () => data };
    }
  }

  mockRuntime(context, class {}, { OfflineAudioContextClass: OfflineContext });
  const { getSoundWaveform } = await import(`../dist/audio/waveform.js?waveform=${Date.now()}`);
  const { THEMES, themes } = await import("../dist/sounds/themes.js");
  const { sounds } = await import("../dist/sounds/recipes.js");

  for (const theme of themes) {
    for (const name of sounds) {
      const { peaks, duration, sampleRate } = await getSoundWaveform(name, { theme, resolution: 32 });
      assert.equal(peaks.length, 32, `${theme} ${name}`);
      assert.equal(Math.max(...peaks.map(Math.abs)), 1, `${theme} ${name} fills its own peak`);
      assert.equal(sampleRate, 44100);
      const last = Math.max(...THEMES[theme][name].layers.filter((l) => !l.from).map((l) => (l.offset ?? 0) + l.attack + l.decay));
      assert.ok(duration >= last - 1e-9, `${theme} ${name} duration covers its always-on layers`);
    }
  }
  // the render is longer than the trace: it includes the room's tail
  assert.ok(rendered.every((ctx) => ctx.length > 0));

  await assert.rejects(() => getSoundWaveform("nope"), TypeError);
  await assert.rejects(() => getSoundWaveform("toString"), TypeError);
});

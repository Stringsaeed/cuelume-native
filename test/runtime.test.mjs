import assert from "node:assert/strict";
import test from "node:test";

const audioParam = () => ({
  value: 0,
  setValueAtTime() {},
  exponentialRampToValueAtTime() {},
});

// The real `react-native-audio-api`/`react-native` packages assume a Metro +
// native runtime and can't be loaded under plain Node — every test that
// touches `dist/` (even indirectly, e.g. via `index.js`) must mock both
// before importing, so the real packages are never reached.
function mockAudioApi(t, AudioContextClass = class {}) {
  const AudioManager = {
    calls: [],
    setAudioSessionOptions(options) {
      this.calls.push(options);
    },
  };
  t.mock.module("react-native-audio-api", {
    exports: { AudioContext: AudioContextClass, AudioManager },
  });
  return AudioManager;
}

function mockPlatform(t, os = "ios") {
  t.mock.module("react-native", { exports: { Platform: { OS: os } } });
}

test("expanded palette exposes sci-fi interaction and arrival cues", async (t) => {
  mockPlatform(t);
  mockAudioApi(t);
  const { setVolume, sounds } = await import("../dist/index.js");
  assert.equal(sounds.length, 17);
  assert.deepEqual(sounds.slice(-3), ["pulse", "scan", "arrival"]);
  assert.equal(typeof setVolume, "function");
});

test("an AudioContext that throws is a silent no-op", async (t) => {
  let constructions = 0;

  class ThrowingContext {
    constructor() {
      constructions++;
      throw new Error("blocked");
    }
  }

  mockPlatform(t);
  mockAudioApi(t, ThrowingContext);
  const { play, setEnabled } = await import(`../dist/audio/engine.js?throwing=${Date.now()}`);

  assert.doesNotThrow(() => play("toString"));
  assert.equal(constructions, 0, "invalid sound names never reach the context");
  setEnabled(false);
  assert.doesNotThrow(() => play("chime"));
  assert.equal(constructions, 0, "disabled playback never reaches the context");
  setEnabled(true);
  assert.doesNotThrow(() => play("chime"));
  assert.equal(constructions, 1);
});

test("a suspended AudioContext whose resume() rejects renders nothing", async (t) => {
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

  mockPlatform(t);
  mockAudioApi(t, RejectedContext);
  const { play } = await import(`../dist/audio/engine.js?rejected=${Date.now()}`);

  assert.doesNotThrow(() => play("chime"));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renders, 0);
});

test("disabling playback mid-resume skips the render once it settles", async (t) => {
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

  mockPlatform(t);
  mockAudioApi(t, DeferredContext);
  const { play, setEnabled } = await import(`../dist/audio/engine.js?deferred=${Date.now()}`);

  play("chime");
  setEnabled(false);
  finishResume();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(renders, 0);
});

test("iOS audio session is configured once, lazily, before first playback", async (t) => {
  class AudioNodeStub {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }

  class SilentContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new AudioNodeStub();
    createGain() {
      return Object.assign(new AudioNodeStub(), { gain: audioParam() });
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
      return Object.assign(new AudioNodeStub(), { frequency: audioParam(), Q: audioParam() });
    }
    createDelay() {
      return Object.assign(new AudioNodeStub(), { delayTime: audioParam() });
    }
  }

  mockPlatform(t, "ios");
  const AudioManager = mockAudioApi(t, SilentContext);
  const { play } = await import(`../dist/audio/engine.js?session-ios=${Date.now()}`);

  play("chime");
  assert.deepEqual(AudioManager.calls, [{ iosCategory: "ambient", iosOptions: ["mixWithOthers"] }]);

  play("tick");
  assert.equal(AudioManager.calls.length, 1, "session is only configured once per context");
});

test("audio session is left alone on Android", async (t) => {
  class AudioNodeStub {
    connect(destination) {
      return destination;
    }
    disconnect() {}
  }

  class SilentContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new AudioNodeStub();
    createGain() {
      return Object.assign(new AudioNodeStub(), { gain: audioParam() });
    }
    createWaveShaper() {
      return Object.assign(new AudioNodeStub(), { curve: null, oversample: "none" });
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(1) };
    }
    createBufferSource() {
      return Object.assign(new AudioNodeStub(), { buffer: null, start() {}, stop() {} });
    }
    createBiquadFilter() {
      return Object.assign(new AudioNodeStub(), { frequency: audioParam(), Q: audioParam() });
    }
  }

  mockPlatform(t, "android");
  const AudioManager = mockAudioApi(t, SilentContext);
  const { play } = await import(`../dist/audio/engine.js?session-android=${Date.now()}`);

  play("press");
  assert.deepEqual(AudioManager.calls, []);
});

test("volume is clamped and one boosted output bus is reused", async (t) => {
  const gains = [];
  const waveShapers = [];

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
    createWaveShaper() {
      const node = Object.assign(new AudioNodeStub("limiter"), { curve: null, oversample: "none" });
      waveShapers.push(node);
      return node;
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

  mockPlatform(t);
  mockAudioApi(t, VolumeContext);
  const { play, setVolume } = await import(`../dist/audio/engine.js?volume=${Date.now()}`);

  setVolume(2);
  play("press", { volume: 0.5 });
  setVolume(0.5);
  play("press", { volume: 0.5 });
  play("press", { volume: 2 });
  play("press", { volume: Number.NaN });
  setVolume(-1);
  setVolume(Number.NaN);
  setVolume(Number.POSITIVE_INFINITY);
  play("press");

  const output = gains[0];
  const masters = gains.slice(1).filter((gain) => gain.connections.includes(output));

  assert.deepEqual(
    masters.map(({ gain }) => gain.value),
    [0.2, 0.1, 0.2, 0.2],
  );
  assert.ok(output.gain.value > 1);
  assert.equal(waveShapers.length, 1);
  assert.deepEqual(output.connections, [waveShapers[0]]);
  assert.equal(waveShapers[0].connections.length, 1);
  assert.equal(waveShapers[0].connections[0].name, "destination");
});

test("finished shimmer graphs disconnect after their audible tail", async (t) => {
  const timers = [];
  const disconnected = [];
  const nodes = new Map();

  class AudioNodeStub {
    constructor(name) {
      this.name = name;
      this.connections = [];
      nodes.set(name, this);
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
  class CleanupContext {
    state = "running";
    currentTime = 0;
    sampleRate = 1;
    destination = new AudioNodeStub("destination");
    createGain() {
      const names = ["output", "master", "feedback-gain", "wet-gain", "tone-gain", "tone-gain"];
      return Object.assign(new AudioNodeStub(names[gainCount++] ?? "gain"), { gain: audioParam() });
    }
    createWaveShaper() {
      return Object.assign(new AudioNodeStub("limiter"), { curve: null, oversample: "none" });
    }
    createDelay() {
      return Object.assign(new AudioNodeStub("delay"), { delayTime: audioParam() });
    }
    createBiquadFilter() {
      return Object.assign(new AudioNodeStub("feedback-filter"), {
        frequency: audioParam(),
        Q: audioParam(),
      });
    }
    createOscillator() {
      return Object.assign(new AudioNodeStub("oscillator"), {
        frequency: audioParam(),
        detune: audioParam(),
        start() {},
        stop() {},
      });
    }
  }

  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return 0;
  };
  t.after(() => {
    globalThis.setTimeout = originalSetTimeout;
  });

  mockPlatform(t);
  mockAudioApi(t, CleanupContext);
  const { play } = await import(`../dist/audio/engine.js?cleanup=${Date.now()}`);
  play("chime");

  assert.equal(timers.length, 1);
  assert.equal(Math.round(timers[0].delay), 1176);
  assert.equal(nodes.get("master").connections.includes(nodes.get("output")), true);
  assert.equal(nodes.get("wet-gain").connections.includes(nodes.get("output")), true);
  assert.deepEqual(nodes.get("output").connections, [nodes.get("limiter")]);
  assert.deepEqual(nodes.get("limiter").connections, [nodes.get("destination")]);
  timers[0].callback();
  assert.deepEqual(disconnected, ["master", "delay", "feedback-filter", "feedback-gain", "wet-gain"]);

  play("chime");
  assert.equal(timers.length, 2);
});

test("useCuelumeSound resolves press/release/toggle sounds with bind()'s defaults", async (t) => {
  mockPlatform(t);
  mockAudioApi(t);
  const { resolveSound } = await import("../dist/interactions/useCuelumeSound.js");

  assert.equal(resolveSound(undefined, "press"), "press");
  assert.equal(resolveSound("pulse", "press"), "pulse");
  assert.equal(resolveSound(false, "press"), null);
  assert.equal(resolveSound("not-a-real-sound", "press"), "press");
});

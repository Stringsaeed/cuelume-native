# Cuelume Native example

A kitchen-sink Expo app for [`cuelume-native`](../README.md): every sound via
`play()`, two buttons wired through `useCuelumeSound()`, and the
`setEnabled`/`setVolume` preferences.

## Why this needs a dev client

`react-native-audio-api` ships native code, so **this app cannot run in Expo
Go** — you need a dev-client build:

```sh
npm install         # from the repo root — installs this workspace too
npm run build        # from the repo root — builds cuelume-native's dist/ once
cd example
npm run ios          # or: npm run android
```

## How linking works here

`cuelume-native` is **not** an npm dependency of this app (there's no
`node_modules/cuelume-native`). This app lives *inside* the library's own
repo root rather than next to it as a sibling package, and a `file:..`
self-dependency confuses Metro's module graph (it and the workspace root
resolve to the same files two different ways). Instead:

- `metro.config.js` uses [`react-native-monorepo-config`](https://www.npmjs.com/package/react-native-monorepo-config)
  to point the `cuelume-native` import straight at the workspace root and
  read its TypeScript source directly — edits to `../src` show up via Fast
  Refresh with no build step.
- `tsconfig.json` adds a `paths` entry so the editor/type-checker resolves
  `cuelume-native` to `../dist/index.d.ts` instead (run `npm run build` at
  the repo root after changing the library's public API to refresh these).

## Layout

- `App.tsx` — the whole demo.
- `metro.config.js` — the monorepo wiring described above, plus stripping a
  trailing `.js` off relative imports so Metro's resolver can find `cuelume-native`'s
  `.ts` source (its compiled output uses explicit `.js` extensions for
  Node ESM; raw source doesn't have them).
- `babel.config.js` — registers `react-native-worklets/plugin`, required by
  `react-native-audio-api`.

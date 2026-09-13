# Releasing

Publishing is automated: pushing a `v*.*.*` tag runs [`.github/workflows/publish.yml`](.github/workflows/publish.yml), which builds, tests, and publishes to npm. There's no `NPM_TOKEN` — the workflow authenticates via npm's [trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC), so publishes are short-lived and tied to this exact workflow file and repo.

## Cutting a release

```sh
npm version patch   # or: minor / major
git push --follow-tags
```

`npm version` bumps `package.json`, commits it, and creates a matching `vX.Y.Z` git tag. Pushing the tag triggers the publish workflow, which refuses to publish if the tag doesn't match `package.json`'s version.

## One-time setup (already done for this repo, kept here for reference)

Trusted publishing has to be configured once per package on npmjs.com, and — since a brand-new package has no Settings page yet — the very first version has to reach the registry manually before that's possible:

1. **First publish, from a maintainer's machine:**
   ```sh
   npm login
   npm run build
   npm publish
   ```
2. On [npmjs.com](https://www.npmjs.com/package/cuelume-native), open **Settings → Trusted Publisher → Add trusted publisher**, and set:
   - **Provider:** GitHub Actions
   - **Organization or user:** `Stringsaeed`
   - **Repository:** `cuelume-native`
   - **Workflow filename:** `publish.yml`
   - **Environment name:** leave blank (the workflow doesn't use a GitHub Environment)
3. From then on, every subsequent release goes through the tag-push workflow above — no local `npm publish` needed, and no token to rotate or leak.

## What the workflow verifies before publishing

- `npm test` (which builds `dist/` and runs the full test suite) must pass.
- The pushed tag's version (`vX.Y.Z`) must exactly match `version` in `package.json` — a mismatch fails the job before anything is published.

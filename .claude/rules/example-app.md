---
paths:
  - "example/**"
---

# Example App

## Headless verification via Metro bundle

To confirm RN/reanimated code compiles + worklets transform without a simulator, bundle through the running Metro: `curl "http://localhost:8083/node_modules/expo-router/entry.bundle?platform=ios&dev=true&minify=false&transform.routerRoot=app"`. `http 200` + `hasError:false` in the head = clean; an `UnableToResolve`/`*Error` JSON header = failure. **Use the `expo-router/entry` entry — `/index.bundle` is wrong (404).** Grep the output for your symbol to confirm it's wired in. Does NOT verify on-device pixel behavior (e.g. `useAnimatedProps({text})` rendering) — that still needs a simulator.

Local packages via `file:../packages/onboarding` and `file:../packages/onboarding-ui`. Rebuild before reload after package changes.

## Upgrading the example's Expo SDK

Bumping `example/` Expo SDK (`npx expo install expo@latest && npx expo install --fix`) is not enough in this monorepo: `packages/onboarding` + `packages/onboarding-ui` **devDeps pin `react`/`react-native`** (and onboarding-ui pins expo-router/reanimated/safe-area/svg/etc). Leave them on the old SDK and workspace hoisting keeps a **duplicate react-native** (e.g. example 0.85 + packages 0.83) — `expo-doctor` flags "Found duplicates for react-native", and Metro/native builds break. Bump both packages' devDeps to match, then `npm dedupe` (collapses same-version nested copies expo-doctor still warns about). CNG app: no `ios/`/`android/` committed, so config-plugin changes go in `app.json`.

- RN 0.85 (SDK 56) removed `StyleSheet.absoluteFillObject` → use `StyleSheet.absoluteFill` (now the equivalent frozen object). Native peer deps must match the SDK too (e.g. `react-native-svg` 15.15.4 for RN 0.85's `ImageResponseObserver` signature) — `npx expo install <pkg> --check` shows the expected version even for transitively-pulled deps.
- **`weak let` Swift error in expo-modules-jsi is Xcode's live indexer, not the build.** jsi compiles via a prebuilt SPM xcframework at `node_modules/expo-modules-jsi/apple/Products/ExpoModulesJSI.xcframework`; confirm the real build by checking the active slice's binary size (~2MB real vs ~16KB stub) + mtime. Don't patch node_modules for it.

```bash
cd example/
npm install
npm start
npm run type:check
npm run lint
npm run ios
npm run android
```

## Workspace type resolution

`@rocapine/react-native-onboarding` resolves to `dist/index.d.ts` via workspace symlink + `package.json#types`. New exported symbols in `packages/onboarding/src/` are invisible to `packages/onboarding-ui/` and `example/` `tsc` runs until headless package built (or `npm run watch:headless` running). **Build before typechecking after adding exports.**

## Worktree gotcha

Fresh worktree has no `example/node_modules` — `tsc` **and `npm run build:ui`** resolve `@rocapine/*` via the **main** repo's symlink (main packages' stale `dist`, not the worktree), giving false type errors / building against the wrong source. Two fixes: `npm install --workspaces --include-workspace-root` from worktree root, or symlink directly — `mkdir -p node_modules/@rocapine && ln -sfn ../../packages/onboarding node_modules/@rocapine/react-native-onboarding && ln -sfn ../../packages/onboarding-ui node_modules/@rocapine/react-native-onboarding-ui` — then `build:headless` + `build:ui` before `type:check`.

Running the example (Metro / `expo run:ios`) from a worktree needs `@rocapine/*` linked first (`npm install` at worktree root, or the symlink commands above) — else Metro fails with `Unable to resolve module @rocapine/react-native-onboarding`. Metro **caches** the failed resolve, so after linking restart with `expo start --clear` (a plain reload won't pick it up).

Local `main` ref is **stale** in a worktree (branched from `origin/main`, which is usually ahead). For release/scope diffs (`/bump-version`, `git diff main...HEAD`) use `origin/main` as the base, else already-merged commits leak in and the version-bump scope is wrong. A worktree `npm install` also rewrites `package-lock.json`'s version field — don't bundle that into a feature commit (causes rebase conflicts; resolve with `git checkout --ours package-lock.json`).

Running metro from a worktree while another session runs metro in the main repo: port 8081 is taken, and `expo start` is **non-interactive** in a background shell — it prints "Use port 8083 instead?" then bails with "Skipping dev server". Pass an explicit free port: `npm start --prefix example -- --port 8083`.

`npm install` in a worktree may fail on `@shopify/react-native-skia`'s postinstall (downloads a prebuilt binary from a CDN — intermittent `504 Gateway Time-out`). Use `npm install --ignore-scripts`: Metro JS bundling doesn't need the skia native binary (only on-device skia rendering does).

## Native module autolinking (peer-dep elements)

A UIElement that renders an optional peer dep (e.g. `@react-native-picker/picker` for `Picker` / `WheelPicker`) needs that dep in **`example/package.json`** — workspace hoisting satisfies JS resolution but autolinking only sees declared example deps, so the native module is missing at runtime (`Unimplemented component: RNCPicker`). After adding, rebuild the dev client (`npx expo run:ios`) — reloading Metro is not enough.

`expo prebuild` reads `app.json`'s `expo-font` plugin font paths — a google font like `Bangers_400Regular.ttf` must exist under `example/assets/fonts/` (copy from `node_modules/@expo-google-fonts/<font>/...`), or prebuild fails with ENOENT.

## Layout

- `app/example/` — individual page-type demos (registered in `app/example/index.tsx`)
- `app/onboarding/[questionId].tsx` — full onboarding flow with real API
- `app/onboarding_custom_screens/` — custom-component override demos
- `app/_layout.tsx` — root layout with `OnboardingProvider` setup
- `components/` — demo custom components (e.g., `MinimalAnswerButton`, `AnimatedAnswersList`)

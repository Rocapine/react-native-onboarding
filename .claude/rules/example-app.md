---
paths:
  - "example/**"
---

# Example App

Local packages via `file:../packages/onboarding` and `file:../packages/onboarding-ui`. Rebuild before reload after package changes.

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

Fresh worktree has no `example/node_modules` — `tsc` resolves `@rocapine/*` via the **main** repo's symlink (main packages' stale `dist`, not the worktree), giving false type errors. Two fixes: `npm install --workspaces --include-workspace-root` from worktree root, or symlink directly — `mkdir -p node_modules/@rocapine && ln -sfn ../../packages/onboarding node_modules/@rocapine/react-native-onboarding && ln -sfn ../../packages/onboarding-ui node_modules/@rocapine/react-native-onboarding-ui` — then `build:headless` + `build:ui` before `type:check`.

## Layout

- `app/example/` — individual page-type demos (registered in `app/example/index.tsx`)
- `app/onboarding/[questionId].tsx` — full onboarding flow with real API
- `app/onboarding_custom_screens/` — custom-component override demos
- `app/_layout.tsx` — root layout with `OnboardingProvider` setup
- `components/` — demo custom components (e.g., `MinimalAnswerButton`, `AnimatedAnswersList`)

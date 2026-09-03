# parity-artifacts

Verification screenshots for the native-onboarding parity programme, referenced from pull
request comments so a reviewer sees the rendered result without checking anything out.

**This branch is never merged.** It shares no history with `main` — it is an orphan branch
whose only purpose is hosting images at stable `raw.githubusercontent.com` URLs, which
GitHub markdown renders inline because this repository is public.

Layout is `pr-<number>/<surface>-<what-it-shows>.png`. Surface prefixes:

- `ios-` — iPhone simulator, the truthful device render
- `web-` — react-native-web through Chrome, fast but known to diverge from device
  (see `rocapine/onboarding-studio#307`)

Captured by the `parity-tester` agent, which runs **offline** by construction: the example
app is pointed at an unreachable base URL so it falls back to the local
`packages/onboarding/src/onboarding-example.ts` payload. That matters twice over here —
this branch is public, so no screenshot may ever contain a real project's data.

Images are downscaled to 640px wide before committing. Full-resolution originals stay on
the machine that captured them, under `~/Developer/.parity-artifacts/`.

Safe to prune: delete a `pr-<n>/` directory once that PR is merged and closed. Nothing
builds from this branch and nothing depends on it.

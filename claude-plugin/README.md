# Rocapine Onboarding Plugin

Claude Code plugin for building and updating onboarding flows powered by **Rocapine Onboarding Studio**.

**Version policy.** Plugin version mirrors the SDK version it was tested against. `1.22.0` here matches `@rocapine/react-native-onboarding@1.22.0` + `@rocapine/react-native-onboarding-ui@1.22.0`. The `check-sdk-version` skill detects drift in a target app and proposes an upgrade — never auto-runs it.

## Two opinions baked in

1. **ComposableScreen exclusively.** Every screen is a ComposableScreen UIElement tree. Full design-system fidelity, one mental model, no hidden UI assumptions.
2. **Inspect the target app first.** Every authoring + integration step runs a probe of the consuming app that produces a structured **Design Profile** — brand + surface + text colors, font families + scale + weights, radius + spacing ladders, button/input dimensions, voice, motion library, icon lib, existing button/card component paths. Every emitted UIElement is wired with those values. Generic onboarding output is a regression.

## Components

### Skills

| Skill | Purpose |
|-------|---------|
| `create-step-json` | Author a ComposableScreen step from a screen-intent archetype, design-system-matched |
| `compose-screen-builder` | Deep reference for ComposableScreen UIElement trees |
| `validate-step-json` | Validate against `ComposableScreenStepTypeSchema` |
| `export-existing-onboarding` | Scan target app for an existing onboarding flow and convert it to ComposableScreen steps |
| `check-sdk-version` | Detect plugin/SDK version mismatch; propose upgrade |
| `setup-headless-sdk` | Install + wire `@rocapine/react-native-onboarding` |
| `setup-ui-sdk` | Install + wire `@rocapine/react-native-onboarding-ui` |
| `customize-onboarding-theme` | Map host design system tokens to onboarding theme |
| `customize-onboarding-components` | Override `customComponents` slots |
| `onboarding-best-practices` | Flow arc + per-archetype heuristics + target-app probe protocol |

### Agents

| Agent | When |
|-------|------|
| `onboarding-architect` | Design a full ComposableScreen-only flow from a product brief, after probing the app |
| `step-json-reviewer` | Audit step JSON across schema, design-system alignment, conversion, a11y |
| `sdk-integration-verifier` | Verify SDK wiring + theme alignment in a target app |

### Archetypes (the only screen vocabulary)

`hero` · `question-single` · `question-multi` · `input` · `picker` · `reflection` · `social-proof` · `loader` · `commitment` · `carousel`

All implemented as ComposableScreen UIElement trees. See `skills/create-step-json/references/composable-archetypes.md`.

## Installation

Local marketplace:

```bash
mkdir -p .claude-plugin
cat > .claude-plugin/marketplace.json <<'EOF'
{
  "name": "rocapine-local",
  "owner": { "name": "Rocapine" },
  "plugins": [{ "name": "rocapine-onboarding-sdk", "source": "./claude-plugin" }]
}
EOF
```

Then in Claude Code:
```
/plugin marketplace add /path/to/repo
/plugin install rocapine-onboarding-sdk@rocapine-local
```

## Reference

- Headless SDK source: `packages/onboarding/src/`
- UI SDK source: `packages/onboarding-ui/src/`
- ComposableScreen schema: `packages/onboarding/src/steps/ComposableScreen/`
- Example app: `example/app/`
- OpenAPI spec: `openapi.yaml`
- Target-app probe protocol: `skills/onboarding-best-practices/references/inspect-target-app.md`

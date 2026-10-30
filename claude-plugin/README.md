# Rocapine Onboarding Plugin

Claude Code plugin for building and updating onboarding flows powered by **Rocapine Onboarding Studio**.

**Version policy.** Plugin version mirrors the SDK version it was tested against. `1.22.0` here matches `@rocapine/react-native-onboarding@1.22.0` + `@rocapine/react-native-onboarding-ui@1.22.0`. The `check-sdk-version` skill detects drift in a target app and proposes an upgrade — never auto-runs it.

## Two opinions baked in

1. **Built-in step types for new steps.** `MediaContent`, `Question`, `Picker`, `Carousel`, `Loader`, `Ratings`, `Commitment`, `Paywall`. The `ComposableScreen` step type is deprecated (#353): existing ComposableScreen steps keep rendering and can still be edited, but no skill authors new ones. Paywalls are still UIElement trees.
2. **Inspect the target app first.** Every authoring + integration step runs a probe of the consuming app that produces a structured **Design Profile** — brand + surface + text colors, font families + scale + weights, radius + spacing ladders, button/input dimensions, voice, motion library, icon lib, existing button/card component paths. Every emitted step and theme mapping uses those values. Generic onboarding output is a regression.

## Components

### Skills

| Skill | Purpose |
|-------|---------|
| `create-step-json` | Author a step with a built-in step type, matched to the app's copy voice |
| `compose-screen-builder` | Deep reference for UIElement trees: paywalls, and editing existing ComposableScreen steps |
| `validate-step-json` | Validate a step against its type's `<Type>StepTypeSchema` |
| `export-existing-onboarding` | Scan target app for an existing onboarding flow and convert it to built-in steps |
| `check-sdk-version` | Detect plugin/SDK version mismatch; propose upgrade |
| `setup-headless-sdk` | Install + wire `@rocapine/react-native-onboarding` |
| `setup-ui-sdk` | Install + wire `@rocapine/react-native-onboarding-ui` |
| `setup-paywalls` | Mount `PaywallProvider`, pick a billing adapter (store or Stripe), host the modal, present by moment |
| `customize-onboarding-theme` | Map host design system tokens to onboarding theme |
| `customize-onboarding-components` | Override `customComponents` slots |
| `onboarding-best-practices` | Flow arc + per-archetype heuristics + target-app probe protocol |

### Agents

| Agent | When |
|-------|------|
| `onboarding-architect` | Design a full flow of built-in steps from a product brief, after probing the app |
| `step-json-reviewer` | Audit step JSON across schema, design-system alignment, conversion, a11y |
| `sdk-integration-verifier` | Verify SDK wiring + theme alignment in a target app |

### Step types
`MediaContent` · `Question` · `Picker` · `Carousel` · `Loader` · `Ratings` · `Commitment` · `Paywall`

See `skills/create-step-json/references/built-in-step-types.md`. The ComposableScreen archetypes in `skills/create-step-json/references/composable-archetypes.md` are kept as a reference for editing existing ComposableScreen steps.

## Installation

Local marketplace:

```bash
mkdir -p .claude-plugin
cat > .claude-plugin/marketplace.json <<'EOF'
{
  "name": "rocapine-local",
  "owner": { "name": "Rocapine" },
  "plugins": [{ "name": "react-native-onboarding", "source": "./claude-plugin" }]
}
EOF
```

Then in Claude Code:
```
/plugin marketplace add /path/to/repo
/plugin install react-native-onboarding@rocapine-local
```

## Reference

- Headless SDK source: `packages/onboarding/src/`
- UI SDK source: `packages/onboarding-ui/src/`
- ComposableScreen element schemas + UIElement union: `packages/onboarding/src/screens/` (the `packages/onboarding/src/steps/ComposableScreen/` step wrapper re-exports these, screen-agnostic)
- Example app: `example/app/`
- OpenAPI spec: `openapi.yaml`
- Target-app probe protocol: `skills/onboarding-best-practices/references/inspect-target-app.md`

# Rocapine Onboarding Plugin

Claude Code plugin for building and updating onboarding flows powered by **Rocapine Onboarding Studio**.

Covers the full lifecycle:

- Authoring step JSON (Ratings, MediaContent, Picker, Commitment, Carousel, Loader, Question, ComposableScreen)
- Integrating `@rocapine/react-native-onboarding` (headless SDK) in any Expo/React Native app
- Integrating `@rocapine/react-native-onboarding-ui` (UI SDK) with theming + custom components
- Composing `ComposableScreen` UIElement trees
- Reviewing onboarding flows for conversion, accessibility, and SDK best practices

## Components

### Skills

| Skill | Purpose |
|-------|---------|
| `create-step-json` | Author a new step JSON payload for any step type |
| `validate-step-json` | Validate step JSON against headless SDK Zod schemas |
| `setup-headless-sdk` | Install + wire `@rocapine/react-native-onboarding` |
| `setup-ui-sdk` | Install + wire `@rocapine/react-native-onboarding-ui` |
| `customize-onboarding-theme` | Build/extend light & dark theme tokens |
| `customize-onboarding-components` | Replace `QuestionAnswerButton`, `QuestionAnswersList`, etc. |
| `compose-screen-builder` | Compose `ComposableScreen` UIElement trees |
| `onboarding-best-practices` | Conversion-optimized onboarding patterns |

### Agents

| Agent | When |
|-------|------|
| `onboarding-architect` | Design a full onboarding flow from a product goal |
| `step-json-reviewer` | Review a step JSON payload for quality, conversion, accessibility |
| `sdk-integration-verifier` | Verify SDK integration in a target Expo/RN app |

## Installation

```bash
# Test locally from any project:
cc --plugin-dir /path/to/this/claude-plugin
```

Or copy this folder into the consuming project's `.claude-plugin/` directory.

## Reference

- Headless SDK source: `packages/onboarding/src/`
- UI SDK source: `packages/onboarding-ui/src/`
- Example app: `example/app/`
- OpenAPI spec: `openapi.yaml`

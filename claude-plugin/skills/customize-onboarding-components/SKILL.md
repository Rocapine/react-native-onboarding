---
name: customize-onboarding-components
description: Replaces specific UI SDK components (QuestionAnswerButton, QuestionAnswersList, etc.) with custom implementations while keeping SDK data flow. Use when the user wants to override how a Question answer renders, swap the answer list, or asks "customize the answer button" / "use my own component for X".
allowed-tools: Read, Write, Edit, Glob, Grep
---

# Customize Onboarding Components

Replace UI SDK components via the `customComponents` prop on `OnboardingProvider`. Resolution: Custom List → Custom Button → Default.

## Currently customizable

- `QuestionAnswerButton`
- `QuestionAnswersList`

Both live behind `useCustomComponents()` (`src/infra/provider/CustomComponentsContext.tsx`).

## Pattern: custom answer button

```tsx
import { OnboardingProvider, type QuestionAnswerButtonProps } from "@rocapine/react-native-onboarding";
import { Pressable, Text } from "react-native";
import { useTheme } from "@rocapine/react-native-onboarding-ui";

function MyAnswerButton({ answer, selected, onPress }: QuestionAnswerButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: selected ? theme.colors.primary : theme.colors.neutral.lower,
        backgroundColor: selected ? theme.colors.primary + "22" : theme.colors.surface.low,
      }}
    >
      <Text style={{ color: theme.colors.text.primary }}>{answer.label}</Text>
    </Pressable>
  );
}

<OnboardingProvider customComponents={{ QuestionAnswerButton: MyAnswerButton }} /* ... */ />
```

## Pattern: custom answers list

When the default list layout (vertical stack) isn't enough — e.g. you want a grid of icon tiles:

```tsx
import type { QuestionAnswersListProps } from "@rocapine/react-native-onboarding";

function MyAnswersGrid({ answers, selectedValues, onToggle, multipleAnswer }: QuestionAnswersListProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      {answers.map(a => (
        <TileButton
          key={a.value}
          answer={a}
          selected={selectedValues.includes(a.value)}
          onPress={() => onToggle(a.value)}
        />
      ))}
    </View>
  );
}

<OnboardingProvider customComponents={{ QuestionAnswersList: MyAnswersGrid }} />
```

If a custom list is provided, it completely owns rendering. The custom button is then ignored unless your list re-uses it via `useCustomComponents()`.

## Adding a new customizable component (advanced)

If you need to override something the SDK doesn't yet expose:

1. Open `packages/onboarding/src/infra/provider/CustomComponentsContext.tsx`.
2. Add the slot to the `CustomComponents` interface.
3. In the renderer (`packages/onboarding-ui/src/UI/Pages/<Page>/Renderer.tsx`):
   ```ts
   const customComponents = useCustomComponents();
   const ButtonImpl = customComponents.MyNewSlot || DefaultButtonImpl;
   ```
4. Export the props interface from the headless package public API.
5. Document in the consuming app's README.

Bump SDK versions afterward via the `bump-version` skill (repo-internal).

## Anti-patterns

- Don't reach into UI SDK internals — only override through `customComponents`.
- Don't make custom components stateful for selection — selection lives in the SDK and is passed as props.
- Don't bypass `useTheme()` — colors won't react to color-scheme changes.

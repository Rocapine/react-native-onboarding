import { describe, it, expect } from "vitest";
// Old path — must keep working for onboarding-studio and every host app.
import {
  ComposableScreenStepTypeSchema,
  UIElementSchema,
} from "../steps/ComposableScreen/types";
// New path — the screen-agnostic home.
import {
  UIElementSchema as ScreenUIElementSchema,
  ScreenElementsSchema,
} from "../screens/types";

const textElement = {
  id: "t1",
  type: "Text",
  props: { content: "Hello" },
};

const step = {
  id: "s1",
  name: "Step 1",
  type: "ComposableScreen",
  displayProgressHeader: true,
  payload: { elements: [textElement] },
};

describe("screen types back-compat", () => {
  it("parses a UIElement from the old path", () => {
    expect(UIElementSchema.safeParse(textElement).success).toBe(true);
  });

  it("parses a UIElement from the new path", () => {
    expect(ScreenUIElementSchema.safeParse(textElement).success).toBe(true);
  });

  it("both paths expose the same schema object", () => {
    expect(UIElementSchema).toBe(ScreenUIElementSchema);
  });

  it("still parses a full ComposableScreen step from the old path", () => {
    const result = ComposableScreenStepTypeSchema.safeParse(step);
    expect(result.success).toBe(true);
  });

  it("ScreenElementsSchema rejects a KeyboardAvoidingView nested in another", () => {
    const nested = [
      {
        id: "kav1",
        type: "KeyboardAvoidingView",
        props: {},
        children: [
          { id: "kav2", type: "KeyboardAvoidingView", props: {}, children: [] },
        ],
      },
    ];
    expect(ScreenElementsSchema.safeParse(nested).success).toBe(false);
  });
});

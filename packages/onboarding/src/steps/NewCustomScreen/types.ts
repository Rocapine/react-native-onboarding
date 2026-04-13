import { z } from "zod";
import { CustomPayloadSchema } from "../common.types";

type UIElement =
  | {
      id: string;
      name?: string;
      type: "YStack" | "XStack";
      props: {
        gap?: number;
        padding?: number;
        paddingHorizontal?: number;
        paddingVertical?: number;
        flex?: number;
        alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
        justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
        backgroundColor?: string;
        flexWrap?: "wrap" | "nowrap";
        flexShrink?: number;
      };
      children: UIElement[];
    }
  | {
      id: string;
      name?: string;
      type: "Text";
      props: {
        content: string;
        fontSize?: number;
        fontWeight?: string;
        color?: string;
        textAlign?: "left" | "center" | "right";
        letterSpacing?: number;
        lineHeight?: number;
        backgroundColor?: string;
        padding?: number;
        paddingHorizontal?: number;
        paddingVertical?: number;
      };
    };

const StackElementPropsSchema = z.object({
  gap: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  flex: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  backgroundColor: z.string().optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  flexShrink: z.number().optional(),
});

const TextElementPropsSchema = z.object({
  content: z.string(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  backgroundColor: z.string().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
});

const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
  z.union([
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.union([z.literal("YStack"), z.literal("XStack")]),
      props: StackElementPropsSchema,
      children: z.array(UIElementSchema),
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Text"),
      props: TextElementPropsSchema,
    }),
  ])
);

export const NewCustomScreenStepPayloadSchema = z.object({
  elements: z.array(UIElementSchema),
});

export const NewCustomScreenStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("NewCustomScreen"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: NewCustomScreenStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullable(),
});

export type NewCustomScreenStepType = z.infer<typeof NewCustomScreenStepTypeSchema>;

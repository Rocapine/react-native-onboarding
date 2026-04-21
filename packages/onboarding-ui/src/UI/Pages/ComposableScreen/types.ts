import { z } from "zod";
import { CustomPayloadSchema } from "../types";

export type UIElement =
  | {
      id: string;
      name?: string;
      type: "YStack" | "XStack";
      props: {
        gap?: number;
        padding?: number;
        paddingHorizontal?: number;
        paddingVertical?: number;
        margin?: number;
        marginHorizontal?: number;
        marginVertical?: number;
        flex?: number;
        width?: number;
        height?: number;
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
        alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
        justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
        backgroundColor?: string;
        flexWrap?: "wrap" | "nowrap";
        flexShrink?: number;
        borderWidth?: number;
        borderRadius?: number;
        borderColor?: string;
        overflow?: "hidden" | "visible" | "scroll";
        opacity?: number;
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
        margin?: number;
        marginHorizontal?: number;
        marginVertical?: number;
        borderWidth?: number;
        borderRadius?: number;
        borderColor?: string;
        opacity?: number;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Image";
      props: {
        url: string;
        width?: number;
        height?: number;
        aspectRatio?: number;
        resizeMode?: "cover" | "contain" | "stretch" | "center";
        borderRadius?: number;
        borderWidth?: number;
        borderColor?: string;
        opacity?: number;
        margin?: number;
        marginHorizontal?: number;
        marginVertical?: number;
        padding?: number;
        paddingHorizontal?: number;
        paddingVertical?: number;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Lottie";
      props: {
        source: string;
        width?: number;
        height?: number;
        autoPlay?: boolean;
        loop?: boolean;
        speed?: number;
        opacity?: number;
        margin?: number;
        marginHorizontal?: number;
        marginVertical?: number;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Rive";
      props: {
        url: string;
        width?: number;
        height?: number;
        autoplay?: boolean;
        fit?: "Contain" | "Cover" | "Fill" | "FitWidth" | "FitHeight" | "None" | "ScaleDown" | "Layout";
        alignment?: "TopLeft" | "TopCenter" | "TopRight" | "CenterLeft" | "Center" | "CenterRight" | "BottomLeft" | "BottomCenter" | "BottomRight";
        artboardName?: string;
        stateMachineName?: string;
        opacity?: number;
        margin?: number;
        marginHorizontal?: number;
        marginVertical?: number;
      };
    };

const StackElementPropsSchema = z.object({
  gap: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  flex: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  backgroundColor: z.string().optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  flexShrink: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  overflow: z.enum(["hidden", "visible", "scroll"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
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
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

const ImageElementPropsSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  borderRadius: z.number().optional(),
  borderWidth: z.number().optional(),
  borderColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
});

const LottieElementPropsSchema = z.object({
  source: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  speed: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
});

const RiveElementPropsSchema = z.object({
  url: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  autoplay: z.boolean().optional(),
  fit: z.enum(["Contain", "Cover", "Fill", "FitWidth", "FitHeight", "None", "ScaleDown", "Layout"]).optional(),
  alignment: z.enum(["TopLeft", "TopCenter", "TopRight", "CenterLeft", "Center", "CenterRight", "BottomLeft", "BottomCenter", "BottomRight"]).optional(),
  artboardName: z.string().optional(),
  stateMachineName: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
});

export const UIElementSchema: z.ZodType<UIElement> = z.lazy(() =>
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
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Image"),
      props: ImageElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Lottie"),
      props: LottieElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Rive"),
      props: RiveElementPropsSchema,
    }),
  ])
);


export const ComposableScreenStepPayloadSchema = z.object({
  elements: z.array(UIElementSchema),
});

export const ComposableScreenStepTypeSchema = z.object({
  id: z.string(),
  type: z.literal("ComposableScreen"),
  name: z.string(),
  displayProgressHeader: z.boolean(),
  payload: ComposableScreenStepPayloadSchema,
  customPayload: CustomPayloadSchema,
  continueButtonLabel: z.string().optional().default("Continue"),
  figmaUrl: z.string().nullable(),
});

export type ComposableScreenStepType = z.infer<typeof ComposableScreenStepTypeSchema>;

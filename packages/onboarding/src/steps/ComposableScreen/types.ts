import { z } from "zod";
import { CustomPayloadSchema } from "../common.types";

type BaseBoxProps = {
  width?: number;
  height?: number;
  opacity?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
};

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
      props: BaseBoxProps & {
        url: string;
        aspectRatio?: number;
        resizeMode?: "cover" | "contain" | "stretch" | "center";
      };
    }
  | {
      id: string;
      name?: string;
      type: "Lottie";
      props: BaseBoxProps & {
        source: string;
        autoPlay?: boolean;
        loop?: boolean;
        speed?: number;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Rive";
      props: BaseBoxProps & {
        url: string;
        autoplay?: boolean;
        fit?: "Contain" | "Cover" | "Fill" | "FitWidth" | "FitHeight" | "None" | "ScaleDown" | "Layout";
        alignment?: "TopLeft" | "TopCenter" | "TopRight" | "CenterLeft" | "Center" | "CenterRight" | "BottomLeft" | "BottomCenter" | "BottomRight";
        artboardName?: string;
        stateMachineName?: string;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Icon";
      props: BaseBoxProps & {
        name: string;
        size?: number;
        color?: string;
        strokeWidth?: number;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Video";
      props: BaseBoxProps & {
        url: string;
        autoPlay?: boolean;
        loop?: boolean;
        muted?: boolean;
        controls?: boolean;
      };
    }
  | {
      id: string;
      name?: string;
      type: "Input";
      props: BaseBoxProps & {
        placeholder?: string;
        defaultValue?: string;
        keyboardType?: "default" | "email-address" | "numeric" | "phone-pad" | "decimal-pad" | "url" | "number-pad";
        returnKeyType?: "done" | "next" | "go" | "search" | "send";
        autoCapitalize?: "none" | "sentences" | "words" | "characters";
        secureTextEntry?: boolean;
        maxLength?: number;
        multiline?: boolean;
        numberOfLines?: number;
        editable?: boolean;
        color?: string;
        backgroundColor?: string;
        fontSize?: number;
        fontWeight?: string;
        textAlign?: "left" | "center" | "right";
        placeholderColor?: string;
      };
    };

const BaseBoxPropsSchema = z.object({
  width: z.number().optional(),
  height: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
});

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

const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
});

const LottieElementPropsSchema = BaseBoxPropsSchema.extend({
  source: z.string(),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  speed: z.number().optional(),
});

const RiveElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  autoplay: z.boolean().optional(),
  fit: z.enum(["Contain", "Cover", "Fill", "FitWidth", "FitHeight", "None", "ScaleDown", "Layout"]).optional(),
  alignment: z.enum(["TopLeft", "TopCenter", "TopRight", "CenterLeft", "Center", "CenterRight", "BottomLeft", "BottomCenter", "BottomRight"]).optional(),
  artboardName: z.string().optional(),
  stateMachineName: z.string().optional(),
});

const IconElementPropsSchema = BaseBoxPropsSchema.extend({
  name: z.string(),
  size: z.number().optional(),
  color: z.string().optional(),
  strokeWidth: z.number().optional(),
});

const VideoElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  controls: z.boolean().optional(),
});

const InputElementPropsSchema = BaseBoxPropsSchema.extend({
  placeholder: z.string().optional(),
  defaultValue: z.string().optional(),
  keyboardType: z.enum(["default", "email-address", "numeric", "phone-pad", "decimal-pad", "url", "number-pad"]).optional(),
  returnKeyType: z.enum(["done", "next", "go", "search", "send"]).optional(),
  autoCapitalize: z.enum(["none", "sentences", "words", "characters"]).optional(),
  secureTextEntry: z.boolean().optional(),
  maxLength: z.number().optional(),
  multiline: z.boolean().optional(),
  numberOfLines: z.number().optional(),
  editable: z.boolean().optional(),
  color: z.string().optional(),
  backgroundColor: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  placeholderColor: z.string().optional(),
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
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Icon"),
      props: IconElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Video"),
      props: VideoElementPropsSchema,
    }),
    z.object({
      id: z.string(),
      name: z.string().optional(),
      type: z.literal("Input"),
      props: InputElementPropsSchema,
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

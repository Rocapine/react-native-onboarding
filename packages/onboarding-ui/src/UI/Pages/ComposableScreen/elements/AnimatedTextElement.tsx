import React, { useEffect } from "react";
import { TextInput } from "react-native";
import { z } from "zod";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withDelay,
  cancelAnimation,
} from "react-native-reanimated";
import { useResolvedFontStyle } from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim, resolveInheritedFontFamily, RichTextStyleContext } from "./shared";
import { EASING_MAP } from "./buildAnimation";

type AnimatedEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out";

export type AnimatedTextElementProps = BaseBoxProps & {
  from?: number;
  to: number;
  duration?: number;
  delay?: number;
  easing?: AnimatedEasing;
  autoplay?: boolean;
  loop?: boolean;
  decimals?: number;
  thousandsSeparator?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

const EasingSchema = z.enum(["linear", "ease-in", "ease-out", "ease-in-out"]);

export const AnimatedTextElementPropsSchema = BaseBoxPropsSchema.extend({
  from: z.number().optional(),
  to: z.number(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  easing: EasingSchema.optional(),
  autoplay: z.boolean().optional(),
  loop: z.boolean().optional(),
  decimals: z.number().int().min(0).optional(),
  thousandsSeparator: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

// react-native-redash's ReText trick: TextInput's native `text` prop can be set
// from a reanimated worklet via useAnimatedProps, so the number updates on the
// UI thread WITHOUT a React re-render. (RN <Text> can't — its content is a
// child, not an animatable prop.)
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type AnimatedTextUIElement = Extract<UIElement, { type: "AnimatedText" }>;

type Props = {
  element: AnimatedTextUIElement;
  ctx: RenderContext;
};

export const AnimatedTextElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const p = element.props;

  const from = p.from ?? 0;
  const to = p.to;
  const duration = p.duration ?? 1000;
  const delay = p.delay ?? 0;
  const easing = EASING_MAP[p.easing ?? "ease-out"];
  const autoplay = p.autoplay ?? true;
  const loop = p.loop ?? false;
  const decimals = p.decimals ?? 0;
  const separator = p.thousandsSeparator ?? ",";

  // Text-style defaults inherited from a parent `RichText` container (empty
  // otherwise). Element props always win over inherited values.
  const inherited = React.useContext(RichTextStyleContext);
  const fontSize = p.fontSize ?? inherited.fontSize;
  const fontWeight = p.fontWeight ?? inherited.fontWeight;
  const fontStyle = p.fontStyle ?? inherited.fontStyle;
  const color = p.color ?? inherited.color;
  const textAlign = p.textAlign ?? inherited.textAlign;
  const letterSpacing = p.letterSpacing ?? inherited.letterSpacing;
  const lineHeight = p.lineHeight ?? inherited.lineHeight;
  const inheritedFontFamily = resolveInheritedFontFamily(
    p.fontFamily ?? inherited.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(inheritedFontFamily, fontWeight, fontStyle);

  // 0 -> 1 driver, lives on the UI thread.
  const progress = useSharedValue(autoplay ? 0 : 1);

  useEffect(() => {
    if (!autoplay) return;
    progress.value = 0;
    const anim = withTiming(1, { duration, easing });
    const looped = loop ? withRepeat(anim, -1, false) : anim;
    progress.value = delay > 0 ? withDelay(delay, looped) : looped;
    return () => cancelAnimation(progress);
  }, [autoplay, loop, duration, delay, easing]);

  // Worklet: maps the driver to the formatted number and writes it to the
  // native TextInput. No JS closure (formatNumber is inlined), only primitives
  // captured — re-keyed via the deps array. No React re-render fires.
  const animatedProps = useAnimatedProps(() => {
    const raw = from + (to - from) * progress.value;
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(raw * factor) / factor;
    let str = rounded.toFixed(decimals);
    if (separator !== "") {
      const neg = str[0] === "-";
      if (neg) str = str.slice(1);
      const dot = str.indexOf(".");
      const intPart = dot === -1 ? str : str.slice(0, dot);
      const decPart = dot === -1 ? "" : str.slice(dot);
      let grouped = "";
      for (let i = 0; i < intPart.length; i++) {
        if (i > 0 && (intPart.length - i) % 3 === 0) grouped += separator;
        grouped += intPart[i];
      }
      str = (neg ? "-" : "") + grouped + decPart;
    }
    // `text` is TextInput's native prop, not in the public props type.
    // `defaultValue` MUST be driven here too: once the count finishes, `progress`
    // is constant and this worklet stops pushing `text`. A parent re-render then
    // reconciles the TextInput and reverts the (uncontrolled) native value to its
    // `defaultValue` — a static mount-time defaultValue would snap the display
    // back to `from`. Keeping defaultValue in sync makes the fallback the live value.
    return { text: str, defaultValue: str } as object;
  }, [from, to, decimals, separator]);

  return (
    <AnimatedTextInput
      editable={false}
      pointerEvents="none"
      caretHidden
      contextMenuHidden
      underlineColorAndroid="transparent"
      accessibilityRole="text"
      animatedProps={animatedProps}
      style={{
        // Neutralize TextInput defaults so it lays out like <Text>.
        padding: 0,
        includeFontPadding: false,
        flex: p.flex,
        flexShrink: p.flexShrink,
        flexGrow: p.flexGrow,
        alignSelf: p.alignSelf,
        width: dim(p.width),
        height: dim(p.height),
        minWidth: p.minWidth,
        maxWidth: p.maxWidth,
        minHeight: p.minHeight,
        maxHeight: p.maxHeight,
        fontSize,
        fontWeight: resolvedFont.resolvedToVariant ? undefined : (fontWeight as any),
        fontFamily: resolvedFont.fontFamily,
        fontStyle,
        color: color ?? theme.colors.text.primary,
        textAlign,
        letterSpacing,
        lineHeight,
        backgroundColor: p.backgroundColor,
        margin: p.margin,
        marginHorizontal: p.marginHorizontal,
        marginVertical: p.marginVertical,
        paddingHorizontal: p.paddingHorizontal,
        paddingVertical: p.paddingVertical,
        borderWidth: p.borderWidth,
        borderRadius: p.borderRadius,
        borderColor: p.borderColor,
        opacity: p.opacity,
      }}
    />
  );
};

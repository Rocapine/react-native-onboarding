import React from "react";
import { z } from "zod";
import { View } from "react-native";
import Animated, * as Reanimated from "react-native-reanimated";
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { useResolvedFontStyle } from "@rocapine/react-native-onboarding";
import {
  BaseBoxProps,
  BaseBoxPropsSchema,
  type AnimationEasing,
  type EnteringPreset,
  type SpringConfig,
  AnimationEasingSchema,
  EnteringPresetSchema,
  SpringConfigSchema,
} from "./BaseBoxProps";
import { UIElement } from "../types";
import {
  RenderContext,
  dim,
  interpolate,
  resolveInheritedFontFamily,
  RichTextStyleContext,
} from "./shared";
import { EASING_MAP } from "./buildAnimation";

// Mirror of the headless TypewriterTextElement schema. Kept in lockstep with
// packages/onboarding/src/steps/ComposableScreen/elements/TypewriterTextElement.ts —
// TS won't catch drift because this re-declares its own type.
export type TypewriterTextElementProps = BaseBoxProps & {
  content: string;
  mode?: "plain" | "expression";
  preset?: EnteringPreset;
  duration?: number;
  delay?: number;
  stagger?: number;
  easing?: AnimationEasing;
  spring?: SpringConfig;
  loop?: boolean;
  loopDelay?: number;
  cursor?: boolean;
  cursorChar?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
};

export const TypewriterTextElementPropsSchema = BaseBoxPropsSchema.extend({
  content: z.string(),
  mode: z.enum(["plain", "expression"]).optional(),
  preset: EnteringPresetSchema.optional(),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).optional(),
  stagger: z.number().min(0).optional(),
  easing: AnimationEasingSchema.optional(),
  spring: SpringConfigSchema.optional(),
  loop: z.boolean().optional(),
  loopDelay: z.number().min(0).optional(),
  cursor: z.boolean().optional(),
  cursorChar: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
});

// textAlign aligns text inside a Text box, but here every character is its own
// shrink-wrapped flex item, so textAlign is a no-op on the row — map it onto the
// row's justifyContent instead (same trick as RichTextElement).
const ALIGN_TO_JUSTIFY = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
} as const;

type TypewriterTextUIElement = Extract<UIElement, { type: "TypewriterText" }>;

type Props = {
  element: TypewriterTextUIElement;
  ctx: RenderContext;
  parentType?: "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";
};

type CharItem = { ch: string; i: number };
type Group =
  | { kind: "word"; chars: CharItem[] }
  | { kind: "space"; item: CharItem };

const isWhitespace = (ch: string): boolean => /\s/.test(ch);

// Split into word groups + standalone whitespace items, tagging each character
// with its absolute index so the stagger is continuous across word boundaries.
// Words stay in a non-wrapping inner row (chars never break mid-word); spaces are
// their own items in the outer wrapping row, so wrapping happens between words.
const buildGroups = (text: string): Group[] => {
  const groups: Group[] = [];
  let buf: CharItem[] = [];
  Array.from(text).forEach((ch, i) => {
    if (isWhitespace(ch)) {
      if (buf.length) {
        groups.push({ kind: "word", chars: buf });
        buf = [];
      }
      groups.push({ kind: "space", item: { ch, i } });
    } else {
      buf.push({ ch, i });
    }
  });
  if (buf.length) groups.push({ kind: "word", chars: buf });
  return groups;
};

/**
 * Typewriter text: reveals its content one character at a time. Each character
 * is an `Animated.Text` mounting its own reanimated entering animation, delayed
 * by `delay + charIndex * stagger`. Characters must be real native views (not
 * inline nested `<Text>`) because presets like `FadeInDown` use `transform`,
 * which RN ignores on inline nested Text (see composable-screen-runtime.md →
 * "TextSpan is not a UIElement").
 *
 * Entering builders hold each character's final layout box from frame 0 and only
 * animate opacity/transform, so the line never reflows as characters appear.
 *
 * `loop` replays the reveal: a timer bumps a generation counter every
 * `revealDuration + loopDelay` ms, which re-keys the characters so they remount
 * and their entering animations fire again.
 *
 * `cursor` switches to a true typewriter: characters mount progressively (one per
 * `stagger`), so the line grows left-to-right and a blinking caret rendered after
 * the last typed character follows the text. Without `cursor`, all characters
 * hold their layout from frame 0 (no reflow) and only their opacity/transform
 * animates in — a staggered headline reveal.
 *
 * NOT handled here (intentional, easy follow-ups): `reduceMotion`,
 * `backgroundGradient`, explicit line breaks.
 */
export const TypewriterTextElementComponent = ({ element, ctx, parentType }: Props): React.ReactElement => {
  const { theme, variables } = ctx;
  const p = element.props;

  const preset: EnteringPreset = p.preset ?? "FadeInDown";
  const duration = p.duration ?? 400;
  const delay = p.delay ?? 0;
  const stagger = p.stagger ?? 45;

  // Text-style defaults inherited from a parent `RichText` (empty otherwise);
  // element props always win.
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
  // Font hook called ONCE at top, reused for every character (rules-of-hooks).
  const resolvedFont = useResolvedFontStyle(inheritedFontFamily, fontWeight, fontStyle);

  const text = p.mode === "expression" ? interpolate(p.content, variables) : p.content;
  const groups = buildGroups(text);

  const loop = p.loop ?? false;
  const loopDelay = p.loopDelay ?? 1200;
  const charCount = Array.from(text).length;
  // Wall-clock for one full reveal: lead-in + last char's stagger offset + its
  // own animation. Used as the loop period (plus the inter-cycle pause).
  const revealDuration = delay + Math.max(0, charCount - 1) * stagger + duration;

  // `loop`: bump a generation counter so the characters re-key and remount,
  // re-firing their entering animations. Fires once per (reveal + pause), i.e.
  // every few seconds — not per frame — so the re-render cost is negligible.
  const [gen, setGen] = React.useState(0);
  React.useEffect(() => {
    if (!loop) return;
    const id = setInterval(() => setGen((g) => g + 1), revealDuration + loopDelay);
    return () => clearInterval(id);
  }, [loop, revealDuration, loopDelay]);

  // Blinking typewriter caret. Hook called unconditionally (rules-of-hooks); the
  // caret view is only rendered when `cursor` is set.
  const cursorOpacity = useSharedValue(1);
  React.useEffect(() => {
    if (!p.cursor) {
      cancelAnimation(cursorOpacity);
      cursorOpacity.value = 1;
      return;
    }
    cursorOpacity.value = withRepeat(withTiming(0, { duration: 530 }), -1, true);
    return () => cancelAnimation(cursorOpacity);
  }, [p.cursor]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: cursorOpacity.value }));

  // Cursor mode = true typewriter: characters are mounted progressively (one per
  // `stagger`), so the line grows left-to-right and the caret — rendered right
  // after the last typed char — follows the text. `typed` is the count currently
  // shown. Hold-layout mode shows everything at once (all chars present from
  // frame 0) and reveals via per-char entering delay, so there `typed` = charCount.
  // Re-keyed on `gen` so a loop cycle retypes from the start.
  const [typed, setTyped] = React.useState(p.cursor ? 0 : charCount);
  React.useEffect(() => {
    if (!p.cursor) {
      setTyped(charCount);
      return;
    }
    setTyped(0);
    let n = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const startTimeout = setTimeout(() => {
      interval = setInterval(() => {
        n += 1;
        setTyped(n);
        if (n >= charCount && interval) clearInterval(interval);
      }, Math.max(1, stagger));
    }, delay);
    return () => {
      clearTimeout(startTimeout);
      if (interval) clearInterval(interval);
    };
  }, [p.cursor, gen, charCount, stagger, delay]);

  // Resolve the reanimated entering builder by name (same convention as
  // buildAnimation.ts). Unknown/typo preset → undefined → characters render with
  // no animation (forward-compat with reanimated version mismatches).
  const Builder = (Reanimated as unknown as Record<string, any>)[preset];

  // Entering builder: duration → delay → spring|easing. Spring wins over easing
  // (matches reanimated + the rest of the schema).
  const buildEntering = (delayMs: number): any => {
    if (!Builder) return undefined;
    let b = Builder.duration(duration).delay(delayMs);
    if (p.spring) {
      b = b.springify();
      if (p.spring.damping != null) b = b.damping(p.spring.damping);
      if (p.spring.stiffness != null) b = b.stiffness(p.spring.stiffness);
      if (p.spring.mass != null) b = b.mass(p.spring.mass);
    } else if (p.easing) {
      b = b.easing(EASING_MAP[p.easing]);
    }
    return b;
  };
  // Hold-layout mode staggers via the builder's own delay (delay + i*stagger).
  const enteringFor = (charIndex: number): any => buildEntering(delay + charIndex * stagger);

  const charStyle = {
    fontSize,
    fontWeight: resolvedFont.resolvedToVariant ? undefined : (fontWeight as any),
    fontFamily: resolvedFont.fontFamily,
    fontStyle,
    color: color ?? theme.colors.text.primary,
    letterSpacing,
    lineHeight,
  } as const;

  const containerStyle = {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: textAlign ? ALIGN_TO_JUSTIFY[textAlign] : "flex-start",
    flex: p.flex,
    flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
    flexGrow: p.flexGrow,
    alignSelf: p.alignSelf,
    width: dim(p.width),
    height: dim(p.height),
    minWidth: p.minWidth,
    maxWidth: p.maxWidth,
    minHeight: p.minHeight,
    maxHeight: p.maxHeight,
    padding: p.padding,
    paddingHorizontal: p.paddingHorizontal,
    paddingVertical: p.paddingVertical,
    margin: p.margin,
    marginHorizontal: p.marginHorizontal,
    marginVertical: p.marginVertical,
    backgroundColor: p.backgroundColor,
    borderWidth: p.borderWidth,
    borderRadius: p.borderRadius,
    borderColor: p.borderColor,
    overflow: p.overflow,
    opacity: p.opacity,
  } as const;

  const cursorNode = p.cursor ? (
    <Animated.Text key="cursor" style={[charStyle, cursorStyle]}>
      {p.cursorChar ?? "|"}
    </Animated.Text>
  ) : null;

  // Cursor mode: progressive typewriter. Render only the first `typed` characters
  // as a flat sequence (so the line grows and the caret sits right after the last
  // typed char). Each char fades in via the preset on mount (delay 0 — the mount
  // timing already supplies the stagger). Flat (not word-grouped): a caret line is
  // typically short; word integrity matters less than the caret hugging the text.
  if (p.cursor) {
    const chars = Array.from(text);
    return (
      <View style={containerStyle}>
        {chars.slice(0, typed).map((ch, i) => (
          <Animated.Text key={`${gen}-${i}`} entering={buildEntering(0)} style={charStyle}>
            {ch}
          </Animated.Text>
        ))}
        {cursorNode}
      </View>
    );
  }

  // Hold-layout mode: all characters present from frame 0 (no reflow), revealed by
  // the per-char entering delay. Key includes `gen` so a loop tick remounts them.
  const renderChar = ({ ch, i }: CharItem): React.ReactElement => (
    <Animated.Text key={`${gen}-${i}`} entering={enteringFor(i)} style={charStyle}>
      {ch}
    </Animated.Text>
  );

  return (
    <View style={containerStyle}>
      {groups.map((g, gi) =>
        g.kind === "space" ? (
          renderChar(g.item)
        ) : (
          // One non-wrapping row per word so its characters never break mid-word.
          <View key={`w${gen}-${gi}`} style={{ flexDirection: "row", flexShrink: 0 }}>
            {g.chars.map(renderChar)}
          </View>
        )
      )}
      {cursorNode}
    </View>
  );
};

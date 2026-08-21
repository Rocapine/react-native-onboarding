import React, { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { z } from "zod";
import { useSharedValue } from "react-native-reanimated";
// DEFAULT import, and the peer range in package.json is pinned to `^4.0.0`
// because of it. These two facts are one decision and must move together.
//
// `react-native-reanimated-carousel@4` exports Carousel as a DEFAULT only
// (`export default Carousel`). v5 removed that default and exports named
// (`export { Carousel }`) — so under v5 this binding is `undefined` and the
// element red-boxes on device with "Element type is invalid … got: undefined",
// pointing at `Carousel` rather than at the import. `Pagination` is named in
// both majors and resolves fine, which is what makes the failure look like an
// element bug instead of a dependency one.
//
// That shipped: the peer range was `"*"` and not optional, so npm resolved the
// newest major and every FRESH install got v5 and a dead Carousel — while this
// repo kept working, because its devDependency pins ^4.0.3. Confirmed on a real
// device before it was found here.
//
// Do NOT "modernize" this to `import { Carousel }` on its own. v5 is a
// migration, not an import fix: it also drops `autoPlay`, `autoPlayInterval`,
// `snapEnabled`, `pagingEnabled`, `mode` and `modeConfig` — all used below and
// all authored in payloads — and narrows `onProgressChange` from
// `(offsetProgress, absoluteProgress)` to `(progress)`, while the handler below
// reads the SECOND argument. Supporting v5 means reworking this element's props
// and its progress plumbing, and widening the peer range without that is how
// the crash comes back.
//
// `ICarouselInstance` is v4's ref type; v5 renamed it `CarouselRef`. Type-only,
// so it erases at runtime and did not contribute to the crash.
import Carousel, { Pagination, ICarouselInstance } from "react-native-reanimated-carousel";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import { dim, type RenderContext } from "./shared";
import { useVariables } from "./VariablesContext";
import { useAnimatedVariables } from "./AnimatedVariablesContext";
import { GradientBox } from "./GradientBox";

export type CarouselElementProps = BaseBoxProps & {
  carouselType?: "left-align" | "normal" | "parallax" | "stack";
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showDots?: boolean;
  dotColor?: string;
  activeDotColor?: string;
  dotWidth?: number;
  dotHeight?: number;
  activeDotWidth?: number;
  activeDotHeight?: number;
  dotsGap?: number;
  dotsPosition?: "top" | "bottom";
  dotsMarginTop?: number;
  dotsMarginBottom?: number;
  defaultIndex?: number | null;
  variableName?: string;
  /**
   * Continuous swipe position, published as a screen-scoped animated variable.
   * Always normalized to `[0, childCount)` — the library's `absoluteProgress` is
   * UNBOUNDED under `loop: true` (which is the default), so the raw value would
   * break gates after the first lap. See the headless schema for full semantics.
   */
  progressVariableName?: string;
};

export const CarouselElementPropsSchema = BaseBoxPropsSchema.extend({
  carouselType: z.enum(["left-align", "normal", "parallax", "stack"]).optional().default("normal"),
  autoPlay: z.boolean().optional().default(false),
  autoPlayInterval: z.number().nonnegative().optional().default(3000),
  loop: z.boolean().optional().default(true),
  showDots: z.boolean().optional().default(true),
  dotColor: z.string().optional(),
  activeDotColor: z.string().optional(),
  dotWidth: z.number().nonnegative().optional().default(20),
  dotHeight: z.number().nonnegative().optional().default(4),
  activeDotWidth: z.number().nonnegative().optional(),
  activeDotHeight: z.number().nonnegative().optional(),
  dotsGap: z.number().nonnegative().optional().default(8),
  dotsPosition: z.enum(["top", "bottom"]).optional().default("bottom"),
  dotsMarginTop: z.number().optional().default(12),
  dotsMarginBottom: z.number().optional().default(0),
  defaultIndex: z.number().int().nonnegative().nullable().optional(),
  variableName: z.string().min(1).optional(),
  progressVariableName: z.string().min(1).optional(),
});

type CarouselUIElement = Extract<UIElement, { type: "Carousel" }>;

const DEFAULT_HEIGHT = 240;

type Props = {
  element: CarouselUIElement;
  ctx: RenderContext;
};

export function CarouselElementComponent({ element, ctx }: Props): React.ReactElement {
  const { theme } = ctx;
  const { variables } = useVariables();
  const animatedVariables = useAnimatedVariables();
  const { props, children } = element;
  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  const carouselType = props.carouselType ?? "normal";

  const variableName = props.variableName;
  const variableValue = variableName ? variables[variableName]?.value : undefined;
  const childrenCount = children.length;
  const clampIndex = (n: number) => Math.max(0, Math.min(n, Math.max(0, childrenCount - 1)));

  // Frozen on first mount — RNRC `defaultIndex` only applies at mount.
  const initialIndexRef = useRef<number | null>(null);
  if (initialIndexRef.current === null) {
    const parsed = variableValue !== undefined ? parseInt(variableValue, 10) : NaN;
    const fromVar = Number.isFinite(parsed) ? parsed : null;
    initialIndexRef.current = clampIndex(fromVar ?? props.defaultIndex ?? 0);
  }
  const lastSyncedIndexRef = useRef<number>(initialIndexRef.current);

  // The continuous swipe position published to `progressVariableName`, kept
  // separate from `progress` on purpose: `progress` must stay RAW because
  // Pagination and the `scrollTo({ count: index - progress.value })` arithmetic
  // both depend on the library's own unwrapped scale. This one is normalized.
  // Seeded with the mount index so a gate evaluates correctly on the first frame,
  // before the library's first onProgressChange lands.
  const publishedProgress = useSharedValue<number>(initialIndexRef.current ?? 0);

  useEffect(() => {
    if (!variableName) return;
    const parsed = parseInt(variableValue ?? "", 10);
    if (!Number.isFinite(parsed)) return;
    const target = clampIndex(parsed);
    if (target === lastSyncedIndexRef.current) return;
    lastSyncedIndexRef.current = target;
    ref.current?.scrollTo({ count: target - progress.value, animated: true });
  }, [variableName, variableValue, childrenCount]);

  // Persist the initial index into ctx.variables when no value exists yet, so the
  // default reaches downstream renderWhen / interpolation across renders.
  useEffect(() => {
    if (!variableName) return;
    if (variableValue !== undefined) return;
    if (props.defaultIndex == null) return;
    ctx.setVariable(variableName, { value: String(clampIndex(props.defaultIndex)) });
  }, [variableName, variableValue, props.defaultIndex, childrenCount]);

  // `absoluteProgress` is clamped to [0, n-1] under `loop: false`, but is
  // UNBOUNDED under `loop: true` — the library never wraps its internal offset,
  // so lap two reports n, n+1, ... Since `loop` defaults to true, publishing the
  // raw value would silently break every gate after the first lap. Wrapping into
  // [0, n) is a no-op when not looping and makes each lap read identically.
  const progressVariableName = props.progressVariableName;
  const normalizeProgress = (raw: number) => {
    if (childrenCount <= 0) return 0;
    return ((raw % childrenCount) + childrenCount) % childrenCount;
  };

  // Publish the live swipe position for `renderWhen` consumers on this screen to
  // evaluate on the UI thread (see GatedElement). Mirrors the ProgressIndicator
  // producer: register on mount, unregister on unmount. Purely additive — the
  // snap-time store write via `variableName` is untouched.
  useEffect(() => {
    if (!progressVariableName) return;
    animatedVariables.register(progressVariableName, publishedProgress);
    return () => animatedVariables.unregister(progressVariableName);
  }, [progressVariableName, animatedVariables, publishedProgress]);

  // Keep the seed correct if the child count changes before the first swipe.
  useEffect(() => {
    if (!progressVariableName) return;
    publishedProgress.value = normalizeProgress(progress.value);
  }, [progressVariableName, childrenCount]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!size || size.width !== width || size.height !== height) {
      setSize({ width, height });
    }
  };

  // Stack uses 75% width (shows side items); left-align uses 82% (peek effect)
  const availableWidth = size?.width ?? 0;
  const itemWidth =
    carouselType === "stack"
      ? availableWidth * 0.75
      : carouselType === "left-align"
        ? availableWidth * 0.82
        : availableWidth;

  const hasExplicitSize =
    props.height != null || props.flex != null || props.flexGrow != null;
  const heightFallback = hasExplicitSize ? undefined : DEFAULT_HEIGHT;

  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
    height: dim(props.height) ?? heightFallback,
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    borderRadius: props.borderRadius,
    borderWidth: props.borderWidth,
    borderColor: props.borderColor,
    backgroundColor: props.backgroundGradient ? undefined : props.backgroundColor,
    opacity: props.opacity,
    // Left-align shows the next slide peeking — must not clip
    overflow: carouselType === "left-align" ? ("visible" as const) : (props.overflow ?? ("hidden" as const)),
  };

  const modeProps: Record<string, unknown> =
    carouselType === "parallax"
      ? {
        mode: "parallax",
        modeConfig: { parallaxScrollingScale: 0.9, parallaxScrollingOffset: 50 },
      }
      : carouselType === "stack"
        ? {
          mode: "horizontal-stack",
          modeConfig: { snapDirection: "left", stackInterval: 18 },
          customConfig: () => ({ type: "positive", viewCount: 5 }),
        }
        : {};

  const dotW = props.dotWidth ?? 20;
  const dotH = props.dotHeight ?? 4;
  const activeDotW = props.activeDotWidth ?? dotW;
  const activeDotH = props.activeDotHeight ?? dotH;
  const dotsGap = props.dotsGap ?? 8;
  const dotsMarginTop = props.dotsMarginTop ?? 12;
  const dotsMarginBottom = props.dotsMarginBottom ?? 0;
  const dotsPosition = props.dotsPosition ?? "bottom";
  const dotBg = props.dotColor ?? theme.colors.neutral.low;
  const activeDotBg = props.activeDotColor ?? theme.colors.primary;

  const ready = !!size && size.width > 0 && size.height > 0;

  const pagination = (props.showDots ?? true) ? (
    <Pagination.Custom
      progress={progress}
      data={children}
      dotStyle={{
        width: dotW,
        height: dotH,
        borderRadius: dotH / 2,
        backgroundColor: dotBg,
      }}
      activeDotStyle={{
        width: activeDotW,
        height: activeDotH,
        borderRadius: activeDotH / 2,
        backgroundColor: activeDotBg,
      }}
      containerStyle={{ gap: dotsGap, marginTop: dotsMarginTop, marginBottom: dotsMarginBottom }}
      // Each dot is a button whose accessibility label the library builds as
      // `Slide ${i+1} of ${n} - ${carouselName}` — interpolated UNGUARDED even
      // though `carouselName` is optional (Pagination/Custom/index.tsx:84). So
      // omitting it makes a screen reader say "Slide 1 of 6 - undefined" out
      // loud, once per dot. Confirmed on device.
      //
      // The authored `name` is the right source: it is already the human label
      // for this element everywhere else, and it distinguishes two carousels on
      // one screen. `name` is optional, so the fallback is a literal rather than
      // another `undefined` — passing through an absent name would reproduce
      // exactly the bug this fixes.
      carouselName={element.name ?? "Carousel"}
      horizontal
      onPress={(index: number) => {
        ref.current?.scrollTo({ count: index - progress.value, animated: true });
      }}
    />
  ) : null;

  return (
    <GradientBox gradient={props.backgroundGradient} style={containerStyle}>
      {dotsPosition === "top" && pagination}
      <View style={{ flex: 1 }} onLayout={onLayout}>
        {ready && (
          <Carousel
            ref={ref}
            loop={props.loop}
            autoPlay={props.autoPlay}
            autoPlayInterval={props.autoPlayInterval}
            defaultIndex={initialIndexRef.current ?? 0}
            snapEnabled={true}
            pagingEnabled={true}
            data={children}
            width={itemWidth}
            height={size!.height}
            style={{ width: size!.width, height: size!.height }}
            renderItem={({ item }: { item: UIElement }) => ctx.renderChildren([item], "YStack")}
            onProgressChange={(_: number, absoluteProgress: number) => {
              progress.value = absoluteProgress;
              if (progressVariableName) {
                publishedProgress.value = normalizeProgress(absoluteProgress);
              }
            }}
            onSnapToItem={(index: number) => {
              if (!variableName) return;
              if (index === lastSyncedIndexRef.current) return;
              lastSyncedIndexRef.current = index;
              ctx.setVariable(variableName, { value: String(index) });
            }}
            {...(modeProps as any)}
          />
        )}
      </View>
      {dotsPosition === "bottom" && pagination}
    </GradientBox>
  );
}

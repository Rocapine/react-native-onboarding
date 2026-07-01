import React, { useEffect, useRef, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { z } from "zod";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { Pagination, ICarouselInstance } from "react-native-reanimated-carousel";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import { dim, type RenderContext } from "./shared";
import { useVariables } from "./VariablesContext";
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

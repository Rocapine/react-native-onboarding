import React, { useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { Pagination, ICarouselInstance } from "react-native-reanimated-carousel";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import { dim, type RenderContext } from "./shared";

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
  dotsGap?: number;
  dotsMarginTop?: number;
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
  dotsGap: z.number().nonnegative().optional().default(8),
  dotsMarginTop: z.number().optional().default(12),
});

type CarouselUIElement = Extract<UIElement, { type: "Carousel" }>;

type Props = {
  element: CarouselUIElement;
  ctx: RenderContext;
};

export function CarouselElementComponent({ element, ctx }: Props): React.ReactElement {
  const { theme } = ctx;
  const { props, children } = element;
  const { width: windowWidth } = useWindowDimensions();
  const progress = useSharedValue<number>(0);
  const ref = useRef<ICarouselInstance>(null);

  const carouselType = props.carouselType ?? "normal";

  // Stack uses 75% width (shows side items); left-align uses 82% (peek effect)
  const itemWidth =
    carouselType === "stack"
      ? windowWidth * 0.75
      : carouselType === "left-align"
        ? windowWidth * 0.82
        : (typeof props.width === "number" ? props.width : windowWidth);
  const itemHeight = typeof props.height === "number" ? props.height : 220;

  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
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
    backgroundColor: props.backgroundColor,
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
  const dotsGap = props.dotsGap ?? 8;
  const dotsMarginTop = props.dotsMarginTop ?? 12;
  const dotBg = props.dotColor ?? theme.colors.neutral.low;
  const activeDotBg = props.activeDotColor ?? theme.colors.primary;
  console.log(props.autoPlay, props.autoPlayInterval);
  console.log(element);
  return (
    <View style={containerStyle}>
      <Carousel
        ref={ref}
        loop={props.loop}
        autoPlay={props.autoPlay}
        autoPlayInterval={props.autoPlayInterval}
        snapEnabled={true}
        pagingEnabled={true}
        data={children}
        width={itemWidth}
        height={itemHeight}
        style={{ width: itemWidth, height: itemHeight }}
        renderItem={({ item }: { item: UIElement }) => ctx.renderChildren([item], "YStack")}
        onProgressChange={(_: number, absoluteProgress: number) => {
          progress.value = absoluteProgress;
        }}
        {...(modeProps as any)}
      />
      {(props.showDots ?? true) && (
        <Pagination.Basic
          progress={progress}
          data={children}
          dotStyle={{
            width: dotW,
            height: dotH,
            borderRadius: dotH / 2,
            backgroundColor: dotBg,
          }}
          activeDotStyle={{
            overflow: "hidden",
            backgroundColor: activeDotBg,
          }}
          containerStyle={{ gap: dotsGap, marginTop: dotsMarginTop }}
          horizontal
          onPress={(index: number) => {
            ref.current?.scrollTo({ count: index - progress.value, animated: true });
          }}
        />
      )}
    </View>
  );
}

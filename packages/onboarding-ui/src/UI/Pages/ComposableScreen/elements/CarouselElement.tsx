import React, { useRef } from "react";
import { useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { useSharedValue } from "react-native-reanimated";
import Carousel, { Pagination, ICarouselInstance } from "react-native-reanimated-carousel";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import type { RenderContext } from "./shared";

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
  autoPlay: z.boolean().optional().default(true),
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
      : (props.width ?? windowWidth);
  const itemHeight = props.height ?? 220;

  const containerStyle = {
    alignSelf: props.alignSelf,
    width: props.width,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    borderRadius: props.borderRadius,
    borderWidth: props.borderWidth,
    borderColor: props.borderColor,
    opacity: props.opacity,
    // Left-align shows the next slide peeking — must not clip
    overflow: carouselType === "left-align" ? ("visible" as const) : ("hidden" as const),
  };

  // Mode-specific props per rn-carousel docs
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

  return (
    <View style={containerStyle}>
      <Carousel
        ref={ref}
        loop={props.loop ?? true}
        autoPlay={props.autoPlay ?? true}
        autoPlayInterval={props.autoPlayInterval ?? 3000}
        snapEnabled={true}
        pagingEnabled={true}
        data={children}
        width={itemWidth}
        height={itemHeight}
        style={{ width: itemWidth, height: itemHeight }}
        renderItem={({ item }: { item: UIElement }) => (
          <View
            style={{
              width: itemWidth,
              height: itemHeight,
              borderRadius: props.borderRadius ?? 0,
              overflow: "hidden",
            }}
          >
            {ctx.renderChildren([item], "YStack")}
          </View>
        )}
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
            width: props.dotWidth ?? 20,
            height: props.dotHeight ?? 4,
            borderRadius: 2,
            backgroundColor: props.dotColor ?? theme.colors.neutral.low,
          }}
          activeDotStyle={{
            overflow: "hidden",
            backgroundColor: props.activeDotColor ?? theme.colors.primary,
          }}
          containerStyle={{ gap: props.dotsGap ?? 8, marginTop: props.dotsMarginTop ?? 12 }}
          horizontal
          onPress={(index: number) => {
            ref.current?.scrollTo({ count: index - progress.value, animated: true });
          }}
        />
      )}
    </View>
  );
}

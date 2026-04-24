import React, { useState } from "react";
import { Image, Text, useWindowDimensions, View } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import type { UIElement } from "../types";
import type { RenderContext } from "./shared";

// ---------------------------------------------------------------------------
// Schema (mirrored from headless CarouselElement.ts)
// ---------------------------------------------------------------------------

export type CarouselItem = {
  image?: string;
  title?: string;
  description?: string;
};

export const CarouselItemSchema = z.object({
  image: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type CarouselElementProps = BaseBoxProps & {
  items: CarouselItem[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showDots?: boolean;
};

export const CarouselElementPropsSchema = BaseBoxPropsSchema.extend({
  items: z.array(CarouselItemSchema).min(1, "carousel must have at least one item"),
  autoPlay: z.boolean().optional().default(true),
  autoPlayInterval: z.number().nonnegative().optional().default(3000),
  loop: z.boolean().optional().default(true),
  showDots: z.boolean().optional().default(true),
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type CarouselUIElement = Extract<UIElement, { type: "Carousel" }>;

type Props = {
  element: CarouselUIElement;
  ctx: RenderContext;
};

export const CarouselElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const { width: windowWidth } = useWindowDimensions();
  const { props } = element;

  const carouselWidth = props.width ?? windowWidth;
  const carouselHeight = props.height ?? 220;
  const autoPlay = props.autoPlay ?? true;
  const autoPlayInterval = props.autoPlayInterval ?? 3000;
  const loop = props.loop ?? true;
  const showDots = props.showDots ?? true;
  const items = props.items;

  const [activeIndex, setActiveIndex] = useState(0);

  // Lazy-require so the peer dep is truly optional at bundle time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let ReanimatedCarousel: React.ComponentType<any> | undefined;
  try {
    ReanimatedCarousel = require("react-native-reanimated-carousel").default;
  } catch {
    ReanimatedCarousel = undefined;
  }

  const containerStyle = {
    alignSelf: props.alignSelf,
    width: props.width,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    borderWidth: props.borderWidth,
    borderRadius: props.borderRadius,
    borderColor: props.borderColor,
    opacity: props.opacity,
    overflow: "hidden" as const,
  };

  const renderSlide = (item: CarouselItem) => (
    <View
      style={{
        width: carouselWidth,
        height: carouselHeight,
        overflow: "hidden",
        borderRadius: props.borderRadius ?? 0,
      }}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={{ width: "100%", height: "100%" }}
          resizeMode="cover"
        />
      ) : null}
      {(item.title || item.description) ? (
        <View
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            paddingHorizontal: 16,
            paddingVertical: 12,
            backgroundColor: "rgba(0,0,0,0.35)",
          }}
        >
          {item.title ? (
            <Text
              style={{
                color: theme.colors.text.opposite,
                fontSize: theme.typography.textStyles.bodyMedium.fontSize,
                fontWeight: theme.typography.fontWeight.semibold as any,
                marginBottom: item.description ? 2 : 0,
              }}
              numberOfLines={2}
            >
              {item.title}
            </Text>
          ) : null}
          {item.description ? (
            <Text
              style={{
                color: theme.colors.text.opposite,
                fontSize: theme.typography.textStyles.caption.fontSize,
                opacity: 0.85,
              }}
              numberOfLines={2}
            >
              {item.description}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  const dots = showDots ? (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: 10,
        gap: 6,
      }}
    >
      {items.map((_, i) => (
        <View
          key={i}
          style={{
            width: i === activeIndex ? 12 : 6,
            height: 6,
            borderRadius: 3,
            backgroundColor:
              i === activeIndex
                ? theme.colors.primary
                : theme.colors.neutral.low,
          }}
        />
      ))}
    </View>
  ) : null;

  if (!ReanimatedCarousel) {
    // Fallback: render first slide statically when peer dep is missing.
    return (
      <View style={containerStyle}>
        {renderSlide(items[0])}
        {dots}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <ReanimatedCarousel
        data={items}
        renderItem={({ item }: { item: CarouselItem }) => renderSlide(item)}
        width={carouselWidth}
        height={carouselHeight}
        loop={loop}
        autoPlay={autoPlay}
        autoPlayInterval={autoPlayInterval}
        onProgressChange={(_: number, absoluteProgress: number) => {
          const index = Math.round(Math.abs(absoluteProgress)) % items.length;
          setActiveIndex(index);
        }}
      />
      {dots}
    </View>
  );
};

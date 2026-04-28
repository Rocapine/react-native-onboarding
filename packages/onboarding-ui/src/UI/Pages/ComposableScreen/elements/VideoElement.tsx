import React, { useEffect } from "react";
import { z } from "zod";
import { Text, StyleSheet } from "react-native";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { getTextStyle } from "../../../Theme/helpers";
import { GradientBox } from "./GradientBox";

export type VideoElementProps = BaseBoxProps & {
  url: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  contentFit?: "contain" | "cover" | "fill";
};

export const VideoElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  controls: z.boolean().optional(),
  contentFit: z.enum(["contain", "cover", "fill"]).optional(),
});

type VideoUIElement = Extract<UIElement, { type: "Video" }>;

let VideoElementComponent: React.ComponentType<{ element: VideoUIElement; style: object }> | null = null;
try {
  const { VideoView, useVideoPlayer } = require("expo-video");
  VideoElementComponent = ({ element, style }: { element: VideoUIElement; style: object }) => {
    const player = useVideoPlayer(element.props.url, (p: any) => {
      p.loop = element.props.loop ?? false;
      p.muted = element.props.muted ?? true;
      if (element.props.autoPlay) p.play();
    });

    useEffect(() => {
      player.loop = element.props.loop ?? false;
      player.muted = element.props.muted ?? true;
      if (element.props.autoPlay) {
        player.play();
      } else {
        player.pause();
      }
    }, [element.props.loop, element.props.muted, element.props.autoPlay]);

    return (
      <VideoView
        player={player}
        style={style}
        allowsFullscreen={false}
        nativeControls={element.props.controls ?? false}
        contentFit={element.props.contentFit ?? "contain"}
      />
    );
  };
} catch {
  // expo-video not installed
}

type Props = {
  element: VideoUIElement;
  ctx: RenderContext;
};

export const VideoElementRenderer = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const wrapperStyle = {
    flex: element.props.flex,
    flexShrink: element.props.flexShrink,
    flexGrow: element.props.flexGrow,
    alignSelf: element.props.alignSelf,
    width: dim(element.props.width) ?? ("100%" as `${number}%`),
    height: dim(element.props.height ?? 200),
    minWidth: element.props.minWidth,
    maxWidth: element.props.maxWidth,
    minHeight: element.props.minHeight,
    maxHeight: element.props.maxHeight,
    opacity: element.props.opacity,
    backgroundColor: element.props.backgroundGradient ? undefined : element.props.backgroundColor,
    margin: element.props.margin,
    marginHorizontal: element.props.marginHorizontal,
    marginVertical: element.props.marginVertical,
    padding: element.props.padding,
    paddingHorizontal: element.props.paddingHorizontal,
    paddingVertical: element.props.paddingVertical,
    borderWidth: element.props.borderWidth,
    borderRadius: element.props.borderRadius,
    borderColor: element.props.borderColor,
    overflow: "hidden" as const,
  };

  if (!VideoElementComponent) {
    return (
      <GradientBox
        gradient={element.props.backgroundGradient}
        style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }] as any}
      >
        <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
          Install expo-video to render videos.
        </Text>
      </GradientBox>
    );
  }

  return (
    <GradientBox gradient={element.props.backgroundGradient} style={wrapperStyle as any}>
      <VideoElementComponent element={element} style={styles.fill} />
    </GradientBox>
  );
};

const styles = StyleSheet.create({
  fill: {
    width: "100%",
    height: "100%",
  },
  mediaFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  mediaFallbackText: {
    textAlign: "center",
    paddingHorizontal: 16,
  },
});

import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, PanResponder, LayoutChangeEvent } from "react-native";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";
import { LottieElementComponent } from "./LottieElement";
import { RiveElementRenderer } from "./RiveElement";
import { ImageElementComponent } from "./ImageElement";

// ---------------------------------------------------------------------------
// Schema/type are DUPLICATED inline (repo convention — onboarding-ui does not
// import element schemas from the headless package). Keep byte-for-byte in sync
// with packages/onboarding/.../elements/SliderElement.ts.
// ---------------------------------------------------------------------------

export type SliderReactionStop = { atValue: number; source: string };

export type SliderReaction = {
  type: "Lottie" | "Rive" | "Image";
  source?: string;
  stops?: SliderReactionStop[];
  height?: number;
};

export type SliderElementProps = BaseBoxProps & {
  variableName?: string;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  minLabel?: string;
  maxLabel?: string;
  showValue?: boolean;
  valueSuffix?: string;
  trackColor?: string;
  trackFilledColor?: string;
  trackHeight?: number;
  knobColor?: string;
  knobSize?: number;
  reaction?: SliderReaction;
};

const SliderReactionStopSchema = z.object({
  atValue: z.number(),
  source: z.string().trim().min(1, "reaction stop source must not be empty"),
});

const SliderReactionSchema = z.object({
  type: z.enum(["Lottie", "Rive", "Image"]),
  source: z.string().trim().min(1).optional(),
  stops: z.array(SliderReactionStopSchema).min(1, "reaction stops must not be empty").optional(),
  height: z.number().positive().optional(),
});

export const SliderElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().optional(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive().optional(),
  defaultValue: z.number().optional(),
  minLabel: z.string().optional(),
  maxLabel: z.string().optional(),
  showValue: z.boolean().optional(),
  valueSuffix: z.string().optional(),
  trackColor: z.string().optional(),
  trackFilledColor: z.string().optional(),
  trackHeight: z.number().positive().optional(),
  knobColor: z.string().optional(),
  knobSize: z.number().positive().optional(),
  reaction: SliderReactionSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.max <= data.min) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "max must be greater than min", path: ["max"] });
  }
  if (data.defaultValue !== undefined && (data.defaultValue < data.min || data.defaultValue > data.max)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "defaultValue must be within [min, max]", path: ["defaultValue"] });
  }
  if (data.reaction) {
    const hasSource = data.reaction.source !== undefined;
    const hasStops = data.reaction.stops !== undefined;
    if (hasSource === hasStops) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reaction must provide exactly one of `source` or `stops`",
        path: ["reaction", hasSource ? "stops" : "source"],
      });
    }
    if (hasStops) {
      data.reaction.stops!.forEach((stop, i) => {
        if (stop.atValue < data.min || stop.atValue > data.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "reaction stop atValue must be within [min, max]",
            path: ["reaction", "stops", i, "atValue"],
          });
        }
      });
    }
  }
});

// Snap a raw value to the nearest step and clamp to [min, max]. Mirrors the
// headless `snapSliderValue` helper.
const snapValue = (props: SliderElementProps, raw: number): number => {
  const step = props.step && props.step > 0 ? props.step : 1;
  const clamped = Math.min(props.max, Math.max(props.min, raw));
  const steps = Math.round((clamped - props.min) / step);
  const snapped = props.min + steps * step;
  const trimmed = Math.round(snapped * 1e6) / 1e6;
  return Math.min(props.max, Math.max(props.min, trimmed));
};

type SliderUIElement = Extract<UIElement, { type: "Slider" }>;

type Props = {
  element: SliderUIElement;
  ctx: RenderContext;
};

// Pick the discrete-stop source for the current value: highest `atValue <= value`,
// falling back to the first stop when value sits below every stop.
const resolveStopSource = (stops: SliderReactionStop[], value: number): string | undefined => {
  const sorted = [...stops].sort((a, b) => a.atValue - b.atValue);
  let chosen: string | undefined = sorted[0]?.source;
  for (const stop of sorted) {
    if (value >= stop.atValue) chosen = stop.source;
  }
  return chosen;
};

// Render the value-bound reaction by reusing the concrete media renderer with a
// synthetic sub-element. `stops` swaps the source discretely; a single `source`
// renders statically (progress-driven media is a follow-up).
const SliderReactionView = ({
  reaction,
  value,
  ctx,
  baseId,
}: {
  reaction: SliderReaction;
  value: number;
  ctx: RenderContext;
  baseId: string;
}): React.ReactElement | null => {
  const source = reaction.stops ? resolveStopSource(reaction.stops, value) : reaction.source;
  if (!source) return null;

  const height = reaction.height;
  const boxProps = { height } as BaseBoxProps;

  if (reaction.type === "Lottie") {
    const el = { id: `${baseId}-reaction`, type: "Lottie" as const, props: { ...boxProps, source, autoPlay: true, loop: true } };
    return <LottieElementComponent key={source} element={el} ctx={ctx} />;
  }
  if (reaction.type === "Rive") {
    const el = { id: `${baseId}-reaction`, type: "Rive" as const, props: { ...boxProps, url: source } };
    return <RiveElementRenderer key={source} element={el} ctx={ctx} />;
  }
  // Image
  const el = { id: `${baseId}-reaction`, type: "Image" as const, props: { ...boxProps, url: source } };
  return <ImageElementComponent key={source} element={el} ctx={ctx} />;
};

export const SliderElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const { props } = element;

  const stored = props.variableName ? variables[props.variableName]?.value : undefined;
  const defaultValue = props.defaultValue ?? props.min;
  // The live numeric value derives from the variable when set, else the default.
  const value = stored !== undefined && stored !== "" ? Number(stored) : defaultValue;

  const [trackWidth, setTrackWidth] = useState(0);

  // Seed the variable with the default once, mirroring RadioGroup/WheelPicker.
  useEffect(() => {
    if (props.variableName && stored === undefined) {
      const seeded = snapValue(props, defaultValue);
      setVariable(props.variableName, { value: String(seeded), label: String(seeded) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.variableName, stored]);

  const knobSize = props.knobSize ?? 24;
  const trackHeight = props.trackHeight ?? 4;

  // Latest value/width via refs so the PanResponder (created once) reads fresh
  // data without being recreated on every drag.
  const valueRef = useRef(value);
  valueRef.current = value;
  const widthRef = useRef(trackWidth);
  widthRef.current = trackWidth;

  const commitFromX = (x: number) => {
    const w = widthRef.current;
    if (w <= 0) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    const raw = props.min + ratio * (props.max - props.min);
    const snapped = snapValue(props, raw);
    if (props.variableName && snapped !== valueRef.current) {
      setVariable(props.variableName, { value: String(snapped), label: String(snapped) });
    }
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => commitFromX(e.nativeEvent.locationX),
        onPanResponderMove: (e) => commitFromX(e.nativeEvent.locationX),
      }),
    // commitFromX closes over stable refs + props; recreate only if props identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.min, props.max, props.step, props.variableName]
  );

  const ratio = (value - props.min) / (props.max - props.min || 1);
  const filledWidth = Math.min(1, Math.max(0, ratio)) * trackWidth;

  const onTrackLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  const trackColor = props.trackColor ?? theme.colors.neutral.low;
  const trackFilledColor = props.trackFilledColor ?? theme.colors.primary;
  const knobColor = props.knobColor ?? theme.colors.primary;

  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
    height: dim(props.height),
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
    borderWidth: props.borderWidth,
    borderRadius: props.borderRadius,
    borderColor: props.borderColor,
    backgroundColor: props.backgroundGradient ? undefined : props.backgroundColor,
    opacity: props.opacity,
    overflow: props.overflow,
  } as const;

  return (
    <View style={containerStyle}>
      {props.reaction ? (
        <View style={{ alignItems: "center", marginBottom: 16 }}>
          <SliderReactionView reaction={props.reaction} value={value} ctx={ctx} baseId={element.id} />
        </View>
      ) : null}

      {props.showValue ? (
        <Text
          style={{
            textAlign: "center",
            marginBottom: 8,
            color: theme.colors.text.primary,
            fontSize: theme.typography.textStyles.heading2.fontSize,
            fontWeight: theme.typography.textStyles.heading2.fontWeight,
          }}
        >
          {String(value)}
          {props.valueSuffix ? ` ${props.valueSuffix}` : ""}
        </Text>
      ) : null}

      {/* Hit area is padded vertically so the thin track is easy to grab. */}
      <View
        onLayout={onTrackLayout}
        {...panResponder.panHandlers}
        style={{ justifyContent: "center", height: Math.max(knobSize, trackHeight) + 16 }}
      >
        <View style={{ height: trackHeight, borderRadius: trackHeight / 2, backgroundColor: trackColor }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: filledWidth,
              borderRadius: trackHeight / 2,
              backgroundColor: trackFilledColor,
            }}
          />
        </View>
        {trackWidth > 0 ? (
          <View
            style={{
              position: "absolute",
              left: Math.min(trackWidth - knobSize, Math.max(0, filledWidth - knobSize / 2)),
              width: knobSize,
              height: knobSize,
              borderRadius: knobSize / 2,
              backgroundColor: knobColor,
              shadowColor: "#000",
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 1 },
              elevation: 3,
            }}
          />
        ) : null}
      </View>

      {props.minLabel || props.maxLabel ? (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.textStyles.caption.fontSize }}>
            {props.minLabel ?? ""}
          </Text>
          <Text style={{ color: theme.colors.text.secondary, fontSize: theme.typography.textStyles.caption.fontSize }}>
            {props.maxLabel ?? ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
};

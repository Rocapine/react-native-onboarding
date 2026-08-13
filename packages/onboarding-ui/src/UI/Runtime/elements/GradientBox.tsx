import React from "react";
import { View, StyleSheet } from "react-native";
import type { ViewStyle } from "react-native";
import Svg, { Defs, Rect, RadialGradient, Stop } from "react-native-svg";
import type { GradientBackground } from "./BaseBoxProps";

let LinearGradient: React.ComponentType<{
  colors: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: number[];
  style?: object;
  children?: React.ReactNode;
}> | null = null;

try {
  LinearGradient = require("expo-linear-gradient").LinearGradient;
} catch {
  // expo-linear-gradient not installed
}

const EDGE_POINT: Record<string, { x: number; y: number }> = {
  top:         { x: 0.5, y: 0 },
  bottom:      { x: 0.5, y: 1 },
  left:        { x: 0,   y: 0.5 },
  right:       { x: 1,   y: 0.5 },
  topLeft:     { x: 0,   y: 0 },
  topRight:    { x: 1,   y: 0 },
  bottomLeft:  { x: 0,   y: 1 },
  bottomRight: { x: 1,   y: 1 },
};

type Props = {
  gradient?: GradientBackground;
  style?: ViewStyle;
  children?: React.ReactNode;
};

export const GradientBox = ({ gradient, style, children }: Props): React.ReactElement => {
  // useId runs unconditionally (rules of hooks) — the radial branch below needs a
  // unique <RadialGradient id> per box so multiple gradients don't collide.
  const gradientId = React.useId();

  if (gradient?.type === "linear" && LinearGradient) {
    const colors = gradient.stops.map((s) => s.color) as [string, string, ...string[]];
    const allHavePositions = gradient.stops.every((s) => s.position !== undefined);
    const locations = allHavePositions ? (gradient.stops.map((s) => s.position!) as number[]) : undefined;
    return (
      <LinearGradient
        colors={colors}
        start={EDGE_POINT[gradient.from]}
        end={EDGE_POINT[gradient.to]}
        locations={locations}
        style={style}
      >
        {children}
      </LinearGradient>
    );
  }

  // Radial — react-native-svg (a required dep, always available). The SVG fills
  // the box behind in-flow children, so the box sizes to its content exactly like
  // the linear / plain-View paths. `objectBoundingBox` units map cx/cy/r to 0..1
  // fractions of the box (a non-square box yields an ellipse). Missing stop
  // positions are distributed evenly across 0..1.
  if (gradient?.type === "radial") {
    const c = gradient.center ?? { x: 0.5, y: 0.5 };
    const r = gradient.radius ?? 0.75;
    const n = gradient.stops.length;
    // useId() yields ":r0:"-style strings; strip non-word chars so the
    // `url(#…)` reference is a clean token.
    const svgId = `grad-${gradientId.replace(/[^a-zA-Z0-9]/g, "")}`;
    return (
      <View style={style}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
          <Defs>
            <RadialGradient id={svgId} cx={String(c.x)} cy={String(c.y)} r={String(r)} gradientUnits="objectBoundingBox">
              {gradient.stops.map((s, i) => (
                <Stop
                  key={i}
                  offset={String(s.position ?? (n > 1 ? i / (n - 1) : 0))}
                  stopColor={s.color}
                />
              ))}
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${svgId})`} />
        </Svg>
        {children}
      </View>
    );
  }

  return <View style={style}>{children}</View>;
};

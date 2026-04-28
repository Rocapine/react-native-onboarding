import React from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
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
  return <View style={style}>{children}</View>;
};

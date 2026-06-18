import React, { useCallback, useRef, useState } from "react";
import { z } from "zod";
import {
  View,
  Text,
  TouchableOpacity,
  PixelRatio,
  StyleSheet,
  LayoutChangeEvent,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

// Lazy-load Skia (optional peer dep). Both the live canvas and the SVG/PNG
// serialization depend on it, so the element is unusable without it — throw an
// explicit install error when a DrawingPad is actually rendered. (Mirrors the
// require/try-catch precedent in Pages/Commitment/Renderer.tsx.)
let SkiaModule: any;
try {
  SkiaModule = require("@shopify/react-native-skia");
} catch (e) {
  SkiaModule = null;
}

export type DrawingPadElementProps = BaseBoxProps & {
  variableName?: string;
  imageVariableName?: string;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  clearable?: boolean;
  imageFormat?: "png" | "jpeg";
};

export const DrawingPadElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  imageVariableName: z.string().min(1).optional(),
  strokeColor: z.string().optional(),
  strokeWidth: z.number().positive().optional(),
  backgroundColor: z.string().optional(),
  clearable: z.boolean().optional(),
  imageFormat: z.enum(["png", "jpeg"]).optional(),
});

type DrawingPadUIElement = Extract<UIElement, { type: "DrawingPad" }>;

type Props = {
  element: DrawingPadUIElement;
  ctx: RenderContext;
};

export const DrawingPadElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, setVariable } = ctx;
  const { props } = element;

  if (!SkiaModule) {
    throw new Error(
      "DrawingPad element requires @shopify/react-native-skia. Install it with: npm install @shopify/react-native-skia"
    );
  }
  const Skia = SkiaModule.Skia;

  const strokeColor = props.strokeColor ?? theme.colors.text.primary;
  const strokeWidth = props.strokeWidth ?? 2;
  const backgroundColor = props.backgroundColor ?? theme.colors.neutral.lowest;
  const clearable = props.clearable ?? true;
  const imageFormat = props.imageFormat ?? "png";

  const currentPath = useRef<any>(null);
  // pathsRef is the source of truth (read synchronously in gesture callbacks);
  // `paths` state only mirrors it to trigger re-renders of the live canvas.
  const pathsRef = useRef<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [hasDrawing, setHasDrawing] = useState(false);
  // Canvas size (dp), captured on layout — needed for the offscreen PNG export.
  const sizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Build a base64 image data URI by replaying the strokes onto an offscreen
  // Skia surface. Scaled by device pixel ratio for a crisp raster. Returns
  // undefined if the surface can't be created (e.g. size not yet measured).
  const renderImage = useCallback(
    (drawn: any[]): string | undefined => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return undefined;
      try {
        const pr = PixelRatio.get();
        const surface = Skia.Surface.MakeOffscreen(
          Math.round(width * pr),
          Math.round(height * pr)
        );
        if (!surface) return undefined;
        const canvas = surface.getCanvas();
        canvas.scale(pr, pr);

        const bgPaint = Skia.Paint();
        bgPaint.setColor(Skia.Color(backgroundColor));
        bgPaint.setStyle(SkiaModule.PaintStyle.Fill);
        canvas.drawRect(Skia.XYWHRect(0, 0, width, height), bgPaint);

        const paint = Skia.Paint();
        paint.setColor(Skia.Color(strokeColor));
        paint.setStyle(SkiaModule.PaintStyle.Stroke);
        paint.setStrokeWidth(strokeWidth);
        paint.setStrokeCap(SkiaModule.StrokeCap.Round);
        paint.setStrokeJoin(SkiaModule.StrokeJoin.Round);
        paint.setAntiAlias(true);
        drawn.forEach((p) => canvas.drawPath(p, paint));

        surface.flush();
        const image = surface.makeImageSnapshot();
        const fmt =
          imageFormat === "jpeg" ? SkiaModule.ImageFormat.JPEG : SkiaModule.ImageFormat.PNG;
        const b64 = image.encodeToBase64(fmt, 100);
        return `data:image/${imageFormat === "jpeg" ? "jpeg" : "png"};base64,${b64}`;
      } catch (e) {
        return undefined;
      }
    },
    [Skia, backgroundColor, strokeColor, strokeWidth, imageFormat]
  );

  // Serialize the drawing into the bound variable(s). Called on stroke end and
  // on clear — NOT per touch-move (avoids ~60×/s setVariable re-render storms;
  // see ProgressIndicatorElement). SVG path string → variableName; base64 image
  // data URI → imageVariableName.
  const commit = useCallback(
    (drawn: any[]) => {
      if (props.variableName) {
        const svg = drawn.map((p) => p.toSVGString()).join(" ");
        setVariable(props.variableName, {
          value: svg,
          label: drawn.length > 0 ? "Drawing captured" : "",
          kind: "string",
        });
      }
      if (props.imageVariableName) {
        const dataUri = drawn.length > 0 ? renderImage(drawn) ?? "" : "";
        setVariable(props.imageVariableName, { value: dataUri, kind: "string" });
      }
    },
    [props.variableName, props.imageVariableName, setVariable, renderImage]
  );

  // runOnJS(true): run gesture callbacks on the JS thread so we can touch React
  // state and the Skia.Path objects directly (no worklet bridging needed).
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .onBegin(({ x, y }: { x: number; y: number }) => {
      const path = Skia.Path.Make();
      path.moveTo(x, y);
      currentPath.current = path;
      pathsRef.current = [...pathsRef.current, path];
      setPaths(pathsRef.current);
      setHasDrawing(true);
    })
    .onUpdate(({ x, y }: { x: number; y: number }) => {
      if (currentPath.current) {
        currentPath.current.lineTo(x, y);
        // New array ref forces a re-render so the live canvas tracks the stroke.
        setPaths([...pathsRef.current]);
      }
    })
    .onEnd(() => {
      currentPath.current = null;
      commit(pathsRef.current);
    });

  const handleClear = () => {
    currentPath.current = null;
    pathsRef.current = [];
    setPaths([]);
    setHasDrawing(false);
    commit([]);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    sizeRef.current = { width, height };
  };

  // BaseBoxProps → container style (see composable-screen-runtime rule).
  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
    height: dim(props.height) ?? 200,
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    aspectRatio: props.aspectRatio,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    borderWidth: props.borderWidth ?? 2,
    borderRadius: props.borderRadius ?? 16,
    borderColor: props.borderColor ?? theme.colors.primary,
    backgroundColor,
    opacity: props.opacity,
    overflow: "hidden" as const,
    position: "relative" as const,
  };

  const Canvas = SkiaModule.Canvas;
  const SkPath = SkiaModule.Path;

  return (
    <View style={containerStyle} onLayout={onLayout}>
      <GestureHandlerRootView style={styles.fill}>
        {clearable && hasDrawing && (
          <TouchableOpacity
            style={[styles.clearButton, { backgroundColor: theme.colors.neutral.higher }]}
            onPress={handleClear}
            activeOpacity={0.8}
          >
            <Text style={[styles.clearButtonText, { color: theme.colors.text.opposite }]}>✕</Text>
          </TouchableOpacity>
        )}
        <GestureDetector gesture={panGesture}>
          <Canvas style={styles.fill}>
            {paths.map((path: any, index: number) => (
              <SkPath
                key={index}
                path={path}
                color={strokeColor}
                style="stroke"
                strokeWidth={strokeWidth}
                strokeCap="round"
                strokeJoin="round"
              />
            ))}
          </Canvas>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  clearButton: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 1,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: "400",
  },
});

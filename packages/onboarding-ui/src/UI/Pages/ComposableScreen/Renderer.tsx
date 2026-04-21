import React, { useState, useEffect, useContext, useMemo } from "react";
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, TextInput } from "react-native";
import { ComposableScreenStepType, ComposableScreenStepTypeSchema, UIElement } from "./types";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";
import { withErrorBoundary } from "../../ErrorBoundary";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { OnboardingProgressContext } from "../../Provider/OnboardingProgressProvider";

let LottieView: React.ComponentType<{
  source: string | object;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
  style?: object;
}> | null = null;
try {
  LottieView = require("lottie-react-native").default;
} catch {
  // lottie-react-native not installed
}

// Metro cannot tree-shake optional peer deps at runtime; the try/catch pattern
// below is the standard React Native approach for optional native modules.
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
    return (
      <VideoView
        player={player}
        style={style}
        allowsFullscreen={false}
        nativeControls={element.props.controls ?? false}
      />
    );
  };
} catch {
  // expo-video not installed
}

type InputUIElement = Extract<UIElement, { type: "Input" }>;
const InputElementComponent = ({ element, theme, variables, onVariableChange }: { element: InputUIElement; theme: Theme; variables: Record<string, string>; onVariableChange: (key: string, value: string) => void }) => {
  const persistedValue = element.props.variableName ? variables[element.props.variableName] : undefined;
  const [value, setValue] = useState(persistedValue ?? element.props.defaultValue ?? "");

  useEffect(() => {
    if (element.props.variableName && element.props.defaultValue && persistedValue === undefined) {
      onVariableChange(element.props.variableName, element.props.defaultValue);
    }
  }, []);

  const handleChange = (text: string) => {
    setValue(text);
    if (element.props.variableName) {
      onVariableChange(element.props.variableName, text);
    }
  };

  return (
    <View
      style={{
        backgroundColor: element.props.backgroundColor ?? theme.colors.neutral.lowest,
        borderWidth: element.props.borderWidth ?? 1,
        borderRadius: element.props.borderRadius ?? 8,
        borderColor: element.props.borderColor ?? theme.colors.neutral.low,
        width: element.props.width,
        height: element.props.height,
        opacity: element.props.opacity,
        margin: element.props.margin,
        marginHorizontal: element.props.marginHorizontal,
        marginVertical: element.props.marginVertical,
        overflow: "hidden",
      }}
    >
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder={element.props.placeholder}
        placeholderTextColor={element.props.placeholderColor ?? theme.colors.text.tertiary}
        keyboardType={element.props.keyboardType ?? "default"}
        returnKeyType={element.props.returnKeyType ?? "done"}
        autoCapitalize={element.props.autoCapitalize ?? "sentences"}
        secureTextEntry={element.props.secureTextEntry ?? false}
        maxLength={element.props.maxLength}
        multiline={element.props.multiline ?? false}
        numberOfLines={element.props.numberOfLines}
        editable={element.props.editable ?? true}
        style={{
          flex: 1,
          color: element.props.color ?? theme.colors.text.primary,
          fontSize: element.props.fontSize ?? theme.typography.textStyles.body.fontSize,
          fontWeight: element.props.fontWeight as any,
          textAlign: element.props.textAlign,
          padding: element.props.padding ?? 12,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
        }}
      />
    </View>
  );
};

type RiveUIElement = Extract<UIElement, { type: "Rive" }>;
let RiveElementComponent: React.ComponentType<{ element: RiveUIElement; riveStyle: object }> | null = null;
try {
  const riveModule = require("rive-react-native");
  const Rive = riveModule.default;
  const { Fit, Alignment } = riveModule;
  RiveElementComponent = ({ element, riveStyle }: { element: RiveUIElement; riveStyle: object }) => {
    return (
      <Rive
        url={element.props.url}
        autoplay={element.props.autoplay ?? true}
        fit={element.props.fit ? Fit[element.props.fit] : Fit.Contain}
        alignment={element.props.alignment ? Alignment[element.props.alignment] : Alignment.Center}
        artboardName={element.props.artboardName}
        stateMachineName={element.props.stateMachineName}
        style={riveStyle}
        onError={console.error}
      />
    );
  };
} catch {
  // rive-react-native not installed - will show fallback if Rive is used
}

const interpolate = (template: string, variables: Record<string, string>): string =>
  template.replace(/\{\{([^}]+?)\}\}/g, (_, key) => variables[key] ?? "");

type ContentProps = {
  step: ComposableScreenStepType;
  onContinue: () => void;
  theme?: Theme;
};

const renderElement = (element: UIElement, theme: Theme, variables: Record<string, string>, setVariable: (key: string, value: string) => void, parentType?: "XStack" | "YStack"): React.ReactNode => {
  if (element.type === "YStack" || element.type === "XStack") {
    return (
      <View
        key={element.id}
        style={{
          flexDirection: element.type === "XStack" ? "row" : "column",
          gap: element.props.gap,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          flex: element.props.flex,
          width: element.props.width,
          height: element.props.height,
          minWidth: element.props.minWidth,
          maxWidth: element.props.maxWidth,
          minHeight: element.props.minHeight,
          maxHeight: element.props.maxHeight,
          flexShrink: element.props.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          flexWrap: element.props.flexWrap,
          alignItems: element.props.alignItems,
          justifyContent: element.props.justifyContent,
          backgroundColor: element.props.backgroundColor,
          borderWidth: element.props.borderWidth,
          borderRadius: element.props.borderRadius,
          borderColor: element.props.borderColor,
          overflow: element.props.overflow,
          opacity: element.props.opacity,
        }}
      >
        {element.children.map((child) => renderElement(child, theme, variables, setVariable, element.type))}
      </View>
    );
  }

  if (element.type === "Text") {
    const content = element.props.mode === "expression"
      ? interpolate(element.props.content, variables)
      : element.props.content;
    return (
      <Text
        key={element.id}
        style={{
          fontSize: element.props.fontSize,
          fontWeight: element.props.fontWeight as any,
          color: element.props.color ?? theme.colors.text.primary,
          textAlign: element.props.textAlign,
          letterSpacing: element.props.letterSpacing,
          lineHeight: element.props.lineHeight,
          backgroundColor: element.props.backgroundColor,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          borderWidth: element.props.borderWidth,
          borderRadius: element.props.borderRadius,
          borderColor: element.props.borderColor,
          opacity: element.props.opacity,
          flexShrink: parentType === "XStack" ? 1 : undefined,
        }}
      >
        {content}
      </Text>
    );
  }

  if (element.type === "Image") {
    const hasExplicitHeight = element.props.height !== undefined;
    const aspectRatio = hasExplicitHeight
      ? undefined
      : (element.props.aspectRatio ?? 16 / 9);
    return (
      <Image
        key={element.id}
        source={{ uri: element.props.url }}
        resizeMode={element.props.resizeMode ?? "cover"}
        style={{
          width: element.props.width ?? "100%",
          height: element.props.height,
          aspectRatio,
          borderRadius: element.props.borderRadius,
          borderWidth: element.props.borderWidth,
          borderColor: element.props.borderColor,
          opacity: element.props.opacity,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
        }}
      />
    );
  }

  if (element.type === "Lottie") {
    const wrapperStyle = {
      width: element.props.width ?? ("100%" as `${number}%`),
      height: element.props.height ?? 200,
      opacity: element.props.opacity,
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

    if (!LottieView) {
      return (
        <View key={element.id} style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
            Install lottie-react-native to render Lottie animations.
          </Text>
        </View>
      );
    }

    return (
      <View key={element.id} style={wrapperStyle}>
        <LottieView
          source={{ uri: element.props.source }}
          autoPlay={element.props.autoPlay ?? true}
          loop={element.props.loop ?? true}
          speed={element.props.speed}
          style={styles.fill}
        />
      </View>
    );
  }

  if (element.type === "Rive") {
    const wrapperStyle = {
      width: element.props.width ?? ("100%" as `${number}%`),
      height: element.props.height ?? 200,
      opacity: element.props.opacity,
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

    if (!RiveElementComponent) {
      return (
        <View key={element.id} style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
            Install rive-react-native to render Rive animations.
          </Text>
        </View>
      );
    }

    return (
      <View key={element.id} style={wrapperStyle}>
        <RiveElementComponent element={element} riveStyle={styles.fill} />
      </View>
    );
  }

  if (element.type === "Icon") {
    const icons = require("lucide-react-native");
    const IconComp = icons[element.props.name] as React.ComponentType<{
      size?: number;
      color?: string;
      strokeWidth?: number;
    }> | undefined;
    return (
      <View
        key={element.id}
        style={{
          width: element.props.width,
          height: element.props.height,
          margin: element.props.margin,
          marginHorizontal: element.props.marginHorizontal,
          marginVertical: element.props.marginVertical,
          padding: element.props.padding,
          paddingHorizontal: element.props.paddingHorizontal,
          paddingVertical: element.props.paddingVertical,
          borderWidth: element.props.borderWidth,
          borderRadius: element.props.borderRadius,
          borderColor: element.props.borderColor,
          opacity: element.props.opacity,
        }}
      >
        {IconComp ? (
          <IconComp
            size={element.props.size ?? 24}
            color={element.props.color ?? theme.colors.text.primary}
            strokeWidth={element.props.strokeWidth ?? 2}
          />
        ) : null}
      </View>
    );
  }

  if (element.type === "Video") {
    const wrapperStyle = {
      width: element.props.width ?? ("100%" as `${number}%`),
      height: element.props.height ?? 200,
      opacity: element.props.opacity,
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
        <View key={element.id} style={[wrapperStyle, styles.mediaFallback, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[styles.mediaFallbackText, getTextStyle(theme, "caption"), { color: theme.colors.text.tertiary }]}>
            Install expo-video to render videos.
          </Text>
        </View>
      );
    }

    return (
      <View key={element.id} style={wrapperStyle}>
        <VideoElementComponent element={element} style={styles.fill} />
      </View>
    );
  }

  if (element.type === "Input") {
    return <InputElementComponent key={element.id} element={element} theme={theme} variables={variables} onVariableChange={setVariable} />;
  }

  return null;
};

const ComposableScreenRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = useMemo(() => ComposableScreenStepTypeSchema.parse(step), [step]);
  const { elements } = validatedData.payload;
  const { composableVariables, setComposableVariable } = useContext(OnboardingProgressContext);
  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue}
      theme={theme}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
        keyboardShouldPersistTaps="handled"
      >
        {elements.map((element) => renderElement(element, theme, composableVariables, setComposableVariable))}
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: theme.colors.primary }]}
            onPress={onContinue}
            activeOpacity={0.8}
          >
            <Text
              style={[
                getTextStyle(theme, "button"),
                { color: theme.colors.text.opposite },
              ]}
            >
              {validatedData.continueButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </OnboardingTemplate>
  )
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  fill: {
    width: "100%",
    height: "100%",
  },
  scrollContent: {
    flexGrow: 1,
  },
  bottomSection: {
    paddingHorizontal: 32,
    alignItems: "center",
  },
  ctaButton: {
    borderRadius: 90,
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 234,
    alignItems: "center",
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

export const ComposableScreenRenderer = withErrorBoundary(ComposableScreenRendererBase, "ComposableScreen");

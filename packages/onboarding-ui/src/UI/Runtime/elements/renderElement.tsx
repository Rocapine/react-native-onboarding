import React from "react";
import { Pressable } from "react-native";
import { runOnJS, useAnimatedReaction, useSharedValue, type SharedValue } from "react-native-reanimated";
import { evaluateCondition } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { BaseBoxProps } from "./BaseBoxProps";
import { RenderContext, areElementPropsEqual } from "./shared";
import { useVariables } from "./VariablesContext";
import { useAnimatedVariables } from "./AnimatedVariablesContext";
import { buildAnimatedGatePlan, evalAnimatedNode } from "./animatedGate";
import { runActions } from "./runActions";
import { StackElementComponent } from "./StackElement";
import { PlainTextElementComponent, ExpressionTextElementComponent } from "./TextElement";
import { RichTextElementComponent } from "./RichTextElement";
import { ImageElementComponent } from "./ImageElement";
import { ProgressiveBlurImageElementComponent } from "./ProgressiveBlurImageElement";
import { LottieElementComponent } from "./LottieElement";
import { RiveElementRenderer } from "./RiveElement";
import { IconElementComponent } from "./IconElement";
import { VideoElementRenderer } from "./VideoElement";
import { InputElementComponent } from "./InputElement";
import { RadioGroupComponent } from "./RadioGroupElement";
import { CheckboxGroupComponent } from "./CheckboxGroupElement";
import { ButtonElementComponent } from "./ButtonElement";
import { DatePickerElementComponent } from "./DatePickerElement";
import { WheelPickerElementComponent } from "./WheelPickerElement";
import { CarouselElementComponent } from "./CarouselElement";
import { ZStackElementComponent } from "./ZStackElement";
import { SafeAreaViewElementComponent } from "./SafeAreaViewElement";
import { ScrollViewElementComponent } from "./ScrollViewElement";
import { KeyboardAvoidingViewElementComponent } from "./KeyboardAvoidingViewElement";
import { ProgressIndicatorElementComponent } from "./ProgressIndicatorElement";
import { AnimatedTextElementComponent } from "./AnimatedTextElement";
import { TypewriterTextElementComponent } from "./TypewriterTextElement";
import { DrawingPadElementComponent } from "./DrawingPadElement";
import { SliderElementComponent } from "./SliderElement";
import { AnimatedBox } from "./AnimatedBox";

type ParentType = "XStack" | "YStack" | "ZStack" | "RichText" | "XScroll";

// Element types that own their own press / focus / scroll handling. The generic
// `onPress` (BaseBoxProps) is NOT wired for these — Button/RadioGroup/Checkbox/
// DatePicker already dispatch actions or selections; Input/WheelPicker would have
// their focus / scroll-selection intercepted by an outer Pressable.
const PRESS_HANDLED_TYPES = new Set<UIElement["type"]>([
  "Button",
  "RadioGroup",
  "CheckboxGroup",
  "DatePicker",
  "Input",
  "WheelPicker",
  "DrawingPad",
  "Slider",
]);

// Pure builder: dispatch element type → concrete renderer, then apply the generic
// onPress (Pressable) and motion (AnimatedBox) wrappers. Reads NO variables — the
// renderWhen gate lives in `GatedElement`. Wrapped by the memoized `ElementHost` /
// `GatedElement` below, so it only re-runs when its host re-renders (theme or
// structure change), NOT on every variable write.
const renderConcrete = (
  element: UIElement,
  ctx: RenderContext,
  parentType?: ParentType
): React.ReactNode => {
  // Dispatch to the concrete element renderer. Captured into `node` so a single
  // AnimatedBox wrapper can apply animation/transform to any of the types.
  const node = ((): React.ReactNode => {
  if (element.type === "YStack" || element.type === "XStack") {
    return <StackElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "Text") {
    // Plain Text never reads variables → fully static (memo-skips on writes).
    // Expression Text interpolates `{{var}}` → subscribes via useVariables.
    const TextComp = element.props.mode === "expression"
      ? ExpressionTextElementComponent
      : PlainTextElementComponent;
    return <TextComp key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "RichText") {
    return <RichTextElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "Image") {
    return <ImageElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ProgressiveBlurImage") {
    return <ProgressiveBlurImageElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Lottie") {
    return <LottieElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Rive") {
    return <RiveElementRenderer key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Icon") {
    return <IconElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Video") {
    return <VideoElementRenderer key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Input") {
    return <InputElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "RadioGroup") {
    return <RadioGroupComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "CheckboxGroup") {
    return <CheckboxGroupComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Button") {
    return <ButtonElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "DatePicker") {
    return <DatePickerElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "WheelPicker") {
    return <WheelPickerElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Carousel") {
    return <CarouselElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ZStack") {
    return <ZStackElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "SafeAreaView") {
    return <SafeAreaViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ScrollView") {
    return <ScrollViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "KeyboardAvoidingView") {
    return <KeyboardAvoidingViewElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "ProgressIndicator") {
    return <ProgressIndicatorElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "AnimatedText") {
    return <AnimatedTextElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "TypewriterText") {
    return <TypewriterTextElementComponent key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }

  if (element.type === "DrawingPad") {
    return <DrawingPadElementComponent key={element.id} element={element} ctx={ctx} />;
  }

  if (element.type === "Slider") {
    return <SliderElementComponent key={element.id} element={element} ctx={ctx} />;
  }

    return null;
  })();

  // Cast to BaseBoxProps: not every element's props type extends it (e.g.
  // WheelPicker), but the onPress/animation/transform/flex/alignSelf fields are
  // all optional BaseBoxProps members and simply read as undefined when absent.
  const p = element.props as BaseBoxProps;

  // Generic onPress: make any non-pressable element tappable, dispatching the
  // same action list as Button via runActions. Skipped for PRESS_HANDLED_TYPES.
  // A Pressable around a scroll/carousel keeps inner scrolling working — RN's
  // gesture responder gives the scroll the touch when it pans.
  let content: React.ReactNode = node;
  if (
    content !== null &&
    p.onPress &&
    p.onPress.length > 0 &&
    !PRESS_HANDLED_TYPES.has(element.type)
  ) {
    const onPress = p.onPress;
    // The Pressable must be layout-transparent (like AnimatedBox): forward the
    // element's flex sizing so the wrapper participates in its parent's flex
    // context exactly as the element would. Without this, the style-less
    // Pressable sizes to content while the element's `flex`/`flexShrink` sit on
    // the inner node — breaking row splits (cards overflow) and column flow.
    // Mirror StackElement's `parentType === "XStack"` flexShrink:1 default.
    content = (
      <Pressable
        key={element.id}
        onPress={() => {
          void runActions(onPress, ctx);
        }}
        style={{
          flex: p.flex,
          flexGrow: p.flexGrow,
          flexShrink: p.flexShrink ?? (parentType === "XStack" ? 1 : undefined),
          alignSelf: p.alignSelf,
        }}
      >
        {content}
      </Pressable>
    );
  }

  // Wrap only when motion is requested — zero overhead (no extra view) otherwise.
  // Cast to BaseBoxProps: not every element's props type extends it (e.g.
  // WheelPicker), but the animation/transform/flex/alignSelf fields are all
  // optional BaseBoxProps members and simply read as undefined when absent.
  if (content !== null && (p.animation || p.transform)) {
    return (
      <AnimatedBox
        key={element.id}
        animation={p.animation}
        transform={p.transform}
        flex={p.flex}
        alignSelf={p.alignSelf}
      >
        {content}
      </AnimatedBox>
    );
  }

  return content;
};

type HostProps = {
  element: UIElement;
  ctx: RenderContext;
  parentType?: ParentType;
};

// Memoized wrapper for every non-gated element. This is what stops the
// whole-tree re-render storm: when the Renderer (or a re-rendering ancestor)
// re-runs on a variable write, `ElementHost` skips because element / ctx /
// parentType are referentially equal, so `renderConcrete` — and the entire
// subtree it produces, including the onPress / motion wrappers — is preserved.
// Components that genuinely depend on variables subscribe via `useVariables()`
// and re-render independently (context propagation bypasses React.memo).
const ElementHost = React.memo(
  ({ element, ctx, parentType }: HostProps) => <>{renderConcrete(element, ctx, parentType)}</>,
  areElementPropsEqual
);
ElementHost.displayName = "ElementHost";

// Gate for `renderWhen` elements. A SINGLE component (not a store-vs-animated
// component-type swap), so the gated subtree keeps a stable identity: when a gate
// switches onto the UI-thread path as its producer registers, `renderConcrete`'s
// output is NOT remounted — no replayed entrance animation, no reset transient
// state. It subscribes to the store so its condition re-evaluates on writes, and
// resolves any animated SharedValue for its variable.
//
// If that variable is being animated on this screen, visibility is driven from the
// live value on the UI thread via `useAnimatedReaction` (flipping local state only
// as thresholds are crossed) — the store is never written, so the boundary-only
// write (and its perf win) is preserved. Otherwise it evaluates against the store,
// exactly like the original gate. The animated seed comes from the same store
// evaluation, and the ProgressIndicator seeds the store with the value the sweep
// starts from, so the seed matches the first animated frame — no flicker when the
// gate switches paths.
const GatedElement = React.memo(
  ({ element, ctx, parentType }: HostProps) => {
    const { flatVariables } = useVariables();
    const plan = React.useMemo(() => buildAnimatedGatePlan(element.renderWhen), [element]);
    const registry = useAnimatedVariables();

    // The producer's SharedValue for this variable, if one animates it here.
    // Seeded synchronously (producer earlier in tree order) and updated via the
    // registry listener (producer that registers later) — both orderings resolve.
    const [animatedSv, setAnimatedSv] = React.useState<SharedValue<number> | undefined>(() =>
      plan ? registry.get(plan.variable) : undefined
    );
    React.useEffect(() => {
      if (!plan) return;
      setAnimatedSv(registry.get(plan.variable));
      return registry.subscribe(plan.variable, () => setAnimatedSv(registry.get(plan.variable)));
    }, [plan, registry]);

    const node = plan?.node;
    const isAnimated = !!node && !!animatedSv;
    // Stable placeholder so the reaction hook is unconditional before a producer
    // resolves; the worklet returns a constant while not animated, so it never
    // churns state on the placeholder.
    const fallbackSv = useSharedValue(0);
    const sv = animatedSv ?? fallbackSv;

    // Local visibility for the animated path, seeded from the store evaluation (see
    // the flicker note above) and updated by the reaction as thresholds are crossed.
    const [animatedShown, setAnimatedShown] = React.useState(() =>
      element.renderWhen ? evaluateCondition(element.renderWhen, flatVariables) : true
    );
    useAnimatedReaction(
      () => (isAnimated && node ? evalAnimatedNode(node, sv.value) : true),
      (result, previous) => {
        if (isAnimated && result !== previous) runOnJS(setAnimatedShown)(result);
      },
      [node, sv, isAnimated]
    );

    const visible = isAnimated
      ? animatedShown
      : !element.renderWhen || evaluateCondition(element.renderWhen, flatVariables);

    return visible ? <>{renderConcrete(element, ctx, parentType)}</> : null;
  },
  areElementPropsEqual
);
GatedElement.displayName = "GatedElement";

export const renderElement = (
  element: UIElement,
  ctx: RenderContext,
  parentType?: ParentType
): React.ReactNode => {
  if (element.renderWhen) {
    return <GatedElement key={element.id} element={element} ctx={ctx} parentType={parentType} />;
  }
  return <ElementHost key={element.id} element={element} ctx={ctx} parentType={parentType} />;
};

import React, { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { Animated, Linking, Pressable, Text } from "react-native";
import {
  useResolvedFontStyle,
  evaluateCondition,
  type LeafCondition,
  type ConditionGroup,
  type ComposableVariableKind,
  LeafConditionSchema,
  ConditionGroupSchema,
} from "@rocapine/react-native-onboarding";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, buildShadowStyle, dim, interpolate, resolveInheritedFontFamily } from "./shared";
import { GradientBox } from "./GradientBox";
import { ComposableVariableEntry } from "../../../Provider/OnboardingProgressProvider";
import { evaluateSetVariableExpression } from "./expression";
import { triggerHaptic, type HapticStyle } from "./haptics";

/**
 * Optional result a custom action handler may return to write variables back
 * into the live ComposableScreen variable bag and/or stop the action queue.
 * Returning `void` (the common case) writes nothing and continues the queue —
 * so existing handlers are unaffected. Defined locally here because the UI
 * package depends on the PUBLISHED headless package, which does not yet export
 * this type (mirrors the repo's inline-schema-duplication convention); it
 * becomes the headless export's mirror once that version ships.
 */
export type ActionResult = {
  variables?: Record<string, ComposableVariableEntry>;
  abort?: boolean;
};

export type CustomButtonAction = {
  type: "custom";
  function: string;
  variables?: string[];
};

export const CustomButtonActionSchema = z.object({
  type: z.literal("custom"),
  function: z.string().min(1, "function must not be empty"),
  variables: z.array(z.string()).optional(),
});

export type SetVariableButtonAction = {
  type: "setVariable";
  name: string;
  value: string;
  label?: string;
  /**
   * When `"expression"`, `value` is parsed as an arithmetic expression with
   * `{{var}}` references, numeric literals, and `+ - * /` (parens supported).
   * On parse failure, falls back to plain interpolation (string).
   * Defaults to `"literal"` — `value` stored verbatim.
   */
  valueMode?: "literal" | "expression";
  /**
   * Tags the stored variable's underlying type. In `"literal"` mode this is
   * used as-is. In `"expression"` mode the inferred result kind is used
   * unless `kind` is explicitly set (ignored — expression mode derives kind
   * from evaluation).
   */
  kind?: ComposableVariableKind;
};

export const SetVariableButtonActionSchema = z.object({
  type: z.literal("setVariable"),
  name: z.string().min(1, "name must not be empty"),
  value: z.string(),
  label: z.string().optional(),
  valueMode: z.enum(["literal", "expression"]).optional(),
  kind: z.enum(["int", "float", "string"]).optional(),
});

/**
 * Declares a variable a capability action promises to write into the variable
 * bag once its host handler resolves. Inline-duplicated from the headless
 * package (which depends on the PUBLISHED build that does not yet export it);
 * becomes the headless mirror once that version ships.
 */
export type ActionVariableDecl = {
  name: string;
  kind?: ComposableVariableKind;
  label?: string;
};

export const ActionVariableDeclSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(["int", "float", "string"]).optional(),
  label: z.string().optional(),
});

// ── First-class capability / navigation actions (inline-duplicated) ─────────

export type NavigateButtonAction = {
  type: "navigate";
  stepId: string;
};

export const NavigateButtonActionSchema = z.object({
  type: z.literal("navigate"),
  stepId: z.string().min(1),
});

export type RequestNotificationPermissionButtonAction = {
  type: "requestNotificationPermission";
  writes?: ActionVariableDecl[];
};

export const RequestNotificationPermissionButtonActionSchema = z.object({
  type: z.literal("requestNotificationPermission"),
  writes: z.array(ActionVariableDeclSchema).optional(),
});

export type RequestHealthSyncButtonAction = {
  type: "requestHealthSync";
  metrics?: string[];
  writes?: ActionVariableDecl[];
};

export const RequestHealthSyncButtonActionSchema = z.object({
  type: z.literal("requestHealthSync"),
  metrics: z.array(z.string()).optional(),
  writes: z.array(ActionVariableDeclSchema).optional(),
});

export type PresentPaywallButtonAction = {
  type: "presentPaywall";
  placement?: string;
  writes?: ActionVariableDecl[];
};

export const PresentPaywallButtonActionSchema = z.object({
  type: z.literal("presentPaywall"),
  placement: z.string().optional(),
  writes: z.array(ActionVariableDeclSchema).optional(),
});

export type RestorePurchaseButtonAction = {
  type: "restorePurchase";
  writes?: ActionVariableDecl[];
};

export const RestorePurchaseButtonActionSchema = z.object({
  type: z.literal("restorePurchase"),
  writes: z.array(ActionVariableDeclSchema).optional(),
});

export type OpenURLButtonAction = {
  type: "openURL";
  url: string;
  external?: boolean;
};

export const OpenURLButtonActionSchema = z.object({
  type: z.literal("openURL"),
  url: z.string().min(1),
  external: z.boolean().optional(),
});

export type RequestReviewButtonAction = {
  type: "requestReview";
  writes?: ActionVariableDecl[];
};

export const RequestReviewButtonActionSchema = z.object({
  type: z.literal("requestReview"),
  writes: z.array(ActionVariableDeclSchema).optional(),
});

export type ButtonAction =
  | "continue"
  | CustomButtonAction
  | SetVariableButtonAction
  | NavigateButtonAction
  | RequestNotificationPermissionButtonAction
  | RequestHealthSyncButtonAction
  | PresentPaywallButtonAction
  | RestorePurchaseButtonAction
  | OpenURLButtonAction
  | RequestReviewButtonAction;

export const ButtonActionSchema = z.union([
  z.literal("continue"),
  z.discriminatedUnion("type", [
    CustomButtonActionSchema,
    SetVariableButtonActionSchema,
    NavigateButtonActionSchema,
    RequestNotificationPermissionButtonActionSchema,
    RequestHealthSyncButtonActionSchema,
    PresentPaywallButtonActionSchema,
    RestorePurchaseButtonActionSchema,
    OpenURLButtonActionSchema,
    RequestReviewButtonActionSchema,
  ]),
]);

/**
 * Context every capability handler receives. Inline-duplicated from the headless
 * `ActionHandlerCtx`; the published headless build does not yet export it.
 */
export type ActionHandlerCtx = {
  variables: Record<string, ComposableVariableEntry | undefined>;
  writes?: ActionVariableDecl[];
};

/**
 * Typed registry of host handlers for the first-class capability actions.
 * Inline-duplicated from the headless `ActionHandlers` (published build does
 * not export it yet). Threaded onto the RenderContext alongside `customActions`.
 */
export type ActionHandlers = {
  requestNotificationPermission?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
  requestHealthSync?: (
    ctx: ActionHandlerCtx & { metrics?: string[] }
  ) => void | ActionResult | Promise<void | ActionResult>;
  presentPaywall?: (
    ctx: ActionHandlerCtx & { placement?: string }
  ) => void | ActionResult | Promise<void | ActionResult>;
  restorePurchase?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
  openURL?: (
    ctx: ActionHandlerCtx & { url: string; external?: boolean }
  ) => void | ActionResult | Promise<void | ActionResult>;
  requestReview?: (
    ctx: ActionHandlerCtx
  ) => void | ActionResult | Promise<void | ActionResult>;
};

type ButtonOverridableProps = BaseBoxProps & {
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
};

export type ButtonStyleOverride = Partial<ButtonOverridableProps>;

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  actions?: ButtonAction[];
  /** @deprecated Use `actions` instead. */
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string | "inherit";
  fontStyle?: "normal" | "italic";
  textAlign?: "left" | "center" | "right";
  disabledWhen?: LeafCondition | ConditionGroup;
  /** @deprecated Use `disabledStyle.backgroundColor`. */
  disabledBackgroundColor?: string;
  /** @deprecated Use `disabledStyle.color`. */
  disabledColor?: string;
  pressedStyle?: ButtonStyleOverride;
  disabledStyle?: ButtonStyleOverride;
  transitionDurationMs?: number;
  haptic?: HapticStyle;
};

export const ButtonStyleOverrideSchema = BaseBoxPropsSchema.extend({
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
}).partial();

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string().min(1, "label must not be empty"),
  actions: z.array(ButtonActionSchema).optional(),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  disabledWhen: z.union([LeafConditionSchema, ConditionGroupSchema]).optional(),
  disabledBackgroundColor: z.string().optional(),
  disabledColor: z.string().optional(),
  pressedStyle: ButtonStyleOverrideSchema.optional(),
  disabledStyle: ButtonStyleOverrideSchema.optional(),
  transitionDurationMs: z.number().min(0).optional(),
  haptic: z.enum(["none", "light", "medium", "heavy", "soft", "rigid"]).optional(),
});

type ButtonUIElement = Extract<UIElement, { type: "Button" }>;

type Props = {
  element: ButtonUIElement;
  ctx: RenderContext;
};

export const ButtonElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, onContinue, customActions, actionHandlers, goToStep, variables, setVariable } = ctx;
  const flatVariables = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(variables).map(([k, v]) => [k, v?.value])
      ),
    [variables]
  );
  const isDisabled = element.props.disabledWhen
    ? evaluateCondition(element.props.disabledWhen, flatVariables)
    : false;
  const [isPressed, setIsPressed] = useState(false);

  const handlePress = async () => {
    if (isDisabled) return;
    triggerHaptic(element.props.haptic);
    const { actions, action } = element.props;
    const effective: ButtonAction[] =
      actions ?? (action === "continue" ? ["continue"] : []);

    // Build the slice of variables the action declared it cares about. When a
    // capability action declares `writes`, the handler receives the current
    // values of those names so it can read-modify-write; otherwise it gets the
    // full bag (capability handlers rarely need a filter).
    const sliceFor = (
      writes?: ActionVariableDecl[]
    ): Record<string, ComposableVariableEntry | undefined> => {
      if (!writes || writes.length === 0) return { ...variables };
      const out: Record<string, ComposableVariableEntry | undefined> = {};
      for (const w of writes) out[w.name] = variables[w.name];
      return out;
    };
    // Merge a handler's returned variables into the bag. Returns `true` when the
    // action requested an abort (caller should stop the remaining actions).
    const mergeResult = (result: ActionResult | void): boolean => {
      if (result?.variables) {
        for (const [name, entry] of Object.entries(result.variables)) {
          setVariable(name, entry);
        }
      }
      return !!result?.abort;
    };
    // Run a capability handler with shared error handling. Returns "abort" when
    // the queue should stop (handler aborted or threw), "done" otherwise.
    const runCapability = async (
      label: string,
      handler:
        | ((ctx: any) => void | ActionResult | Promise<void | ActionResult>)
        | undefined,
      handlerArgs: any
    ): Promise<"abort" | "done"> => {
      if (!handler) {
        console.warn(`[ComposableScreen] No actionHandlers.${label} registered`);
        return "done";
      }
      try {
        const result = (await handler(handlerArgs)) as ActionResult | void;
        return mergeResult(result) ? "abort" : "done";
      } catch (err) {
        console.error(`[ComposableScreen] actionHandlers.${label} threw:`, err);
        return "abort";
      }
    };

    for (const act of effective) {
      if (act === "continue") {
        onContinue();
        return;
      }
      switch (act.type) {
        case "setVariable": {
          let value: string;
          let kind: ComposableVariableKind | undefined;
          if (act.valueMode === "expression") {
            const computed = evaluateSetVariableExpression(act.value, variables);
            value = computed.value;
            kind = computed.kind;
          } else {
            value = act.value;
            kind = act.kind;
          }
          setVariable(act.name, { value, label: act.label, kind });
          continue;
        }
        case "navigate": {
          // SDK-internal: resolve the target step and update the progress
          // context. Terminal like "continue" — the host's router (driven off
          // the progress context / its own logic) owns the actual screen change.
          goToStep(act.stepId);
          return;
        }
        case "openURL": {
          const url = interpolate(act.url, variables);
          // Prefer a host handler; otherwise fall back to RN core Linking.
          if (actionHandlers.openURL) {
            const r = await runCapability("openURL", actionHandlers.openURL, {
              url,
              external: act.external,
              variables: sliceFor(undefined),
            });
            if (r === "abort") return;
          } else {
            try {
              await Linking.openURL(url);
            } catch (err) {
              console.error(`[ComposableScreen] openURL("${url}") failed:`, err);
              return;
            }
          }
          continue;
        }
        case "requestNotificationPermission": {
          const r = await runCapability(
            "requestNotificationPermission",
            actionHandlers.requestNotificationPermission,
            { variables: sliceFor(act.writes), writes: act.writes }
          );
          if (r === "abort") return;
          continue;
        }
        case "requestHealthSync": {
          const r = await runCapability(
            "requestHealthSync",
            actionHandlers.requestHealthSync,
            { variables: sliceFor(act.writes), writes: act.writes, metrics: act.metrics }
          );
          if (r === "abort") return;
          continue;
        }
        case "presentPaywall": {
          const r = await runCapability(
            "presentPaywall",
            actionHandlers.presentPaywall,
            { variables: sliceFor(act.writes), writes: act.writes, placement: act.placement }
          );
          if (r === "abort") return;
          continue;
        }
        case "restorePurchase": {
          const r = await runCapability(
            "restorePurchase",
            actionHandlers.restorePurchase,
            { variables: sliceFor(act.writes), writes: act.writes }
          );
          if (r === "abort") return;
          continue;
        }
        case "requestReview": {
          const r = await runCapability(
            "requestReview",
            actionHandlers.requestReview,
            { variables: sliceFor(act.writes), writes: act.writes }
          );
          if (r === "abort") return;
          continue;
        }
        case "custom": {
          const handler = customActions[act.function];
          if (!handler) {
            console.warn(
              `[ComposableScreen] No customAction registered for "${act.function}"`
            );
            continue;
          }
          const requested = act.variables ?? [];
          const vars: Record<string, ComposableVariableEntry | undefined> = {};
          for (const name of requested) vars[name] = variables[name];
          try {
            // The published headless `CustomActionHandler` is typed `() => void`;
            // the next SDK release widens it to `void | ActionResult`. Cast so we
            // can honor a returned result today — `void`-returning handlers (the
            // common case) yield `undefined` and skip both branches below.
            const result = (await handler({ variables: vars })) as ActionResult | void;
            // Merge any variables the handler wrote back into the variable bag,
            // then honor an optional `abort` to stop the remaining actions.
            if (mergeResult(result)) return;
          } catch (err) {
            console.error(
              `[ComposableScreen] customAction "${act.function}" threw:`,
              err
            );
            return;
          }
          continue;
        }
      }
    }
  };

  // State overrides are merged over base props. disabledStyle wins over the
  // deprecated `disabledBackgroundColor`/`disabledColor` fields; falls back to
  // those when only the legacy fields are set.
  const stateOverride: ButtonStyleOverride = isDisabled
    ? (element.props.disabledStyle ?? {})
    : isPressed
      ? (element.props.pressedStyle ?? {})
      : {};
  const eff = { ...element.props, ...stateOverride };

  const variant = eff.variant ?? "filled";
  const isFilled = variant === "filled";
  const isOutlined = variant === "outlined";

  const legacyDisabledBg =
    isDisabled && !element.props.disabledStyle
      ? (element.props.disabledBackgroundColor ?? theme.colors.disable)
      : undefined;
  const legacyDisabledText =
    isDisabled && !element.props.disabledStyle
      ? (element.props.disabledColor ?? theme.colors.text.disable)
      : undefined;

  const bgColor = isDisabled
    ? isFilled
      ? (eff.backgroundColor ?? legacyDisabledBg ?? theme.colors.disable)
      : "transparent"
    : isFilled
      ? (eff.backgroundColor ?? theme.colors.primary)
      : "transparent";
  const textColor = isDisabled
    ? (eff.color ?? legacyDisabledText ?? theme.colors.text.disable)
    : isFilled
      ? (eff.color ?? theme.colors.text.opposite)
      : (eff.color ?? theme.colors.primary);
  const outlinedBorderColor = isDisabled
    ? (eff.borderColor ?? legacyDisabledBg ?? theme.colors.disable)
    : (eff.borderColor ?? theme.colors.primary);

  const hasGradient = isFilled && !isDisabled && !!eff.backgroundGradient;
  const borderRadius = eff.borderRadius ?? 90;
  const inheritedFontFamily = resolveInheritedFontFamily(
    eff.fontFamily,
    theme.typography.defaultFontFamily
  );
  const resolvedFont = useResolvedFontStyle(
    inheritedFontFamily,
    eff.fontWeight
  );

  // Animate opacity between rest/pressed/disabled. Uses native driver — color
  // and shadow* changes apply instantly on state transition (acceptable for
  // tap-feedback timescales). transitionDurationMs gates animation length.
  const opacityAnim = useRef(new Animated.Value(eff.opacity ?? 1)).current;
  const duration = element.props.transitionDurationMs ?? 150;
  const restOpacity = element.props.opacity ?? 1;
  const pressedOpacity = element.props.pressedStyle?.opacity ?? 0.8;
  const disabledOpacity =
    element.props.disabledStyle?.opacity ?? element.props.opacity ?? 1;
  const targetOpacity = isDisabled
    ? disabledOpacity
    : isPressed
      ? pressedOpacity
      : restOpacity;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: targetOpacity,
      duration,
      useNativeDriver: true,
    }).start();
  }, [targetOpacity, duration, opacityAnim]);

  const shadowStyle = buildShadowStyle(eff);

  const labelNode = (
    <Text
      style={{
        color: textColor,
        fontSize: eff.fontSize ?? theme.typography.textStyles.button.fontSize,
        fontWeight: resolvedFont.resolvedToVariant
          ? undefined
          : ((resolvedFont.fontWeight as any) ?? theme.typography.textStyles.button.fontWeight),
        fontFamily: resolvedFont.fontFamily,
        fontStyle: eff.fontStyle,
        textAlign: eff.textAlign ?? "center",
      }}
    >
      {element.props.label}
    </Text>
  );

  const onPressIn = () => setIsPressed(true);
  const onPressOut = () => setIsPressed(false);

  if (hasGradient) {
    return (
      <Animated.View
        style={{
          ...shadowStyle,
          opacity: opacityAnim,
          width: dim(eff.width),
          height: dim(eff.height),
          margin: eff.margin,
          marginHorizontal: eff.marginHorizontal,
          marginVertical: eff.marginVertical,
          alignSelf: eff.alignSelf ?? (eff.width ? undefined : "stretch"),
          borderRadius,
        }}
      >
        <GradientBox
          gradient={eff.backgroundGradient}
          style={{
            borderRadius,
            borderWidth: isOutlined ? (eff.borderWidth ?? 1) : (eff.borderWidth ?? 0),
            borderColor: isOutlined ? outlinedBorderColor : eff.borderColor,
            overflow: "hidden",
            flex: 1,
          }}
        >
          <Pressable
            onPress={handlePress}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={isDisabled}
            style={{
              flex: 1,
              padding: eff.padding,
              paddingVertical: eff.paddingVertical ?? (eff.padding != null ? undefined : 14),
              paddingHorizontal: eff.paddingHorizontal ?? (eff.padding != null ? undefined : 24),
              justifyContent: "center",
            }}
          >
            {labelNode}
          </Pressable>
        </GradientBox>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      style={{
        ...shadowStyle,
        opacity: opacityAnim,
        backgroundColor: bgColor,
        borderRadius,
        borderWidth: isOutlined ? (eff.borderWidth ?? 1) : (eff.borderWidth ?? 0),
        borderColor: isOutlined ? outlinedBorderColor : eff.borderColor,
        width: dim(eff.width),
        height: dim(eff.height),
        margin: eff.margin,
        marginHorizontal: eff.marginHorizontal,
        marginVertical: eff.marginVertical,
        alignSelf: eff.alignSelf ?? (eff.width ? undefined : "stretch"),
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={isDisabled}
        style={{
          padding: eff.padding,
          paddingVertical: eff.paddingVertical ?? (eff.padding != null ? undefined : 14),
          paddingHorizontal: eff.paddingHorizontal ?? (eff.padding != null ? undefined : 24),
          justifyContent: "center",
          borderRadius,
        }}
      >
        {labelNode}
      </Pressable>
    </Animated.View>
  );
};

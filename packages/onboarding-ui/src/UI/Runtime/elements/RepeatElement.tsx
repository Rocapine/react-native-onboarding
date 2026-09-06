import React, { useMemo } from "react";
import { z } from "zod";
import type { UIElement } from "../types";
import type { RenderContext, ParentType } from "./shared";
import { VariablesContext, useVariables } from "./VariablesContext";
import { buildRowEntries, buildRowFlat, buildRowKeys, suffixIds } from "./repeatScope";

// Mirror of the headless RepeatElement schema. Kept in lockstep with
// packages/onboarding/src/screens/elements/RepeatElement.ts — TS won't catch
// drift because this re-declares its own type.
//
// Deliberately does NOT extend BaseBoxProps: Repeat renders no view of its own
// (the rows become children of whatever contains the Repeat), so box props would
// silently do nothing.
export type RepeatElementProps = {
  data: Array<Record<string, string | number | boolean>>;
  as?: string;
  keyField?: string;
};

export const RepeatElementPropsSchema = z.object({
  data: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))),
  as: z.string().min(1).optional(),
  keyField: z.string().min(1).optional(),
});

type RepeatUIElement = Extract<UIElement, { type: "Repeat" }>;

type Props = {
  element: RepeatUIElement;
  ctx: RenderContext;
  parentType?: ParentType;
};

/**
 * Renders `children` once per row of `props.data`, with each row's fields exposed
 * to that row's subtree under the `as` prefix (default `item`).
 *
 * Layout-transparent: it returns a fragment of the materialized rows and no view
 * of its own, so the rows become direct children of the containing stack and that
 * stack's `gap`/direction/alignment apply per row. A context Provider is likewise
 * layout-transparent, so wrapping each row in one costs no layout box.
 *
 * The scope is published on TWO paths, because the runtime reads variables two
 * different ways and a row needs both:
 *   • VariablesContext — reactive, drives `{{item.x}}` interpolation and
 *     `renderWhen` gates (which is what makes Repeat subsume a `Match`).
 *   • a derived RenderContext with a wrapped `getVariables` — press-time, read by
 *     `runActions`, which deliberately reads the live store ref rather than
 *     context. Without this a repeated card could be drawn but not answered: a
 *     `setVariable` expression referencing `{{item.id}}` would resolve empty.
 * The derived ctx also overrides `renderChildren` so nested containers inside a
 * row keep the row scope instead of reverting to the screen's root context.
 */
export function RepeatElementComponent({ element, ctx, parentType }: Props): React.ReactElement {
  const { variables, flatVariables } = useVariables();
  const { props, children } = element;

  const rows = props.data ?? [];
  const scope = props.as ?? "item";
  const keyField = props.keyField;

  const rowKeys = useMemo(() => buildRowKeys(rows, keyField), [rows, keyField]);

  // Cloning is memoized on the template + keys: `data` and `children` both come
  // from the memoized parsed step, so this runs once per screen, not per render.
  const materialized = useMemo(
    () => rowKeys.map((key) => suffixIds(children, key)),
    [children, rowKeys]
  );

  // Reactive scope (interpolation + renderWhen).
  const scopedVariables = useMemo(
    () =>
      rows.map((row, i) => {
        return {
          variables: { ...variables, ...buildRowEntries(row, i, scope) },
          flatVariables: { ...flatVariables, ...buildRowFlat(row, i, scope) },
        };
      }),
    [rows, scope, variables, flatVariables]
  );

  // Press-time scope (runActions reads ctx.getVariables(), not context).
  const scopedContexts = useMemo(
    () =>
      rows.map((row, i) => {
        const extra = buildRowEntries(row, i, scope);

        const rowCtx: RenderContext = {
          ...ctx,
          getVariables: () => ({ ...ctx.getVariables(), ...extra }),
          // Self-referential on purpose: a nested container calls the
          // renderChildren of the ctx it was handed, so this keeps descendants
          // on the row's scope rather than falling back to the root ctx.
          renderChildren: (els, pt) => ctx.renderChildren(els, pt, rowCtx),
        };
        return rowCtx;
      }),
    [rows, scope, ctx]
  );

  return (
    <>
      {materialized.map((rowElements, i) => (
        <VariablesContext.Provider key={rowKeys[i]} value={scopedVariables[i]}>
          {scopedContexts[i].renderChildren(rowElements, parentType ?? "YStack")}
        </VariablesContext.Provider>
      ))}
    </>
  );
}

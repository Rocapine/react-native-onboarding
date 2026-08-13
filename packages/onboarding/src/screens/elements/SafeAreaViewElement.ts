import { z } from "zod";
import { BaseBoxPropsSchema, type BaseBoxProps } from "./BaseBoxProps";

export type SafeAreaEdge = "top" | "right" | "bottom" | "left";
export type SafeAreaEdgeMode = "off" | "additive" | "maximum";

export type SafeAreaViewElementProps = BaseBoxProps & {
  mode?: "padding" | "margin";
  edges?: SafeAreaEdge[] | Partial<Record<SafeAreaEdge, SafeAreaEdgeMode>>;
};

const EdgeSchema = z.enum(["top", "right", "bottom", "left"]);
const EdgeModeSchema = z.enum(["off", "additive", "maximum"]);

export const SafeAreaViewElementPropsSchema = BaseBoxPropsSchema.extend({
  mode: z.enum(["padding", "margin"]).optional(),
  edges: z
    .union([
      z.array(EdgeSchema),
      z.strictObject({
        top: EdgeModeSchema.optional(),
        right: EdgeModeSchema.optional(),
        bottom: EdgeModeSchema.optional(),
        left: EdgeModeSchema.optional(),
      }),
    ])
    .optional(),
});

import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type StackElementProps = BaseBoxProps & {
  gap?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  flexWrap?: "wrap" | "nowrap";
};

export const StackElementPropsSchema = BaseBoxPropsSchema.extend({
  gap: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
});

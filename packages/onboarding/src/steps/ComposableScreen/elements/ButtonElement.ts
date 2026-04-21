import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type ButtonElementProps = BaseBoxProps & {
  label: string;
  action?: "continue";
  variant?: "filled" | "outlined" | "ghost";
  backgroundColor?: string;
  color?: string;
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  textAlign?: "left" | "center" | "right";
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";
};

export const ButtonElementPropsSchema = BaseBoxPropsSchema.extend({
  label: z.string(),
  action: z.enum(["continue"]).optional(),
  variant: z.enum(["filled", "outlined", "ghost"]).optional(),
  backgroundColor: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  alignSelf: z.enum(["auto", "flex-start", "center", "flex-end", "stretch"]).optional(),
});

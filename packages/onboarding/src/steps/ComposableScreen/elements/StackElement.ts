import { z } from "zod";

export type StackElementProps = {
  gap?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  flex?: number;
  width?: number;
  height?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  backgroundColor?: string;
  flexWrap?: "wrap" | "nowrap";
  flexShrink?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  overflow?: "hidden" | "visible" | "scroll";
  opacity?: number;
};

export const StackElementPropsSchema = z.object({
  gap: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  flex: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  minWidth: z.number().optional(),
  maxWidth: z.number().optional(),
  minHeight: z.number().optional(),
  maxHeight: z.number().optional(),
  alignItems: z.enum(["flex-start", "center", "flex-end", "stretch"]).optional(),
  justifyContent: z.enum(["flex-start", "center", "flex-end", "space-between", "space-around"]).optional(),
  backgroundColor: z.string().optional(),
  flexWrap: z.enum(["wrap", "nowrap"]).optional(),
  flexShrink: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  overflow: z.enum(["hidden", "visible", "scroll"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
});

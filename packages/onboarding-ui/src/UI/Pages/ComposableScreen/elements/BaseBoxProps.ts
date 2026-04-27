import { z } from "zod";

export type BaseBoxProps = {
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  flex?: number;
  flexShrink?: number;
  flexGrow?: number;
  alignSelf?: "auto" | "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  opacity?: number;
  backgroundColor?: string;
  overflow?: "hidden" | "visible" | "scroll";
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
};

export const BaseBoxPropsSchema = z.object({
  width: z.union([z.number().min(0), z.string()]).optional(),
  height: z.union([z.number().min(0), z.string()]).optional(),
  minWidth: z.number().min(0).optional(),
  maxWidth: z.number().min(0).optional(),
  minHeight: z.number().min(0).optional(),
  maxHeight: z.number().min(0).optional(),
  flex: z.number().min(0).optional(),
  flexShrink: z.number().min(0).optional(),
  flexGrow: z.number().min(0).optional(),
  alignSelf: z.enum(["auto", "flex-start", "flex-end", "center", "stretch", "baseline"]).optional(),
  opacity: z.number().min(0).max(1).optional(),
  backgroundColor: z.string().optional(),
  overflow: z.enum(["hidden", "visible", "scroll"]).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  padding: z.number().min(0).optional(),
  paddingHorizontal: z.number().min(0).optional(),
  paddingVertical: z.number().min(0).optional(),
  borderWidth: z.number().min(0).optional(),
  borderRadius: z.number().min(0).optional(),
  borderColor: z.string().optional(),
});

import { z } from "zod";

export type TextElementProps = {
  content: string;
  mode?: "plain" | "expression";
  fontSize?: number;
  fontWeight?: string;
  fontFamily?: string;
  color?: string;
  textAlign?: "left" | "center" | "right";
  letterSpacing?: number;
  lineHeight?: number;
  backgroundColor?: string;
  padding?: number;
  paddingHorizontal?: number;
  paddingVertical?: number;
  margin?: number;
  marginHorizontal?: number;
  marginVertical?: number;
  borderWidth?: number;
  borderRadius?: number;
  borderColor?: string;
  opacity?: number;
};

export const TextElementPropsSchema = z.object({
  content: z.string(),
  mode: z.enum(["plain", "expression"]).optional(),
  fontSize: z.number().optional(),
  fontWeight: z.string().optional(),
  fontFamily: z.string().optional(),
  color: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  backgroundColor: z.string().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
  opacity: z.number().min(0).max(1).optional(),
});

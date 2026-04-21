import { z } from "zod";

export type BaseBoxProps = {
  width?: number;
  height?: number;
  opacity?: number;
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
  width: z.number().optional(),
  height: z.number().optional(),
  opacity: z.number().min(0).max(1).optional(),
  margin: z.number().optional(),
  marginHorizontal: z.number().optional(),
  marginVertical: z.number().optional(),
  padding: z.number().optional(),
  paddingHorizontal: z.number().optional(),
  paddingVertical: z.number().optional(),
  borderWidth: z.number().optional(),
  borderRadius: z.number().optional(),
  borderColor: z.string().optional(),
});

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
  width: z.number().min(0).optional(),
  height: z.number().min(0).optional(),
  opacity: z.number().min(0).max(1).optional(),
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

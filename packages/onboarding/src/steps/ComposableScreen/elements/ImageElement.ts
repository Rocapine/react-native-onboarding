import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
});

import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type LottieElementProps = BaseBoxProps & {
  source: string;
  autoPlay?: boolean;
  loop?: boolean;
  speed?: number;
};

export const LottieElementPropsSchema = BaseBoxPropsSchema.extend({
  source: z.string().min(1, "source must not be empty"),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  speed: z.number().optional(),
});

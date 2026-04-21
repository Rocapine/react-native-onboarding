import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type VideoElementProps = BaseBoxProps & {
  url: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
};

export const VideoElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string(),
  autoPlay: z.boolean().optional(),
  loop: z.boolean().optional(),
  muted: z.boolean().optional(),
  controls: z.boolean().optional(),
});

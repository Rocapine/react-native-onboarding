import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type ImageElementProps = BaseBoxProps & {
  url: string;
  aspectRatio?: number;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  /** Uniform Gaussian blur radius (px). 0/undefined = sharp. Ignored for SVGs. */
  blurRadius?: number;
  /**
   * Swap the rendered image by a variable's value. The runtime resolves
   * `cases[variables[variableName].value]`, falling back to `default` and then
   * to plain `url` when the variable is unset or has no matching case.
   * Optional and fully backward-compatible — when unset, `url` is used.
   */
  urlByVariable?: {
    variableName: string;
    cases: Record<string, string>;
    default?: string;
  };
};

export const ImageElementPropsSchema = BaseBoxPropsSchema.extend({
  url: z.string().min(1, "url must not be empty"),
  aspectRatio: z.number().optional(),
  resizeMode: z.enum(["cover", "contain", "stretch", "center"]).optional(),
  blurRadius: z.number().min(0).optional(),
  urlByVariable: z
    .object({
      variableName: z.string().min(1, "variableName must not be empty"),
      cases: z.record(z.string(), z.string()),
      default: z.string().optional(),
    })
    .optional(),
});

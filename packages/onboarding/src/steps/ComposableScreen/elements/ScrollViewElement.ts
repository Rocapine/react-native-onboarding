import { z } from "zod";
import { BaseBoxPropsSchema, type BaseBoxProps } from "./BaseBoxProps";

export type ScrollViewContentInset = {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
};

export type ScrollViewElementProps = BaseBoxProps & {
  horizontal?: boolean;
  bounces?: boolean;
  showsVerticalScrollIndicator?: boolean;
  showsHorizontalScrollIndicator?: boolean;
  alwaysBounceVertical?: boolean;
  alwaysBounceHorizontal?: boolean;
  contentInset?: ScrollViewContentInset;
  contentContainerPadding?: number;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
};

const ContentInsetSchema = z.object({
  top: z.number().optional(),
  right: z.number().optional(),
  bottom: z.number().optional(),
  left: z.number().optional(),
});

export const ScrollViewElementPropsSchema = BaseBoxPropsSchema.extend({
  horizontal: z.boolean().optional(),
  bounces: z.boolean().optional(),
  showsVerticalScrollIndicator: z.boolean().optional(),
  showsHorizontalScrollIndicator: z.boolean().optional(),
  alwaysBounceVertical: z.boolean().optional(),
  alwaysBounceHorizontal: z.boolean().optional(),
  contentInset: ContentInsetSchema.optional(),
  contentContainerPadding: z.number().min(0).optional(),
  keyboardShouldPersistTaps: z.enum(["always", "never", "handled"]).optional(),
});

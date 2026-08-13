import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type CarouselElementProps = BaseBoxProps & {
  carouselType?: "left-align" | "normal" | "parallax" | "stack";
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showDots?: boolean;
  dotColor?: string;
  activeDotColor?: string;
  dotWidth?: number;
  dotHeight?: number;
  activeDotWidth?: number;
  activeDotHeight?: number;
  dotsGap?: number;
  dotsPosition?: "top" | "bottom";
  dotsMarginTop?: number;
  dotsMarginBottom?: number;
  defaultIndex?: number | null;
  variableName?: string;
};

export const CarouselElementPropsSchema = BaseBoxPropsSchema.extend({
  carouselType: z.enum(["left-align", "normal", "parallax", "stack"]).optional().default("normal"),
  autoPlay: z.boolean().optional().default(false),
  autoPlayInterval: z.number().nonnegative().optional().default(3000),
  loop: z.boolean().optional().default(true),
  showDots: z.boolean().optional().default(true),
  dotColor: z.string().optional(),
  activeDotColor: z.string().optional(),
  dotWidth: z.number().nonnegative().optional().default(20),
  dotHeight: z.number().nonnegative().optional().default(4),
  activeDotWidth: z.number().nonnegative().optional(),
  activeDotHeight: z.number().nonnegative().optional(),
  dotsGap: z.number().nonnegative().optional().default(8),
  dotsPosition: z.enum(["top", "bottom"]).optional().default("bottom"),
  dotsMarginTop: z.number().optional().default(12),
  dotsMarginBottom: z.number().optional().default(0),
  defaultIndex: z.number().int().nonnegative().nullable().optional(),
  variableName: z.string().min(1).optional(),
});

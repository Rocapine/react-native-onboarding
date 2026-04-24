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
  dotsGap?: number;
  dotsMarginTop?: number;
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
  dotsGap: z.number().nonnegative().optional().default(8),
  dotsMarginTop: z.number().optional().default(12),
});

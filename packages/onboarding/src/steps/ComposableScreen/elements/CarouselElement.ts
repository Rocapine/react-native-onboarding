import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

export type CarouselItem = {
  image?: string;
  title?: string;
  description?: string;
};

export const CarouselItemSchema = z.object({
  image: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export type CarouselElementProps = BaseBoxProps & {
  items: CarouselItem[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  loop?: boolean;
  showDots?: boolean;
};

export const CarouselElementPropsSchema = BaseBoxPropsSchema.extend({
  items: z.array(CarouselItemSchema).min(1, "carousel must have at least one item"),
  autoPlay: z.boolean().optional().default(true),
  autoPlayInterval: z.number().nonnegative().optional().default(3000),
  loop: z.boolean().optional().default(true),
  showDots: z.boolean().optional().default(true),
});

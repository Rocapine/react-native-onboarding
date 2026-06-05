import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";

/**
 * One review card. Mirrors the legacy `SocialProofSchema` shape
 * (`{ numberOfStar, content, authorName }`) so existing data ports directly.
 */
export type ReviewProof = {
  numberOfStar: number;
  content: string;
  authorName: string;
};

export type ReviewsElementProps = BaseBoxProps & {
  reviews: ReviewProof[];
  /** Laurel + award badge above the cards. Default true. */
  showAward?: boolean;
  /** Award badge text. Default "Users Choice". */
  awardLabel?: string;
  /** Filled-star count in the award row. Default 5. */
  awardStars?: number;
  /** Filled-star color. Default "#FED64B" (legacy). */
  starColor?: string;
  /** Empty/outline-star color. Default theme neutral. */
  emptyStarColor?: string;
  /** Single card, vertical stack, or swipeable carousel. Default "card". */
  layout?: "card" | "stack" | "carousel";
  /** "+N others" overlapping-avatar group below the card. Default true. */
  showOthersCount?: boolean;
  cardBackgroundColor?: string;
};

const ReviewProofSchema = z.object({
  numberOfStar: z.number().min(0).max(5),
  content: z.string(),
  authorName: z.string().trim().min(1, "authorName must not be empty"),
});

export const ReviewsElementPropsSchema = BaseBoxPropsSchema.extend({
  reviews: z.array(ReviewProofSchema).min(1, "reviews must not be empty"),
  showAward: z.boolean().optional(),
  awardLabel: z.string().optional(),
  awardStars: z.number().min(0).max(5).optional(),
  starColor: z.string().optional(),
  emptyStarColor: z.string().optional(),
  layout: z.enum(["card", "stack", "carousel"]).optional(),
  showOthersCount: z.boolean().optional(),
  cardBackgroundColor: z.string().optional(),
});

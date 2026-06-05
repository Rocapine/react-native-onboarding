import React from "react";
import { View, Text, Image as RNImage, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { z } from "zod";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { UIElement } from "../types";
import { RenderContext, dim } from "./shared";

// ---------------------------------------------------------------------------
// Schema/type DUPLICATED inline (repo convention). Keep in sync with
// packages/onboarding/.../elements/ReviewsElement.ts.
// ---------------------------------------------------------------------------

export type ReviewProof = {
  numberOfStar: number;
  content: string;
  authorName: string;
};

export type ReviewsElementProps = BaseBoxProps & {
  reviews: ReviewProof[];
  showAward?: boolean;
  awardLabel?: string;
  awardStars?: number;
  starColor?: string;
  emptyStarColor?: string;
  layout?: "card" | "stack" | "carousel";
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

type ReviewsUIElement = Extract<UIElement, { type: "Reviews" }>;

type Props = {
  element: ReviewsUIElement;
  ctx: RenderContext;
};

const StarIcon = ({ size, filled, color, emptyColor }: { size: number; filled: boolean; color: string; emptyColor: string }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M16 2L20.12 11.76L31 13.24L23.5 20.48L25.24 31.24L16 26.76L6.76 31.24L8.5 20.48L1 13.24L11.88 11.76L16 2Z"
      fill={filled ? color : "none"}
      stroke={filled ? color : emptyColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export const ReviewsElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme } = ctx;
  const { props } = element;

  const reviews = props.reviews;
  const starColor = props.starColor ?? "#FED64B";
  const emptyStarColor = props.emptyStarColor ?? theme.colors.neutral.medium;
  const showAward = props.showAward !== false;
  const showOthersCount = props.showOthersCount !== false;
  const cardBg = props.cardBackgroundColor ?? theme.colors.neutral.lowestest;
  const layout = props.layout ?? "card";

  const otherUsersCount = reviews.length > 1 ? reviews.length - 1 : 0;

  const renderStars = (numberOfStar: number, size: number = 20) => (
    <View style={styles.starsContainer}>
      {Array.from({ length: 5 }).map((_, index) => (
        <StarIcon key={index} size={size} filled={index < numberOfStar} color={starColor} emptyColor={emptyStarColor} />
      ))}
    </View>
  );

  const renderCard = (review: ReviewProof, key: React.Key) => (
    <View key={key} style={[styles.reviewCard, { backgroundColor: cardBg }]}>
      <View style={styles.reviewAuthor}>
        <View style={[styles.avatar, { backgroundColor: theme.colors.neutral.low }]}>
          <Text style={[styles.avatarText, { color: theme.colors.text.opposite }]}>
            {review.authorName.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.authorName, { color: theme.colors.text.secondary, fontSize: theme.typography.textStyles.label.fontSize }]}>
          {review.authorName}
        </Text>
      </View>

      <Text style={[styles.reviewContent, { color: theme.colors.text.primary, fontSize: theme.typography.textStyles.bodyMedium.fontSize }]}>
        {review.content}
      </Text>

      {renderStars(review.numberOfStar)}
    </View>
  );

  const containerStyle = {
    alignSelf: props.alignSelf,
    flex: props.flex,
    flexShrink: props.flexShrink,
    flexGrow: props.flexGrow,
    width: dim(props.width),
    height: dim(props.height),
    minWidth: props.minWidth,
    maxWidth: props.maxWidth,
    minHeight: props.minHeight,
    maxHeight: props.maxHeight,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    borderWidth: props.borderWidth,
    borderRadius: props.borderRadius,
    borderColor: props.borderColor,
    backgroundColor: props.backgroundGradient ? undefined : props.backgroundColor,
    opacity: props.opacity,
    overflow: props.overflow,
    alignItems: "center" as const,
    gap: 24,
  };

  // "card" shows the first review; "stack"/"carousel" show all (carousel is
  // rendered as a vertical stack here — true swiping is a Carousel container concern).
  const cardsToShow = layout === "card" ? reviews.slice(0, 1) : reviews;

  return (
    <View style={containerStyle}>
      {showAward ? (
        <View style={styles.awardContainer}>
          <RNImage source={require("../../../../assets/laurel-left.png")} style={styles.laurelImage} resizeMode="contain" />
          <View style={styles.awardTextContainer}>
            {renderStars(props.awardStars ?? 5, 32)}
            <Text style={[styles.awardTitle, { color: theme.colors.text.secondary, fontSize: theme.typography.textStyles.heading2.fontSize, fontWeight: theme.typography.textStyles.heading2.fontWeight }]}>
              {props.awardLabel ?? "Users Choice"}
            </Text>
          </View>
          <RNImage source={require("../../../../assets/laurel-right.png")} style={styles.laurelImage} resizeMode="contain" />
        </View>
      ) : null}

      <View style={styles.reviewSection}>
        {cardsToShow.map((review, i) => renderCard(review, i))}

        {showOthersCount && otherUsersCount > 0 ? (
          <View style={styles.usersCount}>
            <View style={styles.avatarGroup}>
              {reviews.slice(1, 4).map((proof, index) => (
                <View
                  key={index}
                  style={[
                    styles.smallAvatar,
                    {
                      zIndex: 3 - index,
                      marginLeft: index > 0 ? -10 : 0,
                      borderColor: theme.colors.neutral.lowestest,
                      backgroundColor: theme.colors.neutral.low,
                    },
                  ]}
                >
                  <Text style={[styles.smallAvatarText, { color: theme.colors.text.opposite }]}>
                    {proof.authorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.usersCountText, { color: theme.colors.text.secondary, fontSize: theme.typography.textStyles.bodyMedium.fontSize }]}>
              +{otherUsersCount.toLocaleString()} others
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  awardContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  laurelImage: {
    width: 27,
    height: 63,
  },
  awardTextContainer: {
    alignItems: "center",
    gap: 12,
  },
  awardTitle: {
    textAlign: "center",
  },
  starsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  reviewSection: {
    gap: 24,
    alignItems: "center",
    width: "100%",
  },
  reviewCard: {
    borderRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 326,
    gap: 16,
  },
  reviewAuthor: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "600",
  },
  authorName: {},
  reviewContent: {
    textAlign: "center",
  },
  usersCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  avatarGroup: {
    flexDirection: "row",
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  smallAvatarText: {
    fontSize: 12,
    fontWeight: "600",
  },
  usersCountText: {},
});

import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { RatingsStepType, RatingsStepTypeSchema } from "./types";
import { useState } from "react";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

// Lazy load StoreReview - only needed for ratings screens
let StoreReview: any;
try {
  StoreReview = require("expo-store-review");
} catch (e) {
  // StoreReview not installed - will show error when ratings screen is used
  StoreReview = null;
}

interface RatingsRendererProps {
  step: RatingsStepType;
  onContinue?: () => void;
  theme?: Theme;
}

const StarIcon = ({ size, filled }: { size: number; filled: boolean }) => (
  <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
    <Path
      d="M16 2L20.12 11.76L31 13.24L23.5 20.48L25.24 31.24L16 26.76L6.76 31.24L8.5 20.48L1 13.24L11.88 11.76L16 2Z"
      fill={filled ? "#FED64B" : "none"}
      stroke={filled ? "#FED64B" : "#D1D1D6"}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const RatingsRendererBase = ({ step, onContinue, theme = defaultTheme }: RatingsRendererProps) => {
  const [hasOpenedRequestReview, setHasOpenedRequestReview] = useState(false);

  // Check if StoreReview is available
  if (!StoreReview) {
    throw new Error(
      "Ratings screens require expo-store-review. Install it with: npx expo install expo-store-review"
    );
  }

  const handlePress = async () => {
    if (!hasOpenedRequestReview) {
      setHasOpenedRequestReview(true);
      if (await StoreReview.hasAction()) {
        // you can call StoreReview.requestReview()
        await StoreReview.requestReview();
      }
    } else {
      onContinue?.();
    }
  };
  // Validate the schema
  const validatedData = RatingsStepTypeSchema.parse(step);
  const { title, subtitle, socialProofs, rateTheAppButtonLabel } =
    validatedData.payload;

  // Get the first social proof to display (as shown in design)
  const mainReview = socialProofs[0];
  const otherUsersCount = socialProofs.length > 1 ? socialProofs.length - 1 : 0;

  const renderStars = (numberOfStar: number, size: number = 20) => {
    return (
      <View style={styles.starsContainer}>
        {Array.from({ length: 5 }).map((_, index) => (
          <StarIcon key={index} size={size} filled={index < numberOfStar} />
        ))}
      </View>
    );
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={handlePress}
      theme={theme}
      button={{
        text: !hasOpenedRequestReview
          ? rateTheAppButtonLabel
          : validatedData.continueButtonLabel,
      }}
    >
      <View style={styles.container}>
        {/* Main Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Award Section */}
          <View style={styles.awardSection}>
            <View style={styles.awardContainer}>
              <Image
                source={require("../../../assets/laurel-left.png")}
                style={styles.laurelImage}
                resizeMode="contain"
              />
              <View style={styles.awardTextContainer}>
                {renderStars(5, 32)}
                <Text style={[getTextStyle(theme, "heading2"), styles.awardTitle, { color: theme.colors.text.secondary }]}>Users Choice</Text>
              </View>
              <Image
                source={require("../../../assets/laurel-right.png")}
                style={styles.laurelImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Review Section */}
          <View style={styles.reviewSection}>
            <View style={[styles.reviewCard, { backgroundColor: theme.colors.neutral.lowest }]}>
              <View style={styles.reviewAuthor}>
                <View style={[styles.avatar, { backgroundColor: theme.colors.neutral.low }]}>
                  <Text style={[styles.avatarText, { color: theme.colors.text.opposite }]}>
                    {mainReview.authorName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={[getTextStyle(theme, "label"), styles.authorName, { color: theme.colors.text.secondary }]}>{mainReview.authorName}</Text>
              </View>

              <Text style={[getTextStyle(theme, "bodyMedium"), styles.reviewContent, { color: theme.colors.text.primary }]}>{mainReview.content}</Text>

              {renderStars(mainReview.numberOfStar)}
            </View>

            {/* Other Users Count */}
            {otherUsersCount > 0 && (
              <View style={styles.usersCount}>
                <View style={styles.avatarGroup}>
                  {socialProofs.slice(1, 4).map((proof, index) => (
                    <View
                      key={index}
                      style={[
                        styles.smallAvatar,
                        {
                          zIndex: 3 - index,
                          marginLeft: index > 0 ? -10 : 0,
                          borderColor: theme.colors.surface.lowest,
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
                <Text style={[getTextStyle(theme, "bodyMedium"), styles.usersCountText, { color: theme.colors.text.secondary }]}>
                  +{otherUsersCount.toLocaleString()} others
                </Text>
              </View>
            )}
          </View>

          {/* Title and Subtitle */}
          <View style={styles.textSection}>
            <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
            <Text style={[getTextStyle(theme, "heading3"), styles.subtitle, { color: theme.colors.text.secondary }]}>{subtitle}</Text>
          </View>
        </ScrollView>
      </View>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
    paddingTop: 20,
    justifyContent: "space-between",
  },
  awardSection: {
    flex: 1,
    alignItems: "center",
  },
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
    paddingHorizontal: 32,
    gap: 24,
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
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
  textSection: {
    paddingHorizontal: 32,
    gap: 16,
    alignItems: "center",
    marginTop: "auto",
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
});

import { withErrorBoundary } from "../../ErrorBoundary";

export const RatingsRenderer = withErrorBoundary(
  RatingsRendererBase,
  "Ratings"
);

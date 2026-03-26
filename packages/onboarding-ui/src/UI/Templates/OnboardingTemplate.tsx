import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { OnboardingStepType } from "../types";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getTextStyle } from "../Theme/helpers";
import { Theme } from "../Theme/types";
import { defaultTheme } from "../Theme/defaultTheme";
import * as LucideIcons from "lucide-react-native";

function lucideIconLookupKeys(raw: string): string[] {
  const s = raw.trim();
  if (!s) return [];
  const keys: string[] = [s];
  if (/[-_\s]/.test(s)) {
    const pascal = s
      .split(/[-_\s]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("");
    if (pascal && !keys.includes(pascal)) keys.push(pascal);
  }
  if (/^[a-z][a-z0-9]*$/.test(s)) {
    const cap = s.charAt(0).toUpperCase() + s.slice(1);
    if (!keys.includes(cap)) keys.push(cap);
  }
  if (/^[A-Z0-9]+$/.test(s) && s.length > 1) {
    const title = s.charAt(0) + s.slice(1).toLowerCase();
    if (!keys.includes(title)) keys.push(title);
  }
  return keys;
}

function resolveIcon(iconName: string, color: string): React.ReactElement | null {
  if (!iconName?.trim()) return null;
  const mod = LucideIcons as Record<string, any>;
  for (const key of lucideIconLookupKeys(iconName)) {
    const IconComponent = mod[key];
    if (IconComponent != null) {
      return <IconComponent size={20} color={color} strokeWidth={2} />;
    }
  }
  return null;
}

type OnboardingTemplateProps = {
  children: React.ReactNode;
  onContinue: () => void;
  button?: {
    text: string;
    disabled?: boolean;
    icon?: string | null;
  };
  step: OnboardingStepType;
  theme?: Theme;
};

export const OnboardingTemplate = ({
  children,
  onContinue,
  step,
  button,
  theme = defaultTheme,
}: OnboardingTemplateProps) => {
  const { top, bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.neutral.lowest,
          paddingTop: step.displayProgressHeader ? top + 40 : top,
          paddingBottom: bottom
        },
      ]}
    >
      {children}
      {button && (
        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[
              styles.ctaButton,
              { backgroundColor: theme.colors.primary },
              button.disabled && { backgroundColor: theme.colors.disable },
            ]}
            onPress={onContinue}
            activeOpacity={0.8}
            disabled={button.disabled}
          >
            {button.icon ? (
              <View style={styles.ctaButtonContent}>
                {resolveIcon(
                  button.icon,
                  button.disabled
                    ? theme.colors.text.disable
                    : theme.colors.text.opposite
                )}
                <Text
                  style={[
                    getTextStyle(theme, "button"),
                    styles.ctaButtonText,
                    { color: theme.colors.text.opposite },
                    button.disabled && { color: theme.colors.text.disable },
                  ]}
                >
                  {button.text}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  getTextStyle(theme, "button"),
                  styles.ctaButtonText,
                  { color: theme.colors.text.opposite },
                  button.disabled && { color: theme.colors.text.disable },
                ]}
              >
                {button.text}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSection: {
    paddingHorizontal: 32,
    gap: 24,
    alignItems: "center",
  },
  ctaButton: {
    borderRadius: 90,
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 234,
    alignItems: "center",
  },
  ctaButtonText: {},
  ctaButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});

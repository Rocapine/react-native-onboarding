import { useState } from "react";
import { QuestionStepTypeSchema, QuestionStepType } from "./types";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { getTextStyle } from "../../Theme/helpers";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { useCustomComponents } from "../../../infra/provider/CustomComponentsContext";
import {
  DefaultQuestionAnswerButton,
  DefaultQuestionAnswersList,
} from "./components";

interface QuestionRendererProps {
  step: QuestionStepType;
  onContinue?: (...args: any[]) => void;
  theme?: Theme;
}

const QuestionRendererBase = ({ step, onContinue, theme = defaultTheme }: QuestionRendererProps) => {
  const customComponents = useCustomComponents();

  // Validate the schema
  const validatedData = QuestionStepTypeSchema.parse(step);
  const { title, subtitle, answers, multipleAnswer } = validatedData.payload;

  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const handleContinue = () => {
    if (!onContinue) return;
    const selectedAnswers = Object.keys(selected).filter(
      (key) => selected[key]
    );
    onContinue(multipleAnswer ? selectedAnswers : selectedAnswers[0]);
  };

  const onAnswerSelected = (answer: string) => {
    if (!onContinue) return;
    if (multipleAnswer) {
      toggleSelected(answer);
    } else {
      onContinue(answer);
    }
  };

  const toggleSelected = (answer: string) => {
    const isNoneOfTheAbove = answer === "None of the above";

    setSelected((prev) => {
      if (multipleAnswer) {
        let newSelected: Record<string, boolean>;

        if (isNoneOfTheAbove) {
          return { [answer]: true };
        }

        newSelected = { ...prev, [answer]: !prev[answer] };

        if (newSelected["None of the above"]) {
          newSelected["None of the above"] = false;
        }

        return newSelected;
      } else {
        return { [answer]: true };
      }
    });
  };

  const isAnySelected = Object.values(selected).some((value) => value);

  // Priority: Custom full list > Custom button (via DefaultList) > Default implementation
  const AnswersList =
    customComponents.QuestionAnswersList || DefaultQuestionAnswersList;
  const AnswerButton =
    customComponents.QuestionAnswerButton || DefaultQuestionAnswerButton;

  return (
    <OnboardingTemplate
      step={step}
      onContinue={onContinue || (() => {})}
      theme={theme}
      button={multipleAnswer ? { text: "Continue" } : undefined}
    >
      <View style={styles.container}>
        {/* Main Content */}
        <View style={styles.contentContainer}>
          {/* Header */}
          <View style={styles.headerSection}>
            <Text
              style={[
                getTextStyle(theme, "heading1"),
                styles.title,
                { color: theme.colors.text.primary },
              ]}
            >
              {title}
            </Text>
            {Boolean(subtitle?.length) ? (
              <Text
                style={[
                  getTextStyle(theme, "body"),
                  styles.subtitle,
                  { color: theme.colors.text.secondary },
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>

          {/* Answers */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Use custom list if provided, otherwise use default list which respects custom button */}
            {customComponents.QuestionAnswersList ? (
              <AnswersList
                answers={answers}
                selected={selected}
                onAnswerPress={onAnswerSelected}
                multipleAnswer={multipleAnswer}
                theme={theme}
              />
            ) : (
              <View style={styles.answersContainer}>
                {answers.map((answer, index) => (
                  <AnswerButton
                    key={answer.value}
                    answer={answer}
                    selected={selected[answer.value]}
                    onPress={() => onAnswerSelected(answer.value)}
                    theme={theme}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === answers.length - 1}
                  />
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 40,
  },
  headerSection: {
    gap: 8,
  },
  title: {
    textAlign: "center",
  },
  subtitle: {
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  answersContainer: {
    gap: 10,
  },
  bottomSection: {
    paddingHorizontal: 32,
    paddingBottom: 8,
    gap: 24,
    alignItems: "center",
  },
  continueButton: {
    backgroundColor: "#262626",
    borderRadius: 90,
    paddingVertical: 18,
    paddingHorizontal: 24,
    minWidth: 234,
    alignItems: "center",
  },
  continueButtonDisabled: {
    backgroundColor: "#d1d1d6",
  },
  continueButtonText: {
    fontFamily: "System",
    fontSize: 16,
    fontWeight: "500",
    color: "#ffffff",
    textAlign: "center",
  },
  homeIndicator: {
    width: 148,
    height: 5,
    backgroundColor: "#000000",
    borderRadius: 100,
    opacity: 0.3,
  },
});

import { withErrorBoundary } from "../../ErrorBoundary";

export const QuestionRenderer = withErrorBoundary(
  QuestionRendererBase,
  "Question"
);

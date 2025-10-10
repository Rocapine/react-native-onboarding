import { OnboardingTemplate } from "../../Templates/OnboardingTemplate";
import { PickerStepType, PickerStepTypeSchema, WeightUnit, HeightUnit } from "./types";
import { View, Text, StyleSheet, TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Keyboard } from "react-native";
import { useState } from "react";
import { Theme } from "../../Theme/types";
import { defaultTheme } from "../../Theme/defaultTheme";
import { getTextStyle } from "../../Theme/helpers";

// Lazy load Picker - only needed for picker screens
let PickerComponent: any;
try {
  const PickerModule = require("@react-native-picker/picker");
  PickerComponent = PickerModule.Picker;
} catch (e) {
  // Picker not installed - will show error when picker screen is used
  PickerComponent = null;
}

type ContentProps = {
  step: PickerStepType;
  onContinue: (value?: string | number) => void;
  theme?: Theme;
};

const PickerRendererBase = ({ step, onContinue, theme = defaultTheme }: ContentProps) => {
  const validatedData = PickerStepTypeSchema.parse(step);
  const { title, description, pickerType } = validatedData.payload;

  // Check if Picker is available
  if (!PickerComponent) {
    throw new Error(
      "Picker screens require @react-native-picker/picker. Install it with: npm install @react-native-picker/picker"
    );
  }

  // Route to specific picker implementation based on type
  if (pickerType === "weight") {
    return (
      <WeightPicker
        step={validatedData}
        onContinue={onContinue}
        title={title}
        description={description}
        theme={theme}
      />
    );
  }

  if (pickerType === "height") {
    return (
      <HeightPicker
        step={validatedData}
        onContinue={onContinue}
        title={title}
        description={description}
        theme={theme}
      />
    );
  }

  if (pickerType === "name") {
    return (
      <NamePicker
        step={validatedData}
        onContinue={onContinue}
        title={title}
        description={description}
        theme={theme}
      />
    );
  }

  if (pickerType === "date") {
    return (
      <DatePicker
        step={validatedData}
        onContinue={onContinue}
        title={title}
        description={description}
        theme={theme}
      />
    );
  }

  // Fallback for other picker types (to be implemented)
  return (
    <OnboardingTemplate
      step={step}
      onContinue={() => onContinue()}
      theme={theme}
      button={{ text: validatedData.continueButtonLabel }}
    >
      <View style={styles.container}>
        <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
        {description && <Text style={[getTextStyle(theme, "body"), styles.description, { color: theme.colors.text.secondary }]}>{description}</Text>}
        <View style={[styles.placeholderContainer, { backgroundColor: theme.colors.neutral.lowest }]}>
          <Text style={[getTextStyle(theme, "body"), styles.placeholderText, { color: theme.colors.text.secondary }]}>
            Picker type "{pickerType}" not yet implemented
          </Text>
        </View>
      </View>
    </OnboardingTemplate>
  );
};

type WeightPickerProps = {
  step: PickerStepType;
  onContinue: (value?: string | number) => void;
  title: string;
  description: string | null;
  theme: Theme;
};

const WeightPicker = ({
  step,
  onContinue,
  title,
  description,
  theme,
}: WeightPickerProps) => {
  const [selectedWeight, setSelectedWeight] = useState<number>(70);
  const [unit, setUnit] = useState<WeightUnit>("kg");

  const generateWeightOptions = (unit: WeightUnit) => {
    const config = {
      lb: { max: 660, step: 1 },
      kg: { max: 300, step: 1 },
    } as const;

    const { max, step } = config[unit];
    const options: React.ReactNode[] = [];

    for (let i = max; i >= step; i -= step) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }

    return options;
  };

  const handleContinue = () => {
    // Return weight as "value-unit" format, e.g., "70-kg"
    onContinue(`${selectedWeight}-${unit}`);
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={handleContinue}
      theme={theme}
      button={{ text: step.continueButtonLabel }}
    >
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
          {description && (
            <Text style={[getTextStyle(theme, "body"), styles.description, { color: theme.colors.text.secondary }]}>{description}</Text>
          )}
        </View>

        <View style={styles.pickerContainer}>
          <View style={styles.pickerRow}>
            <PickerComponent
              selectedValue={selectedWeight}
              onValueChange={(itemValue: number) => setSelectedWeight(Number(itemValue))}
              style={styles.weightPicker}
              itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
            >
              {generateWeightOptions(unit)}
            </PickerComponent>
            <PickerComponent
              selectedValue={unit}
              onValueChange={(itemValue: WeightUnit) => {
                if (itemValue === "kg") {
                  setSelectedWeight(70);
                } else if (itemValue === "lb") {
                  setSelectedWeight(154);
                }
                setUnit(itemValue);
              }}
              style={styles.unitPicker}
              itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
            >
              <PickerComponent.Item label="lb" value="lb" />
              <PickerComponent.Item label="kg" value="kg" />
            </PickerComponent>
          </View>
        </View>
      </View>
    </OnboardingTemplate>
  );
};

type HeightPickerProps = {
  step: PickerStepType;
  onContinue: (value?: string | number) => void;
  title: string;
  description: string | null;
  theme: Theme;
};

const HeightPicker = ({
  step,
  onContinue,
  title,
  description,
  theme,
}: HeightPickerProps) => {
  const [unit, setUnit] = useState<HeightUnit>("cm");

  // For metric (cm)
  const [selectedCm, setSelectedCm] = useState<number>(170);

  // For imperial (ft + in)
  const [selectedFeet, setSelectedFeet] = useState<number>(5);
  const [selectedInches, setSelectedInches] = useState<number>(7);

  const generateCmOptions = () => {
    const options: React.ReactNode[] = [];
    for (let i = 250; i >= 100; i--) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }
    return options;
  };

  const generateFeetOptions = () => {
    const options: React.ReactNode[] = [];
    for (let i = 8; i >= 3; i--) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }
    return options;
  };

  const generateInchesOptions = () => {
    const options: React.ReactNode[] = [];
    for (let i = 11; i >= 0; i--) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }
    return options;
  };

  const handleContinue = () => {
    // Return height based on unit
    if (unit === "cm") {
      onContinue(`${selectedCm}-${unit}`);
    } else {
      // Return as "feet-inches-ft" format, e.g., "5-7-ft"
      onContinue(`${selectedFeet}-${selectedInches}-${unit}`);
    }
  };

  const handleUnitChange = (newUnit: HeightUnit) => {
    if (newUnit === "cm") {
      setSelectedCm(170);
    } else if (newUnit === "ft") {
      setSelectedFeet(5);
      setSelectedInches(7);
    }
    setUnit(newUnit);
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={handleContinue}
      theme={theme}
      button={{ text: step.continueButtonLabel }}
    >
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>{title}</Text>
          {description && (
            <Text style={[getTextStyle(theme, "body"), styles.description, { color: theme.colors.text.secondary }]}>{description}</Text>
          )}
        </View>

        <View style={styles.pickerContainer}>
          {unit === "cm" ? (
            <View style={styles.pickerRow}>
              <PickerComponent
                selectedValue={selectedCm}
                onValueChange={(itemValue: number) => setSelectedCm(Number(itemValue))}
                style={styles.weightPicker}
                itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
              >
                {generateCmOptions()}
              </PickerComponent>
              <PickerComponent
                selectedValue={unit}
                onValueChange={(itemValue: HeightUnit) => handleUnitChange(itemValue)}
                style={styles.unitPicker}
                itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
              >
                <PickerComponent.Item label="cm" value="cm" />
                <PickerComponent.Item label="ft" value="ft" />
              </PickerComponent>
            </View>
          ) : (
            <View style={styles.heightImperialContainer}>
              <View style={styles.pickerRow}>
                <PickerComponent
                  selectedValue={selectedFeet}
                  onValueChange={(itemValue: number) => setSelectedFeet(Number(itemValue))}
                  style={styles.heightFeetPicker}
                  itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
                >
                  {generateFeetOptions()}
                </PickerComponent>
                <PickerComponent
                  selectedValue={selectedInches}
                  onValueChange={(itemValue: number) => setSelectedInches(Number(itemValue))}
                  style={styles.heightInchesPicker}
                  itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
                >
                  {generateInchesOptions()}
                </PickerComponent>
                <PickerComponent
                  selectedValue={unit}
                  onValueChange={(itemValue: HeightUnit) => handleUnitChange(itemValue)}
                  style={styles.heightUnitPicker}
                  itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
                >
                  <PickerComponent.Item label="cm" value="cm" />
                  <PickerComponent.Item label="ft" value="ft" />
                </PickerComponent>
              </View>
            </View>
          )}
        </View>
      </View>
    </OnboardingTemplate>
  );
};

type NamePickerProps = {
  step: PickerStepType;
  onContinue: (value?: string | number) => void;
  title: string;
  description: string | null;
  theme: Theme;
};

const NamePicker = ({
  step,
  onContinue,
  title,
  description,
  theme,
}: NamePickerProps) => {
  const [name, setName] = useState<string>("");

  const handleContinue = () => {
    if (name.trim()) {
      onContinue(name.trim());
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <TouchableWithoutFeedback onPress={dismissKeyboard}>
        <View style={{ flex: 1 }}>
          <OnboardingTemplate
            step={step}
            onContinue={handleContinue}
            theme={theme}
            button={{
              text: step.continueButtonLabel,
              disabled: !name.trim(),
            }}
          >
            <View style={styles.container}>
              <View style={styles.textContainer}>
                <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>
                  {title}
                </Text>
                {description && (
                  <Text style={[getTextStyle(theme, "body"), styles.description, { color: theme.colors.text.secondary }]}>
                    {description}
                  </Text>
                )}
              </View>

              <View style={styles.nameInputContainer}>
                <TextInput
                  autoFocus
                  value={name}
                  onChangeText={setName}
                  returnKeyType="done"
                  placeholder="Type to write"
                  placeholderTextColor={theme.colors.text.disable}
                  onSubmitEditing={() => name.trim() && handleContinue()}
                  style={[
                    styles.nameInput,
                    {
                      backgroundColor: theme.colors.surface.lower,
                      color: theme.colors.text.primary,
                    },
                  ]}
                />
              </View>
            </View>
          </OnboardingTemplate>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

type DatePickerProps = {
  step: PickerStepType;
  onContinue: (value?: string | number) => void;
  title: string;
  description: string | null;
  theme: Theme;
};

const DatePicker = ({
  step,
  onContinue,
  title,
  description,
  theme,
}: DatePickerProps) => {

  // Get current date as default
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(now.getDate());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const generateDayOptions = (month: number, year: number) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const options: React.ReactNode[] = [];
    for (let i = 1; i <= daysInMonth; i++) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }
    return options;
  };

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options: React.ReactNode[] = [];
    for (let i = currentYear; i >= currentYear - 100; i--) {
      options.push(<PickerComponent.Item key={i} label={i.toString()} value={i} />);
    }
    return options;
  };

  const handleMonthChange = (month: number) => {
    setSelectedMonth(month);
    // Adjust day if it exceeds the new month's days
    const daysInNewMonth = new Date(selectedYear, month + 1, 0).getDate();
    if (selectedDay > daysInNewMonth) {
      setSelectedDay(daysInNewMonth);
    }
  };

  const handleContinue = () => {
    // Return date as ISO string "YYYY-MM-DD"
    const date = new Date(selectedYear, selectedMonth, selectedDay);
    onContinue(date.toISOString().split('T')[0]);
  };

  return (
    <OnboardingTemplate
      step={step}
      onContinue={handleContinue}
      theme={theme}
      button={{ text: step.continueButtonLabel }}
    >
      <View style={styles.container}>
        <View style={styles.textContainer}>
          <Text style={[getTextStyle(theme, "heading1"), styles.title, { color: theme.colors.text.primary }]}>
            {title}
          </Text>
          {description && (
            <Text style={[getTextStyle(theme, "body"), styles.description, { color: theme.colors.text.secondary }]}>
              {description}
            </Text>
          )}
        </View>

        <View style={styles.pickerContainer}>
          <View style={styles.datePickerRow}>
            {/* Month Picker */}
            <PickerComponent
              selectedValue={selectedMonth}
              onValueChange={(itemValue: number) => handleMonthChange(itemValue)}
              style={styles.monthPicker}
              itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
            >
              {months.map((month, index) => (
                <PickerComponent.Item key={index} label={month} value={index} />
              ))}
            </PickerComponent>

            {/* Day Picker */}
            <PickerComponent
              selectedValue={selectedDay}
              onValueChange={(itemValue: number) => setSelectedDay(itemValue)}
              style={styles.dayPicker}
              itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
            >
              {generateDayOptions(selectedMonth, selectedYear)}
            </PickerComponent>

            {/* Year Picker */}
            <PickerComponent
              selectedValue={selectedYear}
              onValueChange={(itemValue: number) => setSelectedYear(itemValue)}
              style={styles.yearPicker}
              itemStyle={[styles.pickerItem, { color: theme.colors.text.primary }]}
            >
              {generateYearOptions()}
            </PickerComponent>
          </View>
        </View>
      </View>
    </OnboardingTemplate>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 32,
  },
  textContainer: {
    gap: 16,
  },
  title: {
    textAlign: "center",
    letterSpacing: -0.76,
  },
  description: {
    textAlign: "center",
  },
  placeholderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 24,
    padding: 32,
  },
  placeholderText: {
    textAlign: "center",
  },
  pickerContainer: {
    flex: 1,
    justifyContent: "center",
  },
  pickerRow: {
    flexDirection: "row",
  },
  weightPicker: {
    width: "65%",
  },
  unitPicker: {
    width: "35%",
  },
  pickerItem: {
    fontSize: 20,
  },
  heightImperialContainer: {
    flex: 1,
  },
  heightFeetPicker: {
    width: "33%",
  },
  heightInchesPicker: {
    width: "33%",
  },
  heightUnitPicker: {
    width: "34%",
  },
  nameInputContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  nameInput: {
    width: "100%",
    paddingVertical: 16,
    paddingHorizontal: 24,
    height: 70,
    fontSize: 17,
    borderRadius: 16,
  },
  datePickerRow: {
    flexDirection: "row",
  },
  monthPicker: {
    flex: 2,
  },
  dayPicker: {
    flex: 1,
  },
  yearPicker: {
    flex: 1,
  },
});

import { withErrorBoundary } from '../../ErrorBoundary';

export const PickerRenderer = withErrorBoundary(PickerRendererBase, 'Picker');

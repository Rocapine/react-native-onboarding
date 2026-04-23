import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View, Platform } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BaseBoxProps, BaseBoxPropsSchema } from "./BaseBoxProps";
import { z } from "zod";
import type { UIElement } from "../types";
import type { RenderContext } from "./shared";

export type DatePickerElementProps = BaseBoxProps & {
  variableName?: string;
  defaultValue?: string;
  minimumDate?: string;
  maximumDate?: string;
  mode?: "date" | "time" | "datetime";
  display?: "default" | "spinner" | "calendar" | "clock" | "compact" | "inline";
  textColor?: string;
  accentColor?: string;
  locale?: string;
};

export const DatePickerElementPropsSchema = BaseBoxPropsSchema.extend({
  variableName: z.string().min(1).optional(),
  defaultValue: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date string" }).optional(),
  minimumDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date string" }).optional(),
  maximumDate: z.string().refine((s) => !isNaN(Date.parse(s)), { message: "Invalid date string" }).optional(),
  mode: z.enum(["date", "time", "datetime"]).optional().default("date"),
  display: z.enum(["default", "spinner", "calendar", "clock", "compact", "inline"]).optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  locale: z.string().optional(),
});

type DatePickerUIElement = Extract<UIElement, { type: "DatePicker" }>;

type Props = {
  element: DatePickerUIElement;
  ctx: RenderContext;
};

function formatDate(date: Date, mode: "date" | "time" | "datetime"): string {
  if (mode === "time") {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (mode === "datetime") {
    return date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  }
  return date.toLocaleDateString([], { dateStyle: "medium" });
}

export const DatePickerElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, variables, setVariable } = ctx;
  const { props } = element;

  const persistedValue = props.variableName ? variables[props.variableName]?.value : undefined;
  const initialDate = persistedValue
    ? new Date(persistedValue)
    : props.defaultValue
    ? new Date(props.defaultValue)
    : new Date();

  const [date, setDate] = useState<Date>(initialDate);
  const [isPickerVisible, setPickerVisible] = useState(false);
  const mode = props.mode ?? "date";

  // Tracks which variableName has been seeded so re-renders don't clobber a
  // persisted value that arrived after the first render.
  const seededVariableRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (
      props.variableName &&
      persistedValue === undefined &&
      seededVariableRef.current !== props.variableName
    ) {
      seededVariableRef.current = props.variableName;
      setVariable(props.variableName, {
        value: initialDate.toISOString(),
        label: formatDate(initialDate, mode),
      });
    }
  }, [props.variableName, persistedValue, initialDate, mode, setVariable]);

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (!selected) return;
    setDate(selected);
    if (props.variableName) {
      setVariable(props.variableName, {
        value: selected.toISOString(),
        label: formatDate(selected, mode),
      });
    }
  };

  const containerStyle = {
    alignSelf: props.alignSelf,
    width: props.width,
    height: props.height,
    margin: props.margin,
    marginHorizontal: props.marginHorizontal,
    marginVertical: props.marginVertical,
    padding: props.padding,
    paddingHorizontal: props.paddingHorizontal,
    paddingVertical: props.paddingVertical,
    opacity: props.opacity,
    borderWidth: props.borderWidth,
    borderRadius: props.borderRadius,
    borderColor: props.borderColor,
    overflow: "hidden" as const,
  };

  const pickerProps = {
    value: date,
    mode,
    onChange: handleChange,
    minimumDate: props.minimumDate ? new Date(props.minimumDate) : undefined,
    maximumDate: props.maximumDate ? new Date(props.maximumDate) : undefined,
    // Fall back to theme tokens when CMS props are not provided.
    textColor: props.textColor ?? theme.colors.text.primary,
    accentColor: props.accentColor ?? theme.colors.primary,
    locale: props.locale,
  };

  if (Platform.OS === "android") {
    return (
      <View style={containerStyle}>
        <Pressable
          onPress={() => setPickerVisible(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: props.borderRadius ?? 8,
            borderWidth: props.borderWidth ?? 1,
            borderColor: props.borderColor ?? theme.colors.neutral.low,
            backgroundColor: theme.colors.neutral.lowest,
          }}
        >
          <Text
            style={{
              color: props.textColor ?? theme.colors.text.primary,
              fontSize: theme.typography.textStyles.body.fontSize,
            }}
          >
            {formatDate(date, mode)}
          </Text>
          <Text style={{ color: theme.colors.text.tertiary, fontSize: 16 }}>›</Text>
        </Pressable>
        {isPickerVisible && (
          <DateTimePicker
            {...pickerProps}
            display={(props.display ?? "default") as any}
            onChange={(event, selected) => {
              setPickerVisible(false);
              handleChange(event, selected);
            }}
          />
        )}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <DateTimePicker
        {...pickerProps}
        display={(props.display ?? "spinner") as any}
      />
    </View>
  );
};

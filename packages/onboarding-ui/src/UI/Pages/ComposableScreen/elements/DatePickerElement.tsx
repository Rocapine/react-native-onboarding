import React, { useEffect, useState } from "react";
import { View, Platform } from "react-native";
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
  defaultValue: z.string().optional(),
  minimumDate: z.string().optional(),
  maximumDate: z.string().optional(),
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
  const { variables, setVariable } = ctx;
  const { props } = element;

  const persistedValue = props.variableName ? variables[props.variableName]?.value : undefined;
  const initialDate = persistedValue
    ? new Date(persistedValue)
    : props.defaultValue
    ? new Date(props.defaultValue)
    : new Date();

  const [date, setDate] = useState<Date>(initialDate);
  const mode = props.mode ?? "date";

  useEffect(() => {
    if (props.variableName && persistedValue === undefined) {
      setVariable(props.variableName, {
        value: initialDate.toISOString(),
        label: formatDate(initialDate, mode),
      });
    }
  }, []);

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

  return (
    <View
      style={{
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
        overflow: "hidden",
      }}
    >
      <DateTimePicker
        value={date}
        mode={mode}
        display={(props.display ?? (Platform.OS === "ios" ? "spinner" : "default")) as any}
        onChange={handleChange}
        minimumDate={props.minimumDate ? new Date(props.minimumDate) : undefined}
        maximumDate={props.maximumDate ? new Date(props.maximumDate) : undefined}
        textColor={props.textColor}
        accentColor={props.accentColor}
        locale={props.locale}
      />
    </View>
  );
};

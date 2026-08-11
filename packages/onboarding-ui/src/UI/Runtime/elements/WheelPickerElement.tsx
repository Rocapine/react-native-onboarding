import React, { useEffect, useMemo } from "react";
import { View, Text } from "react-native";
import { resolveWheelPickerItems, useResolvedFontFamily } from "@rocapine/react-native-onboarding";
import { UIElement } from "../types";
import { RenderContext, dim, resolveInheritedFontFamily } from "./shared";
import { useVariables } from "./VariablesContext";

// Lazy load Picker - only needed for WheelPicker elements, peer dep is optional.
let PickerComponent: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PickerModule = require("@react-native-picker/picker");
  PickerComponent = PickerModule.Picker;
} catch {
  PickerComponent = null;
}

type WheelPickerUIElement = Extract<UIElement, { type: "WheelPicker" }>;

type Props = {
  element: WheelPickerUIElement;
  ctx: RenderContext;
};

export const WheelPickerElementComponent = ({ element, ctx }: Props): React.ReactElement => {
  const { theme, setVariable } = ctx;
  const { variables } = useVariables();
  const { props } = element;

  const items = useMemo(() => resolveWheelPickerItems(props), [props]);

  const selectedValue = props.variableName ? variables[props.variableName]?.value : undefined;

  // Seed the variable with the default once, mirroring RadioGroup.
  useEffect(() => {
    if (props.variableName && props.defaultValue !== undefined && selectedValue === undefined) {
      const defaultItem = items.find((i) => i.value === props.defaultValue);
      if (defaultItem) {
        setVariable(props.variableName, { value: defaultItem.value, label: defaultItem.label });
      }
    }
  }, [props.variableName, props.defaultValue, items, selectedValue]);

  const handleChange = (value: string) => {
    if (props.variableName) {
      const item = items.find((i) => i.value === value);
      setVariable(props.variableName, { value, label: item?.label });
    }
  };

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
    backgroundColor: props.backgroundColor,
    opacity: props.opacity,
    overflow: props.overflow,
  } as const;

  const itemColor = props.itemColor ?? theme.colors.text.primary;
  // Fall back to the theme default font so wheel items honor theme typography.
  const itemFontFamily = useResolvedFontFamily(
    resolveInheritedFontFamily(props.itemFontFamily, theme.typography.defaultFontFamily),
    undefined
  );

  if (!PickerComponent) {
    // Peer dep not installed — surface a clear placeholder instead of crashing.
    return (
      <View style={containerStyle}>
        <Text style={{ color: theme.colors.text.secondary }}>
          WheelPicker requires @react-native-picker/picker
        </Text>
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <PickerComponent
        selectedValue={selectedValue ?? items[0]?.value}
        onValueChange={(value: string) => handleChange(String(value))}
        itemStyle={{
          color: itemColor,
          fontSize: props.itemFontSize,
          fontFamily: itemFontFamily,
        }}
      >
        {items.map((item) => (
          <PickerComponent.Item key={item.value} label={item.label} value={item.value} color={itemColor} />
        ))}
      </PickerComponent>
    </View>
  );
};

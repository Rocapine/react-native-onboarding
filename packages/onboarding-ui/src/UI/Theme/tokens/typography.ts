import { TypographyTokens } from "../types";

export const typography = {
  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.3,
    relaxed: 1.4,
  },
  textStyles: {
    heading1: {
      fontSize: 32,
      fontWeight: "600" as const,
      lineHeight: 1.25,
      fontFamily: "Inter",
    },
    heading2: {
      fontSize: 24,
      fontWeight: "600" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    heading3: {
      fontSize: 18,
      fontWeight: "500" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    body: {
      fontSize: 16,
      fontWeight: "400" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    bodyMedium: {
      fontSize: 16,
      fontWeight: "500" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    label: {
      fontSize: 14,
      fontWeight: "500" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    caption: {
      fontSize: 12,
      fontWeight: "400" as const,
      lineHeight: 1.3,
      fontFamily: "Inter",
    },
    button: {
      fontSize: 16,
      fontWeight: "500" as const,
      lineHeight: 1.5,
      fontFamily: "Inter",
    },
  },
  defaultFontFamily: "Inter",
} satisfies TypographyTokens;

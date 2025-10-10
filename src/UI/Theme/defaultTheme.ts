import { Theme } from "./types";
import { lightTokens } from "./tokens/lightTokens";
import { typography } from "./tokens/typography";

/**
 * Default theme that combines light color tokens and typography.
 * This is used as a fallback when no theme is provided to components.
 */
export const defaultTheme: Theme = {
  colors: lightTokens.colors,
  typography: typography,
};

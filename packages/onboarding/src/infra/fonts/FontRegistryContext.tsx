import { createContext, useContext, useMemo } from "react";
import type { FontRegistry } from "./registry";
import { resolveFontFamily } from "./registry";

const FontRegistryContext = createContext<FontRegistry>({});

export const FontRegistryProvider = FontRegistryContext.Provider;

export const useFontRegistry = (): FontRegistry => useContext(FontRegistryContext);

export const useResolvedFontFamily = (
  family: string | null | undefined,
  weight: string | number | null | undefined
): string | undefined => {
  const registry = useFontRegistry();
  return useMemo(() => resolveFontFamily(registry, family, weight), [registry, family, weight]);
};

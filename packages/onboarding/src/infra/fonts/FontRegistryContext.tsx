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

/**
 * Resolves a `family + weight` request to a registered font name. Returns
 * `resolvedToVariant: true` when the registry matched a concrete weighted
 * variant — callers should then suppress `fontWeight` on the rendered Text to
 * avoid synthetic emboldening on top of an already-weighted font file.
 */
export const useResolvedFontStyle = (
  family: string | null | undefined,
  weight: string | number | null | undefined
): {
  fontFamily: string | undefined;
  fontWeight: string | number | undefined;
  resolvedToVariant: boolean;
} => {
  const registry = useFontRegistry();
  return useMemo(() => {
    const fontFamily = resolveFontFamily(registry, family, weight);
    const variants = family ? registry?.[family] : undefined;
    const resolvedToVariant =
      !!variants && fontFamily !== undefined && fontFamily !== family;
    return {
      fontFamily,
      fontWeight: resolvedToVariant ? undefined : (weight ?? undefined),
      resolvedToVariant,
    };
  }, [registry, family, weight]);
};

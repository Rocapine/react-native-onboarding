import { createContext, useContext, useMemo } from "react";
import type { FontRegistry, FontStyleKey } from "./registry";
import { resolveFontFamily } from "./registry";

const FontRegistryContext = createContext<FontRegistry>({});

export const FontRegistryProvider = FontRegistryContext.Provider;

export const useFontRegistry = (): FontRegistry => useContext(FontRegistryContext);

export const useResolvedFontFamily = (
  family: string | null | undefined,
  weight: string | number | null | undefined,
  fontStyle?: FontStyleKey | string | null
): string | undefined => {
  const registry = useFontRegistry();
  return useMemo(
    () => resolveFontFamily(registry, family, weight, fontStyle),
    [registry, family, weight, fontStyle]
  );
};

/**
 * Resolves a `family + weight + style` request to a registered font name.
 * Returns `resolvedToVariant: true` when the registry matched a concrete
 * weighted variant — callers should then suppress `fontWeight` on the rendered
 * Text to avoid synthetic emboldening on top of an already-weighted font file.
 * Pass `fontStyle: "italic"` to select the italic face when one is registered.
 */
export const useResolvedFontStyle = (
  family: string | null | undefined,
  weight: string | number | null | undefined,
  fontStyle?: FontStyleKey | string | null
): {
  fontFamily: string | undefined;
  fontWeight: string | number | undefined;
  resolvedToVariant: boolean;
} => {
  const registry = useFontRegistry();
  return useMemo(() => {
    const fontFamily = resolveFontFamily(registry, family, weight, fontStyle);
    const variants = family ? registry?.[family] : undefined;
    const resolvedToVariant =
      !!variants && fontFamily !== undefined && fontFamily !== family;
    return {
      fontFamily,
      fontWeight: resolvedToVariant ? undefined : (weight ?? undefined),
      resolvedToVariant,
    };
  }, [registry, family, weight, fontStyle]);
};

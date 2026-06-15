import { Platform } from "react-native";
import type {
  FontFamilyManifest,
  FontFamilyManifestInput,
  FontsManifest,
  FontVariantEntry,
  FontWeightKey,
} from "../../types";

export type FontStyleKey = "normal" | "italic";

// One weight bucket can hold both an upright and an italic face.
export type RegisteredFace = Partial<Record<FontStyleKey, string>>;

// family -> weight -> { normal?, italic? } registered (PostScript) names.
export type FontRegistry = Record<string, Record<number, RegisteredFace>>;

const WEIGHT_NAME_TO_NUM: Record<string, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

export const normalizeWeight = (key: FontWeightKey | string | number | undefined): number => {
  if (key === undefined || key === null) return 400;
  if (typeof key === "number") return key;
  const named = WEIGHT_NAME_TO_NUM[key];
  if (named) return named;
  const parsed = parseInt(key, 10);
  return Number.isFinite(parsed) ? parsed : 400;
};

export const normalizeStyle = (style: string | undefined | null): FontStyleKey =>
  style === "italic" ? "italic" : "normal";

// Font families whose internal name collides with the iOS system font (SF Pro).
// Registering custom faces under one of these names makes iOS give the system
// font precedence, so only Regular resolves — every other weight renders tofu.
// On iOS we skip registering them and resolve to `fontFamily: undefined` so RN
// uses the real system font (which *is* SF Pro) honoring `fontWeight`. On
// Android (no SF Pro system font) the bundled faces register normally.
const SYSTEM_FONT_FAMILIES = new Set<string>([
  "system",
  "sfpro",
  "sfprodisplay",
  "sfprotext",
  "sfprorounded",
  "sfuidisplay",
  "sfuitext",
]);

const normalizeFamilyKey = (family: string): string =>
  family.toLowerCase().replace(/[\s_.-]+/g, "");

// True when `family` names a platform system font that must NOT be registered as
// a bundled face on iOS (see SYSTEM_FONT_FAMILIES). Always false on other
// platforms — only iOS has the SF Pro collision.
export const isSystemFontFamily = (family: string | null | undefined): boolean => {
  if (!family || Platform.OS !== "ios") return false;
  return SYSTEM_FONT_FAMILIES.has(normalizeFamilyKey(family));
};

// The registered (PostScript) name is the font file's base name, without
// directory, query string, or extension — e.g. ".../Inter-SemiBold.ttf?v=2"
// registers as "Inter-SemiBold".
const buildRegisteredName = (url: string): string => {
  const path = url.split(/[?#]/)[0];
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.[^.]+$/, "");
};

let expoFontWarned = false;
const loadExpoFont = (): typeof import("expo-font") | null => {
  try {
    return require("expo-font");
  } catch {
    if (!expoFontWarned) {
      console.warn(
        "[onboarding] `fonts` manifest provided but `expo-font` is not installed. Skipping runtime font registration."
      );
      expoFontWarned = true;
    }
    return null;
  }
};

type NormalizedVariant = { weight: number; style: FontStyleKey; url: string };

const normalizeFamilyVariants = (input: FontFamilyManifestInput | undefined): NormalizedVariant[] => {
  if (!input) return [];

  if (Array.isArray(input)) {
    // Key by weight+style so an italic face is never overwritten by the upright
    // face at the same weight (and vice-versa). Last entry wins on exact dup.
    const byKey = new Map<string, NormalizedVariant>();
    for (const entry of input as FontVariantEntry[]) {
      if (!entry || typeof entry.url !== "string" || !entry.url) continue;
      const weight = normalizeWeight(entry.weight as FontWeightKey | number);
      const style = normalizeStyle(entry.style);
      byKey.set(`${weight}-${style}`, { weight, style, url: entry.url });
    }
    return Array.from(byKey.values());
  }

  const out: NormalizedVariant[] = [];
  for (const [weightKey, url] of Object.entries(input as FontFamilyManifest)) {
    if (typeof url !== "string" || !url) continue;
    out.push({ weight: normalizeWeight(weightKey as FontWeightKey), style: "normal", url });
  }
  return out;
};

export const registerFonts = async (manifest: FontsManifest | undefined): Promise<FontRegistry> => {
  const registry: FontRegistry = {};
  if (!manifest || Object.keys(manifest).length === 0) return registry;

  const Font = loadExpoFont();
  if (!Font) return registry;

  const loads: Array<Promise<void>> = [];

  for (const [family, variantsInput] of Object.entries(manifest)) {
    // Don't register a system-font family's bundled faces on iOS — resolution
    // returns `fontFamily: undefined` for it so the real system font is used.
    if (isSystemFontFamily(family)) continue;

    const variants = normalizeFamilyVariants(variantsInput);
    if (variants.length === 0) continue;
    registry[family] = registry[family] ?? {};

    for (const { weight, style, url } of variants) {
      const registeredName = buildRegisteredName(url);
      const bucket = (registry[family][weight] = registry[family][weight] ?? {});
      bucket[style] = registeredName;

      loads.push(
        Font.loadAsync({ [registeredName]: { uri: url } as any }).catch((error: unknown) => {
          console.warn(
            `[onboarding] Failed to load font "${family}" weight ${weight} (${style}) from ${url}:`,
            error
          );
          const b = registry[family]?.[weight];
          if (b) {
            delete b[style];
            if (Object.keys(b).length === 0) delete registry[family][weight];
          }
        })
      );
    }
  }

  await Promise.all(loads);
  return registry;
};

// Picks the requested style from a weight bucket, falling back to the other
// style when the requested one isn't available at that weight.
const pickFace = (
  face: RegisteredFace | undefined,
  style: FontStyleKey
): string | undefined => (face ? (face[style] ?? face.normal ?? face.italic) : undefined);

export const resolveFontFamily = (
  registry: FontRegistry | null | undefined,
  family: string | null | undefined,
  weight: string | number | null | undefined,
  fontStyle?: FontStyleKey | string | null
): string | undefined => {
  if (!family) return undefined;
  // System font on iOS: let RN resolve the real system font from fontWeight.
  if (isSystemFontFamily(family)) return undefined;
  if (!registry) return family;
  const variants = registry[family];
  if (!variants) return family;

  const style = normalizeStyle(fontStyle);
  const requested = normalizeWeight(weight as FontWeightKey | undefined);

  const exact = pickFace(variants[requested], style);
  if (exact) return exact;

  const available = Object.keys(variants)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  if (available.length === 0) return family;

  let best = available[0];
  let bestDelta = Math.abs(best - requested);
  for (const candidate of available) {
    const delta = Math.abs(candidate - requested);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }
  return pickFace(variants[best], style) ?? family;
};

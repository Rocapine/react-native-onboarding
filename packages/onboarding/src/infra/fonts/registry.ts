import type {
  FontFamilyManifest,
  FontFamilyManifestInput,
  FontsManifest,
  FontVariantEntry,
  FontWeightKey,
} from "../../types";

export type FontRegistry = Record<string, Record<number, string>>;

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

const buildRegisteredName = (family: string, weight: number) => `${family}-${weight}`;

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

type NormalizedVariant = { weight: number; url: string };

const normalizeFamilyVariants = (input: FontFamilyManifestInput | undefined): NormalizedVariant[] => {
  if (!input) return [];

  if (Array.isArray(input)) {
    const byWeight = new Map<number, NormalizedVariant>();
    for (const entry of input as FontVariantEntry[]) {
      if (!entry || typeof entry.url !== "string" || !entry.url) continue;
      const weight = normalizeWeight(entry.weight as FontWeightKey | number);
      const existing = byWeight.get(weight);
      const isNormalStyle = !entry.style || entry.style === "normal";
      if (!existing || isNormalStyle) {
        byWeight.set(weight, { weight, url: entry.url });
      }
    }
    return Array.from(byWeight.values());
  }

  const out: NormalizedVariant[] = [];
  for (const [weightKey, url] of Object.entries(input as FontFamilyManifest)) {
    if (typeof url !== "string" || !url) continue;
    out.push({ weight: normalizeWeight(weightKey as FontWeightKey), url });
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
    const variants = normalizeFamilyVariants(variantsInput);
    if (variants.length === 0) continue;
    registry[family] = registry[family] ?? {};

    for (const { weight, url } of variants) {
      const registeredName = buildRegisteredName(family, weight);
      registry[family][weight] = registeredName;

      loads.push(
        Font.loadAsync({ [registeredName]: { uri: url } as any }).catch((error: unknown) => {
          console.warn(
            `[onboarding] Failed to load font "${family}" weight ${weight} from ${url}:`,
            error
          );
          delete registry[family][weight];
        })
      );
    }
  }

  await Promise.all(loads);
  return registry;
};

export const resolveFontFamily = (
  registry: FontRegistry | null | undefined,
  family: string | null | undefined,
  weight: string | number | null | undefined
): string | undefined => {
  if (!family) return undefined;
  if (!registry) return family;
  const variants = registry[family];
  if (!variants) return family;

  const requested = normalizeWeight(weight as FontWeightKey | undefined);
  const exact = variants[requested];
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
  return variants[best];
};

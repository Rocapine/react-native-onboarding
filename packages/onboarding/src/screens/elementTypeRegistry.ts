import { UIElementSchema } from "./types";

/**
 * The element `type` names this SDK build knows, and the key sets each of them
 * accepts — read off `UIElementSchema` itself at runtime rather than hardcoded,
 * so nothing here can drift as elements are added.
 *
 * Two consumers, deliberately sharing one derivation: `unknownKeys.ts` (which
 * keys it needs) and `unknownElementTypes.ts` (which *types* exist at all).
 * They used to be able to disagree about what "known" means, which for a
 * forward-compatibility strip is not a cosmetic risk: a type the strip thinks
 * is unknown is a type the app silently refuses to render.
 */
export type ElementKeySets = { topLevel: Set<string>; props: Set<string> };

const zdef = (schema: any): any => schema?._zod?.def ?? schema?._def;

// Every string literal a `type` field can hold. Variants use `z.literal("X")`;
// a `z.union([literal, literal])` is tolerated for robustness.
const literalsOf = (schema: any): string[] => {
  const def = zdef(schema);
  if (!def) return [];
  if (def.type === "literal") {
    const values = def.values ?? (def.value !== undefined ? [def.value] : []);
    return values.filter((v: unknown): v is string => typeof v === "string");
  }
  if (def.type === "union") return (def.options ?? []).flatMap(literalsOf);
  return [];
};

let registry: Map<string, ElementKeySets> | null = null;

/**
 * Built once, lazily. Any shape change in zod's internals degrades to an EMPTY
 * registry, which every caller must read as "learn nothing" rather than "reject
 * everything" — this is a diagnostic and a forward-compat aid, it must never be
 * able to break rendering.
 */
export const getElementRegistry = (): Map<string, ElementKeySets> => {
  if (registry) return registry;
  const built = new Map<string, ElementKeySets>();
  try {
    const lazyDef = zdef(UIElementSchema);
    const union = typeof lazyDef?.getter === "function" ? lazyDef.getter() : UIElementSchema;
    const options = zdef(union)?.options ?? [];
    for (const option of options) {
      const shape = zdef(option)?.shape;
      if (!shape) continue;
      const propsShape = zdef(shape.props)?.shape ?? {};
      const keySets: ElementKeySets = {
        topLevel: new Set(Object.keys(shape)),
        props: new Set(Object.keys(propsShape)),
      };
      for (const typeName of literalsOf(shape.type)) built.set(typeName, keySets);
    }
  } catch {
    // fall through to whatever was built before the failure
  }
  registry = built;
  return registry;
};

/** Every element `type` this build can parse. Empty means "could not tell". */
export const getKnownElementTypes = (): ReadonlySet<string> => new Set(getElementRegistry().keys());

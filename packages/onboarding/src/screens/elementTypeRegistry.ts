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

/**
 * The derivation itself, over ANY element union — this package's, or another
 * package's re-declared mirror of it.
 *
 * Kept schema-agnostic because the onboarding-ui package has to derive its own
 * capability set rather than inherit this one's: it re-declares its own
 * `UIElementSchema`, that mirror is what actually parses and renders an element
 * tree, and the peer-dependency range between the two packages lets a host
 * resolve different versions of them. Sharing the mechanism but not the answer
 * is the point — one place that knows how to read a discriminated union, two
 * honest answers about two schemas.
 */
const buildElementRegistry = (schema: unknown): Map<string, ElementKeySets> => {
  const built = new Map<string, ElementKeySets>();
  try {
    const lazyDef = zdef(schema);
    const union = typeof lazyDef?.getter === "function" ? lazyDef.getter() : schema;
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
  return built;
};

/**
 * Every element `type` a given element union declares. EMPTY means "could not
 * tell" — zod internals moved, or this is not an element union — and every
 * caller must read it as "learn nothing" rather than "reject everything", which
 * would blank every screen in every app.
 */
export const deriveElementTypeNames = (schema: unknown): ReadonlySet<string> =>
  new Set(buildElementRegistry(schema).keys());

let registry: Map<string, ElementKeySets> | null = null;

/**
 * Built once, lazily, from THIS package's schema. Any shape change in zod's
 * internals degrades to an EMPTY registry, read as "learn nothing" — this is a
 * diagnostic and a forward-compat aid, it must never be able to break rendering.
 */
export const getElementRegistry = (): Map<string, ElementKeySets> => {
  if (registry) return registry;
  registry = buildElementRegistry(UIElementSchema);
  return registry;
};

/** Every element `type` this build can parse. Empty means "could not tell". */
export const getKnownElementTypes = (): ReadonlySet<string> => new Set(getElementRegistry().keys());

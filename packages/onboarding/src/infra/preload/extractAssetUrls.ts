import type { BaseStepType, Onboarding } from "../../types";

/**
 * A remote asset referenced somewhere in an onboarding payload.
 *
 * `kind` selects how {@link preloadAssets} warms it:
 * - `image`     → native image prefetch (expo-image / RN Image)
 * - `image-svg` → HTTP-cache warm (SvgUri fetches the XML itself; native image
 *                 prefetch can't decode SVG)
 * - `video` / `lottie` / `rive` → HTTP-cache warm
 */
export type AssetKind = "image" | "image-svg" | "video" | "lottie" | "rive";

export interface AssetRef {
  url: string;
  kind: AssetKind;
}

// `.svg` path-extension detection, query/hash tolerant. Mirrors the local
// `isSvgUrl` in onboarding-ui's ImageElement.tsx (not exported from UI).
const isSvgUrl = (url: string): boolean =>
  url.split(/[?#]/)[0].toLowerCase().endsWith(".svg");

// MediaSource.type → AssetKind. Images get re-tagged to `image-svg` by the
// caller when the url is an SVG.
const mediaTypeToKind = (type: unknown): AssetKind => {
  switch (type) {
    case "video":
      return "video";
    case "lottie":
      return "lottie";
    case "rive":
      return "rive";
    default:
      return "image";
  }
};

// An unresolved `{{var}}` placeholder. Such a url is a TEMPLATE, not an address:
// prefetching it would fire a request for a literal "https://cdn/{{sign}}.png"
// that always 404s, and the real url isn't knowable until the variable resolves.
const hasPlaceholder = (url: string): boolean => url.includes("{{");

// Push a url with kind, re-tagging SVG images so the runner HTTP-warms them.
const pushAsset = (out: AssetRef[], url: unknown, kind: AssetKind): void => {
  if (typeof url !== "string" || url.length === 0) return;
  // Skip templates. Reached by an `Image` with `mode: "expression"`, and by the
  // template inside a `Repeat` (whose per-row urls are pushed separately, below,
  // where the row data makes them resolvable).
  if (hasPlaceholder(url)) return;
  const finalKind: AssetKind = kind === "image" && isSvgUrl(url) ? "image-svg" : kind;
  out.push({ url, kind: finalKind });
};

// Resolve `{{scope.field}}` against one Repeat row. Only the row scope is
// substituted — anything referencing a runtime variable stays a placeholder and
// is dropped by `pushAsset`, which is correct: it still isn't knowable up front.
const resolveRowUrl = (url: string, row: Record<string, unknown>, scope: string): string =>
  url.replace(/\{\{([^}]+?)\}\}/g, (match, key: string) => {
    const trimmed = key.trim();
    if (!trimmed.startsWith(`${scope}.`)) return match;
    const value = row[trimmed.slice(scope.length + 1)];
    return value == null ? match : String(value);
  });

// A `{ type, url }` MediaSource is remote (prefetchable); a `{ type, localPathId }`
// MediaSource is a bundled asset — skip it.
const pushMediaSource = (out: AssetRef[], media: any): void => {
  if (!media || typeof media !== "object") return;
  if (typeof media.url !== "string") return; // localPathId variant or malformed
  pushAsset(out, media.url, mediaTypeToKind(media.type));
};

// Walk a ComposableScreen UIElement tree. Asset-bearing element types pull their
// url/source prop; container types recurse into the top-level `children` array
// (sibling of `props`, per the UIElement schema — NOT `props.children`).
const walkElement = (out: AssetRef[], element: any): void => {
  if (!element || typeof element !== "object") return;
  const props = element.props ?? {};

  switch (element.type) {
    case "Image":
    case "ProgressiveBlurImage":
      pushAsset(out, props.url, "image");
      break;
    case "Video":
      pushAsset(out, props.url, "video");
      break;
    case "Lottie":
      pushAsset(out, props.source, "lottie");
      break;
    case "Rive":
      pushAsset(out, props.url, "rive");
      break;
    default:
      break;
  }

  // A `Repeat` renders its template once per row, so the assets it actually
  // shows are the template's url props resolved against each row — the template
  // string itself is unfetchable and was skipped above. Walk the template once
  // per row with the row substituted in, so repeated media still preloads.
  if (element.type === "Repeat" && Array.isArray(props.data)) {
    const scope = typeof props.as === "string" && props.as ? props.as : "item";
    for (const row of props.data) {
      if (!row || typeof row !== "object") continue;
      const resolved: AssetRef[] = [];
      if (Array.isArray(element.children)) {
        for (const child of element.children) walkElementWithRow(resolved, child, row, scope);
      }
      out.push(...resolved);
    }
    return;
  }

  if (Array.isArray(element.children)) {
    for (const child of element.children) walkElement(out, child);
  }
};

// `walkElement`, but url props are resolved against a Repeat row first. Separate
// from `walkElement` so the ordinary path stays allocation-free.
const walkElementWithRow = (
  out: AssetRef[],
  element: any,
  row: Record<string, unknown>,
  scope: string
): void => {
  if (!element || typeof element !== "object") return;
  const props = element.props ?? {};
  const resolve = (u: unknown) => (typeof u === "string" ? resolveRowUrl(u, row, scope) : u);

  switch (element.type) {
    case "Image":
    case "ProgressiveBlurImage":
      pushAsset(out, resolve(props.url), "image");
      break;
    case "Video":
      pushAsset(out, resolve(props.url), "video");
      break;
    case "Lottie":
      pushAsset(out, resolve(props.source), "lottie");
      break;
    case "Rive":
      pushAsset(out, resolve(props.url), "rive");
      break;
    default:
      break;
  }

  if (Array.isArray(element.children)) {
    for (const child of element.children) walkElementWithRow(out, child, row, scope);
  }
};

// Collect every remote asset from one step. Defensive: a malformed step throws
// here and is swallowed by the per-step guard in extractAssetUrls.
const extractFromStep = (out: AssetRef[], step: BaseStepType): void => {
  const payload: any = step.payload;
  if (!payload) return;

  switch (step.type) {
    case "ComposableScreen":
      if (Array.isArray(payload.elements)) {
        for (const el of payload.elements) walkElement(out, el);
      }
      break;
    case "MediaContent":
      pushMediaSource(out, payload.mediaSource);
      break;
    case "Carousel":
      if (Array.isArray(payload.screens)) {
        for (const screen of payload.screens) pushAsset(out, screen?.mediaUrl, "image");
      }
      break;
    case "Loader":
      if (Array.isArray(payload.didYouKnowImages)) {
        for (const media of payload.didYouKnowImages) pushMediaSource(out, media);
      }
      break;
    default:
      break;
  }
};

/**
 * Extract every remote asset referenced by an onboarding payload, deduped by url.
 *
 * Covers ComposableScreen element trees (Image / ProgressiveBlurImage / Video /
 * Lottie / Rive, recursing through container children), MediaContent, Carousel,
 * and Loader. Bundled assets (MediaSource `localPathId`) are skipped — only
 * remote `url`s are returned.
 *
 * Pure and side-effect free; safe to call on partial/malformed payloads (each
 * step is guarded independently).
 */
export const extractAssetUrls = <StepType extends BaseStepType>(
  onboarding: Onboarding<StepType> | null | undefined
): AssetRef[] => {
  const steps = onboarding?.steps;
  if (!Array.isArray(steps)) return [];

  const collected: AssetRef[] = [];
  for (const step of steps) {
    try {
      extractFromStep(collected, step);
    } catch {
      // One malformed step must not abort preloading the rest.
    }
  }

  // Dedupe by url (first kind seen wins).
  const seen = new Set<string>();
  const deduped: AssetRef[] = [];
  for (const asset of collected) {
    if (seen.has(asset.url)) continue;
    seen.add(asset.url);
    deduped.push(asset);
  }
  return deduped;
};

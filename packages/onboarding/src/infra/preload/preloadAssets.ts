import { Image as RNImage } from "react-native";
import type { AssetRef } from "./extractAssetUrls";

declare const __DEV__: boolean;

// expo-image (optional peer dep) gives reliable cross-platform image caching.
// Require-guarded exactly like onboarding-ui's ImageElement — fall back to RN
// Image.prefetch when absent.
let ExpoImage: { prefetch?: (urls: string | string[]) => Promise<unknown> } | null = null;
try {
  ExpoImage = require("expo-image").Image;
} catch {
  // expo-image not installed — RN Image.prefetch fallback below.
}

// Cap concurrent HTTP-warm fetches so we don't saturate the connection while the
// user is interacting with the first screen.
const FETCH_CONCURRENCY = 4;

// Warm the OS/CDN HTTP cache for a non-image asset. expo-video /
// lottie-react-native / rive-react-native / SvgUri all load from the URL at
// mount, so a cached response makes them appear instantly. For video we abort
// after the first chunk to avoid pulling the whole file into memory.
const warmHttpCache = async (ref: AssetRef): Promise<void> => {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : undefined;
  try {
    const res = await fetch(ref.url, controller ? { signal: controller.signal } : undefined);
    if (ref.kind === "video") {
      // Touch the body so the request is real, then abort — establishes the
      // connection and warms the CDN edge without downloading the full video.
      controller?.abort();
      return;
    }
    // Drain small JSON/binary/SVG bodies fully so they land in the cache.
    if (typeof res.arrayBuffer === "function") await res.arrayBuffer();
  } catch {
    // Best-effort: aborted reads and network errors are expected and silent.
  }
};

// Run thunks with bounded concurrency.
const runPool = (thunks: Array<() => Promise<void>>, limit: number): void => {
  let i = 0;
  const next = (): void => {
    if (i >= thunks.length) return;
    const thunk = thunks[i++];
    thunk().finally(next);
  };
  for (let n = 0; n < Math.min(limit, thunks.length); n++) next();
};

/**
 * Fire-and-forget background prefetch of onboarding assets. Returns immediately;
 * all work is async and best-effort (failures are swallowed). Safe to call with
 * an empty list.
 *
 * - `image`   → native prefetch via expo-image (batched) or RN Image.prefetch.
 * - everything else → HTTP-cache warm via `fetch`, concurrency-capped.
 */
export const preloadAssets = (assets: AssetRef[]): void => {
  if (!assets || assets.length === 0) return;

  const imageUrls: string[] = [];
  const warmThunks: Array<() => Promise<void>> = [];

  for (const asset of assets) {
    if (asset.kind === "image") imageUrls.push(asset.url);
    else warmThunks.push(() => warmHttpCache(asset));
  }

  // Images: prefer expo-image's batch prefetch; otherwise RN per-url.
  if (imageUrls.length > 0) {
    try {
      if (ExpoImage?.prefetch) {
        Promise.resolve(ExpoImage.prefetch(imageUrls)).catch(() => {});
      } else {
        for (const url of imageUrls) {
          Promise.resolve(RNImage.prefetch(url)).catch(() => {});
        }
      }
    } catch {
      // Prefetch unavailable — silent no-op.
    }
  }

  // Non-image assets: bounded HTTP-cache warming.
  if (warmThunks.length > 0) runPool(warmThunks, FETCH_CONCURRENCY);

  if (typeof __DEV__ !== "undefined" && __DEV__) {
    // eslint-disable-next-line no-console
    console.info(
      `[onboarding] preloading ${imageUrls.length} image(s) + ${warmThunks.length} other asset(s)`
    );
  }
};

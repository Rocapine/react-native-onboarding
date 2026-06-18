import { describe, it, expect } from "vitest";
import { extractAssetUrls, type AssetRef } from "../infra/preload/extractAssetUrls";

// Helper: wrap steps in a minimal Onboarding-shaped object.
const onb = (steps: any[]) => ({ steps }) as any;

const byUrl = (assets: AssetRef[]) =>
  Object.fromEntries(assets.map((a) => [a.url, a.kind]));

describe("extractAssetUrls — ComposableScreen element tree", () => {
  it("pulls url/source from leaf asset elements with correct kinds", () => {
    const step = {
      type: "ComposableScreen",
      payload: {
        elements: [
          { type: "Image", props: { url: "https://cdn/img.png" } },
          { type: "ProgressiveBlurImage", props: { url: "https://cdn/blur.jpg" } },
          { type: "Video", props: { url: "https://cdn/clip.mp4" } },
          { type: "Lottie", props: { source: "https://cdn/anim.json" } },
          { type: "Rive", props: { url: "https://cdn/anim.riv" } },
          { type: "Text", props: { content: "no asset" } },
        ],
      },
    };
    expect(byUrl(extractAssetUrls(onb([step])))).toEqual({
      "https://cdn/img.png": "image",
      "https://cdn/blur.jpg": "image",
      "https://cdn/clip.mp4": "video",
      "https://cdn/anim.json": "lottie",
      "https://cdn/anim.riv": "rive",
    });
  });

  it("recurses into nested container children", () => {
    const step = {
      type: "ComposableScreen",
      payload: {
        elements: [
          {
            type: "YStack",
            props: {},
            children: [
              { type: "Image", props: { url: "https://cdn/a.png" } },
              {
                type: "ScrollView",
                props: {},
                children: [{ type: "Video", props: { url: "https://cdn/deep.mp4" } }],
              },
            ],
          },
        ],
      },
    };
    const assets = extractAssetUrls(onb([step]));
    expect(assets.map((a) => a.url).sort()).toEqual([
      "https://cdn/a.png",
      "https://cdn/deep.mp4",
    ]);
  });

  it("tags .svg image urls as image-svg (query/hash tolerant)", () => {
    const step = {
      type: "ComposableScreen",
      payload: {
        elements: [
          { type: "Image", props: { url: "https://cdn/icon.svg" } },
          { type: "Image", props: { url: "https://cdn/icon2.svg?v=2#frag" } },
        ],
      },
    };
    const kinds = extractAssetUrls(onb([step])).map((a) => a.kind);
    expect(kinds).toEqual(["image-svg", "image-svg"]);
  });
});

describe("extractAssetUrls — other step types", () => {
  it("MediaContent: uses MediaSource.type as kind, skips localPathId", () => {
    const steps = [
      { type: "MediaContent", payload: { mediaSource: { type: "video", url: "https://cdn/m.mp4" } } },
      { type: "MediaContent", payload: { mediaSource: { type: "image", localPathId: "bundled-1" } } },
      { type: "MediaContent", payload: { mediaSource: { type: "lottie", url: "https://cdn/m.json" } } },
    ];
    expect(byUrl(extractAssetUrls(onb(steps)))).toEqual({
      "https://cdn/m.mp4": "video",
      "https://cdn/m.json": "lottie",
    });
  });

  it("Carousel: screens[].mediaUrl as images", () => {
    const step = {
      type: "Carousel",
      payload: {
        screens: [
          { mediaUrl: "https://cdn/c1.png", title: "a" },
          { mediaUrl: "https://cdn/c2.png", title: "b" },
        ],
      },
    };
    expect(byUrl(extractAssetUrls(onb([step])))).toEqual({
      "https://cdn/c1.png": "image",
      "https://cdn/c2.png": "image",
    });
  });

  it("Loader: didYouKnowImages MediaSource array, skips localPathId", () => {
    const step = {
      type: "Loader",
      payload: {
        title: "t",
        steps: [],
        didYouKnowImages: [
          { type: "image", url: "https://cdn/dyk.png" },
          { type: "image", localPathId: "bundled-2" },
        ],
      },
    };
    expect(byUrl(extractAssetUrls(onb([step])))).toEqual({
      "https://cdn/dyk.png": "image",
    });
  });
});

describe("extractAssetUrls — robustness", () => {
  it("dedupes repeated urls (first kind wins)", () => {
    const step = {
      type: "ComposableScreen",
      payload: {
        elements: [
          { type: "Image", props: { url: "https://cdn/dup.png" } },
          { type: "Image", props: { url: "https://cdn/dup.png" } },
        ],
      },
    };
    expect(extractAssetUrls(onb([step]))).toEqual([
      { url: "https://cdn/dup.png", kind: "image" },
    ]);
  });

  it("skips empty/missing urls", () => {
    const step = {
      type: "ComposableScreen",
      payload: {
        elements: [
          { type: "Image", props: { url: "" } },
          { type: "Image", props: {} },
          { type: "Lottie", props: { source: null } },
        ],
      },
    };
    expect(extractAssetUrls(onb([step]))).toEqual([]);
  });

  it("returns [] for null/empty/malformed onboarding", () => {
    expect(extractAssetUrls(null)).toEqual([]);
    expect(extractAssetUrls(undefined)).toEqual([]);
    expect(extractAssetUrls(onb([]))).toEqual([]);
    expect(extractAssetUrls({ steps: "not-array" } as any)).toEqual([]);
  });

  it("one malformed step does not abort extraction of the rest", () => {
    const steps = [
      { type: "ComposableScreen", get payload(): any { throw new Error("boom"); } },
      { type: "Image", payload: undefined },
      { type: "MediaContent", payload: { mediaSource: { type: "image", url: "https://cdn/ok.png" } } },
    ];
    expect(byUrl(extractAssetUrls(onb(steps)))).toEqual({
      "https://cdn/ok.png": "image",
    });
  });
});

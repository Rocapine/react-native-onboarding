// Optional peer dep: expo-haptics. Mirrors the dynamic-require pattern used by
// Ratings (expo-store-review) and GradientBox (expo-linear-gradient) — graceful,
// never throws. Not installed → no-op. "none"/undefined → no-op.
let Haptics: any;
try {
  Haptics = require("expo-haptics");
} catch {
  Haptics = null;
}

export type HapticStyle = "none" | "light" | "medium" | "heavy" | "soft" | "rigid";

export function triggerHaptic(style?: HapticStyle): void {
  if (!style || style === "none" || !Haptics?.impactAsync) return;
  const map: Record<Exclude<HapticStyle, "none">, any> = {
    light: Haptics.ImpactFeedbackStyle.Light,
    medium: Haptics.ImpactFeedbackStyle.Medium,
    heavy: Haptics.ImpactFeedbackStyle.Heavy,
    soft: Haptics.ImpactFeedbackStyle.Soft,
    rigid: Haptics.ImpactFeedbackStyle.Rigid,
  };
  // Best-effort: swallow rejection (unsupported device, etc.).
  Haptics.impactAsync(map[style]).catch(() => {});
}

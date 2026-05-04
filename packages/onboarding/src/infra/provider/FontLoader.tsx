import { useEffect, useState } from "react";
import type { FontsManifest } from "../../types";
import { FontRegistryProvider } from "../fonts/FontRegistryContext";
import { registerFonts, type FontRegistry } from "../fonts/registry";

interface FontLoaderGateProps {
  fonts: FontsManifest | undefined;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const FontLoaderGate = ({ fonts, fallback = null, children }: FontLoaderGateProps) => {
  const hasFonts = !!fonts && Object.keys(fonts).length > 0;
  const [registry, setRegistry] = useState<FontRegistry | null>(hasFonts ? null : {});

  useEffect(() => {
    if (!hasFonts) {
      setRegistry({});
      return;
    }
    let cancelled = false;
    setRegistry(null);
    registerFonts(fonts)
      .then((result) => {
        if (!cancelled) setRegistry(result);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[onboarding] Font registration failed:", err);
          setRegistry({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fonts, hasFonts]);

  if (registry === null) return <>{fallback}</>;
  return <FontRegistryProvider value={registry}>{children}</FontRegistryProvider>;
};

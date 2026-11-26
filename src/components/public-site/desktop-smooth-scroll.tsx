"use client";

import { ReactLenis } from "lenis/react";
import { useEffect, useState, type ReactNode } from "react";

export function DesktopSmoothScroll({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px) and (hover: hover) and (pointer: fine)");
    const motion = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(desktop.matches && motion.matches);

    update();
    desktop.addEventListener("change", update);
    motion.addEventListener("change", update);
    return () => {
      desktop.removeEventListener("change", update);
      motion.removeEventListener("change", update);
    };
  }, []);

  if (!enabled) return children;

  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}

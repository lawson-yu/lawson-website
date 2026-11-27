"use client";

import { ReactLenis, useLenis } from "lenis/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

const ARTICLE_RETURN_FOCUS_KEY = "lawson:article-return-slug";

function ScrollToTopOnNavigate() {
  const pathname = usePathname();
  const lenis = useLenis();
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;

    if (window.location.hash) return;
    try {
      if (window.sessionStorage.getItem(ARTICLE_RETURN_FOCUS_KEY)) return;
    } catch {
      // sessionStorage 不可用时照常回到顶部。
    }

    if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, lenis]);

  return null;
}

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

  if (!enabled) {
    return (
      <>
        <ScrollToTopOnNavigate />
        {children}
      </>
    );
  }

  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      <ScrollToTopOnNavigate />
      {children}
    </ReactLenis>
  );
}

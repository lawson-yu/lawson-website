import type { useLenis } from "lenis/react";

type LenisInstance = ReturnType<typeof useLenis>;
type ScrollTo = (top: number, immediate?: boolean) => void;

export function scrollPageTo(lenis: LenisInstance, top: number, immediate = false) {
  const instant = immediate || matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lenis) {
    lenis.scrollTo(top, { immediate: instant, duration: 0.75, easing: (value) => 1 - (1 - value) ** 4 });
  } else {
    window.scrollTo({
      top,
      behavior: instant ? "auto" : "smooth",
    });
  }
}

export function cancelPageScroll(lenis: LenisInstance) {
  lenis?.stop();
  lenis?.start();
}

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

export function articleScroll(offset: number, height: number, count: number) {
  const start = 0.8 * height;
  const step = 0.5 * height;
  const raw = (offset - start) / step;
  const progress = clamp(raw, 0, count - 1);
  const nearest = Math.round(raw);
  const snap = raw >= 0 && raw <= count - 1 && Math.abs(raw - nearest) <= 0.12
    ? start + nearest * step
    : null;
  const exit = start + (count - 1) * step + 0.2 * height;
  const reveal = clamp((offset / height - 0.5) / 0.3) * (1 - clamp((offset - exit) / (0.3 * height)));
  return { progress, reveal, snap };
}

export function createShowcaseMotion(
  root: HTMLElement,
  track: HTMLElement,
  onChange: (index: number) => void,
  scrollTo: ScrollTo,
  cancelScroll: () => void,
) {
  const panels = [...track.children] as HTMLElement[];
  const media = matchMedia("(min-width: 768px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)");
  let active = 0;
  let frame = 0;
  let driving = false;
  let lastWheel = -Infinity;
  let direction = 0;
  let amount = 0;
  let latched = false;

  const stepped = () => media.matches && panels.length > 1;
  const show = (index: number, immediate = false) => {
    active = index;
    root.dataset.active = String(index);
    onChange(index);
    panels.forEach((panel, i) => {
      panel.inert = stepped() && i !== index;
      if (stepped() && i !== index) panel.setAttribute("aria-hidden", "true");
      else panel.removeAttribute("aria-hidden");
    });
    track.style.transition = stepped() && !immediate ? "transform 650ms cubic-bezier(.16, 1, .3, 1)" : "none";
    track.style.transform = stepped() ? `translate3d(0, ${-index * 100}%, 0)` : "";
  };
  const anchor = (index: number) => {
    const top = root.getBoundingClientRect().top + window.scrollY;
    return top + (index === panels.length - 1 ? (index - 0.5) * window.innerHeight + 4 : index * window.innerHeight);
  };
  const select = (index: number) => {
    if (index < 0 || index >= panels.length) return;
    if (!stepped()) {
      show(index);
      panels[index].scrollIntoView({ behavior: "auto", block: "center" });
      return;
    }
    show(index);
    driving = true;
    scrollTo(anchor(index));
  };
  const update = () => {
    frame = 0;
    if (!stepped()) return;
    const offset = -root.getBoundingClientRect().top;
    if (driving) {
      if (Math.abs(window.scrollY - anchor(active)) < 2 || offset < -2 || offset > (panels.length - 1) * window.innerHeight + 2) driving = false;
      else return;
    }
    const index = Math.max(0, Math.min(panels.length - 1, Math.round(offset / window.innerHeight)));
    if (index !== active) show(index);
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
  const configure = () => {
    if (driving) cancelScroll();
    driving = latched = false;
    root.dataset.stepped = String(stepped());
    const index = stepped() ? Math.max(0, Math.min(panels.length - 1, Math.round(-root.getBoundingClientRect().top / window.innerHeight))) : active;
    show(index, true);
  };
  const interrupt = () => {
    cancelScroll();
    driving = false;
    latched = false;
  };
  const wheel = (event: WheelEvent) => {
    if (!stepped() || event.ctrlKey || !event.cancelable || Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.deltaY === 0) return;
    if (!(event.target instanceof Element) || !root.contains(event.target)) return;
    if (event.target.closest("input, textarea, select, [contenteditable=true], [role=dialog], [data-lenis-prevent]")) return;
    const now = performance.now();
    const sign = Math.sign(event.deltaY);
    const fresh = now - lastWheel > 180 || sign !== direction;
    lastWheel = now;
    direction = sign;
    const rect = root.getBoundingClientRect();
    if (rect.top > 2 || rect.bottom < window.innerHeight - 2) { latched = true; amount = 0; return; }
    if (fresh) { latched = false; amount = 0; }
    const next = active + sign;
    if (!latched && (next < 0 || next >= panels.length)) { interrupt(); return; }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (latched) return;
    amount += Math.abs(event.deltaY) * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
    if (event.deltaMode === 0 && amount < 32) return;
    latched = true;
    select(next);
  };

  configure();
  media.addEventListener("change", configure);
  window.addEventListener("wheel", wheel, { passive: false, capture: true });
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", configure);
  window.addEventListener("pointerdown", interrupt);
  window.addEventListener("keydown", interrupt);
  return {
    select,
    dispose() {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", configure);
      window.removeEventListener("wheel", wheel, true);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", configure);
      window.removeEventListener("pointerdown", interrupt);
      window.removeEventListener("keydown", interrupt);
      track.style.removeProperty("transform");
      track.style.removeProperty("transition");
      panels.forEach((panel) => {
        panel.inert = false;
        panel.removeAttribute("aria-hidden");
      });
      delete root.dataset.stepped;
      delete root.dataset.active;
    },
  };
}

export function revealProcess(root: HTMLElement) {
  const media = matchMedia("(min-width: 768px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)");
  let observer: IntersectionObserver | undefined;

  const configure = () => {
    observer?.disconnect();
    observer = undefined;
    if (!media.matches || !("IntersectionObserver" in window) || root.getBoundingClientRect().bottom <= 0) {
      root.dataset.revealed = "true";
      return;
    }
    root.dataset.revealed = "false";
    observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      root.dataset.revealed = "true";
      observer?.disconnect();
      observer = undefined;
    }, { rootMargin: "0px 0px -30% 0px", threshold: 0 });
    observer.observe(root);
  };

  configure();
  media.addEventListener("change", configure);
  return () => {
    observer?.disconnect();
    media.removeEventListener("change", configure);
    delete root.dataset.revealed;
  };
}

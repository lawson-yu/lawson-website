import { clamp, scrollAt, type ScrollLayout, type StageBox } from "./scroll";

export function createTimeline(site: HTMLElement, wake: () => void) {
  const stage = site.querySelector<HTMLElement>(".stage");
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const layout: ScrollLayout = { os: 0, transition: 0, projects: 0, vh: innerHeight, width: innerWidth };
  const box: StageBox = { s: 1, tx: 0, ty: 0 };
  let titleOut: boolean | undefined;
  let ideaIn: boolean | undefined;
  let reduced: boolean | undefined;
  let y = scrollY;
  let disposed = false;
  let refreshFrame = 0;
  let scrollFrame = 0;

  function updateScroll() {
    scrollFrame = 0;
    y = scrollY;
    const progress = clamp((y - layout.os + 0.8 * layout.vh) / (0.75 * layout.vh));
    const scatter = scrollAt(y, 0, layout).scatter;
    const simple = motion.matches || innerWidth < 768;
    const nextIdeaIn = simple || y >= layout.transition - 0.4 * layout.vh;

    if (ideaIn !== nextIdeaIn) {
      site.style.setProperty("--idea-reveal", String(Number(nextIdeaIn)));
      ideaIn = nextIdeaIn;
    }

    site.style.setProperty("--hero-veil", String(1 - progress));
    site.style.setProperty("--transition-veil", String(1 - scatter));
    site.style.setProperty("--content-veil", String(clamp((y - (layout.transition - 1.5 * layout.vh)) / (1.5 * layout.vh))));

    const exitY = layout.footer === undefined ? 0 : Math.min(0, layout.footer - y - layout.vh);
    box.ty = exitY;
    if (stage) stage.style.transform = `translate3d(0, ${exitY}px, 0)`;
    site.style.setProperty("--cloud-opacity", motion.matches ? "0.24" : "1");

    const nextOut = !simple && y >= layout.projects - layout.vh;
    if (titleOut !== nextOut || reduced !== motion.matches) {
      titleOut = nextOut;
      reduced = motion.matches;
      const out = Number(nextOut);
      site.style.setProperty("--idea-out-y", motion.matches ? "0%" : `${18 * out}%`);
      site.style.setProperty("--idea-out-opacity", String(1 - out));
      site.style.setProperty("--idea-sub-y", motion.matches ? "0px" : `${12 * out}px`);
    }

    if (y > 0 || site.classList.contains("has-entered")) {
      site.classList.add("has-entered");
      site.classList.toggle("is-hero-out", progress >= 1);
      const alpha = Math.max(0, 1 - progress);
      site.style.setProperty("--hero-alpha", String(alpha));
      site.style.setProperty("--hero-visibility", alpha <= 0 ? "hidden" : "visible");
      site.style.setProperty("--hero-scale", String(motion.matches ? 1 : 1 - 0.12 * progress));
    }

    wake();
  }

  const schedule = () => {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll);
  };

  function measure() {
    layout.vh = innerHeight;
    layout.width = innerWidth;

    const hero = site.querySelector<HTMLElement>('[data-screen="hero"], .home-hero');
    const heroBottom = hero ? hero.getBoundingClientRect().bottom + scrollY : layout.vh;

    const osEl = site.querySelector<HTMLElement>('[data-screen="os"], [data-home-motion="featured-articles"]');
    layout.os = osEl ? osEl.getBoundingClientRect().top + scrollY : heroBottom;

    const transEl = site.querySelector<HTMLElement>('[data-screen="transition"], [data-home-motion="particle-transition"]');
    layout.transition = transEl ? transEl.getBoundingClientRect().top + scrollY : layout.os + layout.vh;

    const projEl = site.querySelector<HTMLElement>('[data-screen="projects"], [data-home-motion="home-projects"]');
    layout.projects = projEl ? projEl.getBoundingClientRect().top + scrollY : layout.transition + layout.vh;

    const procEl = site.querySelector<HTMLElement>('[data-screen="process"], [data-home-motion="process"]');
    layout.process = procEl ? procEl.getBoundingClientRect().top + scrollY : undefined;

    const servEl = site.querySelector<HTMLElement>('[data-screen="services"], .home-services');
    layout.services = servEl ? servEl.getBoundingClientRect().top + scrollY : undefined;

    const footer = site.querySelector<HTMLElement>(".about-footer") ?? document.querySelector<HTMLElement>(".public-footer");
    layout.footer = footer ? footer.getBoundingClientRect().top + scrollY : undefined;

    updateScroll();
  }

  measure();
  window.addEventListener("scroll", schedule, { passive: true });
  const refresh = () => {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => {
      if (!disposed) measure();
    });
  };
  const resizeObserver = new ResizeObserver(refresh);
  resizeObserver.observe(document.body);
  const mutationObserver = new MutationObserver(refresh);
  mutationObserver.observe(site, { childList: true, subtree: true });
  document.fonts.ready.then(() => {
    if (!disposed) refresh();
  });
  window.addEventListener("resize", refresh);
  window.addEventListener("pageshow", refresh);
  motion.addEventListener("change", refresh);
  site.classList.add("has-timeline");

  return {
    box,
    get visible() {
      return y < (layout.footer ?? Infinity);
    },
    get pointerEnabled() {
      return (
        y < layout.os + (innerWidth < 768 ? 0 : 0.8 * layout.vh) ||
        (y >= layout.transition + 0.8 * layout.vh && y < (layout.process ?? Infinity) - 0.65 * layout.vh)
      );
    },
    get ringVisible() {
      return y >= layout.os + 0.35 * layout.vh && y < layout.transition - 1.2 * layout.vh;
    },
    at(heroY: number) {
      if (motion.matches || innerWidth < 768 || y < layout.transition - 0.4 * layout.vh) return scrollAt(y, heroY, layout);
      if (layout.process !== undefined && y >= layout.process - layout.vh) return scrollAt(y, heroY, layout);
      return scrollAt(layout.transition + 0.8 * layout.vh, heroY, layout);
    },
    step() {
      return false;
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(refreshFrame);
      cancelAnimationFrame(scrollFrame);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("pageshow", refresh);
      motion.removeEventListener("change", refresh);
      stage?.style.removeProperty("transform");
      site.classList.remove("has-timeline", "is-hero-out", "has-entered");
      for (const key of [
        "hero-veil",
        "transition-veil",
        "idea-reveal",
        "cloud-opacity",
        "content-veil",
        "hero-alpha",
        "hero-visibility",
        "hero-scale",
        "idea-out-y",
        "idea-out-opacity",
        "idea-sub-y",
      ]) {
        site.style.removeProperty(`--${key}`);
      }
    },
  };
}

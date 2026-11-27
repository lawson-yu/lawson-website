"use client";

import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Group, Mesh, NoToneMapping, PerspectiveCamera, SRGBColorSpace, WebGLRenderer } from "three";
import { APPEARANCE, renderQuality, type Appearance } from "@/components/kin/appearance";
import { createGrainGeometry, flowField, FOV } from "@/components/kin/cloud-model";
import { createBloom } from "@/components/kin/home-stage/bloom";
import { disposeSurface, loadCloud } from "@/components/kin/home-stage/cloud-assets";
import { createCursor } from "@/components/kin/home-stage/cursor";
import { createTextRing } from "@/components/kin/home-stage/text-ring";
import { createTimeline } from "@/components/kin/home-stage/timeline";
import { createGrainMaterial } from "@/components/kin/particles";
import "@/components/kin/home-stage/stage.css";

const LOAD_TIMEOUT_MS = 8_000;
type RendererFactory = Extract<NonNullable<CanvasProps["gl"]>, (...args: never[]) => unknown>;
type RendererOptions = Parameters<RendererFactory>[0];

type Runtime = {
  cursor: ReturnType<typeof createCursor>;
  post: ReturnType<typeof createBloom> | null;
  ring: ReturnType<typeof createTextRing>;
  dispose(): void;
};

function readRenderQuality() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : Number.POSITIVE_INFINITY;
  const mobile = matchMedia("(max-width: 767px), (pointer: coarse)").matches;
  return renderQuality(window.devicePixelRatio || 1, mobile, cores, nav.deviceMemory);
}

function applyAppearance(cloud: Runtime, appearance: Appearance) {
  cloud.cursor.appearance(appearance);
  if (cloud.post) Object.assign(cloud.post.bloom, appearance.bloom);
}

function CloudScene({
  title,
  onFirstFrame,
  onError,
}: {
  title: RefObject<HTMLElement | null>;
  onFirstFrame(): void;
  onError(): void;
}) {
  const { gl, scene, camera, size, invalidate, setFrameloop, setDpr } = useThree();
  const dpr = useThree((state) => state.viewport.dpr);
  const runtime = useRef<Runtime | null>(null);
  const current = useRef(size);
  const timeline = useRef<ReturnType<typeof createTimeline> | null>(null);
  const previousTime = useRef<number | null>(null);
  const renderedFrames = useRef(0);
  const lost = useRef(false);

  const wake = useCallback(() => {
    if (!document.hidden && !lost.current) invalidate();
  }, [invalidate]);

  const quality = useCallback(() => {
    const profile = readRenderQuality();
    setDpr(profile.dpr);
    runtime.current?.cursor.setLiquidEnabled(profile.liquid && gl.extensions.has("EXT_color_buffer_float"));
  }, [gl, setDpr]);

  useEffect(() => {
    current.current = size;
    if (lost.current) return;
    quality();
    const cloud = runtime.current;
    if (!cloud) return;
    cloud.cursor.resize(size.width, size.height);
    if (timeline.current) cloud.cursor.target(timeline.current.at(cloud.cursor.heroY), timeline.current.box);
    cloud.post?.resize(size.width, size.height);
    wake();
  }, [size, dpr, quality, wake]);

  useEffect(() => {
    let disposed = false;
    let loading: AbortController | undefined;
    const site = gl.domElement.closest<HTMLElement>(".kin-site, .home-page");
    const release = () => {
      runtime.current?.dispose();
      runtime.current = null;
      previousTime.current = null;
      site?.classList.remove("has-cloud");
    };
    const choreography = site ? createTimeline(site, wake) : null;
    timeline.current = choreography;
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const eligible = () => fine.matches && !motion.matches;

    const preferences = () => {
      quality();
      runtime.current?.cursor.setReduced(motion.matches);
      runtime.current?.cursor.setPointerEnabled(fine.matches);
      previousTime.current = null;
      wake();
    };
    const leave = () => {
      runtime.current?.cursor.leave();
      wake();
    };
    const move = (event: PointerEvent) => {
      if (!eligible() || !choreography?.pointerEnabled || event.pointerType === "touch" || document.hidden || lost.current) return;
      try {
        runtime.current?.cursor.move(event.clientX, event.clientY, performance.now());
      } catch {
        runtime.current?.cursor.setLiquidEnabled(false);
      }
      wake();
    };
    const pointerout = (event: PointerEvent) => {
      if (!event.relatedTarget) leave();
    };
    const visibility = () => {
      previousTime.current = null;
      site?.classList.toggle("is-hidden", document.hidden);
      if (document.hidden) runtime.current?.cursor.leave();
      setFrameloop(document.hidden || lost.current ? "never" : "demand");
      wake();
    };

    async function initialize() {
      if (disposed || lost.current) return;
      const request = new AbortController();
      loading = request;
      const disposers: (() => void)[] = [];
      const disposeResources = () => {
        for (const dispose of disposers.splice(0).reverse()) dispose();
      };
      try {
        const model = await loadCloud(request.signal);
        disposers.push(() => disposeSurface(model.surface));
        if (disposed || request.signal.aborted) {
          disposeResources();
          return;
        }

        gl.setClearColor(0x000000, 0);
        gl.outputColorSpace = SRGBColorSpace;
        gl.toneMapping = NoToneMapping;

        const hasFloatColorBuffer = gl.extensions.has("EXT_color_buffer_float");
        const geometry = createGrainGeometry(model.positions);
        disposers.push(() => geometry.dispose());
        const grain = createGrainMaterial(APPEARANCE, hasFloatColorBuffer);
        disposers.push(() => {
          grain.material.dispose();
          grain.zero.dispose();
        });
        const field = flowField(model);
        grain.material.uniforms.uOrigin.value.copy(field.origin);
        grain.material.uniforms.uSpan.value = field.span;
        grain.material.uniforms.uRadius.value = Math.max(model.size.x, model.size.y) * 0.62;
        grain.material.uniforms.uModelScale.value = model.unitScale;

        const points = new Mesh(geometry, grain.material);
        points.frustumCulled = false;
        points.position.copy(model.pivot).negate();

        const rig = new Group();
        const ring = createTextRing(model);
        disposers.push(() => ring.dispose());
        rig.add(points, ring.group);
        scene.add(rig);
        disposers.push(() => scene.remove(rig));

        const cursor = createCursor(gl, model, rig, points, grain, camera as PerspectiveCamera, title.current);
        disposers.push(() => cursor.dispose());

        let post: ReturnType<typeof createBloom> | null = null;
        try {
          post = createBloom(gl, scene, camera);
          disposers.push(() => post?.dispose());
        } catch {
          post = null;
        }

        runtime.current = { cursor, post, ring, dispose: disposeResources };
        applyAppearance(runtime.current, APPEARANCE);
        quality();
        cursor.setReduced(motion.matches);
        cursor.setPointerEnabled(fine.matches);
        const c = current.current;
        cursor.resize(c.width, c.height);
        if (choreography) cursor.target(choreography.at(cursor.heroY), choreography.box, true);
        post?.resize(c.width, c.height);
        site?.classList.add("has-cloud");
        wake();
      } catch {
        disposeResources();
        runtime.current = null;
        site?.classList.remove("has-cloud");
        if (!disposed && !request.signal.aborted) onError();
      }
    }

    const contextLost = (event: Event) => {
      event.preventDefault();
      lost.current = true;
      loading?.abort();
      setFrameloop("never");
      release();
      onError();
    };

    const canvas = gl.domElement;
    canvas.addEventListener("webglcontextlost", contextLost);
    queueMicrotask(() => {
      void initialize();
    });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("blur", leave);
    window.addEventListener("pointercancel", leave);
    document.documentElement.addEventListener("pointerleave", leave);
    window.addEventListener("pointerout", pointerout);
    fine.addEventListener("change", preferences);
    motion.addEventListener("change", preferences);
    visibility();

    return () => {
      disposed = true;
      loading?.abort();
      release();
      choreography?.dispose();
      timeline.current = null;
      site?.classList.remove("is-hidden");
      canvas.removeEventListener("webglcontextlost", contextLost);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("blur", leave);
      window.removeEventListener("pointercancel", leave);
      document.documentElement.removeEventListener("pointerleave", leave);
      window.removeEventListener("pointerout", pointerout);
      fine.removeEventListener("change", preferences);
      motion.removeEventListener("change", preferences);
    };
  }, [camera, gl, onError, quality, scene, setFrameloop, title, wake]);

  useFrame(() => {
    if (document.hidden || lost.current) return;
    const cloud = runtime.current;
    if (!cloud) return;
    if (timeline.current && !timeline.current.visible) {
      gl.setRenderTarget(null);
      gl.clear();
      previousTime.current = null;
      return;
    }
    try {
      const now = performance.now();
      const dt = Math.min(0.25, previousTime.current === null ? 1 / 60 : (now - previousTime.current) / 1000);
      let active = timeline.current?.step() ?? false;
      if (!timeline.current?.pointerEnabled) cloud.cursor.leave();
      if (timeline.current) cloud.cursor.target(timeline.current.at(cloud.cursor.heroY), timeline.current.box);
      active = cloud.cursor.step(dt, now) || active;
      cloud.ring.group.visible = timeline.current?.ringVisible ?? false;
      if (cloud.ring.group.visible && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        cloud.ring.step(dt);
        active = true;
      }
      if (cloud.post) cloud.post.composer.render(dt);
      else gl.render(scene, camera);
      if (renderedFrames.current < 2) {
        renderedFrames.current += 1;
        if (renderedFrames.current === 2) onFirstFrame();
        else invalidate();
      }
      previousTime.current = active ? now : null;
      if (active) invalidate();
    } catch {
      onError();
    }
  }, 1);

  return null;
}

export function HomeCharacter({ alt }: { alt: string }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [attempting, setAttempting] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dpr, setDpr] = useState(1);
  const failedRef = useRef(false);
  const attemptRef = useRef(false);
  const timeoutRef = useRef<number | undefined>(undefined);
  const stage = reducedMotion || failed ? "static-fallback" : attempting ? rendered ? "rendered" : "loading" : "static-fallback";

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".kin-site, .home-page");
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const scroll = window.scrollY;
      const height = window.innerHeight;
      const heroProgress = Math.max(0, Math.min(1, scroll / (height * 0.8)));
      const t = heroProgress * heroProgress * (3 - 2 * heroProgress);
      const heroOpacity = 1 - t;
      const pageEnd = root.getBoundingClientRect().bottom + scroll;
      const pageProgress = Math.max(0, Math.min(1, (scroll + height - pageEnd) / (height * 0.7)));
      const pageFade = pageProgress * pageProgress * (3 - 2 * pageProgress);
      root.style.setProperty("--home-hero-opacity", String(heroOpacity));
      root.style.setProperty("--home-hero-shift", `${-14 * t}px`);
      root.style.setProperty("--home-character-opacity", String(stage === "static-fallback" ? heroOpacity : 1 - pageFade));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("pageshow", schedule);
    update();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("pageshow", schedule);
      root.style.removeProperty("--home-hero-opacity");
      root.style.removeProperty("--home-hero-shift");
      root.style.removeProperty("--home-character-opacity");
    };
  }, [stage]);

  const fail = useCallback(() => {
    if (failedRef.current) return;
    failedRef.current = true;
    attemptRef.current = false;
    window.clearTimeout(timeoutRef.current);
    setFailed(true);
    setAttempting(false);
    setRendered(false);
  }, []);

  const firstFrame = useCallback(() => {
    if (failedRef.current) return;
    window.clearTimeout(timeoutRef.current);
    setRendered(true);
  }, []);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const start = () => {
      if (failedRef.current) return;
      attemptRef.current = true;
      setDpr(readRenderQuality().dpr);
      setReducedMotion(false);
      setAttempting(true);
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(fail, LOAD_TIMEOUT_MS);
    };
    const updatePreference = () => {
      if (preference.matches) {
        attemptRef.current = false;
        window.clearTimeout(timeoutRef.current);
        setReducedMotion(true);
        setAttempting(false);
        setRendered(false);
      } else if (!attemptRef.current) {
        start();
      }
    };

    preference.addEventListener("change", updatePreference);
    updatePreference();
    return () => {
      preference.removeEventListener("change", updatePreference);
      window.clearTimeout(timeoutRef.current);
      attemptRef.current = false;
    };
  }, [fail]);

  const createRenderer = useCallback(
    (props: RendererOptions) => {
      try {
        return new WebGLRenderer({ ...props, canvas: props.canvas as HTMLCanvasElement, alpha: true, antialias: false });
      } catch (error) {
        fail();
        throw error;
      }
    },
    [fail],
  );

  return (
    <div className="home-hero__character stage" data-character-stage={stage}>
      <picture>
        <source media="(max-width: 767px)" srcSet="/images/character/static-mobile.webp" />
        <img src="/images/character/static-desktop.webp" alt={alt} fetchPriority="high" />
      </picture>
      <span ref={titleRef} className="hero__title" aria-hidden="true">
        <span className="hero__letters">
          {Array.from("LAWSON", (letter, index) => (
            <span className="hero__letter-mask" key={`${letter}-${index}`}>
              <span className="hero__letter" style={{ animationDelay: `${index * 55}ms` }}>
                {letter}
              </span>
            </span>
          ))}
        </span>
      </span>
      {attempting && !failed && !reducedMotion && (
        <Canvas
          aria-hidden="true"
          className="home-character__canvas kin-canvas"
          camera={{ fov: FOV, near: 0.01, far: 40, position: [0, 0, 1] }}
          dpr={dpr}
          fallback={null}
          frameloop="demand"
          gl={createRenderer}
          resize={{ offsetSize: true }}
        >
          <CloudScene title={titleRef} onFirstFrame={firstFrame} onError={fail} />
        </Canvas>
      )}
    </div>
  );
}

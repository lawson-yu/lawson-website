"use client";

import { Canvas, useFrame, useThree, type CanvasProps } from "@react-three/fiber";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Mesh,
  NoToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
  type Camera,
} from "three";
import { APPEARANCE, renderQuality } from "@/components/kin/appearance";
import { createGrainGeometry, FOV, fitCloud, prepareCustomCloud } from "@/components/kin/cloud-model";
import { createGrainMaterial } from "@/components/kin/particles";

const LOAD_TIMEOUT_MS = 8_000;
type RendererFactory = Extract<NonNullable<CanvasProps["gl"]>, (...args: never[]) => unknown>;
type RendererOptions = Parameters<RendererFactory>[0];
type CloudMotionState = { x: number; y: number; yaw: number; pitch: number; scatter: number; dim: number; pointerX: number; pointerY: number; pointerOn: number };

function updateCloudMotion(
  points: Mesh,
  material: ReturnType<typeof createGrainMaterial>["material"],
  basePosition: Vector3,
  fit: ReturnType<typeof fitCloud>,
  viewport: { width: number; height: number },
  target: CloudMotionState,
  current: CloudMotionState,
  delta: number,
) {
  let active = false;
  const factor = 1 - Math.exp(-12 * Math.min(delta, 0.1));
  const approach = (key: keyof CloudMotionState) => {
    const difference = target[key] - current[key];
    if (Math.abs(difference) < 0.0005) {
      current[key] = target[key];
      return false;
    }
    current[key] += difference * factor;
    return true;
  };
  for (const key of ["x", "y", "yaw", "pitch", "scatter", "dim", "pointerX", "pointerY", "pointerOn"] as const) {
    active = approach(key) || active;
  }

  points.position.set(
    basePosition.x + current.x * viewport.width * fit.unitsPerPx * 0.5,
    basePosition.y + current.y * viewport.height * fit.unitsPerPx * 0.5,
    basePosition.z,
  );
  points.rotation.set(current.pitch + current.pointerY * 0.12, current.yaw + current.pointerX * 0.22, 0);
  material.uniforms.uScatter.value = current.scatter;
  material.uniforms.uDim.value = current.dim;
  material.uniforms.uPointer.value.set(current.pointerX, current.pointerY);
  material.uniforms.uDisturb.value = current.pointerOn;
  return active;
}

function configureRenderer(renderer: WebGLRenderer) {
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
}

function fitCamera(camera: Camera, model: ReturnType<typeof prepareCustomCloud>, width: number, height: number) {
  if (!(camera instanceof PerspectiveCamera) || width === 0 || height === 0) return;
  const fit = fitCloud(model, width, height);
  camera.aspect = width / height;
  camera.position.set(0, 0, fit.cameraZ);
  camera.updateProjectionMatrix();
}

async function loadPointCloud(signal: AbortSignal) {
  const [points, metadata] = await Promise.all([
    fetch("/models/custom/person.bin", { signal }),
    fetch("/models/custom/metadata.json", { signal }),
  ]);
  if (!points.ok) throw new Error(`Point cloud request failed: ${points.status}`);
  if (!metadata.ok) throw new Error(`Point cloud metadata request failed: ${metadata.status}`);

  const [binary, description] = await Promise.all([points.arrayBuffer(), metadata.json()]);
  return prepareCustomCloud(binary, description);
}

function CloudScene({ onFirstFrame, onError }: { onFirstFrame(): void; onError(): void }) {
  const { camera, get, gl, invalidate, scene, size } = useThree();
  const pointsRef = useRef<Mesh | null>(null);
  const materialRef = useRef<ReturnType<typeof createGrainMaterial> | null>(null);
  const modelRef = useRef<ReturnType<typeof prepareCustomCloud> | null>(null);
  const fitRef = useRef<ReturnType<typeof fitCloud> | null>(null);
  const basePositionRef = useRef<Vector3 | null>(null);
  const targetRef = useRef({ x: 0, y: 0, yaw: 0, pitch: 0, scatter: 0, dim: 0, pointerX: 0, pointerY: 0, pointerOn: 0 });
  const currentRef = useRef({ x: 0, y: 0, yaw: 0, pitch: 0, scatter: 0, dim: 0, pointerX: 0, pointerY: 0, pointerOn: 0 });
  const drewFrame = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let geometry: ReturnType<typeof createGrainGeometry> | null = null;
    const root = gl.domElement.closest<HTMLElement>(".home-page");
    const pointerMedia = matchMedia("(hover: hover) and (pointer: fine)");

    const topOf = (name: string) => {
      const section = root?.querySelector<HTMLElement>(`[data-home-motion="${name}"]`);
      return section ? section.getBoundingClientRect().top + window.scrollY : null;
    };
    const ease = (value: number) => {
      const t = Math.max(0, Math.min(1, value));
      return t * t * (3 - 2 * t);
    };
    const updateScroll = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const desktop = pointerMedia.matches;
      const featuredTop = topOf("featured-articles");
      const transitionTop = topOf("particle-transition");
      const projectsTop = topOf("home-projects");
      const processTop = topOf("process");
      const hero = root?.querySelector<HTMLElement>(".home-hero");
      const firstContentTop = featuredTop ?? (hero ? hero.getBoundingClientRect().bottom + y : 0);
      const focus = ease((y - firstContentTop) / (vh * 0.8));
      const recenter = transitionTop === null ? 0 : ease((y - (transitionTop - vh * 1.3)) / (vh * 0.3));
      const transition = transitionTop === null ? 0 : ease((y - (transitionTop - vh * 0.2)) / vh);
      const project = projectsTop === null ? 0 : ease((y - projectsTop) / (vh * 0.8));
      const process = processTop === null ? 0 : ease((y - (processTop - vh * 0.4)) / (vh * 0.8));

      let x = desktop ? 0.42 * focus * (1 - recenter) : 0;
      let yaw = desktop ? -0.5 * focus * (1 - recenter) : 0;
      let pitch = desktop ? 0.18 * focus * (1 - recenter) : 0;
      if (projectsTop !== null && transitionTop !== null && project > 0) {
        x = desktop ? 0.42 * project : 0;
        yaw = desktop ? -0.35 * project : 0;
        pitch = desktop ? 0.08 * project : 0;
      }
      if (processTop !== null && process > 0) {
        x = desktop ? 0.42 + 0.18 * process : 0;
        yaw = desktop ? -0.35 : 0;
        pitch = desktop ? 0.08 : 0;
      }

      const gather = Math.max(project, process);
      const scatter = transitionTop === null ? 0 : transition * (1 - gather);
      const target = targetRef.current;
      target.x = x;
      target.y = desktop ? 0.12 * focus * (1 - recenter) : 0;
      target.yaw = yaw;
      target.pitch = pitch;
      target.scatter = scatter;
      target.dim = Math.min(0.4, transition * 0.25 + process * 0.3);
      if (!desktop) {
        target.pointerX = 0;
        target.pointerY = 0;
        target.pointerOn = 0;
      }
      invalidate();
    };
    let scrollFrame = 0;
    const scheduleScroll = () => {
      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateScroll();
      });
    };
    const move = (event: PointerEvent) => {
      if (!pointerMedia.matches || event.pointerType === "touch") return;
      const model = modelRef.current;
      const fit = fitRef.current;
      if (!model || !fit) return;
      const ndcX = (event.clientX / window.innerWidth) * 2 - 1;
      const ndcY = 1 - (event.clientY / window.innerHeight) * 2;
      const target = targetRef.current;
      const inside = Math.abs(ndcX - target.x) <= model.size.x / (fit.view * (window.innerWidth / window.innerHeight)) &&
        Math.abs(ndcY - target.y) <= model.size.y / fit.view;
      if (!inside) {
        leave();
        return;
      }
      target.pointerX = ndcX;
      target.pointerY = ndcY;
      target.pointerOn = 1;
      invalidate();
    };
    const leave = () => {
      const target = targetRef.current;
      target.pointerX = 0;
      target.pointerY = 0;
      target.pointerOn = 0;
      invalidate();
    };
    const pointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) leave();
    };
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll);
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerout", pointerOut);
    window.addEventListener("blur", leave);
    pointerMedia.addEventListener("change", scheduleScroll);
    updateScroll();

    const contextLost = (event: Event) => {
      event.preventDefault();
      onError();
    };
    gl.domElement.addEventListener("webglcontextlost", contextLost);

    async function initialize() {
      try {
        const model = await loadPointCloud(controller.signal);
        if (disposed) return;

        configureRenderer(gl);

        geometry = createGrainGeometry(model.positions);
        const hasFloatColorBuffer = gl.extensions.has("EXT_color_buffer_float");
        const grain = createGrainMaterial(APPEARANCE, hasFloatColorBuffer);
        const points = new Mesh(geometry, grain.material);
        const center = model.box.getCenter(new Vector3());
        points.frustumCulled = false;
        points.position.copy(center).negate();
        basePositionRef.current = points.position.clone();
        grain.material.uniforms.uCenter.value.set(center.x, center.y);
        grain.material.uniforms.uRadius.value = Math.max(model.size.x, model.size.y) / 2;
        modelRef.current = model;
        const viewport = get().size;
        fitRef.current = fitCloud(model, viewport.width, viewport.height);
        currentRef.current.scatter = 1;
        pointsRef.current = points;
        materialRef.current = grain;

        fitCamera(get().camera, model, viewport.width, viewport.height);
        grain.material.uniforms.uViewport.value.set(viewport.width, viewport.height);
        scene.add(points);
        invalidate();
      } catch {
        if (!disposed && !controller.signal.aborted) onError();
      }
    }

    void initialize();
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", scheduleScroll);
      window.removeEventListener("resize", scheduleScroll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerout", pointerOut);
      window.removeEventListener("blur", leave);
      pointerMedia.removeEventListener("change", scheduleScroll);
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
      if (pointsRef.current) scene.remove(pointsRef.current);
      pointsRef.current = null;
      modelRef.current = null;
      fitRef.current = null;
      geometry?.dispose();
      materialRef.current?.material.dispose();
      materialRef.current?.zero.dispose();
      materialRef.current = null;
    };
  }, [get, gl, invalidate, onError, scene]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || size.width === 0 || size.height === 0) return;

    fitRef.current = fitCloud(model, size.width, size.height);
    fitCamera(camera, model, size.width, size.height);
    materialRef.current?.material.uniforms.uViewport.value.set(size.width, size.height);
    invalidate();
  }, [camera, invalidate, size]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    try {
      const points = pointsRef.current;
      const material = materialRef.current?.material;
      const basePosition = basePositionRef.current;
      const fit = fitRef.current;
      if (!material || !basePosition || !fit) return;
      const active = updateCloudMotion(points, material, basePosition, fit, size, targetRef.current, currentRef.current, delta);
      gl.render(scene, camera);
      if (!drewFrame.current) {
        drewFrame.current = true;
        onFirstFrame();
      }
      if (active) invalidate();
    } catch {
      onError();
    }
  }, 1);

  return null;
}

function readRenderQuality() {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : Number.POSITIVE_INFINITY;
  const mobile = matchMedia("(max-width: 767px), (pointer: coarse)").matches;
  return renderQuality(window.devicePixelRatio || 1, mobile, cores, nav.deviceMemory);
}

export function HomeCharacter({ alt }: { alt: string }) {
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
    const root = document.querySelector<HTMLElement>(".home-page");
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

  const createRenderer = useCallback((props: RendererOptions) => {
    try {
      return new WebGLRenderer({ ...props, canvas: props.canvas as HTMLCanvasElement, alpha: true, antialias: false });
    } catch (error) {
      fail();
      throw error;
    }
  }, [fail]);

  return (
    <div className="home-hero__character" data-character-stage={stage}>
      <picture>
        <source media="(max-width: 767px)" srcSet="/images/character/static-mobile.webp" />
        <img src="/images/character/static-desktop.webp" alt={alt} fetchPriority="high" />
      </picture>
      {attempting && !failed && !reducedMotion && (
        <Canvas
          aria-hidden="true"
          className="home-character__canvas"
          camera={{ fov: FOV, near: 0.01, far: 40, position: [0, 0, 1] }}
          dpr={dpr}
          fallback={null}
          frameloop="demand"
          gl={createRenderer}
        >
          <CloudScene onFirstFrame={firstFrame} onError={fail} />
        </Canvas>
      )}
      <span className="home-hero__wordmark" aria-hidden="true">
        LAWSON
      </span>
    </div>
  );
}

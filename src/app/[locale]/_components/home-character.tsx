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
  const drewFrame = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    let geometry: ReturnType<typeof createGrainGeometry> | null = null;

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
        grain.material.uniforms.uCenter.value.set(center.x, center.y);
        grain.material.uniforms.uRadius.value = Math.max(model.size.x, model.size.y) / 2;
        modelRef.current = model;
        pointsRef.current = points;
        materialRef.current = grain;

        const viewport = get().size;
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
      gl.domElement.removeEventListener("webglcontextlost", contextLost);
      if (pointsRef.current) scene.remove(pointsRef.current);
      pointsRef.current = null;
      modelRef.current = null;
      geometry?.dispose();
      materialRef.current?.material.dispose();
      materialRef.current?.zero.dispose();
      materialRef.current = null;
    };
  }, [get, gl, invalidate, onError, scene]);

  useEffect(() => {
    const model = modelRef.current;
    if (!model || size.width === 0 || size.height === 0) return;

    fitCamera(camera, model, size.width, size.height);
    materialRef.current?.material.uniforms.uViewport.value.set(size.width, size.height);
    invalidate();
  }, [camera, invalidate, size]);

  useFrame(() => {
    if (!pointsRef.current) return;

    try {
      gl.render(scene, camera);
      if (!drewFrame.current) {
        drewFrame.current = true;
        onFirstFrame();
      }
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

  const stage = reducedMotion || failed ? "static-fallback" : attempting ? rendered ? "rendered" : "loading" : "static-fallback";

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

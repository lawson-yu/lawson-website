import { Matrix4, Plane, Ray, Raycaster, Vector2, Vector3, type Group, type Mesh, type PerspectiveCamera, type WebGLRenderer } from "three";
import { fitCloud, placeRig, type CloudModel, type Pose } from "../cloud-model.ts";
import { createLiquid } from "./liquid.ts";
import { updateGrainAppearance, type createGrainMaterial } from "../particles.ts";
import { APPEARANCE, type Appearance } from "../appearance.ts";
import { Spring, SPRINGS } from "./spring.ts";
import type { ScrollTarget, StageBox } from "./scroll.ts";
const clamp = (v: number, min = -1, max = 1) => Math.max(min, Math.min(max, v));
const spring = (value: number, kind: keyof typeof SPRINGS, eps = 1e-4) => new Spring(value, SPRINGS[kind].k, SPRINGS[kind].c, eps);

// 统一推进人物、光斑与 GPU；渲染与唤醒仅由 R3F 调用方负责。
export function createCursor(gl: WebGLRenderer, model: CloudModel & { surface: Group }, rig: Group, points: Mesh, grains: ReturnType<typeof createGrainMaterial>, camera: PerspectiveCamera, title: HTMLElement | null) {
  const pose = { x: spring(0, "POSE"), y: spring(0, "POSE"), scale: spring(1, "POSE"), yaw: spring(0, "POSE"), pitch: spring(0, "POSE"), roll: spring(0, "POSE") };
  const yaw = spring(0, "TURN"), pitch = spring(0, "TURN"), roll = spring(0, "SWAY");
  const fx = spring(0, "FLOAT"), fy = spring(0, "FLOAT");
  const gx = spring(model.headCenter.x, "GLOW", 1e-5), gy = spring(model.headCenter.y, "GLOW", 1e-5);
  const hero = spring(1, "POSE"), dim = spring(0, "POSE"), dust = new Spring(0, 26, 10);
  const disturb = spring(0, "GLOW");
  const springs = [...Object.values(pose), yaw, pitch, roll, fx, fy, gx, gy, hero, dim, dust, disturb];
  const pointer = new Vector2();
  const raycaster = new Raycaster(), localRay = new Ray(), inverse = new Matrix4();
  const gazeDistance = .41 * model.unitScale;
  const gazePlane = new Plane(new Vector3(0, 0, 1), -gazeDistance);
  const surfaceRay = new Raycaster();
  const hit = new Vector3(), eye = new Vector3();
  const local = new Vector2();
  let liquid: ReturnType<typeof createLiquid> | undefined;
  let fit = fitCloud(model, 1, 1);
  let target: ScrollTarget = { pose: { x: 0, y: fit.heroY, scale: 1, yaw: 0, pitch: 0, roll: 0 }, scatter: 0, hero: 1, dim: 0 };
  let stageBox: StageBox | undefined;
  let on = false, reduced = false, pointerEnabled = true, failed = false;
  let appearance = APPEARANCE, liquidEnabled = true;
  let width = 1, height = 1, units = 1;
  let rect = { left: 0, top: 0, width: 1, height: 1 };
  let origin = { left: 0, top: 0 };
  let titleBox = { left: 0, top: 0 };
  const u = grains.material.uniforms;
  const stage = gl.domElement.closest<HTMLElement>(".stage");

  function targets(next: ScrollTarget) {
    target = next;
    for (const key of Object.keys(pose) as (keyof Pose)[]) pose[key].t = next.pose[key];
    hero.t = next.hero;
    dim.t = next.dim;
    dust.t = reduced ? 0 : next.scatter;
    if (reduced) for (const s of springs) s.snap();
  }

  function place() {
    const f = 1 - hero.x;
    placeRig(rig, camera, {
      x: pose.x.x + fx.x * .035 * f, y: pose.y.x + fy.x * .05 * f, scale: pose.scale.x,
      yaw: pose.yaw.x + fx.x * .07 * f, pitch: pose.pitch.x - fy.x * .04 * f, roll: pose.roll.x,
    }, fit.headInRig, [pitch.x, yaw.x, roll.x], f);
    units = fit.unitsPerPx / pose.scale.x;
    u.uUnits.value = units;
    u.uSize.value = appearance.particleSize * model.unitScale * pose.scale.x;
    const head = points.localToWorld(model.headCenter.clone()).project(camera);
    const headPx = model.headSize.clone().multiplyScalar(pose.scale.x / fit.unitsPerPx);
    u.uHead.value.set(head.x, head.y);
    u.uHeadR.value = Math.max(headPx.y / height, 1e-3);
    u.uCenter.value.set(gx.x, gy.x);
    u.uDim.value = dim.x;
    const dimCss = String(dim.x);
    if (stage && stage.style.getPropertyValue("--screen-dim") !== dimCss) stage.style.setProperty("--screen-dim", dimCss);
    u.uScatter.value = dust.x;
    u.uDisturb.value = disturb.x;
    if (title && !title.closest(".is-hero-out")) {
      const values = { "--hx": (head.x + 1) / 2 * width - titleBox.left, "--hy": (1 - head.y) / 2 * height - titleBox.top, "--hrx": headPx.x * .5 / .64 * .81, "--hry": headPx.y * .5 * 1.08 / .64 * .81 };
      for (const [key, value] of Object.entries(values)) {
        const next = `${Math.round(value)}px`;
        if (title.style.getPropertyValue(key) !== next) title.style.setProperty(key, next);
      }
    }
  }

  function projectPointer() {
    u.uPointer.value.set((pointer.x - rect.left) / rect.width * 2 - 1, 1 - (pointer.y - rect.top) / rect.height * 2);
    if (dust.x > .5) {
      yaw.t = pitch.t = roll.t = fx.t = fy.t = 0;
      liquid?.input.leave();
      return false;
    }
    raycaster.setFromCamera(u.uPointer.value, camera);
    if (raycaster.ray.intersectPlane(gazePlane, hit)) {
      eye.copy(model.headCenter).applyMatrix4(points.matrixWorld);
      yaw.t = clamp(Math.atan2(hit.x - eye.x, gazeDistance), -.6, .6) * (1 - dust.x);
      pitch.t = clamp(Math.atan2(eye.y - hit.y, gazeDistance), -.35, .3) * (1 - dust.x);
      roll.t = -yaw.t * .18;
    }
    fx.t = clamp(pointer.x / innerWidth * 2 - 1);
    fy.t = clamp(1 - pointer.y / innerHeight * 2);
    inverse.copy(points.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverse);
    surfaceRay.ray.copy(localRay);
    const intersection = surfaceRay.intersectObject(model.surface, true)[0];
    if (!intersection) { liquid?.input.leave(); return false; }
    hit.copy(intersection.point);
    local.set(hit.x, hit.y);
    const margin = .1 * model.unitScale;
    gx.t = clamp(hit.x, model.box.min.x - margin, model.box.max.x + margin);
    gy.t = clamp(hit.y, model.box.min.y - margin, model.box.max.y + margin);
    return true;
  }

  function leave() {
    on = false;
    disturb.t = 0;
    yaw.t = pitch.t = roll.t = fx.t = fy.t = 0;
    gx.t = model.headCenter.x; gy.t = model.headCenter.y;
    liquid?.input.leave();
  }

  function reset() {
    leave();
    for (const s of springs) s.snap();
    liquid?.reset();
    u.uState.value = u.uFlow.value = grains.zero;
    place();
  }

  return {
    get heroY() { return fit.heroY; },
    target(next: ScrollTarget, box?: StageBox, snap = false) {
      stageBox = box;
      if (box) rect = { width: width * box.s, height: height * box.s, left: origin.left + (width - width * box.s) / 2 + box.tx, top: origin.top + (height - height * box.s) / 2 + box.ty };
      targets(next);
      if (snap || reduced) { for (const s of springs) s.snap(); place(); }
    },
    resize(w: number, h: number) {
      width = w; height = h;
      rect = gl.domElement.getBoundingClientRect();
      origin = { left: stage?.offsetLeft ?? rect.left, top: stage?.offsetTop ?? rect.top };
      if (title) titleBox = { left: title.offsetLeft, top: title.offsetTop - title.offsetHeight / 2 };
      fit = fitCloud(model, width, height);
      camera.aspect = width / height;
      camera.position.set(0, 0, fit.cameraZ);
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      u.uViewport.value.set(width, height);
      if (stageBox) rect = { width: width * stageBox.s, height: height * stageBox.s, left: origin.left + (width - width * stageBox.s) / 2 + stageBox.tx, top: origin.top + (height - height * stageBox.s) / 2 + stageBox.ty };
      gl.domElement.closest<HTMLElement>(".kin-site")?.style.setProperty("--bust-top", `${fit.bustTop.toFixed(2)}%`);
      place();
    },
    move(x: number, y: number, now: number) {
      if (reduced || !pointerEnabled || !Number.isFinite(x) || !Number.isFinite(y)) return;
      pointer.set(x, y);
      on = true;
      disturb.t = 1;
      if (!projectPointer() || failed || !liquidEnabled || appearance.liquidStrength === 0) return;
      try {
        liquid ??= createLiquid(gl, model);
        liquid.state.material.uniforms.uStrength.value = appearance.liquidStrength;
        liquid.input.move(local, now);
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    leave,
    reset,
    appearance(next: Appearance) {
      appearance = next;
      updateGrainAppearance(grains.material, next);
      if (liquid) liquid.state.material.uniforms.uStrength.value = next.liquidStrength;
      place();
    },
    setLiquidEnabled(value: boolean) { liquidEnabled = value; if (!value) reset(); },
    setReduced(value: boolean) { reduced = value; targets(target); if (value) reset(); },
    setPointerEnabled(value: boolean) { pointerEnabled = value; if (!value) reset(); },
    step(dt: number, now: number) {
      dt = clamp(dt, 0, .25);
      if (on) {
        if (projectPointer() && liquid) liquid.input.target.copy(local);
      }
      let active = false;
      for (const s of springs) active = s.step(dt) || active;
      place();
      if (liquid?.input.running) {
        const running = liquid.step(dt, now, units);
        u.uState.value = liquid.gpu.getCurrentRenderTarget(liquid.state).texture;
        u.uFlow.value = liquid.gpu.getCurrentRenderTarget(liquid.flow).texture;
        if (!running) {
          liquid.reset();
          u.uState.value = u.uFlow.value = grains.zero;
        }
        active = running || active;
      }
      return active;
    },
    dispose() { liquid?.dispose(); stage?.style.removeProperty("--screen-dim"); },
  };
}

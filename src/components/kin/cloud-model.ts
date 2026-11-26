import {
  Box3,
  BufferAttribute,
  DataTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  RGBAFormat,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Group,
  type PerspectiveCamera,
} from "three";

export const FOV = 30;
export const SIZE = 0.78;
export const BLEED = 0.07;
export const WIDE = 1.3;
const REFERENCE_HEIGHT = 0.4241144061088562;

export type CloudModel = {
  positions: Float32Array;
  box: Box3;
  size: Vector3;
  pivot: Vector3;
  headCenter: Vector3;
  headSize: Vector2;
  forward: Vector3;
  unitScale: number;
};

export type Pose = {
  x: number;
  y: number;
  scale: number;
  yaw: number;
  pitch: number;
  roll: number;
};

// BIN 是世界坐标下连续的 little-endian float32 XYZ。
export function prepareCustomCloud(binary: ArrayBuffer, metadata: unknown): CloudModel {
  const m = metadata as { count?: number; bounds?: { min?: number[]; max?: number[] }; pivot?: number[]; headCenter?: number[]; headSize?: number[]; forward?: number[] } | null;
  const vector = (value: unknown): value is number[] => Array.isArray(value) && value.length === 3 && value.every((n) => typeof n === "number" && Number.isFinite(n));
  if (!m || !Number.isSafeInteger(m.count) || m.count! <= 0 || binary.byteLength !== m.count! * 12 ||
      !vector(m.bounds?.min) || !vector(m.bounds?.max) || !vector(m.pivot) || !vector(m.headCenter) || !vector(m.headSize) || !vector(m.forward)) {
    throw new Error("Custom: invalid point cloud or metadata");
  }
  const box = new Box3(new Vector3().fromArray(m.bounds.min), new Vector3().fromArray(m.bounds.max));
  const size = box.getSize(new Vector3());
  const headCenter = new Vector3().fromArray(m.headCenter);
  const forward = new Vector3().fromArray(m.forward);
  if (Math.min(size.x, size.y, size.z, ...m.headSize) <= 0 || !box.containsPoint(headCenter) || !box.containsPoint(new Vector3().fromArray(m.pivot)) || forward.distanceTo(new Vector3(0, 0, 1)) > 1e-6) {
    throw new Error("Custom: invalid bounds, calibration or forward (+Z required)");
  }
  const positions = new Float32Array(m.count! * 3);
  const data = new DataView(binary);
  const point = new Vector3();
  const tolerance = size.length() * 1e-5;
  const allowed = box.clone().expandByScalar(tolerance);
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis++) positions[i + axis] = data.getFloat32((i + axis) * 4, true);
    point.fromArray(positions, i);
    if (!point.toArray().every(Number.isFinite) || !allowed.containsPoint(point)) throw new Error("Custom: non-finite or out-of-bounds point");
  }
  return {
    positions, box, size, pivot: new Vector3().fromArray(m.pivot), headCenter,
    headSize: new Vector2(m.headSize[0], m.headSize[1]), forward, unitScale: size.y / REFERENCE_HEIGHT,
  };
}

export function flowField(model: CloudModel) {
  const span = Math.max(model.size.x, model.size.y) + 2 * .15 * model.unitScale;
  return { span, origin: new Vector2((model.box.max.x + model.box.min.x - span) / 2, (model.box.max.y + model.box.min.y - span) / 2) };
}

export function createGrainGeometry(positions: Float32Array) {
  const count = positions.length / 3;
  const side = 2 ** Math.ceil(Math.log2(Math.sqrt(count)));
  const refs = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    refs[i * 2] = ((i % side) + 0.5) / side;
    refs[i * 2 + 1] = (Math.floor(i / side) + 0.5) / side;
  }
  const geometry = new InstancedBufferGeometry();
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]), 3));
  geometry.setAttribute("aHome", new InstancedBufferAttribute(positions, 3));
  geometry.setAttribute("aRef", new InstancedBufferAttribute(refs, 2));
  geometry.instanceCount = count;
  return geometry;
}

export function createZeroTexture(float = true) {
  const texture = new DataTexture(float ? new Float32Array(4) : new Uint8Array(4), 1, 1, RGBAFormat, float ? FloatType : UnsignedByteType);
  texture.needsUpdate = true;
  return texture;
}

// 锚定头部时先计算受约束的抬升量，再应用完整视线旋转。
export function placeRig(rig: Group, camera: PerspectiveCamera, pose: Pose, headInRig: Vector3, gaze = [0, 0, 0], anchor = 0) {
  rig.scale.setScalar(pose.scale);
  rig.rotation.set(pose.pitch + gaze[0] * anchor, pose.yaw + gaze[1] * anchor, pose.roll + gaze[2] * anchor, "YXZ");
  const lift = headInRig.clone().multiplyScalar(pose.scale).applyEuler(rig.rotation);
  const half = (camera.position.z - lift.z) * Math.tan(FOV * Math.PI / 360);
  rig.position.set(pose.x * half * camera.aspect - lift.x, pose.y * half - lift.y, 0);
  rig.rotation.set(pose.pitch + gaze[0], pose.yaw + gaze[1], pose.roll + gaze[2], "YXZ");
  rig.updateMatrixWorld(true);
}

export function fitCloud(model: CloudModel, width: number, height: number) {
  const aspect = width / height;
  const view = Math.max(model.size.y / SIZE, model.size.x / (WIDE * aspect));
  const headInRig = model.headCenter.clone().sub(model.pivot);
  return {
    view,
    cameraZ: view / 2 / Math.tan(FOV * Math.PI / 360),
    headInRig,
    heroY: (-view / 2 - BLEED * view + headInRig.y) / (view / 2),
    unitsPerPx: view / height,
    bustTop: (1 + BLEED - model.size.y / view) * 100,
  };
}

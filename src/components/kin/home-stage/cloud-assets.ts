import { DoubleSide, type Group, type Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { prepareCustomCloud } from "../cloud-model.ts";

// 点云采样与碰撞只需要几何，避免为隐藏的碰撞网格加载贴图。
export async function parseSurface(data: ArrayBuffer) {
  const loader = new GLTFLoader();
  loader.register((parser) => ({
    name: "KIN_geometry_only",
    async beforeRoot() {
      for (const mesh of parser.json.meshes ?? []) {
        for (const primitive of mesh.primitives) delete primitive.material;
      }
    },
  }));
  const { scene } = await loader.parseAsync(data, "");
  scene.updateMatrixWorld(true);
  scene.traverse((object) => {
    if (!(object as Mesh).isMesh) return;
    const mesh = object as Mesh;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.side = DoubleSide;
  });
  return scene;
}

export function disposeSurface(surface: Group) {
  surface.traverse((object) => {
    if (!(object as Mesh).isMesh) return;
    const mesh = object as Mesh;
    mesh.geometry.dispose();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
  });
}

async function asset(path: string, signal?: AbortSignal) {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response;
}

export async function loadCloud(signal?: AbortSignal) {
  const [binary, metadata, glb] = await Promise.all([
    asset("/models/custom/person.bin", signal).then((response) => response.arrayBuffer()),
    asset("/models/custom/metadata.json", signal).then((response) => response.json()),
    asset("/models/custom/person.glb", signal).then((response) => response.arrayBuffer()),
  ]);
  signal?.throwIfAborted();
  const surface = await parseSurface(glb);
  try { signal?.throwIfAborted(); return { ...prepareCustomCloud(binary, metadata), surface }; }
  catch (error) { disposeSurface(surface); throw error; }
}

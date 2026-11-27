import { CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from "three"
import type { CloudModel } from "../cloud-model"

export function createTextRing(model: CloudModel) {
  const group = new Group()
  const orbit = new Group()
  const text = "CREATIVE DEVELOPMENT  /  NEXT.JS  /  REACT  /  THREE.JS  /  DESIGN & CODE  /  "
  const radius = model.size.x * .55
  const height = model.size.y * .225
  const textures = new Map<string, CanvasTexture>()
  const material = new Map<string, MeshBasicMaterial>()
  const geometry = new PlaneGeometry(radius * Math.PI * 2 / text.length * 1.7, height)
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === " ") continue
    if (!textures.has(char)) {
      const canvas = document.createElement("canvas")
      canvas.width = 128; canvas.height = 128
      const context = canvas.getContext("2d")!
      context.fillStyle = "white"
      context.font = '500 100px "Helvetica Neue", Helvetica, sans-serif'
      context.textAlign = "center"; context.textBaseline = "middle"
      context.fillText(char, 64, 66)
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      textures.set(char, texture)
      material.set(char, new MeshBasicMaterial({ map: texture, transparent: true, alphaTest: .08, depthWrite: false, side: DoubleSide, toneMapped: false }))
    }
    const angle = i / text.length * Math.PI * 2
    const letter = new Mesh(geometry, material.get(char)!)
    letter.position.set(Math.sin(angle) * radius, 0, Math.cos(angle) * radius)
    letter.rotation.y = angle
    orbit.add(letter)
  }
  group.position.set(-model.pivot.x, model.box.min.y + model.size.y * .42 - model.pivot.y, -model.pivot.z)
  group.rotation.x = .12
  group.add(orbit)
  group.visible = false
  return {
    group,
    step(dt: number) { orbit.rotation.y -= dt * Math.PI * 2 / 18 },
    dispose() { geometry.dispose(); for (const value of textures.values()) value.dispose(); for (const value of material.values()) value.dispose() },
  }
}

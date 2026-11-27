import type { Pose } from "../cloud-model.ts";

export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const seg = (v: number, a: number, b: number) => clamp((v - a) / (b - a));
export const smooth = (v: number) => { const t = clamp(v); return t * t * (3 - 2 * t); };
export type ScrollLayout = { os: number; transition: number; projects: number; process?: number; services?: number; footer?: number; vh: number; width?: number };
export type ScrollTarget = { pose: Pose; scatter: number; hero: number; dim: number };
export type StageBox = { s: number; tx: number; ty: number };

export function scrollAt(y: number, heroY: number, layout: ScrollLayout): ScrollTarget {
  const around = (top: number, a: number, b: number) => smooth(seg(y, top + a * layout.vh, top + b * layout.vh));
  const inOS = around(layout.os, 0, .8);
  const recenter = around(layout.transition, -1.3, -1);
  const scatter = around(layout.transition, 0, .8);
  const mobile = (layout.width ?? 1024) < 768;
  const narrow = (layout.width ?? 1024) < 1100;
  const pose: Pose = {
    x: (mobile ? 0 : .42) * inOS * (1 - recenter),
    y: heroY + (mobile ? .15 : .334 - heroY) * inOS * (1 - recenter),
    scale: mobile ? 1.2 - .35 * inOS + .35 * recenter : 1,
    yaw: -.5 * inOS * (1 - recenter),
    pitch: .18 * inOS * (1 - recenter),
    roll: 0,
  };
  if (layout.process !== undefined && y >= layout.process - layout.vh) {
    const gather = around(layout.process, -1, -.35);
    const process = around(layout.process, -.65, 0);
    const side = layout.services === undefined ? 0 : around(layout.services, -1, 0);
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    return {
      pose: {
        x: mobile ? mix(0, .75, side) : mix((narrow ? .9 : .68) * process, narrow ? .9 : .64, side),
        y: mobile ? mix(heroY, -.05, side) : mix(mix(heroY, -.1, process), .08, side),
        scale: mobile ? 1.2 : mix(mix(1, narrow ? 1.1 : 1.65, process), narrow ? 1.15 : 1.8, side),
        yaw: mobile ? 0 : mix(-.785 * process, -.35, side),
        pitch: mobile ? 0 : mix(.175 * process, .06, side), roll: 0,
      },
      scatter: 1 - gather, hero: 0, dim: .25 * gather + .4 * Math.max(process, side),
    };
  }
  return { pose, scatter, hero: 1 - inOS, dim: 0 };
}

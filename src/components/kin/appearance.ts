// 默认颜色采用浅蓝渐变，颜色位置固定为 0 / .32 / 1。
export const APPEARANCE = {
  base: "#FFFFFF",
  middle: "#B8DDEF",
  accent: "#7AAEC8",
  particleSize: 0.005,
  filmGrain: 0.335,
  bloom: { strength: 0.020, radius: 0.9, threshold: 0 },
  liquidStrength: 0.5,
};

export type Appearance = typeof APPEARANCE;

// 移动端减少像素填充；弱设备保留姿态、点云与重组，跳过液体计算。
export function renderQuality(dpr: number, mobile: boolean, cores: number, memory?: number) {
  const low = cores <= 4 || (memory !== undefined && memory <= 4);
  return { dpr: Math.min(dpr, low ? 1 : mobile ? 1.5 : 2), liquid: !low };
}

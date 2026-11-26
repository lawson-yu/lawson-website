import assert from "node:assert/strict";
import test from "node:test";
import "./register-paths.mjs";

const { renderQuality } = await import("../src/components/kin/appearance.ts");

test("渲染质量策略区分弱设备与普通配置", () => {
  assert.deepEqual(renderQuality(2, false, 8, 8), { dpr: 2, liquid: true });
  assert.deepEqual(renderQuality(2, true, 8, 8), { dpr: 1.5, liquid: true });
  assert.deepEqual(renderQuality(2, false, 4, 8), { dpr: 1, liquid: false });
  assert.deepEqual(renderQuality(2, false, 8, 4), { dpr: 1, liquid: false });
});

test("未报告设备指标沿用正常质量，不按弱设备处理", () => {
  assert.deepEqual(renderQuality(2, false, Number.POSITIVE_INFINITY), { dpr: 2, liquid: true });
});

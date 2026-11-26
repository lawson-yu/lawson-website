import assert from "node:assert/strict";
import test from "node:test";
import "./register-paths.mjs";

const {
  VISITOR_RECORD_RETENTION_MONTHS,
  getVisitorRecordCutoff,
} = await import("../src/lib/visitor-retention.ts");

test("访客记录保留期默认 24 个月并正确计算截断时间", () => {
  assert.equal(VISITOR_RECORD_RETENTION_MONTHS, 24);

  const regular = getVisitorRecordCutoff(new Date("2026-11-26T10:15:30.000Z"));
  assert.equal(regular.toISOString(), "2024-11-26T10:15:30.000Z");

  // 闰年 2 月 29 日回推 24 个月落在非闰年 2 月底。
  const leapDay = getVisitorRecordCutoff(new Date("2024-02-29T08:00:00.000Z"));
  assert.equal(leapDay.toISOString(), "2022-02-28T08:00:00.000Z");

  // 自定义月数时若目标月天数更少，应钳位到目标月最后一天而非溢出到下月。
  const monthEnd = getVisitorRecordCutoff(new Date("2026-03-31T12:00:00.000Z"), 1);
  assert.equal(monthEnd.toISOString(), "2026-02-28T12:00:00.000Z");
});

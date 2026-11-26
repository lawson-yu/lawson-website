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
});

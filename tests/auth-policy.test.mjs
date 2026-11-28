import assert from "node:assert/strict";
import test from "node:test";
import "./register-paths.mjs";

const { isSiteOwner } = await import("../src/lib/auth-policy.ts");

test("站长白名单忽略邮箱大小写并拒绝名单外账号", () => {
  const original = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "owner@example.com, second@example.com ";

  try {
    assert.equal(isSiteOwner("OWNER@example.com", true), true);
    assert.equal(isSiteOwner("OWNER@example.com", false), false);
    assert.equal(isSiteOwner("visitor@example.com", true), false);
    assert.equal(isSiteOwner(undefined, true), false);
  } finally {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  }
});

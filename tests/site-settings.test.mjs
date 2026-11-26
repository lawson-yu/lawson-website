import assert from "node:assert/strict";
import test from "node:test";
import "./register-paths.mjs";

const { validateSiteSettings } = await import("../src/lib/site-settings.ts");

const validSettings = {
  heroIntroduction: "  原文介绍\n保留换行  ",
  contactUrl: "mailto:hello@example.com",
  socialLinks: [
    { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
  ],
};

test("站点联系入口接受 mailto 与 HTTPS，并保留介绍原文", () => {
  const result = validateSiteSettings(validSettings);
  assert.equal(result.ok, true);
  assert.equal(result.value.heroIntroduction, "  原文介绍\n保留换行  ");

  const httpsResult = validateSiteSettings({
    ...validSettings,
    contactUrl: "https://example.com/contact",
  });
  assert.equal(httpsResult.ok, true);
});

test("站点联系入口拒绝 HTTP 和非邮件的 mailto 地址", () => {
  for (const contactUrl of ["http://example.com", "mailto:not-an-email"]) {
    const result = validateSiteSettings({ ...validSettings, contactUrl });
    assert.equal(result.ok, false);
    assert.equal(result.errors.contactUrl, "contactUrlInvalid");
  }
});

test("社交链接必须有名称、HTTPS 地址和受支持图标", () => {
  for (const socialLink of [
    { name: "", url: "https://github.com/lawson", icon: "code" },
    { name: "GitHub", url: "http://github.com/lawson", icon: "code" },
    { name: "GitHub", url: "https://github.com/lawson", icon: "unknown" },
  ]) {
    const result = validateSiteSettings({
      ...validSettings,
      socialLinks: [socialLink],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.socialLinks);
  }

  const emptyLinks = validateSiteSettings({ ...validSettings, socialLinks: [] });
  assert.equal(emptyLinks.ok, true);
});

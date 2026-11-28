import assert from "node:assert/strict";
import { test } from "node:test";
import "./register-paths.mjs";
import { getContentLocale, isContentLanguage } from "../src/lib/content-language.ts";
import { isValidSlug } from "../src/lib/slug.ts";

test("content languages and slugs accept only the supported domain values", () => {
  assert.equal(isContentLanguage("zh"), true);
  assert.equal(isContentLanguage("en"), true);
  assert.equal(isContentLanguage("fr"), false);
  assert.equal(getContentLocale("en"), "en");
  assert.equal(getContentLocale("unexpected"), "zh");

  for (const slug of ["article", "article-2", "2026-update"]) {
    assert.equal(isValidSlug(slug), true, slug);
  }
  for (const slug of ["", "-article", "article-", "double--hyphen", "Uppercase", "with space", "under_score"]) {
    assert.equal(isValidSlug(slug), false, slug);
  }
});

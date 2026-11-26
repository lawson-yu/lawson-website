import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { getPrisma } from "@/server/db";

export const SITE_SETTINGS_CACHE_TAG = "site-settings";

export async function getSiteSetting() {
  await connection();
  return getCachedSiteSetting();
}

async function getCachedSiteSetting() {
  "use cache";
  cacheLife("hours");
  cacheTag(SITE_SETTINGS_CACHE_TAG);

  return getPrisma().siteSetting.findUnique({ where: { id: 1 } });
}

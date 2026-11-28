"use server";

import { updateTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@/generated/prisma/client";
import {
  validateSiteSettings,
  type SiteSettingsDraft,
} from "@/lib/site-settings";
import { requireSiteOwner } from "@/server/auth";
import { getPrisma } from "@/server/db";
import { SITE_SETTINGS_CACHE_TAG } from "@/server/site-settings";

export interface SiteSettingsActionState {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: { contactUrl?: string; socialLinks?: string };
  values?: SiteSettingsDraft;
}

function readDraft(formData: FormData): SiteSettingsDraft | null {
  const heroIntroduction = formData.get("heroIntroduction");
  const contactUrl = formData.get("contactUrl");
  const socialLinksJson = formData.get("socialLinks");
  if (
    typeof heroIntroduction !== "string" ||
    typeof contactUrl !== "string" ||
    typeof socialLinksJson !== "string"
  ) {
    return null;
  }

  try {
    const parsedSocialLinks: unknown = JSON.parse(socialLinksJson);
    if (!Array.isArray(parsedSocialLinks)) return null;

    return {
      heroIntroduction,
      contactUrl,
      socialLinks: parsedSocialLinks.map((link) => ({
        name: typeof link?.name === "string" ? link.name : "",
        url: typeof link?.url === "string" ? link.url : "",
        icon: typeof link?.icon === "string" ? link.icon : "",
      })),
    };
  } catch {
    return null;
  }
}

export async function saveSiteSettings(
  _previousState: SiteSettingsActionState,
  formData: FormData,
): Promise<SiteSettingsActionState> {
  await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "AdminActions" });

  const draft = readDraft(formData);
  if (!draft) {
    return {
      status: "error",
      message: t("siteSettingsParseError"),
    };
  }

  const validation = validateSiteSettings(draft);
  if (!validation.ok) {
    return {
      status: "error",
      message: t("siteSettingsValidationError"),
      errors: {
        contactUrl: validation.errors.contactUrl ? t("siteContactUrlInvalid") : undefined,
        socialLinks: validation.errors.socialLinks ? t("siteSocialLinksInvalid") : undefined,
      },
      values: draft,
    };
  }

  const { socialLinks, ...textValues } = validation.value;
  const values = {
    ...textValues,
    socialLinks: socialLinks as unknown as Prisma.InputJsonValue,
  };

  try {
    await getPrisma().siteSetting.upsert({
      where: { id: 1 },
      create: { id: 1, ...values },
      update: values,
    });
  } catch {
    return {
      status: "error",
      message: t("siteSettingsSaveError"),
      values: draft,
    };
  }

  updateTag(SITE_SETTINGS_CACHE_TAG);
  return { status: "success", message: t("siteSettingsSaveSuccess") };
}

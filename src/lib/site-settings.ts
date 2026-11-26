export const SOCIAL_ICON_OPTIONS = [
  "code",
  "work",
  "camera",
  "video",
  "link",
] as const;

export type SocialIcon = (typeof SOCIAL_ICON_OPTIONS)[number];

export interface SocialLinkDraft {
  name: string;
  url: string;
  icon: string;
}

export interface SocialLink extends SocialLinkDraft {
  icon: SocialIcon;
}

export interface SiteSettingsDraft {
  heroIntroduction: string;
  contactUrl: string;
  socialLinks: SocialLinkDraft[];
}

export interface SiteSettingsValues {
  heroIntroduction: string | null;
  contactUrl: string | null;
  socialLinks: SocialLink[];
}

export type SiteSettingsValidation =
  | { ok: true; value: SiteSettingsValues }
  | {
      ok: false;
      errors: { contactUrl?: string; socialLinks?: string };
    };

function isHttpsUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function isContactUrl(value: string) {
  const address = value.trim();
  if (address.toLowerCase().startsWith("mailto:")) {
    const recipient = address.slice("mailto:".length).split("?")[0];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient);
  }

  return isHttpsUrl(address);
}

export function validateSiteSettings(
  draft: SiteSettingsDraft,
): SiteSettingsValidation {
  const errors: { contactUrl?: string; socialLinks?: string } = {};

  if (draft.contactUrl.trim() && !isContactUrl(draft.contactUrl)) {
    errors.contactUrl = "contactUrlInvalid";
  }

  if (
    draft.socialLinks.some(
      (link) =>
        !link.name.trim() ||
        !isHttpsUrl(link.url) ||
        !SOCIAL_ICON_OPTIONS.includes(link.icon as SocialIcon),
    )
  ) {
    errors.socialLinks = "socialLinksInvalid";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      heroIntroduction: draft.heroIntroduction.trim()
        ? draft.heroIntroduction
        : null,
      contactUrl: draft.contactUrl.trim() ? draft.contactUrl.trim() : null,
      socialLinks: draft.socialLinks.map((link) => ({
        name: link.name,
        url: link.url.trim(),
        icon: link.icon as SocialIcon,
      })),
    },
  };
}

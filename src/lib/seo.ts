import type { Metadata } from "next";
import {
  DEFAULT_OG_IMAGE_PATH,
  resolveAbsoluteMediaUrl,
} from "@/lib/media-url";

export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

export function getSiteOrigin(override?: string): string {
  const raw = (
    override ||
    process.env.SITE_URL ||
    process.env.BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).trim();
  try {
    return new URL(raw).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function toOgLocale(language: "zh" | "en") {
  return language === "en" ? "en_US" : "zh_CN";
}

function defaultOgImageUrl(siteOrigin: string) {
  return new URL(DEFAULT_OG_IMAGE_PATH, siteOrigin).toString();
}

export function buildDetailMetadata(input: {
  section: "articles" | "projects";
  slug: string;
  title: string;
  description: string;
  bodyLanguage: string;
  coverImageKey?: string | null;
  publishedTime?: Date | null;
  siteOrigin?: string;
  mediaBaseUrl?: string;
}): Metadata {
  const siteOrigin = getSiteOrigin(input.siteOrigin);
  const bodyLocale: "zh" | "en" = input.bodyLanguage === "en" ? "en" : "zh";
  const canonical = `/${bodyLocale}/${input.section}/${input.slug}`;
  const coverUrl = resolveAbsoluteMediaUrl(input.coverImageKey, {
    siteOrigin,
    mediaBaseUrl: input.mediaBaseUrl,
  });
  const shareImageUrl = coverUrl ?? defaultOgImageUrl(siteOrigin);

  return {
    metadataBase: new URL(siteOrigin),
    title: input.title,
    description: input.description,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        zh: `/zh/${input.section}/${input.slug}`,
        en: `/en/${input.section}/${input.slug}`,
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "article",
      title: input.title,
      description: input.description,
      url: canonical,
      locale: toOgLocale(bodyLocale),
      alternateLocale: [toOgLocale(bodyLocale === "en" ? "zh" : "en")],
      ...(input.publishedTime ? { publishedTime: input.publishedTime.toISOString() } : {}),
      authors: ["Lawson"],
      images: [
        {
          url: shareImageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [shareImageUrl],
    },
  };
}

export function buildListMetadata(input: {
  locale: string;
  section: "articles" | "projects";
  title: string;
  description: string;
  hasFilterOrLoadState?: boolean;
  siteOrigin?: string;
}): Metadata {
  const siteOrigin = getSiteOrigin(input.siteOrigin);
  const uiLocale: "zh" | "en" = input.locale === "en" ? "en" : "zh";
  const canonical = `/${uiLocale}/${input.section}`;
  const shareImageUrl = defaultOgImageUrl(siteOrigin);

  return {
    metadataBase: new URL(siteOrigin),
    title: input.title,
    description: input.description,
    robots: input.hasFilterOrLoadState
      ? { index: false, follow: true }
      : { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        zh: `/zh/${input.section}`,
        en: `/en/${input.section}`,
        "x-default": `/zh/${input.section}`,
      },
    },
    openGraph: {
      type: "website",
      title: input.title,
      description: input.description,
      url: canonical,
      locale: toOgLocale(uiLocale),
      alternateLocale: [toOgLocale(uiLocale === "en" ? "zh" : "en")],
      images: [
        {
          url: shareImageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [shareImageUrl],
    },
  };
}

export function buildHomeMetadata(input: {
  locale: string;
  title: string;
  description: string;
  siteOrigin?: string;
}): Metadata {
  const siteOrigin = getSiteOrigin(input.siteOrigin);
  const uiLocale: "zh" | "en" = input.locale === "en" ? "en" : "zh";
  const canonical = `/${uiLocale}`;
  const shareImageUrl = defaultOgImageUrl(siteOrigin);

  return {
    metadataBase: new URL(siteOrigin),
    title: input.title,
    description: input.description,
    robots: { index: true, follow: true },
    alternates: {
      canonical,
      languages: {
        zh: "/zh",
        en: "/en",
        "x-default": "/zh",
      },
    },
    openGraph: {
      type: "website",
      title: input.title,
      description: input.description,
      url: canonical,
      locale: toOgLocale(uiLocale),
      alternateLocale: [toOgLocale(uiLocale === "en" ? "zh" : "en")],
      images: [
        {
          url: shareImageUrl,
          width: OG_IMAGE_WIDTH,
          height: OG_IMAGE_HEIGHT,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [shareImageUrl],
    },
  };
}

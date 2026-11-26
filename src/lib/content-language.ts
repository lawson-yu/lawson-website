export const CONTENT_LANGUAGES = ["zh", "en"] as const;

export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export function isContentLanguage(value: unknown): value is ContentLanguage {
  return value === "zh" || value === "en";
}

export function getContentLocale(value: string | null | undefined): ContentLanguage {
  return value === "en" ? "en" : "zh";
}

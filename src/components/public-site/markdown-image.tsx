import { resolveMediaUrl } from "@/lib/media-url";

export function MarkdownImage({ src, alt }: { src?: string | Blob; alt?: string }) {
  if (typeof src !== "string") return null;
  const imageSrc = resolveMediaUrl(src);

  // eslint-disable-next-line @next/next/no-img-element
  return imageSrc ? <img src={imageSrc} alt={alt ?? ""} loading="lazy" /> : null;
}

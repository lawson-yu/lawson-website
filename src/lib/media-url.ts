// 媒体路径安全校验与公开访问地址解析（客户端与服务端共用）

export const DEFAULT_CARD_COVER_PATH = "/images/prototype/article-list/fragment.webp";
export const DEFAULT_OG_IMAGE_PATH = "/og-default.png";

const SAFE_MEDIA_KEY_PATTERN = /^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]{2,8}$/i;

/**
 * 校验相对媒体 key 是否安全：禁止前导斜杠、路径穿越、反斜杠、空字节及协议前缀。
 */
export function isSafeMediaKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 512) return false;
  if (trimmed.includes("\\") || trimmed.includes("\0") || trimmed.includes("..")) return false;
  if (trimmed.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return false;
  if (trimmed.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    return false;
  }
  return SAFE_MEDIA_KEY_PATTERN.test(trimmed);
}

/**
 * 校验站内静态资源路径（如 `/images/...`、`/uploads/...`）。
 */
export function isSafePublicAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return false;
  if (trimmed.includes("\\") || trimmed.includes("\0") || trimmed.includes("..")) return false;
  return true;
}

/**
 * 校验表单提交的封面字段：允许留空、合法相对 key 或站内静态路径。
 */
export function normalizeSubmittedMediaKey(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;
  if (isSafeMediaKey(trimmed) || isSafePublicAssetPath(trimmed)) return trimmed;
  return null;
}

export function getConfiguredMediaBaseUrl(): string {
  return (
    process.env.MEDIA_PUBLIC_BASE_URL ||
    process.env.MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_MEDIA_BASE_URL ||
    ""
  ).trim();
}

/**
 * 将相对 key、站内路径或 http(s) 地址解析为页面可用的公开图片 URL。
 * 非法或危险协议（如 javascript:/data:）返回 null。
 */
export function resolveMediaUrl(
  keyOrUrl: string | null | undefined,
  options?: { mediaBaseUrl?: string },
): string | null {
  const value = (keyOrUrl ?? "").trim();
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
    } catch {
      return null;
    }
  }

  if (value.startsWith("/")) {
    return isSafePublicAssetPath(value) ? value : null;
  }

  if (!isSafeMediaKey(value)) return null;

  const baseUrl = (options?.mediaBaseUrl !== undefined ? options.mediaBaseUrl : getConfiguredMediaBaseUrl()).trim();
  if (baseUrl) {
    const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
    return new URL(value, normalizedBase).toString();
  }

  return `/uploads/${value}`;
}

/**
 * 解析分享抓取所需的绝对图片地址（og:image / twitter:image）。
 */
export function resolveAbsoluteMediaUrl(
  keyOrUrl: string | null | undefined,
  options: { siteOrigin: string; mediaBaseUrl?: string },
): string | null {
  const resolved = resolveMediaUrl(keyOrUrl, { mediaBaseUrl: options.mediaBaseUrl });
  if (!resolved) return null;
  if (/^https?:\/\//i.test(resolved)) return resolved;
  return new URL(resolved, options.siteOrigin).toString();
}

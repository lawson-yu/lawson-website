import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getArticleImageUrl } from "@/server/articles";

export type ArticleHeading = {
  depth: 2 | 3;
  text: string;
  id: string;
};

export function getArticleHeadings(markdown: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const usedIds = new Map<string, number>();
  let fence: { marker: string; length: number } | undefined;

  for (const line of markdown.split("\n")) {
    const fenceLine = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceLine) {
      const marker = fenceLine[1][0];
      const length = fenceLine[1].length;
      if (!fence) fence = { marker, length };
      else if (fence.marker === marker && length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;

    const match = line.match(/^ {0,3}(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;

    const text = match[2]
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!?\[([^\]]+)\]\([^)]*\)/g, "$1")
      .replace(/[*_~]/g, "")
      .trim();
    const base = text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\p{L}\p{N}_-]+/gu, "-")
      .replace(/-+/g, "-")
      .replace(/^[-_]+|[-_]+$/g, "") || "section";
    const occurrence = usedIds.get(base) ?? 0;
    usedIds.set(base, occurrence + 1);

    headings.push({
      depth: match[1].length as 2 | 3,
      text,
      id: occurrence ? `${base}-${occurrence}` : base,
    });
  }

  return headings;
}

export function ArticleMarkdown({
  markdown,
  headings,
}: {
  markdown: string;
  headings: ArticleHeading[];
}) {
  let headingIndex = 0;

  function renderHeading(Tag: "h2" | "h3") {
    return function Heading({ children }: { children?: ReactNode }) {
      const heading = headings[headingIndex++];
      return <Tag id={heading?.id}>{children}</Tag>;
    };
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h2: renderHeading("h2"),
        h3: renderHeading("h3"),
        img: ({ src, alt }) => {
          if (typeof src !== "string") return null;
          const imageSrc = src?.startsWith("/") || /^https?:\/\//i.test(src ?? "")
            ? src
            : src
              ? getArticleImageUrl(src)
              : undefined;

          // eslint-disable-next-line @next/next/no-img-element
          return imageSrc ? <img src={imageSrc} alt={alt ?? ""} loading="lazy" /> : null;
        },
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/public-site/markdown-image";

export type ArticleHeading = {
  depth: 2 | 3;
  text: string;
  id: string;
};

export function getArticleHeadings(markdown: string): ArticleHeading[] {
  const headings: ArticleHeading[] = [];
  const usedIds = new Map<string, number>();
  const paragraphLines: string[] = [];
  let fence: { marker: string; length: number } | undefined;

  const addHeading = (depth: 2 | 3, sourceText: string) => {
    const text = sourceText
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
      depth,
      text,
      id: occurrence ? `${base}-${occurrence}` : base,
    });
  };

  for (const line of markdown.split("\n")) {
    const fenceLine = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceLine) {
      paragraphLines.length = 0;
      const marker = fenceLine[1][0];
      const length = fenceLine[1].length;
      if (!fence) fence = { marker, length };
      else if (fence.marker === marker && length >= fence.length) fence = undefined;
      continue;
    }
    if (fence) continue;

    if (!line.trim()) {
      paragraphLines.length = 0;
      continue;
    }

    const setext = line.match(/^ {0,3}(=+|-+)\s*$/);
    if (setext) {
      if (setext[1][0] === "-" && paragraphLines.length > 0) {
        addHeading(2, paragraphLines.join(" "));
      }
      paragraphLines.length = 0;
      continue;
    }

    const atx = line.match(/^ {0,3}(#{2,3})\s+(.+?)\s*#*\s*$/);
    if (atx) {
      addHeading(atx[1].length as 2 | 3, atx[2]);
      paragraphLines.length = 0;
      continue;
    }

    paragraphLines.push(line.trim());
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
        img: MarkdownImage,
      }}
    >
      {markdown}
    </ReactMarkdown>
  );
}

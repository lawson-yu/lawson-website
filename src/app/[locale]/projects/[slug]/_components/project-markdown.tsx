import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/public-site/markdown-image";
import type { ReadingHeading } from "@/components/public-site/reading-frame";

function safeHref(value: string | undefined) {
  const href = (value ?? "").trim();
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href;
  return null;
}

export function ProjectMarkdown({
  source,
  codeScrollLabel,
  headings = [],
}: {
  source: string;
  codeScrollLabel: string;
  headings?: ReadingHeading[];
}) {
  let headingIndex = 0;

  function renderHeading(Tag: "h2" | "h3") {
    return function Heading({ children }: { children?: ReactNode }) {
      const heading = headings[headingIndex++];
      return <Tag id={heading?.id}>{children}</Tag>;
    };
  }

  return (
    <div className="project-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
          h2: renderHeading("h2"),
          h3: renderHeading("h3"),
          a: ({ href, children }) => {
            const safe = safeHref(href);
            return safe ? <a href={safe}>{children}</a> : <>{children}</>;
          },
          pre: ({ children }) => (
            <pre tabIndex={0} aria-label={codeScrollLabel}>
              {children}
            </pre>
          ),
          img: MarkdownImage,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

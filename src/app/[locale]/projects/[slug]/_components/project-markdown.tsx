import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownImage } from "@/components/public-site/markdown-image";

function safeHref(value: string | undefined) {
  const href = (value ?? "").trim();
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href;
  return null;
}

export function ProjectMarkdown({ source, codeScrollLabel }: { source: string; codeScrollLabel: string }) {
  return (
    <div className="project-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2>{children}</h2>,
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

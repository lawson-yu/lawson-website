import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { resolveMediaUrl } from "@/lib/media-url";

function safeHref(value: string | undefined) {
  const href = (value ?? "").trim();
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href;
  return null;
}

export function ProjectMarkdown({ source }: { source: string }) {
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
            <pre tabIndex={0} aria-label="代码，可横向滚动">
              {children}
            </pre>
          ),
          img: ({ src, alt }) => {
            if (typeof src !== "string") return null;
            const imageSrc = resolveMediaUrl(src);
            // eslint-disable-next-line @next/next/no-img-element
            return imageSrc ? <img src={imageSrc} alt={alt ?? ""} loading="lazy" /> : null;
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

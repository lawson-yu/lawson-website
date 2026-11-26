import type { ReactNode } from "react";

function safeHref(value: string) {
  const href = value.trim();
  if (/^(https?:|mailto:|\/|#)/i.test(href)) return href;
  return null;
}

function inlineMarkdown(value: string, prefix: string): ReactNode[] {
  const tokens = value.split(/(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);

  return tokens.map((token, index) => {
    const key = `${prefix}-${index}`;
    if (!token) return null;
    if (token.startsWith("[") && token.includes("](")) {
      const splitAt = token.indexOf("](");
      const label = token.slice(1, splitAt);
      const href = safeHref(token.slice(splitAt + 2, -1));
      return href ? <a key={key} href={href}>{label}</a> : label;
    }
    if (token.startsWith("`")) return <code key={key}>{token.slice(1, -1)}</code>;
    if (token.startsWith("**") || token.startsWith("__")) {
      return <strong key={key}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith("*") || token.startsWith("_")) {
      return <em key={key}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
}

function isBlockStart(line: string) {
  return /^(#{1,6}\s|```|\s*[-*+]\s+|\s*\d+\.\s+|>\s?|---+$)/.test(line);
}

export function ProjectMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      blocks.push(
        <pre key={`code-${index}`} tabIndex={0} aria-label={fence[1] || "代码，可横向滚动"}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      index += 1;
      const content = inlineMarkdown(heading[2], `heading-${index}`);
      const level = Math.min(Math.max(heading[1].length, 2), 6);
      if (level === 2) blocks.push(<h2 key={`heading-${index}`}>{content}</h2>);
      else if (level === 3) blocks.push(<h3 key={`heading-${index}`}>{content}</h3>);
      else if (level === 4) blocks.push(<h4 key={`heading-${index}`}>{content}</h4>);
      else if (level === 5) blocks.push(<h5 key={`heading-${index}`}>{content}</h5>);
      else blocks.push(<h6 key={`heading-${index}`}>{content}</h6>);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: ReactNode[] = [];
      while (index < lines.length && /^\s*([-*+]\s+|\d+\.\s+)/.test(lines[index])) {
        const item = lines[index].replace(/^\s*([-*+]\s+|\d+\.\s+)/, "");
        items.push(<li key={`list-${index}`}>{inlineMarkdown(item, `list-${index}`)}</li>);
        index += 1;
      }
      blocks.push(ordered ? <ol key={`list-${index}`}>{items}</ol> : <ul key={`list-${index}`}>{items}</ul>);
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(<blockquote key={`quote-${index}`}>{quote.map((text, i) => <p key={i}>{inlineMarkdown(text, `quote-${index}-${i}`)}</p>)}</blockquote>);
      continue;
    }

    if (/^---+$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} />);
      index += 1;
      continue;
    }

    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && (paragraph.length === 0 || !isBlockStart(lines[index]))) {
      paragraph.push(lines[index]);
      index += 1;
    }
    blocks.push(<p key={`paragraph-${index}`}>{inlineMarkdown(paragraph.join(" "), `paragraph-${index}`)}</p>);
  }

  return <div className="project-markdown">{blocks}</div>;
}

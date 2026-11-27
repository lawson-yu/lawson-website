import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { PublicCloud } from "./public-cloud";

export type ReadingHeading = {
  depth: 2 | 3;
  text: string;
  id: string;
};

function ReadingContentsList({
  headings,
  label,
  showLabel = true,
}: {
  headings: ReadingHeading[];
  label: string;
  showLabel?: boolean;
}) {
  const sections: Array<{ heading: ReadingHeading; children: ReadingHeading[] }> = [];
  for (const heading of headings) {
    if (heading.depth === 2) sections.push({ heading, children: [] });
    else sections.at(-1)?.children.push(heading);
  }

  return (
    <nav aria-label={label}>
      {showLabel && <p>{label}</p>}
      <ul>
        {sections.map(({ heading, children }) => (
          <li key={heading.id}>
            <a href={`#${heading.id}`}>{heading.text}</a>
            {children.length > 0 && (
              <ul>
                {children.map((child) => (
                  <li key={child.id}><a href={`#${child.id}`}>{child.text}</a></li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ReadingContents({
  headings,
  label,
  detailsKey,
}: {
  headings: ReadingHeading[];
  label: string;
  detailsKey: string;
}) {
  return (
    <>
      <aside className="content-reading__contents">
        <ReadingContentsList headings={headings} label={label} />
      </aside>
      <details key={detailsKey} className="content-reading__contents-mobile">
        <summary>
          {label}
          <ChevronDown aria-hidden="true" size={16} />
        </summary>
        <ReadingContentsList headings={headings} label={label} showLabel={false} />
      </details>
    </>
  );
}

export function ReadingFrame({
  lang,
  heading,
  cover,
  contents,
  bodyClassName,
  personScale = 1.0625,
  children,
}: {
  lang: string;
  heading: ReactNode;
  cover?: ReactNode;
  contents?: ReactNode;
  bodyClassName?: string;
  personScale?: number;
  children: ReactNode;
}) {
  return (
    <main className="content-reading">
      <article lang={lang}>
        <header className="content-reading__hero">
          <div className="content-reading__art">
            <PublicCloud variant="B" personScale={personScale} />
          </div>
          <div className="content-reading__opening">
            <div className="content-reading__title">{heading}</div>
            {cover && <figure className="content-reading__cover">{cover}</figure>}
          </div>
        </header>
        <div className="content-reading__layout" data-toc={contents ? "" : undefined}>
          {contents}
          <div className={`content-reading__body${bodyClassName ? ` ${bodyClassName}` : ""}`}>
            {children}
          </div>
        </div>
      </article>
    </main>
  );
}

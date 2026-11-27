import type { ReactNode } from "react";
import { PublicCloud } from "./public-cloud";

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

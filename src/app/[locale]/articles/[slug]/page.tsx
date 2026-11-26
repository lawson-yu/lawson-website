import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { resolveMediaUrl } from "@/lib/media-url";
import { buildDetailMetadata } from "@/lib/seo";
import { getPublishedArticle } from "@/server/articles";
import { ArticleMarkdown, getArticleHeadings, type ArticleHeading } from "./_components/article-markdown";
import "../articles.css";

type ArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

type PublishedArticle = NonNullable<Awaited<ReturnType<typeof getPublishedArticle>>> & {
  firstPublishedAt: Date;
  bodyLanguage: string;
};

async function readArticle(slug: string): Promise<PublishedArticle | null> {
  const article = await getPublishedArticle(slug);
  const firstPublishedAt = article?.firstPublishedAt;
  const bodyLanguage = article?.bodyLanguage;
  if (!article || !firstPublishedAt || !bodyLanguage) return null;
  return { ...article, firstPublishedAt, bodyLanguage };
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const article = await readArticle(slug);
  if (!article) return { robots: { index: false, follow: false } };

  return buildDetailMetadata({
    section: "articles",
    slug,
    title: article.title,
    description: article.excerpt,
    bodyLanguage: article.bodyLanguage,
    coverImageKey: article.coverImageKey,
    publishedTime: article.firstPublishedAt,
  });
}

function articleReturnHref(returnTo: string | undefined, slug: string) {
  if (!returnTo) return "/articles";

  try {
    const destination = new URL(returnTo, "https://lawson.invalid");
    if (destination.origin !== "https://lawson.invalid" || destination.pathname !== "/articles") {
      return "/articles";
    }

    const query = new URLSearchParams();
    for (const key of ["q", "tag", "limit"]) {
      const value = destination.searchParams.get(key);
      if (value) query.set(key, value);
    }
    const search = query.toString();
    return `/articles${search ? `?${search}` : ""}#article-${encodeURIComponent(slug)}`;
  } catch {
    return "/articles";
  }
}

function formatDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function makeContents(headings: ArticleHeading[]) {
  const sections: Array<{ heading: ArticleHeading; children: ArticleHeading[] }> = [];
  for (const heading of headings) {
    if (heading.depth === 2) sections.push({ heading, children: [] });
    else sections.at(-1)?.children.push(heading);
  }
  return sections;
}

function TableOfContents({
  headings,
  label,
}: {
  headings: ArticleHeading[];
  label: string;
}) {
  const sections = makeContents(headings);

  return (
    <nav aria-label={label}>
      <p>{label}</p>
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

export default function ArticlePage({ params, searchParams }: ArticlePageProps) {
  return (
    <Suspense fallback={<main className="article-reading" aria-busy="true" />}>
      <ArticlePageContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ArticlePageContent({ params, searchParams }: ArticlePageProps) {
  await connection();
  const [{ locale, slug }, { returnTo }] = await Promise.all([params, searchParams]);
  const returnHref = articleReturnHref(returnTo, slug);
  const [t, article] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    readArticle(slug),
  ]);
  if (!article) notFound();

  const headings = getArticleHeadings(article.body);
  const h2Count = headings.filter(({ depth }) => depth === 2).length;
  const showContents = h2Count >= 2;
  const bodyLanguage = article.bodyLanguage === "en" ? "en" : "zh";
  const coverUrl = resolveMediaUrl(article.coverImageKey);

  return (
    <main className="article-reading">
      <article lang={bodyLanguage}>
        <header className="article-reading__hero">
          <div className="article-reading__opening">
            <Link className="article-reading__back" href={returnHref}>
              <ArrowLeft aria-hidden="true" size={17} />
              {t("back")}
            </Link>
            <h1 tabIndex={-1}>{article.title}</h1>
            <p className="article-reading__byline">
              <span>{t("author")}</span>
              <time dateTime={article.firstPublishedAt.toISOString()}>
                {formatDate(article.firstPublishedAt, locale)}
              </time>
            </p>
            {article.tags.length > 0 && (
              <div className="article-reading__tags" aria-label={t("tags")}>
                {article.tags.map((tag) => (
                  <Link href={`/articles?tag=${encodeURIComponent(tag.id)}`} key={tag.id}>
                    {tag.name}
                  </Link>
                ))}
              </div>
            )}
            {coverUrl && (
              <figure className="article-reading__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt="" />
              </figure>
            )}
          </div>
        </header>

        <div className="article-reading__layout" data-toc={showContents ? "" : undefined}>
          {showContents && (
            <>
              <aside className="article-reading__contents">
                <TableOfContents headings={headings} label={t("contents")} />
              </aside>
              <details className="article-reading__contents-mobile">
                <summary>
                  {t("contents")}
                  <ChevronDown aria-hidden="true" size={16} />
                </summary>
                <TableOfContents headings={headings} label={t("contents")} />
              </details>
            </>
          )}

          <div className="article-reading__body">
            <p className="article-reading__lede">{article.excerpt}</p>
            <ArticleMarkdown markdown={article.body} headings={headings} />
            <footer className="article-reading__end">
              <Link href={returnHref}>
                {t("continue")}
                <ArrowUpRight aria-hidden="true" size={17} />
              </Link>
            </footer>
          </div>
        </div>
      </article>
    </main>
  );
}

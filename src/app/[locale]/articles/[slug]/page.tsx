import { connection } from "next/server";
import type { Metadata } from "next";
import { ArrowLeft, ArrowUpRight, ChevronDown } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getArticleImageUrl, getPublishedArticle } from "@/server/articles";
import { ArticleMarkdown, getArticleHeadings, type ArticleHeading } from "./_components/article-markdown";

type ArticlePageProps = {
  params: Promise<{ locale: string; slug: string }>;
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

  const bodyLocale = article.bodyLanguage === "en" ? "en" : "zh";
  const canonical = `/${bodyLocale}/articles/${slug}`;
  const image = article.coverImageKey
    ? getArticleImageUrl(article.coverImageKey)
    : "/images/prototype/article-list/fragment.webp";

  return {
    metadataBase: new URL(process.env.SITE_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"),
    title: article.title,
    description: article.excerpt,
    alternates: {
      canonical,
      languages: {
        zh: `/zh/articles/${slug}`,
        en: `/en/articles/${slug}`,
        "x-default": canonical,
      },
    },
    openGraph: {
      type: "article",
      title: article.title,
      description: article.excerpt,
      url: canonical,
      locale: bodyLocale === "en" ? "en_US" : "zh_CN",
      alternateLocale: bodyLocale === "en" ? ["zh_CN"] : ["en_US"],
      publishedTime: article.firstPublishedAt.toISOString(),
      authors: ["Lawson"],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: article.title,
      description: article.excerpt,
      images: [image],
    },
  };
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

export default function ArticlePage({ params }: ArticlePageProps) {
  return (
    <Suspense fallback={<main className="article-reading" aria-busy="true" />}>
      <ArticlePageContent params={params} />
    </Suspense>
  );
}

async function ArticlePageContent({ params }: ArticlePageProps) {
  await connection();
  const { locale, slug } = await params;
  const [t, article] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    readArticle(slug),
  ]);
  if (!article) notFound();

  const headings = getArticleHeadings(article.body);
  const h2Count = headings.filter(({ depth }) => depth === 2).length;
  const showContents = h2Count >= 2;
  const bodyLanguage = article.bodyLanguage === "en" ? "en" : "zh";

  return (
    <main className="article-reading">
      <article lang={bodyLanguage}>
        <header className="article-reading__hero">
          <div className="article-reading__opening">
            <Link className="article-reading__back" href="/articles">
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
                {article.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
              </div>
            )}
            {article.coverImageKey && (
              <figure className="article-reading__cover">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={getArticleImageUrl(article.coverImageKey)} alt="" />
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
              <Link href="/articles">
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

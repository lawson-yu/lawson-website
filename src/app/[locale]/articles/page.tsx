import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Link } from "@/i18n/navigation";
import { getArticleImageUrl, getPublishedArticles, getPublishedTags } from "@/server/articles";
import { LoadMoreArticles } from "./_components/load-more-articles";
import "./articles.css";

const ARTICLE_BATCH_SIZE = 6;

type ArticlesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string; limit?: string }>;
};

function articleLimit(value?: string) {
  const limit = Number(value);
  return Number.isSafeInteger(limit) && limit >= ARTICLE_BATCH_SIZE ? limit : ARTICLE_BATCH_SIZE;
}

export async function generateMetadata({ params }: ArticlesPageProps): Promise<Metadata> {
  await connection();
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Articles" });

  return {
    title: `${t("title")} | LAWSON`,
    description: t("description"),
    alternates: {
      canonical: `/${locale}/articles`,
      languages: {
        zh: "/zh/articles",
        en: "/en/articles",
        "x-default": "/zh/articles",
      },
    },
  };
}

export default function ArticlesPage(props: ArticlesPageProps) {
  return (
    <Suspense fallback={<main className="articles-index" aria-busy="true" />}>
      <ArticlesPageContent {...props} />
    </Suspense>
  );
}

async function ArticlesPageContent({ params, searchParams }: ArticlesPageProps) {
  await connection();
  const [{ locale }, { tag: requestedTag, limit: requestedLimit }] = await Promise.all([params, searchParams]);
  const [t, tags] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getPublishedTags(),
  ]);
  const selectedTag = tags.find((tag) => tag.id === requestedTag);
  const invalidTag = Boolean(requestedTag) && !selectedTag;
  const limit = invalidTag ? ARTICLE_BATCH_SIZE : articleLimit(requestedLimit);
  const result = await getPublishedArticles(selectedTag?.id, limit);
  const hasMore = result.length > limit;
  const articles = result.slice(0, limit);

  return (
    <main className="articles-index">
      <header className="articles-index__hero">
        <div className="articles-index__hero-content">
          <h1>{t("title")}</h1>
          <p>{t("description")}</p>
        </div>
      </header>

      <section className="articles-index__section" aria-labelledby="articles-index-title">
        <div className="articles-index__section-heading">
          <h2 id="articles-index-title">{t("latest")}</h2>
          <span>{articles.length} {t("count")}</span>
        </div>

        <nav className="articles-index__filters" aria-label={t("filterByTag")}>
          <Link
            className="articles-index__filter"
            href="/articles"
            aria-current={!selectedTag ? "page" : undefined}
          >
            {t("allTags")}
          </Link>
          {tags.map((tag) => (
            <Link
              className="articles-index__filter"
              href={`/articles?tag=${encodeURIComponent(tag.id)}`}
              aria-current={selectedTag?.id === tag.id ? "page" : undefined}
              key={tag.id}
            >
              {tag.name}
            </Link>
          ))}
        </nav>
        {invalidTag && (
          <p className="articles-index__notice" role="status">
            {t("invalidTag")} <Link href="/articles">{t("clearFilter")}</Link>
          </p>
        )}
        {articles.length ? (
          <ul className="articles-index__grid">
            {articles.map((article) => (
              <li key={article.id}>
                <article className="article-card">
                  <Link className="article-card__image" href={`/articles/${article.slug}`} aria-label={article.title}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.coverImageKey
                        ? getArticleImageUrl(article.coverImageKey)
                        : "/images/prototype/article-list/fragment.webp"}
                      alt=""
                      loading="lazy"
                    />
                  </Link>
                  <div className="article-card__body">
                    <div className="article-card__meta">
                      <time dateTime={(article.firstPublishedAt ?? article.createdAt).toISOString()}>
                        {new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        }).format(article.firstPublishedAt ?? article.createdAt)}
                      </time>
                      {article.tags.length > 0 && (
                        <span className="article-card__tags">
                          {article.tags.map((tag) => (
                            <Link href={`/articles?tag=${encodeURIComponent(tag.id)}`} key={tag.id}>
                              {tag.name}
                            </Link>
                          ))}
                        </span>
                      )}
                    </div>
                    <Link className="article-card__title" href={`/articles/${article.slug}`}>
                      {article.title}
                    </Link>
                    <p className="article-card__excerpt">{article.excerpt}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <p className="articles-index__empty" role="status">{t("empty")}</p>
        )}
        {hasMore && (
          <LoadMoreArticles
            href={`/articles?${selectedTag ? `tag=${encodeURIComponent(selectedTag.id)}&` : ""}limit=${limit + ARTICLE_BATCH_SIZE}`}
            label={t("loadMore")}
          />
        )}
      </section>
    </main>
  );
}

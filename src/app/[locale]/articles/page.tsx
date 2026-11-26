import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import {
  ARTICLE_BATCH_SIZE,
  MAX_ARTICLE_LIMIT,
  buildArticlesHref,
  clampArticleLimit,
  normalizeSearchQuery,
} from "@/lib/article-search";
import { DEFAULT_CARD_COVER_PATH } from "@/lib/media-url";
import { buildListMetadata } from "@/lib/seo";
import { getArticleImageUrl, getPublishedArticles, getPublishedTags } from "@/server/articles";
import { LoadMoreArticles } from "./_components/load-more-articles";
import "./articles.css";

type ArticlesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string; q?: string; limit?: string }>;
};

export async function generateMetadata({ params, searchParams }: ArticlesPageProps): Promise<Metadata> {
  await connection();
  const [{ locale }, resolvedSearch] = await Promise.all([params, searchParams]);
  const t = await getTranslations({ locale, namespace: "Articles" });
  const hasFilterOrLoadState = Boolean(
    resolvedSearch.tag?.trim() || resolvedSearch.q?.trim() || resolvedSearch.limit?.trim(),
  );

  return buildListMetadata({
    locale,
    section: "articles",
    title: `${t("title")} | LAWSON`,
    description: t("description"),
    hasFilterOrLoadState,
  });
}

export default async function ArticlesPage({ params, searchParams }: ArticlesPageProps) {
  await connection();
  const [
    { locale },
    { q: requestedQuery, tag: requestedTag, limit: requestedLimit },
  ] = await Promise.all([params, searchParams]);
  const [t, tags] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getPublishedTags(),
  ]);
  const query = normalizeSearchQuery(requestedQuery);
  const selectedTag = tags.find((tag) => tag.id === requestedTag);
  const invalidTag = Boolean(requestedTag) && !selectedTag;
  const limit = invalidTag ? ARTICLE_BATCH_SIZE : clampArticleLimit(requestedLimit);
  const result = await getPublishedArticles(selectedTag?.id, limit, query);
  const hasMore = result.length > limit && limit < MAX_ARTICLE_LIMIT;
  const articles = result.slice(0, limit);
  const hasActiveFilter = Boolean(query || selectedTag);

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

        <form
          className="articles-index__search"
          action={`/${locale}/articles`}
          method="get"
          role="search"
        >
          <label className="sr-only" htmlFor="articles-search-input">
            {t("searchLabel")}
          </label>
          <input
            id="articles-search-input"
            key={query}
            className="articles-index__search-input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
          />
          {selectedTag && <input type="hidden" name="tag" value={selectedTag.id} />}
          <button className="articles-index__search-submit" type="submit">
            {t("searchSubmit")}
          </button>
          {hasActiveFilter && (
            <Link className="articles-index__search-clear" href="/articles">
              {t("clearFilter")}
            </Link>
          )}
        </form>

        <nav className="articles-index__filters" aria-label={t("filterByTag")}>
          <Link
            className="articles-index__filter"
            href={buildArticlesHref({ q: query })}
            aria-current={!selectedTag ? "page" : undefined}
          >
            {t("allTags")}
          </Link>
          {tags.map((tag) => (
            <Link
              className="articles-index__filter"
              href={buildArticlesHref({ q: query, tag: tag.id })}
              aria-current={selectedTag?.id === tag.id ? "page" : undefined}
              key={tag.id}
            >
              {tag.name}
            </Link>
          ))}
        </nav>
        {invalidTag && (
          <p className="articles-index__notice" role="status">
            {query ? t("invalidTagWithQuery") : t("invalidTag")}{" "}
            <Link href="/articles">{t("clearFilter")}</Link>
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
                      src={getArticleImageUrl(article.coverImageKey) || DEFAULT_CARD_COVER_PATH}
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
          <p className="articles-index__empty" role="status">
            {hasActiveFilter ? (
              <>
                {t("emptySearch")} <Link href="/articles">{t("clearFilter")}</Link>
              </>
            ) : (
              t("empty")
            )}
          </p>
        )}
        {hasMore && (
          <LoadMoreArticles
            href={buildArticlesHref({
              q: query,
              tag: selectedTag?.id,
              limit: limit + ARTICLE_BATCH_SIZE,
            })}
            label={t("loadMore")}
          />
        )}
      </section>
    </main>
  );
}

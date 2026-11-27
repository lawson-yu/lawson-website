import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowDown, Search } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Suspense } from "react";
import {
  ARTICLE_BATCH_SIZE,
  MAX_ARTICLE_LIMIT,
  buildArticlesHref,
  clampArticleLimit,
  normalizeSearchQuery,
} from "@/lib/article-search";
import { buildListMetadata } from "@/lib/seo";
import { getPublishedArticles, getPublishedTags } from "@/server/articles";
import { ArticleListCard } from "./_components/article-list-card";
import { LoadMoreArticles } from "./_components/load-more-articles";
import { ArticleReturnFocus } from "./_components/article-return-focus";
import "./articles.css";
import "./article-list-presentation.css";

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

export default function ArticlesPage(props: ArticlesPageProps) {
  return (
    <Suspense fallback={<main className="articles-index" aria-busy="true" />}>
      <ArticlesPageContent {...props} />
    </Suspense>
  );
}

async function ArticlesPageContent({ params, searchParams }: ArticlesPageProps) {
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
  type ArticleWithSlug = (typeof result)[number] & { slug: string };
  const articles = result.slice(0, limit).filter(
    (article): article is ArticleWithSlug => article.slug !== null,
  );
  const articleSlugs = articles.map(({ slug }) => slug);
  const hasActiveFilter = Boolean(query || selectedTag);
  const featuredArticle = !hasActiveFilter ? articles[0] : undefined;
  const listArticles = featuredArticle ? articles.slice(1) : articles;
  const returnTo = buildArticlesHref({ q: query, tag: selectedTag?.id, limit });

  return (
    <main className="articles-index">
      <header className="articles-index__hero">
        <div className="articles-index__hero-content">
          <span className="articles-index__wordmark" aria-hidden="true">ARTICLES</span>
          <div>
            <h1>{t("title")}</h1>
            <p>{t("description")}</p>
          </div>
          <a className="articles-index__browse" href="#articles-index-title">
            {t("allTags")} <ArrowDown size={17} aria-hidden="true" />
          </a>
        </div>
      </header>

      {featuredArticle && (
        <section className="articles-index__featured" aria-labelledby="articles-latest-title">
          <h2 className="articles-index__featured-heading" id="articles-latest-title">
            {t("latest")}
          </h2>
          <ArticleListCard article={featuredArticle} locale={locale} returnTo={returnTo} featured />
        </section>
      )}

      <section className="articles-index__section" aria-labelledby="articles-index-title">
        <ArticleReturnFocus articleSlugs={articleSlugs} />
        <div className="articles-index__section-heading">
          <h2 id="articles-index-title">
            {t("allTags")} <span>{articles.length} {t("count")}</span>
          </h2>
          <form
            className="articles-index__search"
            action={`/${locale}/articles`}
            method="get"
            role="search"
          >
            <label className="sr-only" htmlFor="articles-search-input">
              {t("searchLabel")}
            </label>
            <button
              className="articles-index__search-submit"
              type="submit"
              aria-label={t("searchSubmit")}
            >
              <Search size={18} aria-hidden="true" />
            </button>
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
            {hasActiveFilter && (
              <Link className="articles-index__search-clear" href="/articles">
                {t("clearFilter")}
              </Link>
            )}
          </form>
        </div>

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
        {listArticles.length > 0 ? (
          <ul className="articles-index__grid">
            {listArticles.map((article) => (
              <li key={article.id}>
                <ArticleListCard article={article} locale={locale} returnTo={returnTo} />
              </li>
            ))}
          </ul>
        ) : !featuredArticle ? (
          <p className="articles-index__empty" role="status">
            {hasActiveFilter ? (
              <>
                {t("emptySearch")} <Link href="/articles">{t("clearFilter")}</Link>
              </>
            ) : (
              t("empty")
            )}
          </p>
        ) : null}
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

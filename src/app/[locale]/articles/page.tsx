import { connection } from "next/server";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getArticleImageUrl, getPublishedArticles } from "@/server/articles";
import "./articles.css";

type ArticlesPageProps = {
  params: Promise<{ locale: string }>;
};

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

export default async function ArticlesPage({ params }: ArticlesPageProps) {
  await connection();
  const { locale } = await params;
  const [t, articles] = await Promise.all([
    getTranslations({ locale, namespace: "Articles" }),
    getPublishedArticles(),
  ]);

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

        {articles.length ? (
          <ul className="articles-index__grid">
            {articles.map((article) => (
              <li key={article.id}>
                <Link className="article-card" href={`/articles/${article.slug}`}>
                  <span className="article-card__image">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={article.coverImageKey
                        ? getArticleImageUrl(article.coverImageKey)
                        : "/images/prototype/article-list/fragment.webp"}
                      alt=""
                      loading="lazy"
                    />
                  </span>
                  <span className="article-card__body">
                    <span className="article-card__meta">
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
                          {article.tags.map((tag) => <span key={tag.id}>{tag.name}</span>)}
                        </span>
                      )}
                    </span>
                    <span className="article-card__title">{article.title}</span>
                    <span className="article-card__excerpt">{article.excerpt}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="articles-index__empty" role="status">{t("empty")}</p>
        )}
      </section>
    </main>
  );
}

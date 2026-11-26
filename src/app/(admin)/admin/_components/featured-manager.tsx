import { getTranslations } from "next-intl/server";
import "./featured-manager.css";

type FeaturedItem = {
  id: string;
  title: string;
  status: "DRAFT" | "PUBLISHED" | "WITHDRAWN";
  featuredRank: number | null;
};

type FeaturedAction = (formData: FormData) => Promise<void>;

export async function FeaturedManager({
  kind,
  limit,
  items,
  action,
}: {
  kind: "article" | "project";
  limit: number;
  items: FeaturedItem[];
  action: FeaturedAction;
}) {
  const t = await getTranslations({ locale: "zh", namespace: "FeaturedManager" });
  const featured = items
    .filter((item) => item.status !== "DRAFT" && item.featuredRank !== null)
    .sort((left, right) => left.featuredRank! - right.featuredRank! || left.id.localeCompare(right.id));
  const published = featured.filter((item) => item.status === "PUBLISHED");
  const available = items.filter((item) => item.status === "PUBLISHED" && item.featuredRank === null);
  const activePositions = new Map(published.map((item, index) => [item.id, index]));
  const title = t(kind === "article" ? "articlesTitle" : "projectsTitle");

  return (
    <section className="featured-manager" aria-labelledby="featured-manager-title">
      <div className="featured-manager__heading">
        <div>
          <h2 id="featured-manager-title">
            {title} <span className="featured-manager__count">{t("count", { count: featured.length, limit })}</span>
          </h2>
          <p>{t("description")}</p>
        </div>
      </div>

      {featured.length > 0 ? (
        <ol className="featured-manager__list">
          {featured.map((item, index) => {
            const activePosition = activePositions.get(item.id) ?? -1;
            return (
              <li className="featured-manager__row" key={item.id}>
                <div className="featured-manager__item">
                  <span className="featured-manager__rank" aria-hidden="true">{index + 1}</span>
                  <span className="featured-manager__title">{item.title}</span>
                  <span className="featured-manager__status" data-withdrawn={item.status === "WITHDRAWN"}>
                    {item.status === "WITHDRAWN" ? t("withdrawn") : t("published")}
                  </span>
                </div>
                <div className="featured-manager__actions">
                  {item.status === "PUBLISHED" && (
                    <>
                      <form action={action}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          name="intent"
                          value="up"
                          aria-label={t("moveUpFor", { title: item.title })}
                          disabled={activePosition === 0}
                        >
                          {t("moveUp")}
                        </button>
                      </form>
                      <form action={action}>
                        <input type="hidden" name="id" value={item.id} />
                        <button
                          type="submit"
                          name="intent"
                          value="down"
                          aria-label={t("moveDownFor", { title: item.title })}
                          disabled={activePosition === published.length - 1}
                        >
                          {t("moveDown")}
                        </button>
                      </form>
                    </>
                  )}
                  <form action={action}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" name="intent" value="remove">
                      {t("remove")}
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="featured-manager__empty" role="status">{t("empty")}</p>
      )}

      {available.length > 0 ? (
        <form action={action} className="featured-manager__add-form">
          <label htmlFor={`featured-${kind}`}>
            {t(kind === "article" ? "chooseArticle" : "chooseProject")}
          </label>
          <div>
            <select id={`featured-${kind}`} name="id" defaultValue="" required>
              <option value="" disabled>
                {t(kind === "article" ? "emptyArticle" : "emptyProject")}
              </option>
              {available.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button type="submit" name="intent" value="add" disabled={featured.length >= limit}>
              {featured.length >= limit ? t("limitReached") : t("add")}
            </button>
          </div>
        </form>
      ) : (
        <p className="featured-manager__empty-choice">
          {t(kind === "article" ? "noAvailableArticles" : "noAvailableProjects")}
        </p>
      )}
    </section>
  );
}

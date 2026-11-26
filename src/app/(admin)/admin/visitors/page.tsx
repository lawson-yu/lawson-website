import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/public-site/public-authentication";
import { requireSiteOwner } from "@/server/auth";
import { listVisitorRecords, VISITOR_RECORDS_CACHE_TAG } from "@/server/visitors";
import { VISITOR_RECORD_RETENTION_MONTHS } from "@/lib/visitor-retention";
import { DeleteVisitorForm, PruneVisitorRecordsForm } from "./visitor-forms";

async function getCachedVisitorRecords() {
  "use cache";
  cacheLife("seconds");
  cacheTag(VISITOR_RECORDS_CACHE_TAG);
  return listVisitorRecords();
}

const formatTime = (date: Date) =>
  new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date) + " UTC";

export default function AdminVisitorsPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminVisitorsContent />
    </Suspense>
  );
}

async function AdminVisitorsContent() {
  const session = await requireSiteOwner();
  const t = await getTranslations({ locale: "zh", namespace: "Admin" });
  const visitors = await getCachedVisitorRecords();

  return (
    <main className="admin-page admin-visitors-page">
      <header className="admin-page__header">
        <Link href="/admin">{t("brand")}</Link>
        <div>
          <span>{t("signedIn", { email: session.user.email })}</span>
          <SignOutButton label={t("signOut")} />
        </div>
      </header>
      <section className="admin-page__content">
        <div className="admin-visitors__heading">
          <div>
            <h1>{t("visitorRecords")}</h1>
            <p>{t("visitorRecordsDescription", { months: VISITOR_RECORD_RETENTION_MONTHS })}</p>
          </div>
          <p className="admin-visitors__count">{t("visitorCount", { count: visitors.length })}</p>
        </div>

        <PruneVisitorRecordsForm />
        {visitors.length === 0 ? (
          <p className="admin-visitors__empty">{t("noVisitorRecords")}</p>
        ) : (
          <ul className="admin-visitors__list">
            {visitors.map((visitor) => (
              <li key={visitor.id}>
                <article className="admin-visitor">
                  <header className="admin-visitor__header">
                    <div>
                      <h2>{visitor.name || t("unnamedVisitor")}</h2>
                      <p className="admin-visitor__email">{visitor.email}</p>
                    </div>
                    <DeleteVisitorForm visitorId={visitor.id} email={visitor.email} />
                  </header>

                  <dl className="admin-visitor__logins">
                    <div>
                      <dt>{t("firstLogin")}</dt>
                      <dd>
                        <time dateTime={visitor.firstLoginAt.toISOString()}>
                          {formatTime(visitor.firstLoginAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>{t("recentLogin")}</dt>
                      <dd>
                        <time dateTime={visitor.lastLoginAt.toISOString()}>
                          {formatTime(visitor.lastLoginAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>

                  <div className="admin-visitor__visits">
                    <section aria-label={t("articleVisits")}>
                      <h3>{t("articleVisits")} <span>{visitor.articleVisits.length}</span></h3>
                      {visitor.articleVisits.length ? (
                        <ul>
                          {visitor.articleVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.title || visit.slug || t("unnamedArticle")}</strong>
                              <span>
                                {t("firstVisit")} <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                <br />
                                {t("recentVisit")} <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                · {t("visitCount", { count: visit.visitCount })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>{t("noArticleVisits")}</p>
                      )}
                    </section>
                    <section aria-label={t("projectVisits")}>
                      <h3>{t("projectVisits")} <span>{visitor.projectVisits.length}</span></h3>
                      {visitor.projectVisits.length ? (
                        <ul>
                          {visitor.projectVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.name}</strong>
                              <span>
                                {t("firstVisit")} <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                <br />
                                {t("recentVisit")} <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                · {t("visitCount", { count: visit.visitCount })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>{t("noProjectVisits")}</p>
                      )}
                    </section>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

import { cacheLife, cacheTag } from "next/cache";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
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
    <AdminShell activeSection="visitors" userEmail={session.user.email} pageClassName="admin-visitors-page">
      <section aria-labelledby="admin-visitors-heading">
        <div className="admin-head">
          <h1 id="admin-visitors-heading">{t("visitorRecords")}</h1>
          <span className="admin-visitors__count">{t("visitorCount", { count: visitors.length })}</span>
        </div>
        <p className="admin-note">{t("visitorRecordsDescription", { months: VISITOR_RECORD_RETENTION_MONTHS })}</p>

        <PruneVisitorRecordsForm />

        <div className="admin-table" role="region" tabIndex={0} aria-label={t("visitorAccount")}>
          <table>
            <thead>
              <tr>
                <th>{t("visitorAccount")}</th>
                <th>{t("firstLogin")}</th>
                <th>{t("recentLogin")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visitors.map((visitor) => (
                <tr key={visitor.id}>
                  <th scope="row">
                    {visitor.name || t("unnamedVisitor")}
                    <small>{visitor.email}</small>
                  </th>
                  <td>
                    <time dateTime={visitor.firstLoginAt.toISOString()}>
                      {formatTime(visitor.firstLoginAt)}
                    </time>
                  </td>
                  <td>
                    <time dateTime={visitor.lastLoginAt.toISOString()}>
                      {formatTime(visitor.lastLoginAt)}
                    </time>
                  </td>
                  <td>
                    <a className="admin-table-action" href={`#visitor-${visitor.id}`}>
                      {t("viewRecords")} <ArrowRight size={15} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {visitors.length === 0 && (
            <p className="admin-empty">{t("noVisitorRecords")}</p>
          )}
        </div>

        {visitors.length > 0 && (
          <ul className="admin-visitors__list">
            {visitors.map((visitor) => (
              <li key={visitor.id}>
                <article className="admin-visitor admin-visit-detail" id={`visitor-${visitor.id}`}>
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
                        <ul className="admin-list">
                          {visitor.articleVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.title || visit.slug || t("unnamedArticle")}</strong>
                              <span>
                                {t("firstVisit")} <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                {" · "}
                                {t("recentVisit")} <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                {" · "}
                                {t("visitCount", { count: visit.visitCount })}
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
                        <ul className="admin-list">
                          {visitor.projectVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.name}</strong>
                              <span>
                                {t("firstVisit")} <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                {" · "}
                                {t("recentVisit")} <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                {" · "}
                                {t("visitCount", { count: visit.visitCount })}
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
    </AdminShell>
  );
}

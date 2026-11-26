import { Suspense } from "react";
import Link from "next/link";
import { SignOutButton } from "@/components/public-site/public-authentication";
import { requireSiteOwner } from "@/server/auth";
import { listVisitorRecords } from "@/server/visitors";
import { DeleteVisitorForm, PruneVisitorRecordsForm } from "./visitor-forms";

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
  const visitors = await listVisitorRecords();

  return (
    <main className="admin-page admin-visitors-page">
      <header className="admin-page__header">
        <Link href="/admin">LAWSON · 管理后台</Link>
        <div>
          <span>已登录 · {session.user.email}</span>
          <SignOutButton label="退出" />
        </div>
      </header>
      <section className="admin-page__content">
        <div className="admin-visitors__heading">
          <div>
            <h1>访客记录</h1>
            <p>查看登录与内容访问记录。访问记录保留 24 个月；删除账号会一并删除登录和访问记录。</p>
          </div>
          <p className="admin-visitors__count">{visitors.length} 位访客</p>
        </div>

        <PruneVisitorRecordsForm />
        {visitors.length === 0 ? (
          <p className="admin-visitors__empty">暂无访客记录。</p>
        ) : (
          <ul className="admin-visitors__list">
            {visitors.map((visitor) => (
              <li key={visitor.id}>
                <article className="admin-visitor">
                  <header className="admin-visitor__header">
                    <div>
                      <h2>{visitor.name || "未命名访客"}</h2>
                      <p className="admin-visitor__email">{visitor.email}</p>
                    </div>
                    <DeleteVisitorForm visitorId={visitor.id} email={visitor.email} />
                  </header>

                  <dl className="admin-visitor__logins">
                    <div>
                      <dt>首次登录</dt>
                      <dd>
                        <time dateTime={visitor.firstLoginAt.toISOString()}>
                          {formatTime(visitor.firstLoginAt)}
                        </time>
                      </dd>
                    </div>
                    <div>
                      <dt>最近登录</dt>
                      <dd>
                        <time dateTime={visitor.lastLoginAt.toISOString()}>
                          {formatTime(visitor.lastLoginAt)}
                        </time>
                      </dd>
                    </div>
                  </dl>

                  <div className="admin-visitor__visits">
                    <section aria-label="文章访问">
                      <h3>文章访问 <span>{visitor.articleVisits.length}</span></h3>
                      {visitor.articleVisits.length ? (
                        <ul>
                          {visitor.articleVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.title || visit.slug || "未命名文章"}</strong>
                              <span>
                                首次 <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                <br />
                                最近 <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                · {visit.visitCount} 次
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>暂无文章访问记录。</p>
                      )}
                    </section>
                    <section aria-label="项目访问">
                      <h3>项目访问 <span>{visitor.projectVisits.length}</span></h3>
                      {visitor.projectVisits.length ? (
                        <ul>
                          {visitor.projectVisits.map((visit) => (
                            <li key={visit.id}>
                              <strong>{visit.name}</strong>
                              <span>
                                首次 <time dateTime={visit.firstVisitedAt.toISOString()}>{formatTime(visit.firstVisitedAt)}</time>
                                <br />
                                最近 <time dateTime={visit.lastVisitedAt.toISOString()}>{formatTime(visit.lastVisitedAt)}</time>
                                · {visit.visitCount} 次
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>暂无项目访问记录。</p>
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

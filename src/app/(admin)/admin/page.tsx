import { Suspense } from "react";
import Link from "next/link";
import { requireSiteOwner } from "@/server/auth";
import { SignOutButton } from "@/components/public-site/public-authentication";

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="admin-page" aria-busy="true" />}>
      <AdminContent />
    </Suspense>
  );
}

async function AdminContent() {
  const session = await requireSiteOwner();

  return (
    <main className="admin-page">
      <header className="admin-page__header">
        <Link href="/zh">LAWSON · 管理后台</Link>
        <div>
          <span>已登录 · {session.user.email}</span>
          <SignOutButton label="退出" />
        </div>
      </header>
      <section className="admin-page__content">
        <h1>管理后台</h1>
        <p>站长专用空间。文章、作品与首页管理将在对应模块中提供。</p>
      </section>
    </main>
  );
}

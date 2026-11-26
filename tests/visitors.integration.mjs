import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import "./register-paths.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.env.TZ = "UTC";

test("访客记录分表写入、24 个月清理与级联删除", { timeout: 120_000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lawson-visitors-test-"));
  const composeFile = join(directory, "compose.yaml");
  const envFile = join(directory, ".env.test");
  const project = `lawson-test-50-${randomUUID().slice(0, 8)}`;
  const env = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    COMPOSE_FILE: composeFile,
    ENV_FILE: envFile,
  };
  const options = { cwd: root, env, encoding: "utf8", timeout: 45_000 };
  const compose = ["compose", "-p", project, "-f", composeFile, "--env-file", envFile];
  const originalUrl = process.env.DATABASE_URL;
  const originalAdminEmails = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS = "owner@example.test,co-owner@example.test";
  let prisma;

  t.after(async () => {
    try {
      await prisma?.$disconnect();
    } finally {
      try {
        execFileSync("docker", [...compose, "down", "-v"], options);
      } finally {
        rmSync(directory, { recursive: true, force: true });
        if (originalUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalUrl;
        if (originalAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
        else process.env.ADMIN_EMAILS = originalAdminEmails;
      }
    }
  });

  writeFileSync(envFile, "");
  writeFileSync(
    composeFile,
    `services:
  postgres:
    image: postgres:18-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: test
    ports:
      - "127.0.0.1::5432"
    healthcheck:
      test: [CMD-SHELL, "pg_isready -U test -d test"]
      interval: 1s
      timeout: 1s
      retries: 20
`,
  );

  execFileSync("docker", [...compose, "up", "-d", "--wait", "postgres"], options);
  const address = execFileSync("docker", [...compose, "port", "postgres", "5432"], options).trim();
  env.DATABASE_URL = `postgresql://test:test@${address}/test`;
  process.env.DATABASE_URL = env.DATABASE_URL;

  execFileSync("pnpm", ["db:migrate:deploy"], options);

  const { getPrisma } = await import("../src/server/db.ts");
  const {
    recordVisitorLogin,
    recordArticleVisit,
    recordProjectVisit,
    listVisitorRecords,
    pruneExpiredVisitorRecords,
    deleteVisitorAccount,
  } = await import("../src/server/visitors.ts");

  prisma = getPrisma();

  // 准备站长、测试访客、公开与草稿内容
  const owner = await prisma.user.create({
    data: {
      id: "owner-1",
      name: "Lawson",
      email: "owner@example.test",
      emailVerified: true,
    },
  });
  const coOwner = await prisma.user.create({
    data: {
      id: "co-owner-1",
      name: "Co-owner",
      email: "co-owner@example.test",
      emailVerified: true,
    },
  });
  const visitor = await prisma.user.create({
    data: {
      id: "visitor-1",
      name: "Alice Reader",
      email: "alice@example.test",
      emailVerified: true,
      sessions: {
        create: {
          id: "sess-visitor-1",
          token: `tok-${randomUUID()}`,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      },
      accounts: {
        create: {
          id: "acc-visitor-1",
          accountId: "google-alice-1",
          providerId: "google",
        },
      },
    },
  });

  const publishedArticle = await prisma.article.create({
    data: {
      id: "art-pub",
      slug: "published-guide",
      title: "公开指南",
      excerpt: "摘要",
      bodyLanguage: "zh",
      body: "## 正文",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-01-01T00:00:00Z"),
    },
  });
  const draftArticle = await prisma.article.create({
    data: {
      id: "art-draft",
      slug: "draft-guide",
      title: "草稿指南",
      excerpt: "草稿摘要",
      bodyLanguage: "zh",
      body: "## 草稿",
      status: "DRAFT",
    },
  });
  const publishedProject = await prisma.project.create({
    data: {
      id: "proj-pub",
      slug: "internal-tool",
      name: "站内工具",
      description: "说明",
      type: "开发工具",
      body: "## 项目介绍",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2026-01-02T00:00:00Z"),
    },
  });
  const withdrawnProject = await prisma.project.create({
    data: {
      id: "proj-withdrawn",
      slug: "withdrawn-tool",
      name: "撤下工具",
      description: "说明",
      type: "开发工具",
      body: "## 撤下",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "WITHDRAWN",
      firstPublishedAt: new Date("2026-01-03T00:00:00Z"),
    },
  });

  // 1. 首次与最近登录时间
  const login1 = new Date("2026-10-01T08:00:00Z");
  const login2 = new Date("2026-11-20T09:30:00Z");
  await recordVisitorLogin(visitor.id, login1);
  await recordVisitorLogin(visitor.id, login2);
  const refreshedVisitor = await prisma.user.findUnique({ where: { id: visitor.id } });
  assert.equal(refreshedVisitor.firstLoginAt?.toISOString(), login1.toISOString());
  assert.equal(refreshedVisitor.lastLoginAt?.toISOString(), login2.toISOString());

  // 2. 分表记录文章和项目访问，忽略非公开内容
  const visit1 = new Date("2026-11-01T10:00:00Z");
  const visit2 = new Date("2026-11-15T12:00:00Z");
  assert.equal(await recordArticleVisit(visitor.id, publishedArticle.id, visit1), true);
  assert.equal(await recordArticleVisit(visitor.id, publishedArticle.id, visit2), true);
  assert.equal(await recordArticleVisit(visitor.id, draftArticle.id, visit1), false);

  assert.equal(await recordProjectVisit(visitor.id, publishedProject.id, visit1), true);
  assert.equal(await recordProjectVisit(visitor.id, publishedProject.id, visit2), true);
  assert.equal(await recordProjectVisit(visitor.id, withdrawnProject.id, visit1), false);

  const records = await listVisitorRecords();
  assert.equal(records.some((item) => item.id === owner.id || item.id === coOwner.id), false);
  const aliceRecord = records.find((item) => item.id === visitor.id);
  assert.ok(aliceRecord);
  assert.equal(aliceRecord.email, "alice@example.test");
  assert.equal(aliceRecord.name, "Alice Reader");
  assert.equal(aliceRecord.firstLoginAt.toISOString(), login1.toISOString());
  assert.equal(aliceRecord.lastLoginAt.toISOString(), login2.toISOString());
  assert.equal(aliceRecord.articleVisits.length, 1);
  assert.equal(aliceRecord.articleVisits[0].visitCount, 2);
  assert.equal(aliceRecord.articleVisits[0].firstVisitedAt.toISOString(), visit1.toISOString());
  assert.equal(aliceRecord.articleVisits[0].lastVisitedAt.toISOString(), visit2.toISOString());
  assert.equal(aliceRecord.projectVisits.length, 1);
  assert.equal(aliceRecord.projectVisits[0].visitCount, 2);
  assert.equal(aliceRecord.projectVisits[0].firstVisitedAt.toISOString(), visit1.toISOString());
  assert.equal(aliceRecord.projectVisits[0].lastVisitedAt.toISOString(), visit2.toISOString());

  // 3. 24 个月清理操作：保留 24 个月内，清理 24 个月前
  const oldArticle = await prisma.article.create({
    data: {
      id: "art-old",
      slug: "old-article",
      title: "旧文章",
      excerpt: "摘要",
      bodyLanguage: "zh",
      body: "## 旧正文",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2023-01-01T00:00:00Z"),
    },
  });
  const oldProject = await prisma.project.create({
    data: {
      id: "proj-old",
      slug: "old-project",
      name: "旧项目",
      description: "说明",
      type: "实验项目",
      body: "## 旧项目",
      contentLanguage: "zh",
      cardTarget: "INTERNAL",
      status: "PUBLISHED",
      firstPublishedAt: new Date("2023-01-01T00:00:00Z"),
    },
  });
  await prisma.articleVisit.create({
    data: {
      visitorId: visitor.id,
      articleId: oldArticle.id,
      firstVisitedAt: new Date("2024-01-01T00:00:00Z"),
      lastVisitedAt: new Date("2024-01-02T00:00:00Z"),
      visitCount: 3,
    },
  });
  await prisma.projectVisit.create({
    data: {
      visitorId: visitor.id,
      projectId: oldProject.id,
      firstVisitedAt: new Date("2024-01-01T00:00:00Z"),
      lastVisitedAt: new Date("2024-01-02T00:00:00Z"),
      visitCount: 1,
    },
  });

  const pruneResult = await pruneExpiredVisitorRecords(new Date("2026-11-26T00:00:00Z"));
  assert.equal(pruneResult.deletedArticleVisits, 1);
  assert.equal(pruneResult.deletedProjectVisits, 1);
  assert.equal(await prisma.articleVisit.count({ where: { visitorId: visitor.id } }), 1);
  assert.equal(await prisma.projectVisit.count({ where: { visitorId: visitor.id } }), 1);

  // 4. 运维清理脚本同样只删 24 个月前记录
  const expiredDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 800);
  await prisma.articleVisit.create({
    data: {
      visitorId: visitor.id,
      articleId: oldArticle.id,
      firstVisitedAt: expiredDate,
      lastVisitedAt: expiredDate,
      visitCount: 1,
    },
  });
  await prisma.projectVisit.create({
    data: {
      visitorId: visitor.id,
      projectId: oldProject.id,
      firstVisitedAt: expiredDate,
      lastVisitedAt: expiredDate,
      visitCount: 1,
    },
  });
  execFileSync("bash", [join(root, "scripts", "cleanup-visitor-records.sh")], options);
  assert.equal(await prisma.articleVisit.count({ where: { visitorId: visitor.id } }), 1);
  assert.equal(await prisma.projectVisit.count({ where: { visitorId: visitor.id } }), 1);

  // 5. 站长不可删自己；删除测试访客时级联删除会话、账号与全部访问记录
  const selfDelete = await deleteVisitorAccount(owner.id, owner.id);
  assert.equal(selfDelete.ok, false);
  assert.ok(await prisma.user.findUnique({ where: { id: owner.id } }));

  const coOwnerDelete = await deleteVisitorAccount(coOwner.id, owner.id);
  assert.deepEqual(coOwnerDelete, { ok: false, reason: "owner" });
  assert.ok(await prisma.user.findUnique({ where: { id: coOwner.id } }));

  const deleteResult = await deleteVisitorAccount(visitor.id, owner.id);
  assert.equal(deleteResult.ok, true);
  assert.equal(await prisma.user.findUnique({ where: { id: visitor.id } }), null);
  assert.equal(await prisma.session.count({ where: { userId: visitor.id } }), 0);
  assert.equal(await prisma.account.count({ where: { userId: visitor.id } }), 0);
  assert.equal(await prisma.articleVisit.count({ where: { visitorId: visitor.id } }), 0);
  assert.equal(await prisma.projectVisit.count({ where: { visitorId: visitor.id } }), 0);
});

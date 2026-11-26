import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Client } from "pg";
import "./register-paths.mjs";

const { getPrisma } = await import("../src/server/db.ts");
const root = dirname(dirname(fileURLToPath(import.meta.url)));
// pg 按进程时区解析无时区时间，统一为 Prisma 使用的 UTC。
process.env.TZ = "UTC";

test("临时数据库可以迁移、重复 seed、备份并恢复全部作品", { timeout: 120_000 }, async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lawson-database-test-"));
  const composeFile = join(directory, "compose.yaml");
  const envFile = join(directory, ".env.test");
  const backupDirectory = join(directory, "backups", "postgres archive\n测试");
  const backupScript = join(directory, "scripts", "backup-postgres.sh");
  const project = `lawson-test-${randomUUID().slice(0, 8)}`;
  const env = {
    ...process.env,
    COMPOSE_PROJECT_NAME: project,
    COMPOSE_FILE: composeFile,
    ENV_FILE: envFile,
    BACKUP_DIR: backupDirectory,
    BACKUP_RETENTION: "2",
    COS_ALIAS: "",
  };
  const options = { cwd: root, env, encoding: "utf8", timeout: 30_000 };
  const compose = ["compose", "-p", project, "-f", composeFile, "--env-file", envFile];
  let prisma;
  let restored;
  const originalUrl = process.env.DATABASE_URL;
  t.after(async () => {
    try {
      await restored?.end();
      await prisma?.$disconnect();
    } finally {
      try {
        execFileSync("docker", [...compose, "down", "-v"], options);
      } finally {
        rmSync(directory, { recursive: true, force: true });
        if (originalUrl === undefined) delete process.env.DATABASE_URL;
        else process.env.DATABASE_URL = originalUrl;
      }
    }
  });

  // 独立目录中没有生产配置，备份脚本无法读取生产凭据。
  mkdirSync(dirname(backupScript), { recursive: true });
  copyFileSync(join(root, "scripts", "backup-postgres.sh"), backupScript);
  writeFileSync(envFile, "");
  writeFileSync(composeFile, `services:
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
`);
  execFileSync("docker", [...compose, "up", "-d", "--wait", "postgres"], options);
  const address = execFileSync("docker", [...compose, "port", "postgres", "5432"], options).trim();
  env.DATABASE_URL = `postgresql://test:test@${address}/test`;
  process.env.DATABASE_URL = env.DATABASE_URL;

  const initialMigration = readFileSync(
    join(root, "prisma", "migrations", "20261106214211_init", "migration.sql"),
    "utf8",
  );
  let legacyDatabase = new Client({ connectionString: env.DATABASE_URL });
  await legacyDatabase.connect();
  await legacyDatabase.query(initialMigration);
  await legacyDatabase.end();
  execFileSync(
    "pnpm",
    ["exec", "prisma", "migrate", "resolve", "--applied", "20261106214211_init"],
    options,
  );
  legacyDatabase = new Client({ connectionString: env.DATABASE_URL });
  await legacyDatabase.connect();
  await legacyDatabase.query(
    `INSERT INTO "Project" ("id", "slug", "name", "description", "url", "featured", "createdAt", "updatedAt")
     VALUES
       ('legacy-external', 'legacy-external', '旧外链作品', '保留既有外部作品。', 'https://legacy.example/work', true, '2025-03-04T05:06:07Z', '2025-03-04T05:06:07Z'),
       ('legacy-internal', 'legacy-internal', '未完成作品', '缺少公开入口的旧作品。', null, false, '2025-04-05T06:07:08Z', '2025-04-05T06:07:08Z')`,
  );
  await legacyDatabase.end();

  execFileSync("pnpm", ["db:migrate:deploy"], options);
  execFileSync("pnpm", ["db:seed"], options);
  execFileSync("pnpm", ["db:seed"], options);
  prisma = getPrisma();

  const legacyExternal = await prisma.project.findUnique({ where: { slug: "legacy-external" } });
  assert.equal(legacyExternal.status, "PUBLISHED");
  assert.equal(legacyExternal.cardTarget, "EXTERNAL");
  assert.equal(legacyExternal.featuredRank, 1);
  assert.equal(legacyExternal.firstPublishedAt.toISOString(), "2025-03-04T05:06:07.000Z");
  assert.equal(legacyExternal.url, "https://legacy.example/work");

  const legacyInternal = await prisma.project.findUnique({ where: { slug: "legacy-internal" } });
  assert.equal(legacyInternal.status, "DRAFT");
  assert.equal(legacyInternal.cardTarget, "INTERNAL");
  assert.equal(legacyInternal.firstPublishedAt, null);

  const seededExternal = await prisma.project.findUnique({ where: { slug: "personal-website" } });
  assert.equal(seededExternal.status, "PUBLISHED");
  assert.equal(seededExternal.cardTarget, "EXTERNAL");
  assert.equal(seededExternal.type, "个人网站");
  assert.equal(seededExternal.featuredRank, 1);

  const seededInternal = await prisma.project.findUnique({ where: { slug: "side-project" } });
  assert.equal(seededInternal.status, "DRAFT");
  assert.equal(seededInternal.cardTarget, "INTERNAL");
  assert.equal(seededInternal.firstPublishedAt, null);

  const authUserId = `auth-${randomUUID()}`;
  const authSessionToken = randomUUID();
  await prisma.user.create({
    data: {
      id: authUserId,
      name: "隔离测试账号",
      email: `${authUserId}@example.test`,
      emailVerified: true,
      sessions: {
        create: {
          id: `session-${randomUUID()}`,
          token: authSessionToken,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  assert.equal(
    (await prisma.session.findUnique({ where: { token: authSessionToken } }))?.userId,
    authUserId,
  );
  await prisma.user.delete({ where: { id: authUserId } });
  assert.equal(await prisma.session.count({ where: { token: authSessionToken } }), 0);

  const siteSetting = await prisma.siteSetting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      heroIntroduction: "  原文介绍\n保留换行  ",
      contactUrl: "mailto:hello@example.com",
      socialLinks: [
        { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
        { name: "个人主页", url: "https://example.com", icon: "link" },
      ],
    },
    update: {},
  });
  assert.equal(siteSetting.heroIntroduction, "  原文介绍\n保留换行  ");
  assert.deepEqual(siteSetting.socialLinks, [
    { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
    { name: "个人主页", url: "https://example.com", icon: "link" },
  ]);
  await prisma.siteSetting.update({
    where: { id: 1 },
    data: { socialLinks: [
      { name: "个人主页", url: "https://example.com", icon: "link" },
      { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
    ] },
  });
  assert.equal(await prisma.siteSetting.count(), 1);
  assert.deepEqual(
    (await prisma.siteSetting.findUnique({ where: { id: 1 } }))?.socialLinks,
    [
      { name: "个人主页", url: "https://example.com", icon: "link" },
      { name: "GitHub", url: "https://github.com/lawson", icon: "code" },
    ],
  );
  await assert.rejects(prisma.siteSetting.create({ data: { id: 2 } }));

  const projects = await prisma.project.findMany({ orderBy: { slug: "asc" } });
  assert.deepEqual(projects.map((project) => project.slug), [
    "legacy-external", "legacy-internal", "open-source-tool", "personal-website", "side-project",
  ]);
  await assert.rejects(prisma.$queryRaw`SELECT pg_sleep(10)`, /timeout|timed out/i);
  assert.equal((await prisma.project.count()), 5);

  mkdirSync(backupDirectory, { recursive: true });
  const oldDumps = ["20000101", "20010101", "20020101"].map((date) => `lawson_website-${date}T000000Z.dump`);
  for (const dump of oldDumps) writeFileSync(join(backupDirectory, dump), "旧备份测试文件");
  execFileSync("bash", [backupScript], options);
  const dumps = readdirSync(backupDirectory).sort();
  assert.equal(dumps.length, 2, "含空格和换行的目录中也只保留两份备份");
  assert.equal(dumps[0], oldDumps[2]);
  const archive = readFileSync(join(backupDirectory, dumps[1]));

  execFileSync("docker", [...compose, "exec", "-T", "postgres", "createdb", "-U", "test", "restored"], options);
  execFileSync("docker", [...compose, "exec", "-T", "postgres", "pg_restore", "--exit-on-error", "-U", "test", "-d", "restored"], { ...options, input: archive });
  restored = new Client({ connectionString: `postgresql://test:test@${address}/restored` });
  await restored.connect();
  const result = await restored.query('SELECT * FROM "Project" ORDER BY slug');
  assert.deepEqual(result.rows, projects, "恢复后所有作品字段必须与备份前一致");

  await restored.end();
  restored = undefined;
  await prisma.$disconnect();
  prisma = undefined;
  execFileSync("docker", [...compose, "stop", "postgres"], options);
  assert.throws(() => execFileSync("bash", [backupScript], options));
  assert.deepEqual(readdirSync(backupDirectory).sort(), dumps, "备份失败不能删除旧备份或留下临时文件");
  assert.deepEqual(readFileSync(join(backupDirectory, dumps[1])), archive);
});

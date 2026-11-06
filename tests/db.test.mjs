import assert from "node:assert/strict";
import { createServer } from "node:net";
import test from "node:test";
import { performance } from "node:perf_hooks";
import "./register-paths.mjs";

const { getPrisma } = await import("../src/server/db.ts");

test("数据库接受连接却不响应时，在健康检查期限内失败", { timeout: 5_000 }, async (t) => {
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  const originalUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = `postgresql://test:test@127.0.0.1:${server.address().port}/test`;
  const prisma = getPrisma();
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await prisma.$disconnect();
    await new Promise((resolve) => server.close(resolve));
    if (originalUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalUrl;
  });

  const started = performance.now();
  await assert.rejects(prisma.$queryRaw`SELECT 1`, /timeout|timed out/i);
  assert.ok(performance.now() - started < 4_500, "必须在 Docker 的 5 秒超时前结束");
});

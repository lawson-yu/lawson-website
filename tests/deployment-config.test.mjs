import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(root, path), "utf8");

test("生产 Compose 构建将同一 Server Actions 密钥安全传给 Next builder", () => {
  const dockerfile = read("Dockerfile");
  const compose = read("compose.prod.yaml");
  const envExample = read(".env.production.example");
  const deploy = read("scripts/deploy.sh");

  assert.match(envExample, /^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=.*$/m);
  assert.match(compose, /build:\n\s+context: \.\n\s+target: runner\n\s+secrets:\n\s+- next_server_actions_encryption_key/);
  assert.match(compose, /secrets:\n\s+next_server_actions_encryption_key:\n\s+environment: NEXT_SERVER_ACTIONS_ENCRYPTION_KEY/);
  assert.match(dockerfile, /RUN --mount=type=secret,id=next_server_actions_encryption_key,required=true\s+NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="\$\(cat \/run\/secrets\/next_server_actions_encryption_key\)" pnpm build/);
  assert.match(compose, /env_file:\n\s+- \.env\.production/);
  assert.match(deploy, /docker compose -f compose\.prod\.yaml --env-file \.env\.production/);
});

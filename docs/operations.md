# 部署、备份与恢复

以下命令在项目根目录执行。

## 发布

将 [生产配置模板](../.env.production.example) 复制为 `.env.production` 并填写，使用 `./scripts/deploy.sh` 发布，不以直接执行 `docker compose up` 替代。

数据库初始化参数仅对新数据卷生效；更改现有数据库账号或密码需要单独操作数据库，并同步调整 `DATABASE_URL`。连接 URL 中的特殊字符需要 URL 编码。

初始迁移用于创建空数据库中的作品表。如果已有数据库是通过 `prisma db push` 等方式初始化的，先备份并核对现有结构，再建立 Prisma 迁移基线；不要通过重置数据库解决迁移冲突。

迁移或重要部署前先备份。迁移期间旧应用可能继续处理请求，破坏性变更需分阶段兼容或安排停机。回退代码不会撤销数据库迁移，须确认旧代码与当前数据库兼容。

## 备份

将 [备份配置模板](../deploy/backup.env.example) 复制为 `deploy/backup.env`，使用 `./scripts/backup-postgres.sh` 备份。归档可读检查不能代替恢复演练。

异地备份要求运行账号已配置 [COSCLI](https://cloud.tencent.com/document/product/436/63144)；未设置 `COS_ALIAS` 时只有本地备份。云端保留由存储桶生命周期独立管理，脚本不会清理云端旧文件。

定时任务使用 [service](../deploy/lawson-website-backup.service) 和 [timer](../deploy/lawson-website-backup.timer)。安装前核对账号、路径与频率，确保运行账号可使用 COSCLI；安装后监控任务和上传失败。

本地备份按文件名中的 UTC 时间戳保留最近 `BACKUP_RETENTION` 份；目录名可以包含空格。

## 恢复

先在隔离环境演练。恢复会覆盖目标数据库中备份涉及的对象；确认目标和备份，停止其他写入进程，并将示例路径替换为实际文件。以下每一步成功后才继续：

```bash
backup_file=backups/postgres/lawson_website-示例时间戳.dump

docker compose -f compose.prod.yaml --env-file .env.production exec -T postgres \
  pg_restore --list < "$backup_file" > /dev/null

docker compose -f compose.prod.yaml --env-file .env.production stop app

docker compose -f compose.prod.yaml --env-file .env.production exec -T postgres \
  sh -c 'pg_restore --exit-on-error --clean --if-exists --username="$POSTGRES_USER" --dbname="$POSTGRES_DB"' \
  < "$backup_file"
```

恢复失败时保持应用停止，检查数据库日志和备份后重试；部分对象可能已被修改。成功后确认当前应用与恢复后的数据库版本兼容，再启动并验证：

```bash
docker compose -f compose.prod.yaml --env-file .env.production start app
curl -fsS http://localhost/api/health
```

启用 HTTPS 后使用域名访问健康检查。它只验证应用与数据库连通，不验证表结构和业务正确性；仍需核对关键数据与功能。

## 自动测试

`pnpm test` 验证数据库无响应时能够及时失败。`pnpm test:integration` 需要本机 Docker，会自行创建临时 PostgreSQL 数据库，验证迁移、重复 seed、慢查询超时、备份保留和恢复后的完整数据，并在结束时清理测试容器与数据。

GitHub CI 运行同样的测试。测试使用独立的 Compose 项目和临时配置，不读取生产配置、不连接生产数据库，也不上传 COS；无需配置生产凭据。生产备份仍由服务器上的定时任务执行。

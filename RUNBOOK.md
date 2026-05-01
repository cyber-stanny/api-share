# API Share · 内部试运行 Runbook

> 适用范围：约 30 个学生的小规模内部试运行。

## 上线前检查

- `JWT_SECRET` 使用强随机值，不使用示例值。
- `ADMIN_INIT_PASSWORD` 不使用默认值，初始化后尽快更换管理员密码。
- `CORS_ORIGINS` 只配置实际学生端/管理端域名；多个域名用英文逗号分隔。
- 独立服务器完整部署时，设置 `PROXY_ENABLED=true`，并配置 `TENCENT_SECRET_ID` / `TENCENT_SECRET_KEY` 访问 CloudBase 数据库。
- CloudBase 免费版只用于注册、管理和 Key 发放时，设置 `PROXY_ENABLED=false`，避免 `/v1/*` 被误用为稳定 API 代理。
- 上游 API Key 只放在环境变量或数据库中，不写入代码和文档。
- 白名单只导入本次试运行的学生学号。
- 默认额度使用保守值，避免单个学生耗尽上游预算。
- 管理员每天检查 `usage_records`、`token_counters` 和上游余额。

## 依赖安全状态

已执行：

```bash
npm audit fix
```

结果：没有可自动修复的非 breaking 项；剩余 `npm audit` 风险主要来自 `@cloudbase/node-sdk@^2.0.0` 的传递依赖。`npm audit` 建议通过 `npm audit fix --force` 升级到 `@cloudbase/node-sdk@3.18.1`，但这是 breaking change，不能直接用于试运行部署。

试运行阶段的临时措施：

- 仅开放受控域名和受控学生名单。
- 每个学生独立 API Key，并配置每日/每周额度。
- 保留请求频率限制和并发限制。
- 发现异常用量后立即重置对应学生 API Key。
- CloudBase SDK 3.x 升级作为单独 P1 任务验证。

## 异常处理

## MiMo / MiniMax / DeepSeek Token Plan 容量观察

当前 MiMo / MiniMax / DeepSeek 上游保护默认值：

- 并发：`UPSTREAM_MIMO_MAX_CONCURRENT=8`
- 队列：`UPSTREAM_MIMO_MAX_QUEUE=10`
- 排队超时：`UPSTREAM_MIMO_QUEUE_TIMEOUT_MS=30000`
- 速率：`UPSTREAM_MIMO_RPM=80`
- MiniMax 默认使用同一组限制参数，若需要单独调节可改：
  - `UPSTREAM_MINIMAX_MAX_CONCURRENT=8`
  - `UPSTREAM_MINIMAX_MAX_QUEUE=10`
  - `UPSTREAM_MINIMAX_QUEUE_TIMEOUT_MS=30000`
  - `UPSTREAM_MINIMAX_RPM=80`
- DeepSeek 默认使用同一组限制参数，若需要单独调节可改：
  - `UPSTREAM_DEEPSEEK_MAX_CONCURRENT=8`
  - `UPSTREAM_DEEPSEEK_MAX_QUEUE=10`
  - `UPSTREAM_DEEPSEEK_QUEUE_TIMEOUT_MS=30000`
  - `UPSTREAM_DEEPSEEK_RPM=80`

查看当前实例内存指标：

```bash
curl -H "Authorization: Bearer <ADMIN_JWT>" \
  https://your-domain.example.com/api/admin/upstream-metrics
```

重点看：

- `maxConcurrent`：当天达到过的最大并发。
- `maxQueueDepth`：当天最大排队深度。
- `queueFullRejected`：队列满导致的拒绝次数。
- `queueTimeoutRejected`：排队超过 30 秒的拒绝次数。
- `avgQueueWaitMs`：成功排队请求的平均等待时间。

服务每天会输出一条 `UPSTREAM_LIMITER_DAILY` JSON 日志。多实例部署时，以日志汇总为准；管理接口只代表当前实例。

### 单个学生用量异常

1. 在 `usage_records` 中按 `studentId` 查看最近请求。
2. 在 `users` 中重置或禁用该学生 API Key。
3. 检查是否有大量 401/429/5xx 或异常模型调用。

### 上游余额或 token plan 耗尽

1. 暂停对应 upstream 或降低优先级。
2. 通知学生暂停使用对应模型。
3. 检查 `usage_records` 中最近高用量学生。

### 服务大量返回“系统繁忙”

1. 检查是否有大量 streaming 异常或长连接未关闭。
2. 检查 CloudBase 函数日志中的 proxy/stream 错误。
3. 必要时临时降低单学生频率和并发上限。

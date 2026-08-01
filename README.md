# ⚡ Go2API — OpenCode Go 转发订阅网关

把一份 **OpenCode Go** 订阅转成可分发、可控制的 API 订阅服务：

- **模型控制**：全局白名单 + 每个订阅独立模型白名单（如只给 deepseek-v4-flash、kimi-k2.6）
- **用量控制**：美元额度 / 请求数上限 / RPM 限流 / 每日限流 / 过期时间，超限自动拒绝
- **用量统计**：按 token 精确记账（优先采用上游 `inference-cost` 事件真实成本，缺省回退价格表估算），管理端实时查看
- **多协议转发**：OpenAI `chat/completions`、OpenAI `responses`、Anthropic `messages` 三种端点全支持，SSE 流式透传
- **Web 控制台**：浏览器可视化管理订阅、额度、用量
- **零 npm 依赖**：Node 24 内置 `node:sqlite`，部署零编译、零坑

## 快速开始

```bash
# 本地运行
cp .env.example .env   # 填入 GO_API_KEY（你的 OpenCode Go 密钥）
npm start
```

启动后访问 `http://localhost:3000/` 打开管理控制台（登录密钥在启动日志中，或自己设置 `ADMIN_API_KEY`）。

## 部署到 Railway

1. 推送本仓库到 GitHub
2. Railway → **New Project → Deploy from GitHub repo**
3. 设置环境变量（Variables）：
   | 变量 | 必填 | 说明 |
   |---|---|---|
   | `GO_API_KEY` | ✅ | 你的 OpenCode Go API 密钥 |
   | `ADMIN_API_KEY` | ❌ | 管理密钥；不设则启动时自动生成并打印在日志里 |
   | `DB_PATH` | ❌ | 数据库路径，默认 `./data/go2api.db` |
   | `ENABLED_MODELS` | ❌ | 全局模型白名单（逗号分隔），留空 = 全部 |
   | `DEFAULT_QUOTA_USD` | ❌ | 新订阅默认美元额度，0 = 不限 |
   | `DEFAULT_RPM` | ❌ | 新订阅默认每分钟请求上限，0 = 不限 |
4. **挂持久卷（重要）**：Settings → Volumes → 挂载到 `/app/data`，否则重启后订阅数据丢失
5. 部署完成后，`https://<你的域名>/` 即管理控制台

`railway.json` 已配置健康检查（`/healthz`）和自动重启，也可用附带的 `Dockerfile`。

## 用户接入方式

每个订阅会生成一个 `sk-go2api-xxx` 的 key，把网关地址 + key 给用户即可：

**OpenCode TUI**：`/connect` → OpenAI 兼容 provider → Base URL 填 `https://你的域名/v1`，API Key 填订阅 key

**Claude Code**（走 Anthropic 端点）：
```bash
export ANTHROPIC_BASE_URL="https://你的域名/v1"
export ANTHROPIC_AUTH_TOKEN="sk-go2api-xxx"
```

**任意 OpenAI 兼容客户端**：
```
Base URL: https://你的域名/v1
API Key:  sk-go2api-xxx
```

模型 ID 用裸 ID（如 `deepseek-v4-flash`）；OpenCode 客户端习惯的 `opencode-go/<id>` 前缀同样兼容。`GET /v1/models` 会返回该订阅**可用**的模型列表。

## 管理 API

所有请求带 `Authorization: Bearer <ADMIN_API_KEY>`：

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/admin/subs` | 创建订阅：`{name, models?, quotaUsd?, quotaRequests?, rpm?, rpd?, expiresAt?, note?}` |
| GET | `/admin/subs` | 订阅列表（含实时用量） |
| GET | `/admin/subs/:id` | 详情 + 最近 20 条用量 |
| PATCH | `/admin/subs/:id` | 修改：`{status?, models?, quotaUsd?, ... rotateKey?}`（`rotateKey: true` 换新 key） |
| POST | `/admin/subs/:id/reset` | 清零已用额度 |
| DELETE | `/admin/subs/:id` | 删除订阅 |
| GET | `/admin/stats` | 总请求数 / 总成本 / 按模型分布 |
| GET | `/admin/usage?limit=50&sub_id=` | 用量日志 |
| GET | `/admin/models` | 模型目录与价格表 |

```bash
# 示例：创建订阅（$2 额度，仅两个模型）
curl -X POST https://你的域名/admin/subs \
  -H "Authorization: Bearer $ADMIN_API_KEY" -H "Content-Type: application/json" \
  -d '{"name":"朋友A","quotaUsd":2,"models":["deepseek-v4-flash","kimi-k2.6"],"rpm":10}'
```

## 模型与计费

模型目录/价格表来自 [OpenCode Go 官方文档](https://opencode.ai/docs/zh-cn/go/)（`src/prices.js`，含上游实际提供但文档未列的新模型）。记账逻辑：

1. 流式响应优先解析上游 `x-opencode-type: inference-cost` 事件，**直接采用上游真实成本**
2. 非流式响应带 `cost` 字段且非零时采用
3. 都没有则按价格表 × usage 计算（缓存读取/写入单独计价）
4. usage 缺失时按 `max_tokens` 兜底估算

## 测试

```bash
node test/e2e.js     # 全链路测试（mock 上游，无需真实 key）
GOKEY=sk-xxx node test/live.js   # 真实上游联调（消耗少量上游额度）
```

## 注意事项

- **单实例设计**：RPM 限流在内存中，DB 用 SQLite（WAL）。多实例部署时请把限流换成 Redis，DB 换成 Postgres
- **上游区域限制**：个别模型（如 gpt-5.6-luna）可能因 key 的区域返回 403，属上游策略，会原样透传给用户
- **DeepSeek V4 Flash 注意**：上游有 `reasoning_content` 思维链输出，`max_tokens` 不足时可能只输出推理不出正文，属模型正常行为

# Inkwell

一个基于 TanStack Start 与 Cloudflare 边缘架构的全栈博客系统。

## 技术栈

- **框架**: [TanStack Start](https://tanstack.com/start) (SSR + 文件路由)
- **数据库**: Cloudflare D1 (SQLite) + [Drizzle ORM](https://orm.drizzle.team)
- **存储**: Cloudflare R2 (文章封面图)
- **AI**: Cloudflare Workers AI (文章摘要、标签推荐)
- **样式**: Tailwind CSS v4 + shadcn/ui 组件
- **认证**: Session Cookie + Cloudflare Workers 环境变量

## 特性

- 全栈类型安全 — 端到端 TypeScript
- 管理后台 — 文章编辑、分类管理、站点设置
- 富文本编辑器 — AI 辅助写作、标签推荐、封面管理
- 分类/标签体系 — 支持两级分类、彩色标签
- GA4 支持 — 后台配置测量 ID，前台自动注入
- 自适应布局 — 移动端/桌面端均可使用
- 响应式设计 — 暖画布色调 + 珊瑚色强调，9Router 风格格子背景

## 本地开发

### 前置条件

- Node.js ≥ 20
- [pnpm](https://pnpm.io/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（部署时需要）

### 1. 安装依赖

```bash
pnpm install
```

### 2. 初始化本地 D1 数据库

```bash
# 创建本地 D1 数据库（仅首次）
pnpm wrangler d1 create inkwell_db --local

# 应用数据库迁移
pnpm wrangler d1 migrations apply inkwell_db --local
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env`，填入以下内容：

| 变量 | 说明 | 默认值 |
|---|---|---|
| `ADMIN_USERNAME` | 管理后台登录用户名 | `admin` |
| `ADMIN_PASSWORD_HASH` | 登录密码的 PBKDF2 加盐哈希（`node tools/gen-admin-hash.mjs "密码"` 生成） | 见 `.dev.vars.example` |
| `SESSION_SECRET` | Session Cookie 加密密钥（至少 32 字符） | 见 `.dev.vars.example` |
| `AI_ENC_KEY` | 加密 AI 模型 API Key 的密钥（base64 32 字节） | 见 `.dev.vars.example` |

### 4. 启动开发服务器

```bash
pnpm dev
```

打开 http://localhost:3080 访问前台，http://localhost:3080/admin 进入管理后台。

> **注意**: 本地开发使用 `@cloudflare/vite-plugin`，SSR 在 workerd 运行时中执行，因此 D1 绑定和 `cloudflare:workers` 模块在本地也可用。

## 数据库迁移

当修改 `src/lib/schema.ts` 后，需要生成并应用迁移：

```bash
# 生成迁移 SQL 文件
pnpm drizzle-kit generate

# 应用到本地数据库
pnpm wrangler d1 migrations apply inkwell_db --local

# 应用到生产数据库
pnpm wrangler d1 migrations apply inkwell_db --remote
```

## 部署到 Cloudflare Workers

### 1. 创建生产资源（仅首次）

```bash
# 创建 D1 数据库
pnpm wrangler d1 create inkwell_db

# 创建 R2 存储桶
pnpm wrangler r2 bucket create inkwell-assets

# 应用迁移到生产数据库
pnpm wrangler d1 migrations apply inkwell_db --remote
```

### 2. 配置 wrangler.jsonc

部署前确保 `wrangler.jsonc` 中的 `database_id` 已更新为实际值。创建 D1 数据库后，Wrangler 会输出 database ID，复制到 `wrangler.jsonc` 中：

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "inkwell_db",
      "database_id": "这里替换为实际的 database ID",
      "migrations_dir": "migrations"
    }
  ]
}
```

### 3. 设置生产密钥（Secrets）

密码请用加盐哈希，不要直接填明文（否则登录会被拒绝）：

```bash
# 1. 生成密码哈希，复制输出
node tools/gen-admin-hash.mjs "你的强密码"

# 2. 逐个交互式粘贴（不写进仓库）
pnpm wrangler secret put ADMIN_PASSWORD_HASH
pnpm wrangler secret put SESSION_SECRET
pnpm wrangler secret put AI_ENC_KEY
```

`ADMIN_USERNAME` 已在 `wrangler.jsonc` 的 `vars` 中配置（默认 `admin`），如需修改可编辑该文件。

### 4. 构建并部署

```bash
pnpm build
pnpm wrangler deploy
```

或一键执行：

```bash
pnpm deploy
```

## 项目结构

```
src/
├── routes/          # 文件路由（前台 + 后台）
│   ├── __root.tsx   # 根布局、GA4 注入
│   ├── index.tsx    # 首页
│   ├── posts.$slug  # 文章详情
│   ├── admin.tsx    # 后台布局（侧边栏）
│   ├── admin.*.tsx  # 后台各页面
│   └── ...
├── components/      # UI 组件
├── lib/             # 工具函数、数据库 Schema、认证
├── admin.css        # 后台主题样式
└── styles.css       # 前台主题样式
```

## 外部博客同步（Hugo / Hexo）

系统提供基于 API Key 的同步接口，可将 Hugo / Hexo 等静态博客的文章导入 Inkwell。

### 1. 创建 API Key

登录管理后台，进入 **API 密钥** 页面（`/admin/apikeys`），填写名称后点击「生成密钥」。
密钥明文**仅展示一次**，请立即复制保存。删除密钥会使对应来源的同步立即失效。

### 2. 调用同步接口

```bash
curl -X POST https://your-domain/api/sync \
  -H "Authorization: Bearer ink_xxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "title": "我的第一篇文章",
        "slug": "my-first-post",
        "content": "# 正文 Markdown ...",
        "description": "摘要",
        "tags": ["随笔", "技术"],
        "categories": ["生活"],
        "coverImage": "https://.../cover.jpg",
        "status": "published",
        "date": "2024-01-01"
      }
    ]
  }'
```

- 鉴权：请求头 `Authorization: Bearer <apikey>`。
- 支持一次提交多篇文章（JSON 中的 `posts` 数组）。
- 若提供了含 YAML frontmatter 的 `markdown` 字段（Hugo / Hexo 典型格式），
  系统会自动解析 `title` / `slug` / `description` / `tags` / `categories` /
  `cover` / `draft` / `date` 等元信息，无需逐个字段填写。
- 按 `slug` 判定文章是否存在：已存在则更新，否则新建。同名标签会自动复用或创建；
  分类若不存在则按默认色自动创建。
- 返回示例：`{ "synced": 1, "failed": 0, "results": [{ "slug": "...", "action": "created" }], "errors": [] }`
  （部分失败时 HTTP 状态码为 `207`）。

## License

MIT
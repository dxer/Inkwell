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
| `ADMIN_PASSWORD` | 管理后台登录密码 | `admin_secure_password` |
| `SESSION_SECRET` | Session Cookie 加密密钥（至少 32 字符） | 见 `.env.example` |

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

### 3. 设置生产环境变量

```bash
pnpm wrangler secret put ADMIN_USERNAME
pnpm wrangler secret put ADMIN_PASSWORD
pnpm wrangler secret put SESSION_SECRET
```

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

## License

MIT
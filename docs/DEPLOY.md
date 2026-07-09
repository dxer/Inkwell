# 🚀 部署到 Cloudflare

## 前置要求

1. Fork 本仓库到你的 GitHub 账号
2. 注册 [Cloudflare 账号](https://dash.cloudflare.com/)

---

## 部署步骤（网页操作，推荐）

完全在浏览器中完成，无需命令行。

### 步骤 1：创建 Cloudflare 资源

登录 Cloudflare Dashboard，依次创建：

| 资源类型 | 名称 | 说明 |
|---------|------|------|
| D1 数据库 | `inkwell_db` | 存储文章、分类、标签 |
| R2 存储桶 | `inkwell-assets` | 存储图片等静态资源 |

**注意**：创建 D1 时会显示一个 `Database ID`（如 `xxx-xxx-xxx-xxx`），记录下来备用。

### 步骤 2：通过 Workers 创建项目

1. 进入 **Workers & Pages** → **Create Worker**
2. 点击 **Start from a GitHub repository**
3. 选择你的 Fork 仓库，点击 **Begin setup**

### 步骤 3：配置项目

**Project settings**:
```
Project name: inkwell（或其他名称）
Application entrypoint: 留空（自动检测）
```

**Bindings**（向下滚动找到此区域）:

| 类型 | 变量名 | 资源 |
|------|--------|------|
| D1 | `DB` | 选择 `inkwell_db`（会自动填入 Database ID） |
| R2 | `MY_R2_BUCKET` | 选择 `inkwell-assets` |

点击 **Add binding** 添加每个绑定。

**重要**：确保 D1 绑定显示了有效的 Database ID，如果没有，请重新选择数据库。

**Environment variables / Secrets**:

后台凭证与密钥分两类：**普通变量（Variables）** 和 **加密密钥（Secrets，勾选 Encrypt）**。
密码**不要**直接填明文，而要用加盐哈希（`ADMIN_PASSWORD_HASH`），否则登录会被拒绝。

| 名称 | 类型 | 值 | 说明 |
|------|------|-----|------|
| `ADMIN_USERNAME` | Variable | `admin` | 后台登录用户名 |
| `ADMIN_PASSWORD_HASH` | **Secret (Encrypt)** | `pbkdf2$sha256$...` | 密码的 PBKDF2 哈希，见下方生成方法 |
| `SESSION_SECRET` | **Secret (Encrypt)** | 随机串（≥32 字符） | 会话 Cookie 签名密钥，`openssl rand -base64 32` |
| `AI_ENC_KEY` | **Secret (Encrypt)** | base64 32 字节 | 加密 AI 模型 API Key 的密钥，见下方生成方法 |

点击 **Add variable / Add secret** 逐项添加。

**生成 `ADMIN_PASSWORD_HASH`**（在本地仓库目录执行）：

```bash
node tools/gen-admin-hash.mjs "你的强密码"
# 输出形如 pbkdf2$sha256$200000$<salt>$<hash>，粘到 ADMIN_PASSWORD_HASH
```

**生成 `AI_ENC_KEY`**：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> 用 CLI 部署时等效命令：`wrangler secret put ADMIN_PASSWORD_HASH` / `wrangler secret put SESSION_SECRET` / `wrangler secret put AI_ENC_KEY`（交互式粘贴值，不写进仓库）。
> 本地开发见仓库根目录 `.dev.vars.example`（复制为 `.dev.vars` 填写）。

**Variables**:

```
NODE_VERSION: 20
```

### 步骤 4：部署

点击页面底部的 **Deploy**，等待约 2-3 分钟。

部署成功后会显示你的 Worker 域名（如 `inkwell.你的账户.workers.dev`）。

### 步骤 5：初始化数据库（可选）

应用首次访问时会**自动建表并迁移**（见 `src/routes/__root.tsx` 的 `getSiteSettingsFn`），因此本步骤通常**可跳过**。仅在需要手动预建库时才执行：

1. 进入 **Workers & Pages** → **D1** → 选择 `inkwell_db`
2. 点击右上角的 **Console**
3. 复制以下 SQL 代码粘贴并执行：

```sql
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`sort_order` integer DEFAULT 0,
	`color` text DEFAULT '#C15F3C' NOT NULL
);
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);

CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`keywords` text,
	`cover_image` text,
	`content_blocks` text NOT NULL,
	`content_html` text NOT NULL,
	`category_id` text,
	`status` text DEFAULT 'draft',
	`views` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE UNIQUE INDEX `posts_slug_unique` ON `posts` (`slug`);

CREATE TABLE `posts_to_tags` (
	`post_id` text,
	`tag_id` text,
	PRIMARY KEY(`post_id`, `tag_id`),
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer
);

CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);
```

### 完成！

访问你的 Worker 域名即可看到博客。

后台登录：`你的域名/admin`

---

## 更新部署

代码推送到 GitHub 后，在 Workers 项目页面点击 **Retry deployment** 即可重新部署。

---

## 自定义域名（可选）

进入 Workers → 你的项目 → Triggers → Custom Domains → 添加你的域名。

---

## 常见问题

**Q: 部署后页面空白？**

A: 检查 D1 数据库是否已执行初始化 SQL。

**Q: 图片上传失败？**

A: 检查 R2 存储桶是否正确绑定到 `MY_R2_BUCKET`。

**Q: 部署失败显示 database_id 错误？**

A: 确保在 Workers UI 的 Bindings 中选择了 D1 数据库，Database ID 会自动填充。
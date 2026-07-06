# 🚀 一键部署到 Cloudflare

## 前置要求

1. Fork 本仓库到你的 GitHub 账号
2. 注册 [Cloudflare 账号](https://dash.cloudflare.com/)

---

## 方式一：Cloudflare Pages（网页操作，推荐新手）

完全在浏览器中完成，无需命令行。

### 步骤 1：创建 Cloudflare 资源

登录 Cloudflare Dashboard，依次创建：

| 资源类型 | 名称 | 说明 |
|---------|------|------|
| D1 数据库 | `inkwell_db` | 存储文章、分类、标签 |
| R2 存储桶 | `inkwell-assets` | 存储图片等静态资源 |

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
| D1 | `DB` | 选择 `inkwell_db` |
| R2 | `MY_R2_BUCKET` | 选择 `inkwell-assets` |

点击 **Add binding** 添加每个绑定。

**Environment variables**:

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ADMIN_USERNAME` | admin | 后台登录用户名 |
| `ADMIN_PASSWORD` | 设置密码 | 后台登录密码 |
| `SESSION_SECRET` | 生成随机字符串 | 至少32字符 |

点击 **Add variable** 添加每个变量。

**Variables**:

```
NODE_VERSION: 20
```

### 步骤 4：部署

点击页面底部的 **Deploy**，等待约 2-3 分钟。

部署成功后会显示你的 Worker 域名（如 `inkwell.你的账户.workers.dev`）。

### 步骤 5：初始化数据库

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

## 方式二：GitHub Actions 自动部署（推荐开发者）

代码推送到 GitHub 后自动部署，适合频繁更新。

### 步骤 1：创建 Cloudflare 资源

同方式一步骤 1。

### 步骤 2：获取 API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板
4. 权限勾选：
   - Account > Cloudflare Workers > Edit
   - Account > D1 > Edit
   - Account > R2 > Edit
5. 生成后复制 Token

### 步骤 3：配置 GitHub Secrets

进入你的 Fork 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名称 | 值 |
|------------|-----|
| `CLOUDFLARE_ACCOUNT_ID` | 在 Cloudflare Dashboard 右侧可找到 |
| `CLOUDFLARE_API_TOKEN` | 上一步生成的 Token |

**注意**：环境变量（ADMIN_USERNAME 等）需要在 `.env` 文件中配置并提交，或使用 Cloudflare UI 配置。

### 步骤 4：触发部署

**方式一**：推送代码到 master/main 分支
```bash
git push
```

**方式二**：在 GitHub Actions 页面手动点击 "Run workflow"

### 步骤 5：初始化数据库

同方式一步骤 5。

---

## 自定义域名（可选）

### Cloudflare Workers/Pages

进入 Workers/Pages → 你的项目 → Triggers/Settings → Custom Domains → 添加你的域名。

按提示在 DNS 中添加 CNAME 记录指向你的 Worker/Pages 域名。

---

## 常见问题

**Q: 部署后页面空白？**

A: 检查 D1 数据库是否已执行初始化 SQL。

**Q: 图片上传失败？**

A: 检查 R2 存储桶是否正确绑定到 `MY_R2_BUCKET`。

**Q: 如何重新部署？**

- 方式一：推送代码到 GitHub
- 方式二：在 Workers/Pages 项目页面点击 "Retry deployment"
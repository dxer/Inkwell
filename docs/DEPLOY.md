# 🚀 一键部署到 Cloudflare Workers

## 前置要求

1. Fork 本仓库到你的 GitHub 账号
2. 注册 [Cloudflare 账号](https://dash.cloudflare.com/)

## 部署步骤（只需 3 分钟）

### 1. 创建 Cloudflare 资源

访问 Cloudflare Dashboard，依次创建：

| 资源类型 | 名称 | 说明 |
|---------|------|------|
| D1 数据库 | `inkwell_db` | 存储文章、分类、标签 |
| R2 存储桶 | `inkwell-assets` | 存储图片等静态资源 |

### 2. 获取 API Token

1. 访问 https://dash.cloudflare.com/profile/api-tokens
2. 点击 "Create Token"
3. 使用 "Edit Cloudflare Workers" 模板
4. 权限勾选：
   - Account > Cloudflare Workers > Edit
   - Account > D1 > Edit
   - Account > R2 > Edit
5. 生成后复制 Token

### 3. 配置 GitHub Secrets

进入你的 Fork 仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret 名称 | 值 |
|------------|-----|
| `CLOUDFLARE_ACCOUNT_ID` | 在 Cloudflare Dashboard 右侧可找到 |
| `CLOUDFLARE_API_TOKEN` | 上一步生成的 Token |
| `ADMIN_USERNAME` | 后台登录用户名（如：admin） |
| `ADMIN_PASSWORD` | 后台登录密码 |
| `SESSION_SECRET` | 随机字符串（至少32字符）|

### 4. 触发部署

**方式一**：推送代码到 master/main 分支
```bash
git push
```

**方式二**：在 GitHub Actions 页面手动点击 "Run workflow"

### 5. 访问你的博客

部署完成后，Cloudflare 会显示你的 Worker 域名（如 `inkwell.xxx.workers.dev`）

---

## 自定义域名（可选）

在 Cloudflare Dashboard → Workers → 你的应用 → Triggers → Custom Domains 添加你的域名。

---

## 更新数据库

如需应用数据库迁移，本地执行：
```bash
pnpm exec wrangler d1 migrations apply inkwell_db --remote
```
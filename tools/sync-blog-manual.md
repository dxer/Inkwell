# Inkwell 文章同步工具 · 操作手册

将本地 **Hugo / Hexo** 站点的 Markdown 文章（含 frontmatter 元信息、标签、分类、封面、SEO 关键字以及图片）一键同步到 Inkwell 博客后台。

工具位置：`tools/sync-blog.mjs`（零依赖，仅需 Node.js ≥ 18）。

---

## 1. 工作原理

1. 递归扫描文章目录，解析每篇 Markdown 的 YAML frontmatter，提取：标题、slug、时间、描述、SEO 关键字、标签、分类、封面。
2. 收集文章与封面里引用的本地图片 → 逐个上传到 Inkwell 的 `/api/upload` → 把 Markdown 中的图片链接改写为线上地址。
3. 将处理后的文章以 `POST /api/sync`（携带 `Authorization: Bearer <apikey>`）批量发送到后台，后台按 slug 去重：**已存在则更新，不存在则新建**。

> 导入是**幂等**的：同一篇文章（相同 slug）重复导入会更新原文章，不会新建重复条目。

---

## 2. 前置条件

### 2.1 服务端已部署最新代码
以下功能依赖服务端代码，必须在运行同步的服务器上重新构建/部署后才生效：
- `/api/upload` 的 API Key 鉴权
- 同步导入的重复文章更新（见 §6）
- SEO `keywords` 持久化
- 后台分页、封面图开关等

若服务器仍是旧构建，请在该机器上：
- 本地运行：`pnpm dev` 重启；
- 部署到 Cloudflare：`pnpm deploy` 后**硬刷新**浏览器（Ctrl/Cmd+Shift+R）。

> 验证服务器为新代码：后台「文章管理」列表底部应出现分页条（共 N 篇 · 第 x / y 页 + 上一页/下一页）。看不到分页条即仍为旧代码。

### 2.2 已创建 API Key
在后台「API 密钥」页（`/admin/apikeys`）生成密钥，复制明文（仅展示一次）。同步时用 `--apikey` 传入，或设置环境变量 `APIKEY`。

---

## 3. 快速开始

```bash
# 最简：本机 dev 环境
node tools/sync-blog.mjs \
  --dir ./content/posts \
  --apikey ink_xxxxxxxxxxxx

# 指定线上服务地址 + 图片资源目录
node tools/sync-blog.mjs \
  --dir /opt/workspace/haifeng/rekcore/content/posts \
  --apikey ink_3dvPw2kCXpdT \
  --endpoint http://107.173.127.244:3080/api/sync \
  --assets-dir /opt/workspace/haifeng/rekcore/static,/opt/workspace/haifeng/rekcore/assets
```

也可用 npm script：`pnpm sync -- --dir ./content/posts --apikey ink_xxx ...`

---

## 4. 参数说明

| 参数 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `--dir <path>` | ✅ | — | 文章目录（递归扫描 `.md`/`.markdown`，跳过 `_index.md` 与主题/缓存等目录） |
| `--apikey <key>` | ✅ | — | API 密钥；也可用环境变量 `APIKEY` |
| `--endpoint <url>` | | `http://localhost:3080/api/sync` | 同步接口地址；也可用环境变量 `SYNC_ENDPOINT` |
| `--assets-dir <dirs>` | | 空 | 额外扫描图片的目录，逗号分隔（如 Hugo `static`、Hexo `source`）。**图片在文章目录之外时必须传** |
| `--upload-endpoint <url>` | | 由 `--endpoint` 推导（把 `/api/sync` 换成 `/api/upload`） | 图片上传接口地址 |
| `--batch <n>` | | `20` | 每批发送文章数 |
| `--skip-drafts` | | false | 跳过 `draft: true` / `published: false` 的草稿 |
| `--no-images` | | false | 不同步图片，仅同步文字与元信息 |
| `--dry-run` | | false | 只解析并打印，不调用接口（**不含图片上传计划**，见 §5 注意事项） |
| `--quiet` | | false | 仅输出结果摘要 |

---

## 5. 图片同步（重点）

图片默认**不会自动同步**，除非满足以下任一条件：

- 图片与文章同级（Hugo 页面包 `content/posts/<post>/index.md` + 同目录 `photo.png`）——`--dir` 内自动扫描；
- 图片在文章目录**之外**（Hugo `static/`、Hexo `source/` 等）——必须通过 `--assets-dir` 显式指定。

引用解析顺序（每处图片链接）：
1. 相对文章所在文件夹解析（页面包同级图）；
2. 按文件名在全部已扫描图片中模糊匹配（最宽松）；
3. 按去掉前导斜杠的相对路径匹配（如 `/img/x.png` → 对应 `static/img/x.png`）。

找到本地文件 → 上传并改写为 `/api/assets/...`；找不到 → 计入「跳过」。

运行结束会打印汇总：
```
同步完成：文章成功 N（新建 X / 更新 Y），失败 Z。 图片上传 A，跳过 B（未找到本地文件或已为线上地址）。
```
若 `A=0 且 B>0`，基本是 `--assets-dir` 没配对（见 §8 排查）。

### 已知局限
- **Hugo shortcode 不支持**：`{{< figure src="..." >}}`、`{{% asset image="..." %}}` 等非标准 Markdown 语法，正则会漏抓。
- **图片链接含空格不支持**：Markdown 中 `![x](my photo.png)` 这类带空格的 URL 无法匹配。
- 已为 `http(s):` / `data:` / `/api/assets/` 的链接视为线上地址，直接保留、不上传。

> 注意：`--dry-run` 仅解析元信息，**不会执行图片上传/改写**，因此预览里看不到图片处理情况。要验证图片，请用正式运行并观察结尾的「图片上传/跳过」数字。

---

## 6. 重复导入（幂等更新）

后台按 `slug` 判定文章是否存在：
- 已存在相同 slug → **更新**该文章（标题、正文、封面、标签、分类、关键字全部覆盖）；
- 不存在 → 创建新文章（并自动保证 slug 全局唯一）。

因此可放心多次运行同步脚本做增量更新，不会生成重复文章。

---

## 7. 目录结构示例

**Hugo（页面包 + static）**
```
site/
├── content/posts/
│   ├── my-post/index.md        # 引用 ./diagram.png（同级，自动识别）
│   └── other-post.md
└── static/
    └── img/cover.png           # 引用 /img/cover.png（需 --assets-dir ./static）
```
命令：`--dir ./content/posts --assets-dir ./static`

**Hexo**
```
blog/
├── source/_posts/
│   └── hello.md                # 引用 ../images/a.png 或 /images/a.png
└── source/images/
    └── a.png                   # 需 --assets-dir ./source
```
命令：`--dir ./source/_posts --assets-dir ./source`

---

## 8. 常见问题排查

**Q1. 提示 HTTP 404**
接口路径写错。路由是 `/api/sync`（结尾是 `sync`，不是 `syn`）。检查 `--endpoint` 是否多了/少了字母。

**Q2. 提示「API Key 无效或未授权」(401)**
- Key 错误或未创建；
- 服务器为旧代码（`/api/upload` 尚未加鉴权时可能行为不同）；
- 注意：本地 `localhost` 是安全上下文可用 `navigator.clipboard`，但同步工具用 API Key + Bearer，与是否 HTTPS 无关。

**Q3. 图片一个都没上传（跳过数 = 引用数）**
没传 `--assets-dir`，且图片不在文章目录内。先定位图片位置：
```bash
find /path/to/site -name '*.png' -o -name '*.jpg' -o -name '*.webp' -o -name '*.svg' | grep -vi node_modules | head
```
把含图片的目录加进 `--assets-dir`（逗号分隔）重跑。

**Q4. 部分图片仍缺失**
多为以下原因：
- 用的是 Hugo shortcode（非标准 `![](...)`)；
- Markdown 图片链接含空格；
- 引用路径与本地文件实际位置差异过大（可临时把相关目录整体加入 `--assets-dir` 靠「按文件名模糊匹配」兜底）。

**Q5. 跑完文章成功但封面不显示**
- 封面是本地路径且未被 `--assets-dir` 覆盖 → 上传失败被丢弃；
- 后台「站点设置 → 前台列表封面图」开关未开启（仅影响前台列表页封面，不影响文章详情页）。

---

## 9. 典型完整命令

```bash
node tools/sync-blog.mjs \
  --dir /srv/site/content/posts \
  --apikey ink_3dvPw2kCXpdT \
  --endpoint https://blog.example.com/api/sync \
  --assets-dir /srv/site/static,/srv/site/assets \
  --batch 20

# 只同步已发布、跳过草稿
#   + --skip-drafts

# 先预览解析结果（不含图片上传）
#   + --dry-run
```

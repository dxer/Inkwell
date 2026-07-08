#!/usr/bin/env node
// sync-blog.mjs — 将本地 Hugo / Hexo 文章目录同步到 Inkwell 博客后台。
//
// 用法：
//   node tools/sync-blog.mjs --dir ./content/posts --apikey ink_xxx
//   node tools/sync-blog.mjs --dir ./content --apikey ink_xxx --assets-dir ./static,./assets --endpoint https://blog.example.com/api/sync
//
// 说明：
//   - 递归扫描文章目录中的所有 .md / .markdown（跳过 _index.md、主题/静态资源等）
//   - 解析 YAML frontmatter：标题、时间、描述、slug、SEO 关键字、标签、分类、封面
//   - 收集文章与封面引用的本地图片，先上传到 Inkwell（/api/upload，复用同一 API Key），
//     再把 Markdown 里的图片链接重写为线上 URL，最后调用 /api/sync 同步文章
//   - 接口端按 slug 去重：已存在则更新，不存在则新建
//
// 可选参数：
//   --dir <path>          文章目录（必填）
//   --apikey <key>        API 密钥（必填，也可用环境变量 APIKEY）
//   --endpoint <url>      同步接口地址（默认 http://localhost:3080/api/sync，也可用环境变量 SYNC_ENDPOINT）
//   --assets-dir <dirs>   额外扫描图片的目录（逗号分隔，如 Hugo 的 static、Hexo 的 source）。
//                         文章目录本身也会被扫描以寻找图片（页面包 / 同级图片）。
//   --upload-endpoint <url> 上传接口地址（默认由 --endpoint 推导：把 /api/sync 换成 /api/upload）
//   --batch <n>           每批发送文章数（默认 20）
//   --skip-drafts         跳过 draft/published:false 的草稿
//   --no-images           不同步图片（仅同步文字与元信息）
//   --dry-run             只解析并打印，不真正调用接口
//   --quiet               仅输出结果摘要

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const IGNORE_DIRS = new Set([
  "archetypes", "public", "resources", "layouts", "data",
  "node_modules", ".git",
]);

const IMAGE_EXT = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico",
]);

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".ico": "image/x-icon",
};

// ---------- 参数解析 ----------
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const DIR = args.dir;
const APIKEY = args.apikey || process.env.APIKEY;
const ENDPOINT = args.endpoint || process.env.SYNC_ENDPOINT || "http://localhost:3080/api/sync";
const ASSET_DIRS = (args["assets-dir"] || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .map((s) => path.resolve(s));
const BATCH = Math.max(1, parseInt(args.batch || "20", 10) || 20);
const SKIP_DRAFTS = !!args["skip-drafts"];
const NO_IMAGES = !!args["no-images"];
const DRY_RUN = !!args["dry-run"];
const QUIET = !!args.quiet;

if (!DIR) {
  console.error("缺少必填参数 --dir <文章目录>");
  process.exit(2);
}
if (!APIKEY) {
  console.error("缺少必填参数 --apikey <密钥>（或设置环境变量 APIKEY）");
  process.exit(2);
}

const UPLOAD_BASE = ENDPOINT.replace(/\/api\/sync\/?$/, "");
const UPLOAD_ENDPOINT = args["upload-endpoint"] || `${UPLOAD_BASE}/api/upload`;

// ---------- 极简 YAML frontmatter 解析 ----------
function parseScalar(v) {
  if (v === undefined) return "";
  let s = String(v).trim();
  if (s.startsWith("[") && s.endsWith("]")) {
    return s
      .slice(1, -1)
      .split(",")
      .map((x) => parseScalar(x.trim()))
      .filter((x) => x !== "" && x != null);
  }
  s = s.replace(/^["']|["']$/g, "");
  if (s === "true") return true;
  if (s === "false") return false;
  if (s !== "" && !isNaN(Number(s))) return Number(s);
  return s;
}

function parseFrontmatter(raw) {
  const text = raw.replace(/\r\n/g, "\n");
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const header = m[1];
  const body = m[2];
  const data = {};
  const lines = header.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }
    const kv = line.match(/^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) {
      i++;
      continue;
    }
    const indent = kv[1].length;
    const key = kv[2];
    const value = kv[3].trim();

    // 嵌套块映射：key: 后跟缩进的 subkey: value
    if (!value && i + 1 < lines.length) {
      const next = lines[i + 1];
      const nkv = next.match(/^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
      if (nkv && nkv[1].length > indent) {
        const obj = {};
        while (i + 1 < lines.length) {
          const nl = lines[i + 1];
          const nnkv = nl.match(/^(\s*)([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
          if (!nnkv || nnkv[1].length <= indent) break;
          obj[nnkv[2]] = parseScalar(nnkv[3].trim());
          i++;
        }
        data[key] = obj;
        continue;
      }
      // 块列表：- item
      const nlist = next.match(/^(\s*)-\s+(.*)$/);
      if (nlist && nlist[1].length > indent) {
        const list = [];
        while (i + 1 < lines.length) {
          const nl = lines[i + 1];
          const nl2 = nl.match(/^(\s*)-\s+(.*)$/);
          if (!nl2 || nl2[1].length < indent) break;
          list.push(parseScalar(nl2[2].trim()));
          i++;
        }
        data[key] = list;
        continue;
      }
    }

    data[key] = parseScalar(value);
    i++;
  }
  return { data, body };
}

// ---------- 提取元数据 ----------
function toStr(v) {
  return v == null ? "" : String(v).trim();
}

function asArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v.map((x) => toStr(x)).filter(Boolean);
  return toStr(v)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function extractMeta(file, raw) {
  const { data, body } = parseFrontmatter(raw);

  const title = toStr(data.title) || path.basename(file).replace(/\.(md|markdown)$/i, "");
  const slug = toStr(data.slug) || (Array.isArray(data.aliases) ? toStr(data.aliases[0]) : "");
  const description = toStr(data.description) || toStr(data.summary) || toStr(data.excerpt);

  const keywords = asArray(data.keywords);
  const tags = asArray(data.tags);
  const categories = asArray(data.categories).length ? asArray(data.categories) : asArray(data.category);
  let coverImage = data.cover?.image || data.image || data.cover || data.thumbnail || null;
  coverImage = coverImage ? toStr(coverImage) : null;

  const date = data.date || data.publishDate || data.published || data.lastmod || null;
  const isDraft = data.draft === true || data.published === false;
  const status = isDraft ? "draft" : "published";

  return {
    title, slug, description,
    keywords: keywords.join(", "),
    tags, categories,
    coverImage,
    date: date ? toStr(date) : null,
    status, isDraft,
    body, raw,
  };
}

// ---------- 文件收集 ----------
async function walk(dir, ignoreDirs, onFile) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    console.error(`无法读取目录 ${dir}: ${e.message}`);
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (ignoreDirs.has(e.name)) continue;
      await walk(full, ignoreDirs, onFile);
    } else if (e.isFile()) {
      await onFile(full, e.name);
    }
  }
}

async function collectMarkdownFiles(dir) {
  const files = [];
  await walk(path.resolve(dir), IGNORE_DIRS, (full, name) => {
    const lower = name.toLowerCase();
    if (!lower.endsWith(".md") && !lower.endsWith(".markdown")) return;
    if (name.startsWith("_index.")) return; // Hugo 列表页，非文章
    files.push(full);
  });
  return files;
}

// 构建图片索引：absPath -> 文件；并按 basename 与相对路径建立查找表
async function buildImageIndex(roots) {
  const index = { byPath: new Map(), byBase: new Map(), byRel: new Map() };
  const scanRoot = async (root, ignore) => {
    await walk(root, ignore, (full, name) => {
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXT.has(ext)) return;
      index.byPath.set(full, full);
      const base = name.toLowerCase();
      if (!index.byBase.has(base)) index.byBase.set(base, full);
      const rel = path.relative(root, full).toLowerCase();
      if (rel && !index.byRel.has(rel)) index.byRel.set(rel, full);
    });
  };
  // 文章目录本身（含页面包同级图片），用 IGNORE_DIRS 跳过无关目录
  await scanRoot(path.resolve(DIR), IGNORE_DIRS);
  // 用户指定的资源目录（如 static / source），完整扫描
  for (const d of ASSET_DIRS) await scanRoot(d, new Set());
  return index;
}

// 将文章/封面中的图片引用解析为本地文件绝对路径；返回 null 表示无需处理
function resolveImageSrc(rawSrc, mdDir, index) {
  if (/^(https?:|data:|#|\/api\/assets\/)/i.test(rawSrc)) return null;
  const clean = rawSrc.split("#")[0].split("?")[0];
  if (!clean) return null;
  // 1) 相对文章目录解析（页面包 / 同级图片）
  const rel = path.resolve(mdDir, clean);
  if (index.byPath.has(rel)) return rel;
  // 2) 按文件名在全部索引中匹配（最宽松）
  const base = path.basename(clean).toLowerCase();
  if (index.byBase.has(base)) return index.byBase.get(base);
  // 3) 按去掉前导斜杠的相对路径匹配（如 /img/x.png 对应 static/img/x.png）
  const noLead = clean.replace(/^\/+/, "").toLowerCase();
  if (index.byRel.has(noLead)) return index.byRel.get(noLead);
  return null;
}

// ---------- 调用接口 ----------
async function postBatch(posts) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${APIKEY}`,
    },
    body: JSON.stringify({ posts }),
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* 非 JSON 响应 */
  }
  if (!res.ok) {
    throw new Error(payload?.error || `HTTP ${res.status}`);
  }
  return payload;
}

const uploadCache = new Map(); // absPath -> url
async function uploadImage(absPath) {
  if (uploadCache.has(absPath)) return uploadCache.get(absPath);
  const buf = await readFile(absPath);
  const ext = path.extname(absPath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const form = new FormData();
  form.append("file", new Blob([buf], { type: mime }), path.basename(absPath));

  const res = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${APIKEY}` },
    body: form,
  });
  let payload = null;
  try {
    payload = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(payload?.error || `上传图片 HTTP ${res.status}`);
  }
  uploadCache.set(absPath, payload.url);
  return payload.url;
}

// 从一篇文章原始文本中抽取所有图片引用 src
function collectImageRefs(raw, coverImage) {
  const srcs = new Set();
  if (coverImage) srcs.add(coverImage);

  const mdRe = /!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g;
  let m;
  while ((m = mdRe.exec(raw)) !== null) srcs.add(m[1]);

  const imgRe = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  while ((m = imgRe.exec(raw)) !== null) srcs.add(m[1]);

  return [...srcs];
}

// 把文章里的本地图片上传并重写为线上 URL，返回 { raw, uploaded, skipped, newCover }
async function rewriteImages(raw, mdDir, coverImage, index) {
  const srcs = collectImageRefs(raw, coverImage);
  const replacements = []; // [src, url]
  let uploaded = 0;
  let skipped = 0;
  let newCover = null;

  for (const src of srcs) {
    const abs = resolveImageSrc(src, mdDir, index);
    if (!abs) {
      skipped++;
      continue;
    }
    try {
      const url = await uploadImage(abs);
      replacements.push([src, url]);
      uploaded++;
      if (src === coverImage) newCover = url; // 封面被重写
    } catch (e) {
      if (!QUIET) console.log(`    ⚠ 图片上传失败(${path.basename(abs)}): ${e.message}`);
      skipped++;
    }
  }

  let out = raw;
  for (const [src, url] of replacements) {
    out = out.split(src).join(url);
  }
  return { raw: out, uploaded, skipped, newCover };
}

// ---------- 主流程 ----------
async function main() {
  const files = await collectMarkdownFiles(DIR);
  if (files.length === 0) {
    console.log("未在目录中找到任何 Markdown 文章。");
    return;
  }
  if (!QUIET) console.log(`扫描到 ${files.length} 个 Markdown 文件。`);

  const items = [];
  for (const file of files) {
    const raw = await readFile(file, "utf8");
    const meta = extractMeta(file, raw);
    if (SKIP_DRAFTS && meta.isDraft) {
      if (!QUIET) console.log(`  ⊘ 跳过草稿: ${file}`);
      continue;
    }
    items.push({ file, meta });
  }

  if (items.length === 0) {
    console.log("没有需要同步的文章（草稿已被跳过）。");
    return;
  }

  // 图片索引（文章目录 + 额外资源目录）
  let imageIndex = null;
  if (!NO_IMAGES) {
    imageIndex = await buildImageIndex([DIR, ...ASSET_DIRS]);
    if (!QUIET)
      console.log(`图片索引建立完成，共发现 ${imageIndex.byPath.size} 个图片文件。`);
  }

  if (DRY_RUN) {
    console.log("\n[dry-run] 解析结果预览：");
    for (const { file, meta } of items) {
      console.log(`\n• ${file}`);
      console.log(`    标题 : ${meta.title}`);
      console.log(`    slug : ${meta.slug || "(由标题生成)"}`);
      console.log(`    描述 : ${meta.description || "(无)"}`);
      console.log(`    时间 : ${meta.date || "(无)"}`);
      console.log(`    关键字: ${meta.keywords || "(无)"}`);
      console.log(`    标签 : ${meta.tags.join(", ") || "(无)"}`);
      console.log(`    分类 : ${meta.categories.join(", ") || "(无)"}`);
      console.log(`    封面 : ${meta.coverImage || "(无)"}`);
      console.log(`    状态 : ${meta.status}`);
    }
    console.log(`\n共 ${items.length} 篇将同步（dry-run，未实际发送）。`);
    return;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  let imagesUploaded = 0;
  let imagesSkipped = 0;
  const errors = [];

  for (let i = 0; i < items.length; i += BATCH) {
    const slice = items.slice(i, i + BATCH);
    const posts = [];

    for (const { file, meta } of slice) {
      let raw = meta.raw;
      let coverImage = meta.coverImage;
      if (imageIndex) {
        const r = await rewriteImages(raw, path.dirname(file), meta.coverImage, imageIndex);
        raw = r.raw;
        imagesUploaded += r.uploaded;
        imagesSkipped += r.skipped;
        if (r.newCover) {
          coverImage = r.newCover;
        } else if (
          coverImage &&
          !/^(https?:|data:|#|\/api\/assets\/)/i.test(coverImage)
        ) {
          // 本地封面但未能找到对应文件，丢弃以免写入无效路径
          coverImage = null;
        }
      }
      posts.push({
        markdown: raw,
        title: meta.title,
        slug: meta.slug,
        description: meta.description,
        keywords: meta.keywords,
        tags: meta.tags,
        categories: meta.categories,
        coverImage,
        status: meta.status,
        date: meta.date,
      });
    }

    try {
      const result = await postBatch(posts);
      for (const r of result.results || []) {
        if (r.action === "created") created++;
        else if (r.action === "updated") updated++;
        if (!QUIET) console.log(`  ✓ ${r.action}  ${r.slug}`);
      }
      for (const e of result.errors || []) {
        failed++;
        errors.push(e.error);
        if (!QUIET) console.log(`  ✗ 失败[${e.index}]  ${e.error}`);
      }
    } catch (err) {
      failed += slice.length;
      errors.push(err.message);
      if (!QUIET)
        console.log(`  ✗ 批次(${i + 1}-${i + slice.length})出错: ${err.message}`);
    }
  }

  console.log(
    `\n同步完成：文章成功 ${created + updated}（新建 ${created} / 更新 ${updated}），失败 ${failed}。` +
      (imageIndex ? ` 图片上传 ${imagesUploaded}，跳过 ${imagesSkipped}（未找到本地文件或已为线上地址）。` : "")
  );
  if (errors.length) {
    console.log("失败原因（前 5 条）：");
    for (const e of errors.slice(0, 5)) console.log("  - " + e);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("同步中断：", e.message);
  process.exit(1);
});

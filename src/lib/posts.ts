// 文章同步相关工具：Markdown 编译、标签 / 分类关联、YAML frontmatter 解析、
// 以及供外部同步接口使用的 upsert 逻辑。供 /api/sync 复用，避免在路由中
// 重复新增 / 编辑文章时已有的标签关联逻辑。

import { marked } from "marked";
import { getDb } from "./db";
import { posts, categories, tags, postsToTags } from "./schema";
import { eq } from "drizzle-orm";
import { checkSlugUnique } from "./ai";
import { generateId } from "./id";
import { sanitizeMarkdownHtml } from "./sanitize";

const MARKED_OPTIONS = { gfm: true, breaks: true } as const;

// 将 Markdown 编译为前台渲染用的 HTML（经 sanitize 防 XSS）
export function compileMarkdown(markdown: string): string {
  try {
    const raw = marked.parse(markdown || "", MARKED_OPTIONS) as string;
    return sanitizeMarkdownHtml(raw);
  } catch {
    return sanitizeMarkdownHtml(`<p>${markdown || ""}</p>`);
  }
}

// 把标签名数组关联到指定文章（找不到则新建标签）
export async function linkTagsForPost(
  db: any,
  postId: string,
  tagNames: string[]
): Promise<void> {
  await db.delete(postsToTags).where(eq(postsToTags.postId, postId));

  for (const rawName of tagNames) {
    const cleanName = String(rawName ?? "").trim();
    if (!cleanName) continue;

    let tagRecord = await db
      .select()
      .from(tags)
      .where(eq(tags.name, cleanName))
      .limit(1);
    let tagId: string;

    if (tagRecord.length > 0) {
      tagId = tagRecord[0].id;
    } else {
      tagId = generateId();
      const cleanTagSlug = cleanName
        .toLowerCase()
        .replace(/[^a-zA-Z0-9一-龥]+/g, "-")
        .replace(/(^-|-$)/g, "");
      await db.insert(tags).values({
        id: tagId,
        name: cleanName,
        slug: cleanTagSlug || `tag-${tagId}`,
      });
    }

    await db
      .insert(postsToTags)
      .values({ postId, tagId })
      .onConflictDoNothing();
  }
}

// 按名称 / 别名解析分类；不存在时按默认色自动创建（同步场景下保留原文结构）
export async function resolveCategoryByName(
  db: any,
  name: string
): Promise<string | null> {
  const cleanName = String(name ?? "").trim();
  if (!cleanName) return null;

  const slug = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const existing = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const id = generateId();
  await db.insert(categories).values({
    id,
    name: cleanName,
    slug: slug || `category-${id}`,
    parentId: null,
    sortOrder: 0,
    color: "#cc785c",
  });
  return id;
}

// ---------- YAML frontmatter 解析（支持 Hugo / Hexo 常见写法） ----------

interface FrontmatterResult {
  data: Record<string, any>;
  body: string;
}

// 极简 YAML frontmatter 解析：支持 `key: value`、行内数组 `key: [a, b]`、
// 以及块列表：
//   key:
//     - a
//     - b
// 以及布尔 / 数字字面量。足以覆盖 Hugo / Hexo 的文章头信息。
export function parseFrontmatter(input: string): FrontmatterResult {
  const text = input.replace(/\r\n/g, "\n");
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: text };
  }

  const rawHeader = match[1];
  const body = match[2];
  const data: Record<string, any> = {};

  const lines = rawHeader.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith("#")) {
      i++;
      continue;
    }

    const kv = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!kv) {
      i++;
      continue;
    }

    const key = kv[1];
    let value = kv[2].trim();

    // 行内数组：[a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      i++;
      continue;
    }

    // 块列表：下一行以 "- " 缩进开头
    if (!value && i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
      const list: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1])) {
        i++;
        list.push(lines[i].replace(/^\s*-\s+/, "").trim().replace(/^["']|["']$/g, ""));
      }
      data[key] = list;
      continue;
    }

    // 去除引号
    value = value.replace(/^["']|["']$/g, "");

    // 布尔 / 数字
    if (value === "true") data[key] = true;
    else if (value === "false") data[key] = false;
    else if (value !== "" && !isNaN(Number(value))) data[key] = Number(value);
    else data[key] = value;

    i++;
  }

  return { data, body };
}

// 将传入的同步文章规整为内部字段
export interface SyncPostInput {
  title?: string;
  slug?: string;
  filename?: string; // 源文件名（如 my-post.md），无 meta slug 时用作 slug 回退
  content?: string; // Markdown 正文（不含 frontmatter）
  markdown?: string; // 含 YAML frontmatter 的原始 Markdown（Hugo / Hexo 典型格式）
  description?: string;
  keywords?: string | string[]; // SEO 关键词，逗号分隔或数组
  tags?: string[];
  categories?: string[];
  coverImage?: string | null;
  status?: "draft" | "published";
  date?: string; // ISO / 常见日期字符串
}

interface NormalizedPost {
  title: string;
  slug: string;
  contentBlocks: string;
  description: string;
  keywords: string;
  tags: string[];
  categoryId: string | null;
  coverImage: string | null;
  status: "draft" | "published";
  createdAt: Date;
}

// 规整单篇同步文章：优先使用结构化字段，否则从 markdown 的 frontmatter 解析
async function normalizeSyncPost(input: SyncPostInput): Promise<NormalizedPost> {
  let title = input.title?.trim() || "";
  let slug = input.slug?.trim() || "";
  let contentBlocks = input.content ?? "";
  let description = input.description?.trim() || "";
  let keywordsRaw = input.keywords;
  let keywords = Array.isArray(keywordsRaw)
    ? keywordsRaw.join(", ")
    : typeof keywordsRaw === "string"
      ? keywordsRaw.trim()
      : "";
  let tags: string[] = Array.isArray(input.tags) ? input.tags : [];
  let categories: string[] = Array.isArray(input.categories) ? input.categories : [];
  let coverImage = input.coverImage ?? null;
  let status: "draft" | "published" = input.status ?? "published";
  let createdAt = input.date ? new Date(input.date) : new Date();
  if (isNaN(createdAt.getTime())) createdAt = new Date();

  // 若提供了含 frontmatter 的 markdown，优先解析其中的元信息
  if ((!contentBlocks || !title) && input.markdown) {
    const { data, body } = parseFrontmatter(input.markdown);
    contentBlocks = body;
    if (!title && data.title) title = String(data.title);
    if (!slug && data.slug) slug = String(data.slug);
    if (!description && (data.description ?? data.summary)) {
      description = String(data.description ?? data.summary);
    }
    if (keywords.length === 0 && data.keywords) {
      keywords = Array.isArray(data.keywords)
        ? data.keywords.map(String).join(", ")
        : String(data.keywords);
    }
    if (tags.length === 0 && data.tags) {
      tags = Array.isArray(data.tags) ? data.tags.map(String) : [String(data.tags)];
    }
    const rawCats = data.categories ?? data.category;
    if (categories.length === 0 && rawCats) {
      categories = Array.isArray(rawCats) ? rawCats.map(String) : [String(rawCats)];
    }
    if (coverImage == null && (data.cover ?? data.image)) {
      coverImage = String(data.cover ?? data.image);
    }
    if (input.status == null && data.draft === true) status = "draft";
    if (isNaN(createdAt.getTime()) && data.date) {
      const d = new Date(String(data.date));
      if (!isNaN(d.getTime())) createdAt = d;
    }
  }

  if (!title) title = "无标题文章";
  if (!slug) {
    // slug 回退优先级：文件名（去扩展名）> 标题
    const fileBase = input.filename
      ? input.filename.replace(/\.(md|markdown)$/i, "")
      : "";
    slug = (fileBase || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  const db = await getDb();
  const categoryId = categories.length > 0 ? await resolveCategoryByName(db, categories[0]) : null;

  return {
    title,
    slug,
    contentBlocks,
    description,
    keywords,
    tags,
    categoryId,
    coverImage,
    status,
    createdAt,
  };
}

// 同步单篇文章：已存在同 slug 则更新，否则新建。返回操作结果。
export async function upsertPostFromSync(
  input: SyncPostInput
): Promise<{ action: "created" | "updated"; slug: string }> {
  const db = await getDb();
  const post = await normalizeSyncPost(input);
  const contentHtml = compileMarkdown(post.contentBlocks);

  // 先按原始 slug 查找是否已存在：存在则「更新」而非新建，保证重复导入幂等
  const existing = await db
    .select()
    .from(posts)
    .where(eq(posts.slug, post.slug))
    .limit(1);

  if (existing.length > 0) {
    const id = existing[0].id;
    await db
      .update(posts)
      .set({
        title: post.title,
        slug: post.slug,
        description: post.description,
        keywords: post.keywords,
        coverImage: post.coverImage,
        contentBlocks: post.contentBlocks,
        contentHtml,
        categoryId: post.categoryId,
        status: post.status,
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id));
    await linkTagsForPost(db, id, post.tags);
    return { action: "updated", slug: post.slug };
  }

  // 不存在：确保 slug 全局唯一后创建
  const uniqueSlug = await checkSlugUnique(post.slug);
  const id = generateId();
  await db.insert(posts).values({
    id,
    title: post.title,
    slug: uniqueSlug,
    description: post.description,
    keywords: post.keywords,
    coverImage: post.coverImage,
    contentBlocks: post.contentBlocks,
    contentHtml,
    categoryId: post.categoryId,
    status: post.status,
    createdAt: post.createdAt,
    updatedAt: new Date(),
  });
  await linkTagsForPost(db, id, post.tags);
  return { action: "created", slug: uniqueSlug };
}

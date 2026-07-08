import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";

// 1. 站点全局配置表
export const siteSettings = sqliteTable("site_settings", {
  key: text("key").primaryKey(), // 配置键名，如 'site_title', 'site_description'
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// 2. 分类表
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  parentId: text("parent_id"), // 父分类 ID，支持两级分类
  sortOrder: integer("sort_order").default(0),
  color: text("color").notNull().default("#cc785c"), // 分类颜色 HEX，前台列表 pill 用
});

// 3. 标签表
export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

// 4. 文章表
export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  keywords: text("keywords"), // SEO 关键词，逗号分隔
  coverImage: text("cover_image"),
  contentBlocks: text("content_blocks").notNull(), // Markdown 源文本
  contentHtml: text("content_html").notNull(),     // 前台渲染用 HTML
  categoryId: text("category_id").references(() => categories.id), // 单分类关联
  status: text("status", { enum: ["draft", "published", "trash"] }).default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  views: integer("views").default(0).notNull(),
});

// 5. 文章与标签的多对多中间表
export const postsToTags = sqliteTable("posts_to_tags", {
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
}));

// 6. API 密钥表（用于外部博客系统如 Hugo / Hexo 同步文章）
export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),        // 密钥备注名，便于管理后台识别
  keyPrefix: text("key_prefix").notNull(), // 明文前几位，仅用于后台展示（如 ink_8f3a）
  keyHash: text("key_hash").notNull(), // 完整密钥的 SHA-256 摘要，校验时比对
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

// 7. AI 模型表（可配置的模型列表：Cloudflare Workers AI / OpenAI 兼容）
export const aiModels = sqliteTable("ai_models", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),                 // 展示名，如 "Cloudflare Llama 3.1 8B"
  provider: text("provider", { enum: ["cloudflare", "openai", "openai-compatible"] }).notNull().default("cloudflare"),
  modelId: text("model_id").notNull(),          // 模型标识，如 @cf/meta/llama-3.1-8b-instruct / gpt-4o-mini
  baseUrl: text("base_url"),                     // OpenAI 兼容端点，如 https://api.openai.com/v1
  apiKey: text("api_key"),                       // 加密后的密钥（AES-256-GCM），明文绝不入库
  capabilities: text("capabilities").notNull().default("text"), // 逗号分隔：text / image
  isDefaultText: integer("is_default_text", { mode: "boolean" }).notNull().default(false),
  isDefaultImage: integer("is_default_image", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// 8. AI 提示词表（提示词库，分文章元数据 / 图片生成两类）
export const aiPrompts = sqliteTable("ai_prompts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),                 // 提示词名称
  kind: text("kind", { enum: ["text", "image"] }).notNull().default("text"),
  content: text("content").notNull(),           // 提示词正文
  modelId: text("model_id").references(() => aiModels.id), // 可选：绑定的默认模型
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false), // 该类型下的启用项（每个 kind 仅一个）
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

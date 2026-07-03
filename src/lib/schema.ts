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
  color: text("color").notNull().default("#C15F3C"), // 分类颜色 HEX，前台列表 pill 用
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
  coverImage: text("cover_image"),
  contentBlocks: text("content_blocks").notNull(), // BlockNote 编辑用 JSON
  contentHtml: text("content_html").notNull(),     // 前台渲染用 HTML
  categoryId: text("category_id").references(() => categories.id), // 单分类关联
  status: text("status", { enum: ["draft", "published", "trash"] }).default("draft"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// 5. 文章与标签的多对多中间表
export const postsToTags = sqliteTable("posts_to_tags", {
  postId: text("post_id").references(() => posts.id, { onDelete: "cascade" }),
  tagId: text("tag_id").references(() => tags.id, { onDelete: "cascade" }),
}, (t) => ({
  pk: primaryKey({ columns: [t.postId, t.tagId] }),
}));

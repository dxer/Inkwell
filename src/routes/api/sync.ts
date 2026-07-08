import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "../../lib/db";
import { apiKeys } from "../../lib/schema";
import { eq } from "drizzle-orm";
import { authenticateApiKey } from "../../lib/apikey";
import { upsertPostFromSync, type SyncPostInput } from "../../lib/posts";

// 外部博客同步入口（Hugo / Hexo 等）。
// 鉴权：Authorization: Bearer <apikey>，密钥经 SHA-256 后与数据库比对。
// 请求体：
//   { "posts": [ { "title", "slug", "content"(markdown), "description",
//                  "tags": [], "categories": [], "coverImage", "status",
//                  "date", "markdown"(含 frontmatter 的原始文本) }, ... ] }
// 其中 content 与 markdown 二选一；提供 markdown 时将从 YAML frontmatter
// 自动解析标题 / 别名 / 标签 / 分类 / 封面 / 草稿状态 / 日期。
export const Route = createFileRoute("/api/sync")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const apiKey = await authenticateApiKey(request);
        if (!apiKey) {
          return json({ error: "API Key 无效或未授权" }, 401);
        }

        // 记录使用时间
        const db = await getDb();
        await db
          .update(apiKeys)
          .set({ lastUsedAt: new Date() })
          .where(eq(apiKeys.id, apiKey.id));

        let body: any;
        try {
          body = await request.json();
        } catch {
          return json({ error: "请求体不是合法的 JSON" }, 400);
        }

        const postsInput: SyncPostInput[] = Array.isArray(body?.posts)
          ? body.posts
          : body && (body.title || body.markdown || body.content)
            ? [body]
            : [];

        if (postsInput.length === 0) {
          return json({ error: "未提供任何文章（期望 posts 数组）" }, 400);
        }

        const results: { slug: string; action: string }[] = [];
        const errors: { index: number; error: string }[] = [];

        for (let i = 0; i < postsInput.length; i++) {
          try {
            const res = await upsertPostFromSync(postsInput[i]);
            results.push(res);
          } catch (e: any) {
            errors.push({ index: i, error: e?.message || "未知错误" });
          }
        }

        return json({
          synced: results.length,
          failed: errors.length,
          results,
          errors,
        }, errors.length === 0 ? 200 : 207);
      },
    },
  },
});

function json(payload: any, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

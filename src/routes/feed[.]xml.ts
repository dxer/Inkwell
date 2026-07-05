import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "../lib/db";
import { posts, siteSettings } from "../lib/schema";
import { eq, desc } from "drizzle-orm";

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Detect current base URL from request context
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;

        try {
          const db = await getDb();

          // Get site settings
          const settingsList = await db.select().from(siteSettings);
          const settings: Record<string, string> = {};
          for (const s of settingsList) {
            settings[s.key] = s.value;
          }

          const siteTitle = settings.site_title || "智能无服务器博客";
          const siteSubtitle = settings.site_subtitle || "基于 TanStack Start & Cloudflare D1 架构";
          const siteDescription = settings.site_description || "现代化边缘全栈智能博客系统";

          // Fetch latest 20 published posts
          const latestPosts = await db
            .select({
              title: posts.title,
              slug: posts.slug,
              description: posts.description,
              createdAt: posts.createdAt,
            })
            .from(posts)
            .where(eq(posts.status, "published"))
            .orderBy(desc(posts.createdAt))
            .limit(20);

          // Build dynamic RSS 2.0 structure
          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${siteTitle}]]></title>
    <link>${baseUrl}/</link>
    <description><![CDATA[${siteSubtitle} - ${siteDescription}]]></description>
    <language>zh-CN</language>
    <generator>TanStack Start RSS Generator</generator>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml" />
    ${latestPosts
      .map((p) => {
        const postLink = `${baseUrl}/posts/${p.slug}`;
        const postDate = new Date(p.createdAt || new Date()).toUTCString();
        return `
    <item>
      <title><![CDATA[${p.title || "(无标题)"}]]></title>
      <link>${postLink}</link>
      <guid isPermaLink="true">${postLink}</guid>
      <pubDate>${postDate}</pubDate>
      <description><![CDATA[${p.description || ""}]]></description>
    </item>`;
      })
      .join("")}
  </channel>
</rss>`;

          return new Response(xml, {
            headers: {
              "Content-Type": "application/rss+xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch (e) {
          console.error("Failed to generate RSS feed", e);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});

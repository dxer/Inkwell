import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "../lib/db";
import { posts, categories } from "../lib/schema";
import { eq, desc } from "drizzle-orm";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Detect current base URL from request context
        const url = new URL(request.url);
        const baseUrl = `${url.protocol}//${url.host}`;
        
        try {
          const db = await getDb();
          
          // Fetch published articles
          const publishedPosts = await db
            .select({
              slug: posts.slug,
              updatedAt: posts.updatedAt,
              createdAt: posts.createdAt,
            })
            .from(posts)
            .where(eq(posts.status, "published"))
            .orderBy(desc(posts.createdAt));

          // Fetch categories
          const activeCategories = await db
            .select({
              slug: categories.slug,
            })
            .from(categories);

          // Build dynamic sitemap.xml structure
          const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  ${activeCategories
    .map(
      (c) => `
  <url>
    <loc>${baseUrl}/category/${c.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
    )
    .join("")}
  ${publishedPosts
    .map((p) => {
      const date = new Date(p.updatedAt || p.createdAt || new Date());
      const isoDate = date.toISOString().split("T")[0];
      return `
  <url>
    <loc>${baseUrl}/posts/${p.slug}</loc>
    <lastmod>${isoDate}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
    })
    .join("")}
</urlset>`;

          return new Response(xml, {
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch (e) {
          console.error("Failed to generate sitemap", e);
          return new Response("Internal Server Error", { status: 500 });
        }
      },
    },
  },
});

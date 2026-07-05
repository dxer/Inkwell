import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags, siteSettings } from '../lib/schema'
import { eq, sql } from 'drizzle-orm'
import { useTheme } from 'next-themes'
import { SiteLayout } from '@/components/site/site-layout'
import { categoryColor } from '@/lib/category-color'
import { ReadingProgress } from '@/components/site/reading-progress'
import { BackToTop } from '@/components/site/back-to-top'
import { TableOfContents } from '@/components/site/table-of-contents'
import { CodeBlockEnhancer } from '@/components/site/code-block-enhancer'
import { useState } from 'react'
import { List, Eye } from 'lucide-react'

export const getPostFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const { slug } = data;
    const db = await getDb();

    // Fetch post details
    const postResult = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        description: posts.description,
        coverImage: posts.coverImage,
        contentHtml: posts.contentHtml,
        views: posts.views,
        createdAt: posts.createdAt,
        status: posts.status,
        categoryName: categories.name,
        categorySlug: categories.slug,
        categoryColor: categories.color,
      })
      .from(posts)
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(eq(posts.slug, slug))
      .limit(1);

    const post = postResult[0];

    // Handle not found or unpublished
    if (!post || (post.status !== 'published' && process.env.NODE_ENV !== 'development')) {
      throw notFound();
    }

    // Increment views for published posts
    if (post.status === 'published') {
      try {
        await db.update(posts)
          .set({ views: sql`${posts.views} + 1` })
          .where(eq(posts.id, post.id));
        // Update local object to reflect the incremented count in current page render
        post.views = (post.views || 0) + 1;
      } catch (err) {
        console.error("Failed to increment view count", err);
      }
    }

    // Fetch tags for this post
    const postTags = await db
      .select({
        name: tags.name,
        slug: tags.slug,
      })
      .from(postsToTags)
      .innerJoin(tags, eq(postsToTags.tagId, tags.id))
      .where(eq(postsToTags.postId, post.id));

    // Fetch site settings
    const settingsList = await db.select().from(siteSettings);
    const settings: Record<string, string> = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }

    return {
      post,
      tags: postTags,
      settings,
    };
  });

export const Route = createFileRoute('/posts/$slug')({
  loader: async ({ params }) => {
    return await getPostFn({ data: { slug: params.slug } });
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    const settings = loaderData?.settings || {};
    const title = post ? `${post.title} - ${settings.site_title || "智能无服务器博客"}` : (settings.site_title || "智能无服务器博客");
    const description = post?.description || settings.site_description || "";
    const coverImage = post?.coverImage || "";

    return {
      meta: [
        { name: 'description', content: description },
        { title: title },
        // Open Graph / Facebook
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'article' },
        { property: 'og:image', content: coverImage },
        // Twitter
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: title },
        { name: 'twitter:description', content: description },
        { name: 'twitter:image', content: coverImage },
      ]
    };
  },
  component: PostDetail
})

function PostDetail() {
  const { post, tags, settings } = Route.useLoaderData() as { post: any; tags: any[]; settings: Record<string, string> }
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const catStyle = post.categoryName ? categoryColor(post.categoryColor, isDark) : null
  const date = new Date(post.createdAt)
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  const [showToc, setShowToc] = useState(false)

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "image": post.coverImage ? [post.coverImage] : [],
    "datePublished": date.toISOString(),
    "dateModified": post.updatedAt ? new Date(post.updatedAt).toISOString() : date.toISOString(),
    "description": post.description || "",
    "author": {
      "@type": "Person",
      "name": settings.site_title || "Author"
    }
  };

  return (
    <SiteLayout settings={settings} width="reading">
      {/* Scroll reading progress indicator */}
      <ReadingProgress />

      {/* Floating scroll to top button */}
      <BackToTop />

      {/* TOC Trigger Toggle Button - positioned right above BackToTop */}
      <button
        onClick={() => setShowToc(!showToc)}
        className="fixed bottom-20 right-6 z-40 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/95 transition-all duration-300 transform active:scale-90 flex items-center justify-center cursor-pointer"
        aria-label="切换目录大纲"
        title="目录大纲"
      >
        <List size={20} strokeWidth={2.5} />
      </button>

      {/* Drawer Table of Contents - slide-in from right, styled without scrollbars */}
      <aside
        className={`fixed top-24 right-6 z-35 w-[260px] max-h-[calc(100vh-8rem)] overflow-y-auto p-5 rounded-xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl transition-all duration-300 no-scrollbar ${
          showToc
            ? "opacity-100 translate-x-0 pointer-events-auto"
            : "opacity-0 translate-x-8 pointer-events-none"
        }`}
      >
        <TableOfContents />
      </aside>

      {/* Client-side syntax highlighting & Copy code block enhancements */}
      <CodeBlockEnhancer />

      {/* SEO structured metadata */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Main center aligned reading content */}
      <article className="min-w-0">
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-4 text-xs text-muted-foreground">
            {post.categoryName && catStyle && (
              <Link
                to="/category/$slug"
                params={{ slug: post.categorySlug || '' }}
                className="inline-flex items-center font-medium px-2 py-0.5 rounded-full hover:opacity-80 text-foreground transition-opacity"
                style={catStyle}
              >
                {post.categoryName}
              </Link>
            )}
            <time className="tabular-nums" dateTime={isoDate}>
              {isoDate}
            </time>
            <span className="flex items-center gap-1 tabular-nums">
              <Eye size={12} strokeWidth={2.5} />
              {post.views || 0} 次阅读
            </span>
          </div>

          <h1
            className="font-bold mb-4 tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-post-title)' }}
          >
            {post.title}
          </h1>

          {/* Tags displayed directly below the title */}
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mt-3.5">
              {tags.map(tag => (
                <Link
                  key={tag.slug}
                  to="/tag/$slug"
                  params={{ slug: tag.slug }}
                  className="text-xs px-2.5 py-0.5 bg-secondary/60 hover:bg-primary/10 hover:text-primary text-muted-foreground rounded-md border border-border/80 hover:border-primary/30 transition-all duration-300 font-medium cursor-pointer"
                >
                  #{tag.name}
                </Link>
              ))}
            </div>
          )}
        </header>

        {post.coverImage && (
          <div className="rounded-lg overflow-hidden border border-border aspect-[16/9] md:aspect-[21/9] mb-12 bg-secondary">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="prose prose-lg prose-neutral dark:prose-invert max-w-none leading-relaxed prose-reader
                        prose-headings:[font-family:var(--font-serif)] prose-headings:tracking-tight
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-img:rounded-lg prose-img:border prose-img:border-border
                        prose-blockquote:border-primary prose-blockquote:not-italic">
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </div>
      </article>
    </SiteLayout>
  )
}

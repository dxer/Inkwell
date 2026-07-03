import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags, siteSettings } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { useTheme } from 'next-themes'
import { SiteLayout } from '@/components/site/site-layout'
import { categoryColor } from '@/lib/category-color'

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

    return {
      meta: [
        { name: 'description', content: description },
        { title: title },
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

  return (
    <SiteLayout settings={settings} width="reading">
      <article>
        <header className="mb-10">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {post.categoryName && catStyle && (
              <Link
                to="/category/$slug"
                params={{ slug: post.categorySlug || '' }}
                className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
                style={catStyle}
              >
                {post.categoryName}
              </Link>
            )}
            <time className="text-xs text-muted-foreground tabular-nums" dateTime={isoDate}>
              {isoDate}
            </time>
          </div>

          <h1
            className="font-bold mb-4 tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-post-title)' }}
          >
            {post.title}
          </h1>
        </header>

        {post.coverImage && (
          <div className="rounded-lg overflow-hidden border border-border aspect-[16/9] md:aspect-[21/9] mb-12 bg-secondary">
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}

        <div className="prose prose-lg prose-neutral max-w-none leading-relaxed prose-reader
                        prose-headings:[font-family:var(--font-serif)] prose-headings:tracking-tight
                        prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                        prose-img:rounded-lg prose-img:border prose-img:border-border
                        prose-blockquote:border-primary prose-blockquote:not-italic">
          <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
        </div>

        {tags.length > 0 && (
          <footer className="border-t border-border pt-8 mt-14 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mr-2">文章标签</span>
            {tags.map(tag => (
              <Link
                key={tag.slug}
                to="/tag/$slug"
                params={{ slug: tag.slug }}
                className="text-xs px-3 py-1 bg-secondary hover:bg-primary hover:text-primary-foreground text-muted-foreground rounded-full border border-border hover:border-primary transition-colors"
              >
                #{tag.name}
              </Link>
            ))}
          </footer>
        )}
      </article>
    </SiteLayout>
  )
}

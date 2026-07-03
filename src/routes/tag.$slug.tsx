import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags, siteSettings } from '../lib/schema'
import { eq, and, desc, count, inArray } from 'drizzle-orm'
import { useTheme } from 'next-themes'
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'
import { categoryColor } from '@/lib/category-color'

type TagSearch = {
  page?: number
}

export const getTagPostsFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; page: number }) => data)
  .handler(async ({ data }) => {
    const { slug } = data;
    const pageNum = data.page;
    const db = await getDb();

    // Fetch tag
    const tagResult = await db
      .select()
      .from(tags)
      .where(eq(tags.slug, slug))
      .limit(1);

    const tag = tagResult[0];
    if (!tag) {
      throw notFound();
    }

    // Get site settings
    const settingsList = await db.select().from(siteSettings);
    const settings: Record<string, string> = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }
    const pageSize = Number(settings.page_size) || 10;

    // Get total posts count associated with this tag
    const totalPostsResult = await db
      .select({ val: count() })
      .from(posts)
      .innerJoin(postsToTags, eq(posts.id, postsToTags.postId))
      .where(and(eq(posts.status, 'published'), eq(postsToTags.tagId, tag.id)));
    const totalPosts = totalPostsResult[0]?.val || 0;

    // Get posts list
    const postsList = await db
      .select({
        id: posts.id,
        title: posts.title,
        slug: posts.slug,
        description: posts.description,
        coverImage: posts.coverImage,
        createdAt: posts.createdAt,
        categoryName: categories.name,
        categorySlug: categories.slug,
        categoryColor: categories.color,
      })
      .from(posts)
      .innerJoin(postsToTags, eq(posts.id, postsToTags.postId))
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(and(eq(posts.status, 'published'), eq(postsToTags.tagId, tag.id)))
      .orderBy(desc(posts.createdAt))
      .limit(pageSize)
      .offset((pageNum - 1) * pageSize);

    // Fetch tags for these posts
    const postIds = postsList.map((p: any) => p.id);
    const postTagsMap: Record<string, { name: string; slug: string }[]> = {};

    if (postIds.length > 0) {
      const postsToTagsList = await db
        .select({
          postId: postsToTags.postId,
          tagName: tags.name,
          tagSlug: tags.slug,
        })
        .from(postsToTags)
        .innerJoin(tags, eq(postsToTags.tagId, tags.id))
        .where(inArray(postsToTags.postId, postIds));

      for (const pt of postsToTagsList) {
        if (pt.postId) {
          if (!postTagsMap[pt.postId]) {
            postTagsMap[pt.postId] = [];
          }
          postTagsMap[pt.postId].push({ name: pt.tagName, slug: pt.tagSlug });
        }
      }
    }

    return {
      tag,
      posts: postsList.map((p: any) => ({
        ...p,
        tags: postTagsMap[p.id] || [],
      })),
      settings,
      pagination: {
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalPosts / pageSize),
        totalPosts,
      }
    };
  });

export const Route = createFileRoute('/tag/$slug')({
  validateSearch: (search: Record<string, unknown>): TagSearch => {
    return {
      page: search.page ? Number(search.page) : undefined,
    }
  },
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ params, deps: { page } }) => {
    return await getTagPostsFn({ data: { slug: params.slug, page: page || 1 } });
  },
  head: ({ loaderData }) => {
    const tag = loaderData?.tag;
    const settings = loaderData?.settings || {};
    const title = tag ? `标签：#${tag.name} - ${settings.site_title || "智能无服务器博客"}` : (settings.site_title || "智能无服务器博客");
    
    return {
      meta: [
        { name: 'description', content: `查看含有标签 #${tag?.name} 的所有文章` },
        { title: title },
      ]
    };
  },
  component: TagPage
})

function TagPage() {
  const { tag, posts, settings, pagination } = Route.useLoaderData() as {
    tag: any; posts: any[]; settings: Record<string, string>; pagination: any
  }

  return (
    <SiteLayout settings={settings} width="wide">
      <div className="border-b border-border pb-6 mb-10">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">标签归档</span>
        <h1
          className="font-bold mt-2"
          style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-archive-title)' }}
        >
          #{tag.name}
        </h1>
        <p className="text-xs text-muted-foreground mt-2">共 {pagination.totalPosts} 篇文章</p>
      </div>

      <section className="flex flex-col gap-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-xl bg-card/50">
            <p className="text-muted-foreground text-sm">暂无带有此标签的文章</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-6">
              {posts.map((post, index) => (
                <ArchiveCard key={post.id} post={post} activeTagSlug={tag.slug} index={index} />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-6 mt-4">
                <Link
                  disabled={pagination.page <= 1}
                  to="/tag/$slug"
                  params={{ slug: tag.slug }}
                  search={{ page: pagination.page - 1 }}
                  className={`inline-flex items-center min-h-[44px] px-4 border border-border rounded-md text-sm transition-colors ${pagination.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-secondary'}`}
                >
                  上一页
                </Link>
                <span className="text-sm text-muted-foreground tabular-nums">第 {pagination.page} / {pagination.totalPages} 页</span>
                <Link
                  disabled={pagination.page >= pagination.totalPages}
                  to="/tag/$slug"
                  params={{ slug: tag.slug }}
                  search={{ page: pagination.page + 1 }}
                  className={`inline-flex items-center min-h-[44px] px-4 border border-border rounded-md text-sm transition-colors ${pagination.page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:bg-secondary'}`}
                >
                  下一页
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  )
}

function ArchiveCard({ post, activeTagSlug, index }: { post: any; activeTagSlug: string; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const catStyle = post.categoryName ? categoryColor(post.categoryColor, isDark) : null
  const date = new Date(post.createdAt)
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 transition-colors duration-300 flex flex-col md:flex-row`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      {post.coverImage && (
        <div className="md:w-1/3 aspect-[16/10] md:aspect-auto overflow-hidden relative border-b md:border-b-0 md:border-r border-border bg-secondary">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500" />
        </div>
      )}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            {post.categoryName && catStyle && (
              <span
                className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full"
                style={catStyle}
              >
                {post.categoryName}
              </span>
            )}
            <time className="text-xs text-muted-foreground tabular-nums" dateTime={isoDate}>
              {isoDate}
            </time>
          </div>
          <h2 className="text-xl font-bold group-hover:text-primary transition-colors mb-2 leading-snug">
            <Link to="/posts/$slug" params={{ slug: post.slug }}>{post.title}</Link>
          </h2>
          {post.description && (
            <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">{post.description}</p>
          )}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((t: any) => (
              <Link
                key={t.slug}
                to="/tag/$slug"
                params={{ slug: t.slug }}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  t.slug === activeTagSlug
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'text-muted-foreground hover:text-primary border-border'
                }`}
              >
                #{t.name}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

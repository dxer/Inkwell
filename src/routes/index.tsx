import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, siteSettings, postsToTags } from '../lib/schema'
import { eq, desc, count, inArray } from 'drizzle-orm'
import { FileText } from 'lucide-react'
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'

type PostSearch = {
  page?: number
}

export const getHomeDataFn = createServerFn({ method: 'GET' })
  .validator((data: { page: number }) => data)
  .handler(async ({ data }) => {
    const pageNum = data.page;
    const db = await getDb();

    // Get site settings
    const settingsList = await db.select().from(siteSettings);
    const settings: Record<string, string> = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }
    const pageSize = Number(settings.page_size) || 10;

    // Get total posts count
    const totalPostsResult = await db
      .select({ val: count() })
      .from(posts)
      .where(eq(posts.status, 'published'));
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
      })
      .from(posts)
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.createdAt))
      .limit(pageSize)
      .offset((pageNum - 1) * pageSize);

    // Fetch tags for the posts
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

    // Fetch all categories
    const allCategories = await db
      .select()
      .from(categories)
      .orderBy(categories.sortOrder);

    // Fetch all tags
    const allTags = await db
      .select()
      .from(tags);

    return {
      posts: postsList.map((p: any) => ({
        ...p,
        tags: postTagsMap[p.id] || [],
      })),
      categories: allCategories,
      tags: allTags,
      settings,
      pagination: {
        page: pageNum,
        pageSize,
        totalPages: Math.ceil(totalPosts / pageSize),
        totalPosts,
      }
    }
  });

export const Route = createFileRoute('/')({
  validateSearch: (search: Record<string, unknown>): PostSearch => {
    return {
      page: search.page ? Number(search.page) : undefined,
    }
  },
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ deps: { page } }) => {
    return await getHomeDataFn({ data: { page: page || 1 } });
  },
  component: Home
})

function Home() {
  const { posts, categories, tags, settings, pagination } = Route.useLoaderData() as {
    posts: any[]; categories: any[]; tags: any[]; settings: Record<string, string>; pagination: any
  }

  // Header nav: categories first, then tags.
  const navItems = [
    ...categories.map((c: any) => ({ name: c.name, slug: c.slug, kind: 'category' as const })),
    ...tags.map((t: any) => ({ name: t.name, slug: t.slug, kind: 'tag' as const })),
  ]

  return (
    <SiteLayout settings={settings} navItems={navItems} width="reading">
      {posts.length === 0 ? (
        <div className="text-center py-24 border border-dashed border-border rounded-xl bg-card/40">
          <FileText size={28} className="text-muted-foreground/50 mx-auto" strokeWidth={1.5} />
          <p className="text-muted-foreground text-sm mt-3">暂无发布文章</p>
        </div>
      ) : (
        <>
          <div className="flex flex-col divide-y divide-border">
            {posts.map((post, index) => (
              <HomeArticle key={post.id} post={post} index={index} />
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <Link
                disabled={pagination.page <= 1}
                to="/"
                search={{ page: pagination.page - 1 }}
                className={`inline-flex items-center min-h-[44px] px-3 text-sm transition-colors ${pagination.page <= 1 ? 'opacity-40 cursor-not-allowed' : 'text-primary hover:underline'}`}
              >
                ← 上一页
              </Link>
              <span className="text-sm text-muted-foreground tabular-nums">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Link
                disabled={pagination.page >= pagination.totalPages}
                to="/"
                search={{ page: pagination.page + 1 }}
                className={`inline-flex items-center min-h-[44px] px-3 text-sm transition-colors ${pagination.page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed' : 'text-primary hover:underline'}`}
              >
                下一页 →
              </Link>
            </div>
          )}
        </>
      )}
    </SiteLayout>
  )
}

function HomeArticle({ post, index }: { post: any; index: number }) {
  const [ref, inView] = useInView<HTMLDivElement>()

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group py-8 first:pt-0`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-3">
        {post.categoryName && (
          <Link
            to="/category/$slug"
            params={{ slug: post.categorySlug || '' }}
            className="text-primary hover:underline font-medium"
          >
            {post.categoryName}
          </Link>
        )}
        {post.categoryName && <span className="text-border">·</span>}
        <time className="tabular-nums">
          {new Date(post.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
      </div>

      <h2
        className="font-bold leading-tight tracking-tight mb-3"
        style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-list-title)' }}
      >
        <Link to="/posts/$slug" params={{ slug: post.slug }} className="hover:text-primary transition-colors">
          {post.title}
        </Link>
      </h2>

      {post.coverImage && (
        <Link to="/posts/$slug" params={{ slug: post.slug }} className="block rounded-lg overflow-hidden border border-border mb-4 bg-secondary">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full aspect-[16/9] object-cover group-hover:scale-[1.01] transition-transform duration-500"
          />
        </Link>
      )}

      {post.description && (
        <p className="text-base text-muted-foreground line-clamp-2 mb-4 leading-relaxed">
          {post.description}
        </p>
      )}

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.tags.map((tag: any) => (
            <Link
              key={tag.slug}
              to="/tag/$slug"
              params={{ slug: tag.slug }}
              className="text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              #{tag.name}
            </Link>
          ))}
        </div>
      )}
    </article>
  )
}

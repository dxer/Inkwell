import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags, siteSettings } from '../lib/schema'
import { eq, and, desc, count, inArray } from 'drizzle-orm'
import { SiteLayout } from '@/components/site/site-layout'
import { useInView } from '@/lib/use-in-view'
import { useTheme } from 'next-themes'
import { categoryColor } from '@/lib/category-color'
import { ArrowRight, Eye, FileText } from 'lucide-react'

type CategorySearch = {
  page?: number
}

export const getCategoryPostsFn = createServerFn({ method: 'GET' })
  .validator((data: { slug: string; page: number }) => data)
  .handler(async ({ data }) => {
    const { slug } = data;
    const pageNum = data.page;
    const db = await getDb();

    // Fetch category
    const catResult = await db
      .select()
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    const category = catResult[0];
    if (!category) {
      throw notFound();
    }

    // Fetch subcategories
    const subCats = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.parentId, category.id));

    const catIds = [category.id, ...subCats.map((sc: any) => sc.id)];

    // Get site settings
    const settingsList = await db.select().from(siteSettings);
    const settings: Record<string, string> = {};
    for (const s of settingsList) {
      settings[s.key] = s.value;
    }
    const pageSize = Number(settings.page_size) || 10;

    // Get total posts count in this category tree
    const totalPostsResult = await db
      .select({ val: count() })
      .from(posts)
      .where(and(eq(posts.status, 'published'), inArray(posts.categoryId, catIds)));
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
      .leftJoin(categories, eq(posts.categoryId, categories.id))
      .where(and(eq(posts.status, 'published'), inArray(posts.categoryId, catIds)))
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
      category,
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

export const Route = createFileRoute('/category/$slug')({
  validateSearch: (search: Record<string, unknown>): CategorySearch => {
    return {
      page: search.page ? Number(search.page) : undefined,
    }
  },
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ params, deps: { page } }) => {
    return await getCategoryPostsFn({ data: { slug: params.slug, page: page || 1 } });
  },
  head: ({ loaderData }) => {
    const category = loaderData?.category;
    const settings = loaderData?.settings || {};
    const title = category ? `分类：${category.name} - ${settings.site_title || "智能无服务器博客"}` : (settings.site_title || "智能无服务器博客");
    
    return {
      meta: [
        { name: 'description', content: `查看分类 ${category?.name} 下的所有文章` },
        { title: title },
      ]
    };
  },
  component: CategoryPage
})

function CategoryPage() {
  const { category, posts, settings, pagination } = Route.useLoaderData() as {
    category: any; posts: any[]; settings: Record<string, string>; pagination: any
  }
 
  return (
    <SiteLayout settings={settings} width="reading">
      <div className="border-b border-border pb-6 mb-10">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">分类归档</span>
        <h1
          className="mt-2"
          style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--text-archive-title)' }}
        >
          {category.name}
        </h1>
        <p className="text-xs text-muted-foreground mt-2">共 {pagination.totalPosts} 篇文章</p>
      </div>

      <section className="flex flex-col">
        {posts.length === 0 ? (
          <div className="text-center py-24 border border-dashed border-border rounded-xl bg-card/40">
            <FileText size={28} className="text-muted-foreground/50 mx-auto" strokeWidth={1.5} />
            <p className="text-muted-foreground text-sm mt-3">该分类下暂无文章</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col divide-y divide-border">
              {posts.map((post, index) => (
                <ArchiveCard key={post.id} post={post} index={index} isLatest={index === 0 && pagination.page === 1} showCover={settings.show_cover_image !== "false"} showViews={settings.show_views !== "false"} />
              ))}
            </div>

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Link
                  disabled={pagination.page <= 1}
                  to="/category/$slug"
                  params={{ slug: category.slug }}
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
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  search={{ page: pagination.page + 1 }}
                  className={`inline-flex items-center min-h-[44px] px-3 text-sm transition-colors ${pagination.page >= pagination.totalPages ? 'opacity-40 cursor-not-allowed' : 'text-primary hover:underline'}`}
                >
                  下一页 →
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </SiteLayout>
  )
}

function ArchiveCard({ post, index, isLatest, showCover, showViews }: { post: any; index: number; isLatest: boolean; showCover: boolean; showViews: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const catStyle = post.categoryName ? categoryColor(post.categoryColor, isDark) : null
  const date = new Date(post.createdAt)
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

  return (
    <article
      ref={ref}
      className={`reveal ${inView ? 'is-visible' : ''} group -mx-3 sm:-mx-4 px-3 sm:px-4 rounded-lg py-8 first:pt-4 transition-colors duration-200 hover:bg-secondary/40`}
      style={{ ['--reveal-index' as string]: Math.min(index, 5) }}
    >
      {/* Meta row: LATEST badge + colored category pill + ISO date */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {isLatest && (
          <span className="inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ backgroundColor: 'hsl(14 53% 50% / 0.14)', color: 'hsl(14 53% 45%)' }}>
            Latest
          </span>
        )}
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
        {showViews && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 ml-1.5 tabular-nums">
            <Eye size={12} strokeWidth={2.5} />
            {post.views || 0}
          </span>
        )}
      </div>

      <h2
        className="leading-tight mb-3"
        style={{
          fontFamily: 'var(--font-serif)',
          fontSize: isLatest ? 'var(--text-post-title)' : 'var(--text-list-title)',
        }}
      >
        <Link to="/posts/$slug" params={{ slug: post.slug }} className="hover:text-primary transition-colors">
          {post.title}
        </Link>
      </h2>

      {post.coverImage && showCover && (
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map((tag: any) => (
              <Link
                key={tag.slug}
                to="/tag/$slug"
                params={{ slug: tag.slug }}
                className="text-xs text-muted-foreground hover:text-primary hover:border-primary/40 border border-transparent transition-colors px-2 py-0.5 rounded-full hover:bg-secondary"
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        )}
        <Link
          to="/posts/$slug"
          params={{ slug: post.slug }}
          className="inline-flex items-center gap-1 text-sm text-primary hover:gap-1.5 transition-all font-medium ml-auto"
        >
          继续阅读 <ArrowRight size={14} />
        </Link>
      </div>
    </article>
  )
}

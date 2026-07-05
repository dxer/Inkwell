import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags } from '../lib/schema'
import { count, eq, desc, sql } from 'drizzle-orm'
import { FileText, FileEdit, FileCheck, FolderTree, Tags, ArrowRight, PenLine, Settings, Eye, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const getAdminStatsFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = await getDb();

    // Total posts
    const totalPostsRes = await db.select({ val: count() }).from(posts);
    const totalPosts = totalPostsRes[0]?.val || 0;

    // Drafts
    const draftsRes = await db.select({ val: count() }).from(posts).where(eq(posts.status, 'draft'));
    const drafts = draftsRes[0]?.val || 0;

    // Published
    const publishedRes = await db.select({ val: count() }).from(posts).where(eq(posts.status, 'published'));
    const published = publishedRes[0]?.val || 0;

    // Total Views sum
    const totalViewsRes = await db.select({ val: sql<number>`sum(${posts.views})` }).from(posts);
    const totalViews = Number(totalViewsRes[0]?.val) || 0;

    // Categories
    const totalCategoriesRes = await db.select({ val: count() }).from(categories);
    const totalCategories = totalCategoriesRes[0]?.val || 0;

    // Tags
    const totalTagsRes = await db.select({ val: count() }).from(tags);
    const totalTags = totalTagsRes[0]?.val || 0;

    // 5 Recent Drafts
    const recentDrafts = await db
      .select({
        id: posts.id,
        title: posts.title,
        updatedAt: posts.updatedAt,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.status, 'draft'))
      .orderBy(desc(posts.updatedAt), desc(posts.createdAt))
      .limit(5);

    // Top 5 Popular Posts
    const popularPosts = await db
      .select({
        id: posts.id,
        title: posts.title,
        views: posts.views,
        createdAt: posts.createdAt,
      })
      .from(posts)
      .where(eq(posts.status, 'published'))
      .orderBy(desc(posts.views))
      .limit(5);

    return {
      stats: {
        totalPosts,
        drafts,
        published,
        totalViews,
        totalCategories,
        totalTags,
      },
      recentDrafts,
      popularPosts,
    };
  });

export const Route = createFileRoute('/admin/')({
  loader: async () => {
    return await getAdminStatsFn();
  },
  component: AdminIndex
})

function AdminIndex() {
  const { stats, recentDrafts, popularPosts } = Route.useLoaderData() as { stats: any; recentDrafts: any[]; popularPosts: any[] };

  const statCards = [
    { label: '全部文章', value: stats.totalPosts, icon: FileText, color: 'from-slate-500 to-slate-600' },
    { label: '已发布', value: stats.published, icon: FileCheck, color: 'from-emerald-500 to-emerald-600' },
    { label: '草稿箱', value: stats.drafts, icon: FileEdit, color: 'from-amber-500 to-amber-600' },
    { label: '总浏览量', value: stats.totalViews, icon: Eye, color: 'from-blue-500 to-blue-600' },
    { label: '分类 / 标签', value: `${stats.totalCategories} / ${stats.totalTags}`, icon: FolderTree, color: 'from-violet-500 to-violet-600' },
  ];

  return (
    <div className="p-6 md:p-8 lg:p-10 flex flex-col gap-7 w-full overflow-y-auto flex-1 min-h-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">工作台</h1>
          <p className="text-sm text-muted-foreground mt-0.5">博客系统全局概览</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" className="h-8 text-xs font-semibold shadow-sm">
            <Link to="/admin/posts/new">
              <PenLine size={13} className="mr-1.5" /> 撰写文章
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs">
            <Link to="/admin/settings">
              <Settings size={13} className="mr-1.5" /> 设置
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {statCards.map((s) => (
          <div key={s.label} className="relative p-4 rounded-xl border border-border/60 bg-card hover:border-border transition-all duration-300 group overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] uppercase font-bold text-muted-foreground/80 tracking-widest">{s.label}</span>
              <span className={`w-7 h-7 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center shadow-sm`}>
                <s.icon size={13} className="text-white" strokeWidth={2.25} />
              </span>
            </div>
            <p className="text-2xl font-extrabold tracking-tight font-mono text-foreground tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        {/* Popular Articles */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                <h3 className="text-sm font-semibold">热门文章 Top 5</h3>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                <Link to="/admin/posts" search={{ status: 'published' }}>
                  查看全部 <ArrowRight size={12} className="ml-1" />
                </Link>
              </Button>
            </div>
            <div className="p-4">
              {popularPosts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">暂无发布文章</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {(() => {
                    const maxViews = popularPosts[0]?.views || 1;
                    return popularPosts.map((post: any, idx: number) => {
                      const percentage = Math.max(Math.min((post.views / maxViews) * 100, 100), 2);
                      return (
                        <div key={post.id} className="p-3 rounded-lg hover:bg-secondary/30 transition-colors duration-200 flex flex-col gap-2.5 group/item">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 flex items-center gap-2.5">
                              <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${
                                idx === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' :
                                idx === 1 ? 'bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400' :
                                idx === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' :
                                'bg-secondary text-muted-foreground'
                              }`}>
                                {idx + 1}
                              </span>
                              <div className="min-w-0 flex-1">
                                <Link to="/admin/posts/$id" params={{ id: post.id }} className="text-sm font-medium block truncate hover:text-primary transition-colors">
                                  {post.title || "(无标题)"}
                                </Link>
                              </div>
                            </div>
                            <span className="text-xs font-semibold flex items-center gap-1 text-muted-foreground tabular-nums shrink-0">
                              <Eye size={11} className="text-muted-foreground/50" />
                              {post.views || 0}
                            </span>
                          </div>
                          <div className="w-full h-1 bg-secondary/60 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-primary/60 to-primary/30 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Drafts */}
        <div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
              <div className="flex items-center gap-2">
                <FileEdit size={15} className="text-amber-600" />
                <h3 className="text-sm font-semibold">最近草稿</h3>
              </div>
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground text-xs h-7">
                <Link to="/admin/posts" search={{ status: 'draft' }}>
                  全部 <ArrowRight size={12} className="ml-1" />
                </Link>
              </Button>
            </div>
            <div className="p-3">
              {recentDrafts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-10 text-center">草稿箱为空</p>
              ) : (
                <div className="flex flex-col gap-0.5">
                  {recentDrafts.map((draft: any) => (
                    <Link
                      key={draft.id}
                      to="/admin/posts/$id"
                      params={{ id: draft.id }}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors no-underline group/draft"
                    >
                      <div className="min-w-0 flex-1">
                        <span className="text-sm font-medium block truncate group-hover/draft:text-primary transition-colors">
                          {draft.title || "(无标题)"}
                        </span>
                        <span className="text-[10px] text-muted-foreground mt-0.5 block tabular-nums">
                          {new Date(draft.updatedAt || draft.createdAt).toLocaleDateString('zh-CN')}
                        </span>
                      </div>
                      <ArrowRight size={13} className="text-muted-foreground/30 group-hover/draft:text-primary shrink-0 transition-colors" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { posts, categories, tags, postsToTags } from '../lib/schema'
import { eq, and, desc, like, count } from 'drizzle-orm'
import { toast } from 'sonner'
import { PenLine, RotateCcw, Trash2, Send, FileEdit, FolderInput, Eye } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import React, { useState } from 'react'

export const updatePostStatusFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; status: 'draft' | 'published' | 'trash' }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    await db
      .update(posts)
      .set({ status: data.status, updatedAt: new Date() })
      .where(eq(posts.id, data.id));
    return { success: true };
  });

export const deletePostPermanentlyFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    // Junction table postsToTags has cascade onDelete, so deleting from posts is clean
    await db.delete(posts).where(eq(posts.id, data.id));
    return { success: true };
  });

type PostsSearch = {
  search?: string
  category?: string
  tag?: string
  status?: 'draft' | 'published' | 'trash' | 'all'
  page?: number
  pageSize?: number
}

export const getAdminPostsFn = createServerFn({ method: 'GET' })
  .validator((data: PostsSearch) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    const conditions = [];

    if (data.status && data.status !== 'all') {
      conditions.push(eq(posts.status, data.status));
    }

    if (data.category) {
      conditions.push(eq(posts.categoryId, data.category));
    }

    if (data.search) {
      conditions.push(like(posts.title, `%${data.search}%`));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const pageSize = Number(data.pageSize) > 0 ? Number(data.pageSize) : 15;
    const page = Number(data.page) > 0 ? Number(data.page) : 1;
    const offset = (page - 1) * pageSize;

    let query = db
      .select({
        id: posts.id,
        title: posts.title,
        status: posts.status,
        createdAt: posts.createdAt,
        updatedAt: posts.updatedAt,
        views: posts.views,
        categoryName: categories.name,
      })
      .from(posts)
      .leftJoin(categories, eq(posts.categoryId, categories.id));

    if (data.tag) {
      query = query
        .innerJoin(postsToTags, eq(posts.id, postsToTags.postId))
        .where(
          and(
            eq(postsToTags.tagId, data.tag),
            ...(conditions.length > 0 ? conditions : [])
          )
        ) as any;
    } else if (whereClause) {
      query = query.where(whereClause) as any;
    }

    const list = await query
      .orderBy(desc(posts.updatedAt), desc(posts.createdAt))
      .limit(pageSize)
      .offset(offset);

    // 总数统计（用于分页）
    const countWhere = data.tag
      ? and(eq(postsToTags.tagId, data.tag), ...(conditions.length > 0 ? conditions : []))
      : whereClause;
    const totalRows = data.tag
      ? await db
          .select({ val: count() })
          .from(posts)
          .innerJoin(postsToTags, eq(posts.id, postsToTags.postId))
          .where(countWhere as any)
      : await db
          .select({ val: count() })
          .from(posts)
          .where(whereClause as any);
    const total = totalRows[0]?.val || 0;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    // Fetch categories and tags for filter select options
    const allCategories = await db.select().from(categories).orderBy(categories.sortOrder);
    const allTags = await db.select().from(tags);

    return {
      posts: list,
      categories: allCategories,
      tags: allTags,
      filters: data,
      pagination: { page, pageSize, total, totalPages },
    };
  });

export const Route = createFileRoute('/admin/posts/')({
  validateSearch: (search: Record<string, unknown>): PostsSearch => {
    return {
      search: search.search ? String(search.search) : undefined,
      category: search.category ? String(search.category) : undefined,
      tag: search.tag ? String(search.tag) : undefined,
      status: (search.status as any) || 'all',
      page: search.page ? Number(search.page) : undefined,
      pageSize: search.pageSize ? Number(search.pageSize) : undefined,
    }
  },
  loaderDeps: ({ search }) => ({ ...search }),
  loader: async ({ deps }) => {
    return await getAdminPostsFn({ data: deps });
  },
  component: AdminPostsIndex
})

function AdminPostsIndex() {
  const { posts: list, categories: catList, tags: tagList, filters, pagination } = Route.useLoaderData() as {
    posts: any[]; categories: any[]; tags: any[]; filters: any; pagination: any
  };
  const navigate = useNavigate();

  const [search, setSearch] = useState(filters.search || "");
  const [status, setStatus] = useState<'draft' | 'published' | 'trash' | 'all'>((filters.status as any) || "all");
  const [category, setCategory] = useState(filters.category || "__all__");
  const [tag, setTag] = useState(filters.tag || "__all__");

  const goToPage = (next: number) => {
    navigate({
      to: ".",
      search: {
        search: search || undefined,
        status: status !== "all" ? (status as any) : undefined,
        category: category !== "__all__" ? category : undefined,
        tag: tag !== "__all__" ? tag : undefined,
        page: next > 1 ? next : undefined,
      }
    });
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: ".",
      search: {
        search: search || undefined,
        status: status !== "all" ? (status as any) : undefined,
        category: category !== "__all__" ? category : undefined,
        tag: tag !== "__all__" ? tag : undefined,
        page: undefined,
      }
    });
  };

  const handleResetFilters = () => {
    setSearch("");
    setStatus("all");
    setCategory("__all__");
    setTag("__all__");
    navigate({ to: ".", search: {} });
  };

  const handleUpdateStatus = async (id: string, newStatus: 'draft' | 'published' | 'trash') => {
    try {
      await updatePostStatusFn({ data: { id, status: newStatus } });
      toast.success("状态已更新");
      navigate({ to: "." });
    } catch (e: any) {
      toast.error("更新失败", { description: e.message });
    }
  };

  const handleDeletePermanently = async (id: string) => {
    try {
      await deletePostPermanentlyFn({ data: { id } });
      toast.success("文章已永久删除");
      navigate({ to: "." });
    } catch (e: any) {
      toast.error("删除失败", { description: e.message });
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'published') return <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white">已发布</Badge>;
    if (s === 'draft') return <Badge variant="secondary" className="text-amber-700 bg-amber-100 hover:bg-amber-100">草稿</Badge>;
    return <Badge variant="destructive">回收站</Badge>;
  };

  return (
    <div className="p-6 md:p-8 lg:p-10 pb-16 flex flex-col gap-5 w-full overflow-y-auto flex-1 min-h-0">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">文章管理</h1>
          <p className="text-sm text-muted-foreground mt-0.5">创建、编辑、筛选及管理文章</p>
        </div>
        <Button asChild size="sm" className="h-8 text-xs font-semibold shadow-sm">
          <Link to="/admin/posts/new"><PenLine size={13} className="mr-1" /> 撰写文章</Link>
        </Button>
      </div>

      {/* Filters Form */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <form onSubmit={handleFilterSubmit} className="flex flex-col sm:flex-row flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
            <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">标题搜索</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="按关键字搜索…" />
          </div>
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">状态</label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="published">已发布</SelectItem>
                <SelectItem value="draft">草稿</SelectItem>
                <SelectItem value="trash">回收站</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">分类</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">所有分类</SelectItem>
                {catList.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 min-w-[120px]">
            <label className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">标签</label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">所有标签</SelectItem>
                {tagList.map(t => (
                  <SelectItem key={t.id} value={t.id}>#{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="h-8 text-xs">应用筛选</Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={handleResetFilters}>重置</Button>
          </div>
        </form>
      </div>

      {/* Posts Table */}
      <Card className="py-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold">文章列表（{pagination?.total ?? 0}）</h3>
          </div>

          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>文章标题</TableHead>
                <TableHead>分类</TableHead>
                <TableHead>浏览量</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                    没有找到符合条件的文章
                  </TableCell>
                </TableRow>
              ) : (
                list.map(post => (
                  <TableRow key={post.id}>
                    <TableCell className="max-w-[240px] md:max-w-[320px] font-medium">
                      <div className="overflow-x-auto no-scrollbar whitespace-nowrap scroll-smooth py-1" title={post.title || undefined}>
                        <Link to="/admin/posts/$id" params={{ id: post.id }} className="hover:text-primary transition-colors inline-block">
                          {post.title || "(无标题)"}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {post.categoryName || <span className="italic">未分类</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      <span className="flex items-center gap-1.5">
                        <Eye size={13} className="text-muted-foreground/60" />
                        {post.views || 0}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {new Date(post.updatedAt || post.createdAt).toLocaleString('zh-CN')}
                    </TableCell>
                    <TableCell>{statusBadge(post.status)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <Button asChild variant="outline" size="xs">
                          <Link to="/admin/posts/$id" params={{ id: post.id }}>编辑</Link>
                        </Button>

                        {post.status !== 'published' && (
                          <Button variant="ghost" size="xs" className="text-emerald-700 hover:text-emerald-700 hover:bg-emerald-50" onClick={() => handleUpdateStatus(post.id, 'published')}>
                            <Send size={12} /> 发布
                          </Button>
                        )}
                        {post.status === 'published' && (
                          <Button variant="ghost" size="xs" onClick={() => handleUpdateStatus(post.id, 'draft')}>
                            <FileEdit size={12} /> 草稿
                          </Button>
                        )}

                        {post.status !== 'trash' ? (
                          <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleUpdateStatus(post.id, 'trash')}>
                            <Trash2 size={12} /> 回收站
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="xs" onClick={() => handleUpdateStatus(post.id, 'draft')}>
                              <RotateCcw size={12} /> 还原
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive hover:bg-destructive/10 font-semibold">
                                  永久删除
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>永久删除这篇文章？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    「{post.title || "(无标题)"}」将被彻底删除，此操作无法撤销。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>取消</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeletePermanently(post.id)}>确认删除</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-border/40">
              <span className="text-xs text-muted-foreground tabular-nums">
                共 {pagination.total} 篇 · 第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pagination.page <= 1}
                  onClick={() => goToPage(pagination.page - 1)}
                >
                  ← 上一页
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                >
                  下一页 →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

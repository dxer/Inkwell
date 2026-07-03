import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { categories, posts } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../lib/id'
import { toast } from 'sonner'
import { Loader2, Trash2, FolderTree, ChevronRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

// Server function to add category
export const addCategoryFn = createServerFn({ method: 'POST' })
  .validator((data: { name: string; slug: string; parentId: string | null; sortOrder: number; color: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    const id = generateId();

    // Clean slug
    const cleanSlug = data.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Validate color: must be #RRGGBB, else default to terracotta
    const cleanColor = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : "#C15F3C";

    await db.insert(categories).values({
      id,
      name: data.name.trim(),
      slug: cleanSlug || `category-${id}`,
      parentId: data.parentId || null,
      sortOrder: data.sortOrder || 0,
      color: cleanColor,
    });

    return { success: true };
  });

export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();
    
    // Safety check: nullify categories in posts first
    await db.update(posts).set({ categoryId: null }).where(eq(posts.categoryId, data.id));
    
    // Safety check: remove parent relationships for subcategories
    await db.update(categories).set({ parentId: null }).where(eq(categories.parentId, data.id));
    
    // Delete target category
    await db.delete(categories).where(eq(categories.id, data.id));
    
    return { success: true };
  });

export const listCategoriesFn = createServerFn({ method: 'GET' })
  .handler(async () => {
    const db = await getDb();
    const list = await db.select().from(categories).orderBy(categories.sortOrder);
    return { categories: list };
  });

export const Route = createFileRoute('/admin/categories')({
  loader: async () => {
    return await listCategoriesFn();
  },
  component: AdminCategories
})

function AdminCategories() {
  const { categories: list } = Route.useLoaderData() as { categories: any[] };
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [parentId, setParentId] = useState("__none__");
  const [sortOrder, setSortOrder] = useState("0");
  const [color, setColor] = useState("#C15F3C");
  const [saving, setSaving] = useState(false);

  // Get parent options (only those with no parentId themselves, to keep hierarchy to 2 levels max)
  const parentOptions = list.filter(c => !c.parentId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error("请填写名称和别名");
      return;
    }
    setSaving(true);
    try {
      await addCategoryFn({
        data: {
          name,
          slug,
          parentId: parentId === "__none__" ? null : parentId,
          sortOrder: parseInt(sortOrder) || 0,
          color,
        }
      });
      setName(""); setSlug(""); setParentId("__none__"); setSortOrder("0"); setColor("#C15F3C");
      toast.success("分类已添加");
      navigate({ to: "." });
    } catch (err: any) {
      toast.error("添加失败", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategoryFn({ data: { id } });
      toast.success("分类已删除");
      navigate({ to: "." });
    } catch (err: any) {
      toast.error("删除失败", { description: err.message });
    }
  };

  return (
    <div className="p-6 md:p-10 flex flex-col gap-6 max-w-5xl w-full">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">分类管理</h1>
        <p className="text-sm text-muted-foreground mt-1">创建和维护文章的主分类导航</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Add Category Form */}
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle className="text-base">添加新分类</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-name">分类名称</Label>
                <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：前端开发" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-slug">路径别名 (Slug)</Label>
                <Input id="cat-slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="例如：frontend" />
              </div>
              <div className="flex flex-col gap-2">
                <Label>父级分类</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(无, 作为一级分类)</SelectItem>
                    {parentOptions.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-order">排序权重</Label>
                <Input id="cat-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} placeholder="越小越靠前" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-color">分类颜色</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="cat-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-border bg-background p-1"
                    aria-label="选择分类颜色"
                  />
                  <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#C15F3C" className="font-mono text-sm max-w-[140px]" />
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={{ backgroundColor: `${color}22`, color }}
                  >
                    预览
                  </span>
                </div>
              </div>
              <Button type="submit" disabled={saving} className="mt-1">
                {saving ? (<><Loader2 size={15} className="animate-spin" /> 添加中…</>) : "添加分类"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Categories List */}
        <Card className="lg:col-span-2 shadow-none">
          <CardHeader>
            <CardTitle className="text-base">分类目录</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderTree size={28} className="text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground mt-3">暂无分类，在左侧创建</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {parentOptions.map(parent => {
                  const children = list.filter(c => c.parentId === parent.id);
                  return (
                    <div key={parent.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between p-3 rounded-md border border-border bg-secondary/30">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="h-3 w-3 rounded-full shrink-0 border border-border" style={{ backgroundColor: parent.color }} aria-hidden="true" />
                          <span className="text-sm font-semibold truncate">{parent.name}</span>
                          <Badge variant="secondary" className="font-mono text-[10px] font-normal">/category/{parent.slug}</Badge>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[11px] text-muted-foreground tabular-nums">排序 {parent.sortOrder}</span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 size={14} />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>删除「{parent.name}」？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  该分类下的文章将转为未分类状态，子分类将提升为一级分类。此操作不可撤销。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(parent.id)}>确认删除</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>

                      {children.length > 0 && (
                        <div className="pl-4 ml-3 border-l border-border flex flex-col gap-1.5">
                          {children.map(child => (
                            <div key={child.id} className="flex items-center justify-between p-2.5 rounded-md border border-border/70 bg-background">
                              <div className="flex items-center gap-2 min-w-0">
                                <ChevronRight size={13} className="text-muted-foreground shrink-0" />
                                <span className="h-2.5 w-2.5 rounded-full shrink-0 border border-border" style={{ backgroundColor: child.color }} aria-hidden="true" />
                                <span className="text-sm truncate">{child.name}</span>
                                <Badge variant="outline" className="font-mono text-[10px] font-normal">/category/{child.slug}</Badge>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] text-muted-foreground tabular-nums">排序 {child.sortOrder}</span>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                      <Trash2 size={14} />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>删除「{child.name}」？</AlertDialogTitle>
                                      <AlertDialogDescription>该分类下的文章将转为未分类状态。此操作不可撤销。</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>取消</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDelete(child.id)}>确认删除</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

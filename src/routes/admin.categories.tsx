import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getDb } from '../lib/db'
import { categories, posts } from '../lib/schema'
import { eq } from 'drizzle-orm'
import { generateId } from '../lib/id'
import { toast } from 'sonner'
import { Loader2, Trash2, FolderTree, ChevronRight, Edit } from 'lucide-react'
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
  .validator((data: { name: string; slug: string; color: string }) => data)
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
      parentId: null,
      sortOrder: 0,
      color: cleanColor,
    });

    return { success: true };
  });

// Server function to update category
export const updateCategoryFn = createServerFn({ method: 'POST' })
  .validator((data: { id: string; name: string; slug: string; color: string }) => data)
  .handler(async ({ data }) => {
    const db = await getDb();

    // Clean slug
    const cleanSlug = data.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Validate color
    const cleanColor = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : "#C15F3C";

    await db.update(categories).set({
      name: data.name.trim(),
      slug: cleanSlug || `category-${data.id}`,
      parentId: null,
      sortOrder: 0,
      color: cleanColor,
    }).where(eq(categories.id, data.id));

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
  const [color, setColor] = useState("#C15F3C");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleCancelEdit = () => {
    setEditingId(null);
    setName("");
    setSlug("");
    setColor("#C15F3C");
  };

  const handleStartEdit = (category: any) => {
    setEditingId(category.id);
    setName(category.name);
    setSlug(category.slug);
    setColor(category.color || "#C15F3C");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) {
      toast.error("请填写名称和别名");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCategoryFn({
          data: {
            id: editingId,
            name,
            slug,
            color,
          }
        });
        toast.success("分类已更新");
      } else {
        await addCategoryFn({
          data: {
            name,
            slug,
            color,
          }
        });
        toast.success("分类已添加");
      }
      handleCancelEdit();
      navigate({ to: "." });
    } catch (err: any) {
      toast.error(editingId ? "更新失败" : "添加失败", { description: err.message });
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
    <div className="p-6 md:p-8 lg:p-10 flex flex-col gap-5 w-full overflow-y-auto flex-1 min-h-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">分类管理</h1>
        <p className="text-sm text-muted-foreground mt-0.5">创建和维护文章的主分类</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Add Category Form */}
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold">{editingId ? "修改分类" : "添加新分类"}</h3>
          </div>
          <div className="p-5">
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
              <div className="flex gap-2 mt-1">
                <Button type="submit" disabled={saving} className="flex-1">
                  {saving ? (<><Loader2 size={15} className="animate-spin" /> 保存中…</>) : editingId ? "保存修改" : "添加分类"}
                </Button>
                {editingId && (
                  <Button type="button" variant="outline" onClick={handleCancelEdit}>
                    取消
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Categories List */}
        <div className="lg:col-span-2 rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border/40">
            <h3 className="text-sm font-semibold">分类目录</h3>
          </div>
          <div className="p-4">
            {list.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderTree size={28} className="text-muted-foreground/50" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground mt-3">暂无分类，在左侧创建</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {list.map(category => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-3.5 rounded-lg border border-border/60 transition-all duration-200 hover:bg-secondary/20 hover:border-border"
                    style={{
                      borderLeft: `3px solid ${category.color}`,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pl-1.5">
                      <span className="text-sm font-semibold truncate text-foreground/90">{category.name}</span>
                      <Badge variant="secondary" className="font-mono text-[10px] font-normal opacity-80">/category/{category.slug}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleStartEdit(category)}
                        className="text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                        title="修改分类"
                      >
                        <Edit size={14} />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 size={14} />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>删除「{category.name}」？</AlertDialogTitle>
                            <AlertDialogDescription>
                              该分类下的文章将转为未分类状态。此操作不可撤销。
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(category.id)}>确认删除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
